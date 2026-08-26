const express = require('express');
const router = express.Router();
const { getByVisit, create, update, getPharmacyQueue, getLabResults, getInjectionReports, getRadiologyReports, saveRadiologyReport } = require('../controllers/consultation.controller');
const { protect, requirePharmacy, authorize } = require('../middleware/auth.middleware');

router.use(protect, requirePharmacy);
router.get('/pharmacy-queue', getPharmacyQueue);
router.get("/visit/:visit_id/lab-results", getLabResults);
router.get("/visit/:visit_id/injection-reports", getInjectionReports);
router.get("/visit/:visit_id/radiology-reports", getRadiologyReports);
router.post("/visit/:visit_id/radiology-report", saveRadiologyReport);
router.get('/visit/:visit_id', getByVisit);
router.post('/', authorize('doctor','admin'), create);
router.put('/:id', authorize('doctor','admin'), update);

module.exports = router;
