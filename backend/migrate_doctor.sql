CREATE TABLE IF NOT EXISTS consultations (
  id SERIAL PRIMARY KEY,
  pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  visit_id INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES users(id),
  presenting_complaint TEXT,
  history_of_illness TEXT,
  examination_findings TEXT,
  diagnosis TEXT NOT NULL,
  icd_code VARCHAR(20),
  management_plan TEXT,
  follow_up_date DATE,
  follow_up_notes TEXT,
  admit_patient BOOLEAN DEFAULT false,
  referral TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id SERIAL PRIMARY KEY,
  pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  visit_id INTEGER NOT NULL REFERENCES visits(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  doctor_id INTEGER NOT NULL REFERENCES users(id),
  drug_name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100),
  frequency VARCHAR(100),
  duration VARCHAR(100),
  route VARCHAR(50) DEFAULT 'oral',
  instructions TEXT,
  quantity INTEGER,
  status VARCHAR(30) DEFAULT 'pending',
  dispensed_at TIMESTAMPTZ,
  dispensed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lab_requests (
  id SERIAL PRIMARY KEY,
  pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  visit_id INTEGER NOT NULL REFERENCES visits(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  doctor_id INTEGER NOT NULL REFERENCES users(id),
  test_name VARCHAR(255) NOT NULL,
  test_code VARCHAR(50),
  urgency VARCHAR(20) DEFAULT 'routine',
  notes TEXT,
  status VARCHAR(30) DEFAULT 'pending',
  result TEXT,
  result_file_url TEXT,
  resulted_at TIMESTAMPTZ,
  resulted_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultations_visit ON consultations(visit_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_pharmacy ON prescriptions(pharmacy_id, status);
CREATE INDEX IF NOT EXISTS idx_lab_requests_pharmacy ON lab_requests(pharmacy_id, status);
CREATE TABLE IF NOT EXISTS procedures (
  id SERIAL PRIMARY KEY,
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  visit_id UUID NOT NULL REFERENCES visits(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  doctor_id UUID NOT NULL REFERENCES users(id),
  procedure_name VARCHAR(255) NOT NULL,
  procedure_code VARCHAR(50),
  notes TEXT,
  outcome TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_procedures_consultation ON procedures(consultation_id);
