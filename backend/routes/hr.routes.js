const express = require('express');
const router = express.Router();
const { protect, requirePharmacy, authorize } = require('../middleware/auth.middleware');
const {
  getStaffProfiles, getStaffProfileById, upsertStaffProfile, deleteStaffProfile,
  getLeaveRequests, createLeaveRequest, reviewLeaveRequest, deleteLeaveRequest,
  getShiftSchedules, createShiftSchedule, batchCreateShifts, updateShiftSchedule, deleteShiftSchedule,
  getHRDashboardMetrics
} = require('../controllers/hr.controller');

router.use(protect);
router.use(requirePharmacy);

// Dashboard Metrics
router.get('/metrics', getHRDashboardMetrics);

// Staff Profiles
router.get('/staff', getStaffProfiles);
router.get('/staff/:id', getStaffProfileById);
router.post('/staff', authorize('facility_admin', 'admin', 'super_admin'), upsertStaffProfile);
router.delete('/staff/:id', authorize('facility_admin', 'admin', 'super_admin'), deleteStaffProfile);

// Leave Requests
router.get('/leave', getLeaveRequests);
router.post('/leave', createLeaveRequest);
router.patch('/leave/:id/review', authorize('facility_admin', 'admin', 'super_admin'), reviewLeaveRequest);
router.delete('/leave/:id', authorize('facility_admin', 'admin', 'super_admin'), deleteLeaveRequest);

// Shift Schedules & Roster
router.get('/shifts', getShiftSchedules);
router.post('/shifts', authorize('facility_admin', 'admin', 'super_admin'), createShiftSchedule);
router.post('/shifts/batch', authorize('facility_admin', 'admin', 'super_admin'), batchCreateShifts);
router.patch('/shifts/:id', authorize('facility_admin', 'admin', 'super_admin'), updateShiftSchedule);
router.delete('/shifts/:id', authorize('facility_admin', 'admin', 'super_admin'), deleteShiftSchedule);

module.exports = router;
