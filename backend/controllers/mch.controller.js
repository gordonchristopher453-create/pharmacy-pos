const MCHModel = require('../models/mch.model');
const ServiceOrderModel = require('../models/serviceOrder.model');
const { pool } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

const registerANC = async (req, res) => {
  try {
    const data = { ...req.body, pharmacy_id: req.pharmacy_id, created_by: req.user.id };
    if (!data.patient_id) return errorResponse(res, 400, 'Patient is required');
    if (!data.anc_number) {
      const pRes = await pool.query('SELECT patient_number FROM patients WHERE id = $1', [data.patient_id]);
      if (pRes.rows[0]) data.anc_number = pRes.rows[0].patient_number;
    }
    const anc = await MCHModel.registerANC(data);
    return successResponse(res, 201, 'ANC registration successful', anc);
  } catch (e) {
    logger.error('Register ANC error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const getANCList = async (req, res) => {
  try {
    const list = await MCHModel.getANCList(req.pharmacy_id, req.query.search || '');
    return successResponse(res, 200, 'ANC list fetched', list);
  } catch (e) {
    logger.error('Get ANC list error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const getANCById = async (req, res) => {
  try {
    const anc = await MCHModel.getANCById(req.params.id, req.pharmacy_id);
    if (!anc) return errorResponse(res, 404, 'ANC record not found');
    const [visits, profile] = await Promise.all([
      MCHModel.getANCVisits(req.params.id),
      MCHModel.getANCProfile(req.params.id),
    ]);
    return successResponse(res, 200, 'ANC record fetched', { ...anc, visits, profile });
  } catch (e) {
    logger.error('Get ANC error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const updateANC = async (req, res) => {
  try {
    const anc = await MCHModel.updateANC(req.params.id, req.pharmacy_id, req.body);
    return successResponse(res, 200, 'ANC updated', anc);
  } catch (e) {
    logger.error('Update ANC error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const addANCVisit = async (req, res) => {
  try {
    const data = { ...req.body, anc_id: req.params.id, pharmacy_id: req.pharmacy_id, created_by: req.user.id };
    const visit = await MCHModel.addANCVisit(data);
    return successResponse(res, 201, 'ANC visit recorded', visit);
  } catch (e) {
    logger.error('Add ANC visit error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const saveANCProfile = async (req, res) => {
  try {
    const data = { ...req.body, anc_id: req.params.id, pharmacy_id: req.pharmacy_id };
    const profile = await MCHModel.saveANCProfile(data);
    return successResponse(res, 200, 'ANC profile saved', profile);
  } catch (e) {
    logger.error('Save ANC profile error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const addPNCVisit = async (req, res) => {
  try {
    const data = { ...req.body, pharmacy_id: req.pharmacy_id, created_by: req.user.id };
    if (!data.patient_id) return errorResponse(res, 400, 'Patient is required');
    const visit = await MCHModel.addPNCVisit(data);
    return successResponse(res, 201, 'PNC visit recorded', visit);
  } catch (e) {
    logger.error('Add PNC visit error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const getPNCVisits = async (req, res) => {
  try {
    const visits = await MCHModel.getPNCVisits(req.pharmacy_id, req.query.patient_id);
    return successResponse(res, 200, 'PNC visits fetched', visits);
  } catch (e) {
    logger.error('Get PNC error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const addCWCRecord = async (req, res) => {
  try {
    const data = { ...req.body, pharmacy_id: req.pharmacy_id, created_by: req.user.id };
    if (!data.patient_id) return errorResponse(res, 400, 'Patient is required');
    const record = await MCHModel.addCWCRecord(data);
    return successResponse(res, 201, 'CWC record saved', record);
  } catch (e) {
    logger.error('Add CWC error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const getCWCRecords = async (req, res) => {
  try {
    const records = await MCHModel.getCWCRecords(req.pharmacy_id, req.query.patient_id);
    return successResponse(res, 200, 'CWC records fetched', records);
  } catch (e) {
    logger.error('Get CWC error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const addImmunization = async (req, res) => {
  try {
    const data = { ...req.body, pharmacy_id: req.pharmacy_id, created_by: req.user.id };
    if (!data.patient_id || !data.vaccine) return errorResponse(res, 400, 'Patient and vaccine are required');
    const imm = await MCHModel.addImmunization(data);

    // Deduct stock from MCH Stock
    let stockItem = null;
    const { mch_stock_id } = req.body;
    if (mch_stock_id) {
      const stockRes = await pool.query(
        `SELECT * FROM mch_stock WHERE id=$1 AND pharmacy_id=$2 AND is_active=true`,
        [mch_stock_id, req.pharmacy_id]
      );
      if (stockRes.rows.length > 0) {
        stockItem = stockRes.rows[0];
      }
    } else {
      // Find by name
      const stockRes = await pool.query(
        `SELECT * FROM mch_stock WHERE name ILIKE $1 AND category='vaccine' AND pharmacy_id=$2 AND is_active=true AND quantity > 0 LIMIT 1`,
        [data.vaccine, req.pharmacy_id]
      );
      if (stockRes.rows.length > 0) {
        stockItem = stockRes.rows[0];
      }
    }

    if (stockItem && stockItem.quantity > 0) {
      await pool.query(
        `UPDATE mch_stock SET quantity = quantity - 1, updated_at = NOW() WHERE id=$1`,
        [stockItem.id]
      );
      await pool.query(
        `INSERT INTO mch_stock_movements (pharmacy_id, mch_stock_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
         VALUES ($1, $2, 'out', 1, 'immunization', $3, $4, $5)`,
        [req.pharmacy_id, stockItem.id, imm.id, `Administered vaccine: ${data.vaccine}`, req.user.id]
      );
    }

    // Create service order for billing
    if (req.body.visit_id) {
      try {
        await ServiceOrderModel.create({
          pharmacy_id: req.pharmacy_id,
          visit_id: req.body.visit_id,
          patient_id: data.patient_id,
          order_type: 'vaccine',
          ordered_by: req.user.id,
          ordered_by_dept: 'mch',
          assigned_to_dept: 'immunization',
          vaccine_name: data.vaccine,
          vaccine_code: data.vaccine_code || null,
          dose_number: data.dose_number || 1,
          vaccine_price: data.vaccine_price || 0,
        });
      } catch (svcErr) {
        logger.error('MCH immunization service order failed:', svcErr.message);
      }
    }

    return successResponse(res, 201, 'Immunization recorded', imm);
  } catch (e) {
    logger.error('Add immunization error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const getImmunizations = async (req, res) => {
  try {
    const imm = await MCHModel.getImmunizations(req.pharmacy_id, req.query.patient_id);
    return successResponse(res, 200, 'Immunizations fetched', imm);
  } catch (e) {
    logger.error('Get immunizations error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const getDueImmunizations = async (req, res) => {
  try {
    const due = await MCHModel.getDueImmunizations(req.pharmacy_id);
    return successResponse(res, 200, 'Due immunizations fetched', due);
  } catch (e) {
    logger.error('Get due immunizations error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const addFamilyPlanning = async (req, res) => {
  try {
    const data = { ...req.body, pharmacy_id: req.pharmacy_id, created_by: req.user.id };
    if (!data.patient_id || !data.method) return errorResponse(res, 400, 'Patient and method are required');
    const fp = await MCHModel.addFamilyPlanning(data);

    // Deduct stock from MCH Stock (FP Supply)
    let stockItem = null;
    const { mch_stock_id } = req.body;
    if (mch_stock_id) {
      const stockRes = await pool.query(
        `SELECT * FROM mch_stock WHERE id=$1 AND pharmacy_id=$2 AND is_active=true`,
        [mch_stock_id, req.pharmacy_id]
      );
      if (stockRes.rows.length > 0) {
        stockItem = stockRes.rows[0];
      }
    } else {
      // Try to find matching stock item by method name
      const stockRes = await pool.query(
        `SELECT * FROM mch_stock WHERE name ILIKE $1 AND category='fp_supply' AND pharmacy_id=$2 AND is_active=true AND quantity > 0 LIMIT 1`,
        [data.method, req.pharmacy_id]
      );
      if (stockRes.rows.length > 0) {
        stockItem = stockRes.rows[0];
      }
    }

    if (stockItem && stockItem.quantity > 0) {
      await pool.query(
        `UPDATE mch_stock SET quantity = quantity - 1, updated_at = NOW() WHERE id=$1`,
        [stockItem.id]
      );
      await pool.query(
        `INSERT INTO mch_stock_movements (pharmacy_id, mch_stock_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
         VALUES ($1, $2, 'out', 1, 'family_planning', $3, $4, $5)`,
        [req.pharmacy_id, stockItem.id, fp.id, `Administered contraceptive: ${data.method}`, req.user.id]
      );
    }

    // Handle Billing for Family Planning administered method
    if (req.body.visit_id && req.body.price && parseFloat(req.body.price) > 0) {
      try {
        await pool.query(`
          INSERT INTO billing_items (facility_id, visit_id, patient_id, item_type, item_name, quantity, unit_price, status)
          VALUES ($1, $2, $3, 'mch', $4, 1, $5, 'pending')
        `, [
          req.pharmacy_id,
          req.body.visit_id,
          data.patient_id,
          `FP Method: ${data.method}`,
          parseFloat(req.body.price)
        ]);
      } catch (billErr) {
        logger.error('Failed to record FP billing:', billErr.message);
      }
    }

    return successResponse(res, 201, 'Family planning recorded', fp);
  } catch (e) {
    logger.error('Add FP error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const getFamilyPlanning = async (req, res) => {
  try {
    const fp = await MCHModel.getFamilyPlanning(req.pharmacy_id, req.query.patient_id);
    return successResponse(res, 200, 'Family planning fetched', fp);
  } catch (e) {
    logger.error('Get FP error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const addReferral = async (req, res) => {
  try {
    const data = { ...req.body, pharmacy_id: req.pharmacy_id, created_by: req.user.id };
    const ref = await MCHModel.addReferral(data);
    return successResponse(res, 201, 'Referral recorded', ref);
  } catch (e) {
    logger.error('Add referral error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const stats = await MCHModel.getDashboardStats(req.pharmacy_id);
    return successResponse(res, 200, 'MCH stats fetched', stats);
  } catch (e) {
    logger.error('MCH stats error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const getANCRegister = async (req, res) => {
  try {
    const { month, year } = req.query;
    const data = await MCHModel.getANCRegister(req.pharmacy_id,
      month || new Date().getMonth() + 1, year || new Date().getFullYear());
    return successResponse(res, 200, 'ANC register fetched', data);
  } catch (e) {
    logger.error('ANC register error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const getImmunizationRegister = async (req, res) => {
  try {
    const { month, year } = req.query;
    const data = await MCHModel.getImmunizationRegister(req.pharmacy_id,
      month || new Date().getMonth() + 1, year || new Date().getFullYear());
    return successResponse(res, 200, 'Immunization register fetched', data);
  } catch (e) {
    logger.error('Immunization register error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

// ─── HIGH RISK FLAGS ──────────────────────────────────────
const addHighRiskFlag = async (req, res) => {
  try {
    const data = { ...req.body, anc_id: req.params.id, created_by: req.user.id };
    const flag = await MCHModel.addHighRiskFlag(data);
    return successResponse(res, 201, 'High risk flag added', flag);
  } catch (e) {
    logger.error('Add high risk flag error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const getHighRiskFlags = async (req, res) => {
  try {
    const flags = await MCHModel.getHighRiskFlags(req.params.id);
    return successResponse(res, 200, 'High risk flags fetched', flags);
  } catch (e) {
    logger.error('Get high risk flags error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const deleteHighRiskFlag = async (req, res) => {
  try {
    await MCHModel.deleteHighRiskFlag(req.params.flagId);
    return successResponse(res, 200, 'High risk flag deleted');
  } catch (e) {
    logger.error('Delete high risk flag error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

// ─── MCH APPOINTMENTS ─────────────────────────────────────
const createMCHAppointment = async (req, res) => {
  try {
    const data = { ...req.body, pharmacy_id: req.pharmacy_id, created_by: req.user.id };
    const appointment = await MCHModel.createMCHAppointment(data);
    return successResponse(res, 201, 'Appointment created', appointment);
  } catch (e) {
    logger.error('Create appointment error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const getMCHAppointments = async (req, res) => {
  try {
    const { patient_id, date, type } = req.query;
    const appointments = await MCHModel.getMCHAppointments(req.pharmacy_id, { patient_id, date, type });
    return successResponse(res, 200, 'Appointments fetched', appointments);
  } catch (e) {
    logger.error('Get appointments error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const updateMCHAppointment = async (req, res) => {
  try {
    const appointment = await MCHModel.updateMCHAppointment(req.params.id, req.pharmacy_id, req.body);
    return successResponse(res, 200, 'Appointment updated', appointment);
  } catch (e) {
    logger.error('Update appointment error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const deleteMCHAppointment = async (req, res) => {
  try {
    await MCHModel.deleteMCHAppointment(req.params.id, req.pharmacy_id);
    return successResponse(res, 200, 'Appointment deleted');
  } catch (e) {
    logger.error('Delete appointment error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};



// ─── MOH Report Exporter Helper ──────────────────────────
const ReportExporter = require("../utils/reportExporter");

const exportMOHReport = async (res, title, columns, data, format) => {
  if (format === "excel" || format === "xlsx") {
    const workbook = await ReportExporter.toExcel(title, columns, data);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${title}.xlsx"`);
    return workbook.xlsx.write(res);
  }
  if (format === "pdf") {
    return ReportExporter.toPDF(title, columns, data, res);
  }
  return { title, columns, data };
};
// ─── MOH REPORTS ─────────────────────────────────────────
const getMOH510ANC = async (req, res) => {
  try {
    const { month, year, format } = req.query;
    const data = await MCHModel.getMOH510ANC(req.pharmacy_id,
      month || new Date().getMonth() + 1, year || new Date().getFullYear());
    const columns = [
      { key: 'serial_no', header: 'S/No' },
      { key: 'date_seen', header: 'Date Seen' },
      { key: 'anc_number', header: 'ANC No' },
      { key: 'anc_clinic_number', header: 'Clinic No' },
      { key: 'full_name', header: 'Full Name' },
      { key: 'date_of_birth', header: 'DOB' },
      { key: 'gravida', header: 'Gravida' },
      { key: 'para', header: 'Para' },
      { key: 'lmp', header: 'LMP' },
      { key: 'edd', header: 'EDD' },
      { key: 'gestation_age', header: 'Gestation(Wks)' },
      { key: 'blood_pressure', header: 'BP' },
      { key: 'weight', header: 'Weight' },
      { key: 'risk_factors', header: 'Risk Factors' },
      { key: 'next_appointment', header: 'Next Visit' },
      { key: 'status', header: 'Status' },
    ];
    const result = await exportMOHReport(res, 'MOH 510 - ANC Register', columns, data, format);
    if (result) return successResponse(res, 200, 'MOH 510 ANC Register', result);
  } catch (e) {
    logger.error('MOH 510 error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const getMOH511PNC = async (req, res) => {
  try {
    const { month, year, format } = req.query;
    const data = await MCHModel.getMOH511PNC(req.pharmacy_id,
      month || new Date().getMonth() + 1, year || new Date().getFullYear());
    const columns = [
      { key: 'serial_no', header: 'S/No' },
      { key: 'visit_date', header: 'Visit Date' },
      { key: 'full_name', header: 'Full Name' },
      { key: 'date_of_birth', header: 'DOB' },
      { key: 'delivery_date', header: 'Delivery Date' },
      { key: 'delivery_outcome', header: 'Outcome' },
      { key: 'mother_condition', header: 'Mother Condition' },
      { key: 'baby_condition', header: 'Baby Condition' },
      { key: 'feeding_method', header: 'Feeding Method' },
      { key: 'fp_counseling', header: 'FP Counseling' },
      { key: 'next_visit_date', header: 'Next Visit' },
    ];
    const result = await exportMOHReport(res, 'MOH 511 - PNC Register', columns, data, format);
    if (result) return successResponse(res, 200, 'MOH 511 PNC Register', result);
  } catch (e) {
    logger.error('MOH 511 error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const getMOH512CWC = async (req, res) => {
  try {
    const { month, year, format } = req.query;
    const data = await MCHModel.getMOH512CWC(req.pharmacy_id,
      month || new Date().getMonth() + 1, year || new Date().getFullYear());
    const columns = [
      { key: 'serial_no', header: 'S/No' },
      { key: 'visit_date', header: 'Visit Date' },
      { key: 'full_name', header: 'Full Name' },
      { key: 'date_of_birth', header: 'DOB' },
      { key: 'birth_weight', header: 'Birth Wt(kg)' },
      { key: 'current_weight', header: 'Current Wt(kg)' },
      { key: 'height', header: 'Height(cm)' },
      { key: 'muac', header: 'MUAC(cm)' },
      { key: 'nutrition_status', header: 'Nutrition Status' },
      { key: 'milestones', header: 'Milestones' },
      { key: 'notes', header: 'Notes' },
    ];
    const result = await exportMOHReport(res, 'MOH 512 - CWC Register', columns, data, format);
    if (result) return successResponse(res, 200, 'MOH 512 CWC Register', result);
  } catch (e) {
    logger.error('MOH 512 error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const getMOH513Immunization = async (req, res) => {
  try {
    const { month, year, format } = req.query;
    const data = await MCHModel.getMOH513Immunization(req.pharmacy_id,
      month || new Date().getMonth() + 1, year || new Date().getFullYear());
    const columns = [
      { key: 'serial_no', header: 'S/No' },
      { key: 'date_given', header: 'Date Given' },
      { key: 'full_name', header: 'Full Name' },
      { key: 'date_of_birth', header: 'DOB' },
      { key: 'vaccine', header: 'Vaccine' },
      { key: 'dose', header: 'Dose' },
      { key: 'batch_number', header: 'Batch No' },
      { key: 'next_due_date', header: 'Next Due' },
      { key: 'notes', header: 'Notes' },
    ];
    const result = await exportMOHReport(res, 'MOH 513 - Immunization Register', columns, data, format);
    if (result) return successResponse(res, 200, 'MOH 513 Immunization Register', result);
  } catch (e) {
    logger.error('MOH 513 error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const getMOH514FamilyPlanning = async (req, res) => {
  try {
    const { month, year, format } = req.query;
    const data = await MCHModel.getMOH514FamilyPlanning(req.pharmacy_id,
      month || new Date().getMonth() + 1, year || new Date().getFullYear());
    const columns = [
      { key: 'serial_no', header: 'S/No' },
      { key: 'visit_date', header: 'Visit Date' },
      { key: 'full_name', header: 'Full Name' },
      { key: 'date_of_birth', header: 'DOB' },
      { key: 'method', header: 'Method' },
      { key: 'start_date', header: 'Start Date' },
      { key: 'follow_up_date', header: 'Follow Up' },
      { key: 'side_effects', header: 'Side Effects' },
      { key: 'counseling_notes', header: 'Notes' },
    ];
    const result = await exportMOHReport(res, 'MOH 514 - Family Planning Register', columns, data, format);
    if (result) return successResponse(res, 200, 'MOH 514 FP Register', result);
  } catch (e) {
    logger.error('MOH 514 error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const getMOH515Delivery = async (req, res) => {
  try {
    const { month, year, format } = req.query;
    const data = await MCHModel.getMOH515Delivery(req.pharmacy_id,
      month || new Date().getMonth() + 1, year || new Date().getFullYear());
    const columns = [
      { key: 'serial_no', header: 'S/No' },
      { key: 'delivery_date', header: 'Delivery Date' },
      { key: 'full_name', header: 'Full Name' },
      { key: 'date_of_birth', header: 'DOB' },
      { key: 'gestation_weeks', header: 'Gest(Wks)' },
      { key: 'mode_of_delivery', header: 'Mode' },
      { key: 'presentation', header: 'Presentation' },
      { key: 'mother_status', header: 'Mother Status' },
      { key: 'baby_status', header: 'Baby Status' },
      { key: 'birth_weight', header: 'Birth Wt(kg)' },
      { key: 'sex_of_baby', header: 'Sex' },
      { key: 'apgar_1min', header: 'Apgar 1min' },
      { key: 'apgar_5min', header: 'Apgar 5min' },
      { key: 'complications', header: 'Complications' },
      { key: 'blood_loss_ml', header: 'Blood Loss(ml)' },
    ];
    const result = await exportMOHReport(res, 'MOH 515 - Delivery Register', columns, data, format);
    if (result) return successResponse(res, 200, 'MOH 515 Delivery Register', result);
  } catch (e) {
    logger.error('MOH 515 error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const getMCHMonthlySummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    const data = await MCHModel.getMCHMonthlySummary(req.pharmacy_id,
      month || new Date().getMonth() + 1, year || new Date().getFullYear());
    return successResponse(res, 200, 'MCH Monthly Summary', data);
  } catch (e) {
    logger.error('MCH summary error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};


// ─── DELIVERY REGISTER ──────────────────────────────────
const addDeliveryRecord = async (req, res) => {
  try {
    const data = { ...req.body, pharmacy_id: req.pharmacy_id, created_by: req.user.id };
    const record = await MCHModel.addDeliveryRecord(data);
    return successResponse(res, 201, 'Delivery record added', record);
  } catch (e) {
    logger.error('Add delivery record error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const getDeliveryRecords = async (req, res) => {
  try {
    const { patient_id, date_from, date_to } = req.query;
    const records = await MCHModel.getDeliveryRecords(req.pharmacy_id, { patient_id, date_from, date_to });
    return successResponse(res, 200, 'Delivery records fetched', records);
  } catch (e) {
    logger.error('Get delivery records error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const getDeliveryById = async (req, res) => {
  try {
    const record = await MCHModel.getDeliveryById(req.params.id, req.pharmacy_id);
    if (!record) return errorResponse(res, 404, 'Delivery record not found');
    return successResponse(res, 200, 'Delivery record fetched', record);
  } catch (e) {
    logger.error('Get delivery error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};

const updateDeliveryRecord = async (req, res) => {
  try {
    const record = await MCHModel.updateDeliveryRecord(req.params.id, req.pharmacy_id, req.body);
    return successResponse(res, 200, 'Delivery record updated', record);
  } catch (e) {
    logger.error('Update delivery record error:', e.message);
    return errorResponse(res, 500, e.message);
  }
};


// ── MCH QUEUE ────────────────────────────────────────────────
const getMCHQueue = async (req, res) => {
  try {
    const { date } = req.query;
    const d = date || new Date().toISOString().split('T')[0];
    const result = await pool.query(`
      SELECT v.*, v.created_at as visit_date, p.full_name as patient_name, v.mch_service, p.patient_number,
        p.gender, p.date_of_birth, p.phone,
        vt.blood_pressure_systolic, vt.blood_pressure_diastolic,
        vt.pulse_rate, vt.temperature, vt.weight, vt.oxygen_saturation
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      LEFT JOIN vitals vt ON v.id::text = vt.visit_id::text
      WHERE v.pharmacy_id::text = $1::text AND v.status = 'mch' AND DATE(v.created_at) = $2
      ORDER BY CASE v.priority WHEN 'emergency' THEN 1 WHEN 'urgent' THEN 2 ELSE 3 END, v.created_at DESC
    `, [req.pharmacy_id, d]);
    return res.json({ success: true, message: 'MCH queue fetched', data: result.rows });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to fetch MCH queue' });
  }
};

module.exports = {
  getMCHQueue,
  registerANC, getANCList, getANCById, updateANC, addANCVisit, saveANCProfile,
  addPNCVisit, getPNCVisits, addCWCRecord, getCWCRecords,
  addImmunization, getImmunizations, getDueImmunizations,
  addFamilyPlanning, getFamilyPlanning, addReferral,
  getDashboardStats, getANCRegister, getImmunizationRegister,
  addHighRiskFlag, getHighRiskFlags, deleteHighRiskFlag,
  createMCHAppointment, getMCHAppointments, updateMCHAppointment, deleteMCHAppointment,
  addDeliveryRecord, getDeliveryRecords, getDeliveryById, updateDeliveryRecord,
  getMOH510ANC, getMOH511PNC, getMOH512CWC, getMOH513Immunization,
  getMOH514FamilyPlanning, getMOH515Delivery, getMCHMonthlySummary,
};

const saveObstetricHistory = async (req, res) => {
  try {
    const data = await MCHModel.saveObstetricHistory(req.params.id, req.pharmacy_id, req.body.rows || []);
    return successResponse(res, 200, 'Obstetric history saved', data);
  } catch(e) { return errorResponse(res, 500, e.message); }
};

const getObstetricHistory = async (req, res) => {
  try {
    const data = await MCHModel.getObstetricHistory(req.params.id);
    return successResponse(res, 200, 'Obstetric history fetched', data);
  } catch(e) { return errorResponse(res, 500, e.message); }
};

const upsertSerologyTest = async (req, res) => {
  try {
    const data = await MCHModel.upsertSerologyTest({ ...req.body, anc_id: req.params.id, pharmacy_id: req.pharmacy_id });
    return successResponse(res, 200, 'Serology test saved', data);
  } catch(e) { return errorResponse(res, 500, e.message); }
};

const getSerologyTests = async (req, res) => {
  try {
    const data = await MCHModel.getSerologyTests(req.params.id);
    return successResponse(res, 200, 'Serology tests fetched', data);
  } catch(e) { return errorResponse(res, 500, e.message); }
};

const addPreventiveService = async (req, res) => {
  try {
    const data = await MCHModel.addPreventiveService({ ...req.body, anc_id: req.params.id, pharmacy_id: req.pharmacy_id });
    return successResponse(res, 200, 'Preventive service saved', data);
  } catch(e) { return errorResponse(res, 500, e.message); }
};

const getPreventiveServices = async (req, res) => {
  try {
    const data = await MCHModel.getPreventiveServices(req.params.id);
    return successResponse(res, 200, 'Preventive services fetched', data);
  } catch(e) { return errorResponse(res, 500, e.message); }
};

module.exports = Object.assign(module.exports, {
  saveObstetricHistory, getObstetricHistory,
  upsertSerologyTest, getSerologyTests,
  addPreventiveService, getPreventiveServices,
});
