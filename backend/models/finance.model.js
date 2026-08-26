const { pool } = require('../config/db');

class FinanceModel {
  // ─── EXPENSES ───────────────────────────────────────────
  static async createExpense({ pharmacy_id, category, description, amount, expense_date, payee, payment_method, receipt_ref, recorded_by }) {
    const result = await pool.query(`
      INSERT INTO expenses (pharmacy_id, category, description, amount, expense_date, recorded_by)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [
      pharmacy_id,
      category,
      description + (payee ? ` (Payee: ${payee})` : '') + (payment_method ? ` [${payment_method}]` : ''),
      amount,
      expense_date || new Date().toISOString().split('T')[0],
      recorded_by
    ]);
    return result.rows[0];
  }

  static async getExpenses({ pharmacy_id, start_date, end_date, category }) {
    let query = `
      SELECT e.*, u.full_name as recorded_by_name
      FROM expenses e
      LEFT JOIN users u ON e.recorded_by::text = u.id::text
      WHERE ($1::text IS NULL OR e.pharmacy_id::text = $1::text)
    `;
    const params = [pharmacy_id];
    if (start_date) { params.push(start_date); query += ` AND e.expense_date >= $${params.length}`; }
    if (end_date) { params.push(end_date); query += ` AND e.expense_date <= $${params.length}`; }
    if (category && category !== 'all') { params.push(category); query += ` AND e.category = $${params.length}`; }
    query += ` ORDER BY e.expense_date DESC, e.id DESC`;
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
        COALESCE(SUM(amount) FILTER (WHERE category='operations' OR category='other'), 0) as other_total
      FROM expenses WHERE ($1::text IS NULL OR pharmacy_id::text = $1::text)
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
      DELETE FROM expenses WHERE id::text = $1::text AND ($2::text IS NULL OR pharmacy_id::text = $2::text) RETURNING id
    `, [id, pharmacy_id]);
    return result.rows[0];
  }

  // ─── PETTY CASH ─────────────────────────────────────────
  static async createPettyCashTransaction({ pharmacy_id, transaction_type, category, amount, description, payee_or_source, voucher_number, payment_method, receipt_ref, recorded_by, recorded_by_name }) {
    const result = await pool.query(`
      INSERT INTO petty_cash (
        pharmacy_id, transaction_type, category, amount, description,
        payee_or_source, voucher_number, payment_method, receipt_ref,
        recorded_by, recorded_by_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      pharmacy_id, transaction_type, category || 'general', parseFloat(amount),
      description, payee_or_source, voucher_number || `PC-${Date.now().toString().slice(-6)}`,
      payment_method || 'cash', receipt_ref, recorded_by, recorded_by_name
    ]);
    return result.rows[0];
  }

  static async getPettyCash({ pharmacy_id, start_date, end_date }) {
    let query = `
      SELECT * FROM petty_cash
      WHERE ($1::text IS NULL OR pharmacy_id::text = $1::text)
    `;
    const params = [pharmacy_id];
    if (start_date) { params.push(start_date); query += ` AND created_at >= $${params.length}`; }
    if (end_date) { params.push(end_date); query += ` AND created_at <= $${params.length}`; }
    query += ` ORDER BY created_at DESC`;
    const result = await pool.query(query, params);

    // Calculate balance
    const totals = await pool.query(`
      SELECT 
        COALESCE(SUM(amount) FILTER (WHERE transaction_type='inflow'), 0) as total_inflows,
        COALESCE(SUM(amount) FILTER (WHERE transaction_type='outflow'), 0) as total_outflows
      FROM petty_cash
      WHERE ($1::text IS NULL OR pharmacy_id::text = $1::text)
    `, [pharmacy_id]);

    const inflows = parseFloat(totals.rows[0]?.total_inflows || 0);
    const outflows = parseFloat(totals.rows[0]?.total_outflows || 0);

    return {
      transactions: result.rows,
      summary: {
        total_inflows: inflows,
        total_outflows: outflows,
        current_balance: inflows - outflows
      }
    };
  }

  static async deletePettyCash(id, pharmacy_id) {
    const result = await pool.query(`
      DELETE FROM petty_cash WHERE id::text = $1::text AND ($2::text IS NULL OR pharmacy_id::text = $2::text) RETURNING id
    `, [id, pharmacy_id]);
    return result.rows[0];
  }

  // ─── PAYROLL ────────────────────────────────────────────
  static calculateKenyanStatutory(basic, allowances = 0) {
    const gross = basic + allowances;
    if (gross <= 0) {
      return { gross: 0, paye: 0, sha: 0, nssf: 0, housing_levy: 0, total_deductions: 0, net_salary: 0 };
    }

    // NSSF Tier 1 & 2 approx (6% of gross, capped around 2,160 - 4,320)
    const nssf = Math.min(2160, Math.round(gross * 0.06));
    // SHA 2.75% of gross
    const sha = Math.round(gross * 0.0275);
    // Affordable Housing Levy 1.5% of gross
    const housing_levy = Math.round(gross * 0.015);

    // Taxable pay after allowable pension deduction (NSSF)
    const taxable = Math.max(0, gross - nssf);
    
    // Kenyan PAYE tax bands
    let gross_paye = 0;
    if (taxable <= 24000) {
      gross_paye = taxable * 0.10;
    } else if (taxable <= 32333) {
      gross_paye = (24000 * 0.10) + ((taxable - 24000) * 0.25);
    } else if (taxable <= 500000) {
      gross_paye = (24000 * 0.10) + ((32333 - 24000) * 0.25) + ((taxable - 32333) * 0.30);
    } else {
      gross_paye = (24000 * 0.10) + ((32333 - 24000) * 0.25) + ((500000 - 32333) * 0.30) + ((taxable - 500000) * 0.325);
    }

    // Personal Relief KES 2,400 per month
    const paye = Math.max(0, Math.round(gross_paye - 2400));
    const total_deductions = paye + sha + nssf + housing_levy;
    const net_salary = gross - total_deductions;

    return {
      gross,
      paye,
      sha,
      nssf,
      housing_levy,
      total_deductions,
      net_salary
    };
  }

  static async createPayroll({
    pharmacy_id, user_id, employee_name, employee_email, role,
    month, year, basic_salary, allowances,
    paye, sha, nssf, housing_levy, other_deductions,
    notes, created_by
  }) {
    const b = parseFloat(basic_salary || 0);
    const a = parseFloat(allowances || 0);
    const p = parseFloat(paye || 0);
    const s = parseFloat(sha || 0);
    const n = parseFloat(nssf || 0);
    const h = parseFloat(housing_levy || 0);
    const o = parseFloat(other_deductions || 0);
    const total_ded = p + s + n + h + o;
    const net = b + a - total_ded;

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
      pharmacy_id, user_id || null, employee_name, employee_email, role,
      month, year, b, a,
      p, s, n, h, o,
      net, notes, created_by
    ]);
    return result.rows[0];
  }

  static async generateBatchPayroll({ pharmacy_id, month, year, created_by }) {
    // 1. Fetch all active staff profiles or registered users
    let staffProfiles = [];
    try {
      const spRes = await pool.query(`
        SELECT sp.*, u.email as user_email, u.role as user_role
        FROM staff_profiles sp
        LEFT JOIN users u ON sp.user_id::text = u.id::text
        WHERE ($1::text IS NULL OR sp.pharmacy_id::text = $1::text) AND sp.status = 'active'
      `, [pharmacy_id]);
      staffProfiles = spRes.rows;
    } catch (e) {
      staffProfiles = [];
    }

    if (staffProfiles.length === 0) {
      // Fallback to users table
      const usersRes = await pool.query(`
        SELECT id, full_name, email, role
        FROM users
        WHERE ($1::text IS NULL OR pharmacy_id::text = $1::text) AND is_active = true
      `, [pharmacy_id]);

      staffProfiles = usersRes.rows.map(u => ({
        user_id: u.id,
        full_name: u.full_name,
        email: u.email,
        designation: u.role,
        basic_salary: 45000,
        house_allowance: 5000,
        transport_allowance: 3000,
        other_allowances: 0
      }));
    }

    const generated = [];
    for (const staff of staffProfiles) {
      const basic = parseFloat(staff.basic_salary || 40000);
      const allowances = parseFloat(staff.house_allowance || 0) + parseFloat(staff.transport_allowance || 0) + parseFloat(staff.other_allowances || 0);
      const statutory = this.calculateKenyanStatutory(basic, allowances);

      const record = await this.createPayroll({
        pharmacy_id,
        user_id: staff.user_id,
        employee_name: staff.full_name,
        employee_email: staff.email || staff.user_email,
        role: staff.designation || staff.department || 'Staff',
        month: parseInt(month),
        year: parseInt(year),
        basic_salary: basic,
        allowances,
        paye: statutory.paye,
        sha: statutory.sha,
        nssf: statutory.nssf,
        housing_levy: statutory.housing_levy,
        other_deductions: 0,
        notes: 'Auto-computed statutory payroll batch',
        created_by
      });
      generated.push(record);
    }

    return generated;
  }

  static async getPayroll({ pharmacy_id, month, year }) {
    let query = `
      SELECT p.*, u.full_name as created_by_name,
             sp.bank_name, sp.bank_account, sp.kra_pin, sp.nssf_number, sp.sha_number, sp.mpesa_number
      FROM payroll p
      LEFT JOIN users u ON p.created_by::text = u.id::text
      LEFT JOIN staff_profiles sp ON p.user_id::text = sp.user_id::text
      WHERE ($1::text IS NULL OR p.pharmacy_id::text = $1::text)
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
      DELETE FROM payroll WHERE id::text = $1::text AND ($2::text IS NULL OR pharmacy_id::text = $2::text) RETURNING id
    `, [id, pharmacy_id]);
    return result.rows[0];
  }

  // ─── CASH FLOW ──────────────────────────────────────────
  static async getCashFlow({ pharmacy_id, start_date, end_date }) {
    const sd = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const ed = end_date || new Date().toISOString().split('T')[0];

    // 1. Pharmacy Sales Revenue
    const salesRes = await pool.query(`
      SELECT 
        COALESCE(SUM(total), 0) as total,
        COALESCE(SUM(total) FILTER (WHERE payment_method ILIKE '%cash%'), 0) as cash_total,
        COALESCE(SUM(total) FILTER (WHERE payment_method ILIKE '%mpesa%' OR payment_method ILIKE '%m-pesa%'), 0) as mpesa_total,
        COALESCE(SUM(total) FILTER (WHERE payment_method ILIKE '%insurance%' OR payment_method ILIKE '%sha%' OR payment_method ILIKE '%nhif%'), 0) as insurance_total,
        COALESCE(SUM(total) FILTER (WHERE payment_method ILIKE '%card%'), 0) as card_total
      FROM sales
      WHERE ($1::text IS NULL OR pharmacy_id::text=$1::text) AND DATE(created_at) BETWEEN $2 AND $3
    `, [pharmacy_id, sd, ed]);

    // 2. Clinical Billing Revenue
    let billingRes = { rows: [{ total: 0, cash_total: 0, mpesa_total: 0, insurance_total: 0 }] };
    try {
      billingRes = await pool.query(`
        SELECT 
          COALESCE(SUM(total_price), 0) as total,
          COALESCE(SUM(total_price) FILTER (WHERE payment_method ILIKE '%cash%'), 0) as cash_total,
          COALESCE(SUM(total_price) FILTER (WHERE payment_method ILIKE '%mpesa%' OR payment_method ILIKE '%m-pesa%'), 0) as mpesa_total,
          COALESCE(SUM(total_price) FILTER (WHERE status IN ('insurance', 'nhif', 'sha') OR payment_method ILIKE '%insurance%'), 0) as insurance_total
        FROM billing_items
        WHERE ($1::text IS NULL OR facility_id::text=$1::text) AND status IN ('paid', 'insurance', 'nhif', 'sha') AND DATE(created_at) BETWEEN $2 AND $3
      `, [pharmacy_id, sd, ed]);
    } catch (e) {}

    // 3. Operating Expenses
    const expenses = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total FROM expenses
      WHERE ($1::text IS NULL OR pharmacy_id::text=$1::text) AND expense_date BETWEEN $2 AND $3
    `, [pharmacy_id, sd, ed]);

    // 4. Stock Purchases
    const purchases = await pool.query(`
      SELECT COALESCE(SUM(total), 0) as total FROM purchase_orders
      WHERE ($1::text IS NULL OR pharmacy_id::text=$1::text) AND DATE(created_at) BETWEEN $2 AND $3
    `, [pharmacy_id, sd, ed]);

    // 5. Payroll Salaries Outflow
    const payrollRes = await pool.query(`
      SELECT COALESCE(SUM(net_salary), 0) as total FROM payroll
      WHERE ($1::text IS NULL OR pharmacy_id::text=$1::text)
    `, [pharmacy_id]);

    const pharmacyRev = parseFloat(salesRes.rows[0]?.total || 0);
    const clinicalRev = parseFloat(billingRes.rows[0]?.total || 0);
    const totalRev = pharmacyRev + clinicalRev;

    const cashCollected = parseFloat(salesRes.rows[0]?.cash_total || 0) + parseFloat(billingRes.rows[0]?.cash_total || 0);
    const mpesaCollected = parseFloat(salesRes.rows[0]?.mpesa_total || 0) + parseFloat(billingRes.rows[0]?.mpesa_total || 0);
    const insurancePending = parseFloat(salesRes.rows[0]?.insurance_total || 0) + parseFloat(billingRes.rows[0]?.insurance_total || 0);
    const cardCollected = parseFloat(salesRes.rows[0]?.card_total || 0);

    const exp = parseFloat(expenses.rows[0]?.total || 0);
    const pur = parseFloat(purchases.rows[0]?.total || 0);
    const sal = parseFloat(payrollRes.rows[0]?.total || 0);

    const totalOutflow = exp + pur + sal;

    return {
      period: { start: sd, end: ed },
      revenue: totalRev,
      pharmacy_revenue: pharmacyRev,
      clinical_revenue: clinicalRev,
      channels: {
        cash: cashCollected,
        mpesa: mpesaCollected,
        insurance: insurancePending,
        card: cardCollected
      },
      expenses: exp,
      purchases: pur,
      payroll_salaries: sal,
      total_outflow: totalOutflow,
      net_cashflow: totalRev - totalOutflow
    };
  }

  // ─── PROFIT & LOSS ──────────────────────────────────────
  static async getProfitLoss({ pharmacy_id, start_date, end_date }) {
    const sd = start_date || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const ed = end_date || new Date().toISOString().split('T')[0];

    const sales = await pool.query(`
      SELECT
        (SELECT COALESCE(SUM(total), 0) FROM sales WHERE ($1::text IS NULL OR pharmacy_id::text=$1::text) AND DATE(created_at) BETWEEN $2 AND $3) as revenue,
        COALESCE(SUM(si.quantity * COALESCE(p.buying_price, p.selling_price * 0.7, 0)), 0) as cogs
      FROM sale_items si
      LEFT JOIN products p ON si.product_id::text = p.id::text
      LEFT JOIN sales s ON si.sale_id::text = s.id::text
      WHERE ($1::text IS NULL OR s.pharmacy_id::text=$1::text) AND DATE(s.created_at) BETWEEN $2 AND $3
    `, [pharmacy_id, sd, ed]);

    let billingRevenue = 0;
    try {
      const bRes = await pool.query(`
        SELECT COALESCE(SUM(total_price), 0) as total FROM billing_items
        WHERE ($1::text IS NULL OR facility_id::text=$1::text) AND status IN ('paid', 'insurance', 'nhif', 'sha') AND DATE(created_at) BETWEEN $2 AND $3
      `, [pharmacy_id, sd, ed]);
      billingRevenue = parseFloat(bRes.rows[0]?.total || 0);
    } catch (e) {}

    const expenses = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total FROM expenses
      WHERE ($1::text IS NULL OR pharmacy_id::text=$1::text) AND expense_date BETWEEN $2 AND $3
    `, [pharmacy_id, sd, ed]);

    const revenue = parseFloat(sales.rows[0]?.revenue || 0) + billingRevenue;
    const cogs = parseFloat(sales.rows[0]?.cogs || 0);
    const grossProfit = revenue - cogs;
    const totalExpenses = parseFloat(expenses.rows[0]?.total || 0);
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
