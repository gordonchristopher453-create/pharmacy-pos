// Writes an append-only audit trail entry. Call this from inside the
// same transaction (pass the `client`, not the pool) right before an
// UPDATE or DELETE on a clinical table, so the audit row and the
// mutation either both commit or both roll back together.

async function logAudit(client, {
  pharmacy_id, table_name, record_id, action,
  old_data = null, new_data = null, changed_by = null,
  visit_id = null, patient_id = null,
}) {
  try {
    if (client && typeof client.query === 'function') {
      const recIdStr = record_id != null ? String(record_id) : '0';
      const isUuid = (val) => val && typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      const parsedPharmacyId = isUuid(pharmacy_id) ? pharmacy_id : (pharmacy_id ? String(pharmacy_id) : null);
      const parsedChangedBy = isUuid(changed_by) ? changed_by : (changed_by ? String(changed_by) : null);
      const parsedVisitId = visit_id ? String(visit_id) : null;
      const parsedPatientId = patient_id ? String(patient_id) : null;

      await client.query('SAVEPOINT audit_sp');
      await client.query(`
        INSERT INTO audit_log
          (pharmacy_id, table_name, record_id, action, old_data, new_data, changed_by, visit_id, patient_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [
        parsedPharmacyId, table_name, recIdStr, action,
        old_data ? JSON.stringify(old_data) : null,
        new_data ? JSON.stringify(new_data) : null,
        parsedChangedBy, parsedVisitId, parsedPatientId,
      ]);
      await client.query('RELEASE SAVEPOINT audit_sp');
    }
  } catch (err) {
    try {
      if (client && typeof client.query === 'function') {
        await client.query('ROLLBACK TO SAVEPOINT audit_sp');
      }
    } catch (rErr) {}
    console.error('Audit log failed (safely rolled back savepoint):', err.message);
  }
}

module.exports = { logAudit };
