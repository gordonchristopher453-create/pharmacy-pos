const { pool } = require('../config/db');

class HRModel {
  // ─── STAFF PROFILES ───────────────────────────────────────
  static async getStaffProfiles(pharmacy_id, { department, status, search } = {}) {
    let query = `
      SELECT sp.*, u.role as system_role, u.is_active as user_active
      FROM staff_profiles sp
      LEFT JOIN users u ON sp.user_id::text = u.id::text
      WHERE ($1::text IS NULL OR sp.pharmacy_id::text = $1::text)
    `;
    const params = [pharmacy_id];

    if (department && department !== 'all') {
      params.push(department);
      query += ` AND sp.department = $${params.length}`;
    }
    if (status && status !== 'all') {
      params.push(status);
      query += ` AND sp.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (sp.full_name ILIKE $${params.length} OR sp.designation ILIKE $${params.length} OR sp.employee_number ILIKE $${params.length} OR sp.phone ILIKE $${params.length})`;
    }

    query += ` ORDER BY sp.full_name ASC`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async getStaffProfileById(id, pharmacy_id) {
    const result = await pool.query(`
      SELECT sp.*, u.role as system_role
      FROM staff_profiles sp
      LEFT JOIN users u ON sp.user_id::text = u.id::text
      WHERE sp.id::text = $1::text AND ($2::text IS NULL OR sp.pharmacy_id::text = $2::text)
    `, [id, pharmacy_id]);
    return result.rows[0];
  }

  static async upsertStaffProfile(data) {
    const {
      id, pharmacy_id, user_id, employee_number, full_name, email, phone,
      national_id, gender, date_of_birth, date_joined, department, designation,
      employment_type, contract_end_date, kra_pin, nssf_number, sha_number,
      license_board, license_number, license_expiry, basic_salary, house_allowance,
      transport_allowance, other_allowances, bank_name, bank_branch, bank_account,
      mpesa_number, annual_leave_days, leave_balance, status, emergency_contact_name,
      emergency_contact_phone, emergency_contact_relation, notes
    } = data;

    if (id) {
      const result = await pool.query(`
        UPDATE staff_profiles SET
          employee_number=$1, full_name=$2, email=$3, phone=$4, national_id=$5,
          gender=$6, date_of_birth=$7, date_joined=$8, department=$9, designation=$10,
          employment_type=$11, contract_end_date=$12, kra_pin=$13, nssf_number=$14,
          sha_number=$15, license_board=$16, license_number=$17, license_expiry=$18,
          basic_salary=$19, house_allowance=$20, transport_allowance=$21, other_allowances=$22,
          bank_name=$23, bank_branch=$24, bank_account=$25, mpesa_number=$26,
          annual_leave_days=$27, leave_balance=$28, status=$29, emergency_contact_name=$30,
          emergency_contact_phone=$31, emergency_contact_relation=$32, notes=$33,
          updated_at=NOW()
        WHERE id::text=$34::text AND ($35::text IS NULL OR pharmacy_id::text=$35::text)
        RETURNING *
      `, [
        employee_number, full_name, email, phone, national_id,
        gender, date_of_birth || null, date_joined || new Date(), department || 'Clinical', designation,
        employment_type || 'full_time', contract_end_date || null, kra_pin, nssf_number,
        sha_number, license_board, license_number, license_expiry || null,
        parseFloat(basic_salary || 0), parseFloat(house_allowance || 0),
        parseFloat(transport_allowance || 0), parseFloat(other_allowances || 0),
        bank_name, bank_branch, bank_account, mpesa_number,
        parseInt(annual_leave_days || 21), parseInt(leave_balance !== undefined ? leave_balance : 21),
        status || 'active', emergency_contact_name,
        emergency_contact_phone, emergency_contact_relation, notes,
        id, pharmacy_id
      ]);
      return result.rows[0];
    } else {
      const result = await pool.query(`
        INSERT INTO staff_profiles (
          pharmacy_id, user_id, employee_number, full_name, email, phone,
          national_id, gender, date_of_birth, date_joined, department, designation,
          employment_type, contract_end_date, kra_pin, nssf_number, sha_number,
          license_board, license_number, license_expiry, basic_salary, house_allowance,
          transport_allowance, other_allowances, bank_name, bank_branch, bank_account,
          mpesa_number, annual_leave_days, leave_balance, status, emergency_contact_name,
          emergency_contact_phone, emergency_contact_relation, notes
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35
        ) RETURNING *
      `, [
        pharmacy_id, user_id || null, employee_number, full_name, email, phone,
        national_id, gender, date_of_birth || null, date_joined || new Date(), department || 'Clinical', designation,
        employment_type || 'full_time', contract_end_date || null, kra_pin, nssf_number, sha_number,
        license_board, license_number, license_expiry || null, parseFloat(basic_salary || 0), parseFloat(house_allowance || 0),
        parseFloat(transport_allowance || 0), parseFloat(other_allowances || 0), bank_name, bank_branch, bank_account,
        mpesa_number, parseInt(annual_leave_days || 21), parseInt(leave_balance !== undefined ? leave_balance : 21), status || 'active', emergency_contact_name,
        emergency_contact_phone, emergency_contact_relation, notes
      ]);
      return result.rows[0];
    }
  }

  static async deleteStaffProfile(id, pharmacy_id) {
    const result = await pool.query(`
      DELETE FROM staff_profiles WHERE id::text = $1::text AND ($2::text IS NULL OR pharmacy_id::text = $2::text) RETURNING id
    `, [id, pharmacy_id]);
    return result.rows[0];
  }

  // ─── LEAVE MANAGEMENT ─────────────────────────────────────
  static async getLeaveRequests(pharmacy_id, { status, start_date, end_date } = {}) {
    let query = `
      SELECT lr.*
      FROM leave_requests lr
      WHERE ($1::text IS NULL OR lr.pharmacy_id::text = $1::text)
    `;
    const params = [pharmacy_id];

    if (status && status !== 'all') {
      params.push(status);
      query += ` AND lr.status = $${params.length}`;
    }
    if (start_date) {
      params.push(start_date);
      query += ` AND lr.start_date >= $${params.length}`;
    }
    if (end_date) {
      params.push(end_date);
      query += ` AND lr.end_date <= $${params.length}`;
    }

    query += ` ORDER BY lr.created_at DESC`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async createLeaveRequest(data) {
    const {
      pharmacy_id, user_id, employee_name, department, leave_type,
      start_date, end_date, days_count, reason, handover_staff
    } = data;

    const result = await pool.query(`
      INSERT INTO leave_requests (
        pharmacy_id, user_id, employee_name, department, leave_type,
        start_date, end_date, days_count, reason, handover_staff, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
      RETURNING *
    `, [
      pharmacy_id, user_id || null, employee_name, department, leave_type || 'annual',
      start_date, end_date, parseInt(days_count || 1), reason, handover_staff
    ]);
    return result.rows[0];
  }

  static async reviewLeaveRequest({ id, pharmacy_id, status, review_notes, reviewed_by, reviewed_by_name }) {
    const result = await pool.query(`
      UPDATE leave_requests SET
        status = $1,
        review_notes = $2,
        reviewed_by = $3,
        reviewed_by_name = $4,
        reviewed_at = NOW(),
        updated_at = NOW()
      WHERE id::text = $5::text AND ($6::text IS NULL OR pharmacy_id::text = $6::text)
      RETURNING *
    `, [status, review_notes, reviewed_by, reviewed_by_name, id, pharmacy_id]);

    const leave = result.rows[0];
    // If approved and has user_id, deduct days from leave balance
    if (leave && status === 'approved' && leave.leave_type === 'annual') {
      try {
        await pool.query(`
          UPDATE staff_profiles
          SET leave_balance = GREATEST(0, leave_balance - $1)
          WHERE (user_id::text = $2::text OR full_name = $3) AND ($4::text IS NULL OR pharmacy_id::text = $4::text)
        `, [leave.days_count, leave.user_id, leave.employee_name, pharmacy_id]);
      } catch (err) {
        // ignore if staff profile not linked
      }
    }

    return leave;
  }

  static async deleteLeaveRequest(id, pharmacy_id) {
    const result = await pool.query(`
      DELETE FROM leave_requests WHERE id::text = $1::text AND ($2::text IS NULL OR pharmacy_id::text = $2::text) RETURNING id
    `, [id, pharmacy_id]);
    return result.rows[0];
  }

  // ─── SHIFT SCHEDULES / ROSTER ─────────────────────────────
  static async getShiftSchedules(pharmacy_id, { start_date, end_date, department } = {}) {
    let query = `
      SELECT ss.*
      FROM shift_schedules ss
      WHERE ($1::text IS NULL OR ss.pharmacy_id::text = $1::text)
    `;
    const params = [pharmacy_id];

    if (start_date) {
      params.push(start_date);
      query += ` AND ss.shift_date >= $${params.length}`;
    }
    if (end_date) {
      params.push(end_date);
      query += ` AND ss.shift_date <= $${params.length}`;
    }
    if (department && department !== 'all') {
      params.push(department);
      query += ` AND ss.department = $${params.length}`;
    }

    query += ` ORDER BY ss.shift_date ASC, ss.start_time ASC, ss.employee_name ASC`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async createShiftSchedule(data) {
    const {
      pharmacy_id, user_id, employee_name, department, shift_type,
      shift_date, start_time, end_time, notes, status, created_by
    } = data;

    const result = await pool.query(`
      INSERT INTO shift_schedules (
        pharmacy_id, user_id, employee_name, department, shift_type,
        shift_date, start_time, end_time, notes, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      pharmacy_id, user_id || null, employee_name, department || 'Clinical',
      shift_type || 'morning', shift_date, start_time || '08:00', end_time || '17:00',
      notes, status || 'scheduled', created_by
    ]);
    return result.rows[0];
  }

  static async batchCreateShifts(pharmacy_id, shifts, created_by) {
    const created = [];
    for (const s of shifts) {
      const res = await this.createShiftSchedule({
        pharmacy_id,
        user_id: s.user_id,
        employee_name: s.employee_name,
        department: s.department,
        shift_type: s.shift_type,
        shift_date: s.shift_date,
        start_time: s.start_time,
        end_time: s.end_time,
        notes: s.notes,
        status: s.status || 'scheduled',
        created_by
      });
      created.push(res);
    }
    return created;
  }

  static async updateShiftSchedule(id, pharmacy_id, data) {
    const { shift_type, start_time, end_time, notes, status } = data;
    const result = await pool.query(`
      UPDATE shift_schedules SET
        shift_type = COALESCE($1, shift_type),
        start_time = COALESCE($2, start_time),
        end_time = COALESCE($3, end_time),
        notes = COALESCE($4, notes),
        status = COALESCE($5, status),
        updated_at = NOW()
      WHERE id::text = $6::text AND ($7::text IS NULL OR pharmacy_id::text = $7::text)
      RETURNING *
    `, [shift_type, start_time, end_time, notes, status, id, pharmacy_id]);
    return result.rows[0];
  }

  static async deleteShiftSchedule(id, pharmacy_id) {
    const result = await pool.query(`
      DELETE FROM shift_schedules WHERE id::text = $1::text AND ($2::text IS NULL OR pharmacy_id::text = $2::text) RETURNING id
    `, [id, pharmacy_id]);
    return result.rows[0];
  }

  // ─── HR OVERVIEW METRICS ──────────────────────────────────
  static async getHRMetrics(pharmacy_id) {
    const totalStaffRes = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'on_leave') as on_leave
      FROM staff_profiles
      WHERE ($1::text IS NULL OR pharmacy_id::text = $1::text)
    `, [pharmacy_id]);

    const pendingLeaveRes = await pool.query(`
      SELECT COUNT(*) as pending_count
      FROM leave_requests
      WHERE ($1::text IS NULL OR pharmacy_id::text = $1::text) AND status = 'pending'
    `, [pharmacy_id]);

    const today = new Date().toISOString().split('T')[0];
    const todayShiftsRes = await pool.query(`
      SELECT COUNT(*) as today_shifts,
             COUNT(*) FILTER (WHERE shift_type = 'night') as night_shifts,
             COUNT(*) FILTER (WHERE shift_type = 'on_call') as on_call
      FROM shift_schedules
      WHERE ($1::text IS NULL OR pharmacy_id::text = $1::text) AND shift_date = $2
    `, [pharmacy_id, today]);

    const expiringLicensesRes = await pool.query(`
      SELECT COUNT(*) as expiring_count
      FROM staff_profiles
      WHERE ($1::text IS NULL OR pharmacy_id::text = $1::text)
        AND license_expiry IS NOT NULL
        AND license_expiry <= (CURRENT_DATE + INTERVAL '60 days')
    `, [pharmacy_id]);

    return {
      totalStaff: parseInt(totalStaffRes.rows[0]?.total || 0),
      activeStaff: parseInt(totalStaffRes.rows[0]?.active || 0),
      onLeaveStaff: parseInt(totalStaffRes.rows[0]?.on_leave || 0),
      pendingLeaveRequests: parseInt(pendingLeaveRes.rows[0]?.pending_count || 0),
      todayShifts: parseInt(todayShiftsRes.rows[0]?.today_shifts || 0),
      nightShifts: parseInt(todayShiftsRes.rows[0]?.night_shifts || 0),
      expiringLicenses: parseInt(expiringLicensesRes.rows[0]?.expiring_count || 0),
    };
  }
}

module.exports = HRModel;
