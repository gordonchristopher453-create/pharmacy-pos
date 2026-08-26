const { pool } = require('../config/db');
const PatientModel = require('../models/patient.model');
const VisitModel = require('../models/visit.model');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

const getPatients = async (req, res) => {
  try {
    const { search, limit, offset } = req.query;
    const patients = await PatientModel.findAll({ pharmacy_id: req.pharmacy_id, search, limit: parseInt(limit) || 200, offset: parseInt(offset) || 0 });
    const stats = await PatientModel.getStats(req.pharmacy_id);
    return successResponse(res, 200, 'Patients fetched', { patients, stats });
  } catch (error) {
    logger.error('Get patients error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch patients');
  }
};

const getPatient = async (req, res) => {
  try {
    const patient = await PatientModel.findById(req.params.id, req.pharmacy_id);
    if (!patient) return errorResponse(res, 404, 'Patient not found');
    const visits = await PatientModel.getVisits(req.params.id, req.pharmacy_id);
    return successResponse(res, 200, 'Patient fetched', { ...patient, visits });
  } catch (error) {
    logger.error('Get patient error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch patient');
  }
};

const createPatient = async (req, res) => {
  try {
    if (!req.body.full_name) return errorResponse(res, 400, 'Full name is required');
    if (req.body.phone && req.body.phone.trim() !== '') {
      const cleanedPhone = req.body.phone.trim();
      const existing = await pool.query(
        'SELECT id, full_name, patient_number FROM patients WHERE phone = $1 AND pharmacy_id = $2 AND is_active = true LIMIT 1',
        [cleanedPhone, req.pharmacy_id]
      );
      if (existing.rows.length > 0) {
        return errorResponse(res, 400, `Patient with this phone number is already registered (${existing.rows[0].full_name} - ${existing.rows[0].patient_number}).`);
      }
    }
    const patient = await PatientModel.create({ ...req.body, pharmacy_id: req.pharmacy_id });
    logger.info('Patient registered: ' + patient.patient_number);
    return successResponse(res, 201, 'Patient registered', patient);
  } catch (error) {
    logger.error('Create patient error:', error.message);
    return errorResponse(res, 500, error.message || 'Failed to register patient');
  }
};

const updatePatient = async (req, res) => {
  try {
    if (req.body.phone && req.body.phone.trim() !== '') {
      const cleanedPhone = req.body.phone.trim();
      const existing = await pool.query(
        'SELECT id, full_name, patient_number FROM patients WHERE phone = $1 AND pharmacy_id = $2 AND id != $3 AND is_active = true LIMIT 1',
        [cleanedPhone, req.pharmacy_id, req.params.id]
      );
      if (existing.rows.length > 0) {
        return errorResponse(res, 400, `Another patient with this phone number is already registered (${existing.rows[0].full_name} - ${existing.rows[0].patient_number}).`);
      }
    }
    const patient = await PatientModel.update(req.params.id, req.pharmacy_id, req.body);
    if (!patient) return errorResponse(res, 404, 'Patient not found');
    return successResponse(res, 200, 'Patient updated', patient);
  } catch (error) {
    logger.error('Update patient error:', error.message);
    return errorResponse(res, 500, 'Failed to update patient');
  }
};

const createVisit = async (req, res) => {
  try {
    const { patient_id } = req.params;
    const patient = await PatientModel.findById(patient_id, req.pharmacy_id);
    if (!patient) return errorResponse(res, 404, 'Patient not found');

    // Prevent duplicate active/open visits for the same patient at once
    const activeVisit = await pool.query(`
      SELECT id, visit_number, status FROM visits 
      WHERE patient_id = $1 AND pharmacy_id = $2 AND status NOT IN ('COMPLETED', 'discharged', 'cancelled', 'ARCHIVED') 
      LIMIT 1
    `, [patient_id, req.pharmacy_id]);

    if (activeVisit.rows.length > 0) {
      return errorResponse(res, 400, `Patient already has an active check-in/encounter running (${activeVisit.rows[0].visit_number} in status ${activeVisit.rows[0].status.toUpperCase()}). Please discharge or complete the current visit first.`);
    }

    const { visit_type, priority, chief_complaint, notes, consultation_fee, fee_paid, payment_method, mch_service, department, status } = req.body;

    let finalFee = consultation_fee;
    if (visit_type === 'mch' && mch_service) {
      const mchFees = { mch_anc: 500, mch_pnc: 500, mch_cwc: 300, mch_immunization: 200, mch_fp: 300 };
      finalFee = mchFees[mch_service] || 300;
    } else if (visit_type === 'revisit') {
      // Find the most recent visit of this patient
      const lastVisitRes = await pool.query(`
        SELECT created_at FROM visits 
        WHERE patient_id = $1 AND pharmacy_id = $2 
        ORDER BY created_at DESC LIMIT 1
      `, [patient_id, req.pharmacy_id]);

      if (lastVisitRes.rows.length > 0) {
        const lastVisitDate = new Date(lastVisitRes.rows[0].created_at);
        const diffDays = Math.ceil(Math.abs(new Date() - lastVisitDate) / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) {
          finalFee = 0; // Waived
        } else {
          finalFee = 500; // Standard revisit fee
        }
      } else {
        finalFee = 500;
      }
    }

    const visit = await VisitModel.create({
      pharmacy_id: req.pharmacy_id,
      patient_id,
      visit_type,
      priority,
      chief_complaint,
      notes,
      consultation_fee: finalFee,
      fee_paid,
      payment_method,
      mch_service,
      department: department || (visit_type === 'mch' ? 'mch' : 'triage'),
      status: status || (visit_type === 'mch' || department === 'mch' ? 'mch' : 'WAITING_TRIAGE'),
      created_by: req.user.id,
    });

    // Create billing item synchronously
    if (visit_type === 'mch' && mch_service) {
      try {
        const { pool } = require('../config/db');
        const isPaid = !!fee_paid;
        const mchFees = { mch_anc: 500, mch_pnc: 500, mch_cwc: 300, mch_immunization: 200, mch_fp: 300 };
        const fee = mchFees[mch_service] || 300;
        const description = mch_service.replace(/^mch_/, '').toUpperCase() + ' Clinic Service';

        await pool.query(`
          INSERT INTO billing_items (facility_id, visit_id, patient_id, item_name, item_type, unit_price, quantity, status, payment_method, paid_at)
          VALUES ($1,$2,$3,$4,'mch',$5,1,$6,$7,$8)
        `, [
          req.pharmacy_id,
          visit.id,
          patient_id,
          description,
          fee,
          isPaid ? 'paid' : 'pending',
          isPaid ? (payment_method || 'cash') : null,
          isPaid ? new Date() : null
        ]);
      } catch (billErr) {
        logger.error('Failed to record MCH service fee billing in patient.controller:', billErr.message);
      }
    } else if (finalFee && parseFloat(finalFee) > 0) {
      try {
        const { pool } = require('../config/db');
        const isPaid = !!fee_paid;
        await pool.query(`
          INSERT INTO billing_items (facility_id, visit_id, patient_id, item_name, item_type, unit_price, quantity, status, payment_method, paid_at)
          VALUES ($1,$2,$3,'Consultation Fee','consultation',$4,1,$5,$6,$7)
        `, [
          req.pharmacy_id,
          visit.id,
          patient_id,
          parseFloat(finalFee),
          isPaid ? 'paid' : 'pending',
          isPaid ? (payment_method || 'cash') : null,
          isPaid ? new Date() : null
        ]);
      } catch (billErr) {
        logger.error('Failed to record consultation fee billing in patient.controller:', billErr.message);
      }
    }

    logger.info('Visit created: ' + visit.visit_number);
    const io = req.app.get('io');
    if (io) {
      io.emit(`visit_opened_${req.pharmacy_id}`, { visit_id: visit.id, visit_type, patient_id });
      io.emit(`queue_update_${req.pharmacy_id}`, { visit_id: visit.id, status: visit.status, action: 'create' });
    }
    return successResponse(res, 201, 'Visit created', visit);
  } catch (error) {
    logger.error('Create visit error:', error.message, error.stack);
    return errorResponse(res, 500, error.message || 'Failed to create visit');
  }
};

const getVisits = async (req, res) => {
  try {
    const { status, visit_type, date, date_from, date_to, limit, offset } = req.query;
    const targetDate = (!date && !date_from && !date_to) ? new Date().toISOString().split('T')[0] : date;
    const visits = await VisitModel.findAll({ 
      pharmacy_id: req.pharmacy_id, 
      status, 
      visit_type, 
      date: targetDate, 
      date_from, 
      date_to, 
      limit: limit ? parseInt(limit, 10) : 1000, 
      offset: offset ? parseInt(offset, 10) : 0 
    });
    const stats = await VisitModel.getDailyStats(req.pharmacy_id, targetDate || date_from);
    return successResponse(res, 200, 'Visits fetched', { visits, stats });
  } catch (error) {
    logger.error('Get visits error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch visits');
  }
};

const updateVisitStatus = async (req, res) => {
  try {
    const { status, mch_service } = req.body;
    if (status === 'mch' && mch_service) {
      try {
        const mchFees = { mch_anc: 500, mch_pnc: 500, mch_cwc: 300, mch_immunization: 200, mch_fp: 300 };
        const fee = mchFees[mch_service] || 300;
        const description = mch_service.replace(/^mch_/, '').toUpperCase() + ' Service';

        // Check if there's already a Consultation Fee billing item for this visit
        const existingConsultation = await pool.query(
          "SELECT id FROM billing_items WHERE visit_id=$1 AND item_type='consultation' AND facility_id=$2 LIMIT 1",
          [req.params.id, req.pharmacy_id]
        );

        if (existingConsultation.rows[0]) {
          // Update existing consultation fee to represent the MCH clinic service
          await pool.query(`
            UPDATE billing_items
            SET item_name=$1, item_type='mch'
            WHERE id=$2 AND facility_id=$3
          `, [description, existingConsultation.rows[0].id, req.pharmacy_id]);
        } else {
          // Check if this MCH service has already been billed for this visit
          const existingMCH = await pool.query(
            "SELECT id FROM billing_items WHERE visit_id=$1 AND item_name=$2 AND facility_id=$3 LIMIT 1",
            [req.params.id, description, req.pharmacy_id]
          );

          if (!existingMCH.rows[0]) {
            const v = await pool.query('SELECT patient_id, fee_paid, payment_method FROM visits WHERE id=$1', [req.params.id]);
            const patientId = v.rows[0]?.patient_id;
            const isPaid = !!v.rows[0]?.fee_paid;
            const paymentMethod = v.rows[0]?.payment_method || 'cash';

            await pool.query(`
              INSERT INTO billing_items (facility_id, visit_id, patient_id, item_name, item_type, unit_price, quantity, status, payment_method, paid_at)
              VALUES ($1, $2, $3, $4, 'mch', $5, 1, $6, $7, $8)
            `, [
              req.pharmacy_id,
              req.params.id,
              patientId,
              description,
              fee,
              isPaid ? 'paid' : 'pending',
              isPaid ? paymentMethod : null,
              isPaid ? new Date() : null
            ]);
          }
        }
      } catch(e) { logger.error('MCH billing error:', e.message); }
    }
    const visit = await VisitModel.updateStatus(req.params.id, req.pharmacy_id, status, mch_service, req.body.department);
    if (!visit) return errorResponse(res, 404, 'Visit not found');
    const io = req.app.get('io');
    if (io) io.emit('queue_update_' + req.pharmacy_id, { visit_id: req.params.id, status });
    return successResponse(res, 200, 'Visit status updated', visit);
  } catch (error) {
    logger.error('Update visit status error:', error.message);
    return errorResponse(res, 500, 'Failed to update visit status');
  }
};

const addVitals = async (req, res) => {
  try {
    let visit = await VisitModel.findById(req.params.visit_id, req.pharmacy_id);
    let patientId = visit?.patient_id;
    if (!patientId) {
      const vRes = await pool.query(
        'SELECT patient_id FROM visits WHERE id::text = $1 LIMIT 1',
        [String(req.params.visit_id)]
      );
      patientId = vRes.rows[0]?.patient_id || req.body.patient_id || null;
    }

    const vitals = await VisitModel.addVitals({
      ...req.body,
      pharmacy_id: req.pharmacy_id || req.user?.pharmacy_id,
      visit_id: req.params.visit_id,
      patient_id: patientId,
      recorded_by: req.user?.id,
    });
    return successResponse(res, 201, 'Vitals recorded successfully', vitals);
  } catch (error) {
    logger.error('Add vitals error:', error.message);
    return errorResponse(res, 500, 'Failed to record vitals: ' + error.message);
  }
};

const getPatientHistory = async (req, res) => {
  try {
    const { search, date_from, date_to, limit = 1000, offset = 0 } = req.query;
    const params = [req.pharmacy_id ? String(req.pharmacy_id) : null];
    let where = '';
    if (search) {
      params.push('%' + search + '%');
      const n = params.length;
      where += ` AND (p.full_name ILIKE $${n} OR p.patient_number ILIKE $${n} OR p.phone ILIKE $${n} OR v.visit_number ILIKE $${n})`;
    }
    if (date_from) { params.push(date_from); where += ` AND DATE(v.created_at) >= $${params.length}`; }
    if (date_to)   { params.push(date_to);   where += ` AND DATE(v.created_at) <= $${params.length}`; }
    params.push(parseInt(limit));
    const li = params.length;
    params.push(parseInt(offset));
    const oi = params.length;
    const query = `
      SELECT v.*, p.full_name as patient_name, p.patient_number, p.gender, p.date_of_birth,
        p.phone, p.allergies, p.blood_group,
        c.diagnosis, c.presenting_complaint, c.management_plan, c.icd_code,
        c.examination_findings, c.history_of_illness, c.follow_up_date, c.follow_up_notes,
        c.id as consultation_id, u.full_name as doctor_name
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      LEFT JOIN consultations c ON v.id = c.visit_id
      LEFT JOIN users u ON c.doctor_id = u.id
      WHERE (v.pharmacy_id::text = $1::text OR v.pharmacy_id IS NULL OR $1 IS NULL) ${where}
      ORDER BY v.created_at DESC
      LIMIT $${li} OFFSET $${oi}
    `;
    const result = await pool.query(query, params);
    return successResponse(res, 200, 'History fetched', result.rows);
  } catch (error) {
    logger.error('Get patient history error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch history');
  }
};

const getMOHReport = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const to   = date_to   || new Date().toISOString().split('T')[0];
    const result = await pool.query(`
      SELECT c.diagnosis, c.icd_code,
        COUNT(CASE WHEN EXTRACT(YEAR FROM AGE(p.date_of_birth)) < 5 AND p.gender='male'   THEN 1 END) as under5_male,
        COUNT(CASE WHEN EXTRACT(YEAR FROM AGE(p.date_of_birth)) < 5 AND p.gender='female' THEN 1 END) as under5_female,
        COUNT(CASE WHEN EXTRACT(YEAR FROM AGE(p.date_of_birth)) >= 5 AND p.gender='male'  THEN 1 END) as over5_male,
        COUNT(CASE WHEN EXTRACT(YEAR FROM AGE(p.date_of_birth)) >= 5 AND p.gender='female' THEN 1 END) as over5_female,
        COUNT(*) as total
      FROM consultations c
      JOIN visits v ON c.visit_id = v.id
      JOIN patients p ON c.patient_id = p.id
      WHERE c.pharmacy_id = $1 AND DATE(v.created_at) BETWEEN $2 AND $3
        AND c.diagnosis IS NOT NULL AND c.diagnosis != ''
      GROUP BY c.diagnosis, c.icd_code
      ORDER BY total DESC
    `, [req.pharmacy_id, from, to]);
    return successResponse(res, 200, 'MOH report fetched', { from, to, data: result.rows });
  } catch (error) {
    logger.error('MOH report error:', error.message);
    return errorResponse(res, 500, 'Failed to generate MOH report');
  }
};

module.exports = {
  getPatients, getPatient, createPatient, updatePatient,
  createVisit, getVisits, updateVisitStatus, addVitals,
  getPatientHistory, getMOHReport
};
