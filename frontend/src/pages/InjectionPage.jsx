import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Plus, X, Loader, RefreshCw, Search, CheckCircle, Clock, DollarSign, CreditCard, AlertTriangle, ShieldCheck, Check, FileText } from 'lucide-react';

const PAYMENT_METHODS = [
  { value: 'mpesa', label: '📱 M-Pesa' },
  { value: 'cash', label: '💵 Cash' },
  { value: 'insurance', label: '🛡️ Private Insurance' },
  { value: 'sha', label: '🏥 SHA (Social Health Authority)' },
  { value: 'bank', label: '🏦 Bank Transfer / Card' }
];

const INJECTION_PRESETS = [
  { name: 'IM Injection Administration Fee', code: 'PROC-IM', price: 200, desc: 'Intramuscular injection administration & sterile consumables' },
  { name: 'IV Injection / Cannulation Fee', code: 'PROC-IV-AB', price: 500, desc: 'Intravenous cannulation, butterfly & slow IV push' },
  { name: 'Subcutaneous (SC) Injection Fee', code: 'PROC-SC', price: 200, desc: 'Subcutaneous injection administration' },
  { name: 'IV Normal Saline Infusion Setup', code: 'PROC-IV-NS', price: 600, desc: 'IV Giving set, 500ml Normal Saline, Cannula & Monitoring' },
  { name: 'Wound Dressing & Injection Consumables', code: 'PROC-DRESS', price: 350, desc: 'Sterile swabs, spirit, needles & plaster' },
  { name: 'Tetanus Toxoid (TT) Injection Service', code: 'INJ-TT', price: 400, desc: 'Tetanus toxoid vaccine administration' }
];

const getAge = dob => {
  if (!dob) return '—';
  const y = Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
  return y < 1 ? `${Math.floor((Date.now() - new Date(dob)) / (30.44 * 24 * 60 * 60 * 1000))}mo` : `${y}y`;
};

const ROUTES = ['IV', 'IM', 'SC', 'Oral', 'Sublingual', 'Topical', 'Inhalation', 'PR', 'ID'];
const STATUS_COLORS = { pending: '#f59e0b', administered: '#10b981', cancelled: '#ef4444' };
const STATUS_LABELS = { pending: '⏳ Pending', administered: '✅ Given', cancelled: '❌ Cancelled' };

const parseDosageAndRoute = (name = '', categoryName = '') => {
  const lowercaseName = name.toLowerCase();
  const lowercaseCat = (categoryName || '').toLowerCase();
  
  // 1. Parse Dosage (Strength)
  const dosageRegex = /(\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|iu|units|ug|mcl|%)(?:\/\d+\s*(?:ml|g))?)/gi;
  const match = lowercaseName.match(dosageRegex);
  let dosage = '';
  if (match) {
    dosage = match[0].trim();
  }

  // 2. Parse Route
  let route = 'Oral'; // default for InjectionPage is Oral, but wait, default for emptyOrder is IV. Let's map appropriately.
  
  const routeMap = {
    oral: 'Oral',
    iv: 'IV',
    im: 'IM',
    topical: 'Topical',
    sublingual: 'Sublingual',
    inhaled: 'Inhalation',
    rectal: 'PR',
    eye_drops: 'Topical',
    ear_drops: 'Topical'
  };

  let parsedRoute = 'oral';
  if (
    lowercaseName.includes('injection') || 
    lowercaseName.includes('inj') || 
    lowercaseName.includes('vial') || 
    lowercaseName.includes('ampoule') ||
    lowercaseName.includes('infusion') ||
    lowercaseName.includes('iv') ||
    lowercaseName.includes('im') ||
    lowercaseCat.includes('injection') ||
    lowercaseCat.includes('iv')
  ) {
    if (lowercaseName.includes('im') && !lowercaseName.includes('iv')) {
      parsedRoute = 'im';
    } else {
      parsedRoute = 'iv';
    }
  } else if (
    lowercaseName.includes('cream') || 
    lowercaseName.includes('ointment') || 
    lowercaseName.includes('gel') || 
    lowercaseName.includes('topical') || 
    lowercaseName.includes('lotion') ||
    lowercaseCat.includes('topical')
  ) {
    parsedRoute = 'topical';
  } else if (
    lowercaseName.includes('eye drop') || 
    lowercaseName.includes('ophthalmic') ||
    lowercaseCat.includes('eye') ||
    lowercaseCat.includes('ophthalmic')
  ) {
    parsedRoute = 'eye_drops';
  } else if (
    lowercaseName.includes('ear drop') || 
    lowercaseName.includes('otic') ||
    lowercaseCat.includes('ear')
  ) {
    parsedRoute = 'ear_drops';
  } else if (
    lowercaseName.includes('nasal') ||
    lowercaseCat.includes('nasal')
  ) {
    parsedRoute = 'inhaled';
  } else if (
    lowercaseName.includes('suppository') || 
    lowercaseName.includes('rectal') ||
    lowercaseCat.includes('rectal')
  ) {
    parsedRoute = 'rectal';
  } else if (
    lowercaseName.includes('inhaler') || 
    lowercaseName.includes('nebule') || 
    lowercaseName.includes('inhalation') ||
    lowercaseCat.includes('inhalation')
  ) {
    parsedRoute = 'inhaled';
  }

  return { dosage, route: routeMap[parsedRoute] || 'Oral' };
};

const Card = ({ children, style = {}, ...props }) => (
  <div style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)', ...style }} {...props}>{children}</div>
);

const Btn = ({ children, variant = 'primary', size = 'md', ...props }) => (
  <button {...props} style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: size === 'sm' ? '6px 12px' : '10px 18px',
    background: variant === 'primary' ? 'var(--accent)' : variant === 'danger' ? '#ef4444' : variant === 'success' ? '#10b981' : 'var(--bg-elevated)',
    border: variant === 'ghost' ? '1px solid var(--border)' : 'none', borderRadius: 8,
    color: variant === 'primary' || variant === 'success' ? '#0F1612' : variant === 'danger' ? '#fff' : 'var(--text-primary)',
    fontSize: size === 'sm' ? 11 : 13, fontWeight: 600, cursor: props.disabled ? 'not-allowed' : 'pointer',
    opacity: props.disabled ? 0.6 : 1, fontFamily: 'DM Sans, sans-serif', ...props.style
  }}>{children}</button>
);

const inp = { width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' };

export default function InjectionPage() {
  const { user } = useSelector(s => s.auth);
  const [tab, setTab] = useState('queue');
  const [visits, setVisits] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedVisitOrders, setSelectedVisitOrders] = useState(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [histLoading, setHistLoading] = useState(false);
  const [search, setSearch] = useState('');
  const today = new Date().toISOString().split('T')[0];
  const [queueDate, setQueueDate] = useState(today);
  const [histSearch, setHistSearch] = useState('');
  const [histDate, setHistDate] = useState(today);
  const [selected, setSelected] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [administering, setAdministering] = useState(null);
  const [returning, setReturning] = useState(false);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [clock, setClock] = useState(new Date());
  const emptyOrder = { drug_name: '', dosage: '', route: 'IV', frequency: '', duration: '', quantity: '', instructions: '', product_id: '' };
  const [newOrder, setNewOrder] = useState(emptyOrder);
  const [productSearch, setProductSearch] = useState('');
  const [nurseNotes, setNurseNotes] = useState({});
  const filteredProducts = products.filter(p => p.name?.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 8);

  const [procedures, setProcedures] = useState([]);
  const [servicePrices, setServicePrices] = useState([]);
  const [showProcForm, setShowProcForm] = useState(false);
  const [newProcedure, setNewProcedure] = useState({ procedure_name: '', procedure_code: '', notes: '' });
  const [procSaving, setProcSaving] = useState(false);
  const [procOutcomeNotes, setProcOutcomeNotes] = useState({});
  const [completingProc, setCompletingProc] = useState(null);
  const [panelTab, setPanelTab] = useState('drugs');

  // Billing & Payment States
  const [billingSummary, setBillingSummary] = useState({ total_billed: 0, total_paid: 0, total_pending: 0, all_paid: false, items: [] });
  const [billingItems, setBillingItems] = useState([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingBill, setPayingBill] = useState(false);
  const [payForm, setPayForm] = useState({
    payment_method: 'mpesa',
    reference_number: '',
    amount: '',
    notes: '',
    insurance_provider: '',
    member_number: '',
    auth_code: '',
    item_ids: []
  });
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [addingService, setAddingService] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    item_name: '',
    service_code: '',
    unit_price: '',
    quantity: 1,
    description: ''
  });

  const fetchBillingSummary = async (visitId) => {
    if (!visitId) return;
    setBillingLoading(true);
    try {
      const res = await api.get('/injection-room/visit/' + visitId + '/billing-summary');
      const d = res.data.data || {};
      setBillingSummary(d);
      setBillingItems(d.items || []);
    } catch {
      // ignore
    } finally {
      setBillingLoading(false);
    }
  };

  const handlePayBill = async () => {
    if (!selected?.id) return;
    const amt = parseFloat(payForm.amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    setPayingBill(true);
    try {
      const pendingIds = billingItems.filter(b => b.status === 'pending').map(b => b.id);
      const payload = {
        payment_method: payForm.payment_method,
        reference_number: payForm.reference_number || (payForm.payment_method === 'cash' ? 'CASH-' + Date.now().toString().slice(-6) : ''),
        amount: amt,
        insurance_provider: payForm.insurance_provider,
        member_number: payForm.member_number,
        auth_code: payForm.auth_code,
        notes: payForm.notes,
        item_ids: payForm.item_ids && payForm.item_ids.length > 0 ? payForm.item_ids : pendingIds
      };
      await api.post(`/billing/visit/${selected.id}/pay`, payload);
      toast.success('✅ Payment recorded successfully & injection items cleared');
      setShowPayModal(false);
      fetchBillingSummary(selected.id);
      fetchVisitOrders(selected.id);
      fetchVisits();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Payment collection failed');
    } finally {
      setPayingBill(false);
    }
  };

  const handleAddService = async () => {
    if (!selected?.id) return;
    if (!serviceForm.item_name.trim()) {
      toast.error('Service or procedure name is required');
      return;
    }
    const price = parseFloat(serviceForm.unit_price) || 0;
    setAddingService(true);
    try {
      await api.post(`/injection-room/visit/${selected.id}/bill-service`, {
        ...serviceForm,
        unit_price: price
      });
      toast.success('Injection service added to bill');
      setShowAddServiceModal(false);
      setServiceForm({ item_name: '', service_code: '', unit_price: '', quantity: 1, description: '' });
      fetchBillingSummary(selected.id);
      fetchVisitOrders(selected.id);
      fetchVisits();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to bill service');
    } finally {
      setAddingService(false);
    }
  };

  const handleWaiveItem = async (itemId) => {
    if (!confirm('Are you sure you want to waive this injection fee?')) return;
    try {
      await api.put(`/billing/item/${itemId}/waive`, { waive_reason: 'Waived at Injection Room' });
      toast.success('Item fee waived');
      fetchBillingSummary(selected.id);
      fetchVisitOrders(selected.id);
      fetchVisits();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to waive item');
    }
  };

  const fetchServicePrices = async () => {
    try {
      const { data } = await api.get('/billing/service-prices');
      setServicePrices(data.data || []);
    } catch {}
  };

  const fetchPatientProcedures = async (visitId) => {
    try {
      const res = await api.get('/inpatient/visit/' + visitId + '/procedures');
      setProcedures(res.data.data || []);
    } catch {}
  };

  const handleOrderProcedure = async () => {
    if (!newProcedure.procedure_name.trim()) return toast.error('Procedure name required');
    setProcSaving(true);
    try {
      const res = await api.post(`/inpatient/visit/${selected.id}/procedures`, newProcedure);
      setProcedures(p => [...p, res.data.data]);
      setNewProcedure({ procedure_name: '', procedure_code: '', notes: '' });
      setShowProcForm(false);
      toast.success('Procedure ordered and billed successfully');
    } catch (e) {
      toast.error('Failed to order procedure');
    } finally {
      setProcSaving(false);
    }
  };

  const handleCompleteProcedure = async (procedureId) => {
    const notesText = procOutcomeNotes[procedureId] || '';
    if (!notesText.trim()) return toast.error('Enter outcome notes to complete the procedure');
    setCompletingProc(procedureId);
    try {
      const res = await api.put(`/inpatient/procedures/${procedureId}/complete`, {
        outcome: 'Completed: ' + notesText,
        notes: notesText
      });
      setProcedures(p => p.map(item => item.id === procedureId ? { ...item, outcome: res.data.data.outcome, notes: res.data.data.notes } : item));
      toast.success('Procedure completed and recorded');
    } catch (e) {
      toast.error('Failed to complete procedure');
    } finally {
      setCompletingProc(null);
    }
  };

  useEffect(() => { const t = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { fetchVisits(); }, [queueDate]);
  useEffect(() => { fetchProducts(); }, []);
  useEffect(() => { fetchServicePrices(); }, []);
  useEffect(() => { if (tab === 'history') fetchHistory(); }, [tab, histDate, histSearch]);

  const fetchVisits = async () => {
    setLoading(true);
    try {
      const d = queueDate || new Date().toISOString().split('T')[0];
      const res = await api.get(`/injection-room?date=${d}`);
      setVisits(res.data.data.visits || []);
      setStats(res.data.data.stats || {});
    } catch { toast.error('Failed to load injection room'); }
    finally { setLoading(false); }
  };

  const fetchVisitOrders = async (visitId) => {
    setOrdersLoading(true);
    try {
      const res = await api.get('/injection-room/visit/' + visitId);
      const fetchedOrders = res.data.data || [];
      setSelectedVisitOrders(fetchedOrders);
      setOrders(fetchedOrders);
    } catch { toast.error('Failed to load orders'); }
    finally { setOrdersLoading(false); }
  };

  const fetchHistory = async () => {
    setHistLoading(true);
    try {
      const params = new URLSearchParams();
      if (histDate) params.append('date', histDate);
      if (histSearch) params.append('search', histSearch);
      const res = await api.get(`/injection-room/history?${params}`);
      setHistory(res.data.data || []);
    } catch { toast.error('Failed to load history'); }
    finally { setHistLoading(false); }
  };

  const fetchProducts = async () => {
    try { const res = await api.get('/products'); setProducts(res.data.data || []); } catch {}
  };

  const openPatient = async (visit) => {
    setSelected(visit);
    setOrders(visit.orders || []);
    setPanelTab('drugs');
    fetchPatientProcedures(visit.id);
    fetchVisitOrders(visit.id);
    fetchBillingSummary(visit.id);
    try {
      const cr = await api.get('/consultations/visit/' + visit.id);
      const con = cr.data.data;
      setSelected(prev => ({ ...prev, diagnosis: con?.diagnosis, management_plan: con?.management_plan, prescriptions: con?.prescriptions || [] }));
    } catch {}
    setShowAddOrder(false);
    setNewOrder(emptyOrder);
    setProductSearch("");
  };

  const handleAddOrder = async () => {
    if (!newOrder.drug_name) { toast.error('Drug name required'); return; }
    setSaving(true);
    try {
      const res = await api.post(`/injection-room/visit/${selected.id}/orders`, newOrder);
      setOrders(p => [...p, res.data.data]);
      setNewOrder(emptyOrder); setProductSearch(''); setShowAddOrder(false);
      fetchBillingSummary(selected.id);
      toast.success('Order added and billed to patient');
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to add order'); }
    finally { setSaving(false); }
  };

  const handleAdminister = async (orderId) => {
    setAdministering(orderId);
    try {
      const order = orders.find(o => o.id === orderId);
      const noteToSend = nurseNotes[orderId] !== undefined ? nurseNotes[orderId] : (order?.nurse_report || order?.notes || '');
      await api.put(`/injection-room/orders/${orderId}/administer`, { nurse_report: noteToSend, notes: noteToSend });
      setNurseNotes(p => { const n = {...p}; delete n[orderId]; return n; });
      setOrders(p => p.map(o => o.id === orderId ? { ...o, status: 'administered', nurse_report: noteToSend, notes: noteToSend, administered_at: new Date().toISOString() } : o));
      toast.success('✅ Drug administered & stock updated');
      fetchVisits();
      fetchHistory();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to administer'); }
    finally { setAdministering(null); }
  };

  const handleReturnToDoctor = async () => {
    setReturning(true);
    try {
      await api.put(`/injection-room/visit/${selected.id}/return-to-doctor`, {});
      toast.success('Patient returned to doctor');
      setSelected(null);
      fetchVisits();
      fetchHistory();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setReturning(false); }
  };

  const filtered = visits.filter(v =>
    !search || v.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
    v.patient_number?.toLowerCase().includes(search.toLowerCase()) || v.phone?.includes(search)
  );

  // ── PATIENT DETAIL ───────────────────────────────────────────────────────────
  if (selected) {
    const pendingOrders = orders.filter(o => o.status?.toLowerCase() === 'pending');
    const doneOrders = orders.filter(o => o.status?.toLowerCase() === 'administered');
    const allDone = orders.length > 0 && orders.every(o => o.status?.toLowerCase() === 'administered');

    return (
      <div style={{ height: '100vh', overflow: 'auto', padding: 20, background: 'var(--bg-base)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Btn variant="ghost" onClick={() => setSelected(null)}>← Back</Btn>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>💉 {selected.patient_name}</h1>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selected.visit_number} · {selected.patient_number}</div>
          </div>
          <Btn variant="success" onClick={handleReturnToDoctor} disabled={returning}>
            {returning ? <Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <CheckCircle size={14} />}
            Return to Doctor
          </Btn>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card style={{ padding: 20 }}>
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 44, marginBottom: 6 }}>{selected.gender === 'female' ? '👩' : '👨'}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{selected.patient_name}</div>
                <div style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'monospace', marginTop: 3 }}>{selected.patient_number}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{selected.gender} · {getAge(selected.date_of_birth)}</div>
              </div>
              {selected.allergies && (
                <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 2 }}>⚠ ALLERGIES</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{selected.allergies}</div>
                </div>
              )}
            </Card>

            {(selected.temperature || selected.pulse_rate || selected.blood_pressure_systolic) && (
              <Card style={{ padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Triage Vitals</div>
                {[
                  { label: 'BP', value: selected.blood_pressure_systolic ? `${selected.blood_pressure_systolic}/${selected.blood_pressure_diastolic}` : null, unit: 'mmHg', color: '#ef4444' },
                  { label: 'Temp', value: selected.temperature, unit: '°C', color: '#f59e0b' },
                  { label: 'Pulse', value: selected.pulse_rate, unit: 'bpm', color: '#3b82f6' },
                  { label: 'SpO2', value: selected.oxygen_saturation, unit: '%', color: '#10b981' },
                  { label: 'Weight', value: selected.weight, unit: 'kg', color: 'var(--text-primary)' },
                ].filter(r => r.value).map(({ label, value, unit, color }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontWeight: 700, color }}>{value} {unit}</span>
                  </div>
                ))}
              </Card>
            )}

            <Card style={{ padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Progress</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: '#f59e0b' }}>Pending</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>{pendingOrders.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: '#10b981' }}>Administered</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>{doneOrders.length}</span>
              </div>
              {orders.length > 0 && (
                <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#10b981', borderRadius: 4, width: `${(doneOrders.length / orders.length) * 100}%`, transition: 'width 0.5s' }} />
                </div>
              )}
              {allDone && <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: '#10b981', textAlign: 'center' }}>✅ All done — ready to return</div>}
            </Card>

            {/* Injection Billing Card */}
            <Card style={{ padding: 16, border: billingSummary.total_pending > 0 ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(16,185,129,0.35)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 1 }}>Injection Billing</div>
                {billingSummary.total_pending > 0 ? (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 800 }}>⚠️ UNPAID</span>
                ) : (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, background: 'rgba(16,185,129,0.15)', color: '#10b981', fontWeight: 800 }}>✅ CLEARED</span>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Billed:</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>KES {Number(billingSummary.total_billed || 0).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Paid / Settled:</span>
                <span style={{ fontWeight: 700, color: '#10b981' }}>KES {Number(billingSummary.total_paid || 0).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Balance Pending:</span>
                <span style={{ fontWeight: 700, color: billingSummary.total_pending > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                  KES {Number(billingSummary.total_pending || 0).toLocaleString()}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {billingSummary.total_pending > 0 && (
                  <Btn
                    size="sm"
                    variant="success"
                    onClick={() => {
                      setPayForm({
                        payment_method: 'mpesa',
                        reference_number: '',
                        amount: String(billingSummary.total_pending || ''),
                        notes: 'Injection room services payment',
                        insurance_provider: '',
                        member_number: '',
                        auth_code: '',
                        item_ids: []
                      });
                      setShowPayModal(true);
                    }}
                    style={{ width: '100%', justifyContent: 'center', fontWeight: 700 }}
                  >
                    <DollarSign size={13} /> Collect Payment (KES {billingSummary.total_pending})
                  </Btn>
                )}
                <Btn
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowAddServiceModal(true)}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <Plus size={13} /> + Bill Service Fee
                </Btn>
              </div>
            </Card>
          </div>

          <Card style={{ padding: 20 }}>
            <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border)', marginBottom: 16, paddingBottom: 8 }}>
              <button
                onClick={() => setPanelTab('drugs')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
                  color: panelTab === 'drugs' ? 'var(--accent)' : 'var(--text-muted)',
                  borderBottom: panelTab === 'drugs' ? '2px solid var(--accent)' : 'none',
                  paddingBottom: 6
                }}
              >
                💉 Drug Orders ({orders.length})
              </button>
              <button
                onClick={() => setPanelTab('procs')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
                  color: panelTab === 'procs' ? 'var(--accent)' : 'var(--text-muted)',
                  borderBottom: panelTab === 'procs' ? '2px solid var(--accent)' : 'none',
                  paddingBottom: 6
                }}
              >
                🩺 Procedures & Treatments ({procedures.length})
              </button>
              <button
                onClick={() => setPanelTab('billing')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
                  color: panelTab === 'billing' ? 'var(--accent)' : 'var(--text-muted)',
                  borderBottom: panelTab === 'billing' ? '2px solid var(--accent)' : 'none',
                  paddingBottom: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                💳 Injection Billing ({billingItems.length})
                {billingSummary.total_pending > 0 && (
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'rgba(239,68,68,0.2)', color: '#ef4444', fontWeight: 800 }}>
                    KES {billingSummary.total_pending}
                  </span>
                )}
              </button>
            </div>

            {panelTab === 'drugs' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>💊 Ordered Injectable Medications</div>
                  <Btn size="sm" onClick={() => setShowAddOrder(p => !p)}><Plus size={13} /> Add Drug Order</Btn>
                </div>

            {showAddOrder && (
              <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 16, marginBottom: 16, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>New Drug Order</div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Search from Pharmacy Stock</label>
                  <div style={{ position: 'relative' }}>
                    <input value={productSearch} onChange={e => { setProductSearch(e.target.value); if (!e.target.value) setNewOrder(p => ({ ...p, product_id: '', drug_name: '' })); }}
                      placeholder="Type to search..." style={inp} />
                     {productSearch && filteredProducts.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px #00000040', marginTop: 4, overflow: 'hidden' }}>
                        {filteredProducts.map(p => {
                          const { dosage, route } = parseDosageAndRoute(p.name, p.category_name);
                          return (
                            <div key={p.id} onClick={() => { setNewOrder(prev => ({ ...prev, drug_name: p.name, product_id: p.id, dosage: dosage || prev.dosage || '', route: route || prev.route || 'Oral' })); setProductSearch(p.name); }}
                              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.generic_name}</div>
                              </div>
                              <span style={{ fontSize: 11, color: 'var(--accent)' }}>Stock: {p.total_stock}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div><label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Drug Name *</label>
                    <input value={newOrder.drug_name} onChange={e => setNewOrder(p => ({ ...p, drug_name: e.target.value }))} placeholder="e.g. Paracetamol" style={inp} /></div>
                  <div><label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Dosage</label>
                    <input value={newOrder.dosage} onChange={e => setNewOrder(p => ({ ...p, dosage: e.target.value }))} placeholder="e.g. 500mg" style={inp} /></div>
                  <div><label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Route</label>
                    <select value={newOrder.route} onChange={e => setNewOrder(p => ({ ...p, route: e.target.value }))} style={inp}>
                      {ROUTES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div><label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Frequency</label>
                    <input value={newOrder.frequency} onChange={e => setNewOrder(p => ({ ...p, frequency: e.target.value }))} placeholder="e.g. Once" style={inp} /></div>
                  <div><label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Quantity</label>
                    <input type="number" value={newOrder.quantity} onChange={e => setNewOrder(p => ({ ...p, quantity: e.target.value }))} placeholder="1" style={inp} /></div>
                  <div><label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Duration</label>
                    <input value={newOrder.duration} onChange={e => setNewOrder(p => ({ ...p, duration: e.target.value }))} placeholder="e.g. Once" style={inp} /></div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Instructions</label>
                  <input value={newOrder.instructions} onChange={e => setNewOrder(p => ({ ...p, instructions: e.target.value }))} placeholder="e.g. Give slowly over 30 mins" style={inp} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn variant="ghost" onClick={() => { setShowAddOrder(false); setNewOrder(emptyOrder); setProductSearch(''); }} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
                  <Btn onClick={handleAddOrder} disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
                    {saving ? <Loader size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Plus size={13} />} Add Order
                  </Btn>
                </div>
              </div>
            )}

            {orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-faint)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💉</div>
                <div style={{ fontSize: 14 }}>No orders yet</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Doctor Prescription Plan */}
              {selected.prescriptions?.length > 0 && (
                <Card style={{ padding:16, marginBottom:16, borderLeft:"4px solid #3b82f6" }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"#3b82f6", marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                    📋 Doctor Prescription Plan
                  </div>
                  {selected.diagnosis && <div style={{ fontSize:12, color:"var(--accent)", marginBottom:8, fontWeight:600 }}>Dx: {selected.diagnosis}</div>}
                  {selected.management_plan && <div style={{ fontSize:12, color:"var(--text-muted)", marginBottom:10 }}>{selected.management_plan}</div>}
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {selected.prescriptions.map((p, i) => (
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", background:"var(--bg-elevated)", borderRadius:8, fontSize:12 }}>
                        <div>
                          <span style={{ fontWeight:600, color:"var(--text-primary)" }}>{p.drug_name}</span>
                          {p.dosage && <span style={{ color:"var(--text-muted)", marginLeft:8 }}>{p.dosage} · {p.frequency} · {p.duration}</span>}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <span style={{ fontSize:10, padding:"2px 8px", borderRadius:4, background:p.route==="IV"||p.route==="IM"?"#ef444420":"var(--accent)15", color:p.route==="IV"||p.route==="IM"?"#ef4444":"var(--accent)", fontWeight:600 }}>{p.route}</span>
                          <span style={{ color:"var(--text-muted)" }}>Qty: {p.quantity||"—"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
              
              {/* Injection Orders */}
                {orders.map(order => {
                  const sc = STATUS_COLORS[order.status] || 'var(--text-muted)';
                  return (
                    <div key={order.id} style={{ padding: 16, borderRadius: 10, background: 'var(--bg-elevated)', border: `1px solid ${order.status === 'administered' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{order.drug_name}</span>
                        </div>
                        {/* Treatment Plan (read-only) */}
                        {selected.management_plan && (
                          <div style={{ marginBottom: 8, padding: '8px 12px', background: 'rgba(168,85,247,0.08)', borderRadius: 8, border: '1px solid rgba(168,85,247,0.2)' }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#a855f7', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📋 Doctor's Treatment Plan</div>
                            <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{selected.management_plan}</div>
                          </div>
                        )}
                        {/* Doctor's Instructions (read-only) */}
                        {order.instructions && (
                          <div style={{ marginBottom: 8, padding: '8px 12px', background: 'rgba(59,130,246,0.08)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.2)' }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#3b82f6', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>👨‍⚕️ Doctor's Instructions</div>
                            <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{order.instructions}</div>
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 600 }}>{order.route}</span>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: `${sc}20`, color: sc }}>{STATUS_LABELS[order.status]}</span>
                            {order.is_paid ? (
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: 'rgba(16,185,129,0.15)', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Check size={11} /> Paid {order.total_price > 0 ? `(KES ${order.total_price})` : ''} {order.payment_method ? `· ${order.payment_method.toUpperCase()}` : ''}
                              </span>
                            ) : Number(order.total_price) > 0 ? (
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <AlertTriangle size={11} /> Unpaid: KES {order.total_price}
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: 'rgba(107,114,128,0.15)', color: '#9ca3af' }}>
                                ⚪ Included / Free
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                            {order.dosage && <span>💊 {order.dosage}</span>}
                            {order.frequency && <span>🔄 {order.frequency}</span>}
                            {order.quantity && <span>📦 Qty: {order.quantity}</span>}
                            {Number(order.unit_price) > 0 && <span>💵 Price: KES {order.unit_price}</span>}
                          </div>
                          {order.instructions && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>📋 {order.instructions}</div>}
                          {order.administered_at && <div style={{ fontSize: 11, color: '#10b981', marginTop: 4 }}>✅ Given at {new Date(order.administered_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</div>}
                          {order.nurse_report && <div style={{ marginTop:6, padding:'8px 10px', background:'rgba(16,185,129,0.1)', borderRadius:8, fontSize:12, color:'#10b981', border:'1px solid rgba(16,185,129,0.2)' }}>📝 <strong>Nurse report:</strong> {order.nurse_report}</div>}
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
                            <textarea
                              value={nurseNotes[order.id] || order.nurse_report || ''}
                              onChange={e => setNurseNotes(p => ({ ...p, [order.id]: e.target.value }))}
                              placeholder="Nurse notes: vitals, observations, reactions, side effects..."
                              rows={3}
                              style={{ width:'100%', padding:'8px 10px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text-primary)', fontSize:11, outline:'none', fontFamily:'DM Sans, sans-serif', resize:'vertical', boxSizing:'border-box' }}
                            />
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {!order.is_paid && Number(order.total_price) > 0 && (
                                <Btn
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    setPayForm({
                                      payment_method: 'mpesa',
                                      reference_number: '',
                                      amount: String(order.total_price || ''),
                                      notes: `Payment for ${order.drug_name}`,
                                      insurance_provider: '',
                                      member_number: '',
                                      auth_code: '',
                                      item_ids: order.billing_item_id ? [order.billing_item_id] : []
                                    });
                                    setShowPayModal(true);
                                  }}
                                  style={{ padding: '4px 10px', fontSize: 11 }}
                                >
                                  <CreditCard size={12} /> Pay (KES {order.total_price})
                                </Btn>
                              )}
                              {order.status === 'pending' && (
                                <Btn size="sm" variant="success" onClick={() => handleAdminister(order.id)} disabled={administering === order.id} style={{ padding: '4px 10px', fontSize: 11 }}>
                                  {administering === order.id ? <Loader size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : <CheckCircle size={12} />} Mark as Given
                                </Btn>
                              )}
                              {order.status === 'administered' && (
                                <Btn size="sm" variant="ghost" onClick={() => handleAdminister(order.id)} disabled={administering === order.id} style={{ padding: '4px 10px', fontSize: 11 }}>
                                  💾 Update Notes
                                </Btn>
                              )}
                            </div>
                          </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </>
            )}

            {panelTab === 'procs' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>🩺 Ordered Procedures & Treatments</div>
                  <Btn size="sm" onClick={() => setShowProcForm(p => !p)}><Plus size={13} /> Order Procedure</Btn>
                </div>

                {showProcForm && (
                  <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 16, marginBottom: 16, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Order New Procedure</div>
                    
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Select Procedure from Price List</label>
                      <select
                        style={inp}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === 'custom') {
                            setNewProcedure(p => ({ ...p, procedure_name: '', procedure_code: '' }));
                          } else if (val) {
                            const selectedItem = servicePrices.find(s => s.id === parseInt(val));
                            if (selectedItem) {
                              setNewProcedure(p => ({ ...p, procedure_name: selectedItem.name, procedure_code: selectedItem.service_code || '' }));
                            }
                          }
                        }}
                      >
                        <option value="">-- Select Procedure --</option>
                        <option value="custom">✍️ [Custom Manual Entry]</option>
                        {servicePrices.filter(s => s.is_active && (s.category?.toLowerCase()?.includes('proc') || s.category?.toLowerCase()?.includes('surg') || s.name?.toLowerCase()?.includes('proc') || s.name?.toLowerCase()?.includes('dressing') || s.name?.toLowerCase()?.includes('injection'))).map(s => {
                          const codeTag = s.service_code ? (s.service_code.toUpperCase().startsWith('DHA') ? s.service_code : `DHA Code: ${s.service_code}`) : '';
                          return (
                            <option key={s.id} value={s.id}>
                              {s.name} {codeTag ? `[${codeTag}]` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Procedure Name *</label>
                      <input value={newProcedure.procedure_name} onChange={e => setNewProcedure(p => ({ ...p, procedure_name: e.target.value }))} placeholder="e.g. Sterile Dressing Change" style={inp} />
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Procedure Code (Optional)</label>
                      <input value={newProcedure.procedure_code} onChange={e => setNewProcedure(p => ({ ...p, procedure_code: e.target.value }))} placeholder="e.g. PROC-1" style={inp} />
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Clinical Notes / Instructions</label>
                      <textarea value={newProcedure.notes} onChange={e => setNewProcedure(p => ({ ...p, notes: e.target.value }))} placeholder="Enter instructions..." style={inp} rows={2} />
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <Btn variant="ghost" onClick={() => { setShowProcForm(false); setNewProcedure({ procedure_name: '', procedure_code: '', notes: '' }); }} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
                      <Btn onClick={handleOrderProcedure} disabled={procSaving} style={{ flex: 1, justifyContent: 'center' }}>
                        {procSaving ? <Loader size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Plus size={13} />} Order & Bill
                      </Btn>
                    </div>
                  </div>
                )}

                {procedures.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-faint)' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🩺</div>
                    <div style={{ fontSize: 14 }}>No procedures ordered yet</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {procedures.map((p, idx) => {
                      const isCompleted = p.outcome && (p.outcome.includes('Completed') || p.outcome.includes('completed'));
                      return (
                        <div key={idx} style={{ padding: 16, borderRadius: 10, background: 'var(--bg-elevated)', border: `1px solid ${isCompleted ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{p.procedure_name}</div>
                              {p.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>📝 {p.notes}</div>}
                              {p.outcome && (
                                <div style={{ fontSize: 12, color: isCompleted ? '#10b981' : 'var(--accent)', marginTop: 4 }}>
                                  <strong>Status/Outcome:</strong> {p.outcome}
                                </div>
                              )}

                              {!isCompleted && (
                                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px dashed var(--border)', paddingTop: 8 }}>
                                  <textarea
                                    placeholder="Enter procedure outcome notes & observations..."
                                    value={procOutcomeNotes[p.id] || ''}
                                    onChange={e => setProcOutcomeNotes(prev => ({ ...prev, [p.id]: e.target.value }))}
                                    rows={2}
                                    style={{ ...inp, fontSize: 11, padding: '6px 10px' }}
                                  />
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <Btn
                                      size="sm"
                                      variant="success"
                                      onClick={() => handleCompleteProcedure(p.id)}
                                      disabled={completingProc === p.id}
                                      style={{ padding: '4px 10px', fontSize: 11 }}
                                    >
                                      {completingProc === p.id ? 'Saving...' : '✓ Complete & Record'}
                                    </Btn>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {panelTab === 'billing' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>💳 Injection Services & Fees Billing</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Real-time billing items and payment settlement for visit #{selected.visit_number}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Btn size="sm" variant="ghost" onClick={() => fetchBillingSummary(selected.id)}>
                      <RefreshCw size={12} /> Refresh
                    </Btn>
                    <Btn size="sm" variant="secondary" onClick={() => setShowAddServiceModal(true)}>
                      <Plus size={12} /> + Bill Service Fee
                    </Btn>
                    {billingSummary.total_pending > 0 && (
                      <Btn
                        size="sm"
                        variant="success"
                        onClick={() => {
                          setPayForm({
                            payment_method: 'mpesa',
                            reference_number: '',
                            amount: String(billingSummary.total_pending || ''),
                            notes: 'Settling all pending injection room charges',
                            insurance_provider: '',
                            member_number: '',
                            auth_code: '',
                            item_ids: []
                          });
                          setShowPayModal(true);
                        }}
                        style={{ fontWeight: 700 }}
                      >
                        <DollarSign size={13} /> Collect Full Payment (KES {billingSummary.total_pending})
                      </Btn>
                    )}
                  </div>
                </div>

                {/* Financial Overview Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
                  <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Total Billed</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>KES {Number(billingSummary.total_billed || 0).toLocaleString()}</div>
                  </div>
                  <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid rgba(16,185,129,0.3)' }}>
                    <div style={{ fontSize: 11, color: '#10b981', marginBottom: 4 }}>Paid / Settled</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>KES {Number(billingSummary.total_paid || 0).toLocaleString()}</div>
                  </div>
                  <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg-elevated)', border: billingSummary.total_pending > 0 ? '1px solid rgba(239,68,68,0.4)' : '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: billingSummary.total_pending > 0 ? '#ef4444' : 'var(--text-muted)', marginBottom: 4 }}>Pending Collection</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: billingSummary.total_pending > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                      KES {Number(billingSummary.total_pending || 0).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Financial Clearance</div>
                    <div>
                      {billingSummary.total_pending > 0 ? (
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 800 }}>
                          ⚠️ Payment Pending
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: 'rgba(16,185,129,0.15)', color: '#10b981', fontWeight: 800 }}>
                          ✅ Fully Cleared
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                {billingItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-faint)', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
                    <div style={{ fontSize: 14 }}>No billing items found for injection services in this visit.</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Adding a drug order automatically bills the medication and administration fee.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {billingItems.map((item) => {
                      const isPaid = item.status === 'paid';
                      const isWaived = item.status === 'waived';
                      return (
                        <div
                          key={item.id}
                          style={{
                            padding: '14px 16px',
                            borderRadius: 8,
                            background: 'var(--bg-elevated)',
                            border: `1px solid ${isPaid ? 'rgba(16,185,129,0.3)' : isWaived ? 'var(--border)' : 'rgba(239,68,68,0.3)'}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 12,
                            flexWrap: 'wrap'
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{item.item_name}</span>
                              {item.service_code && (
                                <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'monospace', background: 'var(--accent-soft)', padding: '1px 6px', borderRadius: 4 }}>
                                  {item.service_code}
                                </span>
                              )}
                              <span style={{
                                fontSize: 11, padding: '2px 8px', borderRadius: 12, fontWeight: 700,
                                background: isPaid ? 'rgba(16,185,129,0.15)' : isWaived ? 'rgba(107,114,128,0.15)' : 'rgba(239,68,68,0.15)',
                                color: isPaid ? '#10b981' : isWaived ? '#9ca3af' : '#ef4444'
                              }}>
                                {isPaid ? '✅ Paid' : isWaived ? '⚪ Waived' : '⏳ Pending'}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                              <span>Qty: {item.quantity}</span>
                              <span>Unit Price: KES {Number(item.unit_price || 0).toLocaleString()}</span>
                              <span>Total: <strong style={{ color: 'var(--text-primary)' }}>KES {Number(item.total_price || 0).toLocaleString()}</strong></span>
                              {item.payment_method && <span>Method: <strong>{item.payment_method.toUpperCase()}</strong></span>}
                              {item.reference_number && <span>Ref: {item.reference_number}</span>}
                            </div>
                          </div>

                          {!isPaid && !isWaived && (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <Btn
                                size="sm"
                                variant="ghost"
                                onClick={() => handleWaiveItem(item.id)}
                                style={{ fontSize: 11, color: 'var(--text-muted)' }}
                              >
                                Waive
                              </Btn>
                              <Btn
                                size="sm"
                                variant="success"
                                onClick={() => {
                                  setPayForm({
                                    payment_method: 'mpesa',
                                    reference_number: '',
                                    amount: String(item.total_price || ''),
                                    notes: `Settling ${item.item_name}`,
                                    insurance_provider: '',
                                    member_number: '',
                                    auth_code: '',
                                    item_ids: [item.id]
                                  });
                                  setShowPayModal(true);
                                }}
                                style={{ fontSize: 11 }}
                              >
                                <CreditCard size={12} /> Pay KES {item.total_price}
                              </Btn>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <Btn variant="success" onClick={handleReturnToDoctor} disabled={returning} style={{ width: '100%', justifyContent: 'center', padding: '12px 0' }}>
                {returning ? <Loader size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> : <CheckCircle size={15} />}
                ✅ Complete — Return to Doctor
              </Btn>
            </div>
          </Card>
        </div>

        {/* Modal: Collect Payment */}
        {showPayModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 460, boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>💳 Collect Injection Payment</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Patient: {selected.patient_name} · Visit #{selected.visit_number}</div>
                </div>
                <button onClick={() => setShowPayModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Payment Method</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
                    {PAYMENT_METHODS.map(m => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setPayForm(p => ({ ...p, payment_method: m.value }))}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: payForm.payment_method === m.value ? '2px solid var(--accent)' : '1px solid var(--border)',
                          background: payForm.payment_method === m.value ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                          color: payForm.payment_method === m.value ? 'var(--accent)' : 'var(--text-primary)'
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Amount to Collect (KES)</label>
                  <input
                    type="number"
                    value={payForm.amount}
                    onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="Enter amount in KES"
                    style={{ ...inp, fontSize: 15, fontWeight: 700 }}
                  />
                </div>

                {payForm.payment_method === 'mpesa' && (
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>M-Pesa Transaction Code</label>
                    <input
                      type="text"
                      value={payForm.reference_number}
                      onChange={e => setPayForm(p => ({ ...p, reference_number: e.target.value.toUpperCase() }))}
                      placeholder="e.g. QRT987654"
                      style={{ ...inp, textTransform: 'uppercase' }}
                    />
                  </div>
                )}

                {(payForm.payment_method === 'insurance' || payForm.payment_method === 'sha') && (
                  <>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Provider / Scheme</label>
                      <input
                        type="text"
                        value={payForm.insurance_provider}
                        onChange={e => setPayForm(p => ({ ...p, insurance_provider: e.target.value }))}
                        placeholder={payForm.payment_method === 'sha' ? 'Social Health Authority (SHA)' : 'e.g. Jubilee, AAR, CIC'}
                        style={inp}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Member #</label>
                        <input
                          type="text"
                          value={payForm.member_number}
                          onChange={e => setPayForm(p => ({ ...p, member_number: e.target.value }))}
                          placeholder="Member ID"
                          style={inp}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Pre-Auth / Claim Code</label>
                        <input
                          type="text"
                          value={payForm.auth_code}
                          onChange={e => setPayForm(p => ({ ...p, auth_code: e.target.value }))}
                          placeholder="Auth Code"
                          style={inp}
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Notes (Optional)</label>
                  <input
                    type="text"
                    value={payForm.notes}
                    onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="e.g. Injection fee paid at station"
                    style={inp}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <Btn variant="ghost" onClick={() => setShowPayModal(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
                  <Btn variant="success" onClick={handlePayBill} disabled={payingBill} style={{ flex: 2, justifyContent: 'center', fontWeight: 700 }}>
                    {payingBill ? <Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Check size={14} />} Confirm Payment (KES {payForm.amount || 0})
                  </Btn>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Bill Injection Service */}
        {showAddServiceModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>💉 Bill Injection Service / Fee</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Add standard administration fee or consumable to patient bill</div>
                </div>
                <button onClick={() => setShowAddServiceModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
                    Quick Select Standard Procedure
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                    {INJECTION_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setServiceForm({
                            item_name: p.name,
                            service_code: p.code,
                            unit_price: String(p.price),
                            quantity: 1,
                            description: p.desc
                          });
                        }}
                        style={{
                          textAlign: 'left',
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: 'var(--bg-elevated)',
                          border: serviceForm.service_code === p.code ? '2px solid var(--accent)' : '1px solid var(--border)',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginTop: 2 }}>KES {p.price}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Service / Procedure Name *</label>
                  <input
                    type="text"
                    value={serviceForm.item_name}
                    onChange={e => setServiceForm(p => ({ ...p, item_name: e.target.value }))}
                    placeholder="e.g. IM Injection Administration Fee"
                    style={inp}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Price (KES) *</label>
                    <input
                      type="number"
                      value={serviceForm.unit_price}
                      onChange={e => setServiceForm(p => ({ ...p, unit_price: e.target.value }))}
                      placeholder="0"
                      style={inp}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Quantity</label>
                    <input
                      type="number"
                      min={1}
                      value={serviceForm.quantity}
                      onChange={e => setServiceForm(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
                      style={inp}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description / Notes</label>
                  <input
                    type="text"
                    value={serviceForm.description}
                    onChange={e => setServiceForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Optional notes"
                    style={inp}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <Btn variant="ghost" onClick={() => setShowAddServiceModal(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
                  <Btn variant="success" onClick={handleAddService} disabled={addingService} style={{ flex: 2, justifyContent: 'center', fontWeight: 700 }}>
                    {addingService ? <Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Plus size={14} />} Add to Patient Bill
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

  // ── MAIN VIEW ────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
              💉 Injection Room
              {tab === 'queue' && filtered.length > 0 && (
                <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'rgba(245,158,11,0.2)', color: '#f59e0b', fontWeight: 700 }}>{filtered.length} patients</span>
              )}
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{user?.full_name} · {clock.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
          </div>
          <Btn variant="ghost" onClick={tab === 'queue' ? fetchVisits : fetchHistory}><RefreshCw size={14} /> Refresh</Btn>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', borderRadius: 8, padding: 3, marginBottom: 12, width: 'fit-content' }}>
          {[{ key: 'queue', label: '💉 Queue' }, { key: 'history', label: '📋 History' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: tab === t.key ? 'var(--accent)' : 'transparent',
              color: tab === t.key ? '#0F1612' : 'var(--text-muted)'
            }}>{t.label}</button>
          ))}
        </div>

        {tab === 'queue' && (
          <>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'In Room', value: stats.in_injection || filtered.length, color: '#f59e0b' },
                { label: 'With Doctor', value: stats.with_doctor || 0, color: '#a855f7' },
                { label: 'Discharged', value: stats.discharged || 0, color: '#10b981' },
              ].map(s => (
                <div key={s.label} style={{ padding: '10px 16px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient..."
                  style={{ width: '100%', padding: '9px 9px 9px 36px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>}
              </div>
              <input type="date" value={queueDate} onChange={e => setQueueDate(e.target.value)}
                style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
            </div>
          </>
        )}

        {tab === 'history' && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={histSearch} onChange={e => setHistSearch(e.target.value)} placeholder="Search name, number or phone..."
                style={{ width: '100%', padding: '9px 9px 9px 36px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              {histSearch && <button onClick={() => setHistSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>}
            </div>
            <input type="date" value={histDate} onChange={e => setHistDate(e.target.value)}
              style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {tab === 'queue' && (
          loading ? <div style={{ textAlign: 'center', padding: 80 }}><Loader size={32} color="var(--accent)" style={{ animation: 'spin 0.8s linear infinite' }} /></div>
          : filtered.length === 0 ? (
            <Card style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💉</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-faint)', marginBottom: 6 }}>No patients in injection room</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Patients sent here by doctor will appear</div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(v => {
                const pendingCount = (v.orders || []).filter(o => o.status?.toLowerCase() === 'pending').length;
                const doneCount = (v.orders || []).filter(o => o.status?.toLowerCase() === 'administered').length;
                const hasUnpaid = (v.orders || []).some(o => !o.is_paid && Number(o.total_price) > 0);
                return (
                  <Card key={v.id} style={{ padding: '14px 18px', cursor: 'pointer', borderLeft: '5px solid #f59e0b' }}
                    onClick={() => openPatient(v)}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{v.patient_name}</span>
                          <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'monospace', background: 'var(--accent-soft)', padding: '1px 6px', borderRadius: 4 }}>{v.patient_number}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.gender} · {getAge(v.date_of_birth)}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {(v.orders || []).length > 0 ? (
                            <>
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(245,158,11,0.2)', color: '#f59e0b', fontWeight: 700 }}>⏳ {pendingCount} pending</span>
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(16,185,129,0.2)', color: '#10b981', fontWeight: 700 }}>✅ {doneCount} given</span>
                              {hasUnpaid ? (
                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.2)', color: '#ef4444', fontWeight: 700 }}>⚠️ Unpaid Bill</span>
                              ) : (
                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(16,185,129,0.2)', color: '#10b981', fontWeight: 700 }}>💳 Cleared</span>
                              )}
                            </>
                          ) : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No orders yet</span>}
                          {v.temperature && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>T {v.temperature}°C</span>}
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}><Clock size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />{Math.floor((Date.now() - new Date(v.visit_date)) / 60000)}min</span>
                        </div>
                      </div>
                      <Btn size="sm">Manage →</Btn>
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        )}

        {tab === 'history' && (
          histLoading ? <div style={{ textAlign: 'center', padding: 80 }}><Loader size={32} color="var(--accent)" style={{ animation: 'spin 0.8s linear infinite' }} /></div>
          : history.length === 0 ? (
            <Card style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-faint)', marginBottom: 6 }}>No records found</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Try a different date or search term</div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{history.length} record{history.length !== 1 ? 's' : ''} for {new Date(histDate + 'T00:00:00').toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
              {history.map(v => {
                const orders = v.orders || [];
                const done = orders.filter(o => o.status === 'administered').length;
                return (
                  <Card key={v.id} onClick={() => fetchVisitOrders(v.id)} style={{ padding: '14px 18px', cursor: 'pointer', borderLeft: `4px solid ${v.status === 'discharged' ? '#10b981' : '#a855f7'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{v.patient_name}</span>
                          <span style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'monospace', background: 'var(--accent-soft)', padding: '1px 6px', borderRadius: 4 }}>{v.patient_number}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.gender} · {getAge(v.date_of_birth)}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(16,185,129,0.2)', color: '#10b981', fontWeight: 700 }}>✅ {done}/{orders.length} given</span>
                          <span style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: 'monospace' }}>{v.visit_number}</span>
                        </div>
                        {orders.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {orders.map((o, i) => (
                              <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: o.status === 'administered' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: o.status === 'administered' ? '#10b981' : '#f59e0b', border: `1px solid ${o.status === 'administered' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
                                {o.drug_name} {o.dosage} ({o.route})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'right', flexShrink: 0 }}>
                        {new Date(v.visit_date).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {/* Orders Modal */}
      {selectedVisitOrders && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002, padding: 16 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', width: '100%', maxWidth: 600, maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Injection Orders</h3>
              <button onClick={() => setSelectedVisitOrders(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            <div style={{ padding: 16 }}>
              {ordersLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><Loader size={24} color="var(--accent)" style={{ animation: 'spin 0.8s linear infinite' }} /></div>
              ) : selectedVisitOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-faint)' }}>No orders found</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selectedVisitOrders.map(order => (
                    <div key={order.id} style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{order.drug_name}</span>
                        </div>
                        {/* Treatment Plan (read-only) */}
                        {selected?.management_plan && (
                          <div style={{ marginBottom: 8, padding: '8px 12px', background: 'rgba(168,85,247,0.08)', borderRadius: 8, border: '1px solid rgba(168,85,247,0.2)' }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#a855f7', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📋 Doctor's Treatment Plan</div>
                            <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{selected.management_plan}</div>
                          </div>
                        )}
                        {/* Doctor's Instructions (read-only) */}
                        {order.instructions && (
                          <div style={{ marginBottom: 8, padding: '8px 12px', background: 'rgba(59,130,246,0.08)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.2)' }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: '#3b82f6', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>👨‍⚕️ Doctor's Instructions</div>
                            <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{order.instructions}</div>
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: order.status === 'administered' ? '#10b98120' : '#ef444420', color: order.status === 'administered' ? '#10b981' : '#ef4444' }}>
                          {order.status === 'administered' ? '✅ Given' : '⏳ Pending'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {order.dosage && <span>Dosage: {order.dosage}</span>}
                        {order.route && <span>Route: {order.route}</span>}
                        {order.frequency && <span>Frequency: {order.frequency}</span>}
                        {order.duration && <span>Duration: {order.duration}</span>}
                      </div>
                      {order.nurse_report && (
                        <div style={{ marginTop: 6, padding: 8, background: 'var(--bg-base)', borderRadius: 6, fontSize: 12, color: 'var(--text-primary)' }}>
                          <strong>Nurse Report:</strong> {order.nurse_report}
                        </div>
                      )}
                      {order.administered_at && (
                        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
                          Given at: {new Date(order.administered_at).toLocaleString('en-KE')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
