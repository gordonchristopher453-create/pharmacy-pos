const { pool } = require('../config/db');
const StockModel = require('../models/stock.model');
const SupplierModel = require('../models/supplier.model');
const PurchaseOrderModel = require('../models/purchaseOrder.model');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

const getStockOverview = async (req, res) => {
  try {
    const { search, category_id, filter, department } = req.query;
    const dept = department || "pharmacy";
    const pharmacy_id = req.pharmacy_id;
    let query = `
      SELECT p.*,
        c.name as category_name, s.name as supplier_name,
        COALESCE(SUM(st.quantity), 0) as total_stock,
        MIN(st.expiry_date) as nearest_expiry,
        COUNT(st.id) as batch_count,
        COALESCE(SUM(st.quantity * p.buying_price), 0) as stock_value_buying,
        COALESCE(SUM(st.quantity * p.selling_price), 0) as stock_value_selling
      FROM products p
      LEFT JOIN categories c ON p.category_id::text = c.id::text
      LEFT JOIN suppliers s ON p.supplier_id::text = s.id::text
      LEFT JOIN stock st ON p.id::text = st.product_id::text
      WHERE p.is_active = true AND (p.pharmacy_id::text = $1::text OR p.pharmacy_id IS NULL) AND (p.department = $2 OR p.department IS NULL)
    `;
    const params = [pharmacy_id, dept];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (p.name ILIKE $${params.length} OR p.generic_name ILIKE $${params.length} OR p.barcode ILIKE $${params.length})`;
    }
    if (category_id) { params.push(category_id); query += ` AND p.category_id::text = $${params.length}::text`; }

    query += ` GROUP BY p.id, c.name, s.name`;

    if (filter === 'low_stock') query += ` HAVING COALESCE(SUM(st.quantity), 0) <= p.reorder_level`;
    else if (filter === 'out_of_stock') query += ` HAVING COALESCE(SUM(st.quantity), 0) = 0`;
    else if (filter === 'expiring_soon') query += ` HAVING MIN(st.expiry_date) <= NOW() + INTERVAL '30 days' AND MIN(st.expiry_date) >= NOW()`;

    query += ` ORDER BY p.name ASC`;
    const result = await pool.query(query, params);

    const stats = await pool.query(`
      SELECT
        COUNT(DISTINCT p.id) as total_products,
        COALESCE(SUM(st.quantity * p.buying_price), 0) as total_stock_value,
        COUNT(DISTINCT CASE WHEN COALESCE(st_sub.total_qty, 0) <= p.reorder_level THEN p.id END) as low_stock_count,
        COUNT(DISTINCT CASE WHEN COALESCE(st_sub.total_qty, 0) = 0 THEN p.id END) as out_of_stock_count
      FROM products p
      LEFT JOIN stock st ON p.id::text = st.product_id::text
      LEFT JOIN (SELECT product_id, SUM(quantity) as total_qty FROM stock GROUP BY product_id) st_sub ON p.id::text = st_sub.product_id::text
      WHERE p.is_active = true AND (p.pharmacy_id::text = $1::text OR p.pharmacy_id IS NULL) AND (p.department = $2 OR p.department IS NULL)
    `, [pharmacy_id, dept]);

    return successResponse(res, 200, 'Stock overview fetched', { products: result.rows, stats: stats.rows[0] });
  } catch (error) {
    logger.error('Stock overview error:', JSON.stringify(error), error?.message, error?.stack);
    return errorResponse(res, 500, 'Failed to fetch stock: ' + JSON.stringify(error));
  }
};

const getMovements = async (req, res) => {
  try {
    const { product_id, movement_type, limit = 50 } = req.query;
    let query = `
      SELECT sm.*, p.name as product_name, u.full_name as user_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id::text = p.id::text
      LEFT JOIN users u ON sm.user_id::text = u.id::text
      WHERE (sm.pharmacy_id::text = $1::text OR sm.pharmacy_id IS NULL) AND (sm.department = $2 OR sm.department IS NULL)
    `;
    const dept = req.query.department || 'pharmacy';
    const params = [req.pharmacy_id, dept];

    if (product_id) { params.push(product_id); query += ` AND sm.product_id::text = $${params.length}::text`; }
    if (movement_type) { params.push(movement_type); query += ` AND sm.movement_type = $${params.length}`; }

    params.push(limit);
    query += ` ORDER BY sm.created_at DESC LIMIT $${params.length}`;

    const result = await pool.query(query, params);
    return successResponse(res, 200, 'Movements fetched', result.rows);
  } catch (error) {
    logger.error('Get movements error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch movements');
  }
};

const adjustStock = async (req, res) => {
  const client = await pool.connect();
  try {
    const { product_id, adjustment_type, quantity, reason } = req.body;
    const pharmacy_id = req.pharmacy_id;
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO stock_adjustments (product_id, user_id, adjustment_type, quantity, reason, pharmacy_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [product_id, req.user.id, adjustment_type, quantity, reason, pharmacy_id]);

    if (['damaged', 'expired', 'lost'].includes(adjustment_type)) {
      await StockModel.deductStock(product_id, quantity, client, pharmacy_id);
      await client.query(`
        INSERT INTO stock_movements (product_id, user_id, movement_type, quantity, notes, pharmacy_id)
        VALUES ($1, $2, 'adjustment', $3, $4, $5)
      `, [product_id, req.user.id, -quantity, `${adjustment_type}: ${reason}`, pharmacy_id]);
    } else {
      await client.query(`INSERT INTO stock (product_id, quantity, pharmacy_id) VALUES ($1, $2, $3)`, [product_id, quantity, pharmacy_id]);
      await client.query(`
        INSERT INTO stock_movements (product_id, user_id, movement_type, quantity, notes, pharmacy_id)
        VALUES ($1, $2, 'adjustment', $3, $4, $5)
      `, [product_id, req.user.id, quantity, `${adjustment_type}: ${reason}`, pharmacy_id]);
    }

    await client.query('COMMIT');
    return successResponse(res, 200, 'Stock adjusted successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Adjust stock error:', error.message);
    return errorResponse(res, 500, 'Failed to adjust stock: ' + error.message);
  } finally {
    client.release();
  }
};

const getSuppliers = async (req, res) => {
  try {
    const suppliers = await SupplierModel.findAll(req.pharmacy_id);
    return successResponse(res, 200, 'Suppliers fetched', suppliers);
  } catch (error) {
    logger.error('Get suppliers error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch suppliers');
  }
};

const createSupplier = async (req, res) => {
  try {
    const supplier = await SupplierModel.create({ ...req.body, pharmacy_id: req.pharmacy_id });
    return successResponse(res, 201, 'Supplier created', supplier);
  } catch (error) {
    logger.error('Create supplier error:', error.message);
    return errorResponse(res, 500, 'Failed to create supplier');
  }
};

const getPurchaseOrders = async (req, res) => {
  try {
    const orders = await PurchaseOrderModel.findAll({ ...req.query, pharmacy_id: req.pharmacy_id, department: req.query.department });
    return successResponse(res, 200, 'Purchase orders fetched', orders);
  } catch (error) {
    logger.error('Get POs error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch purchase orders');
  }
};

const createPurchaseOrder = async (req, res) => {
  try {
    const dept = req.body.department || "pharmacy";
    const po = await PurchaseOrderModel.create({ ...req.body, user_id: req.user.id, pharmacy_id: req.pharmacy_id, department: dept });
    const io = req.app.get('io');
    if (io) io.emit(`stock_changed_${req.pharmacy_id}`, { type: 'purchase', po_id: po.id });
    return successResponse(res, 201, 'Stock received successfully', po);
  } catch (error) {
    logger.error('Create PO error:', error.message);
    return errorResponse(res, 500, 'Failed to create purchase order: ' + error.message);
  }
};

const scanInvoice = async (req, res) => {
  try {
    const { image_base64, media_type } = req.body;
    if (!image_base64) return errorResponse(res, 400, 'No image provided');

    const apiKey = process.env.GOOGLE_VISION_API_KEY;
    if (!apiKey) return errorResponse(res, 500, 'Google Vision API key not configured');

    // Call Google Vision API
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: image_base64 },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }]
          }]
        })
      }
    );

    const visionData = await visionResponse.json();

    if (visionData.error) return errorResponse(res, 422, 'Vision API error: ' + visionData.error.message);

    const ocrText = visionData.responses?.[0]?.fullTextAnnotation?.text || '';
    if (!ocrText.trim()) return errorResponse(res, 422, 'Could not extract text from image. Try a clearer photo.');

    const parsed = parseInvoiceText(ocrText);
    return successResponse(res, 200, 'Invoice scanned successfully', { raw_text: ocrText, ...parsed });
  } catch (error) {
    logger.error('Scan invoice error:', error.message);
    return errorResponse(res, 500, 'Invoice scanning failed: ' + error.message);
  }
};

const parseInvoiceText = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result = { supplier_name: null, invoice_number: null, invoice_date: null, items: [] };

  // Extract invoice number
  const invMatch = text.match(/inv(?:oice)?[\s#:.-]*([A-Z0-9\-\/]+)/i);
  if (invMatch) result.invoice_number = invMatch[1];

  // Extract date (supports DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD)
  const dateMatch = text.match(/(\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4})|(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    const raw = dateMatch[0];
    if (raw.includes('-') && raw.split('-')[0].length === 4) {
      result.invoice_date = raw; // already YYYY-MM-DD
    } else {
      const parts = raw.split(/[\-\/]/);
      if (parts.length === 3) {
        const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
        result.invoice_date = `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }

  // Supplier name — first non-empty line that looks like a company
  for (const line of lines.slice(0, 5)) {
    if (line.length > 3 && !/^(invoice|date|tel|p\.?o|ref)/i.test(line)) {
      result.supplier_name = line;
      break;
    }
  }

  // Parse line items — handles formats common in Kenyan pharma invoices:
  // "Amoxicillin 500mg    100    tabs    500.00"
  // "Paracetamol 1000 500 2.50"
  const itemPattern = /^([A-Za-z][A-Za-z0-9\s\-\.,%\/]+?)\s{2,}(\d+)\s+(\d+\.?\d*)/;
  const itemPattern2 = /^([A-Za-z][A-Za-z0-9\s\-\.,%\/]+?)\s+(\d+)\s+(?:[A-Za-z\/]+\s+)?(\d+[,.]?\d*)/;

  for (const line of lines) {
    // Skip header/footer lines
    if (/^(description|product|item|qty|quantity|unit|price|amount|total|vat|sub|page|invoice|date|supplier|no\.|s\.?n)/i.test(line)) continue;
    if (line.split(' ').length < 2) continue;

    let match = line.match(itemPattern) || line.match(itemPattern2);
    if (match) {
      const name = match[1].trim().replace(/\s+/g, ' ');
      const qty = parseInt(match[2]);
      const price = parseFloat(match[3].replace(',', ''));

      // Extract batch number
      const batchMatch = line.match(/b(?:atch)?[\s#:]*([A-Z0-9\-]+)/i);
      const batch = batchMatch ? batchMatch[1] : null;

      // Extract expiry date
      const expiryMatch = line.match(/exp(?:iry|\.)?\.?[\s:]*([0-9]{1,2}[\-\/][0-9]{2,4})/i);
      let expiry = null;
      if (expiryMatch) {
        const ep = expiryMatch[1].split(/[\-\/]/);
        if (ep.length === 2) {
          const yr = ep[1].length === 2 ? '20' + ep[1] : ep[1];
          expiry = `${yr}-${ep[0].padStart(2, '0')}-01`;
        }
      }

      if (name.length > 2 && qty > 0 && price > 0 && qty < 100000 && price < 10000000) {
        result.items.push({
          product_name: name,
          generic_name: null,
          quantity_ordered: qty,
          unit_cost: price,
          batch_number: batch,
          expiry_date: expiry
        });
      }
    }
  }
  return result;
};


const getExpiredDrugs = async (req, res) => {
  try {
    const expired = await StockModel.getExpired(req.pharmacy_id);
    return successResponse(res, 200, 'Expired drugs fetched', expired);
  } catch (error) {
    logger.error('Get expired error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch expired drugs');
  }
};

const disposeExpiredDrug = async (req, res) => {
  try {
    const { stock_id } = req.params;
    const result = await StockModel.disposeExpired(stock_id, req.user.id, req.pharmacy_id);
    return successResponse(res, 200, `Disposed ${result.disposed_quantity} units of ${result.product_name}`, result);
  } catch (error) {
    logger.error('Dispose expired error:', error.message);
    return errorResponse(res, 500, 'Failed to dispose: ' + error.message);
  }
};

const disposeAllExpiredDrugs = async (req, res) => {
  try {
    const result = await StockModel.disposeAllExpired(req.user.id, req.pharmacy_id);
    return successResponse(res, 200, `Successfully disposed ${result.total_batches} expired batches (${result.total_quantity} total units)`, result);
  } catch (error) {
    logger.error('Dispose all expired error:', error.message);
    return errorResponse(res, 500, 'Failed to dispose all expired drugs: ' + error.message);
  }
};

module.exports = { getStockOverview, getMovements, adjustStock, getSuppliers, createSupplier, getPurchaseOrders, createPurchaseOrder, scanInvoice, getExpiredDrugs, disposeExpiredDrug, disposeAllExpiredDrugs };
