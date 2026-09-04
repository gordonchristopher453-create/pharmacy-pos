// ── Official Financial Summary & Collection Handover Print Utility ──

export const printFinancialSummaryReport = ({
  summary = {},
  by_method = [],
  by_type = [],
  by_staff = [],
  delayed_collections = [],
  recent_transactions = [],
  facility = {},
  date_from,
  date_to,
  is_daily = false,
  generated_by = 'Administrator',
  user_role = 'admin',
  currency = 'KES'
}) => {
  const facilityName = facility?.name || 'Medicare Healthcare System';
  const facilityAddress = facility?.address || 'Hospital Road, P.O Box 40200';
  const facilityPhone = facility?.phone || '+254 700 000 000';
  const facilityEmail = facility?.email || 'finance@medicare.health';

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

  const periodLabel = is_daily || date_from === date_to
    ? `DAILY SUMMARY FOR ${formatDateStr(date_from)}`
    : `FINANCIAL PERIOD SUMMARY: ${formatDateStr(date_from)} TO ${formatDateStr(date_to)}`;

  const totalBilled = parseFloat(summary.total_billed || 0);
  const totalCollected = parseFloat(summary.total_collected || 0);
  const totalPending = parseFloat(summary.total_pending || 0);
  const totalWaived = parseFloat(summary.total_waived || 0);
  const collectionRate = totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(1) : '100.0';

  const cashCollected = parseFloat(summary.cash_collected || 0);
  const mpesaCollected = parseFloat(summary.mpesa_collected || 0);
  const insuranceCollected = parseFloat(summary.insurance_collected || 0);
  const bankCollected = parseFloat(summary.bank_collected || 0);
  const corporateCollected = parseFloat(summary.corporate_collected || 0);

  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow popups to print the financial summary report.');
    return;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Financial Summary Report - ${periodLabel}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      color: #1a202c;
      background: #fff;
      font-size: 12px;
      line-height: 1.4;
      margin: 0;
      padding: 0;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f766e;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .facility-title {
      font-size: 20px;
      font-weight: 800;
      color: #0f766e;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin: 0 0 4px 0;
    }
    .facility-meta {
      font-size: 11px;
      color: #4b5563;
      margin: 2px 0;
    }
    .report-title-badge {
      text-align: right;
    }
    .badge-label {
      display: inline-block;
      background: #0f766e;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 4px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .period-title {
      font-size: 13px;
      font-weight: 800;
      color: #111827;
      margin: 6px 0 2px 0;
    }
    .audit-meta {
      font-size: 10px;
      color: #6b7280;
    }
    
    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      margin-bottom: 18px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px;
      border-top: 3px solid #0f766e;
    }
    .kpi-card.collected { border-top-color: #10b981; }
    .kpi-card.pending { border-top-color: #ef4444; }
    .kpi-card.waived { border-top-color: #8b5cf6; }
    .kpi-card.rate { border-top-color: #0284c7; }
    .kpi-label {
      font-size: 9.5px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .kpi-val {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      font-family: monospace;
    }
    .kpi-sub {
      font-size: 9px;
      color: #64748b;
      margin-top: 3px;
    }

    /* Section Headers */
    .section-title {
      font-size: 12px;
      font-weight: 800;
      color: #0f766e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
      margin: 16px 0 8px 0;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 11px;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      text-transform: uppercase;
      font-size: 9.5px;
    }
    td {
      padding: 6px 8px;
      border: 1px solid #e2e8f0;
      color: #1e293b;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .mono { font-family: monospace; font-weight: 600; }
    .total-row td {
      background: #e2e8f0 !important;
      font-weight: 800;
      border-top: 2px solid #94a3b8;
    }

    /* Sign-off Blocks */
    .signoff-section {
      margin-top: 24px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      page-break-inside: avoid;
    }
    .signoff-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 12px;
      background: #fafafa;
    }
    .signoff-header {
      font-size: 11px;
      font-weight: 800;
      color: #0f766e;
      text-transform: uppercase;
      border-bottom: 1px dashed #cbd5e1;
      padding-bottom: 6px;
      margin-bottom: 12px;
    }
    .signoff-line {
      display: flex;
      justify-content: space-between;
      margin-top: 18px;
      font-size: 10.5px;
      color: #475569;
    }
    .line-field {
      border-bottom: 1px solid #94a3b8;
      min-width: 140px;
      display: inline-block;
    }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="background:#f0fdf4; border:1px solid #86efac; padding:10px 16px; margin-bottom:16px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
    <span style="font-weight:700; color:#166534;">Official Financial Summary Ready for Printing & Auditing</span>
    <button onclick="window.print()" style="background:#0f766e; color:#fff; border:none; padding:6px 16px; border-radius:4px; font-weight:700; cursor:pointer;">🖨️ Print Report</button>
  </div>

  <div class="header">
    <div>
      <h1 class="facility-title">${facilityName}</h1>
      <div class="facility-meta">🏥 Healthcare Administration & Accounts Department</div>
      <div class="facility-meta">📍 ${facilityAddress} • Tel: ${facilityPhone}</div>
      <div class="facility-meta">✉️ ${facilityEmail}</div>
    </div>
    <div class="report-title-badge">
      <span class="badge-label">${is_daily ? 'Receptionist Daily Collection' : 'Executive Financial Audit'}</span>
      <div class="period-title">${periodLabel}</div>
      <div class="audit-meta">Generated: ${new Date().toLocaleString('en-KE')}</div>
      <div class="audit-meta">Prepared By: <strong>${generated_by}</strong> (${user_role?.toUpperCase()})</div>
    </div>
  </div>

  <!-- Key Financial Metrics -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Total Services Billed</div>
      <div class="kpi-val">${fmt(totalBilled)}</div>
      <div class="kpi-sub">${summary.total_items || 0} items (${summary.total_patients || 0} patients)</div>
    </div>
    <div class="kpi-card collected">
      <div class="kpi-label">Total Realized Collections</div>
      <div class="kpi-val" style="color:#10b981;">${fmt(totalCollected)}</div>
      <div class="kpi-sub">${summary.paid_count || 0} bills settled</div>
    </div>
    <div class="kpi-card pending">
      <div class="kpi-label">Delayed Collections / Arrears</div>
      <div class="kpi-val" style="color:#ef4444;">${fmt(totalPending)}</div>
      <div class="kpi-sub">${summary.pending_count || 0} accounts pending</div>
    </div>
    <div class="kpi-card waived">
      <div class="kpi-label">Waived / Statutory Exemptions</div>
      <div class="kpi-val" style="color:#8b5cf6;">${fmt(totalWaived)}</div>
      <div class="kpi-sub">${summary.waived_count || 0} service waivers</div>
    </div>
    <div class="kpi-card rate">
      <div class="kpi-label">Collection Efficiency</div>
      <div class="kpi-val" style="color:#0284c7;">${collectionRate}%</div>
      <div class="kpi-sub">Recovery Ratio</div>
    </div>
  </div>

  <!-- Payment Channels Distribution -->
  <div class="section-title">1. Payment Rails & Settlement Reconciliation</div>
  <table>
    <thead>
      <tr>
        <th>Payment Rail / Gateway</th>
        <th class="text-center">Transactions</th>
        <th class="text-right">Collected Amount (${currency})</th>
        <th class="text-right">Share of Total</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>💵 Physical Cash in Till</strong> (Register Balance)</td>
        <td class="text-center">-</td>
        <td class="text-right mono">${fmt(cashCollected)}</td>
        <td class="text-right">${totalCollected > 0 ? ((cashCollected / totalCollected) * 100).toFixed(1) : 0}%</td>
      </tr>
      <tr>
        <td><strong>📱 M-Pesa Mobile Money</strong> (Paybill / Buy Goods)</td>
        <td class="text-center">-</td>
        <td class="text-right mono">${fmt(mpesaCollected)}</td>
        <td class="text-right">${totalCollected > 0 ? ((mpesaCollected / totalCollected) * 100).toFixed(1) : 0}%</td>
      </tr>
      <tr>
        <td><strong>🏥 Insurance / SHA / NHIF</strong> (Claims Approved)</td>
        <td class="text-center">-</td>
        <td class="text-right mono">${fmt(insuranceCollected)}</td>
        <td class="text-right">${totalCollected > 0 ? ((insuranceCollected / totalCollected) * 100).toFixed(1) : 0}%</td>
      </tr>
      <tr>
        <td><strong>🏦 Bank POS / Direct Transfer</strong> (Card / EFT)</td>
        <td class="text-center">-</td>
        <td class="text-right mono">${fmt(bankCollected)}</td>
        <td class="text-right">${totalCollected > 0 ? ((bankCollected / totalCollected) * 100).toFixed(1) : 0}%</td>
      </tr>
      ${corporateCollected > 0 ? `
      <tr>
        <td><strong>🏢 Corporate Credit Accounts</strong></td>
        <td class="text-center">-</td>
        <td class="text-right mono">${fmt(corporateCollected)}</td>
        <td class="text-right">${totalCollected > 0 ? ((corporateCollected / totalCollected) * 100).toFixed(1) : 0}%</td>
      </tr>
      ` : ''}
      <tr class="total-row">
        <td>TOTAL RECONCILED COLLECTIONS</td>
        <td class="text-center">${summary.paid_count || 0}</td>
        <td class="text-right mono">${fmt(totalCollected)}</td>
        <td class="text-right">100.0%</td>
      </tr>
    </tbody>
  </table>

  <!-- Cashier / Front Desk Shift Handover Breakdown -->
  ${by_staff && by_staff.length > 0 ? `
  <div class="section-title">2. Cashier Shift & Collector Handover Breakdown</div>
  <table>
    <thead>
      <tr>
        <th>Staff Member / Collector</th>
        <th>Designation</th>
        <th class="text-center">Items</th>
        <th class="text-right">Cash</th>
        <th class="text-right">M-Pesa</th>
        <th class="text-right">Insurance / Other</th>
        <th class="text-right">Total Remitted (${currency})</th>
      </tr>
    </thead>
    <tbody>
      ${by_staff.map(s => `
        <tr>
          <td><strong>${s.collector_name || 'Front Desk'}</strong></td>
          <td style="text-transform:capitalize;">${s.collector_role || 'Receptionist'}</td>
          <td class="text-center">${s.count}</td>
          <td class="text-right mono">${fmt(s.cash_collected)}</td>
          <td class="text-right mono">${fmt(s.mpesa_collected)}</td>
          <td class="text-right mono">${fmt(parseFloat(s.insurance_collected || 0) + parseFloat(s.bank_collected || 0))}</td>
          <td class="text-right mono" style="font-weight:700;">${fmt(s.total_collected)}</td>
        </tr>
      `).join('')}
      <tr class="total-row">
        <td colspan="2">TOTAL REMITTED BY ALL STAFF</td>
        <td class="text-center">${by_staff.reduce((acc, s) => acc + parseInt(s.count || 0), 0)}</td>
        <td class="text-right mono">${fmt(cashCollected)}</td>
        <td class="text-right mono">${fmt(mpesaCollected)}</td>
        <td class="text-right mono">${fmt(insuranceCollected + bankCollected)}</td>
        <td class="text-right mono">${fmt(totalCollected)}</td>
      </tr>
    </tbody>
  </table>
  ` : ''}

  <!-- Departmental Revenue Breakdown -->
  ${by_type && by_type.length > 0 ? `
  <div class="section-title">3. Departmental & Clinical Service Streams</div>
  <table>
    <thead>
      <tr>
        <th>Clinical Department / Service Stream</th>
        <th class="text-center">Count</th>
        <th class="text-right">Billed Amount</th>
        <th class="text-right">Collected Amount</th>
        <th class="text-right">Pending / Delayed</th>
      </tr>
    </thead>
    <tbody>
      ${by_type.map(t => `
        <tr>
          <td style="text-transform:capitalize;"><strong>${t.item_type || 'General'}</strong></td>
          <td class="text-center">${t.count}</td>
          <td class="text-right mono">${fmt(t.billed_amount || t.amount)}</td>
          <td class="text-right mono" style="color:#10b981;">${fmt(t.collected_amount || t.collected)}</td>
          <td class="text-right mono" style="color:#ef4444;">${fmt(t.pending_amount || (parseFloat(t.billed_amount || t.amount) - parseFloat(t.collected_amount || t.collected || 0)))}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  <!-- Delayed Collections & Arrears Ledger -->
  ${delayed_collections && delayed_collections.length > 0 ? `
  <div class="section-title">4. Delayed Collections & Outstanding Arrears Ledger</div>
  <table>
    <thead>
      <tr>
        <th>Patient Name</th>
        <th>Patient No.</th>
        <th>Service Description</th>
        <th>Billed Date</th>
        <th class="text-center">Aging</th>
        <th class="text-right">Balance Due (${currency})</th>
      </tr>
    </thead>
    <tbody>
      ${delayed_collections.slice(0, 15).map(d => `
        <tr>
          <td><strong>${d.patient_name || 'Walk-in'}</strong></td>
          <td class="mono">${d.patient_number || '-'}</td>
          <td>${d.item_name || 'Medical Service'}</td>
          <td>${d.created_at ? new Date(d.created_at).toLocaleDateString('en-KE') : '-'}</td>
          <td class="text-center" style="color:#ef4444; font-weight:700;">${d.days_delayed > 0 ? `${d.days_delayed}d overdue` : 'Today'}</td>
          <td class="text-right mono" style="font-weight:700; color:#ef4444;">${fmt(d.balance_due || d.total_price)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ${delayed_collections.length > 15 ? `<div style="font-size:10px; color:#64748b; margin-top:-8px; margin-bottom:12px;">* Showing top 15 delayed records. Full list available in digital audit ledger.</div>` : ''}
  ` : ''}

  <!-- Shift Handover Sign-Off Block -->
  <div class="signoff-section">
    <div class="signoff-box">
      <div class="signoff-header">Prepared & Handed Over By (Cashier / Receptionist)</div>
      <div style="font-size:10px; color:#64748b; margin-bottom:12px;">
        I hereby confirm that the collections listed above have been accurately tallied and all physical cash, M-Pesa receipts, and credit claim vouchers are accounted for.
      </div>
      <div class="signoff-line">
        <span>Staff Name: <span class="line-field">${generated_by}</span></span>
        <span>Staff ID: <span class="line-field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></span>
      </div>
      <div class="signoff-line">
        <span>Signature: <span class="line-field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></span>
        <span>Date: <span class="line-field">${new Date().toLocaleDateString('en-KE')}</span></span>
      </div>
    </div>

    <div class="signoff-box">
      <div class="signoff-header">Received, Verified & Audited By (HR / Finance Admin)</div>
      <div style="font-size:10px; color:#64748b; margin-bottom:12px;">
        I acknowledge receipt and physical reconciliation of the above cash collections, mobile payment statement, and verified hospital claim documentation.
      </div>
      <div class="signoff-line">
        <span>Official Name: <span class="line-field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></span>
        <span>Designation: <span class="line-field">HR / Finance</span></span>
      </div>
      <div class="signoff-line">
        <span>Signature: <span class="line-field">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></span>
        <span>Official Stamp: [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</span>
      </div>
    </div>
  </div>
</body>
</html>
`;

  win.document.open();
  win.document.write(html);
  win.document.close();
};
