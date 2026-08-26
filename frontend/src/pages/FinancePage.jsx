import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  DollarSign, TrendingUp, TrendingDown, Users, CreditCard,
  FileText, Calendar, Plus, RefreshCw, Printer, Download,
  Search, Filter, Trash2, CheckCircle2, AlertCircle,
  Building, Wallet, PieChart, BarChart3, ChevronRight, X, Eye,
  Sparkles, FileSpreadsheet, ArrowUpRight, ArrowDownRight, Shield
} from 'lucide-react';

const EXPENSE_CATEGORIES = [
  { id: 'rent', label: 'Premises Rent' },
  { id: 'utilities', label: 'Utilities (Electricity, Water, Internet)' },
  { id: 'stock', label: 'Medical Stock & Drugs Purchase' },
  { id: 'equipment', label: 'Medical Equipment & Maintenance' },
  { id: 'salary', label: 'Staff Allowances & Welfare' },
  { id: 'marketing', label: 'Marketing & Community Outreach' },
  { id: 'licenses', label: 'Regulatory Licenses & Compliance' },
  { id: 'operations', label: 'General Operations & Logistics' },
  { id: 'other', label: 'Miscellaneous Other Expenses' },
];

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'mpesa', label: 'M-Pesa (Paybill / Till)' },
  { id: 'bank_transfer', label: 'Bank Transfer (EFT / RTGS)' },
  { id: 'cheque', label: 'Cheque' },
  { id: 'card', label: 'Credit / Debit Card' },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const Card = ({ children, style = {}, ...props }) => (
  <div
    style={{
      background: 'var(--bg-surface)',
      borderRadius: 14,
      border: '1px solid var(--border)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
      ...style
    }}
    {...props}
  >
    {children}
  </div>
);

const fmt = (n) => `KES ${parseFloat(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function FinancePage() {
  const { user } = useSelector(state => state.auth);
  const pharmacy = user?.pharmacy;
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('Overview');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Date Filters
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Data States
  const [cashFlow, setCashFlow] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [expenseSummary, setExpenseSummary] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [pettyCash, setPettyCash] = useState({ transactions: [], summary: {} });
  const [staffList, setStaffList] = useState([]);

  // Payroll Filter
  const [payrollMonth, setPayrollMonth] = useState(new Date().getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState(new Date().getFullYear());

  // Expense Filter
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all');
  const [expenseSearch, setExpenseSearch] = useState('');

  // Modals
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showPettyCashModal, setShowPettyCashModal] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);

  // Forms
  const [expenseForm, setExpenseForm] = useState({
    category: 'operations',
    description: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    payee: '',
    payment_method: 'mpesa',
    receipt_ref: ''
  });

  const [pettyForm, setPettyForm] = useState({
    transaction_type: 'outflow',
    category: 'transport',
    amount: '',
    description: '',
    payee_or_source: '',
    voucher_number: '',
    payment_method: 'cash'
  });

  const [payrollForm, setPayrollForm] = useState({
    user_id: '',
    employee_name: '',
    employee_email: '',
    role: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    basic_salary: '',
    allowances: '',
    paye: '',
    sha: '',
    nssf: '',
    housing_levy: '',
    other_deductions: '',
    notes: ''
  });

  // Load All Financial Data
  const loadFinancialData = async () => {
    setLoading(true);
    try {
      const [cfRes, pnlRes, expRes, payRes, pcRes, stRes] = await Promise.all([
        api.get(`/finance/cashflow?start_date=${startDate}&end_date=${endDate}`),
        api.get(`/finance/pnl?start_date=${startDate}&end_date=${endDate}`),
        api.get(`/finance/expenses?start_date=${startDate}&end_date=${endDate}`),
        api.get(`/finance/payroll?month=${payrollMonth}&year=${payrollYear}`),
        api.get(`/finance/petty-cash?start_date=${startDate}&end_date=${endDate}`),
        api.get('/finance/staff'),
      ]);

      setCashFlow(cfRes.data.data);
      setPnl(pnlRes.data.data);
      setExpenses(expRes.data.data?.expenses || []);
      setExpenseSummary(expRes.data.data?.summary || []);
      setPayroll(payRes.data.data || []);
      setPettyCash(pcRes.data.data || { transactions: [], summary: {} });
      setStaffList(stRes.data.data || []);
    } catch (err) {
      toast.error('Failed to load finance records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinancialData();
  }, [startDate, endDate, payrollMonth, payrollYear]);

  // Tax Auto Calculator for Manual Payroll Form
  const handleAutoCalcTaxes = async (basic, allowances) => {
    const b = parseFloat(basic || 0);
    const a = parseFloat(allowances || 0);
    if (b <= 0) return;
    try {
      const res = await api.get(`/finance/payroll/tax-preview?basic_salary=${b}&allowances=${a}`);
      const d = res.data.data;
      setPayrollForm(f => ({
        ...f,
        paye: d.paye,
        sha: d.sha,
        nssf: d.nssf,
        housing_levy: d.housing_levy
      }));
    } catch {}
  };

  // Add Expense
  const handleSaveExpense = async () => {
    if (!expenseForm.amount || !expenseForm.description) {
      toast.error('Amount and Description are required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/finance/expenses', expenseForm);
      toast.success('Expense recorded successfully!');
      setShowExpenseModal(false);
      setExpenseForm({
        category: 'operations',
        description: '',
        amount: '',
        expense_date: new Date().toISOString().split('T')[0],
        payee: '',
        payment_method: 'mpesa',
        receipt_ref: ''
      });
      loadFinancialData();
    } catch {
      toast.error('Failed to record expense');
    } finally {
      setSaving(false);
    }
  };

  // Delete Expense
  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Delete this expense entry?')) return;
    try {
      await api.delete(`/finance/expenses/${id}`);
      toast.success('Expense deleted');
      loadFinancialData();
    } catch {
      toast.error('Failed to delete expense');
    }
  };

  // Add Petty Cash
  const handleSavePettyCash = async () => {
    if (!pettyForm.amount || !pettyForm.description) {
      toast.error('Amount and description required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/finance/petty-cash', pettyForm);
      toast.success('Petty cash voucher recorded!');
      setShowPettyCashModal(false);
      setPettyForm({
        transaction_type: 'outflow',
        category: 'transport',
        amount: '',
        description: '',
        payee_or_source: '',
        voucher_number: '',
        payment_method: 'cash'
      });
      loadFinancialData();
    } catch {
      toast.error('Failed to save petty cash');
    } finally {
      setSaving(false);
    }
  };

  // Delete Petty Cash
  const handleDeletePettyCash = async (id) => {
    try {
      await api.delete(`/finance/petty-cash/${id}`);
      toast.success('Petty cash record deleted');
      loadFinancialData();
    } catch {
      toast.error('Failed to delete petty cash');
    }
  };

  // Save Individual Payroll
  const handleSavePayroll = async () => {
    if (!payrollForm.employee_name || !payrollForm.basic_salary) {
      toast.error('Employee name and basic salary are required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/finance/payroll', payrollForm);
      toast.success('Payroll record saved!');
      setShowPayrollModal(false);
      loadFinancialData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save payroll');
    } finally {
      setSaving(false);
    }
  };

  // Generate Batch Payroll
  const handleGenerateBatchPayroll = async () => {
    if (!window.confirm(`Generate automated statutory payroll batch for ${MONTHS[payrollMonth - 1]} ${payrollYear}?`)) return;
    setSaving(true);
    try {
      const res = await api.post('/finance/payroll/batch', {
        month: payrollMonth,
        year: payrollYear
      });
      toast.success(res.data?.message || 'Batch payroll generated successfully!');
      loadFinancialData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate batch payroll');
    } finally {
      setSaving(false);
    }
  };

  // Delete Payroll
  const handleDeletePayroll = async (id) => {
    if (!window.confirm('Delete this salary payroll record?')) return;
    try {
      await api.delete(`/finance/payroll/${id}`);
      toast.success('Payroll record deleted');
      loadFinancialData();
    } catch {
      toast.error('Failed to delete payroll record');
    }
  };

  // Export Bank Salary CSV Schedule
  const handleExportBankSchedule = () => {
    if (payroll.length === 0) {
      toast.error('No payroll records found for this period');
      return;
    }
    const headers = ['Employee Name', 'Role', 'Bank Name', 'Account Number', 'Gross Pay', 'Total Deductions', 'Net Salary Payable', 'KRA PIN'];
    const rows = payroll.map(p => [
      `"${p.employee_name}"`,
      `"${p.role || ''}"`,
      `"${p.bank_name || 'Bank Transfer'}"`,
      `"${p.bank_account || ''}"`,
      parseFloat(p.basic_salary || 0) + parseFloat(p.allowances || 0),
      parseFloat(p.paye || 0) + parseFloat(p.sha || 0) + parseFloat(p.nssf || 0) + parseFloat(p.housing_levy || 0) + parseFloat(p.other_deductions || 0),
      parseFloat(p.net_salary || 0),
      `"${p.kra_pin || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Bank_Salary_Payment_Schedule_${MONTHS[payrollMonth - 1]}_${payrollYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Bank Salary Schedule CSV downloaded!');
  };

  // Print Official P&L Statement
  const handlePrintPnL = () => {
    const w = window.open('', '_blank');
    const html = `<!DOCTYPE html><html><head><title>P&L Statement - ${startDate} to ${endDate}</title>
    <style>
      body{font-family:'Segoe UI',sans-serif;padding:40px;color:#0f172a;max-width:800px;margin:0 auto;}
      .header{border-bottom:2px solid #0f172a;padding-bottom:14px;margin-bottom:24px;display:flex;justify-content:space-between;}
      .title{font-size:22px;font-weight:800;text-transform:uppercase;}
      table{width:100%;border-collapse:collapse;margin:20px 0;}
      td{padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;}
      .bold{font-weight:700;}
      .section-hdr{background:#f1f5f9;font-weight:800;text-transform:uppercase;font-size:12px;color:#334155;}
      .num{text-align:right;font-family:monospace;font-size:14px;}
      .total-row{border-top:2px solid #0f172a;border-bottom:2px solid #0f172a;font-weight:800;}
    </style></head><body>
      <div class="header">
        <div>
          <div class="title">🏥 ${pharmacy?.name || 'Healthcare Facility'}</div>
          <div style="font-size:14px;color:#475569;margin-top:4px;">Official Statement of Profit & Loss (P&L)</div>
          <div style="font-size:12px;color:#64748b;">Reporting Period: ${startDate} to ${endDate}</div>
        </div>
        <div style="text-align:right;font-size:11px;color:#64748b;">
          Generated: ${new Date().toLocaleDateString('en-KE')}<br/>
          Financial Accounts Division
        </div>
      </div>
      <table>
        <tr class="section-hdr"><td colspan="2">1. Operating Revenue</td></tr>
        <tr><td>Gross Pharmacy POS & Clinical Service Sales</td><td class="num">${fmt(pnl?.revenue || 0)}</td></tr>
        <tr class="section-hdr"><td colspan="2">2. Cost of Goods Sold (COGS)</td></tr>
        <tr><td>Pharmaceutical Stock Dispensed & Consumables</td><td class="num" style="color:#ef4444;">(${fmt(pnl?.cogs || 0)})</td></tr>
        <tr class="bold" style="background:#f8fafc;"><td>Gross Operational Profit</td><td class="num bold" style="color:#10b981;">${fmt(pnl?.gross_profit || 0)}</td></tr>
        <tr><td style="font-size:12px;color:#64748b;">Gross Margin Percentage</td><td class="num" style="font-size:12px;color:#64748b;">${pnl?.gross_margin || 0}%</td></tr>
        <tr class="section-hdr"><td colspan="2">3. Operating Expenses & Staff Remuneration</td></tr>
        <tr><td>Hospital Operating Expenses & Utilities</td><td class="num" style="color:#ef4444;">(${fmt(pnl?.expenses || 0)})</td></tr>
        <tr class="total-row"><td style="font-size:15px;">Net Operating Profit / (Loss)</td><td class="num" style="font-size:16px;color:${(pnl?.net_profit || 0) >= 0 ? '#10b981' : '#ef4444'};">${fmt(pnl?.net_profit || 0)}</td></tr>
        <tr><td style="font-size:12px;color:#64748b;">Net Profit Margin</td><td class="num" style="font-size:12px;color:#64748b;">${pnl?.net_margin || 0}%</td></tr>
      </table>
      <div style="margin-top:60px;display:flex;justify-content:space-between;font-size:12px;">
        <div>Finance Manager / Accountant: ____________________</div>
        <div>Managing Director: ____________________</div>
      </div>
      <script>window.onload=function(){window.print();}</script>
    </body></html>`;
    w.document.write(html);
    w.document.close();
  };

  // Print Payslip
  const handlePrintPayslip = (p) => {
    const w = window.open('', '_blank');
    const gross = parseFloat(p.basic_salary || 0) + parseFloat(p.allowances || 0);
    const totalDeductions = parseFloat(p.paye || 0) + parseFloat(p.sha || 0) + parseFloat(p.nssf || 0) + parseFloat(p.housing_levy || 0) + parseFloat(p.other_deductions || 0);
    const net = parseFloat(p.net_salary || 0);

    const html = `<!DOCTYPE html><html><head><title>Salary Payslip - ${p.employee_name}</title>
    <style>
      body{font-family:'Segoe UI',sans-serif;padding:35px;color:#0f172a;max-width:700px;margin:0 auto;border:1px solid #cbd5e1;border-radius:12px;}
      .hdr{border-bottom:2px solid #0f172a;padding-bottom:12px;display:flex;justify-content:space-between;}
      .emp-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px;background:#f8fafc;border-radius:8px;margin:16px 0;font-size:12px;}
      table{width:100%;border-collapse:collapse;margin:12px 0;}
      th{background:#0f172a;color:#fff;padding:8px 12px;font-size:11px;text-transform:uppercase;text-align:left;}
      td{padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;}
      .num{text-align:right;font-family:monospace;font-size:13px;}
      .net-box{background:#ecfdf5;border:2px solid #10b981;padding:12px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;margin-top:16px;}
    </style></head><body>
      <div class="hdr">
        <div>
          <h2 style="margin:0;font-size:18px;">🏥 ${pharmacy?.name || 'Healthcare Facility'}</h2>
          <div style="font-size:12px;color:#475569;">Official Confidential Salary Payslip</div>
        </div>
        <div style="text-align:right;font-size:11px;color:#64748b;">
          Pay Period: <strong>${MONTHS[(p.month || 1) - 1]} ${p.year}</strong><br/>
          Ref: PS-${p.id || Date.now().toString().slice(-6)}
        </div>
      </div>
      <div class="emp-grid">
        <div>Employee Name: <strong>${p.employee_name}</strong></div>
        <div>Designation / Role: <strong>${p.role || 'Staff'}</strong></div>
        <div>KRA PIN: <strong>${p.kra_pin || '—'}</strong></div>
        <div>Bank / Account: <strong>${p.bank_name || 'Bank Transfer'} (${p.bank_account || '—'})</strong></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
          <table>
            <thead><tr><th>Earnings Item</th><th style="text-align:right;">Amount</th></tr></thead>
            <tbody>
              <tr><td>Basic Monthly Pay</td><td class="num">${fmt(p.basic_salary)}</td></tr>
              <tr><td>Allowances (House/Transport)</td><td class="num">${fmt(p.allowances)}</td></tr>
              <tr style="font-weight:700;background:#f8fafc;"><td>Gross Earnings</td><td class="num">${fmt(gross)}</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <table>
            <thead><tr><th>Statutory / Deductions</th><th style="text-align:right;">Amount</th></tr></thead>
            <tbody>
              <tr><td>PAYE Income Tax</td><td class="num" style="color:#ef4444;">${fmt(p.paye)}</td></tr>
              <tr><td>SHA Health Contribution</td><td class="num" style="color:#ef4444;">${fmt(p.sha)}</td></tr>
              <tr><td>NSSF Pension Scheme</td><td class="num" style="color:#ef4444;">${fmt(p.nssf)}</td></tr>
              <tr><td>Affordable Housing Levy</td><td class="num" style="color:#ef4444;">${fmt(p.housing_levy)}</td></tr>
              ${parseFloat(p.other_deductions || 0) > 0 ? `<tr><td>Other Deductions</td><td class="num" style="color:#ef4444;">${fmt(p.other_deductions)}</td></tr>` : ''}
              <tr style="font-weight:700;background:#f8fafc;"><td>Total Deductions</td><td class="num" style="color:#ef4444;">${fmt(totalDeductions)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="net-box">
        <div>
          <div style="font-size:12px;color:#065f46;font-weight:700;text-transform:uppercase;">Net Salary Payable</div>
          <div style="font-size:10px;color:#047857;">Transferred via Automated Payroll System</div>
        </div>
        <div style="font-size:22px;font-weight:800;color:#065f46;font-family:monospace;">${fmt(net)}</div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:40px;font-size:11px;color:#64748b;">
        <div>Finance Officer: __________________________</div>
        <div>Employee Signature: __________________________</div>
      </div>
      <script>window.onload=function(){window.print();}</script>
    </body></html>`;
    w.document.write(html);
    w.document.close();
  };

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchCat = expenseCategoryFilter === 'all' || e.category === expenseCategoryFilter;
      const matchSearch = !expenseSearch ||
        e.description?.toLowerCase().includes(expenseSearch.toLowerCase()) ||
        e.category?.toLowerCase().includes(expenseSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [expenses, expenseCategoryFilter, expenseSearch]);

  return (
    <div style={{ padding: 24, height: '100vh', overflowY: 'auto', background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              💰 Financial Management & Payroll Suite
            </h1>
            <span style={{ fontSize: 11, background: '#10b98120', color: '#10b981', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
              AUDIT READY
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Revenue streams, statutory payroll engine, expense management, petty cash, and P&L financial audits.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'var(--bg-surface)', padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border)' }}>
            <Calendar size={14} color="var(--text-muted)" />
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}
            />
          </div>

          <button
            onClick={loadFinancialData}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>

          <button
            onClick={() => navigate('/app/department/hr')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer'
            }}
          >
            <Users size={14} color="#3b82f6" /> Open HR & Workforce →
          </button>

          <button
            onClick={() => setShowExpenseModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
              background: 'var(--accent)', border: 'none', borderRadius: 8,
              color: '#0F1612', fontSize: 13, fontWeight: 700, cursor: 'pointer'
            }}
          >
            <Plus size={15} /> Record Expense
          </button>
        </div>
      </div>

      {/* Top Financial KPI Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Card style={{ padding: 16, borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Gross Operating Revenue</span>
            <div style={{ padding: 6, background: '#10b98115', borderRadius: 8, color: '#10b981' }}><TrendingUp size={16} /></div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
            {fmt(cashFlow?.revenue || 0)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            POS Pharmacy + Clinical Services
          </div>
        </Card>

        <Card style={{ padding: 16, borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>HR Payroll Outflows</span>
            <div style={{ padding: 6, background: '#3b82f615', borderRadius: 8, color: '#3b82f6' }}><Users size={16} /></div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#3b82f6', fontFamily: 'monospace' }}>
            {fmt(cashFlow?.payroll_salaries || 0)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Salaries & Statutory taxes
          </div>
        </Card>

        <Card style={{ padding: 16, borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Operating Expenses</span>
            <div style={{ padding: 6, background: '#f59e0b15', borderRadius: 8, color: '#f59e0b' }}><TrendingDown size={16} /></div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b', fontFamily: 'monospace' }}>
            {fmt(cashFlow?.expenses || 0)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Rent, utilities & logistics
          </div>
        </Card>

        <Card style={{ padding: 16, borderLeft: `4px solid ${(pnl?.net_profit || 0) >= 0 ? '#10b981' : '#ef4444'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Net Operating Profit</span>
            <div style={{ padding: 6, background: (pnl?.net_profit || 0) >= 0 ? '#10b98115' : '#ef444415', borderRadius: 8, color: (pnl?.net_profit || 0) >= 0 ? '#10b981' : '#ef4444' }}>
              <DollarSign size={16} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: (pnl?.net_profit || 0) >= 0 ? '#10b981' : '#ef4444', fontFamily: 'monospace' }}>
            {fmt(pnl?.net_profit || 0)}
          </div>
          <div style={{ fontSize: 11, color: (pnl?.net_profit || 0) >= 0 ? '#10b981' : '#ef4444', marginTop: 4, fontWeight: 600 }}>
            Margin: {pnl?.net_margin || 0}%
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { id: 'Overview', label: '📊 Financial Overview & Analytics', icon: BarChart3 },
          { id: 'Payroll', label: '👥 Payroll & Remuneration', icon: Users, badge: payroll.length },
          { id: 'Expenses', label: '💸 Operating Expenses', icon: TrendingDown, badge: expenses.length },
          { id: 'PettyCash', label: '💵 Petty Cash Book', icon: Wallet, badge: pettyCash.transactions?.length },
          { id: 'CashFlow', label: '📈 Cash Flow Position', icon: TrendingUp },
          { id: 'PnL', label: '📑 Profit & Loss (P&L)', icon: FileText },
        ].map(t => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? '#0F1612' : 'var(--text-muted)',
                borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none',
                cursor: 'pointer', transition: 'all 0.15s ease'
              }}
            >
              <Icon size={16} /> {t.label}
              {t.badge ? (
                <span style={{
                  padding: '1px 6px', borderRadius: 10, fontSize: 10, fontWeight: 800,
                  background: active ? '#0F1612' : 'var(--bg-elevated)',
                  color: active ? 'var(--accent)' : 'var(--text-primary)',
                  border: active ? 'none' : '1px solid var(--border)'
                }}>
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: FINANCIAL OVERVIEW ── */}
      {activeTab === 'Overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Revenue Streams & Payment Gateways */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            <Card style={{ padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <PieChart size={18} color="#10b981" /> Revenue Collections by Payment Channel
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { name: 'M-Pesa (Till / Paybill)', val: cashFlow?.channels?.mpesa || 0, color: '#10b981' },
                  { name: 'Cash Collections', val: cashFlow?.channels?.cash || 0, color: '#3b82f6' },
                  { name: 'Insurance / SHA Claims', val: cashFlow?.channels?.insurance || 0, color: '#f59e0b' },
                  { name: 'Credit / Debit Cards', val: cashFlow?.channels?.card || 0, color: '#8b5cf6' },
                ].map(c => {
                  const total = cashFlow?.revenue || 1;
                  const pct = Math.round((c.val / total) * 100);
                  return (
                    <div key={c.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{c.name}</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{fmt(c.val)} ({pct}%)</span>
                      </div>
                      <div style={{ height: 7, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: c.color, borderRadius: 4 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card style={{ padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building size={18} color="#3b82f6" /> Inflow Sources
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>💊 Pharmacy POS Sales</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Over-the-counter & prescription sales</div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
                    {fmt(cashFlow?.pharmacy_revenue || 0)}
                  </div>
                </div>

                <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>🩺 OPD & Clinical Services</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Doctor consultations, labs & nursing fees</div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#3b82f6', fontFamily: 'monospace' }}>
                    {fmt(cashFlow?.clinical_revenue || 0)}
                  </div>
                </div>

                <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>💵 Petty Cash Float Balance</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Hospital operational cash on hand</div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#f59e0b', fontFamily: 'monospace' }}>
                    {fmt(pettyCash.summary?.current_balance || 0)}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── TAB 2: PAYROLL & REMUNERATION ── */}
      {activeTab === 'Payroll' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Payroll Period:</span>
              <select
                value={payrollMonth}
                onChange={e => setPayrollMonth(parseInt(e.target.value))}
                style={{
                  padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                }}
              >
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <select
                value={payrollYear}
                onChange={e => setPayrollYear(parseInt(e.target.value))}
                style={{
                  padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                }}
              >
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={handleExportBankSchedule}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}
              >
                <Download size={14} /> Export Bank CSV Schedule
              </button>

              <button
                onClick={handleGenerateBatchPayroll}
                disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer'
                }}
              >
                <Sparkles size={14} color="var(--accent)" /> ⚡ Generate Batch Payroll
              </button>

              <button
                onClick={() => {
                  setPayrollForm({
                    user_id: '', employee_name: '', employee_email: '', role: '',
                    month: payrollMonth, year: payrollYear,
                    basic_salary: '', allowances: '', paye: '', sha: '', nssf: '', housing_levy: '', other_deductions: '', notes: ''
                  });
                  setShowPayrollModal(true);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
                  background: 'var(--accent)', border: 'none', borderRadius: 8,
                  color: '#0F1612', fontSize: 13, fontWeight: 700, cursor: 'pointer'
                }}
              >
                <Plus size={15} /> Add Payroll Entry
              </button>
            </div>
          </div>

          {/* Payroll Table */}
          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                    {['Employee', 'Role', 'Basic Pay', 'Allowances', 'Gross Pay', 'PAYE Tax', 'SHA (2.75%)', 'NSSF', 'Housing Levy', 'Net Salary', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '11px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payroll.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>
                        No payroll computed for {MONTHS[payrollMonth - 1]} {payrollYear}. Click "Generate Batch Payroll" to calculate staff salaries automatically.
                      </td>
                    </tr>
                  ) : payroll.map(p => {
                    const gross = parseFloat(p.basic_salary || 0) + parseFloat(p.allowances || 0);
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{p.employee_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.bank_name || 'Bank Transfer'} ({p.bank_account || '—'})</div>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{p.role || 'Staff'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'monospace' }}>{fmt(p.basic_salary)}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{fmt(p.allowances)}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{fmt(gross)}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', color: '#ef4444' }}>{fmt(p.paye)}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', color: '#ef4444' }}>{fmt(p.sha)}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', color: '#ef4444' }}>{fmt(p.nssf)}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', color: '#ef4444' }}>{fmt(p.housing_levy)}</td>
                        <td style={{ padding: '10px 12px', fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: '#10b981' }}>{fmt(p.net_salary)}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => handlePrintPayslip(p)}
                              title="Print Payslip"
                              style={{
                                padding: '5px 8px', borderRadius: 6, border: 'none',
                                background: '#10b98120', color: '#10b981', cursor: 'pointer'
                              }}
                            >
                              <Printer size={13} />
                            </button>
                            <button
                              onClick={() => handleDeletePayroll(p.id)}
                              title="Delete Record"
                              style={{
                                padding: '5px 8px', borderRadius: 6, border: 'none',
                                background: '#ef444420', color: '#ef4444', cursor: 'pointer'
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB 3: OPERATING EXPENSES ── */}
      {activeTab === 'Expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search expenses by description..."
                value={expenseSearch}
                onChange={e => setExpenseSearch(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px 9px 36px', background: 'var(--bg-surface)',
                  border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)',
                  fontSize: 13, outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            <select
              value={expenseCategoryFilter}
              onChange={e => setExpenseCategoryFilter(e.target.value)}
              style={{
                padding: '9px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none'
              }}
            >
              <option value="all">All Categories</option>
              {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                    {['Date', 'Category', 'Description & Payee', 'Amount (KES)', 'Recorded By', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '11px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>
                        No operating expenses found for this period. Click "Record Expense" to add an entry.
                      </td>
                    </tr>
                  ) : filteredExpenses.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-primary)' }}>
                        {new Date(e.expense_date).toLocaleDateString('en-KE')}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                          background: '#f59e0b20', color: '#f59e0b', textTransform: 'capitalize'
                        }}>
                          {e.category}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {e.description}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: '#ef4444' }}>
                        {fmt(e.amount)}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                        {e.recorded_by_name || 'Finance Admin'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button
                          onClick={() => handleDeleteExpense(e.id)}
                          style={{
                            padding: '5px 8px', borderRadius: 6, border: 'none',
                            background: '#ef444420', color: '#ef4444', cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB 4: PETTY CASH BOOK ── */}
      {activeTab === 'PettyCash' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ padding: '8px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Current Float Balance</span>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
                  {fmt(pettyCash.summary?.current_balance || 0)}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowPettyCashModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
                background: 'var(--accent)', border: 'none', borderRadius: 8,
                color: '#0F1612', fontSize: 13, fontWeight: 700, cursor: 'pointer'
              }}
            >
              <Plus size={15} /> Record Petty Cash Voucher
            </button>
          </div>

          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                    {['Date', 'Voucher #', 'Type', 'Description', 'Payee / Source', 'Amount (KES)', 'Recorded By', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '11px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(!pettyCash.transactions || pettyCash.transactions.length === 0) ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>
                        No petty cash transactions recorded. Click "Record Petty Cash Voucher" to add an inflow or disbursement.
                      </td>
                    </tr>
                  ) : pettyCash.transactions.map(pc => (
                    <tr key={pc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-primary)' }}>
                        {new Date(pc.created_at).toLocaleDateString('en-KE')}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', fontWeight: 700 }}>
                        {pc.voucher_number}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                          background: pc.transaction_type === 'inflow' ? '#10b98120' : '#ef444420',
                          color: pc.transaction_type === 'inflow' ? '#10b981' : '#ef4444',
                          textTransform: 'uppercase'
                        }}>
                          {pc.transaction_type === 'inflow' ? '↓ Float Inflow' : '↑ Disbursement'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {pc.description}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                        {pc.payee_or_source || '—'}
                      </td>
                      <td style={{
                        padding: '10px 12px', fontSize: 13, fontWeight: 800, fontFamily: 'monospace',
                        color: pc.transaction_type === 'inflow' ? '#10b981' : '#ef4444'
                      }}>
                        {pc.transaction_type === 'inflow' ? '+' : '-'}{fmt(pc.amount)}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                        {pc.recorded_by_name || 'Accountant'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button
                          onClick={() => handleDeletePettyCash(pc.id)}
                          style={{
                            padding: '5px 8px', borderRadius: 6, border: 'none',
                            background: '#ef444420', color: '#ef4444', cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB 5: CASH FLOW ── */}
      {activeTab === 'CashFlow' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            <Card style={{ padding: 20, borderLeft: '4px solid #10b981' }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, color: '#10b981', display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={18} /> Total Cash Inflows
              </h3>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'monospace', color: '#10b981', marginBottom: 16 }}>
                +{fmt(cashFlow?.revenue || 0)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Pharmacy Sales Revenue:</span>
                  <strong>{fmt(cashFlow?.pharmacy_revenue || 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Clinical & Consultation Fees:</span>
                  <strong>{fmt(cashFlow?.clinical_revenue || 0)}</strong>
                </div>
              </div>
            </Card>

            <Card style={{ padding: 20, borderLeft: '4px solid #ef4444' }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingDown size={18} /> Total Cash Outflows
              </h3>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'monospace', color: '#ef4444', marginBottom: 16 }}>
                -{fmt(cashFlow?.total_outflow || 0)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Operating Expenses:</span>
                  <strong>{fmt(cashFlow?.expenses || 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Staff Salaries & Remuneration:</span>
                  <strong>{fmt(cashFlow?.payroll_salaries || 0)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Stock Purchases:</span>
                  <strong>{fmt(cashFlow?.purchases || 0)}</strong>
                </div>
              </div>
            </Card>
          </div>

          <Card style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Net Cash Position</h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Period: {startDate} to {endDate}</div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, fontFamily: 'monospace', color: (cashFlow?.net_cashflow || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                {fmt(cashFlow?.net_cashflow || 0)}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB 6: PROFIT & LOSS ── */}
      {activeTab === 'PnL' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 850 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Official Hospital Profit & Loss Statement</h3>
            <button
              onClick={handlePrintPnL}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer'
              }}
            >
              <Printer size={15} /> Print / Export Statement
            </button>
          </div>

          <Card style={{ padding: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>1. Operating Revenue</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 14 }}>
                  <span>Gross Clinic & Pharmacy Revenue</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#10b981' }}>{fmt(pnl?.revenue || 0)}</span>
                </div>
              </div>

              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>2. Cost of Goods Sold (COGS)</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 14 }}>
                  <span>Pharmaceutical Inventory & Consumables</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#ef4444' }}>({fmt(pnl?.cogs || 0)})</span>
                </div>
              </div>

              <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>Gross Operational Profit</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gross Margin: {pnl?.gross_margin || 0}%</div>
                </div>
                <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace', color: '#10b981' }}>{fmt(pnl?.gross_profit || 0)}</span>
              </div>

              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>3. Operating Expenses</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 14 }}>
                  <span>Hospital Operations, Rent & Salaries</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#ef4444' }}>({fmt(pnl?.expenses || 0)})</span>
                </div>
              </div>

              <div style={{ padding: '14px 16px', background: 'var(--bg-elevated)', border: '2px solid var(--border)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>Net Operating Profit / (Loss)</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Net Margin: {pnl?.net_margin || 0}%</div>
                </div>
                <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color: (pnl?.net_profit || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                  {fmt(pnl?.net_profit || 0)}
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── MODAL: RECORD EXPENSE ── */}
      {showExpenseModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
        }}>
          <div style={{ background: 'var(--bg-surface)', width: '100%', maxWidth: 500, borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>💸 Record Operating Expense</h3>
              <button onClick={() => setShowExpenseModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Expense Category</label>
                <select
                  value={expenseForm.category}
                  onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                >
                  {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Amount (KES) *</label>
                <input
                  type="number"
                  placeholder="e.g. 25000"
                  value={expenseForm.amount}
                  onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description & Purpose *</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly electricity bill for clinic & cold room"
                  value={expenseForm.description}
                  onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Payee / Supplier</label>
                  <input
                    type="text"
                    placeholder="e.g. Kenya Power"
                    value={expenseForm.payee}
                    onChange={e => setExpenseForm(f => ({ ...f, payee: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Payment Method</label>
                  <select
                    value={expenseForm.payment_method}
                    onChange={e => setExpenseForm(f => ({ ...f, payment_method: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  >
                    {PAYMENT_METHODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Receipt / Reference Number</label>
                <input
                  type="text"
                  placeholder="e.g. KPLC-892189 / M-Pesa Code"
                  value={expenseForm.receipt_ref}
                  onChange={e => setExpenseForm(f => ({ ...f, receipt_ref: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowExpenseModal(false)} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13 }}>Cancel</button>
              <button onClick={handleSaveExpense} disabled={saving} style={{ padding: '8px 18px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0F1612', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                {saving ? 'Saving...' : 'Record Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD PAYROLL ENTRY ── */}
      {showPayrollModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
        }}>
          <div style={{ background: 'var(--bg-surface)', width: '100%', maxWidth: 600, borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>👥 Add Payroll Entry</h3>
              <button onClick={() => setShowPayrollModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '75vh', overflowY: 'auto' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Select Staff Member</label>
                <select
                  value={payrollForm.employee_name}
                  onChange={e => {
                    const st = staffList.find(s => s.full_name === e.target.value);
                    setPayrollForm(f => ({
                      ...f,
                      employee_name: e.target.value,
                      user_id: st?.user_id || st?.id || null,
                      employee_email: st?.email || '',
                      role: st?.designation || st?.role || '',
                      basic_salary: st?.basic_salary || '',
                      allowances: parseFloat(st?.house_allowance || 0) + parseFloat(st?.transport_allowance || 0) || ''
                    }));
                    if (st?.basic_salary) {
                      handleAutoCalcTaxes(st.basic_salary, parseFloat(st?.house_allowance || 0) + parseFloat(st?.transport_allowance || 0));
                    }
                  }}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                >
                  <option value="">Select Employee</option>
                  {staffList.map(s => <option key={s.id} value={s.full_name}>{s.full_name} ({s.designation || s.role || 'Staff'})</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Basic Salary (KES) *</label>
                  <input
                    type="number"
                    value={payrollForm.basic_salary}
                    onChange={e => {
                      setPayrollForm(f => ({ ...f, basic_salary: e.target.value }));
                      handleAutoCalcTaxes(e.target.value, payrollForm.allowances);
                    }}
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Allowances (KES)</label>
                  <input
                    type="number"
                    value={payrollForm.allowances}
                    onChange={e => {
                      setPayrollForm(f => ({ ...f, allowances: e.target.value }));
                      handleAutoCalcTaxes(payrollForm.basic_salary, e.target.value);
                    }}
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase' }}>Statutory Deductions (Kenya)</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>PAYE Tax</label>
                    <input
                      type="number"
                      value={payrollForm.paye}
                      onChange={e => setPayrollForm(f => ({ ...f, paye: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>SHA (2.75%)</label>
                    <input
                      type="number"
                      value={payrollForm.sha}
                      onChange={e => setPayrollForm(f => ({ ...f, sha: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>NSSF</label>
                    <input
                      type="number"
                      value={payrollForm.nssf}
                      onChange={e => setPayrollForm(f => ({ ...f, nssf: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>Housing Levy (1.5%)</label>
                    <input
                      type="number"
                      value={payrollForm.housing_levy}
                      onChange={e => setPayrollForm(f => ({ ...f, housing_levy: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowPayrollModal(false)} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13 }}>Cancel</button>
              <button onClick={handleSavePayroll} disabled={saving} style={{ padding: '8px 18px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0F1612', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                {saving ? 'Saving...' : 'Save Payroll Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: PETTY CASH ── */}
      {showPettyCashModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
        }}>
          <div style={{ background: 'var(--bg-surface)', width: '100%', maxWidth: 480, borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>💵 Record Petty Cash Voucher</h3>
              <button onClick={() => setShowPettyCashModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Transaction Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setPettyForm(f => ({ ...f, transaction_type: 'outflow' }))}
                    style={{
                      padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: pettyForm.transaction_type === 'outflow' ? '#ef4444' : 'var(--bg-elevated)',
                      color: pettyForm.transaction_type === 'outflow' ? '#fff' : 'var(--text-muted)',
                      border: 'none', cursor: 'pointer'
                    }}
                  >
                    ↑ Disbursement (Outflow)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPettyForm(f => ({ ...f, transaction_type: 'inflow' }))}
                    style={{
                      padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: pettyForm.transaction_type === 'inflow' ? '#10b981' : 'var(--bg-elevated)',
                      color: pettyForm.transaction_type === 'inflow' ? '#fff' : 'var(--text-muted)',
                      border: 'none', cursor: 'pointer'
                    }}
                  >
                    ↓ Replenish Float (Inflow)
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Amount (KES) *</label>
                <input
                  type="number"
                  placeholder="e.g. 1500"
                  value={pettyForm.amount}
                  onChange={e => setPettyForm(f => ({ ...f, amount: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description & Purpose *</label>
                <input
                  type="text"
                  placeholder="e.g. Emergency sterile water, transport refund, office milk"
                  value={pettyForm.description}
                  onChange={e => setPettyForm(f => ({ ...f, description: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Payee / Recipient</label>
                <input
                  type="text"
                  placeholder="e.g. Nurse Alice / Rider"
                  value={pettyForm.payee_or_source}
                  onChange={e => setPettyForm(f => ({ ...f, payee_or_source: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowPettyCashModal(false)} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13 }}>Cancel</button>
              <button onClick={handleSavePettyCash} disabled={saving} style={{ padding: '8px 18px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0F1612', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                {saving ? 'Saving...' : 'Record Voucher'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
