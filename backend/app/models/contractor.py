from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, Text, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base

class Contractor(Base):
    __tablename__ = 'contractors'
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    registration_number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    department: Mapped[str] = mapped_column(String(100), default='Greater Chennai Corporation')
    private_contact_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(254), unique=True, nullable=True, index=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    onsite_badge_id: Mapped[Optional[str]] = mapped_column(String(40), unique=True, nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    leaderboard_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    score: Mapped["ContractorScore"] = relationship(back_populates='contractor', uselist=False, cascade='all, delete-orphan')

class ContractorScore(Base):
    __tablename__ = 'contractor_scores'
    id: Mapped[int] = mapped_column(primary_key=True)
    contractor_id: Mapped[int] = mapped_column(ForeignKey('contractors.id', ondelete='CASCADE'), unique=True, index=True)
    current_score: Mapped[int] = mapped_column(Integer, default=100)
    current_grade: Mapped[str] = mapped_column(String(2), default='A+')
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    contractor: Mapped[Contractor] = relationship(back_populates='score')

class ContractorScoreTransaction(Base):
    __tablename__ = 'contractor_score_transactions'
    __table_args__ = (UniqueConstraint('event_reference', name='uq_contractor_event_reference'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    contractor_id: Mapped[int] = mapped_column(ForeignKey('contractors.id'), index=True)
    project_id: Mapped[Optional[int]] = mapped_column(ForeignKey('projects.id'), nullable=True, index=True)
    issue_id: Mapped[Optional[int]] = mapped_column(ForeignKey('issues.id'), nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(60), index=True)
    event_reference: Mapped[str] = mapped_column(String(100), index=True)
    points_change: Mapped[int] = mapped_column(Integer)
    previous_score: Mapped[int] = mapped_column(Integer)
    new_score: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(Text)
    verification_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_by: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

class ContractorScoringRule(Base):
    __tablename__ = 'contractor_scoring_rules'
    id: Mapped[int] = mapped_column(primary_key=True)
    event_type: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    points: Mapped[int] = mapped_column(Integer)
    description: Mapped[str] = mapped_column(String(240))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_by: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ContractorAppeal(Base):
    __tablename__ = 'contractor_appeals'
    id: Mapped[int] = mapped_column(primary_key=True)
    contractor_id: Mapped[int] = mapped_column(ForeignKey('contractors.id'), index=True)
    score_transaction_id: Mapped[int] = mapped_column(ForeignKey('contractor_score_transactions.id'), index=True)
    appeal_reason: Mapped[str] = mapped_column(Text)
    supporting_evidence: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(24), default='Pending')
    admin_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

class ContractorInspection(Base):
    __tablename__ = 'contractor_inspections'
    id: Mapped[int] = mapped_column(primary_key=True)
    contractor_id: Mapped[int] = mapped_column(ForeignKey('contractors.id'), index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey('projects.id'), index=True)
    inspection_type: Mapped[str] = mapped_column(String(60))
    inspection_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    inspection_result: Mapped[str] = mapped_column(String(24))
    remarks: Mapped[str] = mapped_column(Text)
    inspected_by: Mapped[str] = mapped_column(String(120))
    inspected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class MunicipalSetting(Base):
    __tablename__ = 'municipal_settings'
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[str] = mapped_column(String(240))
    updated_by: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ContractorAuditLog(Base):
    __tablename__ = 'contractor_audit_logs'
    id: Mapped[int] = mapped_column(primary_key=True)
    actor: Mapped[str] = mapped_column(String(120))
    action: Mapped[str] = mapped_column(String(80), index=True)
    contractor_id: Mapped[Optional[int]] = mapped_column(ForeignKey('contractors.id'), nullable=True, index=True)
    detail: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
