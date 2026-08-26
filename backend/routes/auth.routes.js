const express = require('express');
const router = express.Router();
const { register, login, refresh, logout, getMe, changePassword, updateProfile, requestPasswordOtp, verifyOtpAndResetPassword } = require('../controllers/auth.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.post('/register', protect, authorize('facility_admin', 'admin'), register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', protect, logout);
router.post('/forgot-password/request-otp', requestPasswordOtp);
router.post('/forgot-password/verify-otp', verifyOtpAndResetPassword);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);
router.put('/profile', protect, updateProfile);

module.exports = router;
