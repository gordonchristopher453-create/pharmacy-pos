import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  Clock, Heart, Stethoscope, Baby, Syringe, Users, ClipboardList,
  ArrowLeft, Search, Calendar, ChevronRight,
  Phone, Hash
} from 'lucide-react';
import PatientSearch from '../../components/PatientSearch';

const Card = ({ children, style={}, ...props }) => (
  <div style={{ background:'var(--bg-surface)', borderRadius:14, border:'1px solid var(--border)', ...style }} {...props}>{children}</div>
);

const TYPE_CONFIG = {
  anc: { label:'ANC Visit', icon:Heart, color:'#ec4899', route:'/app/mch/anc' },
  pnc: { label:'PNC Visit', icon:Stethoscope, color:'#8b5cf6', route:'/app/mch/pnc' },
  cwc: { label:'CWC Visit', icon:Baby, color:'#06b6d4', route:'/app/mch/cwc' },
  immunization: { label:'Immunization', icon:Syringe, color:'#f59e0b', route:'/app/mch/immunization' },
  fp: { label:'Family Planning', icon:Users, color:'#10b981', route:'/app/mch/family-planning' },
  delivery: { label:'Delivery', icon:ClipboardList, color:'#ef4444', route:'/app/mch/delivery' },
};

export default function MCHHistory() {
  const navigate = useNavigate();
  const [now] = useState(() => Date.now());
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  const fetchHistory = async (patientId) => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        api.get(`/mch/anc?search=${patientId}`),
        api.get(`/mch/pnc?patient_id=${patientId}`),
        api.get(`/mch/cwc?patient_id=${patientId}`),
        api.get(`/mch/immunization?patient_id=${patientId}`),
        api.get(`/mch/family-planning?patient_id=${patientId}`),
        api.get(`/mch/delivery?patient_id=${patientId}`),
      ]);

      const allHistory = [];
      
      // ANC
      if (results[0].status === 'fulfilled') {
        (results[0].value.data.data || []).forEach(a => {
          allHistory.push({ type:'anc', date:a.created_at, data:a, title:'ANC Registration', detail:`G${a.gravida}P${a.para} • EDD: ${a.edd ? new Date(a.edd).toLocaleDateString() : 'N/A'}` });
          // ANC visits
          if (a.visits) a.visits.forEach(v => {
            allHistory.push({ type:'anc', date:v.visit_date, data:v, title:'ANC Visit', detail:`Gest: ${v.gestation_age}wks • Wt: ${v.weight}kg • BP: ${v.blood_pressure}` });
          });
        });
      }
      
      // PNC
      if (results[1].status === 'fulfilled') {
        (results[1].value.data.data || []).forEach(v => {
          allHistory.push({ type:'pnc', date:v.visit_date, data:v, title:'PNC Visit', detail:`Outcome: ${v.delivery_outcome || 'N/A'} • Mother: ${v.mother_condition || 'N/A'}` });
        });
      }
      
      // CWC
      if (results[2].status === 'fulfilled') {
        (results[2].value.data.data || []).forEach(v => {
          allHistory.push({ type:'cwc', date:v.visit_date, data:v, title:'CWC Visit', detail:`Wt: ${v.current_weight}kg • MUAC: ${v.muac}cm • Nutrition: ${v.nutrition_status || 'N/A'}` });
        });
      }
      
      // Immunization
      if (results[3].status === 'fulfilled') {
        (results[3].value.data.data || []).forEach(v => {
          allHistory.push({ type:'immunization', date:v.date_given, data:v, title:`${v.vaccine} Vaccine`, detail:`Dose: ${v.dose || 'N/A'} • Batch: ${v.batch_number || 'N/A'}` });
        });
      }
      
      // FP
      if (results[4].status === 'fulfilled') {
        (results[4].value.data.data || []).forEach(v => {
          allHistory.push({ type:'fp', date:v.created_at, data:v, title:'Family Planning', detail:`Method: ${v.method} • Follow-up: ${v.follow_up_date ? new Date(v.follow_up_date).toLocaleDateString() : 'N/A'}` });
        });
      }
      
      // Delivery
      if (results[5].status === 'fulfilled') {
        (results[5].value.data.data || []).forEach(v => {
          allHistory.push({ type:'delivery', date:v.delivery_date, data:v, title:'Delivery Record', detail:`Mode: ${v.mode_of_delivery || 'N/A'} • Baby: ${v.baby_status} • Wt: ${v.birth_weight}kg • APGAR: ${v.apgar_1min}/${v.apgar_5min}` });
        });
      }

      // Sort by date descending
      allHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
      setHistory(allHistory);
    } catch {
      toast.error('Failed to fetch patient history');
    }
    setLoading(false);
  };

  const handlePatientSelect = (p) => {
    setPatient(p);
    fetchHistory(p.id);
  };

  const filteredHistory = filter === 'all' ? history : history.filter(h => h.type === filter);

  const getAge = (dob) => {
    if (!dob) return '';
    return Math.floor((now - new Date(dob)) / (365.25*24*60*60*1000)) + 'y';
  };

  return (
    <div style={{ padding:28, height:'100vh', overflow:'auto' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => navigate('/app/mch')} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><ArrowLeft size={20} /></button>
          <div>
            <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:8 }}>
              <Clock size={22} color="var(--accent)" /> MCH History
            </h1>
            <p style={{ fontSize:12, color:'var(--text-muted)' }}>Complete maternal & child health timeline</p>
          </div>
        </div>
      </div>

      {/* Patient Search */}
      <div style={{ marginBottom:20 }}>
        <PatientSearch onSelect={handlePatientSelect} placeholder="Search patient by name, phone, or patient number..." />
      </div>

      {/* Patient Info Banner */}
      {patient && (
        <Card style={{ padding:'16px 20px', marginBottom:20, display:'flex', alignItems:'center', gap:16, border:'1px solid var(--accent)', background:'var(--accent)06' }}>
          <div style={{ width:48, height:48, borderRadius:12, background:'var(--accent)18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>👤</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)' }}>{patient.full_name}</div>
            <div style={{ display:'flex', gap:16, fontSize:11, color:'var(--text-muted)', marginTop:3 }}>
              {patient.patient_number && <span style={{ display:'flex', alignItems:'center', gap:4 }}><Hash size={10} /> {patient.patient_number}</span>}
              {patient.phone && <span style={{ display:'flex', alignItems:'center', gap:4 }}><Phone size={10} /> {patient.phone}</span>}
              {patient.date_of_birth && <span style={{ display:'flex', alignItems:'center', gap:4 }}><Calendar size={10} /> {getAge(patient.date_of_birth)} • {new Date(patient.date_of_birth).toLocaleDateString()}</span>}
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:24, fontWeight:700, color:'var(--accent)' }}>{history.length}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>Total Events</div>
          </div>
        </Card>
      )}

      {/* Filters */}
      {patient && (
        <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
          <button onClick={() => setFilter('all')}
            style={{ padding:'7px 16px', borderRadius:20, border:'1px solid', borderColor: filter==='all' ? 'var(--accent)' : 'var(--border)', background: filter==='all' ? 'var(--accent)' : 'transparent', color: filter==='all' ? '#0F1612' : 'var(--text-muted)', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}>
            All ({history.length})
          </button>
          {Object.entries(TYPE_CONFIG).map(([key, config]) => {
            const count = history.filter(h => h.type === key).length;
            if (count === 0) return null;
            return (
              <button key={key} onClick={() => setFilter(key)}
                style={{ padding:'7px 16px', borderRadius:20, border:'1px solid', borderColor: filter===key ? config.color : 'var(--border)', background: filter===key ? `${config.color}18` : 'transparent', color: filter===key ? config.color : 'var(--text-muted)', fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6, transition:'all 0.15s' }}>
                <config.icon size={13} /> {config.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}>Loading history...</div>
      ) : patient && filteredHistory.length === 0 ? (
        <Card style={{ textAlign:'center', padding:60 }}>
          <Clock size={40} color="var(--text-faint)" style={{ marginBottom:12 }} />
          <p style={{ color:'var(--text-muted)', fontSize:14 }}>No MCH history found for this patient</p>
        </Card>
      ) : patient ? (
        <div style={{ position:'relative', paddingLeft:32 }}>
          {/* Timeline line */}
          <div style={{ position:'absolute', left:15, top:0, bottom:0, width:2, background:'var(--border)' }} />
          
          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            {filteredHistory.map((event, i) => {
              const config = TYPE_CONFIG[event.type];
              return (
                <div key={i} style={{ position:'relative', paddingBottom:20 }}>
                  {/* Timeline dot */}
                  <div style={{ position:'absolute', left:-25, top:4, width:12, height:12, borderRadius:'50%', background:config.color, border:'2px solid var(--bg-base)', zIndex:1 }} />
                  
                  <Card style={{ padding:'14px 18px', cursor:'pointer', transition:'all 0.15s' }}
                    onClick={() => navigate(config.route)}
                    onMouseEnter={e => e.currentTarget.style.borderColor = config.color}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                      <div style={{ width:36, height:36, borderRadius:9, background:`${config.color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <config.icon size={16} color={config.color} />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                          <span style={{ fontSize:13, fontWeight:600, color:config.color }}>{event.title}</span>
                          <span style={{ fontSize:10, color:'var(--text-faint)', display:'flex', alignItems:'center', gap:4 }}>
                            <Calendar size={10} /> {event.date ? new Date(event.date).toLocaleDateString('en-KE', { day:'numeric', month:'short', year:'numeric' }) : 'N/A'}
                          </span>
                        </div>
                        <p style={{ fontSize:11, color:'var(--text-muted)', margin:0, lineHeight:1.5 }}>{event.detail}</p>
                      </div>
                      <ChevronRight size={14} color="var(--text-faint)" style={{ marginTop:4 }} />
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <Card style={{ textAlign:'center', padding:80 }}>
          <Search size={48} color="var(--text-faint)" style={{ marginBottom:16 }} />
          <p style={{ color:'var(--text-muted)', fontSize:15, fontWeight:500 }}>Search for a patient to view their MCH history</p>
          <p style={{ color:'var(--text-faint)', fontSize:12, marginTop:6 }}>Search by name, phone number, or patient number</p>
        </Card>
      )}
    </div>
  );
}
