const { verifyAccessToken } = require('../config/jwt');
const UserModel = require('../models/user.model');
const SuperAdminModel = require('../models/superAdmin.model');
const logger = require('../utils/logger');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    if (decoded.is_super_admin) {
      const admin = await SuperAdminModel.findById(decoded.id);
      if (!admin) return res.status(401).json({ success: false, message: 'Super admin not found.' });
      req.user = { ...admin, role: 'super_admin', is_super_admin: true, pharmacy_id: null, permissions: ['*'] };
      req.pharmacy_id = null;
      return next();
    }

    const user = await UserModel.findById(decoded.id);
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated.' });
    }

    let perms = user.permissions;
    if (typeof perms === 'string') { try { perms = JSON.parse(perms); } catch { perms = []; } }
    if (!Array.isArray(perms)) perms = [];

    req.user = { ...user, permissions: perms, is_super_admin: false };
    req.pharmacy_id = user.pharmacy_id || 1;
    const { tenantStorage } = require('../config/db');
    tenantStorage.run(req.pharmacy_id, () => {
      next();
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.info('Auth middleware: JWT expired');
    } else if (error.name === 'JsonWebTokenError') {
      logger.info('Auth middleware: Invalid JWT - ' + error.message);
    } else {
      logger.error(`Auth middleware error: ${error.stack}`);
    }
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (req.user.is_super_admin) return next();
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: `Role '${req.user.role}' is not authorized.` });
    }
    next();
  };
};

const requirePermission = (permission) => {
  return (req, res, next) => {
    if (req.user.is_super_admin) return next();
    if (['facility_admin', 'admin'].includes(req.user.role)) return next();
    const perms = req.user.permissions || [];
    if (perms.includes('*') || perms.includes(permission)) return next();
    return res.status(403).json({ success: false, message: `Permission required: ${permission}` });
  };
};

const requireAnyPermission = (...permissions) => {
  return (req, res, next) => {
    if (req.user.is_super_admin) return next();
    if (['facility_admin', 'admin'].includes(req.user.role)) return next();
    const perms = req.user.permissions || [];
    if (perms.includes('*')) return next();
    if (permissions.some(p => perms.includes(p))) return next();
    return res.status(403).json({ success: false, message: `Required: ${permissions.join(' or ')}` });
  };
};

const superAdminOnly = (req, res, next) => {
  if (!req.user.is_super_admin) {
    return res.status(403).json({ success: false, message: 'Super admin access required.' });
  }
  next();
};

const requirePharmacy = (req, res, next) => {
  if (!req.user.pharmacy_id && !req.user.is_super_admin) {
    req.user.pharmacy_id = 1;
    req.pharmacy_id = 1;
  }
  next();
};

module.exports = { protect, authorize, requirePermission, requireAnyPermission, superAdminOnly, requirePharmacy };
