export const printInpatientBill = (selectedPatient, billingItems = [], drugOrders = [], labRequests = [], procedures = [], pharmacy = null, currentUser = null) => {
  const win = window.open('', '_blank');
  if (!win) return;

  const facilityName = pharmacy?.name || 'OUTERING HEALTH SERVICES';
  const logo = pharmacy?.logo_url || '';
  const header = pharmacy?.receipt_header || 'P.O Box 12004-00100 Nairobi\nTel: +254 700 000 000 | Email: info@outeringhealth.co.ke\nKRA PIN: P051897264Z | eTIMS Integrated System';
  const footer = pharmacy?.receipt_footer || 'Thank you for choosing Outering Health Services!\nFor any billing inquiries, please contact our Accounts & Billing Desk.\nSystem Generated Inpatient Invoice & Statement of Account.';
  const currency = pharmacy?.currency || 'KES';

  const fmt = (n) => `${currency} ${parseFloat(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const admissionDate = selectedPatient.admission_date ? new Date(selectedPatient.admission_date) : (selectedPatient.created_at ? new Date(selectedPatient.created_at) : new Date());
  const dischargeDate = selectedPatient.discharged_at ? new Date(selectedPatient.discharged_at) : null;

  const admDateStr = admissionDate.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const disDateStr = dischargeDate 
    ? dischargeDate.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
    : 'Still Admitted (Active IPD)';

  const headerLines = (header || '').split('\n').map(l => l.trim()).filter(l => l);

  // Group billing items by type
  const items = Array.isArray(billingItems) ? billingItems : [];
  
  const categoryLabels = {
    admission: '🛏️ Ward Accommodation & Bed Stay',
    bed_charge: '🛏️ Ward Accommodation & Bed Stay',
    prescription: '💊 MAR Medications & Pharmacy Supplies',
    drug: '💊 MAR Medications & Pharmacy Supplies',
    laboratory: '🔬 Laboratory Services & Tests',
    lab: '🔬 Laboratory Services & Tests',
    radiology: '📷 Radiology & Diagnostic Imaging',
    procedure: '🩺 Ward Procedures & Clinical Interventions',
    injection: '💉 Injections & Nursing Services',
    other: '📋 Other Medical & Ward Services'
  };

  const grouped = {};
  items.forEach(item => {
    const cat = categoryLabels[item.item_type] || '📋 General Ward & Medical Services';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  const totalBilled = items.reduce((s, i) => s + parseFloat(i.total_price || (parseFloat(i.unit_price || 0) * (parseInt(i.quantity) || 1)) || 0), 0);
  const totalPaid = items.reduce((s, i) => {
    const st = (i.status || '').toLowerCase();
    const pm = (i.payment_method || '').toLowerCase();
    if (['paid', 'insurance', 'nhif', 'sha', 'corporate', 'settled', 'cleared'].includes(st)) {
      return s + parseFloat(i.paid_amount || i.total_price || (parseFloat(i.unit_price || 0) * (parseInt(i.quantity) || 1)) || 0);
    }
    if (['cash', 'mpesa', 'bank', 'card', 'insurance', 'sha', 'nhif', 'corporate'].includes(pm) && st !== 'pending' && st !== 'waived' && st !== 'cancelled') {
      return s + parseFloat(i.paid_amount || i.total_price || (parseFloat(i.unit_price || 0) * (parseInt(i.quantity) || 1)) || 0);
    }
    if (st === 'partial') {
      return s + parseFloat(i.paid_amount || 0);
    }
    return s;
  }, 0);
  const totalWaived = items.filter(i => (i.status || '').toLowerCase() === 'waived').reduce((s, i) => s + parseFloat(i.total_price || (parseFloat(i.unit_price || 0) * (parseInt(i.quantity) || 1)) || 0), 0);
  const balance = Math.max(0, totalBilled - totalPaid - totalWaived);

  const invoiceNo = `INV-IPD-${selectedPatient.patient_number || selectedPatient.id || Math.floor(1000 + Math.random() * 9000)}`;
  const preparedBy = currentUser?.full_name || currentUser?.username || 'Attending Clinical Staff / Accounts';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Inpatient Statement of Account - ${selectedPatient.patient_name}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 12px;
            color: #1e293b;
            margin: 0;
            padding: 16px;
            background: #ffffff;
          }
          .header-table {
            width: 100%;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .facility-title {
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .facility-sub {
            font-size: 11px;
            color: #475569;
            line-height: 1.4;
          }
          .invoice-badge {
            text-align: right;
          }
          .invoice-title {
            font-size: 16px;
            font-weight: 800;
            color: #2563eb;
            text-transform: uppercase;
          }
          .inv-num {
            font-size: 11px;
            font-family: monospace;
            font-weight: bold;
            color: #64748b;
          }
          .patient-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 20px;
          }
          .patient-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
          }
          .p-field {
            font-size: 11px;
          }
          .p-label {
            color: #64748b;
            font-weight: 600;
            display: block;
            text-transform: uppercase;
            font-size: 9px;
          }
          .p-val {
            font-weight: 700;
            color: #0f172a;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .items-table th {
            background: #0f172a;
            color: #ffffff;
            font-weight: 700;
            text-align: left;
            padding: 8px 10px;
            font-size: 10px;
            text-transform: uppercase;
          }
          .category-header {
            background: #f1f5f9;
            font-weight: 800;
            font-size: 11px;
            color: #1e293b;
            padding: 6px 10px;
            border-left: 3px solid #2563eb;
          }
          .items-table td {
            padding: 7px 10px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 11px;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .status-paid { color: #16a34a; font-weight: 700; }
          .status-pending { color: #dc2626; font-weight: 700; }
          .summary-box {
            width: 320px;
            margin-left: auto;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 12px;
            background: #f8fafc;
            margin-bottom: 24px;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            font-size: 11px;
          }
          .summary-total {
            border-top: 2px solid #0f172a;
            padding-top: 8px;
            margin-top: 6px;
            font-size: 14px;
            font-weight: 800;
            color: #0f172a;
          }
          .signatures {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
            padding-top: 20px;
            border-top: 1px dashed #cbd5e1;
          }
          .sig-block {
            width: 40%;
            text-align: center;
          }
          .sig-line {
            border-bottom: 1px solid #475569;
            margin-bottom: 6px;
            height: 30px;
          }
          .sig-text {
            font-size: 10px;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
          }
          .footer-note {
            margin-top: 30px;
            text-align: center;
            font-size: 10px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
            white-space: pre-line;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 16px; text-align: right;">
          <button onclick="window.print()" style="padding: 8px 16px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
            🖨️ Print Invoice
          </button>
        </div>

        <!-- Facility Header -->
        <table class="header-table">
          <tr>
            <td style="vertical-align: top;">
              ${logo ? `<img src="${logo}" style="height: 50px; margin-bottom: 6px;" /><br/>` : ''}
              <div class="facility-title">${facilityName}</div>
              <div class="facility-sub">${headerLines.join(' • ')}</div>
            </td>
            <td class="invoice-badge" style="vertical-align: top;">
              <div class="invoice-title">INPATIENT STATEMENT OF ACCOUNT</div>
              <div class="inv-num">INVOICE #: ${invoiceNo}</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Date: ${new Date().toLocaleDateString('en-KE')}</div>
            </td>
          </tr>
        </table>

        <!-- Patient Demographics -->
        <div class="patient-box">
          <div class="patient-grid">
            <div class="p-field">
              <span class="p-label">Patient Name</span>
              <span class="p-val">${selectedPatient.patient_name}</span>
            </div>
            <div class="p-field">
              <span class="p-label">Patient Reg No</span>
              <span class="p-val">${selectedPatient.patient_number || selectedPatient.patient_id || '—'}</span>
            </div>
            <div class="p-field">
              <span class="p-label">Ward & Bed</span>
              <span class="p-val">${selectedPatient.ward_name || 'Inpatient Ward'} — Bed ${selectedPatient.bed_number || 'N/A'}</span>
            </div>
            <div class="p-field">
              <span class="p-label">Admission Date</span>
              <span class="p-val">${admDateStr}</span>
            </div>
            <div class="p-field">
              <span class="p-label">Discharge Date</span>
              <span class="p-val">${disDateStr}</span>
            </div>
            <div class="p-field">
              <span class="p-label">Attending Physician</span>
              <span class="p-val">${selectedPatient.attending_doctor || selectedPatient.doctor_name || 'Dr. On Duty'}</span>
            </div>
          </div>
        </div>

        <!-- Itemized Charges -->
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 45%;">Item Description / Clinical Service</th>
              <th class="text-center" style="width: 10%;">Qty</th>
              <th class="text-right" style="width: 15%;">Unit Price</th>
              <th class="text-right" style="width: 15%;">Total (${currency})</th>
              <th class="text-center" style="width: 15%;">Payment Status</th>
            </tr>
          </thead>
          <tbody>
            ${Object.keys(grouped).length === 0 ? `
              <tr>
                <td colspan="5" style="text-align: center; color: #94a3b8; padding: 20px;">No billable items logged for this admission.</td>
              </tr>
            ` : Object.entries(grouped).map(([category, catItems]) => `
              <tr>
                <td colspan="5" class="category-header">${category} (${catItems.length})</td>
              </tr>
              ${catItems.map(item => {
                const qty = parseInt(item.quantity) || 1;
                const price = parseFloat(item.unit_price || 0);
                const itemTotal = price * qty;
                const isPaid = ['paid', 'insurance', 'nhif', 'sha', 'corporate'].includes(item.status);
                return `
                  <tr>
                    <td style="padding-left: 20px; font-weight: 600; color: #334155;">${item.item_name || item.description}</td>
                    <td class="text-center">${qty}</td>
                    <td class="text-right">${fmt(price)}</td>
                    <td class="text-right" style="font-weight: 700;">${fmt(itemTotal)}</td>
                    <td class="text-center">
                      <span class="${isPaid ? 'status-paid' : 'status-pending'}">
                        ${isPaid ? 'PAID' : 'PENDING'}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            `).join('')}
          </tbody>
        </table>

        <!-- Summary Totals -->
        <div class="summary-box">
          <div class="summary-row">
            <span style="color: #64748b; font-weight: 600;">Total Accrued Charges:</span>
            <span style="font-weight: 700;">${fmt(totalBilled)}</span>
          </div>
          <div class="summary-row">
            <span style="color: #16a34a; font-weight: 600;">Paid / Settled Amount:</span>
            <span style="font-weight: 700; color: #16a34a;">-${fmt(totalPaid)}</span>
          </div>
          ${totalWaived > 0 ? `
            <div class="summary-row">
              <span style="color: #ea580c; font-weight: 600;">Waived Amount:</span>
              <span style="font-weight: 700; color: #ea580c;">-${fmt(totalWaived)}</span>
            </div>
          ` : ''}
          <div class="summary-row summary-total">
            <span>NET BALANCE DUE:</span>
            <span style="color: ${balance > 0 ? '#dc2626' : '#16a34a'};">${fmt(balance)}</span>
          </div>
        </div>

        <!-- Signatures -->
        <div class="signatures">
          <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-text">Prepared By: ${preparedBy}</div>
          </div>
          <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-text">Accounts & Billing Desk Approval / Stamp</div>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer-note">${footer}</div>
      </body>
    </html>
  `;

  win.document.open();
  win.document.write(html);
  win.document.close();
};
