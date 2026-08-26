-- ══════════════════════════════════════════════
-- PARTS 12-15: Store hierarchy + Stock transfers
-- ══════════════════════════════════════════════

-- Transfer header
CREATE TABLE IF NOT EXISTS stock_transfers (
  id              SERIAL PRIMARY KEY,
  pharmacy_id     INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  transfer_number VARCHAR(30) UNIQUE NOT NULL,
  from_store      VARCHAR(30) NOT NULL,
  to_store        VARCHAR(30) NOT NULL,
  status          VARCHAR(20) DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','issued','received','cancelled')),
  requested_by    INTEGER REFERENCES users(id),
  approved_by     INTEGER REFERENCES users(id),
  issued_by       INTEGER REFERENCES users(id),
  received_by     INTEGER REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  issued_at       TIMESTAMPTZ,
  received_at     TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Transfer line items
CREATE TABLE IF NOT EXISTS stock_transfer_items (
  id                  SERIAL PRIMARY KEY,
  transfer_id         INTEGER NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id          INTEGER NOT NULL REFERENCES products(id),
  quantity_requested  INTEGER NOT NULL DEFAULT 0,
  quantity_issued     INTEGER DEFAULT 0,
  quantity_received   INTEGER DEFAULT 0,
  batch_number        VARCHAR(100),
  expiry_date         DATE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Add reorder_level to stock if missing
ALTER TABLE stock ADD COLUMN IF NOT EXISTS reorder_level INTEGER DEFAULT 10;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transfers_pharmacy   ON stock_transfers(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status     ON stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfers_from       ON stock_transfers(from_store);
CREATE INDEX IF NOT EXISTS idx_transfers_to         ON stock_transfers(to_store);
CREATE INDEX IF NOT EXISTS idx_transfer_items_xfer  ON stock_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_prod  ON stock_transfer_items(product_id);

SELECT 'Stock Transfer migration complete ✅' as status;
