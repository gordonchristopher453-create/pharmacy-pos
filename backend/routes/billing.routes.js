const express = require('express');
const router = express.Router();
const { protect, requirePharmacy } = require('../middleware/auth.middleware');
const { getBillingDashboard, getBillingItems, payBillingItem, payVisitBill, waiveBillingItem, markInsurance, getVisitBilling, getDailySummary, getBillingClaims, getVisitInvoice } = require('../controllers/billing.controller');
const { pool } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');

router.get('/dashboard',              protect, getBillingDashboard);
router.get('/',                       protect, getBillingItems);
router.get('/claims',                 protect, getBillingClaims);
router.get('/visit/:visit_id',        protect, getVisitBilling);
router.get('/visit/:visit_id/invoice',protect, getVisitInvoice);
router.put('/items/:id/pay',          protect, payBillingItem);
router.put('/items/:id/waive',        protect, waiveBillingItem);
router.put('/items/:id/insurance',    protect, markInsurance);
router.post('/visit/:visit_id/pay',   protect, payVisitBill);

// Inpatient Bills (Cashier module)
router.get('/inpatient-folder', protect, async (req, res) => {
  try {
    const { status = 'all', search } = req.query;
    
    // First trigger bed charge sync for all active admissions
    const inpatientRoutes = require('./inpatient.routes');
    if (inpatientRoutes.syncInpatientBedCharges) {
      try {
        const activeInpatients = await pool.query(`
          SELECT DISTINCT v.id
          FROM visits v
          LEFT JOIN inpatient_admissions ia ON ia.visit_id::text = v.id::text
          LEFT JOIN beds b ON b.current_visit_id::text = v.id::text
          WHERE (v.pharmacy_id::text = $1::text OR v.pharmacy_id IS NULL)
            AND (v.status = 'inpatient' OR ia.status = 'admitted' OR (b.id IS NOT NULL AND b.status = 'occupied'))
        `, [req.pharmacy_id]);

        for (const row of activeInpatients.rows) {
          await inpatientRoutes.syncInpatientBedCharges(row.id, req.pharmacy_id);
        }
      } catch(e){
        console.error('Error syncing inpatient charges:', e.message);
      }
    }

    let whereSql = `WHERE (v.pharmacy_id::text = $1::text OR v.pharmacy_id IS NULL) AND (v.status = 'inpatient' OR LOWER(COALESCE(v.visit_type,'')) = 'inpatient' OR (ia.id IS NOT NULL AND ia.status = 'admitted') OR (b.id IS NOT NULL AND b.status = 'occupied'))`;
    const params = [req.pharmacy_id];

    if (status === 'admitted') {
      whereSql += ` AND (v.status = 'inpatient' OR ia.status = 'admitted' OR b.status = 'occupied')`;
    } else if (status === 'discharged') {
      whereSql += ` AND (v.status = 'discharged' OR ia.status = 'discharged')`;
    }

    if (search) {
      params.push(`%${search}%`);
      whereSql += ` AND (p.full_name ILIKE $${params.length} OR p.patient_number ILIKE $${params.length} OR w.name ILIKE $${params.length} OR v.visit_number ILIKE $${params.length})`;
    }

    const result = await pool.query(`
      SELECT 
        v.id as visit_id,
        v.id as id,
        v.patient_id,
        v.visit_number,
        v.status as visit_status,
        v.created_at as visit_date,
        v.attending_doctor as doctor_id,
        v.payment_method,
        v.insurance_provider,
        v.member_number,
        v.auth_code,
        p.full_name as patient_name,
        p.patient_number,
        p.phone,
        p.gender,
        p.date_of_birth,
        p.sha_number,
        ia.id as admission_id,
        ia.admitted_at as admission_date,
        ia.discharged_at as discharge_date,
        ia.admission_notes,
        ia.management_plan,
        COALESCE(ia.status, CASE WHEN v.status = 'discharged' THEN 'discharged' ELSE 'admitted' END) as admission_status,
        w.name as ward_name,
        1500 as daily_rate,
        b.bed_number,
        COALESCE(SUM(bi.total_price), 0) AS total_amount,
        COALESCE(SUM(bi.total_price) FILTER (WHERE bi.status IN ('paid', 'insurance', 'sha', 'nhif', 'corporate')), 0) AS paid_amount,
        COALESCE(SUM(bi.total_price) FILTER (WHERE bi.status = 'pending'), 0) AS pending_amount,
        COUNT(bi.id) AS total_items
      FROM visits v
      JOIN patients p ON v.patient_id::text = p.id::text
      LEFT JOIN inpatient_admissions ia ON ia.visit_id::text = v.id::text
      LEFT JOIN beds b ON b.current_visit_id::text = v.id::text
      LEFT JOIN wards w ON b.ward_id::text = w.id::text
      LEFT JOIN billing_items bi ON bi.visit_id::text = v.id::text
      ${whereSql}
      GROUP BY v.id, p.id, ia.id, w.name, b.bed_number
      ORDER BY v.created_at DESC
      LIMIT 100
    `, params);

    return successResponse(res, 200, 'Inpatient bills fetched', result.rows);
  } catch (e) {
    console.error('Error in /inpatient-folder:', e.message);
    return errorResponse(res, 500, e.message);
  }
});

// Queue: visits currently in billing status
router.get('/queue', protect, async (req, res) => {
  try {
    const { date, date_from, date_to, all_dates } = req.query;

    // Auto-heal/sync visits fee_paid flags where the consultation or MCH billing item has actually been paid/waived
    try {
      await pool.query(`
        UPDATE visits v
        SET fee_paid = true, payment_method = COALESCE(v.payment_method, bi.payment_method, 'cash'), updated_at = NOW()
        FROM billing_items bi
        WHERE bi.visit_id::text = v.id::text
          AND bi.item_type IN ('consultation', 'mch')
          AND bi.status IN ('paid', 'insurance', 'nhif', 'sha', 'corporate', 'waived')
          AND v.fee_paid = false
          AND (v.pharmacy_id::text = $1::text OR v.pharmacy_id IS NULL)
      `, [req.pharmacy_id]);
    } catch (syncErr) {
      console.error("Error auto-syncing visits fee_paid state in billing queue:", syncErr.message);
    }

    let whereConditions = [
      `($1::text IS NULL OR v.pharmacy_id::text = $1::text)`,
      `v.status NOT IN ('discharged', 'cancelled')`,
      `(
        EXISTS (
          SELECT 1 FROM billing_items bi2 
          WHERE bi2.visit_id::text = v.id::text 
            AND (bi2.status = 'pending' OR (bi2.status = 'partial' AND bi2.total_price > COALESCE(bi2.paid_amount, 0)))
        )
        OR (
          NOT EXISTS (SELECT 1 FROM billing_items bi2 WHERE bi2.visit_id::text = v.id::text)
          AND COALESCE(v.fee_paid, false) = false
        )
      )`
    ];
    const params = [req.pharmacy_id];

    // Filter strictly by date unless all_dates is explicitly requested
    if (all_dates !== 'true' && all_dates !== true) {
      const dFrom = date_from || date || new Date().toISOString().split('T')[0];
      const dTo = date_to || date || dFrom;
      params.push(dFrom);
      whereConditions.push(`DATE(v.created_at) >= $${params.length}`);
      params.push(dTo);
      whereConditions.push(`DATE(v.created_at) <= $${params.length}`);
    }

    const whereClause = `WHERE ` + whereConditions.join(' AND ');

    const result = await pool.query(`
      SELECT v.*, p.full_name as patient_name, p.patient_number, p.phone, p.gender, p.date_of_birth,
        w.name as ward_name, b.bed_number,
        (EXISTS(SELECT 1 FROM inpatient_admissions ia WHERE ia.visit_id::text = v.id::text AND ia.status = 'admitted')
         OR v.status = 'inpatient' OR LOWER(COALESCE(v.visit_type, '')) = 'inpatient' OR (b.id IS NOT NULL AND b.status = 'occupied')) AS is_inpatient,
        COALESCE(SUM(
          CASE 
            WHEN bi.status = 'pending' THEN bi.total_price
            WHEN bi.status = 'partial' THEN GREATEST(0, bi.total_price - COALESCE(bi.paid_amount, 0))
            ELSE 0
          END
        ), 0) AS pending_amount,
        COALESCE(SUM(bi.total_price), 0) AS total_amount,
        COALESCE(SUM(
          CASE 
            WHEN bi.status IN ('paid', 'insurance', 'sha', 'nhif', 'corporate', 'settled', 'cleared') THEN COALESCE(bi.paid_amount, bi.total_price)
            WHEN bi.status = 'partial' THEN COALESCE(bi.paid_amount, 0)
            ELSE 0
          END
        ), 0) AS paid_amount
      FROM visits v
      JOIN patients p ON v.patient_id::text = p.id::text
      LEFT JOIN billing_items bi ON bi.visit_id::text = v.id::text
      LEFT JOIN beds b ON (b.current_visit_id::text = v.id::text AND b.status = 'occupied')
      LEFT JOIN wards w ON b.ward_id::text = w.id::text
      ${whereClause}
      GROUP BY v.id, p.full_name, p.patient_number, p.phone, p.gender, p.date_of_birth, w.name, b.bed_number, b.id
      ORDER BY v.created_at DESC
    `, params);
    return successResponse(res, 200, 'Billing queue fetched', result.rows);
  } catch (e) {
    console.error('Error in /billing/queue:', e.message);
    return errorResponse(res, 500, e.message);
  }
});

// Fees: consultation fees config (return empty array if table doesn't exist)
router.get('/fees', protect, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM consultation_fees WHERE pharmacy_id = $1 ORDER BY created_at DESC
    `, [req.pharmacy_id]);
    return successResponse(res, 200, 'Fees fetched', result.rows);
  } catch { return successResponse(res, 200, 'Fees fetched', []); }
});

// Payments history
router.get('/payments', protect, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const result = await pool.query(`
      SELECT v.*, p.full_name as patient_name, p.patient_number
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      WHERE v.pharmacy_id = $1 AND v.fee_paid = true
      ORDER BY v.updated_at DESC
      LIMIT $2
    `, [req.pharmacy_id, limit]);
    return successResponse(res, 200, 'Payments fetched', result.rows);
  } catch (e) { return errorResponse(res, 500, e.message); }
});

// Patient Payment History (for receptionist to view & print combined receipts after discharge or during active visit)
router.get('/patient-history', protect, async (req, res) => {
  try {
    const { search, status, date_from, date_to, limit = 100 } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const dFrom = date_from || (search ? null : today);
    const dTo = date_to || (search ? null : today);
    let whereClause = `WHERE ($1::text IS NULL OR v.pharmacy_id::text = $1::text)`;
    const params = [req.pharmacy_id];

    if (status) {
      if (status === 'discharged') {
        params.push('discharged');
        whereClause += ` AND v.status = $${params.length}`;
      } else if (status === 'active') {
        whereClause += ` AND v.status NOT IN ('discharged', 'cancelled')`;
      }
    }

    if (dFrom) {
      params.push(dFrom);
      whereClause += ` AND DATE(v.created_at) >= $${params.length}`;
    }

    if (dTo) {
      params.push(dTo);
      whereClause += ` AND DATE(v.created_at) <= $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (p.full_name ILIKE $${params.length} OR p.patient_number ILIKE $${params.length} OR v.visit_number ILIKE $${params.length} OR p.phone ILIKE $${params.length})`;
    }

    params.push(limit);
    const limitParamIndex = params.length;

    const query = `
      SELECT 
        v.id AS visit_id,
        v.visit_number,
        v.status AS visit_status,
        v.created_at AS visit_date,
        v.discharged_at,
        v.fee_paid,
        v.payment_method AS visit_payment_method,
        p.id AS patient_id,
        p.full_name AS patient_name,
        p.patient_number,
        p.phone,
        p.gender,
        p.date_of_birth,
        COALESCE(SUM(bi.total_price), 0) AS total_billed,
        COALESCE(SUM(
          CASE 
            WHEN bi.status IN ('paid', 'insurance', 'nhif', 'sha', 'corporate', 'settled', 'cleared') THEN COALESCE(bi.paid_amount, bi.total_price)
            WHEN bi.status = 'partial' THEN COALESCE(bi.paid_amount, 0)
            ELSE 0
          END
        ), 0) AS total_paid,
        COALESCE(SUM(bi.total_price) FILTER (WHERE bi.status = 'waived'), 0) AS total_waived,
        COALESCE(SUM(
          CASE
            WHEN bi.status = 'pending' THEN bi.total_price
            WHEN bi.status = 'partial' THEN GREATEST(0, bi.total_price - COALESCE(bi.paid_amount, 0))
            ELSE 0
          END
        ), 0) AS total_pending,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', bi.id,
            'item_type', bi.item_type,
            'item_name', bi.item_name,
            'description', bi.description,
            'quantity', bi.quantity,
            'unit_price', bi.unit_price,
            'total_price', bi.total_price,
            'paid_amount', bi.paid_amount,
            'status', bi.status,
            'payment_method', bi.payment_method,
            'paid_at', bi.paid_at,
            'created_at', bi.created_at
          ) ORDER BY bi.created_at ASC
        ) FILTER (WHERE bi.id IS NOT NULL) AS items
      FROM visits v
      JOIN patients p ON v.patient_id::text = p.id::text
      LEFT JOIN billing_items bi ON bi.visit_id::text = v.id::text
      ${whereClause}
      GROUP BY v.id, p.id
      ORDER BY v.created_at DESC
      LIMIT $${limitParamIndex}
    `;

    const result = await pool.query(query, params);
    return successResponse(res, 200, 'Patient payment history fetched', result.rows);
  } catch (e) {
    console.error('Error fetching patient payment history:', e.message);
    return errorResponse(res, 500, e.message);
  }
});


// ── Service Price List ────────────────────────────────────────────────────────

router.get('/service-prices', protect, requirePharmacy, async (req, res) => {
  try {
    const { category } = req.query;
    let q = `SELECT * FROM service_prices WHERE pharmacy_id=$1 AND is_active=true`;
    const params = [req.pharmacy_id];
    if (category) { params.push(category); q += ` AND category=$${params.length}`; }
    q += ` ORDER BY category, name`;
    const result = await pool.query(q, params);
    return successResponse(res, 200, 'Prices fetched', result.rows);
  } catch (e) { return errorResponse(res, 500, e.message); }
});

router.post('/service-prices', protect, requirePharmacy, async (req, res) => {
  try {
    const { category, name, description, price } = req.body;
    if (!name || price === undefined) return errorResponse(res, 400, 'Name and price required');
    const result = await pool.query(`
      INSERT INTO service_prices (pharmacy_id, category, name, description, price)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [req.pharmacy_id, category||'other', name, description||null, price]);
    return successResponse(res, 201, 'Price added', result.rows[0]);
  } catch (e) { return errorResponse(res, 500, e.message); }
});

router.put('/service-prices/:id', protect, requirePharmacy, async (req, res) => {
  try {
    const { category, name, description, price, is_active } = req.body;
    const result = await pool.query(`
      UPDATE service_prices SET
        category=$1, name=$2, description=$3, price=$4,
        is_active=COALESCE($5, is_active), updated_at=NOW()
      WHERE id=$6 AND pharmacy_id=$7 RETURNING *
    `, [category, name, description||null, price, is_active, req.params.id, req.pharmacy_id]);
    if (!result.rows[0]) return errorResponse(res, 404, 'Price not found');
    return successResponse(res, 200, 'Price updated', result.rows[0]);
  } catch (e) { return errorResponse(res, 500, e.message); }
});

router.delete('/service-prices/:id', protect, requirePharmacy, async (req, res) => {
  try {
    await pool.query(
      `UPDATE service_prices SET is_active=false, updated_at=NOW() WHERE id=$1 AND pharmacy_id=$2`,
      [req.params.id, req.pharmacy_id]
    );
    return successResponse(res, 200, 'Price removed');
  } catch (e) { return errorResponse(res, 500, e.message); }
});

// ── Auto-billing helper: create billing items from service price list ─────────
// Called internally when doctor sends to lab/radiology/procedure etc.
router.post('/auto-bill', protect, requirePharmacy, async (req, res) => {
  try {
    const { visit_id, patient_id, items } = req.body;
    // items: [{ name, category }] — we look up price from service_prices (or products if drug/injection)
    const created = [];
    console.log('AUTO-BILL received items:', JSON.stringify(items));
    for (const item of items) {
      let price = 0;

      if (item.category === 'injection' || item.category === 'drug' || item.category === 'prescription' || item.category === 'opd') {
        // Look up price from products table
        try {
          const isUuid = item.code && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.code);
          let prodRes;
          if (isUuid) {
            prodRes = await pool.query(
              `SELECT selling_price FROM products WHERE pharmacy_id = $1 AND id = $2 LIMIT 1`,
              [req.pharmacy_id, item.code]
            );
          } else {
            prodRes = await pool.query(
              `SELECT selling_price FROM products WHERE pharmacy_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
              [req.pharmacy_id, item.name.trim()]
            );
          }
          
          if (prodRes && prodRes.rows[0]) {
            price = parseFloat(prodRes.rows[0].selling_price || 0);
          } else {
            // Fuzzy match in products with cleaned name
            const cleanName = item.name.trim()
              .replace(/^(inj\.|inj|vial|amp|tab\.|tab|cap\.)\s+/i, '')
              .replace(/\s+(inj\.|inj|injection|vial|amp|tablet|tab|capsule|cap)$/i, '')
              .trim();
            const fuzzyRes = await pool.query(
              `SELECT selling_price FROM products WHERE pharmacy_id = $1 AND (LOWER(name) LIKE LOWER($2) OR LOWER(name) LIKE LOWER($3)) LIMIT 1`,
              [req.pharmacy_id, '%' + item.name.trim() + '%', '%' + cleanName + '%']
            );
            if (fuzzyRes && fuzzyRes.rows[0]) {
              price = parseFloat(fuzzyRes.rows[0].selling_price || 0);
            }
          }

          // Fallback to service_prices if not found in products
          if (price === 0) {
            const spRes = await pool.query(
              `SELECT price FROM service_prices WHERE pharmacy_id = $1 AND is_active = true AND (LOWER(name) = LOWER($2) OR LOWER(name) LIKE LOWER($3)) LIMIT 1`,
              [req.pharmacy_id, item.name.trim(), '%' + item.name.trim() + '%']
            );
            if (spRes && spRes.rows[0]) {
              price = parseFloat(spRes.rows[0].price || 0);
            } else if (item.category === 'injection' || item.name.toLowerCase().includes('injection') || item.name.toLowerCase().includes('inj')) {
              // fallback to generic Injection Administration fee
              const spRes2 = await pool.query(
                `SELECT price FROM service_prices WHERE pharmacy_id = $1 AND is_active = true AND LOWER(name) LIKE '%injection%' LIMIT 1`,
                [req.pharmacy_id]
              );
              if (spRes2 && spRes2.rows[0]) {
                price = parseFloat(spRes2.rows[0].price || 0);
              }
            }
          }
        } catch (prodErr) {
          console.error('Error fetching product price for auto-bill:', prodErr.message);
        }
      } else {
        // Query service_prices table for other categories (lab, radiology, procedure, etc.)
        const priceRow = await pool.query(`
          SELECT * FROM service_prices
          WHERE pharmacy_id=$1 AND is_active=true
            AND (
              (service_code IS NOT NULL AND service_code = $2)
              OR LOWER(name) = LOWER($3)
            )
          ORDER BY (service_code = $2) DESC
          LIMIT 1
        `, [req.pharmacy_id, item.code || '', item.name]);
        price = parseFloat(priceRow.rows[0]?.price || 0);
      }

      // check if billing item already exists for this visit+item to avoid duplicates
      // check by service_code first, then by exact name (case-insensitive and trimmed)
      let exists;
      if (item.category === 'injection' || item.category === 'drug' || item.category === 'prescription' || item.category === 'opd') {
        const firstWord = (item.name || '').trim().toLowerCase().split(' ')[0];
        exists = await pool.query(`
          SELECT id, unit_price, quantity FROM billing_items
          WHERE visit_id=$1 AND status != 'cancelled'
            AND (
              (service_code IS NOT NULL AND service_code <> '' AND LOWER(TRIM(service_code)) = LOWER(TRIM($2)))
              OR LOWER(TRIM(item_name)) = LOWER(TRIM($3))
              OR LOWER(TRIM(item_name)) LIKE LOWER(TRIM($4))
              OR LOWER(TRIM($3)) LIKE '%' || LOWER(TRIM(item_name)) || '%'
              OR (LENGTH($5) >= 3 AND LOWER(TRIM(item_name)) LIKE $5 || '%')
            )
          LIMIT 1
        `, [visit_id, (item.code || '').trim(), (item.name || '').trim(), '%' + (item.name || '').trim() + '%', firstWord]);
      } else {
        exists = await pool.query(`
          SELECT id, unit_price FROM billing_items
          WHERE visit_id=$1 AND status != 'cancelled'
            AND (
              (service_code IS NOT NULL AND service_code <> '' AND LOWER(TRIM(service_code)) = LOWER(TRIM($2)))
              OR LOWER(TRIM(item_name)) = LOWER(TRIM($3))
            )
          LIMIT 1
        `, [visit_id, (item.code || '').trim(), (item.name || '').trim()]);
      }

      if (exists.rows[0]) {
        const existingItem = exists.rows[0];
        if ((item.category === 'injection' || item.category === 'drug' || item.category === 'prescription' || item.category === 'opd') && parseFloat(existingItem.unit_price) === 0 && price > 0) {
          await pool.query(`
            UPDATE billing_items SET unit_price = $1, total_price = $1 * quantity, updated_at = NOW()
            WHERE id = $2
          `, [price, existingItem.id]);
        }
        continue;
      }

      const totalPrice = price * 1;
      const result = await pool.query(`
        INSERT INTO billing_items
          (facility_id, visit_id, patient_id, item_name, item_type, unit_price, quantity, status)
        VALUES ($1,$2,$3,$4,$5,$6,1,'pending') RETURNING *
      `, [req.pharmacy_id, visit_id, patient_id, item.name, item.category, price]);
      // store service_code reference for future dedupe and SHA claims
      if (item.code) {
        await pool.query(
          "UPDATE billing_items SET service_code=$1 WHERE id=$2",
          [item.code, result.rows[0].id]
        ).catch(()=>{});
      }
      created.push(result.rows[0]);
    }
    return successResponse(res, 201, 'Billing items created', created);
  } catch (e) { console.error('AUTO-BILL ERROR:', e.message, e.stack); return errorResponse(res, 500, e.message); }
});

// Daily summary for receptionist
router.get('/daily-summary', protect, getDailySummary);

router.get('/visit/:visit_id/paid', protect, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) AS total_items,
        COUNT(*) FILTER (WHERE status != 'pending') AS paid_items,
        COALESCE(SUM(total_price),0) AS total_bill,
        COALESCE(SUM(total_price) FILTER (WHERE status != 'pending'),0) AS total_paid,
        COALESCE(SUM(total_price) FILTER (WHERE status = 'pending'),0) AS balance
      FROM billing_items
      WHERE visit_id=$1 AND facility_id=$2
    `, [req.params.visit_id, req.pharmacy_id]);
    const row = result.rows[0];
    const has_bill = parseInt(row.total_items) > 0;
    const paid = parseFloat(row.balance) === 0;
    return res.json({ success:true, data: { has_bill, paid, total_bill: row.total_bill, total_paid: row.total_paid, balance: row.balance, total_items: row.total_items, paid_items: row.paid_items } });
  } catch (e) { return res.status(500).json({ success:false, message:e.message }); }
});

// Billing summary for receptionist dashboard
router.get('/summary', protect, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const pid = req.pharmacy_id;
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='pending')   AS pending_count,
        COUNT(*) FILTER (WHERE status IN ('paid', 'insurance', 'nhif', 'sha')) AS paid_count,
        COALESCE(SUM(total_price) FILTER (WHERE status='pending'),0) AS pending_total,
        COALESCE(SUM(total_price) FILTER (WHERE status IN ('paid', 'insurance', 'nhif', 'sha')),0) AS collected_total,
        COALESCE(SUM(total_price),0)                                AS total_billed,
        COALESCE(SUM(total_price) FILTER (WHERE status IN ('paid', 'insurance', 'nhif', 'sha')),0) AS total_collected,
        COALESCE(SUM(total_price) FILTER (WHERE status='pending'),0) AS total_outstanding,
        CASE WHEN COALESCE(SUM(total_price),0) > 0
          THEN ROUND((COALESCE(SUM(total_price) FILTER (WHERE status IN ('paid', 'insurance', 'nhif', 'sha')),0) / COALESCE(SUM(total_price),0)) * 100, 1)
          ELSE 0 END AS collection_rate
      FROM billing_items
      WHERE facility_id=$1 AND DATE(created_at)=$2
    `, [pid, today]);
    return successResponse(res, 200, 'Billing summary', result.rows[0] || {});
  } catch (e) { return errorResponse(res, 500, e.message); }
});

// Add an item to a visit bill (manual billing)
router.post('/visit/:visit_id/items', protect, async (req, res) => {
  try {
    const { item_type, description, unit_price, quantity, reference_id, product_id } = req.body;
    if (!description || unit_price === undefined || unit_price === null) {
      const { errorResponse } = require('../utils/response');
      return errorResponse(res, 400, 'description and unit_price required');
    }
    const { pool } = require('../config/db');
    const { successResponse, errorResponse } = require('../utils/response');

    // Get patient_id from the visit
    const visit = await pool.query('SELECT patient_id FROM visits WHERE id=$1 AND pharmacy_id=$2', [req.params.visit_id, req.pharmacy_id]);
    if (!visit.rows[0]) return errorResponse(res, 404, 'Visit not found');
    const patientId = visit.rows[0].patient_id;

    const qty = parseInt(quantity || 1);
    let up = parseFloat(unit_price);

    // If drug price is 0, try to resolve the correct selling price from products table
    if (item_type === 'drug' && up === 0) {
      const prodId = reference_id || product_id || null;
      try {
        let prodRes;
        if (prodId) {
          const isUuid = typeof prodId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(prodId);
          if (isUuid) {
            prodRes = await pool.query('SELECT selling_price FROM products WHERE id = $1 AND (pharmacy_id = $2 OR pharmacy_id IS NULL)', [prodId, req.pharmacy_id]);
          } else {
            prodRes = await pool.query('SELECT selling_price FROM products WHERE (id::text = $1 OR barcode = $1) AND (pharmacy_id = $2 OR pharmacy_id IS NULL)', [String(prodId), req.pharmacy_id]);
          }
        } else {
          // Extract drug name if description contains dosage/frequency (e.g. "Paracetamol 500mg tds")
          const drugNameGuess = description.split(' ')[0];
          prodRes = await pool.query(
            `SELECT selling_price FROM products WHERE pharmacy_id = $1 AND (LOWER(name) = LOWER($2) OR LOWER(name) LIKE LOWER($3)) LIMIT 1`,
            [req.pharmacy_id, description.trim(), drugNameGuess.trim() + '%']
          );
        }
        if (prodRes && prodRes.rows[0]) {
          up = parseFloat(prodRes.rows[0].selling_price || 0);
        }
      } catch (err) {
        console.error('Error auto-resolving drug price in billing routes:', err.message);
      }
    }

    // Smart duplicate prevention for drug/injection/prescription/opd categories
    const itemTypeLower = (item_type || 'other').toLowerCase();
    if (itemTypeLower === 'drug' || itemTypeLower === 'opd' || itemTypeLower === 'injection' || itemTypeLower === 'prescription') {
      const cleanDesc = description.trim().toLowerCase();
      const firstWord = cleanDesc.split(' ')[0];
      try {
        const exists = await pool.query(`
          SELECT id, item_name, unit_price, quantity FROM billing_items
          WHERE visit_id = $1 AND status != 'cancelled'
            AND item_type IN ('drug', 'opd', 'injection', 'prescription')
            AND (
              LOWER(TRIM(item_name)) = LOWER(TRIM($2))
              OR LOWER(TRIM(item_name)) LIKE LOWER(TRIM($3))
              OR LOWER(TRIM($2)) LIKE '%' || LOWER(TRIM(item_name)) || '%'
              OR (LENGTH($4) >= 3 AND LOWER(TRIM(item_name)) LIKE $4 || '%')
            )
          LIMIT 1
        `, [req.params.visit_id, description.trim(), '%' + description.trim() + '%', firstWord]);

        if (exists.rows[0]) {
          const existingItem = exists.rows[0];
          if (parseFloat(existingItem.unit_price) === 0 && up > 0) {
            const updated = await pool.query(`
              UPDATE billing_items SET unit_price = $1, total_price = $1 * quantity, updated_at = NOW()
              WHERE id = $2 RETURNING *
            `, [up, existingItem.id]);
            return successResponse(res, 200, 'Existing billing item price updated', updated.rows[0]);
          }
          return successResponse(res, 200, 'Item already billed', existingItem);
        }
      } catch (dupErr) {
        console.error('Error checking duplicates in billing items:', dupErr.message);
      }
    }

    const totalPrice = up * qty;
    const result = await pool.query(`
      INSERT INTO billing_items (facility_id, visit_id, patient_id, item_name, item_type, unit_price, quantity, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      RETURNING *
    `, [req.pharmacy_id, req.params.visit_id, patientId, description, item_type||'other', up, qty]);
    return successResponse(res, 201, 'Item added', result.rows[0]);
  } catch (e) { return errorResponse(res, 500, e.message); }
});

module.exports = router;

