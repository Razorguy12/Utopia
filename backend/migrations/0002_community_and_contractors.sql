-- Additive GCC community verification and contractor performance schema.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contractor_id INTEGER;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS submitter_user_id INTEGER;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS submitter_community_id VARCHAR(64);
ALTER TABLE issues ADD COLUMN IF NOT EXISTS official_verification VARCHAR(24) NOT NULL DEFAULT 'Pending';
ALTER TABLE issues ADD COLUMN IF NOT EXISTS verified_by VARCHAR(120);
ALTER TABLE issues ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS verification_reason TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS internal_notes TEXT;

CREATE TABLE IF NOT EXISTS citizen_users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(256) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_citizen_users_email ON citizen_users(email);

CREATE TABLE IF NOT EXISTS contractors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  registration_number VARCHAR(40) NOT NULL UNIQUE,
  department VARCHAR(100) NOT NULL DEFAULT 'Greater Chennai Corporation',
  private_contact_details TEXT,
  email VARCHAR(254) UNIQUE,
  password_hash VARCHAR(256),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  leaderboard_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_contractors_name ON contractors(name);
CREATE INDEX IF NOT EXISTS ix_contractors_email ON contractors(email);
CREATE INDEX IF NOT EXISTS ix_contractors_registration_number ON contractors(registration_number);
ALTER TABLE contractors ADD COLUMN IF NOT EXISTS onsite_badge_id VARCHAR(40);
CREATE UNIQUE INDEX IF NOT EXISTS ix_contractors_onsite_badge_id ON contractors(onsite_badge_id) WHERE onsite_badge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_projects_contractor_id ON projects(contractor_id);
CREATE INDEX IF NOT EXISTS ix_issues_submitter_user_id ON issues(submitter_user_id);
DO $$ BEGIN ALTER TABLE projects ADD CONSTRAINT fk_projects_contractor_id FOREIGN KEY (contractor_id) REFERENCES contractors(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE issues ADD CONSTRAINT fk_issues_submitter_user_id FOREIGN KEY (submitter_user_id) REFERENCES citizen_users(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Preserve existing named project contractors and leave awarded/placeholder work unassigned.
INSERT INTO contractors(name,registration_number,department)
SELECT p.contractor,'GCC-MIG-'||LPAD(ROW_NUMBER() OVER (ORDER BY p.department,p.contractor)::text,6,'0'),p.department
FROM (SELECT DISTINCT contractor,department FROM projects WHERE contractor IS NOT NULL AND lower(trim(contractor)) NOT IN ('pending tender award','unassigned','tbd','none','')) p
ON CONFLICT (registration_number) DO NOTHING;
UPDATE projects p SET contractor_id=c.id FROM contractors c WHERE p.contractor_id IS NULL AND p.contractor=c.name AND p.department=c.department;
CREATE TABLE IF NOT EXISTS contractor_scores (
  id SERIAL PRIMARY KEY,
  contractor_id INTEGER NOT NULL UNIQUE REFERENCES contractors(id) ON DELETE CASCADE,
  current_score INTEGER NOT NULL DEFAULT 100 CHECK (current_score BETWEEN 0 AND 100),
  current_grade VARCHAR(2) NOT NULL DEFAULT 'A+',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO contractor_scores(contractor_id,current_score,current_grade)
SELECT c.id,100,'A+' FROM contractors c WHERE NOT EXISTS (SELECT 1 FROM contractor_scores sc WHERE sc.contractor_id=c.id);
CREATE TABLE IF NOT EXISTS contractor_score_transactions (
  id SERIAL PRIMARY KEY,
  contractor_id INTEGER NOT NULL REFERENCES contractors(id),
  project_id INTEGER REFERENCES projects(id),
  issue_id INTEGER REFERENCES issues(id),
  event_type VARCHAR(60) NOT NULL,
  event_reference VARCHAR(100) NOT NULL UNIQUE,
  points_change INTEGER NOT NULL,
  previous_score INTEGER NOT NULL CHECK (previous_score BETWEEN 0 AND 100),
  new_score INTEGER NOT NULL CHECK (new_score BETWEEN 0 AND 100),
  reason TEXT NOT NULL,
  verification_reference VARCHAR(100),
  created_by VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_contractor_score_transactions_contractor_id ON contractor_score_transactions(contractor_id);
CREATE INDEX IF NOT EXISTS ix_contractor_score_transactions_issue_id ON contractor_score_transactions(issue_id);
CREATE INDEX IF NOT EXISTS ix_contractor_score_transactions_project_id ON contractor_score_transactions(project_id);
CREATE INDEX IF NOT EXISTS ix_contractor_score_transactions_created_at ON contractor_score_transactions(created_at);

CREATE TABLE IF NOT EXISTS contractor_scoring_rules (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(60) NOT NULL UNIQUE,
  points INTEGER NOT NULL,
  description VARCHAR(240) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by VARCHAR(120),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS contractor_appeals (
  id SERIAL PRIMARY KEY,
  contractor_id INTEGER NOT NULL REFERENCES contractors(id),
  score_transaction_id INTEGER NOT NULL REFERENCES contractor_score_transactions(id),
  appeal_reason TEXT NOT NULL,
  supporting_evidence TEXT,
  status VARCHAR(24) NOT NULL DEFAULT 'Pending',
  admin_response TEXT,
  reviewed_by VARCHAR(120),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_contractor_appeals_contractor_id ON contractor_appeals(contractor_id);
CREATE INDEX IF NOT EXISTS ix_contractor_appeals_score_transaction_id ON contractor_appeals(score_transaction_id);
CREATE TABLE IF NOT EXISTS contractor_inspections (
  id SERIAL PRIMARY KEY,
  contractor_id INTEGER NOT NULL REFERENCES contractors(id),
  project_id INTEGER NOT NULL REFERENCES projects(id),
  inspection_type VARCHAR(60) NOT NULL,
  inspection_score INTEGER,
  inspection_result VARCHAR(24) NOT NULL,
  remarks TEXT NOT NULL,
  inspected_by VARCHAR(120) NOT NULL,
  inspected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS complaint_confirmations (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  citizen_user_id INTEGER REFERENCES citizen_users(id) ON DELETE CASCADE,
  anonymous_id VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT uq_issue_citizen_confirmation UNIQUE(issue_id,citizen_user_id)
);
ALTER TABLE complaint_confirmations ADD COLUMN IF NOT EXISTS anonymous_id VARCHAR(64);
ALTER TABLE complaint_confirmations ALTER COLUMN citizen_user_id DROP NOT NULL;
DO $$ BEGIN ALTER TABLE complaint_confirmations ADD CONSTRAINT uq_issue_anonymous_confirmation UNIQUE(issue_id,anonymous_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS ix_complaint_confirmations_issue_id ON complaint_confirmations(issue_id);
CREATE INDEX IF NOT EXISTS ix_complaint_confirmations_citizen_user_id ON complaint_confirmations(citizen_user_id);
CREATE TABLE IF NOT EXISTS complaint_comments (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  citizen_user_id INTEGER REFERENCES citizen_users(id) ON DELETE CASCADE,
  anonymous_id VARCHAR(64),
  parent_comment_id INTEGER REFERENCES complaint_comments(id) ON DELETE CASCADE,
  comment VARCHAR(2000) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  is_reported BOOLEAN NOT NULL DEFAULT FALSE
);
ALTER TABLE complaint_comments ADD COLUMN IF NOT EXISTS anonymous_id VARCHAR(64);
ALTER TABLE complaint_comments ALTER COLUMN citizen_user_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS ix_complaint_comments_issue_id ON complaint_comments(issue_id);
CREATE INDEX IF NOT EXISTS ix_complaint_comments_citizen_user_id ON complaint_comments(citizen_user_id);
CREATE INDEX IF NOT EXISTS ix_complaint_comments_parent_comment_id ON complaint_comments(parent_comment_id);
CREATE TABLE IF NOT EXISTS comment_evidence (
  id SERIAL PRIMARY KEY,
  comment_id INTEGER NOT NULL REFERENCES complaint_comments(id) ON DELETE CASCADE,
  media_id INTEGER NOT NULL UNIQUE REFERENCES media_attachments(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ix_comment_evidence_comment_id ON comment_evidence(comment_id);

CREATE TABLE IF NOT EXISTS complaint_verifications (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL UNIQUE REFERENCES issues(id) ON DELETE CASCADE,
  verifier_user_id VARCHAR(120) NOT NULL,
  department VARCHAR(100) NOT NULL,
  verification_status VARCHAR(24) NOT NULL,
  verification_reason TEXT NOT NULL,
  verified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_complaint_verifications_issue_id ON complaint_verifications(issue_id);
CREATE TABLE IF NOT EXISTS municipal_settings (
  key VARCHAR(80) PRIMARY KEY,
  value VARCHAR(240) NOT NULL,
  updated_by VARCHAR(120),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS contractor_audit_logs (
  id SERIAL PRIMARY KEY,
  actor VARCHAR(120) NOT NULL,
  action VARCHAR(80) NOT NULL,
  contractor_id INTEGER REFERENCES contractors(id),
  detail TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_contractor_audit_logs_action ON contractor_audit_logs(action);
CREATE INDEX IF NOT EXISTS ix_contractor_audit_logs_contractor_id ON contractor_audit_logs(contractor_id);
CREATE INDEX IF NOT EXISTS ix_contractor_audit_logs_created_at ON contractor_audit_logs(created_at);
