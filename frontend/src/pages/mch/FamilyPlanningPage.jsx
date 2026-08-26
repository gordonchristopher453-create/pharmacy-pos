import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Users, ArrowLeft, Search, RefreshCw, X, Save } from 'lucide-react';

const inp = { width:'100%', padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' };
const lbl = { fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5, fontWeight:600 };
const Card = ({ children, style={}, ...p }) => <div style={{ background:'var(--bg-surface)', borderRadius:14, border:'1px solid var(--border)', ...style }} {...p}>{children}</div>;
const Btn = ({ children, variant='primary', size='md', ...p }) => (
  <button {...p} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:size==='sm'?'6px 13px':'10px 20px',
    background:variant==='primary'?'var(--accent)':variant==='danger'?'#ef4444':'var(--bg-elevated)',
    border:variant==='ghost'?'1px solid var(--border)':'none', borderRadius:9,
    color:variant==='primary'?'#0F1612':variant==='danger'?'#fff':'var(--text-primary)',
    fontSize:size==='sm'?11:13, fontWeight:600, cursor:p.disabled?'not-allowed':'pointer',
    opacity:p.disabled?0.6:1, fontFamily:'DM Sans, sans-serif', ...p.style }}>{children}</button>
);
const Inp = ({ label, ...p }) => <div><label style={lbl}>{label}</label><input {...p} style={inp}/></div>;
const Sel = ({ label, children, ...p }) => <div><label style={lbl}>{label}</label><select {...p} style={{ ...inp }}>{children}</select></div>;
const Txt = ({ label, ...p }) => <div><label style={lbl}>{label}</label><textarea {...p} style={{ ...inp, resize:'vertical' }}/></div>;

const COLOR = '#10b981';
const today = new Date().toISOString().split('T')[0];

const FP_METHODS = [
  { name:'COC Pills', category:'Hormonal', desc:'Combined Oral Contraceptive — daily pill', followUp:'3 months' },
  { name:'POP Pills', category:'Hormonal', desc:'Progestogen-Only Pill — daily pill', followUp:'3 months' },
  { name:'Depo-Provera', category:'Hormonal', desc:'Injectable — 3-monthly injection', followUp:'3 months' },
  { name:'Implanon / Jadelle', category:'Implant', desc:'Sub-dermal implant — 3-5 years', followUp:'1 year' },
  { name:'IUD / Copper T', category:'Long-acting', desc:'Intrauterine device — up to 10 years', followUp:'1 year' },
  { name:'Male Condom', category:'Barrier', desc:'Single-use barrier method' },
  { name:'Female Condom', category:'Barrier', desc:'Single-use barrier method' },
  { name:'LAM', category:'Natural', desc:'Lactational Amenorrhoea Method — breastfeeding' },
  { name:'NFP / SDM', category:'Natural', desc:'Natural Family Planning / Standard Days Method' },
  { name:'BTL', category:'Permanent', desc:'Bilateral Tubal Ligation — surgical sterilization' },
  { name:'Vasectomy', category:'Permanent', desc:'Male surgical sterilization' },
  { name:'Emergency Pill', category:'Emergency', desc:'Post-coital contraception — within 72 hours', followUp:'1 month' },
];

const BLANK = { visit_type:'new', method:'', start_date:today, follow_up_date:'', side_effects:'', counseling_notes:'', complaints:'', treatment_given:'', mch_stock_id:'', price:0 };

export default function FamilyPlanningPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('queue');
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [qL, setQL] = useState(false);
  const [hL, setHL] = useState(false);
  const [sel, setSel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ ...BLANK });
  const [selMethod, setSelMethod] = useState(null);
  const [stockFP, setStockFP] = useState([]);
  const sf = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(() => { fetchQueue(); fetchStockFP(); }, []);
  useEffect(() => { if(tab==='history') fetchHistory(); }, [tab]);

  const fetchStockFP = async () => {
    try {
      const { data } = await api.get('/mch-stock?category=fp_supply');
      setStockFP(data.data || []);
    } catch {}
  };

  const fetchQueue = async () => {
    setQL(true);
    try { const { data } = await api.get('/mch/queue'); setQueue((data.data||[]).filter(v=>v.mch_service==='mch_fp')); }
    catch { toast.error('Failed to load queue'); }
    setQL(false);
  };
  const fetchHistory = async () => {
    setHL(true);
    try {
      const params = new URLSearchParams({ date_from:dateFrom, date_to:dateTo });
      if(search) params.append('search',search);
      const { data } = await api.get('/mch/family-planning?'+params.toString());
      setHistory(data.data||[]);
    } catch { toast.error('Failed to load history'); }
    setHL(false);
  };
  const handleSave = async () => {
    if(!form.method) return toast.error('Select a FP method');
    setSaving(true);
    try {
      await api.post('/mch/family-planning', { ...form, patient_id:sel.patient_id, visit_id:sel.id });
      await api.put('/patients/visits/'+sel.id+'/status', { status:'discharged' });
      toast.success('FP record saved — patient discharged');
      setSel(null); fetchQueue(); fetchStockFP();
    } catch(e) { toast.error(e.response?.data?.message||'Failed to save'); }
    setSaving(false);
  };
  const onMethodChange = name => {
    sf('method', name);
    const m = FP_METHODS.find(x=>x.name===name);
    setSelMethod(m||null);
    if(m?.followUp) {
      const d = new Date();
      const match = m.followUp.match(/(\d+)\s*(month|year)/);
      if(match) {
        const n = parseInt(match[1]);
        if(match[2]==='month') d.setMonth(d.getMonth()+n);
        else d.setFullYear(d.getFullYear()+n);
        sf('follow_up_date', d.toISOString().split('T')[0]);
      }
    }
  };

  const methodsByCategory = FP_METHODS.reduce((acc,m)=>{ (acc[m.category]||(acc[m.category]=[])).push(m); return acc; }, {});

  return (
    <div style={{ padding:24, height:'100vh', overflow:'auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={()=>navigate('/app/mch')} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><ArrowLeft size={20}/></button>
          <div>
            <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', margin:0, display:'flex', alignItems:'center', gap:9 }}><Users size={22} color={COLOR}/> Family Planning</h1>
            <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>{queue.length} waiting · FP Services · MOH 514</p>
          </div>
        </div>
        <Btn variant="ghost" size="sm" onClick={fetchQueue}><RefreshCw size={13}/> Refresh</Btn>
      </div>

      <div style={{ display:'flex', gap:4, marginBottom:20, background:'var(--bg-surface)', borderRadius:10, padding:4, border:'1px solid var(--border)', width:'fit-content' }}>
        {[{id:'queue',label:`🏥 Queue (${queue.length})`},{id:'history',label:'📋 History'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:'7px 20px', borderRadius:7, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, background:tab===t.id?COLOR:'transparent', color:tab===t.id?'#fff':'var(--text-muted)', fontFamily:'DM Sans, sans-serif' }}>{t.label}</button>
        ))}
      </div>

      {tab==='queue' && (
        qL?<div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}>Loading...</div>
        :queue.length===0
          ?<Card style={{ textAlign:'center', padding:64 }}><Users size={42} color="var(--text-faint)" style={{ marginBottom:12 }}/><p style={{ color:'var(--text-muted)', fontSize:14, fontWeight:600 }}>No patients in FP queue</p></Card>
          :<div style={{ display:'grid', gap:10 }}>
            {queue.map((v,idx)=>(
              <Card key={v.id} style={{ padding:'16px 20px', cursor:'pointer' }}
                onClick={()=>{ setSel(v); setForm({...BLANK}); setSelMethod(null); }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=COLOR;e.currentTarget.style.boxShadow=`0 4px 16px ${COLOR}20`;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.boxShadow='none';}}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                    <div style={{ width:44, height:44, borderRadius:'50%', background:`${COLOR}15`, border:`2px solid ${COLOR}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:COLOR }}>{idx+1}</div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{v.patient_name}</div>
                      <div style={{ fontSize:12, color:'var(--text-muted)' }}>{v.patient_number}</div>
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <span style={{ fontSize:10, padding:'3px 8px', borderRadius:5, background:`${COLOR}18`, color:COLOR, fontWeight:700 }}>FP</span>
                    <div style={{ fontSize:12, color:'var(--accent)', fontWeight:700, marginTop:8 }}>Attend →</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
      )}

      {tab==='history' && (
        <div>
          <div style={{ background:'var(--bg-surface)', borderRadius:12, border:'1px solid var(--border)', padding:14, marginBottom:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:10, alignItems:'flex-end' }}>
              <div><label style={lbl}>Search</label><div style={{ position:'relative' }}><Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&fetchHistory()} placeholder="Name or number..." style={{ ...inp, paddingLeft:32 }}/></div></div>
              <Inp label="From" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/>
              <Inp label="To" type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/>
              <Btn onClick={fetchHistory}>Search</Btn>
            </div>
          </div>
          {hL?<div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}>Loading...</div>
          :history.length===0?<Card style={{ textAlign:'center', padding:60 }}><p style={{ color:'var(--text-muted)' }}>No FP records found</p></Card>
          :<div style={{ display:'grid', gap:10 }}>{history.map(r=>(
            <Card key={r.id} style={{ padding:'16px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ display:'flex', gap:13, alignItems:'center' }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:`${COLOR}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🌸</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{r.full_name}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>{r.patient_number}</div>
                    <div style={{ fontSize:12, color:COLOR, fontWeight:600, marginTop:2 }}>{r.method}</div>
                    {r.follow_up_date&&<div style={{ fontSize:11, color:'var(--text-faint)', marginTop:1 }}>Follow-up: {new Date(r.follow_up_date).toLocaleDateString('en-KE')}</div>}
                  </div>
                </div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>{new Date(r.created_at).toLocaleDateString('en-KE')}</div>
              </div>
            </Card>
          ))}</div>}
        </div>
      )}

      {sel && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'var(--bg-surface)', borderRadius:18, border:'1px solid var(--border)', width:'100%', maxWidth:660, maxHeight:'93vh', overflow:'auto', padding:28 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:40, height:40, borderRadius:11, background:`${COLOR}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🌸</div>
                <div>
                  <h2 style={{ fontSize:17, fontWeight:800, color:'var(--text-primary)', margin:0 }}>{sel.patient_name}</h2>
                  <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>{sel.patient_number} · Family Planning</p>
                </div>
              </div>
              <button onClick={()=>setSel(null)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={20}/></button>
            </div>

            {/* Visit type */}
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              {[{v:'new',l:'🆕 New Client'},{v:'revisit',l:'🔄 Revisit'},{v:'change',l:'🔁 Method Change'},{v:'discontinue',l:'❌ Discontinuing'}].map(o=>(
                <button key={o.v} onClick={()=>sf('visit_type',o.v)} style={{ flex:1, padding:'8px 4px', borderRadius:8, border:'1px solid', borderColor:form.visit_type===o.v?COLOR:'var(--border)', background:form.visit_type===o.v?`${COLOR}12`:'transparent', color:form.visit_type===o.v?COLOR:'var(--text-muted)', fontWeight:600, cursor:'pointer', fontSize:11, fontFamily:'DM Sans, sans-serif' }}>{o.l}</button>
              ))}
            </div>

            {/* FP Stock Selection */}
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Select Administered Item from MCH Stock</label>
              <select
                value={form.mch_stock_id || ''}
                onChange={e => {
                  const stockId = e.target.value;
                  if (!stockId) {
                    sf('mch_stock_id', '');
                    return;
                  }
                  const sItem = stockFP.find(v => v.id === stockId);
                  if (sItem) {
                    sf('mch_stock_id', stockId);
                    // Match the method name if it matches an FP_METHOD
                    const matchedMethod = FP_METHODS.find(m => sItem.name.toLowerCase().includes(m.name.toLowerCase()));
                    if (matchedMethod) {
                      onMethodChange(matchedMethod.name);
                    } else {
                      sf('method', sItem.name);
                    }
                  }
                }}
                style={{ ...inp }}
              >
                <option value="">-- Optional: Deduct from available FP Stock --</option>
                {stockFP.map(v => (
                  <option key={v.id} value={v.id} disabled={v.quantity <= 0}>
                    {v.name} (Qty: {v.quantity}) {v.batch_number ? `[Batch: ${v.batch_number}]` : ''} {v.quantity <= 0 ? ' - OUT OF STOCK' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Method picker */}
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>FP Method *</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                {FP_METHODS.map(m=>(
                  <button key={m.name} onClick={()=>onMethodChange(m.name)} style={{
                    padding:'8px 10px', borderRadius:8, border:'1px solid',
                    borderColor:form.method===m.name?COLOR:'var(--border)',
                    background:form.method===m.name?`${COLOR}12`:'var(--bg-elevated)',
                    color:form.method===m.name?COLOR:'var(--text-muted)',
                    fontWeight:600, cursor:'pointer', fontSize:11, fontFamily:'DM Sans, sans-serif',
                    textAlign:'left', transition:'all 0.12s'
                  }}>
                    <div style={{ fontWeight:700, color:form.method===m.name?COLOR:'var(--text-primary)', marginBottom:1 }}>{m.name}</div>
                    <div style={{ fontSize:10, color:'var(--text-faint)' }}>{m.category}</div>
                  </button>
                ))}
              </div>
            </div>

            {selMethod && (
              <div style={{ padding:12, background:`${COLOR}10`, borderRadius:10, border:`1px solid ${COLOR}30`, marginBottom:16, fontSize:12 }}>
                <span style={{ color:COLOR, fontWeight:700 }}>{selMethod.name}: </span>
                <span style={{ color:'var(--text-muted)' }}>{selMethod.desc}</span>
                {selMethod.followUp&&<span style={{ color:'var(--text-muted)' }}> · Recommended follow-up: {selMethod.followUp}</span>}
              </div>
            )}

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Inp label="Start Date" type="date" value={form.start_date} onChange={e=>sf('start_date',e.target.value)}/>
              <Inp label="Follow-up Date" type="date" value={form.follow_up_date} onChange={e=>sf('follow_up_date',e.target.value)}/>
              <Inp label="Supply Price (KSh)" type="number" value={form.price} onChange={e=>sf('price', parseFloat(e.target.value) || 0)} placeholder="0 for free / standard service"/>
              <div style={{ gridColumn:'1/-1' }}><Txt label="Side Effects Reported" rows={2} value={form.side_effects} onChange={e=>sf('side_effects',e.target.value)} placeholder="None / Describe any side effects..."/></div>
              <div style={{ gridColumn:'1/-1' }}><Txt label="Counseling Notes" rows={3} value={form.counseling_notes} onChange={e=>sf('counseling_notes',e.target.value)} placeholder="Counseling given, dual protection, STI prevention, partner communication..."/></div>
              <div style={{ gridColumn:'1/-1' }}><Txt label="Treatment / Medications Given" rows={2} value={form.treatment_given} onChange={e=>sf('treatment_given',e.target.value)}/></div>
            </div>

            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <Btn variant="ghost" onClick={()=>setSel(null)} style={{ flex:1, justifyContent:'center' }}>Cancel</Btn>
              <Btn onClick={handleSave} disabled={saving} style={{ flex:2, justifyContent:'center' }}><Save size={14}/> {saving?'Saving...':'Save & Discharge'}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
