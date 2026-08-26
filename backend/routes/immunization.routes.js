const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  administerVaccine, getImmunizationHistory, getImmunizationQueue,
  getVaccineStock, getMissedVaccineAlerts,
} = require('../controllers/immunization.controller');

router.get('/queue',                          protect, getImmunizationQueue);
router.get('/stock',                          protect, getVaccineStock);
router.get('/alerts/missed',                  protect, getMissedVaccineAlerts);
router.post('/administer',                    protect, administerVaccine);
router.get('/patient/:patient_id/history',    protect, getImmunizationHistory);

module.exports = router;
