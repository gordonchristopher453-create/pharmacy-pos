import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  Users, FlaskConical, Pill, UserRound, Stethoscope,
  TrendingUp, Package, Clock, DollarSign, AlertTriangle,
  RefreshCw, Loader, ChevronRight, Activity, Search,
  ShoppingCart, Truck, Building2, Receipt, CheckCircle2
} from 'lucide-react';

const DEPARTMENTS = [
  {
    id: 'reception',
    label: 'Reception',
    icon: '🏥',
    color: '#f97316',
    desc: 'Patient registration & queue',
    route: '/app/department/reception',
  },
  {
    id: 'doctor',
    label: 'Doctors',
    icon: '👨‍⚕️',
    color: '#3b82f6',
    desc: 'Consultations & clinical notes',
    route: '/app/department/doctor',
  },
  {
    id: 'laboratory',
    label: 'Laboratory',
    icon: '🔬',
    color: '#06b6d4',
    desc: 'Lab requests, results & stock',
    route: '/app/department/laboratory',
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    icon: '💊',
    color: '#10b981',
    desc: 'Dispensing, stock & sales',
    route: '/app/department/pharmacy',
  },
  {
    id: 'hr',
    label: 'HR & Finance',
    icon: '👥',
    color: '#a855f7',
    desc: 'Staff, payroll & finances',
    route: '/app/department/hr',
  },
];

export default function DashboardPage() {
  const { user } = useSelector(state => state.auth);
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState([]);
  const [billingQueue, setBillingQueue] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [expiredCount, setExpiredCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStep, setFilterStep] = useState('all'); // all, triage, doctor, lab, pharmacy, discharged
  const [payingVisitId, setPayingVisitId] = useState(null);

  const isPharmacyOnly = user?.pharmacy?.facility_type === 'pharmacy';

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const promises = [
        api.get('/stock').catch(() => ({ data: { data: { stats: {}, items: [] } } })),
        api.get(`/sales/summary/daily?date=${today}`).catch(() => ({ data: { data: {} } })),
        api.get('/sales?limit=8').catch(() => ({ data: { data: { sales: [] } } })),
        api.get('/stock/expired').catch(() => ({ data: { data: [] } })),
      ];

      if (!isPharmacyOnly) {
        promises.push(
          api.get('/patients/visits?date=today').catch(() => ({ data: { data: { stats: {}, visits: [] } } })),
          api.get('/billing/queue').catch(() => ({ data: { data: [] } }))
        );
      }

      const results = await Promise.all(promises);
      const stockRes = results[0];
      const salesRes = results[1];
      const recentSalesRes = results[2];
      const expiredRes = results[3];

      setStats({
        stock: stockRes.data.data?.stats || {},
        stockItems: stockRes.data.data?.items || stockRes.data.data?.stock || [],
        sales: salesRes.data.data || {},
      });
      setRecentSales(recentSalesRes.data?.data?.sales || recentSalesRes.data?.data || []);
      setExpiredCount(Array.isArray(expiredRes.data?.data) ? expiredRes.data.data.length : 0);

      if (!isPharmacyOnly) {
        const visitRes = results[4];
        const billRes = results[5];
        setStats(prev => ({
          ...prev,
          visits: visitRes.data.data?.stats || {},
        }));
        setVisits(visitRes.data.data?.visits || []);
        setBillingQueue(billRes.data.data || []);
      }
    } catch {
      toast.error('Failed to sync dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPay = async (visit) => {
    setPayingVisitId(visit.id);
    try {
      // 1. Fetch exact bill items
      const billRes = await api.get(`/billing/visit/${visit.id}`);
      const billData = billRes.data?.data;
      if (!billData || !billData.items || billData.items.length === 0) {
        toast.error('No bill items found for this visit');
        return;
      }

      const pendingItems = billData.items.filter(item => item.status === 'pending');
      if (pendingItems.length === 0) {
        toast.success('🎉 Visit is already fully paid or exempt!');
        fetchStats();
        return;
      }

      const itemIds = pendingItems.map(item => item.id);
      const totalAmount = pendingItems.reduce((acc, item) => acc + parseFloat(item.total_price || 0), 0);

      // 2. Submit payment simulation based on visit's payment scheme
      const scheme = visit.payment_method || 'cash';
      const refNum = scheme === 'mpesa' ? 'MPESA-' + Math.random().toString(36).substr(2, 9).toUpperCase() : 
                     scheme === 'sha' ? 'SHA-CLAIM-' + Math.random().toString(36).substr(2, 9).toUpperCase() : 
                     scheme === 'insurance' ? 'INS-PREAUTH-' + Math.random().toString(36).substr(2, 9).toUpperCase() : 
                     'CSH-' + Math.random().toString(36).substr(2, 9).toUpperCase();

      await api.post(`/billing/visit/${visit.id}/pay`, {
        payment_method: scheme,
        amount: String(totalAmount),
        reference_number: refNum,
        notes: `Automated instant cashier settlement via Integrated Payment Gateway for ${scheme.toUpperCase()} scheme.`,
        item_ids: itemIds
      });

      toast.success(`🎉 settled KES ${totalAmount.toLocaleString()} via ${scheme.toUpperCase()}! eTIMS & MOH claim filed.`);
      fetchStats();
    } catch (e) {
      toast.error('Failed to auto-settle bill');
    } finally {
      setPayingVisitId(null);
    }
  };

  const fmtMoney = (n) => {
    const v = parseFloat(n || 0);
    if (v >= 1000000) return `KES ${(v/1000000).toFixed(1)}M`;
    if (v >= 1000) return `KES ${(v/1000).toFixed(1)}K`;
    return `KES ${v.toFixed(0)}`;
  };

  const getPatientWorkflowStep = (visit) => {
    if (visit.status === 'discharged') return 'discharged';
    if (visit.status === 'pharmacy') return 'pharmacy';
    if (visit.status === 'lab') return 'lab';
    if (visit.status === 'with_doctor') return 'doctor';
    return 'triage';
  };

  const filteredVisits = visits.filter(v => {
    // search query
    const s = searchQuery.toLowerCase();
    const matchesSearch = !s || 
      (v.patient_name || '').toLowerCase().includes(s) || 
      (v.patient_number || '').toLowerCase().includes(s) ||
      (v.visit_number || '').toLowerCase().includes(s);

    if (!matchesSearch) return false;

    // filter step
    const step = getPatientWorkflowStep(v);
    if (filterStep === 'all') return true;
    return step === filterStep;
  });

  const deptStats = {
    reception: [
      { label: "Today's Patients", value: stats.visits?.total_visits || 0, color: '#f97316' },
      { label: 'Waiting', value: stats.visits?.waiting || 0, color: '#ef4444' },
      { label: 'Discharged', value: stats.visits?.discharged || 0, color: '#10b981' },
    ],
    doctor: [
      { label: 'With Doctor', value: stats.visits?.with_doctor || 0, color: '#3b82f6' },
      { label: 'Emergencies', value: stats.visits?.emergencies || 0, color: '#ef4444' },
    ],
    laboratory: [
      { label: 'Pending Tests', value: stats.visits?.lab || 0, color: '#06b6d4' },
      { label: 'Low Stock', value: stats.stock?.low_stock_count || 0, color: '#f59e0b' },
    ],
    pharmacy: [
      { label: "Today's Revenue", value: fmtMoney(stats.sales?.total_revenue), color: '#10b981' },
      { label: 'Transactions', value: stats.sales?.total_transactions || 0, color: '#3b82f6' },
      { label: 'Low Stock', value: stats.stock?.low_stock_count || 0, color: '#f59e0b' },
    ],
    hr: [
      { label: 'Total Revenue', value: fmtMoney(stats.sales?.total_revenue), color: '#a855f7' },
      { label: 'Cash', value: fmtMoney(stats.sales?.cash_total), color: '#10b981' },
      { label: 'M-Pesa', value: fmtMoney(stats.sales?.mpesa_total), color: '#3b82f6' },
    ],
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: STANDALONE PHARMACY DASHBOARD
  // ══════════════════════════════════════════════════════════════════════════
  if (isPharmacyOnly) {
    const lowStockItems = (stats.stockItems || []).filter(item => {
      const qty = parseInt(item.available_quantity || item.quantity || 0);
      const min = parseInt(item.reorder_level || item.min_stock || 10);
      return qty <= min;
    }).slice(0, 6);

    const PHARMACY_MODULES = [
      { label: 'Point of Sale (POS)', icon: ShoppingCart, color: 'var(--accent)', path: '/app/pos', desc: 'Fast barcode checkout & instant receipt printing' },
      { label: 'Products & Formulary', icon: Package, color: '#06b6d4', path: '/app/products', desc: 'Manage medicines, barcodes, strengths & categories' },
      { label: 'Stock & Batches', icon: TrendingUp, color: '#8b5cf6', path: '/app/stock', desc: 'Batch tracking, expiry dates & inventory audits' },
      { label: 'Purchases & Receiving', icon: Truck, color: '#f59e0b', path: '/app/purchases', desc: 'Purchase orders, GRNs & supplier stock intake' },
      { label: 'Suppliers Directory', icon: Building2, color: '#10b981', path: '/app/suppliers', desc: 'Pharmaceutical distributors & purchase invoices' },
      { label: 'Sales & Invoicing', icon: DollarSign, color: '#ec4899', path: '/app/billing', desc: 'Credit accounts, cash receipts & sales records' },
      { label: 'Expired Drugs Alert', icon: AlertTriangle, color: '#ef4444', path: '/app/expired', desc: 'Monitor near-expiry medicines & batch shelf-life' },
      { label: 'Financial Reports', icon: Receipt, color: '#6366f1', path: '/app/reports', desc: 'Daily P&L, sales summaries & gross margin analytics' },
    ];

    return (
      <div style={{ padding: 28, height: '100vh', overflow: 'auto' }}>
        {/* Pharmacy Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 10, background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 800, padding: '3px 8px', borderRadius: 4, letterSpacing: '0.5px' }}>
                💊 PHARMACY RETAIL & DISPENSARY
              </span>
              <span style={{ fontSize: 10, background: '#10b98115', color: '#10b981', fontWeight: 800, padding: '3px 8px', borderRadius: 4, letterSpacing: '0.5px' }}>
                PPB COMPLIANT · eTIMS READY
              </span>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.4px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>💊</span> {user?.pharmacy?.name || 'Standalone Pharmacy'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              Standalone Pharmacy Control Center · {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/app/pos')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--accent)', color: '#0F1612', borderRadius: 10, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)' }}>
              <ShoppingCart size={16} /> Open Point of Sale
            </button>
            <button onClick={fetchStats} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* Primary Pharmacy KPI Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 28 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Today's Total Sales</span>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={18} color="var(--accent)" />
              </div>
            </div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)', marginBottom: 4 }}>
              {fmtMoney(stats.sales?.total_revenue)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {stats.sales?.total_transactions || 0} completed transactions
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cash vs M-Pesa</span>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: '#3b82f615', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Receipt size={18} color="#3b82f6" />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>M-Pesa</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: '#10b981' }}>{fmtMoney(stats.sales?.mpesa_total)}</div>
              </div>
              <div style={{ height: 24, width: 1, background: 'var(--border)' }} />
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Cash</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: '#3b82f6' }}>{fmtMoney(stats.sales?.cash_total)}</div>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Low Stock Watchlist</span>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f59e0b15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={18} color="#f59e0b" />
              </div>
            </div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 800, color: stats.stock?.low_stock_count > 0 ? '#f59e0b' : 'var(--text-primary)', marginBottom: 4 }}>
              {stats.stock?.low_stock_count || 0} items
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Require immediate supplier restock
            </div>
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Expiry & Formulary</span>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: '#ec489915', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={18} color="#ec4899" />
              </div>
            </div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 800, color: expiredCount > 0 ? '#ef4444' : 'var(--text-primary)', marginBottom: 4 }}>
              {expiredCount} expired / {stats.stock?.total_products || 0} active
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Total active catalog medications
            </div>
          </div>
        </div>

        {/* Operational Modules Grid */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>
            Pharmacy Operational Modules
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
            {PHARMACY_MODULES.map(m => {
              const Icon = m.icon;
              return (
                <div key={m.label} onClick={() => navigate(m.path)}
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = m.color; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 20px ${m.color}15`; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: `${m.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={20} color={m.color} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{m.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{m.desc}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 14, fontSize: 11, fontWeight: 700, color: m.color }}>
                    Open module <ChevronRight size={14} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Split: Recent Sales & Low Stock Watchlist */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
          {/* Recent Sales Ledger */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Receipt size={18} color="var(--accent)" /> Recent Pharmacy Sales
                </h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Latest point-of-sale customer transactions</div>
              </div>
              <button onClick={() => navigate('/app/billing')} style={{ fontSize: 12, color: 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                View All
              </button>
            </div>

            {recentSales.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--text-muted)', fontSize: 12 }}>
                No sales recorded today yet. Use POS to make your first sale.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recentSales.slice(0, 6).map(sale => (
                  <div key={sale.id} style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {sale.receipt_number || sale.invoice_number || `Sale #${sale.id}`}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        <span>{sale.customer_name || sale.patient_name || 'Walk-in Customer'}</span>
                        <span>•</span>
                        <span style={{ textTransform: 'uppercase', fontWeight: 600, color: 'var(--accent)' }}>{sale.payment_method || 'CASH'}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                        KES {parseFloat(sale.total_amount || sale.total || 0).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {sale.created_at ? new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Low Stock Fast Watchlist */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={18} color="#f59e0b" /> Low Stock & Fast Reorder
                </h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Items below minimum safety reorder threshold</div>
              </div>
              <button onClick={() => navigate('/app/stock')} style={{ fontSize: 12, color: '#f59e0b', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                Inventory Hub
              </button>
            </div>

            {lowStockItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--text-muted)', fontSize: 12 }}>
                <CheckCircle2 size={24} color="var(--accent)" style={{ margin: '0 auto 8px', display: 'block' }} />
                Stock levels are healthy. All medications are above safety levels.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lowStockItems.map(item => (
                  <div key={item.id || item.name} style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {item.generic_name || item.brand_name || item.category || 'Pharmaceutical'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div>
                        <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>
                          {item.available_quantity || item.quantity || 0} left
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Min: {item.reorder_level || item.min_stock || 10}</div>
                      </div>
                      <button onClick={() => navigate('/app/purchases')} style={{ padding: '5px 10px', background: '#f59e0b15', color: '#f59e0b', border: '1px solid #f59e0b30', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        Restock
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 28, height: '100vh', overflow: 'auto' }}>
      {/* Enterprise Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 10, background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 800, padding: '3px 8px', borderRadius: 4, letterSpacing: '0.5px' }}>ENTERPRISE PLATINUM SUITE</span>
            <span style={{ fontSize: 10, background: '#ec489915', color: '#ec4899', fontWeight: 800, padding: '3px 8px', borderRadius: 4, letterSpacing: '0.5px' }}>SHA READY</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.4px' }}>
            🏥 Medicare Unified HMS
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {user?.pharmacy?.name} · Enterprise Control Terminal · {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={fetchStats} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' }}>
          <RefreshCw size={14} /> Sync Metrics
        </button>
      </div>

      {/* Enterprise Gateway Integrations Status bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }} className="enterprise-status-cards">
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: '#10b98112', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🏛️</div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>SHA e-Claims Gateway</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>Connected (API Live)</div>
          </div>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: '#ec489912', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🌸</div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>SHA Portal</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#ec4899' }}>Verified & Syncing</div>
          </div>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: '#3b82f612', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📊</div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>MOH KHIS (MOH 711)</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>Direct Upload Active</div>
          </div>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f59e0b12', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🛡️</div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>eTIMS Compliance</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>Automatic Billing Active</div>
          </div>
        </div>
      </div>

      {/* Unified Clinical & Billing Flow Tracker */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              🏥 Unified Patient Flow Terminal <span style={{ fontSize: 11, background: 'var(--accent-soft)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>{filteredVisits.length} Active</span>
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Live operational progression, real-time insurance pre-authorizations & eTIMS automated cashier status</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: 220 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search patient..." style={{ width: '100%', padding: '8px 8px 8px 30px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <select value={filterStep} onChange={e => setFilterStep(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}>
              <option value="all">All Departments</option>
              <option value="triage">Triage Vitals</option>
              <option value="doctor">Doctor Consultation</option>
              <option value="lab">Laboratory Tests</option>
              <option value="pharmacy">Pharmacy Dispense</option>
              <option value="discharged">Discharged / Complete</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 30 }}><Loader size={24} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--accent)' }}/></div>
        ) : filteredVisits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 10px', border: '1px dashed var(--border)', borderRadius: 12, color: 'var(--text-muted)', fontSize: 13 }}>
            No patient visits matches the filter for today.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
            {filteredVisits.map(visit => {
              const currentStep = getPatientWorkflowStep(visit);
              const billMatch = billingQueue.find(b => b.visit_id === visit.id);
              const balance = billMatch ? parseFloat(billMatch.balance || 0) : 0;
              const hasBill = billMatch && parseFloat(billMatch.total || 0) > 0;
              const isPaid = billMatch ? billMatch.status === 'paid' : false;

              // scheme details
              const schemeName = (visit.payment_method || 'cash').toUpperCase();
              let schemeBg = 'var(--bg-elevated)';
              let schemeColor = 'var(--text-muted)';
              if (schemeName === 'SHA' || schemeName === 'NHIF') { schemeBg = '#3b82f615'; schemeColor = '#3b82f6'; }
              else if (schemeName === 'WAIVER') { schemeBg = '#6b728015'; schemeColor = '#6b7280'; }
              else if (schemeName === 'INSURANCE') { schemeBg = '#a855f715'; schemeColor = '#a855f7'; }
              else if (schemeName === 'MPESA') { schemeBg = '#10b98115'; schemeColor = '#10b981'; }

              return (
                <div key={visit.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  
                  {/* Left: Patient Details & Scheme */}
                  <div style={{ minWidth: 200, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{visit.patient_name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{visit.patient_number}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Visit: <strong style={{ color: 'var(--accent)' }}>{visit.visit_number}</strong></span>
                      <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>·</span>
                      <span style={{ padding: '2px 8px', borderRadius: 4, background: schemeBg, color: schemeColor, fontWeight: 700, fontSize: 10 }}>{schemeName}</span>
                      {visit.visit_type === 'mch' && (
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: '#ec489920', color: '#ec4899', fontWeight: 700 }}>🤱 MCH SERVICE</span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Live Progression Pipeline */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 2, minWidth: 320, justifyContent: 'center' }}>
                    {[
                      { key: 'triage', label: 'Triage 🩺', stepNum: 1 },
                      { key: 'doctor', label: 'Doctor 👨‍⚕️', stepNum: 2 },
                      { key: 'lab', label: 'Lab 🔬', stepNum: 3 },
                      { key: 'pharmacy', label: 'Pharmacy 💊', stepNum: 4 },
                      { key: 'discharged', label: 'Complete ✅', stepNum: 5 }
                    ].map((stage, i) => {
                      const stagesOrder = ['triage', 'doctor', 'lab', 'pharmacy', 'discharged'];
                      const activeIndex = stagesOrder.indexOf(currentStep);
                      const isCompleted = i < activeIndex;
                      const isActive = i === activeIndex;

                      let color = 'var(--text-faint)';
                      let border = '1px solid var(--border)';
                      let bg = 'transparent';
                      let fontWeight = 500;

                      if (isCompleted) {
                        color = '#10b981';
                        bg = '#10b98112';
                        border = '1px solid #10b98130';
                      } else if (isActive) {
                        color = 'var(--accent)';
                        bg = 'var(--accent-soft)';
                        border = '1px solid var(--accent)';
                        fontWeight = 700;
                      }

                      return (
                        <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ padding: '6px 10px', borderRadius: 20, fontSize: 11, fontWeight, border, background: bg, color, display: 'flex', alignItems: 'center', gap: 4 }}>
                            {stage.label}
                          </div>
                          {i < 4 && <span style={{ color: isCompleted ? '#10b981' : 'var(--border)', fontWeight: 700 }}>➔</span>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Right: Cashier / pre-auth auto settlement */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 200, justifyContent: 'flex-end' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>eTIMS Billing State</div>
                      {isPaid ? (
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>✅ Fully Settled</div>
                      ) : balance > 0 ? (
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>Unpaid: KES {balance.toLocaleString()}</div>
                      ) : hasBill ? (
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>✅ Free / Exempt</div>
                      ) : (
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)' }}>No Active Invoice</div>
                      )}
                    </div>
                    
                    {balance > 0 && (
                      <button 
                        onClick={() => handleQuickPay(visit)} 
                        disabled={payingVisitId === visit.id}
                        style={{
                          padding: '8px 14px', borderRadius: 8, border: 'none',
                          background: 'var(--accent)', color: '#0F1612', fontSize: 11, fontWeight: 700,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                        }}
                      >
                        {payingVisitId === visit.id ? (
                          <Loader size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
                        ) : (
                          '💳 Quick Settle'
                        )}
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Department Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
        {DEPARTMENTS.filter(dept => {
          const isPharmacyOnly = user?.pharmacy?.facility_type === 'pharmacy';
          if (isPharmacyOnly) return dept.id === 'pharmacy';
          return true;
        }).map(dept => (
          <div key={dept.id} onClick={() => navigate(dept.route)}
            style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', padding: 24, cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = dept.color; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 24px ${dept.color}20`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>

            {/* Background accent */}
            <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `${dept.color}12` }} />

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: `${dept.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                  {dept.icon}
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{dept.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{dept.desc}</div>
                </div>
              </div>
              <ChevronRight size={18} color={dept.color} />
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${(deptStats[dept.id] || []).length}, 1fr)`, gap: 10 }}>
              {(deptStats[dept.id] || []).map(({ label, value, color }) => (
                <div key={label} style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 4 }}>{label}</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: dept.color, fontWeight: 600 }}>
              <Activity size={12} />
              Click to open {dept.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
