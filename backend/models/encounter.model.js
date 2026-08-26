const { pool } = require('../config/db');
const logger = require('../utils/logger');

/**
 * Log an audit event in encounter_events
 */
async function logEncounterEvent({
  pharmacy_id,
  encounter_id,
  visit_id,
  patient_id,
  event_type,
  actor_id,
  metadata
}, client = null) {
  const queryClient = client || pool;
  try {
    const res = await queryClient.query(`
      INSERT INTO encounter_events (
        pharmacy_id, encounter_id, visit_id, patient_id, event_type, actor_id, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `, [
      pharmacy_id || null,
      encounter_id,
      visit_id || null,
      patient_id || null,
      event_type,
      actor_id || null,
      metadata ? (typeof metadata === 'object' ? JSON.stringify(metadata) : metadata) : null
    ]);
    return res.rows[0];
  } catch (err) {
    logger.error('Failed to log encounter event:', err.message);
    return null;
  }
}

/**
 * Find an active or paused encounter for a given visit
 */
async function findActiveByVisit(visit_id, pharmacy_id = null, client = null) {
  const queryClient = client || pool;
  let q = `
    SELECT * FROM encounters 
    WHERE visit_id::text = $1::text AND status IN ('IN_PROGRESS', 'PAUSED', 'active')
  `;
  const params = [visit_id];
  if (pharmacy_id) {
    params.push(pharmacy_id);
    q += ` AND (pharmacy_id::text = $2::text OR pharmacy_id IS NULL)`;
  }
  q += ` ORDER BY created_at DESC LIMIT 1`;
  const res = await queryClient.query(q, params);
  return res.rows[0] || null;
}

/**
 * Get or create an active encounter for a visit.
 * Resume if paused / in progress. Never create duplicate active encounters or visits.
 */
async function getOrCreateActiveEncounter({
  visit_id,
  patient_id,
  pharmacy_id,
  doctor_id,
  department_id,
  clinic_id,
  current_step = 'consultation'
}, client = null) {
  const queryClient = client || pool;

  // 1. Try to find an existing active/paused encounter for this visit
  let active = await findActiveByVisit(visit_id, pharmacy_id, queryClient);

  if (active) {
    // Resume/update existing encounter
    const updateRes = await queryClient.query(`
      UPDATE encounters
      SET status = 'IN_PROGRESS',
          doctor_id = COALESCE($1, doctor_id),
          department_id = COALESCE($2, department_id),
          clinic_id = COALESCE($3, clinic_id),
          current_step = COALESCE($4, current_step),
          updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `, [doctor_id || null, department_id || null, clinic_id || null, current_step, active.id]);

    const updatedEncounter = updateRes.rows[0];

    await logEncounterEvent({
      pharmacy_id,
      encounter_id: updatedEncounter.id,
      visit_id,
      patient_id,
      event_type: 'RESUMED',
      actor_id: doctor_id,
      metadata: { action: 'resume_encounter', current_step }
    }, queryClient);

    return updatedEncounter;
  }

  // 2. Create new encounter for this visit
  const encNumber = `ENC-${visit_id}-${Math.floor(Date.now() / 1000)}`;
  const insRes = await queryClient.query(`
    INSERT INTO encounters (
      pharmacy_id, visit_id, patient_id, encounter_number,
      department_id, clinic_id, doctor_id, status, current_step,
      started_at, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'IN_PROGRESS', $8, NOW(), NOW(), NOW())
    RETURNING *
  `, [
    pharmacy_id || null,
    visit_id,
    patient_id,
    encNumber,
    department_id || null,
    clinic_id || null,
    doctor_id || null,
    current_step
  ]);

  const newEncounter = insRes.rows[0];

  await logEncounterEvent({
    pharmacy_id,
    encounter_id: newEncounter.id,
    visit_id,
    patient_id,
    event_type: 'STARTED',
    actor_id: doctor_id,
    metadata: { action: 'start_encounter', encounter_number: encNumber }
  }, queryClient);

  return newEncounter;
}

/**
 * Pause an encounter
 */
async function pauseEncounter(encounter_id, actor_id = null, metadata = {}, client = null, pharmacy_id = null) {
  const queryClient = client || pool;
  let q = `
    UPDATE encounters
    SET status = 'PAUSED', paused_at = NOW(), updated_at = NOW()
    WHERE id = $1
  `;
  const params = [encounter_id];
  if (pharmacy_id) {
    params.push(pharmacy_id);
    q += ` AND (pharmacy_id::text = $2::text OR pharmacy_id IS NULL)`;
  }
  q += ` RETURNING *`;

  const res = await queryClient.query(q, params);

  if (res.rows[0]) {
    const enc = res.rows[0];
    await logEncounterEvent({
      pharmacy_id: enc.pharmacy_id,
      encounter_id: enc.id,
      visit_id: enc.visit_id,
      patient_id: enc.patient_id,
      event_type: 'PAUSED',
      actor_id,
      metadata
    }, queryClient);
  }
  return res.rows[0] || null;
}

/**
 * Complete an encounter
 */
async function completeEncounter(encounter_id, actor_id = null, current_step = 'completed', metadata = {}, client = null, pharmacy_id = null) {
  const queryClient = client || pool;
  let q = `
    UPDATE encounters
    SET status = 'COMPLETED', completed_at = NOW(), current_step = $2, updated_at = NOW()
    WHERE id = $1
  `;
  const params = [encounter_id, current_step];
  if (pharmacy_id) {
    params.push(pharmacy_id);
    q += ` AND (pharmacy_id::text = $3::text OR pharmacy_id IS NULL)`;
  }
  q += ` RETURNING *`;

  const res = await queryClient.query(q, params);

  if (res.rows[0]) {
    const enc = res.rows[0];
    await logEncounterEvent({
      pharmacy_id: enc.pharmacy_id,
      encounter_id: enc.id,
      visit_id: enc.visit_id,
      patient_id: enc.patient_id,
      event_type: 'COMPLETED',
      actor_id,
      metadata
    }, queryClient);
  }
  return res.rows[0] || null;
}

/**
 * Update current step of an encounter
 */
async function updateEncounterStep(encounter_id, current_step, actor_id = null, metadata = {}, client = null, pharmacy_id = null) {
  const queryClient = client || pool;
  let q = `
    UPDATE encounters
    SET current_step = $2, updated_at = NOW()
    WHERE id = $1
  `;
  const params = [encounter_id, current_step];
  if (pharmacy_id) {
    params.push(pharmacy_id);
    q += ` AND (pharmacy_id::text = $3::text OR pharmacy_id IS NULL)`;
  }
  q += ` RETURNING *`;

  const res = await queryClient.query(q, params);

  if (res.rows[0]) {
    const enc = res.rows[0];
    await logEncounterEvent({
      pharmacy_id: enc.pharmacy_id,
      encounter_id: enc.id,
      visit_id: enc.visit_id,
      patient_id: enc.patient_id,
      event_type: 'STEP_UPDATED',
      actor_id,
      metadata: { current_step, ...metadata }
    }, queryClient);
  }
  return res.rows[0] || null;
}

/**
 * Get full encounter details with events and linked items
 */
async function getEncounterById(encounter_id, pharmacy_id = null) {
  let q = `SELECT e.*, p.first_name, p.last_name, p.patient_number, u.full_name as doctor_name
           FROM encounters e
           JOIN patients p ON e.patient_id::text = p.id::text
           LEFT JOIN users u ON e.doctor_id::text = u.id::text
           WHERE e.id::text = $1::text`;
  const params = [encounter_id];
  if (pharmacy_id) {
    params.push(pharmacy_id);
    q += ` AND (e.pharmacy_id::text = $2::text OR e.pharmacy_id IS NULL)`;
  }

  const encRes = await pool.query(q, params);
  if (!encRes.rows[0]) return null;

  const encounter = encRes.rows[0];

  const eventsRes = await pool.query(`
    SELECT ee.*, u.full_name as actor_name
    FROM encounter_events ee
    LEFT JOIN users u ON ee.actor_id::text = u.id::text
    WHERE ee.encounter_id::text = $1::text
    ORDER BY ee.created_at ASC
  `, [encounter_id]);

  encounter.events = eventsRes.rows;

  return encounter;
}

/**
 * Get all encounters for a visit
 */
async function getEncountersByVisit(visit_id, pharmacy_id = null) {
  let q = `SELECT e.*, u.full_name as doctor_name
           FROM encounters e
           LEFT JOIN users u ON e.doctor_id::text = u.id::text
           WHERE e.visit_id::text = $1::text`;
  const params = [visit_id];
  if (pharmacy_id) {
    params.push(pharmacy_id);
    q += ` AND (e.pharmacy_id::text = $2::text OR e.pharmacy_id IS NULL)`;
  }
  q += ` ORDER BY e.created_at DESC`;

  const res = await pool.query(q, params);
  return res.rows;
}

module.exports = {
  findActiveByVisit,
  getOrCreateActiveEncounter,
  pauseEncounter,
  completeEncounter,
  updateEncounterStep,
  logEncounterEvent,
  getEncounterById,
  getEncountersByVisit
};
