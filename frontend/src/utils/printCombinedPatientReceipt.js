export const printCombinedPatientReceipt = (patientRecord, pharmacy, currentUser) => {
  const facilityName = pharmacy?.name || 'OUTERING HEALTH SERVICES';
  const logo = pharmacy?.logo_url || '';
  const header = pharmacy?.receipt_header || 'P.O Box 12004-00100 Nairobi\nTel: +254 700 000 000 | Email: info@outeringhealth.co.ke\nKRA PIN: P051897264Z | eTIMS Integrated System';
  const footer = pharmacy?.receipt_footer || 'Thank you for choosing Outering Health Services!\nFor any billing inquiries, please contact our Accounts Desk.\nSystem Generated Official Receipt & Discharge Clearance.';
  const currency = pharmacy?.currency || 'KES';

  const fmt = (n) => `${currency} ${parseFloat(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const visitDate = patientRecord.visit_date ? new Date(patientRecord.visit_date) : new Date();
  const dischargeDate = patientRecord.discharged_at ? new Date(patientRecord.discharged_at) : null;

  const visitDateStr = visitDate.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
  const visitTimeStr = visitDate.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
  const dischargeDateStr = dischargeDate ? `${dischargeDate.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })} ${dischargeDate.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}` : 'N/A (Active/Outpatient)';

  const headerLines = (header || '').split('\n').map(l => l.trim()).filter(l => l);

  const itemTypeLabels = {
    consultation: 'Consultation & Clinic Fees',
    opd: 'OPD Services & Procedures',
    laboratory: 'Laboratory Diagnostics',
    lab: 'Laboratory Diagnostics',
    radiology: 'Radiology & Imaging',
    procedure: 'Medical Procedures',
    drug: 'Pharmacy & Prescriptions',
    injection: 'Injections & Nursing',
    admission: 'Inpatient Ward Admission',
    bed_charge: 'Ward Accommodation & Bed Charges',
    mch: 'Maternal & Child Health Services',
    other: 'Other Medical Services'
  };

  const rawItems = patientRecord.items || patientRecord.billing_items || [];
  // Filter out invalid null items if any
  const items = Array.isArray(rawItems) ? rawItems.filter(i => i && (i.id || i.item_name || i.description)) : [];

  // Group items by item_type category
  const grouped = {};
  items.forEach(item => {
    const cat = itemTypeLabels[item.item_type] || 'Other Medical Services';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  const itemsBilled = items.reduce((s, i) => s + parseFloat(i.total_price || (i.unit_price * (i.quantity || 1)) || 0), 0);
  const itemsPaid = items.reduce((s, i) => {
    const st = (i.status || '').toLowerCase();
    const pm = (i.payment_method || '').toLowerCase();
    if (['paid', 'insurance', 'nhif', 'sha', 'corporate', 'settled', 'cleared'].includes(st)) {
      return s + parseFloat(i.paid_amount || i.total_price || (i.unit_price * (i.quantity || 1)) || 0);
    }
    if (['cash', 'mpesa', 'bank', 'card', 'insurance', 'sha', 'nhif', 'corporate'].includes(pm) && st !== 'pending' && st !== 'waived' && st !== 'cancelled') {
      return s + parseFloat(i.paid_amount || i.total_price || (i.unit_price * (i.quantity || 1)) || 0);
    }
    if (st === 'partial') {
      return s + parseFloat(i.paid_amount || 0);
    }
    return s;
  }, 0);

  const itemsWaived = items.filter(i => (i.status || '').toLowerCase() === 'waived').reduce((s, i) => s + parseFloat(i.total_price || (i.unit_price * (i.quantity || 1)) || 0), 0);

  const totalBilled = items.length > 0 ? itemsBilled : parseFloat(patientRecord.total_billed || patientRecord.total_amount || 0);
  const totalPaid = items.length > 0 ? itemsPaid : parseFloat(patientRecord.total_paid || patientRecord.paid_amount || (patientRecord.fee_paid ? totalBilled : 0));
  const totalWaived = items.length > 0 ? itemsWaived : parseFloat(patientRecord.total_waived || 0);
  const balance = Math.max(0, totalBilled - totalPaid - totalWaived);

  const isFullySettled = balance <= 0;
  const isDischarged = patientRecord.visit_status === 'discharged' || patientRecord.discharged_at;

  const statusTitle = isDischarged 
    ? (isFullySettled ? '✅ DISCHARGED - ACCOUNT FULLY SETTLED' : '⚠️ DISCHARGED - PENDING BALANCE')
    : (isFullySettled ? '✅ ACCOUNT FULLY PAID' : '⏳ ACTIVE VISIT - PARTIAL PAYMENTS');

  const cashierName = currentUser?.full_name || currentUser?.username || 'Cashier / Receptionist';
  const receiptNo = `RCP-${patientRecord.visit_number || 'VIS'}-${Math.floor(1000 + Math.random() * 9000)}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Combined Payment Receipt - ${patientRecord.patient_name} (${patientRecord.visit_number})</title>
      <style>
        @page { size: A4; margin: 12mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; background: #fff; padding: 20px; font-size: 13px; line-height: 1.5; }
        .receipt-container { max-width: 800px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px; padding: 24px; background: #ffffff; }
        
        .header-table { width: 100%; margin-bottom: 16px; border-bottom: 2px solid #0f172a; padding-bottom: 16px; }
        .facility-title { font-size: 20px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
        .facility-sub { font-size: 11px; color: #475569; margin-top: 4px; white-space: pre-line; }
        
        .doc-type-banner { background: #0f172a; color: #ffffff; text-align: center; padding: 8px 12px; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; border-radius: 4px; margin-bottom: 16px; }
        
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 16px; borderRadius: 6px; margin-bottom: 20px; }
        .meta-item { font-size: 12px; }
        .meta-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
        .meta-val { font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px; }
        
        table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        table.data-table th { background: #f1f5f9; color: #334155; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 8px 10px; border-bottom: 2px solid #cbd5e1; text-align: left; }
        table.data-table td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
        
        .category-row td { background: #f8fafc; font-weight: 800; color: #0f172a; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; padding-top: 10px; padding-bottom: 6px; }
        .status-pill { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
        .status-paid { background: #dcfce7; color: #15803d; }
        .status-pending { background: #fee2e2; color: #b91c1c; }
        .status-waived { background: #f1f5f9; color: #475569; }
        
        .summary-box { float: right; width: 320px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; }
        .summary-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; color: #334155; }
        .summary-row.total { font-size: 15px; font-weight: 800; color: #0f172a; border-top: 2px solid #0f172a; padding-top: 8px; margin-top: 6px; }
        .summary-row.balance { font-size: 14px; font-weight: 800; color: ${isFullySettled ? '#15803d' : '#b91c1c'}; border-top: 1px dashed #cbd5e1; padding-top: 6px; margin-top: 4px; }
        
        .clearance-stamp { text-align: center; border: 2px dashed ${isFullySettled ? '#16a34a' : '#dc2626'}; color: ${isFullySettled ? '#15803d' : '#b91c1c'}; padding: 10px; font-weight: 800; font-size: 13px; letter-spacing: 1px; border-radius: 6px; margin-bottom: 24px; clear: both; }
        
        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; padding-top: 16px; border-top: 1px solid #cbd5e1; }
        .sig-box { text-align: center; font-size: 11px; color: #475569; }
        .sig-line { border-bottom: 1px solid #94a3b8; height: 35px; margin-bottom: 6px; }
        
        .footer-note { text-align: center; font-size: 11px; color: #64748b; margin-top: 24px; white-space: pre-line; border-top: 1px solid #e2e8f0; padding-top: 12px; }
        
        @media print {
          body { padding: 0; background: #fff; }
          .receipt-container { border: none; padding: 0; width: 100%; max-width: 100%; }
        }
      </style>
    </head>
    <body>
      <div class="receipt-container">
        <!-- HEADER -->
        <table class="header-table">
          <tr>
            <td style="vertical-align: top;">
              ${logo ? `<img src="${logo}" style="height: 55px; margin-bottom: 8px;" alt="Logo" />` : ''}
              <div class="facility-title">${facilityName}</div>
              <div class="facility-sub">${headerLines.join('\n')}</div>
            </td>
            <td style="text-align: right; vertical-align: top;">
              <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Official Receipt No.</div>
              <div style="font-size: 16px; font-weight: 800; color: #0f172a; font-family: monospace;">${receiptNo}</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Issued On: ${new Date().toLocaleDateString('en-KE')} ${new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</div>
            </td>
          </tr>
        </table>

        <!-- BANNER -->
        <div class="doc-type-banner">
          COMBINED PATIENT STATEMENT & PAYMENT RECEIPT
        </div>

        <!-- PATIENT & VISIT METADATA -->
        <div class="meta-grid">
          <div>
            <div class="meta-item">
              <div class="meta-label">Patient Name</div>
              <div class="meta-val">${patientRecord.patient_name || 'N/A'}</div>
            </div>
            <div class="meta-item" style="margin-top: 8px;">
              <div class="meta-label">Patient Number / ID</div>
              <div class="meta-val" style="font-family: monospace;">${patientRecord.patient_number || 'N/A'}</div>
            </div>
            <div class="meta-item" style="margin-top: 8px;">
              <div class="meta-label">Gender / Phone</div>
              <div class="meta-val">${patientRecord.gender || 'N/A'} · ${patientRecord.phone || 'N/A'}</div>
            </div>
          </div>
          <div>
            <div class="meta-item">
              <div class="meta-label">Visit Number</div>
              <div class="meta-val" style="font-family: monospace;">${patientRecord.visit_number || 'N/A'}</div>
            </div>
            <div class="meta-item" style="margin-top: 8px;">
              <div class="meta-label">Admission / Visit Date</div>
              <div class="meta-val">${visitDateStr} (${visitTimeStr})</div>
            </div>
            <div class="meta-item" style="margin-top: 8px;">
              <div class="meta-label">Discharge Date / Status</div>
              <div class="meta-val">${dischargeDateStr}</div>
            </div>
          </div>
        </div>

        <!-- ITEMIZED SERVICES TABLE -->
        <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 8px; letter-spacing: 0.5px;">
          📋 Itemized Account Ledger & Charges
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 45%;">Service / Item Description</th>
              <th style="width: 15%; text-align: center;">Qty</th>
              <th style="width: 20%; text-align: right;">Unit Price</th>
              <th style="width: 20%; text-align: right;">Total Price</th>
            </tr>
          </thead>
          <tbody>
            ${Object.keys(grouped).length === 0 ? `
              <tr><td colspan="4" style="text-align: center; color: #64748b; padding: 16px;">No billed items recorded for this visit.</td></tr>
            ` : Object.entries(grouped).map(([category, catItems]) => `
              <tr class="category-row">
                <td colspan="4">📂 ${category}</td>
              </tr>
              ${catItems.map(item => `
                <tr>
                  <td>
                    <div style="font-weight: 600; color: #0f172a;">${item.item_name || item.description || 'Medical Service'}</div>
                    ${item.description && item.description !== item.item_name ? `<div style="font-size: 11px; color: #64748b;">${item.description}</div>` : ''}
                  </td>
                  <td style="text-align: center;">${item.quantity || 1}</td>
                  <td style="text-align: right; font-family: monospace;">${fmt(item.unit_price)}</td>
                  <td style="text-align: right; font-weight: 700; font-family: monospace;">${fmt(item.total_price)}</td>
                </tr>
              `).join('')}
            `).join('')}
          </tbody>
        </table>

        <!-- SUMMARY BOX -->
        <div class="summary-box">
          <div class="summary-row">
            <span>Total Billed Charges:</span>
            <span style="font-family: monospace; font-weight: 700;">${fmt(totalBilled)}</span>
          </div>
          <div class="summary-row">
            <span>Total Waived / Discounts:</span>
            <span style="font-family: monospace; color: #64748b;">-${fmt(totalWaived)}</span>
          </div>
          <div class="summary-row total">
            <span>Total Amount Paid:</span>
            <span style="font-family: monospace; color: #16a34a;">${fmt(totalPaid)}</span>
          </div>
          <div class="summary-row balance">
            <span>Outstanding Balance:</span>
            <span style="font-family: monospace;">${fmt(Math.max(0, balance))}</span>
          </div>
        </div>

        <!-- CLEARANCE BANNER -->
        <div class="clearance-stamp">
          ${statusTitle}
        </div>

        <!-- SIGNATURES -->
        <div class="signatures">
          <div class="sig-box">
            <div class="sig-line"></div>
            <div>Prepared By: <strong>${cashierName}</strong></div>
            <div>Official Reception / Billing Desk</div>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <div>Patient / Relative Signature</div>
            <div>Date: ____ / ____ / ________</div>
          </div>
        </div>

        <!-- FOOTER -->
        <div class="footer-note">
          ${footer}
        </div>
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  const printWin = window.open('', '_blank');
  if (printWin) {
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  }
};
