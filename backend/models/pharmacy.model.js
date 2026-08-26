const { pool } = require('../config/db');

const DEFAULT_CATEGORIES = [
  { name: 'Antibiotics', description: 'Antibiotic medicines' },
  { name: 'Analgesics', description: 'Pain relief medicines' },
  { name: 'Antimalaria', description: 'Malaria treatment medicines' },
  { name: 'Antihistamines', description: 'Allergy medicines' },
  { name: 'Antifungals', description: 'Fungal infection treatments' },
  { name: 'Vitamins & Supplements', description: 'Vitamins and nutritional supplements' },
  { name: 'Antihypertensives', description: 'Blood pressure medicines' },
  { name: 'Antidiabetics', description: 'Diabetes management medicines' },
  { name: 'Gastrointestinal', description: 'Stomach and digestive medicines' },
  { name: 'Respiratory', description: 'Cough, cold and respiratory medicines' },
  { name: 'Dermatology', description: 'Skin care and treatment' },
  { name: 'Eye & Ear', description: 'Eye and ear drops and treatments' },
  { name: 'Surgical & Supplies', description: 'Medical supplies and surgical items' },
  { name: 'Family Planning', description: 'Contraceptives and family planning' },
  { name: 'IV Fluids', description: 'Intravenous fluids and infusions' },
];

class PharmacyModel {
  static async create({ name, email, phone, address, city, country, license_number, facility_type = 'hospital' }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create pharmacy
      const pharmacy = await client.query(`
        INSERT INTO pharmacies (name, email, phone, address, city, country, license_number, facility_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [name, email, phone, address, city, country || 'Kenya', license_number, facility_type]);

      const ph = pharmacy.rows[0];

      // Create default settings
      await client.query(`
        INSERT INTO pharmacy_settings (pharmacy_id, receipt_header)
        VALUES ($1, $2)
      `, [ph.id, `${name}\n${address || ''}\n${phone || ''}`]);

      // Create trial subscription
      await client.query(`
        INSERT INTO subscriptions (pharmacy_id, plan, status, expires_at)
        VALUES ($1, 'trial', 'active', NOW() + INTERVAL '30 days')
      `, [ph.id]);

      // Seed default categories
      for (const cat of DEFAULT_CATEGORIES) {
        await client.query(`
          INSERT INTO categories (name, description, pharmacy_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (name, pharmacy_id) DO NOTHING
        `, [cat.name, cat.description, ph.id]);
      }

      await client.query('COMMIT');
      return ph;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async findAll() {
    try {
      const pharmaciesRes = await pool.query(`SELECT * FROM pharmacies WHERE deleted_at IS NULL ORDER BY id DESC`);
      const pharmacies = pharmaciesRes.rows || [];

      if (pharmacies.length === 0) return [];

      let subscriptions = [];
      try {
        const subRes = await pool.query(`SELECT pharmacy_id, plan, status, expires_at FROM subscriptions ORDER BY id DESC`);
        subscriptions = subRes.rows || [];
      } catch (_) {}

      let users = [];
      try {
        const userRes = await pool.query(`SELECT id, full_name, email, role, pharmacy_id FROM users WHERE is_active = true`);
        users = userRes.rows || [];
      } catch (_) {}

      return pharmacies.map(p => {
        const pSub = subscriptions.find(s => String(s.pharmacy_id) === String(p.id)) || {};
        const pUsers = users.filter(u => String(u.pharmacy_id) === String(p.id));
        const pAdmin = pUsers.find(u => u.role === 'facility_admin' || u.role === 'admin') || {};

        return {
          ...p,
          country: p.country || 'Kenya',
          facility_type: p.facility_type || 'hospital',
          is_active: p.is_active !== false,
          created_at: p.created_at || new Date().toISOString(),
          updated_at: p.updated_at || new Date().toISOString(),
          plan: pSub.plan || 'trial',
          subscription_status: pSub.status || 'active',
          expires_at: pSub.expires_at || null,
          user_count: pUsers.length > 0 ? pUsers.length : 1,
          admin_email: pAdmin.email || p.email,
          admin_name: pAdmin.full_name || 'Admin',
          admin_user_id: pAdmin.id || null
        };
      });
    } catch (err) {
      console.error('PharmacyModel.findAll query error, running fallback:', err.message);
      const fallback = await pool.query(`SELECT * FROM pharmacies WHERE deleted_at IS NULL ORDER BY id DESC`);
      return (fallback.rows || []).map(p => ({
        ...p,
        plan: 'trial',
        subscription_status: 'active',
        admin_email: p.email,
        admin_name: 'Admin',
        user_count: 1
      }));
    }
  }

  static async findById(id) {
    const result = await pool.query(`
      SELECT p.*,
        s.plan, s.status as subscription_status, s.expires_at, s.max_users, s.max_counters,
        ps.receipt_header, ps.receipt_footer, ps.receipt_show_logo, ps.receipt_show_address,
        ps.mpesa_till_number, ps.mpesa_paybill, ps.mpesa_account_name,
        ps.bank_name, ps.bank_account, ps.bank_branch,
        ps.currency, ps.tax_rate, ps.tax_name,
        ps.low_stock_alert_days, ps.expiry_alert_days
      FROM pharmacies p
      LEFT JOIN subscriptions s ON p.id = s.pharmacy_id
      LEFT JOIN pharmacy_settings ps ON p.id = ps.pharmacy_id
      WHERE p.id = $1
    `, [id]);
    return result.rows[0];
  }

  static async findByEmail(email) {
    const result = await pool.query(`SELECT * FROM pharmacies WHERE email = $1`, [email]);
    return result.rows[0];
  }

  static async update(id, fields) {
    const { name, phone, address, city, country, license_number, is_active, logo_url, facility_type } = fields;
    const result = await pool.query(`
      UPDATE pharmacies
      SET name = COALESCE($1, name),
          phone = COALESCE($2, phone),
          address = COALESCE($3, address),
          city = COALESCE($4, city),
          country = COALESCE($5, country),
          license_number = COALESCE($6, license_number),
          is_active = COALESCE($7, is_active),
          logo_url = COALESCE($8, logo_url),
          facility_type = COALESCE($9, facility_type),
          updated_at = NOW()
      WHERE id = $10 RETURNING *
    `, [name, phone, address, city, country, license_number, is_active, logo_url, facility_type, id]);
    return result.rows[0];
  }

  static async updateSettings(pharmacy_id, settings) {
    const {
      receipt_header, receipt_footer, receipt_show_logo, receipt_show_address,
      mpesa_till_number, mpesa_paybill, mpesa_account_name,
      bank_name, bank_account, bank_branch,
      currency, tax_rate, tax_name, low_stock_alert_days, expiry_alert_days
    } = settings;

    const result = await pool.query(`
      UPDATE pharmacy_settings
      SET receipt_header=$1, receipt_footer=$2, receipt_show_logo=$3, receipt_show_address=$4,
          mpesa_till_number=$5, mpesa_paybill=$6, mpesa_account_name=$7,
          bank_name=$8, bank_account=$9, bank_branch=$10,
          currency=$11, tax_rate=$12, tax_name=$13,
          low_stock_alert_days=$14, expiry_alert_days=$15, updated_at=NOW()
      WHERE pharmacy_id=$16
      RETURNING *
    `, [receipt_header, receipt_footer, receipt_show_logo, receipt_show_address,
        mpesa_till_number, mpesa_paybill, mpesa_account_name,
        bank_name, bank_account, bank_branch,
        currency, tax_rate, tax_name, low_stock_alert_days, expiry_alert_days, pharmacy_id]);
    return result.rows[0];
  }

  static async updateSubscription(pharmacy_id, { plan, status, expires_at, max_users, max_counters, notes }) {
    const result = await pool.query(`
      UPDATE subscriptions
      SET plan=$1, status=$2, expires_at=$3, max_users=$4, max_counters=$5, notes=$6
      WHERE pharmacy_id=$7 RETURNING *
    `, [plan, status, expires_at, max_users, max_counters, notes, pharmacy_id]);
    return result.rows[0];
  }

  static async getStats(pharmacy_id) {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE pharmacy_id=$1 AND is_active=true) as active_users,
        (SELECT COUNT(*) FROM products WHERE pharmacy_id=$1 AND is_active=true) as total_products,
        (SELECT COALESCE(SUM(total), 0) FROM sales WHERE pharmacy_id=$1 AND DATE(created_at)=CURRENT_DATE) as today_revenue,
        (SELECT COUNT(*) FROM sales WHERE pharmacy_id=$1 AND DATE(created_at)=CURRENT_DATE) as today_sales
    `, [pharmacy_id]);
    return result.rows[0];
  }
}

module.exports = PharmacyModel;
