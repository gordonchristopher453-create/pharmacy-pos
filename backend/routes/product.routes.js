const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const {
  getProducts,
  getByBarcode,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  addStock,
  getExpiring,
  getCategories,
  createCategory
} = require('../controllers/product.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/categories', getCategories);
router.post('/categories', authorize('facility_admin', 'super_admin'), createCategory);
router.get('/expiring', getExpiring);
router.get('/barcode/:barcode', getByBarcode);

// Get available products with current stock
router.get('/available', async (req, res) => {
  try {
    const { search, limit = 100 } = req.query;
    let query = `
      SELECT p.*, COALESCE(SUM(s.quantity),0) as in_stock
      FROM products p
      LEFT JOIN stock s ON p.id = s.product_id AND (s.pharmacy_id = $1 OR s.pharmacy_id IS NULL)
      WHERE (p.pharmacy_id = $1 OR p.pharmacy_id IS NULL) AND p.is_active = true
    `;
    const params = [req.pharmacy_id];
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (p.name ILIKE $${params.length} OR p.generic_name ILIKE $${params.length})`;
    }
    query += ` GROUP BY p.id HAVING COALESCE(SUM(s.quantity),0) > 0`;
    query += ` ORDER BY p.name ASC LIMIT $${params.length + 1}`;
    params.push(limit);
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch(e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', authorize('facility_admin', 'pharmacist', 'lab_technician', 'store_manager'), createProduct);
router.put('/:id', authorize('facility_admin', 'pharmacist', 'lab_technician', 'store_manager'), updateProduct);
router.delete('/:id', authorize('facility_admin', 'pharmacist', 'lab_technician', 'store_manager', 'super_admin'), deleteProduct);
router.post('/:id/stock', authorize('facility_admin', 'pharmacist', 'lab_technician', 'store_manager'), addStock);

module.exports = router;
