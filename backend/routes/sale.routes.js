const express = require('express');
const router = express.Router();
const { createSale, getSales, getSale, getDailySummary } = require('../controllers/sale.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/summary/daily', authorize('facility_admin', 'admin', 'accountant', 'pharmacist', 'store_manager', 'hr', 'super_admin'), getDailySummary);
router.get('/', getSales);
router.get('/:id', getSale);
router.post('/', createSale);

module.exports = router;
