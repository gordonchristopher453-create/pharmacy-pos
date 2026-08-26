import { useState, useEffect, useRef } from 'react';
import AIScanner from '../components/AIScanner';
import { useSelector } from 'react-redux';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  Package, Plus, Search, AlertTriangle, TrendingDown,
  BarChart2, Camera, Check, Loader, X, RefreshCw
} from 'lucide-react';

const TABS = ['Inventory', 'Receive Stock', 'Purchase Orders', 'Suppliers', 'Movements'];

const Card = ({ children, style = {} }) => (
  <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border)', ...style }}>
    {children}
  </div>
);

const Input = ({ label, style, ...props }) => (
  <div style={{ width: '100%' }}>
    {label && <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>{label}</label>}
    <input {...props} style={{
      width: '100%', padding: '9px 12px',
      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
      borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
      outline: 'none', fontFamily: 'DM Sans, sans-serif', ...style
    }} />
  </div>
);

const Select = ({ label, children, ...props }) => (
  <div style={{ width: '100%' }}>
    {label && <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>{label}</label>}
    <select {...props} style={{
      width: '100%', padding: '9px 12px',
      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
      borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none'
    }}>{children}</select>
  </div>
);

const Btn = ({ children, variant = 'primary', size = 'md', ...props }) => (
  <button {...props} style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: size === 'sm' ? '6px 12px' : '10px 18px',
    background: variant === 'primary' ? 'var(--accent)' : variant === 'danger' ? 'var(--danger)' : 'var(--bg-elevated)',
    border: variant === 'ghost' ? '1px solid var(--border)' : 'none',
    borderRadius: 8, color: variant === 'primary' ? '#0F1612' : 'var(--text-primary)',
    fontSize: size === 'sm' ? 12 : 13, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif', ...props.style
  }}>{children}</button>
);

const ProductSearchInput = ({ value, onChange, products }) => {
  const [query, setQuery] = useState(value.product_name || '');
  const [open, setOpen] = useState(false);
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    (p.generic_name || '').toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Product Name *</label>
      <input
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          onChange('product_name', e.target.value);
          onChange('product_id', '');
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Type or search product name..."
        style={{
          width: '100%', padding: '9px 12px',
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none'
        }}
      />
      {open && query.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 8px 24px #00000040', marginTop: 4, overflow: 'hidden'
        }}>
          {filtered.map(p => (
            <div key={p.id} onMouseDown={() => {
              setQuery(p.name);
              onChange('product_id', p.id);
              onChange('product_name', p.name);
              onChange('generic_name', p.generic_name || '');
              onChange('unit_cost', p.buying_price);
              setOpen(false);
            }} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.generic_name}</div>
              </div>
              <span className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>KES {parseFloat(p.buying_price).toFixed(2)}</span>
            </div>
          ))}
          <div onMouseDown={() => { onChange('product_id', ''); onChange('product_name', query); setOpen(false); }}
            style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
            + Use "{query}" as new product name
          </div>
        </div>
      )}
    </div>
  );
};

const cellStyle = {
  padding: '4px 6px', verticalAlign: 'top'
};

const cellInput = {
  width: '100%', padding: '7px 8px',
  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
  borderRadius: 6, color: 'var(--text-primary)', fontSize: 12,
  outline: 'none', fontFamily: 'DM Sans, sans-serif'
};

function InlineItemRow({ index, item, products, categories, suppliers, onUpdate, onRemove, onAddNext, onOpenNewProduct, getSubtotal }) {
  const [query, setQuery] = useState(item.product_name || '');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  const isNew = item.product_name && !item.product_id;
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    (p.generic_name || '').toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  useEffect(() => {
    if (index === 0 || item.product_name === '') {
      // auto-focus last added row
    }
  }, []);

  const selectProduct = (p) => {
    setQuery(p.name);
    onUpdate(index, 'product_id', p.id);
    onUpdate(index, 'product_name', p.name);
    onUpdate(index, 'generic_name', p.generic_name || '');
    onUpdate(index, 'unit_cost', p.buying_price || '');
    onUpdate(index, '_isNew', false);
    setOpen(false);
  };

  const rowBg = isNew ? 'rgba(251,146,60,0.06)' : 'transparent';
  const borderColor = isNew ? 'rgba(251,146,60,0.4)' : 'var(--border)';

  return (
    <>
      <tr style={{ borderBottom: `1px solid ${borderColor}`, background: rowBg }}>
        <td style={{ ...cellStyle, width: 32, color: 'var(--text-faint)', fontSize: 11, textAlign: 'center' }}>{index + 1}</td>

        {/* Product Name */}
        <td style={{ ...cellStyle, minWidth: 200, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              ref={inputRef}
              value={query}
              autoFocus={index === (products.length > 0 ? index : 0)}
              onChange={e => {
                setQuery(e.target.value);
                onUpdate(index, 'product_name', e.target.value);
                onUpdate(index, 'product_id', '');
                onUpdate(index, '_isNew', true);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 200)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddNext(); } }}
              placeholder="Type product name..."
              style={{ ...cellInput, borderColor: isNew ? 'rgba(251,146,60,0.6)' : 'var(--border)' }}
            />
            {isNew && <span style={{ fontSize: 9, padding: '2px 5px', background: 'rgba(251,146,60,0.2)', color: '#f97316', borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap' }}>NEW</span>}
          </div>
          {open && query.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 6, right: 6, zIndex: 200,
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 8, boxShadow: '0 8px 24px #00000050', overflow: 'hidden'
            }}>
              {filtered.map(p => (
                <div key={p.id} onMouseDown={() => selectProduct(p)}
                  style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{p.generic_name} · Stock: {p.total_stock}</div>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--accent)' }}>KES {parseFloat(p.buying_price || 0).toFixed(2)}</span>
                </div>
              ))}
              {filtered.length === 0 && (
                <div onMouseDown={() => { onUpdate(index, '_isNew', true); setOpen(false); }}
                  style={{ padding: '9px 12px', fontSize: 12, color: '#f97316', fontWeight: 600, cursor: 'pointer' }}>
                  ✦ Add "{query}" as new product
                </div>
              )}
            </div>
          )}
        </td>

        {/* Generic */}
        <td style={{ ...cellStyle, minWidth: 130 }}>
          <input value={item.generic_name || ''} onChange={e => onUpdate(index, 'generic_name', e.target.value)}
            placeholder="Generic..." style={cellInput} />
        </td>

        {/* Qty */}
        <td style={{ ...cellStyle, width: 80 }}>
          <input type="number" min="1" value={item.quantity_ordered || ''} onChange={e => onUpdate(index, 'quantity_ordered', e.target.value)}
            placeholder="0" style={{ ...cellInput, textAlign: 'right' }} />
        </td>

        {/* Unit Cost */}
        <td style={{ ...cellStyle, width: 100 }}>
          <input type="number" min="0" step="0.01" value={item.unit_cost || ''} onChange={e => onUpdate(index, 'unit_cost', e.target.value)}
            placeholder="0.00" style={{ ...cellInput, textAlign: 'right' }} />
        </td>

        {/* Batch */}
        <td style={{ ...cellStyle, width: 100 }}>
          <input value={item.batch_number || ''} onChange={e => onUpdate(index, 'batch_number', e.target.value)}
            placeholder="Optional" style={cellInput} />
        </td>

        {/* Expiry */}
        <td style={{ ...cellStyle, width: 130 }}>
          <input type="date" value={item.expiry_date || ''} onChange={e => onUpdate(index, 'expiry_date', e.target.value)}
            style={cellInput} />
        </td>

        {/* Subtotal */}
        <td style={{ ...cellStyle, width: 100, textAlign: 'right' }}>
          <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: getSubtotal(item) > 0 ? 'var(--accent)' : 'var(--text-faint)' }}>
            {getSubtotal(item) > 0 ? `KES ${getSubtotal(item).toLocaleString()}` : '—'}
          </span>
        </td>

        {/* Remove */}
        <td style={{ ...cellStyle, width: 36 }}>
          <button onClick={() => onRemove(index)} style={{ padding: '4px 6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', borderRadius: 4 }}>
            <X size={14} />
          </button>
        </td>
      </tr>

      {/* New product indicator — click to open full modal */}
      {isNew && !item.product_id && (
        <tr style={{ background: 'rgba(251,146,60,0.04)', borderBottom: '2px solid rgba(251,146,60,0.3)' }}>
          <td colSpan={9} style={{ padding: '8px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, color: '#f97316', fontWeight: 700 }}>⚠ New product — complete product details before confirming</span>
              <button onMouseDown={() => onOpenNewProduct(index)}
                style={{ padding: '5px 14px', background: '#f97316', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                Complete Product Details →
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function StockPage() {
  const { user } = useSelector(state => state.auth);
  const isLab = user?.role === 'lab_technician';
  const isAdmin = user?.role === 'facility_admin';

  const [activeTab, setActiveTab] = useState('Inventory');
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState({});
  const [suppliers, setSuppliers] = useState([]);
  const [movements, setMovements] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [newProductRowIndex, setNewProductRowIndex] = useState(null);
  const emptyNewProduct = () => ({
    name: '', generic_name: '', barcode: '', category_id: '', supplier_id: '',
    unit: 'tablet', selling_price: '', min_selling_price: '', max_selling_price: '',
    reorder_level: '10', requires_prescription: false
  });
  const [newProductForm, setNewProductForm] = useState(emptyNewProduct());
  const [savingProduct, setSavingProduct] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const fileRef = useRef(null);

  const emptyItem = () => ({
    product_id: '', product_name: '', generic_name: '',
    quantity_ordered: '', unit_cost: '', batch_number: '', expiry_date: ''
  });

  const savedReceiveForm = JSON.parse(localStorage.getItem('receiveForm') || 'null');
  const [receiveForm, setReceiveForm] = useState(savedReceiveForm || {
    supplier_id: '', invoice_number: '', invoice_date: '',
    payment_due_date: '', notes: '', items: []
  });

  const [supplierForm, setSupplierForm] = useState({
    name: '', phone: '', email: '', address: '',
    contact_person: '', payment_terms: '30', lead_time_days: '7'
  });

  const [adjustForm, setAdjustForm] = useState({
    adjustment_type: 'damaged', quantity: '', reason: ''
  });

  useEffect(() => { fetchStock(); fetchSuppliers(); fetchCategories(); }, []);
  useEffect(() => { if (activeTab === 'Movements') fetchMovements(); }, [activeTab]);
  useEffect(() => { if (activeTab === 'Purchase Orders') fetchPurchaseOrders(); }, [activeTab]);
  useEffect(() => { const t = setTimeout(fetchStock, 300); return () => clearTimeout(t); }, [search, filter]);
  useEffect(() => { localStorage.setItem('receiveForm', JSON.stringify(receiveForm)); }, [receiveForm]);

  const fetchStock = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (filter !== 'all') params.append('filter', filter);
      if (isLab) params.append("department", "lab");
      const res = await api.get(`/stock?${params}`);
      setProducts(res.data.data.products);
      setStats(res.data.data.stats);
    } catch { toast.error('Failed to fetch stock'); }
    finally { setLoading(false); }
  };

  const fetchSuppliers = async () => {
    try { const res = await api.get('/stock/suppliers'); setSuppliers(res.data.data); } catch {}
  };

  const fetchCategories = async () => {
    try { const res = await api.get('/products/categories'); setCategories(res.data.data); } catch {}
  };

  const fetchMovements = async () => {
    try { const res = await api.get('/stock/movements?department=' + (isLab ? 'lab' : 'pharmacy')); setMovements(res.data.data); } catch {}
  };

  const fetchPurchaseOrders = async () => {
    try { const res = await api.get('/stock/purchase-orders?department=' + (isLab ? 'lab' : 'pharmacy')); setPurchaseOrders(res.data.data); } catch {}
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleScanInvoice = async (file) => {
    if (!file) return;
    setScanLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await api.post('/stock/scan-invoice', {
        image_base64: base64.split(',')[1],
        media_type: file.type
      });
      const data = res.data.data;
      toast.success(`Scanned! Found ${data.items?.length || 0} items. Review and confirm.`);
      setReceiveForm(prev => ({
        ...prev,
        invoice_number: data.invoice_number || prev.invoice_number,
        invoice_date: data.invoice_date || prev.invoice_date,
        items: (data.items || []).map(item => ({
          product_id: '',
          product_name: item.product_name || '',
          generic_name: item.generic_name || '',
          quantity_ordered: item.quantity_ordered?.toString() || '',
          unit_cost: item.unit_cost?.toString() || '',
          batch_number: item.batch_number || '',
          expiry_date: item.expiry_date || ''
        }))
      }));
      if (data.supplier_name) {
        const match = suppliers.find(s => s.name.toLowerCase().includes(data.supplier_name.toLowerCase()));
        if (match) setReceiveForm(prev => ({ ...prev, supplier_id: match.id }));
      }
      setActiveTab('Receive Stock');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Scan failed. Try a clearer image.');
    } finally {
      setScanLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const addItem = () => setReceiveForm(prev => ({
    ...prev, items: [...prev.items, emptyItem()]
  }));

  const updateItem = (index, field, value) => {
    setReceiveForm(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const removeItem = (index) => setReceiveForm(prev => ({
    ...prev, items: prev.items.filter((_, i) => i !== index)
  }));

  const handleAddItemConfirm = async () => {
    if (addItemMode === 'search') {
      if (!addItemSelected) { return; }
      if (!addItemStock.quantity_ordered || parseFloat(addItemStock.quantity_ordered) <= 0) {
        alert('Enter a valid quantity'); return;
      }
      setReceiveForm(prev => ({
        ...prev,
        items: [...prev.items, {
          product_id: addItemSelected.id,
          product_name: addItemSelected.name,
          generic_name: addItemSelected.generic_name || '',
          quantity_ordered: addItemStock.quantity_ordered,
          unit_cost: addItemStock.unit_cost || addItemSelected.buying_price || '',
          batch_number: addItemStock.batch_number,
          expiry_date: addItemStock.expiry_date
        }]
      }));
    } else {
      if (!newProductForm.name.trim()) { alert('Product name is required'); return; }
      if (!newProductForm.selling_price || parseFloat(newProductForm.selling_price) < 0) { alert('Enter a valid selling price'); return; }
      if (!newProductForm.quantity_ordered || parseFloat(newProductForm.quantity_ordered) <= 0) { alert('Enter a valid quantity'); return; }
      try {
        const res = await api.post('/products', {
          name: newProductForm.name,
          generic_name: newProductForm.generic_name,
          category_id: newProductForm.category_id || null,
          unit: newProductForm.unit,
          selling_price: parseFloat(newProductForm.selling_price),
          min_selling_price: parseFloat(newProductForm.min_selling_price) || 0,
          max_selling_price: parseFloat(newProductForm.max_selling_price) || 0,
          reorder_level: parseInt(newProductForm.reorder_level) || 10,
          requires_prescription: newProductForm.requires_prescription,
          buying_price: parseFloat(newProductForm.unit_cost) || 0
        });
        const created = res.data.data;
        setReceiveForm(prev => ({
          ...prev,
          items: [...prev.items, {
            product_id: created.id,
            product_name: created.name,
            generic_name: created.generic_name || '',
            quantity_ordered: newProductForm.quantity_ordered,
            unit_cost: newProductForm.unit_cost,
            batch_number: newProductForm.batch_number,
            expiry_date: newProductForm.expiry_date
          }]
        }));
        fetchStock();
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to create product');
        return;
      }
    }
    setShowAddItemModal(false);
    setAddItemMode('search');
    setAddItemSearch('');
    setAddItemSelected(null);
    setAddItemStock({ quantity_ordered: '', unit_cost: '', batch_number: '', expiry_date: '' });
    setNewProductForm(emptyNewProduct());
  };

  const handleSaveNewProduct = async () => {
    if (!newProductForm.name.trim()) { toast.error('Product name is required'); return; }
    if (!newProductForm.selling_price || parseFloat(newProductForm.selling_price) <= 0) { toast.error('Selling price is required'); return; }
    setSavingProduct(true);
    try {
      const res = await api.post('/products', {
        name: newProductForm.name,
        generic_name: newProductForm.generic_name || '',
        barcode: newProductForm.barcode || null,
        category_id: newProductForm.category_id || null,
        supplier_id: newProductForm.supplier_id || null,
        unit: newProductForm.unit || 'tablet',
        selling_price: parseFloat(newProductForm.selling_price),
        min_selling_price: parseFloat(newProductForm.min_selling_price) || 0,
        max_selling_price: parseFloat(newProductForm.max_selling_price) || 0,
        reorder_level: parseInt(newProductForm.reorder_level) || 10,
        requires_prescription: newProductForm.requires_prescription || false,
        buying_price: parseFloat(receiveForm.items[newProductRowIndex]?.unit_cost) || 0,
        department: isLab ? 'lab' : 'pharmacy'
      });
      const created = res.data.data;
      updateItem(newProductRowIndex, 'product_id', created.id);
      updateItem(newProductRowIndex, 'product_name', created.name);
      updateItem(newProductRowIndex, 'generic_name', created.generic_name || '');
      updateItem(newProductRowIndex, '_isNew', false);
      toast.success(`Product "${created.name}" created`);
      setShowNewProductModal(false);
      setNewProductForm(emptyNewProduct());
      setNewProductRowIndex(null);
      fetchStock();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create product');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleReceiveSubmit = async () => {
    for (const item of receiveForm.items) {
      if (!item.product_name.trim()) { toast.error('Product name is required for all items'); return; }
      if (!item.quantity_ordered || parseFloat(item.quantity_ordered) <= 0) { toast.error(`Enter valid quantity for ${item.product_name}`); return; }
      if (item._isNew && !item.product_id) {
        toast.error(`"${item.product_name}" is a new product — click the NEW badge to complete product details first`); return;
      }
    }
    const resolvedItems = [...receiveForm.items];

    const payload = {
      ...receiveForm,
      items: resolvedItems.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        generic_name: item.generic_name,
        quantity_ordered: parseFloat(item.quantity_ordered),
        unit_cost: parseFloat(item.unit_cost) || 0,
        batch_number: item.batch_number || '',
        expiry_date: item.expiry_date || null
      }))
    };
    try {
      if (!payload.supplier_id) payload.supplier_id = null;
      if (!payload.invoice_date) payload.invoice_date = null;
      if (!payload.payment_due_date) payload.payment_due_date = null;
      payload.items.forEach(item => { if (!item.product_id) item.product_id = null; });
      await api.post('/stock/purchase-orders', { ...payload, department: isLab ? 'lab' : 'pharmacy' });
      toast.success(`Stock received! ${resolvedItems.length} item(s) added.`);
      setReceiveForm({ supplier_id: '', invoice_number: '', invoice_date: '', payment_due_date: '', notes: '', items: [] });
      localStorage.removeItem('receiveForm');
      fetchStock();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to receive stock');
    }
  };

  const handleCreateSupplier = async () => {
    if (!supplierForm.name) { toast.error('Supplier name required'); return; }
    try {
      await api.post('/stock/suppliers', {
        ...supplierForm,
        payment_terms: parseInt(supplierForm.payment_terms) || 30,
        lead_time_days: parseInt(supplierForm.lead_time_days) || 7
      });
      toast.success('Supplier created!');
      setShowSupplierModal(false);
      setSupplierForm({ name: '', phone: '', email: '', address: '', contact_person: '', payment_terms: '30', lead_time_days: '7' });
      fetchSuppliers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create supplier');
    }
  };

  const handleAdjustStock = async () => {
    if (!adjustForm.reason.trim()) { toast.error('Please provide a reason'); return; }
    if (!adjustForm.quantity || parseFloat(adjustForm.quantity) <= 0) { toast.error('Enter a valid quantity'); return; }
    try {
      await api.post('/stock/adjust', {
        product_id: selectedProduct.id,
        adjustment_type: adjustForm.adjustment_type,
        quantity: parseFloat(adjustForm.quantity),
        reason: adjustForm.reason
      });
      toast.success('Stock adjusted!');
      setShowAdjustModal(false);
      setAdjustForm({ adjustment_type: 'damaged', quantity: '', reason: '' });
      fetchStock();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to adjust stock');
    }
  };

  const getStockStatus = (product) => {
    const stock = parseInt(product.total_stock);
    if (stock === 0) return { label: 'Out of Stock', color: 'var(--danger)' };
    if (stock <= product.reorder_level) return { label: 'Low Stock', color: 'var(--warning)' };
    return { label: 'In Stock', color: 'var(--accent)' };
  };

  const getExpiryStatus = (expiry) => {
    if (!expiry) return null;
    const days = Math.floor((new Date(expiry) - new Date()) / 86400000);
    if (days < 0) return { label: 'Expired', color: 'var(--danger)' };
    if (days <= 30) return { label: `Exp ${days}d`, color: 'var(--warning)' };
    if (days <= 90) return { label: `Exp ${days}d`, color: 'var(--info)' };
    return null;
  };

  // ✅ NEW: dedicated expired check
  const isExpired = (expiry) => {
    if (!expiry) return false;
    return new Date(expiry) < new Date();
  };

  const getSubtotal = (item) => {
    const qty = parseFloat(item.quantity_ordered) || 0;
    const cost = parseFloat(item.unit_cost) || 0;
    return qty * cost;
  };

  const totalReceive = receiveForm.items.reduce((s, i) => s + getSubtotal(i), 0);

  // ✅ Added 'Expired' column to headers
  const inventoryHeaders = isAdmin
    ? ['Product / Generic', 'Category', 'Barcode', 'Stock', 'Reorder', 'Buy Price', 'Sell Price', 'Stock Value', 'Expiry', 'Expired', 'Status', '']
    : ['Product / Generic', 'Category', 'Barcode', 'Stock', 'Reorder', 'Sell Price', 'Expiry', 'Expired', 'Status', ''];

  return (
    <div style={{ height: '100vh', overflow: 'auto', padding: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Stock Management</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            {isAdmin ? 'Full access — buying prices visible' : 'Pharmacist view — selling prices only'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input type="file" ref={fileRef} style={{ display: 'none' }} accept="image/*"
            onChange={e => handleScanInvoice(e.target.files[0])} />
          <Btn variant="ghost" onClick={() => setShowScanner(true)}>
            {scanLoading ? <Loader size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Camera size={15} />}
            {scanLoading ? 'Scanning...' : 'Scan Invoice'}
          </Btn>
          <Btn onClick={() => { addItem(); setActiveTab('Receive Stock'); }}>
            <Plus size={15} /> Receive Stock
          </Btn>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Products', value: stats.total_products || 0, icon: Package, color: 'var(--accent)' },
          ...(isAdmin ? [{ label: 'Stock Value (Buy)', value: `KES ${parseFloat(stats.total_stock_value || 0).toLocaleString()}`, icon: BarChart2, color: 'var(--info)' }] : []),
          { label: 'Low Stock', value: stats.low_stock_count || 0, icon: TrendingDown, color: 'var(--warning)' },
          { label: 'Out of Stock', value: stats.out_of_stock_count || 0, icon: AlertTriangle, color: 'var(--danger)' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
                <div className="mono" style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} color={color} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 16px', background: 'none', border: 'none',
            borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === tab ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: -1
          }}>{tab}</button>
        ))}
      </div>

      {/* INVENTORY */}
      {activeTab === 'Inventory' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..."
                style={{ width: '100%', padding: '9px 9px 9px 36px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
            </div>
            {['all', 'low_stock', 'out_of_stock', 'expiring_soon'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: filter === f ? 'var(--accent-soft)' : 'var(--bg-surface)',
                border: filter === f ? '1px solid var(--accent)' : '1px solid var(--border)',
                color: filter === f ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer'
              }}>
                {f === 'all' ? 'All' : f === 'low_stock' ? '⚠ Low Stock' : f === 'out_of_stock' ? '✕ Out of Stock' : '⏳ Expiring'}
              </button>
            ))}
            <button onClick={fetchStock} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <RefreshCw size={14} />
            </button>
          </div>
          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                    {inventoryHeaders.map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={inventoryHeaders.length} style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>
                      <Loader size={20} style={{ animation: 'spin 0.8s linear infinite' }} />
                    </td></tr>
                  ) : products.length === 0 ? (
                    <tr><td colSpan={inventoryHeaders.length} style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>No products found</td></tr>
                  ) : products.map(p => {
                    const status = getStockStatus(p);
                    const expiry = getExpiryStatus(p.nearest_expiry);
                    const expired = isExpired(p.nearest_expiry);
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', background: expired ? 'rgba(239,68,68,0.04)' : 'transparent' }}
                        onMouseEnter={e => e.currentTarget.style.background = expired ? 'rgba(239,68,68,0.08)' : 'var(--bg-elevated)'}
                        onMouseLeave={e => e.currentTarget.style.background = expired ? 'rgba(239,68,68,0.04)' : 'transparent'}>
                        <td style={{ padding: '11px 14px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                          {p.generic_name && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.generic_name}</div>}
                          {p.requires_prescription && <span style={{ fontSize: 9, background: 'var(--warning)20', color: 'var(--warning)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>Rx</span>}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{p.category_name || '—'}</td>
                        <td style={{ padding: '11px 14px', fontSize: 11, color: 'var(--text-faint)', fontFamily: 'monospace' }}>{p.barcode || '—'}</td>
                        <td style={{ padding: '11px 14px' }}>
                          <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: status.color }}>{p.total_stock}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 3 }}>{p.unit}s</span>
                        </td>
                        <td style={{ padding: '11px 14px' }}><span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.reorder_level}</span></td>
                        {isAdmin && <td style={{ padding: '11px 14px' }}><span className="mono" style={{ fontSize: 12, color: 'var(--text-primary)' }}>KES {parseFloat(p.buying_price).toFixed(2)}</span></td>}
                        <td style={{ padding: '11px 14px' }}><span className="mono" style={{ fontSize: 12, color: 'var(--accent)' }}>KES {parseFloat(p.selling_price).toFixed(2)}</span></td>
                        {isAdmin && <td style={{ padding: '11px 14px' }}><span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>KES {parseFloat(p.stock_value_buying || 0).toLocaleString()}</span></td>}
                        <td style={{ padding: '11px 14px' }}>
                          {expiry ? <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: `${expiry.color}20`, color: expiry.color, fontWeight: 600 }}>{expiry.label}</span>
                            : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.nearest_expiry ? new Date(p.nearest_expiry).toLocaleDateString() : '—'}</span>}
                        </td>
                        {/* ✅ NEW: Expired column */}
                        <td style={{ padding: '11px 14px' }}>
                          {expired
                            ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', fontWeight: 700, border: '1px solid rgba(239,68,68,0.3)' }}>⚠ EXPIRED</span>
                            : <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>—</span>}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: `${status.color}20`, color: status.color, fontWeight: 600 }}>{status.label}</span>
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <Btn variant="ghost" size="sm" onClick={() => { setSelectedProduct(p); setShowAdjustModal(true); }}>Adjust</Btn>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* RECEIVE STOCK */}
      {activeTab === 'Receive Stock' && (
        <div style={{ maxWidth: 1000 }}>
          <Card style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Invoice Details</h3>
              <div onClick={() => setShowScanner(true)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                borderRadius: 10, border: '2px dashed var(--accent)', cursor: 'pointer', background: 'var(--accent-soft)'
              }}>
                {scanLoading ? <Loader size={18} color="var(--accent)" style={{ animation: 'spin 0.8s linear infinite' }} /> : <Camera size={18} color="var(--accent)" />}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{scanLoading ? 'Scanning...' : 'Scan Invoice with AI'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Upload photo — items auto-filled</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <Select label="Supplier (optional)" value={receiveForm.supplier_id} onChange={e => setReceiveForm(p => ({ ...p, supplier_id: e.target.value }))}>
                <option value="">Select supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
              <Input label="Invoice Number" value={receiveForm.invoice_number} onChange={e => setReceiveForm(p => ({ ...p, invoice_number: e.target.value }))} placeholder="INV-001" />
              <Input label="Invoice Date" type="date" value={receiveForm.invoice_date} onChange={e => setReceiveForm(p => ({ ...p, invoice_date: e.target.value }))} />
              <Input label="Payment Due Date" type="date" value={receiveForm.payment_due_date} onChange={e => setReceiveForm(p => ({ ...p, payment_due_date: e.target.value }))} />
              <Input label="Notes" value={receiveForm.notes} onChange={e => setReceiveForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" style={{ gridColumn: '2 / -1' }} />
            </div>
          </Card>

          <Card style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Items ({receiveForm.items.length})</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="ghost" onClick={() => setShowScanner(true)}><Camera size={14} /> Scan Invoice</Btn>
                <Btn onClick={addItem}><Plus size={14} /> Add Item</Btn>
              </div>
            </div>

            {receiveForm.items.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>
                <Package size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p style={{ marginBottom: 12 }}>No items yet. Add items below or scan an invoice.</p>
                <Btn onClick={addItem}><Plus size={14} /> Add First Item</Btn>
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-elevated)', borderBottom: '2px solid var(--border)' }}>
                        {['#', 'Product Name', 'Generic Name', 'Qty *', 'Unit Cost (KES) *', 'Batch No.', 'Expiry Date', 'Subtotal', ''].map(h => (
                          <th key={h} style={{ padding: '9px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {receiveForm.items.map((item, index) => (
                        <InlineItemRow
                          key={index}
                          index={index}
                          item={item}
                          products={products}
                          categories={categories}
                          suppliers={suppliers}
                          onUpdate={updateItem}
                          onRemove={removeItem}
                          onAddNext={() => { addItem(); }}
                          onOpenNewProduct={(i) => {
                            setNewProductRowIndex(i);
                            setNewProductForm(f => ({ ...f, name: receiveForm.items[i].product_name, generic_name: receiveForm.items[i].generic_name || '' }));
                            setShowNewProductModal(true);
                          }}
                          getSubtotal={getSubtotal}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{receiveForm.items.length} item{receiveForm.items.length !== 1 ? 's' : ''}</div>
                      <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>KES {totalReceive.toLocaleString()}</div>
                    </div>
                    <Btn variant="ghost" size="sm" onClick={addItem}><Plus size={13} /> Add Row</Btn>
                  </div>
                  <Btn onClick={handleReceiveSubmit} style={{ padding: '13px 28px', fontSize: 14 }}>
                    <Check size={18} /> Confirm & Add to Stock
                  </Btn>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* PURCHASE ORDERS */}
      {activeTab === 'Purchase Orders' && (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                  {['PO Number', 'Supplier', 'Invoice #', ...(isAdmin ? ['Total'] : []), 'Status', 'Payment', 'Date'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>No purchase orders yet</td></tr>
                ) : purchaseOrders.map(po => (
                  <tr key={po.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '11px 14px' }}><span className="mono" style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 13 }}>{po.po_number}</span></td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--text-primary)' }}>{po.supplier_name || '—'}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--text-muted)' }}>{po.invoice_number || '—'}</td>
                    {isAdmin && <td style={{ padding: '11px 14px' }}><span className="mono" style={{ fontSize: 13 }}>KES {parseFloat(po.total).toLocaleString()}</span></td>}
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, fontWeight: 600, background: po.status === 'received' ? 'var(--accent)20' : 'var(--warning)20', color: po.status === 'received' ? 'var(--accent)' : 'var(--warning)' }}>{po.status}</span>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, fontWeight: 600, background: po.payment_status === 'paid' ? 'var(--accent)20' : 'var(--danger)20', color: po.payment_status === 'paid' ? 'var(--accent)' : 'var(--danger)' }}>{po.payment_status}</span>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{new Date(po.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* SUPPLIERS */}
      {activeTab === 'Suppliers' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Btn onClick={() => setShowSupplierModal(true)}><Plus size={15} /> Add Supplier</Btn>
          </div>
          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                    {['Supplier', 'Contact Person', 'Phone', 'Email', 'Payment Terms', 'Lead Time', 'Orders', ...(isAdmin ? ['Total Purchased'] : [])].map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {suppliers.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>No suppliers yet</td></tr>
                  ) : suppliers.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
                        {s.address && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.address}</div>}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--text-muted)' }}>{s.contact_person || '—'}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--text-muted)' }}>{s.phone || '—'}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--text-muted)' }}>{s.email || '—'}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--text-muted)' }}>{s.payment_terms} days</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--text-muted)' }}>{s.lead_time_days} days</td>
                      <td style={{ padding: '11px 14px' }}><span className="mono" style={{ fontSize: 13 }}>{s.total_orders}</span></td>
                      {isAdmin && <td style={{ padding: '11px 14px' }}><span className="mono" style={{ fontSize: 13, color: 'var(--accent)' }}>KES {parseFloat(s.total_purchased).toLocaleString()}</span></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* MOVEMENTS */}
      {activeTab === 'Movements' && (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                  {['Product', 'Type', 'Qty', 'User', 'Notes', 'Date & Time'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>No movements recorded yet</td></tr>
                ) : movements.map(m => {
                  const colors = { purchase: 'var(--accent)', sale: 'var(--info)', adjustment: 'var(--warning)', return: 'var(--danger)', expiry: 'var(--danger)' };
                  const color = colors[m.movement_type] || 'var(--text-muted)';
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{m.product_name}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, background: `${color}20`, color, fontWeight: 600, textTransform: 'capitalize' }}>{m.movement_type}</span>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: m.quantity > 0 ? 'var(--accent)' : 'var(--danger)' }}>
                          {m.quantity > 0 ? '+' : ''}{m.quantity}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--text-muted)' }}>{m.user_name}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{m.notes || '—'}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{new Date(m.created_at).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ADJUST MODAL */}
      {showAdjustModal && selectedProduct && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <Card style={{ padding: 28, width: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Adjust Stock</h3>
              <button onClick={() => { setShowAdjustModal(false); setAdjustForm({ adjustment_type: 'damaged', quantity: '', reason: '' }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ marginBottom: 16, padding: 14, background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedProduct.name}</div>
              {selectedProduct.generic_name && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedProduct.generic_name}</div>}
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
                Current stock: <span className="mono" style={{ color: 'var(--accent)', fontWeight: 700 }}>{selectedProduct.total_stock} {selectedProduct.unit}s</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Select label="Adjustment Type" value={adjustForm.adjustment_type} onChange={e => setAdjustForm(p => ({ ...p, adjustment_type: e.target.value }))}>
                <option value="damaged">Damaged</option>
                <option value="expired">Expired / Disposed</option>
                <option value="lost">Lost / Missing</option>
                <option value="found">Found / Recovered</option>
                <option value="correction">Stock Correction</option>
              </Select>
              <Input label="Quantity *" type="number" min="1"
                value={adjustForm.quantity}
                placeholder="Enter quantity"
                onChange={e => setAdjustForm(p => ({ ...p, quantity: e.target.value }))} />
              <Input label="Reason *" value={adjustForm.reason}
                onChange={e => setAdjustForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="Explain the reason..." />
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <Btn variant="ghost" onClick={() => { setShowAdjustModal(false); setAdjustForm({ adjustment_type: 'damaged', quantity: '', reason: '' }); }} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
                <Btn variant="danger" onClick={handleAdjustStock} style={{ flex: 1, justifyContent: 'center' }}>Confirm Adjustment</Btn>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* SUPPLIER MODAL */}
      {showSupplierModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <Card style={{ padding: 28, width: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Add Supplier</h3>
              <button onClick={() => setShowSupplierModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Input label="Company Name *" value={supplierForm.name} onChange={e => setSupplierForm(p => ({ ...p, name: e.target.value }))} placeholder="ABC Pharmaceuticals Ltd" />
              <Input label="Contact Person" value={supplierForm.contact_person} onChange={e => setSupplierForm(p => ({ ...p, contact_person: e.target.value }))} placeholder="John Doe" />
              <Input label="Phone" value={supplierForm.phone} onChange={e => setSupplierForm(p => ({ ...p, phone: e.target.value }))} placeholder="+254 700 000 000" />
              <Input label="Email" value={supplierForm.email} onChange={e => setSupplierForm(p => ({ ...p, email: e.target.value }))} placeholder="supplier@email.com" />
              <Input label="Address" value={supplierForm.address} onChange={e => setSupplierForm(p => ({ ...p, address: e.target.value }))} placeholder="Nairobi, Kenya" style={{ gridColumn: '1 / -1' }} />
              <Input label="Payment Terms (days)" type="number" value={supplierForm.payment_terms} onChange={e => setSupplierForm(p => ({ ...p, payment_terms: e.target.value }))} placeholder="30" />
              <Input label="Lead Time (days)" type="number" value={supplierForm.lead_time_days} onChange={e => setSupplierForm(p => ({ ...p, lead_time_days: e.target.value }))} placeholder="7" />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <Btn variant="ghost" onClick={() => setShowSupplierModal(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
              <Btn onClick={handleCreateSupplier} style={{ flex: 1, justifyContent: 'center' }}>Create Supplier</Btn>
            </div>
          </Card>
        </div>
      )}

      {/* modal removed - inline table used instead */}
      {/* NEW PRODUCT MODAL */}
      {showNewProductModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000088', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>New Product Details</h2>
              <button onClick={() => setShowNewProductModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <div style={{ gridColumn: '1 / -1', marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Product Name *</label>
                  <input value={newProductForm.name} onChange={e => setNewProductForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Paracetamol 500mg"
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
                </div>
                {[
                  ['Generic Name', 'generic_name', 'text', 'e.g. Paracetamol'],
                  ['Barcode', 'barcode', 'text', 'Scan or type'],
                ].map(([label, key, type, placeholder]) => (
                  <div key={key} style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{label}</label>
                    <input type={type} value={newProductForm[key] || ''} onChange={e => setNewProductForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                      style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
                  </div>
                ))}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Category</label>
                  <select value={newProductForm.category_id || ''} onChange={e => setNewProductForm(p => ({ ...p, category_id: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, outline: 'none' }}>
                    <option value="">No category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Supplier</label>
                  <select value={newProductForm.supplier_id || ''} onChange={e => setNewProductForm(p => ({ ...p, supplier_id: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, outline: 'none' }}>
                    <option value="">No supplier</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Unit</label>
                  <select value={newProductForm.unit || 'tablet'} onChange={e => setNewProductForm(p => ({ ...p, unit: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, outline: 'none' }}>
                    {['tablet','capsule','bottle','sachet','vial','ampoule','tube','piece','box','strip','syrup','injection','cream','drops','inhaler','patch','suppository','other'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Reorder Level</label>
                  <input type="number" value={newProductForm.reorder_level || '10'} onChange={e => setNewProductForm(p => ({ ...p, reorder_level: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Selling Price (KSH) *</label>
                  <input type="number" min="0" step="0.01" value={newProductForm.selling_price || ''} onChange={e => setNewProductForm(p => ({ ...p, selling_price: e.target.value }))}
                    placeholder="0.00"
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Min Selling Price (KSH)</label>
                  <input type="number" min="0" step="0.01" value={newProductForm.min_selling_price || ''} onChange={e => setNewProductForm(p => ({ ...p, min_selling_price: e.target.value }))}
                    placeholder="0.00"
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Max Selling Price (KSH)</label>
                  <input type="number" min="0" step="0.01" value={newProductForm.max_selling_price || ''} onChange={e => setNewProductForm(p => ({ ...p, max_selling_price: e.target.value }))}
                    placeholder="0.00"
                    style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <input type="checkbox" id="np_rx" checked={newProductForm.requires_prescription || false}
                    onChange={e => setNewProductForm(p => ({ ...p, requires_prescription: e.target.checked }))}
                    style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  <label htmlFor="np_rx" style={{ fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>Requires prescription (Rx)</label>
                </div>
              </div>
              <button onClick={handleSaveNewProduct} disabled={savingProduct}
                style={{ width: '100%', padding: 13, background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#0F1612', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {savingProduct ? <><Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Saving...</> : 'Save Product & Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {showScanner && <AIScanner type="products" onClose={() => setShowScanner(false)} onImport={fetchStock} />}
    </div>
  );
}
