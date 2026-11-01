from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.project import Project, Event
from ..models.issue import Issue
from ..models.field import FieldSubmission
from ..schemas.field import FieldSubmissionIn
from ..schemas.project import serialize_project
from ..services.auth import get_current_user
from ..models.contractor import Contractor, ContractorScore, ContractorScoringRule
from .contractors import create_transaction

router = APIRouter(prefix="/api/onsite", tags=["On-site Official Portal"])

@router.get('/my-projects')
def get_onsite_projects(user: dict = Depends(get_current_user), s: Session = Depends(get_db)):
    if user.get("role") not in ["onsite", "admin", "official"]:
        raise HTTPException(403, "Access restricted to authorized personnel")

    dept = user.get("department")
    role = user.get("role")

    q = s.query(Project)
    # If onsite official, prioritize/filter by their department
    if role == "onsite" and dept:
        dept_match = q.filter(Project.department.ilike(f'%{dept}%')).all()
        # If no strict department match, show active projects
        if not dept_match:
            dept_match = q.filter(Project.status.in_(['In progress', 'Delayed', 'Scheduled'])).all()
        projects = dept_match
    else:
        projects = q.all()

    results = []
    for p in projects:
        data = serialize_project(p)
        # Attach count of recent field reports
        sub_count = s.query(FieldSubmission).filter(FieldSubmission.project_id == p.id).count()
        data['field_submissions_count'] = sub_count
        results.append(data)
    return results

@router.post('/submissions')
def create_field_submission(sub: FieldSubmissionIn, user: dict = Depends(get_current_user), s: Session = Depends(get_db)):
    if user.get("role") not in ["onsite", "admin", "official"]:
        raise HTTPException(403, "Access restricted to on-site officials")
    
    proj = s.get(Project, sub.project_id)
    if not proj:
        raise HTTPException(404, "Project not found")

    submission = FieldSubmission(
        project_id=sub.project_id,
        official_name=user.get("name", "Site Official"),
        official_badge=user.get("badge_id", "SITE-OFFICER"),
        official_dept=user.get("department", "GCC"),
        report_type=sub.report_type,
        summary=sub.summary,
        detail=sub.detail,
        progress_pct=sub.progress_pct,
        step_number=sub.step_number,
        photo_url=sub.photo_url,
        photo_caption=sub.photo_caption,
        severity=sub.severity,
        labor_count=sub.labor_count,
        machinery_deployed=sub.machinery_deployed,
        shift_hours=sub.shift_hours,
        status="Submitted"
    )
    s.add(submission)

    # Sync project progress and timeline
    if sub.report_type == 'progress':
        was_completed = proj.status == 'Completed'
        if sub.progress_pct is not None:
            proj.progress = max(0, min(100, sub.progress_pct))
            if proj.progress >= 100:
                proj.status = 'Completed'
            elif proj.status == 'Scheduled':
                proj.status = 'In progress'
        if sub.step_number is not None:
            proj.current_step = max(1, min(7, sub.step_number))
        
        # Add official event to project timeline
        ev = Event(
            project_id=proj.id,
            title=f"Field Progress: {sub.summary}",
            detail=f"{sub.detail} (Submitted on-site by {user.get('name')} [{user.get('badge_id')}])",
            created=datetime.utcnow(),
            verified=True
        )
        s.add(ev)
        proj.updated = datetime.utcnow()
        if not was_completed and proj.status == 'Completed' and proj.contractor_id:
            deadline=proj.revised_date or proj.due_date
            event_type='early_completion' if proj.updated.date()<deadline else 'on_time_completion'
            rule=s.query(ContractorScoringRule).filter_by(event_type=event_type,is_active=True).first()
            if rule:
                create_transaction(s,s.get(Contractor,proj.contractor_id),event_type,f'project-completion:{proj.id}',rule.points,rule.description,user.get('name','Field Supervisor'),proj.id)
    elif sub.report_type == 'delay':
        proj.status = 'Delayed'
        if sub.detail:
            proj.delay_reason = sub.detail
        ev = Event(
            project_id=proj.id,
            title=f"Field Delay Advisory: {sub.summary}",
            detail=f"{sub.detail} (Field supervisor: {user.get('name')})",
            created=datetime.utcnow(),
            verified=True
        )
        s.add(ev)
        proj.updated = datetime.utcnow()
    elif sub.report_type == 'blocker':
        # Create an official issue / alert
        iss = Issue(
            ref=f"BLK-{datetime.now():%y%m%d}-{(s.query(Issue).count()+1):04d}",
            project_id=proj.id,
            pincode=proj.pincode,
            kind="Worksite Blocker / Safety Alert",
            message=f"[On-site Notice by {user.get('name')} - {user.get('badge_id')}]: {sub.summary} — {sub.detail}",
            locality=proj.locality,
            severity=sub.severity or "High",
            status="Under Review",
            is_question=False
        )
        s.add(iss)
        proj.updated = datetime.utcnow()

    s.commit()
    s.refresh(submission)
    return {
        "id": submission.id,
        "status": submission.status,
        "message": "Field submission recorded and synchronized with Utopia central registry."
    }

@router.get('/submissions')
def get_field_submissions(project_id: Optional[int] = None, user: dict = Depends(get_current_user), s: Session = Depends(get_db)):
    if user.get("role") not in ["onsite", "admin", "official"]:
        raise HTTPException(403, "Access restricted to authorized personnel")

    q = s.query(FieldSubmission)
    if project_id:
        q = q.filter(FieldSubmission.project_id == project_id)

    submissions = q.order_by(FieldSubmission.created.desc()).all()
    results = []
    for s_item in submissions:
        proj = s.get(Project, s_item.project_id)
        results.append({
            "id": s_item.id,
            "project_id": s_item.project_id,
            "project_title": proj.title if proj else f"Project #{s_item.project_id}",
            "project_code": proj.code if proj else "",
            "project_locality": proj.locality if proj else "",
            "official_name": s_item.official_name,
            "official_badge": s_item.official_badge,
            "official_dept": s_item.official_dept,
            "report_type": s_item.report_type,
            "summary": s_item.summary,
            "detail": s_item.detail,
            "progress_pct": s_item.progress_pct,
            "step_number": s_item.step_number,
            "photo_url": s_item.photo_url,
            "photo_caption": s_item.photo_caption,
            "severity": s_item.severity,
            "labor_count": s_item.labor_count,
            "machinery_deployed": s_item.machinery_deployed,
            "shift_hours": s_item.shift_hours,
            "status": s_item.status,
            "created": s_item.created.isoformat()
        })
    return results

@router.patch('/submissions/{sub_id}/status')
def update_submission_status(sub_id: int, payload: dict, user: dict = Depends(get_current_user), s: Session = Depends(get_db)):
    sub = s.get(FieldSubmission, sub_id)
    if not sub:
        raise HTTPException(404, "Submission not found")
    sub.status = payload.get("status", "Approved")
    s.commit()
    return {"id": sub.id, "status": sub.status}
