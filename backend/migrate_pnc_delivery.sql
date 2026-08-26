-- ══════════════════════════════════════════
-- PART 7: PNC visits table
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS pnc_visits (
  id                      SERIAL PRIMARY KEY,
  pharmacy_id             INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  patient_id              INTEGER NOT NULL REFERENCES patients(id),
  visit_id                INTEGER REFERENCES visits(id),
  delivery_id             INTEGER,
  visit_date              TIMESTAMPTZ DEFAULT NOW(),
  days_postpartum         INTEGER,
  mother_weight           NUMERIC(5,2),
  mother_bp               VARCHAR(20),
  mother_temp             NUMERIC(4,1),
  mother_pulse            INTEGER,
  uterus_involution       VARCHAR(50),
  lochia                  VARCHAR(50),
  perineum                VARCHAR(100),
  breast_condition        VARCHAR(100),
  breastfeeding_status    VARCHAR(50),
  mother_complaints       TEXT,
  mother_assessment       TEXT,
  baby_weight             NUMERIC(5,2),
  baby_temp               NUMERIC(4,1),
  baby_condition          VARCHAR(100),
  cord_condition          VARCHAR(50),
  baby_feeding            VARCHAR(50),
  baby_stool              VARCHAR(50),
  baby_urine              VARCHAR(50),
  baby_jaundice           BOOLEAN DEFAULT false,
  baby_assessment         TEXT,
  danger_signs_counseling BOOLEAN DEFAULT false,
  fp_counseling           BOOLEAN DEFAULT false,
  fp_method_chosen        VARCHAR(80),
  nutrition_counseling    BOOLEAN DEFAULT false,
  immunization_counseling BOOLEAN DEFAULT false,
  treatment_given         TEXT,
  next_appointment        DATE,
  referred_to             VARCHAR(100),
  notes                   TEXT,
  recorded_by             INTEGER REFERENCES users(id),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════
-- PART 8: Deliveries + Labour + Babies
-- ══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS deliveries (
  id                   SERIAL PRIMARY KEY,
  pharmacy_id          INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  patient_id           INTEGER NOT NULL REFERENCES patients(id),
  visit_id             INTEGER REFERENCES visits(id),
  anc_id               INTEGER REFERENCES anc_registrations(id),
  delivery_date        TIMESTAMPTZ DEFAULT NOW(),
  delivery_time        TIME,
  delivery_type        VARCHAR(30) DEFAULT 'normal_svd'
                       CHECK (delivery_type IN ('normal_svd','assisted_vacuum','assisted_forceps','caesarean','breech','referral')),
  gestation_at_delivery INTEGER,
  duration_of_labour   VARCHAR(50),
  labour_onset         VARCHAR(30),
  membranes            VARCHAR(30),
  liquor               VARCHAR(30),
  moulding             VARCHAR(10),
  delivered_by         VARCHAR(100),
  place_of_delivery    VARCHAR(100),
  complications        TEXT,
  blood_loss_ml        INTEGER,
  outcome              VARCHAR(30) DEFAULT 'live_birth'
                       CHECK (outcome IN ('live_birth','stillbirth','neonatal_death','maternal_referral')),
  number_of_babies     INTEGER DEFAULT 1,
  placenta_complete    BOOLEAN DEFAULT true,
  placenta_weight      NUMERIC(5,1),
  uterus_contracted    BOOLEAN DEFAULT true,
  perineum_repair      BOOLEAN DEFAULT false,
  repair_details       TEXT,
  notes                TEXT,
  referred_to          VARCHAR(100),
  recorded_by          INTEGER REFERENCES users(id),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS labour_monitoring (
  id                      SERIAL PRIMARY KEY,
  pharmacy_id             INTEGER NOT NULL REFERENCES pharmacies(id),
  delivery_id             INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  recorded_at             TIMESTAMPTZ DEFAULT NOW(),
  cervical_dilation       INTEGER,
  fetal_heart_rate        INTEGER,
  contractions_per_10min  INTEGER,
  contraction_duration    INTEGER,
  mother_bp               VARCHAR(20),
  mother_pulse            INTEGER,
  mother_temp             NUMERIC(4,1),
  descent                 VARCHAR(20),
  moulding                VARCHAR(10),
  liquor                  VARCHAR(20),
  notes                   TEXT,
  recorded_by             INTEGER REFERENCES users(id)
);

-- PART 9: Baby records + child-mother linkage
CREATE TABLE IF NOT EXISTS baby_records (
  id                SERIAL PRIMARY KEY,
  pharmacy_id       INTEGER NOT NULL REFERENCES pharmacies(id),
  delivery_id       INTEGER NOT NULL REFERENCES deliveries(id),
  mother_id         INTEGER NOT NULL REFERENCES patients(id),
  child_patient_id  INTEGER REFERENCES patients(id),
  birth_date        TIMESTAMPTZ DEFAULT NOW(),
  birth_weight      NUMERIC(5,3),
  sex               VARCHAR(10),
  apgar_1min        INTEGER,
  apgar_5min        INTEGER,
  condition_at_birth VARCHAR(100),
  cry_at_birth      BOOLEAN DEFAULT true,
  resuscitation     BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Add mother_id + birth_weight to patients if missing
ALTER TABLE patients ADD COLUMN IF NOT EXISTS mother_id    INTEGER REFERENCES patients(id);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS birth_weight NUMERIC(5,3);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pnc_visits_patient    ON pnc_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_pnc_visits_visit      ON pnc_visits(visit_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_patient    ON deliveries(patient_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_date       ON deliveries(delivery_date);
CREATE INDEX IF NOT EXISTS idx_labour_delivery       ON labour_monitoring(delivery_id);
CREATE INDEX IF NOT EXISTS idx_baby_records_mother   ON baby_records(mother_id);
CREATE INDEX IF NOT EXISTS idx_baby_records_delivery ON baby_records(delivery_id);
CREATE INDEX IF NOT EXISTS idx_patients_mother       ON patients(mother_id);

SELECT 'PNC + Delivery + Baby Records migration complete ✅' as status;
