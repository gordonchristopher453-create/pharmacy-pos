const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  openVisit, getVisit, getVisits, getActiveVisits, updateVisitStatus,
  createServiceOrder, updateServiceOrder, getDeptOrders,
  getBillingByVisit, payBillingItem
} = require('../controllers/visit.controller');

// Visit CRUD
router.post('/',                    protect, openVisit);
router.get('/',                     protect, getVisits);
router.get('/active',               protect, getActiveVisits);
router.get('/:id',                  protect, getVisit);
router.put('/:id/status',           protect, updateVisitStatus);

// Service orders (inter-dept communication)
router.post('/:visit_id/orders',    protect, createServiceOrder);
router.put('/orders/:id',           protect, updateServiceOrder);
router.get('/dept/:dept/orders',    protect, getDeptOrders);

// Billing
router.get('/:visit_id/billing',    protect, getBillingByVisit);
router.put('/billing/:id/pay',      protect, payBillingItem);

module.exports = router;
