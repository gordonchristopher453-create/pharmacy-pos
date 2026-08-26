const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  recordDelivery, addLabourMonitoring, getDelivery,
  listDeliveries, getBabyRecord, getBabiesByMother,
} = require('../controllers/delivery.controller');

router.post('/',                              protect, recordDelivery);
router.get('/',                               protect, listDeliveries);
router.get('/:id',                            protect, getDelivery);
router.post('/:delivery_id/monitoring',       protect, addLabourMonitoring);
router.get('/babies/:id',                     protect, getBabyRecord);
router.get('/babies/mother/:mother_id',       protect, getBabiesByMother);

module.exports = router;
