const { pool } = require('../config/db');
const SaleModel = require('../models/sale.model');
const ProductModel = require('../models/product.model');
const StockModel = require('../models/stock.model');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

const createSale = async (req, res) => {
  const client = await pool.connect();
  try {
    const { counter_id, items, payment_method, discount, notes, mpesa_code } = req.body;
    const pharmacy_id = req.pharmacy_id;

    if (!items || items.length === 0) return errorResponse(res, 400, 'Cart is empty');
    if (!payment_method) return errorResponse(res, 400, 'Payment method is required');

    await client.query('BEGIN');

    const validatedItems = [];
    for (const item of items) {
      if (!item.product_id || !item.quantity || item.quantity <= 0) {
        await client.query('ROLLBACK');
        return errorResponse(res, 400, 'Each item must have a valid product_id and quantity');
      }

      const product = await ProductModel.findById(item.product_id, pharmacy_id);
      if (!product) { await client.query('ROLLBACK'); return errorResponse(res, 404, `Product not found: ${item.product_id}`); }
      if (!product.is_active) { await client.query('ROLLBACK'); return errorResponse(res, 400, `Product is inactive: ${product.name}`); }

      // Enforce min/max selling price
      const unitPrice = parseFloat(item.unit_price || product.selling_price);
      const minPrice = parseFloat(product.min_selling_price || 0);
      const maxPrice = parseFloat(product.max_selling_price || 0);
      if (minPrice > 0 && unitPrice < minPrice) {
        await client.query('ROLLBACK');
        return errorResponse(res, 400, `Selling price for ${product.name} cannot be below minimum of KSH ${minPrice.toFixed(2)}`);
      }
      if (maxPrice > 0 && unitPrice > maxPrice) {
        await client.query('ROLLBACK');
        return errorResponse(res, 400, `Selling price for ${product.name} cannot exceed maximum of KSH ${maxPrice.toFixed(2)}`);
      }

      // Check for expired stock
      const availableStock = await client.query(`
        SELECT COALESCE(SUM(quantity), 0) as total
        FROM stock
        WHERE product_id = $1 AND pharmacy_id = $2
          AND quantity > 0
          AND (expiry_date IS NULL OR expiry_date > NOW())
      `, [item.product_id, pharmacy_id]);

      const nonExpiredStock = parseInt(availableStock.rows[0].total);
      if (nonExpiredStock < item.quantity) {
        await client.query('ROLLBACK');
        return errorResponse(res, 400, `Insufficient valid stock for ${product.name}. Available (non-expired): ${nonExpiredStock}`);
      }

      validatedItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: unitPrice,
        product_name: product.name
      });
    }

    const sale = await SaleModel.createSale({
      counter_id, user_id: req.user.id, items: validatedItems,
      payment_method, discount, notes, mpesa_code, pharmacy_id
    }, client);

    for (const item of validatedItems) {
      await StockModel.deductStock(item.product_id, item.quantity, client, pharmacy_id);
      await client.query(`
        INSERT INTO stock_movements (product_id, user_id, movement_type, quantity, reference_id, notes, pharmacy_id)
        VALUES ($1, $2, 'sale', $3, $4, $5, $6)
      `, [item.product_id, req.user.id, item.quantity, sale.id, `Sale: ${sale.receipt_number}`, pharmacy_id]);
    }

    await client.query('COMMIT');

    const fullSale = await SaleModel.findById(sale.id, pharmacy_id);
    const io = req.app.get('io');
    if (io) io.emit(`stock_changed_${pharmacy_id}`, { items: validatedItems });

    logger.info(`Sale: ${sale.receipt_number} - ${pharmacy_id}`);
    return successResponse(res, 201, 'Sale completed', fullSale);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Create sale error:', error.message);
    return errorResponse(res, 500, 'Sale failed: ' + error.message);
  } finally {
    client.release();
  }
};

const getSales = async (req, res) => {
  try {
    const { start_date, end_date, payment_method, limit, offset } = req.query;
    const sales = await SaleModel.findAll({
      start_date, end_date, payment_method,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
      pharmacy_id: req.pharmacy_id
    });
    return successResponse(res, 200, 'Sales fetched', sales);
  } catch (error) {
    logger.error('Get sales error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch sales');
  }
};

const getSale = async (req, res) => {
  try {
    const sale = await SaleModel.findById(req.params.id, req.pharmacy_id);
    if (!sale) return errorResponse(res, 404, 'Sale not found');
    return successResponse(res, 200, 'Sale fetched', sale);
  } catch (error) {
    logger.error('Get sale error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch sale');
  }
};

const getDailySummary = async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const summary = await SaleModel.getDailySummary(date, req.pharmacy_id);
    return successResponse(res, 200, 'Daily summary fetched', { date, ...summary });
  } catch (error) {
    logger.error('Daily summary error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch summary');
  }
};

module.exports = { createSale, getSales, getSale, getDailySummary };
