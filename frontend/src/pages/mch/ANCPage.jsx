import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Heart, ArrowLeft, Search, RefreshCw, X, Save, Plus, AlertTriangle, ChevronDown, ChevronUp, Shield, Eye } from 'lucide-react';
import LabOrderModal from "./components/LabOrderModal";

const s = {
  card: { background:'var(--bg-surface)', borderRadius:14, border:'1px solid var(--border)' },
  input: { width:'100%', padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' },
  label: { fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5, fontWeight:600 },
};
const Card = ({ children, style={}, ...p }) => <div style={{ ...s.card, ...style }} {...p}>{children}</div>;
const Btn = ({ children, variant='primary', size='md', ...p }) => (
  <button {...p} style={{ display:'inline-flex', alignItems:'center', gap:6,
    padding:size==='sm'?'6px 13px':size==='lg'?'13px 26px':'10px 20px',
    background:variant==='primary'?'var(--accent)':variant==='danger'?'#ef4444':variant==='warning'?'#f59e0b':variant==='success'?'#10b981':'var(--bg-elevated)',
    border:variant==='ghost'?'1px solid var(--border)':'none', borderRadius:9,
    color:variant==='primary'||variant==='warning'||variant==='success'?'#0F1612':variant==='danger'?'#fff':'var(--text-primary)',
    fontSize:size==='sm'?11:13, fontWeight:600, cursor:p.disabled?'not-allowed':'pointer',
    fontFamily:'DM Sans, sans-serif', opacity:p.disabled?0.6:1, transition:'all 0.15s', ...p.style }}>{children}</button>
);
const Field = ({ label, children }) => <div><label style={s.label}>{label}</label>{children}</div>;
const Inp = ({ label, ...p }) => <Field label={label}><input {...p} style={s.input}/></Field>;
const Sel = ({ label, children, ...p }) => <Field label={label}><select {...p} style={{ ...s.input }}>{children}</select></Field>;
const Txt = ({ label, ...p }) => <Field label={label}><textarea {...p} style={{ ...s.input, resize:'vertical' }}/></Field>;

const COLOR = '#ec4899';

const calcEDD = lmp => {
  if (!lmp) return '';
  const d = new Date(lmp); d.setDate(d.getDate() + 280);
  return d.toISOString().split('T')[0];
};
const calcGA = lmp => {
  if (!lmp) return '';
  const wks = Math.floor((Date.now() - new Date(lmp)) / (7 * 24 * 3600 * 1000));
  return wks > 0 ? String(wks) : '';
};

const BLANK_FORM = {
  anc_clinic_number:'', gravida:'', para:'', lmp:'', edd:'', gestation_age:'',
  weight:'', blood_pressure:'', fundal_height:'', fetal_heart_rate:'',
  marital_status:'', occupation:'', next_of_kin:'', next_of_kin_phone:'',
  risk_factors:'', complaints:'', treatment_given:'', next_appointment:'',
  blood_group:'', rh_factor:'', hemoglobin:'', hiv_test:'', vdrl:'',
  hiv_test_date:'', vdrl_date:'', lab_reference:'', performed_by:'',
  admission_ward:'',
};

const ANC_VACCINES = [
  { name: 'Tetanus Toxoid (TT1)', dose: 'Dose 1' },
  { name: 'Tetanus Toxoid (TT2)', dose: 'Dose 2' },
  { name: 'Tetanus Toxoid (TT3)', dose: 'Dose 3' },
  { name: 'Tetanus Toxoid (TT4)', dose: 'Dose 4' },
  { name: 'Tetanus Toxoid (TT5)', dose: 'Dose 5' },
  { name: 'Influenza (Flu)', dose: 'Single Dose' },
  { name: 'Tdap (Tetanus, Diphtheria, Pertussis)', dose: 'Single Dose' },
  { name: 'Hepatitis B (HepB)', dose: 'Dose 1' },
  { name: 'Hepatitis B (HepB) Booster', dose: 'Booster' },
];

export default function ANCPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector(s => s.auth);
  const [tab, setTab] = useState('queue');
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [qL, setQL] = useState(false);
  const [hL, setHL] = useState(false);
  const [sel, setSel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [action, setAction] = useState('discharge');
  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [formTab, setFormTab] = useState('obs');

  const [servicePrices, setServicePrices] = useState([]);
  const [patientImmunizations, setPatientImmunizations] = useState([]);
  const [loadingImmHistory, setLoadingImmHistory] = useState(false);
  const [savingImm, setSavingImm] = useState(false);
  const [immForm, setImmForm] = useState({
    vaccine: '',
    dose: '',
    date_given: today,
    next_due_date: '',
    batch_number: '',
    site: '',
    adverse_reaction: '',
    notes: '',
  });

  const fetchServicePrices = async () => {
    try {
      const { data } = await api.get('/billing/service-prices');
      setServicePrices(data.data || []);
    } catch {}
  };

  const fetchPatientImmunizations = async (patientId) => {
    setLoadingImmHistory(true);
    try {
      const { data } = await api.get(`/mch/immunization?patient_id=${patientId}`);
      setPatientImmunizations(data.data || []);
    } catch {
      setPatientImmunizations([]);
    }
    setLoadingImmHistory(false);
  };

  const handleSaveImmunization = async () => {
    if (!immForm.vaccine) {
      toast.error('Please select a vaccine');
      return;
    }
    setSavingImm(true);
    try {
      const matchedPriceObj = servicePrices.find(p => p.name.toLowerCase() === immForm.vaccine.toLowerCase() || p.service_code?.toLowerCase() === immForm.vaccine.toLowerCase());
      await api.post('/mch/immunization', {
        ...immForm,
        patient_id: sel.patient_id,
        visit_id: sel.id,
        vaccine_price: matchedPriceObj ? parseFloat(matchedPriceObj.price) : 0,
        vaccine_code: matchedPriceObj ? matchedPriceObj.service_code : null
      });
      toast.success('Immunization recorded & billed successfully!');
      fetchPatientImmunizations(sel.patient_id);
      setImmForm({
        vaccine: '',
        dose: '',
        date_given: today,
        next_due_date: '',
        batch_number: '',
        site: '',
        adverse_reaction: '',
        notes: '',
      });
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to record immunization');
    } finally {
      setSavingImm(false);
    }
  };

  useEffect(() => {
    fetchServicePrices();
  }, []);

  useEffect(() => {
    if (location.state?.autoAttendVisit) {
      openVisit(location.state.autoAttendVisit);
    }
  }, [location.state]);
  const [showFlags, setShowFlags] = useState(false);
  const [flags, setFlags] = useState([]);
  const [flagText, setFlagText] = useState('');
  const [existingANC, setExistingANC] = useState(null);

  // ─── Lab Integration State ───
  const [labOrders, setLabOrders] = useState([]);
  const [drugForm, setDrugForm] = useState({ name: '', dosage: '', qty: '', price: '' });
  const [drugSearch, setDrugSearch] = useState({});
  const [drugResults, setDrugResults] = useState({});
  const [icdSearch, setIcdSearch] = useState('');
  const [icdResults, setIcdResults] = useState([]);
  const [showLabModal, setShowLabModal] = useState(false);
  const [currentLabOrder, setCurrentLabOrder] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);

  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const fetchQueue = async () => {
    setQL(true);
    try {
      const { data } = await api.get('/mch/queue');
      setQueue((data.data || []).filter(v => !v.mch_service || v.mch_service === 'mch_anc'));
    } catch { toast.error('Failed to load queue'); }
    setQL(false);
  };

  const fetchHistory = async () => {
    setHL(true);
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
      if (search) params.append('search', search);
      const { data } = await api.get('/mch/anc?' + params.toString());
      setHistory(data.data || []);
    } catch { toast.error('Failed to load ANC history'); }
    setHL(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchQueue(); }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (tab === 'history') fetchHistory(); }, [tab]);

  // ─── Lab Functions ───
  const fetchLabOrders = async (ancId) => {
    if (!ancId) return;
    try {
      const response = await api.get(`/mch/lab/orders/?anc_id=${ancId}`);
      setLabOrders(response.data.data || []);
    } catch (e) {
      console.error("Failed to fetch lab orders");
    }
  };

  const handleOrderLab = async (testType) => {
    if (!existingANC?.id) {
      toast.error("Save ANC registration first before ordering labs");
      return;
    }
    try {
      const response = await api.post("/mch/lab/order/", {
        anc_encounter_id: existingANC.id,
        patient_id: sel.patient_id,
        test_type: testType
      });
      setCurrentLabOrder(response.data.lab_order_id);
      setShowLabModal(true);
      toast.success("Lab order created – send to billing");
    } catch (e) {
      toast.error("Failed to order lab test");
    }
  };

  const handleOrderDrug = async () => {
    if (!existingANC?.visit_id) { toast.error('Save ANC visit first'); return; }
    if (!drugForm.name) { toast.error('Enter drug name'); return; }
    try {
      await api.post('/anc/orders/drug', {
        visit_id: existingANC.visit_id,
        patient_id: sel.patient_id,
        drug_name: drugForm.name,
        dosage: drugForm.dosage,
        quantity: parseInt(drugForm.qty) || 1,
        drug_price: parseFloat(drugForm.price) || 0,
      });
      toast.success('Drug ordered');
      setDrugForm({ name: '', dosage: '', qty: '', price: '' });
    } catch (e) { toast.error('Failed to order drug'); }
  };

  // ── Stock search (same as OPD) ─────────────────────────
  const searchDrug = async (i, query) => {
    if (query.length < 2) { setDrugResults(p => ({...p, [i]: []})); return; }
    try {
      const res = await api.get('/products?search=' + encodeURIComponent(query) + '&limit=6');
      setDrugResults(p => ({...p, [i]: res.data.data || []}));
    } catch { setDrugResults(p => ({...p, [i]: []})); }
  };

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
    return { dosage };
  };

  const selectDrug = (i, product) => {
    const { dosage } = parseDosageAndRoute(product.name, product.category_name);
    setDrugForm({
      ...drugForm,
      name: product.name,
      dosage: dosage || product.strength || '',
      price: product.selling_price || 0,
      product_id: product.id,
    });
    setDrugResults(p => ({...p, [i]: []}));
    setDrugSearch(p => ({...p, [i]: product.name}));
  };

  // ── ICD-11 search ────────────────────────────────────
  const searchICD = async (query) => {
    if (query.length < 2) { setIcdResults([]); return; }
    try {
      const res = await api.get('/icd11/search?term=' + encodeURIComponent(query));
      setIcdResults(res.data || []);
    } catch { setIcdResults([]); }
  };

  const handleOrderLabICD = async (testName, testCode) => {
    if (!existingANC?.visit_id) { toast.error('Save ANC visit first'); return; }
    try {
      await api.post('/anc/orders/lab', {
        visit_id: existingANC.visit_id,
        patient_id: sel.patient_id,
        test_name: testName,
        test_code: testCode || null,
        lab_price: 500,
      });
      toast.success('Lab ordered: ' + testName);
    } catch (e) { toast.error('Failed to order lab'); }
  };

  const handleConfirmPayment = async () => {
    setBillingLoading(true);
    try {
      await api.post("/mch/lab/confirm-payment/", {
        lab_order_id: currentLabOrder
      });
      setShowLabModal(false);
      toast.success("Payment confirmed – lab tech notified");
      fetchLabOrders(existingANC.id);
    } catch (e) {
      toast.error("Payment confirmation failed");
    }
    setBillingLoading(false);
  };

  const getStatusColor = (status) => {
    const colors = {
      "PENDING_BILLING": "#f59e0b",
      "PAID": "#3b82f6",
      "IN_PROGRESS": "#8b5cf6",
      "COMPLETED": "#10b981",
    };
    return colors[status] || "var(--text-muted)";
  };

  const openVisit = async (v) => {
    setSel(v);
    setForm({ ...BLANK_FORM });
    setFormTab('obs');
    setFlags([]);
    setExistingANC(null);
    setLabOrders([]);
    fetchPatientImmunizations(v.patient_id);
    try {
      const { data } = await api.get('/mch/anc?search=' + encodeURIComponent(v.patient_name || ''));
      const existing = (data.data || []).find(a => a.patient_id === v.patient_id);
      if (existing) {
        setExistingANC(existing);
        setForm(f => ({
          ...f,
          anc_clinic_number: existing.anc_clinic_number || '',
          gravida: existing.gravida || '',
          para: existing.para || '',
          lmp: existing.lmp ? existing.lmp.split('T')[0] : '',
          edd: existing.edd ? existing.edd.split('T')[0] : '',
          gestation_age: existing.gestation_age || '',
          marital_status: existing.marital_status || '',
          occupation: existing.occupation || '',
          next_of_kin: existing.next_of_kin || '',
          next_of_kin_phone: existing.next_of_kin_phone || '',
        }));
        const fRes = await api.get('/mch/anc/' + existing.id + '/high-risk');
        setFlags(fRes.data.data || []);
        fetchLabOrders(existing.id);
      }
    } catch {}
    if (user?.full_name) sf('performed_by', user.full_name);
  };

  const handleSave = async () => {
    if (!sel) return;
    setSaving(true);
    try {
      let ancId = existingANC?.id;
      if (!ancId) {
        const { data } = await api.post('/mch/anc', { ...form, patient_id: sel.patient_id });
        ancId = data.data?.id;
      } else {
        await api.post('/mch/anc/' + ancId + '/visits', { ...form, visit_date: today });
      }
      if (ancId && (form.blood_group || form.hemoglobin || form.hiv_test || form.vdrl)) {
        await api.post('/mch/anc/' + ancId + '/profile', { ...form });
      }
      if (action === 'admit' && form.admission_ward) {
        await api.put('/patients/visits/' + sel.id + '/status', { status: 'admitted' });
        toast.success('ANC saved — admitted to ' + form.admission_ward);
      } else {
        await api.put('/patients/visits/' + sel.id + '/status', { status: 'discharged' });
        toast.success('ANC saved — patient discharged');
      }
      setSel(null);
      fetchQueue();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to save'); }
    setSaving(false);
  };

  const addFlag = async () => {
    if (!flagText.trim() || !existingANC) return;
    try {
      await api.post('/mch/anc/' + existingANC.id + '/high-risk', { condition: flagText, notes: '' });
      const fRes = await api.get('/mch/anc/' + existingANC.id + '/high-risk');
      setFlags(fRes.data.data || []);
      setFlagText('');
      toast.success('High risk flag added');
    } catch { toast.error('Failed to add flag'); }
  };

  const removeFlag = async (flagId) => {
    try {
      await api.delete('/mch/anc/high-risk/' + flagId);
      setFlags(f => f.filter(x => x.id !== flagId));
      toast.success('Flag removed');
    } catch { toast.error('Failed to remove'); }
  };

  const FORM_TABS = [
    { id:'obs', label:'Obstetric' },
    { id:'vitals', label:'Vitals' },
    { id:'lab', label:'Lab / Profile' },
    { id:'immunization', label:'Immunizations' },
    { id:'social', label:'Social' },
    { id:'risk', label:'Risk Flags' },
  ];

  return (
    <div style={{ padding:24, height:'100vh', overflow:'auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => navigate('/app/mch')} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:4 }}><ArrowLeft size={20}/></button>
          <div>
            <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', margin:0, display:'flex', alignItems:'center', gap:9 }}>
              <Heart size={22} color={COLOR}/> ANC Clinic
            </h1>
            <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>{queue.length} waiting · Antenatal Care · MOH 510</p>
          </div>
        </div>
        <Btn variant="ghost" size="sm" onClick={fetchQueue}><RefreshCw size={13}/> Refresh</Btn>
      </div>

      <div style={{ display:'flex', gap:4, marginBottom:20, background:'var(--bg-surface)', borderRadius:10, padding:4, border:'1px solid var(--border)', width:'fit-content' }}>
        {[{ id:'queue', label:`🏥 Queue (${queue.length})` }, { id:'history', label:'📋 All Registrations' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'7px 20px', borderRadius:7, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
            background:tab===t.id?COLOR:'transparent', color:tab===t.id?'#fff':'var(--text-muted)', fontFamily:'DM Sans, sans-serif', transition:'all 0.15s'
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'queue' && (
        qL ? <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}>Loading...</div>
        : queue.length === 0
          ? <Card style={{ textAlign:'center', padding:64 }}>
              <Heart size={42} color="var(--text-faint)" style={{ marginBottom:12 }}/>
              <p style={{ color:'var(--text-muted)', fontSize:14, fontWeight:600 }}>No patients in ANC queue</p>
              <p style={{ color:'var(--text-faint)', fontSize:12, marginTop:4 }}>Patients routed to ANC from Triage/Reception appear here</p>
            </Card>
          : <div style={{ display:'grid', gap:10 }}>
              {queue.map((v, idx) => (
                <Card key={v.id} style={{ padding:'16px 20px', cursor:'pointer', transition:'all 0.18s' }}
                  onClick={() => openVisit(v)}
                  onMouseEnter={e => { e.currentTarget.style.borderColor=COLOR; e.currentTarget.style.boxShadow=`0 4px 16px ${COLOR}20`; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.boxShadow='none'; }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                      <div style={{ width:44, height:44, borderRadius:'50%', background:`${COLOR}15`, border:`2px solid ${COLOR}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:COLOR, fontSize:16 }}>{idx+1}</div>
                      <div>
                        <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{v.patient_name}</div>
                        <div style={{ fontSize:12, color:'var(--text-muted)' }}>{v.patient_number} · {v.gender}</div>
                        {v.chief_complaint && <div style={{ fontSize:11, color:'var(--text-faint)', marginTop:2 }}>CC: {v.chief_complaint}</div>}
                        {v.blood_pressure && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>BP: {v.blood_pressure_systolic}/{v.blood_pressure_diastolic} · Wt: {v.weight}kg</div>}
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      {v.priority === 'emergency' && <span style={{ fontSize:10, padding:'3px 8px', borderRadius:5, background:'#ef444420', color:'#ef4444', fontWeight:700, display:'block', marginBottom:4 }}>EMERGENCY</span>}
                      <span style={{ fontSize:10, padding:'3px 8px', borderRadius:5, background:`${COLOR}18`, color:COLOR, fontWeight:700 }}>ANC</span>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:5 }}>{new Date(v.visit_date).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})}</div>
                      <div style={{ fontSize:12, color:'var(--accent)', fontWeight:700, marginTop:4 }}>Attend →</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
      )}

      {tab === 'history' && (
        <div>
          <div style={{ background:'var(--bg-surface)', borderRadius:12, border:'1px solid var(--border)', padding:14, marginBottom:16 }}>
            <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
              <div style={{ flex:1 }}>
                <label style={s.label}>Search patient</label>
                <div style={{ position:'relative' }}>
                  <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
                  <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key==='Enter'&&fetchHistory()} placeholder="Name, ANC number..." style={{ ...s.input, paddingLeft:32 }}/>
                </div>
              </div>
              <Btn onClick={fetchHistory}><Search size={13}/> Search</Btn>
            </div>
          </div>
          {hL ? <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}>Loading...</div>
          : history.length === 0
            ? <Card style={{ textAlign:'center', padding:60 }}><Heart size={38} color="var(--text-faint)" style={{ marginBottom:10 }}/><p style={{ color:'var(--text-muted)' }}>No ANC records found</p></Card>
            : <div style={{ display:'grid', gap:10 }}>
                {history.map(r => (
                  <Card key={r.id} style={{ padding:'16px 20px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ display:'flex', gap:13, alignItems:'center' }}>
                        <div style={{ width:44, height:44, borderRadius:12, background:`${COLOR}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🤰</div>
                        <div>
                          <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{r.full_name}</div>
                          <div style={{ fontSize:12, color:'var(--text-muted)' }}>{r.patient_number} · G{r.gravida}P{r.para}</div>
                          <div style={{ fontSize:11, color:'var(--text-faint)', marginTop:2 }}>
                            LMP: {r.lmp?new Date(r.lmp).toLocaleDateString('en-KE'):'—'} · EDD: {r.edd?new Date(r.edd).toLocaleDateString('en-KE'):'—'}{r.gestation_age?` · GA: ${r.gestation_age}wks`:''}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        {r.risk_factors?.length > 0 && <AlertTriangle size={14} color="#ef4444" style={{ marginBottom:4 }}/>}
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>{new Date(r.created_at).toLocaleDateString('en-KE')}</div>
                        {r.anc_clinic_number && <div style={{ fontSize:11, color:COLOR, fontWeight:600 }}>#{r.anc_clinic_number}</div>}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
          }
        </div>
      )}

      {sel && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'var(--bg-surface)', borderRadius:18, border:'1px solid var(--border)', width:'100%', maxWidth:720, maxHeight:'93vh', overflow:'auto', padding:28 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                  <div style={{ width:40, height:40, borderRadius:11, background:`${COLOR}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🤰</div>
                  <div>
                    <h2 style={{ fontSize:17, fontWeight:800, color:'var(--text-primary)', margin:0 }}>{sel.patient_name}</h2>
                    <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>{sel.patient_number} · ANC Encounter</p>
                  </div>
                </div>
                {existingANC && <div style={{ fontSize:11, color:COLOR, fontWeight:600, background:`${COLOR}12`, display:'inline-block', padding:'3px 10px', borderRadius:6 }}>Returning ANC — {existingANC.anc_clinic_number || 'No Clinic No.'}</div>}
              </div>
              <button onClick={() => setSel(null)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={20}/></button>
            </div>

            {/* High Risk Alert Banner */}
            {(() => {
              const riskFactors = [];
              if (form.blood_pressure) {
                const parts = form.blood_pressure.split('/').map(n => parseInt(n.trim()));
                if (parts.length === 2 && (parts[0] >= 140 || parts[1] >= 90)) {
                  riskFactors.push(`Elevated BP (${form.blood_pressure} mmHg) - Possible Pre-Eclampsia / HTN`);
                }
              }
              if (form.hemoglobin && parseFloat(form.hemoglobin) < 10.0) {
                riskFactors.push(`Anemia (Hb: ${form.hemoglobin} g/dL < 10.0)`);
              }
              if (form.fetal_heart_rate) {
                const fhr = parseInt(form.fetal_heart_rate);
                if (fhr > 0 && (fhr < 110 || fhr > 160)) {
                  riskFactors.push(`Abnormal FHR (${fhr} bpm - Normal 110-160)`);
                }
              }
              if (form.gestation_age && parseInt(form.gestation_age) >= 41) {
                riskFactors.push(`Post-Dates Pregnancy (${form.gestation_age} Wks)`);
              }

              if (riskFactors.length === 0) return null;

              return (
                <div style={{ background:'#ef444415', border:'1px solid #ef444440', borderRadius:10, padding:'10px 14px', marginBottom:16, display:'flex', alignItems:'flex-start', gap:10 }}>
                  <AlertTriangle size={18} color="#ef4444" style={{ flexShrink:0, marginTop:2 }}/>
                  <div>
                    <div style={{ fontSize:12, fontWeight:800, color:'#ef4444', textTransform:'uppercase', letterSpacing:0.5 }}>
                      ⚠️ High-Risk ANC Patient Identified ({riskFactors.length} Flag{riskFactors.length > 1 ? 's' : ''})
                    </div>
                    <ul style={{ margin:'4px 0 0', paddingLeft:16, fontSize:11, color:'var(--text-primary)' }}>
                      {riskFactors.map((rf, idx) => <li key={idx}>{rf}</li>)}
                    </ul>
                  </div>
                </div>
              );
            })()}

            <div style={{ display:'flex', gap:4, marginBottom:20, background:'var(--bg-elevated)', borderRadius:10, padding:4 }}>
              {FORM_TABS.map(t => (
                <button key={t.id} onClick={() => setFormTab(t.id)} style={{
                  flex:1, padding:'7px 4px', borderRadius:7, border:'none', cursor:'pointer', fontSize:11, fontWeight:600,
                  background:formTab===t.id?COLOR:'transparent', color:formTab===t.id?'#fff':'var(--text-muted)', fontFamily:'DM Sans, sans-serif'
                }}>{t.label}</button>
              ))}
            </div>

            {formTab === 'obs' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <Inp label="ANC Clinic No." value={form.anc_clinic_number} onChange={e => sf('anc_clinic_number',e.target.value)} placeholder="ANC-2025-001"/>
                <Inp label="Gravida" type="number" min="0" value={form.gravida} onChange={e => sf('gravida',e.target.value)}/>
                <Inp label="Para" type="number" min="0" value={form.para} onChange={e => sf('para',e.target.value)}/>
                <Inp label="LMP" type="date" value={form.lmp} onChange={e => { sf('lmp',e.target.value); sf('edd',calcEDD(e.target.value)); sf('gestation_age',calcGA(e.target.value)); }}/>
                <Inp label="EDD (auto)" type="date" value={form.edd} onChange={e => sf('edd',e.target.value)}/>
                <Inp label="Gestation Age (wks)" type="number" value={form.gestation_age} onChange={e => sf('gestation_age',e.target.value)}/>
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)' }}>Next Appointment</label>
                    <button type="button" onClick={() => {
                      const ga = parseInt(form.gestation_age || '0');
                      let addWeeks = 4;
                      if (ga >= 36) addWeeks = 2;
                      else if (ga >= 30) addWeeks = 4;
                      else if (ga >= 20) addWeeks = 6;
                      else addWeeks = 8;

                      const nextDate = new Date();
                      nextDate.setDate(nextDate.getDate() + (addWeeks * 7));
                      sf('next_appointment', nextDate.toISOString().split('T')[0]);
                      toast.success(`WHO Schedule: Set next visit in ${addWeeks} weeks (${ga + addWeeks}wks GA)`);
                    }} style={{ background:'none', border:'none', color:'var(--accent)', fontSize:10, fontWeight:700, cursor:'pointer' }}>
                      ⚡ Auto WHO Schedule
                    </button>
                  </div>
                  <input type="date" value={form.next_appointment} onChange={e => sf('next_appointment',e.target.value)} style={{ width:'100%', padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13 }}/>
                </div>
                <div style={{ gridColumn:'1/-1' }}><Txt label="Complaints / History" rows={3} value={form.complaints} onChange={e => sf('complaints',e.target.value)} placeholder="Chief complaints, obstetric history..."/></div>
                <div style={{ gridColumn:'1/-1' }}><Txt label="Treatment Given / Plan" rows={3} value={form.treatment_given} onChange={e => sf('treatment_given',e.target.value)} placeholder="Medications, iron/folate, deworming, ITNs..."/></div>
              </div>
            )}

            {formTab === 'vitals' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <Inp label="Weight (kg)" type="number" step="0.1" value={form.weight} onChange={e => sf('weight',e.target.value)}/>
                <Inp label="Blood Pressure" value={form.blood_pressure} onChange={e => sf('blood_pressure',e.target.value)} placeholder="120/80 mmHg"/>
                <Inp label="Fundal Height (cm)" type="number" value={form.fundal_height} onChange={e => sf('fundal_height',e.target.value)}/>
                <Inp label="Fetal Heart Rate (bpm)" type="number" value={form.fetal_heart_rate} onChange={e => sf('fetal_heart_rate',e.target.value)} placeholder="120-160"/>
                <Inp label="Fetal Presentation" value={form.presentation||''} onChange={e => sf('presentation',e.target.value)} placeholder="Cephalic / Breech / Transverse"/>
                <Inp label="Fetal Movement" value={form.fetal_movement||''} onChange={e => sf('fetal_movement',e.target.value)} placeholder="Present / Absent"/>
                <Inp label="Oedema" value={form.oedema||''} onChange={e => sf('oedema',e.target.value)} placeholder="None / Grade 1-4"/>
                <Inp label="Temperature (°C)" type="number" step="0.1" value={form.temperature||''} onChange={e => sf('temperature',e.target.value)}/>
              </div>
            )}

            {formTab === 'lab' && (
              <div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <Sel label="Blood Group" value={form.blood_group} onChange={e => sf('blood_group',e.target.value)}>
                    <option value="">Select...</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g=><option key={g}>{g}</option>)}
                  </Sel>
                  <Sel label="Rh Factor" value={form.rh_factor} onChange={e => sf('rh_factor',e.target.value)}>
                    <option value="">Select...</option><option>Positive</option><option>Negative</option>
                  </Sel>
                  <Inp label="Haemoglobin (g/dL)" type="number" step="0.1" value={form.hemoglobin} onChange={e => sf('hemoglobin',e.target.value)}/>
                  <Inp label="Urinalysis" value={form.urinalysis||''} onChange={e => sf('urinalysis',e.target.value)} placeholder="Normal / Protein / Glucose"/>
                  <Sel label="HIV Test" value={form.hiv_test} onChange={e => sf('hiv_test',e.target.value)}>
                    <option value="">Select...</option><option>Reactive</option><option>Non-Reactive</option><option>Declined</option><option>Not Done</option>
                  </Sel>
                  <Inp label="HIV Test Date" type="date" value={form.hiv_test_date} onChange={e => sf('hiv_test_date',e.target.value)}/>
                  <Sel label="VDRL / Syphilis" value={form.vdrl} onChange={e => sf('vdrl',e.target.value)}>
                    <option value="">Select...</option><option>Reactive</option><option>Non-Reactive</option><option>Not Done</option>
                  </Sel>
                  <Inp label="VDRL Date" type="date" value={form.vdrl_date} onChange={e => sf('vdrl_date',e.target.value)}/>
                  <Inp label="Lab Reference No." value={form.lab_reference} onChange={e => sf('lab_reference',e.target.value)}/>
                  <Inp label="Performed By" value={form.performed_by} onChange={e => sf('performed_by',e.target.value)}/>
                </div>

                {/* ─── LAB ORDERING UI ─── */}
                <div style={{ gridColumn: '1/-1', marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>🩸 Order Lab Tests</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>(Billing → Processing → Results)</span>
                  </div>
                  <div style={{ position: 'relative', marginBottom: 10 }}>
                <input
                  value={icdSearch}
                  onChange={e => { setIcdSearch(e.target.value); searchICD(e.target.value); }}
                  placeholder="Search ICD-11 codes (e.g., 1F45 for Malaria, 1B10 for TB)"
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
                {icdResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px #00000040', marginTop: 4, maxHeight: 200, overflow: 'auto' }}>
                    {icdResults.map((item, idx) => (
                      <div key={idx} onClick={() => { handleOrderLabICD(item.test_name, item.code); setIcdSearch(''); setIcdResults([]); }}
                        style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{item.test_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'monospace' }}>{item.code}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {['HB','HIV','VDRL','BG','RH','URINE'].map(test => (
                      <button key={test} onClick={() => handleOrderLab(test)}
                        style={{
                          padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border)',
                          background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 11,
                          fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#0F1612'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                      >
                        Order {test}
                      </button>
                    ))}
                  </div>
                  {labOrders.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Lab Orders</div>
                      {labOrders.map(order => (
                        <div key={order.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '6px 12px', background: 'var(--bg-elevated)', borderRadius: 6, marginBottom: 4
                        }}>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{order.test_type}</span>
                          <span style={{ fontSize: 11, color: getStatusColor(order.status), fontWeight: 600 }}>{order.status.replace('_', ' ')}</span>
                          {order.result_value && <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>→ {order.result_value}</span>}
                          <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                            {order.ordered_at ? new Date(order.ordered_at).toLocaleTimeString('en-KE', {hour: '2-digit', minute: '2-digit'}) : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Drug Ordering Section ─────────────────────────── */}
            <div style={{ gridColumn: '1/-1', marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>💊 Order Drugs (Pharmacy Stock)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div style={{ position: 'relative' }}>
                <input placeholder="Search pharmacy stock..." value={drugSearch[0] || drugForm.name}
                  onChange={e => { setDrugForm({...drugForm, name: e.target.value}); setDrugSearch(p => ({...p, 0: e.target.value})); searchDrug(0, e.target.value); }}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
                {drugResults[0]?.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px #00000040', marginTop: 4, maxHeight: 200, overflow: 'auto' }}>
                    {drugResults[0].map(p => (
                      <div key={p.id} onClick={() => selectDrug(0, p)}
                        style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                          {p.generic_name && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.generic_name}</div>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: p.total_stock > 0 ? 'var(--accent)' : 'var(--danger)' }}>
                            {p.total_stock > 0 ? `✅ Stock: ${p.total_stock}` : '❌ Out'}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>KES {p.selling_price || 0}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
                <input placeholder="Dosage" value={drugForm.dosage} onChange={e => setDrugForm({...drugForm, dosage: e.target.value})}
                  style={{ padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <input placeholder="Quantity" type="number" value={drugForm.qty} onChange={e => setDrugForm({...drugForm, qty: e.target.value})}
                  style={{ padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
                <input placeholder="Price (KES)" type="number" value={drugForm.price} onChange={e => setDrugForm({...drugForm, price: e.target.value})}
                  style={{ padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
              </div>
              <button onClick={handleOrderDrug}
                style={{ padding: '8px 20px', background: 'var(--accent)', color: '#0F1612', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                Order Drug
              </button>
            </div>

            {formTab === 'immunization' && (
              <div>
                {/* Historical Immunizations */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>💉 Immunization History</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 'normal' }}>(MOH 512 Record)</span>
                  </div>
                  {loadingImmHistory ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading history...</div>
                  ) : patientImmunizations.length === 0 ? (
                    <div style={{ padding: '16px 20px', border: '1px dashed var(--border)', borderRadius: 10, textAlign: 'center', color: 'var(--text-faint)', fontSize: 12 }}>
                      No immunization history recorded for this mother
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {patientImmunizations.map(imm => (
                        <div key={imm.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{imm.vaccine}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                              Dose: {imm.dose || '—'} · Route/Site: {imm.site || '—'} · Batch: {imm.batch_number || '—'}
                            </div>
                            {imm.notes && <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>Notes: {imm.notes}</div>}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                              Given: {imm.date_given ? new Date(imm.date_given).toLocaleDateString() : '—'}
                            </div>
                            {imm.next_due_date && (
                              <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, marginTop: 2 }}>
                                Next: {new Date(imm.next_due_date).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Record New Immunization Form */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>➕ Record / Administer Vaccine</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <Sel label="Vaccine Name" value={immForm.vaccine} onChange={e => {
                      const selectedVaccine = e.target.value;
                      const preset = ANC_VACCINES.find(v => v.name === selectedVaccine);
                      setImmForm(f => ({
                        ...f,
                        vaccine: selectedVaccine,
                        dose: preset ? preset.dose : f.dose
                      }));
                    }}>
                      <option value="">Select Vaccine...</option>
                      {ANC_VACCINES.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                    </Sel>
                    <Inp label="Dose (e.g. Dose 1, Booster)" value={immForm.dose} onChange={e => setImmForm({...immForm, dose: e.target.value})} />
                    <Inp label="Date Administered" type="date" value={immForm.date_given} onChange={e => setImmForm({...immForm, date_given: e.target.value})} />
                    <Inp label="Next Due Date" type="date" value={immForm.next_due_date} onChange={e => setImmForm({...immForm, next_due_date: e.target.value})} />
                    <Inp label="Batch Number" value={immForm.batch_number} onChange={e => setImmForm({...immForm, batch_number: e.target.value})} placeholder="e.g. B90218" />
                    <Sel label="Administration Site" value={immForm.site} onChange={e => setImmForm({...immForm, site: e.target.value})}>
                      <option value="">Select Site...</option>
                      <option value="Left Deltoid (IM)">Left Deltoid (IM)</option>
                      <option value="Right Deltoid (IM)">Right Deltoid (IM)</option>
                      <option value="Left Thigh (IM)">Left Thigh (IM)</option>
                      <option value="Right Thigh (IM)">Right Thigh (IM)</option>
                      <option value="Oral">Oral (PO)</option>
                      <option value="Subcutaneous (SC)">Subcutaneous (SC)</option>
                    </Sel>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <Txt label="Adverse Reactions / Notes" rows={2} value={immForm.notes} onChange={e => setImmForm({...immForm, notes: e.target.value})} placeholder="e.g. Fever counseling given, mild swelling expected..." />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-elevated)', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
                    {(() => {
                      const matchedPriceObj = servicePrices.find(p => p.name.toLowerCase() === immForm.vaccine.toLowerCase() || p.service_code?.toLowerCase() === immForm.vaccine.toLowerCase());
                      const currentImmPrice = matchedPriceObj ? parseFloat(matchedPriceObj.price) : 0;
                      return (
                        <>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>PRICE / BILLING</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: currentImmPrice > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                              {currentImmPrice > 0 ? `KES ${currentImmPrice.toLocaleString()}` : 'Free (Government Funded)'}
                            </div>
                          </div>
                          <Btn onClick={handleSaveImmunization} disabled={savingImm || !immForm.vaccine}>
                            {savingImm ? 'Administering...' : '💉 Record & Bill Immunization'}
                          </Btn>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {formTab === 'social' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <Sel label="Marital Status" value={form.marital_status} onChange={e => sf('marital_status',e.target.value)}>
                  <option value="">Select...</option><option>Single</option><option>Married</option><option>Divorced</option><option>Widowed</option><option>Cohabiting</option>
                </Sel>
                <Inp label="Occupation" value={form.occupation} onChange={e => sf('occupation',e.target.value)} placeholder="e.g. Farmer, Trader..."/>
                <Inp label="Next of Kin" value={form.next_of_kin} onChange={e => sf('next_of_kin',e.target.value)}/>
                <Inp label="Next of Kin Phone" value={form.next_of_kin_phone} onChange={e => sf('next_of_kin_phone',e.target.value)} placeholder="07XXXXXXXX"/>
                <div style={{ gridColumn:'1/-1' }}><Txt label="Social Notes / Counseling" rows={4} value={form.social_notes||''} onChange={e => sf('social_notes',e.target.value)} placeholder="Social history, counseling given, referrals..."/></div>
              </div>
            )}

            {formTab === 'risk' && (
              <div>
                <div style={{ background:'#ef444408', border:'1px solid #ef444430', borderRadius:12, padding:16, marginBottom:16 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                    <Shield size={16} color="#ef4444"/><span style={{ fontSize:13, fontWeight:700, color:'#ef4444' }}>High Risk Conditions</span>
                  </div>
                  {!existingANC ? (
                    <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>Save ANC registration first to add risk flags.</p>
                  ) : (
                    <>
                      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                        <input value={flagText} onChange={e => setFlagText(e.target.value)} onKeyDown={e => e.key==='Enter'&&addFlag()} placeholder="e.g. Hypertension, Anaemia, Pre-eclampsia, GDM..." style={{ ...s.input, flex:1 }}/>
                        <Btn onClick={addFlag}><Plus size={13}/> Add</Btn>
                      </div>
                      {flags.length === 0
                        ? <p style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', padding:'12px 0' }}>No high risk flags yet</p>
                        : <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                            {flags.map(f => (
                              <div key={f.id} style={{ display:'flex', alignItems:'center', gap:7, background:'#ef444415', border:'1px solid #ef444430', borderRadius:8, padding:'6px 12px' }}>
                                <AlertTriangle size={12} color="#ef4444"/>
                                <span style={{ fontSize:12, color:'#ef4444', fontWeight:600 }}>{f.condition}</span>
                                <button onClick={() => removeFlag(f.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', padding:0, lineHeight:1 }}><X size={12}/></button>
                              </div>
                            ))}
                          </div>
                      }
                    </>
                  )}
                </div>
                <div style={{ gridColumn:'1/-1' }}><Txt label="Risk Factor Notes" rows={4} value={form.risk_factors} onChange={e => sf('risk_factors',e.target.value)} placeholder="Detailed risk assessment notes..."/></div>
              </div>
            )}

            <div style={{ padding:14, background:'var(--bg-elevated)', borderRadius:12, margin:'20px 0 16px', border:'1px solid var(--border)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.5px', marginBottom:10 }}>PATIENT DISPOSITION</div>
              <div style={{ display:'flex', gap:10, marginBottom: action==='admit'?12:0 }}>
                {[{v:'discharge',l:'✅ Discharge'},{v:'admit',l:'🏥 Admit to Ward'}].map(o => (
                  <button key={o.v} onClick={() => setAction(o.v)} style={{
                    flex:1, padding:10, borderRadius:9, border:'1px solid',
                    borderColor:action===o.v?COLOR:'var(--border)',
                    background:action===o.v?`${COLOR}12`:'transparent',
                    color:action===o.v?COLOR:'var(--text-muted)',
                    fontWeight:600, cursor:'pointer', fontSize:12, fontFamily:'DM Sans, sans-serif'
                  }}>{o.l}</button>
                ))}
              </div>
              {action==='admit' && <Inp label="Ward / Unit" value={form.admission_ward} onChange={e => sf('admission_ward',e.target.value)} placeholder="e.g. Maternity Ward, Labour Ward..."/>}
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <Btn variant="ghost" onClick={() => setSel(null)} style={{ flex:1, justifyContent:'center' }}>Cancel</Btn>
              <Btn onClick={handleSave} disabled={saving}
                style={{ flex:2, justifyContent:'center', background:action==='admit'?'#f59e0b':'var(--accent)', color:'#0F1612' }}>
                <Save size={14}/> {saving?'Saving...' : action==='admit'?'Save & Admit':'Save & Discharge'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ─── Billing Modal ─── */}
      <LabOrderModal
        isOpen={showLabModal}
        onClose={() => setShowLabModal(false)}
        onConfirm={handleConfirmPayment}
        labOrderId={currentLabOrder}
        loading={billingLoading}
      />
    </div>
  );
}
