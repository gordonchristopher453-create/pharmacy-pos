const { pool } = require('../config/db');
const ServiceOrderModel = require('../models/serviceOrder.model');
const VisitModel = require('../models/visit.model');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

// ── Open / update ANC registration ───────────────────────
const saveANCRegistration = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pid = req.pharmacy_id;
    const {
      patient_id, visit_id,
      anc_clinic_number, gravida, para, lmp, edd, gestation_age,
      marital_status, occupation, next_of_kin, next_of_kin_phone,
      risk_factors, complaints, treatment_given, next_appointment,
    } = req.body;

    if (!patient_id) return errorResponse(res, 400, 'patient_id is required');

    // Upsert ANC registration
    const existing = await client.query(
      `SELECT id FROM anc_registrations WHERE patient_id=$1 AND pharmacy_id=$2 LIMIT 1`,
      [patient_id, pid]
    );

    let ancReg;
    if (existing.rows.length > 0) {
      const r = await client.query(`
        UPDATE anc_registrations SET
          anc_clinic_number=COALESCE($1,anc_clinic_number),
          gravida=COALESCE($2,gravida), para=COALESCE($3,para),
          lmp=COALESCE($4,lmp), edd=COALESCE($5,edd),
          gestation_age=COALESCE($6,gestation_age),
          marital_status=COALESCE($7,marital_status),
          occupation=COALESCE($8,occupation),
          next_of_kin=COALESCE($9,next_of_kin),
          next_of_kin_phone=COALESCE($10,next_of_kin_phone),
          updated_at=NOW()
        WHERE patient_id=$11 AND pharmacy_id=$12 RETURNING *
      `, [anc_clinic_number,gravida,para,lmp,edd,gestation_age,
          marital_status,occupation,next_of_kin,next_of_kin_phone,
          patient_id,pid]);
      ancReg = r.rows[0];
    } else {
      const r = await client.query(`
        INSERT INTO anc_registrations
          (pharmacy_id, patient_id, anc_clinic_number, gravida, para, lmp, edd,
           gestation_age, marital_status, occupation, next_of_kin, next_of_kin_phone)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
      `, [pid,patient_id,anc_clinic_number,gravida,para,lmp,edd,
          gestation_age,marital_status,occupation,next_of_kin,next_of_kin_phone]);
      ancReg = r.rows[0];
    }

    // Save visit note if visit_id provided
    if (visit_id && (complaints || treatment_given)) {
      await client.query(`
        INSERT INTO clinical_notes (pharmacy_id, visit_id, patient_id, note_type, subjective, plan, written_by)
        VALUES ($1,$2,$3,'anc',$4,$5,$6)
      `, [pid, visit_id, patient_id, complaints||null, treatment_given||null, req.user.id]);
    }

    // Next appointment
    if (visit_id && next_appointment) {
      await client.query(`
        UPDATE visits SET notes=CONCAT(COALESCE(notes,''),' | Next ANC: '||$1), updated_at=NOW()
        WHERE id=$2 AND pharmacy_id=$3
      `, [next_appointment, visit_id, pid]);
    }

    await client.query(`
      INSERT INTO audit_logs (facility_id, user_id, action, table_name, record_id)
      VALUES ($1,$2,'anc_saved','anc_registrations',$3)
    `, [pid, req.user.id, ancReg.id]);

    await client.query('COMMIT');
    return successResponse(res, 200, 'ANC registration saved', ancReg);
  } catch (e) {
    await client.query('ROLLBACK');
    logger.error('ANC save error:', e.message);
    return errorResponse(res, 500, e.message);
  } finally { client.release(); }
};

// ── Save ANC visit (vitals + profile + exam) ─────────────
const saveANCVisit = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pid = req.pharmacy_id;
    const {
      anc_id, visit_id, patient_id,
      weight, blood_pressure, fundal_height, fetal_heart_rate,
      presentation, fetal_movement, oedema, temperature,
      blood_group, rh_factor, hemoglobin, hiv_test, vdrl,
      hiv_test_date, vdrl_date, urinalysis, lab_reference,
      performed_by, risk_factors,
    } = req.body;

    // Save visit record
    const visitRes = await client.query(`
      INSERT INTO anc_visits
        (pharmacy_id, anc_id, visit_id, patient_id, weight, blood_pressure,
         fundal_height, fetal_heart_rate, presentation, fetal_movement,
         oedema, temperature, blood_group, rh_factor, hemoglobin,
         hiv_test, vdrl, hiv_test_date, vdrl_date, urinalysis,
         lab_reference, performed_by, risk_factors, visit_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,NOW())
      RETURNING *
    `, [pid,anc_id,visit_id,patient_id,weight,blood_pressure,
        fundal_height,fetal_heart_rate,presentation,fetal_movement,
        oedema,temperature,blood_group,rh_factor,hemoglobin,
        hiv_test,vdrl,hiv_test_date,vdrl_date,urinalysis,
        lab_reference,performed_by,risk_factors]);

    await client.query('COMMIT');
    return successResponse(res, 201, 'ANC visit saved', visitRes.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    return errorResponse(res, 500, e.message);
  } finally { client.release(); }
};

// ── Order lab from ANC (goes through ServiceOrder engine) ─
const orderANCLab = async (req, res) => {
  try {
    const { visit_id, patient_id, test_name, test_code, lab_price } = req.body;
    if (!visit_id || !patient_id || !test_name) return errorResponse(res, 400, 'visit_id, patient_id, test_name required');
    const result = await ServiceOrderModel.create({
      pharmacy_id:      req.pharmacy_id,
      visit_id:         visit_id,
      patient_id:       patient_id,
      order_type:       'lab',
      ordered_by:       req.user.id,
      ordered_by_dept:  'anc',
      assigned_to_dept: 'laboratory',
      test_name,
      test_code:        test_code || null,
      lab_price:        lab_price || 0,
      notes:            `Ordered from ANC by ${req.user.full_name||'Nurse'}`,
    });
    const io = req.app.get('io');
    if (io) io.emit(`lab_order_${req.pharmacy_id}`, result.service_order);
    return successResponse(res, 201, 'Lab order created', result);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── Order drug from ANC (goes to pharmacy) ────────────────
const orderANCDrug = async (req, res) => {
  try {
    const { visit_id, patient_id, drug_name, dosage, frequency, duration, quantity, drug_price, product_id } = req.body;
    if (!visit_id || !patient_id || !drug_name) return errorResponse(res, 400, 'visit_id, patient_id, drug_name required');
    const result = await ServiceOrderModel.create({
      pharmacy_id:      req.pharmacy_id,
      visit_id:         visit_id,
      patient_id:       patient_id,
      order_type:       'prescription',
      ordered_by:       req.user.id,
      ordered_by_dept:  'anc',
      assigned_to_dept: 'pharmacy',
      drug_name, product_id, dosage, frequency, duration,
      quantity:         quantity || 1,
      drug_price:       drug_price || 0,
    });
    const io = req.app.get('io');
    if (io) io.emit(`prescription_${req.pharmacy_id}`, result.service_order);
    return successResponse(res, 201, 'Drug order created', result);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── Order vaccine from ANC (goes to immunization) ─────────
const orderANCVaccine = async (req, res) => {
  try {
    const { visit_id, patient_id, vaccine_name, vaccine_code, dose_number, next_due_date, vaccine_price } = req.body;
    if (!visit_id || !patient_id || !vaccine_name) return errorResponse(res, 400, 'visit_id, patient_id, vaccine_name required');
    const result = await ServiceOrderModel.create({
      pharmacy_id:      req.pharmacy_id,
      visit_id:         visit_id,
      patient_id:       patient_id,
      order_type:       'vaccine',
      ordered_by:       req.user.id,
      ordered_by_dept:  'anc',
      assigned_to_dept: 'immunization',
      vaccine_name, vaccine_code,
      dose_number:      dose_number || 1,
      next_due_date:    next_due_date || null,
      vaccine_price:    vaccine_price || 0,
    });
    const io = req.app.get('io');
    if (io) io.emit(`vaccine_order_${req.pharmacy_id}`, result.service_order);
    return successResponse(res, 201, 'Vaccine order created', result);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── Get ANC registration ──────────────────────────────────
const getANCRegistration = async (req, res) => {
  try {
    const { patient_id } = req.params;
    const reg = await pool.query(`
      SELECT ar.*, p.full_name, p.patient_number, p.date_of_birth, p.phone
      FROM anc_registrations ar
      LEFT JOIN patients p ON ar.patient_id=p.id
      WHERE ar.patient_id=$1 AND ar.pharmacy_id=$2
      LIMIT 1
    `, [patient_id, req.pharmacy_id]);
    if (!reg.rows[0]) return errorResponse(res, 404, 'ANC registration not found');

    const visits = await pool.query(`
      SELECT * FROM anc_visits WHERE anc_id=$1 ORDER BY visit_date DESC
    `, [reg.rows[0].id]);

    const flags = await pool.query(`
      SELECT * FROM anc_high_risk WHERE anc_id=$1 ORDER BY created_at DESC
    `, [reg.rows[0].id]);

    return successResponse(res, 200, 'ANC record', {
      registration: reg.rows[0],
      visits: visits.rows,
      high_risk_flags: flags.rows,
    });
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── List all ANC registrations ────────────────────────────
const listANCRegistrations = async (req, res) => {
  try {
    const { search, limit=50, offset=0 } = req.query;
    let q = `
      SELECT ar.*, p.full_name, p.patient_number, p.gender, p.phone
      FROM anc_registrations ar
      LEFT JOIN patients p ON ar.patient_id=p.id
      WHERE ar.pharmacy_id=$1
    `;
    const params = [req.pharmacy_id];
    if (search) {
      params.push(`%${search}%`);
      q += ` AND (p.full_name ILIKE $${params.length} OR ar.anc_clinic_number ILIKE $${params.length} OR p.patient_number ILIKE $${params.length})`;
    }
    q += ` ORDER BY ar.created_at DESC`;
    params.push(limit);  q += ` LIMIT $${params.length}`;
    params.push(offset); q += ` OFFSET $${params.length}`;
    const result = await pool.query(q, params);
    return successResponse(res, 200, 'ANC registrations', result.rows);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── Add high-risk flag ────────────────────────────────────
const addHighRiskFlag = async (req, res) => {
  try {
    const { anc_id } = req.params;
    const { condition, notes } = req.body;
    const result = await pool.query(`
      INSERT INTO anc_high_risk (anc_id, pharmacy_id, condition, notes, flagged_by)
      VALUES ($1,$2,$3,$4,$5) RETURNING *
    `, [anc_id, req.pharmacy_id, condition, notes||null, req.user.id]);
    return successResponse(res, 201, 'High risk flag added', result.rows[0]);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── Remove high-risk flag ─────────────────────────────────
const removeHighRiskFlag = async (req, res) => {
  try {
    await pool.query(`DELETE FROM anc_high_risk WHERE id=$1 AND pharmacy_id=$2`, [req.params.flag_id, req.pharmacy_id]);
    return successResponse(res, 200, 'Flag removed');
  } catch (e) { return errorResponse(res, 500, e.message); }
};

module.exports = {
  saveANCRegistration, saveANCVisit, orderANCLab, orderANCDrug, orderANCVaccine,
  getANCRegistration, listANCRegistrations, addHighRiskFlag, removeHighRiskFlag,
};
