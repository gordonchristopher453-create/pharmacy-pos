-- Drop global barcode unique constraint and scope to per-pharmacy
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_barcode_key;
DROP INDEX IF EXISTS products_barcode_key;
CREATE UNIQUE INDEX IF NOT EXISTS products_pharmacy_barcode_unique ON products (pharmacy_id, barcode) WHERE barcode IS NOT NULL AND barcode <> '';

-- Ensure stock table has proper unique indexes for batch-tracked and non-batch items per facility
CREATE UNIQUE INDEX IF NOT EXISTS stock_product_batch_pharmacy_unique ON stock (product_id, pharmacy_id, batch_number) WHERE batch_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS stock_product_pharmacy_nobatch_unique ON stock (product_id, pharmacy_id) WHERE batch_number IS NULL;
