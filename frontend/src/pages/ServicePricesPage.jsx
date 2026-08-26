import { useState, useEffect } from 'react';
import ICD10Search from '../components/ICD10Search';
import { useSelector } from 'react-redux';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Plus, X, Save, Trash2, RefreshCw, Upload, DollarSign, Loader, Edit2, Camera } from "lucide-react";
import AIScanner from "../components/AIScanner";

const CATEGORIES = [
  'consultation', 'laboratory', 'radiology', 'procedure',
  'injection', 'admission', 'bed_charge', 'mch', 'other'
];

const Card = ({ children, style={}, ...props }) => (
  <div style={{ background:'var(--bg-surface)', borderRadius:14, border:'1px solid var(--border)', ...style }} {...props}>{children}</div>
);
const Btn = ({ children, variant='primary', size='md', ...props }) => (
  <button {...props} style={{
    display:'inline-flex', alignItems:'center', gap:6,
    padding: size==='sm' ? '6px 12px' : '10px 18px',
    background: variant==='primary' ? 'var(--accent)' : variant==='danger' ? 'var(--danger)' : 'var(--bg-elevated)',
    border: variant==='ghost' ? '1px solid var(--border)' : 'none', borderRadius:8,
    color: variant==='primary' ? '#0F1612' : 'var(--text-primary)',
    fontSize: size==='sm' ? 11 : 13, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans, sans-serif', ...props.style
  }}>{children}</button>
);
const inp = { width:'100%', padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'DM Sans, sans-serif' };

export default function ServicePricesPage() {
  const { user } = useSelector(s => s.auth);
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ category:'consultation', name:'', description:'', price:'' });
  const [saving, setSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const currency = user?.pharmacy?.currency || 'KES';
  const fmt = (n) => `${currency} ${parseFloat(n||0).toLocaleString('en-KE', {minimumFractionDigits:2})}`;

  useEffect(() => { fetchPrices(); }, []);

  const fetchPrices = async () => {
    setLoading(true);
    try {
      const params = filterCat ? `?category=${filterCat}` : '';
      const { data } = await api.get('/billing/service-prices' + params);
      setPrices(data.data || []);
    } catch { toast.error('Failed to load prices'); }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) return toast.error('Name and price required');
    setSaving(true);
    try {
      if (editing) {
        await api.put('/billing/service-prices/' + editing, form);
        toast.success('Price updated');
      } else {
        await api.post('/billing/service-prices', form);
        toast.success('Price added');
      }
      setShowForm(false); setEditing(null);
      setForm({ category:'consultation', name:'', description:'', price:'' });
      fetchPrices();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this price?')) return;
    try {
      await api.delete('/billing/service-prices/' + id);
      toast.success('Price removed');
      fetchPrices();
    } catch { toast.error('Failed'); }
  };

  const handleEdit = (p) => {
    setEditing(p.id);
    setForm({ category:p.category, name:p.name, description:p.description||'', price:p.price });
    setShowForm(true);
  };

  const grouped = prices.reduce((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {});

  return (
    <div style={{ padding:28, height:'100vh', overflow:'auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
            <DollarSign size={22} color="var(--accent)" /> Service Price List
          </h1>
          <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>Manage prices for all services offered</p>
        </div>
          <Btn variant="ghost" onClick={() => setShowScanner(true)}><Camera size={14} /> Scan Price List</Btn>
        <div style={{ display:'flex', gap:8 }}>
          <Btn variant="ghost" onClick={fetchPrices}><RefreshCw size={14} /> Refresh</Btn>
          <Btn onClick={() => { setEditing(null); setForm({ category:'consultation', name:'', description:'', price:'' }); setShowForm(true); }}><Plus size={14} /> Add Price</Btn>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        <button onClick={() => { setFilterCat(''); fetchPrices(); }} style={{ padding:'7px 16px', borderRadius:20, border:'1px solid', borderColor: !filterCat ? 'var(--accent)' : 'var(--border)', background: !filterCat ? 'var(--accent)' : 'transparent', color: !filterCat ? '#0F1612' : 'var(--text-muted)', fontSize:12, fontWeight:600, cursor:'pointer' }}>All</button>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => { setFilterCat(cat); fetchPrices(); }} style={{ padding:'7px 16px', borderRadius:20, border:'1px solid', borderColor: filterCat===cat ? 'var(--accent)' : 'var(--border)', background: filterCat===cat ? 'var(--accent)' : 'transparent', color: filterCat===cat ? '#0F1612' : 'var(--text-muted)', fontSize:12, fontWeight:600, cursor:'pointer', textTransform:'capitalize' }}>{cat.replace('_',' ')}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:60 }}><Loader size={28} /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card style={{ padding:60, textAlign:'center' }}>
          <DollarSign size={48} color="var(--text-faint)" style={{ marginBottom:12 }} />
          <p style={{ color:'var(--text-muted)' }}>No prices set. Add your first service price.</p>
        </Card>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(380px, 1fr))', gap:16 }}>
          {Object.entries(grouped).map(([cat, items]) => (
            <Card key={cat} style={{ padding:0, overflow:'hidden' }}>
              <div style={{ padding:'12px 18px', background:'var(--bg-elevated)', borderBottom:'1px solid var(--border)', fontSize:13, fontWeight:700, textTransform:'capitalize', display:'flex', alignItems:'center', gap:8 }}>
                💰 {cat.replace('_',' ')} <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:400 }}>({items.length})</span>
              </div>
              <div style={{ padding:8 }}>
                {items.map(p => (
                  <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>{p.name}</div>
                      {p.description && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{p.description}</div>}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:14, fontWeight:700, color:'var(--accent)' }}>{fmt(p.price)}</span>
                      <button onClick={() => handleEdit(p)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(p.id)} style={{ background:'none', border:'none', color:'var(--danger)', cursor:'pointer' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <Card style={{ width:'100%', maxWidth:480, padding:28 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ fontSize:17, fontWeight:700 }}>{editing ? '✏️ Edit Price' : '➕ Add Price'}</h3>
              <button onClick={() => { setShowForm(false); setEditing(null); }} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={20}/></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:6 }}>Category</label>
                <select value={form.category} onChange={e => setForm({...form, category:e.target.value})} style={inp}>
                  {CATEGORIES.map(c => <option key={c} value={c} style={{textTransform:'capitalize'}}>{c.replace('_',' ')}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:6 }}>Service Name *</label>
                {['laboratory','procedure','radiology'].includes(form.category) ? (
                  <>
                    <ICD10Search
                      type={form.category === 'laboratory' ? 'lab' : 'procedure'}
                      label=""
                      placeholder={form.category === 'laboratory' ? 'e.g. malaria, FBC, LFTs...' : form.category === 'radiology' ? 'e.g. chest x-ray, ultrasound...' : 'e.g. wound dressing, cannulation...'}
                      value={form.name}
                      onSelect={item => setForm({...form, name: item.name, description: item.code || form.description})}
                    />
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>
                      💡 Select from list — name must match what doctor orders for auto-billing to work
                    </div>
                  </>
                ) : (
                  <input value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="e.g. OPD Consultation, Admission Fee, Injection Fee..." style={inp} />
                )}
              </div>
              <div>
      {showScanner && <AIScanner type="services" onClose={() => setShowScanner(false)} onImport={fetchPrices} />}
                <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:6 }}>Description</label>
                <input value={form.description} onChange={e => setForm({...form, description:e.target.value})} placeholder="Optional description..." style={inp} />
              </div>
              <div>
                <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:6 }}>Price ({currency}) *</label>
                <input type="number" value={form.price} onChange={e => setForm({...form, price:e.target.value})} placeholder="0.00" style={inp} />
              </div>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:20 }}>
              <Btn variant="ghost" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</Btn>
              <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Add Price'}</Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
