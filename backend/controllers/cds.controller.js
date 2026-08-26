const { pool } = require('../config/db');
const { evaluateCDS } = require('../services/cdsEngine');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

const evaluateCDSHandler = async (req, res) => {
  try {
    const {
      patient_id,
      visit_id,
      encounter_id,
      proposed_medications = [],
      proposed_lab_requests = [],
      proposed_radiology_requests = [],
      diagnoses = [],
      vitals = {}
    } = req.body;

    if (!patient_id) {
      return errorResponse(res, 400, 'patient_id is required for CDS evaluation');
    }

    const evaluation = await evaluateCDS({
      pharmacy_id: req.pharmacy_id,
      patient_id,
      visit_id,
      encounter_id,
      proposed_medications,
      proposed_lab_requests,
      proposed_radiology_requests,
      diagnoses,
      vitals
    });

    return successResponse(res, 200, 'CDS evaluation complete', evaluation);
  } catch (err) {
    logger.error('CDS evaluation handler error:', err.message);
    return errorResponse(res, 500, 'Failed to perform Clinical Decision Support evaluation');
  }
};

const overrideCDSAlertHandler = async (req, res) => {
  try {
    const { alert_log_id, alert_type, summary, override_reason, visit_id, patient_id } = req.body;

    if (!override_reason || override_reason.trim().length < 3) {
      return errorResponse(res, 400, 'A valid documented clinical override reason is required.');
    }

    if (alert_log_id) {
      await pool.query(
        `UPDATE cds_alert_logs
         SET overridden = TRUE, override_reason = $1, override_by = $2, override_at = NOW()
         WHERE id = $3 AND (pharmacy_id = $4 OR pharmacy_id IS NULL)`,
        [override_reason, req.user?.id || null, alert_log_id, req.pharmacy_id]
      );
    } else {
      await pool.query(
        `INSERT INTO cds_alert_logs (pharmacy_id, visit_id, patient_id, user_id, alert_type, summary, overridden, override_reason, override_by, override_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8, NOW(), NOW())`,
        [
          req.pharmacy_id,
          visit_id || null,
          patient_id || null,
          req.user?.id || null,
          alert_type || 'MANUAL_OVERRIDE',
          summary || 'Clinician CDS Override',
          override_reason,
          req.user?.id || null
        ]
      );
    }

    return successResponse(res, 200, 'CDS alert override recorded in audit trail successfully');
  } catch (err) {
    logger.error('CDS override handler error:', err.message);
    return errorResponse(res, 500, 'Failed to record CDS alert override');
  }
};

const getCDSLogs = async (req, res) => {
  try {
    const { patient_id, visit_id, limit = 50, offset = 0 } = req.query;
    let query = `
      SELECT l.*, u.full_name as overridden_by_name, p.full_name as patient_name, p.patient_number
      FROM cds_alert_logs l
      LEFT JOIN users u ON l.override_by = u.id
      LEFT JOIN patients p ON l.patient_id = p.id
      WHERE (l.pharmacy_id = $1 OR l.pharmacy_id IS NULL)
    `;
    const params = [req.pharmacy_id];

    if (patient_id) {
      params.push(patient_id);
      query += ` AND l.patient_id = $${params.length}`;
    }
    if (visit_id) {
      params.push(visit_id);
      query += ` AND l.visit_id = $${params.length}`;
    }

    query += ` ORDER BY l.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    return successResponse(res, 200, 'CDS alert logs retrieved', result.rows);
  } catch (err) {
    logger.error('Get CDS logs error:', err.message);
    return errorResponse(res, 500, 'Failed to retrieve CDS logs');
  }
};

const getCDSStats = async (req, res) => {
  try {
    const pId = req.pharmacy_id;
    const totalAlertsRes = await pool.query(`SELECT COUNT(*)::int as cnt FROM cds_alert_logs WHERE pharmacy_id = $1 OR pharmacy_id IS NULL`, [pId]);
    const overriddenRes = await pool.query(`SELECT COUNT(*)::int as cnt FROM cds_alert_logs WHERE (pharmacy_id = $1 OR pharmacy_id IS NULL) AND overridden = TRUE`, [pId]);
    const byTypeRes = await pool.query(`
      SELECT alert_type, COUNT(*)::int as count 
      FROM cds_alert_logs 
      WHERE pharmacy_id = $1 OR pharmacy_id IS NULL
      GROUP BY alert_type 
      ORDER BY count DESC
    `, [pId]);
    const bySeverityRes = await pool.query(`
      SELECT severity, COUNT(*)::int as count 
      FROM cds_alert_logs 
      WHERE pharmacy_id = $1 OR pharmacy_id IS NULL
      GROUP BY severity 
      ORDER BY count DESC
    `, [pId]);

    return successResponse(res, 200, 'CDS statistics retrieved', {
      total_alerts: totalAlertsRes.rows[0]?.cnt || 0,
      total_overridden: overriddenRes.rows[0]?.cnt || 0,
      override_percentage: totalAlertsRes.rows[0]?.cnt > 0 
        ? Math.round(((overriddenRes.rows[0]?.cnt || 0) / totalAlertsRes.rows[0].cnt) * 100) 
        : 0,
      alerts_by_type: byTypeRes.rows,
      alerts_by_severity: bySeverityRes.rows
    });
  } catch (err) {
    logger.error('Get CDS stats error:', err.message);
    return errorResponse(res, 500, 'Failed to retrieve CDS statistics');
  }
};

module.exports = {
  evaluateCDSHandler,
  overrideCDSAlertHandler,
  getCDSLogs,
  getCDSStats
};
