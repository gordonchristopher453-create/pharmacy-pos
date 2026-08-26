const { pool } = require('../config/db');
const { sendExpiryWarningEmail } = require('./email');
const logger = require('./logger');

const checkExpiringSubscriptions = async () => {
  try {
    const result = await pool.query(`
      SELECT
        p.id as pharmacy_id, p.name as pharmacy_name,
        s.plan, s.expires_at,
        EXTRACT(DAY FROM (s.expires_at - NOW())) as days_left,
        u.full_name as admin_name, u.email as admin_email
      FROM subscriptions s
      JOIN pharmacies p ON s.pharmacy_id = p.id
      JOIN users u ON u.pharmacy_id = p.id AND u.role = 'admin'
      WHERE s.status = 'active'
        AND s.expires_at > NOW()
        AND EXTRACT(DAY FROM (s.expires_at - NOW())) IN (14, 7, 3, 1)
        AND p.is_active = true
    `);

    for (const row of result.rows) {
      const daysLeft = Math.ceil(row.days_left);
      await sendExpiryWarningEmail({
        pharmacyName: row.pharmacy_name,
        adminName: row.admin_name,
        adminEmail: row.admin_email,
        plan: row.plan,
        expiresAt: row.expires_at,
        daysLeft,
      });
    }

    await pool.query(`
      UPDATE subscriptions SET status = 'expired'
      WHERE status = 'active' AND expires_at < NOW()
    `);

    logger.info(`Expiry check complete. Processed ${result.rows.length} warning(s).`);
  } catch (error) {
    logger.error('Expiry checker error:', error.message);
  }
};

module.exports = { checkExpiringSubscriptions };
