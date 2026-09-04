import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api';
import toast from 'react-hot-toast';
import { 
  Calendar, RefreshCw, Printer, Download, DollarSign, CheckCircle, 
  AlertCircle, Shield, CreditCard, Smartphone, Wallet, Building, 
  Users, TrendingUp, Clock, ChevronRight, Search, FileText, Filter
} from 'lucide-react';
import { printFinancialSummaryReport } from '../utils/printFinancialSummaryReport';

export default function FinancialSummaryReport({ 
  onOpenBill = null, 
  initialDateFrom = null, 
  initialDateTo = null,
  embedded = false 
}) {
  const { user } = useSelector(state => state.auth);

  const todayStr = new Date().toISOString().split('T')[0];

  // RBAC checks
  const userRole = (user?.role || '').toLowerCase();
  const userPerms = Array.isArray(user?.permissions) ? user.permissions : [];
  const isAdminOrHR = [
    'super_admin', 'facility_admin', 'admin', 'hr', 'hr_manager', 'accountant'
  ].includes(userRole) ||
    userPerms.includes('can_view_financial_reports') ||
    userPerms.includes('can_view_revenue_reports') ||
    userPerms.includes('can_view_all_reports');

  const isReceptionistOnly = !isAdminOrHR && (userRole === 'receptionist' || userRole === 'cashier');

  // Date states
  const [dateFrom, setDateFrom] = useState(isAdminOrHR ? (initialDateFrom || todayStr) : todayStr);
  const [dateTo, setDateTo] = useState(isAdminOrHR ? (initialDateTo || todayStr) : todayStr);
  const [activePreset, setActivePreset] = useState(dateFrom === todayStr && dateTo === todayStr ? 'today' : 'custom');

  // Report sub-tab
  const [reportSubTab, setReportSubTab] = useState('overview'); // overview | delayed | handover | ledger

  // Search & filter inside report
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');

  // Data states
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({
    summary: {},
    by_method: [],
    by_type: [],
    by_staff: [],
    delayed_collections: [],
    recent_transactions: [],
    facility: {},
    date_from: todayStr,
    date_to: todayStr,
    is_daily: true,
  });

  const fetchReport = async (dFrom = dateFrom, dTo = dateTo) => {
    setLoading(true);
    try {
      const params = {};
      if (isAdminOrHR) {
        params.date_from = dFrom;
        params.date_to = dTo;
      } else {
        // Receptionist strictly locked to today / single date
        params.date = todayStr;
      }

      const res = await api.get('/billing/daily-summary', { params });
      const data = res.data.data || {};
      setReportData(data);
    } catch (err) {
      toast.error('Failed to load financial summary report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(dateFrom, dateTo);
  }, []);

  // Quick Preset Handlers
  const applyPreset = (preset) => {
    setActivePreset(preset);
    const now = new Date();
    let start = todayStr;
    let end = todayStr;

    if (preset === 'today') {
      start = todayStr;
      end = todayStr;
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      start = y.toISOString().split('T')[0];
      end = start;
    } else if (preset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      start = d.toISOString().split('T')[0];
      end = todayStr;
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      start = firstDay.toISOString().split('T')[0];
      end = todayStr;
    } else if (preset === 'lastMonth') {
      const firstDayPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0);
      start = firstDayPrev.toISOString().split('T')[0];
      end = lastDayPrev.toISOString().split('T')[0];
    }

    setDateFrom(start);
    setDateTo(end);
    fetchReport(start, end);
  };

  const handleCustomDateApply = (e) => {
    e.preventDefault();
    setActivePreset('custom');
    fetchReport(dateFrom, dateTo);
  };

  const handlePrint = () => {
    printFinancialSummaryReport({
      summary: reportData.summary || {},
      by_method: reportData.by_method || [],
      by_type: reportData.by_type || [],
      by_staff: reportData.by_staff || [],
      delayed_collections: reportData.delayed_collections || [],
      recent_transactions: reportData.recent_transactions || [],
      facility: reportData.facility || user?.pharmacy || {},
      date_from: dateFrom,
      date_to: dateTo,
      is_daily: isReceptionistOnly || (dateFrom === dateTo),
      generated_by: user?.full_name || user?.email || 'User',
      user_role: user?.role || 'Staff'
    });
  };

  const exportCSV = () => {
    const rows = (reportData.recent_transactions || []).map(tx => ({
      Date: tx.paid_at ? tx.paid_at.split('T')[0] : (tx.created_at ? tx.created_at.split('T')[0] : ''),
      Patient: tx.patient_name || 'Walk-in',
      PatientNo: tx.patient_number || '',
      Item: tx.item_name || '',
      Category: tx.item_type || '',
      Amount: tx.total_price || 0,
      PaidAmount: tx.paid_amount || tx.total_price || 0,
      Method: tx.payment_method || '',
      Status: tx.status || '',
      Collector: tx.collector_name || ''
    }));

    if (rows.length === 0) {
      toast('No transaction records to export');
      return;
    }

    const headers = Object.keys(rows[0]).join(',');
    const csvContent = 'data:text/csv;charset=utf-8,' + [
      headers,
      ...rows.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Financial_Summary_${dateFrom}_to_${dateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculations
  const summary = reportData.summary || {};
  const totalBilled = parseFloat(summary.total_billed || 0);
  const totalCollected = parseFloat(summary.total_collected || 0);
  const totalPending = parseFloat(summary.total_pending || 0);
  const totalWaived = parseFloat(summary.total_waived || 0);

  const cashCollected = parseFloat(summary.cash_collected || 0);
  const mpesaCollected = parseFloat(summary.mpesa_collected || 0);
  const insuranceCollected = parseFloat(summary.insurance_collected || 0);
  const bankCollected = parseFloat(summary.bank_collected || 0);
  const corporateCollected = parseFloat(summary.corporate_collected || 0);

  const collectionRate = totalBilled > 0 ? ((totalCollected / totalBilled) * 100).toFixed(1) : '100.0';

  const fmt = (n) => `KES ${parseFloat(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Filtered Ledger
  const filteredLedger = (reportData.recent_transactions || []).filter(tx => {
    const matchSearch = !ledgerSearch || 
      (tx.patient_name || '').toLowerCase().includes(ledgerSearch.toLowerCase()) ||
      (tx.patient_number || '').toLowerCase().includes(ledgerSearch.toLowerCase()) ||
      (tx.item_name || '').toLowerCase().includes(ledgerSearch.toLowerCase());

    const matchMethod = methodFilter === 'all' || 
      (tx.payment_method || '').toLowerCase() === methodFilter.toLowerCase();

    return matchSearch && matchMethod;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── TOP CONTROL & FILTER BAR ── */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                📊 Financial Summary & Cash Collection Report
              </h2>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 10px',
                borderRadius: 20,
                background: isAdminOrHR ? '#3b82f620' : '#10b98120',
                color: isAdminOrHR ? '#3b82f6' : '#10b981',
                border: `1px solid ${isAdminOrHR ? '#3b82f640' : '#10b98140'}`
              }}>
                {isAdminOrHR ? 'ADMIN & HR PERIOD ACCESS' : 'RECEPTIONIST DAILY DESK'}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              {isAdminOrHR
                ? 'Audited financial reconciliation, collection efficiency, channel splits, and delayed arrears.'
                : "Today's cash register collections, cashier till balance, and shift handover summary."
              }
            </p>
          </div>

          {/* Action Buttons: Print & Export */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text-primary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Printer size={15} style={{ color: 'var(--accent)' }} />
              Print Official Report
            </button>

            <button
              onClick={exportCSV}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text-primary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Download size={15} />
              Export CSV
            </button>

            <button
              onClick={() => fetchReport(dateFrom, dateTo)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 8,
                color: '#0F1612',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── ROLE-AWARE DATE PICKER / CALENDAR CONTROLS ── */}
        <div style={{
          borderTop: '1px solid var(--border)',
          paddingTop: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          {isAdminOrHR ? (
            /* Admin & HR: Full Date Range Calendar Controls + Presets */
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', width: '100%' }}>
              {/* Presets */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: '7days', label: 'Last 7 Days' },
                  { id: 'thisMonth', label: 'This Month' },
                  { id: 'lastMonth', label: 'Last Month' },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p.id)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: activePreset === p.id ? 'var(--accent)' : 'var(--bg-elevated)',
                      color: activePreset === p.id ? '#0F1612' : 'var(--text-muted)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Calendar From & To Inputs */}
              <form onSubmit={handleCustomDateApply} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px' }}>
                  <Calendar size={14} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>From:</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => {
                      const v = e.target.value;
                      setDateFrom(v);
                      setActivePreset('custom');
                      if (dateTo < v) setDateTo(v);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      outline: 'none',
                      fontFamily: 'DM Sans, sans-serif',
                      cursor: 'pointer'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px' }}>
                  <Calendar size={14} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>To:</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => {
                      setDateTo(e.target.value);
                      setActivePreset('custom');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      outline: 'none',
                      fontFamily: 'DM Sans, sans-serif',
                      cursor: 'pointer'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--accent)',
                    color: 'var(--accent)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Apply Dates
                </button>
              </form>
            </div>
          ) : (
            /* Receptionist: Daily Lock Notice & Shift Indicator */
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>🔒</span>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Daily Shift Reconciliation — {new Date(todayStr).toLocaleDateString('en-KE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Receptionist role is configured for active daily shift balances. Multi-date financial auditing is restricted to Admin and HR.
                  </div>
                </div>
              </div>

              <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--accent)'
              }}>
                📅 Register Date: {todayStr}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── EXECUTIVE KPI MATRIX (5 METRIC CARDS) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        {/* Total Billed */}
        <div style={{
          background: 'var(--bg-surface)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          borderLeft: '4px solid var(--accent)',
          padding: 16
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Billed
            </span>
            <div style={{ padding: 6, background: 'var(--accent)15', borderRadius: 8, color: 'var(--accent)' }}>
              <DollarSign size={16} />
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
            {fmt(totalBilled)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {summary.total_items || 0} services billed · {summary.total_patients || 0} patients
          </div>
        </div>

        {/* Realized Collections */}
        <div style={{
          background: 'var(--bg-surface)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          borderLeft: '4px solid #10b981',
          padding: 16
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Realized Collections
            </span>
            <div style={{ padding: 6, background: '#10b98115', borderRadius: 8, color: '#10b981' }}>
              <CheckCircle size={16} />
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
            {fmt(totalCollected)}
          </div>
          <div style={{ fontSize: 11, color: '#10b981', marginTop: 4, fontWeight: 600 }}>
            {collectionRate}% Efficiency · {summary.paid_count || 0} settled
          </div>
        </div>

        {/* Delayed Collections / Arrears */}
        <div style={{
          background: 'var(--bg-surface)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          borderLeft: '4px solid #ef4444',
          padding: 16
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Delayed / Arrears
            </span>
            <div style={{ padding: 6, background: '#ef444415', borderRadius: 8, color: '#ef4444' }}>
              <AlertCircle size={16} />
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#ef4444', fontFamily: 'monospace' }}>
            {fmt(totalPending)}
          </div>
          <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4, fontWeight: 600 }}>
            {summary.pending_count || 0} pending collections
          </div>
        </div>

        {/* Insurance & Claims */}
        <div style={{
          background: 'var(--bg-surface)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          borderLeft: '4px solid #3b82f6',
          padding: 16
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Insurance & SHA Claims
            </span>
            <div style={{ padding: 6, background: '#3b82f615', borderRadius: 8, color: '#3b82f6' }}>
              <Shield size={16} />
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#3b82f6', fontFamily: 'monospace' }}>
            {fmt(insuranceCollected)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Direct scheme settlements
          </div>
        </div>

        {/* Waived & Exemptions */}
        <div style={{
          background: 'var(--bg-surface)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          borderLeft: '4px solid #8b5cf6',
          padding: 16
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Waived / Exempt
            </span>
            <div style={{ padding: 6, background: '#8b5cf615', borderRadius: 8, color: '#8b5cf6' }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#8b5cf6', fontFamily: 'monospace' }}>
            {fmt(totalWaived)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {summary.waived_count || 0} authorized waivers
          </div>
        </div>
      </div>

      {/* ── REPORT SUB-NAVIGATION TABS ── */}
      <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
        <button
          onClick={() => setReportSubTab('overview')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: reportSubTab === 'overview' ? 'var(--accent)' : 'transparent',
            color: reportSubTab === 'overview' ? '#0F1612' : 'var(--text-muted)',
            transition: 'all 0.15s ease'
          }}
        >
          <TrendingUp size={15} />
          Overview & Payment Rails
        </button>

        <button
          onClick={() => setReportSubTab('delayed')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: reportSubTab === 'delayed' ? 'var(--accent)' : 'transparent',
            color: reportSubTab === 'delayed' ? '#0F1612' : 'var(--text-muted)',
            transition: 'all 0.15s ease'
          }}
        >
          <AlertCircle size={15} />
          Delayed Collections & Arrears ({reportData.delayed_collections?.length || 0})
        </button>

        <button
          onClick={() => setReportSubTab('handover')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: reportSubTab === 'handover' ? 'var(--accent)' : 'transparent',
            color: reportSubTab === 'handover' ? '#0F1612' : 'var(--text-muted)',
            transition: 'all 0.15s ease'
          }}
        >
          <Users size={15} />
          Cashier Shift Handover ({reportData.by_staff?.length || 0})
        </button>

        <button
          onClick={() => setReportSubTab('ledger')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: reportSubTab === 'ledger' ? 'var(--accent)' : 'transparent',
            color: reportSubTab === 'ledger' ? '#0F1612' : 'var(--text-muted)',
            transition: 'all 0.15s ease'
          }}
        >
          <FileText size={15} />
          Itemized Audit Ledger ({reportData.recent_transactions?.length || 0})
        </button>
      </div>

      {/* ── SUB-TAB 1: OVERVIEW & PAYMENT RAILS ── */}
      {reportSubTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Payment Method Channels Card */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 20
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  💵 Collections by Payment Channel & Gateway
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Reconciliation of funds across Cash Till, Safaricom M-Pesa, Insurances, and Bank Swipes
                </p>
              </div>
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#10b981',
                background: '#10b98115',
                padding: '4px 12px',
                borderRadius: 20,
                fontFamily: 'monospace'
              }}>
                Total Reconciled: {fmt(totalCollected)}
              </span>
            </div>

            {/* Visual Distribution Progress Bar */}
            <div style={{
              height: 12,
              background: 'var(--bg-elevated)',
              borderRadius: 6,
              overflow: 'hidden',
              display: 'flex',
              marginBottom: 16
            }}>
              {totalCollected > 0 ? (
                <>
                  <div
                    style={{ width: `${(mpesaCollected / totalCollected) * 100}%`, background: '#10b981' }}
                    title={`M-Pesa: ${fmt(mpesaCollected)}`}
                  />
                  <div
                    style={{ width: `${(cashCollected / totalCollected) * 100}%`, background: '#f59e0b' }}
                    title={`Cash: ${fmt(cashCollected)}`}
                  />
                  <div
                    style={{ width: `${(insuranceCollected / totalCollected) * 100}%`, background: '#3b82f6' }}
                    title={`Insurance/SHA: ${fmt(insuranceCollected)}`}
                  />
                  <div
                    style={{ width: `${(bankCollected / totalCollected) * 100}%`, background: '#8b5cf6' }}
                    title={`Bank: ${fmt(bankCollected)}`}
                  />
                  <div
                    style={{ width: `${(corporateCollected / totalCollected) * 100}%`, background: '#06b6d4' }}
                    title={`Corporate: ${fmt(corporateCollected)}`}
                  />
                </>
              ) : (
                <div style={{ width: '100%', background: 'var(--border)' }} />
              )}
            </div>

            {/* Individual Channel Breakdown Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              {/* Cash */}
              <div style={{ padding: 14, background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  <Wallet size={16} /> CASH IN TILL
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                  {fmt(cashCollected)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {totalCollected > 0 ? Math.round((cashCollected / totalCollected) * 100) : 0}% of collections
                </div>
              </div>

              {/* M-Pesa */}
              <div style={{ padding: 14, background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  <Smartphone size={16} /> M-PESA PAYBILL / TILL
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                  {fmt(mpesaCollected)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {totalCollected > 0 ? Math.round((mpesaCollected / totalCollected) * 100) : 0}% of collections
                </div>
              </div>

              {/* Insurance / SHA */}
              <div style={{ padding: 14, background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3b82f6', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  <Shield size={16} /> INSURANCE / SHA / NHIF
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                  {fmt(insuranceCollected)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {totalCollected > 0 ? Math.round((insuranceCollected / totalCollected) * 100) : 0}% verified claims
                </div>
              </div>

              {/* Bank POS */}
              <div style={{ padding: 14, background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8b5cf6', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  <CreditCard size={16} /> BANK POS / CHEQUE
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                  {fmt(bankCollected)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {totalCollected > 0 ? Math.round((bankCollected / totalCollected) * 100) : 0}% electronic transfers
                </div>
              </div>
            </div>
          </div>

          {/* Departmental Clinical Revenue Streams */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 20
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 14px 0', color: 'var(--text-primary)' }}>
              🏥 Revenue Streams by Hospital Department
            </h3>
            {reportData.by_type?.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>
                No department billing records found for this period
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {reportData.by_type.map((t, idx) => {
                  const billed = parseFloat(t.billed_amount || t.amount || 0);
                  const collected = parseFloat(t.collected_amount || t.collected || 0);
                  const pending = parseFloat(t.pending_amount || (billed - collected));
                  const rate = billed > 0 ? ((collected / billed) * 100).toFixed(0) : 100;

                  return (
                    <div key={idx} style={{
                      padding: 14,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                          {t.item_type || 'General Service'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                          {t.count} items
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Billed:</span>
                        <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                          {fmt(billed)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 11, color: '#10b981' }}>Collected:</span>
                        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#10b981' }}>
                          {fmt(collected)} ({rate}%)
                        </span>
                      </div>

                      {pending > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: 11, color: '#ef4444' }}>Pending Arrears:</span>
                          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: '#ef4444' }}>
                            {fmt(pending)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SUB-TAB 2: DELAYED COLLECTIONS & PENDING ARREARS ── */}
      {reportSubTab === 'delayed' && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 20
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={17} /> Delayed Collections & Pending Patient Arrears
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Unsettled healthcare invoices, credit balances, and delayed payments requiring collection follow-up.
              </p>
            </div>

            <span style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#ef4444',
              background: '#ef444415',
              padding: '4px 12px',
              borderRadius: 20,
              fontFamily: 'monospace'
            }}>
              Total Arrears: {fmt(totalPending)}
            </span>
          </div>

          {reportData.delayed_collections?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 50, color: 'var(--text-muted)' }}>
              <CheckCircle size={36} style={{ color: '#10b981', marginBottom: 10 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>No Delayed Collections</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>All bills for this reporting period have been settled in full.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 10px' }}>Patient Name</th>
                    <th style={{ padding: '8px 10px' }}>Patient Number</th>
                    <th style={{ padding: '8px 10px' }}>Phone Contact</th>
                    <th style={{ padding: '8px 10px' }}>Billed Service</th>
                    <th style={{ padding: '8px 10px' }}>Visit #</th>
                    <th style={{ padding: '8px 10px' }}>Aging / Delay</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total Bill</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Balance Due</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.delayed_collections.map((item, idx) => {
                    const days = parseInt(item.days_delayed || 0);
                    const bal = parseFloat(item.balance_due || item.total_price || 0);

                    return (
                      <tr key={item.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {item.patient_name || 'Patient'}
                        </td>
                        <td style={{ padding: '10px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          {item.patient_number || '-'}
                        </td>
                        <td style={{ padding: '10px', color: 'var(--text-muted)' }}>
                          {item.patient_phone || '-'}
                        </td>
                        <td style={{ padding: '10px', color: 'var(--text-primary)' }}>
                          {item.item_name}
                        </td>
                        <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>
                          {item.visit_number || '-'}
                        </td>
                        <td style={{ padding: '10px' }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: days > 3 ? '#ef444420' : days > 0 ? '#f59e0b20' : '#10b98120',
                            color: days > 3 ? '#ef4444' : days > 0 ? '#f59e0b' : '#10b981'
                          }}>
                            {days > 0 ? `${days} Day${days > 1 ? 's' : ''} Delayed` : 'Billed Today'}
                          </span>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          {fmt(item.total_price)}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#ef4444' }}>
                          {fmt(bal)}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          {onOpenBill ? (
                            <button
                              onClick={() => onOpenBill({ 
                                id: item.visit_id, 
                                visit_id: item.visit_id, 
                                patient_name: item.patient_name,
                                patient_number: item.patient_number 
                              })}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 6,
                                background: 'var(--accent)',
                                color: '#0F1612',
                                border: 'none',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Settle Bill
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pending</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SUB-TAB 3: CASHIER SHIFT HANDOVER RECONCILIATION ── */}
      {reportSubTab === 'handover' && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 20
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                👥 Cashier & Front Desk Shift Handover Breakdown
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Reconciliation of funds collected by each receptionist/cashier for shift closing and handover to HR/Finance.
              </p>
            </div>

            <button
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text-primary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Printer size={14} /> Print Handover Sheet
            </button>
          </div>

          {reportData.by_staff?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              No cashier attribution recorded for this period yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 10px' }}>Staff Name</th>
                    <th style={{ padding: '8px 10px' }}>Designation</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Transactions</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Cash in Till</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>M-Pesa Receipts</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Insurance / Other</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total Remitted</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Shift Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.by_staff.map((s, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {s.collector_name || 'Cashier Desk'}
                      </td>
                      <td style={{ padding: '10px', textTransform: 'capitalize', color: 'var(--text-muted)' }}>
                        {s.collector_role || 'Receptionist'}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center', fontWeight: 600 }}>
                        {s.count}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: '#f59e0b', fontWeight: 600 }}>
                        {fmt(s.cash_collected)}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: '#10b981', fontWeight: 600 }}>
                        {fmt(s.mpesa_collected)}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: '#3b82f6' }}>
                        {fmt(parseFloat(s.insurance_collected || 0) + parseFloat(s.bank_collected || 0))}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {fmt(s.total_collected)}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#10b98120', color: '#10b981', fontWeight: 700 }}>
                          VERIFIED
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--bg-elevated)', fontWeight: 800 }}>
                    <td style={{ padding: '10px' }} colSpan={2}>TOTAL RECONCILED</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {reportData.by_staff.reduce((acc, s) => acc + parseInt(s.count || 0), 0)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: '#f59e0b' }}>
                      {fmt(cashCollected)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: '#10b981' }}>
                      {fmt(mpesaCollected)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: '#3b82f6' }}>
                      {fmt(insuranceCollected + bankCollected)}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                      {fmt(totalCollected)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SUB-TAB 4: ITEMIZED AUDIT LEDGER ── */}
      {reportSubTab === 'ledger' && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 20
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                ⚡ Complete Itemized Transactions & Audit Trail
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Detailed ledger of all billing entries and payments logged during this period.
              </p>
            </div>

            {/* Filter controls */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', minWidth: 220 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search patient, item, or #..."
                  value={ledgerSearch}
                  onChange={e => setLedgerSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 30px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <select
                value={methodFilter}
                onChange={e => setMethodFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Payment Rails</option>
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="insurance">Insurance / SHA</option>
                <option value="bank">Bank POS</option>
              </select>
            </div>
          </div>

          {filteredLedger.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              No transactions matching search criteria.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 10px' }}>Timestamp</th>
                    <th style={{ padding: '8px 10px' }}>Patient</th>
                    <th style={{ padding: '8px 10px' }}>Patient No.</th>
                    <th style={{ padding: '8px 10px' }}>Billed Item</th>
                    <th style={{ padding: '8px 10px' }}>Department</th>
                    <th style={{ padding: '8px 10px' }}>Method</th>
                    <th style={{ padding: '8px 10px' }}>Collector</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedger.map((tx, idx) => {
                    const isPaid = tx.status === 'paid' || ['insurance', 'nhif', 'sha'].includes(tx.status);

                    return (
                      <tr key={tx.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: 11 }}>
                          {tx.paid_at ? new Date(tx.paid_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : (tx.created_at ? new Date(tx.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : '-')}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {tx.patient_name || 'Walk-in'}
                        </td>
                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: 11 }}>
                          {tx.patient_number || '-'}
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>
                          {tx.item_name}
                        </td>
                        <td style={{ padding: '8px 10px', textTransform: 'capitalize', color: 'var(--text-muted)' }}>
                          {tx.item_type || 'General'}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            textTransform: 'uppercase',
                            background: tx.payment_method === 'mpesa' ? '#10b98120' : tx.payment_method === 'cash' ? '#f59e0b20' : '#3b82f620',
                            color: tx.payment_method === 'mpesa' ? '#10b981' : tx.payment_method === 'cash' ? '#f59e0b' : '#3b82f6'
                          }}>
                            {tx.payment_method || 'CASH'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: 11 }}>
                          {tx.collector_name || 'Front Desk'}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: isPaid ? '#10b981' : '#ef4444' }}>
                          {fmt(tx.total_price)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            textTransform: 'uppercase',
                            background: isPaid ? '#10b98120' : '#ef444420',
                            color: isPaid ? '#10b981' : '#ef4444'
                          }}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
