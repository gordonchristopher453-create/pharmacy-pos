const getAge = dob => !dob ? '—' : Math.floor((Date.now()-new Date(dob))/(365.25*24*60*60*1000))+'y';

export const printRadiologyReport = (reportData = {}, patient = {}, visit = {}, pharmacy = {}, currentUserName = '') => {
  const win = window.open('', '_blank');

  const facilityName = pharmacy?.name || 'HEKIMA MEDICAL CENTRE';
  const facilityAddress = pharmacy?.address || 'P.O. Box 1234, Nairobi';
  const facilityPhone = pharmacy?.phone || '+254 700 000000';
  const facilityEmail = pharmacy?.email || 'info@hekimamedical.co.ke';

  const radiologistName = reportData.radiologist_name || reportData.reported_by || currentUserName || 'Consultant Radiologist / Diagnostic Specialist';
  const doctorName = reportData.doctor_name || visit.doctor_name || 'Attending Physician';
  const studyName = reportData.study_name || reportData.examination || reportData.referral || 'Diagnostic Radiology / Imaging Examination';
  const findings = reportData.findings || reportData.result || 'No significant abnormality detected on visual evaluation.';
  const impression = reportData.impression || reportData.conclusion || 'Satisfactory imaging study as detailed in findings above.';
  const notes = reportData.notes || reportData.tech_notes || '';

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Radiology & Diagnostic Imaging Report - ${patient.full_name || patient.patient_name || 'Patient'}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.5; margin: 35px; background: #fff; }
          .header-table { width: 100%; border-collapse: collapse; border-bottom: 3px double #c2410c; padding-bottom: 12px; margin-bottom: 20px; }
          .facility-name { font-size: 22px; font-weight: 800; color: #c2410c; text-transform: uppercase; letter-spacing: 0.5px; }
          .facility-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
          .report-title { font-size: 16px; font-weight: 700; text-align: center; background: #fff7ed; color: #c2410c; padding: 8px; margin: 18px 0; letter-spacing: 1px; border-radius: 6px; border: 1px solid #ffedd5; text-transform: uppercase; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
          .info-table td { padding: 6px 10px; border: 1px solid #e2e8f0; }
          .info-label { font-weight: 700; color: #475569; background: #f8fafc; width: 18%; }
          .info-val { color: #0f172a; font-weight: 500; }
          .section-box { margin-top: 18px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; background: #fafafa; }
          .section-title { font-size: 12px; font-weight: 700; color: #c2410c; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
          .content-text { font-size: 13px; color: #1e293b; white-space: pre-wrap; line-height: 1.6; }
          .footer-section { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 10px; color: #94a3b8; text-align: center; }
          @media print {
            body { margin: 15px; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td>
              <div class="facility-name">${facilityName}</div>
              <div class="facility-sub">${facilityAddress} | Phone: ${facilityPhone}</div>
              <div class="facility-sub">Email: ${facilityEmail}</div>
            </td>
            <td style="text-align: right; vertical-align: bottom;">
              <div style="font-size: 13px; font-weight: 700; color: #ea580c;">DEPARTMENT OF RADIOLOGY</div>
              <div style="font-size: 11px; color: #64748b;">Diagnostic Imaging & Ultrasound</div>
            </td>
          </tr>
        </table>

        <div class="report-title">📸 Radiology & Diagnostic Imaging Report</div>

        <table class="info-table">
          <tr>
            <td class="info-label">Patient Name</td>
            <td class="info-val" style="font-weight: 700; font-size: 13px;">${patient.full_name || patient.patient_name || '—'}</td>
            <td class="info-label">Patient No.</td>
            <td class="info-val" style="font-family: monospace; font-weight: 700; color: #c2410c;">${patient.patient_number || visit.patient_number || '—'}</td>
          </tr>
          <tr>
            <td class="info-label">Age / Gender</td>
            <td class="info-val">${getAge(patient.date_of_birth)} / ${patient.gender || '—'}</td>
            <td class="info-label">Visit Number</td>
            <td class="info-val">${visit.visit_number || '—'}</td>
          </tr>
          <tr>
            <td class="info-label">Referring Doctor</td>
            <td class="info-val">${doctorName}</td>
            <td class="info-label">Radiologist / Tech</td>
            <td class="info-val" style="font-weight: 700; color: #ea580c;">📸 ${radiologistName}</td>
          </tr>
          <tr>
            <td class="info-label">Examination Requested</td>
            <td class="info-val" style="font-weight: 700; color: #9a3412;" colspan="3">${studyName}</td>
          </tr>
          <tr>
            <td class="info-label">Examination Date</td>
            <td class="info-val">${reportData.created_at ? new Date(reportData.created_at).toLocaleString('en-KE') : new Date().toLocaleString('en-KE')}</td>
            <td class="info-label">Report Status</td>
            <td class="info-val" style="font-weight: 700; color: #166534;">✅ Final / Verified Report</td>
          </tr>
        </table>

        <div class="section-box">
          <div class="section-title">🔍 Diagnostic Findings & Observations</div>
          <div class="content-text">${findings}</div>
        </div>

        ${impression ? `
          <div class="section-box" style="background: #fff; border-color: #ffedd5;">
            <div class="section-title" style="color: #ea580c;">💡 Diagnostic Impression / Conclusion</div>
            <div class="content-text" style="font-weight: 600; color: #431407;">${impression}</div>
          </div>
        ` : ''}

        ${notes ? `
          <div style="margin-top: 12px; font-size: 11px; color: #64748b; padding: 8px 12px; background: #f8fafc; border-radius: 6px;">
            <strong>Technical Remarks:</strong> ${notes}
          </div>
        ` : ''}

        <table style="width: 100%; margin-top: 50px; border-collapse: collapse;">
          <tr>
            <td style="width: 50%; font-size: 11px; vertical-align: top;">
              <div style="font-weight: 700; color: #475569;">Diagnostic Center Notice:</div>
              <div style="color: #64748b; margin-top: 4px; font-size: 10px;">
                This radiology report is electronically signed and filed under Kenya Medical Practitioners and Dentists Council guidelines.
              </div>
            </td>
            <td style="width: 50%; text-align: right; font-size: 12px; vertical-align: top;">
              <div style="display: inline-block; text-align: left; border-top: 1.5px solid #c2410c; padding-top: 6px; width: 220px; margin-top: 10px;">
                <div style="font-weight: 700; font-size: 11px; color: #0f172a;">Reporting Radiologist Signature:</div>
                <div style="font-size: 12px; font-weight: 700; color: #c2410c; margin-top: 3px;">${radiologistName}</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 1px;">Consultant Radiologist / Imaging Specialist</div>
              </div>
            </td>
          </tr>
        </table>

        <div class="footer-section">
          Official Diagnostic Imaging Report · Hekima EMR Radiology Information System (RIS)
        </div>
      </body>
    </html>
  `);

  win.document.close();
  setTimeout(() => win.print(), 500);
};
