const { Pool } = require('pg');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { AsyncLocalStorage } = require('async_hooks');

const tenantStorage = new AsyncLocalStorage();

let pool;
let isInMemory = false;

if (process.env.DATABASE_URL) {
  logger.info('Initializing real PostgreSQL Pool with DATABASE_URL');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000 // 10 seconds connection timeout
  });
} else {
  logger.warn('DATABASE_URL is not set. Falling back to pg-mem in-memory PostgreSQL emulator.');
  isInMemory = true;
  
  try {
    const { newDb } = require('pg-mem');
    const db = newDb({ noAstCoverageCheck: true });
    
    // Register uuid and other missing pg extensions/functions in pg-mem
    db.public.registerFunction({
      name: 'gen_random_uuid',
      returns: db.public.getType('uuid'),
      implementation: () => require('crypto').randomUUID(),
    });

    db.public.registerFunction({
      name: 'now',
      returns: db.public.getType('timestamp with time zone'),
      implementation: () => new Date(),
    });

    // Create standard PG Pool adapter from pg-mem
    const PgPool = db.adapters.createPg().Pool;
    pool = new PgPool();
    
    // Attach database reference to pool for custom migration/seeding
    pool.dbInstance = db;
  } catch (err) {
    logger.error('Failed to initialize pg-mem, using basic mock Pool:', err.message);
    // Ultimate fallback to prevent server crashes
    pool = {
      query: async (sql, params) => {
        logger.info(`[MOCK DB QUERY]: ${sql} | Params: ${JSON.stringify(params)}`);
        return { rows: [], rowCount: 0 };
      },
      connect: async () => ({
        query: async (sql, params) => {
          logger.info(`[MOCK DB CLIENT QUERY]: ${sql} | Params: ${JSON.stringify(params)}`);
          return { rows: [], rowCount: 0 };
        },
        release: () => {}
      }),
      on: () => {}
    };
  }
}

// Attach listeners
if (pool.on) {
  pool.on('connect', () => {
    logger.info('PostgreSQL client connected');
  });

  pool.on('error', (err) => {
    logger.error('PostgreSQL pool error:', err.message);
  });
}

const connectDB = async () => {
  try {
    if (isInMemory) {
      logger.info('Initializing in-memory database schema...');
      await runMigrationsAndSeed(pool);
      logger.info('✅ In-memory PostgreSQL database fully initialized and seeded.');
      return;
    }

    logger.info(`Connecting with DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    logger.info(`✅ PostgreSQL Connected: ${result.rows[0].now}`);

    logger.info('Initializing real database schema and seed data...');
    await runMigrationsAndSeed(pool);
    logger.info('✅ Real PostgreSQL database schema migrated and seeded.');
  } catch (error) {
    logger.error(`❌ PostgreSQL connection failed: ${error.message}`);
    logger.warn('⚠️ Falling back to in-memory mode for this session.');
    isInMemory = true;
    try {
      const { newDb } = require('pg-mem');
      const db = newDb({ noAstCoverageCheck: true });
      db.public.registerFunction({
        name: 'gen_random_uuid',
        returns: db.public.getType('uuid'),
        implementation: () => require('crypto').randomUUID(),
      });
      db.public.registerFunction({
        name: 'now',
        returns: db.public.getType('timestamp with time zone'),
        implementation: () => new Date(),
      });
      const PgPool = db.adapters.createPg().Pool;
      pool = new PgPool();
      pool.dbInstance = db;
      await runMigrationsAndSeed(pool);
      logger.info('✅ In-memory PostgreSQL database initialized after connection failure.');
    } catch (fallbackErr) {
      logger.error('Fallback in-memory database setup failed:', fallbackErr.message);
      // Ensure we do not crash
    }
  }
};

async function runMigrationsAndSeed(p) {
  try {
    // 1. Create base tables
    await p.query(`
      CREATE TABLE IF NOT EXISTS pharmacies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        address TEXT,
        city VARCHAR(100),
        country VARCHAR(100),
        email VARCHAR(255),
        logo_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        pharmacy_id INT,
        permissions JSONB DEFAULT '[]',
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id SERIAL PRIMARY KEY,
        user_id INT,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        pharmacy_id INT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id SERIAL PRIMARY KEY,
        pharmacy_id INT,
        patient_number VARCHAR(100),
        full_name VARCHAR(255) NOT NULL,
        date_of_birth DATE,
        gender VARCHAR(20),
        national_id TEXT,
        sha_number TEXT,
        phone VARCHAR(50),
        email VARCHAR(255),
        address TEXT,
        county VARCHAR(100),
        next_of_kin_name VARCHAR(255),
        next_of_kin_phone VARCHAR(50),
        next_of_kin_relation VARCHAR(100),
        blood_group VARCHAR(20),
        allergies TEXT,
        chronic_conditions TEXT,
        occupation VARCHAR(100),
        marital_status VARCHAR(50),
        emirates_id VARCHAR(100),
        nabidh_consent VARCHAR(20) DEFAULT 'opt_out',
        passport_number VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        generic_name VARCHAR(255),
        barcode VARCHAR(100),
        category_id INT,
        supplier_id INT,
        unit VARCHAR(50) DEFAULT 'pcs',
        price DECIMAL(10,2) NOT NULL DEFAULT 0,
        selling_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        buying_price DECIMAL(10,2) DEFAULT 0,
        min_selling_price DECIMAL(10,2) DEFAULT 0,
        max_selling_price DECIMAL(10,2) DEFAULT 0,
        reorder_level INT DEFAULT 10,
        requires_prescription BOOLEAN DEFAULT FALSE,
        pharmacy_id INT,
        department VARCHAR(50) DEFAULT 'pharmacy',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS service_price_defaults (
        service_code VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        default_price DECIMAL(10,2) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE
      );
    `);

    await p.query(`
      CREATE TABLE IF NOT EXISTS service_prices (
        id SERIAL PRIMARY KEY,
        pharmacy_id INT,
        service_code VARCHAR(100),
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Read and run all migrate_*.sql files in the backend folder
    const backendDir = path.join(__dirname, '..');
    const files = fs.readdirSync(backendDir);
    const sqlFiles = files.filter(f => f.startsWith('migrate_') && f.endsWith('.sql'));
    
    // Sort to run key files first if necessary (e.g. roles_permissions adds permissions column to users)
    sqlFiles.sort((a, b) => {
      if (a.includes('roles_permissions')) return -1;
      if (b.includes('roles_permissions')) return 1;
      return a.localeCompare(b);
    });

    for (const sqlFile of sqlFiles) {
      const filePath = path.join(backendDir, sqlFile);
      logger.info(`Running migration: ${sqlFile}`);
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      
      // Execute the migration content. Splitting by semicolons can sometimes fail if there are functions/triggers, 
      // but for standard SQL schemas, running it in chunks or directly works. We will try executing it directly first.
      try {
        await p.query(sqlContent);
      } catch (sqlErr) {
        logger.warn(`Skipped some migration commands in ${sqlFile}: ${sqlErr.message}`);
      }
    }

    // Dynamic Schema Upgrades (Self-Healing)
    logger.info('Running dynamic schema upgrades for products, visits, injection_room_orders, billing_items, and wards...');
    
    // Ensure wards table exists
    try {
      await p.query(`
        CREATE TABLE IF NOT EXISTS wards (
          id SERIAL PRIMARY KEY,
          pharmacy_id INT,
          name VARCHAR(100) NOT NULL,
          ward_type VARCHAR(50) DEFAULT 'general',
          total_beds INT DEFAULT 10,
          daily_rate DECIMAL(10,2) DEFAULT 1000.00,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    } catch (e) {
      logger.error('Failed to create wards table:', e.message);
    }

    // Ensure beds table exists
    try {
      await p.query(`
        CREATE TABLE IF NOT EXISTS beds (
          id SERIAL PRIMARY KEY,
          pharmacy_id INT,
          ward_id INT,
          bed_number VARCHAR(50) NOT NULL,
          status VARCHAR(50) DEFAULT 'available',
          current_visit_id INT,
          current_patient_id INT,
          admitted_at TIMESTAMPTZ,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    } catch (e) {
      logger.error('Failed to create beds table:', e.message);
    }

    // Ensure nursing_notes table exists
    try {
      await p.query(`
        CREATE TABLE IF NOT EXISTS nursing_notes (
          id SERIAL PRIMARY KEY,
          pharmacy_id INT,
          admission_id INT,
          visit_id INT,
          patient_id INT,
          nurse_id INT,
          notes TEXT,
          note_type VARCHAR(50) DEFAULT 'general',
          vitals JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    } catch (e) {
      logger.error('Failed to create nursing_notes table:', e.message);
    }

    // Ensure doctor_round_notes table exists
    try {
      await p.query(`
        CREATE TABLE IF NOT EXISTS doctor_round_notes (
          id SERIAL PRIMARY KEY,
          pharmacy_id INT,
          admission_id INT,
          visit_id INT,
          patient_id INT,
          doctor_id INT,
          round_type VARCHAR(50) DEFAULT 'daily_round',
          clinical_notes TEXT,
          subjective TEXT,
          objective TEXT,
          assessment TEXT,
          plan TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    } catch (e) {
      logger.error('Failed to create doctor_round_notes table:', e.message);
    }

    // Ensure ward_transfers table exists
    try {
      await p.query(`
        CREATE TABLE IF NOT EXISTS ward_transfers (
          id SERIAL PRIMARY KEY,
          pharmacy_id INT,
          visit_id INT,
          patient_id INT,
          from_ward_id INT,
          from_bed_id INT,
          to_ward_id INT,
          to_bed_id INT,
          transferred_by INT,
          transfer_reason TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    } catch (e) {
      logger.error('Failed to create ward_transfers table:', e.message);
    }

    // Ensure encounters table exists
    try {
      await p.query(`
        CREATE TABLE IF NOT EXISTS encounters (
          id SERIAL PRIMARY KEY,
          pharmacy_id INT,
          visit_id INT NOT NULL,
          patient_id INT NOT NULL,
          encounter_number VARCHAR(100),
          department_id VARCHAR(100),
          clinic_id VARCHAR(100),
          doctor_id INT,
          status VARCHAR(50) DEFAULT 'IN_PROGRESS',
          current_step VARCHAR(100) DEFAULT 'consultation',
          started_at TIMESTAMPTZ DEFAULT NOW(),
          paused_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    } catch (e) {
      logger.error('Failed to create encounters table:', e.message);
    }

    // Ensure encounter_events table exists
    try {
      await p.query(`
        CREATE TABLE IF NOT EXISTS encounter_events (
          id SERIAL PRIMARY KEY,
          pharmacy_id INT,
          encounter_id INT NOT NULL,
          visit_id INT,
          patient_id INT,
          event_type VARCHAR(100) NOT NULL,
          actor_id INT,
          metadata JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    } catch (e) {
      logger.error('Failed to create encounter_events table:', e.message);
    }

    // Ensure special_clinics, clinic_referrals, clinic_queue tables exist & seed
    try {
      await p.query(`
        CREATE TABLE IF NOT EXISTS special_clinics (
          id SERIAL PRIMARY KEY,
          code VARCHAR(100) UNIQUE NOT NULL,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          consultation_fee NUMERIC(10,2) DEFAULT 0.00,
          working_days VARCHAR(255) DEFAULT 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
          appointment_duration INT DEFAULT 30,
          location VARCHAR(255) DEFAULT 'Main Clinic Building',
          head_doctor_id INT,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        ALTER TABLE special_clinics ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC(10,2) DEFAULT 0.00;
        ALTER TABLE special_clinics ADD COLUMN IF NOT EXISTS working_days VARCHAR(255) DEFAULT 'Mon,Tue,Wed,Thu,Fri,Sat,Sun';
        ALTER TABLE special_clinics ADD COLUMN IF NOT EXISTS appointment_duration INT DEFAULT 30;
        ALTER TABLE special_clinics ADD COLUMN IF NOT EXISTS location VARCHAR(255) DEFAULT 'Main Clinic Building';
        ALTER TABLE special_clinics ADD COLUMN IF NOT EXISTS head_doctor_id INT;
        ALTER TABLE special_clinics ADD COLUMN IF NOT EXISTS department VARCHAR(100) DEFAULT 'Special Clinic';
        ALTER TABLE special_clinics ADD COLUMN IF NOT EXISTS max_daily_patients INT DEFAULT 50;
        ALTER TABLE special_clinics ADD COLUMN IF NOT EXISTS queue_rules TEXT;
        ALTER TABLE special_clinics ADD COLUMN IF NOT EXISTS referral_rules TEXT;
        ALTER TABLE special_clinics ADD COLUMN IF NOT EXISTS default_lab_profile TEXT;
        ALTER TABLE special_clinics ADD COLUMN IF NOT EXISTS default_rad_profile TEXT;
        ALTER TABLE special_clinics ADD COLUMN IF NOT EXISTS default_billing_profile TEXT;
        ALTER TABLE special_clinics ADD COLUMN IF NOT EXISTS assigned_rooms TEXT;

        ALTER TABLE clinic_doctors ADD COLUMN IF NOT EXISTS staff_role VARCHAR(50) DEFAULT 'doctor';
        ALTER TABLE clinic_doctors ADD COLUMN IF NOT EXISTS assigned_room VARCHAR(100);

        ALTER TABLE clinic_referrals ADD COLUMN IF NOT EXISTS referral_outcome TEXT;
        ALTER TABLE clinic_referrals ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
        ALTER TABLE clinic_referrals ADD COLUMN IF NOT EXISTS from_encounter_id INT;

        ALTER TABLE encounters ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
        ALTER TABLE encounters ADD COLUMN IF NOT EXISTS referral_id INT;
        ALTER TABLE encounters ADD COLUMN IF NOT EXISTS outcome VARCHAR(100);

        CREATE TABLE IF NOT EXISTS admissions (
          id SERIAL PRIMARY KEY,
          pharmacy_id INT,
          visit_id INT NOT NULL,
          patient_id INT NOT NULL,
          encounter_id INT,
          ward_id INT,
          bed_id INT,
          admitting_doctor_id INT,
          admission_reason TEXT,
          admission_notes TEXT,
          status VARCHAR(50) DEFAULT 'admitted',
          admitted_at TIMESTAMPTZ DEFAULT NOW(),
          discharged_at TIMESTAMPTZ,
          discharge_reason TEXT,
          discharge_summary TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS inpatient_admissions (
          id SERIAL PRIMARY KEY,
          pharmacy_id INT,
          visit_id VARCHAR(150),
          patient_id VARCHAR(150),
          bed_id INT,
          ward_id INT,
          status VARCHAR(50) DEFAULT 'admitted',
          admission_notes TEXT,
          management_plan TEXT,
          admitted_at TIMESTAMPTZ DEFAULT NOW(),
          discharged_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS clinical_orders (
          id SERIAL PRIMARY KEY,
          uuid UUID DEFAULT gen_random_uuid(),
          order_number VARCHAR(100) UNIQUE NOT NULL,
          pharmacy_id INT,
          visit_id INT NOT NULL,
          encounter_id INT,
          patient_id INT NOT NULL,
          ordering_doctor_id INT,
          order_type VARCHAR(50) NOT NULL,
          order_details JSONB DEFAULT '{}',
          priority VARCHAR(20) DEFAULT 'ROUTINE',
          status VARCHAR(50) DEFAULT 'ORDERED',
          department VARCHAR(100),
          clinic_id INT,
          assigned_staff_id INT,
          performing_staff_id INT,
          verification_staff_id INT,
          verified_at TIMESTAMPTZ,
          release_staff_id INT,
          released_at TIMESTAMPTZ,
          review_doctor_id INT,
          reviewed_at TIMESTAMPTZ,
          review_comments TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS clinical_order_events (
          id SERIAL PRIMARY KEY,
          order_id INT NOT NULL,
          actor_id INT,
          from_status VARCHAR(50),
          to_status VARCHAR(50),
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS cds_alert_logs (
          id SERIAL PRIMARY KEY,
          pharmacy_id INT,
          visit_id INT,
          encounter_id INT,
          patient_id INT,
          user_id INT,
          alert_type VARCHAR(100),
          severity VARCHAR(20) DEFAULT 'MEDIUM',
          summary TEXT,
          details JSONB DEFAULT '{}',
          overridden BOOLEAN DEFAULT FALSE,
          override_reason TEXT,
          override_by INT,
          override_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS clinic_referrals (
          id SERIAL PRIMARY KEY,
          pharmacy_id INT,
          visit_id INT NOT NULL,
          patient_id INT NOT NULL,
          encounter_id INT NOT NULL,
          from_clinic VARCHAR(100) DEFAULT 'General OPD',
          to_clinic_id INT,
          to_clinic_code VARCHAR(100),
          to_clinic_name VARCHAR(100) NOT NULL,
          referred_by INT,
          referral_reason TEXT,
          urgency VARCHAR(50) DEFAULT 'ROUTINE',
          status VARCHAR(50) DEFAULT 'PENDING',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS clinic_queue (
          id SERIAL PRIMARY KEY,
          pharmacy_id INT,
          visit_id INT NOT NULL,
          patient_id INT NOT NULL,
          encounter_id INT NOT NULL,
          clinic_id INT,
          clinic_code VARCHAR(100),
          clinic_name VARCHAR(100) NOT NULL,
          priority VARCHAR(50) DEFAULT 'NORMAL',
          status VARCHAR(50) DEFAULT 'WAITING',
          queued_at TIMESTAMPTZ DEFAULT NOW(),
          served_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS clinic_doctors (
          id SERIAL PRIMARY KEY,
          pharmacy_id INT,
          clinic_id INT NOT NULL,
          user_id INT NOT NULL,
          is_primary BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS clinic_services (
          id SERIAL PRIMARY KEY,
          pharmacy_id INT,
          clinic_id INT NOT NULL,
          service_name VARCHAR(255) NOT NULL,
          service_code VARCHAR(100),
          fee NUMERIC(10,2) DEFAULT 0.00,
          description TEXT,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS clinic_appointments (
          id SERIAL PRIMARY KEY,
          pharmacy_id INT,
          clinic_id INT NOT NULL,
          patient_id INT NOT NULL,
          doctor_id INT,
          appointment_date DATE NOT NULL,
          appointment_time TIME,
          reason TEXT,
          status VARCHAR(50) DEFAULT 'SCHEDULED',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      const SPECIAL_CLINICS_SEED = [
        { code: 'MEDICAL_OPD', name: 'Medical OPD', description: 'Internal Medicine and General Medical Consultations' },
        { code: 'PAEDIATRIC_OPD', name: 'Paediatric OPD', description: 'Child Health and Paediatric Consultations' },
        { code: 'SURGICAL_OPD', name: 'Surgical OPD', description: 'General Surgery & Pre/Post-Op Evaluation' },
        { code: 'OG', name: 'O&G', description: 'Obstetrics and Gynaecology Special Clinic' },
        { code: 'EYE', name: 'Eye / Ophthalmology', description: 'Ophthalmology & Optical Care' },
        { code: 'ENT', name: 'ENT', description: 'Ear, Nose & Throat Services' },
        { code: 'DENTAL', name: 'Dental Clinic', description: 'Oral Health and Dental Surgery' },
        { code: 'CARDIOLOGY', name: 'Cardiology', description: 'Heart and Cardiovascular Care' },
        { code: 'RENAL', name: 'Renal / Nephrology', description: 'Kidney Health and Nephrology' },
        { code: 'DERMATOLOGY', name: 'Dermatology', description: 'Skin & Dermatological Care' },
        { code: 'ONCOLOGY', name: 'Oncology', description: 'Cancer Care & Oncology Consultations' },
        { code: 'NEUROLOGY', name: 'Neurology', description: 'Nervous System & Neurological Care' },
        { code: 'PHYSIOTHERAPY', name: 'Physiotherapy', description: 'Physical Therapy & Rehabilitation' },
        { code: 'NUTRITION', name: 'Nutrition', description: 'Dietetics & Clinical Nutrition' },
        { code: 'MENTAL_HEALTH', name: 'Mental Health', description: 'Psychiatry & Psychological Services' },
        { code: 'PSYCHIATRY', name: 'Psychiatry & Wellness', description: 'Mental Health & Psychiatry' },
        { code: 'DIABETIC', name: 'Diabetic & Endocrine', description: 'Diabetes & Metabolic Care' },
        { code: 'DIABETES', name: 'Diabetes Clinic', description: 'Diabetes Management Clinic' },
        { code: 'HYPERTENSION', name: 'Hypertension / Cardiac', description: 'Hypertension Management Clinic' },
        { code: 'ORTHOPEDIC', name: 'Orthopedic Clinic', description: 'Bones, Joints & Musculoskeletal' },
        { code: 'CCC', name: 'CCC', description: 'Comprehensive Care Centre' },
        { code: 'TB', name: 'TB', description: 'Tuberculosis Care & Management' },
        { code: 'SICKLE_CELL', name: 'Sickle Cell', description: 'Sickle Cell Disease Care' },
      ];

      for (const sc of SPECIAL_CLINICS_SEED) {
        await p.query(`
          INSERT INTO special_clinics (code, name, description)
          VALUES ($1, $2, $3)
          ON CONFLICT (code) DO UPDATE
          SET name = EXCLUDED.name, description = EXCLUDED.description
        `, [sc.code, sc.name, sc.description]);
      }
    } catch (scErr) {
      logger.error('Failed to setup special clinics tables:', scErr.message);
    }

    // Ensure encounter_id columns exist in related clinical tables
    const encounterIdTables = [
      'consultations',
      'prescriptions',
      'lab_requests',
      'billing_items',
      'injection_room_orders',
      'vitals',
      'procedures',
      'service_orders'
    ];
    for (const tbl of encounterIdTables) {
      try {
        await p.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS encounter_id INT`);
      } catch (colErr) {}
    }

    // Ensure product_id columns support UUID or String IDs (VARCHAR) across tables
    const productIdTables = [
      'prescriptions',
      'billing_items',
      'service_orders',
      'injection_room_orders',
      'stock',
      'stock_movements',
      'sale_items',
      'purchase_order_items',
      'stock_transfer_items'
    ];
    for (const tbl of productIdTables) {
      try {
        await p.query(`ALTER TABLE ${tbl} DROP CONSTRAINT IF EXISTS ${tbl}_product_id_fkey`);
        await p.query(`ALTER TABLE ${tbl} DROP CONSTRAINT IF EXISTS fk_${tbl}_product`);
        await p.query(`ALTER TABLE ${tbl} DROP CONSTRAINT IF EXISTS fk_${tbl}_products`);
        await p.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS product_id VARCHAR(100)`);
        await p.query(`ALTER TABLE ${tbl} ALTER COLUMN product_id TYPE VARCHAR(100) USING product_id::text`);
      } catch (prodColErr) {
        logger.error(`Error altering product_id on ${tbl}: ${prodColErr.message}`);
      }
    }

    // Ensure audit_log and audit_logs tables support string/UUID record IDs
    try {
      await p.query(`ALTER TABLE audit_log ALTER COLUMN record_id TYPE VARCHAR(100) USING record_id::text`);
      await p.query(`ALTER TABLE audit_log ALTER COLUMN record_id DROP NOT NULL`);
    } catch (auditErr) {}

    try {
      await p.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id BIGSERIAL PRIMARY KEY,
          facility_id INT,
          pharmacy_id INT,
          user_id INT,
          action VARCHAR(100),
          table_name VARCHAR(100),
          record_id VARCHAR(100),
          new_values JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await p.query(`ALTER TABLE audit_logs ALTER COLUMN record_id TYPE VARCHAR(100) USING record_id::text`);
    } catch (auditLogsErr) {}

    // Interoperability Readiness: Ensure stable UUID columns exist across core entities
    const uuidTables = [
      'patients',
      'visits',
      'encounters',
      'consultations',
      'prescriptions',
      'lab_requests',
      'billing_items',
      'clinic_referrals',
      'admissions',
      'clinical_orders'
    ];
    for (const tbl of uuidTables) {
      try {
        await p.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT gen_random_uuid()`);
      } catch (uuidErr) {
        // Fallback for DB engines without gen_random_uuid
        try {
          await p.query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS uuid VARCHAR(64) DEFAULT md5(random()::text)`);
        } catch (e2) {}
      }
    }

    // Automatically migrate existing consultations into Encounter records
    try {
      const consultsWithoutEncounter = await p.query(`
        SELECT c.* FROM consultations c WHERE c.encounter_id IS NULL
      `);
      if (consultsWithoutEncounter.rows && consultsWithoutEncounter.rows.length > 0) {
        logger.info(`Migrating ${consultsWithoutEncounter.rows.length} consultations to encounters...`);
        for (const c of consultsWithoutEncounter.rows) {
          const encNum = `ENC-${c.visit_id}-${c.id}`;
          const encRes = await p.query(`
            INSERT INTO encounters (pharmacy_id, visit_id, patient_id, encounter_number, doctor_id, status, current_step, started_at, completed_at)
            VALUES ($1, $2, $3, $4, $5, 'COMPLETED', 'completed', $6, $7)
            RETURNING id
          `, [c.pharmacy_id, c.visit_id, c.patient_id, encNum, c.doctor_id, c.created_at, c.updated_at || c.created_at]);

          if (encRes.rows[0]) {
            const encounterId = encRes.rows[0].id;
            await p.query(`UPDATE consultations SET encounter_id = $1 WHERE id = $2`, [encounterId, c.id]);
            await p.query(`UPDATE prescriptions SET encounter_id = $1 WHERE consultation_id = $2 OR (visit_id = $3 AND encounter_id IS NULL)`, [encounterId, c.id, c.visit_id]);
            await p.query(`UPDATE lab_requests SET encounter_id = $1 WHERE consultation_id = $2 OR (visit_id = $3 AND encounter_id IS NULL)`, [encounterId, c.id, c.visit_id]);
            await p.query(`UPDATE billing_items SET encounter_id = $1 WHERE visit_id = $2 AND encounter_id IS NULL`, [encounterId, c.visit_id]);
            await p.query(`UPDATE injection_room_orders SET encounter_id = $1 WHERE consultation_id = $2 OR (visit_id = $3 AND encounter_id IS NULL)`, [encounterId, c.id, c.visit_id]);

            await p.query(`
              INSERT INTO encounter_events (pharmacy_id, encounter_id, visit_id, patient_id, event_type, actor_id, metadata)
              VALUES ($1, $2, $3, $4, 'MIGRATED', $5, $6)
            `, [c.pharmacy_id, encounterId, c.visit_id, c.patient_id, c.doctor_id, JSON.stringify({ source: 'consultation_migration', consultation_id: c.id })]);
          }
        }
        logger.info('✅ Consultations successfully migrated to encounters.');
      }
    } catch (migErr) {
      logger.warn('Skipped encounter migration: ' + migErr.message);
    }

    // Ensure injection_room_orders table exists
    try {
      await p.query(`
        CREATE TABLE IF NOT EXISTS injection_room_orders (
          id SERIAL PRIMARY KEY,
          pharmacy_id INT,
          visit_id INT,
          patient_id INT,
          consultation_id INT,
          prescribed_by INT,
          administered_by INT,
          drug_name VARCHAR(255) NOT NULL,
          dosage VARCHAR(100),
          route VARCHAR(50),
          frequency VARCHAR(50),
          duration VARCHAR(50),
          quantity INT DEFAULT 1,
          instructions TEXT,
          notes TEXT,
          nurse_report TEXT,
          status VARCHAR(50) DEFAULT 'pending',
          product_id UUID,
          administered_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    } catch (injTableErr) {
      logger.error('Failed to create injection_room_orders table:', injTableErr.message);
    }

    const injectionColumns = [
      { name: 'pharmacy_id', type: 'INT' },
      { name: 'visit_id', type: 'INT' },
      { name: 'patient_id', type: 'INT' },
      { name: 'consultation_id', type: 'INT' },
      { name: 'prescribed_by', type: 'INT' },
      { name: 'administered_by', type: 'INT' },
      { name: 'drug_name', type: 'VARCHAR(255)' },
      { name: 'dosage', type: 'VARCHAR(100)' },
      { name: 'route', type: 'VARCHAR(50)' },
      { name: 'frequency', type: 'VARCHAR(50)' },
      { name: 'duration', type: 'VARCHAR(50)' },
      { name: 'quantity', type: 'INT DEFAULT 1' },
      { name: 'instructions', type: 'TEXT' },
      { name: 'notes', type: 'TEXT' },
      { name: 'nurse_report', type: 'TEXT' },
      { name: 'status', type: "VARCHAR(50) DEFAULT 'pending'" },
      { name: 'product_id', type: 'UUID' },
      { name: 'administered_at', type: 'TIMESTAMPTZ' }
    ];
    for (const col of injectionColumns) {
      try {
        await p.query(`ALTER TABLE injection_room_orders ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
      } catch (colErr) {}
    }

    // Ensure billing_items columns exist
    const billingColumns = [
      { name: 'facility_id', type: 'INT' },
      { name: 'pharmacy_id', type: 'INT' },
      { name: 'item_name', type: 'VARCHAR(255)' },
      { name: 'description', type: 'VARCHAR(255)' },
      { name: 'service_code', type: 'VARCHAR(100)' }
    ];
    for (const col of billingColumns) {
      try {
        await p.query(`ALTER TABLE billing_items ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
      } catch (colErr) {}
    }

    try {
      await p.query(`ALTER TABLE billing_items DROP CONSTRAINT IF EXISTS billing_items_item_type_check`);
      await p.query(`ALTER TABLE billing_items DROP CONSTRAINT IF EXISTS billing_items_status_check`);
      await p.query(`ALTER TABLE injection_room_orders DROP CONSTRAINT IF EXISTS injection_room_orders_status_check`);
      await p.query(`ALTER TABLE billing_items ALTER COLUMN total_price DROP EXPRESSION IF EXISTS`);
    } catch (cErr) {}

    try {
      await p.query(`UPDATE billing_items SET facility_id = pharmacy_id WHERE facility_id IS NULL AND pharmacy_id IS NOT NULL`);
      await p.query(`UPDATE billing_items SET pharmacy_id = facility_id WHERE pharmacy_id IS NULL AND facility_id IS NOT NULL`);
      await p.query(`UPDATE billing_items SET item_name = description WHERE item_name IS NULL AND description IS NOT NULL`);
      await p.query(`UPDATE billing_items SET description = item_name WHERE description IS NULL AND item_name IS NOT NULL`);
    } catch (syncErr) {}

    // Ensure patients columns exist
    const patientColumns = [
      { name: 'pharmacy_id', type: 'INT' },
      { name: 'patient_number', type: 'VARCHAR(100)' },
      { name: 'date_of_birth', type: 'DATE' },
      { name: 'national_id', type: 'TEXT' },
      { name: 'sha_number', type: 'TEXT' },
      { name: 'email', type: 'VARCHAR(255)' },
      { name: 'address', type: 'TEXT' },
      { name: 'county', type: 'VARCHAR(100)' },
      { name: 'next_of_kin_name', type: 'VARCHAR(255)' },
      { name: 'next_of_kin_phone', type: 'VARCHAR(50)' },
      { name: 'next_of_kin_relation', type: 'VARCHAR(100)' },
      { name: 'blood_group', type: 'VARCHAR(20)' },
      { name: 'allergies', type: 'TEXT' },
      { name: 'chronic_conditions', type: 'TEXT' },
      { name: 'occupation', type: 'VARCHAR(100)' },
      { name: 'marital_status', type: 'VARCHAR(50)' },
      { name: 'emirates_id', type: 'VARCHAR(100)' },
      { name: 'nabidh_consent', type: "VARCHAR(20) DEFAULT 'opt_out'" },
      { name: 'passport_number', type: 'VARCHAR(50)' },
      { name: 'is_active', type: 'BOOLEAN DEFAULT TRUE' },
      { name: 'updated_at', type: 'TIMESTAMPTZ DEFAULT NOW()' }
    ];
    for (const col of patientColumns) {
      try {
        await p.query(`ALTER TABLE patients ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
      } catch (colErr) {}
    }
    try {
      await p.query(`ALTER TABLE patients ALTER COLUMN pharmacy_id TYPE INT USING (CASE WHEN pharmacy_id::text ~ '^[0-9]+$' THEN pharmacy_id::text::integer ELSE NULL END)`);
    } catch (e) {}

    // Ensure visits columns exist
    const visitColumns = [
      { name: 'department', type: 'VARCHAR(50)' },
      { name: 'mch_service', type: 'VARCHAR(50)' },
      { name: 'consultation_fee', type: 'DECIMAL(10,2) DEFAULT 0' },
      { name: 'fee_paid', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'payment_method', type: 'VARCHAR(50)' }
    ];
    for (const col of visitColumns) {
      try {
        await p.query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
      } catch (colErr) {
        logger.error(`Failed to add column ${col.name} to visits:`, colErr.message);
      }
    }

    // Drop restrictive status check constraint on visits table to allow dynamic workflow statuses
    try {
      logger.info('Dropping restrictive visits status check constraint if present...');
      await p.query(`
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN
                SELECT tc.constraint_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
                WHERE tc.table_name = 'visits' AND tc.constraint_type = 'CHECK' AND ccu.column_name = 'status'
            LOOP
                EXECUTE 'ALTER TABLE visits DROP CONSTRAINT ' || quote_ident(r.constraint_name);
            END LOOP;
        END $$;
      `);
      await p.query(`ALTER TABLE visits DROP CONSTRAINT IF EXISTS visits_status_check`);
      logger.info('✅ visits status check constraint successfully dropped.');
    } catch (constraintErr) {
      logger.warn('Skipped visits status check constraint drop: ' + constraintErr.message);
    }

    // Ensure consultations columns exist
    const consultationColumns = [
      { name: 'pharmacy_id', type: 'INT' },
      { name: 'visit_id', type: 'INT' },
      { name: 'patient_id', type: 'INT' },
      { name: 'doctor_id', type: 'INT' },
      { name: 'diagnosis', type: 'TEXT' },
      { name: 'icd_code', type: 'VARCHAR(100)' },
      { name: 'presenting_complaint', type: 'TEXT' },
      { name: 'history_of_illness', type: 'TEXT' },
      { name: 'examination_findings', type: 'TEXT' },
      { name: 'review_of_systems', type: 'TEXT' },
      { name: 'impression', type: 'TEXT' },
      { name: 'management_plan', type: 'TEXT' },
      { name: 'nurse_instructions', type: 'TEXT' },
      { name: 'follow_up_date', type: 'DATE' },
      { name: 'follow_up_notes', type: 'TEXT' },
      { name: 'admit_patient', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'admission_ward', type: 'VARCHAR(100)' },
      { name: 'admission_notes', type: 'TEXT' },
      { name: 'admission_reason', type: 'TEXT' }
    ];
    for (const col of consultationColumns) {
      try {
        await p.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
      } catch (colErr) {}
    }

    // Ensure vitals columns exist
    const vitalsColumns = [
      { name: 'oxygen_saturation', type: 'NUMERIC' },
      { name: 'respiratory_rate', type: 'INT' }
    ];
    for (const col of vitalsColumns) {
      try {
        await p.query(`ALTER TABLE vitals ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
      } catch (colErr) {}
    }

    // Ensure products columns exist
    const productColumns = [
      { name: 'generic_name', type: 'VARCHAR(255)' },
      { name: 'barcode', type: 'VARCHAR(100)' },
      { name: 'category_id', type: 'INT' },
      { name: 'supplier_id', type: 'INT' },
      { name: 'unit', type: "VARCHAR(50) DEFAULT 'pcs'" },
      { name: 'selling_price', type: 'DECIMAL(10,2) DEFAULT 0' },
      { name: 'buying_price', type: 'DECIMAL(10,2) DEFAULT 0' },
      { name: 'min_selling_price', type: 'DECIMAL(10,2) DEFAULT 0' },
      { name: 'max_selling_price', type: 'DECIMAL(10,2) DEFAULT 0' },
      { name: 'reorder_level', type: 'INT DEFAULT 10' },
      { name: 'requires_prescription', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'department', type: "VARCHAR(50) DEFAULT 'pharmacy'" },
      { name: 'is_active', type: 'BOOLEAN DEFAULT TRUE' }
    ];
    for (const col of productColumns) {
      try {
        await p.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
      } catch (colErr) {
        logger.error(`Failed to add column ${col.name} to products:`, colErr.message);
      }
    }

    // Synchronize price/selling_price for seeded products if any are missing/zero
    try {
      await p.query(`UPDATE products SET selling_price = price WHERE COALESCE(selling_price, 0) = 0 AND price > 0`);
      await p.query(`UPDATE products SET price = selling_price WHERE COALESCE(price, 0) = 0 AND selling_price > 0`);
    } catch (syncErr) {
      // ignore
    }

    // Ensure OTP columns exist for password resets
    try {
      await p.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp VARCHAR(20)`);
      await p.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp_expires TIMESTAMPTZ`);
      await p.query(`ALTER TABLE super_admins ADD COLUMN IF NOT EXISTS reset_otp VARCHAR(20)`);
      await p.query(`ALTER TABLE super_admins ADD COLUMN IF NOT EXISTS reset_otp_expires TIMESTAMPTZ`);
    } catch (otpColErr) {
      logger.error('Failed to add OTP columns:', otpColErr.message);
    }

    // Ensure subscriptions table exists with correct columns and unique constraint
    try {
      await p.query(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id SERIAL PRIMARY KEY,
          pharmacy_id INT UNIQUE,
          plan VARCHAR(50) DEFAULT 'trial',
          status VARCHAR(50) DEFAULT 'active',
          expires_at TIMESTAMPTZ,
          max_users INT DEFAULT 10,
          max_counters INT DEFAULT 5,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      const subCols = [
        { name: 'max_users', type: 'INT DEFAULT 10' },
        { name: 'max_counters', type: 'INT DEFAULT 5' },
        { name: 'notes', type: 'TEXT' },
        { name: 'updated_at', type: 'TIMESTAMPTZ DEFAULT NOW()' }
      ];
      for (const col of subCols) {
        try {
          await p.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
        } catch (e) {}
      }
      try {
        await p.query(`ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_pharmacy_id_key UNIQUE (pharmacy_id)`);
      } catch (e) {}
    } catch (subErr) {
      logger.error('Failed subscriptions table migration:', subErr.message);
    }

    // 3. Seed initial pharmacy (robust handling for UUID/serial differences)
    let pharmacyId = null;
    try {
      const existingPharm = await p.query(`SELECT id FROM pharmacies WHERE email = $1`, ['medicare@gmail.com']);
      if (existingPharm.rows.length > 0) {
        pharmacyId = existingPharm.rows[0].id;
      } else {
        try {
          const insertResult = await p.query(`
            INSERT INTO pharmacies (name, phone, address, city, country, email)
            VALUES ('Medicare Pharmacy', '+254700000000', '123 Health St', 'Nairobi', 'Kenya', 'medicare@gmail.com')
            RETURNING id;
          `);
          pharmacyId = insertResult.rows[0].id;
        } catch (insertErr) {
          const insertResult = await p.query(`
            INSERT INTO pharmacies (id, name, phone, address, city, country, email)
            VALUES (1, 'Medicare Pharmacy', '+254700000000', '123 Health St', 'Nairobi', 'Kenya', 'medicare@gmail.com')
            RETURNING id;
          `);
          pharmacyId = insertResult.rows[0].id;
        }
      }
    } catch (pharmErr) {
      logger.error('Failed to seed or resolve initial pharmacy:', pharmErr.message);
    }

    // 4. Seed initial users (with correct bcrypt hashes and dynamic pharmacy_id resolution)
    const seedUsers = [
      { full_name: 'Dylan Receptionist', email: 'dylan@gmail.com', password: 'Dylan1234', role: 'receptionist' },
      { full_name: 'Eliud Nurse', email: 'eliud@gmail.com', password: 'Eliud1234', role: 'nurse' },
      { full_name: 'Oliver Doctor', email: 'oliver@gmail.com', password: 'Oliver1234', role: 'doctor' },
      { full_name: 'Abby Lab Tech', email: 'abby@gmail.com', password: 'Abby1234', role: 'lab_technician' },
      { full_name: 'Juma Pharmacist', email: 'juma@gmail.com', password: 'Juma1234', role: 'pharmacist' }
    ];

    if (pharmacyId !== null) {
      for (const u of seedUsers) {
        const hashedPassword = bcrypt.hashSync(u.password, 10);
        try {
          await p.query(`
            INSERT INTO users (full_name, email, password, role, pharmacy_id, is_active)
            VALUES ($1, $2, $3, $4, $5, true)
            ON CONFLICT (email) DO NOTHING;
          `, [u.full_name, u.email, hashedPassword, u.role, pharmacyId]);
        } catch (seedErr) {
          logger.error(`Failed to seed user ${u.email}:`, seedErr.message);
        }
      }
    }

    // Run the role update permissions to align seeded user permissions
    try {
      const rolesPermissionContent = fs.readFileSync(path.join(backendDir, 'migrate_roles_permissions.sql'), 'utf8');
      await p.query(rolesPermissionContent);
    } catch (e) {
      // already run or safe to skip
    }

    // Seed paracetamol product for integration tests
    if (pharmacyId !== null) {
      try {
        await p.query(`
          INSERT INTO products (id, name, price, pharmacy_id)
          VALUES ('68a6478f-79d5-46ae-9a01-fbc48e281749', 'Paracetamol 1000mg', 22.36, $1)
          ON CONFLICT DO NOTHING;
        `, [pharmacyId]);
      } catch (e) {
        // ignore
      }
    }

    // 5. Create billing_items total_price automatic calculation trigger
    try {
      logger.info('Creating billing_items total_price trigger...');
      await p.query(`
        CREATE OR REPLACE FUNCTION calculate_billing_item_total_price()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.total_price := COALESCE(NEW.unit_price, 0) * COALESCE(NEW.quantity, 1);
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);

      await p.query(`
        DROP TRIGGER IF EXISTS trigger_calculate_billing_item_total ON billing_items;
      `);

      await p.query(`
        CREATE TRIGGER trigger_calculate_billing_item_total
        BEFORE INSERT OR UPDATE ON billing_items
        FOR EACH ROW
        EXECUTE FUNCTION calculate_billing_item_total_price();
      `);
      logger.info('✅ billing_items total_price trigger successfully created.');
    } catch (triggerErr) {
      logger.warn('Skipped billing_items total_price trigger creation (likely pg-mem or unsupported context): ' + triggerErr.message);
    }

    // 6. Ensure Inpatient Admission Fee is seeded at KES 2,000 in price list and billings updated
    try {
      await p.query(`
        INSERT INTO service_price_defaults (service_code, name, category, default_price, is_active)
        VALUES ('ADMISSION-FEE', 'Inpatient Admission Fee', 'admission', 2000.00, true)
        ON CONFLICT (service_code) DO UPDATE SET default_price = 2000.00, name = 'Inpatient Admission Fee';
      `);

      const pharmaciesRes = await p.query('SELECT id FROM pharmacies');
      for (const { id } of pharmaciesRes.rows) {
        const checkFee = await p.query("SELECT id FROM service_prices WHERE pharmacy_id = $1 AND (service_code = 'ADMISSION-FEE' OR LOWER(name) = 'inpatient admission fee')", [id]);
        if (checkFee.rows.length === 0) {
          await p.query(`
            INSERT INTO service_prices (pharmacy_id, service_code, name, category, price)
            VALUES ($1, 'ADMISSION-FEE', 'Inpatient Admission Fee', 'admission', 2000.00)
          `, [id]);
        }
      }

      await p.query(`
        UPDATE service_prices
        SET price = 2000.00
        WHERE (service_code = 'ADMISSION-FEE' OR LOWER(name) LIKE '%admission fee%' OR LOWER(name) = 'admission')
          AND (price = 0 OR price IS NULL);
      `);

      await p.query(`
        UPDATE billing_items
        SET unit_price = 2000.00
        WHERE (LOWER(item_type) = 'admission' OR LOWER(item_name) LIKE '%admission%')
          AND LOWER(item_name) NOT LIKE '%daily rate%'
          AND (unit_price = 0 OR unit_price IS NULL);
      `);

      // Clean up erroneously leaked admission/bed charges from outpatient (OPD) visits
      const cleanupResult = await p.query(`
        DELETE FROM billing_items
        WHERE (item_type = 'admission' OR item_name ILIKE '%admission%' OR item_name ILIKE '%daily rate%')
          AND status = 'pending'
          AND visit_id IN (
            SELECT v.id FROM visits v
            WHERE v.status != 'inpatient'
              AND (v.visit_type IS NULL OR LOWER(v.visit_type) != 'inpatient')
              AND NOT EXISTS (SELECT 1 FROM beds b WHERE b.current_visit_id = v.id)
              AND NOT EXISTS (SELECT 1 FROM inpatient_admissions ia WHERE ia.visit_id::text = v.id::text)
          )
      `);
      if (cleanupResult.rowCount > 0) {
        logger.info(`🧹 Cleaned up ${cleanupResult.rowCount} leaked admission billing items from OPD visits.`);
      }

      logger.info('✅ Inpatient admission fee price list & billings successfully set to KES 2,000.');
    } catch (admFeeErr) {
      logger.warn('Admission fee setup error: ' + admFeeErr.message);
    }

  } catch (err) {
    logger.error('Error during database schema migrations/seeding:', err);
  }
}

// Overwrite pool.query and pool.connect to automatically inject tenant context for RLS
if (pool) {
  const originalConnect = pool.connect;
  const originalQuery = pool.query;

  pool.connect = async function () {
    const client = await originalConnect.apply(pool, arguments);
    const pharmacyId = tenantStorage.getStore();
    if (pharmacyId && !isInMemory) {
      try {
        await client.query(`SET LOCAL app.current_pharmacy_id = '${pharmacyId}'`);
      } catch (err) {
        logger.error('Failed to set SET LOCAL in connect:', err.message);
      }
    }
    return client;
  };

  pool.query = async function (text, params) {
    const pharmacyId = tenantStorage.getStore();
    if (pharmacyId && !isInMemory) {
      let client;
      try {
        client = await originalConnect.apply(pool);
        await client.query(`SET LOCAL app.current_pharmacy_id = '${pharmacyId}'`);
        const res = await client.query(text, params);
        return res;
      } finally {
        if (client) client.release();
      }
    } else {
      return originalQuery.apply(pool, [text, params]);
    }
  };
}

module.exports = { pool, connectDB, tenantStorage };
