-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  pharmacy_id TEXT NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('salary', 'rent', 'utilities', 'stock', 'equipment', 'other')),
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE expenses ALTER COLUMN pharmacy_id TYPE TEXT USING pharmacy_id::TEXT;

-- Payroll table
CREATE TABLE IF NOT EXISTS payroll (
  id SERIAL PRIMARY KEY,
  pharmacy_id TEXT NOT NULL,
  user_id UUID REFERENCES users(id),
  employee_name VARCHAR(255) NOT NULL,
  employee_email VARCHAR(255),
  role VARCHAR(100),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  basic_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  allowances DECIMAL(12,2) NOT NULL DEFAULT 0,
  deductions DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_salary DECIMAL(12,2) GENERATED ALWAYS AS (basic_salary + allowances - deductions) STORED,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(pharmacy_id, user_id, month, year)
);
ALTER TABLE payroll ALTER COLUMN pharmacy_id TYPE TEXT USING pharmacy_id::TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_pharmacy ON expenses(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_payroll_pharmacy ON payroll(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_payroll_month_year ON payroll(month, year);
