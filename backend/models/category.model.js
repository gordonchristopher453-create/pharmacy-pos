const { pool } = require('../config/db');

class CategoryModel {
  static async create({ name, description, pharmacy_id }) {
    const result = await pool.query(`
      INSERT INTO categories (name, description, pharmacy_id)
      VALUES ($1, $2, $3) RETURNING *
    `, [name, description, pharmacy_id]);
    return result.rows[0];
  }

  static async findAll(pharmacy_id) {
    const result = await pool.query(`
      SELECT * FROM categories WHERE pharmacy_id = $1 ORDER BY name ASC
    `, [pharmacy_id]);
    return result.rows;
  }

  static async findById(id, pharmacy_id) {
    const result = await pool.query(`SELECT * FROM categories WHERE id = $1 AND pharmacy_id = $2`, [id, pharmacy_id]);
    return result.rows[0];
  }

  static async update(id, pharmacy_id, { name, description }) {
    const result = await pool.query(`
      UPDATE categories SET name=$1, description=$2 WHERE id=$3 AND pharmacy_id=$4 RETURNING *
    `, [name, description, id, pharmacy_id]);
    return result.rows[0];
  }
}

module.exports = CategoryModel;
