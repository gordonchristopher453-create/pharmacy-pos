const { pool } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

// WHO Kenya schedule: vaccine → doses + intervals in days
const VACCINE_SCHEDULE = {
  BCG:        { doses:1, intervals:[], at_birth:true },
  OPV0:       { doses:1, intervals:[], at_birth:true },
  OPV1:       { doses:1, intervals:[42], at_birth:false },
  OPV2:       { doses:1, intervals:[42,70], at_birth:false },
  OPV3:       { doses:1, intervals:[42,70,98], at_birth:false },
  IPV:        { doses:1, intervals:[98], at_birth:false },
  Penta1:     { doses:1, intervals:[42], at_birth:false },
  Penta2:     { doses:1, intervals:[70], at_birth:false },
  Penta3:     { doses:1, intervals:[98], at_birth:false },
  PCV1:       { doses:1, intervals:[42], at_birth:false },
  PCV2:       { doses:1, intervals:[70], at_birth:false },
  PCV3:       { doses:1, intervals:[98], at_birth:false },
  Rota1:      { doses:1, intervals:[42], at_birth:false },
  Rota2:      { doses:1, intervals:[70], at_birth:false },
  Measles1:   { doses:1, intervals:[270], at_birth:false },
  Measles2:   { doses:1, intervals:[540], at_birth:false },
  Rubella:    { doses:1, intervals:[270], at_birth:false },
  VitaminA1:  { doses:1, intervals:[180], at_birth:false },
  VitaminA2:  { doses:1, intervals:[360], at_birth:false },
  TT1:        { doses:1, intervals:[], at_birth:false },
  TT2:        { doses:1, intervals:[28], at_birth:false },
  TT3:        { doses:1, intervals:[180], at_birth:false },
  TT4:        { doses:1, intervals:[365], at_birth:false },
  TT5:        { doses:1, intervals:[730], at_birth:false },
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

// ── Administer vaccine ─────────────────────────────────────
const administerVaccine = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pid = req.pharmacy_id;
    const {
      patient_id, visit_id, vaccine_order_id,
      vaccine_name, vaccine_code, dose_number,
      batch_number, expiry_date, site, route,
      administered_date, next_due_date,
      adverse_reaction, notes,
    } = req.body;

    if (!patient_id || !vaccine_name) return errorResponse(res, 400, 'patient_id and vaccine_name required');

    // 1. Record vaccination
    const result = await client.query(`
      INSERT INTO vaccinations (
        pharmacy_id, patient_id, visit_id, vaccine_order_id,
        vaccine_name, vaccine_code, dose_number,
        batch_number, expiry_date, site, route,
        administered_at, next_due_date,
        adverse_reaction, notes, administered_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
        COALESCE($12,NOW()),$13,$14,$15,$16) RETURNING *
    `, [
      pid, patient_id, visit_id||null, vaccine_order_id||null,
      vaccine_name, vaccine_code||null, dose_number||1,
      batch_number||null, expiry_date||null, site||null, route||null,
      administered_date, next_due_date||null,
      adverse_reaction||null, notes||null, req.user.id,
    ]);
    const vaccination = result.rows[0];

    // 2. Deduct stock from immunization store
    if (batch_number) {
      await client.query(`
        UPDATE stock SET quantity=quantity-1, updated_at=NOW()
        WHERE pharmacy_id=$1 AND department='immunization'
          AND batch_number=$2
          AND quantity > 0
      `, [pid, batch_number]);

      await client.query(`
        INSERT INTO stock_movements (product_id, user_id, movement_type, quantity, batch_number, notes, pharmacy_id, department)
        SELECT s.product_id, $1, 'dispense', -1, $2, $3, $4, 'immunization'
        FROM stock s WHERE s.pharmacy_id=$4 AND s.batch_number=$2 LIMIT 1
      `, [req.user.id, batch_number, `Vaccine: ${vaccine_name} → Patient ${patient_id}`, pid]);
    }

    // 3. Update vaccine_order status if linked
    if (vaccine_order_id) {
      await client.query(`
        UPDATE vaccine_orders SET status='administered', administered_by=$1, administered_at=NOW(), updated_at=NOW()
        WHERE id=$2 AND pharmacy_id=$3
      `, [req.user.id, vaccine_order_id, pid]);
      await client.query(`
        UPDATE service_orders SET status='Completed', fulfilled_by=$1, fulfilled_at=NOW(), updated_at=NOW()
        WHERE id=(SELECT service_order_id FROM vaccine_orders WHERE id=$2) AND pharmacy_id=$3
      `, [req.user.id, vaccine_order_id, pid]);
      // Mark billing paid
      await client.query(`
        UPDATE billing_items SET status='paid', payment_method='included', paid_at=NOW()
        WHERE service_order_id=(SELECT service_order_id FROM vaccine_orders WHERE id=$1) AND pharmacy_id=$2
      `, [vaccine_order_id, pid]);
    }

    // 4. Calculate next due dates for follow-up vaccines
    const schedule = VACCINE_SCHEDULE[vaccine_name];
    let nextDue = next_due_date || null;
    if (!nextDue && schedule) {
      const doseIdx = (dose_number||1);
      const nextInterval = schedule.intervals[doseIdx];
      if (nextInterval && administered_date) {
        nextDue = addDays(administered_date, nextInterval);
        await client.query(`UPDATE vaccinations SET next_due_date=$1 WHERE id=$2`, [nextDue, vaccination.id]);
      }
    }

    // 5. Audit
    await client.query(`
      INSERT INTO audit_trail (pharmacy_id, user_id, action, entity_type, entity_id, new_values)
      VALUES ($1,$2,'vaccine_administered','vaccination',$3,$4)
    `, [pid, req.user.id, vaccination.id, JSON.stringify({ vaccine_name, patient_id, batch_number })]);

    await client.query('COMMIT');
    const io = req.app.get('io');
    if (io) io.emit(`vaccine_administered_${pid}`, { vaccination, next_due: nextDue });
    return successResponse(res, 201, 'Vaccine administered', { vaccination, next_due: nextDue });
  } catch (e) {
    await client.query('ROLLBACK');
    logger.error('Administer vaccine error:', e.message);
    return errorResponse(res, 500, e.message);
  } finally { client.release(); }
};

// ── Get immunization history for a patient ─────────────────
const getImmunizationHistory = async (req, res) => {
  try {
    const { patient_id } = req.params;
    const result = await pool.query(`
      SELECT vc.*, u.full_name as administered_by_name
      FROM vaccinations vc
      LEFT JOIN users u ON vc.administered_by=u.id
      WHERE vc.patient_id=$1 AND vc.pharmacy_id=$2
      ORDER BY vc.administered_at DESC
    `, [patient_id, req.pharmacy_id]);

    // Calculate due/missed vaccines
    const patientRes = await pool.query(`SELECT date_of_birth FROM patients WHERE id=$1`, [patient_id]);
    const dob = patientRes.rows[0]?.date_of_birth;
    const given = result.rows.map(r => r.vaccine_name);
    const schedule = [];
    if (dob) {
      for (const [vax, info] of Object.entries(VACCINE_SCHEDULE)) {
        const due_date = info.at_birth
          ? new Date(dob).toISOString().split('T')[0]
          : info.intervals[0]
            ? addDays(dob, info.intervals[0])
            : null;
        const administered = result.rows.find(r => r.vaccine_name === vax);
        const overdue = due_date && !administered && new Date(due_date) < new Date();
        schedule.push({
          vaccine: vax,
          due_date,
          administered: !!administered,
          administered_at: administered?.administered_at || null,
          overdue,
        });
      }
    }

    return successResponse(res, 200, 'Immunization history', {
      vaccinations: result.rows,
      schedule,
      given_count: given.length,
      pending_count: schedule.filter(s => !s.administered).length,
      overdue_count: schedule.filter(s => s.overdue).length,
    });
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── Immunization queue (pending vaccine orders) ────────────
const getImmunizationQueue = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT vo.*, v.visit_number, p.full_name as patient_name,
             p.patient_number, p.date_of_birth,
             u.full_name as ordered_by_name
      FROM vaccine_orders vo
      LEFT JOIN visits v ON vo.visit_id=v.id
      LEFT JOIN patients p ON vo.patient_id=p.id
      LEFT JOIN users u ON vo.ordered_by=u.id
      WHERE vo.pharmacy_id=$1 AND vo.status='Pending'
      ORDER BY vo.created_at DESC
    `, [req.pharmacy_id]);
    return successResponse(res, 200, 'Immunization queue', result.rows);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── Get vaccine stock (immunization store) ─────────────────
const getVaccineStock = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, p.name as product_name, p.generic_name
      FROM stock s
      LEFT JOIN products p ON s.product_id=p.id
      WHERE s.pharmacy_id=$1 AND s.department='immunization'
        AND s.quantity > 0
      ORDER BY s.expiry_date ASC
    `, [req.pharmacy_id]);

    const expiringSoon = result.rows.filter(r => {
      if (!r.expiry_date) return false;
      const daysLeft = Math.ceil((new Date(r.expiry_date) - new Date()) / (1000*60*60*24));
      return daysLeft <= 30;
    });

    return successResponse(res, 200, 'Vaccine stock', {
      stock: result.rows,
      expiring_soon: expiringSoon,
      total_vaccines: result.rows.length,
    });
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── Missed vaccine alerts ──────────────────────────────────
const getMissedVaccineAlerts = async (req, res) => {
  try {
    // Children born in last 2 years with overdue vaccines
    const result = await pool.query(`
      SELECT p.id as patient_id, p.full_name, p.patient_number, p.date_of_birth,
             mp.full_name as mother_name, mp.phone as mother_phone,
             ARRAY_AGG(DISTINCT vc.vaccine_name) as vaccines_given
      FROM patients p
      LEFT JOIN patients mp ON p.mother_id=mp.id
      LEFT JOIN vaccinations vc ON vc.patient_id=p.id AND vc.pharmacy_id=$1
      WHERE p.pharmacy_id=$1
        AND p.date_of_birth >= NOW() - INTERVAL '2 years'
        AND p.date_of_birth IS NOT NULL
      GROUP BY p.id, p.full_name, p.patient_number, p.date_of_birth, mp.full_name, mp.phone
      ORDER BY p.date_of_birth DESC
      LIMIT 100
    `, [req.pharmacy_id]);

    const alerts = result.rows.map(child => {
      const dob = child.date_of_birth;
      const given = child.vaccines_given?.filter(Boolean) || [];
      const overdue = [];
      for (const [vax, info] of Object.entries(VACCINE_SCHEDULE)) {
        if (given.includes(vax)) continue;
        const due = info.at_birth ? new Date(dob) : info.intervals[0] ? new Date(new Date(dob).getTime() + info.intervals[0]*86400000) : null;
        if (due && due < new Date()) overdue.push({ vaccine: vax, due_date: due.toISOString().split('T')[0] });
      }
      return { ...child, overdue_vaccines: overdue };
    }).filter(c => c.overdue_vaccines.length > 0);

    return successResponse(res, 200, 'Missed vaccine alerts', { alerts, total: alerts.length });
  } catch (e) { return errorResponse(res, 500, e.message); }
};

module.exports = {
  administerVaccine, getImmunizationHistory, getImmunizationQueue,
  getVaccineStock, getMissedVaccineAlerts,
};
