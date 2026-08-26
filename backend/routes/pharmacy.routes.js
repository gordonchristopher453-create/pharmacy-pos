const express = require('express');
const { pool } = require('../config/db');
const router = express.Router();
const { successResponse, errorResponse } = require("../utils/response");
const {
  createPharmacy, getAllPharmacies, updateSubscription,
  togglePharmacy, deletePharmacy, requestAdminOtp, resetAdminPassword, getMyPharmacy, updateSettings, updatePharmacyInfo
} = require('../controllers/pharmacy.controller');
const { protect, superAdminOnly, authorize, requirePharmacy } = require('../middleware/auth.middleware');
const StockModel = require('../models/stock.model');

// Super admin routes
router.get('/all', protect, superAdminOnly, getAllPharmacies);
router.post('/create', protect, superAdminOnly, createPharmacy);
router.put('/:pharmacy_id/subscription', protect, superAdminOnly, updateSubscription);
router.put('/:pharmacy_id/toggle', protect, superAdminOnly, togglePharmacy);
router.post('/:pharmacy_id/request-admin-otp', protect, superAdminOnly, requestAdminOtp);
router.put('/:pharmacy_id/reset-admin-password', protect, superAdminOnly, resetAdminPassword);
router.delete('/:pharmacy_id', protect, superAdminOnly, deletePharmacy);

// Pharmacy admin routes
router.get('/me', protect, requirePharmacy, getMyPharmacy);
router.put('/me', protect, requirePharmacy, authorize('facility_admin', 'super_admin'), updatePharmacyInfo);
router.put('/me/settings', protect, requirePharmacy, authorize('facility_admin', 'super_admin'), updateSettings);

// Dispense a prescription
router.put("/dispense/:id", protect, requirePharmacy, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { status } = req.body;

    // 1. Fetch prescription
    const prescQuery = await client.query(
      "SELECT * FROM prescriptions WHERE id=$1 AND (pharmacy_id=$2 OR pharmacy_id IS NULL)",
      [req.params.id, req.pharmacy_id]
    );
    const prescription = prescQuery.rows[0];
    if (!prescription) {
      await client.query('ROLLBACK');
      return errorResponse(res, 404, "Prescription not found");
    }

    // Check if it's already dispensed
    if (prescription.status === 'dispensed') {
      await client.query('ROLLBACK');
      return errorResponse(res, 400, "This prescription has already been dispensed.");
    }

    // Check if visit is inpatient
    const visitRes = await client.query(
      `SELECT status, visit_type FROM visits WHERE id::text = $1 LIMIT 1`,
      [String(prescription.visit_id)]
    );
    const isInpatientVisit = visitRes.rows[0] && (
      visitRes.rows[0].status === 'inpatient' ||
      (visitRes.rows[0].visit_type && visitRes.rows[0].visit_type.toLowerCase() === 'inpatient')
    );

    // 2. Payment gate check for outpatient visits only (Inpatients pay on running account)
    if (!isInpatientVisit) {
      const billCheck = await client.query(
        `SELECT status, item_name FROM billing_items 
         WHERE visit_id::text = $1 AND (item_type = 'drug' OR item_type = 'prescription')
           AND (LOWER(TRIM(item_name)) = LOWER(TRIM($2)) OR LOWER(TRIM(item_name)) LIKE LOWER(TRIM($3)))`,
        [String(prescription.visit_id), prescription.drug_name, `%${prescription.drug_name.trim()}%`]
      );

      if (billCheck.rows.length > 0) {
        const unpaid = billCheck.rows.some(b => b.status === 'pending');
        if (unpaid) {
          await client.query('ROLLBACK');
          return errorResponse(res, 402, `Payment required before dispensing. The drug "${prescription.drug_name}" must be paid for at reception first.`);
        }
      } else {
        const generalCheck = await client.query(
          `SELECT id, item_name, status FROM billing_items WHERE visit_id::text = $1 AND (item_type = 'drug' OR item_type = 'prescription') AND status = 'pending'`,
          [String(prescription.visit_id)]
        );
        if (generalCheck.rows.length > 0) {
          const matchingPending = generalCheck.rows.find(b => 
            prescription.drug_name.toLowerCase().includes(b.item_name.toLowerCase()) || 
            b.item_name.toLowerCase().includes(prescription.drug_name.toLowerCase())
          );
          if (matchingPending) {
            await client.query('ROLLBACK');
            return errorResponse(res, 402, `Payment required before dispensing. The drug "${prescription.drug_name}" is currently unpaid at reception.`);
          }
        }
      }
    }

    // 3. Deduct pharmacy stock if product_id is linked
    if (prescription.product_id && prescription.quantity) {
      const qty = parseFloat(prescription.quantity);
      if (qty > 0) {
        try {
          await StockModel.deductStock(prescription.product_id, qty, client, req.pharmacy_id);
          
          // Log stock movement
          await client.query(`
            INSERT INTO stock_movements (product_id, user_id, movement_type, quantity, notes, pharmacy_id)
            VALUES ($1, $2, 'sale', $3, $4, $5)
          `, [
            prescription.product_id, 
            req.user.id, 
            -qty, 
            `Dispensed prescription: ${prescription.drug_name} (Visit ID: ${prescription.visit_id})`, 
            req.pharmacy_id
          ]);
        } catch (stockErr) {
          await client.query('ROLLBACK');
          return errorResponse(res, 400, `Stock deduction failed: ${stockErr.message}. Please check pharmacy stock levels.`);
        }
      }
    }

    // 4. Update prescription status
    const result = await client.query(
      `UPDATE prescriptions SET status=$1, dispensed_at=NOW(), dispensed_by=$2 WHERE id=$3 AND (pharmacy_id=$4 OR pharmacy_id IS NULL) RETURNING *`,
      [status || "dispensed", req.user.id, req.params.id, req.pharmacy_id]
    );

    // 5. Automatically mark the pharmacy phase as completed if all prescriptions for this visit are now dispensed
    try {
      const pendingCheck = await client.query(
        `SELECT COUNT(*) FROM prescriptions WHERE visit_id = $1 AND (status = 'pending' OR status IS NULL)`,
        [prescription.visit_id]
      );
      if (parseInt(pendingCheck.rows[0].count) === 0) {
        await client.query(
          `UPDATE visits SET status = 'completed', updated_at = NOW() WHERE id = $1 AND (pharmacy_id = $2 OR pharmacy_id IS NULL) AND status IN ('pharmacy', 'WAITING_PHARMACY')`,
          [prescription.visit_id, req.pharmacy_id]
        );
      }
    } catch (err) {
      console.error('Error completing visit status after dispensing:', err.message);
    }

    await client.query('COMMIT');
    return successResponse(res, 200, "Dispensed and stock deducted successfully.", result.rows[0]);
  } catch(e) {
    await client.query('ROLLBACK');
    return errorResponse(res, 500, e.message);
  } finally {
    client.release();
  }
});
// Delete facility (soft delete)
router.delete("/:id", protect, superAdminOnly, async (req, res) => {
  try {
    const { confirm } = req.body;
    if (confirm !== true) return errorResponse(res, 400, "Please confirm deletion");
    await pool.query("UPDATE pharmacies SET is_active = false, deleted_at = NOW(), updated_at = NOW() WHERE id = $1", [req.params.id]);
    return successResponse(res, 200, "Facility deleted successfully");
  } catch(e) { return errorResponse(res, 500, e.message); }
});


router.get('/dispense-history', protect, async (req, res) => {
  try {
    const { search, date_from, date_to, limit = 500 } = req.query;
    const pharmacyId = req.pharmacy_id || req.user?.pharmacy_id || null;

    const params = [pharmacyId];
    let whereClause = `($1::text IS NULL OR p.pharmacy_id::text = $1::text OR p.pharmacy_id IS NULL) AND (p.status = 'dispensed' OR p.status = 'Dispensed' OR p.dispensed_at IS NOT NULL)`;

    if (date_from && date_to) {
      params.push(date_from);
      params.push(date_to);
      whereClause += ` AND (COALESCE(p.dispensed_at, p.created_at)::date BETWEEN $${params.length - 1}::date AND $${params.length}::date)`;
    } else if (date_from) {
      params.push(date_from);
      whereClause += ` AND (COALESCE(p.dispensed_at, p.created_at)::date = $${params.length}::date)`;
    }

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (pat.full_name ILIKE $${params.length} OR pat.patient_number ILIKE $${params.length} OR p.drug_name ILIKE $${params.length})`;
    }

    params.push(parseInt(limit));
    const result = await pool.query(`
      SELECT p.*, pat.full_name as patient_name, pat.patient_number,
        pat.gender, v.visit_number, v.visit_date,
        c.diagnosis, u.full_name as doctor_name,
        d.full_name as dispensed_by_name
      FROM prescriptions p
      LEFT JOIN consultations c ON p.consultation_id::text = c.id::text
      LEFT JOIN visits v ON p.visit_id::text = v.id::text
      LEFT JOIN patients pat ON COALESCE(p.patient_id, v.patient_id)::text = pat.id::text
      LEFT JOIN users u ON COALESCE(p.doctor_id, c.doctor_id)::text = u.id::text
      LEFT JOIN users d ON p.dispensed_by::text = d.id::text
      WHERE ${whereClause}
      ORDER BY COALESCE(p.dispensed_at, p.created_at) DESC
      LIMIT $${params.length}
    `, params);

    return res.json({ success: true, message: 'Dispense history fetched', data: result.rows || [] });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to fetch history: ' + e.message });
  }
});

// Pharmacy queue – list pending prescriptions
router.get('/queue', protect, async (req, res) => {
  try {
    const pharmacyId = req.pharmacy_id || req.user?.pharmacy_id || null;
    const { pool } = require('../config/db');
    const result = await pool.query(`
      SELECT pr.*, p.full_name as patient_name, v.visit_number
      FROM prescriptions pr
      LEFT JOIN visits v ON pr.visit_id::text = v.id::text
      LEFT JOIN patients p ON (pr.patient_id::text = p.id::text OR v.patient_id::text = p.id::text)
      WHERE ($1::text IS NULL OR pr.pharmacy_id::text = $1::text OR pr.pharmacy_id IS NULL) AND (pr.status = 'pending' OR pr.status IS NULL)
      ORDER BY pr.created_at DESC
    `, [pharmacyId]);
    res.json({ success: true, data: result.rows || [] });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Also serve prescription queue at root path
router.get('/', protect, async (req, res) => {
  try {
    const pharmacyId = req.pharmacy_id || req.user?.pharmacy_id || null;
    const { pool } = require('../config/db');
    const result = await pool.query(
      `SELECT pr.*, p.full_name as patient_name, v.visit_number
       FROM prescriptions pr
       LEFT JOIN visits v ON pr.visit_id::text = v.id::text
       LEFT JOIN patients p ON (pr.patient_id::text = p.id::text OR v.patient_id::text = p.id::text)
       WHERE ($1::text IS NULL OR pr.pharmacy_id::text = $1::text OR pr.pharmacy_id IS NULL) AND (pr.status = 'pending' OR pr.status IS NULL)
       ORDER BY pr.created_at DESC`,
      [pharmacyId]
    );
    res.json({ success: true, data: result.rows || [] });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;

