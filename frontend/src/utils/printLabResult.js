const getAge = dob => !dob ? '—' : Math.floor((Date.now()-new Date(dob))/(365.25*24*60*60*1000))+'y';

export const printLabResult = (requests, pharmacy = null, patientInfo = null, visitInfo = null) => {
  const win = window.open('', '_blank');
  
  const facilityName = pharmacy?.name || 'HEKIMA MEDICAL CENTRE';
  const facilityAddress = pharmacy?.address || 'P.O. Box 1234, Nairobi';
  const facilityPhone = pharmacy?.phone || '+254 700 000000';
  const facilityEmail = pharmacy?.email || 'info@hekimamedical.co.ke';

  const orderList = Array.isArray(requests) ? requests : [requests];
  const primary = orderList[0] || {};

  const patientName = patientInfo?.full_name || patientInfo?.patient_name || primary.patient_name || '—';
  const patientNumber = patientInfo?.patient_number || primary.patient_number || '—';
  const dob = patientInfo?.date_of_birth || primary.date_of_birth;
  const gender = patientInfo?.gender || primary.gender || '—';
  const visitNumber = visitInfo?.visit_number || primary.visit_number || '—';
  const doctorName = primary.doctor_name || visitInfo?.doctor_name || 'Attending Physician';
  const techName = primary.technician_name || primary.reported_by || 'Consultant Lab Technologist';

  const rowsHtml = orderList.map((ord, idx) => {
    const isAbnormal = ord.result_flag && ord.result_flag.toLowerCase() !== 'normal' && ord.result_flag.toLowerCase() !== 'normal range';
    const flagColor = isAbnormal ? '#dc2626' : '#16a34a';
    const bgStyle = isAbnormal ? 'background-color: #fef2f2;' : (idx % 2 === 1 ? 'background-color: #f8fafc;' : '');

    // Format value
    let valDisplay = ord.result_value || ord.result || 'Pending';
    let unitDisplay = ord.result_unit || '—';
    let refDisplay = ord.reference_range || '—';
    let flagDisplay = ord.result_flag ? ord.result_flag.toUpperCase() : (isAbnormal ? 'ABNORMAL' : 'NORMAL');
    let notesDisplay = ord.technician_notes || '—';

    return `
      <tr style="border-bottom: 1px solid #cbd5e1; ${bgStyle}">
        <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #0f172a;">${ord.test_name || 'Lab Test'}</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; font-size: 14px; color: ${isAbnormal ? flagColor : '#0f172a'};">${valDisplay}</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; color: #475569;">${unitDisplay}</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; color: #475569;">${refDisplay}</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; color: ${flagColor};">${flagDisplay}</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; color: #334155; font-size: 11px;">${notesDisplay}</td>
      </tr>
    `;
  }).join('');

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Consolidated Laboratory Report - ${patientName}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.5; margin: 35px; background: #fff; }
          .header-table { width: 100%; border-collapse: collapse; border-bottom: 3px double #1e3a8a; padding-bottom: 12px; margin-bottom: 20px; }
          .facility-name { font-size: 22px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; }
          .facility-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
          .report-title { font-size: 16px; font-weight: 700; text-align: center; background: #eff6ff; color: #1e40af; padding: 8px; margin: 18px 0; letter-spacing: 1px; border-radius: 6px; border: 1px solid #dbeafe; text-transform: uppercase; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
          .info-table td { padding: 6px 10px; border: 1px solid #e2e8f0; }
          .info-label { font-weight: 700; color: #475569; background: #f8fafc; width: 18%; }
          .info-val { color: #0f172a; font-weight: 500; }
          .records-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
          .records-table th { background: #1e3a8a; color: white; padding: 10px 8px; border: 1px solid #1e3a8a; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
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
              <div style="font-size: 13px; font-weight: 700; color: #1e3a8a;">DEPARTMENT OF LABORATORY MEDICINE</div>
              <div style="font-size: 11px; color: #64748b;">ISO 9001:2015 Accredited Pathology Lab</div>
            </td>
          </tr>
        </table>

        <div class="report-title">🧪 Official Consolidated Laboratory Report</div>

        <table class="info-table">
          <tr>
            <td class="info-label">Patient Name</td>
            <td class="info-val" style="font-weight: 700; font-size: 13px;">${patientName}</td>
            <td class="info-label">Patient No.</td>
            <td class="info-val" style="font-family: monospace; font-weight: 700; color: #1e3a8a;">${patientNumber}</td>
          </tr>
          <tr>
            <td class="info-label">Age / Gender</td>
            <td class="info-val">${getAge(dob)} / ${gender}</td>
            <td class="info-label">Visit Number</td>
            <td class="info-val">${visitNumber}</td>
          </tr>
          <tr>
            <td class="info-label">Requested By</td>
            <td class="info-val">${doctorName}</td>
            <td class="info-label">Reporting Tech</td>
            <td class="info-val" style="font-weight: 700; color: #1e3a8a;">👩‍🔬 ${techName}</td>
          </tr>
          <tr>
            <td class="info-label">Total Tests</td>
            <td class="info-val" style="font-weight: 700;">${orderList.length} Investigation(s)</td>
            <td class="info-label">Report Date</td>
            <td class="info-val">${new Date().toLocaleString('en-KE')}</td>
          </tr>
        </table>

        <div style="font-size: 13px; font-weight: 700; color: #1e3a8a; margin-top: 20px; margin-bottom: 8px;">
          🔬 Laboratory Test Results & Clinical Pathology Findings
        </div>

        <table class="records-table">
          <thead>
            <tr>
              <th>Investigation / Test</th>
              <th style="text-align: center;">Result Value</th>
              <th style="text-align: center;">Unit</th>
              <th style="text-align: center;">Reference Range</th>
              <th style="text-align: center;">Flag</th>
              <th>Technician Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <table style="width: 100%; margin-top: 50px; border-collapse: collapse;">
          <tr>
            <td style="width: 50%; font-size: 11px; vertical-align: top;">
              <div style="font-weight: 700; color: #475569;">Pathology Department Disclaimer:</div>
              <div style="color: #64748b; margin-top: 4px; font-size: 10px;">
                Results relate strictly to the specimen analyzed. Verified under Kenya Medical Technologists & Technicians Board (KMLTTB) standards.
              </div>
            </td>
            <td style="width: 50%; text-align: right; font-size: 12px; vertical-align: top;">
              <div style="display: inline-block; text-align: left; border-top: 1.5px solid #1e3a8a; padding-top: 6px; width: 220px; margin-top: 10px;">
                <div style="font-weight: 700; font-size: 11px; color: #0f172a;">Laboratory Technologist Signature:</div>
                <div style="font-size: 12px; font-weight: 700; color: #1e3a8a; margin-top: 3px;">${techName}</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 1px;">KMLTTB Licensed Medical Technologist</div>
              </div>
            </td>
          </tr>
        </table>

        <div class="footer-section">
          Official Laboratory Report · Generated by Hekima EMR Pathology Suite · Valid without alteration
        </div>
      </body>
    </html>
  `);

  win.document.close();
  setTimeout(() => win.print(), 500);
};

export const printCombinedLabReport = printLabResult;
