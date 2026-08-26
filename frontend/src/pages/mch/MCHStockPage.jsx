import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Package, ArrowLeft, Plus, Search, RefreshCw, X, Save, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';

const Card = ({ children, style={}, ...props }) => (<div style={{ background:'var(--bg-surface)', borderRadius:14, border:'1px solid var(--border)', ...style }} {...props}>{children}</div>);
const Btn = ({ children, variant='primary', size='md', ...props }) => (<button {...props} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:size==='sm'?'6px 12px':'10px 18px', background:variant==='primary'?'var(--accent)':variant==='danger'?'#ef4444':variant==='success'?'#10b981':'var(--bg-elevated)', border:variant==='ghost'?'1px solid var(--border)':'none', borderRadius:8, color:variant==='primary'||variant==='success'?'#0F1612':variant==='danger'?'#fff':'var(--text-primary)', fontSize:size==='sm'?11:13, fontWeight:600, cursor:props.disabled?'not-allowed':'pointer', opacity:props.disabled?0.6:1, fontFamily:'DM Sans, sans-serif', ...props.style }}>{children}</button>);
const Input = ({ label, ...props }) => (<div>{label && <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>{label}</label>}<input {...props} style={{ width:'100%', padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' }}/></div>);
const Select = ({ label, children, ...props }) => (<div>{label && <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>{label}</label>}<select {...props} style={{ width:'100%', padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none' }}>{children}</select></div>);
const Textarea = ({ label, ...props }) => (<div>{label && <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>{label}</label>}<textarea {...props} style={{ width:'100%', padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none', fontFamily:'DM Sans, sans-serif', resize:'vertical', boxSizing:'border-box' }}/></div>);

const CATEGORIES = { vaccine:'💉 Vaccine', fp_supply:'👥 FP Supply', consumable:'🩺 Consumable', other:'📦 Other' };
const CAT_COLORS = { vaccine:'#f59e0b', fp_supply:'#10b981', consumable:'#06b6d4', other:'var(--text-muted)' };

const EMPTY_FORM = { name:'', category:'vaccine', quantity:0, unit:'units', reorder_level:10, batch_number:'', expiry_date:'', supplier:'', notes:'' };

export default function MCHStockPage() {
  const navigate = useNavigate();
  const [now] = useState(() => Date.now());
  const [stock, setStock] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showReceive, setShowReceive] = useState(null);
  const [showMovements, setShowMovements] = useState(null);
  const [movements, setMovements] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({...EMPTY_FORM});
  const [receiveForm, setReceiveForm] = useState({ quantity:'', batch_number:'', expiry_date:'', notes:'' });

  const fetchStock = async () => {
    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (search) params.append('search', search);
      const { data } = await api.get('/mch-stock?' + params.toString());
      setStock(data.data || []);
    } catch { toast.error('Failed to fetch stock'); }
    setLoading(false);
  };

  const fetchLowStock = async () => {
    try {
      const { data } = await api.get('/mch-stock/alerts/low');
      setLowStock(data.data || []);
    } catch { /* ignore */ }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchStock(); fetchLowStock(); }, []);

  const fetchMovements = async (id) => {
    try {
      const { data } = await api.get(`/mch-stock/${id}/movements`);
      setMovements(data.data || []);
    } catch { /* ignore */ }
  };

  const handleAdd = async () => {
    if (!form.name) return toast.error('Name required');
    setSaving(true);
    try {
      await api.post('/mch-stock', form);
      toast.success('Stock item added');
      setShowAdd(false);
      setForm({...EMPTY_FORM});
      setLoading(true);
      fetchStock(); fetchLowStock();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to add'); }
    setSaving(false);
  };

  const handleReceive = async () => {
    if (!receiveForm.quantity) return toast.error('Enter quantity');
    setSaving(true);
    try {
      await api.post(`/mch-stock/${showReceive.id}/receive`, receiveForm);
      toast.success('Stock received');
      setShowReceive(null);
      setReceiveForm({ quantity:'', batch_number:'', expiry_date:'', notes:'' });
      setLoading(true);
      fetchStock(); fetchLowStock();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    setSaving(false);
  };

  const sf = (k,v) => setForm(f=>({...f,[k]:v}));
  const rf = (k,v) => setReceiveForm(f=>({...f,[k]:v}));

  const totalItems = stock.length;
  const totalLow = lowStock.length;
  const expiringSoon = stock.filter(s => s.expiry_date && new Date(s.expiry_date) <= new Date(now + 30*24*60*60*1000)).length;

  return (
    <div style={{ padding:24, height:'100vh', overflow:'auto' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => navigate('/app/mch')} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><ArrowLeft size={20}/></button>
          <div>
            <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:8 }}><Package size={22} color="var(--accent)"/> MCH Stock</h1>
            <p style={{ fontSize:12, color:'var(--text-muted)' }}>Vaccines, FP supplies & consumables</p>
          </div>
        </div>
        <Btn onClick={() => setShowAdd(true)}><Plus size={14}/> Add Item</Btn>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Total Items', value:totalItems, color:'var(--accent)' },
          { label:'Low Stock', value:totalLow, color: totalLow>0?'var(--danger)':'var(--accent)' },
          { label:'Expiring Soon', value:expiringSoon, color: expiringSoon>0?'var(--warning)':'var(--accent)' },
        ].map(s => (
          <Card key={s.label} style={{ padding:16 }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{s.label}</div>
            <div style={{ fontSize:26, fontWeight:700, color:s.color }}>{s.value}</div>
          </Card>
        ))}
      </div>

      {/* Low stock alert */}
      {totalLow > 0 && (
        <div style={{ padding:'10px 16px', background:'#ef444410', border:'1px solid #ef444430', borderRadius:10, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
          <AlertTriangle size={16} color="#ef4444"/>
          <span style={{ fontSize:13, color:'#ef4444', fontWeight:600 }}>{totalLow} item{totalLow>1?'s':''} below reorder level</span>
        </div>
      )}

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:16, alignItems:'center' }}>
        <div style={{ position:'relative', flex:1 }}>
          <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key==='Enter'&&(setLoading(true),fetchStock())}
            placeholder="Search items..." style={{ width:'100%', padding:'9px 9px 9px 32px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
        </div>
        <select value={category} onChange={e => { setCategory(e.target.value); }} style={{ padding:'9px 12px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none' }}>
          <option value="">All Categories</option>
          {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Btn variant="ghost" size="sm" onClick={() => { setLoading(true); fetchStock(); fetchLowStock(); }}><RefreshCw size={14}/></Btn>
      </div>

      {/* Stock list */}
      {loading ? <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}>Loading...</div>
      : stock.length === 0 ? (
        <Card style={{ textAlign:'center', padding:60 }}>
          <Package size={40} color="var(--text-faint)" style={{ marginBottom:12 }}/>
          <p style={{ color:'var(--text-muted)' }}>No MCH stock items found</p>
          <p style={{ color:'var(--text-faint)', fontSize:12, marginTop:4 }}>Add vaccines, FP supplies and consumables</p>
        </Card>
      ) : (
        <div style={{ display:'grid', gap:10 }}>
          {stock.map(item => {
            const isLow = item.quantity <= item.reorder_level;
            const isExpiring = item.expiry_date && new Date(item.expiry_date) <= new Date(now + 30*24*60*60*1000);
            return (
              <Card key={item.id} style={{ padding:'16px 20px', borderColor: isLow ? '#ef444440' : 'var(--border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', gap:14, alignItems:'center' }}>
                    <div style={{ width:42, height:42, borderRadius:12, background:`${CAT_COLORS[item.category]}20`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>
                      {item.category==='vaccine'?'💉':item.category==='fp_supply'?'👥':item.category==='consumable'?'🩺':'📦'}
                    </div>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                        <span style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)' }}>{item.name}</span>
                        <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4, background:`${CAT_COLORS[item.category]}20`, color:CAT_COLORS[item.category], fontWeight:600 }}>{CATEGORIES[item.category]}</span>
                        {isLow && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4, background:'#ef444420', color:'#ef4444', fontWeight:600 }}>⚠ LOW</span>}
                        {isExpiring && <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4, background:'#f59e0b20', color:'#f59e0b', fontWeight:600 }}>⚠ EXPIRING</span>}
                      </div>
                      <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                        Batch: {item.batch_number||'—'} · Expiry: {item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-KE') : '—'}
                        {item.supplier && ` · ${item.supplier}`}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:22, fontWeight:700, color: isLow?'#ef4444':'var(--accent)' }}>{item.quantity}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>{item.unit} · min {item.reorder_level}</div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      <Btn size="sm" variant="success" onClick={() => setShowReceive(item)}><TrendingUp size={12}/> Receive</Btn>
                      <Btn size="sm" variant="ghost" onClick={() => { setShowMovements(item); fetchMovements(item.id); }}>History</Btn>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ADD ITEM MODAL */}
      {showAdd && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'var(--bg-surface)', borderRadius:16, border:'1px solid var(--border)', width:'100%', maxWidth:520, padding:28 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)', margin:0 }}>➕ Add MCH Stock Item</h2>
              <button onClick={() => setShowAdd(false)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={20}/></button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div style={{ gridColumn:'1/-1' }}><Input label="Item Name *" value={form.name} onChange={e => sf('name',e.target.value)} placeholder="e.g. BCG Vaccine, OPV, Depo-Provera"/></div>
              <Select label="Category *" value={form.category} onChange={e => sf('category',e.target.value)}>
                {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
              <Input label="Unit" value={form.unit} onChange={e => sf('unit',e.target.value)} placeholder="e.g. vials, doses, pieces"/>
              <Input label="Opening Quantity" type="number" value={form.quantity} onChange={e => sf('quantity',e.target.value)}/>
              <Input label="Reorder Level" type="number" value={form.reorder_level} onChange={e => sf('reorder_level',e.target.value)}/>
              <Input label="Batch Number" value={form.batch_number} onChange={e => sf('batch_number',e.target.value)}/>
              <Input label="Expiry Date" type="date" value={form.expiry_date} onChange={e => sf('expiry_date',e.target.value)}/>
              <div style={{ gridColumn:'1/-1' }}><Input label="Supplier" value={form.supplier} onChange={e => sf('supplier',e.target.value)} placeholder="e.g. KEMSA"/></div>
              <div style={{ gridColumn:'1/-1' }}><Textarea label="Notes" rows={2} value={form.notes} onChange={e => sf('notes',e.target.value)}/></div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <Btn variant="ghost" onClick={() => setShowAdd(false)} style={{ flex:1, justifyContent:'center' }}>Cancel</Btn>
              <Btn onClick={handleAdd} disabled={saving} style={{ flex:2, justifyContent:'center' }}><Save size={14}/> {saving?'Saving...':'Add Item'}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* RECEIVE STOCK MODAL */}
      {showReceive && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'var(--bg-surface)', borderRadius:16, border:'1px solid var(--border)', width:'100%', maxWidth:440, padding:28 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div>
                <h2 style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)', margin:0 }}>📥 Receive Stock</h2>
                <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>{showReceive.name} · Current: {showReceive.quantity} {showReceive.unit}</p>
              </div>
              <button onClick={() => setShowReceive(null)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={20}/></button>
            </div>
            <div style={{ display:'grid', gap:12, marginBottom:20 }}>
              <Input label="Quantity Received *" type="number" value={receiveForm.quantity} onChange={e => rf('quantity',e.target.value)} placeholder="Enter quantity"/>
              <Input label="Batch Number" value={receiveForm.batch_number} onChange={e => rf('batch_number',e.target.value)}/>
              <Input label="Expiry Date" type="date" value={receiveForm.expiry_date} onChange={e => rf('expiry_date',e.target.value)}/>
              <Textarea label="Notes" rows={2} value={receiveForm.notes} onChange={e => rf('notes',e.target.value)} placeholder="e.g. Received from KEMSA"/>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <Btn variant="ghost" onClick={() => setShowReceive(null)} style={{ flex:1, justifyContent:'center' }}>Cancel</Btn>
              <Btn onClick={handleReceive} disabled={saving} style={{ flex:2, justifyContent:'center' }}><TrendingUp size={14}/> {saving?'Saving...':'Receive Stock'}</Btn>
            </div>
          </div>
        </div>
      )}

      {/* MOVEMENTS MODAL */}
      {showMovements && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'var(--bg-surface)', borderRadius:16, border:'1px solid var(--border)', width:'100%', maxWidth:520, maxHeight:'80vh', overflow:'auto', padding:28 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div>
                <h2 style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)', margin:0 }}>📊 Stock Movements</h2>
                <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>{showMovements.name}</p>
              </div>
              <button onClick={() => setShowMovements(null)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={20}/></button>
            </div>
            {movements.length === 0 ? <p style={{ textAlign:'center', color:'var(--text-muted)', padding:40 }}>No movements recorded</p>
            : movements.map(m => (
              <div key={m.id} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                <div>
                  <span style={{ fontWeight:600, color: m.movement_type==='in'?'#10b981':'#ef4444' }}>
                    {m.movement_type==='in'?<TrendingUp size={13}/>:<TrendingDown size={13}/>} {m.movement_type==='in'?'+':'-'}{m.quantity}
                  </span>
                  <span style={{ color:'var(--text-muted)', marginLeft:8 }}>{m.notes}</span>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>{m.created_by_name}</div>
                  <div style={{ fontSize:11, color:'var(--text-faint)' }}>{new Date(m.created_at).toLocaleDateString('en-KE')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
