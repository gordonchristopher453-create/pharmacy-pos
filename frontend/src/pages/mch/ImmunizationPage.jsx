import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Syringe, ArrowLeft, Search, RefreshCw, X, Save, AlertTriangle, Clock } from 'lucide-react';

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

const COLOR = '#f59e0b';
const today = new Date().toISOString().split('T')[0];

// Kenya KEPI Vaccines
const VACCINES = [
  { name:'BCG', doses:['Birth'], site:'Right deltoid', nextAge:'6 weeks' },
  { name:'OPV 0', doses:['Birth'], site:'Oral' },
  { name:'OPV 1', doses:['6 weeks'], site:'Oral', nextAge:'10 weeks' },
  { name:'OPV 2', doses:['10 weeks'], site:'Oral', nextAge:'14 weeks' },
  { name:'OPV 3', doses:['14 weeks'], site:'Oral' },
  { name:'IPV', doses:['14 weeks'], site:'Right anterolateral thigh' },
  { name:'DPT-HepB-Hib 1', doses:['6 weeks'], site:'Left anterolateral thigh', nextAge:'10 weeks' },
  { name:'DPT-HepB-Hib 2', doses:['10 weeks'], site:'Left anterolateral thigh', nextAge:'14 weeks' },
  { name:'DPT-HepB-Hib 3', doses:['14 weeks'], site:'Left anterolateral thigh' },
  { name:'PCV 1', doses:['6 weeks'], site:'Right anterolateral thigh', nextAge:'10 weeks' },
  { name:'PCV 2', doses:['10 weeks'], site:'Right anterolateral thigh', nextAge:'14 weeks' },
  { name:'PCV 3', doses:['14 weeks'], site:'Right anterolateral thigh' },
  { name:'Rota 1', doses:['6 weeks'], site:'Oral', nextAge:'10 weeks' },
  { name:'Rota 2', doses:['10 weeks'], site:'Oral' },
  { name:'Measles 1', doses:['9 months'], site:'Left deltoid', nextAge:'18 months' },
  { name:'Measles 2', doses:['18 months'], site:'Left deltoid' },
  { name:'Yellow Fever', doses:['9 months'], site:'Right deltoid' },
  { name:'Vitamin A', doses:['6 months','12 months','18 months','24 months','30 months','36 months'], site:'Oral' },
  { name:'Deworming', doses:['12 months','18 months'], site:'Oral' },
  { name:'HPV 1', doses:['9-14 years girls'], site:'Deltoid', nextAge:'6 months' },
  { name:'HPV 2', doses:['6 months after HPV1'], site:'Deltoid' },
  { name:'TT 1', doses:['First ANC'], site:'Deltoid', nextAge:'1 month' },
  { name:'TT 2', doses:['1 month after TT1'], site:'Deltoid', nextAge:'6 months' },
  { name:'TT 3', doses:['6 months after TT2'], site:'Deltoid', nextAge:'1 year' },
  { name:'TT 4', doses:['1 year after TT3'], site:'Deltoid', nextAge:'1 year' },
  { name:'TT 5', doses:['1 year after TT4'], site:'Deltoid' },
];

const BLANK = { vaccine:'', dose:'', date_given:today, next_due_date:'', batch_number:'', site:'', administered_by:'', adverse_reaction:'', notes:'', mch_stock_id:'', vaccine_price:0 };

export default function ImmunizationPage() {
  const navigate = useNavigate();
  const { user } = useSelector(s => s.auth);
  const [tab, setTab] = useState('queue');
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [due, setDue] = useState([]);
  const [qL, setQL] = useState(false);
  const [hL, setHL] = useState(false);
  const [sel, setSel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ ...BLANK });
  const [selectedVaccineInfo, setSelectedVaccineInfo] = useState(null);
  const [stockVaccines, setStockVaccines] = useState([]);
  const sf = (k,v) => setForm(f=>({...f,[k]:v}));

  const fetchStockVaccines = async () => {
    try {
      const { data } = await api.get('/mch-stock?category=vaccine');
      setStockVaccines(data.data || []);
    } catch { /* ignore */ }
  };

  const fetchQueue = async () => {
    setQL(true);
    try { const { data } = await api.get('/mch/queue'); setQueue((data.data||[]).filter(v=>v.mch_service==='mch_immunization')); }
    catch { toast.error('Failed to load queue'); }
    setQL(false);
  };

  const fetchDue = async () => {
    try { const { data } = await api.get('/mch/immunization/due'); setDue(data.data||[]); }
    catch { /* ignore */ }
  };

  const fetchHistory = async () => {
    setHL(true);
    try {
      const params = new URLSearchParams({ date_from:dateFrom, date_to:dateTo });
      if(search) params.append('search',search);
      const { data } = await api.get('/mch/immunization?'+params.toString());
      setHistory(data.data||[]);
    } catch { toast.error('Failed to load history'); }
    setHL(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchQueue(); fetchDue(); fetchStockVaccines(); }, []);
  useEffect(() => {
    if(user?.full_name) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(f=>({ ...f, administered_by:f.administered_by||user.full_name }));
    }
  }, [user]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if(tab==='history') fetchHistory(); }, [tab]);
  const handleSave = async () => {
    if(!form.vaccine) return toast.error('Select a vaccine');
    setSaving(true);
    try {
      await api.post('/mch/immunization', { ...form, patient_id:sel.patient_id, visit_id:sel.id });
      await api.put('/patients/visits/'+sel.id+'/status', { status:'discharged' });
      toast.success('Immunization recorded — patient discharged');
      setSel(null); fetchQueue(); fetchDue(); fetchStockVaccines();
    } catch(e) { toast.error(e.response?.data?.message||'Failed to save'); }
    setSaving(false);
  };
  const onVaccineChange = (name) => {
    sf('vaccine', name);
    const info = VACCINES.find(v=>v.name===name);
    setSelectedVaccineInfo(info||null);
    if(info?.site) sf('site', info.site);
    // Auto next due date
    if(info?.nextAge) {
      const d = new Date();
      const match = info.nextAge.match(/(\d+)\s*(week|month|year)/);
      if(match) {
        const n = parseInt(match[1]);
        if(match[2]==='week') d.setDate(d.getDate()+n*7);
        else if(match[2]==='month') d.setMonth(d.getMonth()+n);
        else d.setFullYear(d.getFullYear()+n);
        sf('next_due_date', d.toISOString().split('T')[0]);
      }
    }
  };

  return (
    <div style={{ padding:24, height:'100vh', overflow:'auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={()=>navigate('/app/mch')} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><ArrowLeft size={20}/></button>
          <div>
            <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', margin:0, display:'flex', alignItems:'center', gap:9 }}><Syringe size={22} color={COLOR}/> Immunization</h1>
            <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>{queue.length} waiting · {due.length} due this week · MOH 513</p>
          </div>
        </div>
        <Btn variant="ghost" size="sm" onClick={()=>{ fetchQueue(); fetchDue(); }}><RefreshCw size={13}/> Refresh</Btn>
      </div>

      {/* Due alert banner */}
      {due.length > 0 && (
        <div style={{ background:'#f59e0b12', border:'1px solid #f59e0b40', borderRadius:12, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
          <Clock size={16} color={COLOR}/>
          <span style={{ fontSize:13, color:COLOR, fontWeight:600 }}>{due.length} patient{due.length>1?'s':''} due for immunization within 7 days</span>
        </div>
      )}

      <div style={{ display:'flex', gap:4, marginBottom:20, background:'var(--bg-surface)', borderRadius:10, padding:4, border:'1px solid var(--border)', width:'fit-content' }}>
        {[{id:'queue',label:`🏥 Queue (${queue.length})`},{id:'due',label:`⏰ Due (${due.length})`},{id:'history',label:'📋 History'}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ padding:'7px 18px', borderRadius:7, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, background:tab===t.id?COLOR:'transparent', color:tab===t.id?'#0F1612':'var(--text-muted)', fontFamily:'DM Sans, sans-serif' }}>{t.label}</button>
        ))}
      </div>

      {tab==='queue' && (
        qL?<div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}>Loading...</div>
        :queue.length===0
          ?<Card style={{ textAlign:'center', padding:64 }}><Syringe size={42} color="var(--text-faint)" style={{ marginBottom:12 }}/><p style={{ color:'var(--text-muted)', fontSize:14, fontWeight:600 }}>No patients in immunization queue</p></Card>
          :<div style={{ display:'grid', gap:10 }}>
            {queue.map((v,idx)=>(
              <Card key={v.id} style={{ padding:'16px 20px', cursor:'pointer' }}
                onClick={()=>{ setSel(v); setForm({...BLANK, administered_by:user?.full_name||'', date_given:today}); setSelectedVaccineInfo(null); }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=COLOR;e.currentTarget.style.boxShadow=`0 4px 16px ${COLOR}20`;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.boxShadow='none';}}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                    <div style={{ width:44, height:44, borderRadius:'50%', background:`${COLOR}15`, border:`2px solid ${COLOR}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:COLOR }}>{idx+1}</div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{v.patient_name}</div>
                      <div style={{ fontSize:12, color:'var(--text-muted)' }}>{v.patient_number} · {v.gender}</div>
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <span style={{ fontSize:10, padding:'3px 8px', borderRadius:5, background:`${COLOR}18`, color:COLOR, fontWeight:700 }}>IMMUNIZATION</span>
                    <div style={{ fontSize:12, color:'var(--accent)', fontWeight:700, marginTop:8 }}>Attend →</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
      )}

      {tab==='due' && (
        due.length===0
          ?<Card style={{ textAlign:'center', padding:64 }}><AlertTriangle size={42} color="var(--text-faint)" style={{ marginBottom:12 }}/><p style={{ color:'var(--text-muted)', fontSize:14 }}>No immunizations due in the next 7 days</p></Card>
          :<div style={{ display:'grid', gap:10 }}>
            {due.map(d=>(
              <Card key={d.id} style={{ padding:'16px 20px', border:'1px solid #f59e0b30', background:'#f59e0b08' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', gap:13, alignItems:'center' }}>
                    <div style={{ width:44, height:44, borderRadius:12, background:`${COLOR}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>💉</div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{d.full_name}</div>
                      <div style={{ fontSize:12, color:'var(--text-muted)' }}>{d.patient_number}</div>
                      <div style={{ fontSize:12, color:COLOR, fontWeight:600, marginTop:3 }}>{d.vaccine}{d.dose?` — ${d.dose}`:''}</div>
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:13, fontWeight:700, color:COLOR }}>{d.next_due_date?new Date(d.next_due_date).toLocaleDateString('en-KE',{day:'2-digit',month:'short',year:'numeric'}):''}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>Due date</div>
                    {d.phone&&<div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>{d.phone}</div>}
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
          :history.length===0?<Card style={{ textAlign:'center', padding:60 }}><p style={{ color:'var(--text-muted)' }}>No immunizations found</p></Card>
          :<div style={{ display:'grid', gap:10 }}>{history.map(r=>(
            <Card key={r.id} style={{ padding:'16px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ display:'flex', gap:13, alignItems:'center' }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:`${COLOR}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>💉</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{r.full_name}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>{r.patient_number}</div>
                    <div style={{ fontSize:12, color:COLOR, fontWeight:600, marginTop:2 }}>{r.vaccine}{r.dose?` — ${r.dose}`:''}{r.batch_number?` · Batch: ${r.batch_number}`:''}</div>
                  </div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:12, color:'var(--text-muted)' }}>{r.date_given?new Date(r.date_given).toLocaleDateString('en-KE'):''}</div>
                  {r.next_due_date&&<div style={{ fontSize:11, color:COLOR, fontWeight:600, marginTop:2 }}>Next: {new Date(r.next_due_date).toLocaleDateString('en-KE')}</div>}
                </div>
              </div>
            </Card>
          ))}</div>}
        </div>
      )}

      {sel && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'var(--bg-surface)', borderRadius:18, border:'1px solid var(--border)', width:'100%', maxWidth:620, maxHeight:'93vh', overflow:'auto', padding:28 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:40, height:40, borderRadius:11, background:`${COLOR}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>💉</div>
                <div>
                  <h2 style={{ fontSize:17, fontWeight:800, color:'var(--text-primary)', margin:0 }}>{sel.patient_name}</h2>
                  <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>{sel.patient_number} · Immunization</p>
                </div>
              </div>
              <button onClick={()=>setSel(null)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={20}/></button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={lbl}>Select Vaccine (from MCH Stock) *</label>
                <select
                  value={form.mch_stock_id || ''}
                  onChange={e => {
                    const stockId = e.target.value;
                    if (stockId === 'kepi_manual') {
                      sf('mch_stock_id', '');
                      sf('vaccine', '');
                      sf('batch_number', '');
                      return;
                    }
                    const sItem = stockVaccines.find(v => v.id === stockId);
                    if (sItem) {
                      sf('mch_stock_id', stockId);
                      sf('vaccine', sItem.name);
                      sf('batch_number', sItem.batch_number || '');
                      // Check if it matches any hardcoded info for auto next_due_date/site
                      const info = VACCINES.find(v => sItem.name.toLowerCase().includes(v.name.toLowerCase()));
                      if (info) {
                        setSelectedVaccineInfo(info);
                        if (info.site) sf('site', info.site);
                        if (info.nextAge) {
                          const d = new Date();
                          const match = info.nextAge.match(/(\d+)\s*(week|month|year)/);
                          if (match) {
                            const n = parseInt(match[1]);
                            if (match[2] === 'week') d.setDate(d.getDate() + n * 7);
                            else if (match[2] === 'month') d.setMonth(d.getMonth() + n);
                            else d.setFullYear(d.getFullYear() + n);
                            sf('next_due_date', d.toISOString().split('T')[0]);
                          }
                        }
                      } else {
                        setSelectedVaccineInfo(null);
                      }
                    }
                  }}
                  style={{ ...inp }}
                >
                  <option value="">-- Choose from available MCH Stock --</option>
                  {stockVaccines.map(v => (
                    <option key={v.id} value={v.id} disabled={v.quantity <= 0}>
                      {v.name} (Qty: {v.quantity}) {v.batch_number ? `[Batch: ${v.batch_number}]` : ''} {v.quantity <= 0 ? ' - OUT OF STOCK' : ''}
                    </option>
                  ))}
                  <option value="kepi_manual">-- Other / Manual Entry --</option>
                </select>
              </div>

              {(!form.mch_stock_id) && (
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={lbl}>Vaccine Name (Manual Selection / KEPI Schedule) *</label>
                  <select value={form.vaccine} onChange={e=>onVaccineChange(e.target.value)} style={{ ...inp }}>
                    <option value="">Select vaccine...</option>
                    {VACCINES.map(v=><option key={v.name} value={v.name}>{v.name}</option>)}
                  </select>
                </div>
              )}

              {selectedVaccineInfo && (
                <div style={{ gridColumn:'1/-1', padding:12, background:`${COLOR}10`, borderRadius:10, border:`1px solid ${COLOR}30`, fontSize:12 }}>
                  <span style={{ color:COLOR, fontWeight:700 }}>KEPI Schedule: </span>
                  <span style={{ color:'var(--text-muted)' }}>{selectedVaccineInfo.doses.join(', ')} · Site: {selectedVaccineInfo.site}</span>
                  {selectedVaccineInfo.nextAge && <span style={{ color:'var(--text-muted)' }}> · Next dose: {selectedVaccineInfo.nextAge}</span>}
                </div>
              )}

              <Inp label="Dose" value={form.dose} onChange={e=>sf('dose',e.target.value)} placeholder="e.g. 1st, 2nd, Booster"/>
              <Inp label="Date Given" type="date" value={form.date_given} onChange={e=>sf('date_given',e.target.value)}/>
              <Inp label="Next Due Date" type="date" value={form.next_due_date} onChange={e=>sf('next_due_date',e.target.value)}/>
              <Inp label="Batch Number" value={form.batch_number} onChange={e=>sf('batch_number',e.target.value)} placeholder="Lot / Batch no."/>
              <Inp label="Site" value={form.site} onChange={e=>sf('site',e.target.value)} placeholder="e.g. Left thigh, Oral"/>
              <Inp label="Vaccine Price (KSh)" type="number" value={form.vaccine_price} onChange={e=>sf('vaccine_price', parseFloat(e.target.value) || 0)} placeholder="0 for free / KEPI"/>
              <Inp label="Administered By" value={form.administered_by} onChange={e=>sf('administered_by',e.target.value)}/>
              <div style={{ gridColumn:'1/-1' }}><Txt label="Adverse Reaction (if any)" rows={2} value={form.adverse_reaction} onChange={e=>sf('adverse_reaction',e.target.value)} placeholder="None / Describe reaction..."/></div>
              <div style={{ gridColumn:'1/-1' }}><Txt label="Notes" rows={2} value={form.notes} onChange={e=>sf('notes',e.target.value)}/></div>
            </div>

            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <Btn variant="ghost" onClick={()=>setSel(null)} style={{ flex:1, justifyContent:'center' }}>Cancel</Btn>
              <Btn onClick={handleSave} disabled={saving} style={{ flex:2, justifyContent:'center' }}><Save size={14}/> {saving?'Saving...':'Record & Discharge'}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
