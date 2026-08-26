const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { protect, requirePharmacy } = require('../middleware/auth.middleware');
const { successResponse, errorResponse } = require('../utils/response');

router.use(protect, requirePharmacy);

// List all service prices
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM service_prices WHERE pharmacy_id=$1 ORDER BY category, name', [req.pharmacy_id]);
    return successResponse(res, 200, 'Service prices fetched', result.rows);
  } catch (e) { return errorResponse(res, 500, e.message); }
});

// Add a service price
router.post('/', async (req, res) => {
  try {
    const { name, category, price } = req.body;
    if (!name || !price) return errorResponse(res, 400, 'Name and price are required');
    const result = await pool.query(
      'INSERT INTO service_prices (pharmacy_id, name, category, price) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.pharmacy_id, name, category||'other', price]
    );
    return successResponse(res, 201, 'Service price added', result.rows[0]);
  } catch (e) { return errorResponse(res, 500, e.message); }
});

// Update a service price
router.put('/:id', async (req, res) => {
  try {
    const { name, category, price, is_active } = req.body;
    const result = await pool.query(
      'UPDATE service_prices SET name=COALESCE($1,name), category=COALESCE($2,category), price=COALESCE($3,price), is_active=COALESCE($4,is_active), updated_at=NOW() WHERE id=$5 AND pharmacy_id=$6 RETURNING *',
      [name, category, price, is_active, req.params.id, req.pharmacy_id]
    );
    if (!result.rows[0]) return errorResponse(res, 404, 'Not found');
    return successResponse(res, 200, 'Updated', result.rows[0]);
  } catch (e) { return errorResponse(res, 500, e.message); }
});

// Delete a service price
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM service_prices WHERE id=$1 AND pharmacy_id=$2', [req.params.id, req.pharmacy_id]);
    return successResponse(res, 200, 'Deleted');
  } catch (e) { return errorResponse(res, 500, e.message); }
});

module.exports = router;
