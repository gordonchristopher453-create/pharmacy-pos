const getAge = dob => !dob ? '—' : Math.floor((Date.now()-new Date(dob))/(365.25*24*60*60*1000))+'y';

export const printInjectionReport = (orders, patient = {}, visit = {}, pharmacy = {}, currentNurseName = '') => {
  const win = window.open('', '_blank');

  const facilityName = pharmacy?.name || 'HEKIMA MEDICAL CENTRE';
  const facilityAddress = pharmacy?.address || 'P.O. Box 1234, Nairobi';
  const facilityPhone = pharmacy?.phone || '+254 700 000000';
  const facilityEmail = pharmacy?.email || 'info@hekimamedical.co.ke';

  const orderList = Array.isArray(orders) ? orders : [orders];
  const primaryOrder = orderList[0] || {};
  const nurseName = primaryOrder.nurse_name || primaryOrder.administered_by_name || currentNurseName || 'Registered Staff Nurse (NCK)';
  const doctorName = primaryOrder.prescribed_by_name || visit.doctor_name || 'Attending Medical Officer';

  const rowsHtml = orderList.map((ord, idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? 'background-color: #f8fafc;' : ''}">
      <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: 600; color: #1e293b;">${ord.drug_name || ord.item_name || 'Procedure / Injection'}</td>
      <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: 500;">${ord.dosage || 'As Directed'}</td>
      <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; color: #475569;">${ord.route || 'IM/IV'}</td>
      <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; color: #475569;">${ord.frequency || 'Stat / Once'}</td>
      <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600; color: #16a34a;">
        ${ord.administered_at ? new Date(ord.administered_at).toLocaleString('en-KE') : 'Administered'}
      </td>
      <td style="padding: 10px; border: 1px solid #cbd5e1; color: #334155; font-size: 11px;">
        ${ord.nurse_report || ord.notes || 'Given with precautions. Patient monitored post-administration.'}
      </td>
    </tr>
  `).join('');

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Injection & Procedure Administration Report - ${patient.full_name || patient.patient_name || 'Patient'}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.5; margin: 35px; background: #fff; }
          .header-table { width: 100%; border-collapse: collapse; border-bottom: 3px double #0d9488; padding-bottom: 12px; margin-bottom: 20px; }
          .facility-name { font-size: 22px; font-weight: 800; color: #0f766e; text-transform: uppercase; letter-spacing: 0.5px; }
          .facility-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
          .report-title { font-size: 16px; font-weight: 700; text-align: center; background: #f0fdf4; color: #166534; padding: 8px; margin: 18px 0; letter-spacing: 1px; border-radius: 6px; border: 1px solid #bbf7d0; text-transform: uppercase; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
          .info-table td { padding: 6px 10px; border: 1px solid #e2e8f0; }
          .info-label { font-weight: 700; color: #475569; background: #f8fafc; width: 18%; }
          .info-val { color: #0f172a; font-weight: 500; }
          .records-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
          .records-table th { background: #0f766e; color: white; padding: 8px; border: 1px solid #0d9488; text-align: left; font-size: 11px; text-transform: uppercase; }
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
              <div style="font-size: 13px; font-weight: 700; color: #0f766e;">INJECTION & PROCEDURE UNIT</div>
              <div style="font-size: 11px; color: #64748b;">Nursing & Emergency Care Services</div>
            </td>
          </tr>
        </table>

        <div class="report-title">💉 Injection & Treatment Administration Report</div>

        <table class="info-table">
          <tr>
            <td class="info-label">Patient Name</td>
            <td class="info-val" style="font-weight: 700; font-size: 13px;">${patient.full_name || patient.patient_name || '—'}</td>
            <td class="info-label">Patient No.</td>
            <td class="info-val" style="font-family: monospace; font-weight: 700; color: #0f766e;">${patient.patient_number || visit.patient_number || '—'}</td>
          </tr>
          <tr>
            <td class="info-label">Age / Gender</td>
            <td class="info-val">${getAge(patient.date_of_birth)} / ${patient.gender || '—'}</td>
            <td class="info-label">Visit Number</td>
            <td class="info-val">${visit.visit_number || '—'}</td>
          </tr>
          <tr>
            <td class="info-label">Prescribed By</td>
            <td class="info-val">${doctorName}</td>
            <td class="info-label">Administered By</td>
            <td class="info-val" style="font-weight: 700; color: #166534;">👩‍⚕️ ${nurseName}</td>
          </tr>
          <tr>
            <td class="info-label">Department/Unit</td>
            <td class="info-val">Injection Room / Outpatient Care</td>
            <td class="info-label">Report Date</td>
            <td class="info-val">${new Date().toLocaleString('en-KE')}</td>
          </tr>
        </table>

        <div style="font-size: 13px; font-weight: 700; color: #0f766e; margin-top: 20px; margin-bottom: 8px;">
          📋 Administered Medications & Nursing Procedures
        </div>

        <table class="records-table">
          <thead>
            <tr>
              <th>Drug / Procedure</th>
              <th style="text-align: center;">Dosage</th>
              <th style="text-align: center;">Route</th>
              <th style="text-align: center;">Frequency</th>
              <th style="text-align: center;">Time Administered</th>
              <th>Nurse Observations / Notes</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <table style="width: 100%; margin-top: 50px; border-collapse: collapse;">
          <tr>
            <td style="width: 50%; font-size: 11px; vertical-align: top;">
              <div style="font-weight: 700; color: #475569;">Clinical Verification Note:</div>
              <div style="color: #64748b; margin-top: 4px; font-size: 10px;">
                Medication was administered adhering to aseptic techniques and clinical safety protocols.
              </div>
            </td>
            <td style="width: 50%; text-align: right; font-size: 12px; vertical-align: top;">
              <div style="display: inline-block; text-align: left; border-top: 1.5px solid #0f766e; padding-top: 6px; width: 220px; margin-top: 10px;">
                <div style="font-weight: 700; font-size: 11px; color: #0f172a;">Administering Nurse Signature:</div>
                <div style="font-size: 12px; font-weight: 600; color: #0f766e; margin-top: 3px;">${nurseName}</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 1px;">Registered Nurse (NCK Licensed)</div>
              </div>
            </td>
          </tr>
        </table>

        <div class="footer-section">
          Official Nursing Administration Record · Generated by Hekima EMR System · Valid without alteration
        </div>
      </body>
    </html>
  `);

  win.document.close();
  setTimeout(() => win.print(), 500);
};
