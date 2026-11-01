-- Utopia multimedia issue evidence (safe to run repeatedly).
-- The application also creates this new table through SQLAlchemy metadata at startup.
CREATE TABLE IF NOT EXISTS media_attachments (
    id SERIAL PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    issue_id INTEGER NULL REFERENCES issues(id) ON DELETE CASCADE,
    upload_token_hash VARCHAR(64) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(80) NOT NULL UNIQUE,
    storage_path VARCHAR(500) NOT NULL,
    media_type VARCHAR(16) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_media_attachments_uuid ON media_attachments(uuid);
CREATE INDEX IF NOT EXISTS ix_media_attachments_issue_id ON media_attachments(issue_id);
CREATE INDEX IF NOT EXISTS ix_media_attachments_upload_token_hash ON media_attachments(upload_token_hash);
CREATE INDEX IF NOT EXISTS ix_media_attachments_created_at ON media_attachments(created_at);
