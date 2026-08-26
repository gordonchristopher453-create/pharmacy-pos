-- Migration for Kenya Digital Health Agency (DHA) Compliance Standards
-- Aligned with the Kenya Digital Health Act 2023, SHA (Social Health Authority), and KHIE (Kenya National Health Information Exchange)

-- 1. Add Kenyan National ID, Social Health Authority (SHA) No, and HIE Consent Status to Patients table
ALTER TABLE patients ADD COLUMN IF NOT EXISTS pharmacy_id INT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS national_id TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS sha_number TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nabidh_consent VARCHAR(20) DEFAULT 'opt_out'; -- opt_in, opt_out (KHIE HIE Consent)
ALTER TABLE patients ADD COLUMN IF NOT EXISTS passport_number VARCHAR(50);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS county VARCHAR(100);

-- Ensure patient columns are TEXT type to support AES-256 encrypted fields
ALTER TABLE patients ALTER COLUMN national_id TYPE TEXT;
ALTER TABLE patients ALTER COLUMN sha_number TYPE TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS allergies TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS chronic_conditions TEXT;
ALTER TABLE patients ALTER COLUMN allergies TYPE TEXT;
ALTER TABLE patients ALTER COLUMN chronic_conditions TYPE TEXT;

-- 2. Add DHA Professional KMPDC/PPB License and Title to Users table (for doctors/nurses)
ALTER TABLE users ADD COLUMN IF NOT EXISTS dha_license_number VARCHAR(100); -- Clinician KMPDC/PPB Registration No
ALTER TABLE users ADD COLUMN IF NOT EXISTS professional_title VARCHAR(255); -- e.g. Medical Officer, Specialist, Consultant Pharmacist

-- 3. Add PPB / KEMSA Drug Code and Scientific/Generic Code to Prescriptions table
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS ddc_code VARCHAR(100); -- PPB / KEMSA Drug Registration Code
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS scientific_code VARCHAR(100);

-- 4. Add CPT / MoH Code to Lab Requests and Procedures
ALTER TABLE lab_requests ADD COLUMN IF NOT EXISTS cpt_code VARCHAR(50);
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS cpt_code VARCHAR(50);

-- 5. Add DHA digital signature status and KHIE Sync details to Consultations
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS dha_signed BOOLEAN DEFAULT FALSE; -- Digitally signed under Digital Health Act 2023
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS dha_signed_at TIMESTAMPTZ;
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS nabidh_sync_status VARCHAR(50) DEFAULT 'pending'; -- KHIE sync status: pending, synced, failed
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS nabidh_sync_at TIMESTAMPTZ; -- KHIE sync timestamp
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS review_of_systems TEXT;

-- 6. Support 'read' and 'export' actions in audit_log for Data Protection Act 2019 compliance
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
UPDATE audit_log SET action = 'create' WHERE action = 'INSERT';
UPDATE audit_log SET action = 'create' WHERE action NOT IN ('create','update','delete','read','export');
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check CHECK (action IN ('create','update','delete','read','export'));

-- 7. Add dha_facility_id / sha_facility_code / facility_credentials tables
CREATE TABLE IF NOT EXISTS dha_facilities (
  id SERIAL PRIMARY KEY,
  pharmacy_id INT NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  dha_facility_id VARCHAR(100) NOT NULL UNIQUE,
  sha_facility_code VARCHAR(100) NOT NULL,
  facility_name VARCHAR(255) NOT NULL,
  county VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS facility_credentials (
  id SERIAL PRIMARY KEY,
  pharmacy_id INT NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  api_client_id VARCHAR(255) NOT NULL,
  api_client_secret TEXT NOT NULL,
  hie_endpoint TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Enable Row-Level Security (RLS) on tables for secure tenant isolation
-- Tables to secure: patients, visits, consultations, prescriptions, lab_requests, products, categories, sales, billing_items, dha_facilities, facility_credentials
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE dha_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_credentials ENABLE ROW LEVEL SECURITY;

-- 9. Create policies to restrict access based on app.current_pharmacy_id session variable
-- Policies will bypass when the session variable is empty (e.g. during migrations, seeding, background task) to ensure seamless startup.
DROP POLICY IF EXISTS tenant_patients_policy ON patients;
CREATE POLICY tenant_patients_policy ON patients USING (
  NULLIF(current_setting('app.current_pharmacy_id', true), '') IS NULL OR
  pharmacy_id = NULLIF(current_setting('app.current_pharmacy_id', true), '')::integer
);

DROP POLICY IF EXISTS tenant_visits_policy ON visits;
CREATE POLICY tenant_visits_policy ON visits USING (
  NULLIF(current_setting('app.current_pharmacy_id', true), '') IS NULL OR
  pharmacy_id = NULLIF(current_setting('app.current_pharmacy_id', true), '')::integer
);

DROP POLICY IF EXISTS tenant_consultations_policy ON consultations;
CREATE POLICY tenant_consultations_policy ON consultations USING (
  NULLIF(current_setting('app.current_pharmacy_id', true), '') IS NULL OR
  pharmacy_id = NULLIF(current_setting('app.current_pharmacy_id', true), '')::integer
);

DROP POLICY IF EXISTS tenant_prescriptions_policy ON prescriptions;
CREATE POLICY tenant_prescriptions_policy ON prescriptions USING (
  NULLIF(current_setting('app.current_pharmacy_id', true), '') IS NULL OR
  pharmacy_id = NULLIF(current_setting('app.current_pharmacy_id', true), '')::integer
);

DROP POLICY IF EXISTS tenant_lab_requests_policy ON lab_requests;
CREATE POLICY tenant_lab_requests_policy ON lab_requests USING (
  NULLIF(current_setting('app.current_pharmacy_id', true), '') IS NULL OR
  pharmacy_id = NULLIF(current_setting('app.current_pharmacy_id', true), '')::integer
);

DROP POLICY IF EXISTS tenant_products_policy ON products;
CREATE POLICY tenant_products_policy ON products USING (
  NULLIF(current_setting('app.current_pharmacy_id', true), '') IS NULL OR
  pharmacy_id = NULLIF(current_setting('app.current_pharmacy_id', true), '')::integer
);

DROP POLICY IF EXISTS tenant_categories_policy ON categories;
CREATE POLICY tenant_categories_policy ON categories USING (
  NULLIF(current_setting('app.current_pharmacy_id', true), '') IS NULL OR
  pharmacy_id = NULLIF(current_setting('app.current_pharmacy_id', true), '')::integer
);

DROP POLICY IF EXISTS tenant_sales_policy ON sales;
CREATE POLICY tenant_sales_policy ON sales USING (
  NULLIF(current_setting('app.current_pharmacy_id', true), '') IS NULL OR
  pharmacy_id = NULLIF(current_setting('app.current_pharmacy_id', true), '')::integer
);

DROP POLICY IF EXISTS tenant_billing_items_policy ON billing_items;
CREATE POLICY tenant_billing_items_policy ON billing_items USING (
  NULLIF(current_setting('app.current_pharmacy_id', true), '') IS NULL OR
  facility_id = NULLIF(current_setting('app.current_pharmacy_id', true), '')::integer
);

DROP POLICY IF EXISTS tenant_dha_facilities_policy ON dha_facilities;
CREATE POLICY tenant_dha_facilities_policy ON dha_facilities USING (
  NULLIF(current_setting('app.current_pharmacy_id', true), '') IS NULL OR
  pharmacy_id = NULLIF(current_setting('app.current_pharmacy_id', true), '')::integer
);

DROP POLICY IF EXISTS tenant_facility_credentials_policy ON facility_credentials;
CREATE POLICY tenant_facility_credentials_policy ON facility_credentials USING (
  NULLIF(current_setting('app.current_pharmacy_id', true), '') IS NULL OR
  pharmacy_id = NULLIF(current_setting('app.current_pharmacy_id', true), '')::integer
);
