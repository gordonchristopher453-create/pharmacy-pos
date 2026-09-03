const { pool } = require('../config/db');

class VisitModel {
  static async create({ pharmacy_id, patient_id, visit_type='opd', priority='normal', chief_complaint, created_by, notes, mch_service, consultation_fee, fee_paid, payment_method, status, department }) {
    const client = await pool.connect();
    const creator = created_by || null;
    try {
      await client.query('BEGIN');
      const numRes = await client.query(`SELECT generate_visit_number($1) as num`, [pharmacy_id]);
      const visit_number = numRes.rows[0].num;
      const initialStatus = status || (visit_type === 'mch' || department === 'mch' ? 'mch' : 'WAITING_TRIAGE');
      const dept = department || (visit_type === 'mch' ? 'mch' : 'triage');
      const result = await client.query(`
        INSERT INTO visits (pharmacy_id, patient_id, visit_number, visit_type, priority, chief_complaint, created_by, notes, status, consultation_fee, fee_paid, payment_method, mch_service, department)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *
      `, [
        pharmacy_id, patient_id, visit_number, visit_type, priority,
        chief_complaint||null, creator, notes||null, initialStatus,
        consultation_fee||0, fee_paid||false, payment_method||null, mch_service||null, dept
      ]);
      await client.query('COMMIT');
      return result.rows[0];
    } catch(e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }

  static async findById(id, pharmacy_id) {
    const result = await pool.query(`
      SELECT v.*, v.created_at as visit_date, p.full_name as patient_name, p.patient_number, p.gender, p.date_of_birth,
             vt.blood_pressure_systolic, vt.blood_pressure_diastolic,
             vt.pulse_rate, vt.temperature, vt.oxygen_saturation, vt.weight,
             p.phone as patient_phone, u.full_name as created_by_name
      FROM visits v
      LEFT JOIN patients p ON v.patient_id=p.id
      LEFT JOIN users u ON v.created_by=u.id
      LEFT JOIN LATERAL (
        SELECT blood_pressure_systolic, blood_pressure_diastolic,
               pulse_rate, temperature, oxygen_saturation, weight
        FROM vitals
        WHERE visit_id::text = v.id::text
        ORDER BY recorded_at DESC
        LIMIT 1
      ) vt ON true
      WHERE v.id::text=$1::text AND ($2::text IS NULL OR v.pharmacy_id::text=$2::text)
    `, [String(id), pharmacy_id ? String(pharmacy_id) : null]);
    if (!result.rows[0]) return null;
    const visit = result.rows[0];
    const [serviceOrders, labOrders, prescriptions, vaccines, billing] = await Promise.all([
      pool.query(`SELECT * FROM service_orders WHERE visit_id=$1 ORDER BY created_at DESC`, [id]),
      pool.query(`SELECT * FROM lab_requests WHERE visit_id=$1 ORDER BY created_at DESC`, [id]).catch(()=>({rows:[]})),
      pool.query(`SELECT * FROM prescriptions WHERE visit_id=$1 ORDER BY created_at DESC`, [id]).catch(()=>({rows:[]})),
      pool.query(`SELECT * FROM vaccine_orders WHERE visit_id=$1 ORDER BY created_at DESC`, [id]).catch(()=>({rows:[]})),
      pool.query(`SELECT * FROM billing_items WHERE visit_id=$1 ORDER BY created_at DESC`, [id]).catch(()=>({rows:[]})),
    ]);
    return {
      ...visit,
      service_orders:  serviceOrders.rows,
      lab_orders:      labOrders.rows,
      prescriptions:   prescriptions.rows,
      vaccine_orders:  vaccines.rows,
      billing_items:   billing.rows,
      summary: {
        pending_labs:     labOrders.rows.filter(x=>x.status==='pending'||x.status==='Pending').length,
        pending_drugs:    prescriptions.rows.filter(x=>x.status==='pending'||x.status==='Pending').length,
        pending_vaccines: vaccines.rows.filter(x=>x.status==='pending'||x.status==='Pending').length,
        pending_bills:    billing.rows.filter(x=>x.status==='pending'||x.status==='Pending').length,
        total_bill:       billing.rows.reduce((s,b)=>s+parseFloat(b.total_price||0),0),
      }
    };
  }

  static async findAll({ pharmacy_id, patient_id, status, visit_type, date_from, date_to, date, search, limit=50, offset=0 }={}) {
    // Auto-heal/sync visits fee_paid flags where the consultation or MCH billing item has actually been paid/waived
    try {
      await pool.query(`
        UPDATE visits v
        SET fee_paid = true, payment_method = COALESCE(v.payment_method, bi.payment_method, 'cash'), updated_at = NOW()
        FROM billing_items bi
        WHERE bi.visit_id = v.id
          AND bi.item_type IN ('consultation', 'mch')
          AND bi.status IN ('paid', 'insurance', 'nhif', 'sha', 'corporate', 'waived')
          AND v.fee_paid = false
          AND ($1::text IS NULL OR v.pharmacy_id::text = $1::text)
      `, [pharmacy_id ? String(pharmacy_id) : null]);
    } catch (syncErr) {
      console.error("Error auto-syncing visits fee_paid state:", syncErr.message);
    }

    let q = `
      SELECT v.*, v.created_at as visit_date, p.full_name as patient_name, p.patient_number, p.gender,
             u.full_name as created_by_name,
             (SELECT COUNT(*) FROM billing_items WHERE visit_id=v.id AND status IN ('pending', 'partial')) as pending_bills,
             (SELECT COALESCE(SUM(CASE WHEN status='pending' THEN total_price WHEN status='partial' THEN GREATEST(0, total_price - COALESCE(paid_amount,0)) ELSE 0 END),0) FROM billing_items WHERE visit_id=v.id) as pending_amount,
             (SELECT COALESCE(SUM(total_price),0) FROM billing_items WHERE visit_id=v.id) as total_bill
      FROM visits v
      LEFT JOIN patients p ON v.patient_id=p.id
      LEFT JOIN users u ON v.created_by=u.id
      LEFT JOIN LATERAL (
        SELECT blood_pressure_systolic, blood_pressure_diastolic,
               pulse_rate, temperature, oxygen_saturation, weight
        FROM vitals
        WHERE visit_id::text = v.id::text
        ORDER BY recorded_at DESC
        LIMIT 1
      ) vt ON true
      WHERE ($1::text IS NULL OR v.pharmacy_id::text=$1::text)
    `;
    const params = [pharmacy_id ? String(pharmacy_id) : null];

    if (patient_id) { params.push(patient_id); q += ` AND v.patient_id=$${params.length}`; }

    if (status) {
      if (status === 'opd_queue') {
        q += ` AND COALESCE(v.department, '') != 'special_clinic'
               AND UPPER(COALESCE(v.status, '')) NOT IN (
                 'COMPLETED', 'DISCHARGED', 'CANCELLED', 'ARCHIVED', 'ADMITTED', 'INPATIENT',
                 'SPECIAL_CLINIC', 'REFERRED_SPECIAL', 'REFERRED_EXTERNAL', 'EXTERNAL_REFERRAL',
                 'WAITING_TRIAGE', 'IN_TRIAGE', 'REGISTERED', 'TRIAGE', 'OPEN'
               )`;
      } else if (status === 'active') {
        q += ` AND UPPER(COALESCE(v.status, '')) NOT IN ('COMPLETED', 'DISCHARGED', 'CANCELLED', 'ARCHIVED')`;
      } else {
        const statuses = status.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        if (statuses.length === 1) {
          params.push(statuses[0]);
          q += ` AND UPPER(v.status)=$${params.length}`;
        } else {
          const placeholders = statuses.map(s => { params.push(s); return `$${params.length}`; }).join(',');
          q += ` AND UPPER(v.status) IN (${placeholders})`;
        }
      }
    }

    if (visit_type) { params.push(visit_type); q += ` AND v.visit_type=$${params.length}`; }

    if (date) {
      const d = date === 'today' ? new Date().toISOString().split('T')[0] : date;
      params.push(d);
      q += ` AND (DATE(v.created_at)=$${params.length} OR DATE(v.created_at AT TIME ZONE 'UTC')=$${params.length})`;
    }
    if (date_from) { params.push(date_from); q += ` AND DATE(v.created_at)>=$${params.length}`; }
    if (date_to)   { params.push(date_to);   q += ` AND DATE(v.created_at)<=$${params.length}`; }

    if (search) {
      params.push(`%${search}%`);
      q += ` AND (p.full_name ILIKE $${params.length} OR p.patient_number ILIKE $${params.length} OR p.phone ILIKE $${params.length})`;
    }
    q += ` ORDER BY v.created_at DESC`;
    params.push(limit);  q += ` LIMIT $${params.length}`;
    params.push(offset); q += ` OFFSET $${params.length}`;
    const result = await pool.query(q, params);
    return result.rows;
  }

  static async getDailyStats(pharmacy_id, date) {
    const d = date === 'today' || !date ? new Date().toISOString().split('T')[0] : date;
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_visits,
        COUNT(*) FILTER (WHERE UPPER(status) IN ('WAITING', 'WAITING_TRIAGE', 'IN_TRIAGE', 'REGISTERED', 'TRIAGE', 'OPEN')) as waiting_triage,
        COUNT(*) FILTER (WHERE UPPER(status) IN ('WAITING_DOCTOR', 'WITH_DOCTOR', 'IN_CONSULTATION', 'OPD')) as waiting_doctor,
        COUNT(*) FILTER (WHERE UPPER(status) IN ('WAITING', 'WAITING_TRIAGE', 'IN_TRIAGE', 'REGISTERED', 'TRIAGE', 'OPEN')) as waiting,
        COUNT(*) FILTER (WHERE UPPER(status) IN ('IN_PROGRESS', 'WITH_DOCTOR', 'IN_CONSULTATION', 'IN_TRIAGE')) as in_progress,
        COUNT(*) FILTER (WHERE UPPER(status) IN ('COMPLETED')) as completed,
        COUNT(*) FILTER (WHERE UPPER(status) IN ('DISCHARGED', 'ARCHIVED')) as discharged
      FROM visits
      WHERE pharmacy_id=$1 AND (DATE(created_at)=$2 OR DATE(created_at AT TIME ZONE 'UTC')=$2)
    `, [pharmacy_id, d]);
    return result.rows[0];
  }

  static async checkVisitCompletionBlockers(visitId, pharmacyId) {
    const blockers = [];
    try {
      // 1. Pending Laboratory Orders
      const pendingLabs = await pool.query(
        `SELECT COUNT(*)::int as cnt FROM lab_requests WHERE visit_id=$1 AND LOWER(status) IN ('pending', 'in_progress', 'sample_collected')`,
        [visitId]
      );
      if (pendingLabs.rows[0]?.cnt > 0) {
        blockers.push(`${pendingLabs.rows[0].cnt} pending laboratory order(s)`);
      }

      // 2. Pending Radiology / Service Orders
      const pendingRads = await pool.query(
        `SELECT COUNT(*)::int as cnt FROM service_orders WHERE visit_id=$1 AND LOWER(status) IN ('pending', 'in_progress')`,
        [visitId]
      );
      if (pendingRads.rows[0]?.cnt > 0) {
        blockers.push(`${pendingRads.rows[0].cnt} pending service/radiology order(s)`);
      }

      // 3. Pending Unpaid Billing Items
      const pendingBills = await pool.query(
        `SELECT COUNT(*)::int as cnt FROM billing_items WHERE visit_id::text=$1::text AND LOWER(status) IN ('pending', 'unpaid')`,
        [visitId]
      );
      if (pendingBills.rows[0]?.cnt > 0) {
        blockers.push(`${pendingBills.rows[0].cnt} unpaid billing item(s)`);
      }

      // 4. Pending Prescriptions
      const pendingMeds = await pool.query(
        `SELECT COUNT(*)::int as cnt FROM prescriptions WHERE visit_id=$1 AND LOWER(status) IN ('pending', 'in_progress')`,
        [visitId]
      );
      if (pendingMeds.rows[0]?.cnt > 0) {
        blockers.push(`${pendingMeds.rows[0].cnt} pending prescription(s)`);
      }

      // 5. Pending Referrals
      const pendingRefs = await pool.query(
        `SELECT COUNT(*)::int as cnt FROM clinic_referrals WHERE visit_id=$1 AND UPPER(status) IN ('PENDING', 'WAITING')`,
        [visitId]
      );
      if (pendingRefs.rows[0]?.cnt > 0) {
        blockers.push(`${pendingRefs.rows[0].cnt} pending inter-clinic referral(s)`);
      }

      // 6. Active Inpatient Admission
      const activeAdmissions = await pool.query(
        `SELECT COUNT(*)::int as cnt FROM admissions WHERE visit_id=$1 AND LOWER(status) IN ('admitted', 'active')`,
        [visitId]
      );
      if (activeAdmissions.rows[0]?.cnt > 0) {
        blockers.push(`Active inpatient admission in progress`);
      }

      // 7. Active Encounters
      const activeEncounters = await pool.query(
        `SELECT COUNT(*)::int as cnt FROM encounters WHERE visit_id=$1 AND UPPER(status) IN ('IN_PROGRESS', 'IN_CONSULTATION', 'WAITING', 'CALLED', 'PAUSED', 'WAITING_RESULTS', 'REVIEW', 'WAITING_PHARMACY', 'WAITING_PAYMENT')`,
        [visitId]
      );
      if (activeEncounters.rows[0]?.cnt > 0) {
        blockers.push(`${activeEncounters.rows[0].cnt} active encounter(s) in progress`);
      }
    } catch (err) {
      console.error('Error checking visit completion blockers:', err.message);
    }
    return blockers;
  }

  static async updateStatus(id, pharmacy_id, status, mch_service, department) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(`
        UPDATE visits SET status=$1, department=COALESCE($4,department), mch_service=COALESCE($5,mch_service), updated_at=NOW()
        WHERE id=$2 AND pharmacy_id=$3 RETURNING *
      `, [status, id, pharmacy_id, department || null, mch_service || null]);
      await client.query('COMMIT');
      return result.rows[0];
    } catch(e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }

  static async addVitals({ pharmacy_id, visit_id, patient_id, recorded_by, ...vitals }) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS vitals (
          id SERIAL PRIMARY KEY,
          pharmacy_id VARCHAR(150),
          visit_id VARCHAR(150),
          patient_id VARCHAR(150),
          recorded_by VARCHAR(150),
          temperature NUMERIC,
          blood_pressure_systolic VARCHAR(50),
          blood_pressure_diastolic VARCHAR(50),
          pulse_rate NUMERIC,
          respiratory_rate NUMERIC,
          oxygen_saturation NUMERIC,
          weight NUMERIC,
          height NUMERIC,
          bmi NUMERIC,
          blood_sugar NUMERIC,
          urine_output VARCHAR(100),
          notes TEXT,
          recorded_at TIMESTAMP DEFAULT NOW()
        );
        DO $$ 
        DECLARE r RECORD;
        BEGIN
            FOR r IN (
                SELECT constraint_name 
                FROM information_schema.table_constraints 
                WHERE table_name = 'vitals' 
                  AND constraint_type = 'FOREIGN KEY'
            ) LOOP
                EXECUTE 'ALTER TABLE vitals DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
            END LOOP;
        END $$;
        ALTER TABLE vitals ALTER COLUMN pharmacy_id TYPE VARCHAR(150) USING pharmacy_id::VARCHAR;
        ALTER TABLE vitals ALTER COLUMN visit_id TYPE VARCHAR(150) USING visit_id::VARCHAR;
        ALTER TABLE vitals ALTER COLUMN patient_id TYPE VARCHAR(150) USING patient_id::VARCHAR;
        ALTER TABLE vitals ALTER COLUMN recorded_by TYPE VARCHAR(150) USING recorded_by::VARCHAR;
        ALTER TABLE vitals ADD COLUMN IF NOT EXISTS blood_sugar NUMERIC;
        ALTER TABLE vitals ADD COLUMN IF NOT EXISTS urine_output VARCHAR(100);
      `);
    } catch (e) {
      console.error('Vitals schema auto-migration notice:', e.message);
    }

    const sysBP = vitals.blood_pressure_systolic || vitals.systolic || null;
    const diaBP = vitals.blood_pressure_diastolic || vitals.diastolic || null;
    const temp = vitals.temperature ? parseFloat(vitals.temperature) : null;
    const pulse = vitals.pulse_rate || vitals.pulse ? parseFloat(vitals.pulse_rate || vitals.pulse) : null;
    const resp = vitals.respiratory_rate ? parseFloat(vitals.respiratory_rate) : null;
    const spo2 = vitals.oxygen_saturation ? parseFloat(vitals.oxygen_saturation) : null;
    const w = vitals.weight ? parseFloat(vitals.weight) : null;
    const h = vitals.height ? parseFloat(vitals.height) : null;
    const bmiVal = vitals.bmi ? parseFloat(vitals.bmi) : null;
    const bSugar = vitals.blood_sugar ? parseFloat(vitals.blood_sugar) : null;
    const uOutput = vitals.urine_output || null;

    const result = await pool.query(`
      INSERT INTO vitals (pharmacy_id, visit_id, patient_id, recorded_by,
        temperature, blood_pressure_systolic, blood_pressure_diastolic,
        pulse_rate, respiratory_rate, oxygen_saturation, weight, height, bmi, blood_sugar, urine_output, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *
    `, [
      pharmacy_id ? String(pharmacy_id) : null,
      visit_id ? String(visit_id) : null,
      patient_id ? String(patient_id) : null,
      recorded_by ? String(recorded_by) : null,
      temp, sysBP ? String(sysBP) : null, diaBP ? String(diaBP) : null,
      pulse, resp, spo2, w, h, bmiVal, bSugar, uOutput, vitals.notes || null
    ]);
    return result.rows[0];
  }
}

module.exports = VisitModel;
