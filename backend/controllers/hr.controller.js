const HRModel = require('../models/hr.model');
const UserModel = require('../models/user.model');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

// Staff Profiles
const getStaffProfiles = async (req, res) => {
  try {
    const { department, status, search } = req.query;
    const staff = await HRModel.getStaffProfiles(req.pharmacy_id, { department, status, search });
    const metrics = await HRModel.getHRMetrics(req.pharmacy_id);
    return successResponse(res, 200, 'Staff profiles fetched', { staff, metrics });
  } catch (error) {
    logger.error('Get staff profiles error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch staff profiles');
  }
};

const getStaffProfileById = async (req, res) => {
  try {
    const profile = await HRModel.getStaffProfileById(req.params.id, req.pharmacy_id);
    if (!profile) return errorResponse(res, 404, 'Staff profile not found');
    return successResponse(res, 200, 'Staff profile fetched', profile);
  } catch (error) {
    logger.error('Get staff profile by ID error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch staff profile');
  }
};

const upsertStaffProfile = async (req, res) => {
  try {
    const { full_name, designation, email } = req.body;
    if (!full_name) {
      return errorResponse(res, 400, 'Full name is required');
    }
    const profile = await HRModel.upsertStaffProfile({
      ...req.body,
      pharmacy_id: req.pharmacy_id
    });
    return successResponse(res, 200, 'Staff profile saved successfully', profile);
  } catch (error) {
    logger.error('Save staff profile error:', error.message);
    return errorResponse(res, 500, 'Failed to save staff profile: ' + error.message);
  }
};

const deleteStaffProfile = async (req, res) => {
  try {
    const deleted = await HRModel.deleteStaffProfile(req.params.id, req.pharmacy_id);
    if (!deleted) return errorResponse(res, 404, 'Staff profile not found');
    return successResponse(res, 200, 'Staff profile deleted');
  } catch (error) {
    logger.error('Delete staff profile error:', error.message);
    return errorResponse(res, 500, 'Failed to delete staff profile');
  }
};

// Leave Management
const getLeaveRequests = async (req, res) => {
  try {
    const { status, start_date, end_date } = req.query;
    const leaves = await HRModel.getLeaveRequests(req.pharmacy_id, { status, start_date, end_date });
    return successResponse(res, 200, 'Leave requests fetched', leaves);
  } catch (error) {
    logger.error('Get leave requests error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch leave requests');
  }
};

const createLeaveRequest = async (req, res) => {
  try {
    const { employee_name, start_date, end_date, days_count, leave_type } = req.body;
    if (!employee_name || !start_date || !end_date) {
      return errorResponse(res, 400, 'Employee name, start date, and end date are required');
    }
    const leave = await HRModel.createLeaveRequest({
      ...req.body,
      pharmacy_id: req.pharmacy_id
    });
    return successResponse(res, 201, 'Leave application submitted', leave);
  } catch (error) {
    logger.error('Create leave error:', error.message);
    return errorResponse(res, 500, 'Failed to submit leave application');
  }
};

const reviewLeaveRequest = async (req, res) => {
  try {
    const { status, review_notes } = req.body;
    if (!status || !['approved', 'rejected', 'cancelled'].includes(status)) {
      return errorResponse(res, 400, 'Valid review status required');
    }
    const reviewed = await HRModel.reviewLeaveRequest({
      id: req.params.id,
      pharmacy_id: req.pharmacy_id,
      status,
      review_notes,
      reviewed_by: req.user.id,
      reviewed_by_name: req.user.full_name || req.user.name || 'HR Admin'
    });
    if (!reviewed) return errorResponse(res, 404, 'Leave request not found');
    return successResponse(res, 200, `Leave application ${status}`, reviewed);
  } catch (error) {
    logger.error('Review leave error:', error.message);
    return errorResponse(res, 500, 'Failed to review leave application');
  }
};

const deleteLeaveRequest = async (req, res) => {
  try {
    const deleted = await HRModel.deleteLeaveRequest(req.params.id, req.pharmacy_id);
    if (!deleted) return errorResponse(res, 404, 'Leave request not found');
    return successResponse(res, 200, 'Leave request deleted');
  } catch (error) {
    logger.error('Delete leave error:', error.message);
    return errorResponse(res, 500, 'Failed to delete leave request');
  }
};

// Shift Schedules & Roster
const getShiftSchedules = async (req, res) => {
  try {
    const { start_date, end_date, department } = req.query;
    const shifts = await HRModel.getShiftSchedules(req.pharmacy_id, { start_date, end_date, department });
    return successResponse(res, 200, 'Shift schedules fetched', shifts);
  } catch (error) {
    logger.error('Get shifts error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch shift schedules');
  }
};

const createShiftSchedule = async (req, res) => {
  try {
    const { employee_name, shift_date, shift_type } = req.body;
    if (!employee_name || !shift_date) {
      return errorResponse(res, 400, 'Employee name and shift date are required');
    }
    const shift = await HRModel.createShiftSchedule({
      ...req.body,
      pharmacy_id: req.pharmacy_id,
      created_by: req.user.id
    });
    return successResponse(res, 201, 'Shift schedule assigned', shift);
  } catch (error) {
    logger.error('Create shift error:', error.message);
    return errorResponse(res, 500, 'Failed to assign shift');
  }
};

const batchCreateShifts = async (req, res) => {
  try {
    const { shifts } = req.body;
    if (!Array.isArray(shifts) || shifts.length === 0) {
      return errorResponse(res, 400, 'Shifts array is required');
    }
    const created = await HRModel.batchCreateShifts(req.pharmacy_id, shifts, req.user.id);
    return successResponse(res, 201, `Assigned ${created.length} shifts successfully`, created);
  } catch (error) {
    logger.error('Batch shifts error:', error.message);
    return errorResponse(res, 500, 'Failed to batch assign shifts');
  }
};

const updateShiftSchedule = async (req, res) => {
  try {
    const updated = await HRModel.updateShiftSchedule(req.params.id, req.pharmacy_id, req.body);
    if (!updated) return errorResponse(res, 404, 'Shift not found');
    return successResponse(res, 200, 'Shift updated', updated);
  } catch (error) {
    logger.error('Update shift error:', error.message);
    return errorResponse(res, 500, 'Failed to update shift');
  }
};

const deleteShiftSchedule = async (req, res) => {
  try {
    const deleted = await HRModel.deleteShiftSchedule(req.params.id, req.pharmacy_id);
    if (!deleted) return errorResponse(res, 404, 'Shift not found');
    return successResponse(res, 200, 'Shift deleted');
  } catch (error) {
    logger.error('Delete shift error:', error.message);
    return errorResponse(res, 500, 'Failed to delete shift');
  }
};

const getHRDashboardMetrics = async (req, res) => {
  try {
    const metrics = await HRModel.getHRMetrics(req.pharmacy_id);
    return successResponse(res, 200, 'HR metrics fetched', metrics);
  } catch (error) {
    logger.error('Get HR metrics error:', error.message);
    return errorResponse(res, 500, 'Failed to fetch HR metrics');
  }
};

module.exports = {
  getStaffProfiles, getStaffProfileById, upsertStaffProfile, deleteStaffProfile,
  getLeaveRequests, createLeaveRequest, reviewLeaveRequest, deleteLeaveRequest,
  getShiftSchedules, createShiftSchedule, batchCreateShifts, updateShiftSchedule, deleteShiftSchedule,
  getHRDashboardMetrics
};
