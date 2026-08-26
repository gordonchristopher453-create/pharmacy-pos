import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Baby, ArrowLeft, Search, RefreshCw, X, Save } from 'lucide-react';

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

const COLOR = '#06b6d4';
const today = new Date().toISOString().split('T')[0];

const nutritionColor = n => {
  if (!n) return 'var(--text-muted)';
  if (n === 'SAM') return '#ef4444';
  if (n === 'MAM') return '#f59e0b';
  if (n === 'Overweight') return '#8b5cf6';
  return '#10b981';
};

const BLANK = {
  visit_date:today, birth_weight:'', current_weight:'', height:'', muac:'',
  head_circumference:'', nutrition_status:'', milestones:'',
  immunization_status:'', developmental_milestones:'', complaints:'',
  treatment_given:'', next_appointment:'', counseling:'',
};

const CWC_VACCINES = [
  { name: 'BCG', dose: 'Birth' },
  { name: 'OPV 0', dose: 'Birth' },
  { name: 'OPV 1', dose: '6 Weeks' },
  { name: 'OPV 2', dose: '10 Weeks' },
  { name: 'OPV 3', dose: '14 Weeks' },
  { name: 'Rotarix 1', dose: '6 Weeks' },
  { name: 'Rotarix 2', dose: '10 Weeks' },
  { name: 'DPT/HepB/Hib 1 (Pentavalent)', dose: '6 Weeks' },
  { name: 'DPT/HepB/Hib 2 (Pentavalent)', dose: '10 Weeks' },
  { name: 'DPT/HepB/Hib 3 (Pentavalent)', dose: '14 Weeks' },
  { name: 'PCV 10 1', dose: '6 Weeks' },
  { name: 'PCV 10 2', dose: '10 Weeks' },
  { name: 'PCV 10 3', dose: '14 Weeks' },
  { name: 'IPV 1', dose: '14 Weeks' },
  { name: 'IPV 2', dose: '6 Months' },
  { name: 'Measles-Rubella (MR) 1', dose: '9 Months' },
  { name: 'Measles-Rubella (MR) 2', dose: '18 Months' },
  { name: 'Yellow Fever', dose: '9 Months' },
  { name: 'Vitamin A (6 Months)', dose: '6 Months' },
  { name: 'Vitamin A (12 Months)', dose: '12 Months' },
];

export default function CWCPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState('queue');
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [qL, setQL] = useState(false);
  const [hL, setHL] = useState(false);
  const [sel, setSel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formTab, setFormTab] = useState('growth');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ ...BLANK });
  const sf = (k,v) => setForm(f=>({...f,[k]:v}));

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
    fetchQueue();
    fetchServicePrices();
  }, []);

  useEffect(() => {
    if (location.state?.autoAttendVisit) {
      const v = location.state.autoAttendVisit;
      setSel(v);
      setForm({ ...BLANK });
      setFormTab('growth');
      fetchPatientImmunizations(v.patient_id);
    }
  }, [location.state]);
  useEffect(() => { if(tab==='history') fetchHistory(); }, [tab]);

  const fetchQueue = async () => {
    setQL(true);
    try { const { data } = await api.get('/mch/queue'); setQueue((data.data||[]).filter(v=>v.mch_service==='mch_cwc')); }
    catch { toast.error('Failed to load queue'); }
    setQL(false);
  };
  const fetchHistory = async () => {
    setHL(true);
    try {
      const params = new URLSearchParams({ date_from:dateFrom, date_to:dateTo });
      if(search) params.append('search',search);
      const { data } = await api.get('/mch/cwc?'+params.toString());
      setHistory(data.data||[]);
    } catch { toast.error('Failed to load history'); }
    setHL(false);
  };
  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/mch/cwc', { ...form, patient_id:sel.patient_id });
      await api.put('/patients/visits/'+sel.id+'/status', { status:'discharged' });
      toast.success('CWC record saved — patient discharged');
      setSel(null); fetchQueue();
    } catch(e) { toast.error(e.response?.data?.message||'Failed to save'); }
    setSaving(false);
  };

  // Calculate age from DOB
  const ageStr = dob => {
    if (!dob) return '';
    const diff = Date.now() - new Date(dob);
    const months = Math.floor(diff / (30.44 * 24 * 3600 * 1000));
    if (months < 24) return `${months}m`;
    return `${Math.floor(months/12)}y ${months%12}m`;
  };

  const FTABS = [{id:'growth',label:'Growth'},{id:'milestones',label:'Milestones'},{id:'immunization',label:'Immunizations'},{id:'clinical',label:'Clinical'}];

  return (
    <div style={{ padding:24, height:'100vh', overflow:'auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={()=>navigate('/app/mch')} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><ArrowLeft size={20}/></button>
          <div>
            <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', margin:0, display:'flex', alignItems:'center', gap:9 }}><Baby size={22} color={COLOR}/> CWC Clinic</h1>
            <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>{queue.length} waiting · Child Welfare · MOH 512</p>
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
          ?<Card style={{ textAlign:'center', padding:64 }}><Baby size={42} color="var(--text-faint)" style={{ marginBottom:12 }}/><p style={{ color:'var(--text-muted)', fontSize:14, fontWeight:600 }}>No children in CWC queue</p></Card>
          :<div style={{ display:'grid', gap:10 }}>
            {queue.map((v,idx)=>(
              <Card key={v.id} style={{ padding:'16px 20px', cursor:'pointer' }}
                onClick={()=>{ setSel(v); setForm({...BLANK}); setFormTab('growth'); fetchPatientImmunizations(v.patient_id); }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=COLOR;e.currentTarget.style.boxShadow=`0 4px 16px ${COLOR}20`;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.boxShadow='none';}}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                    <div style={{ width:44, height:44, borderRadius:'50%', background:`${COLOR}15`, border:`2px solid ${COLOR}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:COLOR }}>{idx+1}</div>
                    <div>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{v.patient_name}</div>
                      <div style={{ fontSize:12, color:'var(--text-muted)' }}>{v.patient_number} · {v.gender}{v.date_of_birth?` · Age: ${ageStr(v.date_of_birth)}`:''}</div>
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <span style={{ fontSize:10, padding:'3px 8px', borderRadius:5, background:`${COLOR}18`, color:COLOR, fontWeight:700 }}>CWC</span>
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
          :history.length===0?<Card style={{ textAlign:'center', padding:60 }}><p style={{ color:'var(--text-muted)' }}>No CWC records found</p></Card>
          :<div style={{ display:'grid', gap:10 }}>{history.map(r=>(
            <Card key={r.id} style={{ padding:'16px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ display:'flex', gap:13, alignItems:'center' }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:`${COLOR}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>👶</div>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{r.full_name}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>{r.patient_number}{r.date_of_birth?` · ${ageStr(r.date_of_birth)}`:''}</div>
                    <div style={{ display:'flex', gap:10, marginTop:4, alignItems:'center' }}>
                      {r.current_weight&&<span style={{ fontSize:11, color:'var(--text-muted)' }}>Wt: <b style={{ color:'var(--text-primary)' }}>{r.current_weight}kg</b></span>}
                      {r.muac&&<span style={{ fontSize:11, color:'var(--text-muted)' }}>MUAC: <b style={{ color:'var(--text-primary)' }}>{r.muac}cm</b></span>}
                      {r.nutrition_status&&<span style={{ fontSize:10, padding:'2px 7px', borderRadius:5, background:nutritionColor(r.nutrition_status)+'20', color:nutritionColor(r.nutrition_status), fontWeight:700 }}>{r.nutrition_status}</span>}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>{new Date(r.visit_date||r.created_at).toLocaleDateString('en-KE')}</div>
              </div>
            </Card>
          ))}</div>}
        </div>
      )}

      {sel && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'var(--bg-surface)', borderRadius:18, border:'1px solid var(--border)', width:'100%', maxWidth:640, maxHeight:'93vh', overflow:'auto', padding:28 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:40, height:40, borderRadius:11, background:`${COLOR}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>👶</div>
                <div>
                  <h2 style={{ fontSize:17, fontWeight:800, color:'var(--text-primary)', margin:0 }}>{sel.patient_name}</h2>
                  <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>{sel.patient_number}{sel.date_of_birth?` · Age: ${ageStr(sel.date_of_birth)}`:''} · CWC Visit</p>
                </div>
              </div>
              <button onClick={()=>setSel(null)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={20}/></button>
            </div>

            <div style={{ display:'flex', gap:4, marginBottom:20, background:'var(--bg-elevated)', borderRadius:10, padding:4 }}>
              {FTABS.map(t=>(
                <button key={t.id} onClick={()=>setFormTab(t.id)} style={{ flex:1, padding:'7px 4px', borderRadius:7, border:'none', cursor:'pointer', fontSize:11, fontWeight:600, background:formTab===t.id?COLOR:'transparent', color:formTab===t.id?'#fff':'var(--text-muted)', fontFamily:'DM Sans, sans-serif' }}>{t.label}</button>
              ))}
            </div>

            {formTab==='growth' && (
              <div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                  <Inp label="Visit Date" type="date" value={form.visit_date} onChange={e=>sf('visit_date',e.target.value)}/>
                  <Inp label="Birth Weight (kg)" type="number" step="0.01" value={form.birth_weight} onChange={e=>sf('birth_weight',e.target.value)}/>
                  <Inp label="Current Weight (kg)" type="number" step="0.01" value={form.current_weight} onChange={e=>sf('current_weight',e.target.value)}/>
                  <Inp label="Height / Length (cm)" type="number" step="0.1" value={form.height} onChange={e=>sf('height',e.target.value)}/>
                  <Inp label="MUAC (cm)" type="number" step="0.1" value={form.muac} onChange={e=>sf('muac',e.target.value)}/>
                  <Inp label="Head Circumference (cm)" type="number" step="0.1" value={form.head_circumference} onChange={e=>sf('head_circumference',e.target.value)}/>
                  <Sel label="Nutrition Status" value={form.nutrition_status} onChange={e=>sf('nutrition_status',e.target.value)}>
                    <option value="">Select...</option><option>Normal</option><option>MAM</option><option>SAM</option><option>Overweight</option><option>Obese</option>
                  </Sel>
                  <Sel label="Immunization Status" value={form.immunization_status} onChange={e=>sf('immunization_status',e.target.value)}>
                    <option value="">Select...</option><option>Up to Date</option><option>Incomplete</option><option>Not Immunized</option>
                  </Sel>
                </div>
                {form.nutrition_status && form.nutrition_status !== 'Normal' && (
                  <div style={{ padding:12, background:nutritionColor(form.nutrition_status)+'15', borderRadius:10, border:`1px solid ${nutritionColor(form.nutrition_status)}30`, marginBottom:12, fontSize:12, color:nutritionColor(form.nutrition_status), fontWeight:600 }}>
                    ⚠️ {form.nutrition_status} detected — refer to nutrition unit as appropriate
                  </div>
                )}
              </div>
            )}

            {formTab==='milestones' && (
              <div style={{ display:'grid', gap:12 }}>
                <div style={{ padding:14, background:'var(--bg-elevated)', borderRadius:12, border:'1px solid var(--border)' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginBottom:8 }}>DEVELOPMENTAL MILESTONES</div>
                  {[['Gross Motor','e.g. Sits, Walks, Runs'],['Fine Motor','e.g. Pincer grasp, Draws'],['Language','e.g. Words, Sentences'],['Social','e.g. Smiles, Plays with peers']].map(([k,ph])=>(
                    <div key={k} style={{ marginBottom:10 }}>
                      <label style={{ ...lbl }}>{k}</label>
                      <input value={form[k.toLowerCase().replace(' ','_')]||''} onChange={e=>sf(k.toLowerCase().replace(' ','_'),e.target.value)} placeholder={ph} style={inp}/>
                    </div>
                  ))}
                </div>
                <Txt label="Milestone Summary / Notes" rows={3} value={form.milestones} onChange={e=>sf('milestones',e.target.value)} placeholder="Overall milestone assessment..."/>
              </div>
            )}

            {formTab==='immunization' && (
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
                      No immunization history recorded for this child
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
                      const preset = CWC_VACCINES.find(v => v.name === selectedVaccine);
                      setImmForm(f => ({
                        ...f,
                        vaccine: selectedVaccine,
                        dose: preset ? preset.dose : f.dose
                      }));
                    }}>
                      <option value="">Select Vaccine...</option>
                      {CWC_VACCINES.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                    </Sel>
                    <Inp label="Dose (e.g. Birth, 6 Weeks, Booster)" value={immForm.dose} onChange={e => setImmForm({...immForm, dose: e.target.value})} />
                    <Inp label="Date Administered" type="date" value={immForm.date_given} onChange={e => setImmForm({...immForm, date_given: e.target.value})} />
                    <Inp label="Next Due Date" type="date" value={immForm.next_due_date} onChange={e => setImmForm({...immForm, next_due_date: e.target.value})} />
                    <Inp label="Batch Number" value={immForm.batch_number} onChange={e => setImmForm({...immForm, batch_number: e.target.value})} placeholder="e.g. B10892" />
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
                    <Txt label="Adverse Reactions / Notes" rows={2} value={immForm.notes} onChange={e => setImmForm({...immForm, notes: e.target.value})} placeholder="e.g. Paracetamol prescribed for fever, mother counseled..." />
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

            {formTab==='clinical' && (
              <div style={{ display:'grid', gap:12 }}>
                <Inp label="Next Appointment" type="date" value={form.next_appointment} onChange={e=>sf('next_appointment',e.target.value)}/>
                <Txt label="Complaints / Reason for Visit" rows={2} value={form.complaints} onChange={e=>sf('complaints',e.target.value)}/>
                <Txt label="Treatment Given / Medications" rows={3} value={form.treatment_given} onChange={e=>sf('treatment_given',e.target.value)} placeholder="RUTF, vitamins, deworming, Vit A, medications..."/>
                <Txt label="Counseling / Education Given" rows={2} value={form.counseling} onChange={e=>sf('counseling',e.target.value)} placeholder="Feeding practices, hygiene, when to return..."/>
              </div>
            )}

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
