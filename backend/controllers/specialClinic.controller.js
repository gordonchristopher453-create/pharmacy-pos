const { pool } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');
const crypto = require('crypto');

// ── 1. CLINIC MANAGEMENT ──────────────────────────────────────────────────
const getSpecialClinics = async (req, res) => {
  try {
    const { include_inactive } = req.query;
    let query = `
      SELECT sc.*, 
        u.full_name as head_doctor_name,
        (SELECT COUNT(*)::int FROM clinic_queue q WHERE q.clinic_id = sc.id AND q.status = 'WAITING') as waiting_count,
        (SELECT COUNT(*)::int FROM clinic_doctors cd WHERE cd.clinic_id = sc.id) as doctors_count,
        (SELECT COUNT(*)::int FROM clinic_services cs WHERE cs.clinic_id = sc.id AND cs.is_active = TRUE) as services_count
      FROM special_clinics sc
      LEFT JOIN users u ON sc.head_doctor_id = u.id
    `;
    if (include_inactive !== 'true') {
      query += ` WHERE sc.is_active = TRUE`;
    }
    query += ` ORDER BY sc.name ASC`;

    const result = await pool.query(query);
    return successResponse(res, 200, 'Special clinics fetched', result.rows);
  } catch (err) {
    logger.error('Failed to fetch special clinics:', err.message);
    return errorResponse(res, 500, 'Failed to fetch special clinics');
  }
};

const createSpecialClinic = async (req, res) => {
  try {
    const {
      code,
      name,
      description,
      consultation_fee,
      working_days,
      appointment_duration,
      location,
      head_doctor_id
    } = req.body;

    if (!code || !name) {
      return errorResponse(res, 400, 'Clinic code and name are required');
    }

    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '_');

    const result = await pool.query(`
      INSERT INTO special_clinics (
        code, name, description, consultation_fee, working_days,
        appointment_duration, location, head_doctor_id, is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW())
      RETURNING *
    `, [
      cleanCode,
      name.trim(),
      description || null,
      consultation_fee || 0.00,
      working_days || 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
      appointment_duration || 30,
      location || 'Main Clinic Building',
      head_doctor_id || null
    ]);

    return successResponse(res, 201, 'Special clinic created successfully', result.rows[0]);
  } catch (err) {
    logger.error('Failed to create special clinic:', err.message);
    return errorResponse(res, 500, err.message || 'Failed to create special clinic');
  }
};

const updateSpecialClinic = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      consultation_fee,
      working_days,
      appointment_duration,
      location,
      head_doctor_id,
      is_active
    } = req.body;

    const result = await pool.query(`
      UPDATE special_clinics
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          consultation_fee = COALESCE($3, consultation_fee),
          working_days = COALESCE($4, working_days),
          appointment_duration = COALESCE($5, appointment_duration),
          location = COALESCE($6, location),
          head_doctor_id = COALESCE($7, head_doctor_id),
          is_active = COALESCE($8, is_active)
      WHERE id = $9
      RETURNING *
    `, [
      name,
      description,
      consultation_fee,
      working_days,
      appointment_duration,
      location,
      head_doctor_id,
      is_active,
      id
    ]);

    if (!result.rows[0]) {
      return errorResponse(res, 404, 'Special clinic not found');
    }

    return successResponse(res, 200, 'Special clinic updated successfully', result.rows[0]);
  } catch (err) {
    logger.error('Failed to update special clinic:', err.message);
    return errorResponse(res, 500, 'Failed to update special clinic');
  }
};

// ── 2. DOCTOR ASSIGNMENTS ─────────────────────────────────────────────────
const getClinicDoctors = async (req, res) => {
  try {
    const { clinic_id } = req.query;
    let query = `
      SELECT cd.*, u.full_name as doctor_name, u.email, u.phone, u.role, sc.name as clinic_name
      FROM clinic_doctors cd
      JOIN users u ON cd.user_id::text = u.id::text
      JOIN special_clinics sc ON cd.clinic_id::text = sc.id::text
      WHERE (cd.pharmacy_id::text = $1::text OR cd.pharmacy_id IS NULL)
    `;
    const params = [req.pharmacy_id];

    if (clinic_id) {
      params.push(clinic_id);
      query += ` AND cd.clinic_id::text = $${params.length}::text`;
    }

    query += ` ORDER BY sc.name ASC, cd.is_primary DESC, u.full_name ASC`;

    const result = await pool.query(query, params);
    return successResponse(res, 200, 'Clinic doctors fetched', result.rows);
  } catch (err) {
    logger.error('Failed to fetch clinic doctors:', err.message);
    return errorResponse(res, 500, 'Failed to fetch clinic doctors');
  }
};

const assignClinicDoctor = async (req, res) => {
  try {
    const {
      clinic_id,
      user_id,
      is_primary,
      doctor_type,
      external_name,
      external_specialty,
      external_phone,
      external_email
    } = req.body;

    if (!clinic_id) {
      return errorResponse(res, 400, 'clinic_id is required');
    }

    let targetUserId = user_id;

    if (doctor_type === 'external' || (!user_id && external_name)) {
      if (!external_name || !external_name.trim()) {
        return errorResponse(res, 400, 'External doctor name is required');
      }

      const generatedEmail = external_email?.trim() || `external.${crypto.randomUUID()}@specialist.local`;
      const fullName = external_specialty?.trim() 
        ? `${external_name.trim()} (${external_specialty.trim()})`
        : external_name.trim();

      const newUserRes = await pool.query(`
        INSERT INTO users (
          pharmacy_id, full_name, email, password, role, is_active, permissions, created_at
        ) VALUES (
          $1, $2, $3, 'EXTERNAL_DOCTOR_NO_LOGIN', 'doctor', TRUE, '["can_do_consultation"]'::jsonb, NOW()
        ) RETURNING id
      `, [req.pharmacy_id, fullName, generatedEmail]);

      targetUserId = newUserRes.rows[0].id;
    }

    if (!targetUserId) {
      return errorResponse(res, 400, 'Please select a staff doctor or provide external doctor details');
    }

    const check = await pool.query(`
      SELECT * FROM clinic_doctors WHERE clinic_id = $1 AND user_id = $2
    `, [clinic_id, targetUserId]);

    if (check.rows.length > 0) {
      return errorResponse(res, 400, 'Doctor is already assigned to this clinic');
    }

    const result = await pool.query(`
      INSERT INTO clinic_doctors (pharmacy_id, clinic_id, user_id, is_primary, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `, [req.pharmacy_id, clinic_id, targetUserId, is_primary || false]);

    return successResponse(res, 201, 'Doctor assigned to clinic', result.rows[0]);
  } catch (err) {
    logger.error('Failed to assign doctor:', err.message);
    return errorResponse(res, 500, err.message || 'Failed to assign doctor');
  }
};

const removeClinicDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM clinic_doctors WHERE id = $1`, [id]);
    return successResponse(res, 200, 'Doctor unassigned from clinic');
  } catch (err) {
    logger.error('Failed to remove doctor assignment:', err.message);
    return errorResponse(res, 500, 'Failed to remove doctor assignment');
  }
};

const getAvailableDoctors = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, full_name, email, role, phone, is_active
      FROM users
      WHERE (pharmacy_id = $1 OR pharmacy_id IS NULL)
      AND is_active = TRUE
      ORDER BY full_name ASC
    `, [req.pharmacy_id]);
    return successResponse(res, 200, 'Available doctors fetched', result.rows);
  } catch (err) {
    logger.error('Failed to fetch available doctors:', err.message);
    return errorResponse(res, 500, 'Failed to fetch available doctors');
  }
};

// ── 3. CLINIC SERVICES ────────────────────────────────────────────────────
const getClinicServices = async (req, res) => {
  try {
    const { clinic_id } = req.query;
    let query = `
      SELECT cs.*, sc.name as clinic_name
      FROM clinic_services cs
      JOIN special_clinics sc ON cs.clinic_id = sc.id
      WHERE (cs.pharmacy_id = $1 OR cs.pharmacy_id IS NULL)
    `;
    const params = [req.pharmacy_id];

    if (clinic_id) {
      params.push(clinic_id);
      query += ` AND cs.clinic_id = $${params.length}`;
    }

    query += ` ORDER BY cs.service_name ASC`;

    const result = await pool.query(query, params);
    return successResponse(res, 200, 'Clinic services fetched', result.rows);
  } catch (err) {
    logger.error('Failed to fetch clinic services:', err.message);
    return errorResponse(res, 500, 'Failed to fetch clinic services');
  }
};

const createClinicService = async (req, res) => {
  try {
    const { clinic_id, service_name, service_code, fee, description } = req.body;

    if (!clinic_id || !service_name) {
      return errorResponse(res, 400, 'clinic_id and service_name are required');
    }

    const result = await pool.query(`
      INSERT INTO clinic_services (
        pharmacy_id, clinic_id, service_name, service_code, fee, description, is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
      RETURNING *
    `, [
      req.pharmacy_id,
      clinic_id,
      service_name.trim(),
      service_code || null,
      fee || 0.00,
      description || null
    ]);

    return successResponse(res, 201, 'Clinic service created', result.rows[0]);
  } catch (err) {
    logger.error('Failed to create clinic service:', err.message);
    return errorResponse(res, 500, 'Failed to create clinic service');
  }
};

const updateClinicService = async (req, res) => {
  try {
    const { id } = req.params;
    const { service_name, service_code, fee, description, is_active } = req.body;

    const result = await pool.query(`
      UPDATE clinic_services
      SET service_name = COALESCE($1, service_name),
          service_code = COALESCE($2, service_code),
          fee = COALESCE($3, fee),
          description = COALESCE($4, description),
          is_active = COALESCE($5, is_active)
      WHERE id = $6
      RETURNING *
    `, [service_name, service_code, fee, description, is_active, id]);

    return successResponse(res, 200, 'Clinic service updated', result.rows[0]);
  } catch (err) {
    logger.error('Failed to update clinic service:', err.message);
    return errorResponse(res, 500, 'Failed to update clinic service');
  }
};

// ── 4. APPOINTMENTS ───────────────────────────────────────────────────────
const getClinicAppointments = async (req, res) => {
  try {
    const { clinic_id, patient_id, date, status } = req.query;
    let query = `
      SELECT ca.*, p.full_name as patient_name, p.patient_number, p.phone as patient_phone,
             u.full_name as doctor_name, sc.name as clinic_name
      FROM clinic_appointments ca
      JOIN patients p ON ca.patient_id::text = p.id::text
      JOIN special_clinics sc ON ca.clinic_id::text = sc.id::text
      LEFT JOIN users u ON ca.doctor_id::text = u.id::text
      WHERE (ca.pharmacy_id::text = $1::text OR ca.pharmacy_id IS NULL)
    `;
    const params = [req.pharmacy_id];

    if (clinic_id) {
      params.push(clinic_id);
      query += ` AND ca.clinic_id::text = $${params.length}::text`;
    }
    if (patient_id) {
      params.push(patient_id);
      query += ` AND ca.patient_id::text = $${params.length}::text`;
    }
    if (date) {
      params.push(date);
      query += ` AND ca.appointment_date = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND ca.status = $${params.length}`;
    }

    query += ` ORDER BY ca.appointment_date DESC, ca.appointment_time ASC`;

    const result = await pool.query(query, params);
    return successResponse(res, 200, 'Appointments fetched', result.rows);
  } catch (err) {
    logger.error('Failed to fetch appointments:', err.message);
    return errorResponse(res, 500, 'Failed to fetch appointments');
  }
};

const createClinicAppointment = async (req, res) => {
  try {
    const { clinic_id, patient_id, doctor_id, appointment_date, appointment_time, reason } = req.body;

    if (!clinic_id || !patient_id || !appointment_date) {
      return errorResponse(res, 400, 'clinic_id, patient_id, and appointment_date are required');
    }

    const result = await pool.query(`
      INSERT INTO clinic_appointments (
        pharmacy_id, clinic_id, patient_id, doctor_id, appointment_date, appointment_time, reason, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'SCHEDULED', NOW())
      RETURNING *
    `, [
      req.pharmacy_id,
      clinic_id,
      patient_id,
      doctor_id || null,
      appointment_date,
      appointment_time || '09:00:00',
      reason || null
    ]);

    return successResponse(res, 201, 'Appointment scheduled successfully', result.rows[0]);
  } catch (err) {
    logger.error('Failed to create appointment:', err.message);
    return errorResponse(res, 500, 'Failed to create appointment');
  }
};

const updateClinicAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(`
      UPDATE clinic_appointments
      SET status = $1
      WHERE id = $2
      RETURNING *
    `, [status, id]);

    return successResponse(res, 200, 'Appointment status updated', result.rows[0]);
  } catch (err) {
    logger.error('Failed to update appointment status:', err.message);
    return errorResponse(res, 500, 'Failed to update appointment status');
  }
};

// ── 5. QUEUE & REFERRALS ──────────────────────────────────────────────────
const getClinicQueue = async (req, res) => {
  try {
    const { clinic_id, clinic_code, status, date } = req.query;
    const d = date || new Date().toISOString().split('T')[0];
    let query = `
      SELECT q.*, p.full_name as patient_name, p.patient_number, p.gender, p.date_of_birth, p.phone as patient_phone,
             v.visit_number, v.status as visit_status, v.priority as visit_priority,
             e.encounter_number, e.status as encounter_status,
             (SELECT json_agg(vt.*) FROM vitals vt WHERE vt.visit_id::text = q.visit_id::text OR vt.encounter_id::text = q.encounter_id::text) as vitals
      FROM clinic_queue q
      JOIN patients p ON q.patient_id::text = p.id::text
      JOIN visits v ON q.visit_id::text = v.id::text
      LEFT JOIN encounters e ON q.encounter_id::text = e.id::text
      WHERE (q.pharmacy_id::text = $1::text OR q.pharmacy_id IS NULL)
        AND DATE(q.queued_at) = $2
    `;
    const params = [req.pharmacy_id, d];

    if (clinic_id) {
      params.push(clinic_id);
      query += ` AND q.clinic_id::text = $${params.length}::text`;
    }
    if (clinic_code) {
      params.push(clinic_code);
      query += ` AND q.clinic_code = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND q.status = $${params.length}`;
    } else {
      query += ` AND q.status != 'CANCELLED'`;
    }

    query += ` ORDER BY q.queued_at DESC`;

    const result = await pool.query(query, params);
    return successResponse(res, 200, 'Clinic queue fetched', result.rows);
  } catch (err) {
    logger.error('Failed to fetch clinic queue:', err.message);
    return errorResponse(res, 500, 'Failed to fetch clinic queue');
  }
};

const updateClinicQueueStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const servedAt = status === 'IN_CONSULTATION' || status === 'COMPLETED' ? new Date() : null;

    const result = await pool.query(`
      UPDATE clinic_queue
      SET status = $1,
          served_at = COALESCE($2, served_at)
      WHERE id = $3
      RETURNING *
    `, [status, servedAt, id]);

    if (!result.rows[0]) {
      return errorResponse(res, 404, 'Queue item not found');
    }

    const queueItem = result.rows[0];

    if (status === 'IN_CONSULTATION') {
      await pool.query(`
        UPDATE encounters SET status = 'IN_PROGRESS', updated_at = NOW() WHERE id = $1
      `, [queueItem.encounter_id]);
    } else if (status === 'COMPLETED') {
      await pool.query(`
        UPDATE encounters SET status = 'COMPLETED', ended_at = NOW(), updated_at = NOW() WHERE id = $1
      `, [queueItem.encounter_id]);
    }

    const io = req.app.get('io');
    if (io) {
      io.emit(`clinic_queue_updated_${req.pharmacy_id}`, queueItem);
    }

    return successResponse(res, 200, 'Queue status updated', queueItem);
  } catch (err) {
    logger.error('Failed to update queue status:', err.message);
    return errorResponse(res, 500, 'Failed to update queue status');
  }
};

const referToSpecialClinic = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      visit_id,
      patient_id: reqPatientId,
      clinic_id,
      clinic_code,
      clinic_name,
      from_clinic,
      referral_reason,
      urgency
    } = req.body;

    if (!visit_id || (!clinic_id && !clinic_name && !clinic_code)) {
      return errorResponse(res, 400, 'visit_id and clinic selection are required');
    }

    await client.query('BEGIN');

    // 1. Check visit & patient
    const vRes = await client.query(
      `SELECT * FROM visits WHERE id = $1 AND (pharmacy_id = $2 OR pharmacy_id IS NULL)`,
      [visit_id, req.pharmacy_id]
    );

    if (!vRes.rows[0]) {
      await client.query('ROLLBACK');
      return errorResponse(res, 404, 'Visit not found');
    }

    const visit = vRes.rows[0];
    const patient_id = reqPatientId || visit.patient_id;

    // Resolve target clinic
    let targetClinic = null;
    if (clinic_id) {
      const cRes = await client.query(`SELECT * FROM special_clinics WHERE id = $1`, [clinic_id]);
      targetClinic = cRes.rows[0];
    } else if (clinic_code) {
      const cRes = await client.query(`SELECT * FROM special_clinics WHERE code = $1`, [clinic_code]);
      targetClinic = cRes.rows[0];
    } else if (clinic_name) {
      const cRes = await client.query(`SELECT * FROM special_clinics WHERE name ILIKE $1`, [clinic_name]);
      targetClinic = cRes.rows[0];
    }

    const targetClinicId = targetClinic ? targetClinic.id : (clinic_id || null);
    const targetClinicCode = targetClinic ? targetClinic.code : (clinic_code || 'SPECIAL');
    const targetClinicName = targetClinic ? targetClinic.name : (clinic_name || 'Special Clinic');

    // 1b. Mark current active encounter as REFERRED
    const activeEncRes = await client.query(
      `SELECT id FROM encounters WHERE visit_id = $1 AND status IN ('IN_PROGRESS', 'IN_CONSULTATION', 'active', 'PAUSED') ORDER BY id DESC LIMIT 1`,
      [visit_id]
    );
    let fromEncounterId = null;
    if (activeEncRes.rows[0]) {
      fromEncounterId = activeEncRes.rows[0].id;
      await client.query(
        `UPDATE encounters SET status = 'REFERRED', ended_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [fromEncounterId]
      );
      await client.query(
        `INSERT INTO encounter_events (pharmacy_id, encounter_id, visit_id, patient_id, event_type, actor_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, 'REFERRED', $5, $6, NOW())`,
        [req.pharmacy_id, fromEncounterId, visit_id, patient_id, req.user?.id || null, JSON.stringify({ referred_to: targetClinicName, reason: referral_reason })]
      );
    }

    // 2. Create NEW Encounter under the SAME Visit (Never create another Visit)
    const encNumber = `ENC-${visit_id}-SC-${Date.now()}`;
    const encRes = await client.query(`
      INSERT INTO encounters (
        pharmacy_id, visit_id, patient_id, encounter_number,
        department_id, clinic_id, doctor_id, status, current_step,
        started_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'special_clinic', $5, $6, 'WAITING', 'consultation', NOW(), NOW(), NOW())
      RETURNING *
    `, [
      req.pharmacy_id,
      visit_id,
      patient_id,
      encNumber,
      targetClinicName,
      req.user?.id || null
    ]);

    const newEncounter = encRes.rows[0];

    // 3. Create record in clinic_referrals
    const refRes = await client.query(`
      INSERT INTO clinic_referrals (
        pharmacy_id, visit_id, patient_id, encounter_id, from_encounter_id,
        from_clinic, to_clinic_id, to_clinic_code, to_clinic_name,
        referred_by, referral_reason, urgency, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PENDING', NOW(), NOW())
      RETURNING *
    `, [
      req.pharmacy_id,
      visit_id,
      patient_id,
      newEncounter.id,
      fromEncounterId,
      from_clinic || 'General OPD',
      targetClinicId,
      targetClinicCode,
      targetClinicName,
      req.user?.id || null,
      referral_reason || 'Referred for specialized review',
      urgency || 'ROUTINE'
    ]);

    // 4. Create record in clinic_queue
    const queueRes = await client.query(`
      INSERT INTO clinic_queue (
        pharmacy_id, visit_id, patient_id, encounter_id,
        clinic_id, clinic_code, clinic_name, priority, status, queued_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'WAITING', NOW(), NOW())
      RETURNING *
    `, [
      req.pharmacy_id,
      visit_id,
      patient_id,
      newEncounter.id,
      targetClinicId,
      targetClinicCode,
      targetClinicName,
      urgency || 'NORMAL'
    ]);

    // 5. Audit event in encounter_events
    await client.query(`
      INSERT INTO encounter_events (
        pharmacy_id, encounter_id, visit_id, patient_id, event_type, actor_id, metadata, created_at
      ) VALUES ($1, $2, $3, $4, 'SPECIAL_CLINIC_REFERRAL', $5, $6, NOW())
    `, [
      req.pharmacy_id,
      newEncounter.id,
      visit_id,
      patient_id,
      req.user?.id || null,
      JSON.stringify({
        from_clinic: from_clinic || 'General OPD',
        target_clinic: targetClinicName,
        referral_reason: referral_reason || 'Referred for specialized review',
        urgency: urgency || 'ROUTINE'
      })
    ]);

    // 6. Update Visit status to with_doctor and department to special_clinic
    await client.query(`
      UPDATE visits
      SET status = 'with_doctor', department = 'special_clinic', updated_at = NOW()
      WHERE id = $1 AND (pharmacy_id = $2 OR pharmacy_id IS NULL)
    `, [visit_id, req.pharmacy_id]);

    await client.query('COMMIT');

    const io = req.app.get('io');
    if (io) {
      io.emit(`special_clinic_referral_${req.pharmacy_id}`, {
        visit_id,
        patient_id,
        clinic_name: targetClinicName,
        encounter_id: newEncounter.id
      });
      io.emit(`visit_updated_${req.pharmacy_id}`, { visit_id, status: 'with_doctor' });
    }

    return successResponse(res, 201, `Patient referred to ${targetClinicName}`, {
      encounter: newEncounter,
      referral: refRes.rows[0],
      queue_item: queueRes.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Failed to refer to special clinic:', err.message);
    return errorResponse(res, 500, err.message || 'Failed to refer to special clinic');
  } finally {
    client.release();
  }
};

const getClinicReferrals = async (req, res) => {
  try {
    const { visit_id, patient_id, clinic_id } = req.query;
    let query = `
      SELECT r.*, p.full_name as patient_name, p.patient_number,
             u.full_name as referred_by_name
      FROM clinic_referrals r
      JOIN patients p ON r.patient_id = p.id
      LEFT JOIN users u ON r.referred_by = u.id
      WHERE (r.pharmacy_id = $1 OR r.pharmacy_id IS NULL)
    `;
    const params = [req.pharmacy_id];

    if (visit_id) {
      params.push(visit_id);
      query += ` AND r.visit_id = $${params.length}`;
    }
    if (patient_id) {
      params.push(patient_id);
      query += ` AND r.patient_id = $${params.length}`;
    }
    if (clinic_id) {
      params.push(clinic_id);
      query += ` AND r.to_clinic_id = $${params.length}`;
    }

    query += ` ORDER BY r.created_at DESC`;

    const result = await pool.query(query, params);
    return successResponse(res, 200, 'Clinic referrals fetched', result.rows);
  } catch (err) {
    logger.error('Failed to fetch clinic referrals:', err.message);
    return errorResponse(res, 500, 'Failed to fetch clinic referrals');
  }
};

// ── 6. DASHBOARD & STATS ──────────────────────────────────────────────────
const getClinicDashboardStats = async (req, res) => {
  try {
    const { clinic_id, clinic_code } = req.query;
    const pId = req.pharmacy_id;

    let clinicWhere = '';
    const params = [pId];

    if (clinic_id) {
      params.push(clinic_id);
      clinicWhere = ` AND q.clinic_id::text = $${params.length}::text`;
    } else if (clinic_code) {
      params.push(clinic_code);
      clinicWhere = ` AND q.clinic_code = $${params.length}`;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const todayPatientsRes = await pool.query(`
      SELECT COUNT(DISTINCT q.visit_id)::int as count
      FROM clinic_queue q
      WHERE (q.pharmacy_id::text = $1::text OR q.pharmacy_id IS NULL) ${clinicWhere}
      AND q.queued_at::date = '${todayStr}'::date
    `, params);

    const waitingRes = await pool.query(`
      SELECT COUNT(*)::int as count
      FROM clinic_queue q
      WHERE (q.pharmacy_id::text = $1::text OR q.pharmacy_id IS NULL) ${clinicWhere}
      AND q.status = 'WAITING'
    `, params);

    const inConsultationRes = await pool.query(`
      SELECT COUNT(*)::int as count
      FROM clinic_queue q
      WHERE (q.pharmacy_id::text = $1::text OR q.pharmacy_id IS NULL) ${clinicWhere}
      AND q.status = 'IN_CONSULTATION'
    `, params);

    const completedRes = await pool.query(`
      SELECT COUNT(*)::int as count
      FROM clinic_queue q
      WHERE (q.pharmacy_id::text = $1::text OR q.pharmacy_id IS NULL) ${clinicWhere}
      AND q.status = 'COMPLETED'
      AND q.queued_at::date = '${todayStr}'::date
    `, params);

    const apptParams = [pId];
    let apptQuery = `
      SELECT COUNT(*)::int as count
      FROM clinic_appointments ca
      WHERE (ca.pharmacy_id::text = $1::text OR ca.pharmacy_id IS NULL)
      AND ca.appointment_date = '${todayStr}'::date
    `;
    if (clinic_id) {
      apptParams.push(clinic_id);
      apptQuery += ` AND ca.clinic_id::text = $2::text`;
    }
    const appointmentsTodayRes = await pool.query(apptQuery, apptParams);

    const pendingLabsRes = await pool.query(`
      SELECT COUNT(*)::int as count
      FROM lab_requests lr
      WHERE (lr.pharmacy_id::text = $1::text OR lr.pharmacy_id IS NULL)
      AND lr.status IN ('PENDING', 'IN_PROGRESS')
    `, [pId]);

    const pendingPharmacyRes = await pool.query(`
      SELECT COUNT(*)::int as count
      FROM prescriptions pr
      WHERE (pr.pharmacy_id::text = $1::text OR pr.pharmacy_id IS NULL)
      AND pr.status IN ('PENDING', 'PARTIAL')
    `, [pId]);

    const pendingBillingRes = await pool.query(`
      SELECT COUNT(*)::int as count
      FROM billing_items bi
      WHERE (bi.facility_id::text = $1::text OR bi.facility_id IS NULL OR bi.pharmacy_id::text = $1::text OR bi.pharmacy_id IS NULL)
      AND LOWER(bi.status) = 'pending'
    `, [pId]);

    return successResponse(res, 200, 'Clinic dashboard statistics', {
      today_patients: todayPatientsRes.rows[0]?.count || 0,
      waiting_patients: waitingRes.rows[0]?.count || 0,
      in_consultation: inConsultationRes.rows[0]?.count || 0,
      completed_consultations: completedRes.rows[0]?.count || 0,
      appointments_today: appointmentsTodayRes.rows[0]?.count || 0,
      pending_lab: pendingLabsRes.rows[0]?.count || 0,
      pending_pharmacy: pendingPharmacyRes.rows[0]?.count || 0,
      pending_billing: pendingBillingRes.rows[0]?.count || 0
    });
  } catch (err) {
    logger.error('Failed to fetch clinic stats:', err.message);
    return errorResponse(res, 500, 'Failed to fetch clinic statistics');
  }
};

// ── 7. REPORTS ────────────────────────────────────────────────────────────
const getClinicReports = async (req, res) => {
  try {
    const { clinic_id, date_from, date_to } = req.query;
    const pId = req.pharmacy_id;

    let dateWhere = '';
    const params = [pId];

    if (date_from) {
      params.push(date_from);
      dateWhere += ` AND q.queued_at >= $${params.length}::date`;
    }
    if (date_to) {
      params.push(date_to);
      dateWhere += ` AND q.queued_at <= $${params.length}::date + INTERVAL '1 day'`;
    }

    let clinicWhere = '';
    if (clinic_id) {
      params.push(clinic_id);
      clinicWhere = ` AND q.clinic_id = $${params.length}`;
    }

    // Patient volume by clinic
    const volumeByClinic = await pool.query(`
      SELECT q.clinic_name, COUNT(*)::int as patient_count
      FROM clinic_queue q
      WHERE (q.pharmacy_id = $1 OR q.pharmacy_id IS NULL) ${dateWhere} ${clinicWhere}
      GROUP BY q.clinic_name
      ORDER BY patient_count DESC
    `, params);

    // Top diagnoses across encounters
    const topDiagnoses = await pool.query(`
      SELECT c.diagnosis, COUNT(*)::int as diagnosis_count
      FROM consultations c
      JOIN visits v ON c.visit_id = v.id
      WHERE (v.pharmacy_id = $1 OR v.pharmacy_id IS NULL)
      AND c.diagnosis IS NOT NULL AND c.diagnosis != ''
      GROUP BY c.diagnosis
      ORDER BY diagnosis_count DESC
      LIMIT 10
    `, [pId]);

    // Referral stats
    const referralStats = await pool.query(`
      SELECT r.to_clinic_name, COUNT(*)::int as referral_count
      FROM clinic_referrals r
      WHERE (r.pharmacy_id = $1 OR r.pharmacy_id IS NULL)
      GROUP BY r.to_clinic_name
      ORDER BY referral_count DESC
    `, [pId]);

    return successResponse(res, 200, 'Clinic reports fetched', {
      volume_by_clinic: volumeByClinic.rows,
      top_diagnoses: topDiagnoses.rows,
      referral_stats: referralStats.rows
    });
  } catch (err) {
    logger.error('Failed to fetch clinic reports:', err.message);
    return errorResponse(res, 500, 'Failed to fetch clinic reports');
  }
};

const getMyClinics = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    let clinics = [];

    if (['facility_admin', 'super_admin', 'admin', 'receptionist', 'reception'].includes(userRole)) {
      const allRes = await pool.query(
        `SELECT sc.*, u.full_name as head_doctor_name,
           (SELECT COUNT(*)::int FROM clinic_queue q WHERE q.clinic_id = sc.id AND q.status = 'WAITING') as waiting_count
         FROM special_clinics sc
         LEFT JOIN users u ON sc.head_doctor_id = u.id
         WHERE sc.is_active = TRUE
         ORDER BY sc.name ASC`
      );
      clinics = allRes.rows;
    } else {
      const assignedRes = await pool.query(
        `SELECT DISTINCT sc.*, cd.is_primary, cd.staff_role, cd.assigned_room,
           (SELECT COUNT(*)::int FROM clinic_queue q WHERE q.clinic_id = sc.id AND q.status = 'WAITING') as waiting_count
         FROM special_clinics sc
         JOIN clinic_doctors cd ON sc.id = cd.clinic_id
         WHERE cd.user_id = $1 AND sc.is_active = TRUE
         ORDER BY cd.is_primary DESC, sc.name ASC`,
        [userId]
      );
      clinics = assignedRes.rows;

      if (clinics.length === 0) {
        const fallback = await pool.query(
          `SELECT sc.*,
             (SELECT COUNT(*)::int FROM clinic_queue q WHERE q.clinic_id = sc.id AND q.status = 'WAITING') as waiting_count
           FROM special_clinics sc
           WHERE sc.is_active = TRUE
           ORDER BY sc.name ASC`
        );
        clinics = fallback.rows;
      }
    }
    return successResponse(res, 200, 'Assigned clinics fetched', clinics);
  } catch (err) {
    logger.error('Failed to fetch my clinics:', err.message);
    return errorResponse(res, 500, 'Failed to fetch assigned clinics');
  }
};

module.exports = {
  getSpecialClinics,
  getMyClinics,
  createSpecialClinic,
  updateSpecialClinic,
  getClinicDoctors,
  getAvailableDoctors,
  assignClinicDoctor,
  removeClinicDoctor,
  getClinicServices,
  createClinicService,
  updateClinicService,
  getClinicAppointments,
  createClinicAppointment,
  updateClinicAppointmentStatus,
  getClinicQueue,
  updateClinicQueueStatus,
  referToSpecialClinic,
  getClinicReferrals,
  getClinicDashboardStats,
  getClinicReports
};
