const express = require('express');
const router = express.Router();
const { protect, requirePharmacy, authorize } = require('../middleware/auth.middleware');
const { addExpense, getExpenses, deleteExpense, addPayroll, getPayroll, deletePayroll, getCashFlow, getProfitLoss, getStaffForPayroll } = require('../controllers/finance.controller');

router.use(protect);
router.use(requirePharmacy);
router.use(authorize('facility_admin', 'accountant', 'super_admin'));

router.get('/expenses', getExpenses);
router.post('/expenses', addExpense);
router.delete('/expenses/:id', deleteExpense);

router.get('/payroll', getPayroll);
router.post('/payroll', addPayroll);
router.delete('/payroll/:id', deletePayroll);

router.get('/cashflow', getCashFlow);
router.get('/pnl', getProfitLoss);
router.get('/staff', getStaffForPayroll);

module.exports = router;
