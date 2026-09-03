const { pool } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');
const { logAudit } = require('../utils/audit');
const EncounterModel = require('../models/encounter.model');

// ── helpers ──────────────────────────────────────────────────────────────────
const CONSULT_SELECT = `
  SELECT c.*, e.encounter_number, e.status as encounter_status,
    json_agg(DISTINCT jsonb_build_object(
      'id',p.id,'drug_name',p.drug_name,'dosage',p.dosage,'frequency',p.frequency,
      'duration',p.duration,'route',p.route,'instructions',p.instructions,
      'quantity',p.quantity,'status',p.status,'product_id',p.product_id,'price',p.price,
      'selling_price',p.price
    )) FILTER (WHERE p.id IS NOT NULL) AS prescriptions,
    json_agg(DISTINCT jsonb_build_object(
      'id',l.id,'test_name',l.test_name,'test_code',l.test_code,'urgency',l.urgency,
      'notes',l.notes,'status',l.status,'result',l.result,'result_value',l.result_value,
      'result_unit',l.result_unit,'reference_range',l.reference_range,
      'result_flag',l.result_flag,'technician_notes',l.technician_notes,
      'resulted_at',l.resulted_at,'result_file_url',l.result_file_url
    )) FILTER (WHERE l.id IS NOT NULL) AS lab_requests,
    json_agg(DISTINCT jsonb_build_object(
      'id',pr.id,'procedure_name',pr.procedure_name,'procedure_code',pr.procedure_code,
      'notes',pr.notes,'outcome',pr.outcome
    )) FILTER (WHERE pr.id IS NOT NULL) AS procedures
  FROM consultations c
  LEFT JOIN encounters e ON c.encounter_id = e.id
  LEFT JOIN prescriptions p ON (c.id = p.consultation_id OR (p.consultation_id IS NULL AND c.visit_id = p.visit_id))
  LEFT JOIN lab_requests l ON (c.id = l.consultation_id OR (l.consultation_id IS NULL AND c.visit_id = l.visit_id))
  LEFT JOIN procedures pr ON (c.id = pr.consultation_id OR (pr.consultation_id IS NULL AND c.visit_id = pr.visit_id))
`;

// ── GET by visit ──────────────────────────────────────────────────────────────
const getByVisit = async (req, res) => {
  try {
    const result = await pool.query(
      CONSULT_SELECT + ` WHERE c.visit_id=$1 AND c.pharmacy_id=$2 GROUP BY c.id, e.id, e.encounter_number, e.status`,
      [req.params.visit_id, req.pharmacy_id]
    );
    if (!result.rows[0]) return res.status(404).json({ success:false, message:'No consultation found' });
    return successResponse(res, 200, 'Consultation fetched', result.rows[0]);
  } catch (e) {
    logger.error('Get consultation error:', e.message);
    return errorResponse(res, 500, 'Failed to fetch consultation');
  }
};

// ── GET by id ─────────────────────────────────────────────────────────────────
const getById = async (req, res) => {
  try {
    const result = await pool.query(
      CONSULT_SELECT + ` WHERE c.id=$1 AND c.pharmacy_id=$2 GROUP BY c.id, e.id, e.encounter_number, e.status`,
      [req.params.id, req.pharmacy_id]
    );
    if (!result.rows[0]) return res.status(404).json({ success:false, message:'Not found' });
    return successResponse(res, 200, 'Consultation fetched', result.rows[0]);
  } catch (e) {
    logger.error('Get consultation by id error:', e.message);
    return errorResponse(res, 500, 'Failed to fetch consultation');
  }
};

// ── CREATE ────────────────────────────────────────────────────────────────────
const create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
      visit_id, patient_id,
      presenting_complaint, history_of_illness, examination_findings,
      review_of_systems, impression,
      diagnosis, icd_code, management_plan,
      follow_up_date, follow_up_notes,
      admit_patient, referral,
      admission_ward, admission_reason, admission_notes,
      prescriptions=[], lab_requests=[], procedures=[],
      send_to_pharmacy=false
    } = req.body;

    const finalDiagnosis = (diagnosis && String(diagnosis).trim()) ? String(diagnosis).trim() : 'Under Investigation / Pending';

    const encounter = await EncounterModel.getOrCreateActiveEncounter({
      visit_id,
      patient_id,
      pharmacy_id: req.pharmacy_id,
      doctor_id: req.user?.id,
      current_step: send_to_pharmacy ? 'pharmacy' : 'consultation'
    }, client);

    const cr = await client.query(`
      INSERT INTO consultations (
        pharmacy_id, visit_id, patient_id, doctor_id, encounter_id,
        presenting_complaint, history_of_illness, examination_findings,
        review_of_systems, impression,
        diagnosis, icd_code, management_plan,
        follow_up_date, follow_up_notes,
        admit_patient, referral,
        admission_ward, admission_reason, admission_notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *
    `, [
      req.pharmacy_id, visit_id, patient_id, req.user.id, encounter.id,
      presenting_complaint||null, history_of_illness||null, examination_findings||null,
      review_of_systems||null, impression||null,
      finalDiagnosis, icd_code||null, management_plan||null,
      follow_up_date||null, follow_up_notes||null,
      admit_patient||false, referral||null,
      admission_ward||null, admission_reason||null, admission_notes||null
    ]);

    const c = cr.rows[0];
    await _savePrescriptions(client, prescriptions, c, req);
    await _saveLabRequests(client, lab_requests, c, req);
    await _saveProcedures(client, procedures, c, req);

    if (send_to_pharmacy) {
      await client.query(`
        UPDATE visits SET status = 'pharmacy', updated_at = NOW()
        WHERE id = $1 AND pharmacy_id = $2
      `, [visit_id, req.pharmacy_id]);
      await EncounterModel.completeEncounter(encounter.id, req.user?.id, 'pharmacy', { visit_id }, client);
      const io = req.app.get('io');
      if (io) io.emit(`prescription_${req.pharmacy_id}`, { visit_id, patient_id });
      if (io) io.emit(`visit_updated_${req.pharmacy_id}`, { visit_id, status: 'pharmacy' });
    } else {
      await EncounterModel.pauseEncounter(encounter.id, req.user?.id, { visit_id }, client);
    }

    // Auto-bill consultation fee if set on the visit and doesn't already exist
    if (c.consultation_fee && c.consultation_fee > 0) {
      const existingFee = await client.query(`
        SELECT id FROM billing_items 
        WHERE visit_id = $1 AND (item_type = 'consultation' OR item_name = 'Consultation Fee')
        LIMIT 1
      `, [c.visit_id]);
      if (existingFee.rows.length === 0) {
        await client.query(`
          INSERT INTO billing_items (facility_id, visit_id, patient_id, item_name, item_type, unit_price, quantity, status)
          VALUES ($1,$2,$3,'Consultation Fee','consultation',$4,1,'pending')
        `, [req.pharmacy_id, c.visit_id, c.patient_id, c.consultation_fee]);
      }
    }
    await client.query('COMMIT');
    return successResponse(res, 201, 'Consultation saved', c);
  } catch (e) {
    await client.query('ROLLBACK');
    logger.error('Create consultation error:', e.message);
    return errorResponse(res, 500, e.message);
  } finally { client.release(); }
};

// ── UPDATE ────────────────────────────────────────────────────────────────────
const update = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
      presenting_complaint, history_of_illness, examination_findings,
      review_of_systems, impression,
      diagnosis, icd_code, management_plan,
      follow_up_date, follow_up_notes,
      admit_patient, referral,
      admission_ward, admission_reason, admission_notes,
      prescriptions=[], lab_requests=[], procedures=[],
      send_to_pharmacy=false
    } = req.body;

    // Snapshot the row before we overwrite it, for the audit trail
    const before = await client.query('SELECT * FROM consultations WHERE id=$1 AND pharmacy_id=$2', [req.params.id, req.pharmacy_id]);
    if (!before.rows[0]) return errorResponse(res, 404, 'Consultation not found');

    const encounter = await EncounterModel.getOrCreateActiveEncounter({
      visit_id: before.rows[0].visit_id,
      patient_id: before.rows[0].patient_id,
      pharmacy_id: req.pharmacy_id,
      doctor_id: req.user?.id,
      current_step: send_to_pharmacy ? 'pharmacy' : 'consultation'
    }, client);

    const finalDiagnosis = (diagnosis && String(diagnosis).trim()) ? String(diagnosis).trim() : (before.rows[0].diagnosis || 'Under Investigation / Pending');

    const result = await client.query(`
      UPDATE consultations SET
        encounter_id=$1,
        presenting_complaint=$2, history_of_illness=$3, examination_findings=$4,
        review_of_systems=$5, impression=$6,
        diagnosis=$7, icd_code=$8, management_plan=$9,
        follow_up_date=$10, follow_up_notes=$11,
        admit_patient=$12, referral=$13,
        admission_ward=$14, admission_reason=$15, admission_notes=$16,
        updated_at=NOW()
      WHERE id=$17 AND pharmacy_id=$18 RETURNING *
    `, [
      encounter.id,
      presenting_complaint||null, history_of_illness||null, examination_findings||null,
      review_of_systems||null, impression||null,
      finalDiagnosis, icd_code||null, management_plan||null,
      follow_up_date||null, follow_up_notes||null,
      admit_patient||false, referral||null,
      admission_ward||null, admission_reason||null, admission_notes||null,
      req.params.id, req.pharmacy_id
    ]);

    if (!result.rows[0]) return errorResponse(res, 404, 'Consultation not found');
    const c = result.rows[0];

    await logAudit(client, {
      pharmacy_id: req.pharmacy_id, table_name: 'consultations', record_id: c.id,
      action: 'update', old_data: before.rows[0], new_data: c,
      changed_by: req.user.id, visit_id: c.visit_id, patient_id: c.patient_id,
    });

    await _savePrescriptions(client, prescriptions, c, req);
    await _saveLabRequests(client, lab_requests, c, req);
    await _saveProcedures(client, procedures, c, req);

    if (send_to_pharmacy) {
      await client.query(`
        UPDATE visits SET status = 'pharmacy', updated_at = NOW()
        WHERE id = $1 AND pharmacy_id = $2
      `, [c.visit_id, req.pharmacy_id]);
      await EncounterModel.completeEncounter(encounter.id, req.user?.id, 'pharmacy', { visit_id: c.visit_id }, client);
      const io = req.app.get('io');
      if (io) io.emit(`prescription_${req.pharmacy_id}`, { visit_id: c.visit_id });
      if (io) io.emit(`visit_updated_${req.pharmacy_id}`, { visit_id: c.visit_id, status: 'pharmacy' });
    } else {
      await EncounterModel.pauseEncounter(encounter.id, req.user?.id, { visit_id: c.visit_id }, client);
    }

    // Auto-bill consultation fee if set on the visit and doesn't already exist
    if (c.consultation_fee && c.consultation_fee > 0) {
      const existingFee = await client.query(`
        SELECT id FROM billing_items 
        WHERE visit_id = $1 AND (item_type = 'consultation' OR item_name = 'Consultation Fee')
        LIMIT 1
      `, [c.visit_id]);
      if (existingFee.rows.length === 0) {
        await client.query(`
          INSERT INTO billing_items (facility_id, visit_id, patient_id, item_name, item_type, unit_price, quantity, status)
          VALUES ($1,$2,$3,'Consultation Fee','consultation',$4,1,'pending')
        `, [req.pharmacy_id, c.visit_id, c.patient_id, c.consultation_fee]);
      }
    }
    await client.query('COMMIT');
    return successResponse(res, 200, 'Consultation updated', c);
  } catch (e) {
    await client.query('ROLLBACK');
    logger.error('Update consultation error:', e.message);
    return errorResponse(res, 500, 'Failed to update consultation');
  } finally { client.release(); }
};

// ── PHARMACY QUEUE ────────────────────────────────────────────────────────────
const getPharmacyQueue = async (req, res) => {
  try {
    const { search, date_from, date_to, all_dates, include_inpatient } = req.query;
    const pharmacyId = req.pharmacy_id || req.user?.pharmacy_id || null;
    const params = [pharmacyId];
    let extraClauses = '';

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      extraClauses += ` AND (pat.full_name ILIKE $${params.length} OR pat.patient_number ILIKE $${params.length})`;
    }

    if (date_from && date_to) {
      params.push(date_from);
      params.push(date_to);
      extraClauses += ` AND (
        (v.created_at::date >= $${params.length - 1}::date AND v.created_at::date <= $${params.length}::date)
        OR (vp.latest_prescription_at::date >= $${params.length - 1}::date AND vp.latest_prescription_at::date <= $${params.length}::date)
        OR ((v.created_at AT TIME ZONE 'UTC')::date >= $${params.length - 1}::date AND (v.created_at AT TIME ZONE 'UTC')::date <= $${params.length}::date)
        OR ((vp.latest_prescription_at AT TIME ZONE 'UTC')::date >= $${params.length - 1}::date AND (vp.latest_prescription_at AT TIME ZONE 'UTC')::date <= $${params.length}::date)
      )`;
    } else if (date_from) {
      params.push(date_from);
      extraClauses += ` AND (
        v.created_at::date = $${params.length}::date 
        OR vp.latest_prescription_at::date = $${params.length}::date
        OR (v.created_at AT TIME ZONE 'UTC')::date = $${params.length}::date
        OR (vp.latest_prescription_at AT TIME ZONE 'UTC')::date = $${params.length}::date
      )`;
    } else if (all_dates !== 'true') {
      extraClauses += ` AND (v.created_at::date = CURRENT_DATE OR vp.latest_prescription_at::date = CURRENT_DATE OR (v.created_at AT TIME ZONE 'UTC')::date = CURRENT_DATE OR 1=1)`;
    }

    if (include_inpatient !== 'true') {
      extraClauses += ` AND (
        v.status != 'inpatient' 
        AND LOWER(COALESCE(v.visit_type, '')) != 'inpatient'
        AND NOT EXISTS (SELECT 1 FROM inpatient_admissions ia_ex WHERE ia_ex.visit_id::text = v.id::text AND ia_ex.status = 'admitted')
        AND NOT EXISTS (SELECT 1 FROM beds b_ex WHERE b_ex.current_visit_id::text = v.id::text AND b_ex.status = 'occupied')
      )`;
    }

    const query = `
      WITH visit_prescriptions AS (
        SELECT 
          pr.visit_id::text AS visit_id,
          MAX(pr.created_at) AS latest_prescription_at,
          json_agg(jsonb_build_object(
            'id', pr.id,
            'drug_name', pr.drug_name,
            'dosage', COALESCE(pr.dosage, ''),
            'frequency', COALESCE(pr.frequency, ''),
            'duration', COALESCE(pr.duration, ''),
            'route', COALESCE(pr.route, 'oral'),
            'quantity', COALESCE(pr.quantity, 1),
            'instructions', COALESCE(pr.instructions, ''),
            'status', COALESCE(pr.status, 'pending'),
            'product_id', pr.product_id,
            'price', COALESCE(pr.price, 0),
            'selling_price', COALESCE(pr.price, 0)
          )) FILTER (WHERE pr.id IS NOT NULL) AS prescriptions
        FROM prescriptions pr
        WHERE ($1::text IS NULL OR pr.pharmacy_id::text = $1::text OR pr.pharmacy_id IS NULL)
          AND (LOWER(COALESCE(pr.status, 'pending')) = 'pending' OR pr.status IS NULL)
        GROUP BY pr.visit_id::text
      )
      SELECT 
        v.id,
        v.visit_number,
        v.patient_id,
        v.pharmacy_id,
        v.status,
        v.priority,
        v.visit_type,
        v.payment_mode,
        v.created_at,
        v.updated_at,
        pat.full_name AS patient_name,
        pat.patient_number,
        COALESCE(pat.allergies, '') AS allergies,
        pat.blood_group,
        pat.gender,
        pat.date_of_birth,
        c.diagnosis,
        c.management_plan,
        c.id AS consultation_id,
        u.full_name AS doctor_name,
        w.name AS ward_name,
        b.bed_number,
        (
          EXISTS(SELECT 1 FROM inpatient_admissions ia WHERE ia.visit_id::text = v.id::text AND ia.status = 'admitted')
          OR EXISTS(SELECT 1 FROM beds b2 WHERE b2.current_visit_id::text = v.id::text AND b2.status = 'occupied')
          OR v.status = 'inpatient' 
          OR LOWER(COALESCE(v.visit_type, '')) = 'inpatient'
        ) AS is_inpatient,
        (
          SELECT COALESCE(SUM(bi.total_price) FILTER (WHERE bi.status = 'pending'), 0) = 0 
          FROM billing_items bi 
          WHERE bi.visit_id::text = v.id::text
        ) AS paid,
        vp.prescriptions
      FROM visit_prescriptions vp
      JOIN visits v ON v.id::text = vp.visit_id
      LEFT JOIN patients pat ON pat.id::text = v.patient_id::text
      LEFT JOIN LATERAL (
        SELECT c2.id, c2.diagnosis, c2.management_plan, c2.doctor_id, c2.created_at 
        FROM consultations c2 
        WHERE c2.visit_id::text = v.id::text AND ($1::text IS NULL OR c2.pharmacy_id::text = $1::text OR c2.pharmacy_id IS NULL) 
        ORDER BY c2.created_at DESC LIMIT 1
      ) c ON true
      LEFT JOIN users u ON u.id::text = c.doctor_id::text
      LEFT JOIN LATERAL (
        SELECT ia2.bed_id 
        FROM inpatient_admissions ia2 
        WHERE ia2.visit_id::text = v.id::text AND ia2.status = 'admitted' 
        ORDER BY ia2.created_at DESC LIMIT 1
      ) ia ON true
      LEFT JOIN LATERAL (
        SELECT b2.bed_number, b2.ward_id 
        FROM beds b2 
        WHERE (b2.current_visit_id::text = v.id::text AND b2.status = 'occupied') 
           OR (ia.bed_id::text = b2.id::text) 
        LIMIT 1
      ) b ON true
      LEFT JOIN wards w ON w.id::text = b.ward_id::text
      WHERE ($1::text IS NULL OR v.pharmacy_id::text = $1::text OR v.pharmacy_id IS NULL)
        ${extraClauses}
      ORDER BY 
        CASE v.priority WHEN 'emergency' THEN 1 WHEN 'urgent' THEN 2 ELSE 3 END,
        COALESCE(vp.latest_prescription_at, c.created_at, v.created_at) DESC
      LIMIT 200
    `;

    try {
      const result = await pool.query(query, params);
      return successResponse(res, 200, 'Pharmacy queue fetched', result.rows || []);
    } catch (dbErr) {
      logger.warn('Primary pharmacy queue query failed, falling back to simple queue: ' + dbErr.message);
      // Fallback query that guarantees returning pending prescriptions even if advanced joins fail
      const fallbackResult = await pool.query(`
        SELECT 
          v.id,
          v.visit_number,
          v.patient_id,
          v.pharmacy_id,
          v.status,
          v.priority,
          v.visit_type,
          v.payment_mode,
          v.created_at,
          v.updated_at,
          pat.full_name AS patient_name,
          pat.patient_number,
          COALESCE(pat.allergies, '') AS allergies,
          pat.blood_group,
          pat.gender,
          pat.date_of_birth,
          json_agg(jsonb_build_object(
            'id', pr.id,
            'drug_name', pr.drug_name,
            'dosage', COALESCE(pr.dosage, ''),
            'frequency', COALESCE(pr.frequency, ''),
            'duration', COALESCE(pr.duration, ''),
            'route', COALESCE(pr.route, 'oral'),
            'quantity', COALESCE(pr.quantity, 1),
            'instructions', COALESCE(pr.instructions, ''),
            'status', COALESCE(pr.status, 'pending'),
            'product_id', pr.product_id,
            'price', COALESCE(pr.price, 0),
            'selling_price', COALESCE(pr.price, 0)
          )) FILTER (WHERE pr.id IS NOT NULL) AS prescriptions
        FROM visits v
        JOIN prescriptions pr ON pr.visit_id::text = v.id::text
        LEFT JOIN patients pat ON pat.id::text = v.patient_id::text
        WHERE (LOWER(COALESCE(pr.status, 'pending')) = 'pending' OR pr.status IS NULL)
        GROUP BY v.id, pat.id
        ORDER BY v.created_at DESC
        LIMIT 200
      `);
      return successResponse(res, 200, 'Pharmacy queue fetched (fallback)', fallbackResult.rows || []);
    }
  } catch (e) {
    logger.error('Get pharmacy queue fatal error:', e.message);
    return successResponse(res, 200, 'Pharmacy queue empty on error', []);
  }
};

// ── LAB RESULTS for a visit (doctor reads) ────────────────────────────────────
const getLabResults = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, u.full_name AS technician_name
      FROM lab_requests l
      LEFT JOIN users u ON l.resulted_by::text = u.id::text
      WHERE l.visit_id::text=$1::text AND (l.pharmacy_id::text=$2::text OR l.pharmacy_id IS NULL)
      ORDER BY l.created_at DESC
    `, [req.params.visit_id, req.pharmacy_id]);
    return successResponse(res, 200, 'Lab results fetched', result.rows);
  } catch (e) {
    logger.error('Get lab results error:', e.message);
    return errorResponse(res, 500, 'Failed to fetch lab results');
  }
};

// ── PRIVATE HELPERS ───────────────────────────────────────────────────────────
async function _savePrescriptions(client, list, c, req) {
  // Get existing prescriptions for this consultation to perform smart synchronization
  let existingRows = [];
  try {
    const existingRes = await client.query(
      `SELECT * FROM prescriptions WHERE consultation_id = $1`,
      [c.id]
    );
    existingRows = existingRes.rows;
  } catch (err) {
    logger.error('Error fetching existing prescriptions: ' + err.message);
  }

  const incomingIds = list.map(item => item.id).filter(Boolean);

  // 1. Delete prescriptions that are NOT in the incoming list ONLY if incoming list manages existing IDs
  if (incomingIds.length > 0) {
    const rowsToDelete = existingRows.filter(row => !incomingIds.includes(row.id));
    for (const row of rowsToDelete) {
      if (row.status === 'pending') {
        try {
          await logAudit(client, {
            pharmacy_id: req.pharmacy_id, table_name: 'prescriptions', record_id: row.id,
            action: 'delete', old_data: row, changed_by: req.user.id,
            visit_id: c.visit_id, patient_id: c.patient_id,
          });
          await client.query(`DELETE FROM prescriptions WHERE id = $1`, [row.id]);
          
          // Also delete corresponding pending billing item to keep billing in sync
          await client.query(
            `DELETE FROM billing_items WHERE visit_id = $1 AND item_type = 'drug' AND LOWER(TRIM(item_name)) = LOWER(TRIM($2)) AND status = 'pending'`,
            [c.visit_id, row.drug_name.trim()]
          );
          
          // Also delete corresponding pending injection room order
          await client.query(
            `DELETE FROM injection_room_orders WHERE visit_id = $1 AND LOWER(TRIM(drug_name)) = LOWER(TRIM($2)) AND LOWER(status) = 'pending'`,
            [c.visit_id, row.drug_name.trim()]
          );
        } catch (err) {
          logger.error('Error deleting prescription row ' + row.id + ': ' + err.message);
        }
      }
    }
  }

  // 2. Insert or update incoming prescriptions
  for (const d of list) {
    if (!d.drug_name?.trim()) continue;
    let productId = d.product_id ? String(d.product_id) : null;
    let price = parseFloat(d.selling_price || d.price || 0);

    const isUuid = productId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId);

    // Try to resolve product_id and price from products table if missing or 0
    if (!productId || price === 0) {
      try {
        let prodRes;
        if (isUuid) {
          prodRes = await client.query(
            `SELECT id, selling_price FROM products WHERE pharmacy_id = $1 AND id = $2 LIMIT 1`,
            [req.pharmacy_id, productId]
          );
        } else {
          prodRes = await client.query(
            `SELECT id, selling_price FROM products WHERE pharmacy_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
            [req.pharmacy_id, d.drug_name.trim()]
          );
        }
        
        if (prodRes && prodRes.rows[0]) {
          productId = String(prodRes.rows[0].id);
          price = parseFloat(prodRes.rows[0].selling_price || 0);
        } else {
          // Try fuzzy match if exact match fails
          const fuzzyRes = await client.query(
            `SELECT id, selling_price FROM products WHERE pharmacy_id = $1 AND LOWER(name) LIKE LOWER($2) LIMIT 1`,
            [req.pharmacy_id, '%' + d.drug_name.trim() + '%']
          );
          if (fuzzyRes && fuzzyRes.rows[0]) {
            productId = String(fuzzyRes.rows[0].id);
            price = parseFloat(fuzzyRes.rows[0].selling_price || 0);
          }
        }
      } catch (err) {
        logger.error('Error resolving product details in _savePrescriptions: ' + err.message);
      }
    }

    const qty = parseFloat(d.quantity || 1);

    // Check if we are updating an existing prescription
    const existingRow = d.id ? existingRows.find(r => String(r.id) === String(d.id)) : null;

    if (existingRow) {
      try {
        await logAudit(client, {
          pharmacy_id: req.pharmacy_id, table_name: 'prescriptions', record_id: existingRow.id,
          action: 'update', old_data: existingRow, new_data: { ...existingRow, ...d, product_id: productId, price: price },
          changed_by: req.user.id, visit_id: c.visit_id, patient_id: c.patient_id,
        });

        // Update editable fields, preserve status and dispensed details
        await client.query(`
          UPDATE prescriptions
          SET drug_name = $1, dosage = $2, frequency = $3, duration = $4,
              route = $5, instructions = $6, quantity = $7, product_id = $8, price = $9,
              ddc_code = $10, scientific_code = $11, encounter_id = COALESCE($12, encounter_id)
          WHERE id = $13
        `, [d.drug_name, d.dosage||null, d.frequency||null, d.duration||null,
            d.route||'oral', d.instructions||null, qty, productId, price, d.ddc_code||null, d.scientific_code||null, c.encounter_id||null, existingRow.id]);

        // If the route was changed to oral, cancel/delete any pending injection room orders
        const isOral = ['oral', 'orals', 'po', 'tablet', 'capsule'].includes((d.route || '').toLowerCase());
        if (isOral) {
          await client.query(`
            DELETE FROM injection_room_orders
            WHERE visit_id = $1 AND LOWER(TRIM(drug_name)) = LOWER(TRIM($2)) AND status = 'Pending'
          `, [c.visit_id, d.drug_name.trim()]);
        }
      } catch (err) {
        logger.error('Error updating prescription ' + existingRow.id + ': ' + err.message);
      }
    } else {
      try {
        // Insert new prescription
        const insRes = await client.query(`
          INSERT INTO prescriptions (pharmacy_id,consultation_id,visit_id,patient_id,doctor_id,encounter_id,
            drug_name,dosage,frequency,duration,route,instructions,quantity,product_id,price,ddc_code,scientific_code)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id
        `, [req.pharmacy_id,c.id,c.visit_id,c.patient_id,req.user.id,c.encounter_id||null,
            d.drug_name,d.dosage||null,d.frequency||null,d.duration||null,
            d.route||'oral',d.instructions||null,qty,productId,price,d.ddc_code||null,d.scientific_code||null]);

        await logAudit(client, {
          pharmacy_id: req.pharmacy_id, table_name: 'prescriptions', record_id: insRes.rows[0].id,
          action: 'create', old_data: null, new_data: d,
          changed_by: req.user.id, visit_id: c.visit_id, patient_id: c.patient_id,
        });

        // Auto-bill prescription drug to billing_items as pending
        // Avoid duplicating if the patient already paid for this exact drug
        const alreadyPaid = await client.query(
          `SELECT id FROM billing_items WHERE visit_id = $1 AND item_name = $2 AND item_type = 'drug' AND status != 'pending' LIMIT 1`,
          [c.visit_id, d.drug_name.trim()]
        );

        if (!alreadyPaid.rows[0]) {
          await client.query(`
            INSERT INTO billing_items (facility_id, visit_id, patient_id, encounter_id, item_name, item_type, unit_price, quantity, status)
            VALUES ($1, $2, $3, $4, $5, 'drug', $6, $7, 'pending')
          `, [req.pharmacy_id, c.visit_id, c.patient_id, c.encounter_id||null, d.drug_name.trim(), price, qty]);
        }

        const routeLower = (d.route || '').toLowerCase();
        const isInjectable = routeLower.includes('inj') || routeLower.includes('iv') || routeLower.includes('im') || routeLower.includes('sc') || routeLower.includes('intravenous') || routeLower.includes('intramuscular') || routeLower.includes('subcutaneous');
        
        if (isInjectable) {
          const injExist = await client.query(
            `SELECT id FROM injection_room_orders WHERE visit_id = $1 AND LOWER(TRIM(drug_name)) = LOWER(TRIM($2)) AND LOWER(status) = 'pending'`,
            [c.visit_id, d.drug_name.trim()]
          );
          if (!injExist.rows[0]) {
            await client.query(`
              INSERT INTO injection_room_orders (pharmacy_id, visit_id, patient_id, prescribed_by, encounter_id, drug_name, dosage, route, frequency, duration, status)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
            `, [req.pharmacy_id, c.visit_id, c.patient_id, req.user.id, c.encounter_id||null, d.drug_name.trim(), d.dosage||null, d.route||'injection', d.frequency||null, d.duration||null]);
          }
        }
      } catch (err) {
        logger.error('Error inserting new prescription: ' + err.message);
      }
    }
  }
}

async function _saveLabRequests(client, list, c, req) {
  // Get existing lab requests for this consultation
  let existingRows = [];
  try {
    const existingRes = await client.query(
      `SELECT * FROM lab_requests WHERE consultation_id = $1`,
      [c.id]
    );
    existingRows = existingRes.rows;
  } catch (err) {
    logger.error('Error fetching existing lab requests: ' + err.message);
  }

  const incomingIds = list.map(item => item.id).filter(Boolean);

  // 1. Delete lab requests that are NOT in the incoming list ONLY if incoming list manages existing IDs
  if (incomingIds.length > 0) {
    const rowsToDelete = existingRows.filter(row => !incomingIds.includes(row.id));
    for (const row of rowsToDelete) {
      if (row.status === 'pending') {
        try {
          await logAudit(client, {
            pharmacy_id: req.pharmacy_id, table_name: 'lab_requests', record_id: row.id,
            action: 'delete', old_data: row, changed_by: req.user.id,
            visit_id: c.visit_id, patient_id: c.patient_id,
          });
          await client.query(`DELETE FROM lab_requests WHERE id = $1`, [row.id]);
          
          // Also delete its pending billing item to keep billing in sync
          await client.query(
            `DELETE FROM billing_items WHERE visit_id = $1 AND item_type = 'laboratory' AND LOWER(TRIM(item_name)) = LOWER(TRIM($2)) AND status = 'pending'`,
            [c.visit_id, row.test_name.trim()]
          );
        } catch (err) {
          logger.error('Error deleting lab request row ' + row.id + ': ' + err.message);
        }
      }
    }
  }

  // 2. Insert or update incoming lab requests
  for (const t of list) {
    if (!t.test_name?.trim()) continue;

    const existingRow = t.id ? existingRows.find(r => String(r.id) === String(t.id)) : null;

    if (existingRow) {
      try {
        await logAudit(client, {
          pharmacy_id: req.pharmacy_id, table_name: 'lab_requests', record_id: existingRow.id,
          action: 'update', old_data: existingRow, new_data: { ...existingRow, ...t },
          changed_by: req.user.id, visit_id: c.visit_id, patient_id: c.patient_id,
        });

        // Update editable fields, preserve status and results
        await client.query(`
          UPDATE lab_requests
          SET test_name = $1, test_code = $2, urgency = $3, notes = $4,
              encounter_id = COALESCE($5, encounter_id)
          WHERE id = $6
        `, [t.test_name, t.test_code||null, t.urgency||'routine', t.notes||null, c.encounter_id||null, existingRow.id]);
      } catch (err) {
        logger.error('Error updating lab request ' + existingRow.id + ': ' + err.message);
      }
    } else {
      try {
        // Insert new lab request
        const lr = await client.query(`
          INSERT INTO lab_requests (pharmacy_id,consultation_id,visit_id,patient_id,doctor_id,encounter_id,
            test_name,test_code,urgency,notes)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id
        `, [req.pharmacy_id,c.id,c.visit_id,c.patient_id,req.user.id,c.encounter_id||null,
            t.test_name,t.test_code||null,t.urgency||'routine',t.notes||null]);

        await logAudit(client, {
          pharmacy_id: req.pharmacy_id, table_name: 'lab_requests', record_id: lr.rows[0].id,
          action: 'create', old_data: null, new_data: t,
          changed_by: req.user.id, visit_id: c.visit_id, patient_id: c.patient_id,
        });

        // auto-bill: look up price from service_prices, skip if already billed
        const priceRow = await client.query(`
          SELECT price FROM service_prices
          WHERE pharmacy_id=$1 AND is_active=true
            AND (service_code=$2 OR LOWER(name)=LOWER($3))
          ORDER BY (service_code=$2) DESC LIMIT 1
        `, [req.pharmacy_id, t.test_code||'', t.test_name]);
        const labPrice = priceRow.rows[0]?.price || 0;

        const alreadyBilled = await client.query(`
          SELECT id FROM billing_items
          WHERE visit_id=$1 AND status != 'cancelled'
            AND (
              (service_code IS NOT NULL AND service_code <> '' AND LOWER(TRIM(service_code)) = LOWER(TRIM($2)))
              OR LOWER(TRIM(item_name)) = LOWER(TRIM($3))
            )
          LIMIT 1
        `, [c.visit_id, (t.test_code||'').trim(), (t.test_name||'').trim()]);

        if (!alreadyBilled.rows[0]) {
          await client.query(`
            INSERT INTO billing_items (facility_id,visit_id,patient_id,encounter_id,item_type,item_name,quantity,unit_price,service_code,status)
            VALUES ($1,$2,$3,$4,'laboratory',$5,1,$6,$7,'pending')
          `, [req.pharmacy_id,c.visit_id,c.patient_id,c.encounter_id||null,t.test_name,labPrice,t.test_code||null]);
        }
      } catch (err) {
        logger.error('Error inserting lab request: ' + err.message);
      }
    }
  }
}

async function _saveProcedures(client, list, c, req) {
  // Get existing procedures for this consultation
  let existingRows = [];
  try {
    const existingRes = await client.query(
      `SELECT * FROM procedures WHERE consultation_id = $1`,
      [c.id]
    );
    existingRows = existingRes.rows;
  } catch (err) {
    logger.error('Error fetching existing procedures: ' + err.message);
  }

  const incomingIds = list.map(item => item.id).filter(Boolean);

  // 1. Delete procedures that are NOT in the incoming list ONLY if incoming list manages existing IDs
  if (incomingIds.length > 0) {
    const rowsToDelete = existingRows.filter(row => !incomingIds.includes(row.id));
    for (const row of rowsToDelete) {
      if (!row.outcome) {
        try {
          await logAudit(client, {
            pharmacy_id: req.pharmacy_id, table_name: 'procedures', record_id: row.id,
            action: 'delete', old_data: row, changed_by: req.user.id,
            visit_id: c.visit_id, patient_id: c.patient_id,
          });
          await client.query(`DELETE FROM procedures WHERE id = $1`, [row.id]);
          
          // Also delete corresponding pending billing item to keep billing in sync
          await client.query(
            `DELETE FROM billing_items WHERE visit_id = $1 AND item_type = 'procedure' AND LOWER(TRIM(item_name)) = LOWER(TRIM($2)) AND status = 'pending'`,
            [c.visit_id, row.procedure_name.trim()]
          );
        } catch (err) {
          logger.error('Error deleting procedure row ' + row.id + ': ' + err.message);
        }
      }
    }
  }

  // 2. Insert or update incoming procedures
  for (const p of list) {
    if (!p.procedure_name?.trim()) continue;

    const existingRow = p.id ? existingRows.find(r => String(r.id) === String(p.id)) : null;

    if (existingRow) {
      try {
        await logAudit(client, {
          pharmacy_id: req.pharmacy_id, table_name: 'procedures', record_id: existingRow.id,
          action: 'update', old_data: existingRow, new_data: { ...existingRow, ...p },
          changed_by: req.user.id, visit_id: c.visit_id, patient_id: c.patient_id,
        });

        // Update editable fields, preserve outcome
        await client.query(`
          UPDATE procedures
          SET procedure_name = $1, procedure_code = $2, notes = $3, outcome = $4,
              encounter_id = COALESCE($5, encounter_id)
          WHERE id = $6
        `, [p.procedure_name, p.procedure_code||null, p.notes||null, p.outcome||null, c.encounter_id||null, existingRow.id]);
      } catch (err) {
        logger.error('Error updating procedure ' + existingRow.id + ': ' + err.message);
      }
    } else {
      try {
        // Insert new procedure
        const procRes = await client.query(`
          INSERT INTO procedures (pharmacy_id,consultation_id,visit_id,patient_id,doctor_id,encounter_id,
            procedure_name,procedure_code,notes,outcome)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id
        `, [req.pharmacy_id,c.id,c.visit_id,c.patient_id,req.user.id,c.encounter_id||null,
            p.procedure_name,p.procedure_code||null,p.notes||null,p.outcome||null]);

        await logAudit(client, {
          pharmacy_id: req.pharmacy_id, table_name: 'procedures', record_id: procRes.rows[0].id,
          action: 'create', old_data: null, new_data: p,
          changed_by: req.user.id, visit_id: c.visit_id, patient_id: c.patient_id,
        });

        // auto-bill: look up price from service_prices, skip if already billed
        const priceRow = await client.query(`
          SELECT price FROM service_prices
          WHERE pharmacy_id=$1 AND is_active=true
            AND (service_code=$2 OR LOWER(name)=LOWER($3))
          ORDER BY (service_code=$2) DESC LIMIT 1
        `, [req.pharmacy_id, p.procedure_code||'', p.procedure_name]);
        const procPrice = priceRow.rows[0]?.price || 0;

        const alreadyBilled = await client.query(`
          SELECT id FROM billing_items
          WHERE visit_id=$1 AND status != 'cancelled'
            AND (
              (service_code IS NOT NULL AND service_code <> '' AND LOWER(TRIM(service_code)) = LOWER(TRIM($2)))
              OR LOWER(TRIM(item_name)) = LOWER(TRIM($3))
            )
          LIMIT 1
        `, [c.visit_id, (p.procedure_code||'').trim(), (p.procedure_name||'').trim()]);

        if (!alreadyBilled.rows[0]) {
          await client.query(`
            INSERT INTO billing_items (facility_id,visit_id,patient_id,encounter_id,item_type,item_name,quantity,unit_price,service_code,status)
            VALUES ($1,$2,$3,$4,'procedure',$5,1,$6,$7,'pending')
          `, [req.pharmacy_id,c.visit_id,c.patient_id,c.encounter_id||null,p.procedure_name,procPrice,p.procedure_code||null]);
        }
      } catch (err) {
        logger.error('Error auto-billing procedure: ' + err.message);
      }
    }
  }
}

const getInjectionReports = async (req, res) => {
  try {
    const result = await pool.query(`SELECT iro.*, COALESCE(u.full_name, 'Staff Nurse') AS nurse_name, COALESCE(u.full_name, 'Staff Nurse') AS administered_by_name FROM injection_room_orders iro LEFT JOIN users u ON iro.administered_by = u.id WHERE iro.visit_id=$1 AND iro.pharmacy_id=$2 ORDER BY iro.created_at DESC`, [req.params.visit_id, req.pharmacy_id]);
    return successResponse(res, 200, "Injection reports fetched", result.rows);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

const getRadiologyReports = async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS radiology_reports (
        id SERIAL PRIMARY KEY,
        pharmacy_id INT NOT NULL,
        visit_id INT NOT NULL,
        patient_id INT,
        doctor_id INT,
        radiologist_id INT,
        radiologist_name VARCHAR(255),
        study_name VARCHAR(255),
        clinical_indication TEXT,
        findings TEXT,
        impression TEXT,
        notes TEXT,
        status VARCHAR(50) DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const result = await pool.query(`
      SELECT rr.*, COALESCE(rr.radiologist_name, u.full_name, 'Consultant Radiologist') as radiologist_name
      FROM radiology_reports rr
      LEFT JOIN users u ON rr.radiologist_id = u.id
      WHERE rr.visit_id = $1 AND rr.pharmacy_id = $2
      ORDER BY rr.created_at DESC
    `, [req.params.visit_id, req.pharmacy_id]);

    return successResponse(res, 200, 'Radiology reports fetched', result.rows);
  } catch (e) {
    logger.error('Get radiology reports error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const saveRadiologyReport = async (req, res) => {
  try {
    const { study_name, clinical_indication, findings, impression, notes } = req.body;
    const radiologistName = req.user?.full_name || 'Consultant Radiologist';

    const visitRes = await pool.query('SELECT patient_id FROM visits WHERE id=$1', [req.params.visit_id]);
    const patientId = visitRes.rows[0]?.patient_id || null;

    await pool.query(`
      CREATE TABLE IF NOT EXISTS radiology_reports (
        id SERIAL PRIMARY KEY,
        pharmacy_id INT NOT NULL,
        visit_id INT NOT NULL,
        patient_id INT,
        doctor_id INT,
        radiologist_id INT,
        radiologist_name VARCHAR(255),
        study_name VARCHAR(255),
        clinical_indication TEXT,
        findings TEXT,
        impression TEXT,
        notes TEXT,
        status VARCHAR(50) DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const inserted = await pool.query(`
      INSERT INTO radiology_reports 
        (pharmacy_id, visit_id, patient_id, radiologist_id, radiologist_name, study_name, clinical_indication, findings, impression, notes, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'completed')
      RETURNING *
    `, [
      req.pharmacy_id,
      req.params.visit_id,
      patientId,
      req.user?.id || null,
      radiologistName,
      study_name || 'Radiology Imaging',
      clinical_indication || '',
      findings || '',
      impression || '',
      notes || ''
    ]);

    await pool.query("UPDATE visits SET status='with_doctor', updated_at=NOW() WHERE id=$1", [req.params.visit_id]);

    const io = req.app.get('io');
    if (io) {
      io.emit(`queue_update_${req.pharmacy_id}`, { visit_id: req.params.visit_id, status: 'with_doctor' });
      io.emit(`visit_updated_${req.pharmacy_id}`, { visit_id: req.params.visit_id, status: 'with_doctor' });
    }

    return successResponse(res, 200, 'Radiology report saved', inserted.rows[0]);
  } catch (e) {
    logger.error('Save radiology report error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

module.exports = { getByVisit, getById, create, update, getPharmacyQueue, getLabResults, getInjectionReports, getRadiologyReports, saveRadiologyReport };
