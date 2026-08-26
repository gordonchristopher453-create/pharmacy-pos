import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Search, Printer, Eye, X, Loader, ShoppingCart } from 'lucide-react';
import { printReceipt } from '../utils/printReceipt';
import { useSelector } from 'react-redux';

const Modal = ({ title, onClose, children }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: '#00000070' }} />
    <div style={{ position: 'relative', background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
      </div>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  </div>
);

const pmColors = { cash: 'var(--accent)', mpesa: 'var(--info)', card: 'var(--warning)', insurance: 'var(--danger)' };

export default function SalesPage() {
  const { user } = useSelector(s => s.auth);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentFilter, setPaymentFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => { fetchSales(); }, [startDate, endDate, paymentFilter]);

  const fetchSales = async () => {
    setLoading(true);
    try {
      let url = `/sales?limit=100&start_date=${startDate}&end_date=${endDate}`;
      if (paymentFilter) url += `&payment_method=${paymentFilter}`;
      const res = await api.get(url);
      const data = res.data.data;
      const rows = Array.isArray(data) ? data : data?.data || [];
      setSales(rows);
      setTotalCount(data?.total_count || rows.length);
    } catch { toast.error('Failed to load sales'); }
    finally { setLoading(false); }
  };

  const openDetail = async (sale) => {
    setLoadingDetail(true);
    try {
      const res = await api.get(`/sales/${sale.id}`);
      setSelected(res.data.data);
    } catch { toast.error('Failed to load receipt'); }
    finally { setLoadingDetail(false); }
  };

  const handlePrint = async (sale) => {
    setLoadingDetail(true);
    try {
      const res = await api.get(`/sales/${sale.id}`);
      printReceipt(res.data.data, user?.pharmacy);
    } catch { toast.error('Failed to load receipt for printing'); }
    finally { setLoadingDetail(false); }
  };

  const filtered = sales.filter(s =>
    !search ||
    s.receipt_number?.toLowerCase().includes(search.toLowerCase()) ||
    s.cashier_name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = filtered.reduce((sum, s) => sum + parseFloat(s.total || 0), 0);

  return (
    <div style={{ padding: 24, height: '100vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Sales History</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            {totalCount} transactions • Total: <span className="mono" style={{ color: 'var(--accent)', fontWeight: 700 }}>KES {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search receipt or cashier..." style={{ width: '100%', padding: '10px 14px 10px 36px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>FROM</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '9px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>TO</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '9px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>PAYMENT</label>
          <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} style={{ padding: '9px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}>
            <option value="">All</option>
            <option value="cash">Cash</option>
            <option value="mpesa">M-Pesa</option>
            <option value="card">Card</option>
            <option value="insurance">Insurance</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader size={28} color="var(--accent)" style={{ animation: 'spin 0.8s linear infinite' }} /></div>
      ) : (
        <div style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                {['Receipt', 'Cashier', 'Items', 'Payment', 'Discount', 'Total', 'Time', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--text-faint)' }}>
                  <ShoppingCart size={32} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                  No sales found
                </td></tr>
              ) : filtered.map(sale => (
                <tr key={sale.id} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '11px 14px' }}>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{sale.receipt_number}</span>
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--text-primary)' }}>{sale.cashier_name || '—'}</td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--text-muted)' }}>{sale.item_count || '—'}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, fontWeight: 600, textTransform: 'capitalize', background: `${pmColors[sale.payment_method] || 'var(--text-faint)'}20`, color: pmColors[sale.payment_method] || 'var(--text-faint)' }}>
                      {sale.payment_method}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span className="mono" style={{ fontSize: 12, color: parseFloat(sale.discount) > 0 ? 'var(--warning)' : 'var(--text-faint)' }}>
                      {parseFloat(sale.discount) > 0 ? `- KES ${parseFloat(sale.discount).toFixed(2)}` : '—'}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>KES {parseFloat(sale.total).toLocaleString()}</span>
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                    <div>{new Date(sale.created_at).toLocaleDateString()}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{new Date(sale.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openDetail(sale)} style={{ padding: '6px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                        <Eye size={13} /> View
                      </button>
                      <button onClick={() => handlePrint(sale)} disabled={loadingDetail} style={{ padding: '6px 10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 7, color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}>
                        <Printer size={13} /> Print
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Receipt Detail Modal */}
      {selected && (
        <Modal title={`Receipt — ${selected.receipt_number}`} onClose={() => setSelected(null)}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {new Date(selected.created_at).toLocaleString()} • {selected.cashier_name}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            {(selected.items || []).map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.product_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>x{item.quantity} @ KES {parseFloat(item.unit_price).toFixed(2)}</div>
                </div>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>KES {parseFloat(item.total_price).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: 'var(--text-muted)' }}>
              <span>Subtotal</span><span className="mono">KES {parseFloat(selected.subtotal).toFixed(2)}</span>
            </div>
            {parseFloat(selected.discount) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: 'var(--warning)' }}>
                <span>Discount</span><span className="mono">- KES {parseFloat(selected.discount).toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
              <span>Total</span><span className="mono">KES {parseFloat(selected.total).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              <span>Payment</span><span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{selected.payment_method}</span>
            </div>
          </div>

          <button onClick={() => printReceipt(selected, user?.pharmacy)} style={{ width: '100%', marginTop: 20, padding: 13, background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#0F1612', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Printer size={17} /> Print Receipt
          </button>
        </Modal>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
