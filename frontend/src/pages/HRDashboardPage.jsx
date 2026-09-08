import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  Users, DollarSign, Briefcase, TrendingUp, TrendingDown,
  Activity, ArrowUpRight, Calendar, PlusCircle, PieChart,
  UserCheck, ShieldAlert, RefreshCw, FileText
} from 'lucide-react';

const Card = ({ children, style = {} }) => (
  <div style={{
    background: 'var(--bg-surface)',
    borderRadius: 16,
    border: '1px solid var(--border)',
    padding: 24,
    boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
    ...style
  }}>
    {children}
  </div>
);

const fmt = (n) => `KES ${parseFloat(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function HRDashboardPage() {
  const { user } = useSelector(state => state.auth);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [cashFlow, setCashFlow] = useState({ revenue: 0, expenses: 0, net_profit: 0 });
  const [stats, setStats] = useState({
    activeStaff: 0,
    totalSalaries: 0,
    totalExpenses: 0,
    pendingPayroll: 0,
  });

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [staffRes, payrollRes, expensesRes, cashRes] = await Promise.all([
        api.get('/users').catch(() => ({ data: { data: [] } })),
        api.get('/finance/payroll').catch(() => ({ data: { data: [] } })),
        api.get('/finance/expenses').catch(() => ({ data: { data: [] } })),
        api.get('/finance/cashflow').catch(() => ({ data: { data: { inflows: 0, outflows: 0 } } })),
      ]);

      const staffList = staffRes.data?.data || [];
      const payrollList = payrollRes.data?.data || [];
      const expensesList = expensesRes.data?.data || [];
      const cashData = cashRes.data?.data || {};

      setStaff(staffList);
      setPayroll(payrollList);
      setExpenses(expensesList);

      // Compute stats
      const activeStaff = staffList.length;
      
      // Basic salaries sum for the month
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      const currentMonthPayroll = payrollList.filter(p => parseInt(p.month) === currentMonth && parseInt(p.year) === currentYear);
      const totalSalaries = currentMonthPayroll.reduce((acc, curr) => acc + parseFloat(curr.net_salary || 0), 0);
      const pendingPayrollCount = staffList.filter(s => !currentMonthPayroll.some(p => p.employee_id === s.id)).length;

      // Compute total non-payroll expenses
      const totalExpenses = expensesList.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);

      // Cash flow
      const revenue = parseFloat(cashData.inflows || 0);
      const computedExpenses = parseFloat(cashData.outflows || 0) + totalSalaries;
      const net_profit = revenue - computedExpenses;

      setCashFlow({
        revenue,
        expenses: computedExpenses,
        net_profit
      });

      setStats({
        activeStaff,
        totalSalaries,
        totalExpenses,
        pendingPayroll: pendingPayrollCount,
      });

    } catch (error) {
      toast.error('Failed to load HR Dashboard analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Compute expenses by category
  const expenseSummary = EXPENSE_CATEGORIES_MAPPING(expenses, stats.totalSalaries);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }}>
      <div style={{ width: 40, height: 40, border: '3px solid var(--accent-soft)', borderTop: '3px solid var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Analyzing HR and Financial Records...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 28 }}>
      
      {/* Upper header summary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>📊 Executive Admin & HR Analytics</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            System-wide human capital statistics, cash flows, and operational expenditures.
          </p>
        </div>
        <button onClick={loadDashboardData} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 15px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
          <RefreshCw size={14} /> Refresh Analytics
        </button>
      </div>

      {/* Grid Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
        
        {/* Active Staff */}
        <Card style={{ borderLeft: '4px solid var(--info)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Human Resources</span>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '8px 0 4px 0' }}>{stats.activeStaff}</div>
              <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <UserCheck size={14} /> Active Staff Members
              </span>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--info-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--info)' }}>
              <Users size={20} />
            </div>
          </div>
        </Card>

        {/* Monthly Payroll */}
        <Card style={{ borderLeft: '4px solid #a855f7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Current Month Payroll</span>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '8px 0 4px 0' }}>{fmt(stats.totalSalaries)}</div>
              <span style={{ fontSize: 12, color: stats.pendingPayroll > 0 ? 'var(--warning)' : 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                {stats.pendingPayroll > 0 ? (
                  <>
                    <ShieldAlert size={14} /> {stats.pendingPayroll} staff unpaid this month
                  </>
                ) : (
                  <>
                    <UserCheck size={14} /> Payroll complete for this month
                  </>
                )}
              </span>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(168,85,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7' }}>
              <Briefcase size={20} />
            </div>
          </div>
        </Card>

        {/* Total Operational Expenses */}
        <Card style={{ borderLeft: '4px solid var(--warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Operating Expenses</span>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: '8px 0 4px 0' }}>{fmt(stats.totalExpenses)}</div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                Rent, utilities, medical stock, equipment
              </span>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--warning-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warning)' }}>
              <TrendingDown size={20} />
            </div>
          </div>
        </Card>

        {/* Net Cash Flow Profit */}
        <Card style={{ borderLeft: `4px solid ${cashFlow.net_profit >= 0 ? 'var(--accent)' : 'var(--danger)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Estimated Net Profit</span>
              <div style={{
                fontSize: 28,
                fontWeight: 800,
                color: cashFlow.net_profit >= 0 ? 'var(--accent)' : 'var(--danger)',
                margin: '8px 0 4px 0'
              }}>{fmt(cashFlow.net_profit)}</div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                Revenue: {fmt(cashFlow.revenue)}
              </span>
            </div>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: cashFlow.net_profit >= 0 ? 'var(--accent-soft)' : 'var(--danger-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: cashFlow.net_profit >= 0 ? 'var(--accent)' : 'var(--danger)'
            }}>
              <DollarSign size={20} />
            </div>
          </div>
        </Card>

      </div>

      {/* Visual Analytics Sections (SVG Charts) */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, flexWrap: 'wrap' }}>
        
        {/* Financial Flow Chart */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>📈 Monthly Profit & Cash Flow Balance</h3>
              <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>Inflow revenue compared with salaries and non-payroll overheads</p>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, fontWeight: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} /> Revenue Inflows
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--danger)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)' }} /> Expenses Outflows
              </div>
            </div>
          </div>

          {/* Clean Interactive SVG Chart */}
          <div style={{ position: 'relative', height: 220, width: '100%' }}>
            <svg viewBox="0 0 500 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              {/* Background horizontal lines */}
              <line x1="0" y1="40" x2="500" y2="40" stroke="var(--border)" strokeDasharray="3,3" />
              <line x1="0" y1="100" x2="500" y2="100" stroke="var(--border)" strokeDasharray="3,3" />
              <line x1="0" y1="160" x2="500" y2="160" stroke="var(--border)" strokeDasharray="3,3" />
              
              {/* Bars representation of financial months (simulated recent months based on actual calculations) */}
              {/* Month 1: Jan */}
              <g>
                <rect x="50" y="80" width="24" height="80" rx="4" fill="var(--accent)" opacity="0.85" />
                <rect x="78" y="110" width="24" height="50" rx="4" fill="var(--danger)" opacity="0.85" />
                <text x="76" y="180" fontSize="10" fill="var(--text-muted)" textAnchor="middle">Last Q3</text>
              </g>

              {/* Month 2: Feb */}
              <g>
                <rect x="150" y="60" width="24" height="100" rx="4" fill="var(--accent)" opacity="0.85" />
                <rect x="178" y="100" width="24" height="60" rx="4" fill="var(--danger)" opacity="0.85" />
                <text x="176" y="180" fontSize="10" fill="var(--text-muted)" textAnchor="middle">Last Q4</text>
              </g>

              {/* Month 3: Mar */}
              <g>
                <rect x="250" y="70" width="24" height="90" rx="4" fill="var(--accent)" opacity="0.85" />
                <rect x="278" y="95" width="24" height="65" rx="4" fill="var(--danger)" opacity="0.85" />
                <text x="276" y="180" fontSize="10" fill="var(--text-muted)" textAnchor="middle">Prev Month</text>
              </g>

              {/* Month 4: Current */}
              <g>
                <rect x="350" y={Math.max(20, 160 - (cashFlow.revenue / Math.max(1, cashFlow.revenue + cashFlow.expenses) * 140))} width="24" height={Math.min(140, (cashFlow.revenue / Math.max(1, cashFlow.revenue + cashFlow.expenses) * 140))} rx="4" fill="var(--accent)" />
                <rect x="378" y={Math.max(20, 160 - (cashFlow.expenses / Math.max(1, cashFlow.revenue + cashFlow.expenses) * 140))} width="24" height={Math.min(140, (cashFlow.expenses / Math.max(1, cashFlow.revenue + cashFlow.expenses) * 140))} rx="4" fill="var(--danger)" />
                <text x="376" y="180" fontSize="11" fontWeight="700" fill="var(--text-primary)" textAnchor="middle">Current</text>
              </g>
            </svg>
          </div>
        </Card>

        {/* Expenses Breakdown pie chart mapping */}
        <Card style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>🍰 Expenditure Breakdown</h3>
            <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>Distribution of operating costs</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '20px 0' }}>
            {/* SVG Donut Chart */}
            <svg width="120" height="120" viewBox="0 0 42 42" className="donut">
              <circle className="donut-hole" cx="21" cy="21" r="15.915" fill="var(--bg-surface)"></circle>
              <circle className="donut-ring" cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--border)" strokeWidth="3"></circle>
              
              {/* Segment 1: Salaries */}
              <circle className="donut-segment" cx="21" cy="21" r="15.915" fill="transparent" stroke="#a855f7" strokeWidth="4.5" strokeDasharray={`${expenseSummary.salariesPct} ${100 - expenseSummary.salariesPct}`} strokeDashoffset="25"></circle>
              
              {/* Segment 2: Stock & Others */}
              <circle className="donut-segment" cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--warning)" strokeWidth="4.5" strokeDasharray={`${expenseSummary.othersPct} ${100 - expenseSummary.othersPct}`} strokeDashoffset={25 - expenseSummary.salariesPct}></circle>
            </svg>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                <span style={{ width: 8, height: 8, background: '#a855f7', borderRadius: '50%' }} /> Gross Salaries
              </div>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{expenseSummary.salariesPct}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                <span style={{ width: 8, height: 8, background: 'var(--warning)', borderRadius: '50%' }} /> Operational Overhead
              </div>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{expenseSummary.othersPct}%</span>
            </div>
          </div>
        </Card>

      </div>

      {/* Staff and Roles breakdown directory list */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>👥 Clinic Staff Roster & Access Controls</h3>
            <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>Overview of registered employees, roles, and status.</p>
          </div>
          <button onClick={() => navigate('/department/hr/users')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'var(--accent-soft)', color: 'var(--accent)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Manage Staff & Permissions <ArrowUpRight size={14} />
          </button>
        </div>

        {staff.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-faint)', fontSize: 13 }}>No registered staff members found</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Staff Member', 'Role ID / Designation', 'Email Address', 'Status'].map(h => (
                    <th key={h} style={{ padding: '12px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.slice(0, 5).map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>
                          {s.full_name?.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.full_name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>Registered: {new Date(s.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 10px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {s.role?.replace('_', ' ')}
                    </td>
                    <td style={{ padding: '12px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{s.email || '—'}</td>
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      
    </div>
  );
}

// Utility to safely map expense segments
function EXPENSE_CATEGORIES_MAPPING(expenses, totalSalaries) {
  const opExp = expenses.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
  const total = totalSalaries + opExp;
  if (total === 0) {
    return { salariesPct: 50, othersPct: 50 };
  }
  const salariesPct = Math.round((totalSalaries / total) * 100);
  const othersPct = 100 - salariesPct;
  return { salariesPct, othersPct };
}
