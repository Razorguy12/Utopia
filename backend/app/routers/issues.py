from datetime import datetime, timedelta
from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..database import get_db
from ..models.issue import Issue, ComplaintConfirmation, ComplaintComment, CitizenUser, CommentEvidence, ComplaintVerification
from ..models.project import Project
from ..models.contractor import Contractor, ContractorScoringRule, MunicipalSetting
from ..models.media import MediaAttachment
from ..schemas.issue import IssueIn, IssueReplyIn, QuestionIn
from ..services.auth import get_current_user, get_optional_user
import os
from collections import defaultdict, deque
import time
import uuid
from ..services.media_storage import token_digest, safe_stored_path

router = APIRouter(prefix="/api", tags=["Citizen Issues & Inquiries"])
COMMUNITY_THRESHOLD = max(1, int(os.getenv('COMMUNITY_CORROBORATION_THRESHOLD', '5')))
_community_requests = defaultdict(deque)

def _community_identity(request: Request, response: Response, user: Optional[dict]) -> tuple[Optional[int], str]:
    citizen_id = user.get('citizen_id') if user and user.get('role') == 'citizen' else None
    raw = request.headers.get('x-community-id') or request.cookies.get('utopia_community_id')
    try:
        anonymous_id = str(uuid.UUID(raw)) if raw else str(uuid.uuid4())
    except (ValueError, AttributeError):
        raise HTTPException(400, 'Invalid anonymous community session. Refresh the page and try again.')
    response.set_cookie('utopia_community_id', anonymous_id, max_age=31536000, httponly=True, secure=request.url.scheme == 'https', samesite='lax')
    return citizen_id, anonymous_id

def _rate_limit(request: Request, user: Optional[dict], anonymous_id: str, limit: int=20):
    key=str(user.get('citizen_id') if user and user.get('role') == 'citizen' else anonymous_id)+':'+(request.client.host if request.client else 'unknown')
    now=time.time(); q=_community_requests[key]
    while q and now-q[0]>60: q.popleft()
    if len(q)>=limit: raise HTTPException(429,'Community actions are temporarily rate limited. Please try again shortly.')
    q.append(now)

class CommentIn(BaseModel):
    comment: str = Field(min_length=3, max_length=2000)
    parent_comment_id: Optional[int] = None
    attachments: list[dict] = Field(default_factory=list, max_length=5)

class VerificationIn(BaseModel):
    decision: str
    note: str = Field(min_length=8, max_length=2000)
    severity: Optional[Literal['minor','major','critical']] = None

class ReviewActionIn(BaseModel):
    action: Literal['Under Review','Additional Evidence Requested']
    note: str = Field(min_length=5,max_length=2000)

def _citizen_id(user: dict) -> int:
    if user.get('role') != 'citizen' or not user.get('citizen_id'):
        raise HTTPException(403, 'A citizen account is required for this action.')
    return int(user['citizen_id'])

def _community_count(s: Session, issue_id: int) -> int:
    return s.query(ComplaintConfirmation).filter_by(issue_id=issue_id, is_active=True).count()

def community_threshold(s: Session) -> int:
    setting=s.get(MunicipalSetting,'community_confirmation_threshold')
    return max(1,int(setting.value)) if setting else COMMUNITY_THRESHOLD

def _comment_out(c: ComplaintComment):
    return {'id': c.id, 'issue_id': c.issue_id, 'comment': c.comment, 'created_at': c.created_at.isoformat(),
            'updated_at': c.updated_at.isoformat(), 'is_hidden': c.is_hidden,
            'parent_comment_id': c.parent_comment_id,
            'evidence': [_public_media(e.media) for e in c.evidence if e.media]}

@router.get('/issues')
def list_issues(
    request: Request,
    response: Response,
    pincode: Optional[str] = None,
    locality: Optional[str] = None,
    department: Optional[str] = None,
    s: Session = Depends(get_db),
    user: Optional[dict] = Depends(get_optional_user)
):
    citizen_id, anonymous_id = _community_identity(request, response, user)
    q = s.query(Issue)
    if pincode:
        q = q.filter(Issue.pincode == pincode)
    if locality:
        q = q.filter(Issue.locality.ilike(f"%{locality}%"))
    if department:
        q = q.filter(Issue.department.ilike(f"%{department}%"))
    
    issues = q.order_by(Issue.created.desc()).all()
    out = []
    now = datetime.utcnow()
    for i in issues:
        project = s.get(Project, i.project_id) if i.project_id else None
        days_elapsed = (now - i.created).days
        is_escalated = (i.status not in ['Resolved', 'Answered']) and (days_elapsed >= 3)
        out.append({
            'id': i.id,
            'ref': i.ref,
            'project_id': i.project_id,
            'kind': i.kind,
            'department': i.department,
            'message': i.message,
            'status': i.status,
            'severity': i.severity,
            'locality': i.locality,
            'pincode': i.pincode,
            'is_question': i.is_question,
            'intimated_in_advance': i.intimated_in_advance,
            'is_escalated': is_escalated,
            'days_elapsed': days_elapsed,
            'created': i.created.isoformat(),
            'official_reply': i.official_reply,
            'replied_at': i.replied_at.isoformat() if i.replied_at else None,
            'replied_by': i.replied_by,
            'attachments': [_public_media(m) for m in i.attachments],
            'confirmation_count': _community_count(s, i.id),
            'community_corroborated': _community_count(s, i.id) >= community_threshold(s),
            'community_threshold': community_threshold(s),
            'official_verification': i.official_verification,
            'confirmed_by_me': bool(s.query(ComplaintConfirmation).filter(
                ComplaintConfirmation.issue_id==i.id,
                ComplaintConfirmation.is_active.is_(True),
                or_(ComplaintConfirmation.anonymous_id==anonymous_id, ComplaintConfirmation.citizen_user_id==citizen_id) if citizen_id else ComplaintConfirmation.anonymous_id==anonymous_id
            ).first()),
            'comment_count': s.query(ComplaintComment).filter_by(issue_id=i.id,is_hidden=False).count(),
            'verification_reason': i.verification_reason,
            'verified_at': i.verified_at.isoformat() if i.verified_at else None,
            'project_title': project.title if project else None,
            'contractor': project.contractor if project else None
        })
    return out

@router.post('/issues')
def create_issue(data: IssueIn, request: Request, response: Response, user: Optional[dict] = Depends(get_optional_user), s: Session = Depends(get_db)):
    citizen_id, anonymous_id = _community_identity(request,response,user)
    count = s.query(Issue).count()
    
    # Auto-resolve department, locality, and pincode if associated with a project
    dept = data.department
    locality = data.locality or 'Chennai'
    pincode = data.pincode
    
    if data.project_id:
        proj = s.get(Project, data.project_id)
        if proj:
            if not dept:
                dept = proj.department
            if not pincode:
                pincode = proj.pincode
            if not locality or locality == 'Chennai':
                locality = proj.locality

    if not dept:
        k = f"{data.kind or ''} {data.message or ''}".lower()
        if "water" in k or "pipe" in k or "sewage" in k or "meter" in k:
            dept = "Chennai Metro Water"
        elif "power" in k or "electric" in k or "cable" in k or "wire" in k or "tangedco" in k or "transformer" in k:
            dept = "TANGEDCO"
        elif "stormwater" in k or "flood" in k or "swd" in k or "drain" in k or "culvert" in k:
            dept = "Stormwater Drainage"
        elif "road" in k or "pothole" in k or "asphalt" in k or "tar" in k or "walkway" in k or "pavement" in k:
            dept = "GCC Roads & Bridges"
        else:
            dept = "Greater Chennai Corporation"

    prefix = "Q" if data.is_question else "CGI"
    ref = f'{prefix}-{(locality[:4] if locality else "CHEN").upper()}-{count + 1:04d}'

    media_items = []
    if data.attachments:
        refs = {ref.media_id: ref.upload_token for ref in data.attachments}
        if len(refs) != len(data.attachments):
            raise HTTPException(400, "The same evidence file cannot be attached twice.")
        media_items = s.query(MediaAttachment).filter(
            MediaAttachment.id.in_(refs), MediaAttachment.issue_id.is_(None)
        ).with_for_update().all()
        if len(media_items) != len(refs):
            raise HTTPException(400, "One or more evidence uploads expired or were already used. Please upload them again.")
        for media in media_items:
            if media.upload_token_hash != token_digest(refs[media.id]):
                raise HTTPException(403, "An evidence upload could not be verified.")
            try:
                safe_stored_path(media.storage_path)
            except FileNotFoundError as exc:
                raise HTTPException(400, "An evidence file is no longer available. Please upload it again.") from exc

    issue = Issue(
        ref=ref,
        project_id=data.project_id,
        submitter_user_id=(user.get('citizen_id') if user and user.get('role') == 'citizen' else None),
        submitter_community_id=anonymous_id,
        kind=data.kind,
        department=dept,
        message=data.message,
        phone=data.phone,
        email=data.email,
        severity=data.severity or 'Normal',
        locality=locality,
        pincode=pincode,
        status='Submitted',
        is_question=bool(data.is_question),
        intimated_in_advance=bool(data.intimated_in_advance)
    )
    try:
        s.add(issue)
        s.flush()
        for media in media_items:
            media.issue_id = issue.id
            media.upload_token_hash = ""
        s.commit()
        s.refresh(issue)
    except Exception:
        s.rollback()
        raise
    return {
        'id': issue.id,
        'ref': issue.ref,
        'department': issue.department,
        'attachments': [_public_media(m) for m in issue.attachments],
        'message': f'{"Question" if issue.is_question else "Issue"} registered and routed to {issue.department}. Reference: {ref}'
    }


def _public_media(media: MediaAttachment) -> dict:
    return {
        "media_id": media.id,
        "media_type": media.media_type,
        "mime_type": media.mime_type,
        "filename": media.original_filename,
        "size": media.file_size,
        "url": f"/api/media/{media.id}",
        "created_at": media.created_at.isoformat(),
    }

@router.get('/issues/{issue_id}/confirmations')
def list_confirmations(issue_id: int, request: Request, response: Response, user: Optional[dict] = Depends(get_optional_user), s: Session = Depends(get_db)):
    if not s.get(Issue, issue_id): raise HTTPException(404, 'Issue not found')
    cid, anonymous_id = _community_identity(request,response,user)
    active = s.query(ComplaintConfirmation).filter_by(issue_id=issue_id, is_active=True).all()
    return {'count': len(active), 'confirmed_by_me': any((cid and c.citizen_user_id == cid) or c.anonymous_id == anonymous_id for c in active),
            'citizens': [{'resident': f'Resident {n+1}', 'since': c.created_at.isoformat()} for n, c in enumerate(active)]}

@router.post('/issues/{issue_id}/confirmations')
def confirm_issue(issue_id: int, request: Request, response: Response, user: Optional[dict] = Depends(get_optional_user), s: Session = Depends(get_db)):
    cid, anonymous_id = _community_identity(request,response,user)
    _rate_limit(request,user,anonymous_id)
    issue = s.get(Issue, issue_id)
    if not issue: raise HTTPException(404, 'Issue not found')
    if issue.is_question: raise HTTPException(409, 'Community confirmations apply to grievances, not questions.')
    if (cid and issue.submitter_user_id == cid) or issue.submitter_community_id == anonymous_id: raise HTTPException(403, 'You cannot confirm your own complaint.')
    identity_filter=or_(ComplaintConfirmation.anonymous_id==anonymous_id,ComplaintConfirmation.citizen_user_id==cid) if cid else ComplaintConfirmation.anonymous_id==anonymous_id
    row = s.query(ComplaintConfirmation).filter(ComplaintConfirmation.issue_id==issue_id,identity_filter).with_for_update().first()
    if row:
        row.is_active = True; row.updated_at = datetime.utcnow(); row.anonymous_id=anonymous_id
        if cid: row.citizen_user_id=cid
    else:
        row = ComplaintConfirmation(issue_id=issue_id, citizen_user_id=cid, anonymous_id=anonymous_id, is_active=True)
        s.add(row)
    try:
        s.commit()
    except Exception:
        s.rollback()
        row = s.query(ComplaintConfirmation).filter(ComplaintConfirmation.issue_id==issue_id,identity_filter).first()
        if not row: raise HTTPException(409, 'Confirmation could not be recorded. Please retry.')
        row.is_active = True; row.updated_at = datetime.utcnow(); s.commit()
    count = _community_count(s, issue_id)
    return {'count': count, 'confirmed_by_me': True, 'community_corroborated': count >= community_threshold(s)}

@router.delete('/issues/{issue_id}/confirmations/me')
def undo_confirmation(issue_id: int, request: Request, response: Response, user: Optional[dict] = Depends(get_optional_user), s: Session = Depends(get_db)):
    cid, anonymous_id = _community_identity(request,response,user)
    _rate_limit(request,user,anonymous_id)
    identity_filter=or_(ComplaintConfirmation.anonymous_id==anonymous_id,ComplaintConfirmation.citizen_user_id==cid) if cid else ComplaintConfirmation.anonymous_id==anonymous_id
    row = s.query(ComplaintConfirmation).filter(ComplaintConfirmation.issue_id==issue_id,identity_filter,ComplaintConfirmation.is_active.is_(True)).with_for_update().first()
    if row: row.is_active = False; row.updated_at = datetime.utcnow(); s.commit()
    count = _community_count(s, issue_id)
    return {'count': count, 'confirmed_by_me': False, 'community_corroborated': count >= community_threshold(s)}

@router.get('/issues/{issue_id}/comments')
def list_comments(issue_id: int, s: Session = Depends(get_db)):
    if not s.get(Issue, issue_id): raise HTTPException(404, 'Issue not found')
    rows = s.query(ComplaintComment).filter_by(issue_id=issue_id, is_hidden=False).order_by(ComplaintComment.created_at.asc()).all()
    return [_comment_out(c) for c in rows]

@router.post('/issues/{issue_id}/comments')
def add_comment(issue_id: int, payload: CommentIn, request: Request, response: Response, user: Optional[dict] = Depends(get_optional_user), s: Session = Depends(get_db)):
    cid, anonymous_id = _community_identity(request,response,user)
    _rate_limit(request,user,anonymous_id,10)
    if not s.get(Issue, issue_id): raise HTTPException(404, 'Issue not found')
    parent = s.get(ComplaintComment,payload.parent_comment_id) if payload.parent_comment_id else None
    if payload.parent_comment_id and (not parent or parent.issue_id!=issue_id or parent.is_hidden): raise HTTPException(400,'Reply must belong to this complaint discussion.')
    comment = ComplaintComment(issue_id=issue_id, citizen_user_id=cid, anonymous_id=anonymous_id, parent_comment_id=payload.parent_comment_id, comment=payload.comment.strip())
    if not comment.comment: raise HTTPException(422, 'Comment cannot be empty.')
    s.add(comment); s.flush()
    if payload.attachments:
        for item in payload.attachments:
            media = s.query(MediaAttachment).filter_by(id=item.get('media_id'), issue_id=None).with_for_update().first()
            if not media or media.upload_token_hash != token_digest(item.get('upload_token', '')):
                s.rollback(); raise HTTPException(400, 'Evidence upload expired or could not be verified.')
            safe_stored_path(media.storage_path)
            s.add(CommentEvidence(comment_id=comment.id, media_id=media.id))
            media.upload_token_hash = ''
    s.commit(); s.refresh(comment)
    return _comment_out(comment)

@router.delete('/issues/{issue_id}/comments/{comment_id}')
def delete_comment(issue_id: int, comment_id: int, request: Request, response: Response, user: Optional[dict] = Depends(get_optional_user), s: Session = Depends(get_db)):
    cid, anonymous_id = _community_identity(request,response,user)
    c = s.query(ComplaintComment).filter_by(id=comment_id, issue_id=issue_id).with_for_update().first()
    if not c: raise HTTPException(404, 'Comment not found')
    is_owner=(cid is not None and c.citizen_user_id==cid) or c.anonymous_id==anonymous_id
    if not is_owner:
        if not user or user.get('role') not in ('admin', 'official'): raise HTTPException(403, 'You can only remove your own comment.')
        c.is_hidden = True
    else: c.is_hidden = True
    s.commit(); return {'ok': True}

@router.post('/issues/{issue_id}/comments/{comment_id}/report')
def report_comment(issue_id: int, comment_id: int, request: Request, response: Response, user: Optional[dict] = Depends(get_optional_user), s: Session = Depends(get_db)):
    cid, anonymous_id = _community_identity(request,response,user)
    _rate_limit(request,user,anonymous_id,10)
    c = s.query(ComplaintComment).filter_by(id=comment_id, issue_id=issue_id).first()
    if not c: raise HTTPException(404, 'Comment not found')
    c.is_reported = True; s.commit(); return {'ok': True}

@router.post('/issues/{issue_id}/verification')
@router.post('/department/complaints/{issue_id}/verify')
@router.post('/admin/complaints/{issue_id}/verify')
def verify_issue(issue_id: int, request: Request, payload: VerificationIn, user: dict = Depends(get_current_user), s: Session = Depends(get_db)):
    if user.get('role') not in ('admin', 'official'): raise HTTPException(403, 'Authorized department officers only.')
    if '/admin/' in request.url.path and user.get('role') != 'admin': raise HTTPException(403, 'Municipal administrator access is required.')
    if payload.decision not in ('Verified', 'Rejected'): raise HTTPException(422, 'Decision must be Verified or Rejected.')
    issue = s.query(Issue).filter_by(id=issue_id).with_for_update().first()
    if not issue: raise HTTPException(404, 'Issue not found')
    if issue.official_verification in ('Verified', 'Rejected'): raise HTTPException(409, 'This complaint already has an official decision.')
    project = s.get(Project, issue.project_id) if issue.project_id else None
    authorized_department = (project.department if project else issue.department) or ''
    if user.get('role') == 'official' and user.get('department','').lower() not in authorized_department.lower():
        raise HTTPException(403, 'This complaint is outside your department.')
    s.add(ComplaintVerification(issue_id=issue.id,verifier_user_id=user.get('email') or user.get('sub') or user.get('name','Officer'),department=user.get('department','Municipal Administration'),verification_status=payload.decision,verification_reason=payload.note.strip(),verified_at=datetime.utcnow()))
    issue.official_verification = payload.decision
    issue.verified_by = f"{user.get('name', 'Officer')} ({user.get('badge_id', '')})"
    issue.verified_at = datetime.utcnow()
    issue.verification_reason = payload.note.strip()
    if payload.severity: issue.severity = payload.severity.title()
    scoring_triggered = False
    if payload.decision == 'Verified':
        issue.status = 'Under Review'
        if project:
            contractor = s.get(Contractor, project.contractor_id) if project.contractor_id else None
            if not contractor and project.contractor:
                contractor = s.query(Contractor).filter_by(name=project.contractor, department=project.department).first()
            if contractor:
                from .contractors import create_transaction
                severity = (issue.severity or '').lower()
                event_type = 'verified_critical' if severity == 'critical' else 'verified_major' if severity in ('major','medium','high') else 'verified_minor'
                rule = s.query(ContractorScoringRule).filter_by(event_type=event_type).first()
                if not rule or rule.is_active:
                    points = rule.points if rule else {'verified_minor':-3,'verified_major':-7,'verified_critical':-15}[event_type]
                    create_transaction(s, contractor, event_type, f"verified-complaint:{issue.id}", points, f"{event_type.replace('_',' ').title()} complaint {issue.ref}", issue.verified_by, project.id, issue.id, issue.ref)
                    scoring_triggered = True
    elif payload.decision == 'Rejected': issue.status = 'Rejected'
    s.commit()
    return {'id': issue.id, 'official_verification': issue.official_verification, 'verified_by': issue.verified_by, 'verified_at': issue.verified_at.isoformat(), 'verification_reason': issue.verification_reason, 'scoring_triggered': scoring_triggered}

@router.post('/department/complaints/{issue_id}/reject')
@router.post('/admin/complaints/{issue_id}/reject')
def reject_issue(issue_id: int, request: Request, payload: VerificationIn, user: dict = Depends(get_current_user), s: Session = Depends(get_db)):
    if payload.decision != 'Rejected': payload.decision = 'Rejected'
    return verify_issue(issue_id, request, payload, user, s)

@router.post('/department/complaints/{issue_id}/review-action')
def complaint_review_action(issue_id:int,payload:ReviewActionIn,user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    if user.get('role') not in ('official','admin'):raise HTTPException(403,'Authorized department staff only.')
    issue=s.query(Issue).filter_by(id=issue_id).with_for_update().first()
    if not issue:raise HTTPException(404,'Issue not found')
    project=s.get(Project,issue.project_id) if issue.project_id else None
    target=(project.department if project else issue.department) or ''
    if user.get('role')=='official' and user.get('department','').lower() not in target.lower():raise HTTPException(403,'This complaint is outside your department.')
    if issue.official_verification in ('Verified','Rejected'):raise HTTPException(409,'A final decision has already been recorded.')
    issue.status=payload.action
    line=f"{datetime.utcnow().isoformat()} · {user.get('name','Officer')} · {payload.action}: {payload.note.strip()}"
    issue.internal_notes=f"{issue.internal_notes}\n{line}".strip() if issue.internal_notes else line
    s.commit();return {'id':issue.id,'status':issue.status}

@router.post('/ask-question')
def ask_question(data: QuestionIn, s: Session = Depends(get_db)):
    proj = s.get(Project, data.project_id)
    if not proj:
        raise HTTPException(404, 'Project not found')
    
    count = s.query(Issue).count()
    ref = f'Q-{(proj.locality[:4] if proj.locality else "CHEN").upper()}-{count + 1:04d}'

    issue = Issue(
        ref=ref,
        project_id=proj.id,
        kind=f"Public Question regarding {proj.title}",
        department=proj.department,
        message=data.message,
        phone=data.phone,
        email=data.email,
        locality=proj.locality,
        pincode=proj.pincode,
        status='Submitted',
        is_question=True
    )
    s.add(issue)
    s.commit()
    return {
        'id': issue.id,
        'ref': issue.ref,
        'message': f'Your question has been forwarded to {proj.department}. Reference: {ref}'
    }

@router.post('/issues/{issue_id}/reply')
def reply_issue(issue_id: int, payload: IssueReplyIn, user: dict = Depends(get_current_user), s: Session = Depends(get_db)):
    issue = s.get(Issue, issue_id)
    if not issue:
        raise HTTPException(404, 'Issue not found')
    
    issue.official_reply = payload.reply
    issue.status = payload.status or 'Answered'
    issue.replied_at = datetime.utcnow()
    issue.replied_by = f"{user.get('name', 'Municipal Engineer')} ({user.get('badge_id', 'GCC')})"
    s.commit()
    return {
        'id': issue.id,
        'status': issue.status,
        'official_reply': issue.official_reply,
        'replied_at': issue.replied_at.isoformat(),
        'replied_by': issue.replied_by
    }
