const { pool } = require('../config/db');

class SupplierModel {
  static async create({ name, phone, email, address, contact_person, payment_terms, lead_time_days, notes, pharmacy_id }) {
    const result = await pool.query(`
      INSERT INTO suppliers (name, phone, email, address, contact_person, payment_terms, lead_time_days, notes, pharmacy_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `, [name, phone, email, address, contact_person, payment_terms, lead_time_days, notes, pharmacy_id]);
    return result.rows[0];
  }

  static async findAll(pharmacy_id) {
    const result = await pool.query(`
      SELECT s.*,
        COUNT(po.id) as total_orders,
        COALESCE(SUM(po.total), 0) as total_purchased
      FROM suppliers s
      LEFT JOIN purchase_orders po ON s.id = po.supplier_id
      WHERE s.is_active = true AND s.pharmacy_id = $1
      GROUP BY s.id ORDER BY s.name ASC
    `, [pharmacy_id]);
    return result.rows;
  }

  static async findById(id, pharmacy_id) {
    const result = await pool.query(`SELECT * FROM suppliers WHERE id = $1 AND pharmacy_id = $2`, [id, pharmacy_id]);
    return result.rows[0];
  }

  static async update(id, pharmacy_id, fields) {
    const { name, phone, email, address, contact_person, payment_terms, lead_time_days, notes, is_active } = fields;
    const result = await pool.query(`
      UPDATE suppliers
      SET name=$1, phone=$2, email=$3, address=$4, contact_person=$5,
          payment_terms=$6, lead_time_days=$7, notes=$8, is_active=$9
      WHERE id=$10 AND pharmacy_id=$11 RETURNING *
    `, [name, phone, email, address, contact_person, payment_terms, lead_time_days, notes, is_active, id, pharmacy_id]);
    return result.rows[0];
  }
}

module.exports = SupplierModel;
