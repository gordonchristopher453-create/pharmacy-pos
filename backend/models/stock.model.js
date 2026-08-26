const { pool } = require('../config/db');

class StockModel {
  static async addStock({ product_id, quantity, batch_number, expiry_date, pharmacy_id }) {
    const result = await pool.query(`
      INSERT INTO stock (product_id, quantity, batch_number, expiry_date, pharmacy_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (product_id, pharmacy_id)
      DO UPDATE SET
        quantity = stock.quantity + EXCLUDED.quantity,
        batch_number = COALESCE(EXCLUDED.batch_number, stock.batch_number),
        expiry_date = COALESCE(EXCLUDED.expiry_date, stock.expiry_date),
        updated_at = NOW()
      RETURNING *
    `, [product_id, quantity, batch_number, expiry_date, pharmacy_id]);
    return result.rows[0];
  }

  static async findByProduct(product_id, pharmacy_id) {
    const result = await pool.query(`
      SELECT * FROM stock WHERE product_id::text = $1::text AND ($2::text IS NULL OR pharmacy_id::text = $2::text) AND quantity > 0
      ORDER BY expiry_date ASC
    `, [product_id, pharmacy_id]);
    return result.rows;
  }

  static async deductStock(product_id, quantity, client, pharmacy_id) {
    const db = client || pool;
    const batches = await db.query(`
      SELECT * FROM stock
      WHERE product_id::text = $1::text AND quantity > 0 AND ($2::text IS NULL OR pharmacy_id::text = $2::text)
      ORDER BY expiry_date ASC NULLS LAST
    `, [product_id, pharmacy_id]);

    let remaining = quantity;
    for (const batch of batches.rows) {
      if (remaining <= 0) break;
      const deduct = Math.min(batch.quantity, remaining);
      await db.query(`UPDATE stock SET quantity = quantity - $1, updated_at = NOW() WHERE id::text = $2::text`, [deduct, batch.id]);
      remaining -= deduct;
    }

    if (remaining > 0) throw new Error(`Insufficient stock for product ${product_id}`);
  }

  static async getTotalStock(product_id, pharmacy_id) {
    const result = await pool.query(`
      SELECT COALESCE(SUM(quantity), 0) as total FROM stock
      WHERE product_id::text = $1::text AND ($2::text IS NULL OR pharmacy_id::text = $2::text)
    `, [product_id, pharmacy_id]);
    return parseInt(result.rows[0].total);
  }

  static async getExpiring(days = 30, pharmacy_id) {
    const result = await pool.query(`
      SELECT st.*, p.name as product_name, p.barcode
      FROM stock st JOIN products p ON st.product_id::text = p.id::text
      WHERE st.expiry_date <= NOW() + INTERVAL '${days} days'
        AND st.expiry_date >= NOW()
        AND st.quantity > 0
        AND ($1::text IS NULL OR st.pharmacy_id::text = $1::text)
      ORDER BY st.expiry_date ASC
    `, [pharmacy_id]);
    return result.rows;
  }

  static async getExpired(pharmacy_id) {
    const result = await pool.query(`
      SELECT st.*, p.name as product_name, p.generic_name, p.barcode, p.unit,
             c.name as category_name
      FROM stock st
      JOIN products p ON st.product_id::text = p.id::text
      LEFT JOIN categories c ON p.category_id::text = c.id::text
      WHERE st.expiry_date < NOW()
        AND st.quantity > 0
        AND ($1::text IS NULL OR st.pharmacy_id::text = $1::text)
      ORDER BY st.expiry_date ASC
    `, [pharmacy_id]);
    return result.rows;
  }

  static async disposeExpired(stock_id, user_id, pharmacy_id) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const stockRes = await client.query(
        `SELECT st.*, p.name as product_name FROM stock st
         JOIN products p ON st.product_id::text = p.id::text
         WHERE st.id::text = $1::text AND ($2::text IS NULL OR st.pharmacy_id::text = $2::text)`,
        [stock_id, pharmacy_id]
      );
      const batch = stockRes.rows[0];
      if (!batch) throw new Error('Stock batch not found');

      const qty = batch.quantity;
      await client.query(`DELETE FROM stock WHERE id::text = $1::text`, [stock_id]);
      await client.query(`
        INSERT INTO stock_movements (product_id, user_id, movement_type, quantity, notes, pharmacy_id)
        VALUES ($1, $2, 'disposal', $3, $4, $5)
      `, [batch.product_id, user_id, qty, `Expired drug disposal — Batch: ${batch.batch_number || 'N/A'}`, pharmacy_id]);

      await client.query('COMMIT');
      return { disposed_quantity: qty, product_name: batch.product_name };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  static async disposeAllExpired(user_id, pharmacy_id) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const stockRes = await client.query(
        `SELECT st.*, p.name as product_name FROM stock st
         JOIN products p ON st.product_id::text = p.id::text
         WHERE st.expiry_date < NOW() AND st.quantity > 0
           AND ($1::text IS NULL OR st.pharmacy_id::text = $1::text)`,
        [pharmacy_id]
      );
      const batches = stockRes.rows;
      let totalQty = 0;
      for (const batch of batches) {
        await client.query(`DELETE FROM stock WHERE id::text = $1::text`, [batch.id]);
        await client.query(`
          INSERT INTO stock_movements (product_id, user_id, movement_type, quantity, notes, pharmacy_id)
          VALUES ($1, $2, 'disposal', $3, $4, $5)
        `, [batch.product_id, user_id, batch.quantity, `Expired drug bulk disposal — Batch: ${batch.batch_number || 'N/A'}`, pharmacy_id]);
        totalQty += parseInt(batch.quantity || 0);
      }
      await client.query('COMMIT');
      return { total_batches: batches.length, total_quantity: totalQty };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  static async logMovement({ product_id, user_id, movement_type, quantity, reference_id, notes, pharmacy_id }) {
    await pool.query(`
      INSERT INTO stock_movements (product_id, user_id, movement_type, quantity, reference_id, notes, pharmacy_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [product_id, user_id, movement_type, quantity, reference_id, notes, pharmacy_id]);
  }
}

module.exports = StockModel;
