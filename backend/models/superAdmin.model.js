const { pool } = require('../config/db');

class SuperAdminModel {
  static async create({ full_name, email, password }) {
    const result = await pool.query(`
      INSERT INTO super_admins (full_name, email, password)
      VALUES ($1, $2, $3)
      RETURNING id, full_name, email, is_active, created_at
    `, [full_name, email, password]);
    return result.rows[0];
  }

  static async findByEmail(email) {
    const result = await pool.query(`
      SELECT * FROM super_admins WHERE email = $1 AND is_active = true
    `, [email]);
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(`
      SELECT id, full_name, email, is_active, last_login, created_at, password
      FROM super_admins WHERE id = $1
    `, [id]);
    return result.rows[0];
  }

  static async updatePassword(id, password) {
    await pool.query(`UPDATE super_admins SET password = $1, updated_at = NOW() WHERE id = $2`, [password, id]);
  }

  static async updateLastLogin(id) {
    await pool.query(`UPDATE super_admins SET last_login = NOW() WHERE id = $1`, [id]);
  }

  static async getPlatformStats() {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM pharmacies WHERE is_active=true) as active_pharmacies,
        (SELECT COUNT(*) FROM pharmacies) as total_pharmacies,
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COALESCE(SUM(total), 0) FROM sales WHERE DATE(created_at)=CURRENT_DATE) as today_revenue,
        (SELECT COUNT(*) FROM sales WHERE DATE(created_at)=CURRENT_DATE) as today_transactions,
        (SELECT COUNT(*) FROM subscriptions WHERE status='trial') as trial_pharmacies,
        (SELECT COUNT(*) FROM subscriptions WHERE status='active' AND plan!='trial') as paid_pharmacies
    `);
    return result.rows[0];
  }
}

module.exports = SuperAdminModel;
