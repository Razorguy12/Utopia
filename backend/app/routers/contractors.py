from datetime import datetime
import secrets
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.contractor import Contractor, ContractorScore, ContractorScoreTransaction, ContractorScoringRule, ContractorAppeal, ContractorInspection, MunicipalSetting, ContractorAuditLog
from ..models.project import Project
from ..models.issue import Issue
from ..models.field import FieldSubmission
from ..models.media import MediaAttachment
from ..models.issue import ComplaintComment, ComplaintConfirmation
from .issues import community_threshold
from ..services.auth import get_current_user

router = APIRouter(prefix='/api', tags=['Contractor Performance'])
DEFAULT_RULES = [('early_completion',10,'Project completed before deadline'),('on_time_completion',5,'Project completed on deadline'),('quality_pass',5,'Quality inspection passed'),('quality_excellent',10,'Excellent quality inspection'),('milestone_on_time',2,'Project milestone completed on time'),('positive_feedback',2,'Verified positive citizen feedback'),('verified_minor',-3,'Verified minor complaint'),('verified_major',-7,'Verified major complaint'),('verified_critical',-15,'Verified critical complaint'),('delay_1_3',-2,'Unjustified delay of 1–3 days'),('delay_4_7',-5,'Unjustified delay of 4–7 days'),('delay_over_7',-10,'Unjustified delay exceeding 7 days'),('quality_failed',-8,'Failed quality inspection'),('safety_major',-15,'Major safety violation')]

def grade(score: int) -> str:
    return 'A+' if score >= 90 else 'A' if score >= 80 else 'B' if score >= 70 else 'C' if score >= 60 else 'D' if score >= 40 else 'F'

def create_transaction(s: Session, contractor: Contractor, event_type: str, ref: str, points: int, reason: str, actor: str, project_id=None, issue_id=None, verification_reference=None):
    existing = s.query(ContractorScoreTransaction).filter_by(event_reference=ref).first()
    if existing: return existing
    score = s.query(ContractorScore).filter_by(contractor_id=contractor.id).with_for_update().first()
    if not score:
        score = ContractorScore(contractor_id=contractor.id, current_score=100, current_grade='A+'); s.add(score); s.flush()
    previous = score.current_score
    updated = max(0, min(100, previous + points))
    tx = ContractorScoreTransaction(contractor_id=contractor.id, project_id=project_id, issue_id=issue_id, event_type=event_type, event_reference=ref, points_change=updated-previous, previous_score=previous, new_score=updated, reason=reason, verification_reference=verification_reference, created_by=actor)
    score.current_score = updated; score.current_grade = grade(updated); score.updated_at = datetime.utcnow()
    s.add(tx); s.flush()
    return tx

def require_role(user, *roles):
    if user.get('role') not in roles: raise HTTPException(403, 'You are not authorized for this action.')

def public_stats(s: Session, contractor: Contractor):
    projects = s.query(Project).filter(Project.contractor_id == contractor.id).all()
    done = [p for p in projects if p.status.lower() == 'completed']
    txs=s.query(ContractorScoreTransaction).filter_by(contractor_id=contractor.id).all()
    completed_ids={t.project_id for t in txs if t.event_type in ('early_completion','on_time_completion')}
    ontime=sum(1 for t in txs if t.event_type in ('early_completion','on_time_completion'))
    complaints = s.query(Issue).join(Project, Issue.project_id == Project.id).filter(Project.contractor_id == contractor.id, Issue.official_verification == 'Verified').count()
    score = s.query(ContractorScore).filter_by(contractor_id=contractor.id).first()
    pending=s.query(Issue).join(Project,Issue.project_id==Project.id).filter(Project.contractor_id==contractor.id,Issue.official_verification=='Pending').count()
    my_score=score.current_score if score else 100
    return {'id':contractor.id,'name':contractor.name,'registration_number':contractor.registration_number,'department':contractor.department,'score':my_score,'grade':score.current_grade if score else 'A+','total_projects':len(projects),'completed_projects':len(done),'on_time_rate':round(100*ontime/len(done)) if done else 0,'verified_complaints':complaints,'pending_complaints':pending}

def _performance_dashboard(s:Session, contractors:list[Contractor]):
    rows=[public_stats(s,c) for c in contractors]
    rows.sort(key=lambda x:(-x['score'],x['name'].lower()))
    transactions=s.query(ContractorScoreTransaction).filter(ContractorScoreTransaction.contractor_id.in_([c.id for c in contractors])).order_by(ContractorScoreTransaction.created_at.asc()).all() if contractors else []
    month_map={}
    for tx in transactions:
        key=tx.created_at.strftime('%Y-%m')
        bucket=month_map.setdefault(key,{'month':key,'positive':0,'negative':0,'transactions':0})
        bucket['transactions']+=1
        if tx.points_change>=0:bucket['positive']+=tx.points_change
        else:bucket['negative']+=abs(tx.points_change)
    return {'contractors':rows,'transactions':[{'id':t.id,'contractor_id':t.contractor_id,'contractor':s.get(Contractor,t.contractor_id).name,'project_id':t.project_id,'issue_id':t.issue_id,'date':t.created_at.isoformat(),'event_type':t.event_type,'points_change':t.points_change,'score':t.new_score,'reason':t.reason} for t in transactions], 'monthly':list(month_map.values()),'summary':{'total':len(rows),'average_score':round(sum(r['score'] for r in rows)/len(rows),1) if rows else 0,'excellent':sum(r['score']>=90 for r in rows),'needs_improvement':sum(r['score']<60 for r in rows),'verified_complaints':sum(r['verified_complaints'] for r in rows),'total_projects':sum(r['total_projects'] for r in rows)}}

@router.get('/admin/contractor-performance-dashboard')
def admin_performance_dashboard(user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    require_role(user,'admin')
    return _performance_dashboard(s,s.query(Contractor).filter_by(is_active=True).all())

@router.get('/onsite/contractor-performance')
def onsite_performance_dashboard(user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    require_role(user,'onsite')
    contractor=s.query(Contractor).filter_by(onsite_badge_id=user.get('badge_id'),is_active=True).first()
    if not contractor and user.get('badge_id'):
        reported_projects={r[0] for r in s.query(FieldSubmission.project_id).filter_by(official_badge=user['badge_id']).distinct().all()}
        linked_ids={r[0] for r in s.query(Project.contractor_id).filter(Project.id.in_(reported_projects),Project.contractor_id.isnot(None)).distinct().all()} if reported_projects else set()
        if len(linked_ids)==1:
            contractor=s.get(Contractor,next(iter(linked_ids)))
    result=_performance_dashboard(s,[contractor] if contractor else [])
    result['scope']='Your score, projects and official performance history.' if contractor else 'Your on-site account is not linked to a contractor performance record yet. Ask a municipal administrator to link your on-site badge.'
    if contractor:
        result['projects']=[{'id':p.id,'code':p.code,'title':p.title,'status':p.status,'department':p.department} for p in s.query(Project).filter_by(contractor_id=contractor.id).all()]
        result['complaints']=[{'id':i.id,'ref':i.ref,'kind':i.kind,'message':i.message,'created':i.created.isoformat(),'official_verification':i.official_verification,'verification_reason':i.verification_reason,'confirmation_count':s.query(ComplaintConfirmation).filter_by(issue_id=i.id,is_active=True).count()} for i in s.query(Issue).join(Project,Issue.project_id==Project.id).filter(Project.contractor_id==contractor.id).all()]
    return result

class OnsiteAccountLink(BaseModel):
    badge_id: Optional[str] = Field(default=None, min_length=3, max_length=40)

@router.patch('/admin/contractors/{contractor_id}/onsite-account')
def link_onsite_account(contractor_id:int,data:OnsiteAccountLink,user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    require_role(user,'admin')
    contractor=s.get(Contractor,contractor_id)
    if not contractor: raise HTTPException(404,'Contractor not found')
    badge=(data.badge_id or '').strip() or None
    if badge:
        existing=s.query(Contractor).filter(Contractor.onsite_badge_id==badge,Contractor.id!=contractor.id).first()
        if existing: raise HTTPException(409,'This on-site badge is already linked to another contractor.')
    contractor.onsite_badge_id=badge
    s.add(ContractorAuditLog(actor=user.get('name','Administrator'),action='onsite_contractor_link',contractor_id=contractor.id,detail=f"On-site badge {'linked: '+badge if badge else 'unlinked'}"))
    s.commit()
    return {'contractor_id':contractor.id,'onsite_badge_id':badge}

@router.get('/department/contractor-complaints')
def department_complaints(user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    require_role(user,'official','admin')
    q=s.query(Issue).filter(Issue.is_question.is_(False)).order_by(Issue.official_verification.asc(),Issue.created.desc())
    if user.get('role')=='official': q=q.filter(Issue.department.ilike(f"%{user.get('department','')}%"))
    out=[]
    for issue in q.all():
        project=s.get(Project,issue.project_id) if issue.project_id else None
        count=s.query(ComplaintConfirmation).filter_by(issue_id=issue.id,is_active=True).count()
        out.append({'id':issue.id,'ref':issue.ref,'kind':issue.kind,'message':issue.message,'locality':issue.locality,'created':issue.created.isoformat(),'department':issue.department,'status':issue.status,'official_verification':issue.official_verification,'verification_reason':issue.verification_reason,'internal_notes':issue.internal_notes,'confirmation_count':count,'community_corroborated':count>=community_threshold(s),'comments':[{'id':c.id,'comment':c.comment,'created_at':c.created_at.isoformat(),'evidence':[{'media_id':e.media.id,'media_type':e.media.media_type,'filename':e.media.original_filename,'url':f'/api/media/{e.media.id}'} for e in c.evidence if e.media]} for c in s.query(ComplaintComment).filter_by(issue_id=issue.id,is_hidden=False).all()],'attachments':[{'media_id':m.id,'media_type':m.media_type,'filename':m.original_filename,'url':f'/api/media/{m.id}'} for m in (issue.attachments or [])],'project_id':project.id if project else None,'project_title':project.title if project else None,'contractor':project.contractor if project else None,'contractor_id':project.contractor_id if project else None})
    out.sort(key=lambda x:(not x['community_corroborated'],-x['confirmation_count']))
    return out

def my_contractor(user, s):
    require_role(user,'contractor')
    c=s.get(Contractor,user.get('contractor_id'))
    if not c or not c.is_active: raise HTTPException(403,'Contractor account is inactive.')
    return c

@router.get('/contractors/me/dashboard')
def my_dashboard(user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    c=my_contractor(user,s); data=public_stats(s,c)
    data['transactions']=[{'id':t.id,'date':t.created_at.isoformat(),'project_id':t.project_id,'issue_id':t.issue_id,'event_type':t.event_type,'points_change':t.points_change,'previous_score':t.previous_score,'new_score':t.new_score,'reason':t.reason,'verification_reference':t.verification_reference} for t in s.query(ContractorScoreTransaction).filter_by(contractor_id=c.id).order_by(ContractorScoreTransaction.created_at.desc()).all()]
    data['projects']=[{'id':p.id,'code':p.code,'title':p.title,'status':p.status,'due_date':p.due_date.isoformat()} for p in s.query(Project).filter_by(contractor_id=c.id).all()]
    data['complaints']=[{'id':i.id,'ref':i.ref,'kind':i.kind,'message':i.message,'created':i.created.isoformat(),'official_verification':i.official_verification,'verification_reason':i.verification_reason,'confirmation_count':s.query(ComplaintConfirmation).filter_by(issue_id=i.id,is_active=True).count(),'attachments':[{'media_id':m.id,'media_type':m.media_type,'filename':m.original_filename,'url':f'/api/media/{m.id}'} for m in i.attachments]} for i in s.query(Issue).join(Project,Issue.project_id==Project.id).filter(Project.contractor_id==c.id).all()]
    data['inspections']=[{'project_id':i.project_id,'inspection_type':i.inspection_type,'result':i.inspection_result,'score':i.inspection_score,'remarks':i.remarks,'date':i.inspected_at.isoformat()} for i in s.query(ContractorInspection).filter_by(contractor_id=c.id).order_by(ContractorInspection.inspected_at.desc()).all()]
    return data

@router.get('/contractors/me/score-history')
def my_history(user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    c=my_contractor(user,s); return s.query(ContractorScoreTransaction).filter_by(contractor_id=c.id).order_by(ContractorScoreTransaction.created_at.desc()).all()

@router.get('/contractors/me/projects')
def my_projects(user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    c=my_contractor(user,s); return [{'id':p.id,'code':p.code,'title':p.title,'department':p.department,'locality':p.locality,'status':p.status,'progress':p.progress,'due_date':p.due_date.isoformat(),'revised_date':p.revised_date.isoformat() if p.revised_date else None} for p in s.query(Project).filter_by(contractor_id=c.id).all()]

@router.get('/contractors/me/complaints')
def my_complaints(user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    c=my_contractor(user,s)
    return [{'id':i.id,'ref':i.ref,'project_id':i.project_id,'kind':i.kind,'message':i.message,'status':i.status,'official_verification':i.official_verification,'verification_reason':i.verification_reason,'created':i.created.isoformat(),'attachments':[{'media_id':m.id,'media_type':m.media_type,'filename':m.original_filename,'url':f'/api/media/{m.id}'} for m in i.attachments],'confirmation_count':s.query(ComplaintConfirmation).filter_by(issue_id=i.id,is_active=True).count()} for i in s.query(Issue).join(Project,Issue.project_id==Project.id).filter(Project.contractor_id==c.id).all()]

class AppealIn(BaseModel): score_transaction_id:int; appeal_reason:str=Field(min_length=10,max_length=3000)
@router.post('/contractors/me/appeals')
def appeal(data:AppealIn,user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    c=my_contractor(user,s); tx=s.query(ContractorScoreTransaction).filter_by(id=data.score_transaction_id,contractor_id=c.id).first()
    if not tx: raise HTTPException(404,'Score transaction not found')
    if s.query(ContractorAppeal).filter_by(score_transaction_id=tx.id).filter(ContractorAppeal.status=='Pending').first(): raise HTTPException(409,'An appeal is already pending for this transaction.')
    a=ContractorAppeal(contractor_id=c.id,score_transaction_id=tx.id,appeal_reason=data.appeal_reason); s.add(a); s.commit(); return {'id':a.id,'status':a.status}

@router.get('/contractors/me/appeals')
def my_appeals(user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    c=my_contractor(user,s); return s.query(ContractorAppeal).filter_by(contractor_id=c.id).all()

@router.get('/admin/contractors')
def admin_contractors(user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    require_role(user,'admin'); return [{**public_stats(s,c),'onsite_badge_id':c.onsite_badge_id} for c in s.query(Contractor).all()]

@router.get('/admin/contractors/{contractor_id}')
def admin_contractor_detail(contractor_id:int,user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    require_role(user,'admin');c=s.get(Contractor,contractor_id)
    if not c:raise HTTPException(404,'Contractor not found')
    d=public_stats(s,c);d['transactions']=[{'id':t.id,'date':t.created_at.isoformat(),'points_change':t.points_change,'previous_score':t.previous_score,'new_score':t.new_score,'reason':t.reason,'event_type':t.event_type} for t in s.query(ContractorScoreTransaction).filter_by(contractor_id=c.id).order_by(ContractorScoreTransaction.created_at.desc()).all()]
    d['appeals']=[{'id':a.id,'status':a.status,'appeal_reason':a.appeal_reason,'transaction_id':a.score_transaction_id,'created_at':a.created_at.isoformat()} for a in s.query(ContractorAppeal).filter_by(contractor_id=c.id).all()]
    return d

@router.get('/admin/contractor-appeals')
def admin_appeals(user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    require_role(user,'admin');return [{'id':a.id,'contractor_id':a.contractor_id,'contractor':s.get(Contractor,a.contractor_id).name,'score_transaction_id':a.score_transaction_id,'appeal_reason':a.appeal_reason,'status':a.status,'created_at':a.created_at.isoformat()} for a in s.query(ContractorAppeal).order_by(ContractorAppeal.created_at.desc()).all()]

@router.get('/admin/contractor-audit')
def contractor_audit(user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    require_role(user,'admin');return [{'id':a.id,'actor':a.actor,'action':a.action,'contractor_id':a.contractor_id,'detail':a.detail,'created_at':a.created_at.isoformat()} for a in s.query(ContractorAuditLog).order_by(ContractorAuditLog.created_at.desc()).limit(500).all()]

@router.get('/admin/contractor-statistics')
def admin_stats(user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    require_role(user,'admin'); rows=[public_stats(s,c) for c in s.query(Contractor).all()]
    return {'contractors':len(rows),'active_contractors':s.query(Contractor).filter_by(is_active=True).count(),'average_score':round(sum(r['score'] for r in rows)/len(rows),1) if rows else 0,'excellent':sum(r['score']>=90 for r in rows),'needs_improvement':sum(r['score']<60 for r in rows),'verified_complaints':sum(r['verified_complaints'] for r in rows),'community_corroborated':sum(1 for i in s.query(Issue).all() if s.query(ComplaintConfirmation).filter_by(issue_id=i.id,is_active=True).count()>=community_threshold(s))}

@router.get('/admin/community-confirmation-threshold')
def get_threshold(user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    require_role(user,'admin');return {'threshold':community_threshold(s)}

class ThresholdPatch(BaseModel): threshold:int=Field(ge=1,le=10000)
@router.patch('/admin/community-confirmation-threshold')
def set_threshold(data:ThresholdPatch,user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    require_role(user,'admin');setting=s.get(MunicipalSetting,'community_confirmation_threshold')
    if not setting:setting=MunicipalSetting(key='community_confirmation_threshold',value=str(data.threshold));s.add(setting)
    setting.value=str(data.threshold);setting.updated_by=user.get('name');setting.updated_at=datetime.utcnow();s.add(ContractorAuditLog(actor=user.get('name','Administrator'),action='community_threshold_change',detail=f'Community corroboration threshold set to {data.threshold}.'));s.commit();return {'threshold':data.threshold}

@router.get('/admin/contractor-scoring-rules')
def scoring_rules(user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    require_role(user,'admin'); return s.query(ContractorScoringRule).order_by(ContractorScoringRule.id).all()

class RulePatch(BaseModel): points:int=Field(ge=-100,le=100); is_active:bool
@router.patch('/admin/contractor-scoring-rules/{rule_id}')
def update_rule(rule_id:int,data:RulePatch,user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    require_role(user,'admin'); r=s.get(ContractorScoringRule,rule_id)
    if not r: raise HTTPException(404,'Scoring rule not found')
    r.points=data.points;r.is_active=data.is_active;r.updated_by=user.get('name');s.add(ContractorAuditLog(actor=user.get('name','Administrator'),action='scoring_rule_change',detail=f'{r.event_type}: points={r.points}; active={r.is_active}.'));s.commit();return r

class AdjustmentIn(BaseModel): points:int=Field(ge=-100,le=100); reason:str=Field(min_length=8,max_length=2000)
@router.post('/admin/contractors/{contractor_id}/score-adjustment')
def adjustment(contractor_id:int,data:AdjustmentIn,user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    require_role(user,'admin'); c=s.get(Contractor,contractor_id)
    if not c: raise HTTPException(404,'Contractor not found')
    tx=create_transaction(s,c,'admin_adjustment',f"admin-adjust:{secrets.token_hex(16)}",data.points,data.reason,user.get('name','Administrator'))
    s.commit();return {'transaction_id':tx.id,'score':tx.new_score}

class InspectionIn(BaseModel):
    project_id:int; inspection_type:str=Field(min_length=2,max_length=60); result:str; remarks:str=Field(min_length=8,max_length=2000); score:Optional[int]=Field(default=None,ge=0,le=100)
@router.post('/admin/contractor-inspections')
def record_inspection(data:InspectionIn,user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    require_role(user,'admin','official');p=s.get(Project,data.project_id)
    if not p or not p.contractor_id:raise HTTPException(404,'Project or associated contractor not found')
    if user.get('role')=='official' and user.get('department','').lower() not in p.department.lower():raise HTTPException(403,'This project is outside your department.')
    normalized=data.result.lower()
    if normalized not in ('passed','excellent','failed'):raise HTTPException(422,'Result must be passed, excellent, or failed.')
    inspection=ContractorInspection(contractor_id=p.contractor_id,project_id=p.id,inspection_type=data.inspection_type,inspection_score=data.score,inspection_result=normalized.title(),remarks=data.remarks,inspected_by=user.get('name','Officer'))
    s.add(inspection);s.flush()
    event={'passed':'quality_pass','excellent':'quality_excellent','failed':'quality_failed'}[normalized]
    rule=s.query(ContractorScoringRule).filter_by(event_type=event,is_active=True).first()
    if rule:create_transaction(s,s.get(Contractor,p.contractor_id),event,f'quality-inspection:{inspection.id}',rule.points,f'{rule.description}: {data.remarks}',user.get('name','Officer'),p.id)
    s.commit();return {'id':inspection.id,'inspection_result':inspection.inspection_result}

class DelayEvaluationIn(BaseModel):
    days:int=Field(ge=1,le=3650); justified:bool; reason:str=Field(min_length=8,max_length=2000); reference:str=Field(min_length=4,max_length=100)
@router.post('/admin/projects/{project_id}/evaluate-delay')
def evaluate_delay(project_id:int,data:DelayEvaluationIn,user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    require_role(user,'admin','official');p=s.get(Project,project_id)
    if not p or not p.contractor_id:raise HTTPException(404,'Project or associated contractor not found')
    if user.get('role')=='official' and user.get('department','').lower() not in p.department.lower():raise HTTPException(403,'This project is outside your department.')
    if data.justified:return {'penalty_applied':False,'reason':'The delay was recorded as justified.'}
    event='delay_1_3' if data.days<=3 else 'delay_4_7' if data.days<=7 else 'delay_over_7'
    rule=s.query(ContractorScoringRule).filter_by(event_type=event,is_active=True).first()
    if not rule or not rule.is_active:return {'penalty_applied':False,'reason':'This scoring rule is inactive.'}
    tx=create_transaction(s,s.get(Contractor,p.contractor_id),event,f'delay-review:{project_id}:{data.reference}',rule.points,f'Unjustified delay of {data.days} days: {data.reason}',user.get('name','Officer'),p.id)
    s.commit();return {'penalty_applied':True,'transaction_id':tx.id,'score':tx.new_score}

class PerformanceEventIn(BaseModel):
    event_type:str; reason:str=Field(min_length=8,max_length=2000); reference:str=Field(min_length=4,max_length=100)
@router.post('/admin/projects/{project_id}/performance-event')
def record_performance_event(project_id:int,data:PerformanceEventIn,user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    require_role(user,'admin','official');p=s.get(Project,project_id)
    if not p or not p.contractor_id:raise HTTPException(404,'Project or associated contractor not found')
    if user.get('role')=='official' and user.get('department','').lower() not in p.department.lower():raise HTTPException(403,'This project is outside your department.')
    if data.event_type not in ('milestone_on_time','positive_feedback','safety_major'):raise HTTPException(422,'Unsupported performance event type.')
    rule=s.query(ContractorScoringRule).filter_by(event_type=data.event_type).first()
    if not rule or not rule.is_active:raise HTTPException(409,'This scoring rule is currently inactive.')
    tx=create_transaction(s,s.get(Contractor,p.contractor_id),data.event_type,f'performance-event:{project_id}:{data.reference}',rule.points,f'{rule.description}: {data.reason}',user.get('name','Officer'),p.id)
    s.commit();return {'transaction_id':tx.id,'score':tx.new_score}

class ContractorCreate(BaseModel):
    name:str=Field(min_length=2,max_length=120); registration_number:str=Field(min_length=3,max_length=40); department:str=Field(min_length=2,max_length=100); email:str; password:str=Field(min_length=12,max_length=128)
@router.post('/admin/contractors')
def create_contractor(data:ContractorCreate,user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    require_role(user,'admin')
    if s.query(Contractor).filter((Contractor.email==data.email.lower())|(Contractor.registration_number==data.registration_number)).first(): raise HTTPException(409,'Email or registration number is already registered.')
    import hashlib,secrets
    salt=secrets.token_bytes(16); password_hash=salt.hex()+':'+hashlib.pbkdf2_hmac('sha256',data.password.encode(),salt,310000).hex()
    c=Contractor(name=data.name,registration_number=data.registration_number,department=data.department,email=data.email.lower(),password_hash=password_hash)
    s.add(c);s.flush();s.add(ContractorScore(contractor_id=c.id,current_score=100,current_grade='A+'));s.commit();return {'id':c.id,'name':c.name,'registration_number':c.registration_number}

class ContractorCredentials(BaseModel): email:str; password:str=Field(min_length=12,max_length=128)
@router.post('/admin/contractors/{contractor_id}/credentials')
def set_contractor_credentials(contractor_id:int,data:ContractorCredentials,user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    require_role(user,'admin');c=s.get(Contractor,contractor_id)
    if not c:raise HTTPException(404,'Contractor not found')
    email=data.email.strip().lower()
    other=s.query(Contractor).filter(Contractor.email==email,Contractor.id!=c.id).first()
    if other:raise HTTPException(409,'This email belongs to another contractor account.')
    import hashlib,secrets
    salt=secrets.token_bytes(16);c.email=email;c.password_hash=salt.hex()+':'+hashlib.pbkdf2_hmac('sha256',data.password.encode(),salt,310000).hex();s.commit();return {'id':c.id,'email':c.email,'enabled':True}

class VisibilityPatch(BaseModel): visible:bool
@router.patch('/admin/contractors/{contractor_id}/visibility')
def set_visibility(contractor_id:int,data:VisibilityPatch,user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    require_role(user,'admin');c=s.get(Contractor,contractor_id)
    if not c:raise HTTPException(404,'Contractor not found')
    c.leaderboard_visible=data.visible
    s.add(ContractorAuditLog(actor=user.get('name','Administrator'),action='leaderboard_visibility',contractor_id=c.id,detail=f'Public leaderboard visibility set to {data.visible}.'))
    s.commit();return {'id':c.id,'leaderboard_visible':c.leaderboard_visible}

class AppealReview(BaseModel): approved:bool; response:str=Field(min_length=8,max_length=2000)
@router.post('/admin/contractor-appeals/{appeal_id}/review')
def review_appeal(appeal_id:int,data:AppealReview,user:dict=Depends(get_current_user),s:Session=Depends(get_db)):
    require_role(user,'admin'); a=s.query(ContractorAppeal).filter_by(id=appeal_id).with_for_update().first()
    if not a: raise HTTPException(404,'Appeal not found')
    if a.status!='Pending': raise HTTPException(409,'Appeal has already been reviewed.')
    a.status='Approved' if data.approved else 'Rejected';a.admin_response=data.response;a.reviewed_by=user.get('name');a.reviewed_at=datetime.utcnow()
    if data.approved:
        original=s.get(ContractorScoreTransaction,a.score_transaction_id); c=s.get(Contractor, a.contractor_id)
        create_transaction(s,c,'appeal_reversal',f'appeal-reversal:{a.id}',-original.points_change,f"Reversal following approved appeal #{a.id}: {data.response}",user.get('name','Administrator'),original.project_id,original.issue_id,original.event_reference)
    s.commit();return {'status':a.status}
