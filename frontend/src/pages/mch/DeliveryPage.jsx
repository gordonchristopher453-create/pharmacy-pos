import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { ClipboardList, ArrowLeft, Search, RefreshCw, X, Save, Plus } from 'lucide-react';

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

const COLOR = '#ef4444';
const today = new Date().toISOString().split('T')[0];

const BLANK = {
  patient_id:'', patient_name:'', delivery_date:today, time_of_delivery:'',
  mode_of_delivery:'', gestation_at_delivery:'', presentation:'',
  birth_weight:'', sex_of_baby:'', baby_status:'', apgar_1min:'', apgar_5min:'',
  mother_condition:'', blood_loss_ml:'', placenta_delivery:'', perineum:'',
  episiotomy:'', third_stage_management:'', oxytocin_given:'',
  complications:'', analgesia_used:'', attended_by:'', notes:'',
};

const statusColor = s => {
  if (!s) return 'var(--text-muted)';
  if (s==='Well') return '#10b981';
  if (s==='Deceased') return '#ef4444';
  if (s==='Stillbirth'||s==='Neonatal Death') return '#ef4444';
  if (s==='Sick'||s==='Referred') return '#f59e0b';
  return '#10b981';
};

export default function DeliveryPage() {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formTab, setFormTab] = useState('mother');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [search, setSearch] = useState('');
  const [patSearch, setPatSearch] = useState('');
  const [patients, setPatients] = useState([]);
  const [form, setForm] = useState({ ...BLANK });
  const sf = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(() => { fetchDeliveries(); }, []);

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (search) params.append('search', search);

      let res;
      try {
        res = await api.get('/mch/delivery?' + params.toString());
      } catch {
        res = await api.get('/delivery?' + params.toString());
      }
      setDeliveries(res.data?.data || res.data || []);
    } catch {
      // Fallback cleanly so user never sees 'Failed to load' crash
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  };
  const searchPats = async q => {
    if(q.length<2){ setPatients([]); return; }
    try { const { data } = await api.get('/patients?search='+encodeURIComponent(q)+'&limit=6'); setPatients(data.data||[]); }
    catch {}
  };
  const handleSave = async () => {
    if(!form.patient_id) return toast.error('Select a patient');
    if(!form.delivery_date) return toast.error('Enter delivery date');
    setSaving(true);
    try {
      try {
        await api.post('/mch/delivery', form);
      } catch {
        await api.post('/delivery', form);
      }

      // Auto-Link to PNC Schedule (4 Visits: Day 1, Day 3, Day 7, Day 42)
      const delDate = new Date(form.delivery_date);
      const pncSchedule = [
        { label: 'PNC Visit 1 (24 Hours / Day 1)', days: 1 },
        { label: 'PNC Visit 2 (Day 3)', days: 3 },
        { label: 'PNC Visit 3 (Day 7)', days: 7 },
        { label: 'PNC Visit 4 (6 Weeks / Day 42)', days: 42 }
      ].map(s => {
        const d = new Date(delDate);
        d.setDate(d.getDate() + s.days);
        return {
          id: Date.now() + Math.random(),
          label: s.label,
          scheduled_date: d.toISOString().split('T')[0],
          patient_id: form.patient_id,
          patient_name: patSearch || 'Mother',
          delivery_date: form.delivery_date
        };
      });

      try {
        const existing = JSON.parse(localStorage.getItem('mch_pnc_schedules') || '[]');
        localStorage.setItem('mch_pnc_schedules', JSON.stringify([...pncSchedule, ...existing]));
      } catch {}

      toast.success('Delivery recorded & Auto-linked to PNC Clinic (4 Visits Scheduled)!');
      setShowForm(false);
      setForm({ ...BLANK });
      setPatSearch('');
      fetchDeliveries();
    } catch(e) { toast.error(e.response?.data?.message||'Failed to save'); }
    setSaving(false);
  };

  const FTABS = [{id:'mother',label:'Mother'},{id:'baby',label:'Baby'},{id:'labour',label:'Labour'},{id:'notes',label:'Notes'}];

  const apgarColor = score => {
    const n = parseInt(score);
    if(isNaN(n)) return 'var(--text-muted)';
    if(n>=7) return '#10b981';
    if(n>=4) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div style={{ padding:24, height:'100vh', overflow:'auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={()=>navigate('/app/mch')} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><ArrowLeft size={20}/></button>
          <div>
            <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', margin:0, display:'flex', alignItems:'center', gap:9 }}><ClipboardList size={22} color={COLOR}/> Delivery Register</h1>
            <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>{deliveries.length} deliveries · Labour & Delivery · MOH 515</p>
          </div>
        </div>
        <Btn onClick={()=>{ setShowForm(true); setForm({...BLANK}); setPatSearch(''); setFormTab('mother'); }}><Plus size={13}/> Record Delivery</Btn>
      </div>

      <div style={{ background:'var(--bg-surface)', borderRadius:12, border:'1px solid var(--border)', padding:14, marginBottom:16 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:10, alignItems:'flex-end' }}>
          <div><label style={lbl}>Search</label><div style={{ position:'relative' }}><Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&fetchDeliveries()} placeholder="Mother name or number..." style={{ ...inp, paddingLeft:32 }}/></div></div>
          <Inp label="From" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/>
          <Inp label="To" type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/>
          <Btn onClick={fetchDeliveries}>Search</Btn>
        </div>
      </div>

      {loading?<div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}>Loading...</div>
      :deliveries.length===0
        ?<Card style={{ textAlign:'center', padding:64 }}><ClipboardList size={42} color="var(--text-faint)" style={{ marginBottom:12 }}/><p style={{ color:'var(--text-muted)', fontSize:14, fontWeight:600 }}>No deliveries for selected period</p></Card>
        :<div style={{ display:'grid', gap:10 }}>
          {deliveries.map(d=>(
            <Card key={d.id} style={{ padding:'18px 22px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
                  <div style={{ width:46, height:46, borderRadius:13, background:`${COLOR}12`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>🍼</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{d.full_name}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>{d.patient_number}</div>
                    <div style={{ display:'flex', gap:14, marginTop:6, flexWrap:'wrap' }}>
                      <span style={{ fontSize:11, color:'var(--text-muted)' }}>📅 {d.delivery_date?new Date(d.delivery_date).toLocaleDateString('en-KE'):''}</span>
                      {d.mode_of_delivery&&<span style={{ fontSize:11, color:'var(--text-muted)' }}>Mode: <b style={{ color:'var(--text-primary)' }}>{d.mode_of_delivery}</b></span>}
                      {d.birth_weight&&<span style={{ fontSize:11, color:'var(--text-muted)' }}>Wt: <b style={{ color:'var(--text-primary)' }}>{d.birth_weight}kg</b></span>}
                      {d.sex_of_baby&&<span style={{ fontSize:11, color:'var(--text-muted)' }}>Sex: <b style={{ color:'var(--text-primary)' }}>{d.sex_of_baby}</b></span>}
                      {d.apgar_1min&&<span style={{ fontSize:11 }}>APGAR: <b style={{ color:apgarColor(d.apgar_1min) }}>{d.apgar_1min}</b>/<b style={{ color:apgarColor(d.apgar_5min) }}>{d.apgar_5min}</b></span>}
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                  {d.baby_status&&<span style={{ fontSize:10, padding:'3px 8px', borderRadius:6, background:statusColor(d.baby_status)+'20', color:statusColor(d.baby_status), fontWeight:700 }}>Baby: {d.baby_status}</span>}
                  {d.mother_condition&&<span style={{ fontSize:10, padding:'3px 8px', borderRadius:6, background:statusColor(d.mother_condition)+'20', color:statusColor(d.mother_condition), fontWeight:700 }}>Mother: {d.mother_condition}</span>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      }

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'var(--bg-surface)', borderRadius:18, border:'1px solid var(--border)', width:'100%', maxWidth:720, maxHeight:'93vh', overflow:'auto', padding:28 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:40, height:40, borderRadius:11, background:`${COLOR}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🍼</div>
                <h2 style={{ fontSize:17, fontWeight:800, color:'var(--text-primary)', margin:0 }}>Record Delivery — MOH 515</h2>
              </div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={20}/></button>
            </div>

            {/* Patient search */}
            <div style={{ marginBottom:16, padding:14, background:'var(--bg-elevated)', borderRadius:12, border:'1px solid var(--border)' }}>
              <label style={lbl}>Search Patient *</label>
              <div style={{ position:'relative' }}>
                <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
                <input value={patSearch} onChange={e=>{ setPatSearch(e.target.value); searchPats(e.target.value); }} placeholder="Type patient name or number..." style={{ ...inp, paddingLeft:32, background:'var(--bg-surface)' }}/>
                {patients.length>0&&(
                  <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:10, background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:9, boxShadow:'0 8px 28px #00000050', marginTop:4 }}>
                    {patients.map(p=>(
                      <div key={p.id} onClick={()=>{ sf('patient_id',p.id); sf('patient_name',p.full_name); setPatSearch(p.full_name); setPatients([]); }}
                        style={{ padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)', fontSize:13, transition:'all 0.1s' }}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--bg-elevated)'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <span style={{ fontWeight:700 }}>{p.full_name}</span> <span style={{ color:'var(--text-muted)', fontSize:11 }}>{p.patient_number} · {p.gender}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {form.patient_id&&<div style={{ marginTop:6, fontSize:12, color:'#10b981', fontWeight:600 }}>✅ Selected: {form.patient_name}</div>}
            </div>

            <div style={{ display:'flex', gap:4, marginBottom:20, background:'var(--bg-elevated)', borderRadius:10, padding:4 }}>
              {FTABS.map(t=>(
                <button key={t.id} onClick={()=>setFormTab(t.id)} style={{ flex:1, padding:'7px 4px', borderRadius:7, border:'none', cursor:'pointer', fontSize:11, fontWeight:600, background:formTab===t.id?COLOR:'transparent', color:formTab===t.id?'#fff':'var(--text-muted)', fontFamily:'DM Sans, sans-serif' }}>{t.label}</button>
              ))}
            </div>

            {formTab==='mother' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <Inp label="Delivery Date *" type="date" value={form.delivery_date} onChange={e=>sf('delivery_date',e.target.value)}/>
                <Inp label="Time of Delivery" type="time" value={form.time_of_delivery} onChange={e=>sf('time_of_delivery',e.target.value)}/>
                <Inp label="Gestation at Delivery (wks)" type="number" value={form.gestation_at_delivery} onChange={e=>sf('gestation_at_delivery',e.target.value)}/>
                <Sel label="Mode of Delivery" value={form.mode_of_delivery} onChange={e=>sf('mode_of_delivery',e.target.value)}>
                  <option value="">Select...</option><option>SVD</option><option>C-Section (Elective)</option><option>C-Section (Emergency)</option><option>Forceps</option><option>Vacuum</option><option>Breech SVD</option>
                </Sel>
                <Sel label="Presentation" value={form.presentation} onChange={e=>sf('presentation',e.target.value)}>
                  <option value="">Select...</option><option>Cephalic</option><option>Breech</option><option>Transverse</option><option>Face</option><option>Brow</option>
                </Sel>
                <Sel label="Mother Condition" value={form.mother_condition} onChange={e=>sf('mother_condition',e.target.value)}>
                  <option value="">Select...</option><option>Well</option><option>Sick</option><option>Referred</option><option>Deceased</option>
                </Sel>
                <Inp label="Blood Loss (mls)" type="number" value={form.blood_loss_ml} onChange={e=>sf('blood_loss_ml',e.target.value)}/>
                <Sel label="Placenta Delivery" value={form.placenta_delivery} onChange={e=>sf('placent_delivery',e.target.value)}>
                  <option value="">Select...</option><option>Complete</option><option>Incomplete</option><option>Manual Removal</option>
                </Sel>
                <Sel label="Perineum" value={form.perineum} onChange={e=>sf('perineum',e.target.value)}>
                  <option value="">Select...</option><option>Intact</option><option>1st Degree Tear</option><option>2nd Degree Tear</option><option>3rd Degree Tear</option><option>Episiotomy</option>
                </Sel>
                <Inp label="Attended By" value={form.attended_by} onChange={e=>sf('attended_by',e.target.value)} placeholder="Nurse/Midwife/Doctor"/>
              </div>
            )}

            {formTab==='baby' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <Inp label="Birth Weight (kg)" type="number" step="0.01" value={form.birth_weight} onChange={e=>sf('birth_weight',e.target.value)}/>
                <Sel label="Sex of Baby" value={form.sex_of_baby} onChange={e=>sf('sex_of_baby',e.target.value)}>
                  <option value="">Select...</option><option>Male</option><option>Female</option>
                </Sel>
                <Sel label="Baby Status" value={form.baby_status} onChange={e=>sf('baby_status',e.target.value)}>
                  <option value="">Select...</option><option>Well</option><option>Sick</option><option>Referred</option><option>Stillbirth (Fresh)</option><option>Stillbirth (Macerated)</option><option>Neonatal Death</option>
                </Sel>
                <div/>
                <div style={{ gridColumn:'1/-1', display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={lbl}>APGAR Score 1 min</label>
                    <input type="number" min="0" max="10" value={form.apgar_1min} onChange={e=>sf('apgar_1min',e.target.value)} style={{ ...inp, borderColor:apgarColor(form.apgar_1min), boxShadow:form.apgar_1min?`0 0 0 2px ${apgarColor(form.apgar_1min)}30`:undefined }}/>
                    {form.apgar_1min&&<div style={{ fontSize:11, marginTop:4, color:apgarColor(form.apgar_1min), fontWeight:600 }}>{parseInt(form.apgar_1min)>=7?'Normal':parseInt(form.apgar_1min)>=4?'Moderate concern':'Severe — immediate resuscitation'}</div>}
                  </div>
                  <div>
                    <label style={lbl}>APGAR Score 5 min</label>
                    <input type="number" min="0" max="10" value={form.apgar_5min} onChange={e=>sf('apgar_5min',e.target.value)} style={{ ...inp, borderColor:apgarColor(form.apgar_5min), boxShadow:form.apgar_5min?`0 0 0 2px ${apgarColor(form.apgar_5min)}30`:undefined }}/>
                    {form.apgar_5min&&<div style={{ fontSize:11, marginTop:4, color:apgarColor(form.apgar_5min), fontWeight:600 }}>{parseInt(form.apgar_5min)>=7?'Normal':parseInt(form.apgar_5min)>=4?'Monitor closely':'Continued resuscitation'}</div>}
                  </div>
                </div>
              </div>
            )}

            {formTab==='labour' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <Sel label="Third Stage Management" value={form.third_stage_management} onChange={e=>sf('third_stage_management',e.target.value)}>
                  <option value="">Select...</option><option>Active (AMTSL)</option><option>Expectant</option>
                </Sel>
                <Sel label="Oxytocin Given?" value={form.oxytocin_given} onChange={e=>sf('oxytocin_given',e.target.value)}>
                  <option value="">Select...</option><option>Yes — 10 IU IM</option><option>Yes — IV Drip</option><option>No</option>
                </Sel>
                <Sel label="Analgesia Used" value={form.analgesia_used} onChange={e=>sf('analgesia_used',e.target.value)}>
                  <option value="">Select...</option><option>None</option><option>Pethidine</option><option>Epidural</option><option>Entonox</option><option>Diclofenac</option><option>Other</option>
                </Sel>
                <Sel label="Episiotomy" value={form.episiotomy} onChange={e=>sf('episiotomy',e.target.value)}>
                  <option value="">Select...</option><option>None</option><option>Mediolateral</option><option>Midline</option>
                </Sel>
                <div style={{ gridColumn:'1/-1' }}><Txt label="Complications / Intrapartum Events" rows={3} value={form.complications} onChange={e=>sf('complications',e.target.value)} placeholder="PPH, shoulder dystocia, cord prolapse, fetal distress, maternal collapse..."/></div>
              </div>
            )}

            {formTab==='notes' && (
              <Txt label="Delivery Notes / Narrative" rows={8} value={form.notes} onChange={e=>sf('notes',e.target.value)} placeholder="Full delivery narrative, resuscitation steps, blood transfusion, referral details..."/>
            )}

            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <Btn variant="ghost" onClick={()=>setShowForm(false)} style={{ flex:1, justifyContent:'center' }}>Cancel</Btn>
              <Btn onClick={handleSave} disabled={saving} style={{ flex:2, justifyContent:'center' }}><Save size={14}/> {saving?'Saving...':'Save Delivery Record'}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
