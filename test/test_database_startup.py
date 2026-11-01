from contextlib import contextmanager

from sqlalchemy import inspect, text

from app import database
from app import main


def test_get_db_yields_session_and_closes(monkeypatch):
    class Session:
        closed = False

        def close(self):
            self.closed = True

    session = Session()
    monkeypatch.setattr(database, "SessionLocal", lambda: session)
    generator = database.get_db()
    assert next(generator) is session
    try:
        next(generator)
    except StopIteration:
        pass
    assert session.closed


def test_ensure_columns_adds_legacy_columns_and_is_repeatable(isolated_engine):
    engine = isolated_engine
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE projects (id INTEGER PRIMARY KEY)"))
        conn.execute(text("CREATE TABLE issues (id INTEGER PRIMARY KEY)"))
        conn.execute(text("CREATE TABLE conflict_tickets (id INTEGER PRIMARY KEY)"))
    database.ensure_columns(engine)
    database.ensure_columns(engine)
    inspector = inspect(engine)
    project_cols = {c["name"] for c in inspector.get_columns("projects")}
    issue_cols = {c["name"] for c in inspector.get_columns("issues")}
    conflict_cols = {c["name"] for c in inspector.get_columns("conflict_tickets")}
    assert {"current_step", "technical_scope", "created_by"} <= project_cols
    assert {"department", "official_reply", "pincode"} <= issue_cols
    assert {"approved_dept", "lat", "rescheduled_status"} <= conflict_cols


def test_startup_initializes_and_seeds(monkeypatch):
    calls = []

    class SeedSession:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

    monkeypatch.setattr(main.Base.metadata, "create_all", lambda bind: calls.append("create"))
    monkeypatch.setattr(main, "ensure_columns", lambda engine: calls.append("migrate"))
    monkeypatch.setattr(main, "SessionLocal", SeedSession)
    monkeypatch.setattr(main, "seed_data", lambda session: calls.append("seed"))
    monkeypatch.setattr(main, "cleanup_staged_media", lambda session: calls.append("cleanup"))
    main.on_startup()
    assert calls == ["create", "migrate", "cleanup", "seed"]
