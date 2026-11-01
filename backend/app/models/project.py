from datetime import date, datetime
from typing import Optional, List
from sqlalchemy import String, Integer, Float, Date, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base

class Project(Base):
    __tablename__ = 'projects'
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(180))
    category: Mapped[str] = mapped_column(String(80))
    department: Mapped[str] = mapped_column(String(100))
    locality: Mapped[str] = mapped_column(String(100), index=True)
    pincode: Mapped[str] = mapped_column(String(6), index=True)
    address: Mapped[str] = mapped_column(String(180))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30))
    progress: Mapped[int] = mapped_column(Integer)
    budget: Mapped[int] = mapped_column(Integer)
    contractor: Mapped[str] = mapped_column(String(120))
    contractor_id: Mapped[Optional[int]] = mapped_column(ForeignKey('contractors.id'), nullable=True, index=True)
    start_date: Mapped[date] = mapped_column(Date)
    due_date: Mapped[date] = mapped_column(Date)
    revised_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    disruption: Mapped[str] = mapped_column(String(100))
    delay_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    mitigation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Amazon tracker & Google Maps enhancements
    current_step: Mapped[int] = mapped_column(Integer, default=3)
    contact_engineer_name: Mapped[str] = mapped_column(String(120), default="Er. K. Ramanathan")
    contact_engineer_phone: Mapped[str] = mapped_column(String(40), default="+91 94440 28192")
    contact_engineer_email: Mapped[str] = mapped_column(String(100), default="engineer.civicworks@chennaicorporation.gov.in")
    contact_contractor: Mapped[str] = mapped_column(String(120), default="MetroLink Infrastructure Ltd.")
    contact_contractor_phone: Mapped[str] = mapped_column(String(40), default="+91 98841 55210")
    noise_warning: Mapped[str] = mapped_column(String(200), default="Permitted high-noise window: 22:00 - 04:00")
    dust_warning: Mapped[str] = mapped_column(String(200), default="Trenching dust window: 09:00 - 14:00")
    gmaps_broadcast: Mapped[bool] = mapped_column(Boolean, default=True)
    detour_advice: Mapped[str] = mapped_column(String(200), default="Traffic diversion via Panagal Park")
    technical_scope: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    funding_program: Mapped[str] = mapped_column(String(120), default="Municipal Infrastructure Capital Fund")
    created_by: Mapped[str] = mapped_column(String(120), default="Official Sanction")

    events: Mapped[List["Event"]] = relationship(back_populates="project", cascade="all, delete-orphan")

class Event(Base):
    __tablename__ = 'events'
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey('projects.id'), index=True)
    title: Mapped[str] = mapped_column(String(140))
    detail: Mapped[str] = mapped_column(Text)
    created: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    verified: Mapped[bool] = mapped_column(Boolean, default=True)

    project: Mapped["Project"] = relationship(back_populates="events")
