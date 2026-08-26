-- PART 10: CWC visits
CREATE TABLE IF NOT EXISTS cwc_visits (
  id                      SERIAL PRIMARY KEY,
  pharmacy_id             INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  patient_id              INTEGER NOT NULL REFERENCES patients(id),
  visit_id                INTEGER REFERENCES visits(id),
  mother_id               INTEGER REFERENCES patients(id),
  visit_date              TIMESTAMPTZ DEFAULT NOW(),
  age_in_months           INTEGER,
  weight                  NUMERIC(5,2),
  height                  NUMERIC(5,1),
  muac                    NUMERIC(4,1),
  head_circumference      NUMERIC(4,1),
  weight_for_age          VARCHAR(20),
  height_for_age          VARCHAR(20),
  weight_for_height       VARCHAR(20),
  nutritional_status      VARCHAR(50),
  developmental_milestone VARCHAR(100),
  immunization_status     VARCHAR(50),
  vitamin_a_given         BOOLEAN DEFAULT false,
  deworming_given         BOOLEAN DEFAULT false,
  nutrition_counseling    BOOLEAN DEFAULT false,
  breastfeeding_counseling BOOLEAN DEFAULT false,
  complementary_feeding   VARCHAR(100),
  next_appointment        DATE,
  complaints              TEXT,
  assessment              TEXT,
  treatment_given         TEXT,
  notes                   TEXT,
  recorded_by             INTEGER REFERENCES users(id),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- PART 11: Vaccinations
CREATE TABLE IF NOT EXISTS vaccinations (
  id               SERIAL PRIMARY KEY,
  pharmacy_id      INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  patient_id       INTEGER NOT NULL REFERENCES patients(id),
  visit_id         INTEGER REFERENCES visits(id),
  vaccine_order_id INTEGER REFERENCES vaccine_orders(id),
  vaccine_name     VARCHAR(100) NOT NULL,
  vaccine_code     VARCHAR(30),
  dose_number      INTEGER DEFAULT 1,
  batch_number     VARCHAR(100),
  expiry_date      DATE,
  site             VARCHAR(50),
  route            VARCHAR(30),
  administered_at  TIMESTAMPTZ DEFAULT NOW(),
  next_due_date    DATE,
  adverse_reaction TEXT,
  notes            TEXT,
  administered_by  INTEGER REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cwc_visits_patient     ON cwc_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_cwc_visits_date        ON cwc_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_vaccinations_patient   ON vaccinations(patient_id);
CREATE INDEX IF NOT EXISTS idx_vaccinations_vaccine   ON vaccinations(vaccine_name);
CREATE INDEX IF NOT EXISTS idx_vaccinations_batch     ON vaccinations(batch_number);

SELECT 'CWC + Immunization migration complete ✅' as status;
