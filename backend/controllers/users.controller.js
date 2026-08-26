const bcrypt = require('bcryptjs');
const UserModel = require('../models/user.model');
const { pool } = require('../config/db');
const { sendOtpEmail, sendPasswordResetEmail } = require('../utils/email');
const { ROLES, ROLE_PERMISSIONS, ROLE_META } = require('../config/permissions');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

const VALID_ROLES = Object.values(ROLES).filter(r => r !== 'super_admin');

const getUsers = async (req, res) => {
  try {
    const users = await UserModel.findAll(req.pharmacy_id);
    return successResponse(res, 200, 'Users fetched', users);
  } catch (error) {
    logger.error('Get users error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch users');
  }
};

const createUser = async (req, res) => {
  try {
    const { full_name, email, password, role, custom_permissions } = req.body;

    if (!full_name || !email || !password || !role) {
      return errorResponse(res, 400, 'full_name, email, password and role are required');
    }
    if (!VALID_ROLES.includes(role)) {
      return errorResponse(res, 400, `Invalid role. Valid: ${VALID_ROLES.join(', ')}`);
    }
    if (password.length < 6) {
      return errorResponse(res, 400, 'Password must be at least 6 characters');
    }

    const existing = await UserModel.findByEmailGlobal(email);
    if (existing) return errorResponse(res, 400, 'Email already registered');

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    const permissions = Array.isArray(custom_permissions) ? custom_permissions : ROLE_PERMISSIONS[role] || [];

    const user = await UserModel.create({
      full_name, email, password: hashedPassword, role,
      pharmacy_id: req.pharmacy_id, custom_permissions: permissions,
    });

    logger.info(`User created: ${email} as ${role} in facility ${req.pharmacy_id}`);
    return successResponse(res, 201, 'User created successfully', {
      id: user.id, full_name: user.full_name, email: user.email,
      role: user.role, permissions: user.permissions, pharmacy_id: user.pharmacy_id,
    });
  } catch (error) {
    logger.error('Create user error:', error.message);
    return errorResponse(res, 500, 'Failed to create user');
  }
};

const updateUser = async (req, res) => {
  try {
    const { full_name, role, is_active, permissions } = req.body;

    if (req.params.id === String(req.user.id) && is_active === false) {
      return errorResponse(res, 400, 'You cannot deactivate your own account');
    }
    if (role && !VALID_ROLES.includes(role)) {
      return errorResponse(res, 400, `Invalid role. Valid: ${VALID_ROLES.join(', ')}`);
    }

    const user = await UserModel.update(req.params.id, req.pharmacy_id, { full_name, role, is_active, permissions });
    if (!user) return errorResponse(res, 404, 'User not found');
    return successResponse(res, 200, 'User updated', user);
  } catch (error) {
    logger.error('Update user error:', error.message);
    return errorResponse(res, 500, 'Failed to update user');
  }
};

const updatePermissions = async (req, res) => {
  try {
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      return errorResponse(res, 400, 'permissions must be an array');
    }
    const user = await UserModel.updatePermissions(req.params.id, req.pharmacy_id, permissions);
    if (!user) return errorResponse(res, 404, 'User not found');
    logger.info(`Permissions updated for user ${req.params.id} by ${req.user.id}`);
    return successResponse(res, 200, 'Permissions updated', user);
  } catch (error) {
    logger.error('Update permissions error:', error.message);
    return errorResponse(res, 500, 'Failed to update permissions');
  }
};

const requestUserOtp = async (req, res) => {
  try {
    const userId = req.params.id;
    const pharmacyId = req.pharmacy_id;

    const userRes = await pool.query(
      `SELECT id, email, full_name FROM users WHERE id = $1 AND pharmacy_id = $2`,
      [userId, pharmacyId]
    );

    if (userRes.rows.length === 0) {
      return errorResponse(res, 404, 'Staff member not found');
    }

    const staffUser = userRes.rows[0];
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      `UPDATE users SET reset_otp = $1, reset_otp_expires = $2 WHERE id = $3 AND pharmacy_id = $4`,
      [otp, expiresAt, userId, pharmacyId]
    );

    await sendOtpEmail({ name: staffUser.full_name, email: staffUser.email, otp });
    logger.info(`OTP requested for staff member ${staffUser.email} by admin ${req.user.id}`);

    return successResponse(res, 200, `OTP code sent to staff email (${staffUser.email})`, {
      email: staffUser.email,
      dev_otp: otp
    });
  } catch (error) {
    logger.error('Failed to send staff OTP:', error.message);
    return errorResponse(res, 500, 'Failed to send OTP code to staff member');
  }
};

const resetPassword = async (req, res) => {
  try {
    const { password, otp } = req.body;
    const userId = req.params.id;
    const pharmacyId = req.pharmacy_id;

    if (!password || password.length < 6) {
      return errorResponse(res, 400, 'Password must be at least 6 characters');
    }

    if (!otp || otp.toString().trim().length < 6) {
      return errorResponse(res, 400, '6-digit OTP verification code is strictly required to reset staff password');
    }

    const userRes = await pool.query(
      `SELECT id, email, full_name, reset_otp, reset_otp_expires FROM users WHERE id = $1 AND pharmacy_id = $2`,
      [userId, pharmacyId]
    );

    if (userRes.rows.length === 0) {
      return errorResponse(res, 404, 'User not found');
    }

    const userRecord = userRes.rows[0];

    if (!userRecord.reset_otp || userRecord.reset_otp.toString().trim() !== otp.toString().trim()) {
      return errorResponse(res, 400, 'Invalid OTP verification code. Please request a new OTP code.');
    }
    if (!userRecord.reset_otp_expires || new Date(userRecord.reset_otp_expires) < new Date()) {
      return errorResponse(res, 400, 'OTP code has expired. Please request a new OTP code.');
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    await pool.query(
      `UPDATE users SET password = $1, reset_otp = NULL, reset_otp_expires = NULL, updated_at = NOW() WHERE id = $2 AND pharmacy_id = $3`,
      [hashedPassword, userId, pharmacyId]
    );

    setImmediate(async () => {
      try {
        await sendPasswordResetEmail({
          name: userRecord.full_name || 'Staff Member',
          email: userRecord.email,
          newPassword: password,
          resetBy: req.user?.full_name || 'Facility Administrator'
        });
      } catch (eErr) {
        logger.error('Failed to send staff password reset email:', eErr.message);
      }
    });

    logger.info(`Password reset for staff ${userId} (${userRecord.email}) by admin ${req.user.id}`);
    return successResponse(res, 200, `Staff password reset successfully. Credentials emailed to ${userRecord.email}`);
  } catch (error) {
    logger.error('Reset password error:', error.message);
    return errorResponse(res, 500, 'Failed to reset password');
  }
};

const getRoles = async (req, res) => {
  try {
    const roles = Object.values(ROLES)
      .filter(r => r !== 'super_admin')
      .map(role => ({
        value: role,
        label: ROLE_META[role]?.label || role,
        icon:  ROLE_META[role]?.icon  || '👤',
        color: ROLE_META[role]?.color || '#888',
        default_permissions: ROLE_PERMISSIONS[role] || [],
      }));
    return successResponse(res, 200, 'Roles fetched', roles);
  } catch (error) {
    return errorResponse(res, 500, 'Failed to fetch roles');
  }
};

module.exports = { getUsers, createUser, updateUser, updatePermissions, requestUserOtp, resetPassword, getRoles };
