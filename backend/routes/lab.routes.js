const express = require('express');
const axios = require('axios');
const { protect } = require('../middleware/auth.middleware');
const router = express.Router();

router.get('/search', async (req, res) => {
  try {
    const term = req.query.term;
    if (!term) return res.status(400).json({ message: 'Search term required' });

    const response = await axios.get(
      'https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search',
      { params: { terms: term, maxList: 10, sf: 'LOINC_NUM,LONG_COMMON_NAME' } }
    );

    const data = response.data;
    const codes = data[1] || [];
    const names = (data[3] || []).map(item => item[0]);

    const formatted = names.map((name, i) => ({
      code: codes[i] || '',
      test_name: name
    }));

    res.json(formatted);
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Lab search failed' });
  }
});

// Lab queue – list pending lab requests
router.get('/queue', protect, async (req, res) => {
  try {
    const { pool } = require('../config/db');
    const result = await pool.query(`
      SELECT lr.*, p.full_name as patient_name, v.visit_number
      FROM lab_requests lr
      JOIN patients p ON lr.patient_id::text = p.id::text
      LEFT JOIN visits v ON lr.visit_id::text = v.id::text
      WHERE (lr.pharmacy_id::text = $1::text OR lr.pharmacy_id IS NULL) AND (lr.status = 'pending' OR lr.status IS NULL)
      ORDER BY lr.created_at DESC, lr.id DESC
    `, [req.pharmacy_id]);
    res.json({ success: true, data: result.rows });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Alias for test compatibility
router.get('/requests', async (req, res) => {
  try {
    const { pool } = require("../config/db");
    const result = await pool.query(
      `SELECT lr.*, p.full_name as patient_name, v.visit_number
       FROM lab_requests lr
       JOIN patients p ON lr.patient_id::text = p.id::text
       LEFT JOIN visits v ON lr.visit_id::text = v.id::text
       WHERE (lr.pharmacy_id::text = $1::text OR lr.pharmacy_id IS NULL) AND (lr.status = 'pending' OR lr.status IS NULL)
       ORDER BY lr.created_at DESC, lr.id DESC`,
      [req.pharmacy_id]
    );
    res.json({ success: true, data: result.rows });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Post lab result
router.put('/requests/:id/result', protect, async (req, res) => {
  try {
    const { pool } = require('../config/db');
    const { result, result_value, result_unit, result_flag, reference_range, notes } = req.body;
    const query = await pool.query(
      `UPDATE lab_requests SET status='completed', result=$1, result_value=$2, result_unit=$3, result_flag=$4, reference_range=$5, technician_notes=$6, resulted_at=NOW(), resulted_by=$7 WHERE id::text=$8::text AND (pharmacy_id::text=$9::text OR pharmacy_id IS NULL) RETURNING *`,
      [result, result_value, result_unit, result_flag, reference_range, notes, req.user.id, req.params.id, req.pharmacy_id]
    );
    if (query.rows.length === 0) return res.status(404).json({ success: false, message: 'Lab request not found' });

    if (query.rows[0].visit_id) {
      await pool.query(`
        UPDATE visits SET status='with_doctor', updated_at=NOW()
        WHERE id::text=$1::text AND (pharmacy_id::text=$2::text OR pharmacy_id IS NULL) AND UPPER(status) IN ('LAB', 'WITH_LAB', 'WAITING_LAB', 'WITH_DOCTOR', 'RADIOLOGY', 'WAITING_RADIOLOGY')
      `, [query.rows[0].visit_id, req.pharmacy_id]);

      const io = req.app.get('io');
      if (io) {
        io.emit(`queue_update_${req.pharmacy_id}`, { visit_id: query.rows[0].visit_id, status: 'with_doctor' });
        io.emit(`visit_updated_${req.pharmacy_id}`, { visit_id: query.rows[0].visit_id, status: 'with_doctor' });
      }
    }

    res.json({ success: true, data: query.rows[0] });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
