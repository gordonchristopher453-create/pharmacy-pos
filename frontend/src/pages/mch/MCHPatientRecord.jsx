import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Heart, Stethoscope, Baby, Syringe, Users, FlaskConical, Plus, History, Send, AlertTriangle, X, CheckCircle } from 'lucide-react';

const Card = ({ children, style={}, ...props }) => (
  <div style={{ background:'var(--bg-surface)', borderRadius:14, border:'1px solid var(--border)', ...style }} {...props}>{children}</div>
);
const Btn = ({ children, variant='primary', size='md', ...props }) => (
  <button {...props} style={{
    display:'inline-flex', alignItems:'center', gap:6,
    padding: size==='sm' ? '6px 12px' : '10px 18px',
    background: variant==='primary' ? 'var(--accent)' : variant==='danger' ? '#ef4444' : 'var(--bg-elevated)',
    border: variant==='ghost' ? '1px solid var(--border)' : 'none', borderRadius:8,
    color: variant==='primary' ? '#0F1612' : 'var(--text-primary)',
    fontSize: size==='sm' ? 11 : 13, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans, sans-serif', ...props.style
  }}>{children}</button>
);

const TABS = [
  { id:'timeline', label:'Unified Timeline', icon:History, color:'#10b981' },
  { id:'anc', label:'ANC', icon:Heart, color:'#ec4899' },
  { id:'pnc', label:'PNC', icon:Stethoscope, color:'#8b5cf6' },
  { id:'cwc', label:'CWC', icon:Baby, color:'#06b6d4' },
  { id:'immunization', label:'Immunization', icon:Syringe, color:'#f59e0b' },
  { id:'fp', label:'Family Planning', icon:Users, color:'#10b981' },
  { id:'profile', label:'ANC Profile', icon:FlaskConical, color:'#ec4899' },
  { id:'lab', label:'Lab Results', icon:FlaskConical, color:'#3b82f6' },
];

export default function MCHPatientRecord() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timeline');

  // Referral Modal State
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [sendingReferral, setSendingReferral] = useState(false);
  const [referralForm, setReferralForm] = useState({
    reason: 'Severe Hypertension / Pre-Eclampsia',
    priority: 'Urgent',
    notes: 'Referral from MCH Clinic for specialized doctor evaluation.'
  });

  const fetchRecord = async () => {
    try {
      const { data } = await api.get(`/mch/patient/${patientId}`);
      setRecord(data.data);
    } catch { toast.error('Failed to load MCH record'); }
    setLoading(false);
  };

  useEffect(() => {
    if (patientId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchRecord();
    }
  }, [patientId]);

  const handleSendReferral = async () => {
    if (!referralForm.reason) return toast.error('Enter referral reason');
    setSendingReferral(true);
    try {
      await api.post('/triage', {
        patient_id: p.id,
        chief_complaint: `MCH REFERRAL: ${referralForm.reason}`,
        priority: referralForm.priority,
        notes: referralForm.notes
      });
      toast.success(`Patient referred to OPD Queue (${referralForm.priority} Priority)`);
      setShowReferralModal(false);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to send OPD referral');
    }
    setSendingReferral(false);
  };

  if (loading) return <div style={{ padding:28, textAlign:'center', color:'var(--text-muted)' }}>Loading...</div>;
  if (!record) return <div style={{ padding:28, textAlign:'center' }}>Patient not found</div>;

  const p = record.patient;

  // Build Chronological Care Timeline
  const timelineEvents = [
    ...(record.anc || []).map(a => ({
      id: 'anc_' + a.id,
      date: a.visit_date || a.created_at,
      title: `ANC Visit #${a.anc_number || a.visit_number || '1'}`,
      type: 'ANC Clinic',
      color: '#ec4899',
      details: `G${a.gravida}P${a.para} · BP: ${a.blood_pressure || 'N/A'} · Weight: ${a.weight ? a.weight + 'kg' : 'N/A'} · EDD: ${a.edd ? new Date(a.edd).toLocaleDateString() : 'N/A'}`
    })),
    ...(record.pnc || []).map(p => ({
      id: 'pnc_' + p.id,
      date: p.visit_date || p.created_at,
      title: `PNC Assessment`,
      type: 'PNC Clinic',
      color: '#8b5cf6',
      details: `Outcome: ${p.delivery_outcome || 'Live Birth'} · Mother: ${p.mother_condition || 'Well'} · Baby: ${p.baby_condition || 'Well'}`
    })),
    ...(record.cwc || []).map(c => ({
      id: 'cwc_' + c.id,
      date: c.visit_date || c.created_at,
      title: `CWC Growth Monitoring`,
      type: 'Child Welfare',
      color: '#06b6d4',
      details: `Weight: ${c.current_weight}kg · MUAC: ${c.muac || 'N/A'}cm · Nutrition: ${c.nutrition_status || 'Normal'}`
    })),
    ...(record.immunizations || []).map(i => ({
      id: 'imm_' + i.id,
      date: i.date_given || i.created_at,
      title: `Vaccination: ${i.vaccine}`,
      type: 'Immunization',
      color: '#f59e0b',
      details: `Dose: ${i.dose || 'Standard'} · Batch: ${i.batch_number || 'N/A'} · Administered by: ${i.administered_by || 'Nurse'}`
    })),
    ...(record.family_planning || []).map(f => ({
      id: 'fp_' + f.id,
      date: f.start_date || f.created_at,
      title: `FP Method: ${f.method}`,
      type: 'Family Planning',
      color: '#10b981',
      details: `Follow-up due: ${f.follow_up_date ? new Date(f.follow_up_date).toLocaleDateString() : 'N/A'}`
    }))
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  return (
    <div style={{ padding:28, height:'100vh', overflow:'auto' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => navigate('/app/mch')} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><ArrowLeft size={20}/></button>
          <div>
            <h1 style={{ fontSize:20, fontWeight:700, margin:0 }}>{p.full_name}</h1>
            <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>
              {p.patient_number} · {p.gender} · {p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString() : 'N/A'} · {p.phone}
            </p>
          </div>
        </div>
        <Btn variant="danger" size="sm" onClick={() => setShowReferralModal(true)}>
          <Send size={13}/> Refer to OPD Doctor
        </Btn>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:20, background:'var(--bg-surface)', borderRadius:10, padding:4, border:'1px solid var(--border)', flexWrap:'wrap' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding:'8px 16px', borderRadius:7, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
            background: activeTab===tab.id ? tab.color : 'transparent',
            color: activeTab===tab.id ? '#fff' : 'var(--text-muted)',
            display:'flex', alignItems:'center', gap:6
          }}><tab.icon size={14} /> {tab.label}</button>
        ))}
      </div>

      {/* Unified Timeline Tab */}
      {activeTab === 'timeline' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h3 style={{ fontSize:15, fontWeight:700, margin:0 }}>🗓️ Longitudinal Care History ({timelineEvents.length} Events)</h3>
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>Maternal & Child Continuum of Care</span>
          </div>
          {timelineEvents.length === 0 ? (
            <Card style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>No historical care events logged for this patient</Card>
          ) : (
            <div style={{ position:'relative', paddingLeft:20, borderLeft:'2px solid var(--border)', display:'flex', flexDirection:'column', gap:14 }}>
              {timelineEvents.map(evt => (
                <div key={evt.id} style={{ position:'relative' }}>
                  <div style={{
                    position:'absolute', left:-27, top:4, width:12, height:12, borderRadius:'50%',
                    background: evt.color, border:'2px solid var(--bg-surface)'
                  }}/>
                  <Card style={{ padding:'12px 16px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{evt.title}</span>
                          <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4, background:`${evt.color}20`, color: evt.color, fontWeight:700 }}>{evt.type}</span>
                        </div>
                        <p style={{ fontSize:12, color:'var(--text-muted)', margin:'4px 0 0' }}>{evt.details}</p>
                      </div>
                      <span style={{ fontSize:11, color:'var(--text-faint)', fontWeight:600 }}>
                        {evt.date ? new Date(evt.date).toLocaleDateString('en-KE', { day:'numeric', month:'short', year:'numeric' }) : '—'}
                      </span>
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ANC Tab */}
      {activeTab === 'anc' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
            <h3 style={{ fontSize:15, fontWeight:700 }}>🤰 ANC Records ({record.anc?.length || 0})</h3>
            <Btn size="sm" onClick={() => navigate(`/app/mch/anc?patient=${patientId}`)}><Plus size={13}/> New ANC Visit</Btn>
          </div>
          {record.anc?.length === 0 ? <Card style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>No ANC records</Card> :
            record.anc.map(a => (
              <Card key={a.id} style={{ padding:14, marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontWeight:700 }}>ANC #{a.anc_number || a.anc_clinic_number || 'N/A'}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>G{a.gravida}P{a.para} · LMP: {a.lmp ? new Date(a.lmp).toLocaleDateString() : 'N/A'} · EDD: {a.edd ? new Date(a.edd).toLocaleDateString() : 'N/A'}</div>
                  </div>
                  <span style={{ fontSize:11, padding:'2px 8px', borderRadius:4, background:'var(--accent)15', color:'var(--accent)' }}>{a.status}</span>
                </div>
              </Card>
            ))
          }
        </div>
      )}

      {/* ANC Profile Tab */}
      {activeTab === 'profile' && (
        <div>
          <h3 style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>🔬 ANC Profile & Preventive Care</h3>
          {record.anc_profile ? (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {/* Lab Results */}
              <Card style={{ padding:16 }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>🧪 Laboratory Results</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12 }}>
                  <div><span style={{ color:'var(--text-muted)' }}>Blood Group:</span> {record.anc_profile.blood_group || 'N/A'}</div>
                  <div><span style={{ color:'var(--text-muted)' }}>Rh Factor:</span> {record.anc_profile.rh_factor || 'N/A'}</div>
                  <div><span style={{ color:'var(--text-muted)' }}>Hemoglobin:</span> {record.anc_profile.hemoglobin ? record.anc_profile.hemoglobin + ' g/dL' : 'N/A'}</div>
                  <div><span style={{ color:'var(--text-muted)' }}>Urinalysis:</span> {record.anc_profile.urinalysis || 'N/A'}</div>
                  <div><span style={{ color:'var(--text-muted)' }}>HIV Test:</span> {record.anc_profile.hiv_test || 'N/A'}</div>
                  <div><span style={{ color:'var(--text-muted)' }}>VDRL:</span> {record.anc_profile.vdrl || 'N/A'}</div>
                  <div><span style={{ color:'var(--text-muted)' }}>HIV Test Date:</span> {record.anc_profile.hiv_test_date ? new Date(record.anc_profile.hiv_test_date).toLocaleDateString() : 'N/A'}</div>
                  <div><span style={{ color:'var(--text-muted)' }}>VDRL Date:</span> {record.anc_profile.vdrl_date ? new Date(record.anc_profile.vdrl_date).toLocaleDateString() : 'N/A'}</div>
                </div>
              </Card>

              {/* IPT */}
              <Card style={{ padding:16 }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>💊 IPT (Malaria Prevention)</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, fontSize:12 }}>
                  {[1,2,3,4].map(n => (
                    <div key={n}>
                      <span style={{ color:'var(--text-muted)' }}>IPT {n}:</span>{' '}
                      {record.anc_profile['ipt'+n+'_date'] ? new Date(record.anc_profile['ipt'+n+'_date']).toLocaleDateString() : '—'}
                    </div>
                  ))}
                </div>
              </Card>

              {/* TT */}
              <Card style={{ padding:16 }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>💉 TT (Tetanus Toxoid)</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, fontSize:12 }}>
                  {[1,2,3,4,5].map(n => (
                    <div key={n}>
                      <span style={{ color:'var(--text-muted)' }}>TT {n}:</span>{' '}
                      {record.anc_profile['tt'+n+'_date'] ? new Date(record.anc_profile['tt'+n+'_date']).toLocaleDateString() : '—'}
                    </div>
                  ))}
                </div>
              </Card>

              {/* Iron/Folic */}
              <Card style={{ padding:16 }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>💊 Iron & Folic Acid</div>
                <div style={{ fontSize:12 }}>
                  <span style={{ color: record.anc_profile.iron_folic_given ? '#10b981' : 'var(--text-muted)', fontWeight:600 }}>
                    {record.anc_profile.iron_folic_given ? '✅ Given' : '⏳ Not given'}
                  </span>
                  {record.anc_profile.iron_folic_notes && <div style={{ color:'var(--text-muted)', marginTop:4 }}>{record.anc_profile.iron_folic_notes}</div>}
                </div>
              </Card>
            </div>
          ) : (
            <Card style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>
              <FlaskConical size={40} color="var(--text-faint)" style={{ marginBottom:12 }} />
              <p>No ANC profile recorded yet</p>
              <Btn size="sm" style={{ marginTop:12 }} onClick={() => navigate('/app/mch/anc?patient='+patientId)}>
                <Plus size={13} /> Record ANC Profile
              </Btn>
            </Card>
          )}
        </div>
      )}

      {/* ANC Profile Tab */}
      {activeTab === 'profile' && (
        <div>
          <h3 style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>🔬 ANC Profile & Preventive Care</h3>
          {record.anc_profile ? (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {/* Lab Results */}
              <Card style={{ padding:16 }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>🧪 Laboratory Results</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12 }}>
                  <div><span style={{ color:'var(--text-muted)' }}>Blood Group:</span> {record.anc_profile.blood_group || 'N/A'}</div>
                  <div><span style={{ color:'var(--text-muted)' }}>Rh Factor:</span> {record.anc_profile.rh_factor || 'N/A'}</div>
                  <div><span style={{ color:'var(--text-muted)' }}>Hemoglobin:</span> {record.anc_profile.hemoglobin ? record.anc_profile.hemoglobin + ' g/dL' : 'N/A'}</div>
                  <div><span style={{ color:'var(--text-muted)' }}>Urinalysis:</span> {record.anc_profile.urinalysis || 'N/A'}</div>
                  <div><span style={{ color:'var(--text-muted)' }}>HIV Test:</span> {record.anc_profile.hiv_test || 'N/A'}</div>
                  <div><span style={{ color:'var(--text-muted)' }}>VDRL:</span> {record.anc_profile.vdrl || 'N/A'}</div>
                  <div><span style={{ color:'var(--text-muted)' }}>HIV Test Date:</span> {record.anc_profile.hiv_test_date ? new Date(record.anc_profile.hiv_test_date).toLocaleDateString() : 'N/A'}</div>
                  <div><span style={{ color:'var(--text-muted)' }}>VDRL Date:</span> {record.anc_profile.vdrl_date ? new Date(record.anc_profile.vdrl_date).toLocaleDateString() : 'N/A'}</div>
                </div>
              </Card>

              {/* IPT */}
              <Card style={{ padding:16 }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>💊 IPT (Malaria Prevention)</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, fontSize:12 }}>
                  {[1,2,3,4].map(n => (
                    <div key={n}>
                      <span style={{ color:'var(--text-muted)' }}>IPT {n}:</span>{' '}
                      {record.anc_profile['ipt'+n+'_date'] ? new Date(record.anc_profile['ipt'+n+'_date']).toLocaleDateString() : '—'}
                    </div>
                  ))}
                </div>
              </Card>

              {/* TT */}
              <Card style={{ padding:16 }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>💉 TT (Tetanus Toxoid)</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, fontSize:12 }}>
                  {[1,2,3,4,5].map(n => (
                    <div key={n}>
                      <span style={{ color:'var(--text-muted)' }}>TT {n}:</span>{' '}
                      {record.anc_profile['tt'+n+'_date'] ? new Date(record.anc_profile['tt'+n+'_date']).toLocaleDateString() : '—'}
                    </div>
                  ))}
                </div>
              </Card>

              {/* Iron/Folic */}
              <Card style={{ padding:16 }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>💊 Iron & Folic Acid</div>
                <div style={{ fontSize:12 }}>
                  <span style={{ color: record.anc_profile.iron_folic_given ? '#10b981' : 'var(--text-muted)', fontWeight:600 }}>
                    {record.anc_profile.iron_folic_given ? '✅ Given' : '⏳ Not given'}
                  </span>
                  {record.anc_profile.iron_folic_notes && <div style={{ color:'var(--text-muted)', marginTop:4 }}>{record.anc_profile.iron_folic_notes}</div>}
                </div>
              </Card>
            </div>
          ) : (
            <Card style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>
              <FlaskConical size={40} color="var(--text-faint)" style={{ marginBottom:12 }} />
              <p>No ANC profile recorded yet</p>
              <Btn size="sm" style={{ marginTop:12 }} onClick={() => navigate('/app/mch/anc?patient='+patientId)}>
                <Plus size={13} /> Record ANC Profile
              </Btn>
            </Card>
          )}
        </div>
      )}

      {/* PNC Tab */}
      {activeTab === 'pnc' && (
        <div>
          <h3 style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>🤱 PNC Visits ({record.pnc?.length || 0})</h3>
          {record.pnc?.length === 0 ? <Card style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>No PNC visits</Card> :
            record.pnc.map(v => (
              <Card key={v.id} style={{ padding:14, marginBottom:8 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{new Date(v.visit_date).toLocaleDateString()}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>Outcome: {v.delivery_outcome || 'N/A'} · Mother: {v.mother_condition || 'N/A'} · Baby: {v.baby_condition || 'N/A'}</div>
              </Card>
            ))
          }
        </div>
      )}

      {/* CWC Tab */}
      {activeTab === 'cwc' && (
        <div>
          <h3 style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>👶 CWC Records ({record.cwc?.length || 0})</h3>
          {record.cwc?.length === 0 ? <Card style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>No CWC records</Card> :
            record.cwc.map(v => (
              <Card key={v.id} style={{ padding:14, marginBottom:8 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{new Date(v.visit_date).toLocaleDateString()}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>Weight: {v.current_weight}kg · MUAC: {v.muac}cm · Nutrition: {v.nutrition_status || 'N/A'}</div>
              </Card>
            ))
          }
        </div>
      )}

      {/* Immunization Tab */}
      {activeTab === 'immunization' && (
        <div>
          <h3 style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>💉 Immunizations ({record.immunizations?.length || 0})</h3>
          {record.immunizations?.length === 0 ? <Card style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>No immunizations</Card> :
            record.immunizations.map(v => (
              <Card key={v.id} style={{ padding:14, marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <div style={{ fontWeight:700 }}>{v.vaccine}</div>
                  <span style={{ fontSize:12, color:'var(--text-muted)' }}>{v.date_given ? new Date(v.date_given).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>Dose: {v.dose || 'N/A'} · Batch: {v.batch_number || 'N/A'}</div>
              </Card>
            ))
          }
        </div>
      )}

      {/* Family Planning Tab */}
      {activeTab === 'fp' && (
        <div>
          <h3 style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>👥 Family Planning ({record.family_planning?.length || 0})</h3>
          {record.family_planning?.length === 0 ? <Card style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>No FP records</Card> :
            record.family_planning.map(v => (
              <Card key={v.id} style={{ padding:14, marginBottom:8 }}>
                <div style={{ fontWeight:700 }}>{v.method}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>Started: {v.start_date ? new Date(v.start_date).toLocaleDateString() : 'N/A'} · Follow-up: {v.follow_up_date ? new Date(v.follow_up_date).toLocaleDateString() : 'N/A'}</div>
              </Card>
            ))
          }
        </div>
      )}

      {/* Lab Results Tab */}
      {activeTab === 'lab' && (
        <div>
          <h3 style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>🔬 Lab Results</h3>
          <Card style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>
            <FlaskConical size={40} color="var(--text-faint)" style={{ marginBottom:12 }} />
            <p>Lab integration coming soon</p>
            <p style={{ fontSize:12, marginTop:4 }}>ANC profile lab tests will appear here</p>
          </Card>
        </div>
      )}
      {/* OPD Referral Modal */}
      {showReferralModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'var(--bg-surface)', borderRadius:16, border:'1px solid var(--border)', width:'100%', maxWidth:500, padding:24 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:'#ef444418', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Send size={20} color="#ef4444"/>
                </div>
                <div>
                  <h3 style={{ fontSize:16, fontWeight:800, color:'var(--text-primary)', margin:0 }}>Refer Patient to OPD Doctor</h3>
                  <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>Send {p.full_name} to OPD Doctor Consultation</p>
                </div>
              </div>
              <button onClick={() => setShowReferralModal(false)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={18}/></button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:18 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Referral Reason / Indication</label>
                <select value={referralForm.reason} onChange={e => setReferralForm(f => ({ ...f, reason: e.target.value }))} style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'var(--text-primary)', fontSize:12, fontWeight:600 }}>
                  <option>Severe Hypertension / Pre-Eclampsia</option>
                  <option>Severe Anemia (Hb &lt; 8 g/dL)</option>
                  <option>Obstetric Emergency / Vaginal Bleeding</option>
                  <option>Fetal Distress / Reduced Movements</option>
                  <option>Specialized Lab / Ultrasound Order</option>
                  <option>General Medical Complication</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Priority Level</label>
                <div style={{ display:'flex', gap:8 }}>
                  {['Routine', 'Urgent', 'Emergency'].map(lvl => (
                    <button key={lvl} onClick={() => setReferralForm(f => ({ ...f, priority: lvl }))} style={{
                      flex:1, padding:'8px 10px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer',
                      border: referralForm.priority === lvl ? `2px solid ${lvl === 'Emergency' ? '#ef4444' : lvl === 'Urgent' ? '#f59e0b' : 'var(--accent)'}` : '1px solid var(--border)',
                      background: referralForm.priority === lvl ? (lvl === 'Emergency' ? '#ef444420' : lvl === 'Urgent' ? '#f59e0b20' : 'var(--accent-soft)') : 'transparent',
                      color: referralForm.priority === lvl ? (lvl === 'Emergency' ? '#ef4444' : lvl === 'Urgent' ? '#f59e0b' : 'var(--accent)') : 'var(--text-muted)'
                    }}>{lvl}</button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Clinical Referral Notes</label>
                <textarea rows={3} value={referralForm.notes} onChange={e => setReferralForm(f => ({ ...f, notes: e.target.value }))} placeholder="Provide relevant clinical findings or vitals for the doctor..." style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg-elevated)', color:'var(--text-primary)', fontSize:12, fontFamily:'DM Sans, sans-serif' }} />
              </div>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <Btn variant="ghost" onClick={() => setShowReferralModal(false)} style={{ flex:1, justifyContent:'center' }}>Cancel</Btn>
              <Btn variant="danger" disabled={sendingReferral} onClick={handleSendReferral} style={{ flex:1, justifyContent:'center' }}>
                {sendingReferral ? 'Sending...' : 'Send Referral →'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
