const bcrypt = require('bcryptjs');
const UserModel = require('../models/user.model');
const SuperAdminModel = require('../models/superAdmin.model');
const PharmacyModel = require('../models/pharmacy.model');
const { pool } = require('../config/db');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../config/jwt');
const { successResponse, errorResponse } = require('../utils/response');
const { sendOtpEmail, sendPasswordResetEmail } = require('../utils/email');
const logger = require('../utils/logger');

// @desc    Register user (admin only, creates staff under same pharmacy)
// @route   POST /api/auth/register
const register = async (req, res) => {
  try {
    const { full_name, email, password, role } = req.body;

    if (!full_name || !email || !password || !role) {
      return errorResponse(res, 400, 'full_name, email, password and role are required');
    }
    const VALID_ROLES = ['facility_admin','receptionist','cashier','sha_officer','accountant','nurse','mch_nurse','clinical_officer','doctor','lab_technician','pharmacist','store_manager'];
    if (!VALID_ROLES.includes(role)) {
      return errorResponse(res, 400, 'Invalid role');
    }
    if (password.length < 6) {
      return errorResponse(res, 400, 'Password must be at least 6 characters');
    }

    const existing = await UserModel.findByEmailGlobal(email);
    if (existing) return errorResponse(res, 400, 'Email already registered');

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await UserModel.create({
      full_name, email,
      password: hashedPassword,
      role,
      pharmacy_id: req.user.pharmacy_id
    });

    logger.info(`User registered: ${email} as ${role}`);
    return successResponse(res, 201, 'User registered successfully', {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      pharmacy_id: user.pharmacy_id
    });
  } catch (error) {
    logger.error('Register error:', error.message);
    return errorResponse(res, 500, 'Registration failed');
  }
};

// @desc    Login
// @route   POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 400, 'Email and password are required');
    }

    // Check super admin first
    const superAdmin = await SuperAdminModel.findByEmail(email);
    if (superAdmin) {
      const isMatch = await bcrypt.compare(password, superAdmin.password);
      if (!isMatch) return errorResponse(res, 401, 'Invalid email or password');

      const payload = { id: superAdmin.id, role: 'super_admin', is_super_admin: true };
      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);

      await SuperAdminModel.updateLastLogin(superAdmin.id);
      logger.info(`Super admin logged in: ${email}`);

      return successResponse(res, 200, 'Login successful', {
        user: {
          id: superAdmin.id,
          full_name: superAdmin.full_name,
          email: superAdmin.email,
          role: 'super_admin',
          is_super_admin: true,
          pharmacy_id: null,
          pharmacy: null
        },
        accessToken,
        refreshToken
      });
    }

    // Check pharmacy user
    const user = await UserModel.findByEmailGlobal(email);
    if (!user) return errorResponse(res, 401, 'Invalid email or password');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return errorResponse(res, 401, 'Invalid email or password');

    if (!user.is_active) {
      return errorResponse(res, 403, 'Your account has been deactivated. Contact your administrator.');
    }

    const pharmacy = await PharmacyModel.findById(user.pharmacy_id);
    if (!pharmacy || !pharmacy.is_active) {
      return errorResponse(res, 403, 'Your facility account is inactive. Contact system administrator.');
    }

    const now = new Date();
    const isExpired = pharmacy.subscription_status === 'expired' ||
                      (pharmacy.expires_at && new Date(pharmacy.expires_at) < now);

    if (isExpired) {
      return errorResponse(res, 403, 'Facility subscription has expired. Contact system super admin to renew.');
    }

    const payload = { id: user.id, role: user.role, pharmacy_id: user.pharmacy_id };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await UserModel.saveRefreshToken(user.id, refreshToken, expiresAt, user.pharmacy_id);
    await UserModel.updateLastLogin(user.id);

    logger.info(`User logged in: ${email} (${pharmacy.name})`);
    return successResponse(res, 200, 'Login successful', {
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        permissions: (typeof user.permissions === 'string' ? JSON.parse(user.permissions || '[]') : (user.permissions || [])),
        is_super_admin: false,
        pharmacy_id: user.pharmacy_id,
        pharmacy: {
          id: pharmacy.id,
          name: pharmacy.name,
          logo_url: pharmacy.logo_url,
          currency: pharmacy.currency || 'KES',
          facility_type: pharmacy.facility_type || 'hospital'
        }
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    logger.error('Login error:', error.message);
    return errorResponse(res, 500, 'Login failed');
  }
};

// @desc    Refresh token
// @route   POST /api/auth/refresh
const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return errorResponse(res, 400, 'Refresh token required');

    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded.is_super_admin) {
      const storedToken = await UserModel.findRefreshToken(refreshToken);
      if (!storedToken) return errorResponse(res, 401, 'Invalid or expired refresh token');
    }

    const accessToken = generateAccessToken({
      id: decoded.id,
      role: decoded.role,
      pharmacy_id: decoded.pharmacy_id,
      is_super_admin: decoded.is_super_admin
    });

    return successResponse(res, 200, 'Token refreshed', { accessToken });
  } catch (error) {
    return errorResponse(res, 401, 'Invalid or expired refresh token');
  }
};

// @desc    Logout
// @route   POST /api/auth/logout
const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await UserModel.deleteRefreshToken(refreshToken);
    return successResponse(res, 200, 'Logged out successfully');
  } catch (error) {
    return errorResponse(res, 500, 'Logout failed');
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
const getMe = async (req, res) => {
  try {
    if (req.user.is_super_admin) {
      const admin = await SuperAdminModel.findById(req.user.id);
      return successResponse(res, 200, 'User fetched', {
        ...admin, role: 'super_admin', is_super_admin: true, pharmacy_id: null, pharmacy: null
      });
    }

    const user = await UserModel.findById(req.user.id);
    const pharmacy = await PharmacyModel.findById(user.pharmacy_id);

    const userPerms = typeof user.permissions === 'string' ? JSON.parse(user.permissions || '[]') : (user.permissions || []);
    return successResponse(res, 200, 'User fetched', {
      ...user,
      permissions: userPerms,
      is_super_admin: false,
      pharmacy: pharmacy ? {
        id: pharmacy.id,
        name: pharmacy.name,
        logo_url: pharmacy.logo_url,
        currency: pharmacy.currency || 'KES',
        facility_type: pharmacy.facility_type || 'hospital',
        receipt_header: pharmacy.receipt_header,
        receipt_footer: pharmacy.receipt_footer,
        mpesa_till_number: pharmacy.mpesa_till_number,
        mpesa_paybill: pharmacy.mpesa_paybill,
      } : null
    });
  } catch (error) {
    logger.error('GetMe error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch user');
  }
};

// @desc    Change own password
// @route   PUT /api/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return errorResponse(res, 400, 'Current password and new password are required');
    }
    if (new_password.length < 6) {
      return errorResponse(res, 400, 'New password must be at least 6 characters');
    }

    if (req.user?.is_super_admin) {
      const admin = await SuperAdminModel.findById(req.user.id);
      if (!admin || !admin.password) return errorResponse(res, 404, 'Super admin user account not found');

      const isMatch = await bcrypt.compare(current_password, admin.password);
      if (!isMatch) return errorResponse(res, 401, 'Current password is incorrect');

      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(new_password, salt);
      await SuperAdminModel.updatePassword(admin.id, hashedPassword);

      logger.info(`Password changed successfully for Super Admin: ${admin.email}`);
      return successResponse(res, 200, 'Password changed successfully');
    }

    const user = await UserModel.findById(req.user.id);
    if (!user) return errorResponse(res, 404, 'User account not found');

    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch) return errorResponse(res, 401, 'Current password is incorrect');

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(new_password, salt);
    await UserModel.updatePassword(user.id, user.pharmacy_id, hashedPassword);

    logger.info(`Password changed successfully for user: ${user.email}`);
    return successResponse(res, 200, 'Password changed successfully');
  } catch (error) {
    logger.error('Change password error:', error.message);
    return errorResponse(res, 500, 'Failed to change password');
  }
};

// @desc    Update own clinical professional profile (including DHA license details)
// @route   PUT /api/auth/profile
const updateProfile = async (req, res) => {
  try {
    const { full_name, dha_license_number, professional_title } = req.body;
    const user = await UserModel.updateProfile(req.user.id, req.user.pharmacy_id, {
      full_name,
      dha_license_number,
      professional_title
    });
    if (!user) return errorResponse(res, 404, 'User not found');
    logger.info(`Clinical profile updated for user: ${user.email}`);
    return successResponse(res, 200, 'Clinical profile updated successfully', user);
  } catch (error) {
    logger.error('Update clinical profile error:', error.message);
    return errorResponse(res, 500, 'Failed to update clinical profile');
  }
};

// @desc    Request OTP for self-service forgot password
// @route   POST /api/auth/forgot-password/request-otp
const requestPasswordOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return errorResponse(res, 400, 'Email address is required');

    // Check super admin or user
    let isSuperAdmin = false;
    let targetUser = await SuperAdminModel.findByEmail(email);
    if (targetUser) {
      isSuperAdmin = true;
    } else {
      targetUser = await UserModel.findByEmailGlobal(email);
    }

    if (!targetUser) {
      return errorResponse(res, 404, 'No account found with this email address');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    if (isSuperAdmin) {
      await pool.query(
        `UPDATE super_admins SET reset_otp = $1, reset_otp_expires = $2 WHERE id = $3`,
        [otp, expiresAt, targetUser.id]
      );
    } else {
      await pool.query(
        `UPDATE users SET reset_otp = $1, reset_otp_expires = $2 WHERE id = $3`,
        [otp, expiresAt, targetUser.id]
      );
    }

    await sendOtpEmail({ name: targetUser.full_name, email: targetUser.email, otp });
    logger.info(`Password reset OTP dispatched to ${email}`);

    return successResponse(res, 200, `OTP verification code sent to ${email}`, {
      email,
      dev_otp: otp
    });
  } catch (error) {
    logger.error('Failed to request password OTP:', error.message);
    return errorResponse(res, 500, 'Failed to send OTP code');
  }
};

// @desc    Verify OTP and reset password for self-service
// @route   POST /api/auth/forgot-password/verify-otp
const verifyOtpAndResetPassword = async (req, res) => {
  try {
    const { email, otp, new_password } = req.body;
    if (!email || !otp || !new_password) {
      return errorResponse(res, 400, 'Email, OTP code, and new_password are required');
    }
    if (new_password.length < 6) {
      return errorResponse(res, 400, 'Password must be at least 6 characters');
    }

    let isSuperAdmin = false;
    let targetUser = await pool.query(
      `SELECT id, email, full_name, reset_otp, reset_otp_expires FROM super_admins WHERE LOWER(email) = LOWER($1)`,
      [email]
    );

    if (targetUser.rows.length > 0) {
      isSuperAdmin = true;
    } else {
      targetUser = await pool.query(
        `SELECT id, email, full_name, reset_otp, reset_otp_expires FROM users WHERE LOWER(email) = LOWER($1)`,
        [email]
      );
    }

    if (targetUser.rows.length === 0) {
      return errorResponse(res, 404, 'User account not found');
    }

    const userRecord = targetUser.rows[0];
    if (!userRecord.reset_otp || userRecord.reset_otp !== otp.toString().trim()) {
      return errorResponse(res, 400, 'Invalid OTP verification code');
    }

    if (new Date(userRecord.reset_otp_expires) < new Date()) {
      return errorResponse(res, 400, 'OTP code has expired. Please request a new code.');
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    if (isSuperAdmin) {
      await pool.query(
        `UPDATE super_admins SET password = $1, reset_otp = NULL, reset_otp_expires = NULL, updated_at = NOW() WHERE id = $2`,
        [hashedPassword, userRecord.id]
      );
    } else {
      await pool.query(
        `UPDATE users SET password = $1, reset_otp = NULL, reset_otp_expires = NULL, updated_at = NOW() WHERE id = $2`,
        [hashedPassword, userRecord.id]
      );
    }

    setImmediate(async () => {
      try {
        await sendPasswordResetEmail({
          name: userRecord.full_name || 'User',
          email: userRecord.email,
          newPassword: new_password,
          resetBy: 'Self-Service Password Reset'
        });
      } catch (eErr) {
        logger.error('Failed to send reset confirmation email:', eErr.message);
      }
    });

    logger.info(`Password reset verified with OTP for ${email}`);
    return successResponse(res, 200, 'Password reset successfully. You can now log in.');
  } catch (error) {
    logger.error('Failed to verify OTP and reset password:', error.message);
    return errorResponse(res, 500, 'Failed to reset password');
  }
};

module.exports = { register, login, refresh, logout, getMe, changePassword, updateProfile, requestPasswordOtp, verifyOtpAndResetPassword };
