const { pool } = require('../config/db');
const { encrypt, decrypt } = require('../utils/encryption');

function decryptPatient(p) {
  if (!p) return p;
  return {
    ...p,
    national_id: decrypt(p.national_id),
    sha_number: decrypt(p.sha_number),
    allergies: decrypt(p.allergies),
    chronic_conditions: decrypt(p.chronic_conditions)
  };
}

class PatientModel {
  static async generatePatientNumber(pharmacy_id) {
    const year = new Date().getFullYear();
    const result = await pool.query(`
      SELECT COUNT(*) as count FROM patients WHERE pharmacy_id = $1 AND patient_number LIKE $2
    `, [pharmacy_id, `PT-${year}-%`]);
    const count = parseInt(result.rows[0].count) + 1;
    return `PT-${year}-${String(count).padStart(4, '0')}`;
  }

  static async create({
    pharmacy_id, full_name, date_of_birth, gender, national_id, sha_number,
    phone, email, address, county, next_of_kin_name, next_of_kin_phone,
    next_of_kin_relation, blood_group, allergies, chronic_conditions,
    occupation, marital_status, emirates_id, nabidh_consent, passport_number
  }) {
    const patient_number = await PatientModel.generatePatientNumber(pharmacy_id);
    const dob = (date_of_birth && String(date_of_birth).trim() !== '') ? String(date_of_birth).trim() : null;
    const result = await pool.query(`
      INSERT INTO patients (
        pharmacy_id, patient_number, full_name, date_of_birth, gender,
        national_id, sha_number, phone, email, address, county,
        next_of_kin_name, next_of_kin_phone, next_of_kin_relation,
        blood_group, allergies, chronic_conditions, occupation, marital_status,
        emirates_id, nabidh_consent, passport_number
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      RETURNING *
    `, [
      pharmacy_id, patient_number, full_name, dob, gender || null,
      national_id ? encrypt(national_id) : null, sha_number ? encrypt(sha_number) : null, phone || null, email || null,
      address || null, county || null, next_of_kin_name || null,
      next_of_kin_phone || null, next_of_kin_relation || null,
      blood_group || null, allergies ? encrypt(allergies) : null, chronic_conditions ? encrypt(chronic_conditions) : null,
      occupation || null, marital_status || null,
      emirates_id || null, nabidh_consent || 'opt_out', passport_number || null
    ]);
    return decryptPatient(result.rows[0]);
  }

  static async findAll({ pharmacy_id, search, limit = 100, offset = 0 }) {
    let query = `
      SELECT p.*,
        COUNT(v.id) as total_visits,
        MAX(v.created_at) as last_visit
      FROM patients p
      LEFT JOIN visits v ON p.id = v.patient_id
      WHERE ($1::text IS NULL OR p.pharmacy_id::text = $1::text)
        AND (p.is_active = true OR p.is_active IS NULL)
    `;
    const params = [pharmacy_id ? String(pharmacy_id) : null];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (
        p.full_name ILIKE $${params.length} OR
        p.patient_number ILIKE $${params.length} OR
        p.phone ILIKE $${params.length} OR
        p.national_id ILIKE $${params.length} OR
        p.email ILIKE $${params.length}
      )`;
    }

    query += ` GROUP BY p.id ORDER BY p.created_at DESC`;
    params.push(limit); query += ` LIMIT $${params.length}`;
    params.push(offset); query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    return result.rows.map(decryptPatient);
  }

  static async findById(id, pharmacy_id) {
    const result = await pool.query(`
      SELECT p.*,
        COUNT(v.id) as total_visits,
        MAX(v.created_at) as last_visit
      FROM patients p
      LEFT JOIN visits v ON p.id = v.patient_id
      WHERE p.id::text = $1::text AND ($2::text IS NULL OR p.pharmacy_id::text = $2::text)
      GROUP BY p.id
    `, [String(id), pharmacy_id ? String(pharmacy_id) : null]);
    return decryptPatient(result.rows[0]);
  }

  static async findByNumber(patient_number, pharmacy_id) {
    const result = await pool.query(`
      SELECT * FROM patients WHERE patient_number = $1 AND ($2::text IS NULL OR pharmacy_id::text = $2::text)
    `, [patient_number, pharmacy_id ? String(pharmacy_id) : null]);
    return decryptPatient(result.rows[0]);
  }

  static async update(id, pharmacy_id, fields) {
    const {
      full_name, date_of_birth, gender, national_id, sha_number,
      phone, email, address, county, next_of_kin_name, next_of_kin_phone,
      next_of_kin_relation, blood_group, allergies, chronic_conditions,
      occupation, marital_status, emirates_id, nabidh_consent, passport_number
    } = fields;
    const result = await pool.query(`
      UPDATE patients SET
        full_name=$1, date_of_birth=$2, gender=$3, national_id=$4, sha_number=$5,
        phone=$6, email=$7, address=$8, county=$9, next_of_kin_name=$10,
        next_of_kin_phone=$11, next_of_kin_relation=$12, blood_group=$13,
        allergies=$14, chronic_conditions=$15, occupation=$16,
        marital_status=$17, emirates_id=$18, nabidh_consent=$19, passport_number=$20, updated_at=NOW()
      WHERE id::text=$21::text AND ($22::text IS NULL OR pharmacy_id::text=$22::text) RETURNING *
    `, [
      full_name, (date_of_birth && String(date_of_birth).trim() !== '') ? String(date_of_birth).trim() : null, gender, national_id ? encrypt(national_id) : null, sha_number ? encrypt(sha_number) : null,
      phone, email || null, address || null, county || null, next_of_kin_name || null,
      next_of_kin_phone || null, next_of_kin_relation || null, blood_group || null,
      allergies ? encrypt(allergies) : null, chronic_conditions ? encrypt(chronic_conditions) : null, occupation || null,
      marital_status || null, emirates_id || null, nabidh_consent || 'opt_out', passport_number || null,
      String(id), pharmacy_id ? String(pharmacy_id) : null
    ]);
    return decryptPatient(result.rows[0]);
  }

  static async getVisits(patient_id, pharmacy_id) {
    const result = await pool.query(`
      SELECT v.*,
        v.created_at as visit_date,
        u.full_name as created_by_name,
        vt.blood_pressure_systolic, vt.blood_pressure_diastolic,
        vt.pulse_rate, vt.temperature, vt.weight, vt.oxygen_saturation, vt.respiratory_rate,
        c.id as consultation_id, c.diagnosis, c.icd_code, c.presenting_complaint,
        c.history_of_illness, c.examination_findings, c.review_of_systems,
        c.impression, c.management_plan, c.nurse_instructions,
        c.follow_up_date, c.follow_up_notes, c.admit_patient, c.admission_ward, c.admission_notes,
        doc.full_name as attending_doctor,
        (
          SELECT COALESCE(json_agg(jsonb_build_object(
            'id', lr.id,
            'test_name', lr.test_name,
            'test_code', lr.test_code,
            'urgency', lr.urgency,
            'status', lr.status,
            'notes', lr.notes,
            'result', lr.result,
            'result_value', lr.result_value,
            'result_unit', lr.result_unit,
            'reference_range', lr.reference_range,
            'technician_notes', lr.technician_notes,
            'result_flag', lr.result_flag,
            'created_at', lr.created_at,
            'resulted_at', lr.updated_at
          )), '[]'::json)
          FROM lab_requests lr
          WHERE lr.visit_id = v.id
        ) as lab_results,
        (
          SELECT COALESCE(json_agg(jsonb_build_object(
            'id', p.id,
            'drug_name', p.drug_name,
            'dosage', p.dosage,
            'frequency', p.frequency,
            'route', p.route,
            'duration', p.duration,
            'quantity', p.quantity,
            'instructions', p.instructions,
            'status', p.status
          )), '[]'::json)
          FROM prescriptions p
          WHERE p.visit_id = v.id
        ) as prescriptions,
        (
          SELECT COALESCE(json_agg(jsonb_build_object(
            'id', iro.id,
            'drug_name', iro.drug_name,
            'dosage', iro.dosage,
            'route', iro.route,
            'frequency', iro.frequency,
            'duration', iro.duration,
            'quantity', iro.quantity,
            'instructions', iro.instructions,
            'status', iro.status,
            'nurse_report', iro.nurse_report,
            'notes', iro.notes,
            'administered_at', iro.administered_at
          )), '[]'::json)
          FROM injection_room_orders iro
          WHERE iro.visit_id = v.id
        ) as injection_orders,
        (
          SELECT COALESCE(json_agg(jsonb_build_object(
            'id', pr.id,
            'procedure_name', pr.procedure_name,
            'procedure_code', pr.procedure_code,
            'outcome', pr.outcome,
            'notes', pr.notes
          )), '[]'::json)
          FROM procedures pr
          WHERE pr.visit_id::text = v.id::text
        ) as procedures
      FROM visits v
      LEFT JOIN users u ON v.created_by = u.id
      LEFT JOIN LATERAL (
        SELECT blood_pressure_systolic, blood_pressure_diastolic,
               pulse_rate, temperature, weight, oxygen_saturation, respiratory_rate
        FROM vitals
        WHERE visit_id::text = v.id::text
        ORDER BY recorded_at DESC
        LIMIT 1
      ) vt ON true
      LEFT JOIN consultations c ON v.id = c.visit_id
      LEFT JOIN users doc ON c.doctor_id = doc.id
      WHERE v.patient_id::text = $1::text AND ($2::text IS NULL OR v.pharmacy_id::text = $2::text)
      ORDER BY v.created_at DESC
    `, [String(patient_id), pharmacy_id ? String(pharmacy_id) : null]);
    return result.rows;
  }

  static async getStats(pharmacy_id) {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_patients,
        COUNT(CASE WHEN LOWER(gender)='male' THEN 1 END) as male_count,
        COUNT(CASE WHEN LOWER(gender)='female' THEN 1 END) as female_count,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_this_month,
        COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as registered_today
      FROM patients 
      WHERE ($1::text IS NULL OR pharmacy_id::text = $1::text) 
        AND (is_active = true OR is_active IS NULL)
    `, [pharmacy_id ? String(pharmacy_id) : null]);
    return result.rows[0];
  }
}

module.exports = PatientModel;
