const express = require('express');
const { pool } = require("../config/db");
const router = express.Router();
const { successResponse, errorResponse } = require("../utils/response");
const {
  getPatients, getPatient, createPatient, updatePatient,
  createVisit, getVisits, updateVisitStatus, addVitals,
  getPatientHistory, getMOHReport
} = require('../controllers/patient.controller');
const { protect, requirePharmacy } = require('../middleware/auth.middleware');

router.use(protect, requirePharmacy);

// POST Manual / On-Demand Past Patient Data Restore & Sync
router.post('/restore-records', async (req, res) => {
  try {
    const pharmId = req.pharmacy_id || req.user?.pharmacy_id || null;
    
    // 1. Reactivate all existing records
    if (pharmId) {
      await pool.query(`
        UPDATE patients SET is_active = true WHERE is_active IS NULL OR is_active = false;
        UPDATE patients SET pharmacy_id = $1 WHERE pharmacy_id IS NULL;
        UPDATE visits SET pharmacy_id = $1 WHERE pharmacy_id IS NULL;
        UPDATE consultations SET pharmacy_id = $1 WHERE pharmacy_id IS NULL;
        UPDATE prescriptions SET pharmacy_id = $1 WHERE pharmacy_id IS NULL;
        UPDATE lab_requests SET pharmacy_id = $1 WHERE pharmacy_id IS NULL;
        UPDATE vitals SET pharmacy_id = $1 WHERE pharmacy_id IS NULL;
        UPDATE billing_items SET facility_id = $1, pharmacy_id = $1 WHERE pharmacy_id IS NULL OR facility_id IS NULL;
      `, [pharmId]);
    } else {
      await pool.query(`
        UPDATE patients SET is_active = true WHERE is_active IS NULL OR is_active = false;
      `);
    }

    const PatientModel = require('../models/patient.model');
    const patients = await PatientModel.findAll({ pharmacy_id: pharmId, limit: 200 });
    const stats = await PatientModel.getStats(pharmId);

    return successResponse(res, 200, 'Past patient records restored and synchronized successfully', {
      total_patients: patients.length,
      patients,
      stats
    });
  } catch (err) {
    return errorResponse(res, 500, 'Failed to restore patient records: ' + err.message);
  }
});

router.get('/', getPatients);
router.post('/', createPatient);
router.get('/visits', getVisits);
router.put('/visits/:id/status', updateVisitStatus);
router.post('/visits/:visit_id/vitals', protect, requirePharmacy, addVitals);
router.get('/history/search', getPatientHistory);
const { getPatientTimeline } = require('../controllers/encounter.controller');

router.get('/reports/moh204', getMOHReport);
router.get('/:id/timeline', getPatientTimeline);

// Get all visits for a specific patient
router.get('/:id/visits', protect, async (req, res) => {
  try {
    const PatientModel = require('../models/patient.model');
    const visits = await PatientModel.getVisits(req.params.id, req.pharmacy_id);
    res.json({ success: true, data: visits });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});
router.get('/:id', getPatient);
router.put('/:id', updatePatient);

// PUT Update Patient Medical History (allergies, chronic, past medical/surgical history)
router.put('/:id/medical-history', async (req, res) => {
  try {
    const {
      allergies,
      chronic_conditions,
      past_medical_history,
      past_surgical_history,
      family_history,
      social_history,
      immunization_history,
      blood_group
    } = req.body;

    try {
      await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS past_medical_history TEXT`);
      await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS past_surgical_history TEXT`);
      await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS family_history TEXT`);
      await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS social_history TEXT`);
      await pool.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS immunization_history TEXT`);
    } catch(e){}

    const { encrypt, decrypt } = require('../utils/encryption');

    let result = await pool.query(`
      UPDATE patients SET
        allergies = COALESCE($1, allergies),
        chronic_conditions = COALESCE($2, chronic_conditions),
        past_medical_history = COALESCE($3, past_medical_history),
        past_surgical_history = COALESCE($4, past_surgical_history),
        family_history = COALESCE($5, family_history),
        social_history = COALESCE($6, social_history),
        immunization_history = COALESCE($7, immunization_history),
        blood_group = COALESCE($8, blood_group),
        updated_at = NOW()
      WHERE (id::text = $9::text OR patient_number = $9::text) 
        AND (pharmacy_id::text = $10::text OR pharmacy_id IS NULL OR $10 IS NULL)
      RETURNING *
    `, [
      allergies !== undefined ? encrypt(allergies) : null,
      chronic_conditions !== undefined ? encrypt(chronic_conditions) : null,
      past_medical_history || null,
      past_surgical_history || null,
      family_history || null,
      social_history || null,
      immunization_history || null,
      blood_group || null,
      String(req.params.id),
      req.pharmacy_id ? String(req.pharmacy_id) : null
    ]);

    if (!result.rows[0]) {
      // Try fallback without pharmacy_id filter
      result = await pool.query(`
        UPDATE patients SET
          allergies = COALESCE($1, allergies),
          chronic_conditions = COALESCE($2, chronic_conditions),
          past_medical_history = COALESCE($3, past_medical_history),
          past_surgical_history = COALESCE($4, past_surgical_history),
          family_history = COALESCE($5, family_history),
          social_history = COALESCE($6, social_history),
          immunization_history = COALESCE($7, immunization_history),
          blood_group = COALESCE($8, blood_group),
          updated_at = NOW()
        WHERE (id::text = $9::text OR patient_number = $9::text)
        RETURNING *
      `, [
        allergies !== undefined ? encrypt(allergies) : null,
        chronic_conditions !== undefined ? encrypt(chronic_conditions) : null,
        past_medical_history || null,
        past_surgical_history || null,
        family_history || null,
        social_history || null,
        immunization_history || null,
        blood_group || null,
        String(req.params.id)
      ]);
    }

    if (!result.rows[0]) return errorResponse(res, 404, 'Patient not found');
    const updated = {
      ...result.rows[0],
      allergies: decrypt(result.rows[0].allergies),
      chronic_conditions: decrypt(result.rows[0].chronic_conditions)
    };
    return successResponse(res, 200, 'Patient medical history updated', updated);
  } catch(e) {
    return errorResponse(res, 500, e.message);
  }
});

// POST Retrospective Historical Clinical Note
router.post('/:id/history-notes', async (req, res) => {
  try {
    const { note_title, note_body, note_type, date_of_event } = req.body;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS patient_history_notes (
        id SERIAL PRIMARY KEY,
        patient_id VARCHAR(150) NOT NULL,
        pharmacy_id VARCHAR(150),
        author_name VARCHAR(150),
        author_role VARCHAR(50),
        note_type VARCHAR(50),
        note_title VARCHAR(200),
        note_body TEXT,
        date_of_event TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
      DO $$ 
      DECLARE r RECORD;
      BEGIN
          FOR r IN (
              SELECT constraint_name 
              FROM information_schema.table_constraints 
              WHERE table_name = 'patient_history_notes' 
                AND constraint_type = 'FOREIGN KEY'
          ) LOOP
              EXECUTE 'ALTER TABLE patient_history_notes DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
          END LOOP;
      END $$;
      ALTER TABLE patient_history_notes ALTER COLUMN patient_id TYPE VARCHAR(150) USING patient_id::VARCHAR;
      ALTER TABLE patient_history_notes ALTER COLUMN pharmacy_id TYPE VARCHAR(150) USING pharmacy_id::VARCHAR;
    `);
    const author_name = req.user?.full_name || 'Clinician';
    const author_role = req.user?.role || 'Doctor/Nurse';
    const rawPharmId = req.pharmacy_id || req.user?.pharmacy_id;

    const result = await pool.query(`
      INSERT INTO patient_history_notes (patient_id, pharmacy_id, author_name, author_role, note_type, note_title, note_body, date_of_event)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      String(req.params.id),
      rawPharmId ? String(rawPharmId) : null,
      author_name,
      author_role,
      note_type || 'historical_note',
      note_title || 'Past Clinical Summary',
      note_body,
      date_of_event || new Date()
    ]);

    return successResponse(res, 201, 'History note recorded', result.rows[0]);
  } catch(e) {
    return errorResponse(res, 500, e.message);
  }
});

router.get('/:id/history-notes', async (req, res) => {
  try {
    try {
      const result = await pool.query(`
        SELECT * FROM patient_history_notes 
        WHERE patient_id::text=$1::text 
          AND (pharmacy_id::text=$2::text OR pharmacy_id IS NULL OR $2 IS NULL) 
        ORDER BY created_at DESC
      `, [String(req.params.id), req.pharmacy_id ? String(req.pharmacy_id) : null]);
      return successResponse(res, 200, 'History notes fetched', result.rows);
    } catch(e) {
      return successResponse(res, 200, 'History notes fetched', []);
    }
  } catch(e) {
    return errorResponse(res, 500, e.message);
  }
});

router.post('/:patient_id/visits', createVisit);

// Discharge Summary
router.get("/visits/:visit_id/discharge-summary", async (req, res) => {
  try {
    const visit = await pool.query("SELECT v.*, p.full_name, p.patient_number, p.gender, p.date_of_birth, p.phone, p.allergies FROM visits v JOIN patients p ON v.patient_id::text = p.id::text WHERE v.id::text=$1::text AND (v.pharmacy_id::text=$2::text OR v.pharmacy_id IS NULL)", [req.params.visit_id, req.pharmacy_id]);
    if (!visit.rows[0]) return errorResponse(res, 404, "Visit not found");
    
    const consultation = await pool.query("SELECT * FROM consultations WHERE visit_id::text=$1::text ORDER BY created_at DESC LIMIT 1", [req.params.visit_id]);
    const labResults = await pool.query("SELECT * FROM lab_requests WHERE visit_id::text=$1::text ORDER BY created_at DESC", [req.params.visit_id]);
    const prescriptions = await pool.query("SELECT * FROM prescriptions WHERE visit_id::text=$1::text ORDER BY created_at DESC", [req.params.visit_id]);
    const injectionOrders = await pool.query("SELECT iro.*, u.full_name as nurse_name FROM injection_room_orders iro LEFT JOIN users u ON iro.administered_by::text = u.id::text WHERE iro.visit_id::text=$1::text ORDER BY iro.created_at DESC", [req.params.visit_id]);
    const bill = await pool.query("SELECT * FROM billing_items WHERE visit_id::text=$1::text", [req.params.visit_id]);
    
    const summary = {
      patient: visit.rows[0],
      consultation: consultation.rows[0],
      lab_results: labResults.rows,
      prescriptions: prescriptions.rows,
      injection_orders: injectionOrders.rows,
      bill: bill.rows,
      generated_at: new Date().toISOString()
    };
    
    return successResponse(res, 200, "Discharge summary generated", summary);
  } catch(e) { return errorResponse(res, 500, e.message); }
});
module.exports = router;

// Get vitals for a visit
router.get('/visits/:visit_id/vitals', protect, requirePharmacy, async (req, res) => {
  const { pool } = require('../config/db');
  const { successResponse, errorResponse } = require('../utils/response');
  try {
    const result = await pool.query(
      'SELECT * FROM vitals WHERE visit_id::text=$1::text ORDER BY recorded_at DESC',
      [req.params.visit_id]
    );
    return successResponse(res, 200, 'Vitals fetched', result.rows);
  } catch (e) { return errorResponse(res, 500, e.message); }
});


