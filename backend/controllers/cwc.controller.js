const { pool } = require('../config/db');
const ServiceOrderModel = require('../models/serviceOrder.model');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

// ── Save CWC visit (growth monitoring) ────────────────────
const saveCWCVisit = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pid = req.pharmacy_id;
    const {
      patient_id, visit_id, mother_id,
      visit_date, age_in_months,
      weight, height, muac, head_circumference,
      weight_for_age, height_for_age, weight_for_height,
      nutritional_status, developmental_milestone,
      immunization_status, vitamin_a_given, deworming_given,
      nutrition_counseling, breastfeeding_counseling,
      complementary_feeding, next_appointment,
      complaints, assessment, treatment_given, notes,
    } = req.body;

    if (!patient_id) return errorResponse(res, 400, 'patient_id is required');

    const result = await client.query(`
      INSERT INTO cwc_visits (
        pharmacy_id, patient_id, visit_id, mother_id, visit_date, age_in_months,
        weight, height, muac, head_circumference,
        weight_for_age, height_for_age, weight_for_height,
        nutritional_status, developmental_milestone, immunization_status,
        vitamin_a_given, deworming_given,
        nutrition_counseling, breastfeeding_counseling, complementary_feeding,
        next_appointment, complaints, assessment, treatment_given, notes, recorded_by
      ) VALUES (
        $1,$2,$3,$4,COALESCE($5,NOW()),$6,
        $7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
        $19,$20,$21,$22,$23,$24,$25,$26,$27
      ) RETURNING *
    `, [
      pid, patient_id, visit_id||null, mother_id||null,
      visit_date, age_in_months||null,
      weight||null, height||null, muac||null, head_circumference||null,
      weight_for_age||null, height_for_age||null, weight_for_height||null,
      nutritional_status||null, developmental_milestone||null, immunization_status||null,
      vitamin_a_given||false, deworming_given||false,
      nutrition_counseling||false, breastfeeding_counseling||false, complementary_feeding||null,
      next_appointment||null, complaints||null, assessment||null, treatment_given||null,
      notes||null, req.user.id,
    ]);

    // Clinical note
    if (visit_id) {
      await client.query(`
        INSERT INTO clinical_notes (pharmacy_id, visit_id, patient_id, note_type, subjective, assessment, plan, written_by)
        VALUES ($1,$2,$3,'general',$4,$5,$6,$7)
      `, [pid, visit_id, patient_id, complaints||null, assessment||null, treatment_given||null, req.user.id]);
    }

    await client.query(`
      INSERT INTO audit_trail (pharmacy_id, user_id, action, entity_type, entity_id)
      VALUES ($1,$2,'cwc_visit_saved','cwc_visit',$3)
    `, [pid, req.user.id, result.rows[0].id]);

    await client.query('COMMIT');
    return successResponse(res, 201, 'CWC visit saved', result.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    logger.error('CWC save error:', e.message);
    return errorResponse(res, 500, e.message);
  } finally { client.release(); }
};

// ── Get growth history for WHO chart ──────────────────────
const getGrowthHistory = async (req, res) => {
  try {
    const { patient_id } = req.params;
    const result = await pool.query(`
      SELECT
        id, visit_date, age_in_months,
        weight, height, muac, head_circumference,
        weight_for_age, height_for_age, weight_for_height,
        nutritional_status
      FROM cwc_visits
      WHERE patient_id=$1 AND pharmacy_id=$2
      ORDER BY visit_date ASC
    `, [patient_id, req.pharmacy_id]);

    // Build WHO chart data points
    const chartData = {
      weight_age:  result.rows.map(r => ({ x: r.age_in_months, y: parseFloat(r.weight||0),  date: r.visit_date })),
      height_age:  result.rows.map(r => ({ x: r.age_in_months, y: parseFloat(r.height||0),  date: r.visit_date })),
      muac:        result.rows.map(r => ({ x: r.age_in_months, y: parseFloat(r.muac||0),    date: r.visit_date })),
      head_circ:   result.rows.map(r => ({ x: r.age_in_months, y: parseFloat(r.head_circumference||0), date: r.visit_date })),
    };

    return successResponse(res, 200, 'Growth history', { visits: result.rows, chart_data: chartData });
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── CWC queue ─────────────────────────────────────────────
const getCWCQueue = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.*, p.full_name as patient_name, p.patient_number, p.date_of_birth,
             mp.full_name as mother_name, mp.phone as mother_phone
      FROM visits v
      LEFT JOIN patients p ON v.patient_id=p.id
      LEFT JOIN patients mp ON p.mother_id=mp.id
      WHERE v.pharmacy_id=$1 AND v.visit_type='cwc' AND v.status='open'
      ORDER BY v.created_at DESC
    `, [req.pharmacy_id]);
    return successResponse(res, 200, 'CWC queue', result.rows);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── Get all CWC visits for a child ────────────────────────
const getCWCVisits = async (req, res) => {
  try {
    const { patient_id } = req.params;
    const result = await pool.query(`
      SELECT cv.*, u.full_name as recorded_by_name
      FROM cwc_visits cv
      LEFT JOIN users u ON cv.recorded_by=u.id
      WHERE cv.patient_id=$1 AND cv.pharmacy_id=$2
      ORDER BY cv.visit_date DESC
    `, [patient_id, req.pharmacy_id]);
    return successResponse(res, 200, 'CWC visits', result.rows);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── Order from CWC ────────────────────────────────────────
const orderFromCWC = async (req, res) => {
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
      ordered_by_dept:  'cwc',
      assigned_to_dept: deptMap[order_type] || order_type,
      ...rest,
    });
    const io = req.app.get('io');
    if (io) io.emit(`service_order_${req.pharmacy_id}_${deptMap[order_type]}`, result.service_order);
    return successResponse(res, 201, 'Order created from CWC', result);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

module.exports = { saveCWCVisit, getGrowthHistory, getCWCQueue, getCWCVisits, orderFromCWC };
