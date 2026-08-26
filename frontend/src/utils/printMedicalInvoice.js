export const printMedicalInvoice = (visitRecord, pharmacy, currentUser) => {
  const facilityName = pharmacy?.name || 'OUTERING HEALTH SERVICES';
  const logo = pharmacy?.logo_url || '';
  const header = pharmacy?.receipt_header || 'P.O Box 12004-00100 Nairobi\nTel: +254 700 000 000 | Email: info@outeringhealth.co.ke\nKRA PIN: P051897264Z | eTIMS Integrated System';
  const footer = pharmacy?.receipt_footer || 'Thank you for choosing Outering Health Services!\nFor any billing or insurance inquiries, please contact our Accounts & Claims Desk.\nThis is an official computer-generated medical tax invoice.';
  const currency = pharmacy?.currency || 'KES';

  const fmt = (n) => `${currency} ${parseFloat(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const visitDate = visitRecord.visit_date || visitRecord.created_at ? new Date(visitRecord.visit_date || visitRecord.created_at) : new Date();
  const dischargeDate = visitRecord.discharged_at ? new Date(visitRecord.discharged_at) : null;

  const visitDateStr = visitDate.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const dischargeDateStr = dischargeDate 
    ? dischargeDate.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
    : 'Outpatient / Active Encounter';

  const headerLines = (header || '').split('\n').map(l => l.trim()).filter(l => l);

  const rawItems = visitRecord.items || visitRecord.billing_items || [];
  const items = Array.isArray(rawItems) ? rawItems.filter(i => i && (i.id || i.item_name || i.description)) : [];

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

  const totalBilled = items.length > 0 ? itemsBilled : parseFloat(visitRecord.total_billed || visitRecord.total_amount || 0);
  const totalPaid = items.length > 0 ? itemsPaid : parseFloat(visitRecord.total_paid || visitRecord.paid_amount || (visitRecord.fee_paid ? totalBilled : 0));
  const totalWaived = items.length > 0 ? itemsWaived : parseFloat(visitRecord.total_waived || 0);
  const copayPaid = parseFloat(visitRecord.copay_amount || 0);
  const balance = Math.max(0, totalBilled - totalPaid - totalWaived);

  const insuranceProvider = visitRecord.insurance_provider || visitRecord.patient_insurance || visitRecord.payment_method || 'Cash / Self Pay';
  const memberNumber = visitRecord.member_number || visitRecord.sha_number || visitRecord.policy_number || 'N/A';
  const authCode = visitRecord.auth_code || visitRecord.reference_number || 'N/A';

  const isInsurance = ['insurance', 'sha', 'nhif', 'corporate', 'jubilee', 'britam', 'aar', 'apa', 'cic', 'madison'].some(k => insuranceProvider.toLowerCase().includes(k)) || visitRecord.payment_method === 'insurance';

  const invoiceNo = `INV-${visitRecord.visit_number || 'VIS'}-${Math.floor(1000 + Math.random() * 9000)}`;
  const cashierName = currentUser?.full_name || currentUser?.username || 'Accounts / Billing Officer';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Medical Tax Invoice - ${visitRecord.patient_name || 'Patient'} (${invoiceNo})</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; background: #fff; padding: 16px; font-size: 12px; line-height: 1.4; }
        .invoice-box { max-width: 800px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 8px; padding: 24px; background: #ffffff; }
        
        .header-table { width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
        .facility-title { font-size: 22px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
        .facility-sub { font-size: 11px; color: #475569; margin-top: 4px; white-space: pre-line; }
        
        .inv-banner { display: flex; justify-content: space-between; align-items: center; background: #1e293b; color: #ffffff; padding: 10px 16px; border-radius: 6px; margin-bottom: 16px; }
        .inv-banner-title { font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
        .inv-banner-meta { font-size: 12px; font-family: monospace; font-weight: bold; color: #38bdf8; }

        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; }
        .meta-group-title { font-size: 11px; font-weight: 800; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; border-bottom: 1px solid #dbeafe; padding-bottom: 3px; }
        .meta-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px; }
        .meta-label { color: #64748b; font-weight: 600; }
        .meta-val { color: #0f172a; font-weight: 700; }

        table.items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        table.items-table th { background: #f1f5f9; color: #334155; font-size: 11px; font-weight: 800; text-transform: uppercase; padding: 8px 10px; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #0f172a; text-align: left; }
        table.items-table td { padding: 9px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
        table.items-table tr:nth-child(even) { background: #fdfdfd; }
        
        .status-pill { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
        .pill-paid { background: #dcfce7; color: #15803d; }
        .pill-insurance { background: #dbeafe; color: #1e40af; }
        .pill-pending { background: #fef3c7; color: #b45309; }
        .pill-waived { background: #f1f5f9; color: #64748b; }

        .summary-container { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 20px; }
        .payment-info-box { flex: 1; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 12px; font-size: 11px; color: #475569; }
        .payment-info-title { font-weight: 800; color: #0f172a; margin-bottom: 6px; text-transform: uppercase; font-size: 11px; }

        .totals-box { width: 320px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 16px; }
        .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; color: #334155; }
        .totals-row.bold { font-weight: 700; color: #0f172a; }
        .totals-row.grand-total { font-size: 15px; font-weight: 800; color: #0f172a; border-top: 2px solid #0f172a; padding-top: 8px; margin-top: 6px; }
        .totals-row.due { font-size: 14px; font-weight: 800; color: ${balance > 0 ? '#b91c1c' : '#15803d'}; border-top: 1px dashed #cbd5e1; padding-top: 6px; margin-top: 4px; }

        .stamp-box { text-align: center; border: 2px solid ${balance <= 0 ? '#16a34a' : (isInsurance ? '#2563eb' : '#d97706')}; color: ${balance <= 0 ? '#15803d' : (isInsurance ? '#1e40af' : '#b45309')}; padding: 10px; font-weight: 800; font-size: 13px; letter-spacing: 1px; border-radius: 6px; margin-bottom: 20px; text-transform: uppercase; }

        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px; padding-top: 16px; border-top: 1px solid #cbd5e1; }
        .sig-box { text-align: center; font-size: 11px; color: #475569; }
        .sig-line { border-bottom: 1px solid #94a3b8; height: 35px; margin-bottom: 6px; }

        .footer-note { text-align: center; font-size: 11px; color: #64748b; margin-top: 20px; white-space: pre-line; border-top: 1px solid #e2e8f0; padding-top: 10px; }

        @media print {
          body { padding: 0; background: #fff; }
          .invoice-box { border: none; padding: 0; max-width: 100%; width: 100%; }
        }
      </style>
    </head>
    <body>
      <div class="invoice-box">
        <!-- HEADER -->
        <table class="header-table">
          <tr>
            <td style="vertical-align: top;">
              ${logo ? `<img src="${logo}" style="height: 55px; margin-bottom: 8px;" alt="Logo" />` : ''}
              <div class="facility-title">${facilityName}</div>
              <div class="facility-sub">${headerLines.join(' | ')}</div>
            </td>
            <td style="vertical-align: top; text-align: right;">
              <div style="font-size: 18px; font-weight: 800; color: #2563eb;">OFFICIAL MEDICAL TAX INVOICE</div>
              <div style="font-size: 11px; color: #64748b; margin-top: 4px;">eTIMS Invoice #: <strong>${invoiceNo}</strong></div>
              <div style="font-size: 11px; color: #64748b;">Date: <strong>${visitDateStr}</strong></div>
              <div style="font-size: 11px; color: #64748b;">Visit #: <strong>${visitRecord.visit_number || 'N/A'}</strong></div>
            </td>
          </tr>
        </table>

        <!-- BANNER -->
        <div class="inv-banner">
          <div class="inv-banner-title">
            ${isInsurance ? `🏥 INSURANCE CLAIM INVOICE — ${insuranceProvider.toUpperCase()}` : '💵 CASH / OUTPATIENT MEDICAL INVOICE'}
          </div>
          <div class="inv-banner-meta">
            ${isInsurance ? `Pre-Auth Code: ${authCode}` : `Invoice #: ${invoiceNo}`}
          </div>
        </div>

        <!-- META GRID -->
        <div class="meta-grid">
          <div>
            <div class="meta-group-title">👤 Patient Details</div>
            <div class="meta-row"><span class="meta-label">Patient Name:</span> <span class="meta-val">${visitRecord.patient_name || 'N/A'}</span></div>
            <div class="meta-row"><span class="meta-label">Patient Number:</span> <span class="meta-val">${visitRecord.patient_number || 'N/A'}</span></div>
            <div class="meta-row"><span class="meta-label">Gender / DOB:</span> <span class="meta-val">${(visitRecord.gender || 'N/A').toUpperCase()} ${visitRecord.date_of_birth ? `(${visitRecord.date_of_birth})` : ''}</span></div>
            <div class="meta-row"><span class="meta-label">Phone:</span> <span class="meta-val">${visitRecord.phone || 'N/A'}</span></div>
            <div class="meta-row"><span class="meta-label">National ID / SHA #:</span> <span class="meta-val">${visitRecord.national_id || visitRecord.sha_number || 'N/A'}</span></div>
          </div>
          <div>
            <div class="meta-group-title">💳 Billing & Coverage Details</div>
            <div class="meta-row"><span class="meta-label">Payment Mode:</span> <span class="meta-val">${(visitRecord.payment_method || 'Cash').toUpperCase()}</span></div>
            <div class="meta-row"><span class="meta-label">Insurance Provider:</span> <span class="meta-val">${insuranceProvider}</span></div>
            <div class="meta-row"><span class="meta-label">Member / Policy #:</span> <span class="meta-val">${memberNumber}</span></div>
            <div class="meta-row"><span class="meta-label">Pre-Auth / Approval:</span> <span class="meta-val">${authCode}</span></div>
            <div class="meta-row"><span class="meta-label">Encounter Date:</span> <span class="meta-val">${visitDateStr}</span></div>
          </div>
        </div>

        <!-- ITEMIZED TABLE -->
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th>Service / Item Description</th>
              <th style="width: 90px;">Category</th>
              <th style="width: 50px; text-align: center;">Qty</th>
              <th style="width: 90px; text-align: right;">Unit Price</th>
              <th style="width: 100px; text-align: right;">Total KES</th>
              <th style="width: 80px; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${items.length === 0 ? `
              <tr>
                <td colspan="7" style="text-align: center; padding: 20px; color: #64748b;">No line items recorded for this visit.</td>
              </tr>
            ` : items.map((item, idx) => {
              const qty = parseInt(item.quantity || 1);
              const unit = parseFloat(item.unit_price || 0);
              const tot = parseFloat(item.total_price || (unit * qty));
              const st = (item.status || 'pending').toLowerCase();
              const pillClass = st === 'paid' ? 'pill-paid' : (['insurance','sha','nhif','corporate'].includes(st) ? 'pill-insurance' : (st === 'waived' ? 'pill-waived' : 'pill-pending'));

              return `
                <tr>
                  <td style="color: #64748b;">${idx + 1}</td>
                  <td>
                    <strong style="color: #0f172a;">${item.item_name || item.description || 'Medical Service'}</strong>
                    ${item.description && item.description !== item.item_name ? `<br/><span style="font-size: 10px; color: #64748b;">${item.description}</span>` : ''}
                  </td>
                  <td style="text-transform: capitalize; color: #475569;">${item.item_type || 'General'}</td>
                  <td style="text-align: center; font-weight: 700;">${qty}</td>
                  <td style="text-align: right; font-family: monospace;">${unit.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
                  <td style="text-align: right; font-family: monospace; font-weight: 800; color: #0f172a;">${tot.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
                  <td style="text-align: center;">
                    <span class="status-pill ${pillClass}">${st}</span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <!-- SUMMARY SECTION -->
        <div class="summary-container">
          <div class="payment-info-box">
            <div class="payment-info-title">🏦 Bank Settlement & Insurance Notice</div>
            <p style="margin-bottom: 4px;">Bank: <strong>Kenya Commercial Bank (KCB)</strong></p>
            <p style="margin-bottom: 4px;">A/C Name: <strong>${facilityName}</strong></p>
            <p style="margin-bottom: 4px;">A/C Number: <strong>1122334455</strong> | Branch: <strong>Nairobi Main</strong></p>
            <p style="margin-bottom: 4px;">M-PESA Paybill: <strong>522522</strong> | Account: <strong>${visitRecord.patient_number || 'INVOICE'}</strong></p>
            <p style="margin-top: 6px; font-style: italic; color: #64748b;">Please quote Invoice #${invoiceNo} on all insurance claim remittances or bank wire advice notes.</p>
          </div>

          <div class="totals-box">
            <div class="totals-row"><span>Total Medical Charges:</span> <span>${fmt(totalBilled)}</span></div>
            ${totalWaived > 0 ? `<div class="totals-row" style="color: #64748b;"><span>Exemptions / Waived:</span> <span>- ${fmt(totalWaived)}</span></div>` : ''}
            ${copayPaid > 0 ? `<div class="totals-row" style="color: #16a34a;"><span>Patient Co-Pay Paid:</span> <span>- ${fmt(copayPaid)}</span></div>` : ''}
            <div class="totals-row bold"><span>Total Amount Paid / Claimed:</span> <span>${fmt(totalPaid)}</span></div>
            <div class="totals-row grand-total"><span>Net Payable:</span> <span>${fmt(totalBilled - totalWaived)}</span></div>
            <div class="totals-row due"><span>Outstanding Balance:</span> <span>${fmt(balance)}</span></div>
          </div>
        </div>

        <!-- STAMP -->
        <div class="stamp-box">
          ${balance <= 0 ? '✅ INVOICE FULLY PAID & SETTLED' : (isInsurance ? `🏥 CLAIM SUBMITTED TO ${insuranceProvider.toUpperCase()} FOR SETTLEMENT` : '⚠️ PARTIAL PAYMENT / PENDING SETTLEMENT')}
        </div>

        <!-- SIGNATURES -->
        <div class="signatures">
          <div class="sig-box">
            <div class="sig-line"></div>
            <strong>${cashierName}</strong><br/>
            <span>Accounts & Billing Officer Signature</span>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <strong>${visitRecord.patient_name || 'Patient / Guardian'}</strong><br/>
            <span>Patient / Member Acknowledgement Signature</span>
          </div>
        </div>

        <!-- FOOTER -->
        <div class="footer-note">${footer}</div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `;

  const win = window.open('', '_blank');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
  }
};
