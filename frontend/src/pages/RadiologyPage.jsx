import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Camera, Search, RefreshCw, ChevronRight, X, CheckCircle, Clock, Loader, FlaskConical } from 'lucide-react';

const Card = ({ children, style={}, ...props }) => (
  <div style={{ background:'var(--bg-surface)', borderRadius:14, border:'1px solid var(--border)', ...style }} {...props}>{children}</div>
);
const Btn = ({ children, variant='primary', size='md', ...props }) => (
  <button {...props} style={{
    display:'inline-flex', alignItems:'center', gap:6,
    padding: size==='sm' ? '6px 12px' : '10px 18px',
    background: variant==='primary' ? 'var(--accent)' : variant==='danger' ? 'var(--danger)' : variant==='success' ? '#10b981' : 'var(--bg-elevated)',
    border: variant==='ghost' ? '1px solid var(--border)' : 'none', borderRadius:8,
    color: variant==='primary' || variant==='success' ? '#0F1612' : 'var(--text-primary)',
    fontSize: size==='sm' ? 11 : 13, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans, sans-serif', ...props.style
  }}>{children}</button>
);

const STATUS_COLORS = { pending:'#f59e0b', processing:'#3b82f6', completed:'#10b981', cancelled:'#ef4444' };
const STATUS_LABELS = { pending:'⏳ Pending', processing:'🔄 Processing', completed:'✅ Completed', cancelled:'❌ Cancelled' };

export default function RadiologyPage() {
  const { user } = useSelector(s => s.auth);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState('');
  const [techNotes, setTechNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchRequests(); }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/patients/visits?status=radiology');
      setRequests(data.data?.visits || []);
    } catch { toast.error('Failed to load radiology queue'); }
    setLoading(false);
  };

  const openRequest = async (req) => {
    setSelected(req);
    try {
      const { data } = await api.get('/consultations/visit/' + req.id);
      if (data.data?.radiology_requests) {
        setResult(data.data.radiology_requests[0]?.result || '');
        setTechNotes(data.data.radiology_requests[0]?.notes || '');
      }
    } catch {}
  };

  const submitResult = async () => {
    setSaving(true);
    try {
      await api.post(`/consultations/visit/${selected.id}/radiology-report`, {
        study_name: selected.chief_complaint || 'Radiology Examination',
        findings: result,
        impression: result.split('\n')[0] || 'Reported by Radiology Department',
        notes: techNotes
      });
      toast.success('📸 Radiology report saved & dispatched to Doctor!');
      setSelected(null); setResult(''); setTechNotes('');
      fetchRequests();
    } catch { toast.error('Failed to submit radiology report'); }
    setSaving(false);
  };

  const filtered = requests.filter(r =>
    !search || r.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.patient_number?.toLowerCase().includes(search.toLowerCase())
  );

  if (selected) return (
    <div style={{ padding:28, height:'100vh', overflow:'auto' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <button onClick={() => setSelected(null)} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', cursor:'pointer', color:'var(--text-muted)' }}>← Back</button>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)' }}>📸 {selected.patient_name}</h1>
          <p style={{ fontSize:12, color:'var(--text-muted)' }}>{selected.patient_number} · {selected.visit_number}</p>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:20 }}>
        <Card style={{ padding:24 }}>
          <h3 style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>📝 Radiology Report</h3>
          <textarea value={result} onChange={e => setResult(e.target.value)} rows={12}
            placeholder="Enter radiology findings and report..."
            style={{ width:'100%', padding:14, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:10, color:'var(--text-primary)', fontSize:13, outline:'none', resize:'vertical', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' }} />
          
          <div style={{ marginTop:16 }}>
            <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:6 }}>Technician Notes</label>
            <textarea value={techNotes} onChange={e => setTechNotes(e.target.value)} rows={3}
              placeholder="Technical notes, contrast used, etc..."
              style={{ width:'100%', padding:14, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:10, color:'var(--text-primary)', fontSize:13, outline:'none', resize:'vertical', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' }} />
          </div>

          <Btn onClick={submitResult} disabled={saving || !result} style={{ width:'100%', justifyContent:'center', padding:14, marginTop:20 }}>
            {saving ? <Loader size={16} /> : <CheckCircle size={16} />} {saving ? 'Sending...' : 'Submit Report & Return to Doctor'}
          </Btn>
        </Card>

        <Card style={{ padding:20 }}>
          <h3 style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>Patient Info</h3>
          <div style={{ fontSize:12, display:'flex', flexDirection:'column', gap:8 }}>
            <div><span style={{ color:'var(--text-muted)' }}>Name:</span> {selected.patient_name}</div>
            <div><span style={{ color:'var(--text-muted)' }}>Number:</span> {selected.patient_number}</div>
            <div><span style={{ color:'var(--text-muted)' }}>Gender:</span> {selected.gender}</div>
            {selected.chief_complaint && <div><span style={{ color:'var(--text-muted)' }}>Complaint:</span> {selected.chief_complaint}</div>}
          </div>
        </Card>
      </div>
    </div>
  );

  return (
    <div style={{ padding:28, height:'100vh', overflow:'auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:8 }}>
            <Camera size={22} color="#f97316" /> Radiology
          </h1>
          <p style={{ fontSize:12, color:'var(--text-muted)' }}>{requests.length} patients waiting</p>
        </div>
        <button onClick={fetchRequests} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:10, cursor:'pointer', color:'var(--text-muted)', fontSize:13 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{ position:'relative', marginBottom:20 }}>
        <Search size={16} style={{ position:'absolute', left:12, top:11, color:'var(--text-faint)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient..."
          style={{ width:'100%', padding:'10px 12px 10px 36px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:10, color:'var(--text-primary)', fontSize:13, outline:'none' }} />
      </div>

      {loading ? <div style={{ textAlign:'center', padding:60 }}><Loader size={28} /></div> : filtered.length === 0 ? (
        <Card style={{ padding:60, textAlign:'center' }}>
          <Camera size={48} color="var(--text-faint)" style={{ marginBottom:12 }} />
          <p style={{ color:'var(--text-muted)' }}>No radiology requests</p>
        </Card>
      ) : (
        <div style={{ display:'grid', gap:10 }}>
          {filtered.map(req => (
            <Card key={req.id} onClick={() => openRequest(req)} style={{ padding:'16px 20px', cursor:'pointer', display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:'#f9731618', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Camera size={20} color="#f97316" />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:600 }}>{req.patient_name}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                  {req.patient_number} · {req.chief_complaint || 'No complaint'} · {new Date(req.visit_date).toLocaleDateString()}
                </div>
              </div>
              <ChevronRight size={16} color="var(--text-faint)" />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
