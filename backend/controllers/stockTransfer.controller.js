const { pool } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

// Valid stores in hierarchy
const VALID_STORES = ['pharmacy','mch','immunization','ward','theatre','emergency'];
const MAIN_STORE = 'pharmacy';

// ── Request stock transfer ────────────────────────────────
const requestTransfer = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pid = req.pharmacy_id;
    const { from_store, to_store, items, notes } = req.body;

    if (!from_store || !to_store || !items?.length)
      return errorResponse(res, 400, 'from_store, to_store, items required');
    if (!VALID_STORES.includes(from_store) || !VALID_STORES.includes(to_store))
      return errorResponse(res, 400, `Stores must be one of: ${VALID_STORES.join(', ')}`);
    if (from_store === to_store)
      return errorResponse(res, 400, 'Source and destination stores cannot be the same');
    // Only main pharmacy can be source for sub-store requests
    if (to_store !== MAIN_STORE && from_store !== MAIN_STORE)
      return errorResponse(res, 400, 'Sub-store to sub-store transfers not allowed. Route through main pharmacy');

    // Generate transfer number
    const prefix = `TRF-${new Date().toISOString().slice(0,10).replace(/-/g,'')}`;
    const countRes = await client.query(
      `SELECT COUNT(*) as cnt FROM stock_transfers WHERE pharmacy_id=$1 AND transfer_number LIKE $2`,
      [pid, `${prefix}%`]
    );
    const transfer_number = `${prefix}-${String(parseInt(countRes.rows[0].cnt)+1).padStart(4,'0')}`;

    // Create transfer header
    const tRes = await client.query(`
      INSERT INTO stock_transfers
        (pharmacy_id, transfer_number, from_store, to_store, status, requested_by, notes)
      VALUES ($1,$2,$3,$4,'Pending',$5,$6) RETURNING *
    `, [pid, transfer_number, from_store, to_store, req.user.id, notes||null]);
    const transfer = tRes.rows[0];

    // Create transfer items
    for (const item of items) {
      const { product_id, quantity, batch_number, expiry_date } = item;
      if (!product_id || !quantity) continue;

      // Verify source stock exists
      const stockCheck = await client.query(`
        SELECT id, quantity FROM stock
        WHERE product_id=$1 AND pharmacy_id=$2 AND department=$3
          AND (batch_number=$4 OR ($4 IS NULL AND batch_number IS NULL))
          AND quantity >= $5
        LIMIT 1
      `, [product_id, pid, from_store, batch_number||null, quantity]);

      if (!stockCheck.rows[0]) {
        throw new Error(`Insufficient stock for product ${product_id} in ${from_store} store`);
      }

      await client.query(`
        INSERT INTO stock_transfer_items
          (transfer_id, product_id, quantity_requested, batch_number, expiry_date)
        VALUES ($1,$2,$3,$4,$5)
      `, [transfer.id, product_id, quantity, batch_number||null, expiry_date||null]);
    }

    await client.query(`
      INSERT INTO audit_trail (pharmacy_id, user_id, action, entity_type, entity_id, new_values)
      VALUES ($1,$2,'transfer_requested','stock_transfer',$3,$4)
    `, [pid, req.user.id, transfer.id, JSON.stringify({ from_store, to_store, items: items.length })]);

    await client.query('COMMIT');
    const io = req.app.get('io');
    if (io) io.emit(`transfer_requested_${pid}`, { transfer_id: transfer.id, from_store, to_store });
    return successResponse(res, 201, 'Transfer request created', transfer);
  } catch (e) {
    await client.query('ROLLBACK');
    logger.error('Transfer request error:', e.message);
    return errorResponse(res, 400, e.message);
  } finally { client.release(); }
};

// ── Approve transfer ──────────────────────────────────────
const approveTransfer = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pid = req.pharmacy_id;
    const { id } = req.params;

    const tRes = await client.query(
      `SELECT * FROM stock_transfers WHERE id=$1 AND pharmacy_id=$2 AND status='Pending'`,
      [id, pid]
    );
    if (!tRes.rows[0]) return errorResponse(res, 404, 'Transfer not found or not pending');
    const transfer = tRes.rows[0];

    await client.query(`
      UPDATE stock_transfers SET status='approved', approved_by=$1, approved_at=NOW(), updated_at=NOW()
      WHERE id=$2
    `, [req.user.id, id]);

    await client.query(`
      INSERT INTO audit_trail (pharmacy_id, user_id, action, entity_type, entity_id)
      VALUES ($1,$2,'transfer_approved','stock_transfer',$3)
    `, [pid, req.user.id, id]);

    await client.query('COMMIT');
    const io = req.app.get('io');
    if (io) io.emit(`transfer_approved_${pid}`, { transfer_id: id });
    return successResponse(res, 200, 'Transfer approved');
  } catch (e) {
    await client.query('ROLLBACK');
    return errorResponse(res, 500, e.message);
  } finally { client.release(); }
};

// ── Issue stock (deduct from source) ─────────────────────
const issueTransfer = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pid = req.pharmacy_id;
    const { id } = req.params;

    const tRes = await client.query(`
      SELECT t.*, ti.* FROM stock_transfers t
      JOIN stock_transfer_items ti ON ti.transfer_id=t.id
      WHERE t.id=$1 AND t.pharmacy_id=$2 AND t.status='approved'
    `, [id, pid]);
    if (!tRes.rows[0]) return errorResponse(res, 404, 'Transfer not found or not approved');

    const transfer = tRes.rows[0];
    const items = await client.query(
      `SELECT * FROM stock_transfer_items WHERE transfer_id=$1`, [id]
    );

    for (const item of items.rows) {
      // Deduct from source store
      await client.query(`
        UPDATE stock SET quantity=quantity-$1, updated_at=NOW()
        WHERE product_id=$2 AND pharmacy_id=$3 AND department=$4
          AND (batch_number=$5 OR ($5 IS NULL AND batch_number IS NULL))
      `, [item.quantity_requested, item.product_id, pid, transfer.from_store, item.batch_number||null]);

      // Stock movement — transfer out
      await client.query(`
        INSERT INTO stock_movements
          (product_id, user_id, movement_type, quantity, batch_number, reference_id, notes, pharmacy_id, department)
        VALUES ($1,$2,'transfer_out',$3,$4,$5,$6,$7,$8)
      `, [item.product_id, req.user.id, -item.quantity_requested,
          item.batch_number||null, id,
          `Transfer to ${transfer.to_store}: ${transfer.transfer_number}`,
          pid, transfer.from_store]);

      // Update issued quantity on item
      await client.query(`
        UPDATE stock_transfer_items SET quantity_issued=$1 WHERE id=$2
      `, [item.quantity_requested, item.id]);
    }

    await client.query(`
      UPDATE stock_transfers SET status='issued', issued_by=$1, issued_at=NOW(), updated_at=NOW()
      WHERE id=$2
    `, [req.user.id, id]);

    await client.query(`
      INSERT INTO audit_trail (pharmacy_id, user_id, action, entity_type, entity_id)
      VALUES ($1,$2,'transfer_issued','stock_transfer',$3)
    `, [pid, req.user.id, id]);

    await client.query('COMMIT');
    const io = req.app.get('io');
    if (io) io.emit(`transfer_issued_${pid}`, { transfer_id: id, to_store: transfer.to_store });
    return successResponse(res, 200, 'Stock issued for transfer');
  } catch (e) {
    await client.query('ROLLBACK');
    logger.error('Issue transfer error:', e.message);
    return errorResponse(res, 400, e.message);
  } finally { client.release(); }
};

// ── Receive stock (add to destination) ───────────────────
const receiveTransfer = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pid = req.pharmacy_id;
    const { id } = req.params;
    const { received_items } = req.body; // [{transfer_item_id, quantity_received}]

    const tRes = await client.query(
      `SELECT * FROM stock_transfers WHERE id=$1 AND pharmacy_id=$2 AND status='issued'`,
      [id, pid]
    );
    if (!tRes.rows[0]) return errorResponse(res, 404, 'Transfer not found or not issued yet');
    const transfer = tRes.rows[0];

    const items = await client.query(
      `SELECT * FROM stock_transfer_items WHERE transfer_id=$1`, [id]
    );

    for (const item of items.rows) {
      const received = received_items?.find(r => r.transfer_item_id === item.id);
      const qty = received?.quantity_received || item.quantity_issued || item.quantity_requested;

      // UPSERT into destination store
      if (item.batch_number) {
        await client.query(`
          INSERT INTO stock (product_id, quantity, batch_number, expiry_date, pharmacy_id, department)
          VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT (product_id, batch_number, pharmacy_id)
          DO UPDATE SET quantity=stock.quantity+EXCLUDED.quantity, updated_at=NOW()
        `, [item.product_id, qty, item.batch_number, item.expiry_date||null, pid, transfer.to_store]);
      } else {
        await client.query(`
          INSERT INTO stock (product_id, quantity, batch_number, expiry_date, pharmacy_id, department)
          VALUES ($1,$2,NULL,$3,$4,$5)
          ON CONFLICT (product_id, pharmacy_id) WHERE batch_number IS NULL
          DO UPDATE SET quantity=stock.quantity+EXCLUDED.quantity, updated_at=NOW()
        `, [item.product_id, qty, item.expiry_date||null, pid, transfer.to_store]);
      }

      // Stock movement — transfer in
      await client.query(`
        INSERT INTO stock_movements
          (product_id, user_id, movement_type, quantity, batch_number, reference_id, notes, pharmacy_id, department)
        VALUES ($1,$2,'transfer_in',$3,$4,$5,$6,$7,$8)
      `, [item.product_id, req.user.id, qty,
          item.batch_number||null, id,
          `Transfer from ${transfer.from_store}: ${transfer.transfer_number}`,
          pid, transfer.to_store]);

      await client.query(`
        UPDATE stock_transfer_items SET quantity_received=$1 WHERE id=$2
      `, [qty, item.id]);
    }

    await client.query(`
      UPDATE stock_transfers SET status='received', received_by=$1, received_at=NOW(), updated_at=NOW()
      WHERE id=$2
    `, [req.user.id, id]);

    await client.query(`
      INSERT INTO audit_trail (pharmacy_id, user_id, action, entity_type, entity_id)
      VALUES ($1,$2,'transfer_received','stock_transfer',$3)
    `, [pid, req.user.id, id]);

    await client.query('COMMIT');
    const io = req.app.get('io');
    if (io) io.emit(`transfer_received_${pid}`, { transfer_id: id, to_store: transfer.to_store });
    return successResponse(res, 200, 'Stock received into destination store');
  } catch (e) {
    await client.query('ROLLBACK');
    logger.error('Receive transfer error:', e.message);
    return errorResponse(res, 400, e.message);
  } finally { client.release(); }
};

// ── Get transfers list ────────────────────────────────────
const getTransfers = async (req, res) => {
  try {
    const { status, from_store, to_store, limit=50, offset=0 } = req.query;
    let q = `
      SELECT t.*,
        u1.full_name as requested_by_name,
        u2.full_name as approved_by_name,
        u3.full_name as issued_by_name,
        u4.full_name as received_by_name
      FROM stock_transfers t
      LEFT JOIN users u1 ON t.requested_by::text=u1.id::text
      LEFT JOIN users u2 ON t.approved_by::text=u2.id::text
      LEFT JOIN users u3 ON t.issued_by::text=u3.id::text
      LEFT JOIN users u4 ON t.received_by::text=u4.id::text
      WHERE (t.pharmacy_id::text=$1::text OR t.pharmacy_id IS NULL)
    `;
    const params = [req.pharmacy_id];
    if (status)     { params.push(status);     q += ` AND t.status=$${params.length}`; }
    if (from_store) { params.push(from_store); q += ` AND t.from_store=$${params.length}`; }
    if (to_store)   { params.push(to_store);   q += ` AND t.to_store=$${params.length}`; }
    q += ` ORDER BY t.created_at DESC`;
    params.push(limit);  q += ` LIMIT $${params.length}`;
    params.push(offset); q += ` OFFSET $${params.length}`;
    const result = await pool.query(q, params);

    const transfers = await Promise.all(result.rows.map(async t => {
      const items = await pool.query(`
        SELECT sti.*, p.name as product_name, p.generic_name
        FROM stock_transfer_items sti
        LEFT JOIN products p ON sti.product_id::text=p.id::text
        WHERE sti.transfer_id::text=$1::text
      `, [t.id]);
      return { ...t, items: items.rows };
    }));

    return successResponse(res, 200, 'Transfers fetched', transfers);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── Get stock by store ────────────────────────────────────
const getStoreStock = async (req, res) => {
  try {
    const { store } = req.params;
    if (!VALID_STORES.includes(store)) return errorResponse(res, 400, 'Invalid store');
    const result = await pool.query(`
      SELECT s.*, p.name as product_name, p.generic_name, p.unit,
             c.name as category_name
      FROM stock s
      LEFT JOIN products p ON s.product_id::text=p.id::text
      LEFT JOIN categories c ON p.category_id::text=c.id::text
      WHERE (s.pharmacy_id::text=$1::text OR s.pharmacy_id IS NULL) AND s.department=$2
      ORDER BY p.name ASC
    `, [req.pharmacy_id, store]);

    const expiringSoon = result.rows.filter(r => {
      if (!r.expiry_date) return false;
      return Math.ceil((new Date(r.expiry_date)-new Date())/(1000*60*60*24)) <= 30;
    });
    const lowStock = result.rows.filter(r => r.quantity <= (r.reorder_level||10));

    return successResponse(res, 200, `${store} store stock`, {
      stock: result.rows,
      total_items: result.rows.length,
      total_qty: result.rows.reduce((s,r)=>s+parseInt(r.quantity||0),0),
      expiring_soon: expiringSoon.length,
      low_stock: lowStock.length,
    });
  } catch (e) { return errorResponse(res, 500, e.message); }
};

module.exports = {
  requestTransfer, approveTransfer, issueTransfer,
  receiveTransfer, getTransfers, getStoreStock,
};
