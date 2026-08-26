const express = require('express');
const router = express.Router();
const { protect, requirePharmacy } = require('../middleware/auth.middleware');
const {
  createOrder,
  getOrders,
  updateOrderStatus,
  verifyOrderResult,
  releaseOrderResult,
  reviewOrderResult,
  getOrderStats
} = require('../controllers/orders.controller');

router.use(protect);
router.use(requirePharmacy);

router.post('/', createOrder);
router.get('/', getOrders);
router.get('/tracking', getOrders);
router.get('/stats', getOrderStats);

router.put('/:id/status', updateOrderStatus);
router.post('/:id/verify', verifyOrderResult);
router.post('/:id/release', releaseOrderResult);
router.post('/:id/review', reviewOrderResult);

module.exports = router;
