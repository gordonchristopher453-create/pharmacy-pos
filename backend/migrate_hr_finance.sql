-- ==========================================================
-- PREMIUM HR & FINANCE MODULE SCHEMA
-- ==========================================================

-- 1. Staff Profiles & HR Details
CREATE TABLE IF NOT EXISTS staff_profiles (
  id SERIAL PRIMARY KEY,
  pharmacy_id TEXT NOT NULL,
  user_id UUID,
  employee_number VARCHAR(50),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  national_id VARCHAR(50),
  gender VARCHAR(20),
  date_of_birth DATE,
  date_joined DATE DEFAULT CURRENT_DATE,
  department VARCHAR(100) DEFAULT 'Clinical',
  designation VARCHAR(100),
  employment_type VARCHAR(50) DEFAULT 'full_time',
  contract_end_date DATE,
  kra_pin VARCHAR(50),
  nssf_number VARCHAR(50),
  sha_number VARCHAR(50),
  license_board VARCHAR(100),
  license_number VARCHAR(100),
  license_expiry DATE,
  basic_salary DECIMAL(12,2) DEFAULT 0,
  house_allowance DECIMAL(12,2) DEFAULT 0,
  transport_allowance DECIMAL(12,2) DEFAULT 0,
  other_allowances DECIMAL(12,2) DEFAULT 0,
  bank_name VARCHAR(100),
  bank_branch VARCHAR(100),
  bank_account VARCHAR(50),
  mpesa_number VARCHAR(50),
  annual_leave_days INTEGER DEFAULT 21,
  leave_balance INTEGER DEFAULT 21,
  status VARCHAR(30) DEFAULT 'active',
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(50),
  emergency_contact_relation VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Leave Management
CREATE TABLE IF NOT EXISTS leave_requests (
  id SERIAL PRIMARY KEY,
  pharmacy_id TEXT NOT NULL,
  user_id UUID,
  employee_name VARCHAR(255) NOT NULL,
  department VARCHAR(100),
  leave_type VARCHAR(50) NOT NULL DEFAULT 'annual',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  handover_staff VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_by_name VARCHAR(255),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Shift Schedules & Duty Roster
CREATE TABLE IF NOT EXISTS shift_schedules (
  id SERIAL PRIMARY KEY,
  pharmacy_id TEXT NOT NULL,
  user_id UUID,
  employee_name VARCHAR(255) NOT NULL,
  department VARCHAR(100) NOT NULL DEFAULT 'Clinical',
  shift_type VARCHAR(50) NOT NULL DEFAULT 'morning',
  shift_date DATE NOT NULL,
  start_time VARCHAR(20),
  end_time VARCHAR(20),
  notes TEXT,
  status VARCHAR(30) DEFAULT 'scheduled',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Petty Cash Book
CREATE TABLE IF NOT EXISTS petty_cash (
  id SERIAL PRIMARY KEY,
  pharmacy_id TEXT NOT NULL,
  transaction_type VARCHAR(20) NOT NULL,
  category VARCHAR(50) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT NOT NULL,
  payee_or_source VARCHAR(255),
  voucher_number VARCHAR(100),
  payment_method VARCHAR(50) DEFAULT 'cash',
  receipt_ref VARCHAR(255),
  recorded_by UUID,
  recorded_by_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_staff_profiles_pharmacy ON staff_profiles(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_pharmacy ON leave_requests(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_shift_schedules_pharmacy_date ON shift_schedules(pharmacy_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_petty_cash_pharmacy ON petty_cash(pharmacy_id);
