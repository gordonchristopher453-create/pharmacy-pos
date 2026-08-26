-- ANC tables
CREATE TABLE IF NOT EXISTS anc_registrations (
  id                SERIAL PRIMARY KEY,
  pharmacy_id       INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  patient_id        INTEGER NOT NULL REFERENCES patients(id),
  anc_clinic_number VARCHAR(50),
  gravida           INTEGER,
  para              INTEGER,
  lmp               DATE,
  edd               DATE,
  gestation_age     INTEGER,
  marital_status    VARCHAR(30),
  occupation        VARCHAR(100),
  next_of_kin       VARCHAR(100),
  next_of_kin_phone VARCHAR(20),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (patient_id, pharmacy_id)
);

CREATE TABLE IF NOT EXISTS anc_visits (
  id               SERIAL PRIMARY KEY,
  pharmacy_id      INTEGER NOT NULL REFERENCES pharmacies(id),
  anc_id           INTEGER REFERENCES anc_registrations(id),
  visit_id         INTEGER REFERENCES visits(id),
  patient_id       INTEGER NOT NULL REFERENCES patients(id),
  visit_date       TIMESTAMPTZ DEFAULT NOW(),
  weight           NUMERIC(5,2),
  blood_pressure   VARCHAR(20),
  fundal_height    NUMERIC(5,1),
  fetal_heart_rate INTEGER,
  presentation     VARCHAR(50),
  fetal_movement   VARCHAR(30),
  oedema           VARCHAR(30),
  temperature      NUMERIC(4,1),
  blood_group      VARCHAR(5),
  rh_factor        VARCHAR(15),
  hemoglobin       NUMERIC(4,1),
  hiv_test         VARCHAR(20),
  vdrl             VARCHAR(20),
  hiv_test_date    DATE,
  vdrl_date        DATE,
  urinalysis       VARCHAR(100),
  lab_reference    VARCHAR(50),
  performed_by     VARCHAR(100),
  risk_factors     TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS anc_high_risk (
  id          SERIAL PRIMARY KEY,
  pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id),
  anc_id      INTEGER NOT NULL REFERENCES anc_registrations(id) ON DELETE CASCADE,
  condition   VARCHAR(150) NOT NULL,
  notes       TEXT,
  flagged_by  INTEGER REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anc_reg_patient  ON anc_registrations(patient_id);
CREATE INDEX IF NOT EXISTS idx_anc_visits_anc   ON anc_visits(anc_id);
CREATE INDEX IF NOT EXISTS idx_anc_visits_visit ON anc_visits(visit_id);
CREATE INDEX IF NOT EXISTS idx_anc_highrisk_anc ON anc_high_risk(anc_id);

SELECT 'ANC + Billing migration complete ✅' as status;
