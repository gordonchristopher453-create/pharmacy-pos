const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const PharmacyModel = require('../models/pharmacy.model');
const { sendWelcomeEmail, sendOtpEmail, sendPasswordResetEmail } = require('../utils/email');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

const createPharmacy = async (req, res) => {
  const { name, email, phone, address, city, country, license_number, admin_name, admin_email, admin_password, facility_type, plan, active_period } = req.body;

  if (!name || !email || !admin_email || !admin_password)
    return errorResponse(res, 400, 'name, email, admin_email and admin_password are required');

  const client = await pool.connect();
  try {
    const [facilityEmailCheck, adminEmailCheck, licenseCheck] = await Promise.all([
      client.query(`SELECT id FROM pharmacies WHERE LOWER(email)=LOWER($1) LIMIT 1`, [email]),
      client.query(`SELECT id FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1`, [admin_email]),
      license_number
        ? client.query(`SELECT id FROM pharmacies WHERE LOWER(license_number)=LOWER($1) LIMIT 1`, [license_number])
        : Promise.resolve({ rows: [] }),
    ]);

    if (facilityEmailCheck.rows.length > 0) return errorResponse(res, 400, 'Facility email is already registered');
    if (adminEmailCheck.rows.length > 0)    return errorResponse(res, 400, 'Admin email is already registered');
    if (licenseCheck.rows.length > 0)       return errorResponse(res, 400, 'License number is already registered');

    await client.query('BEGIN');
    const type = facility_type || 'hospital';

    const pharmacyResult = await client.query(`
      INSERT INTO pharmacies (name, email, phone, address, city, country, license_number, facility_type)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [name, email, phone||null, address||null, city||null, country||'Kenya', license_number||null, type]);
    const pharmacy = pharmacyResult.rows[0];

    await client.query(`
      INSERT INTO pharmacy_settings (pharmacy_id, receipt_header) VALUES ($1,$2)
    `, [pharmacy.id, `${name}\n${address||''}\n${phone||''}`]);

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(admin_password, salt);
    const adminResult = await client.query(`
      INSERT INTO users (full_name, email, password, role, pharmacy_id)
      VALUES ($1,$2,$3,'facility_admin',$4) RETURNING id, full_name, email, role
    `, [admin_name||`${name} Admin`, admin_email, hashedPassword, pharmacy.id]);
    const adminUser = adminResult.rows[0];

    const selectedPlan = plan || 'premium';
    let expiresInterval = "'1 year'";
    if (active_period === '1_month') expiresInterval = "'1 month'";
    else if (active_period === '3_months') expiresInterval = "'3 months'";
    else if (active_period === '6_months') expiresInterval = "'6 months'";
    else if (active_period === '1_year') expiresInterval = "'1 year'";
    else if (active_period === 'unlimited') expiresInterval = "'100 years'";
    else if (active_period === 'trial') expiresInterval = "'30 days'";

    const subResult = await client.query(`
      INSERT INTO subscriptions (pharmacy_id, plan, status, expires_at)
      VALUES ($1, $2, 'active', NOW() + INTERVAL ${expiresInterval}) RETURNING *
    `, [pharmacy.id, selectedPlan]);
    const subscription = subResult.rows[0];

    const departments = ['Reception','Triage','OPD','MCH','Laboratory','Pharmacy','Billing','Inpatient','Theatre','Radiology'];
    for (const dept of departments) {
      await client.query(`INSERT INTO departments (name, pharmacy_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [dept, pharmacy.id]);
    }

    await client.query(`INSERT INTO counters (name, pharmacy_id) VALUES ('Counter 1',$1)`, [pharmacy.id]);

    const CATS = [
      ['Antibiotics','Antibiotic medicines'],['Analgesics','Pain relief medicines'],
      ['Antimalaria','Malaria treatment medicines'],['Antihistamines','Allergy medicines'],
      ['Antifungals','Fungal infection treatments'],['Vitamins & Supplements','Vitamins and nutritional supplements'],
      ['Antihypertensives','Blood pressure medicines'],['Antidiabetics','Diabetes management medicines'],
      ['Gastrointestinal','Stomach and digestive medicines'],['Respiratory','Cough, cold and respiratory medicines'],
      ['Dermatology','Skin care and treatment'],['Eye & Ear','Eye and ear drops and treatments'],
      ['Surgical & Supplies','Medical supplies and surgical items'],['Family Planning','Contraceptives and family planning'],
      ['IV Fluids','Intravenous fluids and infusions'],
    ];
    for (const [catName, catDesc] of CATS) {
      await client.query(`
        INSERT INTO categories (name, description, pharmacy_id) VALUES ($1,$2,$3)
        ON CONFLICT (name, pharmacy_id) DO NOTHING
      `, [catName, catDesc, pharmacy.id]);
    }

    try {
      await client.query(`
        INSERT INTO roles (name, pharmacy_id, permissions) VALUES
          ('Doctor',$1,'["consultations","lab_orders","prescriptions"]'),
          ('Nurse',$1,'["vitals","nursing_notes","lab_orders"]'),
          ('Receptionist',$1,'["patients","visits","billing_view"]'),
          ('Lab Technician',$1,'["lab_orders","lab_results"]'),
          ('Pharmacist',$1,'["prescriptions","dispensing","stock"]'),
          ('Cashier',$1,'["billing","payments"]')
        ON CONFLICT DO NOTHING
      `, [pharmacy.id]);
    } catch (_) {}

    await client.query('COMMIT');
    logger.info(`Facility created: ${name} (${type})`);

    setImmediate(async () => {
      try {
        await sendWelcomeEmail({ pharmacyName: name, adminName: admin_name||'Admin', adminEmail: admin_email, adminPassword: admin_password, plan: subscription.plan||'trial', expiresAt: subscription.expires_at });
      } catch (emailErr) { logger.error('Welcome email failed:', emailErr.message); }
    });

    return successResponse(res, 201, 'Facility created successfully', {
      pharmacy,
      admin: { id: adminUser.id, email: adminUser.email, role: adminUser.role },
      subscription: { plan: subscription.plan, expires_at: subscription.expires_at },
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Create facility ROLLED BACK:', error.message);
    if (error.code === '23505') {
      if (error.constraint?.includes('email'))   return errorResponse(res, 400, 'Email is already registered');
      if (error.constraint?.includes('license')) return errorResponse(res, 400, 'License number is already registered');
    }
    return errorResponse(res, 500, 'Failed to create facility — all changes rolled back');
  } finally {
    client.release();
  }
};

const getAllPharmacies = async (req, res) => {
  try {
    const PharmacyModel = require('../models/pharmacy.model');
    const pharmacies = await PharmacyModel.findAll();
    return successResponse(res, 200, 'Facilities fetched', pharmacies);
  } catch (error) { return errorResponse(res, 500, 'Failed to fetch facilities'); }
};

const updateSubscription = async (req, res) => {
  try {
    const { plan, status, expires_at, add_days, max_users, max_counters, notes } = req.body;
    let targetExpiresAt = expires_at;

    if (add_days && !expires_at) {
      const days = parseInt(add_days, 10);
      const now = new Date();
      const baseDate = (req.body.current_expires_at && new Date(req.body.current_expires_at) > now)
        ? new Date(req.body.current_expires_at)
        : now;
      baseDate.setDate(baseDate.getDate() + days);
      targetExpiresAt = baseDate.toISOString();
    }

    const pharmacyId = req.params.pharmacy_id;
    const existing = await pool.query(`SELECT id FROM subscriptions WHERE pharmacy_id = $1`, [pharmacyId]);
    let subResult;

    if (existing.rows && existing.rows.length > 0) {
      subResult = await pool.query(`
        UPDATE subscriptions
        SET plan = COALESCE($2, plan),
            status = COALESCE($3, status),
            expires_at = COALESCE($4, expires_at),
            max_users = COALESCE($5, max_users),
            max_counters = COALESCE($6, max_counters),
            notes = COALESCE($7, notes),
            updated_at = NOW()
        WHERE pharmacy_id = $1
        RETURNING *
      `, [pharmacyId, plan || null, status || null, targetExpiresAt || null, max_users || null, max_counters || null, notes || null]);
    } else {
      subResult = await pool.query(`
        INSERT INTO subscriptions (pharmacy_id, plan, status, expires_at, max_users, max_counters, notes)
        VALUES ($1, COALESCE($2, 'trial'), COALESCE($3, 'active'), COALESCE($4, NOW() + INTERVAL '30 days'), COALESCE($5, 10), COALESCE($6, 5), $7)
        RETURNING *
      `, [pharmacyId, plan || null, status || null, targetExpiresAt || null, max_users || null, max_counters || null, notes || null]);
    }

    if (status === 'active' || !status) {
      await pool.query(`UPDATE pharmacies SET is_active = true WHERE id = $1`, [pharmacyId]);
    }

    return successResponse(res, 200, 'Subscription updated successfully', subResult.rows[0]);
  } catch (error) {
    logger.error('Failed to update subscription:', error.message);
    return errorResponse(res, 500, error.message || 'Failed to update subscription');
  }
};

const togglePharmacy = async (req, res) => {
  try {
    const PharmacyModel = require('../models/pharmacy.model');
    const pharmacy = await PharmacyModel.findById(req.params.pharmacy_id);
    if (!pharmacy) return errorResponse(res, 404, 'Facility not found');
    const newActiveState = !pharmacy.is_active;
    const updated = await PharmacyModel.update(req.params.pharmacy_id, { ...pharmacy, is_active: newActiveState });

    // If activating facility, ensure subscription is active and has a valid future expiration date
    if (newActiveState) {
      const now = new Date();
      const isExpired = pharmacy.subscription_status === 'expired' ||
                        (pharmacy.expires_at && new Date(pharmacy.expires_at) < now) ||
                        !pharmacy.subscription_status;
      if (isExpired) {
        const existingSub = await pool.query(`SELECT id FROM subscriptions WHERE pharmacy_id = $1`, [req.params.pharmacy_id]);
        if (existingSub.rows && existingSub.rows.length > 0) {
          await pool.query(`
            UPDATE subscriptions
            SET status = 'active', expires_at = NOW() + INTERVAL '30 days', updated_at = NOW()
            WHERE pharmacy_id = $1
          `, [req.params.pharmacy_id]);
        } else {
          await pool.query(`
            INSERT INTO subscriptions (pharmacy_id, plan, status, expires_at)
            VALUES ($1, COALESCE($2, 'trial'), 'active', NOW() + INTERVAL '30 days')
          `, [req.params.pharmacy_id, pharmacy.plan || 'trial']);
        }
      }
    }

    return successResponse(res, 200, `Facility ${updated.is_active ? 'activated' : 'deactivated'}`, updated);
  } catch (error) {
    logger.error('Failed to toggle facility:', error.message);
    return errorResponse(res, 500, 'Failed to toggle facility');
  }
};

const getMyPharmacy = async (req, res) => {
  try {
    const PharmacyModel = require('../models/pharmacy.model');
    const pharmacy = await PharmacyModel.findById(req.pharmacy_id);
    if (!pharmacy) return errorResponse(res, 404, 'Facility not found');
    return successResponse(res, 200, 'Facility fetched', pharmacy);
  } catch (error) { return errorResponse(res, 500, 'Failed to fetch facility'); }
};

const updateSettings = async (req, res) => {
  try {
    const PharmacyModel = require('../models/pharmacy.model');
    const settings = await PharmacyModel.updateSettings(req.pharmacy_id, req.body);
    return successResponse(res, 200, 'Settings updated', settings);
  } catch (error) { return errorResponse(res, 500, 'Failed to update settings'); }
};

const updatePharmacyInfo = async (req, res) => {
  try {
    const PharmacyModel = require('../models/pharmacy.model');
    const pharmacy = await PharmacyModel.update(req.pharmacy_id, req.body);
    return successResponse(res, 200, 'Facility updated', pharmacy);
  } catch (error) { return errorResponse(res, 500, 'Failed to update facility'); }
};

const deletePharmacy = async (req, res) => {
  try {
    const { pharmacy_id } = req.params;
    const PharmacyModel = require('../models/pharmacy.model');
    const pharmacy = await PharmacyModel.findById(pharmacy_id);
    if (!pharmacy) return errorResponse(res, 404, 'Facility not found');

    await pool.query(`UPDATE pharmacies SET deleted_at = NOW(), is_active = false WHERE id = $1`, [pharmacy_id]);
    await pool.query(`UPDATE users SET is_active = false WHERE pharmacy_id = $1`, [pharmacy_id]);

    return successResponse(res, 200, 'Facility deleted successfully');
  } catch (error) {
    logger.error('Failed to delete facility:', error.message);
    return errorResponse(res, 500, 'Failed to delete facility');
  }
};

const requestAdminOtp = async (req, res) => {
  try {
    const { pharmacy_id } = req.params;

    let adminRes = await pool.query(
      `SELECT id, email, full_name FROM users WHERE pharmacy_id = $1 AND (role = 'facility_admin' OR role = 'admin') ORDER BY created_at ASC LIMIT 1`,
      [pharmacy_id]
    );

    if (adminRes.rows.length === 0) {
      adminRes = await pool.query(
        `SELECT id, email, full_name FROM users WHERE pharmacy_id = $1 ORDER BY created_at ASC LIMIT 1`,
        [pharmacy_id]
      );
    }

    if (adminRes.rows.length === 0) {
      // Fallback check: find pharmacy email and match in users
      const pRes = await pool.query(`SELECT email FROM pharmacies WHERE id = $1`, [pharmacy_id]);
      if (pRes.rows.length > 0 && pRes.rows[0].email) {
        adminRes = await pool.query(`SELECT id, email, full_name FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [pRes.rows[0].email]);
      }
    }

    if (adminRes.rows.length === 0) {
      return errorResponse(res, 404, 'No admin user found for this facility');
    }

    const adminUser = adminRes.rows[0];
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      `UPDATE users SET reset_otp = $1, reset_otp_expires = $2 WHERE id = $3`,
      [otp, expiresAt, adminUser.id]
    );

    await sendOtpEmail({ name: adminUser.full_name, email: adminUser.email, otp });
    logger.info(`Super Admin requested OTP for facility admin ${adminUser.email} (Pharmacy: ${pharmacy_id})`);

    return successResponse(res, 200, `OTP code sent to facility admin email (${adminUser.email})`, {
      email: adminUser.email,
      user_id: adminUser.id,
      dev_otp: otp
    });
  } catch (error) {
    logger.error('Failed to request facility admin OTP:', error.message);
    return errorResponse(res, 500, 'Failed to send OTP to facility admin');
  }
};

const resetAdminPassword = async (req, res) => {
  try {
    const { pharmacy_id } = req.params;
    const { password, otp, user_id } = req.body;

    if (!password || password.length < 6) {
      return errorResponse(res, 400, 'Password must be at least 6 characters');
    }

    if (!otp || otp.toString().trim().length < 6) {
      return errorResponse(res, 400, '6-digit OTP verification code is strictly required to reset admin password');
    }

    let targetUserId = user_id;
    if (!targetUserId) {
      const adminRes = await pool.query(
        `SELECT id FROM users WHERE pharmacy_id = $1 AND (role = 'facility_admin' OR role = 'admin') ORDER BY created_at ASC LIMIT 1`,
        [pharmacy_id]
      );
      if (adminRes.rows.length > 0) {
        targetUserId = adminRes.rows[0].id;
      } else {
        const anyUser = await pool.query(
          `SELECT id FROM users WHERE pharmacy_id = $1 ORDER BY created_at ASC LIMIT 1`,
          [pharmacy_id]
        );
        if (anyUser.rows.length > 0) targetUserId = anyUser.rows[0].id;
      }
    }

    if (!targetUserId) {
      return errorResponse(res, 404, 'No admin user found for this facility');
    }

    const userRes = await pool.query(`SELECT id, email, full_name, reset_otp, reset_otp_expires FROM users WHERE id = $1`, [targetUserId]);
    if (userRes.rows.length === 0) {
      return errorResponse(res, 404, 'Admin user not found');
    }
    const userRecord = userRes.rows[0];

    // Mandatory OTP Validation
    if (!userRecord.reset_otp || userRecord.reset_otp.toString().trim() !== otp.toString().trim()) {
      return errorResponse(res, 400, 'Invalid OTP verification code. Please request a new OTP code.');
    }
    if (!userRecord.reset_otp_expires || new Date(userRecord.reset_otp_expires) < new Date()) {
      return errorResponse(res, 400, 'OTP code has expired. Please click "Send OTP to Email" to generate a fresh code.');
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    await pool.query(
      `UPDATE users SET password = $1, reset_otp = NULL, reset_otp_expires = NULL, updated_at = NOW() WHERE id = $2`,
      [hashedPassword, targetUserId]
    );

    // Send email notification to facility admin
    setImmediate(async () => {
      try {
        await sendPasswordResetEmail({
          name: userRecord.full_name || 'Facility Admin',
          email: userRecord.email,
          newPassword: password,
          resetBy: 'Platform Super Admin'
        });
      } catch (eErr) {
        logger.error('Failed to send admin password reset email:', eErr.message);
      }
    });

    logger.info(`Super Admin reset admin password for facility ${pharmacy_id}, user ${targetUserId} (${userRecord.email})`);
    return successResponse(res, 200, `Facility admin password reset successfully. Credentials sent to ${userRecord.email}`);
  } catch (error) {
    logger.error('Failed to reset facility admin password:', error.message);
    return errorResponse(res, 500, 'Failed to reset facility admin password');
  }
};

module.exports = { createPharmacy, getAllPharmacies, updateSubscription, togglePharmacy, deletePharmacy, requestAdminOtp, resetAdminPassword, getMyPharmacy, updateSettings, updatePharmacyInfo };
