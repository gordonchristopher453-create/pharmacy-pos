const { pool } = require('../config/db');

class SaleModel {
  static async generateReceiptNumber(pharmacy_id) {
    const date = new Date();
    const prefix = `RCP-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const result = await pool.query(`
      SELECT COUNT(*) as count FROM sales s WHERE receipt_number LIKE $1 AND ($2::text IS NULL OR s.pharmacy_id::text = $2::text)
    `, [`${prefix}%`, pharmacy_id]);
    const count = parseInt(result.rows[0].count) + 1;
    return `${prefix}-${String(count).padStart(4, '0')}`;
  }

  static async createSale({ counter_id, user_id, items, payment_method, discount, notes, mpesa_code, pharmacy_id }, client) {
    const db = client || pool;
    let subtotal = 0;
    for (const item of items) subtotal += item.unit_price * item.quantity;
    const discountAmount = parseFloat(discount) || 0;
    const total = Math.max(0, subtotal - discountAmount);
    const receipt_number = await SaleModel.generateReceiptNumber(pharmacy_id);

    const saleResult = await db.query(`
      INSERT INTO sales (receipt_number, counter_id, user_id, subtotal, discount, total, payment_method, notes, mpesa_code, pharmacy_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
    `, [receipt_number, counter_id, user_id, subtotal, discountAmount, total, payment_method, notes, mpesa_code, pharmacy_id]);

    const sale = saleResult.rows[0];
    for (const item of items) {
      await db.query(`
        INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price, pharmacy_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [sale.id, item.product_id, item.quantity, item.unit_price, item.unit_price * item.quantity, pharmacy_id]);
    }
    return sale;
  }

  static async findById(id, pharmacy_id) {
    const sale = await pool.query(`
      SELECT s.*, u.full_name as cashier_name, c.name as counter_name
      FROM sales s
      LEFT JOIN users u ON s.user_id::text = u.id::text
      LEFT JOIN counters c ON s.counter_id::text = c.id::text
      WHERE s.id::text = $1::text AND ($2::text IS NULL OR s.pharmacy_id::text = $2::text)
    `, [id, pharmacy_id]);
    if (!sale.rows[0]) return null;

    const items = await pool.query(`
      SELECT si.*, p.name as product_name, p.generic_name, p.unit, p.barcode
      FROM sale_items si
      JOIN products p ON si.product_id::text = p.id::text
      WHERE si.sale_id::text = $1::text AND ($2::text IS NULL OR si.pharmacy_id::text = $2::text)
    `, [id, pharmacy_id]);

    return { ...sale.rows[0], items: items.rows };
  }

  static async findAll({ start_date, end_date, user_id, payment_method, limit = 50, offset = 0, pharmacy_id } = {}) {
    let query = `
      SELECT s.*, u.full_name as cashier_name, c.name as counter_name,
        COUNT(*) OVER() as total_count
      FROM sales s
      LEFT JOIN users u ON s.user_id::text = u.id::text
      LEFT JOIN counters c ON s.counter_id::text = c.id::text
      WHERE ($1::text IS NULL OR s.pharmacy_id::text = $1::text)
    `;
    const params = [pharmacy_id];

    if (start_date) { params.push(start_date); query += ` AND s.created_at >= $${params.length}`; }
    if (end_date) { params.push(end_date + ' 23:59:59'); query += ` AND s.created_at <= $${params.length}`; }
    if (user_id) { params.push(user_id); query += ` AND s.user_id::text = $${params.length}::text`; }
    if (payment_method) { params.push(payment_method); query += ` AND s.payment_method = $${params.length}`; }

    query += ` ORDER BY s.created_at DESC`;
    params.push(limit); query += ` LIMIT $${params.length}`;
    params.push(offset); query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    const total_count = result.rows[0] ? parseInt(result.rows[0].total_count) : 0;
    return { data: result.rows, total_count, limit, offset };
  }

  static async getDailySummary(date, pharmacy_id) {
    const result = await pool.query(`
      SELECT
        COUNT(DISTINCT s.id) as total_transactions,
        COALESCE(SUM(s.total), 0) as total_revenue,
        COALESCE(SUM(s.discount), 0) as total_discounts,
        COALESCE(SUM(CASE WHEN s.payment_method = 'cash' THEN s.total ELSE 0 END), 0) as cash_total,
        COALESCE(SUM(CASE WHEN s.payment_method = 'mpesa' THEN s.total ELSE 0 END), 0) as mpesa_total,
        COALESCE(SUM(CASE WHEN s.payment_method = 'card' THEN s.total ELSE 0 END), 0) as card_total,
        COALESCE(SUM(CASE WHEN s.payment_method = 'insurance' THEN s.total ELSE 0 END), 0) as insurance_total,
        COALESCE(SUM(si.quantity * COALESCE(p.buying_price, 0)), 0) as total_cost,
        COALESCE(SUM(si.total_price - (si.quantity * COALESCE(p.buying_price, 0))), 0) as total_profit
      FROM sales s
      LEFT JOIN sale_items si ON s.id::text = si.sale_id::text
      LEFT JOIN products p ON si.product_id::text = p.id::text
      WHERE DATE(s.created_at) = $1 AND ($2::text IS NULL OR s.pharmacy_id::text = $2::text)
    `, [date, pharmacy_id]);
    return result.rows[0];
  }

  static async getTopProducts(pharmacy_id, limit = 10, start_date, end_date) {
    let query = `
      SELECT p.id, p.name, p.generic_name, p.unit,
        SUM(si.quantity) as total_sold,
        SUM(si.total_price) as total_revenue
      FROM sale_items si
      JOIN products p ON si.product_id::text = p.id::text
      JOIN sales s ON si.sale_id::text = s.id::text
      WHERE ($1::text IS NULL OR si.pharmacy_id::text = $1::text)
    `;
    const params = [pharmacy_id];
    if (start_date) { params.push(start_date); query += ` AND s.created_at >= $${params.length}`; }
    if (end_date) { params.push(end_date); query += ` AND s.created_at <= $${params.length}`; }
    query += ` GROUP BY p.id, p.name, p.generic_name, p.unit ORDER BY total_sold DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async getMonthlySummary(pharmacy_id, year) {
    const result = await pool.query(`
      SELECT
        EXTRACT(MONTH FROM created_at) as month,
        TO_CHAR(created_at, 'Mon') as month_name,
        COUNT(*) as total_transactions,
        COALESCE(SUM(total), 0) as total_revenue
      FROM sales
      WHERE ($1::text IS NULL OR pharmacy_id::text = $1::text)
        AND EXTRACT(YEAR FROM created_at) = $2
      GROUP BY EXTRACT(MONTH FROM created_at), TO_CHAR(created_at, 'Mon')
      ORDER BY month ASC
    `, [pharmacy_id, year || new Date().getFullYear()]);
    return result.rows;
  }

  static async getCashierPerformance(pharmacy_id, start_date, end_date) {
    let query = `
      SELECT u.id, u.full_name,
        COUNT(s.id) as total_sales,
        COALESCE(SUM(s.total), 0) as total_revenue,
        COALESCE(AVG(s.total), 0) as avg_sale_value
      FROM sales s
      JOIN users u ON s.user_id::text = u.id::text
      WHERE ($1::text IS NULL OR s.pharmacy_id::text = $1::text)
    `;
    const params = [pharmacy_id];
    if (start_date) { params.push(start_date); query += ` AND s.created_at >= $${params.length}`; }
    if (end_date) { params.push(end_date); query += ` AND s.created_at <= $${params.length}`; }
    query += ` GROUP BY u.id, u.full_name ORDER BY total_revenue DESC`;
    const result = await pool.query(query, params);
    return result.rows;
  }
}

module.exports = SaleModel;
