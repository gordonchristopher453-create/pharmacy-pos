const { pool } = require('../config/db');

class ServiceOrderModel {
  static async create({ pharmacy_id, visit_id, patient_id, order_type, priority='normal',
    ordered_by, ordered_by_dept, assigned_to_dept, notes,
    test_name, test_code, test_category, lab_price,
    product_id, drug_name, dosage, frequency, duration, quantity, instructions, drug_price,
    vaccine_name, vaccine_code, dose_number, site, route, next_due_date, vaccine_price,
  }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get department UUIDs
      const fromDeptRes = await client.query(
        `SELECT id FROM departments WHERE name ILIKE $1 AND pharmacy_id=$2 LIMIT 1`,
        [ordered_by_dept||'', pharmacy_id]
      );
      const toDeptRes = await client.query(
        `SELECT id FROM departments WHERE name ILIKE $1 AND pharmacy_id=$2 LIMIT 1`,
        [assigned_to_dept||'', pharmacy_id]
      );
      const fromDeptId = fromDeptRes.rows[0]?.id || null;
      const toDeptId   = toDeptRes.rows[0]?.id   || null;

      // Create service order using real schema
      const soResult = await client.query(`
        INSERT INTO service_orders (visit_id, facility_id, order_type, priority, requested_by, requested_department_id, target_department_id, clinical_notes, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Pending') RETURNING *
      `, [visit_id, pharmacy_id, order_type, priority, ordered_by||null, fromDeptId, toDeptId, notes||null]);
      const so = soResult.rows[0];

      let detail = null;
      let billDesc = '';
      let billPrice = 0;

      if (order_type === 'lab') {
        const labResult = await client.query(`
          INSERT INTO lab_requests (pharmacy_id, visit_id, patient_id, test_name, test_code, urgency, notes, status, doctor_id, price)
          VALUES ($1,$2,$3,$4,$5,'routine',$6,'pending',$7,$8) RETURNING *
        `, [pharmacy_id, visit_id, patient_id, test_name, test_code||null, notes||null, ordered_by||null, lab_price||0]);
        detail = labResult.rows[0];
        // Link lab request to service order so the trigger can bill it
        await client.query('UPDATE lab_requests SET service_order_id=$1 WHERE id=$2', [so.id, detail.id]);
        billDesc = `Lab: ${test_name}`;
        billPrice = lab_price || 0;

      } else if (order_type === 'prescription') {
        // If product_id is provided, look up drug_name and price from the product
        if (product_id) {
          const isUuid = typeof product_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(product_id);
          let prodRes;
          if (isUuid) {
            prodRes = await client.query('SELECT name, selling_price FROM products WHERE id = $1', [product_id]);
          } else {
            prodRes = await client.query('SELECT name, selling_price FROM products WHERE id::text = $1 OR barcode = $1', [String(product_id)]);
          }
          if (prodRes && prodRes.rows.length > 0) {
            drug_name = drug_name || prodRes.rows[0].name;
            drug_price = drug_price || prodRes.rows[0].selling_price;
          }
        }

        const rxResult = await client.query(`
          INSERT INTO prescriptions (pharmacy_id, visit_id, patient_id, product_id, drug_name, dosage, frequency, duration, quantity, instructions, doctor_id, price)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
        `, [pharmacy_id, visit_id, patient_id, product_id||null, drug_name, dosage||null,
            frequency||null, duration||null, quantity||1, instructions||null, ordered_by||null, drug_price||0]);
        detail = rxResult.rows[0];
        await client.query('UPDATE prescriptions SET service_order_id=$1 WHERE id=$2', [so.id, detail.id]);
        billDesc = `Drug: ${drug_name}${quantity>1?' x'+quantity:''}`;
        billPrice = (drug_price||0) * (quantity||1);

      } else if (order_type === 'vaccine') {
        const vxResult = await client.query(`
          INSERT INTO vaccine_orders (pharmacy_id, visit_id, patient_id, vaccine_name, vaccine_code, dose_number, site, route, next_due_date, ordered_by, price)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
        `, [pharmacy_id, visit_id, patient_id, vaccine_name, vaccine_code||null,
            dose_number||1, site||null, route||null, next_due_date||null, ordered_by||null, vaccine_price||0]);
        detail = vxResult.rows[0];
        await client.query('UPDATE vaccine_orders SET service_order_id=$1 WHERE id=$2', [so.id, detail.id]);
        billDesc = `Vaccine: ${vaccine_name}`;
        billPrice = vaccine_price || 0;
      }

      // Auto-generate billing item
      let billResult = { rows: [{}] };
      if (billDesc && billPrice > 0) {
        billResult = await client.query(`
          INSERT INTO billing_items (facility_id,visit_id,patient_id,item_type,item_name,quantity,unit_price,status,service_order_id)
          VALUES ($1,$2,$3,$4,$5,1,$6,'pending',$7) RETURNING *
        `, [pharmacy_id, visit_id, patient_id, order_type, billDesc, billPrice, so.id]);
      }

      // Audit
      await client.query(`
        INSERT INTO audit_log (pharmacy_id, table_name, record_id, action, changed_by, new_data, visit_id, patient_id)
        VALUES ($1,'service_orders',$2,'create',$3,$4,$5,$6)
      `, [pharmacy_id, String(so.id), ordered_by, JSON.stringify({ order_type, visit_id, patient_id }), visit_id, patient_id]);

      await client.query('COMMIT');
      return { service_order: so, detail, billing_item: billResult.rows[0] };
    } catch(e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }

  static async updateStatus(id, pharmacy_id, { status, fulfilled_by, result_notes }) {
    const result = await pool.query(`
      UPDATE service_orders SET status=$1, updated_at=NOW()
      WHERE id=$2 AND facility_id=$3 RETURNING *
    `, [status, id, pharmacy_id]);
    return result.rows[0];
  }

  static async findByVisit(visit_id, pharmacy_id) {
    const result = await pool.query(`
      SELECT so.*, u.full_name as requested_by_name,
             d1.name as from_dept, d2.name as to_dept
      FROM service_orders so
      LEFT JOIN users u ON so.requested_by=u.id
      LEFT JOIN departments d1 ON so.requested_department_id=d1.id
      LEFT JOIN departments d2 ON so.target_department_id=d2.id
      WHERE so.visit_id=$1 AND so.facility_id=$2 ORDER BY so.created_at DESC
    `, [visit_id, pharmacy_id]);
    return result.rows;
  }

  static async findByDept(dept_name, pharmacy_id, status) {
    const deptRes = await pool.query(
      `SELECT id FROM departments WHERE name ILIKE $1 AND pharmacy_id=$2 LIMIT 1`,
      [dept_name, pharmacy_id]
    );
    if (!deptRes.rows[0]) return [];
    let q = `
      SELECT so.*, v.visit_number, p.full_name as patient_name, p.patient_number,
             u.full_name as requested_by_name,
             d1.name as from_dept, d2.name as to_dept
      FROM service_orders so
      LEFT JOIN visits v ON so.visit_id=v.id
      LEFT JOIN patients p ON v.patient_id=p.id
      LEFT JOIN users u ON so.requested_by=u.id
      LEFT JOIN departments d1 ON so.requested_department_id=d1.id
      LEFT JOIN departments d2 ON so.target_department_id=d2.id
      WHERE so.target_department_id=$1 AND so.facility_id=$2
    `;
    const params = [deptRes.rows[0].id, pharmacy_id];
    if (status) { params.push(status); q += ` AND so.status=$${params.length}`; }
    q += ` ORDER BY so.created_at DESC LIMIT 100`;
    const result = await pool.query(q, params);
    return result.rows;
  }
}

module.exports = ServiceOrderModel;
