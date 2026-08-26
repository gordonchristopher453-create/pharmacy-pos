const { pool } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');

// ── Part 16: Visit Dashboard ──────────────────────────────
const getVisitDashboard = async (req, res) => {
  try {
    const pid = req.pharmacy_id;
    const today = new Date().toISOString().split('T')[0];

    const [visitStats, deptQueues, billing, recentAudit] = await Promise.all([
      // Visit counts by status and type
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status='open')        as open_visits,
          COUNT(*) FILTER (WHERE status='In Progress') as in_progress,
          COUNT(*) FILTER (WHERE status='discharged')  as discharged_today,
          COUNT(*) FILTER (WHERE visit_type='opd')     as opd,
          COUNT(*) FILTER (WHERE visit_type='anc')     as anc,
          COUNT(*) FILTER (WHERE visit_type='pnc')     as pnc,
          COUNT(*) FILTER (WHERE visit_type='emergency') as emergency,
          COUNT(*) FILTER (WHERE visit_type='immunization') as immunization,
          COUNT(*) FILTER (WHERE visit_type='cwc')     as cwc,
          COUNT(*)                                      as total_today
        FROM visits
        WHERE (pharmacy_id::text=$1::text OR pharmacy_id IS NULL) AND DATE(created_at)=$2
      `, [pid, today]),

      // Queue per department
      pool.query(`
        SELECT department, COUNT(*) as count
        FROM visits
        WHERE (pharmacy_id::text=$1::text OR pharmacy_id IS NULL) AND status='open'
        GROUP BY department ORDER BY count DESC
      `, [pid]),

      // Billing summary today
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE LOWER(status)='pending')  as pending_bills,
          COUNT(*) FILTER (WHERE LOWER(status) IN ('paid', 'insurance', 'nhif', 'sha')) as paid_bills,
          COALESCE(SUM(total_price) FILTER (WHERE LOWER(status) IN ('paid', 'insurance', 'nhif', 'sha')),0)    as revenue_today,
          COALESCE(SUM(total_price) FILTER (WHERE LOWER(status)='pending'),0) as outstanding
        FROM billing_items
        WHERE (facility_id::text=$1::text OR facility_id IS NULL) AND DATE(created_at)=$2
      `, [pid, today]),

      // Recent audit trail
      pool.query(`
        SELECT al.*, u.full_name as changed_by_name
        FROM audit_log al
        LEFT JOIN users u ON al.changed_by::text=u.id::text
        WHERE (al.pharmacy_id::text=$1::text OR al.pharmacy_id IS NULL)
        ORDER BY al.changed_at DESC LIMIT 20
      `, [pid]),
    ]);

    // Pending service orders by type
    const pendingOrders = await pool.query(`
      SELECT so.order_type, COUNT(*) as count,
             d.name as target_dept
      FROM service_orders so
      LEFT JOIN departments d ON so.target_department_id::text=d.id::text
      WHERE (so.facility_id::text=$1::text OR so.facility_id IS NULL) AND so.status='Pending'
      GROUP BY so.order_type, d.name
      ORDER BY count DESC
    `, [pid]);

    // Open visits with full details
    const openVisits = await pool.query(`
      SELECT v.*, p.full_name as patient_name, p.patient_number, p.gender,
        (SELECT COUNT(*) FROM lab_requests WHERE visit_id::text=v.id::text AND status='Pending')     as pending_labs,
        (SELECT COUNT(*) FROM prescriptions WHERE visit_id::text=v.id::text AND status='Pending')    as pending_drugs,
        (SELECT COUNT(*) FROM vaccine_orders WHERE visit_id::text=v.id::text AND status='Pending')   as pending_vaccines,
        (SELECT COUNT(*) FROM billing_items  WHERE visit_id::text=v.id::text AND status='Pending')   as pending_bills,
        (SELECT COALESCE(SUM(total_price),0) FROM billing_items WHERE visit_id::text=v.id::text)     as total_bill
      FROM visits v
      LEFT JOIN patients p ON v.patient_id::text=p.id::text
      WHERE (v.pharmacy_id::text=$1::text OR v.pharmacy_id IS NULL) AND v.status IN ('open','In Progress')
      ORDER BY v.created_at DESC
    `, [pid]);

    return successResponse(res, 200, 'Visit dashboard', {
      stats:          visitStats.rows[0],
      dept_queues:    deptQueues.rows,
      billing:        billing.rows[0],
      pending_orders: pendingOrders.rows,
      open_visits:    openVisits.rows,
      recent_audit:   recentAudit.rows,
    });
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── Part 18: Reports ──────────────────────────────────────

const getANCRegister = async (req, res) => {
  try {
    const { date_from, date_to, limit=100, offset=0 } = req.query;
    const pid = req.pharmacy_id;
    let q = `
      SELECT ar.*, p.full_name, p.patient_number, p.date_of_birth, p.phone,
             p.gender, av.weight, av.blood_pressure, av.hemoglobin,
             av.hiv_test, av.vdrl, av.visit_date as last_visit_date
      FROM anc_registrations ar
      LEFT JOIN patients p ON ar.patient_id::text=p.id::text
      LEFT JOIN LATERAL (
        SELECT * FROM anc_visits WHERE anc_id::text=ar.id::text ORDER BY visit_date DESC LIMIT 1
      ) av ON true
      WHERE (ar.pharmacy_id::text=$1::text OR ar.pharmacy_id IS NULL)
    `;
    const params = [pid];
    if (date_from) { params.push(date_from); q += ` AND DATE(ar.created_at)>=$${params.length}`; }
    if (date_to)   { params.push(date_to);   q += ` AND DATE(ar.created_at)<=$${params.length}`; }
    q += ` ORDER BY ar.created_at DESC`;
    params.push(limit);  q += ` LIMIT $${params.length}`;
    params.push(offset); q += ` OFFSET $${params.length}`;
    const result = await pool.query(q, params);
    return successResponse(res, 200, 'ANC Register', { data: result.rows, count: result.rows.length });
  } catch (e) { return errorResponse(res, 500, e.message); }
};

const getImmunizationRegister = async (req, res) => {
  try {
    const { date_from, date_to, vaccine_name, limit=100, offset=0 } = req.query;
    const pid = req.pharmacy_id;
    let q = `
      SELECT vc.*, p.full_name as patient_name, p.patient_number, p.date_of_birth,
             mp.full_name as mother_name, mp.phone as mother_phone,
             u.full_name as administered_by_name
      FROM vaccinations vc
      LEFT JOIN patients p ON vc.patient_id::text=p.id::text
      LEFT JOIN patients mp ON p.mother_id::text=mp.id::text
      LEFT JOIN users u ON vc.administered_by::text=u.id::text
      WHERE (vc.pharmacy_id::text=$1::text OR vc.pharmacy_id IS NULL)
    `;
    const params = [pid];
    if (date_from)    { params.push(date_from);    q += ` AND DATE(vc.administered_at)>=$${params.length}`; }
    if (date_to)      { params.push(date_to);      q += ` AND DATE(vc.administered_at)<=$${params.length}`; }
    if (vaccine_name) { params.push(vaccine_name); q += ` AND vc.vaccine_name=$${params.length}`; }
    q += ` ORDER BY vc.administered_at DESC`;
    params.push(limit);  q += ` LIMIT $${params.length}`;
    params.push(offset); q += ` OFFSET $${params.length}`;
    const result = await pool.query(q, params);
    return successResponse(res, 200, 'Immunization Register', { data: result.rows, count: result.rows.length });
  } catch (e) { return errorResponse(res, 500, e.message); }
};

const getDeliveryRegister = async (req, res) => {
  try {
    const { date_from, date_to, limit=100, offset=0 } = req.query;
    const pid = req.pharmacy_id;
    let q = `
      SELECT d.*, p.full_name as mother_name, p.patient_number,
             u.full_name as recorded_by_name,
             (SELECT COUNT(*) FROM baby_records WHERE delivery_id::text=d.id::text) as babies
      FROM deliveries d
      LEFT JOIN patients p ON d.patient_id::text=p.id::text
      LEFT JOIN users u ON d.recorded_by::text=u.id::text
      WHERE (d.pharmacy_id::text=$1::text OR d.pharmacy_id IS NULL)
    `;
    const params = [pid];
    if (date_from) { params.push(date_from); q += ` AND DATE(d.delivery_date)>=$${params.length}`; }
    if (date_to)   { params.push(date_to);   q += ` AND DATE(d.delivery_date)<=$${params.length}`; }
    q += ` ORDER BY d.delivery_date DESC`;
    params.push(limit);  q += ` LIMIT $${params.length}`;
    params.push(offset); q += ` OFFSET $${params.length}`;
    const result = await pool.query(q, params);
    return successResponse(res, 200, 'Delivery Register', { data: result.rows, count: result.rows.length });
  } catch (e) { return errorResponse(res, 500, e.message); }
};

const getRevenueReport = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const pid = req.pharmacy_id;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to   = date_to   || new Date().toISOString().split('T')[0];

    const [summary, byType, byDay, topServices] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(total_price),0)                                 as gross_revenue,
          COALESCE(SUM(total_price) FILTER (WHERE LOWER(status) IN ('paid', 'insurance', 'nhif', 'sha')),0)    as collected,
          COALESCE(SUM(total_price) FILTER (WHERE LOWER(status)='pending'),0) as outstanding,
          COALESCE(SUM(total_price) FILTER (WHERE LOWER(status)='waived'),0)  as waived,
          COUNT(*) FILTER (WHERE LOWER(status) IN ('paid', 'insurance', 'nhif', 'sha'))                        as paid_count,
          COUNT(*) FILTER (WHERE LOWER(status)='pending')                     as pending_count
        FROM billing_items
        WHERE (facility_id::text=$1::text OR facility_id IS NULL) AND DATE(created_at) BETWEEN $2 AND $3
      `, [pid, from, to]),

      pool.query(`
        SELECT item_type,
          COALESCE(SUM(total_price),0)                              as total,
          COALESCE(SUM(total_price) FILTER (WHERE status IN ('paid', 'insurance', 'nhif', 'sha')),0) as collected,
          COUNT(*)                                                   as count
        FROM billing_items
        WHERE (facility_id::text=$1::text OR facility_id IS NULL) AND DATE(created_at) BETWEEN $2 AND $3
        GROUP BY item_type ORDER BY total DESC
      `, [pid, from, to]),

      pool.query(`
        SELECT DATE(created_at) as date,
          COALESCE(SUM(total_price) FILTER (WHERE status IN ('paid', 'insurance', 'nhif', 'sha')),0) as revenue,
          COUNT(*) as transactions
        FROM billing_items
        WHERE (facility_id::text=$1::text OR facility_id IS NULL) AND DATE(created_at) BETWEEN $2 AND $3
        GROUP BY DATE(created_at) ORDER BY date ASC
      `, [pid, from, to]),

      pool.query(`
        SELECT item_name, COUNT(*) as count,
          COALESCE(SUM(total_price),0) as revenue
        FROM billing_items
        WHERE (facility_id::text=$1::text OR facility_id IS NULL) AND DATE(created_at) BETWEEN $2 AND $3
          AND status IN ('paid', 'insurance', 'nhif', 'sha')
        GROUP BY item_name ORDER BY revenue DESC LIMIT 10
      `, [pid, from, to]),
    ]);

    return successResponse(res, 200, 'Revenue Report', {
      period: { from, to },
      summary: summary.rows[0],
      by_type: byType.rows,
      by_day:  byDay.rows,
      top_services: topServices.rows,
    });
  } catch (e) { return errorResponse(res, 500, e.message); }
};

const getStockMovementReport = async (req, res) => {
  try {
    const { date_from, date_to, department, limit=100 } = req.query;
    const pid = req.pharmacy_id;
    let q = `
      SELECT sm.*, p.name as product_name, p.generic_name, u.full_name as user_name
      FROM stock_movements sm
      LEFT JOIN products p ON sm.product_id::text=p.id::text
      LEFT JOIN users u ON sm.user_id::text=u.id::text
      WHERE (sm.pharmacy_id::text=$1::text OR sm.pharmacy_id IS NULL)
    `;
    const params = [pid];
    if (date_from)  { params.push(date_from);  q += ` AND DATE(sm.created_at)>=$${params.length}`; }
    if (date_to)    { params.push(date_to);    q += ` AND DATE(sm.created_at)<=$${params.length}`; }
    if (department) { params.push(department); q += ` AND sm.department=$${params.length}`; }
    q += ` ORDER BY sm.created_at DESC LIMIT $${params.length+1}`;
    params.push(limit);
    const result = await pool.query(q, params);
    return successResponse(res, 200, 'Stock Movement Report', { data: result.rows, count: result.rows.length });
  } catch (e) { return errorResponse(res, 500, e.message); }
};

// ── Part 17: Audit Trail ──────────────────────────────────
const getAuditTrail = async (req, res) => {
  try {
    const { table_name, date_from, date_to, user_id, limit=50, offset=0 } = req.query;
    const pid = req.pharmacy_id;
    let q = `
      SELECT al.*, u.full_name as changed_by_name
      FROM audit_log al
      LEFT JOIN users u ON al.changed_by::text=u.id::text
      WHERE (al.pharmacy_id::text=$1::text OR al.pharmacy_id IS NULL)
    `;
    const params = [pid];
    if (table_name) { params.push(table_name); q += ` AND al.table_name=$${params.length}`; }
    if (user_id)    { params.push(user_id);    q += ` AND al.changed_by::text=$${params.length}::text`; }
    if (date_from)  { params.push(date_from);  q += ` AND DATE(al.changed_at)>=$${params.length}`; }
    if (date_to)    { params.push(date_to);    q += ` AND DATE(al.changed_at)<=$${params.length}`; }
    q += ` ORDER BY al.changed_at DESC`;
    params.push(limit);  q += ` LIMIT $${params.length}`;
    params.push(offset); q += ` OFFSET $${params.length}`;
    const result = await pool.query(q, params);
    return successResponse(res, 200, 'Audit trail', result.rows);
  } catch (e) { return errorResponse(res, 500, e.message); }
};

module.exports = {
  getVisitDashboard, getANCRegister, getImmunizationRegister,
  getDeliveryRegister, getRevenueReport, getStockMovementReport, getAuditTrail,
};
