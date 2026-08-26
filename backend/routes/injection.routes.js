const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');
const { logAudit } = require('../utils/audit');
const { protect, requirePharmacy } = require('../middleware/auth.middleware');
const StockModel = require('../models/stock.model');

router.use(protect, requirePharmacy);

// Get all injection room patients (optionally filtered by date)
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    const d = date || new Date().toISOString().split('T')[0];
    const params = [req.pharmacy_id, d];
    const dateWhere = ` AND DATE(v.created_at) = $2`;

    const result = await pool.query(`
      SELECT v.*,
        p.full_name as patient_name, p.patient_number, p.gender, p.date_of_birth, p.allergies,
        p.phone, u.full_name as created_by_name,
        c.diagnosis, c.management_plan,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', iro.id, 'drug_name', iro.drug_name, 'dosage', iro.dosage,
            'route', iro.route, 'frequency', iro.frequency, 'duration', iro.duration,
            'quantity', iro.quantity, 'status', iro.status, 'instructions', iro.instructions,
            'administered_at', iro.administered_at, 'notes', iro.notes,
            'product_id', iro.product_id,
            'payment_status', (
              SELECT CASE WHEN EXISTS (
                SELECT 1 FROM billing_items bi
                WHERE bi.visit_id::text = iro.visit_id::text
                  AND bi.status = 'paid'
                  AND (LOWER(bi.item_name) LIKE '%' || LOWER(iro.drug_name) || '%' OR bi.item_type = 'prescription')
              ) OR NOT EXISTS (
                SELECT 1 FROM billing_items bi2
                WHERE bi2.visit_id::text = iro.visit_id::text AND bi2.status = 'pending'
              ) THEN 'paid' ELSE 'pending' END
            )
          ) ORDER BY iro.created_at DESC
        ) FILTER (WHERE iro.id IS NOT NULL) as orders
      FROM visits v
      JOIN patients p ON v.patient_id::text = p.id::text
      LEFT JOIN users u ON v.created_by::text = u.id::text
      LEFT JOIN LATERAL (
        SELECT blood_pressure_systolic, blood_pressure_diastolic,
               pulse_rate, temperature, oxygen_saturation, weight
        FROM vitals
        WHERE visit_id::text = v.id::text
        ORDER BY recorded_at DESC
        LIMIT 1
      ) vt ON true
      LEFT JOIN injection_room_orders iro ON v.id::text = iro.visit_id::text
      LEFT JOIN consultations c ON v.id::text = c.visit_id::text
      WHERE (v.pharmacy_id::text = $1::text OR v.pharmacy_id IS NULL) ${dateWhere}
        AND (
          LOWER(v.status) IN ('injection_room', 'waiting_injection')
          OR EXISTS (
            SELECT 1 FROM injection_room_orders iro_act
            WHERE iro_act.visit_id::text = v.id::text
              AND LOWER(iro_act.status) IN ('pending', 'in_progress', 'scheduled', 'waiting', 'ordered')
          )
        )
        AND LOWER(COALESCE(v.status, '')) NOT IN ('discharged', 'cancelled')
      GROUP BY v.id, v.pharmacy_id, v.patient_id, v.visit_number, v.visit_type,
        c.id, c.diagnosis, c.management_plan,
        v.status, v.priority, v.chief_complaint, v.attending_doctor, v.assigned_to,
        v.notes, v.discharged_at, v.created_at, v.updated_at,
        p.full_name, p.patient_number, p.gender, p.date_of_birth,
        p.allergies, p.phone, u.full_name,
        vt.blood_pressure_systolic, vt.blood_pressure_diastolic,
        vt.pulse_rate, vt.temperature, vt.oxygen_saturation, vt.weight
      ORDER BY v.created_at DESC
    `, params);

    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(DISTINCT v2.id) FROM visits v2
         WHERE (v2.pharmacy_id::text = $1::text OR v2.pharmacy_id IS NULL)
           AND DATE(v2.created_at) = $2
           AND (
             LOWER(v2.status) IN ('injection_room', 'waiting_injection')
             OR EXISTS (
               SELECT 1 FROM injection_room_orders iro_act
               WHERE iro_act.visit_id::text = v2.id::text
                 AND LOWER(iro_act.status) IN ('pending', 'in_progress', 'scheduled', 'waiting', 'ordered')
             )
           )
           AND LOWER(COALESCE(v2.status, '')) NOT IN ('discharged', 'cancelled')
        ) as in_injection,
        COUNT(*) FILTER (WHERE LOWER(status)='with_doctor') as with_doctor,
        COUNT(*) FILTER (WHERE LOWER(status)='discharged') as discharged
      FROM visits
      WHERE (pharmacy_id::text = $1::text OR pharmacy_id IS NULL) AND DATE(created_at) = $2
    `, [req.pharmacy_id, d]);

    return successResponse(res, 200, 'Injection room fetched', {
      visits: result.rows,
      stats: stats.rows[0]
    });
  } catch (error) {
    console.error('Injection room error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch injection room: ' + error.message);
  }
});

router.get("/history", async (req, res) => {
  try {
    const { date, search } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const d = date || (search ? null : today);
    const params = [req.pharmacy_id];
    let dateWhere = '';
    if (d) {
      params.push(d);
      dateWhere = ` AND DATE(v.created_at) = $${params.length}`;
    }

    let query = `SELECT v.*, p.full_name as patient_name, p.patient_number, p.gender, p.date_of_birth, p.phone,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', iro.id, 'drug_name', iro.drug_name, 'dosage', iro.dosage,
            'route', iro.route, 'frequency', iro.frequency, 'duration', iro.duration,
            'quantity', iro.quantity, 'status', iro.status, 'instructions', iro.instructions,
            'administered_at', iro.administered_at, 'notes', iro.notes,
            'product_id', iro.product_id
          ) ORDER BY iro.created_at DESC
        ) FILTER (WHERE iro.id IS NOT NULL) as orders
      FROM visits v
      JOIN patients p ON v.patient_id::text = p.id::text
      LEFT JOIN injection_room_orders iro ON v.id::text = iro.visit_id::text
      WHERE (v.pharmacy_id::text = $1::text OR v.pharmacy_id IS NULL) ${dateWhere}
        AND EXISTS (
          SELECT 1 FROM injection_room_orders iro2
          WHERE iro2.visit_id::text = v.id::text
        )
        AND (
          -- No pending/active injection orders left for this visit
          NOT EXISTS (
            SELECT 1 FROM injection_room_orders iro3
            WHERE iro3.visit_id::text = v.id::text 
              AND LOWER(iro3.status) IN ('pending', 'in_progress', 'scheduled', 'waiting', 'ordered')
          )
          -- OR the entire visit has been finalized / discharged
          OR LOWER(COALESCE(v.status, '')) IN ('discharged', 'cancelled', 'completed')
        )
        AND LOWER(COALESCE(v.status, '')) NOT IN ('injection_room', 'waiting_injection')`;
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (p.full_name ILIKE $${params.length} OR p.patient_number ILIKE $${params.length} OR p.phone ILIKE $${params.length})`;
    }
    query += ` GROUP BY v.id, p.id ORDER BY v.created_at DESC`;
    const result = await pool.query(query, params);
    return successResponse(res, 200, "History fetched", result.rows);
  } catch (error) {
    console.error("History error:", error.message);
    return errorResponse(res, 500, "Failed to fetch history: " + error.message);
  }
});

// Get orders for a specific visit
router.get(['/visit/:visit_id', '/visit/:visit_id/orders'], async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT iro.*, COALESCE(u.full_name, 'Staff Nurse') as nurse_name, COALESCE(u.full_name, 'Staff Nurse') as administered_by_name, p.full_name as prescribed_by_name
      FROM injection_room_orders iro
      LEFT JOIN users u ON iro.administered_by::text = u.id::text
      LEFT JOIN users p ON iro.prescribed_by::text = p.id::text
      WHERE iro.visit_id::text = $1::text AND (iro.pharmacy_id::text = $2::text OR iro.pharmacy_id IS NULL)
      ORDER BY iro.created_at DESC
    `, [req.params.visit_id, req.pharmacy_id]);
    return successResponse(res, 200, 'Orders fetched', result.rows);
  } catch (error) {
    return errorResponse(res, 500, 'Failed to fetch orders');
  }
});

// Add drug order to injection room
router.post('/visit/:visit_id/orders', async (req, res) => {
  try {
    const { drug_name, dosage, route, frequency, duration, quantity, instructions, product_id, consultation_id } = req.body;
    if (!drug_name) return errorResponse(res, 400, 'Drug name required');

    // Get patient_id from visit
    const visit = await pool.query('SELECT patient_id FROM visits WHERE id::text=$1::text AND (pharmacy_id::text=$2::text OR pharmacy_id IS NULL)', [req.params.visit_id, req.pharmacy_id]);
    if (!visit.rows[0]) return errorResponse(res, 404, 'Visit not found');

    // Prevent duplicate entries: skip if an identical pending order already exists for this visit
    const dup = await pool.query(`
      SELECT * FROM injection_room_orders
      WHERE visit_id::text=$1::text AND (pharmacy_id::text=$2::text OR pharmacy_id IS NULL) AND LOWER(drug_name)=LOWER($3)
        AND LOWER(status)='pending'
      LIMIT 1
    `, [req.params.visit_id, req.pharmacy_id, drug_name]);
    if (dup.rows[0]) {
      return successResponse(res, 200, 'Order already exists for this visit', dup.rows[0]);
    }

    const result = await pool.query(`
      INSERT INTO injection_room_orders (
        pharmacy_id, visit_id, patient_id, consultation_id, prescribed_by,
        drug_name, dosage, route, frequency, duration, quantity, instructions, product_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *
    `, [req.pharmacy_id, req.params.visit_id, visit.rows[0].patient_id,
      consultation_id||null, req.user.id, drug_name, dosage||null,
      route||'IV', frequency||null, duration||null, quantity||null,
      instructions||null, product_id||null]);

    return successResponse(res, 201, 'Order added', result.rows[0]);
  } catch (error) {
    console.error('Add order error:', error.message);
    return errorResponse(res, 500, 'Failed to add order: ' + error.message);
  }
});

// Administer a drug (mark as given + deduct from stock)
router.put('/orders/:order_id/administer', async (req, res) => {
  const client = await pool.connect();
  try {
    const { notes, nurse_report } = req.body;
    const finalReport = nurse_report || notes || '';

    // Fetch order details safely
    const orderRes = await client.query(
      'SELECT * FROM injection_room_orders WHERE id=$1',
      [req.params.order_id]
    );
    if (!orderRes.rows[0]) {
      client.release();
      return errorResponse(res, 404, 'Order not found');
    }
    const o = orderRes.rows[0];
    const pharmacyId = req.pharmacy_id || o.pharmacy_id || 1;

    await client.query('BEGIN');

    const alreadyAdministered = o.status === 'administered';

    if (alreadyAdministered) {
      let resultRow;
      try {
        await client.query('SAVEPOINT admin_up1');
        const res1 = await client.query(`
          UPDATE injection_room_orders SET nurse_report=$1, notes=$1, updated_at=NOW()
          WHERE id=$2 RETURNING *
        `, [finalReport, req.params.order_id]);
        resultRow = res1.rows[0];
        await client.query('RELEASE SAVEPOINT admin_up1');
      } catch (uErr) {
        try { await client.query('ROLLBACK TO SAVEPOINT admin_up1'); } catch (r) {}
        const res2 = await client.query(`
          UPDATE injection_room_orders SET notes=$1, updated_at=NOW()
          WHERE id=$2 RETURNING *
        `, [finalReport, req.params.order_id]);
        resultRow = res2.rows[0];
      }

      try {
        await logAudit(client, {
          pharmacy_id: pharmacyId, table_name: 'injection_room_orders', record_id: o.id,
          action: 'update', old_data: o, new_data: resultRow,
          changed_by: req.user?.id || null, visit_id: o.visit_id, patient_id: o.patient_id,
        });
      } catch (auditErr) {
        console.error('Audit log failed during administer:', auditErr.message);
      }

      await client.query('COMMIT');
      return successResponse(res, 200, 'Nurse notes updated', resultRow);
    }

    // Mark order as administered
    let resultRow;
    try {
      await client.query('SAVEPOINT admin_up2');
      const res1 = await client.query(`
        UPDATE injection_room_orders SET
          status='administered', administered_by=$1,
          administered_at=NOW(), notes=$2, nurse_report=$2, updated_at=NOW()
        WHERE id=$3 RETURNING *
      `, [req.user?.id || null, finalReport, req.params.order_id]);
      resultRow = res1.rows[0];
      await client.query('RELEASE SAVEPOINT admin_up2');
    } catch (mErr) {
      try { await client.query('ROLLBACK TO SAVEPOINT admin_up2'); } catch (r) {}
      const res2 = await client.query(`
        UPDATE injection_room_orders SET
          status='administered', administered_by=$1,
          administered_at=NOW(), notes=$2, updated_at=NOW()
        WHERE id=$3 RETURNING *
      `, [req.user?.id || null, finalReport, req.params.order_id]);
      resultRow = res2.rows[0];
    }

    try {
      await logAudit(client, {
        pharmacy_id: pharmacyId, table_name: 'injection_room_orders', record_id: o.id,
        action: 'update', old_data: o, new_data: resultRow,
        changed_by: req.user?.id || null, visit_id: o.visit_id, patient_id: o.patient_id,
      });
    } catch (auditErr) {
      console.error('Audit log failed:', auditErr.message);
    }

    let productId = o.product_id;
    let unitPrice = 0;
    let qty = o.quantity || 1;
    const itemName = `${o.drug_name} ${o.dosage||''}`.trim();

    // 1. Try to resolve productId / selling_price using SAVEPOINT
    if (!productId) {
      const cleanName = o.drug_name.trim()
        .replace(/^(inj\.|inj|vial|amp)\s+/i, '')
        .replace(/\s+(inj\.|inj|injection|vial|amp)$/i, '')
        .trim();
      try {
        await client.query('SAVEPOINT prod_sp');
        const matchProd = await client.query(
          `SELECT id, selling_price FROM products WHERE (pharmacy_id = $1 OR pharmacy_id IS NULL) AND (LOWER(name) = LOWER($2) OR LOWER(name) LIKE LOWER($3)) LIMIT 1`,
          [pharmacyId, o.drug_name.trim(), '%' + cleanName + '%']
        );
        if (matchProd.rows[0]) {
          productId = matchProd.rows[0].id;
          unitPrice = parseFloat(matchProd.rows[0].selling_price || 0);
        }
        await client.query('RELEASE SAVEPOINT prod_sp');
      } catch (e) {
        try { await client.query('ROLLBACK TO SAVEPOINT prod_sp'); } catch (r) {}
      }
    } else {
      try {
        await client.query('SAVEPOINT prod_sp2');
        const priceRes = await client.query('SELECT selling_price FROM products WHERE id=$1', [productId]);
        unitPrice = parseFloat(priceRes.rows[0]?.selling_price || 0);
        await client.query('RELEASE SAVEPOINT prod_sp2');
      } catch (e) {
        try { await client.query('ROLLBACK TO SAVEPOINT prod_sp2'); } catch (r) {}
      }
    }

    // 2. Try service_prices lookup using SAVEPOINT
    if (unitPrice === 0) {
      try {
        await client.query('SAVEPOINT sp_sp');
        const spRes = await client.query(
          `SELECT price FROM service_prices WHERE (pharmacy_id = $1 OR pharmacy_id IS NULL) AND is_active = true AND (LOWER(name) = LOWER($2) OR LOWER(name) LIKE LOWER($3)) LIMIT 1`,
          [pharmacyId, o.drug_name.trim(), '%' + o.drug_name.trim() + '%']
        );
        if (spRes.rows[0]) {
          unitPrice = parseFloat(spRes.rows[0].price || 0);
        } else {
          const spRes2 = await client.query(
            `SELECT price FROM service_prices WHERE (pharmacy_id = $1 OR pharmacy_id IS NULL) AND is_active = true AND LOWER(name) LIKE '%injection%' LIMIT 1`,
            [pharmacyId]
          );
          if (spRes2.rows[0]) {
            unitPrice = parseFloat(spRes2.rows[0].price || 0);
          }
        }
        await client.query('RELEASE SAVEPOINT sp_sp');
      } catch (e) {
        try { await client.query('ROLLBACK TO SAVEPOINT sp_sp'); } catch (r) {}
      }
    }

    // 3. Stock deduction using SAVEPOINT so failure never aborts transaction
    if (productId && qty) {
      try {
        await client.query('SAVEPOINT stock_sp');
        await StockModel.deductStock(productId, qty, client, pharmacyId);
        await client.query(`
          INSERT INTO stock_movements (product_id, user_id, movement_type, quantity, notes, pharmacy_id)
          VALUES ($1,$2,'sale',$3,$4,$5)
        `, [productId, req.user.id, -qty, `Injection Room: ${o.drug_name} for visit`, pharmacyId]);
        await client.query('RELEASE SAVEPOINT stock_sp');
      } catch (stockErr) {
        try { await client.query('ROLLBACK TO SAVEPOINT stock_sp'); } catch (r) {}
        console.error('Stock deduction skipped/failed:', stockErr.message);
      }
    }

    // 4. Billing item update/creation using SAVEPOINT
    try {
      await client.query('SAVEPOINT bill_sp');
      const firstWord = o.drug_name.trim().toLowerCase().split(' ')[0];
      const alreadyBilled = await client.query(`
        SELECT id, unit_price, quantity FROM billing_items
        WHERE visit_id = $1 AND status != 'cancelled'
          AND (
            LOWER(TRIM(COALESCE(item_name, description))) = LOWER(TRIM($2))
            OR LOWER(TRIM(COALESCE(item_name, description))) = LOWER(TRIM($3))
            OR LOWER(TRIM(COALESCE(item_name, description))) LIKE LOWER(TRIM($4))
            OR LOWER(TRIM($2)) LIKE '%' || LOWER(TRIM(COALESCE(item_name, description))) || '%'
            OR LOWER(TRIM($3)) LIKE '%' || LOWER(TRIM(COALESCE(item_name, description))) || '%'
            OR (LENGTH($5) >= 3 AND LOWER(TRIM(COALESCE(item_name, description))) LIKE $5 || '%')
          )
        LIMIT 1
      `, [o.visit_id, itemName, o.drug_name.trim(), '%' + o.drug_name.trim() + '%', firstWord]);

      if (alreadyBilled.rows[0]) {
        const existingItem = alreadyBilled.rows[0];
        if (parseFloat(existingItem.unit_price || 0) === 0 && unitPrice > 0) {
          await client.query(`
            UPDATE billing_items SET unit_price = $1, total_price = $1 * quantity, updated_at = NOW()
            WHERE id = $2
          `, [unitPrice, existingItem.id]);
        }
      } else {
        await client.query(`
          INSERT INTO billing_items (facility_id, pharmacy_id, visit_id, patient_id, item_name, description, item_type, unit_price, quantity, status)
          VALUES ($1,$1,$2,$3,$4,$4,'prescription',$5,$6,'pending')
        `, [pharmacyId, o.visit_id, o.patient_id, itemName, unitPrice, qty]);
      }
      await client.query('RELEASE SAVEPOINT bill_sp');
    } catch (billErr) {
      try { await client.query('ROLLBACK TO SAVEPOINT bill_sp'); } catch (r) {}
      console.error('Billing item creation skipped/failed:', billErr.message);
    }

    // 5. Update visit status if all orders administered
    try {
      await client.query('SAVEPOINT pending_sp');
      const pendingCheck = await client.query(
        "SELECT COUNT(*)::int AS cnt FROM injection_room_orders WHERE visit_id::text=$1::text AND LOWER(status) IN ('pending', 'in_progress', 'scheduled', 'waiting', 'ordered')",
        [o.visit_id]
      );
      if (pendingCheck.rows[0]?.cnt === 0) {
        // Only return visit status to 'with_doctor' if it was specifically in 'injection_room' or 'waiting_injection'
        // If the patient is actively in 'lab', 'radiology', 'inpatient', etc., do not overwrite that department!
        const currentVisit = await client.query('SELECT status FROM visits WHERE id::text=$1::text', [o.visit_id]);
        const curStatus = (currentVisit.rows[0]?.status || '').toLowerCase();
        if (curStatus === 'injection_room' || curStatus === 'waiting_injection') {
          await client.query(
            "UPDATE visits SET status='with_doctor', updated_at=NOW() WHERE id::text=$1::text",
            [o.visit_id]
          );
          const io = req.app.get('io');
          if (io) {
            io.emit(`queue_update_${pharmacyId}`, { visit_id: o.visit_id, status: 'with_doctor' });
            io.emit(`visit_updated_${pharmacyId}`, { visit_id: o.visit_id, status: 'with_doctor' });
          }
        }
      }
      await client.query('RELEASE SAVEPOINT pending_sp');
    } catch (pendingErr) {
      try { await client.query('ROLLBACK TO SAVEPOINT pending_sp'); } catch (r) {}
    }

    await client.query('COMMIT');
    return successResponse(res, 200, 'Drug administered & record updated', resultRow);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (rErr) {}
    console.error('Administer error:', error.message);
    return errorResponse(res, 500, 'Failed to administer: ' + error.message);
  } finally {
    client.release();
  }
});

// Send patient back to doctor
router.put('/visit/:visit_id/return-to-doctor', async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE visits SET status='with_doctor', updated_at=NOW()
      WHERE id=$1 AND pharmacy_id=$2 RETURNING *
    `, [req.params.visit_id, req.pharmacy_id]);
    if (!result.rows[0]) return errorResponse(res, 404, 'Visit not found');

    const io = req.app.get('io');
    if (io) io.emit(`queue_update_${req.pharmacy_id}`, { visit_id: req.params.visit_id, status: 'with_doctor' });

    return successResponse(res, 200, 'Patient returned to doctor', result.rows[0]);
  } catch (error) {
    return errorResponse(res, 500, 'Failed to return patient');
  }
});

// Update vitals in injection room
router.post('/visit/:visit_id/vitals', async (req, res) => {
  try {
    const visit = await pool.query('SELECT patient_id FROM visits WHERE id=$1', [req.params.visit_id]);
    if (!visit.rows[0]) return errorResponse(res, 404, 'Visit not found');
    const { blood_pressure_systolic, blood_pressure_diastolic, pulse_rate, temperature, oxygen_saturation } = req.body;
    await pool.query(`
      INSERT INTO vitals (pharmacy_id, visit_id, patient_id, blood_pressure_systolic, blood_pressure_diastolic, pulse_rate, temperature, oxygen_saturation, recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT DO NOTHING
    `, [req.pharmacy_id, req.params.visit_id, visit.rows[0].patient_id,
      blood_pressure_systolic||null, blood_pressure_diastolic||null,
      pulse_rate||null, temperature||null, oxygen_saturation||null, req.user.id]);
    return successResponse(res, 201, 'Vitals updated');
  } catch (error) {
    return errorResponse(res, 500, 'Failed to update vitals');
  }
});

module.exports = router;

