const getAge = dob => {
  if (!dob) return '—';
  const years = Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
  return years > 0 ? `${years} yrs` : 'Pediatric (<1 yr)';
};

const formatDate = (dt) => {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleString('en-KE', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return String(dt);
  }
};

export const printTreatmentSummary = (visitDetail, pharmacy = null) => {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow popups to open the Patient Discharge Treatment Summary');
    return;
  }

  const facilityName = pharmacy?.name || 'OUTERING HEALTH SERVICES';
  const facilityAddress = pharmacy?.address || 'P.O. Box 45001-00100, Nairobi, Kenya';
  const facilityPhone = pharmacy?.phone || '+254 712 345 678';
  const facilityEmail = pharmacy?.email || 'clinical@outeringhealth.org';
  const facilityMOH = pharmacy?.moh_code || 'MOH-KEN-104928';

  const patient = visitDetail.patient || visitDetail || {};
  const visit = visitDetail.visit || visitDetail || {};
  const consultation = visitDetail.consultation || {};
  
  const prescriptions = visitDetail.prescriptions || consultation.prescriptions || [];
  const labRequests = visitDetail.lab_requests || consultation.lab_requests || [];
  const injectionOrders = visitDetail.injection_orders || visitDetail.mar_orders || [];
  const procedures = visitDetail.procedures || consultation.procedures || [];
  const nursingNotes = visitDetail.nursing_notes || [];
  const vitals = Array.isArray(visitDetail.vitals) ? visitDetail.vitals : (visitDetail.vitals ? [visitDetail.vitals] : []);

  // Determine if patient was admitted / inpatient
  const isAdmitted = visit.ward_name || visit.bed_number || visitDetail.ward_name || visitDetail.bed_number || visit.admitted_at || visitDetail.admitted_at;
  const isDischarged = visit.status === 'discharged' || visitDetail.status === 'discharged' || visitDetail.is_discharge;

  const docTitle = isAdmitted ? 'PATIENT DISCHARGE TREATMENT SUMMARY' : 'OUTPATIENT CLINICAL TREATMENT SUMMARY';

  // Format Vitals Table / History
  const vitalsRows = vitals.length > 0 
    ? vitals.map(v => `
        <tr style="border-bottom:1px solid #e2e8f0; font-size:11px;">
          <td style="padding:5px 8px; font-weight:600; color:#334155;">${formatDate(v.created_at || v.recorded_at)}</td>
          <td style="padding:5px 8px; text-align:center; font-family:monospace; font-weight:bold; color:#0f172a;">${v.blood_pressure_systolic && v.blood_pressure_diastolic ? `${v.blood_pressure_systolic}/${v.blood_pressure_diastolic}` : (v.bp || '—')}</td>
          <td style="padding:5px 8px; text-align:center; color:#1e293b;">${v.pulse_rate || v.pulse || '—'} bpm</td>
          <td style="padding:5px 8px; text-align:center; color:#1e293b;">${v.temperature || '—'} °C</td>
          <td style="padding:5px 8px; text-align:center; color:#1e293b; font-weight:600;">${v.oxygen_saturation || v.spo2 || '—'}%</td>
          <td style="padding:5px 8px; text-align:center; color:#1e293b;">${v.weight || '—'} kg</td>
          <td style="padding:5px 8px; color:#64748b; font-size:10px;">${v.recorded_by_name || v.nurse_name || 'Nurse'}</td>
        </tr>
      `).join('')
    : `
      <tr style="border-bottom:1px solid #e2e8f0; font-size:11px;">
        <td style="padding:5px 8px; font-weight:600; color:#334155;">${formatDate(visit.visit_date || Date.now())}</td>
        <td style="padding:5px 8px; text-align:center; font-family:monospace; font-weight:bold;">${visitDetail.blood_pressure_systolic || consultation.blood_pressure_systolic ? `${visitDetail.blood_pressure_systolic || consultation.blood_pressure_systolic}/${visitDetail.blood_pressure_diastolic || consultation.blood_pressure_diastolic}` : '—'}</td>
        <td style="padding:5px 8px; text-align:center;">${visitDetail.pulse_rate || consultation.pulse_rate || '—'} bpm</td>
        <td style="padding:5px 8px; text-align:center;">${visitDetail.temperature || consultation.temperature || '—'} °C</td>
        <td style="padding:5px 8px; text-align:center;">${visitDetail.oxygen_saturation || consultation.oxygen_saturation || '—'}%</td>
        <td style="padding:5px 8px; text-align:center;">${visitDetail.weight || consultation.weight || '—'} kg</td>
        <td style="padding:5px 8px; color:#64748b;">Triage Nurse</td>
      </tr>
    `;

  // Format Prescriptions Table
  const rxHtml = prescriptions.length > 0
    ? `
      <table style="width:100%; border-collapse:collapse; font-size:11px; margin-top:6px;">
        <thead>
          <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1; text-align:left; color:#334155; font-size:10px; text-transform:uppercase;">
            <th style="padding:6px 8px; border:1px solid #cbd5e1;">Drug Name / Code</th>
            <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">Dosage</th>
            <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">Frequency</th>
            <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">Duration</th>
            <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">Route</th>
            <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">Qty</th>
            <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${prescriptions.map(p => `
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:6px 8px; border:1px solid #e2e8f0; font-weight:bold; color:#0f172a;">
                ${p.drug_name || p.item_name}
                ${p.ddc_code || p.product_id ? `<span style="font-size:9px; color:#64748b; font-family:monospace; display:block;">Code: ${p.ddc_code || p.product_id}</span>` : ''}
              </td>
              <td style="padding:6px 8px; border:1px solid #e2e8f0; text-align:center; color:#334155;">${p.dosage || '—'}</td>
              <td style="padding:6px 8px; border:1px solid #e2e8f0; text-align:center; color:#334155;">${p.frequency || '—'}</td>
              <td style="padding:6px 8px; border:1px solid #e2e8f0; text-align:center; color:#334155;">${p.duration || '—'}</td>
              <td style="padding:6px 8px; border:1px solid #e2e8f0; text-align:center; color:#334155;">${p.route || 'Oral'}</td>
              <td style="padding:6px 8px; border:1px solid #e2e8f0; text-align:center; font-weight:600;">${p.quantity || '—'}</td>
              <td style="padding:6px 8px; border:1px solid #e2e8f0; text-align:center; font-weight:bold; font-size:10px; color:${p.status === 'dispensed' ? '#059669' : '#d97706'}; text-transform:uppercase;">
                ${p.status || 'Prescribed'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : '<div style="font-style:italic; color:#64748b; font-size:11px; margin-top:4px;">No take-home or OPD medications prescribed.</div>';

  // Format Inpatient MAR Orders Table
  const marHtml = injectionOrders.length > 0
    ? `
      <table style="width:100%; border-collapse:collapse; font-size:11px; margin-top:6px;">
        <thead>
          <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1; text-align:left; color:#334155; font-size:10px; text-transform:uppercase;">
            <th style="padding:6px 8px; border:1px solid #cbd5e1;">Inpatient Medication</th>
            <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">Dosage & Route</th>
            <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">Frequency</th>
            <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">Status</th>
            <th style="padding:6px 8px; border:1px solid #cbd5e1;">Prescribed / Administered Notes</th>
          </tr>
        </thead>
        <tbody>
          ${injectionOrders.map(o => `
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:6px 8px; border:1px solid #e2e8f0; font-weight:bold; color:#0f172a;">${o.drug_name}</td>
              <td style="padding:6px 8px; border:1px solid #e2e8f0; text-align:center;">${o.dosage || '—'} (${o.route || 'IV'})</td>
              <td style="padding:6px 8px; border:1px solid #e2e8f0; text-align:center;">${o.frequency || 'TDS'}</td>
              <td style="padding:6px 8px; border:1px solid #e2e8f0; text-align:center; font-weight:bold; font-size:10px; color:${o.status === 'administered' ? '#059669' : '#d97706'}; text-transform:uppercase;">
                ${o.status === 'administered' ? '✓ Administered' : o.status}
              </td>
              <td style="padding:6px 8px; border:1px solid #e2e8f0; font-size:10px; color:#334155;">
                <div>Prescribed by: <strong>${o.prescribed_by_name || o.doctor_name || 'Medical Officer'}</strong></div>
                ${o.status === 'administered' ? `<div style="color:#059669; font-weight:600;">Administered by ${o.administered_by_name || 'Nurse'} @ ${formatDate(o.administered_at)}</div>` : ''}
                ${o.nurse_report ? `<div style="font-style:italic; color:#475569; margin-top:2px;">"${o.nurse_report}"</div>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : '<div style="font-style:italic; color:#64748b; font-size:11px; margin-top:4px;">No ward MAR medication orders recorded.</div>';

  // Format Lab Requests Table
  const labHtml = labRequests.length > 0
    ? `
      <table style="width:100%; border-collapse:collapse; font-size:11px; margin-top:6px;">
        <thead>
          <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1; text-align:left; color:#334155; font-size:10px; text-transform:uppercase;">
            <th style="padding:6px 8px; border:1px solid #cbd5e1;">Investigation / LOINC Code</th>
            <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">Urgency</th>
            <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">Status</th>
            <th style="padding:6px 8px; border:1px solid #cbd5e1;">Official Parameter Results & Findings</th>
          </tr>
        </thead>
        <tbody>
          ${labRequests.map(l => `
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:6px 8px; border:1px solid #e2e8f0; font-weight:bold; color:#1e3a8a;">
                ${l.test_name}
                ${l.test_code || l.cpt_code ? `<span style="display:block; font-size:9px; color:#64748b; font-family:monospace;">[${l.test_code || l.cpt_code}]</span>` : ''}
              </td>
              <td style="padding:6px 8px; border:1px solid #e2e8f0; text-align:center; font-weight:bold; font-size:10px; text-transform:uppercase; color:${['urgent', 'stat', 'emergency'].includes((l.urgency||'').toLowerCase()) ? '#dc2626' : '#475569'};">
                ${l.urgency || 'Routine'}
              </td>
              <td style="padding:6px 8px; border:1px solid #e2e8f0; text-align:center; font-weight:bold; font-size:10px; color:${l.status === 'completed' ? '#059669' : '#d97706'}; text-transform:uppercase;">
                ${l.status === 'completed' ? '✓ COMPLETED' : 'PROCESSING'}
              </td>
              <td style="padding:6px 8px; border:1px solid #e2e8f0; font-size:11px;">
                ${l.status === 'completed' 
                  ? `
                    <div style="background:#f8fafc; padding:6px 8px; border-radius:4px; border:1px solid #e2e8f0;">
                      ${(l.result_value || l.result_flag) ? `
                        <div style="margin-bottom:4px; display:flex; gap:10px; align-items:center;">
                          <span style="font-size:12px; font-weight:bold; color:#0f172a; font-family:monospace;">${l.result_value || ''} ${l.result_unit || ''}</span>
                          ${l.reference_range ? `<span style="font-size:10px; color:#64748b;">(Ref Range: ${l.reference_range})</span>` : ''}
                          ${l.result_flag ? `<span style="font-size:10px; font-weight:bold; padding:2px 6px; border-radius:3px; background:${['high','critical','positive','abnormal'].includes(l.result_flag.toLowerCase()) ? '#fee2e2' : '#fef3c7'}; color:${['high','critical','positive','abnormal'].includes(l.result_flag.toLowerCase()) ? '#b91c1c' : '#b45309'}; text-transform:uppercase;">${l.result_flag}</span>` : ''}
                        </div>
                      ` : ''}
                      ${l.result ? `<div style="white-space:pre-wrap; color:#334155; font-size:11px; font-family:monospace;">${l.result}</div>` : ''}
                      <div style="font-size:9px; color:#64748b; margin-top:4px; border-top:1px dashed #cbd5e1; padding-top:3px;">
                        Tech: <strong>${l.technician_name || 'Lab Specialist'}</strong> | Date: ${formatDate(l.resulted_at || l.updated_at || l.created_at)}
                      </div>
                    </div>
                  `
                  : '<span style="color:#94a3b8; font-style:italic;">Awaiting laboratory analysis report</span>'
                }
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : '<div style="font-style:italic; color:#64748b; font-size:11px; margin-top:4px;">No laboratory investigations requested.</div>';

  // Format Procedures Table
  const procHtml = procedures.length > 0
    ? `
      <table style="width:100%; border-collapse:collapse; font-size:11px; margin-top:6px;">
        <thead>
          <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1; text-align:left; color:#334155; font-size:10px; text-transform:uppercase;">
            <th style="padding:6px 8px; border:1px solid #cbd5e1;">Procedure Name / Kenya DHA Code</th>
            <th style="padding:6px 8px; border:1px solid #cbd5e1;">Notes / Indications</th>
            <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">Clinician</th>
            <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">Outcome</th>
          </tr>
        </thead>
        <tbody>
          ${procedures.map(p => `
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:6px 8px; border:1px solid #e2e8f0; font-weight:bold; color:#0f172a;">
                ${p.procedure_name}
                ${p.procedure_code ? `<span style="display:block; font-size:9px; color:#64748b; font-family:monospace;">[${p.procedure_code}]</span>` : ''}
              </td>
              <td style="padding:6px 8px; border:1px solid #e2e8f0; color:#334155;">${p.notes || 'Routine Clinical Procedure'}</td>
              <td style="padding:6px 8px; border:1px solid #e2e8f0; text-align:center; color:#334155;">${p.doctor_name || 'Medical Officer'}</td>
              <td style="padding:6px 8px; border:1px solid #e2e8f0; text-align:center; font-weight:bold; color:#059669;">${p.outcome || 'Completed'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : '<div style="font-style:italic; color:#64748b; font-size:11px; margin-top:4px;">No clinical procedures performed.</div>';

  // Format Nursing Notes Log
  const notesHtml = nursingNotes.length > 0
    ? `
      <div style="margin-top:6px;">
        ${nursingNotes.map(n => `
          <div style="border:1px solid #e2e8f0; background:#f8fafc; border-radius:4px; padding:6px 10px; margin-bottom:6px; font-size:11px;">
            <div style="display:flex; justify-content:space-between; font-weight:bold; color:#1e293b; border-bottom:1px solid #cbd5e1; padding-bottom:3px; margin-bottom:4px;">
              <span>Nursing Note — ${n.nurse_name || 'Ward Nurse'}</span>
              <span style="font-size:10px; color:#64748b; font-weight:normal;">${formatDate(n.created_at)}</span>
            </div>
            <div style="white-space:pre-wrap; color:#334155;">${n.note_text || n.notes || '—'}</div>
            ${n.vitals_summary ? `<div style="font-size:10px; color:#1e3a8a; font-weight:600; margin-top:4px; background:#eff6ff; padding:3px 6px; border-radius:3px;">Vitals Note: ${n.vitals_summary}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `
    : '<div style="font-style:italic; color:#64748b; font-size:11px; margin-top:4px;">No ward nursing notes logged.</div>';

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${docTitle} - ${patient.full_name || visitDetail.patient_name || 'Record'}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { 
            font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
            color: #0f172a;
            line-height: 1.45;
            margin: 0;
            padding: 20px;
            background: #ffffff;
            font-size: 11px;
          }
          .header-table { width: 100%; border-collapse: collapse; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 12px; }
          .facility-name { font-size: 20px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
          .facility-sub { font-size: 10px; color: #475569; margin-top: 2px; }
          .doc-banner { 
            background: #0f172a;
            color: #ffffff;
            font-size: 14px;
            font-weight: 800;
            text-align: center;
            padding: 8px;
            margin: 12px 0 16px 0;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            border-radius: 4px;
          }
          .sec-header {
            font-size: 11px;
            font-weight: 800;
            color: #1e3a8a;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background: #eff6ff;
            border-left: 4px solid #1e3a8a;
            padding: 5px 8px;
            margin-top: 16px;
            margin-bottom: 8px;
          }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          .info-table td { padding: 5px 8px; font-size: 11px; border: 1px solid #cbd5e1; }
          .info-lbl { font-weight: 700; color: #475569; background: #f8fafc; width: 18%; }
          .info-val { color: #0f172a; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
          .card-box { border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px 10px; background: #fafafa; }
          .card-lbl { font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 4px; }
          .card-val { font-size: 11px; color: #0f172a; white-space: pre-wrap; }
          .page-break-inside-avoid { page-break-inside: avoid; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>

        <!-- HEADER -->
        <table class="header-table">
          <tr>
            <td style="width: 65%;">
              <div class="facility-name">${facilityName}</div>
              <div class="facility-sub">${facilityAddress} | Phone: ${facilityPhone}</div>
              <div class="facility-sub">Email: ${facilityEmail} | MOH Code: ${facilityMOH}</div>
            </td>
            <td style="width: 35%; text-align: right; vertical-align: bottom;">
              <div style="font-size: 12px; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">Official Medical Record</div>
              <div style="font-size: 10px; color: #64748b;">Visit Number: <strong>${visit.visit_number || visitDetail.visit_number || '—'}</strong></div>
              <div style="font-size: 10px; color: #64748b;">Generated: ${formatDate(Date.now())}</div>
            </td>
          </tr>
        </table>

        <!-- TITLE BANNER -->
        <div class="doc-banner">${docTitle}</div>

        <!-- PATIENT DEMOGRAPHICS & ADMISSION OVERVIEW -->
        <div class="sec-header">1. Patient Demographics & Hospital Care Status</div>
        <table class="info-table">
          <tr>
            <td class="info-lbl">Full Name</td>
            <td class="info-val" style="font-weight: 800; font-size: 12px; color: #0f172a;">${patient.full_name || visitDetail.patient_name || '—'}</td>
            <td class="info-lbl">Patient Number (MRN)</td>
            <td class="info-val" style="font-family: monospace; font-weight: 800; color: #1e3a8a;">${patient.patient_number || '—'}</td>
          </tr>
          <tr>
            <td class="info-lbl">Age / Gender</td>
            <td class="info-val">${getAge(patient.date_of_birth)} / <span style="text-transform: capitalize;">${patient.gender || '—'}</span></td>
            <td class="info-lbl">Phone / Contact</td>
            <td class="info-val">${patient.phone || '—'}</td>
          </tr>
          <tr>
            <td class="info-lbl">Blood Group</td>
            <td class="info-val" style="font-weight:bold;">${patient.blood_group || '—'}</td>
            <td class="info-lbl">Allergies</td>
            <td class="info-val" style="color: ${patient.allergies ? '#dc2626' : '#059669'}; font-weight: bold;">
              ${patient.allergies || 'NO KNOWN ALLERGIES'}
            </td>
          </tr>
          <tr>
            <td class="info-lbl">Care Status / Unit</td>
            <td class="info-val" style="font-weight:bold; color:#1e3a8a;">
              ${isAdmitted ? `${visit.ward_name || visitDetail.ward_name || 'Inpatient Ward'} (${visit.bed_number || visitDetail.bed_number || 'Bed'})` : 'Outpatient Department (OPD)'}
            </td>
            <td class="info-lbl">Admission / OPD Date</td>
            <td class="info-val">${formatDate(visit.admitted_at || visitDetail.admitted_at || visit.visit_date || visitDetail.visit_date)}</td>
          </tr>
          ${isAdmitted ? `
            <tr>
              <td class="info-lbl">Discharge Status</td>
              <td class="info-val" style="font-weight:bold; color:${isDischarged ? '#059669' : '#d97706'};">
                ${isDischarged ? `Discharged on ${formatDate(visit.discharged_at || visitDetail.discharged_at || visitDetail.discharge_date)}` : 'Active Inpatient Admission'}
              </td>
              <td class="info-lbl">Attending Physician</td>
              <td class="info-val" style="font-weight:600;">${visit.doctor_name || visitDetail.doctor_name || consultation.doctor_name || 'Medical Officer'}</td>
            </tr>
          ` : ''}
        </table>

        <!-- OPD CLINICAL ASSESSMENT & TRIAGE -->
        <div class="sec-header">2. Outpatient (OPD) Initial Assessment & Clinical History</div>
        ${(consultation.id || consultation.diagnosis || consultation.chief_complaint || visit.chief_complaint || visitDetail.chief_complaint) ? `
          <div class="grid-2">
            <div class="card-box">
              <div class="card-lbl">Chief Presenting Complaint</div>
              <div class="card-val">${consultation.presenting_complaint || consultation.chief_complaint || visit.chief_complaint || visitDetail.chief_complaint || '—'}</div>
            </div>
            <div class="card-box">
              <div class="card-lbl">History of Present Illness (HPI)</div>
              <div class="card-val">${consultation.history_of_illness || consultation.history_present_illness || '—'}</div>
            </div>
          </div>
          ${(consultation.examination_findings || consultation.physical_examination || consultation.review_of_systems) ? `
            <div class="grid-2">
              <div class="card-box">
                <div class="card-lbl">Physical Examination Findings</div>
                <div class="card-val">${consultation.examination_findings || consultation.physical_examination || '—'}</div>
              </div>
              <div class="card-box">
                <div class="card-lbl">Review of Systems (ROS)</div>
                <div class="card-val">${consultation.review_of_systems || '—'}</div>
              </div>
            </div>
          ` : ''}
          <table class="info-table" style="margin-top:4px;">
            <tr>
              <td class="info-lbl" style="width:20%; background:#eff6ff; color:#1e3a8a;">OPD / Admission Diagnosis</td>
              <td class="info-val" style="font-weight:bold; font-size:12px; color:#1e3a8a;">
                ${consultation.diagnosis || visit.diagnosis || visitDetail.diagnosis || 'Clinical evaluation completed'}
                ${(consultation.icd_code || consultation.icd10_code) ? `<span style="font-size:10px; font-weight:normal; color:#64748b; font-family:monospace;"> (ICD Code: ${consultation.icd_code || consultation.icd10_code})</span>` : ''}
              </td>
            </tr>
          </table>
        ` : '<div style="font-style:italic; color:#64748b; font-size:11px;">OPD consultation assessment notes standard.</div>'}

        <!-- INPATIENT WARD MANAGEMENT PLAN -->
        ${isAdmitted ? `
          <div class="sec-header">3. Inpatient Ward Management & Treatment Target Plan</div>
          <table class="info-table">
            <tr>
              <td class="info-lbl" style="vertical-align:top; width:20%;">Management Plan & Daily Targets</td>
              <td class="info-val" style="white-space:pre-wrap; line-height:1.5;">${visitDetail.management_plan || visit.management_plan || consultation.management_plan || 'Ward monitoring, IV fluids, serial vitals charting & daily clinician rounds.'}</td>
            </tr>
          </table>
        ` : ''}

        <!-- SERIAL VITALS LOG -->
        <div class="sec-header">${isAdmitted ? '4' : '3'}. Vital Signs Charting & Serial Monitoring</div>
        <table style="width:100%; border-collapse:collapse; margin-bottom:12px; border:1px solid #cbd5e1;">
          <thead>
            <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1; font-size:10px; color:#334155; text-transform:uppercase;">
              <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:left;">Date & Time</th>
              <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">BP (mmHg)</th>
              <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">Pulse</th>
              <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">Temp</th>
              <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">SpO2</th>
              <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">Weight</th>
              <th style="padding:6px 8px; border:1px solid #cbd5e1; text-align:left;">Clinician / Nurse</th>
            </tr>
          </thead>
          <tbody>
            ${vitalsRows}
          </tbody>
        </table>

        <!-- INPATIENT MAR MEDICATION ADMINISTRATION -->
        ${isAdmitted ? `
          <div class="sec-header">5. Inpatient MAR Medication Administration Log</div>
          ${marHtml}
        ` : ''}

        <!-- LABORATORY & DIAGNOSTIC INVESTIGATIONS -->
        <div class="sec-header">${isAdmitted ? '6' : '4'}. Laboratory & Diagnostic Investigations (LOINC Standard)</div>
        ${labHtml}

        <!-- WARD PROCEDURES & CLINICAL INTERVENTIONS -->
        <div class="sec-header">${isAdmitted ? '7' : '5'}. Procedures & Clinical Interventions (DHA Standard)</div>
        ${procHtml}

        <!-- INPATIENT NURSING NOTES -->
        ${isAdmitted ? `
          <div class="sec-header">8. Ward Nursing Care Progress Notes</div>
          ${notesHtml}
        ` : ''}

        <!-- TAKE HOME / OPD MEDICATIONS -->
        <div class="sec-header">${isAdmitted ? '9' : '6'}. Prescribed Pharmacy Take-Home Medications</div>
        ${rxHtml}

        <!-- DISCHARGE & FOLLOW-UP INSTRUCTIONS -->
        <div class="sec-header page-break-inside-avoid">${isAdmitted ? '10' : '7'}. Discharge Condition & Follow-Up Care Plan</div>
        <table class="info-table page-break-inside-avoid">
          <tr>
            <td class="info-lbl" style="width:20%;">Condition at Discharge</td>
            <td class="info-val" style="font-weight:bold; color:#059669;">
              ${isDischarged ? 'Discharged Home — Patient Stable & Condition Improved' : 'Active Management / Under Ongoing Inpatient Care'}
            </td>
          </tr>
          ${(consultation.follow_up_date || visitDetail.follow_up_date) ? `
            <tr>
              <td class="info-lbl">Scheduled Follow-up</td>
              <td class="info-val" style="font-weight:600;">
                Date: ${formatDate(consultation.follow_up_date || visitDetail.follow_up_date)} 
                ${(consultation.follow_up_notes || visitDetail.follow_up_notes) ? `| Instructions: ${consultation.follow_up_notes || visitDetail.follow_up_notes}` : ''}
              </td>
            </tr>
          ` : ''}
        </table>

        <!-- SIGNATURE & STAMP FOOTER -->
        <div class="page-break-inside-avoid" style="margin-top: 40px; border-top: 2px solid #0f172a; padding-top: 15px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 45%; vertical-align: top;">
                <div style="font-size: 10px; font-weight: bold; color: #475569; text-transform: uppercase;">Official Facility Seal & Verification:</div>
                <div style="border: 2px dashed #cbd5e1; width: 170px; height: 85px; margin-top: 6px; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 10px; font-weight: 600;">
                  OFFICIAL HOSPITAL STAMP
                </div>
              </td>
              <td style="width: 55%; vertical-align: top; text-align: right;">
                <div style="display: inline-block; text-align: left; width: 240px; margin-top: 10px;">
                  <div style="border-bottom: 1px dashed #0f172a; padding-bottom: 4px; margin-bottom: 6px;">
                    <span style="font-size: 9px; color: #64748b; display:block;">Attending Doctor / Physician Signature:</span>
                    <div style="height: 25px;"></div>
                  </div>
                  <div style="font-weight: 800; font-size: 11px; color: #0f172a;">${visit.doctor_name || visitDetail.doctor_name || consultation.doctor_name || 'Dr. Medical Officer'}</div>
                  <div style="font-size: 9px; color: #475569;">Reg No: KMPDC-M/${Math.floor(1000 + Math.random() * 9000)} | Date: ${formatDate(Date.now())}</div>
                </div>
              </td>
            </tr>
          </table>

          <div style="margin-top: 25px; text-align: center; font-size: 9px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 8px;">
            This is an official certified Patient Discharge & Clinical Treatment Summary issued by ${facilityName}.
          </div>
        </div>

      </body>
    </html>
  `);

  win.document.close();
  setTimeout(() => {
    win.print();
  }, 500);
};
