const { pool } = require('../config/db');
const toNull = (val) => (val === '' || val === undefined) ? null : val;

class ProductModel {
  static async create({ name, generic_name, barcode, category_id, supplier_id, unit, selling_price, min_selling_price, max_selling_price, reorder_level, requires_prescription, pharmacy_id, department = "pharmacy" }) {
    const result = await pool.query(`
      INSERT INTO products (name, generic_name, barcode, category_id, supplier_id, unit, selling_price, min_selling_price, max_selling_price, reorder_level, requires_prescription, pharmacy_id, department)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [name, toNull(generic_name), toNull(barcode), toNull(category_id), toNull(supplier_id), unit, selling_price, min_selling_price || 0, max_selling_price || 0, reorder_level || 10, requires_prescription || false, pharmacy_id, department]);
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
      WHERE p.is_active = true AND ($1::text IS NULL OR p.pharmacy_id::text = $1::text)
    `;
    const params = [pharmacy_id];

    if (department) { params.push(department); query += ` AND p.department = $${params.length}`; }
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
      WHERE p.id::text = $1::text AND ($2::text IS NULL OR p.pharmacy_id::text = $2::text)
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
      WHERE p.barcode = $1 AND p.is_active = true AND ($2::text IS NULL OR p.pharmacy_id::text = $2::text)
      GROUP BY p.id, c.name
    `, [barcode, pharmacy_id]);
    return result.rows[0];
  }

  static async update(id, pharmacy_id, fields) {
    const { name, generic_name, barcode, category_id, supplier_id, unit, selling_price, min_selling_price, max_selling_price, reorder_level, requires_prescription, is_active } = fields;
    const result = await pool.query(`
      UPDATE products
      SET name=$1, generic_name=$2, barcode=$3, category_id=$4, supplier_id=$5,
          unit=$6, selling_price=$7, min_selling_price=$8, max_selling_price=$9,
          reorder_level=$10, requires_prescription=$11, is_active=$12, updated_at=NOW()
      WHERE id::text=$13::text AND ($14::text IS NULL OR pharmacy_id::text=$14::text)
      RETURNING *
    `, [name, toNull(generic_name), toNull(barcode), toNull(category_id), toNull(supplier_id), unit, selling_price, min_selling_price || 0, max_selling_price || 0, reorder_level, requires_prescription, is_active, id, pharmacy_id]);
    return result.rows[0];
  }

  static async delete(id, pharmacy_id) {
    const result = await pool.query(`
      UPDATE products
      SET is_active = false, updated_at = NOW()
      WHERE id::text = $1::text AND ($2::text IS NULL OR pharmacy_id::text = $2::text)
      RETURNING *
    `, [id, pharmacy_id]);
    return result.rows[0];
  }
}

module.exports = ProductModel;
