const { pool } = require('../config/db');

class PurchaseOrderModel {
  static async generatePONumber(pharmacy_id) {
    const date = new Date();
    const prefix = `PO-${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
    const result = await pool.query(`SELECT COUNT(*) as count FROM purchase_orders WHERE po_number LIKE $1 AND pharmacy_id=$2`, [`${prefix}%`, pharmacy_id]);
    return `${prefix}-${String(parseInt(result.rows[0].count)+1).padStart(4,'0')}`;
  }

  static async create({ supplier_id, user_id, invoice_number, invoice_date, invoice_image_url, payment_due_date, notes, items, pharmacy_id, department='pharmacy' }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const po_number = await PurchaseOrderModel.generatePONumber(pharmacy_id);
      let subtotal = 0;
      for (const item of items) subtotal += (item.unit_cost||0) * (item.quantity_ordered||0);

      const poResult = await client.query(`
        INSERT INTO purchase_orders (po_number, supplier_id, user_id, invoice_number, invoice_date, invoice_image_url, subtotal, total, payment_due_date, notes, pharmacy_id, department)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$11) RETURNING *
      `, [po_number, supplier_id, user_id, invoice_number, invoice_date, invoice_image_url, subtotal, payment_due_date, notes, pharmacy_id, department]);
      const po = poResult.rows[0];

      for (const item of items) {
        const product_id = item.product_id || null;
        const qty        = parseInt(item.quantity_ordered) || 0;
        const unitCost   = parseFloat(item.unit_cost) || 0;

        await client.query(`
          INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity_ordered, quantity_received, unit_cost, total_cost, batch_number, expiry_date)
          VALUES ($1,$2,$3,$4,$4,$5,$6,$7,$8)
        `, [po.id, product_id, item.product_name, qty, unitCost, unitCost*qty, item.batch_number||null, item.expiry_date||null]);

        if (!product_id) continue;

        if (item.batch_number) {
          await client.query(`
            INSERT INTO stock (product_id, quantity, batch_number, expiry_date, pharmacy_id, department)
            VALUES ($1,$2,$3,$4,$5,$6)
            ON CONFLICT (product_id, batch_number, pharmacy_id)
            DO UPDATE SET quantity=stock.quantity+EXCLUDED.quantity, expiry_date=COALESCE(EXCLUDED.expiry_date,stock.expiry_date), updated_at=NOW()
          `, [product_id, qty, item.batch_number, item.expiry_date||null, pharmacy_id, department]);
        } else {
          await client.query(`
            INSERT INTO stock (product_id, quantity, batch_number, expiry_date, pharmacy_id, department)
            VALUES ($1,$2,NULL,$3,$4,$5)
            ON CONFLICT (product_id, pharmacy_id) WHERE batch_number IS NULL
            DO UPDATE SET quantity=stock.quantity+EXCLUDED.quantity, expiry_date=COALESCE(EXCLUDED.expiry_date,stock.expiry_date), updated_at=NOW()
          `, [product_id, qty, item.expiry_date||null, pharmacy_id, department]);
        }

        await client.query(`
          INSERT INTO stock_movements (product_id, user_id, movement_type, quantity, batch_number, reference_id, notes, pharmacy_id, department)
          VALUES ($1,$2,'purchase',$3,$4,$5,$6,$7,$8)
        `, [product_id, user_id, qty, item.batch_number||null, po.id, `PO: ${po_number}`, pharmacy_id, department]);

        if (unitCost > 0 || item.selling_price > 0) {
          const updates = []; const vals = [];
          if (unitCost > 0)           { vals.push(unitCost);           updates.push(`buying_price=$${vals.length}`); }
          if (item.selling_price > 0) { vals.push(item.selling_price); updates.push(`selling_price=$${vals.length}`); }
          vals.push(product_id); vals.push(pharmacy_id);
          await client.query(`UPDATE products SET ${updates.join(', ')}, updated_at=NOW() WHERE id=$${vals.length-1} AND pharmacy_id=$${vals.length}`, vals);
        }
      }

      await client.query(`UPDATE purchase_orders SET status='received' WHERE id=$1`, [po.id]);
      await client.query('COMMIT');
      return po;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async findAll({ status, supplier_id, limit=50, offset=0, pharmacy_id, department }={}) {
    let query = `SELECT po.*, s.name as supplier_name, u.full_name as created_by FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id=s.id LEFT JOIN users u ON po.user_id=u.id WHERE po.pharmacy_id=$1`;
    const params = [pharmacy_id];
    if (department) { params.push(department); query += ` AND po.department=$${params.length}`; }
    if (status)     { params.push(status);     query += ` AND po.status=$${params.length}`; }
    if (supplier_id){ params.push(supplier_id);query += ` AND po.supplier_id=$${params.length}`; }
    query += ` ORDER BY po.created_at DESC`;
    params.push(limit);  query += ` LIMIT $${params.length}`;
    params.push(offset); query += ` OFFSET $${params.length}`;
    const orders = await pool.query(query, params);
    return await Promise.all(orders.rows.map(async (po) => {
      const items = await pool.query(`SELECT * FROM purchase_order_items WHERE purchase_order_id=$1`, [po.id]);
      return { ...po, items: items.rows };
    }));
  }

  static async findById(id, pharmacy_id) {
    const po = await pool.query(`SELECT po.*, s.name as supplier_name, u.full_name as created_by FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id=s.id LEFT JOIN users u ON po.user_id=u.id WHERE po.id=$1 AND po.pharmacy_id=$2`, [id, pharmacy_id]);
    if (!po.rows[0]) return null;
    const items = await pool.query(`SELECT * FROM purchase_order_items WHERE purchase_order_id=$1`, [id]);
    return { ...po.rows[0], items: items.rows };
  }
}

module.exports = PurchaseOrderModel;
