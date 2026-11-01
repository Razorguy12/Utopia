from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from .config import DB_URL

engine = create_engine(DB_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False)

class Base(DeclarativeBase):
    pass

def get_db():
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()

# Alias for backwards compatibility
db = get_db

def ensure_columns(target_engine):
    """Add missing legacy columns without issuing duplicate DDL on PostgreSQL."""
    column_specs = {
        'projects': [
            ('current_step', 'INTEGER DEFAULT 3'),
            ('contact_engineer_name', "VARCHAR(120) DEFAULT 'Er. K. Ramanathan'"),
            ('contact_engineer_phone', "VARCHAR(40) DEFAULT '+91 94440 28192'"),
            ('contact_engineer_email', "VARCHAR(100) DEFAULT 'engineer.civicworks@chennaicorporation.gov.in'"),
            ('contact_contractor', "VARCHAR(120) DEFAULT 'MetroLink Infrastructure Ltd.'"),
            ('contact_contractor_phone', "VARCHAR(40) DEFAULT '+91 98841 55210'"),
            ('noise_warning', "VARCHAR(200) DEFAULT 'Permitted high-noise window: 22:00 - 04:00'"),
            ('dust_warning', "VARCHAR(200) DEFAULT 'Trenching dust window: 09:00 - 14:00'"),
            ('gmaps_broadcast', "BOOLEAN DEFAULT TRUE"),
            ('detour_advice', "VARCHAR(200) DEFAULT 'Traffic diversion via Panagal Park'"),
            ('technical_scope', "TEXT"),
            ('funding_program', "VARCHAR(120) DEFAULT 'Municipal Infrastructure Capital Fund'"),
            ('created_by', "VARCHAR(120) DEFAULT 'Official Sanction'"),
            ('contractor_id', 'INTEGER')
        ],
        'issues': [
            ('department', "VARCHAR(100) DEFAULT 'Greater Chennai Corporation'"),
            ('phone', 'VARCHAR(20)'),
            ('email', 'VARCHAR(100)'),
            ('pincode', 'VARCHAR(6)'),
            ('is_question', 'BOOLEAN DEFAULT FALSE'),
            ('intimated_in_advance', 'BOOLEAN DEFAULT FALSE'),
            ('official_reply', 'TEXT'),
            ('replied_at', 'TIMESTAMP'),
            ('replied_by', 'VARCHAR(120)')
            ,('official_verification', "VARCHAR(24) DEFAULT 'Pending'")
            ,('verified_by', 'VARCHAR(120)')
            ,('verified_at', 'TIMESTAMP')
            ,('verification_reason', 'TEXT')
            ,('internal_notes', 'TEXT')
            ,('submitter_user_id', 'INTEGER')
            ,('submitter_community_id', 'VARCHAR(64)')
        ],
        'contractors': [
            ('onsite_badge_id', 'VARCHAR(40)')
        ],
        'conflict_tickets': [
            ('requesting_dept_notified', 'BOOLEAN DEFAULT FALSE'),
            ('conflicting_dept_notified', 'BOOLEAN DEFAULT FALSE'),
            ('approved_dept', 'VARCHAR(100)'),
            ('rescheduled_dept', 'VARCHAR(100)'),
            ('rescheduled_start', 'DATE'),
            ('rescheduled_end', 'DATE'),
            ('rescheduled_status', 'VARCHAR(50)'),
            ('requesting_project_id', 'INTEGER'),
            ('proposed_category', 'VARCHAR(100)'),
            ('proposed_description', 'TEXT'),
            ('proposed_budget', 'INTEGER'),
            ('ward_id', 'INTEGER'),
            ('lat', 'FLOAT'),
            ('lng', 'FLOAT'),
        ],
    }

    for table, columns in column_specs.items():
        existing_tables = inspect(target_engine).get_table_names()
        if table not in existing_tables:
            continue
        existing_columns = {column['name'] for column in inspect(target_engine).get_columns(table)}
        for col, col_type in columns:
            if col in existing_columns:
                continue
            with target_engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
            existing_columns.add(col)

    if 'contractors' in inspect(target_engine).get_table_names():
        with target_engine.begin() as conn:
            conn.execute(text('CREATE UNIQUE INDEX IF NOT EXISTS ix_contractors_onsite_badge_id ON contractors (onsite_badge_id) WHERE onsite_badge_id IS NOT NULL'))

    # Widen old PostgreSQL installs to match Issue.kind before seeding or writes.
    if 'issues' in inspect(target_engine).get_table_names():
        kind = next((column for column in inspect(target_engine).get_columns('issues') if column['name'] == 'kind'), None)
        if kind and getattr(kind['type'], 'length', None) is not None and kind['type'].length < 180:
            with target_engine.begin() as conn:
                conn.execute(text('ALTER TABLE issues ALTER COLUMN kind TYPE VARCHAR(180)'))

    # Community interactions allow signed-out browser participants. Preserve old account-linked records.
    tables = inspect(target_engine).get_table_names()
    for table in ('complaint_confirmations', 'complaint_comments'):
        if table not in tables:
            continue
        columns = {column['name'] for column in inspect(target_engine).get_columns(table)}
        columns_to_add = [('anonymous_id', 'VARCHAR(64)')]
        if table == 'complaint_comments':
            columns_to_add.append(('parent_comment_id', 'INTEGER'))
        for column, type_sql in columns_to_add:
            if column not in columns:
                with target_engine.begin() as conn:
                    conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {column} {type_sql}'))
                columns.add(column)
        if 'citizen_user_id' in columns:
            with target_engine.begin() as conn:
                conn.execute(text(f'ALTER TABLE {table} ALTER COLUMN citizen_user_id DROP NOT NULL'))
        if table == 'complaint_confirmations':
            with target_engine.begin() as conn:
                conn.execute(text('CREATE UNIQUE INDEX IF NOT EXISTS uq_issue_anonymous_confirmation ON complaint_confirmations (issue_id, anonymous_id) WHERE anonymous_id IS NOT NULL'))
        if table == 'complaint_comments' and 'parent_comment_id' in columns:
            # Existing installs may have received this column before its self-FK was introduced.
            if target_engine.dialect.name == 'postgresql':
                with target_engine.begin() as conn:
                    conn.execute(text("DO $$ BEGIN ALTER TABLE complaint_comments ADD CONSTRAINT fk_complaint_comments_parent FOREIGN KEY (parent_comment_id) REFERENCES complaint_comments(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$"))
