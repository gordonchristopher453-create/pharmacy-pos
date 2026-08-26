const express = require('express');
const router = express.Router();
const { protect, requirePharmacy, requirePermission } = require('../middleware/auth.middleware');
const {
  registerANC, getANCList, getANCById, updateANC, addANCVisit, saveANCProfile,
  addPNCVisit, getPNCVisits, addCWCRecord, getCWCRecords,
  addImmunization, getImmunizations, getDueImmunizations,
  addFamilyPlanning, getFamilyPlanning, addReferral,
  getDashboardStats, getANCRegister, getImmunizationRegister,
  getMOH510ANC, getMOH511PNC, getMOH512CWC, getMOH513Immunization,
  getMOH514FamilyPlanning, getMOH515Delivery, getMCHMonthlySummary,
  addHighRiskFlag, getHighRiskFlags, deleteHighRiskFlag,
  createMCHAppointment, getMCHAppointments, updateMCHAppointment, deleteMCHAppointment,
  getMCHQueue,
} = require('../controllers/mch.controller');

router.use(protect, requirePharmacy);

// MCH Queue
router.get('/queue', getMCHQueue);

// Dashboard
router.get('/stats',                requirePermission('can_manage_mch'), getDashboardStats);

// ANC
router.get('/anc',                  requirePermission('can_manage_anc'), getANCList);
router.post('/anc',                 requirePermission('can_manage_anc'), registerANC);
router.get('/anc/:id',              requirePermission('can_manage_anc'), getANCById);
router.put('/anc/:id',              requirePermission('can_manage_anc'), updateANC);
router.post('/anc/:id/visits',      requirePermission('can_manage_anc'), addANCVisit);
router.post('/anc/:id/profile',     requirePermission('can_manage_anc'), saveANCProfile);

// High Risk Flags
router.post('/anc/:id/high-risk',        requirePermission('can_manage_anc'), addHighRiskFlag);
router.get('/anc/:id/high-risk',         requirePermission('can_manage_anc'), getHighRiskFlags);
router.delete('/anc/high-risk/:flagId',  requirePermission('can_manage_anc'), deleteHighRiskFlag);

// PNC
router.get('/pnc',                  requirePermission('can_manage_pnc'), getPNCVisits);
router.post('/pnc',                 requirePermission('can_manage_pnc'), addPNCVisit);

// CWC
router.get('/cwc',                  requirePermission('can_manage_cwc'), getCWCRecords);
router.post('/cwc',                 requirePermission('can_manage_cwc'), addCWCRecord);

// Immunization
router.get('/immunization',         requirePermission('can_manage_immunization'), getImmunizations);
router.get('/immunization/due',     requirePermission('can_manage_immunization'), getDueImmunizations);
router.post('/immunization',        requirePermission('can_manage_immunization'), addImmunization);

// Family Planning
router.get('/family-planning',      requirePermission('can_manage_family_planning'), getFamilyPlanning);
router.post('/family-planning',     requirePermission('can_manage_family_planning'), addFamilyPlanning);

// Maternity Referral
router.post('/referral',            requirePermission('can_refer_to_maternity'), addReferral);

// MCH Appointments
router.post('/appointments',             requirePermission('can_manage_mch'), createMCHAppointment);
router.get('/appointments',              requirePermission('can_manage_mch'), getMCHAppointments);
router.put('/appointments/:id',          requirePermission('can_manage_mch'), updateMCHAppointment);
router.delete('/appointments/:id',       requirePermission('can_manage_mch'), deleteMCHAppointment);

// Reports
router.get('/reports/anc-register',           requirePermission('can_view_mch_reports'), getANCRegister);
router.get('/reports/immunization-register',  requirePermission('can_view_mch_reports'), getImmunizationRegister);


// MOH Reports
router.get('/reports/moh-510-anc',            requirePermission('can_view_mch_reports'), getMOH510ANC);
router.get('/reports/moh-511-pnc',            requirePermission('can_view_mch_reports'), getMOH511PNC);
router.get('/reports/moh-512-cwc',            requirePermission('can_view_mch_reports'), getMOH512CWC);
router.get('/reports/moh-513-immunization',   requirePermission('can_view_mch_reports'), getMOH513Immunization);
router.get('/reports/moh-514-family-planning', requirePermission('can_view_mch_reports'), getMOH514FamilyPlanning);
router.get('/reports/moh-515-delivery',       requirePermission('can_view_mch_reports'), getMOH515Delivery);
router.get('/reports/mch-monthly-summary',    requirePermission('can_view_mch_reports'), getMCHMonthlySummary);

// Get unified MCH patient record
router.get("/patient/:patient_id", async (req, res) => {
  try {
    const patient = await pool.query("SELECT * FROM patients WHERE id=$1 AND pharmacy_id=$2", [req.params.patient_id, req.pharmacy_id]);
    if (!patient.rows[0]) return errorResponse(res, 404, "Patient not found");
    
    const [anc, ancVisits, ancProfile, pnc, cwc, immunizations, fp] = await Promise.all([
      pool.query("SELECT * FROM anc_registrations WHERE patient_id=$1 AND pharmacy_id=$2 ORDER BY created_at DESC", [req.params.patient_id, req.pharmacy_id]),
      pool.query("SELECT av.*, ar.anc_number FROM anc_visits av LEFT JOIN anc_registrations ar ON av.anc_id = ar.id WHERE ar.patient_id=$1 AND av.pharmacy_id=$2 ORDER BY av.visit_date DESC", [req.params.patient_id, req.pharmacy_id]),
      pool.query("SELECT * FROM anc_profiles WHERE anc_id IN (SELECT id FROM anc_registrations WHERE patient_id=$1 AND pharmacy_id=$2)", [req.params.patient_id, req.pharmacy_id]),
      pool.query("SELECT * FROM pnc_visits WHERE patient_id=$1 AND pharmacy_id=$2 ORDER BY visit_date DESC", [req.params.patient_id, req.pharmacy_id]),
      pool.query("SELECT * FROM cwc_records WHERE patient_id=$1 AND pharmacy_id=$2 ORDER BY visit_date DESC", [req.params.patient_id, req.pharmacy_id]),
      pool.query("SELECT * FROM immunizations WHERE patient_id=$1 AND pharmacy_id=$2 ORDER BY date_given DESC", [req.params.patient_id, req.pharmacy_id]),
      pool.query("SELECT * FROM family_planning WHERE patient_id=$1 AND pharmacy_id=$2 ORDER BY created_at DESC", [req.params.patient_id, req.pharmacy_id]),
    ]);
    
    return successResponse(res, 200, "MCH record fetched", {
      patient: patient.rows[0],
      anc: anc.rows,
      anc_visits: ancVisits.rows,
      anc_profile: ancProfile.rows[0] || null,
      pnc: pnc.rows,
      cwc: cwc.rows,
      immunizations: immunizations.rows,
      family_planning: fp.rows
    });
  } catch(e) { return errorResponse(res, 500, e.message); }
});
const { saveObstetricHistory, getObstetricHistory, upsertSerologyTest, getSerologyTests, addPreventiveService, getPreventiveServices } = require('../controllers/mch.controller');
router.get('/anc/:id/obstetric-history',  requirePermission('can_manage_anc'), getObstetricHistory);
router.post('/anc/:id/obstetric-history', requirePermission('can_manage_anc'), saveObstetricHistory);
router.get('/anc/:id/serology',           requirePermission('can_manage_anc'), getSerologyTests);
router.post('/anc/:id/serology',          requirePermission('can_manage_anc'), upsertSerologyTest);
router.get('/anc/:id/preventive',         requirePermission('can_manage_anc'), getPreventiveServices);
router.post('/anc/:id/preventive',        requirePermission('can_manage_anc'), addPreventiveService);
module.exports = router;
