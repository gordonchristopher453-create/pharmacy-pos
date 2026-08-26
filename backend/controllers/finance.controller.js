const FinanceModel = require('../models/finance.model');
const UserModel = require('../models/user.model');
const HRModel = require('../models/hr.model');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

// ─── EXPENSES ───────────────────────────────────────────
const addExpense = async (req, res) => {
  try {
    const { category, description, amount, expense_date, payee, payment_method, receipt_ref } = req.body;
    if (!category || !description || !amount) {
      return errorResponse(res, 400, 'Category, description and amount are required');
    }
    const expense = await FinanceModel.createExpense({
      pharmacy_id: req.pharmacy_id,
      category,
      description,
      amount: parseFloat(amount),
      expense_date: expense_date || new Date().toISOString().split('T')[0],
      payee,
      payment_method,
      receipt_ref,
      recorded_by: req.user.id
    });
    return successResponse(res, 201, 'Expense added', expense);
  } catch (error) {
    logger.error('Add expense error:', error.message);
    return errorResponse(res, 500, 'Failed to add expense');
  }
};

const getExpenses = async (req, res) => {
  try {
    const { start_date, end_date, category } = req.query;
    const expenses = await FinanceModel.getExpenses({ pharmacy_id: req.pharmacy_id, start_date, end_date, category });
    const summary = await FinanceModel.getExpenseSummary({ pharmacy_id: req.pharmacy_id, start_date, end_date });
    return successResponse(res, 200, 'Expenses fetched', { expenses, summary });
  } catch (error) {
    logger.error('Get expenses error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch expenses');
  }
};

const deleteExpense = async (req, res) => {
  try {
    const deleted = await FinanceModel.deleteExpense(req.params.id, req.pharmacy_id);
    if (!deleted) return errorResponse(res, 404, 'Expense not found');
    return successResponse(res, 200, 'Expense deleted');
  } catch (error) {
    logger.error('Delete expense error:', error.message);
    return errorResponse(res, 500, 'Failed to delete expense');
  }
};

// ─── PETTY CASH ─────────────────────────────────────────
const addPettyCash = async (req, res) => {
  try {
    const { transaction_type, category, amount, description, payee_or_source, voucher_number, payment_method, receipt_ref } = req.body;
    if (!transaction_type || !amount || !description) {
      return errorResponse(res, 400, 'Transaction type, amount, and description are required');
    }
    const pc = await FinanceModel.createPettyCashTransaction({
      pharmacy_id: req.pharmacy_id,
      transaction_type,
      category,
      amount: parseFloat(amount),
      description,
      payee_or_source,
      voucher_number,
      payment_method,
      receipt_ref,
      recorded_by: req.user.id,
      recorded_by_name: req.user.full_name || req.user.name || 'Accountant'
    });
    return successResponse(res, 201, 'Petty cash transaction recorded', pc);
  } catch (error) {
    logger.error('Petty cash error:', error.message);
    return errorResponse(res, 500, 'Failed to record petty cash transaction');
  }
};

const getPettyCash = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const data = await FinanceModel.getPettyCash({ pharmacy_id: req.pharmacy_id, start_date, end_date });
    return successResponse(res, 200, 'Petty cash records fetched', data);
  } catch (error) {
    logger.error('Get petty cash error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch petty cash records');
  }
};

const deletePettyCash = async (req, res) => {
  try {
    const deleted = await FinanceModel.deletePettyCash(req.params.id, req.pharmacy_id);
    if (!deleted) return errorResponse(res, 404, 'Petty cash record not found');
    return successResponse(res, 200, 'Petty cash record deleted');
  } catch (error) {
    logger.error('Delete petty cash error:', error.message);
    return errorResponse(res, 500, 'Failed to delete petty cash record');
  }
};

// ─── PAYROLL ────────────────────────────────────────────
const addPayroll = async (req, res) => {
  try {
    const {
      user_id, employee_name, employee_email, role,
      month, year, basic_salary, allowances,
      paye, sha, nssf, housing_levy, other_deductions, notes
    } = req.body;

    if (!employee_name || !month || !year || !basic_salary) {
      return errorResponse(res, 400, 'Employee name, month, year and basic salary are required');
    }

    const payroll = await FinanceModel.createPayroll({
      pharmacy_id: req.pharmacy_id,
      user_id: user_id || null,
      employee_name, employee_email, role,
      month: parseInt(month),
      year: parseInt(year),
      basic_salary: parseFloat(basic_salary),
      allowances: parseFloat(allowances || 0),
      paye: parseFloat(paye || 0),
      sha: parseFloat(sha || 0),
      nssf: parseFloat(nssf || 0),
      housing_levy: parseFloat(housing_levy || 0),
      other_deductions: parseFloat(other_deductions || 0),
      notes,
      created_by: req.user.id
    });

    return successResponse(res, 201, 'Payroll saved', payroll);
  } catch (error) {
    logger.error('Add payroll error:', error.message);
    return errorResponse(res, 500, 'Failed to save payroll: ' + error.message);
  }
};

const generateBatchPayroll = async (req, res) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) {
      return errorResponse(res, 400, 'Month and year are required');
    }
    const generated = await FinanceModel.generateBatchPayroll({
      pharmacy_id: req.pharmacy_id,
      month: parseInt(month),
      year: parseInt(year),
      created_by: req.user.id
    });
    return successResponse(res, 201, `Generated payroll for ${generated.length} employees`, generated);
  } catch (error) {
    logger.error('Batch payroll error:', error.message);
    return errorResponse(res, 500, 'Failed to generate batch payroll: ' + error.message);
  }
};

const calculateTaxPreview = async (req, res) => {
  try {
    const { basic_salary, allowances } = req.query;
    const calc = FinanceModel.calculateKenyanStatutory(parseFloat(basic_salary || 0), parseFloat(allowances || 0));
    return successResponse(res, 200, 'Statutory deductions computed', calc);
  } catch (error) {
    return errorResponse(res, 500, 'Calculation error');
  }
};

const getPayroll = async (req, res) => {
  try {
    const { month, year } = req.query;
    const payroll = await FinanceModel.getPayroll({
      pharmacy_id: req.pharmacy_id,
      month: month ? parseInt(month) : null,
      year: year ? parseInt(year) : null
    });
    return successResponse(res, 200, 'Payroll fetched', payroll);
  } catch (error) {
    logger.error('Get payroll error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch payroll');
  }
};

const deletePayroll = async (req, res) => {
  try {
    const deleted = await FinanceModel.deletePayroll(req.params.id, req.pharmacy_id);
    if (!deleted) return errorResponse(res, 404, 'Payroll record not found');
    return successResponse(res, 200, 'Payroll record deleted');
  } catch (error) {
    logger.error('Delete payroll error:', error.message);
    return errorResponse(res, 500, 'Failed to delete payroll record');
  }
};

const getCashFlow = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const data = await FinanceModel.getCashFlow({ pharmacy_id: req.pharmacy_id, start_date, end_date });
    return successResponse(res, 200, 'Cash flow fetched', data);
  } catch (error) {
    logger.error('Cash flow error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch cash flow');
  }
};

const getProfitLoss = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const data = await FinanceModel.getProfitLoss({ pharmacy_id: req.pharmacy_id, start_date, end_date });
    return successResponse(res, 200, 'P&L fetched', data);
  } catch (error) {
    logger.error('P&L error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch P&L');
  }
};

const getStaffForPayroll = async (req, res) => {
  try {
    // Return staff profiles if available, otherwise users
    let staff = await HRModel.getStaffProfiles(req.pharmacy_id, { status: 'active' });
    if (staff.length === 0) {
      staff = await UserModel.findAll(req.pharmacy_id);
    }
    return successResponse(res, 200, 'Staff fetched', staff);
  } catch (error) {
    logger.error('Get staff error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch staff');
  }
};

module.exports = {
  addExpense, getExpenses, deleteExpense,
  addPettyCash, getPettyCash, deletePettyCash,
  addPayroll, generateBatchPayroll, calculateTaxPreview, getPayroll, deletePayroll,
  getCashFlow, getProfitLoss, getStaffForPayroll
};
