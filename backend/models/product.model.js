const { pool } = require('../config/db');

const toNull = (val) => (val === '' || val === undefined || val === null) ? null : val;
const toNum = (val, defaultVal = 0) => {
  if (val === '' || val === undefined || val === null) return defaultVal;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? defaultVal : parsed;
};
const toInt = (val, defaultVal = 10) => {
  if (val === '' || val === undefined || val === null) return defaultVal;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultVal : parsed;
};

class ProductModel {
  static async create({
    name,
    generic_name,
    barcode,
    category_id,
    supplier_id,
    unit,
    selling_price,
    buying_price,
    min_selling_price,
    max_selling_price,
    reorder_level,
    requires_prescription,
    pharmacy_id,
    department = "pharmacy"
  }) {
    const result = await pool.query(`
      INSERT INTO products (
        name, generic_name, barcode, category_id, supplier_id, unit,
        selling_price, buying_price, min_selling_price, max_selling_price,
        reorder_level, requires_prescription, pharmacy_id, department
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      (name || '').trim(),
      toNull(generic_name),
      toNull(barcode),
      toNull(category_id),
      toNull(supplier_id),
      unit || 'tablet',
      toNum(selling_price, 0),
      toNum(buying_price, 0),
      toNum(min_selling_price, 0),
      toNum(max_selling_price, 0),
      toInt(reorder_level, 10),
      Boolean(requires_prescription),
      pharmacy_id,
      department || 'pharmacy'
    ]);
    return result.rows[0];
  }

  static async findAll({ search, category_id, low_stock, pharmacy_id, department } = {}) {
    let query = `
      SELECT p.*,
        c.name as category_name, s.name as supplier_name,
        COALESCE(SUM(st.quantity), 0) as total_stock,
        MIN(st.expiry_date) as nearest_expiry
      FROM products p
      LEFT JOIN categories c ON p.category_id::text = c.id::text
      LEFT JOIN suppliers s ON p.supplier_id::text = s.id::text
      LEFT JOIN stock st ON p.id::text = st.product_id::text
      WHERE p.is_active = true AND (p.pharmacy_id::text = $1::text OR p.pharmacy_id IS NULL)
    `;
    const params = [pharmacy_id];

    if (department) {
      params.push(department);
      query += ` AND (p.department = $${params.length} OR p.department IS NULL)`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (p.name ILIKE $${params.length} OR p.generic_name ILIKE $${params.length} OR p.barcode ILIKE $${params.length})`;
    }
    if (category_id) {
      params.push(category_id);
      query += ` AND p.category_id::text = $${params.length}::text`;
    }

    query += ` GROUP BY p.id, c.name, s.name`;
    if (low_stock) query += ` HAVING COALESCE(SUM(st.quantity), 0) <= p.reorder_level`;
    query += ` ORDER BY p.name ASC`;

    const result = await pool.query(query, params);
    return result.rows;
  }

  static async findById(id, pharmacy_id) {
    const result = await pool.query(`
      SELECT p.*, c.name as category_name, s.name as supplier_name,
        COALESCE(SUM(st.quantity), 0) as total_stock,
        MIN(st.expiry_date) as nearest_expiry
      FROM products p
      LEFT JOIN categories c ON p.category_id::text = c.id::text
      LEFT JOIN suppliers s ON p.supplier_id::text = s.id::text
      LEFT JOIN stock st ON p.id::text = st.product_id::text
      WHERE p.id::text = $1::text AND (p.pharmacy_id::text = $2::text OR p.pharmacy_id IS NULL)
      GROUP BY p.id, c.name, s.name
    `, [id, pharmacy_id]);
    return result.rows[0];
  }

  static async findByBarcode(barcode, pharmacy_id) {
    const result = await pool.query(`
      SELECT p.*, c.name as category_name,
        COALESCE(SUM(st.quantity), 0) as total_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id::text = c.id::text
      LEFT JOIN stock st ON p.id::text = st.product_id::text
      WHERE p.barcode = $1 AND p.is_active = true AND (p.pharmacy_id::text = $2::text OR p.pharmacy_id IS NULL)
      GROUP BY p.id, c.name
    `, [barcode, pharmacy_id]);
    return result.rows[0];
  }

  static async update(id, pharmacy_id, fields) {
    const {
      name, generic_name, barcode, category_id, supplier_id, unit,
      selling_price, buying_price, min_selling_price, max_selling_price,
      reorder_level, requires_prescription, is_active
    } = fields;

    const result = await pool.query(`
      UPDATE products
      SET name=$1, generic_name=$2, barcode=$3, category_id=$4, supplier_id=$5,
          unit=$6, selling_price=$7, buying_price=$8, min_selling_price=$9, max_selling_price=$10,
          reorder_level=$11, requires_prescription=$12, is_active=COALESCE($13, is_active), updated_at=NOW()
      WHERE id::text=$14::text AND (pharmacy_id::text=$15::text OR pharmacy_id IS NULL)
      RETURNING *
    `, [
      (name || '').trim(),
      toNull(generic_name),
      toNull(barcode),
      toNull(category_id),
      toNull(supplier_id),
      unit || 'tablet',
      toNum(selling_price, 0),
      toNum(buying_price, 0),
      toNum(min_selling_price, 0),
      toNum(max_selling_price, 0),
      toInt(reorder_level, 10),
      Boolean(requires_prescription),
      is_active !== undefined ? Boolean(is_active) : null,
      id,
      pharmacy_id
    ]);
    return result.rows[0];
  }

  static async delete(id, pharmacy_id) {
    const result = await pool.query(`
      UPDATE products
      SET is_active = false, updated_at = NOW()
      WHERE id::text = $1::text AND (pharmacy_id::text = $2::text OR pharmacy_id IS NULL)
      RETURNING *
    `, [id, pharmacy_id]);
    return result.rows[0];
  }
}

module.exports = ProductModel;
