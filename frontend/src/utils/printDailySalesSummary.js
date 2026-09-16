// ── Official Daily Sales & Revenue / Income Report Print Utility ──

export const printDailySalesSummary = ({
  pharmacy = {},
  date_from = '',
  date_to = '',
  summary = {},
  top_products = [],
  cashier_performance = [],
  items = [],
  visits = [],
  generated_by = 'Authorized Staff',
  currency = 'KES'
}) => {
  const facilityName = pharmacy?.name || 'Medicare Healthcare & Pharmacy';
  const facilityAddress = pharmacy?.address || 'Hospital Road, P.O Box 40200';
  const facilityPhone = pharmacy?.phone || '+254 700 000 000';
  const facilityEmail = pharmacy?.email || 'sales@medicare.health';
  const rawHeader = pharmacy?.receipt_header || '';
  const headerLines = rawHeader.split('\n').map(l => l.trim()).filter(Boolean);

  const fmt = (n) => `${currency} ${parseFloat(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDateStr = (dStr) => {
    if (!dStr) return '';
    try {
      const d = new Date(dStr);
      return d.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dStr;
    }
  };

  const isSingleDate = !date_to || date_from === date_to;
  const periodLabel = isSingleDate
    ? `DAILY SALES & INCOME REPORT FOR ${formatDateStr(date_from || new Date().toISOString().split('T')[0])}`
    : `SALES & INCOME REPORT PERIOD: ${formatDateStr(date_from)} TO ${formatDateStr(date_to)}`;

  const totalRevenue = parseFloat(summary.total_revenue || summary.total_sales || 0);
  const totalTransactions = parseInt(summary.total_transactions || 0, 10);
  const totalDiscounts = parseFloat(summary.total_discounts || 0);
  const cashTotal = parseFloat(summary.cash_total || summary.cash || 0);
  const mpesaTotal = parseFloat(summary.mpesa_total || summary.mpesa || 0);
  const cardTotal = parseFloat(summary.card_total || summary.card || 0);
  const insuranceTotal = parseFloat(summary.insurance_total || summary.insurance || 0);

  const totalCost = parseFloat(summary.total_cost || 0);
  const totalProfit = parseFloat(summary.total_profit || (totalRevenue - totalCost) || 0);

  // Calculate percentages
  const pct = (val) => totalRevenue > 0 ? ((val / totalRevenue) * 100).toFixed(1) + '%' : '0.0%';

  const topProductsList = top_products || [];
  const cashiersList = cashier_performance || [];

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Daily Sales and Income Report - ${facilityName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      color: #1e293b;
      background: #fff;
      padding: 18px 24px;
      line-height: 1.45;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: -0.5px;
    }
    .brand-sub {
      font-size: 11px;
      color: #475569;
      margin-top: 3px;
    }
    .doc-meta {
      text-align: right;
    }
    .doc-badge {
      display: inline-block;
      background: #0f172a;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-date {
      font-size: 11px;
      color: #475569;
      margin-top: 5px;
    }
    .banner {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #10b981;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .banner-title {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }
    .banner-sub {
      font-size: 10px;
      color: #64748b;
    }
    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 18px;
    }
    .kpi-card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      background: #f8fafc;
    }
    .kpi-card.highlight {
      background: #f0fdf4;
      border-color: #86efac;
    }
    .kpi-card.blue {
      background: #eff6ff;
      border-color: #93c5fd;
    }
    .kpi-lbl {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.5px;
    }
    .kpi-val {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 4px;
    }
    .kpi-card.highlight .kpi-val {
      color: #047857;
    }
    .kpi-card.blue .kpi-val {
      color: #1d4ed8;
    }
    /* Section */
    .sec-title {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-size: 10px;
      font-weight: 700;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      text-transform: uppercase;
    }
    th.text-right, td.text-right {
      text-align: right;
    }
    th.text-center, td.text-center {
      text-align: center;
    }
    td {
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
      font-size: 10.5px;
      color: #1e293b;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .tr-total td {
      font-weight: 800;
      background: #f1f5f9 !important;
      border-top: 2px solid #0f172a;
    }
    .tag {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .tag-cash { background: #dcfce7; color: #15803d; }
    .tag-mpesa { background: #e0e7ff; color: #4338ca; }
    .tag-card { background: #fef3c7; color: #b45309; }
    .tag-insurance { background: #fee2e2; color: #b91c1c; }

    /* Sign-off section */
    .signoff-section {
      margin-top: 26px;
      border-top: 1px solid #cbd5e1;
      padding-top: 14px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }
    .sign-box {
      border: 1px dashed #94a3b8;
      border-radius: 6px;
      padding: 10px;
      background: #fdfdfd;
    }
    .sign-role {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #475569;
    }
    .sign-line {
      margin-top: 36px;
      border-top: 1px solid #64748b;
      padding-top: 4px;
      font-size: 9px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
    }

    .footer-note {
      text-align: center;
      font-size: 9px;
      color: #94a3b8;
      margin-top: 18px;
    }

    @media print {
      body { padding: 0; }
      @page {
        size: A4 portrait;
        margin: 12mm;
      }
      .banner { break-inside: avoid; }
      .kpi-grid { break-inside: avoid; }
      .signoff-section { break-inside: avoid; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div>
      <div class="brand-title">${facilityName}</div>
      <div class="brand-sub">${facilityAddress} &bull; Tel: ${facilityPhone}</div>
      <div class="brand-sub">${facilityEmail} ${headerLines.length ? ' &bull; ' + headerLines.slice(0, 2).join(' &bull; ') : ''}</div>
    </div>
    <div class="doc-meta">
      <div class="doc-badge">OFFICIAL SALES REGISTER</div>
      <div class="doc-date">Generated: ${new Date().toLocaleString('en-KE')}</div>
      <div class="doc-date">By: <strong>${generated_by}</strong></div>
    </div>
  </div>

  <!-- Period Banner -->
  <div class="banner">
    <div>
      <div class="banner-title">${periodLabel}</div>
      <div class="banner-sub">Reconciled register for Over-the-Counter drug sales, cashier transactions, and gross income</div>
    </div>
    <div style="text-align: right;">
      <span style="font-size: 10px; font-weight: 700; color: #047857; background: #dcfce7; padding: 4px 8px; border-radius: 4px;">AUDITED SHIFT REPORT</span>
    </div>
  </div>

  <!-- Primary Financial KPI Summary -->
  <div class="kpi-grid">
    <div class="kpi-card highlight">
      <div class="kpi-lbl">Total Gross Sales</div>
      <div class="kpi-val">${fmt(totalRevenue)}</div>
      <div style="font-size: 9px; color: #059669; margin-top: 2px;">${totalTransactions} paid transactions</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-lbl">Cash Collections</div>
      <div class="kpi-val">${fmt(cashTotal)}</div>
      <div style="font-size: 9px; color: #64748b; margin-top: 2px;">${pct(cashTotal)} of total revenue</div>
    </div>
    <div class="kpi-card blue">
      <div class="kpi-lbl">M-Pesa Mobile Money</div>
      <div class="kpi-val">${fmt(mpesaTotal)}</div>
      <div style="font-size: 9px; color: #2563eb; margin-top: 2px;">${pct(mpesaTotal)} of total revenue</div>
    </div>
    <div class="kpi-card ${totalProfit >= 0 ? 'highlight' : ''}">
      <div class="kpi-lbl">Estimated Gross Income</div>
      <div class="kpi-val">${fmt(totalProfit)}</div>
      <div style="font-size: 9px; color: #475569; margin-top: 2px;">After drug inventory COGS</div>
    </div>
  </div>

  <!-- Secondary Metrics: Discounts, Card, Insurance, COGS -->
  <div class="kpi-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 16px;">
    <div class="kpi-card">
      <div class="kpi-lbl">Card / Bank Payments</div>
      <div class="kpi-val" style="font-size: 13px;">${fmt(cardTotal)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-lbl">Insurance / Corporate</div>
      <div class="kpi-val" style="font-size: 13px;">${fmt(insuranceTotal)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-lbl">Total Customer Discounts</div>
      <div class="kpi-val" style="font-size: 13px;">${fmt(totalDiscounts)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-lbl">Inventory Cost (COGS)</div>
      <div class="kpi-val" style="font-size: 13px;">${fmt(totalCost)}</div>
    </div>
  </div>

  <!-- Breakdown by Payment Mode Table -->
  <div class="sec-title">
    <span>1. Financial Inflow Summary by Payment Method</span>
    <span style="font-weight: 500; font-size: 10px; text-transform: none; color: #64748b;">All figures in ${currency}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Payment Channel</th>
        <th class="text-center" style="width: 20%;">Channel Status</th>
        <th class="text-right" style="width: 25%;">Percentage</th>
        <th class="text-right" style="width: 30%;">Total Collected</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>💵 Cash in Till</strong></td>
        <td class="text-center"><span class="tag tag-cash">Direct Cash</span></td>
        <td class="text-right">${pct(cashTotal)}</td>
        <td class="text-right"><strong>${fmt(cashTotal)}</strong></td>
      </tr>
      <tr>
        <td><strong>📱 M-Pesa Till / Paybill</strong></td>
        <td class="text-center"><span class="tag tag-mpesa">Mobile Inflow</span></td>
        <td class="text-right">${pct(mpesaTotal)}</td>
        <td class="text-right"><strong>${fmt(mpesaTotal)}</strong></td>
      </tr>
      <tr>
        <td><strong>💳 Credit / Debit Card & Bank</strong></td>
        <td class="text-center"><span class="tag tag-card">Electronic</span></td>
        <td class="text-right">${pct(cardTotal)}</td>
        <td class="text-right"><strong>${fmt(cardTotal)}</strong></td>
      </tr>
      <tr>
        <td><strong>🏥 Corporate & Insurance Claims</strong></td>
        <td class="text-center"><span class="tag tag-insurance">Credit Scheme</span></td>
        <td class="text-right">${pct(insuranceTotal)}</td>
        <td class="text-right"><strong>${fmt(insuranceTotal)}</strong></td>
      </tr>
      <tr class="tr-total">
        <td colspan="2">TOTAL DAILY REVENUE / INFLOWS</td>
        <td class="text-right">100.0%</td>
        <td class="text-right" style="font-size: 12px; color: #047857;">${fmt(totalRevenue)}</td>
      </tr>
    </tbody>
  </table>

  ${cashiersList.length > 0 ? `
  <!-- Cashier Performance Breakdown -->
  <div class="sec-title">
    <span>2. Shift Cashier & Dispenser Reconciliation</span>
    <span style="font-weight: 500; font-size: 10px; text-transform: none; color: #64748b;">${cashiersList.length} cashiers active</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Staff Member</th>
        <th class="text-center">Transactions</th>
        <th class="text-right">Average Sale Value</th>
        <th class="text-right">Total Shift Sales</th>
      </tr>
    </thead>
    <tbody>
      ${cashiersList.map(c => `
      <tr>
        <td><strong>${c.full_name || 'Staff User'}</strong></td>
        <td class="text-center">${c.total_sales || 0}</td>
        <td class="text-right">${fmt(c.avg_sale_value || 0)}</td>
        <td class="text-right"><strong>${fmt(c.total_revenue || 0)}</strong></td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  ${topProductsList.length > 0 ? `
  <!-- Top Products Sold Table -->
  <div class="sec-title">
    <span>3. Top Dispensed & Sold Pharmaceuticals / Stock Items</span>
    <span style="font-weight: 500; font-size: 10px; text-transform: none; color: #64748b;">Itemized volume</span>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 6%;" class="text-center">#</th>
        <th style="width: 40%;">Product / Brand Name</th>
        <th style="width: 24%;">Generic Formulation</th>
        <th style="width: 12%;" class="text-center">Qty Dispensed</th>
        <th style="width: 18%;" class="text-right">Revenue</th>
      </tr>
    </thead>
    <tbody>
      ${topProductsList.slice(0, 15).map((p, idx) => `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td><strong>${p.name || p.product_name || 'Drug Item'}</strong></td>
        <td style="color: #64748b;">${p.generic_name || '—'}</td>
        <td class="text-center">${p.total_sold || p.quantity || 0} ${p.unit || 'units'}</td>
        <td class="text-right"><strong>${fmt(p.total_revenue || p.total_price || 0)}</strong></td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  ${visits.length > 0 ? `
  <!-- OPD Attendance Footprint Summary -->
  <div class="sec-title">
    <span>4. Outpatient Department (OPD) Visits Handled</span>
    <span style="font-weight: 500; font-size: 10px; text-transform: none; color: #64748b;">${visits.length} clinical records</span>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 6%;" class="text-center">#</th>
        <th style="width: 34%;">Patient Name</th>
        <th style="width: 20%;">Patient Number</th>
        <th style="width: 15%;">Visit Type</th>
        <th style="width: 15%;" class="text-center">Status</th>
        <th style="width: 10%;" class="text-right">Time</th>
      </tr>
    </thead>
    <tbody>
      ${visits.slice(0, 10).map((v, idx) => `
      <tr>
        <td class="text-center">${idx + 1}</td>
        <td><strong>${v.patient_name}</strong></td>
        <td>${v.patient_number}</td>
        <td>${(v.visit_type || 'OPD').toUpperCase()}</td>
        <td class="text-center">${v.status || 'Active'}</td>
        <td class="text-right">${new Date(v.visit_date).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  <!-- Formal Sign-Off Handover Grid -->
  <div class="signoff-section">
    <div class="sign-box">
      <div class="sign-role">Prepared by (Cashier / Pharmacist)</div>
      <div style="font-size: 10px; margin-top: 4px; color: #334155;">Name: <strong>${generated_by}</strong></div>
      <div class="sign-line">
        <span>Signature</span>
        <span>Date: ${new Date().toLocaleDateString('en-KE')}</span>
      </div>
    </div>
    <div class="sign-box">
      <div class="sign-role">Reconciled by (Internal Accountant)</div>
      <div style="font-size: 10px; margin-top: 4px; color: #334155;">Name: _______________________</div>
      <div class="sign-line">
        <span>Signature</span>
        <span>Date: ________________</span>
      </div>
    </div>
    <div class="sign-box">
      <div class="sign-role">Approved by (Facility In-Charge)</div>
      <div style="font-size: 10px; margin-top: 4px; color: #334155;">Name: _______________________</div>
      <div class="sign-line">
        <span>Signature</span>
        <span>Date: ________________</span>
      </div>
    </div>
  </div>

  <div class="footer-note">
    Confidential Financial Document &bull; Generated by Medicare POS & HMS Enterprise &bull; Page 1 of 1
  </div>

</body>
</html>
  `;

  // Safe window print with fallback for iframes
  const win = window.open('', '_blank', 'width=900,height=800');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 600);
  } else {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch {}
      }, 2000);
    }, 600);
  }
};
