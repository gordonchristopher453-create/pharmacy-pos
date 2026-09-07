-- Ensure all columns exist on billing_items for reports, collections, and receipting
ALTER TABLE billing_items ADD COLUMN IF NOT EXISTS facility_id INT;
ALTER TABLE billing_items ADD COLUMN IF NOT EXISTS pharmacy_id INT;
ALTER TABLE billing_items ADD COLUMN IF NOT EXISTS item_name VARCHAR(255);
ALTER TABLE billing_items ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE billing_items ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE billing_items ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE billing_items ADD COLUMN IF NOT EXISTS reference_number VARCHAR(150);
ALTER TABLE billing_items ADD COLUMN IF NOT EXISTS insurance_provider VARCHAR(150);
ALTER TABLE billing_items ADD COLUMN IF NOT EXISTS member_number VARCHAR(150);
ALTER TABLE billing_items ADD COLUMN IF NOT EXISTS auth_code VARCHAR(150);
ALTER TABLE billing_items ADD COLUMN IF NOT EXISTS copay_amount NUMERIC(10,2) DEFAULT 0;

-- Ensure collected_by can hold both UUID and integer user IDs safely without type mismatches
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='billing_items' AND column_name='collected_by') THEN
    BEGIN
      ALTER TABLE billing_items ALTER COLUMN collected_by TYPE VARCHAR(100);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  ELSE
    ALTER TABLE billing_items ADD COLUMN collected_by VARCHAR(100);
  END IF;
END $$;

-- Backfill legacy records
UPDATE billing_items 
SET paid_amount = total_price 
WHERE (paid_amount IS NULL OR paid_amount = 0) 
  AND status IN ('paid', 'insurance', 'nhif', 'sha', 'corporate');

UPDATE billing_items 
SET item_name = description 
WHERE item_name IS NULL AND description IS NOT NULL;

UPDATE billing_items 
SET facility_id = pharmacy_id 
WHERE facility_id IS NULL AND pharmacy_id IS NOT NULL;

UPDATE billing_items 
SET pharmacy_id = facility_id 
WHERE pharmacy_id IS NULL AND facility_id IS NOT NULL;

-- Ensure indexes for blazing fast date range and status lookups
CREATE INDEX IF NOT EXISTS idx_billing_items_facility_created ON billing_items(facility_id, created_at);
CREATE INDEX IF NOT EXISTS idx_billing_items_pharmacy_created ON billing_items(pharmacy_id, created_at);
CREATE INDEX IF NOT EXISTS idx_billing_items_paid_at ON billing_items(paid_at);
CREATE INDEX IF NOT EXISTS idx_billing_items_payment_method ON billing_items(payment_method);
CREATE INDEX IF NOT EXISTS idx_billing_items_collected_by ON billing_items(collected_by);
