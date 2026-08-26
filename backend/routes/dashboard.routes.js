const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  getVisitDashboard, getANCRegister, getImmunizationRegister,
  getDeliveryRegister, getRevenueReport, getStockMovementReport, getAuditTrail,
} = require('../controllers/dashboard.controller');

// Part 16 — Visit Dashboard
router.get('/visits',               protect, getVisitDashboard);

// Part 17 — Audit Trail
router.get('/audit',                protect, getAuditTrail);

// Part 18 — Reports
router.get('/reports/anc',          protect, getANCRegister);
router.get('/reports/immunization', protect, getImmunizationRegister);
router.get('/reports/deliveries',   protect, getDeliveryRegister);
router.get('/reports/revenue',      protect, getRevenueReport);
router.get('/reports/stock',        protect, getStockMovementReport);

module.exports = router;
