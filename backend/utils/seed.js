require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, connectDB } = require('../config/db');

const seed = async () => {
  await connectDB();

  const superEmail = process.env.SUPER_ADMIN_EMAIL || 'super@pharmapos.com';
  const superPassword = process.env.SUPER_ADMIN_PASSWORD;

  if (!superPassword) {
    console.error('❌ SUPER_ADMIN_PASSWORD must be set in .env');
    process.exit(1);
  }

  const salt = await bcrypt.genSalt(12);
  const superHash = await bcrypt.hash(superPassword, salt);

  await pool.query(`
    INSERT INTO super_admins (full_name, email, password)
    VALUES ($1, $2, $3)
    ON CONFLICT (email) DO NOTHING
  `, ['Super Admin', superEmail, superHash]);

  console.log('✅ Super admin created');
  console.log(`📧 Email: ${superEmail}`);

  if (process.env.CREATE_DEMO_PHARMACY === 'true') {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.error('❌ ADMIN_EMAIL and ADMIN_PASSWORD required for demo pharmacy');
      process.exit(1);
    }

    const pharResult = await pool.query(`
      INSERT INTO pharmacies (name, email, phone, address, city)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name
      RETURNING id
    `, ['Demo Pharmacy', 'demo@pharmacy.com', '+254700000000', 'Nairobi CBD', 'Nairobi']);

    const pharmacy_id = pharResult.rows[0].id;

    await pool.query(`
      INSERT INTO pharmacy_settings (pharmacy_id, receipt_header, receipt_footer)
      VALUES ($1, $2, $3)
      ON CONFLICT (pharmacy_id) DO NOTHING
    `, [pharmacy_id, 'Demo Pharmacy\nNairobi CBD\n+254700000000', 'Thank you for choosing Demo Pharmacy!']);

    await pool.query(`
      INSERT INTO subscriptions (pharmacy_id, plan, status, expires_at)
      VALUES ($1, 'trial', 'active', NOW() + INTERVAL '30 days')
      ON CONFLICT (pharmacy_id) DO NOTHING
    `, [pharmacy_id]);

    const adminHash = await bcrypt.hash(adminPassword, salt);
    await pool.query(`
      INSERT INTO users (full_name, email, password, role, pharmacy_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO NOTHING
    `, ['Pharmacy Admin', adminEmail, adminHash, 'admin', pharmacy_id]);

    await pool.query(`
      INSERT INTO counters (name, pharmacy_id)
      SELECT 'Counter 1', $1
      WHERE NOT EXISTS (
        SELECT 1 FROM counters WHERE pharmacy_id = $1
      )
    `, [pharmacy_id]);

    console.log('✅ Demo pharmacy created');
    console.log(`📧 Admin email: ${adminEmail}`);
  }

  process.exit(0);
};

seed().catch(err => { console.error('❌ Seed failed:', err.message); process.exit(1); });
