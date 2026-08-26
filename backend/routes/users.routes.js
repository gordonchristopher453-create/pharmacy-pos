const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUser, updatePermissions, requestUserOtp, resetPassword, getRoles } = require('../controllers/users.controller');
const { protect, requirePermission, requirePharmacy } = require('../middleware/auth.middleware');

router.use(protect, requirePharmacy);

router.get('/roles', getRoles);
router.get('/',                requirePermission('can_manage_users'), getUsers);
router.post('/',               requirePermission('can_manage_users'), createUser);
router.put('/:id',             requirePermission('can_manage_users'), updateUser);
router.put('/:id/permissions', requirePermission('can_assign_permissions'), updatePermissions);
router.post('/:id/request-otp',requirePermission('can_manage_users'), requestUserOtp);
router.put('/:id/password',    requirePermission('can_manage_users'), resetPassword);

module.exports = router;
