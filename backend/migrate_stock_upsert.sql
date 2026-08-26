ALTER TABLE stock DROP CONSTRAINT IF EXISTS stock_pharmacy_product_unique;
ALTER TABLE stock DROP CONSTRAINT IF EXISTS stock_product_id_pharmacy_id_key;
ALTER TABLE stock ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100);
ALTER TABLE stock ADD COLUMN IF NOT EXISTS department VARCHAR(50) DEFAULT 'pharmacy';
CREATE UNIQUE INDEX IF NOT EXISTS stock_product_batch_pharmacy_unique ON stock (product_id, pharmacy_id, batch_number) WHERE batch_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS stock_product_pharmacy_nobatch_unique ON stock (product_id, pharmacy_id) WHERE batch_number IS NULL;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS department VARCHAR(50) DEFAULT 'pharmacy';
SELECT 'Migration complete ✅' as status;
