from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, SessionLocal, Base, get_db, db, ensure_columns
from .models import Project, Event, Issue, CitizenUser, ComplaintConfirmation, ComplaintComment, CommentEvidence, ComplaintVerification, Contractor, ContractorScore, ContractorScoreTransaction, ContractorScoringRule, ContractorAppeal, ContractorInspection, MunicipalSetting, ContractorAuditLog, ConflictTicket, SMSLog, FieldSubmission, MediaAttachment
from .services.seeder import seed_data
from .routers.media import cleanup_staged_media
from .routers import (
    auth_router,
    projects_router,
    issues_router,
    conflicts_router,
    onsite_router,
    geocode_router,
    broadcasts_router,
    media_router,
    ai_chat_router
    ,contractors_router
)

# Initialize FastAPI Application
app = FastAPI(
    title='Utopia API',
    version='3.0.0',
    description='Smart Public Works Transparency & Municipal Operations Platform'
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# Include Modular Routers
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(issues_router)
app.include_router(conflicts_router)
app.include_router(onsite_router)
app.include_router(geocode_router)
app.include_router(broadcasts_router)
app.include_router(media_router)
app.include_router(ai_chat_router)
app.include_router(contractors_router)

@app.on_event("startup")
def on_startup():
    # Create all tables if not exist
    Base.metadata.create_all(bind=engine)
    # Ensure columns from prior PostgreSQL schema versions exist.
    ensure_columns(engine)
    # Seed initial demo data
    with SessionLocal() as s:
        cleanup_staged_media(s)
        seed_data(s)
        if not hasattr(s, 'query'):
            return
        from .models.contractor import Contractor, ContractorScore, ContractorScoringRule
        from .models.project import Project
        for project in s.query(Project).filter(Project.contractor.isnot(None)).all():
            if project.contractor.strip().lower() in {'pending tender award','unassigned','tbd','none'}:
                continue
            contractor = s.query(Contractor).filter_by(name=project.contractor, department=project.department).first()
            if not contractor:
                contractor = Contractor(name=project.contractor, department=project.department, registration_number=f"GCC-C-{project.id:06d}")
                s.add(contractor); s.flush(); s.add(ContractorScore(contractor_id=contractor.id, current_score=100, current_grade='A+'))
            if not project.contractor_id: project.contractor_id = contractor.id
        defaults = [('early_completion',10,'Project completed before deadline'),('on_time_completion',5,'Project completed on deadline'),('quality_pass',5,'Quality inspection passed'),('quality_excellent',10,'Excellent quality inspection'),('milestone_on_time',2,'Project milestone completed on time'),('positive_feedback',2,'Verified positive citizen feedback'),('verified_minor',-3,'Verified minor complaint'),('verified_major',-7,'Verified major complaint'),('verified_critical',-15,'Verified critical complaint'),('delay_1_3',-2,'Unjustified delay of 1–3 days'),('delay_4_7',-5,'Unjustified delay of 4–7 days'),('delay_over_7',-10,'Unjustified delay exceeding 7 days'),('quality_failed',-8,'Failed quality inspection'),('safety_major',-15,'Major safety violation')]
        for event_type, points, description in defaults:
            if not s.query(ContractorScoringRule).filter_by(event_type=event_type).first(): s.add(ContractorScoringRule(event_type=event_type,points=points,description=description,is_active=True))
        s.commit()

@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "Utopia Smart Municipal Operations Platform",
        "version": "3.0.0"
    }

@app.get("/", tags=["Health"])
def root_status():
    return {
        "message": "Welcome to Utopia — Municipal Operations & Public Works API",
        "docs": "/docs",
        "health": "/api/health"
    }
