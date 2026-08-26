import { useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FlaskConical, Syringe, Pill, Save, X, Plus } from 'lucide-react';

const Card = ({ children, style={}, ...props }) => (
  <div style={{ background:'var(--bg-surface)', borderRadius:14, border:'1px solid var(--border)', padding:20, ...style }} {...props}>{children}</div>
);
const Btn = ({ children, variant='primary', size='md', ...props }) => (
  <button {...props} style={{
    display:'inline-flex', alignItems:'center', gap:6, padding: size==='sm' ? '6px 12px' : '10px 18px',
    background: variant==='primary' ? 'var(--accent)' : variant==='danger' ? 'var(--danger)' : 'var(--bg-elevated)',
    border: variant==='ghost' ? '1px solid var(--border)' : 'none', borderRadius:8,
    color: variant==='primary' ? '#0F1612' : 'var(--text-primary)',
    fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans, sans-serif', ...props.style
  }}>{children}</button>
);
const Input = ({ label, ...props }) => (
  <div>
    <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>{label}</label>
    <input {...props} style={{ width:'100%', padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' }} />
  </div>
);

export default function ANCProfile({ ancId, onSave }) {
  const [form, setForm] = useState({
    blood_group:'', rh_factor:'', hemoglobin:'', urinalysis:'',
    hiv_test:'', vdrl:'', hiv_test_date:'', vdrl_date:'',
    lab_reference:'', performed_by:'', notes:'',
    ipt1_date:'', ipt2_date:'', ipt3_date:'', ipt4_date:'',
    tt1_date:'', tt2_date:'', tt3_date:'', tt4_date:'', tt5_date:'',
    iron_folic_given:false, iron_folic_notes:''
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post(`/mch/anc/${ancId}/profile`, form);
      toast.success('Profile saved!');
      onSave?.();
    } catch { toast.error('Failed to save profile'); }
    setSaving(false);
  };

  return (
    <Card>
      <h3 style={{ fontSize:15, fontWeight:600, color:'var(--text-primary)', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
        <FlaskConical size={18} color="var(--accent)" /> Lab & Preventive Care Profile
      </h3>

      {/* Lab Tests */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:20 }}>
        <Input label="Blood Group" value={form.blood_group} onChange={e => setForm({...form, blood_group:e.target.value})} />
        <Input label="Rh Factor" value={form.rh_factor} onChange={e => setForm({...form, rh_factor:e.target.value})} />
        <Input label="Hemoglobin (g/dL)" type="number" value={form.hemoglobin} onChange={e => setForm({...form, hemoglobin:e.target.value})} />
        <Input label="Urinalysis" value={form.urinalysis} onChange={e => setForm({...form, urinalysis:e.target.value})} />
        <Input label="HIV Test" value={form.hiv_test} onChange={e => setForm({...form, hiv_test:e.target.value})} />
        <Input label="VDRL" value={form.vdrl} onChange={e => setForm({...form, vdrl:e.target.value})} />
        <Input label="HIV Test Date" type="date" value={form.hiv_test_date} onChange={e => setForm({...form, hiv_test_date:e.target.value})} />
        <Input label="VDRL Date" type="date" value={form.vdrl_date} onChange={e => setForm({...form, vdrl_date:e.target.value})} />
        <Input label="Lab Reference" value={form.lab_reference} onChange={e => setForm({...form, lab_reference:e.target.value})} />
      </div>

      {/* IPT Schedule */}
      <h4 style={{ fontSize:13, fontWeight:600, color:'var(--text-muted)', marginBottom:10 }}>IPT (Intermittent Preventive Treatment)</h4>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
        {[1,2,3,4].map(n => (
          <Input key={n} label={`IPT ${n} Date`} type="date" value={form[`ipt${n}_date`]} onChange={e => setForm({...form, [`ipt${n}_date`]:e.target.value})} />
        ))}
      </div>

      {/* TT Schedule */}
      <h4 style={{ fontSize:13, fontWeight:600, color:'var(--text-muted)', marginBottom:10 }}>TT (Tetanus Toxoid)</h4>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:10, marginBottom:20 }}>
        {[1,2,3,4,5].map(n => (
          <Input key={n} label={`TT ${n} Date`} type="date" value={form[`tt${n}_date`]} onChange={e => setForm({...form, [`tt${n}_date`]:e.target.value})} />
        ))}
      </div>

      {/* Iron & Folic */}
      <h4 style={{ fontSize:13, fontWeight:600, color:'var(--text-muted)', marginBottom:10 }}>Iron & Folic Acid</h4>
      <div style={{ display:'flex', gap:16, alignItems:'center', marginBottom:16 }}>
        <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', color:'var(--text-primary)', fontSize:13 }}>
          <input type="checkbox" checked={form.iron_folic_given} onChange={e => setForm({...form, iron_folic_given:e.target.checked})}
            style={{ width:18, height:18, accentColor:'var(--accent)' }} />
          Given
        </label>
        <Input label="Notes" value={form.iron_folic_notes} onChange={e => setForm({...form, iron_folic_notes:e.target.value})} style={{ flex:1 }} />
      </div>

      <Btn onClick={handleSave} disabled={saving}><Save size={14} /> {saving ? 'Saving...' : 'Save Profile'}</Btn>
    </Card>
  );
}
