const EncounterModel = require('../models/encounter.model');
const { pool } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

const getVisitEncounters = async (req, res) => {
  try {
    const { visit_id } = req.params;
    const encounters = await EncounterModel.getEncountersByVisit(visit_id, req.pharmacy_id);
    return successResponse(res, 200, 'Encounters fetched successfully', encounters);
  } catch (err) {
    logger.error('Failed to get visit encounters:', err.message);
    return errorResponse(res, 500, 'Failed to fetch encounters');
  }
};

const getEncounterDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const encounter = await EncounterModel.getEncounterById(id, req.pharmacy_id);
    if (!encounter) {
      return errorResponse(res, 404, 'Encounter not found');
    }
    return successResponse(res, 200, 'Encounter details fetched successfully', encounter);
  } catch (err) {
    logger.error('Failed to get encounter details:', err.message);
    return errorResponse(res, 500, 'Failed to fetch encounter details');
  }
};

const startOrResumeEncounter = async (req, res) => {
  try {
    const { visit_id, patient_id, department_id, clinic_id, current_step } = req.body;
    if (!visit_id || !patient_id) {
      return errorResponse(res, 400, 'visit_id and patient_id are required');
    }

    const encounter = await EncounterModel.getOrCreateActiveEncounter({
      visit_id,
      patient_id,
      pharmacy_id: req.pharmacy_id,
      doctor_id: req.user?.id,
      department_id,
      clinic_id,
      current_step: current_step || 'consultation'
    });

    return successResponse(res, 200, 'Encounter active', encounter);
  } catch (err) {
    logger.error('Failed to start or resume encounter:', err.message);
    return errorResponse(res, 500, 'Failed to process encounter');
  }
};

const pauseEncounter = async (req, res) => {
  try {
    const { id } = req.params;
    const encounter = await EncounterModel.pauseEncounter(id, req.user?.id, req.body);
    if (!encounter) {
      return errorResponse(res, 404, 'Encounter not found');
    }
    return successResponse(res, 200, 'Encounter paused', encounter);
  } catch (err) {
    logger.error('Failed to pause encounter:', err.message);
    return errorResponse(res, 500, 'Failed to pause encounter');
  }
};

const completeEncounter = async (req, res) => {
  try {
    const { id } = req.params;
    const { current_step } = req.body;
    const encounter = await EncounterModel.completeEncounter(id, req.user?.id, current_step || 'completed', req.body);
    if (!encounter) {
      return errorResponse(res, 404, 'Encounter not found');
    }
    return successResponse(res, 200, 'Encounter completed', encounter);
  } catch (err) {
    logger.error('Failed to complete encounter:', err.message);
    return errorResponse(res, 500, 'Failed to complete encounter');
  }
};

const getPatientTimeline = async (req, res) => {
  try {
    const patient_id = req.params.patient_id || req.params.id;
    if (!patient_id) {
      return errorResponse(res, 400, 'Patient ID is required');
    }

    const { date_from, date_to, clinic, doctor_id, diagnosis, status } = req.query;

    // Fetch Patient Profile (support ID or patient_number, relax pharmacy_id if needed)
    const { decrypt } = require('../utils/encryption');
    let patRes = await pool.query(
      `SELECT p.*
       FROM patients p 
       WHERE (p.id::text = $1::text OR p.patient_number = $1::text) 
         AND (p.pharmacy_id::text = $2::text OR p.pharmacy_id IS NULL OR $2 IS NULL)`,
      [patient_id, req.pharmacy_id || null]
    ).catch(() => ({ rows: [] }));

    if (!patRes.rows || !patRes.rows[0]) {
      // Fallback lookup without pharmacy_id filter
      patRes = await pool.query(
        `SELECT p.* FROM patients p WHERE p.id::text = $1::text OR p.patient_number = $1::text LIMIT 1`,
        [patient_id]
      ).catch(() => ({ rows: [] }));
    }

    if (!patRes.rows || !patRes.rows[0]) {
      return errorResponse(res, 404, 'Patient not found');
    }
    const rawPatient = patRes.rows[0];
    const actualPatientId = String(rawPatient.id);

    const safeDecrypt = (val) => {
      if (!val) return val;
      try {
        const d = decrypt(val);
        return d || val;
      } catch (e) {
        return val;
      }
    };

    const patient = {
      ...rawPatient,
      national_id: safeDecrypt(rawPatient.national_id),
      sha_number: safeDecrypt(rawPatient.sha_number),
      allergies: safeDecrypt(rawPatient.allergies),
      chronic_conditions: safeDecrypt(rawPatient.chronic_conditions)
    };

    // Build Visits Query
    const vParams = [actualPatientId];
    let vWhere = `WHERE v.patient_id::text = $1::text`;

    if (date_from) {
      vParams.push(date_from);
      vWhere += ` AND DATE(COALESCE(v.visit_date, v.created_at)) >= $${vParams.length}`;
    }
    if (date_to) {
      vParams.push(date_to);
      vWhere += ` AND DATE(COALESCE(v.visit_date, v.created_at)) <= $${vParams.length}`;
    }
    if (status && status !== 'all') {
      vParams.push(status);
      vWhere += ` AND LOWER(v.status) = LOWER($${vParams.length})`;
    }

    const visitsRes = await pool.query(
      `SELECT v.*, u.full_name as created_by_name
       FROM visits v
       LEFT JOIN users u ON v.created_by::text = u.id::text
       ${vWhere}
       ORDER BY COALESCE(v.visit_date, v.created_at) DESC, v.id DESC`,
      vParams
    ).catch(() => ({ rows: [] }));

    const visits = visitsRes.rows || [];
    if (visits.length === 0) {
      return successResponse(res, 200, 'Timeline fetched', {
        patient,
        visits: [],
        filter_options: { clinics: [], doctors: [], diagnoses: [], statuses: [] }
      });
    }

    const visitIds = visits.map(v => String(v.id));

    // Safe individual queries with individual fallbacks
    const safeQuery = async (sql, params = []) => {
      try {
        const r = await pool.query(sql, params);
        return r.rows || [];
      } catch (err) {
        return [];
      }
    };

    // Bulk Fetch Encounters & Sub-Records
    const [
      encRows,
      conRows,
      vitRows,
      prsRows,
      labRows,
      prcRows,
      bilRows,
      injRows,
      wrdRows,
      evtRows
    ] = await Promise.all([
      safeQuery(
        `SELECT e.*, u.full_name as doctor_name
         FROM encounters e
         LEFT JOIN users u ON e.doctor_id::text = u.id::text
         WHERE e.visit_id::text = ANY($1::text[]) ORDER BY e.id DESC`,
        [visitIds]
      ),
      safeQuery(
        `SELECT c.*, u.full_name as doctor_name
         FROM consultations c
         LEFT JOIN users u ON c.doctor_id::text = u.id::text
         WHERE c.visit_id::text = ANY($1::text[]) ORDER BY c.created_at DESC`,
        [visitIds]
      ),
      safeQuery(
        `SELECT vt.*, u.full_name as recorded_by_name
         FROM vitals vt
         LEFT JOIN users u ON vt.recorded_by::text = u.id::text
         WHERE vt.visit_id::text = ANY($1::text[]) ORDER BY vt.created_at DESC`,
        [visitIds]
      ),
      safeQuery(
        `SELECT p.*, u.full_name as doctor_name
         FROM prescriptions p
         LEFT JOIN users u ON p.doctor_id::text = u.id::text
         WHERE p.visit_id::text = ANY($1::text[]) ORDER BY p.created_at DESC`,
        [visitIds]
      ),
      safeQuery(
        `SELECT l.*, u.full_name as doctor_name, t.full_name as technician_name
         FROM lab_requests l
         LEFT JOIN users u ON l.doctor_id::text = u.id::text
         LEFT JOIN users t ON l.resulted_by::text = t.id::text
         WHERE l.visit_id::text = ANY($1::text[]) ORDER BY l.created_at DESC`,
        [visitIds]
      ),
      safeQuery(
        `SELECT pr.*, u.full_name as doctor_name
         FROM procedures pr
         LEFT JOIN users u ON pr.doctor_id::text = u.id::text
         WHERE pr.visit_id::text = ANY($1::text[]) ORDER BY pr.created_at DESC`,
        [visitIds]
      ),
      safeQuery(
        `SELECT b.* FROM billing_items b WHERE b.visit_id::text = ANY($1::text[]) ORDER BY b.created_at DESC`,
        [visitIds]
      ),
      safeQuery(
        `SELECT iro.*, u.full_name as doctor_name, nu.full_name as nurse_name
         FROM injection_room_orders iro
         LEFT JOIN users u ON iro.doctor_id::text = u.id::text
         LEFT JOIN users nu ON iro.administered_by::text = nu.id::text
         WHERE iro.visit_id::text = ANY($1::text[]) ORDER BY iro.created_at DESC`,
        [visitIds]
      ),
      safeQuery(
        `SELECT wt.* FROM ward_transfers wt WHERE wt.visit_id::text = ANY($1::text[]) ORDER BY wt.created_at DESC`,
        [visitIds]
      ),
      safeQuery(
        `SELECT ee.*, u.full_name as actor_name
         FROM encounter_events ee
         LEFT JOIN users u ON ee.actor_id::text = u.id::text
         WHERE ee.visit_id::text = ANY($1::text[]) ORDER BY ee.created_at DESC`,
        [visitIds]
      )
    ]);

    // Metadata extractors for Filter Dropdowns
    const availableClinics = new Set();
    const availableDoctors = new Map();
    const availableDiagnoses = new Set();
    const availableStatuses = new Set();

    // Grouping helper maps keyed strictly by string visit_id
    const encByVisit = new Map();
    const conByVisit = new Map();
    const vitByVisit = new Map();
    const prsByVisit = new Map();
    const labByVisit = new Map();
    const prcByVisit = new Map();
    const bilByVisit = new Map();
    const injByVisit = new Map();
    const wrdByVisit = new Map();
    const evtByVisit = new Map();

    visitIds.forEach(id => {
      encByVisit.set(id, []);
      conByVisit.set(id, []);
      vitByVisit.set(id, []);
      prsByVisit.set(id, []);
      labByVisit.set(id, []);
      prcByVisit.set(id, []);
      bilByVisit.set(id, []);
      injByVisit.set(id, []);
      wrdByVisit.set(id, []);
      evtByVisit.set(id, []);
    });

    encRows.forEach(r => {
      if (r.clinic_id) availableClinics.add(r.clinic_id);
      if (r.department_id) availableClinics.add(r.department_id);
      if (r.doctor_id && r.doctor_name) availableDoctors.set(String(r.doctor_id), r.doctor_name);
      if (r.status) availableStatuses.add(r.status);
      const k = String(r.visit_id);
      if (encByVisit.has(k)) encByVisit.get(k).push(r);
    });

    conRows.forEach(r => {
      if (r.diagnosis) availableDiagnoses.add(r.diagnosis);
      if (r.doctor_id && r.doctor_name) availableDoctors.set(String(r.doctor_id), r.doctor_name);
      const k = String(r.visit_id);
      if (conByVisit.has(k)) conByVisit.get(k).push(r);
    });

    vitRows.forEach(r => {
      const k = String(r.visit_id);
      if (vitByVisit.has(k)) vitByVisit.get(k).push(r);
    });
    prsRows.forEach(r => {
      const k = String(r.visit_id);
      if (prsByVisit.has(k)) prsByVisit.get(k).push(r);
    });
    labRows.forEach(r => {
      const k = String(r.visit_id);
      if (labByVisit.has(k)) labByVisit.get(k).push(r);
    });
    prcRows.forEach(r => {
      const k = String(r.visit_id);
      if (prcByVisit.has(k)) prcByVisit.get(k).push(r);
    });
    bilRows.forEach(r => {
      const k = String(r.visit_id);
      if (bilByVisit.has(k)) bilByVisit.get(k).push(r);
    });
    injRows.forEach(r => {
      const k = String(r.visit_id);
      if (injByVisit.has(k)) injByVisit.get(k).push(r);
    });
    wrdRows.forEach(r => {
      const k = String(r.visit_id);
      if (wrdByVisit.has(k)) wrdByVisit.get(k).push(r);
    });
    evtRows.forEach(r => {
      const k = String(r.visit_id);
      if (evtByVisit.has(k)) evtByVisit.get(k).push(r);
    });

    visits.forEach(v => {
      if (v.status) availableStatuses.add(v.status);
      if (v.department) availableClinics.add(v.department);
      if (v.visit_type) availableClinics.add(v.visit_type);
    });

    // Assemble structured timeline visits
    const timelineVisits = visits.map(v => {
      const vid = String(v.id);
      const vEncounters = encByVisit.get(vid) || [];
      const vConsultations = conByVisit.get(vid) || [];
      const vVitals = vitByVisit.get(vid) || [];
      const vPrescriptions = prsByVisit.get(vid) || [];
      const vLabs = labByVisit.get(vid) || [];
      const vProcedures = prcByVisit.get(vid) || [];
      const vBilling = bilByVisit.get(vid) || [];
      const vInjections = injByVisit.get(vid) || [];
      const vAdmissions = wrdByVisit.get(vid) || [];
      const vEvents = evtByVisit.get(vid) || [];

      // Primary diagnosis from consultation
      const primaryConsultation = vConsultations[0] || null;
      const primaryDiagnosis = primaryConsultation?.diagnosis || null;
      const icdCode = primaryConsultation?.icd_code || null;
      const primaryDoctor = primaryConsultation?.doctor_name || vEncounters[0]?.doctor_name || 'Unassigned Doctor';
      const clinicName = vEncounters[0]?.clinic_id || vEncounters[0]?.department_id || v.department || v.visit_type || 'General OPD';

      // Assemble encounters array (if no explicit encounters row exists yet, build default encounter)
      let encountersList = vEncounters;
      if (encountersList.length === 0) {
        encountersList = [{
          id: `default-${v.id}`,
          encounter_number: `ENC-${v.visit_number || v.id}`,
          visit_id: v.id,
          patient_id: v.patient_id,
          department_id: v.department || 'General OPD',
          clinic_id: clinicName,
          doctor_id: primaryConsultation?.doctor_id || null,
          doctor_name: primaryDoctor,
          status: v.status === 'discharged' ? 'COMPLETED' : 'IN_PROGRESS',
          current_step: v.status,
          started_at: v.created_at || v.visit_date,
          completed_at: v.status === 'discharged' ? v.updated_at : null
        }];
      }

      // Group sub-items into encounters
      const encountersWithData = encountersList.map((enc, idx) => {
        const encId = enc.id;
        const matchingCon = vConsultations.filter(c => String(c.encounter_id) === String(encId) || idx === 0);
        const matchingVit = vVitals.filter(vt => String(vt.encounter_id) === String(encId) || idx === 0);
        const matchingPrs = vPrescriptions.filter(p => String(p.encounter_id) === String(encId) || idx === 0);
        const matchingLab = vLabs.filter(l => String(l.encounter_id) === String(encId) || idx === 0);
        const matchingPrc = vProcedures.filter(pr => String(pr.encounter_id) === String(encId) || idx === 0);
        const matchingBil = vBilling.filter(b => String(b.encounter_id) === String(encId) || idx === 0);
        const matchingInj = vInjections.filter(inj => String(inj.encounter_id) === String(encId) || idx === 0);
        const matchingWrd = vAdmissions;

        // Categorized Radiology vs General Lab
        const radiologyItems = matchingLab.filter(l =>
          (l.test_name || '').toLowerCase().includes('x-ray') ||
          (l.test_name || '').toLowerCase().includes('xray') ||
          (l.test_name || '').toLowerCase().includes('ultrasound') ||
          (l.test_name || '').toLowerCase().includes('ct scan') ||
          (l.test_name || '').toLowerCase().includes('mri') ||
          (l.test_name || '').toLowerCase().includes('scan') ||
          (l.test_name || '').toLowerCase().includes('radiology')
        );
        const generalLabItems = matchingLab.filter(l => !radiologyItems.includes(l));

        return {
          ...enc,
          clinic: enc.clinic_id || enc.department_id || clinicName,
          doctor: enc.doctor_name || primaryDoctor,
          consultations: matchingCon,
          diagnoses: matchingCon.map(c => ({
            diagnosis: c.diagnosis,
            icd_code: c.icd_code,
            impression: c.impression,
            presenting_complaint: c.presenting_complaint,
            history_of_illness: c.history_of_illness,
            examination_findings: c.examination_findings,
            management_plan: c.management_plan
          })).filter(d => d.diagnosis),
          vitals: matchingVit,
          laboratory: generalLabItems,
          radiology: radiologyItems,
          procedures: matchingPrc,
          prescriptions: matchingPrs,
          billing: matchingBil,
          injections: matchingInj,
          admissions: matchingWrd,
          discharge: {
            is_discharged: v.status === 'discharged' || enc.status === 'COMPLETED',
            discharged_at: v.updated_at,
            summary_notes: primaryConsultation?.follow_up_notes || null
          },
          follow_up: {
            date: primaryConsultation?.follow_up_date || null,
            notes: primaryConsultation?.follow_up_notes || null
          }
        };
      });

      // Compute Step Sequence Flow Nodes
      const flowSteps = [
        { key: 'visit', title: 'Visit Registered', status: 'completed', time: v.created_at || v.visit_date },
        { key: 'triage', title: 'Triage / Vitals', status: vVitals.length > 0 ? 'completed' : (v.status === 'triage' ? 'active' : 'pending'), detail: vVitals[0] ? `BP ${vVitals[0].blood_pressure_systolic||'—'}/${vVitals[0].blood_pressure_diastolic||'—'}` : 'Not recorded' },
        { key: 'doctor', title: `${clinicName} OPD`, status: vConsultations.length > 0 ? 'completed' : (v.status === 'doctor' || v.status === 'with_doctor' ? 'active' : 'pending'), detail: primaryDiagnosis ? `Diag: ${primaryDiagnosis}` : primaryDoctor },
        { key: 'laboratory', title: 'Laboratory', status: vLabs.length > 0 ? (vLabs.every(l => l.status === 'completed') ? 'completed' : 'in_progress') : 'pending', detail: `${vLabs.length} Test(s)` },
        { key: 'procedures', title: 'Procedures / Inj', status: (vProcedures.length > 0 || vInjections.length > 0) ? 'completed' : 'pending', detail: `${vProcedures.length} Proc / ${vInjections.length} Inj` },
        { key: 'pharmacy', title: 'Pharmacy', status: vPrescriptions.length > 0 ? (vPrescriptions.every(p => p.status === 'dispensed') ? 'completed' : 'active') : 'pending', detail: `${vPrescriptions.length} Med(s)` },
        { key: 'billing', title: 'Billing', status: vBilling.length > 0 ? (vBilling.every(b => b.status === 'paid') ? 'completed' : 'pending') : 'pending', detail: `KES ${vBilling.reduce((sum, b) => sum + (parseFloat(b.unit_price || 0) * (b.quantity || 1)), 0).toLocaleString()}` },
        { key: 'completed', title: v.status === 'discharged' ? 'Discharged' : 'Completed', status: v.status === 'discharged' ? 'completed' : 'pending', time: v.status === 'discharged' ? v.updated_at : null }
      ];

      return {
        id: v.id,
        visit_number: v.visit_number,
        visit_date: v.visit_date || v.created_at,
        visit_type: v.visit_type,
        status: v.status,
        department: v.department || clinicName,
        primary_doctor: primaryDoctor,
        primary_diagnosis: primaryDiagnosis,
        icd_code: icdCode,
        consultation_fee: v.consultation_fee,
        fee_paid: v.fee_paid,
        flow_steps: flowSteps,
        encounters: encountersWithData,
        events: vEvents
      };
    });

    // Apply secondary filters (clinic, doctor_id, diagnosis) across visits & encounters
    let filteredTimeline = timelineVisits;

    if (clinic && clinic !== 'all') {
      filteredTimeline = filteredTimeline.filter(tv =>
        tv.department?.toLowerCase() === clinic.toLowerCase() ||
        tv.encounters.some(e => e.clinic?.toLowerCase() === clinic.toLowerCase())
      );
    }

    if (doctor_id && doctor_id !== 'all') {
      filteredTimeline = filteredTimeline.filter(tv =>
        tv.encounters.some(e => String(e.doctor_id) === String(doctor_id) || e.doctor === doctor_id)
      );
    }

    if (diagnosis && diagnosis.trim()) {
      const diagQuery = diagnosis.trim().toLowerCase();
      filteredTimeline = filteredTimeline.filter(tv =>
        (tv.primary_diagnosis || '').toLowerCase().includes(diagQuery) ||
        (tv.icd_code || '').toLowerCase().includes(diagQuery) ||
        tv.encounters.some(e =>
          e.diagnoses.some(d =>
            (d.diagnosis || '').toLowerCase().includes(diagQuery) ||
            (d.icd_code || '').toLowerCase().includes(diagQuery)
          )
        )
      );
    }

    return successResponse(res, 200, 'Patient clinical timeline fetched', {
      patient,
      visits: filteredTimeline,
      filter_options: {
        clinics: Array.from(availableClinics),
        doctors: Array.from(availableDoctors.entries()).map(([id, name]) => ({ id, name })),
        diagnoses: Array.from(availableDiagnoses),
        statuses: Array.from(availableStatuses)
      }
    });

  } catch (err) {
    logger.error('Failed to get patient clinical timeline:', err.message);
    return errorResponse(res, 500, 'Failed to fetch patient clinical timeline: ' + err.message);
  }
};

module.exports = {
  getVisitEncounters,
  getEncounterDetails,
  startOrResumeEncounter,
  pauseEncounter,
  completeEncounter,
  getPatientTimeline
};

