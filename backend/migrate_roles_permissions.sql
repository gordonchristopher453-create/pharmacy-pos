-- Add permissions column
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_users_permissions ON users USING GIN (permissions);

-- Seed permissions for existing users
UPDATE users SET permissions = '["can_access_pos","can_manage_stock","can_manage_purchases","can_manage_suppliers","can_manage_expiry_tracking","can_manage_drug_batches","can_view_pharmacy_reports","can_dispense_medication","can_manage_pharmacy","can_search_patients","can_view_patient_demographics"]'::jsonb
  WHERE role = 'pharmacist' AND permissions = '[]'::jsonb;

UPDATE users SET permissions = '["can_manage_users","can_assign_roles","can_assign_permissions","can_manage_departments","can_manage_billing_config","can_manage_sha_settings","can_manage_mch_config","can_manage_wards","can_manage_beds","can_view_all_reports","can_view_executive_dashboard","can_create_bills","can_receive_payments","can_print_receipts","can_print_invoices","can_view_daily_collections","can_view_cash_reports","can_verify_sha_patients","can_create_sha_claims","can_submit_sha_claims","can_track_sha_claims","can_manage_claim_rejections","can_view_claim_reports","can_view_financial_reports","can_view_revenue_reports","can_view_reconciliation","can_view_outstanding_balances","can_view_audit_reports","can_register_patients","can_manage_visits","can_search_patients","can_view_patient_demographics","can_access_pos"]'::jsonb
  WHERE role IN ('admin','facility_admin') AND permissions = '[]'::jsonb;

UPDATE users SET permissions = '["can_register_patients","can_manage_visits","can_book_appointments","can_manage_queue","can_search_patients","can_view_patient_demographics"]'::jsonb
  WHERE role = 'receptionist' AND permissions = '[]'::jsonb;

UPDATE users SET permissions = '["can_do_triage","can_record_vitals","can_add_nursing_notes","can_manage_injections","can_manage_ward_activities","can_search_patients","can_view_patient_demographics","can_manage_visits"]'::jsonb
  WHERE role = 'nurse' AND permissions = '[]'::jsonb;

UPDATE users SET permissions = '["can_do_consultation","can_make_diagnoses","can_write_prescriptions","can_request_lab","can_request_radiology","can_manage_admissions","can_write_discharge_summaries","can_view_clinical_reports","can_do_triage","can_record_vitals","can_search_patients","can_view_patient_demographics","can_manage_visits","can_manage_queue"]'::jsonb
  WHERE role IN ('doctor','clinical_officer') AND permissions = '[]'::jsonb;

UPDATE users SET permissions = '["can_manage_lab","can_record_lab_results","can_validate_lab_results","can_print_lab_reports","can_search_patients","can_view_patient_demographics"]'::jsonb
  WHERE role IN ('lab_technician','lab_officer') AND permissions = '[]'::jsonb;

-- Rename legacy roles
UPDATE users SET role = 'facility_admin'   WHERE role = 'admin';
UPDATE users SET role = 'lab_officer'      WHERE role = 'lab_technician';
UPDATE users SET role = 'clinical_officer' WHERE role = 'radiologist';

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id            BIGSERIAL PRIMARY KEY,
  pharmacy_id   UUID,
  user_id       INT,
  user_email    TEXT,
  action        TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     TEXT,
  old_value     JSONB,
  new_value     JSONB,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_pharmacy    ON audit_log (pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_audit_user        ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action      ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at  ON audit_log (created_at DESC);
