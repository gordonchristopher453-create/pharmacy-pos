const express = require('express');
const router = express.Router();
const { protect, requirePharmacy } = require('../middleware/auth.middleware');
const {
  getSpecialClinics,
  getMyClinics,
  createSpecialClinic,
  updateSpecialClinic,
  getClinicDoctors,
  getAvailableDoctors,
  assignClinicDoctor,
  removeClinicDoctor,
  getClinicServices,
  createClinicService,
  updateClinicService,
  getClinicAppointments,
  createClinicAppointment,
  updateClinicAppointmentStatus,
  getClinicQueue,
  updateClinicQueueStatus,
  referToSpecialClinic,
  getClinicReferrals,
  getClinicDashboardStats,
  getClinicReports
} = require('../controllers/specialClinic.controller');

router.use(protect, requirePharmacy);

// Clinics CRUD
router.get('/', getSpecialClinics);
router.get('/my-clinics', getMyClinics);
router.post('/', createSpecialClinic);
router.put('/:id', updateSpecialClinic);

// Doctors
router.get('/doctors', getClinicDoctors);
router.get('/available-doctors', getAvailableDoctors);
router.post('/doctors', assignClinicDoctor);
router.delete('/doctors/:id', removeClinicDoctor);

// Services
router.get('/services', getClinicServices);
router.post('/services', createClinicService);
router.put('/services/:id', updateClinicService);

// Appointments
router.get('/appointments', getClinicAppointments);
router.post('/appointments', createClinicAppointment);
router.put('/appointments/:id/status', updateClinicAppointmentStatus);

// Queue & Referrals
router.get('/queue', getClinicQueue);
router.put('/queue/:id/status', updateClinicQueueStatus);
router.post('/refer', referToSpecialClinic);
router.get('/referrals', getClinicReferrals);

// Stats & Reports
router.get('/stats', getClinicDashboardStats);
router.get('/reports', getClinicReports);

module.exports = router;
