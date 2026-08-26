const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { protect, requirePharmacy, requirePermission } = require('../middleware/auth.middleware');
const { successResponse, errorResponse } = require('../utils/response');

router.use(protect, requirePharmacy);

// ── GET all MCH stock ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = `SELECT * FROM mch_stock WHERE pharmacy_id=$1 AND is_active=true`;
    const params = [req.pharmacy_id];
    if (category) { params.push(category); query += ` AND category=$${params.length}`; }
    if (search) { params.push(`%${search}%`); query += ` AND name ILIKE $${params.length}`; }
    query += ` ORDER BY category, name`;
    const result = await pool.query(query, params);
    return successResponse(res, 200, 'MCH stock fetched', result.rows);
  } catch (e) { return errorResponse(res, 500, e.message); }
});

// ── ADD stock item ────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, category, quantity, unit, reorder_level, batch_number, expiry_date, supplier, notes } = req.body;
    if (!name || !category) return errorResponse(res, 400, 'Name and category required');
    const result = await pool.query(`
      INSERT INTO mch_stock (pharmacy_id, name, category, quantity, unit, reorder_level, batch_number, expiry_date, supplier, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
    `, [req.pharmacy_id, name, category, quantity||0, unit||'units', reorder_level||10, batch_number||null, expiry_date||null, supplier||null, notes||null, req.user.id]);
    return successResponse(res, 201, 'Stock item added', result.rows[0]);
  } catch (e) { return errorResponse(res, 500, e.message); }
});

// ── UPDATE stock item ─────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { name, category, quantity, unit, reorder_level, batch_number, expiry_date, supplier, notes } = req.body;
    const result = await pool.query(`
      UPDATE mch_stock SET name=$1, category=$2, quantity=$3, unit=$4, reorder_level=$5,
        batch_number=$6, expiry_date=$7, supplier=$8, notes=$9, updated_at=NOW()
      WHERE id=$10 AND pharmacy_id=$11 RETURNING *
    `, [name, category, quantity, unit, reorder_level, batch_number||null, expiry_date||null, supplier||null, notes||null, req.params.id, req.pharmacy_id]);
    if (!result.rows[0]) return errorResponse(res, 404, 'Item not found');
    return successResponse(res, 200, 'Stock updated', result.rows[0]);
  } catch (e) { return errorResponse(res, 500, e.message); }
});

// ── RECEIVE stock (add quantity) ──────────────────────────────────────────────
router.post('/:id/receive', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { quantity, batch_number, expiry_date, notes } = req.body;
    if (!quantity || quantity <= 0) return errorResponse(res, 400, 'Quantity must be positive');
    const result = await client.query(`
      UPDATE mch_stock SET quantity=quantity+$1, batch_number=COALESCE($2,batch_number),
        expiry_date=COALESCE($3,expiry_date), updated_at=NOW()
      WHERE id=$4 AND pharmacy_id=$5 RETURNING *
    `, [quantity, batch_number||null, expiry_date||null, req.params.id, req.pharmacy_id]);
    if (!result.rows[0]) return errorResponse(res, 404, 'Item not found');
    await client.query(`
      INSERT INTO mch_stock_movements (pharmacy_id, mch_stock_id, movement_type, quantity, notes, created_by)
      VALUES ($1,$2,'in',$3,$4,$5)
    `, [req.pharmacy_id, req.params.id, quantity, notes||'Stock received', req.user.id]);
    await client.query('COMMIT');
    return successResponse(res, 200, 'Stock received', result.rows[0]);
  } catch (e) { await client.query('ROLLBACK'); return errorResponse(res, 500, e.message); }
  finally { client.release(); }
});

// ── DEDUCT stock (used internally by immunization/FP) ────────────────────────
router.post('/:id/deduct', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { quantity, reference_type, reference_id, notes } = req.body;
    if (!quantity || quantity <= 0) return errorResponse(res, 400, 'Quantity must be positive');
    const check = await client.query('SELECT quantity FROM mch_stock WHERE id=$1 AND pharmacy_id=$2', [req.params.id, req.pharmacy_id]);
    if (!check.rows[0]) return errorResponse(res, 404, 'Item not found');
    if (check.rows[0].quantity < quantity) return errorResponse(res, 400, `Insufficient stock. Available: ${check.rows[0].quantity}`);
    const result = await client.query(`
      UPDATE mch_stock SET quantity=quantity-$1, updated_at=NOW()
      WHERE id=$2 AND pharmacy_id=$3 RETURNING *
    `, [quantity, req.params.id, req.pharmacy_id]);
    await client.query(`
      INSERT INTO mch_stock_movements (pharmacy_id, mch_stock_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
      VALUES ($1,$2,'out',$3,$4,$5,$6,$7)
    `, [req.pharmacy_id, req.params.id, quantity, reference_type||null, reference_id||null, notes||'Used in MCH', req.user.id]);
    await client.query('COMMIT');
    return successResponse(res, 200, 'Stock deducted', result.rows[0]);
  } catch (e) { await client.query('ROLLBACK'); return errorResponse(res, 500, e.message); }
  finally { client.release(); }
});

// ── GET stock movements ───────────────────────────────────────────────────────
router.get('/:id/movements', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, u.full_name as created_by_name
      FROM mch_stock_movements m
      LEFT JOIN users u ON m.created_by = u.id
      WHERE m.mch_stock_id=$1 AND m.pharmacy_id=$2
      ORDER BY m.created_at DESC LIMIT 50
    `, [req.params.id, req.pharmacy_id]);
    return successResponse(res, 200, 'Movements fetched', result.rows);
  } catch (e) { return errorResponse(res, 500, e.message); }
});

// ── GET low stock alerts ──────────────────────────────────────────────────────
router.get('/alerts/low', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM mch_stock
      WHERE pharmacy_id=$1 AND is_active=true AND quantity <= reorder_level
      ORDER BY quantity ASC
    `, [req.pharmacy_id]);
    return successResponse(res, 200, 'Low stock fetched', result.rows);
  } catch (e) { return errorResponse(res, 500, e.message); }
});

module.exports = router;
