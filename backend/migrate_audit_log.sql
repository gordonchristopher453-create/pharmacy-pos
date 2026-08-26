-- Append-only audit log for clinical records.
-- This table is never UPDATEd or DELETEd from by the application —
-- only INSERTed into. That's what makes it useful as evidence: a row
-- in `consultations` or `prescriptions` could theoretically be argued
-- as edited after the fact, but a row here, once written, has no code
-- path that touches it again.

CREATE TABLE IF NOT EXISTS audit_log (
  id            BIGSERIAL PRIMARY KEY,
  pharmacy_id   INTEGER NOT NULL,
  table_name    TEXT NOT NULL,
  record_id     INTEGER NOT NULL,
  action        TEXT NOT NULL CHECK (action IN ('create','update','delete')),
  old_data      JSONB,
  new_data      JSONB,
  changed_by    INTEGER,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  visit_id      INTEGER,
  patient_id    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_audit_log_record ON audit_log (table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_visit   ON audit_log (visit_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_patient ON audit_log (patient_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_pharmacy ON audit_log (pharmacy_id, changed_at);
