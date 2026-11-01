"""PostgreSQL-only isolated schema fixtures for API and service tests."""
import asyncio
import os
import sys
import uuid
from datetime import date
from pathlib import Path

import pytest
import httpx
import fastapi.routing
import fastapi.dependencies.utils
import starlette.concurrency
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
os.environ.setdefault("JWT_SECRET", "unit-test-secret-with-enough-entropy-0123456789")
if not os.environ.get("DATABASE_URL"):
    test_database_url = os.environ.get("TEST_DATABASE_URL")
    if test_database_url:
        os.environ["DATABASE_URL"] = test_database_url

from app.config import DB_URL  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Project, ConflictTicket  # noqa: E402


@pytest.fixture()
def isolated_engine():
    """Give each test a private PostgreSQL schema, then remove it completely."""
    schema = f"test_{uuid.uuid4().hex}"
    admin_engine = create_engine(DB_URL, pool_pre_ping=True)
    with admin_engine.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_engine(
        DB_URL,
        pool_pre_ping=True,
        connect_args={"options": f"-csearch_path={schema}"},
    )
    try:
        yield engine
    finally:
        engine.dispose()
        with admin_engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        admin_engine.dispose()


@pytest.fixture()
def db_session(isolated_engine):
    Base.metadata.create_all(isolated_engine)
    factory = sessionmaker(bind=isolated_engine, autoflush=False)
    session = factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session, monkeypatch):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async def run_sync_inline(func, *args, **kwargs):
        # Calling sync handlers inline keeps ASGI tests deterministic.
        return func(*args, **kwargs)

    monkeypatch.setattr(fastapi.routing, "run_in_threadpool", run_sync_inline)
    monkeypatch.setattr(fastapi.dependencies.utils, "run_in_threadpool", run_sync_inline)
    monkeypatch.setattr(starlette.concurrency, "run_in_threadpool", run_sync_inline)

    class ASGIClient:
        """Synchronous facade over HTTPX ASGITransport."""
        def request(self, method, url, **kwargs):
            async def perform():
                transport = httpx.ASGITransport(app=app)
                async with httpx.AsyncClient(transport=transport, base_url="http://test") as raw:
                    return await raw.request(method, url, **kwargs)
            return asyncio.run(perform())

        def get(self, url, **kwargs):
            return self.request("GET", url, **kwargs)

        def post(self, url, **kwargs):
            return self.request("POST", url, **kwargs)

        def delete(self, url, **kwargs):
            return self.request("DELETE", url, **kwargs)

        def patch(self, url, **kwargs):
            return self.request("PATCH", url, **kwargs)

    test_client = ASGIClient()
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def make_project(db_session):
    def create(**overrides):
        defaults = dict(
            code=f"TEST-{db_session.query(Project).count()+1}",
            title="Test drainage work", category="Drainage", department="Chennai Metro Water",
            locality="T. Nagar", pincode="600017", address="Test Road, Chennai",
            description="Test project", status="In progress", progress=25, budget=100000,
            contractor="Test contractor", start_date=date(2026, 1, 1), due_date=date(2026, 12, 31),
            lat=13.0418, lng=80.2337, disruption="One lane closed",
        )
        defaults.update(overrides)
        project = Project(**defaults)
        db_session.add(project)
        db_session.commit()
        db_session.refresh(project)
        return project
    return create


@pytest.fixture()
def token_for(client):
    def login(employee_id="CMW-DIV-0219", password="water123", department="Chennai Metro Water"):
        response = client.post("/api/auth/login", json={
            "employee_id": employee_id, "password": password, "department": department,
        })
        assert response.status_code == 200, response.text
        return response.json()["access_token"]
    return login


@pytest.fixture()
def auth_headers(token_for):
    return {"Authorization": f"Bearer {token_for()}"}


@pytest.fixture()
def make_ticket(db_session):
    def create(**overrides):
        defaults = dict(
            ref="CT-TEST-0001", requesting_dept="Chennai Metro Water", requesting_officer="Test Officer",
            requesting_badge="CMW-TEST", proposed_title="Test proposed work",
            proposed_start=date(2026, 4, 1), proposed_end=date(2026, 9, 1),
            proposed_locality="T. Nagar", proposed_pincode="600017", reason_for_proceeding="Urgent work",
            conflicting_dept="GCC Roads & Bridges", conflicting_project_title="Road resurfacing",
            status="Resolved", approved_dept="GCC Roads & Bridges", rescheduled_dept="Chennai Metro Water",
        )
        defaults.update(overrides)
        ticket = ConflictTicket(**defaults)
        db_session.add(ticket)
        db_session.commit()
        db_session.refresh(ticket)
        return ticket
    return create
