from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, DateTime, Text, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base

class Issue(Base):
    __tablename__ = 'issues'
    id: Mapped[int] = mapped_column(primary_key=True)
    ref: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    project_id: Mapped[Optional[int]] = mapped_column(ForeignKey('projects.id'), nullable=True, index=True)
    submitter_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey('citizen_users.id'), nullable=True, index=True)
    submitter_community_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    kind: Mapped[str] = mapped_column(String(180))
    department: Mapped[Optional[str]] = mapped_column(String(100), default='Greater Chennai Corporation', nullable=True)
    message: Mapped[str] = mapped_column(Text)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default='Open')
    severity: Mapped[str] = mapped_column(String(20), default='Normal')
    locality: Mapped[str] = mapped_column(String(100))
    pincode: Mapped[Optional[str]] = mapped_column(String(6), nullable=True)
    is_question: Mapped[bool] = mapped_column(Boolean, default=False)
    intimated_in_advance: Mapped[bool] = mapped_column(Boolean, default=False)
    created: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    official_reply: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    replied_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    replied_by: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    official_verification: Mapped[str] = mapped_column(String(24), default='Pending')
    verified_by: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    verification_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    internal_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confirmations: Mapped[list["ComplaintConfirmation"]] = relationship(cascade="all, delete-orphan")
    comments: Mapped[list["ComplaintComment"]] = relationship(cascade="all, delete-orphan")
    attachments: Mapped[list["MediaAttachment"]] = relationship(back_populates="issue", cascade="all, delete-orphan")


class CitizenUser(Base):
    __tablename__ = 'citizen_users'
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ComplaintConfirmation(Base):
    __tablename__ = 'complaint_confirmations'
    __table_args__ = (
        UniqueConstraint('issue_id', 'citizen_user_id', name='uq_issue_citizen_confirmation'),
        UniqueConstraint('issue_id', 'anonymous_id', name='uq_issue_anonymous_confirmation'),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    issue_id: Mapped[int] = mapped_column(ForeignKey('issues.id', ondelete='CASCADE'), index=True)
    citizen_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey('citizen_users.id', ondelete='CASCADE'), nullable=True, index=True)
    anonymous_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ComplaintComment(Base):
    __tablename__ = 'complaint_comments'
    id: Mapped[int] = mapped_column(primary_key=True)
    issue_id: Mapped[int] = mapped_column(ForeignKey('issues.id', ondelete='CASCADE'), index=True)
    citizen_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey('citizen_users.id', ondelete='CASCADE'), nullable=True, index=True)
    anonymous_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    parent_comment_id: Mapped[Optional[int]] = mapped_column(ForeignKey('complaint_comments.id', ondelete='CASCADE'), nullable=True, index=True)
    comment: Mapped[str] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    is_reported: Mapped[bool] = mapped_column(Boolean, default=False)
    evidence: Mapped[list["CommentEvidence"]] = relationship(cascade="all, delete-orphan")


class CommentEvidence(Base):
    __tablename__ = 'comment_evidence'
    id: Mapped[int] = mapped_column(primary_key=True)
    comment_id: Mapped[int] = mapped_column(ForeignKey('complaint_comments.id', ondelete='CASCADE'), index=True)
    media_id: Mapped[int] = mapped_column(ForeignKey('media_attachments.id', ondelete='CASCADE'), unique=True)
    media: Mapped["MediaAttachment"] = relationship()


class ComplaintVerification(Base):
    __tablename__ = 'complaint_verifications'
    id: Mapped[int] = mapped_column(primary_key=True)
    issue_id: Mapped[int] = mapped_column(ForeignKey('issues.id', ondelete='CASCADE'), unique=True, index=True)
    verifier_user_id: Mapped[str] = mapped_column(String(120))
    department: Mapped[str] = mapped_column(String(100))
    verification_status: Mapped[str] = mapped_column(String(24))
    verification_reason: Mapped[str] = mapped_column(Text)
    verified_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
