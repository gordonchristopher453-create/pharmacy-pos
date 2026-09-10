const { pool } = require('../config/db');
const { ROLE_PERMISSIONS } = require('../config/permissions');

class UserModel {
  static async create({ full_name, email, password, role, pharmacy_id, custom_permissions }) {
    const perms = custom_permissions || ROLE_PERMISSIONS[role] || [];
    const cleanEmail = email ? email.trim() : email;
    const result = await pool.query(`
      INSERT INTO users (full_name, email, password, role, pharmacy_id, permissions)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, full_name, email, role, is_active, pharmacy_id, permissions, created_at
    `, [full_name, cleanEmail, password, role, pharmacy_id, JSON.stringify(perms)]);
    return result.rows[0];
  }

  static async findByEmail(email, pharmacy_id = null) {
    let query = `SELECT * FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) AND is_active = true`;
    const params = [email ? email.trim() : ''];
    if (pharmacy_id) { params.push(pharmacy_id); query += ` AND pharmacy_id::text = $2::text`; }
    const result = await pool.query(query, params);
    return result.rows[0];
  }

  static async findByEmailGlobal(email) {
    const result = await pool.query(`SELECT * FROM users WHERE LOWER(TRIM(email)) = LOWER(TRIM($1)) AND is_active = true`, [email ? email.trim() : '']);
    return result.rows[0];
  }

  static async findById(id, pharmacy_id = null) {
    let query = `
      SELECT u.id, u.full_name, u.email, u.role, u.is_active, u.pharmacy_id,
             u.last_login, u.created_at, u.password, u.permissions,
             u.dha_license_number, u.professional_title
      FROM users u WHERE u.id = $1
    `;
    const params = [id];
    if (pharmacy_id) { params.push(pharmacy_id); query += ` AND u.pharmacy_id = $2`; }
    const result = await pool.query(query, params);
    return result.rows[0];
  }

  static async findAll(pharmacy_id) {
    const result = await pool.query(`
      SELECT id, full_name, email, role, is_active, last_login, created_at, permissions
      FROM users WHERE pharmacy_id = $1 ORDER BY created_at DESC
    `, [pharmacy_id]);
    return result.rows;
  }

  static async updateLastLogin(id) {
    await pool.query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [id]);
  }

  static async updateProfile(id, pharmacy_id, { full_name, dha_license_number, professional_title }) {
    const result = await pool.query(`
      UPDATE users SET full_name=$1, dha_license_number=$2, professional_title=$3, updated_at=NOW()
      WHERE id=$4 AND pharmacy_id=$5
      RETURNING id, full_name, email, role, is_active, dha_license_number, professional_title
    `, [full_name, dha_license_number, professional_title, id, pharmacy_id]);
    return result.rows[0];
  }

  static async update(id, pharmacy_id, { full_name, role, is_active, permissions }) {
    const permsToSave = permissions !== undefined
      ? permissions
      : (role ? (ROLE_PERMISSIONS[role] || []) : undefined);

    if (permsToSave !== undefined) {
      const result = await pool.query(`
        UPDATE users SET full_name=$1, role=$2, is_active=$3, permissions=$4, updated_at=NOW()
        WHERE id=$5 AND pharmacy_id=$6
        RETURNING id, full_name, email, role, is_active, permissions, updated_at
      `, [full_name, role, is_active, JSON.stringify(permsToSave), id, pharmacy_id]);
      return result.rows[0];
    } else {
      const result = await pool.query(`
        UPDATE users SET full_name=$1, role=$2, is_active=$3, updated_at=NOW()
        WHERE id=$4 AND pharmacy_id=$5
        RETURNING id, full_name, email, role, is_active, permissions, updated_at
      `, [full_name, role, is_active, id, pharmacy_id]);
      return result.rows[0];
    }
  }

  static async updatePermissions(id, pharmacy_id, permissions) {
    const result = await pool.query(`
      UPDATE users SET permissions=$1, updated_at=NOW()
      WHERE id=$2 AND pharmacy_id=$3
      RETURNING id, full_name, email, role, permissions, updated_at
    `, [JSON.stringify(permissions), id, pharmacy_id]);
    return result.rows[0];
  }

  static async updatePassword(id, pharmacy_id, password) {
    if (pharmacy_id) {
      await pool.query(`
        UPDATE users SET password=$1, updated_at=NOW() WHERE id=$2 AND pharmacy_id=$3
      `, [password, id, pharmacy_id]);
    } else {
      await pool.query(`
        UPDATE users SET password=$1, updated_at=NOW() WHERE id=$2
      `, [password, id]);
    }
  }

  static async saveRefreshToken(user_id, token, expires_at, pharmacy_id) {
    await pool.query(`
      INSERT INTO refresh_tokens (user_id, token, expires_at, pharmacy_id)
      VALUES ($1, $2, $3, $4)
    `, [user_id, token, expires_at, pharmacy_id]);
  }

  static async findRefreshToken(token) {
    const result = await pool.query(`
      SELECT rt.*, u.id as user_id, u.role, u.is_active, u.pharmacy_id, u.permissions
      FROM refresh_tokens rt
      JOIN users u ON rt.user_id = u.id
      WHERE rt.token = $1 AND rt.expires_at > NOW()
    `, [token]);
    return result.rows[0];
  }

  static async deleteRefreshToken(token) {
    await pool.query(`DELETE FROM refresh_tokens WHERE token = $1`, [token]);
  }

  static async deleteExpiredTokens() {
    await pool.query(`DELETE FROM refresh_tokens WHERE expires_at < NOW()`);
  }
}

module.exports = UserModel;
