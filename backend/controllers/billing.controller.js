const { pool } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

// ── Dashboard summary ──────────────────────────────────────
const getBillingDashboard = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const pid = req.pharmacy_id;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to   = date_to   || new Date().toISOString().split('T')[0];

    const result = await pool.query(`
      SELECT
        COUNT(*)                                                        AS total_items,
        COUNT(*) FILTER (WHERE status IN ('paid', 'insurance', 'nhif', 'sha')) AS paid,
        COUNT(*) FILTER (WHERE status='pending')                        AS pending,
        COUNT(*) FILTER (WHERE status='waived')                         AS waived,
        COUNT(*) FILTER (WHERE status='insurance')                      AS insurance,
        COUNT(*) FILTER (WHERE status='nhif')                           AS nhif,
        COUNT(*) FILTER (WHERE status='sha')                            AS sha,
        COALESCE(SUM(total_price),0)                                    AS total_amount,
        COALESCE(SUM(total_price) FILTER (WHERE status IN ('paid', 'insurance', 'nhif', 'sha')),0) AS paid_amount,
        COALESCE(SUM(total_price) FILTER (WHERE status='pending'),0)    AS pending_amount,
        COALESCE(SUM(total_price) FILTER (WHERE status='waived'),0)     AS waived_amount,
        COALESCE(SUM(total_price) FILTER (WHERE status='insurance'),0)  AS insurance_amount,
        COALESCE(SUM(total_price) FILTER (WHERE status IN ('nhif','sha')),0) AS nhif_sha_amount
      FROM billing_items
      WHERE facility_id=$1
        AND DATE(created_at) BETWEEN $2 AND $3
    `, [pid, from, to]);

    const byType = await pool.query(`
      SELECT item_type,
        COUNT(*)                                       AS count,
        COALESCE(SUM(total_price),0)                   AS amount,
        COALESCE(SUM(total_price) FILTER (WHERE status IN ('paid', 'insurance', 'nhif', 'sha')),0) AS paid
      FROM billing_items
      WHERE facility_id=$1 AND DATE(created_at) BETWEEN $2 AND $3
      GROUP BY item_type ORDER BY amount DESC
    `, [pid, from, to]);

    const recent = await pool.query(`
      SELECT bi.*, v.visit_number, p.full_name as patient_name, p.patient_number
      FROM billing_items bi
      LEFT JOIN visits v ON bi.visit_id=v.id
      LEFT JOIN patients p ON bi.patient_id=p.id
      WHERE bi.facility_id=$1 AND DATE(bi.created_at) BETWEEN $2 AND $3
      ORDER BY bi.created_at DESC LIMIT 50
    `, [pid, from, to]);

    return successResponse(res, 200, 'Billing dashboard', {
      summary: result.rows[0],
      by_type: byType.rows,
      recent:  recent.rows,
    });
  } catch (e) { logger.error('Billing dashboard error:', e.message); return errorResponse(res, 500, e.message); }
};

const getBillingItems = async (req, res) => {
  try {
    const { status, visit_id, patient_id, item_type, date_from, date_to, search, limit=50, offset=0 } = req.query;
    const pid = req.pharmacy_id;
    let q = `
      SELECT bi.*, v.visit_number, p.full_name as patient_name, p.patient_number, p.gender, p.phone
      FROM billing_items bi
      LEFT JOIN visits v ON bi.visit_id=v.id
      LEFT JOIN patients p ON bi.patient_id=p.id
      WHERE bi.facility_id=$1
    `;
    const params = [pid];
    if (status)    { params.push(status);    q += ` AND bi.status=$${params.length}`; }
    if (visit_id)  { params.push(visit_id);  q += ` AND bi.visit_id=$${params.length}`; }
    if (patient_id){ params.push(patient_id);q += ` AND bi.patient_id=$${params.length}`; }
    if (item_type) { params.push(item_type); q += ` AND bi.item_type=$${params.length}`; }
    if (date_from) { params.push(date_from); q += ` AND DATE(bi.created_at)>=$${params.length}`; }
    if (date_to)   { params.push(date_to);   q += ` AND DATE(bi.created_at)<=$${params.length}`; }
    if (search) {
      params.push(`%${search}%`);
      q += ` AND (p.full_name ILIKE $${params.length} OR p.patient_number ILIKE $${params.length} OR v.visit_number ILIKE $${params.length})`;
    }
    q += ` ORDER BY bi.created_at DESC`;
    params.push(limit);  q += ` LIMIT $${params.length}`;
    params.push(offset); q += ` OFFSET $${params.length}`;
    const result = await pool.query(q, params);
    return successResponse(res, 200, 'Billing items fetched', result.rows);
  } catch (e) { return errorResponse(res, 500, e.message); }
};


// ── Daily Summary Report (Receptionist Billing) ─────────────
const getDailySummary = async (req, res) => {
  try {
    const { date } = req.query;
    const pid = req.pharmacy_id;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const summary = await pool.query(`
      SELECT
        COUNT(*)                                                        AS total_items,
        COUNT(*) FILTER (WHERE status IN ('paid', 'insurance', 'nhif', 'sha', 'corporate')) AS paid_count,
        COUNT(*) FILTER (WHERE status='pending')                        AS pending_count,
        COUNT(*) FILTER (WHERE status='waived')                         AS waived_count,
        COALESCE(SUM(total_price),0)                                    AS total_billed,
        COALESCE(SUM(total_price) FILTER (WHERE status IN ('paid', 'insurance', 'nhif', 'sha', 'corporate')),0) AS total_collected,
        COALESCE(SUM(total_price) FILTER (WHERE status='pending'),0)    AS total_pending,
        COALESCE(SUM(total_price) FILTER (WHERE status='waived'),0)     AS total_waived,
        COALESCE(SUM(total_price) FILTER (WHERE payment_method='cash' AND status='paid'),0) AS cash_collected,
        COALESCE(SUM(total_price) FILTER (WHERE payment_method='mpesa' AND status='paid'),0) AS mpesa_collected,
        COALESCE(SUM(total_price) FILTER (WHERE status IN ('insurance','nhif','sha') OR payment_method IN ('insurance','nhif','sha')),0) AS insurance_collected,
        COALESCE(SUM(total_price) FILTER (WHERE payment_method='bank' AND status='paid'),0) AS bank_collected,
        COALESCE(SUM(total_price) FILTER (WHERE payment_method='corporate'),0) AS corporate_collected
      FROM billing_items
      WHERE facility_id=$1 AND DATE(created_at)=$2
    `, [pid, targetDate]);

    const byMethod = await pool.query(`
      SELECT 
        COALESCE(payment_method, 'cash') AS payment_method,
        COUNT(*) AS count,
        COALESCE(SUM(total_price), 0) AS amount
      FROM billing_items
      WHERE facility_id=$1 AND DATE(created_at)=$2 AND status IN ('paid', 'insurance', 'nhif', 'sha', 'corporate')
      GROUP BY COALESCE(payment_method, 'cash')
      ORDER BY amount DESC
    `, [pid, targetDate]);

    const byType = await pool.query(`
      SELECT item_type,
        COUNT(*)                                       AS count,
        COALESCE(SUM(total_price),0)                   AS amount,
        COALESCE(SUM(total_price) FILTER (WHERE status IN ('paid', 'insurance', 'nhif', 'sha', 'corporate')),0) AS collected
      FROM billing_items
      WHERE facility_id=$1 AND DATE(created_at)=$2
      GROUP BY item_type ORDER BY amount DESC
    `, [pid, targetDate]);

    const recent = await pool.query(`
      SELECT bi.*, v.visit_number, p.full_name as patient_name, p.patient_number
      FROM billing_items bi
      LEFT JOIN visits v ON bi.visit_id=v.id
      LEFT JOIN patients p ON bi.patient_id=p.id
      WHERE bi.facility_id=$1 AND DATE(bi.created_at)=$2
      ORDER BY bi.created_at DESC
      LIMIT 50
    `, [pid, targetDate]);

    return successResponse(res, 200, 'Daily summary', {
      date: targetDate,
      summary: summary.rows[0],
      by_method: byMethod.rows,
      by_type: byType.rows,
      recent_transactions: recent.rows,
    });
  } catch (e) { logger.error('Daily summary error:', e.message); return errorResponse(res, 500, e.message); }
};


// ── Pay single billing item ────────────────────────────────
const payBillingItem = async (req, res) => {
  try {
    const { payment_method } = req.body;
    const pMethod = (payment_method || 'cash').toLowerCase();
    const isInsurance = ['insurance', 'nhif', 'sha', 'corporate'].includes(pMethod);
    const statusToSet = isInsurance ? pMethod : 'paid';

    const result = await pool.query(`
      UPDATE billing_items
      SET status=$1, payment_method=$2, paid_amount=total_price, paid_at=NOW(), updated_at=NOW()
      WHERE id::text=$3::text AND ($4::text IS NULL OR facility_id::text=$4::text OR pharmacy_id::text=$4::text) AND status IN ('pending', 'partial')
      RETURNING *
    `, [statusToSet, pMethod, String(req.params.id), req.pharmacy_id]);
    if (!result.rows[0]) return errorResponse(res, 404, 'Billing item not found or already paid');
    
    // Check if any items are still pending for this visit and sync visit.fee_paid
    const checkPending = await pool.query(`
      SELECT COUNT(*) AS pending_count FROM billing_items
      WHERE visit_id::text = $1::text AND status IN ('pending', 'partial')
    `, [String(result.rows[0].visit_id)]);
    const pendingCount = parseInt(checkPending.rows[0]?.pending_count || 0);
    const feePaid = pendingCount === 0;

    await pool.query(`
      UPDATE visits
      SET fee_paid = $1, payment_method = COALESCE(payment_method, $2), updated_at = NOW()
      WHERE id::text = $3::text
    `, [feePaid, pMethod, String(result.rows[0].visit_id)]);

    await pool.query(`
      INSERT INTO audit_logs (facility_id, user_id, action, table_name, record_id, new_values)
      VALUES ($1,$2,'payment_received','billing_items',$3,$4)
    `, [req.pharmacy_id, req.user.id, result.rows[0].id, JSON.stringify({ payment_method: pMethod, amount: result.rows[0].total_price })]);
    const io = req.app.get('io');
    if (io) io.emit(`billing_paid_${req.pharmacy_id}`, result.rows[0]);
    return successResponse(res, 200, 'Payment recorded', result.rows[0]);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── Pay entire visit or partial deposit ──────────────────
const payVisitBill = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { 
      payment_method, visit_id, item_ids, amount, reference_number, notes,
      insurance_provider, member_number, auth_code, copay_amount 
    } = req.body;
    const vid = String(visit_id || req.params.visit_id);
    const pMethod = (payment_method || 'cash').toLowerCase();
    const isInsuranceMethod = ['insurance', 'nhif', 'sha', 'corporate'].includes(pMethod);
    const statusToSet = isInsuranceMethod ? pMethod : 'paid';

    let depositToAllocate = (amount !== undefined && amount !== null && amount !== '') ? parseFloat(amount) : null;
    const copayVal = (copay_amount !== undefined && copay_amount !== null && copay_amount !== '') ? parseFloat(copay_amount) : 0;
    const insProviderStr = isInsuranceMethod ? (insurance_provider || pMethod.toUpperCase()) : null;

    let itemsToPay = [];
    if (item_ids && Array.isArray(item_ids) && item_ids.length > 0) {
      const stringItemIds = item_ids.map(id => String(id));
      const resItems = await client.query(`
        SELECT * FROM billing_items
        WHERE visit_id::text=$1::text AND id::text = ANY($2::text[]) AND status IN ('pending', 'partial')
        ORDER BY created_at ASC
      `, [vid, stringItemIds]);
      itemsToPay = resItems.rows;
    } else {
      const resItems = await client.query(`
        SELECT * FROM billing_items
        WHERE visit_id::text=$1::text AND status IN ('pending', 'partial')
        ORDER BY created_at ASC
      `, [vid]);
      itemsToPay = resItems.rows;

      if (itemsToPay.length === 0) {
        const vRow = await client.query(`SELECT * FROM visits WHERE id::text=$1::text`, [vid]);
        if (vRow.rows[0] && parseFloat(vRow.rows[0].consultation_fee || 0) > 0) {
          const cFee = parseFloat(vRow.rows[0].consultation_fee);
          const insRes = await client.query(`
            INSERT INTO billing_items (facility_id, visit_id, patient_id, item_name, item_type, unit_price, quantity, total_price, status)
            VALUES ($1, $2, $3, 'Consultation Fee', 'consultation', $4, 1, $4, 'pending')
            RETURNING *
          `, [req.pharmacy_id, vid, vRow.rows[0].patient_id, cFee]);
          itemsToPay = insRes.rows;
        }
      }
    }

    const updatedRows = [];
    if (depositToAllocate !== null && !isNaN(depositToAllocate) && depositToAllocate >= 0) {
      let rem = depositToAllocate;
      for (const item of itemsToPay) {
        if (rem <= 0) break;
        const tot = parseFloat(item.total_price || 0);
        const alreadyPaid = parseFloat(item.paid_amount || 0);
        const itemPending = Math.max(0, tot - alreadyPaid);

        if (rem >= itemPending) {
          rem -= itemPending;
          const uRes = await client.query(`
            UPDATE billing_items
            SET status=$1, payment_method=$2, paid_amount=$3, reference_number=$4,
                insurance_provider=$5, member_number=$6, auth_code=$7, copay_amount=$8,
                paid_at=NOW(), updated_at=NOW()
            WHERE id::text=$9::text RETURNING *
          `, [statusToSet, pMethod, tot, reference_number || null, insProviderStr, member_number || null, auth_code || null, copayVal, String(item.id)]);
          if (uRes.rows[0]) updatedRows.push(uRes.rows[0]);
        } else {
          // Partial payment for this item
          const newPaid = alreadyPaid + rem;
          rem = 0;
          const uRes = await client.query(`
            UPDATE billing_items
            SET status='partial', payment_method=$1, paid_amount=$2, reference_number=$3,
                insurance_provider=$4, member_number=$5, auth_code=$6, copay_amount=$7,
                updated_at=NOW()
            WHERE id::text=$8::text RETURNING *
          `, [pMethod, newPaid, reference_number || null, insProviderStr, member_number || null, auth_code || null, copayVal, String(item.id)]);
          if (uRes.rows[0]) updatedRows.push(uRes.rows[0]);
        }
      }
    } else {
      // Pay all selected/pending items in full
      for (const item of itemsToPay) {
        const tot = parseFloat(item.total_price || 0);
        const uRes = await client.query(`
          UPDATE billing_items
          SET status=$1, payment_method=$2, paid_amount=$3, reference_number=$4,
              insurance_provider=$5, member_number=$6, auth_code=$7, copay_amount=$8,
              paid_at=NOW(), updated_at=NOW()
          WHERE id::text=$9::text RETURNING *
        `, [statusToSet, pMethod, tot, reference_number || null, insProviderStr, member_number || null, auth_code || null, copayVal, String(item.id)]);
        if (uRes.rows[0]) updatedRows.push(uRes.rows[0]);
      }
    }

    // Check if any items are still pending for this visit
    const checkPending = await client.query(`
      SELECT COUNT(*) AS pending_count FROM billing_items
      WHERE visit_id::text = $1::text AND status IN ('pending', 'partial')
    `, [vid]);
    const pendingCount = parseInt(checkPending.rows[0]?.pending_count || 0);
    const feePaid = pendingCount === 0;

    // Update visit status & payment details
    await client.query(`
      UPDATE visits
      SET fee_paid = $1, payment_method = $2, insurance_provider = COALESCE($3, insurance_provider),
          member_number = COALESCE($4, member_number), auth_code = COALESCE($5, auth_code),
          copay_amount = $6, updated_at = NOW()
      WHERE id::text = $7::text
    `, [feePaid, pMethod, insProviderStr, member_number || null, auth_code || null, copayVal, vid]);

    await client.query('COMMIT');

    // Post-commit audit and realtime broadcast (non-blocking, won't abort payment)
    try {
      await pool.query(`
        INSERT INTO audit_logs (facility_id, pharmacy_id, user_id, action, table_name, record_id, new_values)
        VALUES ($1,$1,$2,'visit_payment_received','visit',$3,$4)
      `, [req.pharmacy_id, req.user?.id ? Number(req.user.id) : null, vid, JSON.stringify({ payment_method: pMethod, amount_allocated: depositToAllocate, insurance_provider: insProviderStr, items_affected: updatedRows.length, reference_number, notes })]);
    } catch (auditErr) {
      logger.warn('Audit log write warning in payVisitBill: ' + auditErr.message);
    }

    const io = req.app.get('io');
    if (io) io.emit(`billing_paid_${req.pharmacy_id}`, { visit_id: vid, items: updatedRows });

    return successResponse(res, 200, `Payment recorded for ${updatedRows.length} items`, updatedRows);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    logger.error('Error in payVisitBill:', e.message);
    return errorResponse(res, 500, e.message);
  } finally {
    client.release();
  }
};

// ── Waive a billing item ──────────────────────────────────
const waiveBillingItem = async (req, res) => {
  try {
    const { waive_reason } = req.body;
    const result = await pool.query(`
      UPDATE billing_items
      SET status='waived', waived_by=$1, waive_reason=$2, updated_at=NOW()
      WHERE id=$3 AND facility_id=$4
      RETURNING *
    `, [req.user.id, waive_reason||null, req.params.id, req.pharmacy_id]);
    if (!result.rows[0]) return errorResponse(res, 404, 'Billing item not found');

    // Also update visits.fee_paid to true if this is a consultation or mch service fee item
    if (result.rows[0].item_type === 'consultation' || result.rows[0].item_type === 'mch') {
      await pool.query(`
        UPDATE visits
        SET fee_paid = true, payment_method = 'waived', updated_at = NOW()
        WHERE id = $1 AND pharmacy_id = $2
      `, [result.rows[0].visit_id, req.pharmacy_id]);
    }

    return successResponse(res, 200, 'Item waived', result.rows[0]);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── Mark as insurance / NHIF / SHA ───────────────────────
const markInsurance = async (req, res) => {
  try {
    const { coverage_type, insurance_provider, member_number, auth_code } = req.body; // 'insurance' | 'nhif' | 'sha' | 'corporate'
    const allowed = ['insurance','nhif','sha','corporate'];
    if (!allowed.includes(coverage_type)) return errorResponse(res, 400, 'Invalid coverage type');

    try {
      await pool.query(`ALTER TABLE billing_items ADD COLUMN IF NOT EXISTS insurance_provider VARCHAR(150)`);
      await pool.query(`ALTER TABLE billing_items ADD COLUMN IF NOT EXISTS member_number VARCHAR(150)`);
      await pool.query(`ALTER TABLE billing_items ADD COLUMN IF NOT EXISTS auth_code VARCHAR(150)`);
    } catch(e) {}

    const result = await pool.query(`
      UPDATE billing_items
      SET status=$1, payment_method=$1, insurance_provider=$2, member_number=$3, auth_code=$4, updated_at=NOW()
      WHERE id=$5 AND facility_id=$6 RETURNING *
    `, [coverage_type, insurance_provider || coverage_type.toUpperCase(), member_number || null, auth_code || null, req.params.id, req.pharmacy_id]);
    if (!result.rows[0]) return errorResponse(res, 404, 'Billing item not found');

    // Also update visits
    if (result.rows[0].visit_id) {
      await pool.query(`
        UPDATE visits
        SET fee_paid = true, payment_method = $1, insurance_provider = COALESCE($2, insurance_provider),
            member_number = COALESCE($3, member_number), auth_code = COALESCE($4, auth_code), updated_at = NOW()
        WHERE id = $5 AND pharmacy_id = $6
      `, [coverage_type, insurance_provider || coverage_type.toUpperCase(), member_number || null, auth_code || null, result.rows[0].visit_id, req.pharmacy_id]);
    }

    return successResponse(res, 200, `Marked as ${coverage_type}`, result.rows[0]);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── Get visit billing summary ─────────────────────────────
const getVisitBilling = async (req, res) => {
  try {
    try {
      const vCheck = await pool.query(`
        SELECT v.status, v.visit_type,
               (EXISTS(SELECT 1 FROM inpatient_admissions ia WHERE ia.visit_id::text = v.id::text AND ia.status = 'admitted')
                OR v.status = 'inpatient' OR LOWER(COALESCE(v.visit_type, '')) = 'inpatient'
                OR EXISTS(SELECT 1 FROM beds b WHERE b.current_visit_id::text = v.id::text)) AS is_inpatient
        FROM visits v
        WHERE v.id::text = $1::text AND (v.pharmacy_id = $2 OR v.pharmacy_id IS NULL)
      `, [req.params.visit_id, req.pharmacy_id]);

      if (vCheck.rows[0]?.is_inpatient) {
        const inpatientRoutes = require('../routes/inpatient.routes');
        if (inpatientRoutes && inpatientRoutes.syncInpatientBedCharges) {
          await inpatientRoutes.syncInpatientBedCharges(req.params.visit_id, req.pharmacy_id);
        }
      }
    } catch (sErr) {
      logger.warn('Bed charge sync warning in getVisitBilling: ' + sErr.message);
    }

    let items = await pool.query(`
      SELECT bi.*, so.order_type
      FROM billing_items bi
      LEFT JOIN service_orders so ON bi.service_order_id::text=so.id::text
      WHERE bi.visit_id::text=$1::text AND ($2::text IS NULL OR bi.facility_id::text=$2::text OR bi.pharmacy_id::text=$2::text)
      ORDER BY bi.created_at DESC
    `, [req.params.visit_id, req.pharmacy_id]);

    if (items.rows.length === 0) {
      const vRes = await pool.query(`SELECT * FROM visits WHERE id::text=$1::text AND ($2::text IS NULL OR pharmacy_id::text=$2::text)`, [req.params.visit_id, req.pharmacy_id]);
      if (vRes.rows[0] && parseFloat(vRes.rows[0].consultation_fee || 0) > 0) {
        const cFee = parseFloat(vRes.rows[0].consultation_fee);
        const isPaid = !!vRes.rows[0].fee_paid;
        await pool.query(`
          INSERT INTO billing_items (facility_id, pharmacy_id, visit_id, patient_id, item_name, item_type, unit_price, quantity, total_price, status, paid_amount, payment_method, paid_at)
          VALUES ($1, $1, $2, $3, 'Consultation Fee', 'consultation', $4, 1, $4, $5, $6, $7, $8)
        `, [
          req.pharmacy_id,
          req.params.visit_id,
          vRes.rows[0].patient_id,
          cFee,
          isPaid ? 'paid' : 'pending',
          isPaid ? cFee : 0,
          isPaid ? (vRes.rows[0].payment_method || 'cash') : null,
          isPaid ? new Date() : null
        ]);
        items = await pool.query(`
          SELECT bi.*, so.order_type
          FROM billing_items bi
          LEFT JOIN service_orders so ON bi.service_order_id::text=so.id::text
          WHERE bi.visit_id::text=$1::text AND ($2::text IS NULL OR bi.facility_id::text=$2::text OR bi.pharmacy_id::text=$2::text)
          ORDER BY bi.created_at DESC
        `, [req.params.visit_id, req.pharmacy_id]);
      }
    }

    const rows = items.rows;
    const total = rows.reduce((s, i) => s + parseFloat(i.total_price || (parseFloat(i.unit_price || 0) * (parseInt(i.quantity) || 1)) || 0), 0);
    const paid = rows.reduce((s, i) => {
      const st = (i.status || '').toLowerCase();
      const pm = (i.payment_method || '').toLowerCase();
      if (['paid', 'insurance', 'nhif', 'sha', 'corporate', 'settled', 'cleared'].includes(st)) {
        return s + parseFloat(i.paid_amount || i.total_price || (parseFloat(i.unit_price || 0) * (parseInt(i.quantity) || 1)) || 0);
      }
      if (['cash', 'mpesa', 'bank', 'card', 'insurance', 'sha', 'nhif', 'corporate'].includes(pm) && st !== 'pending' && st !== 'waived' && st !== 'cancelled') {
        return s + parseFloat(i.paid_amount || i.total_price || (parseFloat(i.unit_price || 0) * (parseInt(i.quantity) || 1)) || 0);
      }
      if (st === 'partial') {
        return s + parseFloat(i.paid_amount || 0);
      }
      return s;
    }, 0);
    const waived = rows.filter(i => (i.status || '').toLowerCase() === 'waived').reduce((s, i) => s + parseFloat(i.total_price || (parseFloat(i.unit_price || 0) * (parseInt(i.quantity) || 1)) || 0), 0);
    const balance = Math.max(0, total - paid - waived);
    return successResponse(res, 200, 'Visit billing', { items: rows, total, paid, waived, balance });
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── Get insurance claims pipeline ──────────────────────────
const getBillingClaims = async (req, res) => {
  try {
    const pid = req.pharmacy_id;
    const result = await pool.query(`
      SELECT 
        v.id AS visit_id,
        v.visit_number,
        v.created_at,
        v.insurance_provider,
        v.member_number,
        v.auth_code,
        v.copay_amount,
        p.id AS patient_id,
        p.full_name AS patient_name,
        p.patient_number,
        p.sha_number,
        p.national_id,
        COALESCE(SUM(bi.total_price) FILTER (WHERE bi.status IN ('insurance', 'sha', 'nhif', 'corporate') OR bi.payment_method IN ('insurance', 'sha', 'nhif', 'corporate')), 0) AS claimed_amount,
        COUNT(bi.id) AS total_items
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      JOIN billing_items bi ON bi.visit_id = v.id
      WHERE (v.pharmacy_id::text = $1::text OR ($1::text IS NULL))
        AND (bi.status IN ('insurance', 'sha', 'nhif', 'corporate') OR bi.payment_method IN ('insurance', 'sha', 'nhif', 'corporate') OR v.payment_method IN ('insurance', 'sha', 'nhif', 'corporate'))
      GROUP BY v.id, p.id
      ORDER BY v.created_at DESC
      LIMIT 100
    `, [pid]);

    const claims = result.rows.map(r => ({
      id: `CLM-${r.visit_number}`,
      visit_id: r.visit_id,
      patient_name: r.patient_name,
      patient_number: r.patient_number,
      sha_number: r.sha_number || r.member_number || r.national_id || 'SHA-PENDING',
      benefit_package: r.insurance_provider ? `${r.insurance_provider} Medical Package` : 'SHA Health Package',
      claimed_amount: parseFloat(r.claimed_amount || 0),
      copay_amount: parseFloat(r.copay_amount || 0),
      auth_code: r.auth_code || 'AUTH-OK',
      status: 'PENDING_SUBMISSION',
      created_at: r.created_at,
      khie_verified: true
    }));

    return successResponse(res, 200, 'Insurance claims fetched', claims);
  } catch (e) {
    logger.error('Get billing claims error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

// ── Get visit invoice payload ──────────────────────────────
const getVisitInvoice = async (req, res) => {
  try {
    const vid = req.params.visit_id;
    const pid = req.pharmacy_id;

    const vRes = await pool.query(`
      SELECT v.*, p.full_name AS patient_name, p.patient_number, p.phone, p.gender, p.date_of_birth, p.national_id, p.sha_number, p.insurance_provider AS patient_insurance
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      WHERE v.id::text = $1::text AND ($2::text IS NULL OR v.pharmacy_id::text = $2::text)
    `, [vid, pid]);

    if (!vRes.rows[0]) return errorResponse(res, 404, 'Visit or invoice record not found');
    const visit = vRes.rows[0];

    const iRes = await pool.query(`
      SELECT * FROM billing_items
      WHERE visit_id::text = $1::text AND ($2::text IS NULL OR facility_id::text = $2::text OR pharmacy_id::text = $2::text)
      ORDER BY created_at ASC
    `, [vid, pid]);

    const items = iRes.rows;
    if (items.length === 0 && parseFloat(visit.consultation_fee || 0) > 0) {
      const isPaid = !!visit.fee_paid;
      const cFee = parseFloat(visit.consultation_fee);
      const insRes = await pool.query(`
        INSERT INTO billing_items (facility_id, pharmacy_id, visit_id, patient_id, item_name, item_type, unit_price, quantity, total_price, status, paid_amount, payment_method, paid_at)
        VALUES ($1, $1, $2, $3, 'Consultation Fee', 'consultation', $4, 1, $4, $5, $6, $7, $8)
        RETURNING *
      `, [pid, vid, visit.patient_id, cFee, isPaid ? 'paid' : 'pending', isPaid ? cFee : 0, isPaid ? (visit.payment_method || 'cash') : null, isPaid ? new Date() : null]);
      items.push(insRes.rows[0]);
    }

    const total_billed = items.reduce((s, i) => s + parseFloat(i.total_price || (parseFloat(i.unit_price || 0) * (parseInt(i.quantity) || 1)) || 0), 0);
    const total_paid = items.reduce((s, i) => {
      const st = (i.status || '').toLowerCase();
      const pm = (i.payment_method || '').toLowerCase();
      if (['paid', 'insurance', 'nhif', 'sha', 'corporate', 'settled', 'cleared'].includes(st)) {
        return s + parseFloat(i.paid_amount || i.total_price || (parseFloat(i.unit_price || 0) * (parseInt(i.quantity) || 1)) || 0);
      }
      if (['cash', 'mpesa', 'bank', 'card', 'insurance', 'sha', 'nhif', 'corporate'].includes(pm) && st !== 'pending' && st !== 'waived' && st !== 'cancelled') {
        return s + parseFloat(i.paid_amount || i.total_price || (parseFloat(i.unit_price || 0) * (parseInt(i.quantity) || 1)) || 0);
      }
      if (st === 'partial') {
        return s + parseFloat(i.paid_amount || 0);
      }
      return s;
    }, 0);
    const total_waived = items.filter(i => (i.status || '').toLowerCase() === 'waived').reduce((s, i) => s + parseFloat(i.total_price || (parseFloat(i.unit_price || 0) * (parseInt(i.quantity) || 1)) || 0), 0);
    const balance = Math.max(0, total_billed - total_paid - total_waived);

    return successResponse(res, 200, 'Visit invoice fetched', {
      visit,
      items,
      total_billed,
      total_paid,
      total_waived,
      balance,
      insurance_provider: visit.insurance_provider || visit.patient_insurance || visit.payment_method,
      member_number: visit.member_number || visit.sha_number || visit.national_id,
      auth_code: visit.auth_code || visit.reference_number
    });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

module.exports = { getBillingDashboard, getBillingItems, payBillingItem, payVisitBill, waiveBillingItem, markInsurance, getVisitBilling, getDailySummary, getBillingClaims, getVisitInvoice };
