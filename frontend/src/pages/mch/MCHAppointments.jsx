import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Calendar, ChevronLeft, ChevronRight, Plus, X, Save, Search, ArrowLeft } from 'lucide-react';

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

const TYPE_COLORS = { anc:'#ec4899', pnc:'#8b5cf6', cwc:'#06b6d4', immunization:'#f59e0b', fp:'#10b981', delivery:'#ef4444' };
const TYPE_LABELS = { anc:'ANC', pnc:'PNC', cwc:'CWC', immunization:'Immunization', fp:'Family Planning', delivery:'Delivery' };
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function MCHAppointments() {
  const navigate = useNavigate();
  const today = new Date();
  const [curDate, setCurDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selDay, setSelDay] = useState(null);
  const [dayAppts, setDayAppts] = useState([]);
  const [showDay, setShowDay] = useState(false);
  const [patSearch, setPatSearch] = useState('');
  const [patients, setPatients] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ patient_id:'', patient_name:'', appointment_type:'anc', appointment_date:'', time:'09:00', notes:'' });
  const sf = (k,v) => setForm(f=>({...f,[k]:v}));

  const yr = curDate.getFullYear();
  const mo = curDate.getMonth();
  const daysInMonth = new Date(yr, mo+1, 0).getDate();
  const firstDay = new Date(yr, mo, 1).getDay();
  const monthName = curDate.toLocaleString('en', { month:'long' });

  const fetchAppointments = async () => {
    try {
      const { data } = await api.get('/mch/appointments?date='+yr+'-'+String(mo+1).padStart(2,'0')+'-01');
      setAppointments(data.data||[]);
    } catch { toast.error('Failed to load appointments'); }
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchAppointments(); }, [curDate]);

  const getForDay = day => {
    const ds = `${yr}-${String(mo+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return appointments.filter(a=>a.appointment_date?.startsWith(ds));
  };

  const openDay = (day) => {
    setSelDay(day);
    setDayAppts(getForDay(day));
    setShowDay(true);
  };

  const searchPats = async q => {
    if(q.length<2){ setPatients([]); return; }
    try { const { data } = await api.get('/patients?search='+encodeURIComponent(q)+'&limit=6'); setPatients(data.data||[]); }
    catch { /* ignore */ }
  };

  const handleCreate = async () => {
    if(!form.patient_id||!form.appointment_date||!form.appointment_type) return toast.error('Fill required fields');
    setSaving(true);
    try {
      await api.post('/mch/appointments', { ...form });
      toast.success('Appointment booked');
      setShowForm(false);
      setForm({ patient_id:'', patient_name:'', appointment_type:'anc', appointment_date:'', time:'09:00', notes:'' });
      setPatSearch('');
      setLoading(true);
      fetchAppointments();
    } catch(e) { toast.error(e.response?.data?.message||'Failed to book'); }
    setSaving(false);
  };

  const cancelAppt = async (id) => {
    try {
      await api.delete('/mch/appointments/'+id);
      toast.success('Appointment cancelled');
      setDayAppts(d=>d.filter(a=>a.id!==id));
      setAppointments(a=>a.filter(x=>x.id!==id));
    } catch { toast.error('Failed to cancel'); }
  };

  const isToday = day => today.getFullYear()===yr && today.getMonth()===mo && today.getDate()===day;
  const isPast = day => new Date(yr,mo,day) < new Date(today.getFullYear(),today.getMonth(),today.getDate());

  return (
    <div style={{ padding:24, height:'100vh', overflow:'auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={()=>navigate('/app/mch')} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><ArrowLeft size={20}/></button>
          <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', margin:0, display:'flex', alignItems:'center', gap:9 }}><Calendar size={22} color="var(--accent)"/> MCH Appointments</h1>
        </div>
        <Btn onClick={()=>setShowForm(true)}><Plus size={13}/> Book Appointment</Btn>
      </div>

      {/* Type legend */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        {Object.entries(TYPE_LABELS).map(([k,v])=>(
          <div key={k} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', background:TYPE_COLORS[k]+'15', borderRadius:7, border:'1px solid '+TYPE_COLORS[k]+'30' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:TYPE_COLORS[k] }}/>
            <span style={{ fontSize:11, color:TYPE_COLORS[k], fontWeight:600 }}>{v}</span>
          </div>
        ))}
      </div>

      <Card style={{ padding:20 }}>
        {/* Calendar nav */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <button onClick={()=>setCurDate(new Date(yr,mo-1,1))} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 10px', cursor:'pointer', color:'var(--text-primary)', display:'flex', alignItems:'center' }}><ChevronLeft size={16}/></button>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:800, color:'var(--text-primary)' }}>{monthName} {yr}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>{appointments.length} appointments this month</div>
          </div>
          <button onClick={()=>setCurDate(new Date(yr,mo+1,1))} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 10px', cursor:'pointer', color:'var(--text-primary)', display:'flex', alignItems:'center' }}><ChevronRight size={16}/></button>
        </div>

        {/* Day names */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:4 }}>
          {DAYS.map(d=><div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700, color:'var(--text-muted)', padding:'6px 0' }}>{d}</div>)}
        </div>

        {/* Calendar grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
          {Array.from({length:firstDay}).map((_,i)=><div key={'e'+i}/>)}
          {Array.from({length:daysInMonth},(_,i)=>i+1).map(day=>{
            const appts = getForDay(day);
            return (
              <div key={day}
                onClick={()=>openDay(day)}
                style={{
                  minHeight:74, borderRadius:10, border:'1px solid', padding:6, cursor:'pointer', transition:'all 0.15s',
                  borderColor: isToday(day)?'var(--accent)':appts.length>0?'var(--border)':'var(--border)',
                  background: isToday(day)?'var(--accent)15': isPast(day)?'var(--bg-elevated)':'var(--bg-surface)',
                }}>
                <div style={{ fontSize:12, fontWeight:isToday(day)?800:600, color:isToday(day)?'var(--accent)':isPast(day)?'var(--text-faint)':'var(--text-primary)', marginBottom:4 }}>{day}</div>
                {appts.slice(0,3).map(a=>(
                  <div key={a.id} style={{ fontSize:10, padding:'2px 5px', borderRadius:5, background:TYPE_COLORS[a.appointment_type]+'20', color:TYPE_COLORS[a.appointment_type], fontWeight:600, marginBottom:2, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                    {a.patient_name||'Patient'}
                  </div>
                ))}
                {appts.length>3&&<div style={{ fontSize:10, color:'var(--text-faint)', fontWeight:600 }}>+{appts.length-3} more</div>}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Day detail modal */}
      {showDay && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'var(--bg-surface)', borderRadius:16, border:'1px solid var(--border)', width:'100%', maxWidth:480, maxHeight:'80vh', overflow:'auto', padding:24 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h3 style={{ fontSize:16, fontWeight:800, color:'var(--text-primary)', margin:0 }}>
                <Calendar size={16} color="var(--accent)" style={{ marginRight:8, verticalAlign:'middle' }}/>
                {selDay} {monthName} {yr}
              </h3>
              <button onClick={()=>setShowDay(false)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={18}/></button>
            </div>
            {dayAppts.length===0
              ? <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text-faint)', fontSize:13 }}>No appointments this day</div>
              : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {dayAppts.map(a=>(
                    <div key={a.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', background:'var(--bg-elevated)', borderRadius:10, border:'1px solid '+TYPE_COLORS[a.appointment_type]+'30' }}>
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                          <div style={{ width:10, height:10, borderRadius:'50%', background:TYPE_COLORS[a.appointment_type] }}/>
                          <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{a.patient_name}</span>
                        </div>
                        <div style={{ fontSize:11, color:TYPE_COLORS[a.appointment_type], fontWeight:600 }}>{TYPE_LABELS[a.appointment_type]}</div>
                        {a.notes&&<div style={{ fontSize:11, color:'var(--text-faint)', marginTop:3 }}>{a.notes}</div>}
                      </div>
                      <button onClick={()=>cancelAppt(a.id)} style={{ background:'#ef444415', border:'1px solid #ef444430', borderRadius:7, padding:'5px 10px', cursor:'pointer', color:'#ef4444', fontSize:11, fontWeight:600 }}>Cancel</button>
                    </div>
                  ))}
                </div>
            }
            <Btn onClick={()=>{ setShowDay(false); setForm(f=>({...f,appointment_date:`${yr}-${String(mo+1).padStart(2,'0')}-${String(selDay).padStart(2,'0')}`})); setShowForm(true); }} style={{ width:'100%', justifyContent:'center', marginTop:14 }}><Plus size={13}/> Add Appointment This Day</Btn>
          </div>
        </div>
      )}

      {/* New appointment form */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'var(--bg-surface)', borderRadius:18, border:'1px solid var(--border)', width:'100%', maxWidth:500, maxHeight:'90vh', overflow:'auto', padding:28 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:17, fontWeight:800, color:'var(--text-primary)', margin:0 }}>Book MCH Appointment</h2>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={20}/></button>
            </div>

            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Patient *</label>
              <div style={{ position:'relative' }}>
                <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
                <input value={patSearch} onChange={e=>{ setPatSearch(e.target.value); searchPats(e.target.value); }} placeholder="Search patient name or number..." style={{ ...inp, paddingLeft:32 }}/>
                {patients.length>0&&(
                  <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:10, background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:9, boxShadow:'0 8px 28px #00000050', marginTop:4 }}>
                    {patients.map(p=>(
                      <div key={p.id} onClick={()=>{ sf('patient_id',p.id); sf('patient_name',p.full_name); setPatSearch(p.full_name); setPatients([]); }}
                        style={{ padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)', fontSize:13 }}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--bg-elevated)'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <span style={{ fontWeight:700 }}>{p.full_name}</span> <span style={{ color:'var(--text-muted)', fontSize:11 }}>{p.patient_number}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {form.patient_id&&<div style={{ marginTop:5, fontSize:12, color:'#10b981', fontWeight:600 }}>✅ {form.patient_name}</div>}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <Sel label="Appointment Type *" value={form.appointment_type} onChange={e=>sf('appointment_type',e.target.value)}>
                {Object.entries(TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </Sel>
              <Inp label="Date *" type="date" value={form.appointment_date} onChange={e=>sf('appointment_date',e.target.value)}/>
              <Inp label="Time" type="time" value={form.time} onChange={e=>sf('time',e.target.value)}/>
              <div style={{ gridColumn:'1/-1' }}><Txt label="Notes / Reason" rows={3} value={form.notes} onChange={e=>sf('notes',e.target.value)} placeholder="Reason for appointment, special instructions..."/></div>
            </div>

            <div style={{ display:'flex', gap:10, marginTop:20 }}>
              <Btn variant="ghost" onClick={()=>setShowForm(false)} style={{ flex:1, justifyContent:'center' }}>Cancel</Btn>
              <Btn onClick={handleCreate} disabled={saving} style={{ flex:2, justifyContent:'center' }}><Save size={13}/> {saving?'Booking...':'Book Appointment'}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
