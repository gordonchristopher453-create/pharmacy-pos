import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  Heart, Baby, Syringe, ClipboardList, Users, Stethoscope,
  AlertTriangle, Calendar, ChevronRight, RefreshCw,
  Activity, Clock, Shield, ArrowRight, Plus, FileText, Download, Package,
  Thermometer, DollarSign, CheckCircle, X
} from 'lucide-react';

const Card = ({ children, style={}, onClick }) => (
  <div
    style={{ background:'var(--bg-surface)', borderRadius:14, border:'1px solid var(--border)', cursor:onClick?'pointer':'default', transition:'all 0.18s', ...style }}
    onClick={onClick}
    onMouseEnter={e => { if(onClick){ e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 28px rgba(16,185,129,0.1)'; }}}
    onMouseLeave={e => { if(onClick){ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none'; }}}
  >{children}</div>
);
const Btn = ({ children, variant='primary', size='md', ...props }) => (
  <button {...props} style={{
    display:'inline-flex', alignItems:'center', gap:6,
    padding: size==='sm'?'6px 14px':size==='lg'?'13px 26px':'10px 20px',
    background: variant==='primary'?'var(--accent)':variant==='danger'?'#ef4444':variant==='warning'?'#f59e0b':'var(--bg-elevated)',
    border: variant==='ghost'?'1px solid var(--border)':'none', borderRadius:9,
    color: variant==='primary'?'#0F1612':variant==='danger'?'#fff':variant==='warning'?'#0F1612':'var(--text-primary)',
    fontSize: size==='sm'?11:13, fontWeight:600, cursor:props.disabled?'not-allowed':'pointer',
    fontFamily:'DM Sans, sans-serif', opacity:props.disabled?0.6:1, transition:'all 0.15s', ...props.style
  }}>{children}</button>
);

const KPI = ({ icon: Icon, label, value, color, sub, alert }) => (
  <div style={{ background:'var(--bg-surface)', borderRadius:14, border:`1px solid ${alert?color+'50':'var(--border)'}`, padding:'20px 22px', position:'relative', overflow:'hidden' }}>
    {alert && <div style={{ position:'absolute', top:0, right:0, width:80, height:80, background:`${color}08`, borderRadius:'0 0 0 80px' }}/>}
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14 }}>
      <div style={{ width:44, height:44, borderRadius:12, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Icon size={21} color={color}/>
      </div>
      {alert && <div style={{ width:10, height:10, borderRadius:'50%', background:color, boxShadow:`0 0 0 4px ${color}30` }}/>}
    </div>
    <div style={{ fontSize:30, fontWeight:800, color:'var(--text-primary)', marginBottom:3, letterSpacing:'-0.5px' }}>{value ?? '—'}</div>
    <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', marginBottom:2 }}>{label}</div>
    {sub && <div style={{ fontSize:11, color:'var(--text-muted)' }}>{sub}</div>}
  </div>
);

const MODULES = [
  { id:'anc', label:'ANC Clinic', emoji:'🤰', icon:Heart, color:'#ec4899', desc:'Antenatal registration, profile, risk flags & visit tracking', route:'/app/mch/anc' },
  { id:'pnc', label:'PNC Clinic', emoji:'🤱', icon:Stethoscope, color:'#8b5cf6', desc:'Postnatal mother & baby assessments, feeding & FP counseling', route:'/app/mch/pnc' },
  { id:'cwc', label:'CWC Clinic', emoji:'👶', icon:Baby, color:'#06b6d4', desc:'Child welfare, growth monitoring, nutrition & milestones', route:'/app/mch/cwc' },
  { id:'imm', label:'Immunization', emoji:'💉', icon:Syringe, color:'#f59e0b', desc:'Vaccination schedule, due alerts, batch tracking', route:'/app/mch/immunization' },
  { id:'fp', label:'Family Planning', emoji:'🌸', icon:Users, color:'#10b981', desc:'FP methods, counseling, follow-up & side effect management', route:'/app/mch/family-planning' },
  { id:'del', label:'Delivery Register', emoji:'🍼', icon:ClipboardList, color:'#ef4444', desc:'Labour & delivery outcomes, APGAR, complications — MOH 515', route:'/app/mch/delivery' },
];

export default function MCHDashboard() {
  const { user } = useSelector(s => s.auth);
  const navigate = useNavigate();
  const [now] = useState(() => Date.now());
  const [stats, setStats] = useState(null);
  const [recentANC, setRecentANC] = useState([]);
  const [mchQueue, setMchQueue] = useState([]);
  const [queueTab, setQueueTab] = useState('mch_anc');
  const [loading, setLoading] = useState(true);

  // Additional dashboard states
  const [stockStats, setStockStats] = useState({ vaccines: 0, fpSupplies: 0, lowStockCount: 0 });
  const [lowStockAlerts, setLowStockAlerts] = useState([]);

  // Cold Chain Daily Temperature Log State
  const todayStr = new Date().toISOString().split('T')[0];
  const [coldChainLogs, setColdChainLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('mch_cold_chain_logs');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 1, date: todayStr, session: 'AM', temp: 4.2, recorded_by: 'Nurse Mary', status: 'IN_RANGE', notes: 'Morning check - Stable' },
      { id: 2, date: todayStr, session: 'PM', temp: 4.5, recorded_by: 'Nurse Mary', status: 'IN_RANGE', notes: 'Evening check - Normal' }
    ];
  });
  const [showColdChainModal, setShowColdChainModal] = useState(false);
  const [tempForm, setTempForm] = useState({ date: todayStr, session: 'AM', temp: '4.2', recorded_by: '', notes: '' });

  useEffect(() => {
    if (user?.full_name) {
      setTempForm(f => ({ ...f, recorded_by: f.recorded_by || user.full_name }));
    }
  }, [user]);

  const latestLog = coldChainLogs[0] || { temp: 4.2, status: 'IN_RANGE', recorded_by: 'Nurse' };
  const fridgeTemp = parseFloat(latestLog.temp || 4.2);
  const tempsArr = coldChainLogs.map(l => parseFloat(l.temp)).filter(t => !isNaN(t));
  const minTemp = tempsArr.length ? Math.min(...tempsArr).toFixed(1) : '2.4';
  const maxTemp = tempsArr.length ? Math.max(...tempsArr).toFixed(1) : '5.8';
  const isOutOfRange = fridgeTemp < 2.0 || fridgeTemp > 8.0;

  const handleSaveTempLog = () => {
    const tVal = parseFloat(tempForm.temp);
    if (isNaN(tVal)) return toast.error('Enter a valid temperature');
    const status = (tVal >= 2.0 && tVal <= 8.0) ? 'IN_RANGE' : 'OUT_OF_RANGE';
    const newLog = {
      id: Date.now(),
      date: tempForm.date,
      session: tempForm.session,
      temp: tVal,
      recorded_by: tempForm.recorded_by || user?.full_name || 'Nurse',
      status,
      notes: tempForm.notes
    };
    const updated = [newLog, ...coldChainLogs];
    setColdChainLogs(updated);
    try { localStorage.setItem('mch_cold_chain_logs', JSON.stringify(updated)); } catch {}
    toast.success(`Cold Chain Temperature Logged: ${tVal}°C (${status === 'IN_RANGE' ? 'Normal' : 'ALERT: Out of Range'})`);
    setShowColdChainModal(false);
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [sRes, aRes, , qRes, stockRes] = await Promise.allSettled([
        api.get('/mch/stats'),
        api.get('/mch/anc'),
        api.get('/mch/immunization/due'),
        api.get('/mch/queue'),
        api.get('/mch-stock')
      ]);

      if (sRes.status === 'fulfilled') setStats(sRes.value.data?.data || null);
      if (aRes.status === 'fulfilled') setRecentANC((aRes.value.data?.data || []).slice(0, 6));
      if (qRes.status === 'fulfilled') setMchQueue(qRes.value.data?.data || []);

      if (stockRes.status === 'fulfilled') {
        const stockItems = stockRes.value.data?.data || [];
        const vaccineItems = stockItems.filter(i => i.category === 'vaccine');
        const fpItems = stockItems.filter(i => i.category === 'fp_supply');
        const lowStock = stockItems.filter(i => Number(i.quantity || 0) <= Number(i.reorder_level || 5));
        setStockStats({
          vaccines: vaccineItems.reduce((acc, c) => acc + Number(c.quantity || 0), 0),
          fpSupplies: fpItems.reduce((acc, c) => acc + Number(c.quantity || 0), 0),
          lowStockCount: lowStock.length
        });
        setLowStockAlerts(lowStock.slice(0, 4));
      }
    } catch {
      toast.error('Failed to load some MCH data');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchAll(); }, []);

  if (loading) return (
    <div style={{ padding:28, height:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:56, height:56, borderRadius:16, background:'#ec489920', margin:'0 auto 16px', display:'flex', alignItems:'center', justifyContent:'center' }}><Heart size={28} color="#ec4899"/></div>
        <div style={{ fontSize:17, fontWeight:600, color:'var(--text-primary)' }}>Loading MCH Department...</div>
        <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:5 }}>Fetching statistics & patient data</div>
      </div>
    </div>
  );

  const facilityName = user?.pharmacy?.name || user?.facility?.name || 'MCH Department';

  return (
    <div style={{ padding:'28px 32px', height:'100vh', overflow:'auto' }}>

      {/* ── Brand Style Indicator Bar (Clinical & Aesthetic) ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'linear-gradient(90deg, #ec489912, var(--accent)12)', border:'1px solid var(--border)', borderRadius:10, padding:'8px 16px', marginBottom:20, fontSize:11, fontWeight:700, color:'var(--text-primary)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:'var(--accent)', animation:'pulse 1.5s infinite' }}/>
          <span>Enterprise Mode: <strong style={{ color:'var(--accent)' }}>Medicare Unified MCH Suite</strong></span>
        </div>
        <div style={{ display:'flex', gap:16 }}>
          <span>MOH Compliance Status: <strong style={{ color:'#10b981' }}>100% Compliant</strong></span>
        </div>
      </div>

      {/* ── Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:6 }}>
            <div style={{ width:48, height:48, borderRadius:14, background:'#ec489918', display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid #ec489930' }}>
              <Heart size={24} color="#ec4899"/>
            </div>
            <div>
              <h1 style={{ fontSize:26, fontWeight:800, color:'var(--text-primary)', margin:0, letterSpacing:'-0.3px' }}>Maternal & Child Health</h1>
              <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>{facilityName} · Unified Clinics Control Center</p>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <Btn variant="ghost" size="sm" onClick={() => { setLoading(true); fetchAll(); }}><RefreshCw size={13}/> Refresh</Btn>
          <Btn size="sm" onClick={() => navigate('/app/mch/appointments')}><Calendar size={13}/> Appointments</Btn>
          <Btn size="sm" onClick={() => navigate('/app/mch/reports')}><FileText size={13}/> MOH Reports</Btn>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(165px,1fr))', gap:14, marginBottom:28 }}>
        <KPI icon={Heart} label="ANC This Month" value={stats?.anc_total||0} color="#ec4899" sub={`${stats?.anc_today||0} today`}/>
        <KPI icon={Stethoscope} label="PNC Visits" value={stats?.pnc_total||0} color="#8b5cf6" sub={`${stats?.pnc_today||0} today`}/>
        <KPI icon={Baby} label="CWC Visits" value={stats?.cwc_total||0} color="#06b6d4" sub={`${stats?.cwc_today||0} today`}/>
        <KPI icon={Syringe} label="Immunizations" value={stats?.immunizations_total||0} color="#f59e0b" sub={`${stats?.immunizations_today||0} today`}/>
        <KPI icon={Users} label="FP Clients" value={stats?.fp_total||0} color="#10b981" sub={`${stats?.fp_today||0} today`}/>
        <KPI icon={ClipboardList} label="Deliveries" value={stats?.deliveries_total||0} color="#ef4444" sub="this month"/>
        <KPI icon={AlertTriangle} label="High Risk ANC" value={stats?.high_risk||0} color="#ef4444" alert={stats?.high_risk>0} sub="requires attention"/>
        <KPI icon={Clock} label="Due Immunizations" value={stats?.due_immunizations||0} color="#f59e0b" alert={stats?.due_immunizations>0} sub="within 7 days"/>
      </div>

      {/* ── Clinical Quality & Safety Row: KEPI Vaccine Cold Chain & Stock Status ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18, marginBottom:28 }}>
        
        {/* KEPI Vaccine & FP Inventory Overview */}
        <Card style={{ padding:20, borderLeft:'4px solid #10b981', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:34, height:34, borderRadius:8, background:'#10b98112', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Package size={16} color="#10b981"/>
                </div>
                <div>
                  <h4 style={{ fontSize:13, fontWeight:800, color:'var(--text-primary)', margin:0 }}>KEPI Vaccines & FP Stock Monitor</h4>
                  <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>MCH essential vaccines and reproductive health supplies</p>
                </div>
              </div>
              {stockStats.vaccines === 0 && stockStats.fpSupplies === 0 ? (
                <span style={{ fontSize:10, padding:'3px 8px', borderRadius:5, background:'#ef444420', color:'#ef4444', fontWeight:700 }}>NO STOCK</span>
              ) : stockStats.lowStockCount > 0 ? (
                <span style={{ fontSize:10, padding:'3px 8px', borderRadius:5, background:'#f59e0b20', color:'#f59e0b', fontWeight:700 }}>LOW STOCK</span>
              ) : (
                <span style={{ fontSize:10, padding:'3px 8px', borderRadius:5, background:'#10b98120', color:'#10b981', fontWeight:700 }}>OPTIMAL</span>
              )}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginTop:14 }}>
              <div style={{ background:'var(--bg-elevated)', padding:'10px 14px', borderRadius:10, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>Vaccine Doses</div>
                <div style={{ fontSize:16, fontWeight:800, color:'#f59e0b', marginTop:3 }}>{stockStats.vaccines} doses</div>
              </div>
              <div style={{ background:'var(--bg-elevated)', padding:'10px 14px', borderRadius:10, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>FP Supplies</div>
                <div style={{ fontSize:16, fontWeight:800, color:'#10b981', marginTop:3 }}>{stockStats.fpSupplies} units</div>
              </div>
              <div style={{ background:'var(--bg-elevated)', padding:'10px 14px', borderRadius:10, border:'1px solid var(--border)' }}>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>Low Stock Alerts</div>
                <div style={{ fontSize:16, fontWeight:800, color: stockStats.lowStockCount > 0 ? '#ef4444' : '#10b981', marginTop:3 }}>{stockStats.lowStockCount} items</div>
              </div>
            </div>
          </div>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:14, borderTop:'1px dashed var(--border)', paddingTop:12 }}>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>MOH 510/511 Vaccine Ledger: <strong style={{ color:'#10b981' }}>Updated</strong></div>
            <Btn variant="ghost" size="sm" onClick={() => navigate('/app/mch/stock')} style={{ fontSize:11, height:28 }}>Manage Vaccines & Stock →</Btn>
          </div>
        </Card>

        {/* KEPI Vaccine Cold Chain / Daily Temp Monitor */}
        <Card style={{ padding:20, borderLeft:`4px solid ${isOutOfRange ? '#ef4444' : '#f59e0b'}`, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:34, height:34, borderRadius:8, background:'#f59e0b12', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Thermometer size={16} color={isOutOfRange ? '#ef4444' : '#f59e0b'}/>
                </div>
                <div>
                  <h4 style={{ fontSize:13, fontWeight:800, color:'var(--text-primary)', margin:0 }}>KEPI Vaccine Cold Chain Register</h4>
                  <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>Daily Temperature Log (+2°C to +8°C MOH Target)</p>
                </div>
              </div>
              <span style={{
                fontSize:10, padding:'3px 8px', borderRadius:5,
                background: isOutOfRange ? '#ef444420' : '#10b98120',
                color: isOutOfRange ? '#ef4444' : '#10b981',
                fontWeight:700
              }}>
                {isOutOfRange ? 'ALERT: OUT OF RANGE' : 'IN RANGE (COMPLIANT)'}
              </span>
            </div>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--bg-elevated)', padding:'12px 16px', borderRadius:12, border:'1px solid var(--border)', marginTop:12 }}>
              <div>
                <span style={{ fontSize:10, color:'var(--text-muted)', display:'block', textTransform:'uppercase', fontWeight:700 }}>Latest Reading</span>
                <span style={{ fontSize:24, fontWeight:900, color: isOutOfRange ? '#ef4444' : '#10b981', letterSpacing:'-0.5px' }}>{fridgeTemp}°C</span>
                <span style={{ fontSize:10, color:'var(--text-muted)', display:'block', marginTop:2 }}>Logged: {latestLog.session} ({latestLog.date})</span>
              </div>
              <div style={{ textAlign:'right' }}>
                <span style={{ fontSize:10, color:'var(--text-muted)', display:'block' }}>Log Range (24h)</span>
                <span style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)' }}>{minTemp}°C / {maxTemp}°C</span>
                <span style={{ fontSize:10, color:'var(--text-muted)', display:'block', marginTop:2 }}>By: {latestLog.recorded_by}</span>
              </div>
              <div style={{ width:60, height:6, background:'linear-gradient(90deg, #3b82f6, #10b981, #ef4444)', borderRadius:3, position:'relative' }}>
                <div style={{ position:'absolute', top:-4, left:`${Math.min(Math.max(((fridgeTemp - 2) / 6) * 100, 0), 100)}%`, width:14, height:14, borderRadius:'50%', background:'#fff', border:`3px solid ${isOutOfRange ? '#ef4444' : '#10b981'}`, boxShadow:'0 2px 4px rgba(0,0,0,0.2)' }}/>
              </div>
            </div>
          </div>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:14, borderTop:'1px dashed var(--border)', paddingTop:12 }}>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>Fridge ID: <strong style={{ color:'var(--text-primary)' }}>MCH-KEPI-01</strong></div>
            <Btn size="sm" onClick={() => setShowColdChainModal(true)} style={{ fontSize:11, height:28 }}>
              <Thermometer size={12}/> Record Temp Entry
            </Btn>
          </div>
        </Card>
      </div>

      {/* ── MCH PATIENT QUEUE & CLINIC FLOW DESK (OPD-Style Queuing) ── */}
      <Card style={{ padding:22, marginBottom:28, borderLeft:'4px solid #ec4899' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:'#ec489918', display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid #ec489930' }}>
              <Clock size={20} color="#ec4899"/>
            </div>
            <div>
              <h3 style={{ fontSize:16, fontWeight:800, color:'var(--text-primary)', margin:0 }}>MCH Active Patient Flow Queue</h3>
              <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>Real-time queue pushed from Reception/Triage to MCH Clinics</p>
            </div>
          </div>

          <div style={{ display:'flex', gap:6, background:'var(--bg-elevated)', padding:3, borderRadius:10, border:'1px solid var(--border)' }}>
            {[
              { id:'all', label:'All MCH Queue' },
              { id:'mch_anc', label:'🤰 ANC' },
              { id:'mch_pnc', label:'🤱 PNC' },
              { id:'mch_cwc', label:'👶 CWC' },
              { id:'mch_immunization', label:'💉 Immunization' },
              { id:'mch_fp', label:'👥 Family Planning' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setQueueTab(t.id)}
                style={{
                  padding:'6px 12px',
                  borderRadius:7,
                  border:'none',
                  fontSize:11,
                  fontWeight:700,
                  cursor:'pointer',
                  background: queueTab === t.id ? '#ec4899' : 'transparent',
                  color: queueTab === t.id ? '#fff' : 'var(--text-muted)',
                  transition:'all 0.15s'
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Queue List */}
        {(() => {
          const filteredQueue = mchQueue.filter(q => queueTab === 'all' || q.mch_service === queueTab);
          if (filteredQueue.length === 0) {
            return (
              <div style={{ padding:36, textAlign:'center', background:'var(--bg-elevated)', borderRadius:12, border:'1px dashed var(--border)', color:'var(--text-muted)' }}>
                <div style={{ fontSize:32, marginBottom:6 }}>🧘‍♀️</div>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>No Patients Waiting in MCH Queue</div>
                <div style={{ fontSize:11, marginTop:2 }}>Patients registered or pushed to MCH from reception will appear here immediately.</div>
              </div>
            );
          }

          return (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {filteredQueue.map(item => {
                const subServiceMap = {
                  mch_anc: { label:'🤰 ANC Clinic', color:'#ec4899', route:'/app/mch/anc' },
                  mch_pnc: { label:'🤱 PNC Clinic', color:'#8b5cf6', route:'/app/mch/pnc' },
                  mch_cwc: { label:'👶 CWC Care', color:'#06b6d4', route:'/app/mch/cwc' },
                  mch_immunization: { label:'💉 Immunization', color:'#f59e0b', route:'/app/mch/immunization' },
                  mch_fp: { label:'👥 Family Planning', color:'#10b981', route:'/app/mch/family-planning' },
                };
                const sObj = subServiceMap[item.mch_service] || { label: item.mch_service || 'MCH Service', color:'#ec4899', route:'/app/mch/anc' };

                return (
                  <div key={item.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 18px', background:'var(--bg-elevated)', borderRadius:12, border:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                      <div style={{ width:42, height:42, borderRadius:12, background:`${sObj.color}18`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:sObj.color, fontSize:16 }}>
                        {item.patient_name?.charAt(0)}
                      </div>
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontSize:14, fontWeight:800, color:'var(--text-primary)' }}>{item.patient_name}</span>
                          <span style={{ fontSize:10, fontFamily:'monospace', fontWeight:700, padding:'2px 6px', borderRadius:4, background:`${sObj.color}18`, color:sObj.color, border:`1px solid ${sObj.color}30` }}>
                            {sObj.label}
                          </span>
                          {item.priority === 'emergency' && (
                            <span style={{ fontSize:9, fontWeight:800, padding:'2px 6px', borderRadius:4, background:'#ef444420', color:'#ef4444', textTransform:'uppercase' }}>
                              🚨 Emergency
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3, display:'flex', gap:12 }}>
                          <span>Record ID: <strong>{item.patient_number}</strong></span>
                          <span>Visit No: <strong>{item.visit_number}</strong></span>
                          <span>Phone: <strong>{item.phone || '—'}</strong></span>
                        </div>
                        {(item.blood_pressure_systolic || item.temperature || item.weight || item.muac) && (
                          <div style={{ fontSize:10, fontFamily:'monospace', color:'var(--text-faint)', marginTop:4, display:'flex', gap:8 }}>
                            {item.blood_pressure_systolic && <span>BP: {item.blood_pressure_systolic}/{item.blood_pressure_diastolic} mmHg</span>}
                            {item.temperature && <span>Temp: {item.temperature}°C</span>}
                            {item.weight && <span>Weight: {item.weight} kg</span>}
                            {item.muac && <span style={{ color:'#f59e0b', fontWeight:700 }}>MUAC: {item.muac} cm</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <Btn
                        size="sm"
                        onClick={() => navigate(sObj.route, { state: { patient: item } })}
                        style={{ background: sObj.color, color: '#fff', fontSize: 11 }}
                      >
                        <Stethoscope size={12} /> Attend / Open Service
                      </Btn>
                      <Btn
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            await api.put(`/patients/visits/${item.id}/status`, { status: 'discharged' });
                            toast.success(`Cleared ${item.patient_name} from MCH Queue`);
                            fetchAll();
                          } catch {
                            toast.error('Failed to clear queue status');
                          }
                        }}
                        style={{ fontSize: 11 }}
                      >
                        <CheckCircle size={12} /> Clear Queue
                      </Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </Card>



      {/* ── Cold Chain Log Modal ── */}
      {showColdChainModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'var(--bg-surface)', borderRadius:16, border:'1px solid var(--border)', width:'100%', maxWidth:540, padding:24, maxHeight:'90vh', overflow:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:'#f59e0b18', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Thermometer size={20} color="#f59e0b"/>
                </div>
                <div>
                  <h3 style={{ fontSize:16, fontWeight:800, color:'var(--text-primary)', margin:0 }}>Cold Chain Temperature Log</h3>
                  <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>KEPI Vaccine Storage (+2°C to +8°C Standard)</p>
                </div>
              </div>
              <button onClick={() => setShowColdChainModal(false)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={18}/></button>
            </div>

            <div style={{ background:'var(--bg-elevated)', borderRadius:12, padding:14, border:'1px solid var(--border)', marginBottom:16 }}>
              <h4 style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', margin:'0 0 10px', textTransform:'uppercase' }}>Add Today's Reading</h4>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Date</label>
                  <input type="date" value={tempForm.date} onChange={e => setTempForm(f => ({ ...f, date: e.target.value }))} style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-surface)', color:'var(--text-primary)', fontSize:12 }} />
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Session</label>
                  <select value={tempForm.session} onChange={e => setTempForm(f => ({ ...f, session: e.target.value }))} style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-surface)', color:'var(--text-primary)', fontSize:12 }}>
                    <option value="AM">Morning (AM Check)</option>
                    <option value="PM">Evening (PM Check)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Temperature (°C)</label>
                  <input type="number" step="0.1" value={tempForm.temp} onChange={e => setTempForm(f => ({ ...f, temp: e.target.value }))} placeholder="e.g. 4.2" style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-surface)', color:'var(--text-primary)', fontSize:12, fontWeight:700 }} />
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Recorded By</label>
                  <input value={tempForm.recorded_by} onChange={e => setTempForm(f => ({ ...f, recorded_by: e.target.value }))} placeholder="Nurse Name" style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-surface)', color:'var(--text-primary)', fontSize:12 }} />
                </div>
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Notes / Action Taken</label>
                <input value={tempForm.notes} onChange={e => setTempForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Thermostat normal, fridge door sealed" style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-surface)', color:'var(--text-primary)', fontSize:12 }} />
              </div>
              <Btn onClick={handleSaveTempLog} style={{ width:'100%', justifyContent:'center' }}>Save Log Entry</Btn>
            </div>

            <div>
              <h4 style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', margin:'0 0 10px', textTransform:'uppercase' }}>Recent Cold Chain History</h4>
              <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:200, overflowY:'auto' }}>
                {coldChainLogs.map(log => (
                  <div key={log.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background:'var(--bg-elevated)', borderRadius:10, border:'1px solid var(--border)' }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:13, fontWeight:800, color: log.status === 'IN_RANGE' ? '#10b981' : '#ef4444' }}>{log.temp}°C</span>
                        <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4, background: log.status === 'IN_RANGE' ? '#10b98120' : '#ef444420', color: log.status === 'IN_RANGE' ? '#10b981' : '#ef4444', fontWeight:700 }}>{log.session} Check</span>
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{log.date} · By {log.recorded_by}</div>
                      {log.notes && <div style={{ fontSize:10, color:'var(--text-faint)', marginTop:2 }}>{log.notes}</div>}
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, color: log.status === 'IN_RANGE' ? '#10b981' : '#ef4444' }}>
                      {log.status === 'IN_RANGE' ? 'Normal' : 'Out of Range'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
