const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { savePNCVisit, orderFromPNC, getPNCVisits, getPNCQueue } = require('../controllers/pnc.controller');

router.get('/queue',                  protect, getPNCQueue);
router.post('/',                      protect, savePNCVisit);
router.get('/patient/:patient_id',    protect, getPNCVisits);
router.post('/orders',                protect, orderFromPNC);

module.exports = router;
