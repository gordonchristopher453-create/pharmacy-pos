const VisitModel = require('../models/visit.model');
const ServiceOrderModel = require('../models/serviceOrder.model');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

const openVisit = async (req, res) => {
  try {
    const { patient_id, visit_type, priority, chief_complaint, notes, consultation_fee, fee_paid, payment_method, mch_service } = req.body;
    if (!patient_id) return errorResponse(res, 400, 'patient_id is required');

    // Prevent duplicate open visit for the same patient
    const { pool } = require('../config/db');
    const existing = await pool.query(
      "SELECT id FROM visits WHERE patient_id=$1 AND pharmacy_id=$2 AND status NOT IN ('discharged','cancelled') LIMIT 1",
      [patient_id, req.pharmacy_id]
    );
    if (existing.rows.length > 0) {
      return errorResponse(res, 409, 'Patient already has an open visit: ' + existing.rows[0].id);
    }

    let finalFee = consultation_fee;
    if (visit_type === 'mch' && mch_service) {
      const mchFees = { mch_anc: 500, mch_pnc: 500, mch_cwc: 300, mch_immunization: 200, mch_fp: 300 };
      finalFee = mchFees[mch_service] || 300;
    }

    const visit = await VisitModel.create({
      pharmacy_id: req.pharmacy_id, patient_id, visit_type, priority, chief_complaint,
      created_by: req.user.id, notes, consultation_fee: finalFee, fee_paid, payment_method, mch_service
    });

    // If visit_type is MCH, record its service fee in billing_items
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
        logger.error('Failed to record MCH service fee billing:', billErr.message);
      }
    } else if (finalFee && parseFloat(finalFee) > 0) {
      // If consultation fee is set, record it in billing_items
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
        logger.error('Failed to record consultation fee billing:', billErr.message);
      }
    }

    const io = req.app.get('io');
    if (io) io.emit(`visit_opened_${req.pharmacy_id}`, { visit_id: visit.id, visit_type, patient_id });
    return successResponse(res, 201, 'Visit opened', visit);
  } catch (e) { logger.error('Open visit error:', e.message); return errorResponse(res, 500, e.message); }
};

const getVisit = async (req, res) => {
  try {
    const visit = await VisitModel.findById(req.params.id, req.pharmacy_id);
    if (!visit) return errorResponse(res, 404, 'Visit not found');
    return successResponse(res, 200, 'Visit fetched', visit);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

const getVisits = async (req, res) => {
  try {
    const visits = await VisitModel.findAll({ pharmacy_id: req.pharmacy_id, ...req.query });
    return successResponse(res, 200, 'Visits fetched', visits);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

const getActiveVisits = async (req, res) => {
  try {
    const { pool } = require('../config/db');
    const result = await pool.query(`
      SELECT v.*, p.full_name as patient_name, p.patient_number, p.phone, p.gender, p.date_of_birth
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      WHERE (v.pharmacy_id = $1 OR v.pharmacy_id IS NULL)
        AND v.status NOT IN ('discharged', 'cancelled', 'completed', 'COMPLETED')
      ORDER BY v.created_at DESC
    `, [req.pharmacy_id]);
    return successResponse(res, 200, 'Active visits fetched', result.rows);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

const updateVisitStatus = async (req, res) => {
  try {
    // 🚫 Receptionist can only send patient to triage
    if (req.user.role === 'receptionist' || req.user.role === 'reception') {
      const allowed = ['triaged', 'waiting', 'open', 'REGISTERED', 'WAITING_TRIAGE', 'IN_TRIAGE'];
      if (!allowed.includes(req.body.status)) {
        return errorResponse(res, 403, 'Receptionist can only send patient to triage. Nurse must forward to OPD/MCH.');
      }
      // Force department to 'triage' if status is triage-related
      if (['triaged', 'WAITING_TRIAGE', 'IN_TRIAGE'].includes(req.body.status)) {
        req.body.department = 'triage';
      }
    }

    // 🔒 Enforce Visit Completion Rules
    const targetStatus = (req.body.status || '').toLowerCase();
    if (['completed', 'discharged'].includes(targetStatus)) {
      const forceComplete = req.body.force === true;
      if (!forceComplete) {
        const blockers = await VisitModel.checkVisitCompletionBlockers(req.params.id, req.pharmacy_id);
        if (blockers.length > 0) {
          return errorResponse(
            res,
            400,
            `Cannot complete visit due to active items: ${blockers.join('; ')}`,
            { blockers }
          );
        }
      }
    }

    const visit = await VisitModel.updateStatus(req.params.id, req.pharmacy_id, req.body.status, req.body.mch_service, req.body.department);
    if (!visit) return errorResponse(res, 404, 'Visit not found');
    const io = req.app.get('io');
    if (io) io.emit(`visit_updated_${req.pharmacy_id}`, { visit_id: visit.id, status: visit.status });
    return successResponse(res, 200, 'Visit updated', visit);
  } catch (e) { return errorResponse(res, 400, e.message); }
};

const createServiceOrder = async (req, res) => {
  try {
    const { visit_id } = req.params;
    const { pool } = require('../config/db');
    const vRes = await pool.query('SELECT patient_id FROM visits WHERE id=$1 AND pharmacy_id=$2', [visit_id, req.pharmacy_id]);
    if (!vRes.rows[0]) return require('../utils/response').errorResponse(res, 404, 'Visit not found');
    const patient_id = vRes.rows[0].patient_id;
    const result = await ServiceOrderModel.create({
      pharmacy_id: req.pharmacy_id,
      visit_id: visit_id,
      patient_id: patient_id,
      ordered_by: req.user.id,
      ...req.body
    });
    const io = req.app.get('io');
    if (io) {
      io.emit(`service_order_${req.pharmacy_id}_${result.service_order.assigned_to_dept}`, result.service_order);
      io.emit(`billing_updated_${req.pharmacy_id}`, { visit_id, billing_item: result.billing_item });
    }
    return successResponse(res, 201, 'Service order created', result);
  } catch (e) { logger.error('Service order error:', e.message); return errorResponse(res, 500, e.message); }
};

const updateServiceOrder = async (req, res) => {
  try {
    const { status, result_notes } = req.body;
    const so = await ServiceOrderModel.updateStatus(req.params.id, req.pharmacy_id, {
      status, fulfilled_by: req.user.id, result_notes
    });
    if (!so) return errorResponse(res, 404, 'Service order not found');
    const io = req.app.get('io');
    if (io) io.emit(`service_order_updated_${req.pharmacy_id}`, so);
    return successResponse(res, 200, 'Service order updated', so);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

const getDeptOrders = async (req, res) => {
  try {
    const { dept } = req.params;
    const { status } = req.query;
    const orders = await ServiceOrderModel.findByDept(dept, req.pharmacy_id, status);
    return successResponse(res, 200, 'Department orders fetched', orders);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

const getBillingByVisit = async (req, res) => {
  try {
    const { pool } = require('../config/db');
    const items = await pool.query(`
      SELECT bi.*, so.order_type FROM billing_items bi
      LEFT JOIN service_orders so ON bi.service_order_id=so.id
      WHERE bi.visit_id=$1 AND bi.pharmacy_id=$2 ORDER BY bi.created_at DESC
    `, [req.params.visit_id, req.pharmacy_id]);
    const total = items.rows.reduce((s,i)=>s+parseFloat(i.total_price||0),0);
    const paid  = items.rows.filter(i=>i.status!=='pending').reduce((s,i)=>s+parseFloat(i.total_price||0),0);
    return successResponse(res, 200, 'Billing fetched', { items: items.rows, total, paid, balance: total-paid });
  } catch (e) { return errorResponse(res, 500, e.message); }
};

const payBillingItem = async (req, res) => {
  try {
    const { pool } = require('../config/db');
    const { payment_method } = req.body;
    const result = await pool.query(`
      UPDATE billing_items SET status='paid', payment_method=$1, paid_at=NOW(), updated_at=NOW()
      WHERE id=$2 AND pharmacy_id=$3 RETURNING *
    `, [payment_method||'cash', req.params.id, req.pharmacy_id]);
    if (!result.rows[0]) return errorResponse(res, 404, 'Billing item not found');
    return successResponse(res, 200, 'Payment recorded', result.rows[0]);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

module.exports = { openVisit, getVisit, getVisits, getActiveVisits, updateVisitStatus, createServiceOrder, updateServiceOrder, getDeptOrders, getBillingByVisit, payBillingItem };
