from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.project import Project, Event
from ..models.issue import Issue
from ..schemas.project import ProjectCreateIn, ProjectUpdateIn, serialize_project
from ..services.auth import get_current_user
from ..models.contractor import Contractor, ContractorScore, ContractorScoringRule
from .contractors import create_transaction

router = APIRouter(prefix="/api", tags=["Projects & Municipal Works"])

@router.get('/departments')
def get_departments(s: Session = Depends(get_db)):
    depts = s.query(Project.department).distinct().all()
    out = sorted(list({d[0] for d in depts if d[0]}))
    if not out:
        out = ["Greater Chennai Corporation", "Chennai Metro Water", "TANGEDCO", "Stormwater Drainage", "Chennai Fibre Network", "State Highways & GCC"]
    return out

@router.get('/localities')
def get_localities(s: Session = Depends(get_db)):
    projects = s.query(Project).all()
    groups = {}
    for p in projects:
        pin = p.pincode
        if pin not in groups:
            groups[pin] = {
                'pincode': pin,
                'locality': p.locality,
                'count': 0,
                'active': 0,
                'delayed': 0
            }
        groups[pin]['count'] += 1
        if p.status in ['In progress', 'Delayed']:
            groups[pin]['active'] += 1
        if p.status == 'Delayed':
            groups[pin]['delayed'] += 1
    # Priority sorting: Melakottaiyur, Triplicane, Ayanavaram, then by count descending
    order_pref = {'600127': 1, '600005': 2, '600023': 3, '600017': 4, '600004': 5}
    return sorted(groups.values(), key=lambda x: (order_pref.get(x['pincode'], 99), -x['count']))

@router.get('/stats')
def get_stats(pincode: Optional[str] = None, s: Session = Depends(get_db)):
    q = s.query(Project)
    if pincode:
        q = q.filter(Project.pincode == pincode)
    all_p = q.all()
    total = len(all_p)
    in_prog = sum(1 for p in all_p if p.status == 'In progress')
    delayed = sum(1 for p in all_p if p.status == 'Delayed')
    completed = sum(1 for p in all_p if p.status == 'Completed')
    upcoming = sum(1 for p in all_p if p.status in ['Upcoming', 'Scheduled'])
    total_budget = sum(p.budget for p in all_p)
    return {
        'total': total,
        'in_progress': in_prog,
        'delayed': delayed,
        'completed': completed,
        'upcoming': upcoming,
        'total_budget': total_budget
    }

@router.get('/projects')
def list_projects(
    department: Optional[str] = None,
    pincode: Optional[str] = None,
    locality: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    s: Session = Depends(get_db)
):
    q = s.query(Project)
    if department:
        q = q.filter(Project.department.ilike(f"%{department}%"))
    if pincode:
        q = q.filter(Project.pincode == pincode)
    if locality:
        q = q.filter(Project.locality.ilike(f"%{locality}%"))
    if status:
        q = q.filter(Project.status == status)
    if category:
        q = q.filter(Project.category == category)
    if search:
        term = f"%{search}%"
        q = q.filter(
            (Project.title.ilike(term)) |
            (Project.code.ilike(term)) |
            (Project.description.ilike(term)) |
            (Project.locality.ilike(term)) |
            (Project.address.ilike(term))
        )
    projects = q.order_by(Project.due_date.asc()).all()
    return [serialize_project(p) for p in projects]

@router.get('/projects/{pid}')
def get_project(pid: int, s: Session = Depends(get_db)):
    p = s.query(Project).filter(Project.id == pid).first()
    if not p:
        raise HTTPException(404, 'Project not found')
    out = serialize_project(p)
    out['events'] = [
        {'id': e.id, 'title': e.title, 'detail': e.detail, 'created': e.created.isoformat(), 'verified': e.verified}
        for e in sorted(p.events, key=lambda e: e.created)
    ]
    # Include project-specific questions and complaints
    issues = s.query(Issue).filter(Issue.project_id == pid).order_by(Issue.created.desc()).all()
    out['issues'] = [
        {
            'id': i.id, 'ref': i.ref, 'kind': i.kind, 'message': i.message,
            'status': i.status, 'severity': i.severity, 'created': i.created.isoformat(),
            'is_question': i.is_question, 'official_reply': i.official_reply,
            'replied_at': i.replied_at.isoformat() if i.replied_at else None,
            'replied_by': i.replied_by,
            'attachments': [{
                'media_id': m.id, 'media_type': m.media_type, 'mime_type': m.mime_type,
                'filename': m.original_filename, 'size': m.file_size, 'url': f'/api/media/{m.id}',
                'created_at': m.created_at.isoformat()
            } for m in i.attachments]
        }
        for i in issues
    ]
    return out

@router.post('/projects')
def create_project(data: ProjectCreateIn, user: dict = Depends(get_current_user), s: Session = Depends(get_db)):
    if user.get("role") not in ["official", "admin"]:
        raise HTTPException(403, "Only authorized department engineers can sanction new public works")

    assigned_dept = user.get("department", "Greater Chennai Corporation")
    if user.get("role") == "admin" and data.department:
        assigned_dept = data.department

    # Auto-generate unique work code
    total_count = s.query(Project).count()
    code = f"CG-2026-{total_count + 1:03d}"

    proj = Project(
        code=code,
        title=data.title,
        category=data.category,
        department=assigned_dept,
        locality=data.locality,
        pincode=data.pincode,
        address=data.address or f"{data.locality}, Chennai - {data.pincode}",
        description=data.description,
        status="In progress",
        progress=5,
        budget=data.budget,
        contractor=data.contractor or "Pending Tender Award",
        start_date=data.start_date,
        due_date=data.due_date,
        lat=data.lat or 13.0827,
        lng=data.lng or 80.2707,
        disruption=data.disruption or "Standard lane traffic diversion",
        current_step=3,
        contact_engineer_name=data.contact_engineer_name or user.get('name', 'Er. K. Ramanathan'),
        contact_engineer_phone=data.contact_engineer_phone or "+91 94440 28192",
        contact_engineer_email=data.contact_engineer_email or user.get('email', 'engineer@utopiacivic.gov.in'),
        contact_contractor=data.contact_contractor or "MetroLink Infrastructure Ltd.",
        contact_contractor_phone=data.contact_contractor_phone or "+91 98841 55210",
        noise_warning=data.noise_warning or "Permitted high-noise window: 22:00 - 04:00",
        dust_warning=data.dust_warning or "Trenching dust window: 09:00 - 14:00",
        gmaps_broadcast=data.gmaps_broadcast if data.gmaps_broadcast is not None else True,
        detour_advice=data.detour_advice or "Follow on-site directional signage",
        technical_scope=data.technical_scope,
        funding_program=data.funding_program or "Municipal Infrastructure Capital Fund",
        created_by=f"{user.get('name')} ({user.get('badge_id')})"
    )
    s.add(proj)
    s.flush()
    contractor = None
    if proj.contractor.strip().lower() not in {'pending tender award','unassigned','tbd','none'}:
        contractor = s.query(Contractor).filter_by(name=proj.contractor, department=proj.department).first()
        if not contractor:
            contractor = Contractor(name=proj.contractor, department=proj.department, registration_number=f'GCC-C-{proj.id:06d}')
            s.add(contractor); s.flush(); s.add(ContractorScore(contractor_id=contractor.id,current_score=100,current_grade='A+'))
        proj.contractor_id = contractor.id
    s.commit()
    s.refresh(proj)

    # Initial Event
    ev = Event(
        project_id=proj.id,
        title="Project Sanctioned & Work Order Registered",
        detail=f"Official capital work sanction recorded by {user.get('name')} ({user.get('badge_id')}), {assigned_dept}. Work order issued under {proj.funding_program}.",
        created=datetime.utcnow(),
        verified=True
    )
    s.add(ev)
    s.commit()

    return serialize_project(proj)

@router.patch('/projects/{pid}')
def update_project(pid: int, update_data: ProjectUpdateIn, user: dict = Depends(get_current_user), s: Session = Depends(get_db)):
    p = s.query(Project).filter(Project.id == pid).first()
    if not p:
        raise HTTPException(404, 'Project not found')
    
    # Department-level authorization check
    if user.get("role") == "official":
        if user.get("department", "").lower() not in p.department.lower():
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: You are registered under '{user.get('department')}' and cannot edit projects of '{p.department}'."
            )

    data = update_data.model_dump(exclude_unset=True)
    old_status = p.status
    for field, val in data.items():
        if hasattr(p, field):
            setattr(p, field, val)
    p.updated = datetime.utcnow()
    if data.get('contractor') and p.contractor:
        if p.contractor.strip().lower() in {'pending tender award','unassigned','tbd','none'}:
            p.contractor_id = None
        else:
            contractor = s.query(Contractor).filter_by(name=p.contractor, department=p.department).first()
            if not contractor:
                contractor = Contractor(name=p.contractor, department=p.department, registration_number=f'GCC-C-{p.id:06d}')
                s.add(contractor); s.flush(); s.add(ContractorScore(contractor_id=contractor.id,current_score=100,current_grade='A+'))
            p.contractor_id = contractor.id
    if data.get('status') == 'Completed' and old_status != 'Completed' and p.contractor_id:
        deadline = p.revised_date or p.due_date
        event_type = 'early_completion' if p.updated.date() < deadline else 'on_time_completion'
        rule = s.query(ContractorScoringRule).filter_by(event_type=event_type,is_active=True).first()
        if rule:
            create_transaction(s,s.get(Contractor,p.contractor_id),event_type,f'project-completion:{p.id}',rule.points,rule.description,user.get('name','Officer'),p.id)
    s.commit()
    s.refresh(p)
    return serialize_project(p)

@router.post('/projects/{pid}/events')
def add_project_event(pid: int, title: str, detail: str, user: dict = Depends(get_current_user), s: Session = Depends(get_db)):
    p = s.query(Project).filter(Project.id == pid).first()
    if not p:
        raise HTTPException(404, 'Project not found')
    ev = Event(
        project_id=pid,
        title=title,
        detail=detail,
        created=datetime.utcnow(),
        verified=True
    )
    s.add(ev)
    p.updated = datetime.utcnow()
    s.commit()
    return {'status': 'success', 'event_id': ev.id}
