const { pool } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

// ── Record delivery ────────────────────────────────────────
const recordDelivery = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pid = req.pharmacy_id;
    const {
      patient_id, visit_id, anc_id,
      delivery_date, delivery_time, delivery_type,
      gestation_at_delivery, duration_of_labour,
      // Labour
      labour_onset, membranes, liquor, moulding,
      // Delivery details
      delivered_by, place_of_delivery,
      complications, blood_loss_ml,
      // Birth outcomes
      outcome, number_of_babies,
      // Baby details (first baby — others handled via baby_records)
      baby_sex, birth_weight, apgar_1min, apgar_5min,
      baby_condition, cry_at_birth, resuscitation,
      // Placenta
      placenta_complete, placenta_weight,
      // Postpartum
      uterus_contracted, perineum_repair, repair_details,
      // Notes
      notes, referred_to,
    } = req.body;

    if (!patient_id) return errorResponse(res, 400, 'patient_id is required');

    // 1. Create delivery record
    const deliveryRes = await client.query(`
      INSERT INTO deliveries (
        pharmacy_id, patient_id, visit_id, anc_id,
        delivery_date, delivery_time, delivery_type,
        gestation_at_delivery, duration_of_labour,
        labour_onset, membranes, liquor, moulding,
        delivered_by, place_of_delivery,
        complications, blood_loss_ml, outcome, number_of_babies,
        placenta_complete, placenta_weight,
        uterus_contracted, perineum_repair, repair_details,
        notes, referred_to, recorded_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
        $14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27
      ) RETURNING *
    `, [
      pid, patient_id, visit_id||null, anc_id||null,
      delivery_date||new Date(), delivery_time||null, delivery_type||'normal_svd',
      gestation_at_delivery||null, duration_of_labour||null,
      labour_onset||null, membranes||null, liquor||null, moulding||null,
      delivered_by||req.user.full_name, place_of_delivery||null,
      complications||null, blood_loss_ml||null, outcome||'live_birth', number_of_babies||1,
      placenta_complete||true, placenta_weight||null,
      uterus_contracted||true, perineum_repair||false, repair_details||null,
      notes||null, referred_to||null, req.user.id,
    ]);
    const delivery = deliveryRes.rows[0];

    // 2. Auto-create baby record (Part 9 — child linkage)
    if (outcome !== 'stillbirth' && patient_id) {
      const babyRes = await client.query(`
        INSERT INTO baby_records (
          pharmacy_id, delivery_id, mother_id,
          birth_date, birth_weight, sex,
          apgar_1min, apgar_5min, condition_at_birth,
          cry_at_birth, resuscitation
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
      `, [
        pid, delivery.id, patient_id,
        delivery_date||new Date(), birth_weight||null, baby_sex||null,
        apgar_1min||null, apgar_5min||null, baby_condition||null,
        cry_at_birth||true, resuscitation||false,
      ]);

      // Generate child patient record automatically
      const motherRes = await client.query(`SELECT * FROM patients WHERE id=$1`, [patient_id]);
      const mother = motherRes.rows[0];
      if (mother) {
        const babyNumber = `BABY-${delivery.id}-${Date.now().toString().slice(-4)}`;
        const babyPatientRes = await client.query(`
          INSERT INTO patients (
            pharmacy_id, full_name, patient_number, date_of_birth,
            gender, phone, address, mother_id, birth_weight
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT DO NOTHING RETURNING *
        `, [
          pid,
          `Baby of ${mother.full_name}`,
          babyNumber,
          delivery_date||new Date(),
          baby_sex==='Male'?'male':baby_sex==='Female'?'female':'unknown',
          mother.phone||null,
          mother.address||null,
          patient_id,
          birth_weight||null,
        ]);

        // Link baby record to patient record
        if (babyPatientRes.rows[0]) {
          await client.query(`
            UPDATE baby_records SET child_patient_id=$1 WHERE id=$2
          `, [babyPatientRes.rows[0].id, babyRes.rows[0].id]);
        }
      }
    }

    // 3. Clinical note
    if (visit_id) {
      await client.query(`
        INSERT INTO clinical_notes (pharmacy_id, visit_id, patient_id, note_type, assessment, plan, notes, written_by)
        VALUES ($1,$2,$3,'delivery',$4,$5,$6,$7)
      `, [pid, visit_id, patient_id,
          `${delivery_type||'SVD'} — ${outcome||'live birth'}`,
          notes||null, complications||null, req.user.id]);
    }

    // 4. Audit
    await client.query(`
      INSERT INTO audit_trail (pharmacy_id, user_id, action, entity_type, entity_id, new_values)
      VALUES ($1,$2,'delivery_recorded','delivery',$3,$4)
    `, [pid, req.user.id, delivery.id, JSON.stringify({ delivery_type, outcome, patient_id })]);

    await client.query('COMMIT');
    return successResponse(res, 201, 'Delivery recorded', delivery);
  } catch (e) {
    await client.query('ROLLBACK');
    logger.error('Delivery error:', e.message);
    return errorResponse(res, 500, e.message);
  } finally { client.release(); }
};

// ── Labour monitoring (partograph entries) ─────────────────
const addLabourMonitoring = async (req, res) => {
  try {
    const { delivery_id } = req.params;
    const {
      recorded_at, cervical_dilation, fetal_heart_rate,
      contractions_per_10min, contraction_duration,
      mother_bp, mother_pulse, mother_temp,
      descent, moulding, liquor, notes,
    } = req.body;

    const result = await pool.query(`
      INSERT INTO labour_monitoring (
        pharmacy_id, delivery_id, recorded_at,
        cervical_dilation, fetal_heart_rate,
        contractions_per_10min, contraction_duration,
        mother_bp, mother_pulse, mother_temp,
        descent, moulding, liquor, notes, recorded_by
      ) VALUES ($1,$2,COALESCE($3,NOW()),$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
    `, [
      req.pharmacy_id, delivery_id, recorded_at,
      cervical_dilation||null, fetal_heart_rate||null,
      contractions_per_10min||null, contraction_duration||null,
      mother_bp||null, mother_pulse||null, mother_temp||null,
      descent||null, moulding||null, liquor||null, notes||null, req.user.id,
    ]);
    return successResponse(res, 201, 'Labour monitoring recorded', result.rows[0]);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── Get delivery record ────────────────────────────────────
const getDelivery = async (req, res) => {
  try {
    const delivery = await pool.query(`
      SELECT d.*, p.full_name as mother_name, p.patient_number,
             u.full_name as recorded_by_name
      FROM deliveries d
      LEFT JOIN patients p ON d.patient_id=p.id
      LEFT JOIN users u ON d.recorded_by=u.id
      WHERE d.id=$1 AND d.pharmacy_id=$2
    `, [req.params.id, req.pharmacy_id]);
    if (!delivery.rows[0]) return errorResponse(res, 404, 'Delivery not found');

    const babies = await pool.query(`
      SELECT br.*, p.full_name as child_name, p.patient_number as child_number
      FROM baby_records br
      LEFT JOIN patients p ON br.child_patient_id=p.id
      WHERE br.delivery_id=$1
    `, [req.params.id]);

    const monitoring = await pool.query(`
      SELECT * FROM labour_monitoring WHERE delivery_id=$1 ORDER BY recorded_at ASC
    `, [req.params.id]);

    return successResponse(res, 200, 'Delivery record', {
      delivery: delivery.rows[0],
      babies: babies.rows,
      labour_monitoring: monitoring.rows,
    });
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── List deliveries ────────────────────────────────────────
const listDeliveries = async (req, res) => {
  try {
    const { date_from, date_to, limit=50, offset=0 } = req.query;
    let q = `
      SELECT d.*, p.full_name as mother_name, p.patient_number
      FROM deliveries d
      LEFT JOIN patients p ON d.patient_id=p.id
      WHERE d.pharmacy_id=$1
    `;
    const params = [req.pharmacy_id];
    if (date_from) { params.push(date_from); q += ` AND DATE(d.delivery_date)>=$${params.length}`; }
    if (date_to)   { params.push(date_to);   q += ` AND DATE(d.delivery_date)<=$${params.length}`; }
    q += ` ORDER BY d.delivery_date DESC`;
    params.push(limit);  q += ` LIMIT $${params.length}`;
    params.push(offset); q += ` OFFSET $${params.length}`;
    const result = await pool.query(q, params);
    return successResponse(res, 200, 'Deliveries', result.rows);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── Get baby record + mother linkage ──────────────────────
const getBabyRecord = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT br.*, d.delivery_date, d.delivery_type,
             mp.full_name as mother_name, mp.patient_number as mother_number,
             cp.full_name as child_name, cp.patient_number as child_number
      FROM baby_records br
      LEFT JOIN deliveries d ON br.delivery_id=d.id
      LEFT JOIN patients mp ON br.mother_id=mp.id
      LEFT JOIN patients cp ON br.child_patient_id=cp.id
      WHERE br.id=$1 AND br.pharmacy_id=$2
    `, [req.params.id, req.pharmacy_id]);
    if (!result.rows[0]) return errorResponse(res, 404, 'Baby record not found');
    return successResponse(res, 200, 'Baby record', result.rows[0]);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── List babies by mother ─────────────────────────────────
const getBabiesByMother = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT br.*, d.delivery_date, d.delivery_type,
             cp.full_name as child_name, cp.patient_number as child_number
      FROM baby_records br
      LEFT JOIN deliveries d ON br.delivery_id=d.id
      LEFT JOIN patients cp ON br.child_patient_id=cp.id
      WHERE br.mother_id=$1 AND br.pharmacy_id=$2
      ORDER BY br.birth_date DESC
    `, [req.params.mother_id, req.pharmacy_id]);
    return successResponse(res, 200, 'Babies by mother', result.rows);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

module.exports = {
  recordDelivery, addLabourMonitoring, getDelivery,
  listDeliveries, getBabyRecord, getBabiesByMother,
};
