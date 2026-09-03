const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');
const { protect, requirePharmacy } = require('../middleware/auth.middleware');

router.use(protect, requirePharmacy);

// GET all wards with bed stats
router.get('/wards', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT w.*,
        COUNT(b.id) as total_beds,
        COUNT(CASE WHEN b.status='available' THEN 1 END) as available_beds,
        COUNT(CASE WHEN b.status='occupied' THEN 1 END) as occupied_beds,
        COUNT(CASE WHEN b.status='maintenance' THEN 1 END) as maintenance_beds
      FROM wards w
      LEFT JOIN beds b ON w.id = b.ward_id
      WHERE w.pharmacy_id = $1 AND w.is_active = true
      GROUP BY w.id
      ORDER BY w.name ASC
    `, [req.pharmacy_id]);
    return successResponse(res, 200, 'Wards fetched', result.rows);
  } catch (error) {
    return errorResponse(res, 500, 'Failed to fetch wards: ' + error.message);
  }
});

// CREATE ward
router.post('/wards', async (req, res) => {
  try {
    const { name, ward_type, total_beds } = req.body;
    if (!name) return errorResponse(res, 400, 'Ward name required');
    const ward = await pool.query(`
      INSERT INTO wards (pharmacy_id, name, ward_type, total_beds)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [req.pharmacy_id, name, ward_type || 'general', total_beds || 10]);

    // Auto-create beds
    const beds = parseInt(total_beds) || 10;
    for (let i = 1; i <= beds; i++) {
      await pool.query(`
        INSERT INTO beds (pharmacy_id, ward_id, bed_number)
        VALUES ($1, $2, $3)
      `, [req.pharmacy_id, ward.rows[0].id, name.substring(0,2).toUpperCase() + '-' + String(i).padStart(2,'0')]);
    }
    return successResponse(res, 201, 'Ward created', ward.rows[0]);
  } catch (error) {
    return errorResponse(res, 500, 'Failed to create ward: ' + error.message);
  }
});

// GET all beds
router.get('/beds', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, w.name as ward_name, w.ward_type,
        p.full_name as patient_name, p.patient_number,
        v.visit_number, v.chief_complaint,
        c.diagnosis, u.full_name as doctor_name
      FROM beds b
      LEFT JOIN wards w ON b.ward_id = w.id
      LEFT JOIN patients p ON b.current_patient_id = p.id
      LEFT JOIN visits v ON b.current_visit_id = v.id
      LEFT JOIN consultations c ON v.id = c.visit_id AND c.pharmacy_id = $1
      LEFT JOIN users u ON c.doctor_id = u.id
      WHERE (b.pharmacy_id = $1 OR b.pharmacy_id IS NULL)
      ORDER BY w.name ASC, b.bed_number ASC
    `, [req.pharmacy_id]);
    return successResponse(res, 200, 'Beds fetched', result.rows);
  } catch (error) {
    return errorResponse(res, 500, 'Failed to fetch beds: ' + error.message);
  }
});

// GET admit queue
router.get('/queue', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.*, p.full_name as patient_name, p.patient_number, p.phone, p.gender, p.date_of_birth,
        c.diagnosis, u.full_name as doctor_name
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      LEFT JOIN consultations c ON c.visit_id = v.id AND c.pharmacy_id = v.pharmacy_id
      LEFT JOIN users u ON c.doctor_id = u.id
      WHERE (v.pharmacy_id = $1 OR v.pharmacy_id IS NULL)
        AND v.status IN ('admitted', 'triaged', 'with_doctor', 'inpatient')
        AND NOT EXISTS (
          SELECT 1 FROM beds b WHERE b.current_visit_id = v.id AND b.status = 'occupied'
        )
      ORDER BY v.created_at DESC
      LIMIT 100
    `, [req.pharmacy_id]);
    return successResponse(res, 200, 'Inpatient queue fetched', result.rows);
  } catch (error) {
    return errorResponse(res, 500, 'Failed to fetch queue: ' + error.message);
  }
});

// GET beds for a ward
router.get('/wards/:ward_id/beds', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*,
        p.full_name as patient_name, p.patient_number,
        v.visit_number, v.chief_complaint,
        c.diagnosis, u.full_name as doctor_name
      FROM beds b
      LEFT JOIN patients p ON b.current_patient_id = p.id
      LEFT JOIN visits v ON b.current_visit_id = v.id
      LEFT JOIN consultations c ON v.id = c.visit_id AND c.pharmacy_id = $1
      LEFT JOIN users u ON c.doctor_id = u.id
      WHERE b.ward_id = $2 AND b.pharmacy_id = $1
      ORDER BY b.bed_number ASC
    `, [req.pharmacy_id, req.params.ward_id]);
    return successResponse(res, 200, 'Beds fetched', result.rows);
  } catch (error) {
    return errorResponse(res, 500, 'Failed to fetch beds: ' + error.message);
  }
});

// ADMIT patient to bed
router.post('/admit', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { visit_id, bed_id, notes, payment_method, insurance_provider, member_number, auth_code, copay_amount } = req.body;
    if (!visit_id || !bed_id) return errorResponse(res, 400, 'visit_id and bed_id required');

    // Ensure columns exist
    try {
      await client.query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS insurance_provider VARCHAR(150)`);
      await client.query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS member_number VARCHAR(150)`);
      await client.query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS auth_code VARCHAR(150)`);
      await client.query(`ALTER TABLE visits ADD COLUMN IF NOT EXISTS copay_amount NUMERIC DEFAULT 0`);
    } catch(e) {}

    // Check bed is available
    const bed = await client.query('SELECT * FROM beds WHERE id=$1 AND pharmacy_id=$2', [bed_id, req.pharmacy_id]);
    if (!bed.rows[0]) return errorResponse(res, 404, 'Bed not found');
    if (bed.rows[0].status === 'occupied') return errorResponse(res, 400, 'Bed is already occupied');

    // Get visit info
    const visit = await client.query('SELECT * FROM visits WHERE id=$1 AND pharmacy_id=$2', [visit_id, req.pharmacy_id]);
    if (!visit.rows[0]) return errorResponse(res, 404, 'Visit not found');

    // Update visit insurance cover details if provided
    if (insurance_provider || payment_method || member_number) {
      const pMethod = payment_method || (insurance_provider ? 'insurance' : null);
      await client.query(`
        UPDATE visits 
        SET payment_method = COALESCE($1, payment_method),
            insurance_provider = COALESCE($2, insurance_provider),
            member_number = COALESCE($3, member_number),
            auth_code = COALESCE($4, auth_code),
            copay_amount = COALESCE($5, copay_amount),
            updated_at = NOW()
        WHERE id = $6
      `, [pMethod, insurance_provider || null, member_number || null, auth_code || null, copay_amount ? parseFloat(copay_amount) : 0, visit_id]);

      if (visit.rows[0]?.patient_id) {
        await client.query(`
          UPDATE patients
          SET insurance_provider = COALESCE($1, insurance_provider),
              sha_number = COALESCE($2, sha_number)
          WHERE id = $3
        `, [insurance_provider || null, member_number || null, visit.rows[0].patient_id]);
      }
    }

    // Update bed
    await client.query(`
      UPDATE beds SET status='occupied', current_visit_id=$1, current_patient_id=$2, admitted_at=NOW(), notes=$3, updated_at=NOW()
      WHERE id=$4
    `, [visit_id, visit.rows[0].patient_id, notes||null, bed_id]);

    // Update visit status
    await client.query(`
      UPDATE visits SET status='inpatient', updated_at=NOW() WHERE id=$1
    `, [visit_id]);

    // Auto-create ward & admission fee billing items using service_prices
    try {
      const ward = await client.query('SELECT w.name, w.ward_type FROM wards w JOIN beds b ON b.ward_id=w.id WHERE b.id=$1', [bed_id]);
      const wardName = ward.rows[0]?.name || 'Ward';
      const wardType = ward.rows[0]?.ward_type || 'general';

      // 1. Look up Inpatient Admission Fee from service_prices
      const feeRow = await client.query(`
        SELECT price FROM service_prices
        WHERE (pharmacy_id = $1 OR pharmacy_id IS NULL) AND is_active = true
          AND (service_code = 'ADMISSION-FEE' OR LOWER(name) LIKE '%admission fee%' OR LOWER(name) LIKE 'admission%')
        ORDER BY (service_code = 'ADMISSION-FEE') DESC, (LOWER(name) LIKE '%admission fee%') DESC
        LIMIT 1
      `, [req.pharmacy_id]);

      const admissionFee = (feeRow.rows[0] && parseFloat(feeRow.rows[0].price) > 0)
        ? parseFloat(feeRow.rows[0].price)
        : 2000;

      // 2. Look up Ward Daily Rate from service_prices
      const wardCodeMap = { icu: 'WARD-ICU', private: 'WARD-PRIVATE', maternity: 'WARD-MATERNITY', general: 'WARD-GENERAL', pediatric: 'WARD-PEDS' };
      const wardCode = wardCodeMap[wardType] || 'WARD-GENERAL';
      const rateRow = await client.query(`
        SELECT price FROM service_prices
        WHERE (pharmacy_id = $1 OR pharmacy_id IS NULL) AND is_active = true
          AND (service_code = $2 OR LOWER(name) LIKE LOWER($3))
        ORDER BY (service_code = $2) DESC LIMIT 1
      `, [req.pharmacy_id, wardCode, `%${wardName}%`]);

      const wardFees = { icu: 5000, private: 3000, maternity: 2000, general: 1000, pediatric: 1500 };
      const dailyRate = (rateRow.rows[0] && parseFloat(rateRow.rows[0].price) > 0)
        ? parseFloat(rateRow.rows[0].price)
        : (wardFees[wardType] || 1000);

      // Bill 1: One-time Inpatient Admission Fee
      const existingFee = await client.query(`
        SELECT id FROM billing_items
        WHERE visit_id = $1 AND item_type = 'admission' AND (LOWER(item_name) LIKE '%admission fee%' OR LOWER(item_name) LIKE 'admission -%')
        LIMIT 1
      `, [visit_id]);

      if (!existingFee.rows[0]) {
        await client.query(`
          INSERT INTO billing_items (facility_id, visit_id, patient_id, item_name, item_type, unit_price, quantity, status)
          VALUES ($1,$2,$3,$4,'admission',$5,1,'pending')
        `, [req.pharmacy_id, visit_id, visit.rows[0].patient_id, `Admission - ${wardName}`, admissionFee]);
      } else {
        // Ensure price is updated from price list if previously 0
        await client.query(`
          UPDATE billing_items
          SET unit_price = $1
          WHERE id = $2 AND (unit_price = 0 OR unit_price IS NULL)
        `, [admissionFee, existingFee.rows[0].id]);
      }

      // Bill 2: Daily Ward Rate
      const existingDaily = await client.query(`
        SELECT id FROM billing_items
        WHERE visit_id = $1 AND item_type = 'admission' AND LOWER(item_name) LIKE '%daily rate%'
        LIMIT 1
      `, [visit_id]);

      if (!existingDaily.rows[0]) {
        await client.query(`
          INSERT INTO billing_items (facility_id, visit_id, patient_id, item_name, item_type, unit_price, quantity, status)
          VALUES ($1,$2,$3,$4,'admission',$5,1,'pending')
        `, [req.pharmacy_id, visit_id, visit.rows[0].patient_id, `Ward Admission - ${wardName} (Daily Rate)`, dailyRate]);
      }
    } catch(e) { console.error('Ward billing error:', e.message); }

    await client.query('COMMIT');
    return successResponse(res, 200, 'Patient admitted', { bed_id, visit_id, status: 'inpatient' });
  } catch (error) {
    await client.query('ROLLBACK');
    return errorResponse(res, 500, 'Failed to admit patient: ' + error.message);
  } finally {
    client.release();
  }
});

async function syncInpatientBedCharges(visitId, pharmacyId, dbClient = pool) {
  try {
    if (!visitId) return;

    // Strict validation: check if visit is truly an inpatient
    const visitRes = await dbClient.query(`
      SELECT v.id as visit_id, v.patient_id, v.status, v.visit_type, v.created_at, v.discharged_at,
             b.id as bed_id, b.admitted_at, w.name as ward_name, w.ward_type,
             ia.id as admission_id
      FROM visits v
      LEFT JOIN inpatient_admissions ia ON ia.visit_id::text = v.id::text
      LEFT JOIN beds b ON b.current_visit_id = v.id
      LEFT JOIN wards w ON b.ward_id = w.id
      WHERE v.id = $1 AND (v.pharmacy_id = $2 OR v.pharmacy_id IS NULL)
      ORDER BY b.admitted_at DESC LIMIT 1
    `, [visitId, pharmacyId]);

    const v = visitRes.rows[0];
    if (!v) return;

    const isInpatient = v.status === 'inpatient' ||
      (v.visit_type && v.visit_type.toLowerCase() === 'inpatient') ||
      !!v.admission_id ||
      !!v.bed_id;

    if (!isInpatient) {
      // 🚫 STRICT GUARD: OPD / outpatient visits MUST NEVER have admission or daily ward charges synced or created!
      return;
    }

    const patientId = v.patient_id;
    const wardName = v.ward_name || 'Ward';
    const wardType = (v.ward_type || 'general').toLowerCase();

    // Determine admission timestamp & end timestamp
    const admittedAt = v.admitted_at ? new Date(v.admitted_at) : new Date(v.created_at);
    const endTime = (v.status === 'discharged' && v.discharged_at) ? new Date(v.discharged_at) : new Date();

    // Calculate elapsed days (minimum 1 day)
    const diffMs = Math.max(0, endTime.getTime() - admittedAt.getTime());
    const daysStayed = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    // 1. Look up Inpatient Admission Fee from service_prices
    const feeRow = await dbClient.query(`
      SELECT price FROM service_prices
      WHERE (pharmacy_id = $1 OR pharmacy_id IS NULL) AND is_active = true
        AND (service_code = 'ADMISSION-FEE' OR LOWER(name) LIKE '%admission fee%' OR LOWER(name) LIKE 'admission%')
      ORDER BY CASE WHEN service_code = 'ADMISSION-FEE' THEN 1 ELSE 0 END DESC
      LIMIT 1
    `, [pharmacyId]);

    const admissionFee = (feeRow.rows[0] && parseFloat(feeRow.rows[0].price) > 0)
      ? parseFloat(feeRow.rows[0].price)
      : 2000;

    const existingFee = await dbClient.query(`
      SELECT id, unit_price, status FROM billing_items
      WHERE visit_id = $1 AND item_type = 'admission'
        AND (LOWER(item_name) LIKE '%admission fee%' OR LOWER(item_name) LIKE 'admission -%')
      LIMIT 1
    `, [visitId]);

    if (!existingFee.rows[0]) {
      const feeItemName = `Admission - ${wardName}`;
      await dbClient.query(`
        INSERT INTO billing_items (facility_id, pharmacy_id, visit_id, patient_id, item_name, description, item_type, unit_price, quantity, total_price, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'admission', $7, 1, $7, 'pending')
      `, [pharmacyId, pharmacyId, visitId, patientId, feeItemName, feeItemName, admissionFee]);
    } else if (existingFee.rows[0].status === 'pending' && parseFloat(existingFee.rows[0].unit_price || 0) === 0 && admissionFee > 0) {
      await dbClient.query(`
        UPDATE billing_items
        SET unit_price = $1, total_price = $1, updated_at = NOW()
        WHERE id = $2
      `, [admissionFee, existingFee.rows[0].id]);
    }

    // 2. Look up Ward Daily Rate from service_prices
    const wardCodeMap = { icu: 'WARD-ICU', private: 'WARD-PRIVATE', maternity: 'WARD-MATERNITY', general: 'WARD-GENERAL', pediatric: 'WARD-PEDS' };
    const wardCode = wardCodeMap[wardType] || 'WARD-GENERAL';
    const rateRow = await dbClient.query(`
      SELECT price FROM service_prices
      WHERE (pharmacy_id = $1 OR pharmacy_id IS NULL) AND is_active = true
        AND (service_code = $2 OR LOWER(name) LIKE LOWER($3))
      ORDER BY CASE WHEN service_code = $2 THEN 1 ELSE 0 END DESC
      LIMIT 1
    `, [pharmacyId, wardCode, `%${wardName}%`]);

    const wardFees = { icu: 5000, private: 3000, maternity: 2000, general: 1000, pediatric: 1500 };
    const dailyRate = (rateRow.rows[0] && parseFloat(rateRow.rows[0].price) > 0)
      ? parseFloat(rateRow.rows[0].price)
      : (wardFees[wardType] || 1000);

    const existingDaily = await dbClient.query(`
      SELECT id, unit_price, quantity, status FROM billing_items
      WHERE visit_id = $1 AND item_type = 'admission' AND LOWER(item_name) LIKE '%daily rate%'
      LIMIT 1
    `, [visitId]);

    if (!existingDaily.rows[0]) {
      const dailyItemName = `Ward Admission - ${wardName} (Daily Rate)`;
      const totalPrice = dailyRate * daysStayed;
      await dbClient.query(`
        INSERT INTO billing_items (facility_id, pharmacy_id, visit_id, patient_id, item_name, description, item_type, unit_price, quantity, total_price, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'admission', $7, $8, $9, 'pending')
      `, [pharmacyId, pharmacyId, visitId, patientId, dailyItemName, dailyItemName, dailyRate, daysStayed, totalPrice]);
    } else if (existingDaily.rows[0].status === 'pending') {
      const totalPrice = dailyRate * daysStayed;
      await dbClient.query(`
        UPDATE billing_items
        SET quantity = $1, unit_price = $2, total_price = $3, updated_at = NOW()
        WHERE id = $4
      `, [daysStayed, dailyRate, totalPrice, existingDaily.rows[0].id]);
    }
  } catch (err) {
    console.error('Error syncing inpatient bed charges:', err.message);
  }
}

// GET all inpatients (auto-syncs daily bed charges)
router.get('/patients', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, b.id as bed_id,
        w.name as ward_name, w.ward_type,
        p.full_name as patient_name, p.patient_number, p.gender, p.date_of_birth, p.phone, p.allergies, p.blood_group,
        v.visit_number, v.chief_complaint, v.priority, v.visit_date,
        c.diagnosis, c.management_plan,
        u.full_name as doctor_name
      FROM beds b
      JOIN wards w ON b.ward_id = w.id
      JOIN patients p ON b.current_patient_id = p.id
      JOIN visits v ON b.current_visit_id = v.id
      LEFT JOIN consultations c ON v.id = c.visit_id AND c.pharmacy_id = $1
      LEFT JOIN users u ON c.doctor_id = u.id
      WHERE b.pharmacy_id = $1 AND b.status = 'occupied'
      ORDER BY b.admitted_at DESC
    `, [req.pharmacy_id]);

    // Auto-sync daily bed charges for active inpatients
    for (const row of result.rows) {
      if (row.current_visit_id) {
        await syncInpatientBedCharges(row.current_visit_id, req.pharmacy_id);
      }
    }

    return successResponse(res, 200, 'Inpatients fetched', result.rows);
  } catch (error) {
    return errorResponse(res, 500, 'Failed to fetch inpatients: ' + error.message);
  }
});

// DISCHARGE inpatient & compile full treatment invoice
router.put('/discharge/:visit_id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const visitId = req.params.visit_id;
    const pharmacyId = req.pharmacy_id;

    // 1. Mark discharge timestamp on visit
    await client.query(`
      UPDATE visits SET status='discharged', discharged_at=NOW(), updated_at=NOW()
      WHERE id=$1 AND pharmacy_id=$2
    `, [visitId, pharmacyId]);

    // 2. Free the occupied bed
    await client.query(`
      UPDATE beds SET status='available', current_visit_id=NULL, current_patient_id=NULL, admitted_at=NULL, notes=NULL, updated_at=NOW()
      WHERE current_visit_id=$1 AND pharmacy_id=$2
    `, [visitId, pharmacyId]);

    // 3. Sync final daily bed charges up to discharge time
    await syncInpatientBedCharges(visitId, pharmacyId, client);

    await client.query('COMMIT');

    // 4. Compile full treatment invoice & statement data
    const patientRes = await pool.query(`
      SELECT v.id as visit_id, v.visit_number, v.status, v.created_at as visit_date, v.discharged_at,
             p.id as patient_id, p.full_name as patient_name, p.patient_number, p.gender, p.date_of_birth, p.phone, p.allergies, p.blood_group
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      WHERE v.id = $1 AND v.pharmacy_id = $2
    `, [visitId, pharmacyId]);

    const itemsRes = await pool.query(`
      SELECT * FROM billing_items
      WHERE visit_id = $1 AND facility_id = $2
      ORDER BY created_at ASC
    `, [visitId, pharmacyId]);

    const ordersRes = await pool.query(`
      SELECT * FROM injection_room_orders WHERE visit_id = $1 AND pharmacy_id = $2 ORDER BY created_at DESC
    `, [visitId, pharmacyId]);

    const labsRes = await pool.query(`
      SELECT * FROM lab_requests WHERE visit_id = $1 AND pharmacy_id = $2 ORDER BY created_at DESC
    `, [visitId, pharmacyId]);

    const procsRes = await pool.query(`
      SELECT * FROM procedures WHERE visit_id = $1 AND pharmacy_id = $2 ORDER BY created_at DESC
    `, [visitId, pharmacyId]);

    const items = itemsRes.rows;
    const totalBilled = items.reduce((s, i) => s + (parseFloat(i.unit_price || 0) * (parseInt(i.quantity) || 1)), 0);
    const totalPaid = items.filter(i => ['paid', 'insurance', 'nhif', 'sha', 'corporate'].includes(i.status)).reduce((s, i) => s + (parseFloat(i.unit_price || 0) * (parseInt(i.quantity) || 1)), 0);
    const totalWaived = items.filter(i => i.status === 'waived').reduce((s, i) => s + (parseFloat(i.unit_price || 0) * (parseInt(i.quantity) || 1)), 0);
    const pendingBalance = totalBilled - totalPaid - totalWaived;

    return successResponse(res, 200, 'Patient discharged & full treatment invoice compiled', {
      visit_id: visitId,
      status: 'discharged',
      patient: patientRes.rows[0] || {},
      billing_items: items,
      summary: {
        total_billed: totalBilled,
        total_paid: totalPaid,
        total_waived: totalWaived,
        pending_balance: pendingBalance
      },
      drug_orders: ordersRes.rows,
      lab_requests: labsRes.rows,
      procedures: procsRes.rows
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return errorResponse(res, 500, 'Failed to discharge: ' + error.message);
  } finally {
    client.release();
  }
});

// ── NURSING NOTES ────────────────────────────────────
// Add nursing note
router.post("/:admission_id/nursing-notes", async (req, res) => {
  try {
    const { notes, note_type, vitals } = req.body;
    const rawParam = String(req.params.admission_id || '').trim();
    
    // Auto-create table & drop FK constraints before altering column types to support UUIDs safely
    await pool.query(`
      CREATE TABLE IF NOT EXISTS nursing_notes (
        id SERIAL PRIMARY KEY,
        pharmacy_id VARCHAR(150),
        admission_id VARCHAR(150),
        visit_id VARCHAR(150),
        patient_id VARCHAR(150),
        nurse_id VARCHAR(150),
        notes TEXT,
        note_type VARCHAR(100) DEFAULT 'general',
        vitals JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
      DO $$ 
      DECLARE r RECORD;
      BEGIN
          FOR r IN (
              SELECT constraint_name 
              FROM information_schema.table_constraints 
              WHERE table_name = 'nursing_notes' 
                AND constraint_type = 'FOREIGN KEY'
          ) LOOP
              EXECUTE 'ALTER TABLE nursing_notes DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
          END LOOP;
      END $$;
      ALTER TABLE nursing_notes DROP CONSTRAINT IF EXISTS nursing_notes_pharmacy_id_fkey;
      ALTER TABLE nursing_notes DROP CONSTRAINT IF EXISTS nursing_notes_nurse_id_fkey;
      ALTER TABLE nursing_notes DROP CONSTRAINT IF EXISTS nursing_notes_admission_id_fkey;
      ALTER TABLE nursing_notes DROP CONSTRAINT IF EXISTS nursing_notes_visit_id_fkey;
      ALTER TABLE nursing_notes DROP CONSTRAINT IF EXISTS nursing_notes_patient_id_fkey;
      ALTER TABLE nursing_notes ALTER COLUMN pharmacy_id TYPE VARCHAR(150) USING pharmacy_id::VARCHAR;
      ALTER TABLE nursing_notes ALTER COLUMN admission_id TYPE VARCHAR(150) USING admission_id::VARCHAR;
      ALTER TABLE nursing_notes ALTER COLUMN visit_id TYPE VARCHAR(150) USING visit_id::VARCHAR;
      ALTER TABLE nursing_notes ALTER COLUMN patient_id TYPE VARCHAR(150) USING patient_id::VARCHAR;
      ALTER TABLE nursing_notes ALTER COLUMN nurse_id TYPE VARCHAR(150) USING nurse_id::VARCHAR;
      ALTER TABLE nursing_notes ADD COLUMN IF NOT EXISTS visit_id VARCHAR(150);
      ALTER TABLE nursing_notes ADD COLUMN IF NOT EXISTS patient_id VARCHAR(150);
      ALTER TABLE nursing_notes ADD COLUMN IF NOT EXISTS note_type VARCHAR(100) DEFAULT 'general';
      ALTER TABLE nursing_notes ADD COLUMN IF NOT EXISTS vitals JSONB;
    `);

    // Safely look up bed / visit / patient without integer cast failure
    const bed = await pool.query(
      `SELECT id as bed_id, current_visit_id, current_patient_id 
       FROM beds 
       WHERE (pharmacy_id::text = $2::text OR pharmacy_id IS NULL) AND (
         id::text = $1 OR 
         current_visit_id::text = $1 OR 
         current_patient_id::text = $1
       )
       LIMIT 1`,
      [rawParam, String(req.pharmacy_id || req.user?.pharmacy_id || '')]
    );

    let bedId = bed.rows[0]?.bed_id ? String(bed.rows[0].bed_id) : rawParam;
    let visitId = bed.rows[0]?.current_visit_id ? String(bed.rows[0].current_visit_id) : null;
    let patientId = bed.rows[0]?.current_patient_id ? String(bed.rows[0].current_patient_id) : null;

    if (!visitId || !patientId) {
      const visitRes = await pool.query(
        `SELECT id, patient_id FROM visits WHERE (id::text = $1::text OR visit_number::text = $1::text) AND (pharmacy_id::text = $2::text OR pharmacy_id IS NULL) LIMIT 1`,
        [rawParam, String(req.pharmacy_id || req.user?.pharmacy_id || '')]
      );
      if (visitRes.rows[0]) {
        visitId = visitId || String(visitRes.rows[0].id);
        patientId = patientId || String(visitRes.rows[0].patient_id);
      }
    }

    const nurseIdStr = req.user?.id ? String(req.user.id) : null;
    const rawPharmId = req.pharmacy_id || req.user?.pharmacy_id;
    const pharmIdStr = rawPharmId ? String(rawPharmId) : null;

    const result = await pool.query(`
      INSERT INTO nursing_notes (pharmacy_id, admission_id, nurse_id, notes, note_type, vitals, visit_id, patient_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [pharmIdStr, bedId, nurseIdStr, notes || null, note_type || "general", vitals ? JSON.stringify(vitals) : null, visitId, patientId]);
    
    const nurseName = req.user?.full_name || 'Clinician';
    return successResponse(res, 201, "Clinical note added", {
      ...result.rows[0],
      nurse_name: nurseName
    });
  } catch (error) {
    console.error("Add nursing note error:", error.message);
    return errorResponse(res, 500, "Failed to add clinical note: " + error.message);
  }
});

// Get nursing notes for an admission
router.get("/:admission_id/nursing-notes", async (req, res) => {
  try {
    const rawParam = String(req.params.admission_id || '').trim();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS nursing_notes (
        id SERIAL PRIMARY KEY,
        pharmacy_id VARCHAR(150),
        admission_id VARCHAR(150),
        visit_id VARCHAR(150),
        patient_id VARCHAR(150),
        nurse_id VARCHAR(150),
        notes TEXT,
        note_type VARCHAR(100) DEFAULT 'general',
        vitals JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
      DO $$ 
      DECLARE r RECORD;
      BEGIN
          FOR r IN (
              SELECT constraint_name 
              FROM information_schema.table_constraints 
              WHERE table_name = 'nursing_notes' 
                AND constraint_type = 'FOREIGN KEY'
          ) LOOP
              EXECUTE 'ALTER TABLE nursing_notes DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
          END LOOP;
      END $$;
      ALTER TABLE nursing_notes DROP CONSTRAINT IF EXISTS nursing_notes_pharmacy_id_fkey;
      ALTER TABLE nursing_notes DROP CONSTRAINT IF EXISTS nursing_notes_nurse_id_fkey;
      ALTER TABLE nursing_notes DROP CONSTRAINT IF EXISTS nursing_notes_admission_id_fkey;
      ALTER TABLE nursing_notes DROP CONSTRAINT IF EXISTS nursing_notes_visit_id_fkey;
      ALTER TABLE nursing_notes DROP CONSTRAINT IF EXISTS nursing_notes_patient_id_fkey;
      ALTER TABLE nursing_notes ALTER COLUMN pharmacy_id TYPE VARCHAR(150) USING pharmacy_id::VARCHAR;
      ALTER TABLE nursing_notes ALTER COLUMN admission_id TYPE VARCHAR(150) USING admission_id::VARCHAR;
      ALTER TABLE nursing_notes ALTER COLUMN visit_id TYPE VARCHAR(150) USING visit_id::VARCHAR;
      ALTER TABLE nursing_notes ALTER COLUMN patient_id TYPE VARCHAR(150) USING patient_id::VARCHAR;
      ALTER TABLE nursing_notes ALTER COLUMN nurse_id TYPE VARCHAR(150) USING nurse_id::VARCHAR;
    `);
    const rawPharmId = req.pharmacy_id || req.user?.pharmacy_id;
    const result = await pool.query(`
      SELECT nn.*, COALESCE(u.full_name, 'Clinician') as nurse_name
      FROM nursing_notes nn
      LEFT JOIN users u ON nn.nurse_id::text = u.id::text
      WHERE (
        nn.admission_id::text = $1 OR 
        nn.visit_id::text = $1 OR 
        nn.patient_id::text = $1
      ) AND ($2::text = '' OR nn.pharmacy_id::text = $2::text OR nn.pharmacy_id IS NULL)
      ORDER BY nn.created_at DESC
    `, [rawParam, String(rawPharmId || '')]);
    return successResponse(res, 200, "Nursing notes fetched", result.rows);
  } catch (error) {
    return errorResponse(res, 500, "Failed to fetch nursing notes: " + error.message);
  }
});

// Add drug order for inpatient (+ auto-bill)
router.post('/visit/:visit_id/orders', async (req, res) => {
  const client = await pool.connect();
  try {
    const { drug_name, dosage, route, frequency, duration, quantity, instructions, product_id, consultation_id } = req.body;
    if (!drug_name) return errorResponse(res, 400, 'Drug name required');

    const pharmacyId = req.pharmacy_id || req.user?.pharmacy_id || null;
    const userId = req.user?.id || null;
    const visitId = req.params.visit_id;

    // Ensure nullable columns accept nulls without failing
    try {
      await client.query(`
        ALTER TABLE prescriptions ALTER COLUMN consultation_id DROP NOT NULL;
        ALTER TABLE prescriptions ALTER COLUMN doctor_id DROP NOT NULL;
        ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS product_id VARCHAR(150);
        ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0;
      `);
    } catch(e) {}

    await client.query('BEGIN');

    const visit = await client.query(
      'SELECT patient_id FROM visits WHERE id::text=$1::text AND (pharmacy_id::text=$2::text OR pharmacy_id IS NULL)',
      [String(visitId), pharmacyId ? String(pharmacyId) : null]
    );
    if (!visit.rows[0]) {
      await client.query('ROLLBACK');
      return errorResponse(res, 404, 'Visit not found');
    }
    const patientId = String(visit.rows[0].patient_id);

    // Ensure visit status is updated to inpatient
    await client.query("UPDATE visits SET status='inpatient', updated_at=NOW() WHERE id::text=$1::text", [String(visitId)]);

    const result = await client.query(`
      INSERT INTO injection_room_orders (
        pharmacy_id, visit_id, patient_id, consultation_id, prescribed_by,
        drug_name, dosage, route, frequency, duration, quantity, instructions, product_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *
    `, [
      pharmacyId ? String(pharmacyId) : null,
      String(visitId),
      patientId,
      consultation_id ? String(consultation_id) : null,
      userId ? String(userId) : null,
      drug_name,
      dosage || null,
      route || 'IV',
      frequency || null,
      duration || null,
      quantity ? String(quantity) : null,
      instructions || null,
      product_id ? String(product_id) : null
    ]);

    // Auto-bill for the prescribed inpatient medication
    let drugPrice = 0;
    if (product_id) {
      const prodRes = await client.query('SELECT selling_price FROM products WHERE id::text=$1::text', [String(product_id)]);
      drugPrice = parseFloat(prodRes.rows[0]?.selling_price || 0);
    } else {
      const prodRes = await client.query(
        'SELECT selling_price FROM products WHERE LOWER(name)=LOWER($1) AND (pharmacy_id::text=$2::text OR pharmacy_id IS NULL) LIMIT 1',
        [drug_name.trim(), pharmacyId ? String(pharmacyId) : null]
      );
      drugPrice = parseFloat(prodRes.rows[0]?.selling_price || 0);
    }

    const orderQty = parseFloat(quantity || 1) || 1;
    const itemName = `${drug_name} ${dosage||''}`.trim();

    // Link/insert into prescriptions table for pharmacy queue
    try {
      await client.query(`
        INSERT INTO prescriptions (
          pharmacy_id, visit_id, patient_id, consultation_id, doctor_id,
          drug_name, dosage, route, frequency, duration, quantity, instructions, product_id, price, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending')
      `, [
        pharmacyId ? String(pharmacyId) : null,
        String(visitId),
        patientId,
        consultation_id ? String(consultation_id) : null,
        userId ? String(userId) : null,
        drug_name,
        dosage || null,
        route || 'IV',
        frequency || null,
        duration || null,
        orderQty,
        instructions || null,
        product_id ? String(product_id) : null,
        drugPrice
      ]);
    } catch (pErr) {
      console.error('Prescription sync notice:', pErr.message);
    }

    await client.query(`
      INSERT INTO billing_items (facility_id, pharmacy_id, visit_id, patient_id, item_name, description, item_type, unit_price, quantity, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'prescription', $7, $8, 'pending')
    `, [
      pharmacyId ? String(pharmacyId) : null,
      pharmacyId ? String(pharmacyId) : null,
      String(visitId),
      patientId,
      itemName,
      itemName,
      drugPrice,
      orderQty
    ]);

    await client.query('COMMIT');
    return successResponse(res, 201, 'Drug order added and auto-billed', result.rows[0]);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (rErr) {}
    return errorResponse(res, 500, 'Failed to add order: ' + error.message);
  } finally { client.release(); }
});

// Administer drug to inpatient + deduct stock + update billing
router.put('/orders/:order_id/administer', async (req, res) => {
  const client = await pool.connect();
  try {
    const { notes, nurse_report } = req.body;
    const finalReport = nurse_report || notes || '';
    const userId = req.user?.id || null;
    const StockModel = require('../models/stock.model');

    const order = await client.query(
      'SELECT * FROM injection_room_orders WHERE id::text=$1',
      [String(req.params.order_id)]
    );
    if (!order.rows[0]) {
      client.release();
      return errorResponse(res, 404, 'Order not found');
    }
    const o = order.rows[0];
    const pharmacyId = req.pharmacy_id || o.pharmacy_id || 1;

    await client.query('BEGIN');

    // Make sure column exists
    try { await client.query('ALTER TABLE injection_room_orders ADD COLUMN IF NOT EXISTS administered_count INTEGER DEFAULT 0'); } catch(e){}

    const currentCount = (o.administered_count || 0) + 1;
    let targetDays = parseInt(o.duration || 1);
    if (isNaN(targetDays) || targetDays < 1) targetDays = 1;

    const isFullyCompleted = currentCount >= targetDays;
    const newStatus = isFullyCompleted ? 'administered' : 'in_progress';

    let resultRow;
    try {
      await client.query('SAVEPOINT inp_sp1');
      const res1 = await client.query(`
        UPDATE injection_room_orders 
        SET status=$1, administered_by=$2, administered_at=NOW(), notes=$3, nurse_report=$3, 
            administered_count = COALESCE(administered_count, 0) + 1, updated_at=NOW()
        WHERE id::text=$4 RETURNING *
      `, [newStatus, String(userId), finalReport, String(req.params.order_id)]);
      resultRow = res1.rows[0];
      await client.query('RELEASE SAVEPOINT inp_sp1');
    } catch (uErr) {
      try { await client.query('ROLLBACK TO SAVEPOINT inp_sp1'); } catch(r){}
      const res2 = await client.query(`
        UPDATE injection_room_orders 
        SET status=$1, administered_by=$2, administered_at=NOW(), notes=$3, 
            administered_count = COALESCE(administered_count, 0) + 1, updated_at=NOW()
        WHERE id::text=$4 RETURNING *
      `, [newStatus, String(userId), finalReport, String(req.params.order_id)]);
      resultRow = res2.rows[0];
    }

    let drugPrice = 0;
    try {
      await client.query('SAVEPOINT inp_price_sp');
      if (o.product_id) {
        const prodRes = await client.query('SELECT selling_price FROM products WHERE id::text=$1', [String(o.product_id)]);
        drugPrice = parseFloat(prodRes.rows[0]?.selling_price || 0);
      } else {
        const prodRes = await client.query('SELECT selling_price FROM products WHERE LOWER(name)=LOWER($1) AND (pharmacy_id::text=$2::text OR pharmacy_id IS NULL) LIMIT 1', [o.drug_name.trim(), String(pharmacyId)]);
        drugPrice = parseFloat(prodRes.rows[0]?.selling_price || 0);
      }
      await client.query('RELEASE SAVEPOINT inp_price_sp');
    } catch (e) {
      try { await client.query('ROLLBACK TO SAVEPOINT inp_price_sp'); } catch(r){}
    }

    const singleDoseQty = 1; // Administer 1 daily dose unit per click
    const itemName = `${o.drug_name} ${o.dosage||''}`.trim();

    // Bill for the administered dose
    try {
      await client.query('SAVEPOINT inp_bill_sp');
      const alreadyBilled = await client.query(`
        SELECT id, unit_price, quantity FROM billing_items
        WHERE visit_id::text = $1 AND status != 'cancelled'
          AND (
            LOWER(TRIM(COALESCE(item_name, description))) = LOWER(TRIM($2))
            OR LOWER(TRIM(COALESCE(item_name, description))) = LOWER(TRIM($3))
            OR LOWER(TRIM(COALESCE(item_name, description))) LIKE LOWER(TRIM($4))
          )
        LIMIT 1
      `, [String(o.visit_id), itemName, o.drug_name.trim(), '%' + o.drug_name.trim() + '%']);

      if (alreadyBilled.rows[0]) {
        const existingItem = alreadyBilled.rows[0];
        const newQty = (parseFloat(existingItem.quantity) || 0) + singleDoseQty;
        const newUnitPrice = Math.max(parseFloat(existingItem.unit_price) || 0, drugPrice);
        await client.query(`
          UPDATE billing_items 
          SET quantity = $1, unit_price = $2, total_price = $1 * $2, updated_at = NOW()
          WHERE id::text = $3
        `, [newQty, newUnitPrice, String(existingItem.id)]);
      } else {
        await client.query(`
          INSERT INTO billing_items (facility_id, pharmacy_id, visit_id, patient_id, item_name, description, item_type, unit_price, quantity, status)
          VALUES ($1, $2, $3, $4, $5, $6, 'prescription', $7, $8, 'pending')
        `, [pharmacyId, pharmacyId, String(o.visit_id), String(o.patient_id), itemName, itemName, drugPrice, singleDoseQty]);
      }
      await client.query('RELEASE SAVEPOINT inp_bill_sp');
    } catch (bErr) {
      try { await client.query('ROLLBACK TO SAVEPOINT inp_bill_sp'); } catch(r){}
    }

    if (o.product_id) {
      try {
        await client.query('SAVEPOINT inp_stock_sp');
        await StockModel.deductStock(o.product_id, singleDoseQty, client, pharmacyId);
        await client.query(`
          INSERT INTO stock_movements (product_id, user_id, movement_type, quantity, notes, pharmacy_id)
          VALUES ($1,$2,'sale',$3,$4,$5)
        `, [o.product_id, userId, -singleDoseQty, 'Inpatient Daily Dose: ' + o.drug_name, pharmacyId]);
        await client.query('RELEASE SAVEPOINT inp_stock_sp');
      } catch (sErr) {
        try { await client.query('ROLLBACK TO SAVEPOINT inp_stock_sp'); } catch(r){}
      }
    }

    await client.query('COMMIT');
    return successResponse(res, 200, 'Drug administered & record updated', resultRow);
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch(r){}
    return errorResponse(res, 500, 'Failed to administer: ' + error.message);
  } finally { client.release(); }
});

// Get drug orders for inpatient visit
router.get('/visit/:visit_id/orders', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT iro.*, u.full_name as administered_by_name, p.full_name as prescribed_by_name
      FROM injection_room_orders iro
      LEFT JOIN users u ON iro.administered_by::text = u.id::text
      LEFT JOIN users p ON iro.prescribed_by::text = p.id::text
      WHERE iro.visit_id::text = $1::text AND (iro.pharmacy_id::text = $2::text OR iro.pharmacy_id IS NULL)
      ORDER BY iro.created_at DESC
    `, [req.params.visit_id, req.pharmacy_id]);
    return successResponse(res, 200, 'Orders fetched', result.rows);
  } catch (error) {
    return errorResponse(res, 500, 'Failed to fetch orders: ' + error.message);
  }
});

// GET all procedures for inpatient visit
router.get('/visit/:visit_id/procedures', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, u.full_name as doctor_name
      FROM procedures p
      LEFT JOIN users u ON p.doctor_id::text = u.id::text
      WHERE p.visit_id::text = $1::text AND (p.pharmacy_id::text = $2::text OR p.pharmacy_id IS NULL)
      ORDER BY p.created_at DESC
    `, [req.params.visit_id, req.pharmacy_id]);
    return successResponse(res, 200, 'Procedures fetched', result.rows);
  } catch (error) {
    return errorResponse(res, 500, 'Failed to fetch procedures: ' + error.message);
  }
});

// POST add new procedure for inpatient visit (+ auto-bill)
router.post('/visit/:visit_id/procedures', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { procedure_name, procedure_code, notes } = req.body;
    if (!procedure_name) return errorResponse(res, 400, 'Procedure name required');

    const visit = await client.query('SELECT patient_id FROM visits WHERE id=$1 AND pharmacy_id=$2', [req.params.visit_id, req.pharmacy_id]);
    if (!visit.rows[0]) return errorResponse(res, 404, 'Visit not found');
    const patientId = visit.rows[0].patient_id;

    // Save procedure
    const result = await client.query(`
      INSERT INTO procedures (pharmacy_id, visit_id, patient_id, doctor_id, procedure_name, procedure_code, notes, outcome)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending administration')
      RETURNING *
    `, [req.pharmacy_id, req.params.visit_id, patientId, req.user.id, procedure_name, procedure_code||null, notes||null]);

    // Lookup service price for procedure
    const priceRow = await client.query(`
      SELECT price FROM service_prices
      WHERE pharmacy_id=$1 AND is_active=true
        AND (service_code=$2 OR LOWER(name)=LOWER($3))
      ORDER BY (service_code=$2) DESC LIMIT 1
    `, [req.pharmacy_id, procedure_code||'', procedure_name]);
    const procPrice = priceRow.rows[0]?.price || 0;

    // Check if already billed
    const alreadyBilled = await client.query(`
      SELECT id FROM billing_items
      WHERE visit_id=$1 AND item_name=$2 AND status='pending' LIMIT 1
    `, [req.params.visit_id, procedure_name]);

    if (!alreadyBilled.rows[0]) {
      await client.query(`
        INSERT INTO billing_items (facility_id, visit_id, patient_id, item_name, item_type, unit_price, quantity, status)
        VALUES ($1, $2, $3, $4, 'procedure', $5, 1, 'pending')
      `, [req.pharmacy_id, req.params.visit_id, patientId, procedure_name, procPrice]);
    }

    await client.query('COMMIT');
    return successResponse(res, 201, 'Procedure added and billed', result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    return errorResponse(res, 500, 'Failed to add procedure: ' + error.message);
  } finally { client.release(); }
});

// GET all lab requests for inpatient visit
router.get('/visit/:visit_id/lab-requests', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT lr.*, u.full_name as doctor_name, t.full_name as technician_name
      FROM lab_requests lr
      LEFT JOIN users u ON lr.doctor_id = u.id
      LEFT JOIN users t ON lr.resulted_by = t.id
      WHERE lr.visit_id::text = $1::text AND (lr.pharmacy_id::text = $2::text OR lr.pharmacy_id IS NULL)
      ORDER BY lr.created_at DESC
    `, [req.params.visit_id, req.pharmacy_id]);
    return successResponse(res, 200, 'Lab requests fetched', result.rows);
  } catch (error) {
    return errorResponse(res, 500, 'Failed to fetch lab requests: ' + error.message);
  }
});

// POST add new lab request for inpatient visit (+ auto-bill)
router.post('/visit/:visit_id/lab-requests', async (req, res) => {
  const client = await pool.connect();
  try {
    const { test_name, test_code, notes, urgency } = req.body;
    if (!test_name) return errorResponse(res, 400, 'Test name required');

    const pharmacyId = req.pharmacy_id || req.user?.pharmacy_id || null;
    const userId = req.user?.id || null;
    const visitId = req.params.visit_id;

    try {
      await client.query(`
        ALTER TABLE lab_requests ALTER COLUMN consultation_id DROP NOT NULL;
        ALTER TABLE lab_requests ALTER COLUMN doctor_id DROP NOT NULL;
      `);
    } catch(e) {}

    await client.query('BEGIN');

    const visit = await client.query(
      'SELECT patient_id FROM visits WHERE id::text=$1::text AND (pharmacy_id::text=$2::text OR pharmacy_id IS NULL)',
      [String(visitId), pharmacyId ? String(pharmacyId) : null]
    );
    if (!visit.rows[0]) {
      await client.query('ROLLBACK');
      return errorResponse(res, 404, 'Visit not found');
    }
    const patientId = String(visit.rows[0].patient_id);

    // Ensure visit status is updated to inpatient
    await client.query("UPDATE visits SET status='inpatient', updated_at=NOW() WHERE id::text=$1::text", [String(visitId)]);

    const labNotes = notes ? `[Inpatient Ward] ${notes}` : '[Inpatient Ward]';

    // Save lab request
    const result = await client.query(`
      INSERT INTO lab_requests (pharmacy_id, visit_id, patient_id, doctor_id, test_name, test_code, urgency, notes, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
      RETURNING *
    `, [
      pharmacyId ? String(pharmacyId) : null,
      String(visitId),
      patientId,
      userId ? String(userId) : null,
      test_name,
      test_code || null,
      urgency || 'routine',
      labNotes
    ]);

    // Lookup service price for lab test
    const priceRow = await client.query(`
      SELECT price FROM service_prices
      WHERE (pharmacy_id::text=$1::text OR pharmacy_id IS NULL) AND is_active=true
        AND (service_code=$2 OR LOWER(name)=LOWER($3))
      ORDER BY (service_code=$2) DESC LIMIT 1
    `, [pharmacyId ? String(pharmacyId) : null, test_code || '', test_name]);
    const labPrice = parseFloat(priceRow.rows[0]?.price || 0);

    // Check if already billed
    const alreadyBilled = await client.query(`
      SELECT id FROM billing_items
      WHERE visit_id::text=$1::text AND LOWER(TRIM(item_name))=LOWER(TRIM($2)) AND status='pending' LIMIT 1
    `, [String(visitId), test_name]);

    if (!alreadyBilled.rows[0]) {
      await client.query(`
        INSERT INTO billing_items (facility_id, pharmacy_id, visit_id, patient_id, item_name, description, item_type, unit_price, quantity, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'laboratory', $7, 1, 'pending')
      `, [
        pharmacyId ? String(pharmacyId) : null,
        pharmacyId ? String(pharmacyId) : null,
        String(visitId),
        patientId,
        test_name,
        test_name,
        labPrice
      ]);
    }

    await client.query('COMMIT');
    return successResponse(res, 201, 'Lab request added and billed', result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    return errorResponse(res, 500, 'Failed to add lab request: ' + error.message);
  } finally { client.release(); }
});

// PUT complete a procedure
router.put('/procedures/:procedure_id/complete', async (req, res) => {
  try {
    const { outcome, notes } = req.body;
    if (!outcome) return errorResponse(res, 400, 'Outcome details are required to complete a procedure');
    
    const result = await pool.query(`
      UPDATE procedures
      SET outcome = $1, notes = COALESCE($2, notes)
      WHERE id = $3 AND pharmacy_id = $4
      RETURNING *
    `, [outcome, notes || null, req.params.procedure_id, req.pharmacy_id]);

    if (!result.rows[0]) return errorResponse(res, 404, 'Procedure not found');
    return successResponse(res, 200, 'Procedure marked as completed', result.rows[0]);
  } catch (error) {
    return errorResponse(res, 500, 'Failed to complete procedure: ' + error.message);
  }
});

// PUT update admission notes and management plan
router.put('/admissions/:admission_id/management-plan', async (req, res) => {
  try {
    const { admission_notes, management_plan } = req.body;
    try {
      await pool.query(`ALTER TABLE inpatient_admissions ADD COLUMN IF NOT EXISTS admission_notes TEXT`);
      await pool.query(`ALTER TABLE inpatient_admissions ADD COLUMN IF NOT EXISTS management_plan TEXT`);
    } catch(e){}

    const result = await pool.query(`
      UPDATE inpatient_admissions
      SET admission_notes = COALESCE($1, admission_notes),
          management_plan = COALESCE($2, management_plan),
          updated_at = NOW()
      WHERE id = $3 AND pharmacy_id = $4
      RETURNING *
    `, [admission_notes, management_plan, req.params.admission_id, req.pharmacy_id]);

    if (!result.rows[0]) return errorResponse(res, 404, 'Admission record not found');
    return successResponse(res, 200, 'Admission notes & management plan updated', result.rows[0]);
  } catch (error) {
    return errorResponse(res, 500, 'Failed to update management plan: ' + error.message);
  }
});

// GET all active inpatient drug orders for pharmacy queue
router.get('/pharmacy-queue', async (req, res) => {
  try {
    const pharmacyId = req.pharmacy_id || req.user?.pharmacy_id || null;
    const result = await pool.query(`
      SELECT 
        iro.id,
        iro.visit_id,
        iro.patient_id,
        iro.drug_name,
        iro.dosage,
        iro.frequency,
        iro.duration,
        iro.route,
        iro.quantity,
        iro.instructions,
        iro.product_id,
        iro.created_at,
        p.full_name as patient_name,
        p.patient_number,
        p.gender,
        COALESCE(p.allergies, '') as allergies,
        w.name as ward_name,
        b.bed_number,
        u.full_name as doctor_name
      FROM injection_room_orders iro
      JOIN visits v ON iro.visit_id::text = v.id::text
      LEFT JOIN patients p ON (iro.patient_id::text = p.id::text OR v.patient_id::text = p.id::text)
      LEFT JOIN inpatient_admissions ia ON ia.visit_id::text = v.id::text AND ia.status = 'admitted'
      LEFT JOIN beds b ON (b.current_visit_id::text = v.id::text AND b.status = 'occupied') OR (ia.bed_id::text = b.id::text)
      LEFT JOIN wards w ON b.ward_id::text = w.id::text
      LEFT JOIN users u ON iro.prescribed_by::text = u.id::text
      WHERE ($1::text IS NULL OR iro.pharmacy_id::text = $1::text OR iro.pharmacy_id IS NULL)
        AND (iro.status = 'pending' OR iro.status IS NULL)
        AND (v.status = 'inpatient' OR LOWER(COALESCE(v.visit_type, '')) = 'inpatient' OR (ia.id IS NOT NULL AND ia.status = 'admitted') OR (b.id IS NOT NULL AND b.status = 'occupied'))

      UNION ALL

      SELECT 
        pr.id,
        pr.visit_id,
        pr.patient_id,
        pr.drug_name,
        pr.dosage,
        pr.frequency,
        pr.duration,
        pr.route,
        pr.quantity,
        pr.instructions,
        pr.product_id,
        pr.created_at,
        p.full_name as patient_name,
        p.patient_number,
        p.gender,
        COALESCE(p.allergies, '') as allergies,
        w.name as ward_name,
        b.bed_number,
        u.full_name as doctor_name
      FROM prescriptions pr
      JOIN visits v ON pr.visit_id::text = v.id::text
      LEFT JOIN patients p ON (pr.patient_id::text = p.id::text OR v.patient_id::text = p.id::text)
      LEFT JOIN inpatient_admissions ia ON ia.visit_id::text = v.id::text AND ia.status = 'admitted'
      LEFT JOIN beds b ON (b.current_visit_id::text = v.id::text AND b.status = 'occupied') OR (ia.bed_id::text = b.id::text)
      LEFT JOIN wards w ON b.ward_id::text = w.id::text
      LEFT JOIN users u ON pr.doctor_id::text = u.id::text
      WHERE ($1::text IS NULL OR pr.pharmacy_id::text = $1::text OR pr.pharmacy_id IS NULL)
        AND (pr.status = 'pending' OR pr.status IS NULL)
        AND (v.status = 'inpatient' OR LOWER(COALESCE(v.visit_type, '')) = 'inpatient' OR (ia.id IS NOT NULL AND ia.status = 'admitted') OR (b.id IS NOT NULL AND b.status = 'occupied'))
        AND NOT EXISTS (
          SELECT 1 FROM injection_room_orders iro2 
          WHERE iro2.visit_id::text = pr.visit_id::text 
            AND LOWER(TRIM(iro2.drug_name)) = LOWER(TRIM(pr.drug_name))
        )
      ORDER BY created_at DESC
      LIMIT 200
    `, [pharmacyId]);
    
    const visitsMap = {};
    for (const row of result.rows) {
      if (!visitsMap[row.visit_id]) {
        visitsMap[row.visit_id] = {
          id: row.visit_id,
          visit_id: row.visit_id,
          patient_name: row.patient_name,
          patient_number: row.patient_number,
          gender: row.gender,
          allergies: row.allergies,
          ward_name: row.ward_name,
          bed_number: row.bed_number,
          doctor_name: row.doctor_name,
          visit_status: 'inpatient',
          is_inpatient: true,
          prescriptions: []
        };
      }
      visitsMap[row.visit_id].prescriptions.push(row);
    }
    
    return successResponse(res, 200, 'Inpatient pharmacy queue fetched', Object.values(visitsMap));
  } catch (error) {
    return errorResponse(res, 500, 'Failed to fetch inpatient queue: ' + error.message);
  }
});

router.syncInpatientBedCharges = syncInpatientBedCharges;
module.exports = router;
