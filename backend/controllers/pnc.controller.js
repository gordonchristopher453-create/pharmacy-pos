const { pool } = require('../config/db');
const ServiceOrderModel = require('../models/serviceOrder.model');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

// ── Save PNC visit ─────────────────────────────────────────
const savePNCVisit = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pid = req.pharmacy_id;
    const {
      patient_id, visit_id, delivery_id,
      visit_date, days_postpartum,
      // Mother assessment
      mother_weight, mother_bp, mother_temp, mother_pulse,
      uterus_involution, lochia, perineum, breast_condition,
      breastfeeding_status, mother_complaints, mother_assessment,
      // Baby assessment
      baby_weight, baby_temp, baby_condition,
      cord_condition, baby_feeding, baby_stool, baby_urine,
      baby_jaundice, baby_assessment,
      // Counseling
      danger_signs_counseling, fp_counseling, fp_method_chosen,
      nutrition_counseling, immunization_counseling,
      // Plan
      treatment_given, next_appointment, referred_to, notes,
    } = req.body;

    if (!patient_id) return errorResponse(res, 400, 'patient_id is required');

    const result = await client.query(`
      INSERT INTO pnc_visits (
        pharmacy_id, patient_id, visit_id, delivery_id, visit_date, days_postpartum,
        mother_weight, mother_bp, mother_temp, mother_pulse,
        uterus_involution, lochia, perineum, breast_condition,
        breastfeeding_status, mother_complaints, mother_assessment,
        baby_weight, baby_temp, baby_condition, cord_condition,
        baby_feeding, baby_stool, baby_urine, baby_jaundice, baby_assessment,
        danger_signs_counseling, fp_counseling, fp_method_chosen,
        nutrition_counseling, immunization_counseling,
        treatment_given, next_appointment, referred_to, notes, recorded_by
      ) VALUES (
        $1,$2,$3,$4,COALESCE($5,NOW()),$6,
        $7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
        $18,$19,$20,$21,$22,$23,$24,$25,$26,
        $27,$28,$29,$30,$31,$32,$33,$34,$35,$36
      ) RETURNING *
    `, [
      pid, patient_id, visit_id||null, delivery_id||null,
      visit_date, days_postpartum||null,
      mother_weight||null, mother_bp||null, mother_temp||null, mother_pulse||null,
      uterus_involution||null, lochia||null, perineum||null, breast_condition||null,
      breastfeeding_status||null, mother_complaints||null, mother_assessment||null,
      baby_weight||null, baby_temp||null, baby_condition||null, cord_condition||null,
      baby_feeding||null, baby_stool||null, baby_urine||null, baby_jaundice||null, baby_assessment||null,
      danger_signs_counseling||false, fp_counseling||false, fp_method_chosen||null,
      nutrition_counseling||false, immunization_counseling||false,
      treatment_given||null, next_appointment||null, referred_to||null, notes||null, req.user.id,
    ]);

    if (visit_id && (mother_complaints || mother_assessment)) {
      await client.query(`
        INSERT INTO clinical_notes (pharmacy_id, visit_id, patient_id, note_type, subjective, assessment, plan, written_by)
        VALUES ($1,$2,$3,'pnc',$4,$5,$6,$7)
      `, [pid, visit_id, patient_id, mother_complaints||null, mother_assessment||null, treatment_given||null, req.user.id]);
    }

    await client.query(`
      INSERT INTO audit_trail (pharmacy_id, user_id, action, entity_type, entity_id)
      VALUES ($1,$2,'pnc_saved','pnc_visit',$3)
    `, [pid, req.user.id, result.rows[0].id]);

    await client.query('COMMIT');
    return successResponse(res, 201, 'PNC visit saved', result.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    logger.error('PNC save error:', e.message);
    return errorResponse(res, 500, e.message);
  } finally { client.release(); }
};

// ── Order from PNC (lab/drug/vaccine) ─────────────────────
const orderFromPNC = async (req, res) => {
  try {
    const { order_type, visit_id, patient_id, ...rest } = req.body;
    if (!order_type || !visit_id || !patient_id) return errorResponse(res, 400, 'order_type, visit_id, patient_id required');
    const deptMap = { lab:'laboratory', prescription:'pharmacy', vaccine:'immunization' };
    const result = await ServiceOrderModel.create({
      pharmacy_id:      req.pharmacy_id,
      visit_id:         visit_id,
      patient_id:       patient_id,
      order_type,
      ordered_by:       req.user.id,
      ordered_by_dept:  'pnc',
      assigned_to_dept: deptMap[order_type] || order_type,
      ...rest,
    });
    const io = req.app.get('io');
    if (io) io.emit(`service_order_${req.pharmacy_id}_${deptMap[order_type]}`, result.service_order);
    return successResponse(res, 201, 'Order created from PNC', result);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── List PNC visits for a patient ─────────────────────────
const getPNCVisits = async (req, res) => {
  try {
    const { patient_id } = req.params;
    const result = await pool.query(`
      SELECT pv.*, u.full_name as recorded_by_name
      FROM pnc_visits pv
      LEFT JOIN users u ON pv.recorded_by=u.id
      WHERE pv.patient_id=$1 AND pv.pharmacy_id=$2
      ORDER BY pv.visit_date DESC
    `, [patient_id, req.pharmacy_id]);
    return successResponse(res, 200, 'PNC visits', result.rows);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── PNC queue (open PNC visits) ───────────────────────────
const getPNCQueue = async (req, res) => {
  try {
    const { date } = req.query;
    const d = date || new Date().toISOString().split('T')[0];
    const result = await pool.query(`
      SELECT v.*, p.full_name as patient_name, p.patient_number, p.gender, p.phone
      FROM visits v
      LEFT JOIN patients p ON v.patient_id=p.id
      WHERE v.pharmacy_id=$1 AND v.visit_type='pnc' AND v.status IN ('open','waiting') AND DATE(v.created_at) = $2
      ORDER BY v.created_at DESC
    `, [req.pharmacy_id, d]);
    return successResponse(res, 200, 'PNC queue', result.rows);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

module.exports = { savePNCVisit, orderFromPNC, getPNCVisits, getPNCQueue };
