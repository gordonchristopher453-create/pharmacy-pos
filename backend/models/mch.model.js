const { pool } = require('../config/db');

class MCHModel {

  // ─── ANC ────────────────────────────────────────────────
  static async registerANC(data) {
    const { pharmacy_id, patient_id, anc_number, gravida, para, lmp, edd,
      gestation_age, weight, height, blood_pressure, fundal_height,
      fetal_heart_rate, risk_factors, next_appointment, created_by,
      anc_clinic_number, marital_status, occupation, next_of_kin, next_of_kin_phone } = data;
    const r = await pool.query(`
      INSERT INTO anc_registrations (pharmacy_id, patient_id, anc_number, gravida, para,
        lmp, edd, gestation_age, weight, height, blood_pressure, fundal_height,
        fetal_heart_rate, risk_factors, next_appointment, created_by,
        anc_clinic_number, marital_status, occupation, next_of_kin, next_of_kin_phone)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING *`,
      [pharmacy_id, patient_id, anc_number, gravida, para, lmp, edd,
       gestation_age, weight, height, blood_pressure, fundal_height,
       fetal_heart_rate, risk_factors, next_appointment, created_by,
       anc_clinic_number, marital_status, occupation, next_of_kin, next_of_kin_phone]);
    return r.rows[0];
  }

  static async getANCList(pharmacy_id, search = '') {
    const r = await pool.query(`
      SELECT a.*, p.full_name, p.date_of_birth, p.phone, p.patient_number
      FROM anc_registrations a
      JOIN patients p ON a.patient_id = p.id
      WHERE a.pharmacy_id = $1
      AND ($2 = '' OR p.full_name ILIKE $3 OR a.anc_number ILIKE $3)
      ORDER BY a.created_at DESC`,
      [pharmacy_id, search, `%${search}%`]);
    return r.rows;
  }

  static async getANCById(id, pharmacy_id) {
    const r = await pool.query(`
      SELECT a.*, p.full_name, p.date_of_birth, p.phone, p.gender, p.patient_number
      FROM anc_registrations a
      JOIN patients p ON a.patient_id = p.id
      WHERE a.id = $1 AND a.pharmacy_id = $2`, [id, pharmacy_id]);
    return r.rows[0];
  }

  static async updateANC(id, pharmacy_id, data) {
    const fields = Object.keys(data).map((k, i) => `${k}=$${i+3}`).join(', ');
    const r = await pool.query(
      `UPDATE anc_registrations SET ${fields}, updated_at=NOW()
       WHERE id=$1 AND pharmacy_id=$2 RETURNING *`,
      [id, pharmacy_id, ...Object.values(data)]);
    return r.rows[0];
  }

  static async addANCVisit(data) {
    const { anc_id, pharmacy_id, visit_date, gestation_age, weight, blood_pressure,
      fundal_height, fetal_heart_rate, complaints, treatment_given, next_appointment, created_by,
      visit_number } = data;
    const r = await pool.query(`
      INSERT INTO anc_visits (anc_id, pharmacy_id, visit_date, gestation_age, weight,
        blood_pressure, fundal_height, fetal_heart_rate, complaints, treatment_given,
        next_appointment, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [anc_id, pharmacy_id, visit_date, gestation_age, weight, blood_pressure,
       fundal_height, fetal_heart_rate, complaints, treatment_given, next_appointment, created_by]);
    return r.rows[0];
  }

  static async getANCVisits(anc_id) {
    const r = await pool.query(
      `SELECT * FROM anc_visits WHERE anc_id=$1 ORDER BY visit_date DESC`, [anc_id]);
    return r.rows;
  }

  static async saveANCProfile(data) {
    const { anc_id, pharmacy_id, blood_group, rh_factor, hemoglobin, urinalysis,
      hiv_test, vdrl, hiv_test_date, vdrl_date, lab_reference, performed_by, notes } = data;
    const r = await pool.query(`
      INSERT INTO anc_profiles (anc_id, pharmacy_id, blood_group, rh_factor, hemoglobin,
        urinalysis, hiv_test, vdrl, hiv_test_date, vdrl_date, lab_reference, performed_by, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (anc_id) DO UPDATE SET
        blood_group=EXCLUDED.blood_group, rh_factor=EXCLUDED.rh_factor,
        hemoglobin=EXCLUDED.hemoglobin, urinalysis=EXCLUDED.urinalysis,
        hiv_test=EXCLUDED.hiv_test, vdrl=EXCLUDED.vdrl,
        hiv_test_date=EXCLUDED.hiv_test_date, vdrl_date=EXCLUDED.vdrl_date,
        lab_reference=EXCLUDED.lab_reference, performed_by=EXCLUDED.performed_by,
        notes=EXCLUDED.notes
      RETURNING *`,
      [anc_id, pharmacy_id, blood_group, rh_factor, hemoglobin, urinalysis,
       hiv_test, vdrl, hiv_test_date, vdrl_date, lab_reference, performed_by, notes]);
    return r.rows[0];
  }

  static async getANCProfile(anc_id) {
    const r = await pool.query(`SELECT * FROM anc_profiles WHERE anc_id=$1`, [anc_id]);
    return r.rows[0];
  }

  // ─── PNC ────────────────────────────────────────────────
  static async addPNCVisit(data) {
    const { pharmacy_id, patient_id, anc_id, visit_date, delivery_date, delivery_outcome,
      mother_condition, baby_condition, feeding_method, postnatal_assessment,
      fp_counseling, next_visit_date, created_by } = data;
    const r = await pool.query(`
      INSERT INTO pnc_visits (pharmacy_id, patient_id, anc_id, visit_date, delivery_date,
        delivery_outcome, mother_condition, baby_condition, feeding_method,
        postnatal_assessment, fp_counseling, next_visit_date, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [pharmacy_id, patient_id, anc_id, visit_date, delivery_date, delivery_outcome,
       mother_condition, baby_condition, feeding_method, postnatal_assessment,
       fp_counseling, next_visit_date, created_by]);
    return r.rows[0];
  }

  static async getPNCVisits(pharmacy_id, patient_id) {
    const r = await pool.query(`
      SELECT pv.*, p.full_name, p.patient_number
      FROM pnc_visits pv JOIN patients p ON pv.patient_id = p.id
      WHERE pv.pharmacy_id=$1 ${patient_id ? 'AND pv.patient_id=$2' : ''}
      ORDER BY pv.visit_date DESC`,
      patient_id ? [pharmacy_id, patient_id] : [pharmacy_id]);
    return r.rows;
  }

  // ─── CWC ────────────────────────────────────────────────
  static async addCWCRecord(data) {
    const { pharmacy_id, patient_id, visit_date, birth_weight, current_weight,
      height, muac, head_circumference, nutrition_status, milestones, notes, created_by } = data;
    const r = await pool.query(`
      INSERT INTO cwc_records (pharmacy_id, patient_id, visit_date, birth_weight,
        current_weight, height, muac, head_circumference, nutrition_status,
        milestones, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [pharmacy_id, patient_id, visit_date, birth_weight, current_weight,
       height, muac, head_circumference, nutrition_status, milestones, notes, created_by]);
    return r.rows[0];
  }

  static async getCWCRecords(pharmacy_id, patient_id) {
    const r = await pool.query(`
      SELECT c.*, p.full_name, p.patient_number, p.date_of_birth
      FROM cwc_records c JOIN patients p ON c.patient_id = p.id
      WHERE c.pharmacy_id=$1 ${patient_id ? 'AND c.patient_id=$2' : ''}
      ORDER BY c.visit_date DESC`,
      patient_id ? [pharmacy_id, patient_id] : [pharmacy_id]);
    return r.rows;
  }

  // ─── IMMUNIZATION ────────────────────────────────────────
  static async addImmunization(data) {
    const { pharmacy_id, patient_id, vaccine, dose, batch_number,
      date_given, next_due_date, administered_by, notes, created_by } = data;
    const r = await pool.query(`
      INSERT INTO immunizations (pharmacy_id, patient_id, vaccine, dose, batch_number,
        date_given, next_due_date, administered_by, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [pharmacy_id, patient_id, vaccine, dose, batch_number,
       date_given, next_due_date, administered_by, notes, created_by]);
    return r.rows[0];
  }

  static async getImmunizations(pharmacy_id, patient_id) {
    const r = await pool.query(`
      SELECT i.*, p.full_name, p.patient_number, p.date_of_birth
      FROM immunizations i JOIN patients p ON i.patient_id = p.id
      WHERE i.pharmacy_id=$1 ${patient_id ? 'AND i.patient_id=$2' : ''}
      ORDER BY i.date_given DESC`,
      patient_id ? [pharmacy_id, patient_id] : [pharmacy_id]);
    return r.rows;
  }

  static async getDueImmunizations(pharmacy_id) {
    const r = await pool.query(`
      SELECT i.*, p.full_name, p.phone, p.patient_number
      FROM immunizations i JOIN patients p ON i.patient_id = p.id
      WHERE i.pharmacy_id=$1 AND i.next_due_date <= CURRENT_DATE + INTERVAL '7 days'
      AND i.next_due_date >= CURRENT_DATE
      ORDER BY i.next_due_date ASC`, [pharmacy_id]);
    return r.rows;
  }

  // ─── FAMILY PLANNING ─────────────────────────────────────
  static async addFamilyPlanning(data) {
    const { pharmacy_id, patient_id, method, start_date, follow_up_date,
      side_effects, counseling_notes, created_by } = data;
    const r = await pool.query(`
      INSERT INTO family_planning (pharmacy_id, patient_id, method, start_date,
        follow_up_date, side_effects, counseling_notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [pharmacy_id, patient_id, method, start_date, follow_up_date,
       side_effects, counseling_notes, created_by]);
    return r.rows[0];
  }

  static async getFamilyPlanning(pharmacy_id, patient_id) {
    const r = await pool.query(`
      SELECT f.*, p.full_name, p.patient_number
      FROM family_planning f JOIN patients p ON f.patient_id = p.id
      WHERE f.pharmacy_id=$1 ${patient_id ? 'AND f.patient_id=$2' : ''}
      ORDER BY f.start_date DESC`,
      patient_id ? [pharmacy_id, patient_id] : [pharmacy_id]);
    return r.rows;
  }

  // ─── MATERNITY REFERRAL ──────────────────────────────────
  static async addReferral(data) {
    const { pharmacy_id, patient_id, anc_id, referral_date, delivery_date,
      delivery_type, mother_outcome, baby_outcome, notes, created_by } = data;
    const r = await pool.query(`
      INSERT INTO maternity_referrals (pharmacy_id, patient_id, anc_id, referral_date,
        delivery_date, delivery_type, mother_outcome, baby_outcome, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [pharmacy_id, patient_id, anc_id, referral_date, delivery_date,
       delivery_type, mother_outcome, baby_outcome, notes, created_by]);
    return r.rows[0];
  }

  // ─── DASHBOARD STATS ─────────────────────────────────────
  static async getDashboardStats(pharmacy_id) {
    const today = new Date().toISOString().split('T')[0];
    const [
      anc, pnc, imm, fp, cwc,
      ancMonth, pncMonth, immMonth, fpMonth, cwcMonth,
      deliveriesMonth, highrisk, due
    ] = await Promise.all([
      // Today's counts
      pool.query(`SELECT COUNT(*) FROM visits WHERE pharmacy_id=$1 AND mch_service='mch_anc' AND DATE(created_at) = $2`, [pharmacy_id, today]),
      pool.query(`SELECT COUNT(*) FROM visits WHERE pharmacy_id=$1 AND mch_service='mch_pnc' AND DATE(created_at) = $2`, [pharmacy_id, today]),
      pool.query(`SELECT COUNT(*) FROM visits WHERE pharmacy_id=$1 AND mch_service='mch_immunization' AND DATE(created_at) = $2`, [pharmacy_id, today]),
      pool.query(`SELECT COUNT(*) FROM visits WHERE pharmacy_id=$1 AND mch_service='mch_fp' AND DATE(created_at) = $2`, [pharmacy_id, today]),
      pool.query(`SELECT COUNT(*) FROM visits WHERE pharmacy_id=$1 AND mch_service='mch_cwc' AND DATE(created_at) = $2`, [pharmacy_id, today]),
      
      // Monthly counts
      pool.query(`SELECT COUNT(*) FROM visits WHERE pharmacy_id=$1 AND mch_service='mch_anc' AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`, [pharmacy_id]),
      pool.query(`SELECT COUNT(*) FROM visits WHERE pharmacy_id=$1 AND mch_service='mch_pnc' AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`, [pharmacy_id]),
      pool.query(`SELECT COUNT(*) FROM visits WHERE pharmacy_id=$1 AND mch_service='mch_immunization' AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`, [pharmacy_id]),
      pool.query(`SELECT COUNT(*) FROM visits WHERE pharmacy_id=$1 AND mch_service='mch_fp' AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`, [pharmacy_id]),
      pool.query(`SELECT COUNT(*) FROM visits WHERE pharmacy_id=$1 AND mch_service='mch_cwc' AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`, [pharmacy_id]),
      
      // Deliveries and alert thresholds
      pool.query(`SELECT COUNT(*) FROM delivery_register WHERE pharmacy_id=$1 AND EXTRACT(MONTH FROM delivery_date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM delivery_date) = EXTRACT(YEAR FROM CURRENT_DATE)`, [pharmacy_id]).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(*) FROM anc_registrations WHERE pharmacy_id=$1 AND risk_factors IS NOT NULL AND cardinality(risk_factors) > 0`, [pharmacy_id]),
      pool.query(`SELECT COUNT(*) FROM immunizations WHERE pharmacy_id=$1 AND next_due_date <= CURRENT_DATE + INTERVAL '7 days' AND next_due_date >= CURRENT_DATE`, [pharmacy_id]),
    ]);
    return {
      anc_today: parseInt(anc.rows[0].count),
      pnc_today: parseInt(pnc.rows[0].count),
      immunizations_today: parseInt(imm.rows[0].count),
      fp_today: parseInt(fp.rows[0].count),
      cwc_today: parseInt(cwc.rows[0].count),
      
      anc_total: parseInt(ancMonth.rows[0].count),
      pnc_total: parseInt(pncMonth.rows[0].count),
      immunizations_total: parseInt(immMonth.rows[0].count),
      fp_total: parseInt(fpMonth.rows[0].count),
      cwc_total: parseInt(cwcMonth.rows[0].count),
      
      deliveries_total: parseInt(deliveriesMonth.rows[0].count),
      high_risk: parseInt(highrisk.rows[0].count),
      due_immunizations: parseInt(due.rows[0].count),
    };
  }

  // ─── REPORTS ─────────────────────────────────────────────
  static async getANCRegister(pharmacy_id, month, year) {
    const r = await pool.query(`
      SELECT a.*, p.full_name, p.date_of_birth, p.phone, p.patient_number
      FROM anc_registrations a JOIN patients p ON a.patient_id = p.id
      WHERE a.pharmacy_id=$1
      AND EXTRACT(MONTH FROM a.created_at)=$2
      AND EXTRACT(YEAR FROM a.created_at)=$3
      ORDER BY a.created_at`, [pharmacy_id, month, year]);
    return r.rows;
  }

  static async getImmunizationRegister(pharmacy_id, month, year) {
    const r = await pool.query(`
      SELECT i.*, p.full_name, p.date_of_birth, p.patient_number
      FROM immunizations i JOIN patients p ON i.patient_id = p.id
      WHERE i.pharmacy_id=$1
      AND EXTRACT(MONTH FROM i.date_given)=$2
      AND EXTRACT(YEAR FROM i.date_given)=$3
      ORDER BY i.date_given`, [pharmacy_id, month, year]);
    return r.rows;
  }

  // ─── HIGH RISK FLAGS ────────────────────────────────────
  static async addHighRiskFlag(data) {
    const { anc_id, risk_type, notes, created_by } = data;
    const r = await pool.query(`
      INSERT INTO anc_high_risk_flags (anc_id, risk_type, notes, created_by)
      VALUES ($1,$2,$3,$4) RETURNING *`,
      [anc_id, risk_type, notes, created_by]);
    return r.rows[0];
  }

  static async getHighRiskFlags(anc_id) {
    const r = await pool.query(
      `SELECT * FROM anc_high_risk_flags WHERE anc_id=$1 ORDER BY created_at DESC`, [anc_id]);
    return r.rows;
  }

  static async deleteHighRiskFlag(flag_id) {
    await pool.query(`DELETE FROM anc_high_risk_flags WHERE id=$1`, [flag_id]);
  }

  // ─── MCH APPOINTMENTS ────────────────────────────────────
  static async createMCHAppointment(data) {
    const { pharmacy_id, patient_id, anc_id, appointment_type, appointment_date, notes, created_by } = data;
    const r = await pool.query(`
      INSERT INTO mch_appointments (pharmacy_id, patient_id, anc_id, appointment_type, appointment_date, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [pharmacy_id, patient_id, anc_id, appointment_type, appointment_date, notes, created_by]);
    return r.rows[0];
  }

  static async getMCHAppointments(pharmacy_id, filters = {}) {
    let query = `SELECT ma.*, p.full_name, p.patient_number 
                 FROM mch_appointments ma 
                 JOIN patients p ON ma.patient_id = p.id 
                 WHERE ma.pharmacy_id=$1`;
    const params = [pharmacy_id];
    
    if (filters.patient_id) {
      params.push(filters.patient_id);
      query += ` AND ma.patient_id=$${params.length}`;
    }
    if (filters.date) {
      params.push(filters.date);
      query += ` AND ma.appointment_date=$${params.length}`;
    }
    if (filters.type) {
      params.push(filters.type);
      query += ` AND ma.appointment_type=$${params.length}`;
    }
    
    query += ` ORDER BY ma.appointment_date DESC`;
    const r = await pool.query(query, params);
    return r.rows;
  }

  static async updateMCHAppointment(id, pharmacy_id, data) {
    const fields = Object.keys(data).map((k, i) => `${k}=$${i+3}`).join(', ');
    const r = await pool.query(
      `UPDATE mch_appointments SET ${fields} 
       WHERE id=$1 AND pharmacy_id=$2 RETURNING *`,
      [id, pharmacy_id, ...Object.values(data)]);
    return r.rows[0];
  }

  static async deleteMCHAppointment(id, pharmacy_id) {
    await pool.query(`DELETE FROM mch_appointments WHERE id=$1 AND pharmacy_id=$2`, [id, pharmacy_id]);
  }


  // ─── MOH REPORTS ─────────────────────────────────────────
  static async getMOH510ANC(pharmacy_id, month, year) {
    const r = await pool.query(`
      SELECT 
        ROW_NUMBER() OVER (ORDER BY a.created_at) as serial_no,
        a.created_at::date as date_seen,
        a.anc_number,
        a.anc_clinic_number,
        p.full_name,
        p.date_of_birth,
        a.gravida,
        a.para,
        a.lmp,
        a.edd,
        a.gestation_age,
        a.weight,
        a.height,
        a.blood_pressure,
        a.fundal_height,
        a.fetal_heart_rate,
        a.marital_status,
        a.occupation,
        a.next_of_kin,
        a.next_of_kin_phone,
        a.risk_factors,
        a.next_appointment,
        a.status
      FROM anc_registrations a
      JOIN patients p ON a.patient_id = p.id
      WHERE a.pharmacy_id=$1
      AND EXTRACT(MONTH FROM a.created_at)=$2
      AND EXTRACT(YEAR FROM a.created_at)=$3
      ORDER BY a.created_at`, [pharmacy_id, month, year]);
    return r.rows;
  }

  static async getMOH511PNC(pharmacy_id, month, year) {
    const r = await pool.query(`
      SELECT 
        ROW_NUMBER() OVER (ORDER BY pv.visit_date) as serial_no,
        pv.visit_date,
        p.full_name,
        p.date_of_birth,
        pv.delivery_date,
        pv.delivery_outcome,
        pv.mother_condition,
        pv.baby_condition,
        pv.feeding_method,
        pv.postnatal_assessment,
        pv.fp_counseling,
        pv.next_visit_date
      FROM pnc_visits pv
      JOIN patients p ON pv.patient_id = p.id
      WHERE pv.pharmacy_id=$1
      AND EXTRACT(MONTH FROM pv.visit_date)=$2
      AND EXTRACT(YEAR FROM pv.visit_date)=$3
      ORDER BY pv.visit_date`, [pharmacy_id, month, year]);
    return r.rows;
  }

  static async getMOH512CWC(pharmacy_id, month, year) {
    const r = await pool.query(`
      SELECT 
        ROW_NUMBER() OVER (ORDER BY c.visit_date) as serial_no,
        c.visit_date,
        p.full_name,
        p.date_of_birth,
        c.birth_weight,
        c.current_weight,
        c.height,
        c.muac,
        c.head_circumference,
        c.nutrition_status,
        c.milestones,
        c.notes
      FROM cwc_records c
      JOIN patients p ON c.patient_id = p.id
      WHERE c.pharmacy_id=$1
      AND EXTRACT(MONTH FROM c.visit_date)=$2
      AND EXTRACT(YEAR FROM c.visit_date)=$3
      ORDER BY c.visit_date`, [pharmacy_id, month, year]);
    return r.rows;
  }

  static async getMOH513Immunization(pharmacy_id, month, year) {
    const r = await pool.query(`
      SELECT 
        ROW_NUMBER() OVER (ORDER BY i.date_given) as serial_no,
        i.date_given,
        p.full_name,
        p.date_of_birth,
        i.vaccine,
        i.dose,
        i.batch_number,
        i.next_due_date,
        i.administered_by,
        i.notes
      FROM immunizations i
      JOIN patients p ON i.patient_id = p.id
      WHERE i.pharmacy_id=$1
      AND EXTRACT(MONTH FROM i.date_given)=$2
      AND EXTRACT(YEAR FROM i.date_given)=$3
      ORDER BY i.date_given`, [pharmacy_id, month, year]);
    return r.rows;
  }

  static async getMOH514FamilyPlanning(pharmacy_id, month, year) {
    const r = await pool.query(`
      SELECT 
        ROW_NUMBER() OVER (ORDER BY f.created_at) as serial_no,
        f.created_at::date as visit_date,
        p.full_name,
        p.date_of_birth,
        f.method,
        f.start_date,
        f.follow_up_date,
        f.side_effects,
        f.counseling_notes
      FROM family_planning f
      JOIN patients p ON f.patient_id = p.id
      WHERE f.pharmacy_id=$1
      AND EXTRACT(MONTH FROM f.created_at)=$2
      AND EXTRACT(YEAR FROM f.created_at)=$3
      ORDER BY f.created_at`, [pharmacy_id, month, year]);
    return r.rows;
  }

  static async getMOH515Delivery(pharmacy_id, month, year) {
    const r = await pool.query(`
      SELECT 
        ROW_NUMBER() OVER (ORDER BY dr.delivery_date) as serial_no,
        dr.delivery_date,
        p.full_name,
        p.date_of_birth,
        dr.gestation_weeks,
        dr.mode_of_delivery,
        dr.presentation,
        dr.mother_status,
        dr.baby_status,
        dr.birth_weight,
        dr.sex_of_baby,
        dr.apgar_1min,
        dr.apgar_5min,
        dr.complications,
        dr.duration_of_labour_hours,
        dr.blood_loss_ml,
        dr.notes
      FROM delivery_register dr
      JOIN patients p ON dr.patient_id = p.id
      WHERE dr.pharmacy_id=$1
      AND EXTRACT(MONTH FROM dr.delivery_date)=$2
      AND EXTRACT(YEAR FROM dr.delivery_date)=$3
      ORDER BY dr.delivery_date`, [pharmacy_id, month, year]);
    return r.rows;
  }

  static async getMCHMonthlySummary(pharmacy_id, month, year) {
    const [anc_new, anc_revisit, pnc, deliveries, imm, fp, cwc] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM anc_registrations WHERE pharmacy_id=$1 AND EXTRACT(MONTH FROM created_at)=$2 AND EXTRACT(YEAR FROM created_at)=$3`, [pharmacy_id, month, year]),
      pool.query(`SELECT COUNT(*) FROM anc_visits WHERE pharmacy_id=$1 AND EXTRACT(MONTH FROM visit_date)=$2 AND EXTRACT(YEAR FROM visit_date)=$3`, [pharmacy_id, month, year]),
      pool.query(`SELECT COUNT(*) FROM pnc_visits WHERE pharmacy_id=$1 AND EXTRACT(MONTH FROM visit_date)=$2 AND EXTRACT(YEAR FROM visit_date)=$3`, [pharmacy_id, month, year]),
      pool.query(`SELECT COUNT(*) FROM delivery_register WHERE pharmacy_id=$1 AND EXTRACT(MONTH FROM delivery_date)=$2 AND EXTRACT(YEAR FROM delivery_date)=$3`, [pharmacy_id, month, year]),
      pool.query(`SELECT COUNT(*) FROM immunizations WHERE pharmacy_id=$1 AND EXTRACT(MONTH FROM date_given)=$2 AND EXTRACT(YEAR FROM date_given)=$3`, [pharmacy_id, month, year]),
      pool.query(`SELECT COUNT(*) FROM family_planning WHERE pharmacy_id=$1 AND EXTRACT(MONTH FROM created_at)=$2 AND EXTRACT(YEAR FROM created_at)=$3`, [pharmacy_id, month, year]),
      pool.query(`SELECT COUNT(*) FROM cwc_records WHERE pharmacy_id=$1 AND EXTRACT(MONTH FROM visit_date)=$2 AND EXTRACT(YEAR FROM visit_date)=$3`, [pharmacy_id, month, year]),
    ]);
    return {
      month, year,
      anc_new_registrations: parseInt(anc_new.rows[0].count),
      anc_revisits: parseInt(anc_revisit.rows[0].count),
      pnc_visits: parseInt(pnc.rows[0].count),
      deliveries: parseInt(deliveries.rows[0].count),
      immunizations: parseInt(imm.rows[0].count),
      family_planning: parseInt(fp.rows[0].count),
      cwc_visits: parseInt(cwc.rows[0].count),
    };
  }
}

module.exports = MCHModel;

MCHModel.saveObstetricHistory = async function(anc_id, pharmacy_id, rows) {
  await pool.query(`DELETE FROM anc_obstetric_history WHERE anc_id=$1`, [anc_id]);
  if (!rows || rows.length === 0) return [];
  const results = [];
  for (const row of rows) {
    const r = await pool.query(`
      INSERT INTO anc_obstetric_history
        (anc_id, pharmacy_id, pregnancy_order, year, anc_visits_count,
         place_of_birth, rhesus_negative, anti_d_given, gestation_weeks,
         duration_of_labour, mode_of_delivery, complications, birth_weight,
         sex_of_baby, child_birth_outcome, puerperium_outcome)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *`,
      [anc_id, pharmacy_id, row.pregnancy_order, row.year, row.anc_visits_count,
       row.place_of_birth, row.rhesus_negative, row.anti_d_given, row.gestation_weeks,
       row.duration_of_labour, row.mode_of_delivery, JSON.stringify(row.complications||[]),
       row.birth_weight, row.sex_of_baby, row.child_birth_outcome, row.puerperium_outcome]);
    results.push(r.rows[0]);
  }
  return results;
};

MCHModel.getObstetricHistory = async function(anc_id) {
  const r = await pool.query(
    `SELECT * FROM anc_obstetric_history WHERE anc_id=$1 ORDER BY pregnancy_order`, [anc_id]);
  return r.rows;
};

MCHModel.upsertSerologyTest = async function(data) {
  const { anc_id, pharmacy_id, test_period, test_date, hiv_result, syphilis_result,
    hep_b_result, partner_hiv_result, partner_syphilis_result, partner_hep_b_result,
    performed_by, notes } = data;
  const r = await pool.query(`
    INSERT INTO anc_serology_tests
      (anc_id, pharmacy_id, test_period, test_date, hiv_result, syphilis_result,
       hep_b_result, partner_hiv_result, partner_syphilis_result, partner_hep_b_result,
       performed_by, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT (anc_id, test_period) DO UPDATE SET
      test_date=EXCLUDED.test_date, hiv_result=EXCLUDED.hiv_result,
      syphilis_result=EXCLUDED.syphilis_result, hep_b_result=EXCLUDED.hep_b_result,
      partner_hiv_result=EXCLUDED.partner_hiv_result,
      partner_syphilis_result=EXCLUDED.partner_syphilis_result,
      partner_hep_b_result=EXCLUDED.partner_hep_b_result,
      performed_by=EXCLUDED.performed_by, notes=EXCLUDED.notes
    RETURNING *`,
    [anc_id, pharmacy_id, test_period, test_date, hiv_result, syphilis_result,
     hep_b_result, partner_hiv_result, partner_syphilis_result, partner_hep_b_result,
     performed_by, notes]);
  return r.rows[0];
};

MCHModel.getSerologyTests = async function(anc_id) {
  const r = await pool.query(
    `SELECT * FROM anc_serology_tests WHERE anc_id=$1 ORDER BY created_at`, [anc_id]);
  return r.rows;
};

MCHModel.addPreventiveService = async function(data) {
  const { anc_id, pharmacy_id, service_type, dose_number, date_given,
    gestation_weeks, tablets_given, next_due_date, given_by, notes } = data;
  const r = await pool.query(`
    INSERT INTO anc_preventive_services
      (anc_id, pharmacy_id, service_type, dose_number, date_given,
       gestation_weeks, tablets_given, next_due_date, given_by, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [anc_id, pharmacy_id, service_type, dose_number, date_given,
     gestation_weeks, tablets_given, next_due_date, given_by, notes]);
  return r.rows[0];
};

MCHModel.getPreventiveServices = async function(anc_id) {
  const r = await pool.query(
    `SELECT * FROM anc_preventive_services WHERE anc_id=$1 ORDER BY date_given`, [anc_id]);
  return r.rows;
};

MCHModel.scheduleEIDForInfant = async function(pharmacy_id, patient_id, mother_anc_id) {
  const today = new Date();
  const addWeeks = (d, w) => { const x = new Date(d); x.setDate(x.getDate() + w*7); return x.toISOString().split('T')[0]; };
  const addMonths = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth()+m); return x.toISOString().split('T')[0]; };
  const schedule = [
    { vaccine:'EID - 1st DNA PCR',         dose:'1', date_given: addWeeks(today,6),   next_due_date: addMonths(today,6)  },
    { vaccine:'EID - 2nd DNA PCR',          dose:'2', date_given: addMonths(today,6),  next_due_date: addMonths(today,12) },
    { vaccine:'EID - 3rd DNA PCR',          dose:'3', date_given: addMonths(today,12), next_due_date: addMonths(today,18) },
    { vaccine:'EID - Haemoglobin (HB)',     dose:'1', date_given: addMonths(today,6),  next_due_date: null },
    { vaccine:'EID - Final Antibody Test',  dose:'1', date_given: addMonths(today,18), next_due_date: null },
  ];
  const created = [];
  for (const s of schedule) {
    const r = await pool.query(`
      INSERT INTO immunizations
        (pharmacy_id, patient_id, vaccine, dose, date_given, next_due_date,
         administered_by, is_eid, mother_anc_id, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [pharmacy_id, patient_id, s.vaccine, s.dose, s.date_given, s.next_due_date,
       'System (auto-scheduled)', true, mother_anc_id,
       'Auto-scheduled per Kenya MCH Handbook 2025 EID protocol']);
    created.push(r.rows[0]);
  }
  return created;
};
