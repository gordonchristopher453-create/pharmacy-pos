import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  TrendingUp, TrendingDown, DollarSign, Users,
  Plus, Trash2, Printer, Loader, X, FileText, Wallet,
  Calendar, Shield, PieChart, BarChart3, CheckCircle, 
  AlertCircle, ArrowUpRight, ArrowDownRight, RefreshCw, Briefcase, Calculator
} from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const EXPENSE_CATEGORIES = ['salary','rent','utilities','stock','equipment','operations','other'];
const CATEGORY_COLORS = { 
  salary:'#3b82f6', 
  rent:'#f59e0b', 
  utilities:'#a855f7', 
  stock:'#10b981', 
  equipment:'#f97316', 
  operations:'#06b6d4',
  other:'#64748b' 
};

const TABS = [
  { id: 'Overview', label: '📊 Executive Overview', icon: PieChart },
  { id: 'Payroll', label: '👥 HR & Payroll', icon: Users },
  { id: 'Expenses', label: '💸 Operating Expenses', icon: Wallet },
  { id: 'Cash Flow', label: '📈 Cash Flow', icon: TrendingUp },
  { id: 'P&L', label: '📑 Profit & Loss (P&L)', icon: FileText },
];

const fmt = (n) => `KES ${parseFloat(n||0).toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtShort = (n) => {
  const v = parseFloat(n||0);
  if (v >= 1000000) return `KES ${(v/1000000).toFixed(2)}M`;
  if (v >= 1000) return `KES ${(v/1000).toFixed(1)}K`;
  return `KES ${v.toFixed(0)}`;
};

const Card = ({ children, style={}, ...props }) => (
  <div style={{ background:'var(--bg-surface)', borderRadius:14, border:'1px solid var(--border)', ...style }} {...props}>
    {children}
  </div>
);

const Input = ({ label, ...props }) => (
  <div>
    {label && <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5, fontWeight:600 }}>{label}</label>}
    <input {...props} style={{ width:'100%', padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box', ...props.style }} />
  </div>
);

const Select = ({ label, children, ...props }) => (
  <div>
    {label && <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5, fontWeight:600 }}>{label}</label>}
    <select {...props} style={{ width:'100%', padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box', ...props.style }}>{children}</select>
  </div>
);

// ── PAYSLIP PRINT ────────────────────────────────────────
const printPayslip = (p, pharmacy) => {
  const monthName = MONTHS[p.month - 1];
  const grossEarnings = parseFloat(p.basic_salary||0) + parseFloat(p.allowances||0);
  const paye = parseFloat(p.paye||0);
  const sha = parseFloat(p.sha||0);
  const nssf = parseFloat(p.nssf||0);
  const housing = parseFloat(p.housing_levy||0);
  const other = parseFloat(p.other_deductions||0);
  const totalDeductions = paye + sha + nssf + housing + other;
  const netSalary = parseFloat(p.net_salary||0);
  const taxablePay = Math.max(0, grossEarnings - nssf);
  const f2 = (n) => `KES ${parseFloat(n||0).toLocaleString("en-KE",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

  const html = `<!DOCTYPE html><html><head><title>Payslip - ${p.employee_name}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;color:#0f172a;padding:30px;font-size:13px;line-height:1.5;}
    .payslip-box{max-width:750px;margin:0 auto;border:1px solid #cbd5e1;padding:24px;border-radius:8px;}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:14px;margin-bottom:16px;}
    .org-name{font-size:20px;font-weight:800;text-transform:uppercase;color:#0f172a;}
    .org-sub{font-size:11px;color:#475569;margin-top:3px;}
    .slip-title{text-align:center;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;margin:14px 0;padding:8px;background:#0f172a;color:#ffffff;border-radius:4px;}
    .emp-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;}
    .emp-label{color:#64748b;font-size:10px;text-transform:uppercase;font-weight:700;}
    .emp-value{font-weight:700;font-size:13px;color:#0f172a;}
    table{width:100%;border-collapse:collapse;margin-bottom:16px;}
    th{background:#f1f5f9;color:#334155;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;font-weight:700;border-bottom:2px solid #cbd5e1;}
    td{padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;}
    .amt{text-align:right;font-family:monospace;font-weight:700;}
    .green{color:#15803d;}
    .red{color:#b91c1c;}
    .subtotal td{font-weight:800;background:#f8fafc;}
    .net th{font-size:15px;padding:12px 10px;background:#0f172a;color:#fff;}
    .tax-box{font-size:11px;color:#334155;margin-bottom:16px;padding:10px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;}
    .sig{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:40px;padding-top:16px;border-top:1px solid #cbd5e1;}
    .sig-line{border-top:1px solid #64748b;padding-top:6px;font-size:11px;color:#475569;text-align:center;}
    .footer{text-align:center;font-size:10px;color:#64748b;margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;}
    @media print{body{padding:0;} .payslip-box{border:none;padding:0;}}
  </style></head><body>
  <div class="payslip-box">
    <div class="header">
      <div>
        <div class="org-name">💊 ${pharmacy?.name||'HEALTHCARE FACILITY'}</div>
        <div class="org-sub">${pharmacy?.address||'P.O Box Kenya'}</div>
        ${pharmacy?.phone?`<div class="org-sub">Tel: ${pharmacy.phone}</div>`:''}
        <div class="org-sub">Official Payroll & Remuneration Voucher</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Pay Slip Ref</div>
        <div style="font-size:16px;font-weight:800;color:#0f172a;font-family:monospace;">PAY-${p.year}${String(p.month).padStart(2,'0')}-${String(p.id).padStart(4,'0')}</div>
        <div class="org-sub">Generated: ${new Date().toLocaleDateString('en-KE')}</div>
      </div>
    </div>

    <div class="slip-title">${monthName} ${p.year} — OFFICIAL SALARY PAYSLIP</div>

    <div class="emp-grid">
      <div><div class="emp-label">Employee Name</div><div class="emp-value">${p.employee_name}</div></div>
      <div><div class="emp-label">Employee ID</div><div class="emp-value">EMP-${String(p.id).padStart(4,'0')}</div></div>
      <div><div class="emp-label">Email Address</div><div class="emp-value">${p.employee_email||'—'}</div></div>
      <div><div class="emp-label">Designation / Role</div><div class="emp-value" style="text-transform:capitalize">${p.role||'Staff'}</div></div>
      <div><div class="emp-label">Pay Period</div><div class="emp-value">${monthName} ${p.year}</div></div>
      <div><div class="emp-label">Department</div><div class="emp-value">Clinical / Administrative</div></div>
    </div>

    <table>
      <thead><tr><th>Earnings Breakdown</th><th class="amt">Amount (KES)</th></tr></thead>
      <tbody>
        <tr><td>Basic Salary</td><td class="amt green">${f2(p.basic_salary)}</td></tr>
        ${parseFloat(p.allowances||0)>0?`<tr><td>Allowances & Bonuses</td><td class="amt green">${f2(p.allowances)}</td></tr>`:''}
        <tr class="subtotal"><td>Gross Earnings</td><td class="amt green">${f2(grossEarnings)}</td></tr>
      </tbody>
    </table>

    <div class="tax-box">
      <strong>Kenyan Statutory Tax Computation:</strong><br/>
      Gross Earnings: ${f2(grossEarnings)} &nbsp;|&nbsp;
      NSSF Relief: ${f2(nssf)} &nbsp;|&nbsp;
      Taxable Pay: ${f2(taxablePay)} &nbsp;|&nbsp;
      PAYE Assessed: ${f2(paye)}
    </div>

    <table>
      <thead><tr><th>Statutory & Other Deductions</th><th class="amt">Amount (KES)</th></tr></thead>
      <tbody>
        ${paye>0?`<tr><td>P.A.Y.E (Pay As You Earn)</td><td class="amt red">${f2(paye)}</td></tr>`:'<tr><td>P.A.Y.E (Income Tax)</td><td class="amt">—</td></tr>'}
        ${nssf>0?`<tr><td>N.S.S.F (Pension Scheme)</td><td class="amt red">${f2(nssf)}</td></tr>`:'<tr><td>N.S.S.F</td><td class="amt">—</td></tr>'}
        ${sha>0?`<tr><td>S.H.A (Social Health Authority - 2.75%)</td><td class="amt red">${f2(sha)}</td></tr>`:'<tr><td>S.H.A</td><td class="amt">—</td></tr>'}
        ${housing>0?`<tr><td>Affordable Housing Levy (1.5%)</td><td class="amt red">${f2(housing)}</td></tr>`:'<tr><td>Housing Levy</td><td class="amt">—</td></tr>'}
        ${other>0?`<tr><td>Other Loan / Salary Advance Deductions</td><td class="amt red">${f2(other)}</td></tr>`:''}
        <tr class="subtotal"><td>Total Statutory & Personal Deductions</td><td class="amt red">${f2(totalDeductions)}</td></tr>
      </tbody>
    </table>

    <table class="net">
      <thead><tr><th>TAKE HOME NET PAY</th><th class="amt" style="font-size:16px">${f2(netSalary)}</th></tr></thead>
    </table>

    ${p.notes?`<div style="font-size:11px;color:#334155;margin-bottom:16px;padding:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;"><strong>Payroll Notes:</strong> ${p.notes}</div>`:''}

    <div class="sig">
      <div class="sig-line">Prepared By: Finance / HR Manager</div>
      <div class="sig-line">Employee Signature & Date</div>
    </div>

    <div class="footer">${pharmacy?.name||'Healthcare Facility'} &nbsp;·&nbsp; ${monthName} ${p.year} Confidential Payslip</div>
  </div>
  </body></html>`;

  const w = window.open('','_blank');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
};

// ── PRINT FINANCIAL P&L REPORT ───────────────────────────
const printPLReport = (pl, pharmacy) => {
  const f2 = (n) => `KES ${parseFloat(n||0).toLocaleString("en-KE",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const html = `<!DOCTYPE html><html><head><title>Profit and Loss Statement</title>
  <style>
    body{font-family:'Segoe UI',sans-serif;padding:30px;color:#0f172a;max-width:800px;margin:0 auto;}
    .header{border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:20px;}
    .title{font-size:20px;font-weight:800;text-transform:uppercase;}
    table{width:100%;border-collapse:collapse;margin-top:16px;}
    td,th{padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;}
    .bold{font-weight:800;background:#f8fafc;}
    .amt{text-align:right;font-family:monospace;font-weight:700;}
  </style></head><body>
    <div class="header">
      <div class="title">${pharmacy?.name || 'Healthcare Facility'}</div>
      <div>Official Executive Profit & Loss Statement</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px;">Period: ${pl?.period?.start || 'N/A'} to ${pl?.period?.end || 'N/A'}</div>
    </div>
    <table>
      <thead><tr><th style="text-align:left;">Financial Line Item</th><th style="text-align:right;">Amount (KES)</th></tr></thead>
      <tbody>
        <tr><td>Total Operating Revenue</td><td class="amt" style="color:#16a34a;">${f2(pl?.revenue)}</td></tr>
        <tr><td>Cost of Goods Sold (COGS)</td><td class="amt" style="color:#dc2626;">-${f2(pl?.cogs)}</td></tr>
        <tr class="bold"><td>Gross Operating Profit</td><td class="amt">${f2(pl?.gross_profit)}</td></tr>
        <tr><td>Gross Profit Margin</td><td class="amt">${pl?.gross_margin || 0}%</td></tr>
        <tr><td>Total Operating Expenses (Payroll, Rent, Stock)</td><td class="amt" style="color:#dc2626;">-${f2(pl?.expenses)}</td></tr>
        <tr class="bold" style="font-size:15px;background:#0f172a;color:#fff;"><td>NET OPERATING PROFIT</td><td class="amt" style="color:#fff;">${f2(pl?.net_profit)}</td></tr>
        <tr><td>Net Operating Margin</td><td class="amt">${pl?.net_margin || 0}%</td></tr>
      </tbody>
    </table>
    <script>window.onload = function() { window.print(); };</script>
  </body></html>`;
  const w = window.open('','_blank');
  w.document.write(html);
  w.document.close();
};

// ── MAIN COMPONENT ───────────────────────────────────────
export default function FinancePage() {
  const { user } = useSelector(state => state.auth);
  const pharmacy = user?.pharmacy;
  const [tab, setTab] = useState('Overview');
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [expenseSummary, setExpenseSummary] = useState([]);
  const [cashflow, setCashflow] = useState(null);
  const [pl, setPl] = useState(null);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());

  const EMPTY_PAYROLL = {
    user_id: '', employee_name: '', employee_email: '', role: '',
    month: now.getMonth() + 1, year: now.getFullYear(),
    basic_salary: '', allowances: '',
    paye: '', sha: '', nssf: '', housing_levy: '', other_deductions: '',
    notes: ''
  };

  const EMPTY_EXPENSE = {
    category: 'rent', description: '', amount: '', expense_date: now.toISOString().split('T')[0]
  };

  const [payrollForm, setPayrollForm] = useState(EMPTY_PAYROLL);
  const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE);
  const pf = (k, v) => setPayrollForm(p => ({ ...p, [k]: v }));
  const ef = (k, v) => setExpenseForm(p => ({ ...p, [k]: v }));

  // Helper auto-calculate statutory deductions for Kenya
  const autoCalculateKenyanDeductions = (basicStr, allowancesStr) => {
    const basic = parseFloat(basicStr || 0);
    const allowances = parseFloat(allowancesStr || 0);
    const gross = basic + allowances;
    if (gross <= 0) return;

    // NSSF Tier 1 & 2 approx
    const nssf = Math.min(2160, Math.round(gross * 0.06));
    // SHA 2.75%
    const sha = Math.round(gross * 0.0275);
    // Housing Levy 1.5%
    const housing = Math.round(gross * 0.015);

    // Taxable pay
    const taxable = Math.max(0, gross - nssf);
    // PAYE brackets approximation
    let paye = 0;
    if (taxable > 24000) {
      if (taxable <= 32333) paye = (taxable - 24000) * 0.25;
      else if (taxable <= 500000) paye = (32333 - 24000) * 0.25 + (taxable - 32333) * 0.30;
      else paye = (32333 - 24000) * 0.25 + (500000 - 32333) * 0.30 + (taxable - 500000) * 0.325;
      paye = Math.max(0, paye - 2400); // Personal relief KES 2,400
    }

    pf('nssf', nssf ? String(nssf) : '');
    pf('sha', sha ? String(sha) : '');
    pf('housing_levy', housing ? String(housing) : '');
    pf('paye', paye ? String(Math.round(paye)) : '');
  };

  // Live net salary calculation
  const grossEarnings = (parseFloat(payrollForm.basic_salary)||0) + (parseFloat(payrollForm.allowances)||0);
  const totalDeductions = (parseFloat(payrollForm.paye)||0) + (parseFloat(payrollForm.sha)||0) +
    (parseFloat(payrollForm.nssf)||0) + (parseFloat(payrollForm.housing_levy)||0) + (parseFloat(payrollForm.other_deductions)||0);
  const netPreview = grossEarnings - totalDeductions;

  useEffect(() => { fetchStaff(); }, []);
  useEffect(() => { fetchPayroll(); }, [filterMonth, filterYear]);
  useEffect(() => { fetchExpenses(); }, []);
  useEffect(() => { fetchCashflow(); }, []);
  useEffect(() => { fetchPL(); }, []);

  const fetchStaff = async () => {
    try { const r = await api.get('/finance/staff'); setStaff(r.data.data||[]); } catch {}
  };

  const fetchPayroll = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/finance/payroll?month=${filterMonth}&year=${filterYear}`);
      setPayroll(r.data.data||[]);
    } catch { toast.error('Failed to load payroll'); }
    finally { setLoading(false); }
  };

  const fetchExpenses = async () => {
    try {
      const r = await api.get('/finance/expenses');
      setExpenses(r.data.data?.expenses||[]);
      setExpenseSummary(r.data.data?.summary||[]);
    } catch {}
  };

  const fetchCashflow = async () => {
    try {
      const r = await api.get('/finance/cashflow');
      setCashflow(r.data.data);
    } catch {}
  };

  const fetchPL = async () => {
    try {
      const r = await api.get('/finance/pnl');
      setPl(r.data.data);
    } catch {}
  };

  const handleStaffSelect = (user_id) => {
    const s = staff.find(s => s.id === parseInt(user_id));
    if (s) {
      pf('user_id', s.id);
      pf('employee_name', s.full_name);
      pf('employee_email', s.email);
      pf('role', s.role);
    } else {
      pf('user_id', '');
    }
  };

  const handleSavePayroll = async () => {
    if (!payrollForm.employee_name || !payrollForm.basic_salary) {
      toast.error('Employee name and basic salary are required'); return;
    }
    setSaving(true);
    try {
      await api.post('/finance/payroll', {
        ...payrollForm,
        basic_salary: parseFloat(payrollForm.basic_salary)||0,
        allowances: parseFloat(payrollForm.allowances)||0,
        paye: parseFloat(payrollForm.paye)||0,
        sha: parseFloat(payrollForm.sha)||0,
        nssf: parseFloat(payrollForm.nssf)||0,
        housing_levy: parseFloat(payrollForm.housing_levy)||0,
        other_deductions: parseFloat(payrollForm.other_deductions)||0,
      });
      toast.success('Payroll saved successfully!');
      setShowPayrollModal(false);
      setPayrollForm(EMPTY_PAYROLL);
      fetchPayroll();
      fetchCashflow();
      fetchPL();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to save payroll');
    } finally { setSaving(false); }
  };

  const handleSaveExpense = async () => {
    if (!expenseForm.description || !expenseForm.amount) {
      toast.error('Description and amount are required'); return;
    }
    setSaving(true);
    try {
      await api.post('/finance/expenses', expenseForm);
      toast.success('Expense recorded successfully!');
      setShowExpenseModal(false);
      setExpenseForm(EMPTY_EXPENSE);
      fetchExpenses();
      fetchCashflow();
      fetchPL();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to add expense');
    } finally { setSaving(false); }
  };

  const handleDeletePayroll = async (id) => {
    if (!window.confirm('Delete this payroll record?')) return;
    try {
      await api.delete(`/finance/payroll/${id}`);
      toast.success('Payroll record deleted');
      fetchPayroll();
      fetchCashflow();
      fetchPL();
    } catch { toast.error('Failed to delete payroll'); }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await api.delete(`/finance/expenses/${id}`);
      toast.success('Expense deleted');
      fetchExpenses();
      fetchCashflow();
      fetchPL();
    } catch { toast.error('Failed to delete expense'); }
  };

  const totalNetPayroll = payroll.reduce((s, p) => s + parseFloat(p.net_salary||0), 0);
  const totalGrossPayroll = payroll.reduce((s, p) => s + parseFloat(p.basic_salary||0) + parseFloat(p.allowances||0), 0);
  const totalStatutoryTaxes = payroll.reduce((s, p) => s + parseFloat(p.paye||0) + parseFloat(p.sha||0) + parseFloat(p.nssf||0) + parseFloat(p.housing_levy||0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + parseFloat(e.amount||0), 0);

  return (
    <div style={{ padding: 24, height: '100vh', overflow: 'auto', background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>💼 Executive Admin & HR Financial Dashboard</h1>
            <span style={{ fontSize: 11, background: 'var(--accent)20', color: 'var(--accent)', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>FACILITY MANAGEMENT</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Full financial oversight, staff payroll processing, statutory tax compliance, operating expenses, cash flow & P&L statements.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => { fetchPayroll(); fetchExpenses(); fetchCashflow(); fetchPL(); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setShowPayrollModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0F1612', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={15}/> Process Staff Payroll
          </button>
          <button onClick={() => setShowExpenseModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={15}/> Record Expense
          </button>
        </div>
      </div>

      {/* Top Executive KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Card style={{ padding: 16, borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Gross Revenue (P&L)</span>
            <div style={{ padding: 6, background: '#10b98115', borderRadius: 8, color: '#10b981' }}><DollarSign size={16}/></div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>{fmtShort(pl?.revenue || 0)}</div>
          <div style={{ fontSize: 11, color: '#10b981', marginTop: 4, fontWeight: 600 }}>Medical & Sales Inflows</div>
        </Card>

        <Card style={{ padding: 16, borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Monthly HR Net Payroll</span>
            <div style={{ padding: 6, background: '#3b82f615', borderRadius: 8, color: '#3b82f6' }}><Users size={16}/></div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{fmtShort(totalNetPayroll)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{payroll.length} Personnel Enrolled ({MONTHS[filterMonth-1]})</div>
        </Card>

        <Card style={{ padding: 16, borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Statutory Taxes (KRA/SHA)</span>
            <div style={{ padding: 6, background: '#8b5cf615', borderRadius: 8, color: '#8b5cf6' }}><Shield size={16}/></div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#8b5cf6', fontFamily: 'monospace' }}>{fmtShort(totalStatutoryTaxes)}</div>
          <div style={{ fontSize: 11, color: '#8b5cf6', marginTop: 4, fontWeight: 600 }}>PAYE, SHA, NSSF, Housing</div>
        </Card>

        <Card style={{ padding: 16, borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Operating Expenses</span>
            <div style={{ padding: 6, background: '#f59e0b15', borderRadius: 8, color: '#f59e0b' }}><Wallet size={16}/></div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{fmtShort(totalExpenses)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Rent, Utilities & Consumables</div>
        </Card>

        <Card style={{ padding: 16, borderLeft: `4px solid ${(pl?.net_profit || 0) >= 0 ? '#10b981' : '#ef4444'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Net Profit Margin</span>
            <div style={{ padding: 6, background: (pl?.net_profit || 0) >= 0 ? '#10b98115' : '#ef444415', borderRadius: 8, color: (pl?.net_profit || 0) >= 0 ? '#10b981' : '#ef4444' }}>
              {(pl?.net_profit || 0) >= 0 ? <ArrowUpRight size={16}/> : <ArrowDownRight size={16}/>}
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: (pl?.net_profit || 0) >= 0 ? '#10b981' : '#ef4444', fontFamily: 'monospace' }}>
            {fmtShort(pl?.net_profit || 0)}
          </div>
          <div style={{ fontSize: 11, color: (pl?.net_profit || 0) >= 0 ? '#10b981' : '#ef4444', marginTop: 4, fontWeight: 700 }}>
            {pl?.net_margin || 0}% Net Margin
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: active ? 'var(--accent)' : 'transparent',
              color: active ? '#0F1612' : 'var(--text-muted)', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none',
              cursor: 'pointer', transition: 'all 0.15s ease'
            }}>
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: EXECUTIVE OVERVIEW & ANALYTICS ── */}
      {tab === 'Overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {/* Financial Health Summary */}
            <Card style={{ padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Briefcase size={18} color="var(--accent)" /> Executive Financial Health Indicator
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ padding: 14, background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>Gross Revenue vs Operating Outflows</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{pl?.gross_margin || 0}% Margin</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${Math.min(100, Math.max(0, pl?.gross_margin || 0))}%`, background: '#10b981' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Staff Payroll Ratio</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#3b82f6', fontFamily: 'monospace', marginTop: 2 }}>
                      {pl?.revenue ? Math.round((totalNetPayroll / pl.revenue) * 100) : 0}% of Revenue
                    </div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Expenses Ratio</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#f59e0b', fontFamily: 'monospace', marginTop: 2 }}>
                      {pl?.revenue ? Math.round((totalExpenses / pl.revenue) * 100) : 0}% of Revenue
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* HR & Payroll Summary Box */}
            <Card style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={18} color="#3b82f6" /> HR & Payroll Summary ({MONTHS[filterMonth-1]} {filterYear})
                </h3>
                <button onClick={() => setTab('Payroll')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Manage Payroll →</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Enrolled Staff Members</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{payroll.length} Personnel</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Gross Salaries & Allowances</span>
                  <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{fmt(totalGrossPayroll)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Statutory Tax Remittances</span>
                  <strong style={{ color: '#8b5cf6', fontFamily: 'monospace' }}>{fmt(totalStatutoryTaxes)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Net Salary Outflow</span>
                  <strong style={{ color: '#10b981', fontFamily: 'monospace' }}>{fmt(totalNetPayroll)}</strong>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── TAB 2: HR & PAYROLL MANAGEMENT ── */}
      {tab === 'Payroll' && (
        <div>
          {/* Month / Year Filters & Actions */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Pay Period:</span>
              <Select value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value))} style={{ width: 140 }}>
                {MONTHS.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
              </Select>
              <input type="number" value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))}
                style={{ width: 90, padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ padding: '8px 14px', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Net Payroll: </span>
                <span style={{ color: 'var(--accent)', fontWeight: 800, fontFamily: 'monospace' }}>{fmt(totalNetPayroll)}</span>
              </div>
              <button onClick={() => setShowPayrollModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0F1612', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <Plus size={15}/> Add Payroll Entry
              </button>
            </div>
          </div>

          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                    {['Employee','Designation','Basic Salary','Allowances','P.A.Y.E','S.H.A','N.S.S.F','Housing Levy','Other','Net Pay','Actions'].map(h => (
                      <th key={h} style={{ padding: '11px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center' }}><Loader size={24} color="var(--accent)" style={{ animation: 'spin 0.8s linear infinite' }}/></td></tr>
                  ) : payroll.length === 0 ? (
                    <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>No payroll records for {MONTHS[filterMonth-1]} {filterYear}. Click "Add Payroll Entry" to process.</td></tr>
                  ) : payroll.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{p.employee_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.employee_email || `EMP-${p.id}`}</div>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{p.role || 'Staff'}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{fmt(p.basic_salary)}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#10b981' }}>+{fmt(p.allowances)}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#ef4444' }}>{fmt(p.paye)}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#ef4444' }}>{fmt(p.sha)}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#ef4444' }}>{fmt(p.nssf)}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#ef4444' }}>{fmt(p.housing_levy)}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#ef4444' }}>{fmt(p.other_deductions)}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 14, fontWeight: 800, color: '#10b981' }}>{fmt(p.net_salary)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => printPayslip(p, pharmacy)} style={{ padding: '5px 8px', borderRadius: 6, border: 'none', background: '#3b82f620', color: '#3b82f6', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                            <Printer size={12}/> Print Payslip
                          </button>
                          <button onClick={() => handleDeletePayroll(p.id)} style={{ padding: '5px 8px', borderRadius: 6, border: 'none', background: '#ef444420', color: '#ef4444', cursor: 'pointer' }}>
                            <Trash2 size={12}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB 3: OPERATING EXPENSES ── */}
      {tab === 'Expenses' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
            {EXPENSE_CATEGORIES.map(cat => {
              const catData = expenseSummary.find(s => s.category === cat);
              return (
                <Card key={cat} style={{ padding: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'capitalize', fontWeight: 600 }}>{cat}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: CATEGORY_COLORS[cat], fontFamily: 'monospace' }}>
                    {fmtShort(catData?.total || 0)}
                  </div>
                </Card>
              );
            })}
          </div>

          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                    {['Date','Category','Description','Amount','Recorded By','Actions'].map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>No expenses recorded yet. Click "Record Expense" to add operational costs.</td></tr>
                  ) : expenses.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{new Date(e.expense_date).toLocaleDateString('en-KE')}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 700, textTransform: 'uppercase', background: `${CATEGORY_COLORS[e.category] || '#64748b'}20`, color: CATEGORY_COLORS[e.category] || '#64748b' }}>
                          {e.category}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{e.description}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 14, fontWeight: 800, color: '#ef4444' }}>{fmt(e.amount)}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{e.recorded_by_name || 'Admin'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <button onClick={() => handleDeleteExpense(e.id)} style={{ padding: '5px 8px', borderRadius: 6, border: 'none', background: '#ef444420', color: '#ef4444', cursor: 'pointer' }}>
                          <Trash2 size={13}/>
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

      {/* ── TAB 4: CASH FLOW ── */}
      {tab === 'Cash Flow' && cashflow && (
        <div style={{ maxWidth: 650 }}>
          <Card style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>
              📈 Operational Cash Flow — {cashflow.period?.start} to {cashflow.period?.end}
            </h3>

            {[
              { label: 'Revenue & Patient Collections (+)', value: cashflow.revenue, color: '#10b981', sign: '+' },
              { label: 'Stock Inventory Purchases (-)', value: cashflow.purchases, color: '#ef4444', sign: '-' },
              { label: 'Operating Expenses & Payroll (-)', value: cashflow.expenses, color: '#ef4444', sign: '-' },
            ].map(({ label, value, color, sign }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color }}>{sign} {fmt(value)}</span>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', marginTop: 8, borderTop: '2px solid var(--text-primary)' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Net Cash Flow Position</span>
              <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: cashflow.net_cashflow >= 0 ? '#10b981' : '#ef4444' }}>
                {fmt(cashflow.net_cashflow)}
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB 5: PROFIT & LOSS STATEMENT ── */}
      {tab === 'P&L' && pl && (
        <div style={{ maxWidth: 650 }}>
          <Card style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
                📑 Profit & Loss Statement — {pl.period?.start} to {pl.period?.end}
              </h3>
              <button onClick={() => printPLReport(pl, pharmacy)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: '#3b82f620', border: 'none', borderRadius: 6, color: '#3b82f6', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <Printer size={13} /> Print Statement
              </button>
            </div>

            {[
              { label: 'Total Operating Revenue', value: pl.revenue, color: '#10b981', bold: true },
              { label: 'Cost of Goods Sold (COGS)', value: pl.cogs, color: '#ef4444' },
              { label: 'Gross Operating Profit', value: pl.gross_profit, color: pl.gross_profit >= 0 ? '#10b981' : '#ef4444', bold: true },
              { label: 'Gross Profit Margin (%)', value: `${pl.gross_margin}%`, color: 'var(--text-muted)', isText: true },
              { label: 'Total Operating Expenses & Payroll', value: pl.expenses, color: '#ef4444' },
              { label: 'NET OPERATING PROFIT', value: pl.net_profit, color: pl.net_profit >= 0 ? '#10b981' : '#ef4444', bold: true, highlight: true },
              { label: 'Net Margin (%)', value: `${pl.net_margin}%`, color: 'var(--text-muted)', isText: true },
            ].map(({ label, value, color, bold, highlight, isText }) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', padding: highlight ? '14px 12px' : '10px 0',
                background: highlight ? 'var(--bg-elevated)' : 'transparent', borderRadius: highlight ? 8 : 0,
                borderBottom: highlight ? 'none' : '1px solid var(--border)', margin: highlight ? '8px 0' : 0
              }}>
                <span style={{ fontSize: highlight ? 14 : 13, color: bold ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: bold ? 800 : 500 }}>{label}</span>
                <span style={{ fontFamily: 'monospace', fontSize: highlight ? 16 : 14, fontWeight: bold ? 800 : 600, color }}>{isText ? value : fmt(value)}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* ── PAYROLL MODAL ── */}
      {showPayrollModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', width: '100%', maxWidth: 580, maxHeight: '92vh', overflow: 'auto' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Process Staff Payroll Entry</h3>
              <button onClick={() => setShowPayrollModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Select Existing Staff (Optional)</label>
                <Select value={payrollForm.user_id} onChange={e => handleStaffSelect(e.target.value)}>
                  <option value="">-- Manual Entry / Select Staff --</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>)}
                </Select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Input label="Employee Full Name *" value={payrollForm.employee_name} onChange={e => pf('employee_name', e.target.value)} placeholder="e.g. Dr. John Kamau" />
                <Input label="Email Address" value={payrollForm.employee_email} onChange={e => pf('employee_email', e.target.value)} placeholder="email@example.com" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <Input label="Designation / Role" value={payrollForm.role} onChange={e => pf('role', e.target.value)} placeholder="Pharmacist, Doctor..." />
                <Select label="Month" value={payrollForm.month} onChange={e => pf('month', parseInt(e.target.value))}>
                  {MONTHS.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
                </Select>
                <Input label="Year" type="number" value={payrollForm.year} onChange={e => pf('year', parseInt(e.target.value))} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'var(--bg-elevated)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                <div>
                  <Input label="Basic Salary (KES) *" type="number" value={payrollForm.basic_salary} onChange={e => {
                    pf('basic_salary', e.target.value);
                    autoCalculateKenyanDeductions(e.target.value, payrollForm.allowances);
                  }} placeholder="0.00" />
                </div>
                <div>
                  <Input label="Allowances / Bonuses (KES)" type="number" value={payrollForm.allowances} onChange={e => {
                    pf('allowances', e.target.value);
                    autoCalculateKenyanDeductions(payrollForm.basic_salary, e.target.value);
                  }} placeholder="0.00" />
                </div>
              </div>

              {/* Statutory Deductions */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Kenyan Statutory Deductions (Auto-Calculated)</span>
                  <button onClick={() => autoCalculateKenyanDeductions(payrollForm.basic_salary, payrollForm.allowances)} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calculator size={12} /> Recalculate
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Input label="P.A.Y.E Income Tax (KES)" type="number" value={payrollForm.paye} onChange={e => pf('paye', e.target.value)} />
                  <Input label="S.H.A Health (2.75%) (KES)" type="number" value={payrollForm.sha} onChange={e => pf('sha', e.target.value)} />
                  <Input label="N.S.S.F Pension (KES)" type="number" value={payrollForm.nssf} onChange={e => pf('nssf', e.target.value)} />
                  <Input label="Housing Levy (1.5%) (KES)" type="number" value={payrollForm.housing_levy} onChange={e => pf('housing_levy', e.target.value)} />
                </div>
              </div>

              <Input label="Other Loans / Advance Deductions (KES)" type="number" value={payrollForm.other_deductions} onChange={e => pf('other_deductions', e.target.value)} placeholder="0.00" />

              {/* Net Salary Preview */}
              <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--accent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Take-Home Net Salary Preview:</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: netPreview >= 0 ? '#10b981' : '#ef4444', fontFamily: 'monospace' }}>
                  {fmt(netPreview)}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button onClick={() => setShowPayrollModal(false)} style={{ flex: 1, padding: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button onClick={handleSavePayroll} disabled={saving} style={{ flex: 1, padding: 10, background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0F1612', cursor: 'pointer', fontWeight: 700 }}>
                  {saving ? 'Saving...' : 'Save & Generate Payslip'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EXPENSE MODAL ── */}
      {showExpenseModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', width: '100%', maxWidth: 450 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Record Operating Expense</h3>
              <button onClick={() => setShowExpenseModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Select label="Expense Category *" value={expenseForm.category} onChange={e => ef('category', e.target.value)}>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
              </Select>
              <Input label="Description / Voucher Reference *" value={expenseForm.description} onChange={e => ef('description', e.target.value)} placeholder="e.g. Facility Monthly Rent, Electricity Bill" />
              <Input label="Amount (KES) *" type="number" value={expenseForm.amount} onChange={e => ef('amount', e.target.value)} placeholder="0.00" />
              <Input label="Expense Date *" type="date" value={expenseForm.expense_date} onChange={e => ef('expense_date', e.target.value)} />

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button onClick={() => setShowExpenseModal(false)} style={{ flex: 1, padding: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button onClick={handleSaveExpense} disabled={saving} style={{ flex: 1, padding: 10, background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0F1612', cursor: 'pointer', fontWeight: 700 }}>
                  {saving ? 'Recording...' : 'Record Expense'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
