import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Edit2, Truck, X, Loader, Phone, Mail } from 'lucide-react';

const Modal = ({ title, onClose, children }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: '#00000070' }} />
    <div style={{ position: 'relative', background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
      </div>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  </div>
);

const Input = ({ label, ...props }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{label}</label>
    <input {...props} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
  </div>
);

const EMPTY = { name: '', phone: '', email: '', address: '', contact_person: '', payment_terms: 30, lead_time_days: 7, notes: '' };

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSuppliers(); }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/stock/suppliers');
      setSuppliers(res.data.data || []);
    } catch { toast.error('Failed to load suppliers'); }
    finally { setLoading(false); }
  };

  const openAdd = () => { setForm(EMPTY); setModal('add'); };
  const openEdit = (s) => { setSelected(s); setForm({ ...s }); setModal('edit'); };
  const closeModal = () => { setModal(null); setSelected(null); };
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name) return toast.error('Supplier name is required');
    setSaving(true);
    try {
      if (modal === 'add') {
        await api.post('/stock/suppliers', { ...form, payment_terms: parseInt(form.payment_terms) || 30, lead_time_days: parseInt(form.lead_time_days) || 7 });
        toast.success('Supplier created');
      } else {
        await api.put(`/stock/suppliers/${selected.id}`, { ...form, payment_terms: parseInt(form.payment_terms) || 30, lead_time_days: parseInt(form.lead_time_days) || 7 });
        toast.success('Supplier updated');
      }
      closeModal(); fetchSuppliers();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ padding: 24, height: '100vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Suppliers</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{suppliers.length} suppliers</p>
        </div>
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#0F1612', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={17} /> Add Supplier
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader size={28} color="var(--accent)" style={{ animation: 'spin 0.8s linear infinite' }} /></div>
      ) : suppliers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-faint)' }}>
          <Truck size={40} style={{ opacity: 0.3, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
          No suppliers yet. Add your first supplier.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {suppliers.map(s => (
            <div key={s.id} style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)', padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Truck size={22} color="var(--accent)" />
                </div>
                <button onClick={() => openEdit(s)} style={{ padding: '6px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <Edit2 size={13} />
                </button>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{s.name}</div>
              {s.contact_person && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Contact: {s.contact_person}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                {s.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}><Phone size={12} />{s.phone}</div>}
                {s.email && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}><Mail size={12} />{s.email}</div>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 4 }}>TOTAL ORDERS</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{s.total_orders || 0}</div>
                </div>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', marginBottom: 4 }}>TOTAL SPENT</div>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                    KES {parseFloat(s.total_purchased || 0).toLocaleString()}
                  </div>
                </div>
              </div>
              {s.payment_terms && (
                <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-faint)' }}>
                  Terms: {s.payment_terms} • Lead time: {s.lead_time_days || 0} days
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(modal === 'add' || modal === 'edit') && (
        <Modal title={modal === 'add' ? 'Add Supplier' : 'Edit Supplier'} onClose={closeModal}>
          <Input label="Supplier Name *" value={form.name} onChange={e => f('name', e.target.value)} placeholder="e.g. Meds Wholesale Ltd" />
          <Input label="Contact Person" value={form.contact_person || ''} onChange={e => f('contact_person', e.target.value)} placeholder="e.g. John Kamau" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Input label="Phone" value={form.phone || ''} onChange={e => f('phone', e.target.value)} placeholder="+254..." />
            <Input label="Email" type="email" value={form.email || ''} onChange={e => f('email', e.target.value)} placeholder="supplier@email.com" />
          </div>
          <Input label="Address" value={form.address || ''} onChange={e => f('address', e.target.value)} placeholder="Nairobi, Kenya" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Payment Terms</label>
              <select value={form.payment_terms || 30} onChange={e => f('payment_terms', e.target.value)} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, outline: 'none' }}>
                  <option value={0}>Cash on Delivery</option><option value={7}>Net 7 days</option><option value={14}>Net 14 days</option><option value={30}>Net 30 days</option><option value={60}>Net 60 days</option>
              </select>
            </div>
            <Input label="Lead Time (days)" type="number" value={form.lead_time_days || 7} onChange={e => f('lead_time_days', e.target.value)} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Notes</label>
            <textarea value={form.notes || ''} onChange={e => f('notes', e.target.value)} rows={3} placeholder="Additional notes..." style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'DM Sans, sans-serif' }} />
          </div>
          <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 13, background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#0F1612', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {saving ? <><Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Saving...</> : 'Save Supplier'}
          </button>
        </Modal>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
