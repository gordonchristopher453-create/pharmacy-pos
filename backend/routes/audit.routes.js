const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');
const { protect, requirePharmacy } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');

router.use(protect, requirePharmacy);

router.post('/log', async (req, res) => {
  try {
    const { table_name, record_id, action, old_data, new_data, visit_id, patient_id } = req.body;
    const result = await pool.query(`
      INSERT INTO audit_log
        (pharmacy_id, table_name, record_id, action, old_data, new_data, changed_by, visit_id, patient_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      req.pharmacy_id,
      table_name || 'patients',
      record_id ? String(record_id) : '0',
      action || 'read',
      old_data ? JSON.stringify(old_data) : null,
      new_data ? JSON.stringify(new_data) : null,
      req.user.id,
      visit_id && !isNaN(Number(visit_id)) ? parseInt(visit_id, 10) : null,
      patient_id && !isNaN(Number(patient_id)) ? parseInt(patient_id, 10) : null,
    ]);
    return successResponse(res, 201, 'Audit log added successfully', result.rows[0]);
  } catch (e) {
    logger.error('Failed to write audit log: ' + e.message);
    return errorResponse(res, 500, 'Failed to add audit log');
  }
});

router.get('/visit/:visit_id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, u.full_name AS changed_by_name
      FROM audit_log a
      LEFT JOIN users u ON a.changed_by = u.id
      WHERE a.visit_id=$1 AND a.pharmacy_id=$2
      ORDER BY a.changed_at DESC
    `, [req.params.visit_id, req.pharmacy_id]);
    return successResponse(res, 200, 'Audit trail fetched', result.rows);
  } catch (e) {
    return errorResponse(res, 500, 'Failed to fetch audit trail');
  }
});

router.get('/patient/:patient_id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, u.full_name AS changed_by_name
      FROM audit_log a
      LEFT JOIN users u ON a.changed_by = u.id
      WHERE a.patient_id=$1 AND a.pharmacy_id=$2
      ORDER BY a.changed_at DESC
    `, [req.params.patient_id, req.pharmacy_id]);
    return successResponse(res, 200, 'Audit trail fetched', result.rows);
  } catch (e) {
    return errorResponse(res, 500, 'Failed to fetch audit trail');
  }
});

module.exports = router;
