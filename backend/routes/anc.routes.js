const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  saveANCRegistration, saveANCVisit, orderANCLab, orderANCDrug, orderANCVaccine,
  getANCRegistration, listANCRegistrations, addHighRiskFlag, removeHighRiskFlag,
} = require('../controllers/anc.controller');

router.get('/',                           protect, listANCRegistrations);
router.post('/',                          protect, saveANCRegistration);
router.get('/patient/:patient_id',        protect, getANCRegistration);
router.post('/visits',                    protect, saveANCVisit);
router.post('/orders/lab',               protect, orderANCLab);
router.post('/orders/drug',              protect, orderANCDrug);
router.post('/orders/vaccine',           protect, orderANCVaccine);
router.post('/:anc_id/high-risk',        protect, addHighRiskFlag);
router.delete('/high-risk/:flag_id',     protect, removeHighRiskFlag);

module.exports = router;
