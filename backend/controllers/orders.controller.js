const { pool } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Enterprise Centralized Order Management Controller
 */

// Helper to generate unique order number
const generateOrderNumber = async (pharmacyId) => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${timestamp}-${random}`;
};

// 1. Create Order
const createOrder = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const {
      visit_id,
      encounter_id,
      patient_id,
      order_type,
      order_details = {},
      priority = 'ROUTINE',
      department = 'GENERAL',
      clinic_id
    } = req.body;

    if (!visit_id || !patient_id || !order_type) {
      await client.query('ROLLBACK');
      return errorResponse(res, 400, 'visit_id, patient_id, and order_type are required');
    }

    const orderNumber = await generateOrderNumber(req.pharmacy_id);

    const orderRes = await client.query(
      `INSERT INTO clinical_orders (
        pharmacy_id, visit_id, encounter_id, patient_id, ordering_doctor_id,
        order_number, order_type, order_details, priority, status, department, clinic_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ORDERED', $10, $11, NOW(), NOW())
      RETURNING *`,
      [
        req.pharmacy_id,
        visit_id,
        encounter_id || null,
        patient_id,
        req.user?.id || null,
        orderNumber,
        order_type.toUpperCase(),
        JSON.stringify(order_details),
        priority.toUpperCase(),
        department,
        clinic_id || null
      ]
    );

    const newOrder = orderRes.rows[0];

    // Record Event
    await client.query(
      `INSERT INTO clinical_order_events (order_id, actor_id, from_status, to_status, notes, created_at)
       VALUES ($1, $2, NULL, 'ORDERED', $3, NOW())`,
      [newOrder.id, req.user?.id || null, `Order created by ${req.user?.full_name || 'Staff'}`]
    );

    await client.query('COMMIT');

    const io = req.app.get('io');
    if (io) io.emit(`order_created_${req.pharmacy_id}`, newOrder);

    return successResponse(res, 201, 'Clinical order created successfully', newOrder);
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Create clinical order error:', err.message);
    return errorResponse(res, 500, 'Failed to create clinical order');
  } finally {
    client.release();
  }
};

// 2. Get Orders / Order Tracking List
const getOrders = async (req, res) => {
  try {
    const {
      visit_id,
      patient_id,
      order_type,
      status,
      department,
      priority,
      search,
      limit = 50,
      offset = 0
    } = req.query;

    let query = `
      SELECT o.*,
        p.full_name as patient_name, p.patient_number, p.gender, p.date_of_birth,
        u_doc.full_name as ordering_doctor_name,
        u_perf.full_name as performing_staff_name,
        u_ver.full_name as verification_staff_name,
        u_rev.full_name as review_doctor_name
      FROM clinical_orders o
      LEFT JOIN patients p ON o.patient_id = p.id
      LEFT JOIN users u_doc ON o.ordering_doctor_id = u_doc.id
      LEFT JOIN users u_perf ON o.performing_staff_id = u_perf.id
      LEFT JOIN users u_ver ON o.verification_staff_id = u_ver.id
      LEFT JOIN users u_rev ON o.review_doctor_id = u_rev.id
      WHERE (o.pharmacy_id = $1 OR o.pharmacy_id IS NULL)
    `;
    const params = [req.pharmacy_id];

    if (visit_id) {
      params.push(visit_id);
      query += ` AND o.visit_id = $${params.length}`;
    }
    if (patient_id) {
      params.push(patient_id);
      query += ` AND o.patient_id = $${params.length}`;
    }
    if (order_type) {
      params.push(order_type.toUpperCase());
      query += ` AND UPPER(o.order_type) = $${params.length}`;
    }
    if (status) {
      params.push(status.toUpperCase());
      query += ` AND UPPER(o.status) = $${params.length}`;
    }
    if (department) {
      params.push(department);
      query += ` AND o.department = $${params.length}`;
    }
    if (priority) {
      params.push(priority.toUpperCase());
      query += ` AND UPPER(o.priority) = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (o.order_number ILIKE $${params.length} OR p.full_name ILIKE $${params.length} OR p.patient_number ILIKE $${params.length})`;
    }

    query += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    return successResponse(res, 200, 'Clinical orders fetched successfully', result.rows);
  } catch (err) {
    logger.error('Get clinical orders error:', err.message);
    return errorResponse(res, 500, 'Failed to fetch clinical orders');
  }
};

// 3. Update Order Status (Lifecycle Transitions)
const updateOrderStatus = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { status, notes, performing_staff_id, assigned_staff_id } = req.body;

    if (!status) {
      await client.query('ROLLBACK');
      return errorResponse(res, 400, 'Target status is required');
    }

    const currentOrderRes = await client.query(`SELECT * FROM clinical_orders WHERE id = $1 AND (pharmacy_id = $2 OR pharmacy_id IS NULL)`, [id, req.pharmacy_id]);
    const currentOrder = currentOrderRes.rows[0];
    if (!currentOrder) {
      await client.query('ROLLBACK');
      return errorResponse(res, 404, 'Clinical order not found');
    }

    const fromStatus = currentOrder.status;
    const toStatus = status.toUpperCase();

    const updateRes = await client.query(
      `UPDATE clinical_orders
       SET status = $1,
           performing_staff_id = COALESCE($2, performing_staff_id),
           assigned_staff_id = COALESCE($3, assigned_staff_id),
           updated_at = NOW()
       WHERE id = $4 AND (pharmacy_id = $5 OR pharmacy_id IS NULL)
       RETURNING *`,
      [toStatus, performing_staff_id || req.user?.id || null, assigned_staff_id || null, id, req.pharmacy_id]
    );

    const updatedOrder = updateRes.rows[0];

    // Record Event
    await client.query(
      `INSERT INTO clinical_order_events (order_id, actor_id, from_status, to_status, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [id, req.user?.id || null, fromStatus, toStatus, notes || `Status changed to ${toStatus}`]
    );

    await client.query('COMMIT');

    const io = req.app.get('io');
    if (io) io.emit(`order_updated_${req.pharmacy_id}`, updatedOrder);

    return successResponse(res, 200, `Order status updated to ${toStatus}`, updatedOrder);
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Update order status error:', err.message);
    return errorResponse(res, 500, 'Failed to update order status');
  } finally {
    client.release();
  }
};

// 4. Verify Order Results
const verifyOrderResult = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { verification_notes, order_details } = req.body;

    const currentOrderRes = await client.query(`SELECT * FROM clinical_orders WHERE id = $1 AND (pharmacy_id = $2 OR pharmacy_id IS NULL)`, [id, req.pharmacy_id]);
    const currentOrder = currentOrderRes.rows[0];
    if (!currentOrder) {
      await client.query('ROLLBACK');
      return errorResponse(res, 404, 'Clinical order not found');
    }

    const mergedDetails = order_details ? { ...currentOrder.order_details, ...order_details } : currentOrder.order_details;

    const updateRes = await client.query(
      `UPDATE clinical_orders
       SET status = 'VERIFIED',
           verification_staff_id = $1,
           verified_at = NOW(),
           order_details = $2,
           updated_at = NOW()
       WHERE id = $3 AND (pharmacy_id = $4 OR pharmacy_id IS NULL)
       RETURNING *`,
      [req.user?.id || null, JSON.stringify(mergedDetails), id, req.pharmacy_id]
    );

    const updatedOrder = updateRes.rows[0];

    await client.query(
      `INSERT INTO clinical_order_events (order_id, actor_id, from_status, to_status, notes, created_at)
       VALUES ($1, $2, $3, 'VERIFIED', $4, NOW())`,
      [id, req.user?.id || null, currentOrder.status, verification_notes || 'Results verified by staff']
    );

    await client.query('COMMIT');
    return successResponse(res, 200, 'Order results verified successfully', updatedOrder);
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Verify order result error:', err.message);
    return errorResponse(res, 500, 'Failed to verify order results');
  } finally {
    client.release();
  }
};

// 5. Release Order Results
const releaseOrderResult = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    const currentOrderRes = await client.query(`SELECT * FROM clinical_orders WHERE id = $1 AND (pharmacy_id = $2 OR pharmacy_id IS NULL)`, [id, req.pharmacy_id]);
    const currentOrder = currentOrderRes.rows[0];
    if (!currentOrder) {
      await client.query('ROLLBACK');
      return errorResponse(res, 404, 'Clinical order not found');
    }

    const updateRes = await client.query(
      `UPDATE clinical_orders
       SET status = 'RELEASED',
           release_staff_id = $1,
           released_at = NOW(),
           updated_at = NOW()
       WHERE id = $2 AND (pharmacy_id = $3 OR pharmacy_id IS NULL)
       RETURNING *`,
      [req.user?.id || null, id, req.pharmacy_id]
    );

    const updatedOrder = updateRes.rows[0];

    await client.query(
      `INSERT INTO clinical_order_events (order_id, actor_id, from_status, to_status, notes, created_at)
       VALUES ($1, $2, $3, 'RELEASED', 'Results released to clinical team', NOW())`,
      [id, req.user?.id || null, currentOrder.status]
    );

    await client.query('COMMIT');
    return successResponse(res, 200, 'Order results released successfully', updatedOrder);
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Release order result error:', err.message);
    return errorResponse(res, 500, 'Failed to release order results');
  } finally {
    client.release();
  }
};

// 6. Clinician Review & Acknowledgment
const reviewOrderResult = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { review_comments } = req.body;

    const currentOrderRes = await client.query(`SELECT * FROM clinical_orders WHERE id = $1 AND (pharmacy_id = $2 OR pharmacy_id IS NULL)`, [id, req.pharmacy_id]);
    const currentOrder = currentOrderRes.rows[0];
    if (!currentOrder) {
      await client.query('ROLLBACK');
      return errorResponse(res, 404, 'Clinical order not found');
    }

    const updateRes = await client.query(
      `UPDATE clinical_orders
       SET status = 'REVIEWED',
           review_doctor_id = $1,
           reviewed_at = NOW(),
           review_comments = $2,
           updated_at = NOW()
       WHERE id = $3 AND (pharmacy_id = $4 OR pharmacy_id IS NULL)
       RETURNING *`,
      [req.user?.id || null, review_comments || null, id, req.pharmacy_id]
    );

    const updatedOrder = updateRes.rows[0];

    await client.query(
      `INSERT INTO clinical_order_events (order_id, actor_id, from_status, to_status, notes, created_at)
       VALUES ($1, $2, $3, 'REVIEWED', $4, NOW())`,
      [id, req.user?.id || null, currentOrder.status, `Reviewed by Doctor: ${review_comments || 'No comments'}`]
    );

    await client.query('COMMIT');
    return successResponse(res, 200, 'Order results acknowledged and reviewed by doctor', updatedOrder);
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Review order result error:', err.message);
    return errorResponse(res, 500, 'Failed to record doctor review');
  } finally {
    client.release();
  }
};

// 7. Order Management Statistics & Performance Reports
const getOrderStats = async (req, res) => {
  try {
    const pId = req.pharmacy_id;
    const totalOrdersRes = await pool.query(`SELECT COUNT(*)::int as cnt FROM clinical_orders WHERE pharmacy_id = $1 OR pharmacy_id IS NULL`, [pId]);
    const pendingOrdersRes = await pool.query(`SELECT COUNT(*)::int as cnt FROM clinical_orders WHERE (pharmacy_id = $1 OR pharmacy_id IS NULL) AND status IN ('ORDERED', 'RECEIVED', 'ACCEPTED', 'SCHEDULED', 'IN_PROGRESS')`, [pId]);
    const completedOrdersRes = await pool.query(`SELECT COUNT(*)::int as cnt FROM clinical_orders WHERE (pharmacy_id = $1 OR pharmacy_id IS NULL) AND status IN ('COMPLETED', 'VERIFIED', 'RELEASED', 'REVIEWED', 'CLOSED')`, [pId]);
    const verifiedOrdersRes = await pool.query(`SELECT COUNT(*)::int as cnt FROM clinical_orders WHERE (pharmacy_id = $1 OR pharmacy_id IS NULL) AND status = 'VERIFIED'`, [pId]);
    const awaitingReviewRes = await pool.query(`SELECT COUNT(*)::int as cnt FROM clinical_orders WHERE (pharmacy_id = $1 OR pharmacy_id IS NULL) AND status = 'RELEASED'`, [pId]);

    // Turnaround times
    const tatRes = await pool.query(`
      SELECT 
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/60)::int as avg_turnaround_minutes
      FROM clinical_orders
      WHERE (pharmacy_id = $1 OR pharmacy_id IS NULL) AND status IN ('COMPLETED', 'VERIFIED', 'RELEASED', 'REVIEWED')
    `, [pId]);

    // By Type
    const byTypeRes = await pool.query(`
      SELECT order_type, COUNT(*)::int as count 
      FROM clinical_orders 
      WHERE pharmacy_id = $1 OR pharmacy_id IS NULL
      GROUP BY order_type 
      ORDER BY count DESC
    `, [pId]);

    // By Status
    const byStatusRes = await pool.query(`
      SELECT status, COUNT(*)::int as count 
      FROM clinical_orders 
      WHERE pharmacy_id = $1 OR pharmacy_id IS NULL
      GROUP BY status 
      ORDER BY count DESC
    `, [pId]);

    return successResponse(res, 200, 'Order management statistics retrieved', {
      total_orders: totalOrdersRes.rows[0]?.cnt || 0,
      pending_orders: pendingOrdersRes.rows[0]?.cnt || 0,
      completed_orders: completedOrdersRes.rows[0]?.cnt || 0,
      verified_orders: verifiedOrdersRes.rows[0]?.cnt || 0,
      awaiting_doctor_review: awaitingReviewRes.rows[0]?.cnt || 0,
      avg_turnaround_minutes: tatRes.rows[0]?.avg_turnaround_minutes || 15,
      orders_by_type: byTypeRes.rows,
      orders_by_status: byStatusRes.rows
    });
  } catch (err) {
    logger.error('Get order stats error:', err.message);
    return errorResponse(res, 500, 'Failed to retrieve order management statistics');
  }
};

module.exports = {
  createOrder,
  getOrders,
  updateOrderStatus,
  verifyOrderResult,
  releaseOrderResult,
  reviewOrderResult,
  getOrderStats
};
