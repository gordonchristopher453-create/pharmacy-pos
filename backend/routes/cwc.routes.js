const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { saveCWCVisit, getGrowthHistory, getCWCQueue, getCWCVisits, orderFromCWC } = require('../controllers/cwc.controller');

router.get('/queue',                      protect, getCWCQueue);
router.post('/',                          protect, saveCWCVisit);
router.get('/patient/:patient_id',        protect, getCWCVisits);
router.get('/patient/:patient_id/growth', protect, getGrowthHistory);
router.post('/orders',                    protect, orderFromCWC);

module.exports = router;
