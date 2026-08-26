-- ══════════════════════════════════════════════════════════
-- PART 3 & 4: Visit Architecture + ServiceOrder Engine
-- Safe to run multiple times
-- ══════════════════════════════════════════════════════════

-- 1. visits table (central hub for all patient interactions)
CREATE TABLE IF NOT EXISTS visits (
  id              SERIAL PRIMARY KEY,
  pharmacy_id     INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  patient_id      INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_number    VARCHAR(30) UNIQUE NOT NULL,
  visit_type      VARCHAR(30) NOT NULL DEFAULT 'opd'
                  CHECK (visit_type IN ('opd','anc','pnc','delivery','family_planning','cwc','immunization','inpatient','emergency')),
  status          VARCHAR(20) NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'triage', 'triaged', 'waiting', 'with_doctor', 'lab', 'pharmacy', 'radiology', 'injection_room', 'in_progress', 'completed', 'discharged', 'admitted', 'cancelled', 'mch', 'billing')),
  priority        VARCHAR(15) DEFAULT 'normal'
                  CHECK (priority IN ('normal','urgent','emergency')),
  chief_complaint TEXT,
  opened_by       INTEGER REFERENCES users(id),
  closed_by       INTEGER REFERENCES users(id),
  opened_at       TIMESTAMPTZ DEFAULT NOW(),
  closed_at       TIMESTAMPTZ,
  notes           TEXT,
  department      VARCHAR(50),
  mch_service     VARCHAR(50),
  consultation_fee DECIMAL(10,2) DEFAULT 0,
  fee_paid        BOOLEAN DEFAULT FALSE,
  payment_method  VARCHAR(50),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. service_orders (the inter-department communication engine)
CREATE TABLE IF NOT EXISTS service_orders (
  id              SERIAL PRIMARY KEY,
  pharmacy_id     INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  visit_id        INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  patient_id      INTEGER NOT NULL REFERENCES patients(id),
  order_type      VARCHAR(20) NOT NULL
                  CHECK (order_type IN ('lab','prescription','vaccine','procedure','referral','consultation')),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','in_progress','completed','cancelled')),
  priority        VARCHAR(15) DEFAULT 'normal',
  ordered_by      INTEGER REFERENCES users(id),
  ordered_by_dept VARCHAR(50),
  assigned_to_dept VARCHAR(50),
  fulfilled_by    INTEGER REFERENCES users(id),
  fulfilled_at    TIMESTAMPTZ,
  notes           TEXT,
  result_notes    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. lab_orders (linked to service_orders)
CREATE TABLE IF NOT EXISTS lab_orders (
  id                SERIAL PRIMARY KEY,
  pharmacy_id       INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  service_order_id  INTEGER REFERENCES service_orders(id),
  visit_id          INTEGER REFERENCES visits(id),
  patient_id        INTEGER NOT NULL REFERENCES patients(id),
  test_name         VARCHAR(100) NOT NULL,
  test_code         VARCHAR(30),
  category          VARCHAR(50),
  status            VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending','paid','in_progress','completed','cancelled')),
  ordered_by        INTEGER REFERENCES users(id),
  performed_by      INTEGER REFERENCES users(id),
  result_value      TEXT,
  result_unit       VARCHAR(30),
  result_range      VARCHAR(50),
  result_flag       VARCHAR(10),
  result_notes      TEXT,
  resulted_at       TIMESTAMPTZ,
  price             NUMERIC(10,2) DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 4. prescriptions (linked to service_orders)
CREATE TABLE IF NOT EXISTS prescriptions (
  id                SERIAL PRIMARY KEY,
  pharmacy_id       INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  service_order_id  INTEGER REFERENCES service_orders(id),
  visit_id          INTEGER REFERENCES visits(id),
  patient_id        INTEGER NOT NULL REFERENCES patients(id),
  product_id        INTEGER REFERENCES products(id),
  drug_name         VARCHAR(150) NOT NULL,
  dosage            VARCHAR(100),
  frequency         VARCHAR(80),
  duration          VARCHAR(80),
  quantity          INTEGER DEFAULT 1,
  instructions      TEXT,
  status            VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending','dispensed','cancelled','partial')),
  prescribed_by     INTEGER REFERENCES users(id),
  dispensed_by      INTEGER REFERENCES users(id),
  dispensed_at      TIMESTAMPTZ,
  price             NUMERIC(10,2) DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 5. vaccine_orders (linked to service_orders)
CREATE TABLE IF NOT EXISTS vaccine_orders (
  id                SERIAL PRIMARY KEY,
  pharmacy_id       INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  service_order_id  INTEGER REFERENCES service_orders(id),
  visit_id          INTEGER REFERENCES visits(id),
  patient_id        INTEGER NOT NULL REFERENCES patients(id),
  vaccine_name      VARCHAR(100) NOT NULL,
  vaccine_code      VARCHAR(30),
  dose_number       INTEGER DEFAULT 1,
  batch_number      VARCHAR(100),
  expiry_date       DATE,
  site              VARCHAR(50),
  route             VARCHAR(30),
  status            VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending','administered','cancelled')),
  ordered_by        INTEGER REFERENCES users(id),
  administered_by   INTEGER REFERENCES users(id),
  administered_at   TIMESTAMPTZ,
  next_due_date     DATE,
  price             NUMERIC(10,2) DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 6. billing_items (auto-created by service orders)
CREATE TABLE IF NOT EXISTS billing_items (
  id                SERIAL PRIMARY KEY,
  pharmacy_id       INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  visit_id          INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  patient_id        INTEGER NOT NULL REFERENCES patients(id),
  service_order_id  INTEGER REFERENCES service_orders(id),
  item_type         VARCHAR(20) NOT NULL
                    CHECK (item_type IN ('lab','prescription','vaccine','procedure','consultation','other')),
  description       VARCHAR(200) NOT NULL,
  quantity          INTEGER DEFAULT 1,
  unit_price        NUMERIC(10,2) DEFAULT 0,
  total_price       NUMERIC(10,2) DEFAULT 0,
  status            VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending','paid','waived','cancelled','insurance','nhif','sha')),
  payment_method    VARCHAR(30),
  paid_at           TIMESTAMPTZ,
  waived_by         INTEGER REFERENCES users(id),
  waive_reason      TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 7. clinical_notes
CREATE TABLE IF NOT EXISTS clinical_notes (
  id              SERIAL PRIMARY KEY,
  pharmacy_id     INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  visit_id        INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  patient_id      INTEGER NOT NULL REFERENCES patients(id),
  note_type       VARCHAR(30) DEFAULT 'general'
                  CHECK (note_type IN ('general','nursing','doctor','anc','pnc','delivery','triage','discharge')),
  subjective      TEXT,
  objective       TEXT,
  assessment      TEXT,
  plan            TEXT,
  notes           TEXT,
  written_by      INTEGER REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 8. audit_trail (Part 17)
CREATE TABLE IF NOT EXISTS audit_trail (
  id              SERIAL PRIMARY KEY,
  pharmacy_id     INTEGER REFERENCES pharmacies(id),
  user_id         INTEGER REFERENCES users(id),
  user_name       VARCHAR(100),
  department      VARCHAR(50),
  action          VARCHAR(100) NOT NULL,
  entity_type     VARCHAR(50),
  entity_id       INTEGER,
  old_values      JSONB,
  new_values      JSONB,
  ip_address      VARCHAR(45),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_visits_pharmacy    ON visits(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_visits_patient     ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_status      ON visits(status);
CREATE INDEX IF NOT EXISTS idx_service_orders_visit   ON service_orders(visit_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_status  ON service_orders(status);
CREATE INDEX IF NOT EXISTS idx_service_orders_dept    ON service_orders(assigned_to_dept);
CREATE INDEX IF NOT EXISTS idx_lab_orders_visit   ON lab_orders(visit_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_visit ON prescriptions(visit_id);
CREATE INDEX IF NOT EXISTS idx_vaccine_orders_visit ON vaccine_orders(visit_id);
CREATE INDEX IF NOT EXISTS idx_billing_items_visit ON billing_items(visit_id);
CREATE INDEX IF NOT EXISTS idx_billing_items_status ON billing_items(status);
CREATE INDEX IF NOT EXISTS idx_audit_trail_entity ON audit_trail(entity_type, entity_id);

-- 10. visit_number sequence function
CREATE OR REPLACE FUNCTION generate_visit_number(p_pharmacy_id INTEGER)
RETURNS VARCHAR AS $$
DECLARE
  v_prefix VARCHAR;
  v_count  INTEGER;
BEGIN
  v_prefix := 'V-' || TO_CHAR(NOW(), 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO v_count
  FROM visits WHERE pharmacy_id = p_pharmacy_id AND visit_number LIKE v_prefix || '%';
  RETURN v_prefix || '-' || LPAD(v_count::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

SELECT 'Visit Architecture Migration Complete ✅' as status;
