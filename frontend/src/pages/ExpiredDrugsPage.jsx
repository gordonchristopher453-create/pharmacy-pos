import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api';
import toast from 'react-hot-toast';
import { AlertTriangle, Trash2, Loader, RefreshCw, Package, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function ExpiredDrugsPage() {
  const { user } = useSelector(state => state.auth);
  const [expired, setExpired] = useState([]);
  const [loading, setLoading] = useState(true);
  const [disposing, setDisposing] = useState(null);
  const [disposingAll, setDisposingAll] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [confirmAllModal, setConfirmAllModal] = useState(false);
  const [deptTab, setDeptTab] = useState('all');

  const fetchExpired = async () => {
    setLoading(true);
    try {
      const res = await api.get('/stock/expired');
      setExpired(res.data.data || []);
    } catch (e) {
      toast.error('Failed to load expired drugs: ' + (e.response?.data?.message || e.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchExpired(); }, []);

  const filteredExpired = expired.filter(item => {
    if (deptTab === 'all') return true;
    const itemDept = (item.department || 'pharmacy').toLowerCase();
    return itemDept === deptTab;
  });

  const handleDispose = async (stockId) => {
    setDisposing(stockId);
    try {
      const res = await api.post(`/stock/expired/${stockId}/dispose`);
      toast.success(res.data.message || 'Disposed successfully');
      setConfirmId(null);
      fetchExpired();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to dispose expired stock');
    } finally {
      setDisposing(null);
    }
  };

  const handleDisposeAll = async () => {
    setDisposingAll(true);
    try {
      const res = await api.post('/stock/expired/dispose-all');
      toast.success(res.data.message || 'All expired drugs disposed successfully');
      setConfirmAllModal(false);
      fetchExpired();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to dispose all expired drugs');
    } finally {
      setDisposingAll(false);
    }
  };

  const totalUnits = filteredExpired.reduce((sum, e) => sum + parseInt(e.quantity || 0), 0);
  const totalProducts = new Set(filteredExpired.map(e => e.product_id)).size;

  return (
    <div style={{ padding: 24, minHeight: '100vh', overflow: 'auto', background: 'var(--bg-main)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <AlertTriangle size={22} color="var(--danger)" />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Expired Stock & Quarantine Register</h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Monitor and safely log disposal of Pharmacy drugs, Lab reagents/supplies & MCH items past certified expiry dates
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={fetchExpired} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <RefreshCw size={14} /> Refresh List
          </button>
          {filteredExpired.length > 0 && (
            <button onClick={() => setConfirmAllModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--danger)', border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 2px 8px rgba(239,68,68,0.3)' }}>
              <Trash2 size={15} /> Dispose All Expired ({filteredExpired.length})
            </button>
          )}
        </div>
      </div>

      {/* Department Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: 'var(--bg-surface)', padding: 4, borderRadius: 12, border: '1px solid var(--border)', width: 'fit-content' }}>
        {[
          { id: 'all', label: 'All Departments' },
          { id: 'pharmacy', label: '💊 Pharmacy Stock' },
          { id: 'laboratory', label: '🧪 Lab Reagents & Supplies' },
          { id: 'mch', label: '🤱 MCH & Vaccines' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setDeptTab(tab.id)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              background: deptTab === tab.id ? 'var(--accent)' : 'transparent',
              color: deptTab === tab.id ? '#0F1612' : 'var(--text-muted)',
              transition: 'all 0.15s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* KPI Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div style={{ background: 'var(--bg-surface)', padding: '16px 20px', borderRadius: 14, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={22} color="var(--danger)" />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Expired Batches</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--danger)', marginTop: 2 }}>{expired.length}</div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: '16px 20px', borderRadius: 14, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={22} color="var(--warning)" />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Affected Products</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{totalProducts}</div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: '16px 20px', borderRadius: 14, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={22} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Quarantined Units</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{totalUnits}</div>
          </div>
        </div>
      </div>

      {/* Warning Banner */}
      {filteredExpired.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={18} color="var(--danger)" />
          <span style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 600, lineHeight: 1.4 }}>
            These products have exceeded their official shelf life. System automatically blocks dispensing expired units at POS. Click <b>Dispose</b> to remove from inventory and record disposal movement.
          </span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader size={28} color="var(--accent)" style={{ animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : filteredExpired.length === 0 ? (
        <div style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)', padding: 60, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle2 size={32} color="var(--accent)" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>All Stock is Fresh & Active</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>There are currently zero expired stock items in this department view.</div>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                {['Department', 'Product / Reagent Name', 'Batch Number', 'Expired Date', 'Days Elapsed', 'Expired Qty', 'Action'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredExpired.map(item => {
                const daysExpired = Math.floor((new Date() - new Date(item.expiry_date)) / (1000 * 60 * 60 * 24));
                const deptLabel = item.department === 'laboratory' ? '🧪 Laboratory' : item.department === 'mch' ? '🤱 MCH Clinic' : '💊 Pharmacy';
                const deptBg = item.department === 'laboratory' ? 'rgba(6,182,212,0.15)' : item.department === 'mch' ? 'rgba(236,72,153,0.15)' : 'rgba(16,185,129,0.15)';
                const deptColor = item.department === 'laboratory' ? '#06b6d4' : item.department === 'mch' ? '#ec4899' : '#10b981';

                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 6, background: deptBg, color: deptColor, border: `1px solid ${deptColor}30` }}>
                        {deptLabel}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.product_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.generic_name || '—'} • {item.unit} • {item.category_name || 'General'}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.batch_number || 'N/A'}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 13, color: 'var(--danger)', fontWeight: 600 }}>
                        {new Date(item.expiry_date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.12)', color: 'var(--danger)', fontWeight: 600 }}>
                        {daysExpired > 0 ? `${daysExpired}d ago` : 'Today'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)' }}>{item.quantity} {item.unit}s</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {confirmId === item.id ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => handleDispose(item.id)}
                            disabled={disposing === item.id}
                            style={{ padding: '6px 12px', background: 'var(--danger)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            {disposing === item.id ? <Loader size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Trash2 size={12} />}
                            Confirm
                          </button>
                          <button onClick={() => setConfirmId(null)} style={{ padding: '6px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmId(item.id)}
                          style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 7, color: 'var(--danger)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Trash2 size={12} /> Dispose Batch
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm Dispose All Modal */}
      {confirmAllModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={() => setConfirmAllModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', width: '100%', maxWidth: 460, padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={24} color="var(--danger)" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Dispose All {expired.length} Expired Batches?</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.5 }}>
              This action will remove all <b>{totalUnits} units</b> of expired stock across {totalProducts} products and log disposal stock movements for compliance.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setConfirmAllModal(false)} style={{ flex: 1, padding: '12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleDisposeAll} disabled={disposingAll} style={{ flex: 1, padding: '12px', background: 'var(--danger)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {disposingAll ? <Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Trash2 size={16} />}
                Dispose All
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
