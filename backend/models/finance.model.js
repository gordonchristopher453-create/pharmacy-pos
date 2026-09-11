const { pool } = require('../config/db');

class FinanceModel {
  // ─── EXPENSES ───────────────────────────────────────────
  static async createExpense({ pharmacy_id, category, description, amount, expense_date, recorded_by }) {
    const result = await pool.query(`
      INSERT INTO expenses (pharmacy_id, category, description, amount, expense_date, recorded_by)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [pharmacy_id, category, description, amount, expense_date, recorded_by]);
    return result.rows[0];
  }

  static async getExpenses({ pharmacy_id, start_date, end_date, category }) {
    let query = `
      SELECT e.*, u.full_name as recorded_by_name
      FROM expenses e
      LEFT JOIN users u ON e.recorded_by::text = u.id::text
      WHERE (e.pharmacy_id::text = $1::text OR e.pharmacy_id IS NULL)
    `;
    const params = [pharmacy_id];
    if (start_date) { params.push(start_date); query += ` AND e.expense_date >= $${params.length}`; }
    if (end_date) { params.push(end_date); query += ` AND e.expense_date <= $${params.length}`; }
    if (category) { params.push(category); query += ` AND e.category = $${params.length}`; }
    query += ` ORDER BY e.expense_date DESC`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async getExpenseSummary({ pharmacy_id, start_date, end_date }) {
    let query = `
      SELECT
        COALESCE(SUM(amount), 0) as total,
        COUNT(*) as count,
        category,
        COALESCE(SUM(amount) FILTER (WHERE category='salary'), 0) as salary_total,
        COALESCE(SUM(amount) FILTER (WHERE category='rent'), 0) as rent_total,
        COALESCE(SUM(amount) FILTER (WHERE category='utilities'), 0) as utilities_total,
        COALESCE(SUM(amount) FILTER (WHERE category='stock'), 0) as stock_total,
        COALESCE(SUM(amount) FILTER (WHERE category='equipment'), 0) as equipment_total,
        COALESCE(SUM(amount) FILTER (WHERE category='other'), 0) as other_total
      FROM expenses WHERE (pharmacy_id::text = $1::text OR pharmacy_id IS NULL)
    `;
    const params = [pharmacy_id];
    if (start_date) { params.push(start_date); query += ` AND expense_date >= $${params.length}`; }
    if (end_date) { params.push(end_date); query += ` AND expense_date <= $${params.length}`; }
    query += ` GROUP BY category`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async deleteExpense(id, pharmacy_id) {
    const result = await pool.query(`
      DELETE FROM expenses WHERE id::text = $1::text AND (pharmacy_id::text = $2::text OR pharmacy_id IS NULL) RETURNING id
    `, [id, pharmacy_id]);
    return result.rows[0];
  }

  // ─── PAYROLL ────────────────────────────────────────────
  static async createPayroll({
    pharmacy_id, user_id, employee_name, employee_email, role,
    month, year, basic_salary, allowances,
    paye, sha, nssf, housing_levy, other_deductions,
    notes, created_by
  }) {
    const total_deductions = (paye || 0) + (sha || 0) + (nssf || 0) + (housing_levy || 0) + (other_deductions || 0);
    const net_salary = basic_salary + (allowances || 0) - total_deductions;

    const result = await pool.query(`
      INSERT INTO payroll (
        pharmacy_id, user_id, employee_name, employee_email, role,
        month, year, basic_salary, allowances,
        paye, sha, nssf, housing_levy, other_deductions,
        net_salary, notes, created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      ON CONFLICT (pharmacy_id, user_id, month, year)
      DO UPDATE SET
        basic_salary=$8, allowances=$9,
        paye=$10, sha=$11, nssf=$12, housing_levy=$13, other_deductions=$14,
        net_salary=$15, notes=$16
      RETURNING *
    `, [
      pharmacy_id, user_id, employee_name, employee_email, role,
      month, year, basic_salary, allowances || 0,
      paye || 0, sha || 0, nssf || 0, housing_levy || 0, other_deductions || 0,
      net_salary, notes, created_by
    ]);
    return result.rows[0];
  }

  static async getPayroll({ pharmacy_id, month, year }) {
    let query = `
      SELECT p.*, u.full_name as created_by_name
      FROM payroll p
      LEFT JOIN users u ON p.created_by::text = u.id::text
      WHERE (p.pharmacy_id::text = $1::text OR p.pharmacy_id IS NULL)
    `;
    const params = [pharmacy_id];
    if (month) { params.push(month); query += ` AND p.month = $${params.length}`; }
    if (year) { params.push(year); query += ` AND p.year = $${params.length}`; }
    query += ` ORDER BY p.year DESC, p.month DESC, p.employee_name ASC`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async deletePayroll(id, pharmacy_id) {
    const result = await pool.query(`
      DELETE FROM payroll WHERE id::text = $1::text AND (pharmacy_id::text = $2::text OR pharmacy_id IS NULL) RETURNING id
    `, [id, pharmacy_id]);
    return result.rows[0];
  }

  // ─── CASH FLOW ──────────────────────────────────────────
  static async getCashFlow({ pharmacy_id, start_date, end_date }) {
    const sd = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const ed = end_date || new Date().toISOString().split('T')[0];

    const revenue = await pool.query(`
      SELECT COALESCE(SUM(total), 0) as total FROM sales
      WHERE (pharmacy_id::text=$1::text OR pharmacy_id IS NULL) AND DATE(created_at) BETWEEN $2 AND $3
    `, [pharmacy_id, sd, ed]);

    const billingRevenue = await pool.query(`
      SELECT COALESCE(SUM(total_price), 0) as total FROM billing_items
      WHERE (facility_id::text=$1::text OR facility_id IS NULL) AND status IN ('paid', 'insurance', 'nhif', 'sha') AND DATE(created_at) BETWEEN $2 AND $3
    `, [pharmacy_id, sd, ed]);

    const expenses = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total FROM expenses
      WHERE (pharmacy_id::text=$1::text OR pharmacy_id IS NULL) AND expense_date BETWEEN $2 AND $3
    `, [pharmacy_id, sd, ed]);

    const purchases = await pool.query(`
      SELECT COALESCE(SUM(total), 0) as total FROM purchase_orders
      WHERE (pharmacy_id::text=$1::text OR pharmacy_id IS NULL) AND DATE(created_at) BETWEEN $2 AND $3
    `, [pharmacy_id, sd, ed]);

    const rev = parseFloat(revenue.rows[0].total) + parseFloat(billingRevenue.rows[0].total);
    const exp = parseFloat(expenses.rows[0].total);
    const pur = parseFloat(purchases.rows[0].total);

    return {
      period: { start: sd, end: ed },
      revenue: rev,
      expenses: exp,
      purchases: pur,
      total_outflow: exp + pur,
      net_cashflow: rev - exp - pur
    };
  }

  // ─── PROFIT & LOSS ──────────────────────────────────────
  static async getProfitLoss({ pharmacy_id, start_date, end_date }) {
    const sd = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const ed = end_date || new Date().toISOString().split('T')[0];

    const sales = await pool.query(`
      SELECT
        (SELECT COALESCE(SUM(total), 0) FROM sales WHERE (pharmacy_id::text=$1::text OR pharmacy_id IS NULL) AND DATE(created_at) BETWEEN $2 AND $3) as revenue,
        COALESCE(SUM(si.quantity * COALESCE(p.buying_price, p.selling_price * 0.7, 0)), 0) as cogs
      FROM sale_items si
      LEFT JOIN products p ON si.product_id::text = p.id::text
      LEFT JOIN sales s ON si.sale_id::text = s.id::text
      WHERE (s.pharmacy_id::text=$1::text OR s.pharmacy_id IS NULL) AND DATE(s.created_at) BETWEEN $2 AND $3
    `, [pharmacy_id, sd, ed]);

    const billingRevenue = await pool.query(`
      SELECT COALESCE(SUM(total_price), 0) as total FROM billing_items
      WHERE (facility_id::text=$1::text OR facility_id IS NULL) AND status IN ('paid', 'insurance', 'nhif', 'sha') AND DATE(created_at) BETWEEN $2 AND $3
    `, [pharmacy_id, sd, ed]);

    const expenses = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total FROM expenses
      WHERE (pharmacy_id::text=$1::text OR pharmacy_id IS NULL) AND expense_date BETWEEN $2 AND $3
    `, [pharmacy_id, sd, ed]);

    const revenue = parseFloat(sales.rows[0].revenue) + parseFloat(billingRevenue.rows[0].total);
    const cogs = parseFloat(sales.rows[0].cogs);
    const grossProfit = revenue - cogs;
    const totalExpenses = parseFloat(expenses.rows[0].total);
    const netProfit = grossProfit - totalExpenses;

    return {
      period: { start: sd, end: ed },
      revenue,
      cogs,
      gross_profit: grossProfit,
      gross_margin: revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : 0,
      expenses: totalExpenses,
      net_profit: netProfit,
      net_margin: revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : 0
    };
  }
}

module.exports = FinanceModel;
