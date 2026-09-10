const express = require('express');
const router = express.Router();
const { protect, requirePharmacy, authorize } = require('../middleware/auth.middleware');
const {
  addExpense, getExpenses, deleteExpense,
  addPettyCash, getPettyCash, deletePettyCash,
  addPayroll, generateBatchPayroll, calculateTaxPreview, getPayroll, deletePayroll,
  getCashFlow, getProfitLoss, getStaffForPayroll
} = require('../controllers/finance.controller');

router.use(protect);
router.use(requirePharmacy);
router.use(authorize('facility_admin', 'admin', 'accountant', 'super_admin'));

// Operating Expenses
router.get('/expenses', getExpenses);
router.post('/expenses', addExpense);
router.delete('/expenses/:id', deleteExpense);

// Petty Cash Book
router.get('/petty-cash', getPettyCash);
router.post('/petty-cash', addPettyCash);
router.delete('/petty-cash/:id', deletePettyCash);

// Payroll & Remuneration
router.get('/payroll', getPayroll);
router.post('/payroll', addPayroll);
router.post('/payroll/batch', generateBatchPayroll);
router.get('/payroll/tax-preview', calculateTaxPreview);
router.delete('/payroll/:id', deletePayroll);

// Financial Statements & Audits
router.get('/cashflow', getCashFlow);
router.get('/pnl', getProfitLoss);
router.get('/staff', getStaffForPayroll);

module.exports = router;
