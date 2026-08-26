import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { Plus, X, Loader, ShoppingBag, Trash2, ChevronDown, ChevronUp, ScanLine } from 'lucide-react';
import AIScanner from '../components/AIScanner';

const Modal = ({ title, onClose, children, wide }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: '#00000070' }} />
    <div style={{ position: 'relative', background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', width: '100%', maxWidth: wide ? 780 : 540, maxHeight: '92vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
      </div>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  </div>
);

const Input = ({ label, ...props }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{label}</label>}
    <input {...props} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
  </div>
);

const statusColor = { pending: 'var(--warning)', received: 'var(--accent)', cancelled: 'var(--danger)' };
const EMPTY_ITEM = { product_id: '', product_name: '', quantity_ordered: '', unit_cost: '', batch_number: '', expiry_date: '' };

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const pdfPageToBase64 = async (file) => {
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = Math.min(pdf.numPages, 3);
  const base64Pages = [];
  for (let p = 1; p <= pages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    base64Pages.push(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]);
  }
  return base64Pages;
};

export default function PurchasesPage() {
  const { user } = useSelector(state => state.auth);
  const isLab = user?.role === 'lab_technician';
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ supplier_id: '', invoice_number: '', invoice_date: '', notes: '' });
  const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
  const [scanning, setScanning] = useState(false);
  const [scanPreview, setScanPreview] = useState(null);
  const [scanType, setScanType] = useState(null);
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [ordersRes, suppliersRes, productsRes] = await Promise.all([
        api.get('/stock/purchase-orders?department=' + (isLab ? 'lab' : 'pharmacy')),
        api.get('/stock/suppliers'),
        api.get('/products')
      ]);
      setOrders(ordersRes.data.data || []);
      setSuppliers(suppliersRes.data.data || []);
      setProducts(productsRes.data.data || []);
    } catch { toast.error('Failed to load purchase orders'); }
    finally { setLoading(false); }
  };

  const openAdd = () => {
    setForm({ supplier_id: '', invoice_number: '', invoice_date: new Date().toISOString().split('T')[0], notes: '' });
    setItems([{ ...EMPTY_ITEM }]);
    setScanPreview(null);
    setScanType(null);
    setModal('add');
  };

  const addItem = () => setItems(p => [...p, { ...EMPTY_ITEM }]);
  const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i));
  const updateItem = (i, k, v) => setItems(p => p.map((item, idx) => idx === i ? { ...item, [k]: v } : item));

  const handleProductSelect = (i, product_id) => {
    const p = products.find(p => p.id === product_id);
    updateItem(i, 'product_id', product_id);
    if (p) updateItem(i, 'product_name', p.name);
  };

  const subtotal = items.reduce((sum, i) => sum + (parseFloat(i.unit_cost) || 0) * (parseInt(i.quantity_ordered) || 0), 0);

  const applyScannedData = (data) => {
    if (data.invoice_number) setForm(p => ({ ...p, invoice_number: data.invoice_number }));
    if (data.invoice_date) setForm(p => ({ ...p, invoice_date: data.invoice_date }));
    if (data.supplier_name) {
      const matched = suppliers.find(s =>
        s.name.toLowerCase().includes(data.supplier_name.toLowerCase()) ||
        data.supplier_name.toLowerCase().includes(s.name.toLowerCase())
      );
      if (matched) setForm(p => ({ ...p, supplier_id: matched.id }));
    }
    if (data.items && data.items.length > 0) {
      const mapped = data.items.map(item => {
        const matched = products.find(p =>
          p.name.toLowerCase().includes(item.product_name.toLowerCase()) ||
          item.product_name.toLowerCase().includes(p.name.toLowerCase())
        );
        return {
          product_id: matched?.id || '',
          product_name: matched?.name || item.product_name,
          quantity_ordered: String(item.quantity_ordered || ''),
          unit_cost: String(item.unit_cost || ''),
          batch_number: item.batch_number || '',
          expiry_date: item.expiry_date || ''
        };
      });
      setItems(mapped.length > 0 ? mapped : [{ ...EMPTY_ITEM }]);
      toast.success(`Scanned ${mapped.length} item${mapped.length > 1 ? 's' : ''} — please review`);
    } else {
      toast('No items detected. Fill in manually.', { icon: '⚠️' });
    }
  };

  const handleImageScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanType('image');
    setScanPreview(URL.createObjectURL(file));
    setScanning(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await api.post('/stock/scan-invoice', { image_base64: base64, media_type: file.type });
      applyScannedData(res.data.data);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Scan failed. Try a clearer image.');
    } finally {
      setScanning(false);
      e.target.value = '';
    }
  };

  const handlePdfScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanType('pdf');
    setScanPreview(null);
    setScanning(true);
    e.target.value = '';
    try {
      toast('Converting PDF pages...', { icon: '📄' });
      const pages = await pdfPageToBase64(file);
      const uniquePages = [...new Set(pages)].slice(0, 3);
      let mergedItems = [];
      let invoiceData = { invoice_number: null, invoice_date: null, supplier_name: null };
      for (let i = 0; i < uniquePages.length; i++) {
        try {
          const res = await api.post('/stock/scan-invoice', { image_base64: uniquePages[i], media_type: 'image/jpeg' });
          const d = res.data.data;
          if (!invoiceData.invoice_number && d.invoice_number) invoiceData.invoice_number = d.invoice_number;
          if (!invoiceData.invoice_date && d.invoice_date) invoiceData.invoice_date = d.invoice_date;
          if (!invoiceData.supplier_name && d.supplier_name) invoiceData.supplier_name = d.supplier_name;
          if (d.items) mergedItems = [...mergedItems, ...d.items];
        } catch (pageErr) {
          console.warn('Page ' + (i+1) + ' scan failed, skipping');
        }
      }
      const seen = new Set();
      mergedItems = mergedItems.filter(item => {
        const key = item.product_name?.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      applyScannedData({ ...invoiceData, items: mergedItems });
    } catch (err) {
      toast.error(err.response?.data?.message || 'PDF scan failed. Try a clearer PDF.');
    } finally {
      setScanning(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.supplier_id) return toast.error('Select a supplier');
    if (items.length === 0 || !items[0].product_name) return toast.error('Add at least one item');
    const validItems = items.filter(i => i.product_name && i.quantity_ordered && i.unit_cost);
    if (validItems.length === 0) return toast.error('Fill in all item details');
    setSaving(true);
    try {
      await api.post('/stock/purchase-orders', { ...form, items: validItems });
      toast.success('Purchase order created & stock updated');
      setModal(null); fetchAll();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to create PO'); }
    finally { setSaving(false); }
  };

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div style={{ padding: 24, height: '100vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Purchase Orders</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{orders.length} orders total</p>
        </div>
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#0F1612', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={17} /> Receive Stock
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader size={28} color="var(--accent)" style={{ animation: 'spin 0.8s linear infinite' }} /></div>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-faint)' }}>
          <ShoppingBag size={40} style={{ opacity: 0.3, marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
          No purchase orders yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {orders.map(o => (
            <div key={o.id} style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', cursor: 'pointer' }} onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{o.po_number}</span>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{o.supplier_name} • {o.created_by}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>KES {parseFloat(o.total || 0).toLocaleString()}</span>
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, fontWeight: 700, background: `${statusColor[o.status]}20`, color: statusColor[o.status] }}>{o.status}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(o.created_at).toLocaleDateString()}</span>
                  {expanded === o.id ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                </div>
              </div>
              {expanded === o.id && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', background: 'var(--bg-elevated)' }}>
                  {o.invoice_number && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                      Invoice: {o.invoice_number} {o.invoice_date ? `• ${new Date(o.invoice_date).toLocaleDateString()}` : ''}
                    </div>
                  )}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Product', 'Qty', 'Unit Cost', 'Total', 'Batch', 'Expiry'].map(h => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(o.items || []).length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: '16px 10px', color: 'var(--text-faint)', textAlign: 'center' }}>No items found</td></tr>
                      ) : (o.items || []).map((item, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 10px', color: 'var(--text-primary)', fontWeight: 600 }}>{item.product_name}</td>
                          <td style={{ padding: '8px 10px' }} className="mono">{item.quantity_ordered}</td>
                          <td style={{ padding: '8px 10px' }} className="mono">KES {parseFloat(item.unit_cost || 0).toFixed(2)}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--accent)', fontWeight: 700 }} className="mono">KES {parseFloat(item.total_cost || 0).toFixed(2)}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{item.batch_number || '—'}</td>
                          <td style={{ padding: '8px 10px', color: item.expiry_date ? 'var(--warning)' : 'var(--text-faint)' }}>
                            {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal === 'add' && (
        <Modal title="Receive Stock / New Purchase Order" onClose={() => setModal(null)} wide>
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={() => setModal('scanner')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', background: 'rgba(16,185,129,0.1)', border: '1px dashed rgba(16,185,129,0.4)', borderRadius: 10, color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <ScanLine size={15} /> Scan Invoice (Photo or PDF) — Auto-fill items
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <div style={{ gridColumn: '1/-1', marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Supplier *</label>
              <select value={form.supplier_id} onChange={e => f('supplier_id', e.target.value)} style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, outline: 'none' }}>
                <option value="">Select supplier...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <Input label="Invoice Number" value={form.invoice_number} onChange={e => f('invoice_number', e.target.value)} placeholder="INV-001" />
            <Input label="Invoice Date" type="date" value={form.invoice_date} onChange={e => f('invoice_date', e.target.value)} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Items {items.length > 0 && items[0].product_name && <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginLeft: 6 }}>({items.length} from scan)</span>}
              </label>
              <button onClick={addItem} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--accent-soft)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <Plus size={13} /> Add Item
              </button>
            </div>
            {items.map((item, i) => (
              <div key={i} style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 14, marginBottom: 10, border: item.product_name ? '1px solid rgba(16,185,129,0.25)' : '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Item {i + 1}</span>
                  {items.length > 1 && <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}><Trash2 size={14} /></button>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Product</label>
                    <select value={item.product_id || ''} onChange={e => handleProductSelect(i, e.target.value)} style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}>
                      <option value="">{item.product_name || 'Select product...'}</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Qty *</label>
                    <input type="number" value={item.quantity_ordered} onChange={e => updateItem(i, 'quantity_ordered', e.target.value)} placeholder="0" style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Unit Cost *</label>
                    <input type="number" value={item.unit_cost} onChange={e => updateItem(i, 'unit_cost', e.target.value)} placeholder="0.00" style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Batch Number</label>
                    <input value={item.batch_number} onChange={e => updateItem(i, 'batch_number', e.target.value)} placeholder="BT2026001" style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Expiry Date</label>
                    <input type="date" value={item.expiry_date} onChange={e => updateItem(i, 'expiry_date', e.target.value)} style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
                  </div>
                </div>
                {item.quantity_ordered && item.unit_cost && (
                  <div style={{ marginTop: 8, textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }} className="mono">
                    Line total: KES {(parseFloat(item.unit_cost) * parseInt(item.quantity_ordered)).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 10, marginBottom: 20, border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Total</span>
            <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>KES {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>

          <button onClick={handleSubmit} disabled={saving} style={{ width: '100%', padding: 13, background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#0F1612', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {saving ? <><Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Processing...</> : '✅ Confirm & Update Stock'}
          </button>
        </Modal>
      )}

      {modal === 'scanner' && (
        <AIScanner
          type="stock_invoice"
          onClose={() => setModal('add')}
          onImport={(scannedItems) => {
            if (scannedItems && scannedItems.length > 0) {
              const mapped = scannedItems.map(item => {
                const matched = products.find(p =>
                  p.name.toLowerCase().includes((item.name || '').toLowerCase()) ||
                  (item.name || '').toLowerCase().includes(p.name.toLowerCase())
                );
                return {
                  product_id: matched?.id || '',
                  product_name: matched?.name || item.name || '',
                  quantity_ordered: String(item.quantity || ''),
                  unit_cost: String(item.buying_price || ''),
                  batch_number: '',
                  expiry_date: item.expiry_date || ''
                };
              });
              setItems(mapped);
              toast.success(mapped.length + ' items imported from scan');
            }
            setModal('add');
          }}
        />
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
