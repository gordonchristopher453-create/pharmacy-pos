const express = require('express');
const router = express.Router();
const { protect, requirePharmacy } = require('../middleware/auth.middleware');
const {
  evaluateCDSHandler,
  overrideCDSAlertHandler,
  getCDSLogs,
  getCDSStats
} = require('../controllers/cds.controller');

router.use(protect);
router.use(requirePharmacy);

router.post('/evaluate', evaluateCDSHandler);
router.post('/override', overrideCDSAlertHandler);
router.get('/logs', getCDSLogs);
router.get('/stats', getCDSStats);

module.exports = router;
