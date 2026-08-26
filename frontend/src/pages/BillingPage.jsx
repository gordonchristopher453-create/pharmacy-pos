import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api';
import toast from 'react-hot-toast';
import { printBillingReceipt } from '../utils/printBillingReceipt';
import { printCombinedPatientReceipt } from '../utils/printCombinedPatientReceipt';
import { printMedicalInvoice } from '../utils/printMedicalInvoice';
import { 
  Loader, RefreshCw, Search, Plus, X, Printer, DollarSign, CheckCircle, 
  TrendingUp, Smartphone, Shield, CreditCard, AlertCircle, FileText, 
  Receipt, ArrowUpRight, Wallet, PieChart, Users, Calendar, Building
} from 'lucide-react';

const Card = ({ children, style = {}, ...props }) => (
  <div style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)', ...style }} {...props}>{children}</div>
);

const Btn = ({ children, variant = 'primary', size = 'md', ...props }) => (
  <button {...props} style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: size === 'sm' ? '6px 12px' : '9px 16px',
    background: variant === 'primary' ? 'var(--accent)' : variant === 'danger' ? '#ef4444' : variant === 'success' ? '#10b981' : 'var(--bg-elevated)',
    border: variant === 'ghost' ? '1px solid var(--border)' : 'none', borderRadius: 8,
    color: variant === 'primary' || variant === 'success' ? '#0F1612' : variant === 'danger' ? '#fff' : 'var(--text-primary)',
    fontSize: size === 'sm' ? 11 : 13, fontWeight: 600, cursor: props.disabled ? 'not-allowed' : 'pointer',
    opacity: props.disabled ? 0.6 : 1, fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s ease', ...props.style
  }}>{children}</button>
);

const inp = { 
  width: '100%', 
  padding: '9px 12px', 
  background: '#1A2420', 
  border: '1px solid var(--border)', 
  borderRadius: 8, 
  color: '#E8F5F0', 
  fontSize: 13, 
  outline: 'none', 
  boxSizing: 'border-box', 
  fontFamily: 'DM Sans, sans-serif' 
};

const selectStyle = {
  ...inp,
  backgroundColor: '#1A2420',
  color: '#E8F5F0',
  cursor: 'pointer'
};

const STATUS_COLORS = { pending: '#ef4444', partial: '#f59e0b', paid: '#10b981', waived: '#6b7280', insurance: '#3b82f6', sha: '#8b5cf6' };
const ITEM_TYPES = ['consultation', 'opd', 'laboratory', 'radiology', 'procedure', 'drug', 'injection', 'admission', 'bed_charge', 'other'];
const PAYMENT_METHODS = [
  { value: 'cash', label: '💵 Cash' },
  { value: 'mpesa', label: '📱 M-Pesa' },
  { value: 'insurance', label: '🛡️ Private Insurance' },
  { value: 'sha', label: '🏥 SHA (Social Health Authority)' },
  { value: 'bank', label: '🏦 Bank Transfer / Card' },
  { value: 'corporate', label: '🏢 Corporate Billing' }
];

export default function BillingPage() {
  const { user } = useSelector(s => s.auth);
  const [tab, setTab] = useState('dashboard'); // 'dashboard' | 'queue' | 'history'
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [bill, setBill] = useState(null);
  const [billLoading, setBillLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [byType, setByType] = useState([]);
  const [byMethod, setByMethod] = useState([]);
  const [recentTx, setRecentTx] = useState([]);
  const [saving, setSaving] = useState(false);

  // Date filters - default queue to Today
  const today = new Date().toISOString().split('T')[0];
  const [queueDateFrom, setQueueDateFrom] = useState(today);
  const [queueDateTo, setQueueDateTo] = useState(today);
  const [queueDate, setQueueDate] = useState(today);
  const [histDateFrom, setHistDateFrom] = useState(today);
  const [histDateTo, setHistDateTo] = useState(today);
  const [histSearch, setHistSearch] = useState('');
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  // Add item form
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemForm, setItemForm] = useState({ item_type: 'consultation', description: '', quantity: 1, unit_price: '' });

  // Payment form
  const [showPayment, setShowPayment] = useState(false);
  const [payForm, setPayForm] = useState({ 
    payment_method: 'cash', 
    amount: '', 
    reference_number: '', 
    notes: '',
    insurance_provider: 'SHA / Social Health Authority',
    member_number: '',
    auth_code: '',
    copay_amount: ''
  });
  const [selectedBillItems, setSelectedBillItems] = useState([]);

  // Inpatient Folder
  const [inpatientFolder, setInpatientFolder] = useState([]);
  const [inpatientLoading, setInpatientLoading] = useState(false);
  const [inpatientStatusFilter, setInpatientStatusFilter] = useState('all');

  useEffect(() => { 
    fetchSummary(); 
    fetchQueue(); 
  }, [queueDateFrom, queueDateTo]);

  const fetchInpatientFolder = async () => {
    setInpatientLoading(true);
    try {
      const res = await api.get('/billing/inpatient-folder', { params: { status: inpatientStatusFilter, search } });
      setInpatientFolder(res.data.data || []);
    } catch { toast.error('Failed to load inpatient bills'); }
    finally { setInpatientLoading(false); }
  };

  useEffect(() => { 
    if (tab === 'history') {
      fetchHistory();
    }
    if (tab === 'inpatient') {
      fetchInpatientFolder();
    }
  }, [tab, histDateFrom, histDateTo, inpatientStatusFilter, search]);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const params = {
        date_from: queueDateFrom || today,
        date_to: queueDateTo || queueDateFrom || today
      };
      const res = await api.get('/billing/queue', { params });
      setQueue(res.data.data || []);
    } catch { toast.error('Failed to load billing queue'); }
    finally { setLoading(false); }
  };

  const fetchSummary = async () => {
    try {
      const res = await api.get('/billing/daily-summary', { params: { date: queueDateFrom || today } });
      setSummary(res.data.data?.summary || {});
      setByType(res.data.data?.by_type || []);
      setByMethod(res.data.data?.by_method || []);
      setRecentTx(res.data.data?.recent_transactions || []);
    } catch {}
  };

  const fetchHistory = async () => {
    setHistLoading(true);
    try {
      const dFrom = histDateFrom || today;
      const dTo = histDateTo || today;
      const params = { date_from: dFrom, date_to: dTo };
      if (histSearch) params.search = histSearch;
      const res = await api.get('/billing/patient-history', { params });
      setHistory(res.data.data || []);
    } catch { toast.error('Failed to load billing history'); }
    finally { setHistLoading(false); }
  };

  const openBill = async (visit) => {
    setBillLoading(true);
    try {
      const vid = visit.visit_id || visit.id;
      const res = await api.get('/billing/visit/' + vid);
      const billData = res.data.data || null;
      setBill(billData);
      setSelectedVisit({
        ...visit,
        total_billed: billData?.total,
        total_paid: billData?.paid,
        total_waived: billData?.waived,
        balance: billData?.balance,
        fee_paid: (billData?.balance || 0) <= 0
      });
    } catch { toast.error('Failed to load bill'); }
    finally { setBillLoading(false); }
  };

  const payBill = async () => {
    setSaving(true);
    try {
      const vid = selectedVisit.visit_id || selectedVisit.id;
      await api.post('/billing/visit/' + vid + '/pay', { ...payForm, item_ids: selectedBillItems });
      toast.success('Payment recorded successfully');
      setShowPayment(false);
      await openBill(selectedVisit);
      fetchQueue();
      fetchSummary();
      if (tab === 'history') fetchHistory();
      if (tab === 'inpatient') fetchInpatientFolder();
    } catch (e) { 
      toast.error(e.response?.data?.message || 'Payment failed'); 
    }
    finally { setSaving(false); }
  };

  const addItem = async () => {
    setSaving(true);
    try {
      const vid = selectedVisit.visit_id || selectedVisit.id;
      await api.post('/billing/visit/' + vid + '/items', itemForm);
      toast.success('Billing item added');
      setShowAddItem(false);
      openBill(selectedVisit);
      fetchSummary();
    } catch { toast.error('Failed to add item'); }
    finally { setSaving(false); }
  };

  const fmt = (val) => 'KES ' + parseFloat(val || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Dashboard calculation helpers
  const totalBilled = parseFloat(summary?.total_billed || 0);
  const totalCollected = parseFloat(summary?.total_collected || 0);
  const totalPending = parseFloat(summary?.total_pending || 0);
  const totalWaived = parseFloat(summary?.total_waived || 0);
  const cashCollected = parseFloat(summary?.cash_collected || 0);
  const mpesaCollected = parseFloat(summary?.mpesa_collected || 0);
  const insuranceCollected = parseFloat(summary?.insurance_collected || 0);
  const bankCollected = parseFloat(summary?.bank_collected || 0);
  const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0;

  // Filtered queues
  const opdQueue = queue.filter(v => !v.is_inpatient && v.status !== 'inpatient');
  const inpatientQueue = queue.filter(v => v.is_inpatient || v.status === 'inpatient');

  const [queueFilter, setQueueFilter] = useState('opd'); // 'opd' | 'all'

  const activeQueueList = queueFilter === 'opd' ? opdQueue : queue;

  const filteredQueue = activeQueueList.filter(v => 
    !search || 
    (v.patient_name || '').toLowerCase().includes(search.toLowerCase()) || 
    (v.patient_number || '').toLowerCase().includes(search.toLowerCase()) ||
    (v.visit_number || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: 24, height: '100vh', overflow: 'auto', background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>💳 Billing & Revenue Console</h1>
            <span style={{ fontSize: 11, background: '#10b98120', color: '#10b981', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>PREMIUM GRADE</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Manage patient billing queues, payment collections, and financial reports</p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px' }}>
            <Calendar size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>From:</span>
            <input type="date" value={queueDateFrom} onChange={e => {
              const val = e.target.value;
              setQueueDateFrom(val);
              if (queueDateTo < val) setQueueDateTo(val);
            }} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, outline: 'none', cursor: 'pointer' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginLeft: 4 }}>To:</span>
            <input type="date" value={queueDateTo} onChange={e => {
              const val = e.target.value;
              setQueueDateTo(val);
            }} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, outline: 'none', cursor: 'pointer' }} />
          </div>

          <Btn variant="ghost" onClick={() => { fetchQueue(); fetchSummary(); }}>
            <RefreshCw size={15}/> Refresh
          </Btn>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
        <button onClick={() => setTab('dashboard')} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
          background: tab === 'dashboard' ? 'var(--accent)' : 'transparent',
          color: tab === 'dashboard' ? '#0F1612' : 'var(--text-muted)', border: 'none', cursor: 'pointer', transition: 'all 0.15s ease'
        }}>
          <PieChart size={16} /> 📊 Executive Dashboard
        </button>

        <button onClick={() => setTab('queue')} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
          background: tab === 'queue' ? 'var(--accent)' : 'transparent',
          color: tab === 'queue' ? '#0F1612' : 'var(--text-muted)', border: 'none', cursor: 'pointer', transition: 'all 0.15s ease'
        }}>
          <Wallet size={16} /> 📋 OPD Queue ({opdQueue.length})
        </button>

        <button onClick={() => setTab('inpatient')} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
          background: tab === 'inpatient' ? 'var(--accent)' : 'transparent',
          color: tab === 'inpatient' ? '#0F1612' : 'var(--text-muted)', border: 'none', cursor: 'pointer', transition: 'all 0.15s ease'
        }}>
          <Receipt size={16} /> 🏥 Inpatient Bills ({inpatientFolder.length})
        </button>

        <button onClick={() => setTab('history')} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
          background: tab === 'history' ? 'var(--accent)' : 'transparent',
          color: tab === 'history' ? '#0F1612' : 'var(--text-muted)', border: 'none', cursor: 'pointer', transition: 'all 0.15s ease'
        }}>
          <Receipt size={16} /> 📜 Patient History & Receipts
        </button>
      </div>

      {/* TAB 1: EXECUTIVE DASHBOARD */}
      {tab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Top Key Performance Indicators (KPIs) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <Card style={{ padding: 18, borderLeft: '4px solid var(--accent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Billed Today</span>
                <div style={{ padding: 6, background: 'var(--accent)15', borderRadius: 8, color: 'var(--accent)' }}><DollarSign size={16}/></div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{fmt(totalBilled)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{summary?.total_items || 0} Total Billed Items</div>
            </Card>

            <Card style={{ padding: 18, borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Collections Today</span>
                <div style={{ padding: 6, background: '#10b98115', borderRadius: 8, color: '#10b981' }}><CheckCircle size={16}/></div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>{fmt(totalCollected)}</div>
              <div style={{ fontSize: 11, color: '#10b981', marginTop: 4, fontWeight: 600 }}>{collectionRate}% Collection Rate</div>
            </Card>

            <Card style={{ padding: 18, borderLeft: '4px solid #ef4444' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Outstanding Arrears</span>
                <div style={{ padding: 6, background: '#ef444415', borderRadius: 8, color: '#ef4444' }}><AlertCircle size={16}/></div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444', fontFamily: 'monospace' }}>{fmt(totalPending)}</div>
              <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{summary?.pending_count || 0} Bills Pending Collection</div>
            </Card>

            <Card style={{ padding: 18, borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Waived / Exemptions</span>
                <div style={{ padding: 6, background: '#8b5cf615', borderRadius: 8, color: '#8b5cf6' }}><Shield size={16}/></div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#8b5cf6', fontFamily: 'monospace' }}>{fmt(totalWaived)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{summary?.waived_count || 0} Waived Services</div>
            </Card>
          </div>

          {/* Payment Method Breakdown Bar */}
          <Card style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>💵 Collections by Payment Channel</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Breakdown of collected funds across Cash, M-Pesa, Insurance, and Bank</p>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981', background: '#10b98115', padding: '4px 10px', borderRadius: 20 }}>
                Total: {fmt(totalCollected)}
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div style={{ height: 12, background: 'var(--bg-elevated)', borderRadius: 6, overflow: 'hidden', display: 'flex', marginBottom: 16 }}>
              {totalCollected > 0 ? (
                <>
                  <div style={{ width: `${(mpesaCollected / totalCollected) * 100}%`, background: '#10b981' }} title="M-Pesa" />
                  <div style={{ width: `${(cashCollected / totalCollected) * 100}%`, background: '#f59e0b' }} title="Cash" />
                  <div style={{ width: `${(insuranceCollected / totalCollected) * 100}%`, background: '#3b82f6' }} title="Insurance/SHA" />
                  <div style={{ width: `${(bankCollected / totalCollected) * 100}%`, background: '#8b5cf6' }} title="Bank" />
                </>
              ) : (
                <div style={{ width: '100%', background: 'var(--border)' }} />
              )}
            </div>

            {/* Method Breakdown Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  <Smartphone size={16} /> M-PESA
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace' }}>{fmt(mpesaCollected)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {totalCollected > 0 ? Math.round((mpesaCollected / totalCollected) * 100) : 0}% of collections
                </div>
              </div>

              <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f59e0b', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  <Wallet size={16} /> CASH
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace' }}>{fmt(cashCollected)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {totalCollected > 0 ? Math.round((cashCollected / totalCollected) * 100) : 0}% of collections
                </div>
              </div>

              <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3b82f6', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  <Shield size={16} /> INSURANCE / SHA
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace' }}>{fmt(insuranceCollected)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {totalCollected > 0 ? Math.round((insuranceCollected / totalCollected) * 100) : 0}% of claims
                </div>
              </div>

              <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8b5cf6', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  <CreditCard size={16} /> BANK / CHEQUE
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace' }}>{fmt(bankCollected)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {totalCollected > 0 ? Math.round((bankCollected / totalCollected) * 100) : 0}% direct transfers
                </div>
              </div>
            </div>
          </Card>

          {/* Department Revenue Breakdown & Live Ledger */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {/* Revenue by Service Category */}
            <Card style={{ padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>🏥 Revenue by Service Category</h3>
              {byType.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 30, fontSize: 13 }}>No revenue data recorded for this date</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {byType.map((cat, i) => (
                    <div key={i} style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>{cat.item_type || 'General'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cat.count} service(s) billed</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                          {fmt(cat.amount)}
                        </div>
                        <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>
                          Collected: {fmt(cat.collected)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Live Cashier Payment Ledger Feed */}
            <Card style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>⚡ Live Recent Payments Ledger</h3>
                <Btn size="sm" variant="ghost" onClick={() => setTab('history')}>View All</Btn>
              </div>

              {recentTx.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 30, fontSize: 13 }}>No recent payment activity for today</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                  {recentTx.map((tx, i) => (
                    <div key={i} style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{tx.patient_name || 'Patient'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {tx.item_name} · <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{tx.patient_number}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: tx.status === 'paid' ? '#10b981' : 'var(--text-primary)', fontFamily: 'monospace' }}>
                          {fmt(tx.total_price)}
                        </div>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase', background: (STATUS_COLORS[tx.status] || '#10b981') + '20', color: STATUS_COLORS[tx.status] || '#10b981' }}>
                          {tx.payment_method || tx.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVE QUEUE */}
      {tab === 'queue' && (
        <>
          {/* Filter Toolbar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search active billing queue by patient name, number, or visit #..."
                  style={{ width: '100%', padding: '10px 10px 10px 36px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Department / Category Filter */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setQueueFilter('opd')}
                  style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    border: '1px solid var(--border)', cursor: 'pointer',
                    background: queueFilter === 'opd' ? 'var(--accent)' : 'var(--bg-surface)',
                    color: queueFilter === 'opd' ? '#0F1612' : 'var(--text-muted)'
                  }}
                >
                  🩺 Outpatients Only ({opdQueue.length})
                </button>
                <button
                  onClick={() => setQueueFilter('all')}
                  style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    border: '1px solid var(--border)', cursor: 'pointer',
                    background: queueFilter === 'all' ? 'var(--accent)' : 'var(--bg-surface)',
                    color: queueFilter === 'all' ? '#0F1612' : 'var(--text-muted)'
                  }}
                >
                  👥 All Pending ({queue.length})
                </button>
              </div>
            </div>

            {/* Date Range Calendar Filter Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                <Calendar size={16} style={{ color: 'var(--accent)' }} />
                <span>Filter Queue By Date Range:</span>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>From:</span>
                  <input
                    type="date"
                    value={queueDateFrom}
                    onChange={e => {
                      const val = e.target.value;
                      setQueueDateFrom(val);
                      if (queueDateTo < val) setQueueDateTo(val);
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, outline: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>To:</span>
                  <input
                    type="date"
                    value={queueDateTo}
                    onChange={e => {
                      const val = e.target.value;
                      setQueueDateTo(val);
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, outline: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                  />
                </div>

                <Btn
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    setQueueDateFrom(todayStr);
                    setQueueDateTo(todayStr);
                  }}
                  style={{
                    background: queueDateFrom === today && queueDateTo === today ? 'var(--accent)' : 'var(--bg-elevated)',
                    color: queueDateFrom === today && queueDateTo === today ? '#0F1612' : 'var(--text-primary)'
                  }}
                >
                  📅 Reset to Today
                </Btn>
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60 }}><Loader size={28} color="var(--accent)" style={{ animation: 'spin 0.8s linear infinite' }} /></div>
          ) : filteredQueue.length === 0 ? (
            <Card style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-faint)', marginBottom: 6 }}>No pending bills in queue</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>All bills for this date have been settled or no active visits found</div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredQueue.map(visit => (
                <Card key={visit.id} style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{visit.patient_name}</span>
                      <span style={{ fontSize: 11, padding: '2px 6px', background: 'var(--bg-elevated)', borderRadius: 4, color: 'var(--accent)', fontFamily: 'monospace', fontWeight: 700 }}>{visit.patient_number}</span>
                      {(visit.is_inpatient || visit.ward_name) && (
                        <span style={{ fontSize: 11, padding: '2px 8px', background: '#3b82f620', color: '#3b82f6', borderRadius: 4, fontWeight: 700 }}>
                          🏥 Inpatient: {visit.ward_name || 'Ward'} {visit.bed_number ? `(${visit.bed_number})` : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {visit.gender} · {visit.phone} · Visit #: <strong style={{ color: 'var(--text-primary)' }}>{visit.visit_number}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#ef4444', fontFamily: 'monospace' }}>
                      KES {parseFloat(visit.pending_amount || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                    </div>
                    <Btn size="sm" onClick={() => openBill(visit)}>Open Bill & Collect</Btn>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 3: PATIENT HISTORY & RECEIPTS */}
      {tab === 'history' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, position: 'relative', minWidth: 200 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={histSearch} onChange={e => setHistSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') fetchHistory(); }}
                placeholder="Search patient payment records by name or patient #..."
                style={{ width: '100%', padding: '10px 10px 10px 36px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <input type="date" value={histDateFrom} onChange={e => setHistDateFrom(e.target.value)}
              style={{ padding: '9px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 12, alignSelf: 'center' }}>to</span>
            <input type="date" value={histDateTo} onChange={e => setHistDateTo(e.target.value)}
              style={{ padding: '9px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
            <Btn onClick={fetchHistory} size="sm"><Search size={14}/> Search</Btn>
          </div>

          {histLoading ? (
            <div style={{ textAlign: 'center', padding: 60 }}><Loader size={28} color="var(--accent)" style={{ animation: 'spin 0.8s linear infinite' }} /></div>
          ) : history.length === 0 ? (
            <Card style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📜</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-faint)', marginBottom: 6 }}>No patient payment records found</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Use the filters above to search by date range or patient name</div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.map(record => {
                const items = Array.isArray(record.items) ? record.items.filter(i => i && i.id) : [];
                return (
                  <Card key={record.visit_id} style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: items.length > 0 ? 10 : 0 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{record.patient_name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{record.patient_number}</span>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 800, background: record.visit_status === 'discharged' ? '#10b98120' : '#3b82f620', color: record.visit_status === 'discharged' ? '#10b981' : '#3b82f6' }}>
                            {record.visit_status?.toUpperCase() || 'ACTIVE'}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Visit #: {record.visit_number} · Date: {new Date(record.visit_date).toLocaleDateString('en-KE')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)', fontFamily: 'monospace' }}>
                          KES {parseFloat(record.total_billed || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                        </div>
                        <Btn size="sm" variant="ghost" onClick={() => printMedicalInvoice({
                          ...record,
                          total_billed: record.total_billed,
                          total_paid: record.total_paid,
                          total_waived: record.total_waived
                        }, user?.pharmacy, user)}>
                          <FileText size={13} /> 📄 Medical Invoice
                        </Btn>
                        <Btn size="sm" variant="success" onClick={() => printCombinedPatientReceipt(record, user?.pharmacy, user)}>
                          <Printer size={13} /> Combined Receipt
                        </Btn>
                      </div>
                    </div>

                    {items.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
                        {items.slice(0, 5).map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', padding: '3px 0' }}>
                            <span>{item.item_name || item.description}</span>
                            <span style={{ fontFamily: 'monospace' }}>KES {parseFloat(item.total_price||0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: INPATIENT BILLS */}
      {tab === 'inpatient' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, background: 'var(--bg-surface)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>🏥 Cashier Inpatient Bills</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Comprehensive inpatient account statements, cumulative daily bed charges, pharmacy orders & final discharge billing.</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['all', 'admitted', 'discharged'].map(st => (
                <button key={st} onClick={() => setInpatientStatusFilter(st)} style={{
                  padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, fontWeight: 700,
                  background: inpatientStatusFilter === st ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: inpatientStatusFilter === st ? '#0F1612' : 'var(--text-muted)', cursor: 'pointer'
                }}>
                  {st === 'all' ? 'All Wards' : st === 'admitted' ? 'Active Admitted' : 'Discharged'}
                </button>
              ))}
              <Btn variant="ghost" onClick={fetchInpatientFolder}><RefreshCw size={14}/> Refresh</Btn>
            </div>
          </div>

          {inpatientLoading ? (
            <div style={{ textAlign: 'center', padding: 60 }}><Loader size={28} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--accent)' }}/></div>
          ) : inpatientFolder.length === 0 ? (
            <Card style={{ padding: 40, textAlign: 'center' }}>
              <Receipt size={36} style={{ color: 'var(--text-muted)', marginBottom: 8 }}/>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>No Inpatient Accounts Found</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Inpatient admission files and active ward accounts will appear here automatically.</div>
            </Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 16 }}>
              {inpatientFolder.map(inp => {
                const total = parseFloat(inp.total_amount || 0);
                const paid = parseFloat(inp.paid_amount || 0);
                const pending = parseFloat(inp.pending_amount || 0);

                return (
                  <Card key={inp.visit_id} style={{ padding: 18, border: pending > 0 ? '1px solid var(--warning)50' : '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>🛏️ {inp.patient_name}</span>
                          <span className="mono" style={{ fontSize: 11, background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4, color: 'var(--text-muted)' }}>{inp.patient_number}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          🏥 {inp.ward_name || 'Ward'} • Bed {inp.bed_number || 'N/A'} • Admitted {inp.admission_date ? new Date(inp.admission_date).toLocaleDateString('en-KE') : 'Recently'}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, fontWeight: 800, background: inp.admission_status === 'discharged' ? '#10b98120' : '#3b82f620', color: inp.admission_status === 'discharged' ? '#10b981' : '#3b82f6' }}>
                        {inp.admission_status ? inp.admission_status.toUpperCase() : 'ADMITTED'}
                      </span>
                    </div>

                    <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center', marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Charges</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>KES {total.toLocaleString('en-KE')}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Paid</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#10b981' }}>KES {paid.toLocaleString('en-KE')}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Pending</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: pending > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>KES {pending.toLocaleString('en-KE')}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Btn style={{ flex: 1, justifyContent: 'center' }} onClick={() => openBill(inp)}>
                        💳 Open Inpatient Bill & Settle
                      </Btn>
                      <Btn variant="ghost" size="sm" onClick={() => printMedicalInvoice({
                        ...inp,
                        total_billed: total,
                        total_paid: paid
                      }, user?.pharmacy, user)}>
                        <FileText size={14}/> Invoice
                      </Btn>
                      <Btn variant="ghost" size="sm" onClick={() => printCombinedPatientReceipt(inp, user?.pharmacy, user)}>
                        <Printer size={14}/> Statement
                      </Btn>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bill Detail Modal */}
      {selectedVisit && bill && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 16 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', width: '100%', maxWidth: 700, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{selectedVisit.patient_name}</h3>
                <div style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'monospace', marginTop: 2 }}>
                  {selectedVisit.patient_number} · Visit #{selectedVisit.visit_number}
                </div>
              </div>
              <button onClick={() => { setSelectedVisit(null); setBill(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, background: 'var(--bg-elevated)', padding: 12, borderRadius: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Visit Number</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{selectedVisit.visit_number}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Billed</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{fmt(bill.total)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <Btn size="sm" onClick={() => setShowAddItem(true)}><Plus size={14} /> Add Line Item</Btn>
                <Btn size="sm" variant="success" onClick={() => { 
                  const pendingItems = (bill?.items || []).filter(i => i.status === 'pending' || i.status === 'partial'); 
                  setSelectedBillItems(pendingItems.map(i => i.id)); 
                  const total = pendingItems.reduce((s, i) => s + parseFloat(i.total_price || 0) - parseFloat(i.paid_amount || 0), 0); 
                  const visitPaymentMethod = selectedVisit?.payment_method || 'cash';
                  const isIns = ['insurance', 'sha', 'nhif', 'corporate'].includes(visitPaymentMethod.toLowerCase());
                  setPayForm({
                    payment_method: isIns ? visitPaymentMethod : 'cash',
                    amount: total > 0 ? String(total) : '',
                    member_number: selectedVisit?.sha_number || selectedVisit?.member_number || '',
                    insurance_provider: selectedVisit?.insurance_provider || (isIns ? 'SHA / Social Health Authority' : ''),
                    auth_code: selectedVisit?.auth_code || '',
                    copay_amount: selectedVisit?.copay_amount ? String(selectedVisit.copay_amount) : '',
                    reference_number: '',
                    notes: ''
                  }); 
                  setShowPayment(true); 
                }}>
                  <DollarSign size={14} /> Collect Payment / Bill Insurance
                </Btn>
                <Btn size="sm" variant="ghost" onClick={() => printMedicalInvoice({
                  ...selectedVisit,
                  items: bill.items,
                  total_billed: bill.total,
                  total_paid: bill.paid,
                  total_waived: bill.waived,
                  balance: bill.balance,
                  insurance_provider: selectedVisit?.insurance_provider,
                  member_number: selectedVisit?.sha_number || selectedVisit?.member_number
                }, user?.pharmacy, user)}>
                  <FileText size={14} /> 📄 Medical Tax Invoice
                </Btn>
                <Btn size="sm" variant="ghost" onClick={() => printCombinedPatientReceipt({
                  ...selectedVisit,
                  items: bill.items,
                  total_billed: bill.total,
                  total_paid: bill.paid,
                  total_waived: bill.waived,
                  balance: bill.balance
                }, user?.pharmacy, user)}>
                  <Printer size={14} /> Combined Receipt
                </Btn>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Bill Line Items</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {bill.items?.map(item => (
                  <div key={item.id} style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{item.item_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{item.item_type} x{item.quantity} · Unit: KES {parseFloat(item.unit_price||0).toLocaleString()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: STATUS_COLORS[item.status] || 'var(--text-primary)', fontFamily: 'monospace' }}>
                        {fmt(item.total_price)}
                      </div>
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase', background: (STATUS_COLORS[item.status] || '#10b981') + '20', color: STATUS_COLORS[item.status] || '#10b981' }}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItem && selectedVisit && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002, padding: 16 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', width: '100%', maxWidth: 450 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Add Charge Item</h3>
              <button onClick={() => setShowAddItem(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Item Category</label>
                <select value={itemForm.item_type} onChange={e => setItemForm({...itemForm, item_type: e.target.value})} style={selectStyle}>
                  {ITEM_TYPES.map(t => <option key={t} value={t} style={{ background: '#1A2420', color: '#E8F5F0' }}>{t.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description / Service Name</label>
                <input value={itemForm.description} onChange={e => setItemForm({...itemForm, description: e.target.value})} placeholder="e.g. Special Consultation Fee, Dressing Fee" style={inp} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Quantity</label>
                  <input type="number" value={itemForm.quantity} onChange={e => setItemForm({...itemForm, quantity: e.target.value})} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Unit Price (KES)</label>
                  <input type="number" value={itemForm.unit_price} onChange={e => setItemForm({...itemForm, unit_price: e.target.value})} placeholder="0.00" style={inp} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <Btn variant="ghost" onClick={() => setShowAddItem(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
                <Btn onClick={addItem} disabled={saving || !itemForm.description || !itemForm.unit_price} style={{ flex: 1, justifyContent: 'center' }}>
                  {saving ? 'Adding...' : 'Add Item'}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && selectedVisit && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002, padding: 16 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Collect Patient Payment</h3>
              <button onClick={() => setShowPayment(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 8, fontWeight: 600 }}>Select Pending Items to Collect</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(bill?.items || []).filter(i => i.status === 'pending').map(item => (
                    <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }}>
                      <input type="checkbox"
                        checked={selectedBillItems.includes(item.id)}
                        onChange={e => {
                          const newSelection = e.target.checked
                            ? [...selectedBillItems, item.id]
                            : selectedBillItems.filter(id => id !== item.id);
                          setSelectedBillItems(newSelection);
                          const total = (bill?.items || []).filter(i => newSelection.includes(i.id)).reduce((s, i) => s + parseFloat(i.total_price || 0), 0);
                          setPayForm({...payForm, amount: total ? String(total) : ''});
                        }}
                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{item.item_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.item_type}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)', fontFamily: 'monospace' }}>KES {parseFloat(item.total_price || 0).toLocaleString()}</div>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5, fontWeight: 600 }}>Payment Channel / Method</label>
                <select value={payForm.payment_method} onChange={e => setPayForm({...payForm, payment_method: e.target.value})} style={selectStyle}>
                  {PAYMENT_METHODS.map(m => (
                    <option key={m.value} value={m.value} style={{ background: '#1A2420', color: '#E8F5F0' }}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {['insurance', 'sha', 'nhif', 'corporate'].includes(payForm.payment_method) && (
                <div style={{ background: '#3b82f610', border: '1px solid #3b82f630', padding: 14, borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Shield size={16} /> Insurance / Coverage Details
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Primary Insurance Scheme / Provider</label>
                    <select value={payForm.insurance_provider} onChange={e => setPayForm({...payForm, insurance_provider: e.target.value})} style={selectStyle}>
                      <option value="SHA / Social Health Authority" style={{ background: '#1A2420', color: '#E8F5F0' }}>🏥 SHA / Social Health Authority (DHA Portal)</option>
                      <option value="Jubilee Health Insurance" style={{ background: '#1A2420', color: '#E8F5F0' }}>🛡️ Jubilee Health Insurance</option>
                      <option value="Britam General Insurance" style={{ background: '#1A2420', color: '#E8F5F0' }}>🛡️ Britam General Insurance</option>
                      <option value="APA Insurance" style={{ background: '#1A2420', color: '#E8F5F0' }}>🛡️ APA Insurance</option>
                      <option value="AAR Insurance" style={{ background: '#1A2420', color: '#E8F5F0' }}>🛡️ AAR Insurance</option>
                      <option value="CIC General Insurance" style={{ background: '#1A2420', color: '#E8F5F0' }}>🛡️ CIC General Insurance</option>
                      <option value="Madison Insurance" style={{ background: '#1A2420', color: '#E8F5F0' }}>🛡️ Madison Insurance</option>
                      <option value="GA Insurance" style={{ background: '#1A2420', color: '#E8F5F0' }}>🛡️ GA Insurance</option>
                      <option value="Old Mutual / UAP" style={{ background: '#1A2420', color: '#E8F5F0' }}>🛡️ Old Mutual / UAP Insurance</option>
                      <option value="Equity Afia Insurance" style={{ background: '#1A2420', color: '#E8F5F0' }}>🛡️ Equity Afia Insurance</option>
                      <option value="Heritage Insurance" style={{ background: '#1A2420', color: '#E8F5F0' }}>🛡️ Heritage Insurance</option>
                      <option value="Corporate / Direct Billing" style={{ background: '#1A2420', color: '#E8F5F0' }}>🏢 Corporate / Direct Billing Scheme</option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Member / Policy #</label>
                      <input value={payForm.member_number} onChange={e => setPayForm({...payForm, member_number: e.target.value})} placeholder="e.g. SHA-9021234" style={inp} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Pre-Auth / Approval Code</label>
                      <input value={payForm.auth_code} onChange={e => setPayForm({...payForm, auth_code: e.target.value})} placeholder="e.g. AUTH-88219" style={inp} />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Patient Co-Pay Amount (KES)</label>
                    <input type="number" value={payForm.copay_amount} onChange={e => setPayForm({...payForm, copay_amount: e.target.value})} placeholder="0.00 (Leave empty if 100% covered)" style={inp} />
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5, fontWeight: 600 }}>Amount Billed / Collected (KES)</label>
                <input type="number" value={payForm.amount} onChange={e => setPayForm({...payForm, amount: e.target.value})} placeholder="Enter amount" style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5, fontWeight: 600 }}>Reference / Claim Code / Transaction ID</label>
                <input value={payForm.reference_number} onChange={e => setPayForm({...payForm, reference_number: e.target.value})} placeholder="e.g. QX890123, SHA claim reference..." style={inp} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5, fontWeight: 600 }}>Notes</label>
                <textarea value={payForm.notes} onChange={e => setPayForm({...payForm, notes: e.target.value})} rows={2} placeholder="Any payment notes..." style={{...inp, resize:'vertical'}} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <Btn variant="ghost" onClick={() => setShowPayment(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
                <Btn variant="success" onClick={payBill} disabled={saving || !payForm.amount || selectedBillItems.length === 0} style={{ flex: 1, justifyContent: 'center' }}>
                  {saving ? 'Processing...' : `✅ Collect KES ${parseFloat(payForm.amount||0).toLocaleString()}`}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
