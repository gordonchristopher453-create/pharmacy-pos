const express = require('express');
const router = express.Router();
const { protect, requirePharmacy } = require('../middleware/auth.middleware');
const {
  getVisitEncounters,
  getEncounterDetails,
  startOrResumeEncounter,
  pauseEncounter,
  completeEncounter,
  getPatientTimeline
} = require('../controllers/encounter.controller');

router.use(protect, requirePharmacy);

router.get('/patient/:patient_id/timeline', getPatientTimeline);
router.get('/visit/:visit_id', getVisitEncounters);
router.get('/:id', getEncounterDetails);
router.post('/start', startOrResumeEncounter);
router.post('/', startOrResumeEncounter);
router.put('/:id/pause', pauseEncounter);
router.put('/:id/complete', completeEncounter);

module.exports = router;
