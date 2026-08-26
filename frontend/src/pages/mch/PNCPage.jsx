import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Stethoscope, ArrowLeft, Search, RefreshCw, X, Save } from 'lucide-react';

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

const COLOR = '#8b5cf6';
const today = new Date().toISOString().split('T')[0];

const BLANK = {
  visit_date:today, delivery_date:'', delivery_outcome:'', delivery_mode:'',
  birth_weight:'', baby_condition:'', baby_sex:'', feeding_method:'',
  breast_examination:'', mother_condition:'', blood_pressure:'', temperature:'',
  lochia:'', perineum_healing:'', episiotomy_healing:'', uterine_involution:'',
  fp_counseling:'', fp_method_chosen:'', complaints:'', treatment_given:'',
  next_visit_date:'', postnatal_assessment:'', admission_ward:'',
};

export default function PNCPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('queue');
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [qL, setQL] = useState(true);
  const [hL, setHL] = useState(false);
  const [sel, setSel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [action, setAction] = useState('discharge');
  const [formTab, setFormTab] = useState('mother');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ ...BLANK });
  const sf = (k,v) => setForm(f=>({...f,[k]:v}));

  const fetchQueue = async () => {
    try { const { data } = await api.get('/mch/queue'); setQueue((data.data||[]).filter(v=>v.mch_service==='mch_pnc')); }
    catch { toast.error('Failed to load queue'); }
    setQL(false);
  };
  const fetchHistory = async () => {
    try {
      const params = new URLSearchParams({ date_from:dateFrom, date_to:dateTo });
      if(search) params.append('search',search);
      const { data } = await api.get('/mch/pnc?'+params.toString());
      setHistory(data.data||[]);
    } catch { toast.error('Failed to load history'); }
    setHL(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchQueue(); }, []);
  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/mch/pnc', { ...form, patient_id:sel.patient_id, postnatal_assessment:form.postnatal_assessment||'Done' });
      if(action==='admit'&&form.admission_ward) {
        await api.put('/patients/visits/'+sel.id+'/status', { status:'admitted' });
        toast.success('PNC saved — admitted to '+form.admission_ward);
      } else {
        await api.put('/patients/visits/'+sel.id+'/status', { status:'discharged' });
        toast.success('PNC visit saved — patient discharged');
      }
      setSel(null); fetchQueue();
    } catch(e) { toast.error(e.response?.data?.message||'Failed to save'); }
    setSaving(false);
  };

  const FTABS = [{id:'mother',label:'Mother'},{id:'baby',label:'Baby'},{id:'fp',label:'FP/Counsel'}];

  return (
    <div style={{ padding:24, height:'100vh', overflow:'auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={()=>navigate('/app/mch')} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><ArrowLeft size={20}/></button>
          <div>
            <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', margin:0, display:'flex', alignItems:'center', gap:9 }}><Stethoscope size={22} color={COLOR}/> PNC Clinic</h1>
            <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>{queue.length} waiting · Postnatal Care · MOH 511</p>
          </div>
        </div>
        <Btn variant="ghost" size="sm" onClick={() => { setQL(true); fetchQueue(); }}><RefreshCw size={13}/> Refresh</Btn>
      </div>

      <div style={{ display:'flex', gap:4, marginBottom:20, background:'var(--bg-surface)', borderRadius:10, padding:4, border:'1px solid var(--border)', width:'fit-content' }}>
        {[{id:'queue',label:`🏥 Queue (${queue.length})`},{id:'history',label:'📋 History'}].map(t=>(
          <button key={t.id} onClick={()=>{ setTab(t.id); if(t.id==='history') { setHL(true); fetchHistory(); } }} style={{ padding:'7px 20px', borderRadius:7, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, background:tab===t.id?COLOR:'transparent', color:tab===t.id?'#fff':'var(--text-muted)', fontFamily:'DM Sans, sans-serif' }}>{t.label}</button>
        ))}
      </div>

      {tab==='queue' && (
        qL ? <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}>Loading...</div>
        : queue.length===0
          ? <Card style={{ textAlign:'center', padding:64 }}><Stethoscope size={42} color="var(--text-faint)" style={{ marginBottom:12 }}/><p style={{ color:'var(--text-muted)', fontSize:14, fontWeight:600 }}>No patients in PNC queue</p></Card>
          : <div style={{ display:'grid', gap:10 }}>
              {queue.map((v,idx)=>(
                <Card key={v.id} style={{ padding:'16px 20px', cursor:'pointer' }}
                  onClick={()=>{ setSel(v); setForm({...BLANK}); setFormTab('mother'); }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=COLOR;e.currentTarget.style.boxShadow=`0 4px 16px ${COLOR}20`;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.boxShadow='none';}}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                      <div style={{ width:44, height:44, borderRadius:'50%', background:`${COLOR}15`, border:`2px solid ${COLOR}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:COLOR }}>{idx+1}</div>
                      <div>
                        <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{v.patient_name}</div>
                        <div style={{ fontSize:12, color:'var(--text-muted)' }}>{v.patient_number}</div>
                        {v.chief_complaint&&<div style={{ fontSize:11, color:'var(--text-faint)', marginTop:2 }}>CC: {v.chief_complaint}</div>}
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <span style={{ fontSize:10, padding:'3px 8px', borderRadius:5, background:`${COLOR}18`, color:COLOR, fontWeight:700 }}>PNC</span>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:5 }}>{new Date(v.visit_date).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})}</div>
                      <div style={{ fontSize:12, color:'var(--accent)', fontWeight:700, marginTop:4 }}>Attend →</div>
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
              <div><label style={lbl}>Search</label><div style={{ position:'relative' }}><Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/><input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(setHL(true),fetchHistory())} placeholder="Name or number..." style={{ ...inp, paddingLeft:32 }}/></div></div>
              <Inp label="From" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/>
              <Inp label="To" type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/>
              <Btn onClick={() => { setHL(true); fetchHistory(); }}>Search</Btn>
            </div>
          </div>
          {hL?<div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}>Loading...</div>
          :history.length===0?<Card style={{ textAlign:'center', padding:60 }}><p style={{ color:'var(--text-muted)' }}>No PNC records found</p></Card>
          :<div style={{ display:'grid', gap:10 }}>{history.map(r=>(
            <Card key={r.id} style={{ padding:'16px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ display:'flex', gap:13, alignItems:'center' }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:`${COLOR}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🤱</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{r.full_name}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>{r.patient_number}</div>
                    <div style={{ fontSize:11, color:'var(--text-faint)', marginTop:2 }}>Visit: {r.visit_date?new Date(r.visit_date).toLocaleDateString('en-KE'):'—'} · Outcome: {r.delivery_outcome||'—'} · Baby: {r.baby_condition||'—'}</div>
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
          <div style={{ background:'var(--bg-surface)', borderRadius:18, border:'1px solid var(--border)', width:'100%', maxWidth:680, maxHeight:'93vh', overflow:'auto', padding:28 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:40, height:40, borderRadius:11, background:`${COLOR}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🤱</div>
                <div>
                  <h2 style={{ fontSize:17, fontWeight:800, color:'var(--text-primary)', margin:0 }}>{sel.patient_name}</h2>
                  <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>{sel.patient_number} · PNC Encounter</p>
                </div>
              </div>
              <button onClick={()=>setSel(null)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={20}/></button>
            </div>

            <div style={{ display:'flex', gap:4, marginBottom:20, background:'var(--bg-elevated)', borderRadius:10, padding:4 }}>
              {FTABS.map(t=>(
                <button key={t.id} onClick={()=>setFormTab(t.id)} style={{ flex:1, padding:'7px 4px', borderRadius:7, border:'none', cursor:'pointer', fontSize:11, fontWeight:600, background:formTab===t.id?COLOR:'transparent', color:formTab===t.id?'#fff':'var(--text-muted)', fontFamily:'DM Sans, sans-serif' }}>{t.label}</button>
              ))}
            </div>

            {formTab==='mother' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <Inp label="Visit Date" type="date" value={form.visit_date} onChange={e=>sf('visit_date',e.target.value)}/>
                <Inp label="Delivery Date" type="date" value={form.delivery_date} onChange={e=>sf('delivery_date',e.target.value)}/>
                <Sel label="Mother Condition" value={form.mother_condition} onChange={e=>sf('mother_condition',e.target.value)}>
                  <option value="">Select...</option><option>Well</option><option>Sick</option><option>Referred</option><option>Deceased</option>
                </Sel>
                <Inp label="Blood Pressure" value={form.blood_pressure} onChange={e=>sf('blood_pressure',e.target.value)} placeholder="120/80"/>
                <Inp label="Temperature (°C)" type="number" step="0.1" value={form.temperature} onChange={e=>sf('temperature',e.target.value)}/>
                <Sel label="Uterine Involution" value={form.uterine_involution} onChange={e=>sf('uterine_involution',e.target.value)}>
                  <option value="">Select...</option><option>Well Involuted</option><option>Sub-involuted</option><option>Not Assessed</option>
                </Sel>
                <Sel label="Lochia" value={form.lochia} onChange={e=>sf('lochia',e.target.value)}>
                  <option value="">Select...</option><option>Rubra</option><option>Serosa</option><option>Alba</option><option>Abnormal</option>
                </Sel>
                <Sel label="Perineum / Episiotomy" value={form.perineum_healing} onChange={e=>sf('perineum_healing',e.target.value)}>
                  <option value="">Select...</option><option>Healing Well</option><option>Infected</option><option>Dehisced</option><option>N/A</option>
                </Sel>
                <Sel label="Breast Examination" value={form.breast_examination} onChange={e=>sf('breast_examination',e.target.value)}>
                  <option value="">Select...</option><option>Normal</option><option>Engorged</option><option>Mastitis</option><option>Cracked Nipples</option>
                </Sel>
                <Inp label="Next Visit Date" type="date" value={form.next_visit_date} onChange={e=>sf('next_visit_date',e.target.value)}/>
                <div style={{ gridColumn:'1/-1' }}><Txt label="Complaints" rows={2} value={form.complaints} onChange={e=>sf('complaints',e.target.value)}/></div>
                <div style={{ gridColumn:'1/-1' }}><Txt label="Treatment Given" rows={3} value={form.treatment_given} onChange={e=>sf('treatment_given',e.target.value)} placeholder="Medications, supplements, wound care..."/></div>
              </div>
            )}

            {formTab==='baby' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <Sel label="Delivery Outcome" value={form.delivery_outcome} onChange={e=>sf('delivery_outcome',e.target.value)}>
                  <option value="">Select...</option><option>Live Birth</option><option>Stillbirth</option><option>Neonatal Death</option>
                </Sel>
                <Sel label="Mode of Delivery" value={form.delivery_mode} onChange={e=>sf('delivery_mode',e.target.value)}>
                  <option value="">Select...</option><option>SVD</option><option>C-Section</option><option>Forceps</option><option>Vacuum</option><option>Breech</option>
                </Sel>
                <Inp label="Birth Weight (kg)" type="number" step="0.01" value={form.birth_weight} onChange={e=>sf('birth_weight',e.target.value)}/>
                <Sel label="Sex of Baby" value={form.baby_sex} onChange={e=>sf('baby_sex',e.target.value)}>
                  <option value="">Select...</option><option>Male</option><option>Female</option>
                </Sel>
                <Sel label="Baby Condition" value={form.baby_condition} onChange={e=>sf('baby_condition',e.target.value)}>
                  <option value="">Select...</option><option>Well</option><option>Sick</option><option>Referred</option><option>Deceased</option>
                </Sel>
                <Sel label="Feeding Method" value={form.feeding_method} onChange={e=>sf('feeding_method',e.target.value)}>
                  <option value="">Select...</option><option>Exclusive Breastfeeding</option><option>Mixed Feeding</option><option>Formula</option><option>Not Feeding</option>
                </Sel>
                <Sel label="Umbilical Cord Status" value={form.cord_status} onChange={e=>sf('cord_status',e.target.value)}>
                  <option value="">Select...</option><option>Clean & Dry</option><option>Moist / Slight Odor</option><option>Purulent Discharge / Infected</option><option>Cord Off - Normal Healing</option>
                </Sel>
                <Sel label="Neonatal Jaundice Check" value={form.jaundice_check} onChange={e=>sf('jaundice_check',e.target.value)}>
                  <option value="">Select...</option><option>No Jaundice (Normal)</option><option>Mild Jaundice (Face Only)</option><option>Moderate (Trunk & Limbs)</option><option>Severe Jaundice (Palms & Soles - URGENT REFERRAL)</option>
                </Sel>
                <div style={{ gridColumn:'1/-1', background:'var(--bg-elevated)', padding:12, borderRadius:10, border:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)' }}>💉 Child Immunization & CWC Link</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>Transfer baby to CWC Clinic for BCG, OPV 0, & Growth Monitoring</div>
                  </div>
                  <Btn size="sm" onClick={() => {
                    toast.success('Redirecting to Child Immunization Clinic...');
                    navigate('/app/mch/immunization', { state: { babyName: sel.patient_name + ' (Baby)', motherId: sel.patient_id } });
                  }}>
                    Open Immunization →
                  </Btn>
                </div>
              </div>
            )}

            {formTab==='fp' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <Sel label="FP Counseling Done?" value={form.fp_counseling} onChange={e=>sf('fp_counseling',e.target.value)}>
                  <option value="">Select...</option><option>Yes</option><option>No</option><option>Declined</option>
                </Sel>
                <Sel label="FP Method Chosen" value={form.fp_method_chosen} onChange={e=>sf('fp_method_chosen',e.target.value)}>
                  <option value="">None / Not Chosen</option><option>COC Pills</option><option>POP Pills</option><option>Depo-Provera</option><option>Implanon / Jadelle</option><option>IUD / Copper T</option><option>Male Condom</option><option>Female Condom</option><option>LAM</option><option>NFP</option><option>BTL</option><option>Vasectomy</option>
                </Sel>
                <div style={{ gridColumn:'1/-1' }}><Txt label="Counseling Notes" rows={5} value={form.postnatal_assessment} onChange={e=>sf('postnatal_assessment',e.target.value)} placeholder="Counseling given, patient education, FP plan, baby immunization schedule..."/></div>
              </div>
            )}

            <div style={{ padding:14, background:'var(--bg-elevated)', borderRadius:12, margin:'20px 0 16px', border:'1px solid var(--border)' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.5px', marginBottom:10 }}>PATIENT DISPOSITION</div>
              <div style={{ display:'flex', gap:10, marginBottom:action==='admit'?12:0 }}>
                {[{v:'discharge',l:'✅ Discharge'},{v:'admit',l:'🏥 Admit to Ward'}].map(o=>(
                  <button key={o.v} onClick={()=>setAction(o.v)} style={{ flex:1, padding:10, borderRadius:9, border:'1px solid', borderColor:action===o.v?COLOR:'var(--border)', background:action===o.v?`${COLOR}12`:'transparent', color:action===o.v?COLOR:'var(--text-muted)', fontWeight:600, cursor:'pointer', fontSize:12, fontFamily:'DM Sans, sans-serif' }}>{o.l}</button>
                ))}
              </div>
              {action==='admit' && <Inp label="Ward / Unit" value={form.admission_ward} onChange={e=>sf('admission_ward',e.target.value)} placeholder="e.g. Maternity Ward..."/>}
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <Btn variant="ghost" onClick={()=>setSel(null)} style={{ flex:1, justifyContent:'center' }}>Cancel</Btn>
              <Btn onClick={handleSave} disabled={saving} style={{ flex:2, justifyContent:'center' }}>
                <Save size={14}/> {saving?'Saving...' : action==='admit'?'Save & Admit':'Save & Discharge'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
