const express = require('express');
const router = express.Router();
const { getDashboard, getSalesReport, getMonthlyReport, getStockReport, getDailySummaryReport, getPatientHistory, getProfitReport, getSalesSummary, getLabSalesSummary, getDrugSalesSummary } = require('../controllers/reports.controller');
const { protect, requirePharmacy, authorize } = require('../middleware/auth.middleware');

router.use(protect, requirePharmacy);

router.get('/dashboard',      getDashboard);
router.get('/sales',          authorize('facility_admin','pharmacist','store_manager'), getSalesReport);
router.get('/sales/monthly',  authorize('facility_admin','super_admin'), getMonthlyReport);
router.get('/stock',          authorize('facility_admin','pharmacist','store_manager'), getStockReport);
router.get('/daily-summary',  getDailySummaryReport);
router.get('/patient/:patient_id/history', getPatientHistory);


router.get('/profit', getProfitReport);
router.get('/sales-summary', getSalesSummary);
router.get('/lab-sales', getLabSalesSummary);
router.get('/drug-sales', getDrugSalesSummary);


module.exports = router;
