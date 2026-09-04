const SaleModel = require('../models/sale.model');
const StockModel = require('../models/stock.model');
const ProductModel = require('../models/product.model');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

const getDashboard = async (req, res) => {
  try {
    const pharmacy_id = req.user.is_super_admin
      ? (req.query.pharmacy_id || null)
      : req.pharmacy_id;
    const today = new Date().toISOString().split('T')[0];
    const [daily, topProducts, expiring] = await Promise.all([
      SaleModel.getDailySummary(today, pharmacy_id),
      SaleModel.getTopProducts(pharmacy_id, 5),
      StockModel.getExpiring(30, pharmacy_id)
    ]);
    return successResponse(res, 200, 'Dashboard fetched', {
      today: daily,
      top_products: topProducts,
      expiring_soon: expiring.length
    });
  } catch (error) {
    logger.error('Dashboard error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch dashboard');
  }
};

const getSalesReport = async (req, res) => {
  try {
    const { start_date, end_date, group_by } = req.query;
    const pharmacy_id = req.user.is_super_admin
      ? (req.query.pharmacy_id || null)
      : req.pharmacy_id;
    const [summary, topProducts, cashierPerf] = await Promise.all([
      SaleModel.getDailySummary(start_date || new Date().toISOString().split('T')[0], pharmacy_id),
      SaleModel.getTopProducts(pharmacy_id, 10, start_date, end_date),
      SaleModel.getCashierPerformance(pharmacy_id, start_date, end_date)
    ]);
    return successResponse(res, 200, 'Sales report fetched', {
      summary,
      top_products: topProducts,
      cashier_performance: cashierPerf
    });
  } catch (error) {
    logger.error('Sales report error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch sales report');
  }
};

const getMonthlyReport = async (req, res) => {
  try {
    const { year } = req.query;
    const pharmacy_id = req.user.is_super_admin
      ? (req.query.pharmacy_id || null)
      : req.pharmacy_id;
    const data = await SaleModel.getMonthlySummary(pharmacy_id, year);
    return successResponse(res, 200, 'Monthly report fetched', data);
  } catch (error) {
    logger.error('Monthly report error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch monthly report');
  }
};

const getStockReport = async (req, res) => {
  try {
    const { days } = req.query;
    const pharmacy_id = req.user.is_super_admin
      ? (req.query.pharmacy_id || null)
      : req.pharmacy_id;
    const [expiring, lowStock] = await Promise.all([
      StockModel.getExpiring(parseInt(days) || 30, pharmacy_id),
      ProductModel.findAll({ low_stock: true, pharmacy_id })
    ]);
    return successResponse(res, 200, 'Stock report fetched', {
      expiring_stock: expiring,
      low_stock_products: lowStock
    });
  } catch (error) {
    logger.error('Stock report error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch stock report');
  }
};

module.exports = { getDashboard, getSalesReport, getMonthlyReport, getStockReport };

const { pool } = require('../config/db');

const getDailySummaryReport = async (req, res) => {
  try {
    const pharmacy_id = req.pharmacy_id;
    const today = new Date().toISOString().split('T')[0];

    const userRole = (req.user?.role || '').toLowerCase();
    const userPerms = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
    const isAdminOrHR = [
      'super_admin', 'facility_admin', 'admin', 'hr', 'hr_manager', 'accountant'
    ].includes(userRole) ||
      userPerms.includes('can_view_financial_reports') ||
      userPerms.includes('can_view_revenue_reports') ||
      userPerms.includes('can_view_all_reports');

    let date_from = today;
    let date_to = today;
    if (isAdminOrHR) {
      date_from = req.query.date_from || req.query.start_date || req.query.date || today;
      date_to = req.query.date_to || req.query.end_date || req.query.date || date_from;
    } else {
      const singleDate = req.query.date || today;
      date_from = singleDate;
      date_to = singleDate;
    }

    const [visits, sales, labs, billing, billingBreakdown] = await Promise.all([
      pool.query(`
        SELECT v.*, p.full_name as patient_name, p.patient_number, p.gender, p.date_of_birth, p.phone
        FROM visits v JOIN patients p ON v.patient_id::text=p.id::text
        WHERE (v.pharmacy_id::text=$1::text OR v.pharmacy_id IS NULL) 
          AND DATE(v.visit_date) BETWEEN $2 AND $3 
        ORDER BY v.visit_date ASC
      `, [pharmacy_id, date_from, date_to]),
      pool.query(`
        SELECT COALESCE(SUM(total_amount),0) as total_sales, COUNT(*) as total_transactions,
               COALESCE(SUM(CASE WHEN payment_method='mpesa' THEN total_amount ELSE 0 END),0) as mpesa,
               COALESCE(SUM(CASE WHEN payment_method='cash' THEN total_amount ELSE 0 END),0) as cash
        FROM sales 
        WHERE (pharmacy_id::text=$1::text OR pharmacy_id IS NULL) 
          AND DATE(created_at) BETWEEN $2 AND $3
      `, [pharmacy_id, date_from, date_to]),
      pool.query(`
        SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='Completed') as completed
        FROM lab_requests 
        WHERE (pharmacy_id::text=$1::text OR pharmacy_id IS NULL) 
          AND DATE(created_at) BETWEEN $2 AND $3
      `, [pharmacy_id, date_from, date_to]),
      pool.query(`
        SELECT 
          COUNT(*) AS total_items,
          COALESCE(SUM(total_price),0) AS total_billed,
          COALESCE(SUM(CASE 
            WHEN status IN ('paid', 'insurance', 'nhif', 'sha', 'corporate') THEN COALESCE(paid_amount, total_price)
            WHEN status = 'partial' THEN COALESCE(paid_amount, 0)
            ELSE 0 END), 0) AS total_collected,
          COALESCE(SUM(CASE 
            WHEN status='pending' THEN total_price
            WHEN status='partial' THEN (total_price - COALESCE(paid_amount, 0))
            ELSE 0 END), 0) AS total_pending,
          COALESCE(SUM(total_price) FILTER (WHERE status='waived'),0) AS total_waived,
          COALESCE(SUM(CASE WHEN LOWER(payment_method)='cash' AND status IN ('paid','partial') THEN COALESCE(paid_amount, total_price) ELSE 0 END), 0) AS cash_collected,
          COALESCE(SUM(CASE WHEN LOWER(payment_method)='mpesa' AND status IN ('paid','partial') THEN COALESCE(paid_amount, total_price) ELSE 0 END), 0) AS mpesa_collected,
          COALESCE(SUM(CASE WHEN LOWER(payment_method) IN ('insurance','nhif','sha') OR status IN ('insurance','nhif','sha') THEN COALESCE(paid_amount, total_price) ELSE 0 END), 0) AS insurance_collected,
          COALESCE(SUM(CASE WHEN LOWER(payment_method)='bank' AND status IN ('paid','partial') THEN COALESCE(paid_amount, total_price) ELSE 0 END), 0) AS bank_collected
        FROM billing_items 
        WHERE (facility_id::text=$1::text OR pharmacy_id::text=$1::text OR (facility_id IS NULL AND pharmacy_id IS NULL)) 
          AND (
            (DATE(created_at) BETWEEN $2 AND $3)
            OR (paid_at IS NOT NULL AND DATE(paid_at) BETWEEN $2 AND $3)
          )
      `, [pharmacy_id, date_from, date_to]).catch(() => ({ rows: [{ total_collected: 0, total_billed: 0, total_pending: 0 }] })),
      pool.query(`
        SELECT 
          COALESCE(LOWER(payment_method), 'cash') AS payment_method,
          COUNT(*) AS count,
          COALESCE(SUM(CASE 
            WHEN status IN ('paid', 'insurance', 'nhif', 'sha', 'corporate') THEN COALESCE(paid_amount, total_price)
            WHEN status = 'partial' THEN COALESCE(paid_amount, 0)
            ELSE 0 END), 0) AS amount
        FROM billing_items
        WHERE (facility_id::text=$1::text OR pharmacy_id::text=$1::text OR (facility_id IS NULL AND pharmacy_id IS NULL))
          AND (
            (DATE(created_at) BETWEEN $2 AND $3)
            OR (paid_at IS NOT NULL AND DATE(paid_at) BETWEEN $2 AND $3)
          )
          AND (status IN ('paid', 'insurance', 'nhif', 'sha', 'corporate') OR (status='partial' AND paid_amount > 0))
        GROUP BY COALESCE(LOWER(payment_method), 'cash')
        ORDER BY amount DESC
      `, [pharmacy_id, date_from, date_to]).catch(() => ({ rows: [] }))
    ]);
    const pharmacy = await pool.query(`SELECT name, address, phone FROM pharmacies WHERE id::text=$1::text`, [pharmacy_id]);
    return successResponse(res, 200, 'Daily summary fetched', {
      date: date_from,
      date_from,
      date_to,
      is_daily: date_from === date_to,
      can_filter_dates: isAdminOrHR,
      user_role: req.user?.role,
      pharmacy: pharmacy.rows[0] || {},
      visits: visits.rows,
      sales_summary: sales.rows[0],
      lab_summary: labs.rows[0],
      billing_summary: billing.rows[0],
      by_method: billingBreakdown.rows || [],
    });
  } catch (e) { return errorResponse(res, 500, e.message); }
};

const getPatientHistory = async (req, res) => {
  try {
    const { patient_id } = req.params;
    const pharmacy_id = req.pharmacy_id;
    const patient = await pool.query(`SELECT * FROM patients WHERE id::text=$1::text AND (pharmacy_id::text=$2::text OR pharmacy_id IS NULL)`, [patient_id, pharmacy_id]);
    if (!patient.rows[0]) return errorResponse(res, 404, 'Patient not found');
    const [visits, labs, prescriptions, procedures, injections, nursingNotes] = await Promise.all([
      pool.query(`
        SELECT v.*, u.full_name as doctor_name
        FROM visits v LEFT JOIN users u ON v.created_by::text=u.id::text
        WHERE v.patient_id::text=$1::text AND (v.pharmacy_id::text=$2::text OR v.pharmacy_id IS NULL) ORDER BY v.visit_date DESC
      `, [patient_id, pharmacy_id]),
      pool.query(`
        SELECT lr.*, u.full_name as technician_name
        FROM lab_requests lr LEFT JOIN users u ON lr.requested_by::text=u.id::text
        WHERE lr.patient_id::text=$1::text AND (lr.pharmacy_id::text=$2::text OR lr.pharmacy_id IS NULL) ORDER BY lr.created_at DESC
      `, [patient_id, pharmacy_id]),
      pool.query(`
        SELECT pr.*, u.full_name as prescribed_by_name
        FROM prescriptions pr LEFT JOIN users u ON pr.doctor_id::text=u.id::text
        WHERE pr.patient_id::text=$1::text AND (pr.pharmacy_id::text=$2::text OR pr.pharmacy_id IS NULL) ORDER BY pr.created_at DESC
      `, [patient_id, pharmacy_id]).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT p.*, u.full_name as doctor_name
        FROM procedures p LEFT JOIN users u ON p.doctor_id::text=u.id::text
        WHERE p.patient_id::text=$1::text AND (p.pharmacy_id::text=$2::text OR p.pharmacy_id IS NULL) ORDER BY p.created_at DESC
      `, [patient_id, pharmacy_id]).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT iro.*, u1.full_name as prescribed_by_name, u2.full_name as administered_by_name
        FROM injection_room_orders iro
        LEFT JOIN users u1 ON iro.prescribed_by::text=u1.id::text
        LEFT JOIN users u2 ON iro.administered_by::text=u2.id::text
        WHERE iro.patient_id::text=$1::text AND (iro.pharmacy_id::text=$2::text OR iro.pharmacy_id IS NULL) ORDER BY iro.created_at DESC
      `, [patient_id, pharmacy_id]).catch(() => ({ rows: [] })),
      pool.query(`
        SELECT nn.*, u.full_name as nurse_name, w.name as ward_name
        FROM nursing_notes nn
        LEFT JOIN users u ON nn.nurse_id::text=u.id::text
        LEFT JOIN beds b ON nn.admission_id::text=b.id::text
        LEFT JOIN wards w ON b.ward_id::text=w.id::text
        WHERE nn.patient_id::text=$1::text AND (nn.pharmacy_id::text=$2::text OR nn.pharmacy_id IS NULL) ORDER BY nn.created_at DESC
      `, [patient_id, pharmacy_id]).catch(() => ({ rows: [] })),
    ]);
    return successResponse(res, 200, 'Patient history fetched', {
      patient: patient.rows[0],
      visits: visits.rows,
      lab_results: labs.rows,
      prescriptions: prescriptions.rows,
      procedures: procedures.rows,
      injections: injections.rows,
      nursing_notes: nursingNotes.rows,
    });
  } catch (e) { return errorResponse(res, 500, e.message); }
};

module.exports.getDailySummaryReport = getDailySummaryReport;
module.exports.getPatientHistory = getPatientHistory;

// ── Hospital Profit Report ────────────────────────────────
const getProfitReport = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to   = date_to   || from;
    const pid  = req.pharmacy_id;

    const [revenue, expenses] = await Promise.all([
      pool.query(`
        SELECT COALESCE(SUM(total_price) FILTER (WHERE status='paid'),0) AS total_revenue
        FROM billing_items WHERE (facility_id::text=$1::text OR facility_id IS NULL) AND DATE(created_at) BETWEEN $2 AND $3
      `, [pid, from, to]),
      pool.query(`
        SELECT COALESCE(SUM(amount),0) AS total_expenses
        FROM expenses WHERE (pharmacy_id::text=$1::text OR pharmacy_id IS NULL) AND DATE(expense_date) BETWEEN $2 AND $3
      `, [pid, from, to])
    ]);

    return successResponse(res, 200, 'Profit report', {
      period: { from, to },
      revenue: parseFloat(revenue.rows[0].total_revenue || 0),
      expenses: parseFloat(expenses.rows[0].total_expenses || 0),
      profit: parseFloat(revenue.rows[0].total_revenue || 0) - parseFloat(expenses.rows[0].total_expenses || 0)
    });
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── Sales Summary Report ─────────────────────────────────
const getSalesSummary = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to   = date_to   || from;
    const pid  = req.pharmacy_id;
    const result = await pool.query(`
      SELECT item_type, COUNT(*) AS count, SUM(total_price) AS total,
        SUM(CASE WHEN status='paid' THEN total_price ELSE 0 END) AS collected
      FROM billing_items WHERE (facility_id::text=$1::text OR facility_id IS NULL) AND DATE(created_at) BETWEEN $2 AND $3
      GROUP BY item_type ORDER BY total DESC
    `, [pid, from, to]);
    return successResponse(res, 200, 'Sales summary', { period: { from, to }, breakdown: result.rows });
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── Lab Sales Summary Report ─────────────────────────────
const getLabSalesSummary = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to   = date_to   || from;
    const pid  = req.pharmacy_id;
    const result = await pool.query(`
      SELECT 
        COALESCE(lr.test_name, bi.item_name) AS test_name,
        COUNT(*) AS count,
        COALESCE(SUM(bi.total_price), 0) AS total,
        COALESCE(SUM(CASE WHEN bi.status = 'paid' THEN bi.total_price ELSE 0 END), 0) AS collected
      FROM billing_items bi
      LEFT JOIN lab_requests lr ON (
        (bi.service_order_id IS NOT NULL AND bi.service_order_id::text = lr.service_order_id::text)
        OR (bi.visit_id::text = lr.visit_id::text AND LOWER(TRIM(bi.item_name)) = LOWER(TRIM(lr.test_name)))
      )
      WHERE (bi.facility_id::text = $1::text OR bi.facility_id IS NULL)
        AND LOWER(bi.item_type) IN ('lab', 'laboratory')
        AND DATE(bi.created_at) BETWEEN $2 AND $3
      GROUP BY COALESCE(lr.test_name, bi.item_name)
      ORDER BY total DESC
    `, [pid, from, to]);
    return successResponse(res, 200, 'Lab sales summary', { period: { from, to }, breakdown: result.rows });
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── Drug Sales Summary Report ─────────────────────────────────
const getDrugSalesSummary = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
    const to   = date_to   || new Date().toISOString().split('T')[0];
    const pid  = req.pharmacy_id;

    // Direct POS Sales summary
    const posSalesRes = await pool.query(`
      SELECT 
        COUNT(DISTINCT s.id) AS total_orders,
        COALESCE(SUM(s.total), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN s.payment_method = 'cash' THEN s.total ELSE 0 END), 0) AS cash_revenue,
        COALESCE(SUM(CASE WHEN s.payment_method = 'mpesa' THEN s.total ELSE 0 END), 0) AS mpesa_revenue,
        COALESCE(SUM(CASE WHEN s.payment_method = 'card' THEN s.total ELSE 0 END), 0) AS card_revenue,
        COALESCE(SUM(CASE WHEN s.payment_method = 'insurance' THEN s.total ELSE 0 END), 0) AS insurance_revenue,
        COALESCE(SUM(si.quantity), 0) AS total_units_sold,
        COALESCE(SUM(si.total_price - (si.quantity * COALESCE(p.buying_price, 0))), 0) AS estimated_profit
      FROM sales s
      LEFT JOIN sale_items si ON s.id::text = si.sale_id::text
      LEFT JOIN products p ON si.product_id::text = p.id::text
      WHERE (s.pharmacy_id::text = $1::text OR s.pharmacy_id IS NULL) AND DATE(s.created_at) BETWEEN $2 AND $3
    `, [pid, from, to]);

    // Prescription / OPD drug sales summary from billing items
    const rxSalesRes = await pool.query(`
      SELECT 
        COALESCE(SUM(total_price), 0) AS total_rx_billed,
        COALESCE(SUM(CASE WHEN status='paid' THEN total_price ELSE 0 END), 0) AS total_rx_collected,
        COUNT(*) AS rx_count
      FROM billing_items
      WHERE (facility_id::text = $1::text OR facility_id IS NULL) AND item_type IN ('prescription', 'medication', 'drug', 'pharmacy') AND DATE(created_at) BETWEEN $2 AND $3
    `, [pid, from, to]);

    // Itemized drug sales performance
    const drugItemsRes = await pool.query(`
      SELECT 
        p.id AS product_id,
        p.name AS product_name,
        p.generic_name,
        p.unit,
        c.name AS category_name,
        p.buying_price,
        p.selling_price,
        COALESCE(SUM(si.quantity), 0) AS units_sold,
        COALESCE(SUM(si.total_price), 0) AS total_revenue,
        COALESCE(SUM(si.total_price - (si.quantity * COALESCE(p.buying_price, 0))), 0) AS profit
      FROM products p
      LEFT JOIN sale_items si ON p.id::text = si.product_id::text
      LEFT JOIN sales s ON si.sale_id::text = s.id::text AND DATE(s.created_at) BETWEEN $2 AND $3
      LEFT JOIN categories c ON p.category_id::text = c.id::text
      WHERE (p.pharmacy_id::text = $1::text OR p.pharmacy_id IS NULL) AND (p.department = 'pharmacy' OR p.department IS NULL)
      GROUP BY p.id, p.name, p.generic_name, p.unit, c.name, p.buying_price, p.selling_price
      ORDER BY total_revenue DESC, units_sold DESC
    `, [pid, from, to]);

    // Sales by drug category
    const categorySalesRes = await pool.query(`
      SELECT 
        COALESCE(c.name, 'General / Uncategorized') AS category_name,
        COUNT(DISTINCT p.id) AS unique_drugs,
        COALESCE(SUM(si.quantity), 0) AS units_sold,
        COALESCE(SUM(si.total_price), 0) AS total_revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id::text = s.id::text
      JOIN products p ON si.product_id::text = p.id::text
      LEFT JOIN categories c ON p.category_id::text = c.id::text
      WHERE (s.pharmacy_id::text = $1::text OR s.pharmacy_id IS NULL) AND DATE(s.created_at) BETWEEN $2 AND $3
      GROUP BY c.name
      ORDER BY total_revenue DESC
    `, [pid, from, to]);

    return successResponse(res, 200, 'Drug sales summary report', {
      period: { from, to },
      metrics: posSalesRes.rows[0] || {},
      prescription_metrics: rxSalesRes.rows[0] || {},
      items: drugItemsRes.rows,
      categories: categorySalesRes.rows
    });
  } catch (e) {
    logger.error('Drug sales summary report error:', e.message);
    return errorResponse(res, 500, 'Failed to generate drug sales summary: ' + e.message);
  }
};

module.exports.getProfitReport = getProfitReport;
module.exports.getSalesSummary = getSalesSummary;
module.exports.getLabSalesSummary = getLabSalesSummary;
module.exports.getDrugSalesSummary = getDrugSalesSummary;
