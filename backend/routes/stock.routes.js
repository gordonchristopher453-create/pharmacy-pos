const express = require('express');
const router = express.Router();
const {
  getStockOverview,
  getMovements,
  adjustStock,
  getSuppliers,
  createSupplier,
  getPurchaseOrders,
  createPurchaseOrder,
  scanInvoice,
  getExpiredDrugs,
  disposeExpiredDrug,
  disposeAllExpiredDrugs
} = require('../controllers/stock.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/', getStockOverview);
router.get('/movements', getMovements);
router.post('/adjust', authorize('facility_admin', 'pharmacist', 'lab_technician', 'store_manager'), adjustStock);
router.get('/suppliers', getSuppliers);
router.post('/suppliers', authorize('facility_admin', 'pharmacist', 'store_manager'), createSupplier);
router.get('/purchase-orders', getPurchaseOrders);
router.post('/purchase-orders', authorize('facility_admin', 'pharmacist', 'store_manager'), createPurchaseOrder);
router.post('/scan-invoice', authorize('facility_admin', 'pharmacist', 'store_manager'), scanInvoice);
router.get('/expired', authorize('facility_admin', 'pharmacist', 'store_manager'), getExpiredDrugs);
router.post('/expired/dispose-all', authorize('facility_admin', 'pharmacist', 'store_manager'), disposeAllExpiredDrugs);
router.post('/expired/:stock_id/dispose', authorize('facility_admin', 'pharmacist', 'store_manager'), disposeExpiredDrug);

module.exports = router;
