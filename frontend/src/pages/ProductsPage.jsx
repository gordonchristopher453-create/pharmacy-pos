import { useState, useEffect } from 'react';
import AIScanner from "../components/AIScanner";
import api from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Search, Edit2, Trash2, Package, X, Loader, AlertTriangle, Camera, CheckCircle2, ShieldAlert, DollarSign } from 'lucide-react';
import { useSelector } from 'react-redux';

const Modal = ({ title, onClose, children }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} />
    <div style={{ position: 'relative', background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', width: '100%', maxWidth: 540, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
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

const Select = ({ label, children, ...props }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{label}</label>
    <select {...props} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, outline: 'none' }}>
      {children}
    </select>
  </div>
);

const EMPTY = { name: "", generic_name: "", barcode: "", category_id: "", supplier_id: "", unit: "tablet", selling_price: "", buying_price: "", min_selling_price: "", max_selling_price: "", reorder_level: 10, requires_prescription: false };

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modal, setModal] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [selected, setSelected] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [stockQty, setStockQty] = useState('');
  const [stockBatch, setStockBatch] = useState('');
  const [stockExpiry, setStockExpiry] = useState('');
  const { user } = useSelector(state => state.auth);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const pRes = await api.get(`/products?department=${user?.role === 'lab_technician' ? 'lab' : 'pharmacy'}`);
      setProducts(pRes.data.data || []);
    } catch (e) { toast.error("Failed to load products: " + (e.response?.data?.message || e.message)); }
    try {
      const cRes = await api.get("/products/categories");
      setCategories(cRes.data.data || []);
    } catch (e) { toast.error("Failed to load categories: " + (e.response?.data?.message || e.message)); }
    try {
      const sRes = await api.get("/stock/suppliers");
      setSuppliers(sRes.data.data || []);
    } catch (e) { console.error("Suppliers error:", e.message); }
    setLoading(false);
  };

  const filtered = products.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.generic_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.includes(search);
    const matchesCat = categoryFilter ? String(p.category_id) === String(categoryFilter) : true;
    return matchesSearch && matchesCat;
  });

  const totalValuation = products.reduce((sum, p) => sum + (parseFloat(p.total_stock || 0) * parseFloat(p.selling_price || 0)), 0);
  const lowStockCount = products.filter(p => parseInt(p.total_stock || 0) <= parseInt(p.reorder_level || 10)).length;

  const openAdd = () => { setForm(EMPTY); setModal('add'); };
  const openEdit = (p) => { setSelected(p); setForm({ ...p, category_id: p.category_id || '', supplier_id: p.supplier_id || '' }); setModal('edit'); };
  const openStock = (p) => { setSelected(p); setStockQty(''); setStockBatch(''); setStockExpiry(''); setModal('stock'); };
  const closeModal = () => { setModal(null); setSelected(null); setDeleteConfirm(null); };

  const handleSave = async () => {
    if (!form.name || !form.selling_price) return toast.error('Name and selling price are required');
    const min = parseFloat(form.min_selling_price || 0);
    const max = parseFloat(form.max_selling_price || 0);
    const price = parseFloat(form.selling_price);
    if (min > 0 && max > 0 && min > max) return toast.error('Min price cannot exceed max price');
    if (min > 0 && price < min) return toast.error('Selling price cannot be below minimum');
    if (max > 0 && price > max) return toast.error('Selling price cannot exceed maximum');
    setSaving(true);
    try {
      if (modal === 'add') {
        await api.post('/products', { ...form, department: user?.role === 'lab_technician' ? 'lab' : 'pharmacy' });
        toast.success('Product created successfully');
      } else {
        await api.put(`/products/${selected.id}`, form);
        toast.success('Product updated successfully');
      }
      closeModal();
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    setDeleting(true);
    try {
      const res = await api.delete(`/products/${id}`);
      toast.success(res.data.message || 'Product deleted successfully');
      setDeleteConfirm(null);
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddStock = async () => {
    if (!stockQty || parseInt(stockQty) <= 0) return toast.error('Enter a valid quantity');
    setSaving(true);
    try {
      await api.post(`/products/${selected.id}/stock`, {
        quantity: parseInt(stockQty),
        batch_number: stockBatch,
        expiry_date: stockExpiry || null
      });
      toast.success('Stock added successfully');
      closeModal();
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to add stock'); }
    finally { setSaving(false); }
  };

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div style={{ padding: 24, minHeight: '100vh', overflow: 'auto', background: 'var(--bg-main)' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Pharmacy Product Catalog</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Manage medicine formulations, prices, prescription constraints & stock</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => setShowScanner(true)} style={{ padding: "10px 16px", borderRadius: 10, background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-primary)", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Camera size={16} /> Scan Invoice AI
          </button>
          <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#0F1612', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(16,185,129,0.25)' }}>
            <Plus size={17} /> Add New Product
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'var(--bg-surface)', padding: '16px 20px', borderRadius: 14, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={22} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Products</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{products.length}</div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: '16px 20px', borderRadius: 14, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={22} color="var(--warning)" />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Low / Out of Stock</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: lowStockCount > 0 ? 'var(--warning)' : 'var(--text-primary)', marginTop: 2 }}>{lowStockCount}</div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: '16px 20px', borderRadius: 14, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={22} color="#6366f1" />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Stock Retail Value</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>KES {totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by drug name, generic name, barcode..." style={{ width: '100%', padding: '11px 14px 11px 42px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ padding: '11px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, outline: 'none' }}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Main Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader size={28} color="var(--accent)" style={{ animation: 'spin 0.8s linear infinite' }} /></div>
      ) : (
        <div style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                {['Product / Drug', 'Category', 'Buying Cost', 'Selling Price', 'Min / Max Price', 'Stock Level', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--text-faint)' }}>
                  <Package size={32} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                  No products found matching filters
                </td></tr>
              ) : filtered.map(p => {
                const stock = parseInt(p.total_stock || 0);
                const isLow = stock <= parseInt(p.reorder_level || 10) && stock > 0;
                const isOut = stock === 0;
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {p.name}
                        {p.requires_prescription && <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(245,158,11,0.15)', color: 'var(--warning)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Rx Required</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{p.generic_name || '—'} • {p.unit}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>{p.category_name || 'General'}</td>
                    <td style={{ padding: '12px 16px' }}><span className="mono" style={{ fontSize: 13, color: 'var(--text-muted)' }}>KES {parseFloat(p.buying_price || 0).toFixed(2)}</span></td>
                    <td style={{ padding: '12px 16px' }}><span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>KES {parseFloat(p.selling_price || 0).toFixed(2)}</span></td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {parseFloat(p.min_selling_price || 0) > 0 ? `KES ${parseFloat(p.min_selling_price).toFixed(2)}` : '—'}
                        {' / '}
                        {parseFloat(p.max_selling_price || 0) > 0 ? `KES ${parseFloat(p.max_selling_price).toFixed(2)}` : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {(isLow || isOut) && <AlertTriangle size={13} color={isOut ? 'var(--danger)' : 'var(--warning)'} />}
                        <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: isOut ? 'var(--danger)' : isLow ? 'var(--warning)' : 'var(--text-primary)' }}>{stock} {p.unit}s</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 600, background: p.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: p.is_active ? 'var(--accent)' : 'var(--danger)' }}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => openStock(p)} title="Add stock batch" style={{ padding: '6px 12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 7, color: 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Stock</button>
                        <button onClick={() => openEdit(p)} title="Edit product" style={{ padding: "6px 10px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-muted)", cursor: "pointer" }}><Edit2 size={13} /></button>
                        <button onClick={() => setDeleteConfirm(p)} title="Delete product" style={{ padding: "6px 10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 7, color: "var(--danger)", cursor: "pointer" }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <Modal title={modal === 'add' ? 'Add New Product' : 'Edit Product Details'} onClose={closeModal}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <div style={{ gridColumn: '1 / -1' }}><Input label="Product Name *" value={form.name} onChange={e => f('name', e.target.value)} placeholder="e.g. Amoxicillin 500mg Caps" /></div>
            <Input label="Generic Name" value={form.generic_name || ''} onChange={e => f('generic_name', e.target.value)} placeholder="e.g. Amoxicillin Trihydrate" />
            <Input label="Barcode / SKU" value={form.barcode || ''} onChange={e => f('barcode', e.target.value)} placeholder="Scan or enter barcode" />
            <Select label="Category" value={form.category_id || ''} onChange={e => f('category_id', e.target.value)}>
              <option value="">No category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select label="Supplier" value={form.supplier_id || ''} onChange={e => f('supplier_id', e.target.value)}>
              <option value="">No supplier</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select label="Unit Type" value={form.unit || 'tablet'} onChange={e => f('unit', e.target.value)}>
              {['tablet', 'capsule', 'bottle', 'sachet', 'vial', 'ampoule', 'tube', 'piece', 'box', 'strip'].map(u => <option key={u} value={u}>{u}</option>)}
            </Select>
            <Input label="Reorder Threshold" type="number" value={form.reorder_level || 10} onChange={e => f('reorder_level', e.target.value)} />
            <Input label="Buying Cost (KES)" type="number" value={form.buying_price || ""} onChange={e => f("buying_price", e.target.value)} placeholder="0.00" />
            <Input label="Selling Price (KES) *" type="number" value={form.selling_price || ''} onChange={e => f('selling_price', e.target.value)} placeholder="0.00" />
            <Input label="Min Selling Price (KES)" type="number" value={form.min_selling_price || ''} onChange={e => f('min_selling_price', e.target.value)} placeholder="0.00" />
            <Input label="Max Selling Price (KES)" type="number" value={form.max_selling_price || ''} onChange={e => f('max_selling_price', e.target.value)} placeholder="0.00" />
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <input type="checkbox" id="rx" checked={form.requires_prescription || false} onChange={e => f('requires_prescription', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="rx" style={{ fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>Requires Doctor Prescription (Rx)</label>
            </div>
            {modal === 'edit' && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <input type="checkbox" id="active" checked={form.is_active !== false} onChange={e => f('is_active', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <label htmlFor="active" style={{ fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>Product Active in System</label>
              </div>
            )}
          </div>
          <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: 13, background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#0F1612', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {saving ? <><Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Saving...</> : 'Save Product'}
          </button>
        </Modal>
      )}

      {/* Add Stock Modal */}
      {modal === 'stock' && (
        <Modal title={`Receive Stock — ${selected?.name}`} onClose={closeModal}>
          <Input label="Quantity Received *" type="number" value={stockQty} onChange={e => setStockQty(e.target.value)} placeholder="e.g. 100" />
          <Input label="Batch Number" value={stockBatch} onChange={e => setStockBatch(e.target.value)} placeholder="e.g. BTH-2026-001" />
          <Input label="Expiry Date" type="date" value={stockExpiry} onChange={e => setStockExpiry(e.target.value)} />
          <button onClick={handleAddStock} disabled={saving} style={{ width: '100%', padding: 13, background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#0F1612', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {saving ? <><Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Adding Stock...</> : 'Confirm Stock Addition'}
          </button>
        </Modal>
      )}

      {/* Delete Product Confirmation Modal */}
      {deleteConfirm && (
        <Modal title="Confirm Product Deletion" onClose={closeModal}>
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={24} color="var(--danger)" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Delete "{deleteConfirm.name}"?
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.5 }}>
              This product will be archived from active sales and inventory listings. Previous sales history will remain preserved for auditing.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={closeModal} style={{ flex: 1, padding: '12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm.id)} disabled={deleting} style={{ flex: 1, padding: '12px', background: 'var(--danger)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {deleting ? <Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Trash2 size={16} />}
                Confirm Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {showScanner && <AIScanner type="products" onClose={() => setShowScanner(false)} onImport={fetchAll} />}
    </div>
  );
}
