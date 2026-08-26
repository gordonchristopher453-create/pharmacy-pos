import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api';
import toast from 'react-hot-toast';
import { printCombinedPatientReceipt } from '../utils/printCombinedPatientReceipt';
import { 
  Search, RefreshCw, Printer, Loader, FileText, CheckCircle, 
  AlertCircle, DollarSign, Calendar, Filter, UserCheck, Shield, ChevronRight, X
} from 'lucide-react';

const Card = ({ children, style = {}, ...props }) => (
  <div style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)', ...style }} {...props}>{children}</div>
);

const Btn = ({ children, variant = 'primary', size = 'md', ...props }) => (
  <button {...props} style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: size === 'sm' ? '6px 12px' : '9px 16px',
    background: variant === 'primary' ? 'var(--accent)' : variant === 'danger' ? '#ef4444' : variant === 'success' ? '#10b981' : 'var(--bg-elevated)',
    border: variant === 'ghost' ? '1px solid var(--border)' : 'none', borderRadius: 8,
    color: variant === 'primary' || variant === 'success' ? '#0F1612' : variant === 'danger' ? '#fff' : 'var(--text-primary)',
    fontSize: size === 'sm' ? 11 : 13, fontWeight: 600, cursor: props.disabled ? 'not-allowed' : 'pointer',
    opacity: props.disabled ? 0.6 : 1, fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s ease', ...props.style
  }}>{children}</button>
);

const STATUS_COLORS = {
  discharged: '#10b981',
  completed: '#10b981',
  active: '#3b82f6',
  in_progress: '#3b82f6',
  admitted: '#f59e0b',
  cancelled: '#ef4444',
  billing: '#8b5cf6'
};

export default function PatientPaymentHistoryPage() {
  const { user } = useSelector(s => s.auth);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // '' | 'discharged' | 'active'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, [statusFilter]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await api.get('/billing/patient-history', { params });
      setRecords(res.data.data || []);
    } catch {
      toast.error('Failed to load patient payment history');
    } finally {
      setLoading(false);
    }
  };

  const fmt = (val) => 'KES ' + parseFloat(val || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Stats
  const totalBilledSum = records.reduce((s, r) => s + parseFloat(r.total_billed || 0), 0);
  const totalPaidSum = records.reduce((s, r) => s + parseFloat(r.total_paid || 0), 0);
  const dischargedCount = records.filter(r => r.visit_status === 'discharged' || r.discharged_at).length;
  const pendingBalSum = records.reduce((s, r) => s + Math.max(0, parseFloat(r.total_pending || 0)), 0);

  return (
    <div style={{ padding: 24, minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
      {/* Page Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>📜 Patient Payment History & Combined Receipts</h1>
            <span style={{ fontSize: 11, background: 'var(--accent)20', color: 'var(--accent)', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>RECEPTION DESK</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Search patient visits, view full financial ledgers, and print combined official discharge receipts for settled accounts.
          </p>
        </div>
        <Btn variant="ghost" onClick={fetchHistory}>
          <RefreshCw size={15} /> Refresh
        </Btn>
      </div>

      {/* Filter & Search Bar */}
      <Card style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative', minWidth: 240 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') fetchHistory(); }}
              placeholder="Search by Patient Name, Patient #, Phone, Visit #..."
              style={{ width: '100%', padding: '10px 10px 10px 38px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
            >
              <option value="">All Statuses</option>
              <option value="discharged">🏥 Discharged Patients</option>
              <option value="active">⏳ Active Visits</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
            />
          </div>

          <Btn onClick={fetchHistory} size="md">
            <Filter size={14} /> Search
          </Btn>
        </div>
      </Card>

      {/* Patient Visits Table / Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Loader size={32} color="var(--accent)" style={{ animation: 'spin 0.8s linear infinite' }} />
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12 }}>Loading patient payment ledgers...</div>
        </div>
      ) : records.length === 0 ? (
        <Card style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📜</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-faint)', marginBottom: 6 }}>No patient records found</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Try adjusting your search query or date range filters</div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {records.map(record => {
            const items = Array.isArray(record.items) ? record.items.filter(i => i && i.id) : [];
            const billed = parseFloat(record.total_billed || 0);
            const paid = parseFloat(record.total_paid || 0);
            const waived = parseFloat(record.total_waived || 0);
            const pending = parseFloat(record.total_pending || (billed - paid - waived));
            const isSettled = pending <= 0;
            const isDischarged = record.visit_status === 'discharged' || record.discharged_at;

            return (
              <Card key={record.visit_id} style={{ padding: 18, borderLeft: `4px solid ${isDischarged ? '#10b981' : 'var(--accent)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                  {/* Patient Details */}
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{record.patient_name}</span>
                      <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent)' }}>
                        {record.patient_number}
                      </span>
                      {isDischarged ? (
                        <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: '#10b98120', color: '#10b981', fontWeight: 800 }}>
                          🏥 DISCHARGED
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: '#3b82f620', color: '#3b82f6', fontWeight: 800 }}>
                          ⏳ ACTIVE VISIT
                        </span>
                      )}
                      {isSettled ? (
                        <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: '#10b98115', color: '#10b981', fontWeight: 700 }}>
                          ✅ PAID IN FULL
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: '#ef444415', color: '#ef4444', fontWeight: 700 }}>
                          ⚠️ PENDING KES {pending.toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>Visit #: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{record.visit_number}</strong></span>
                      <span>·</span>
                      <span>Visit Date: {new Date(record.visit_date).toLocaleDateString('en-KE')} {new Date(record.visit_date).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</span>
                      {record.discharged_at && (
                        <>
                          <span>·</span>
                          <span>Discharged: {new Date(record.discharged_at).toLocaleDateString('en-KE')}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Financial Metrics & Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Billed</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        {fmt(billed)}
                      </div>
                      <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>
                        Paid: {fmt(paid)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <Btn size="sm" variant="ghost" onClick={() => setSelectedRecord(record)}>
                        <FileText size={13} /> View Items ({items.length})
                      </Btn>
                      <Btn size="sm" variant="success" onClick={() => printCombinedPatientReceipt(record, user?.pharmacy, user)}>
                        <Printer size={13} /> Print Combined Receipt
                      </Btn>
                    </div>
                  </div>
                </div>

                {/* Items Quick Preview */}
                {items.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                    {items.slice(0, 4).map((item, idx) => (
                      <div key={idx} style={{ padding: '6px 10px', background: 'var(--bg-elevated)', borderRadius: 6, fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                          {item.item_name || item.description}
                        </span>
                        <span style={{ fontWeight: 700, color: item.status === 'paid' ? '#10b981' : item.status === 'pending' ? '#ef4444' : 'var(--text-muted)', fontFamily: 'monospace' }}>
                          KES {parseFloat(item.total_price || 0).toLocaleString()}
                        </span>
                      </div>
                    ))}
                    {items.length > 4 && (
                      <button onClick={() => setSelectedRecord(record)} style={{ padding: '6px 10px', background: 'none', border: '1px dashed var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--accent)', cursor: 'pointer', textAlign: 'center', fontWeight: 600 }}>
                        + {items.length - 4} more item(s)...
                      </button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Record Details Modal */}
      {selectedRecord && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', width: '100%', maxWidth: 750, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{selectedRecord.patient_name}</h3>
                <div style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'monospace', marginTop: 2 }}>
                  {selectedRecord.patient_number} · Visit #{selectedRecord.visit_number}
                </div>
              </div>
              <button onClick={() => setSelectedRecord(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 24 }}>
              {/* Financial Summary Box */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: 14, background: 'var(--bg-elevated)', borderRadius: 10, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Billed</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{fmt(selectedRecord.total_billed)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Paid</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>{fmt(selectedRecord.total_paid)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Balance</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: parseFloat(selectedRecord.total_pending||0) > 0 ? '#ef4444' : '#10b981' }}>
                    {fmt(selectedRecord.total_pending)}
                  </div>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Billed Items Ledger</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
                {(selectedRecord.items || []).filter(i => i && i.id).map(item => (
                  <div key={item.id} style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{item.item_name || item.description}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {item.item_type} · Qty: {item.quantity} · Unit: KES {parseFloat(item.unit_price||0).toLocaleString()}
                        {item.payment_method && ` · Paid via ${item.payment_method.toUpperCase()}`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        {fmt(item.total_price)}
                      </div>
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase', background: item.status === 'paid' ? '#10b98120' : '#ef444420', color: item.status === 'paid' ? '#10b981' : '#ef4444' }}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <Btn variant="ghost" onClick={() => setSelectedRecord(null)}>Close</Btn>
                <Btn variant="success" onClick={() => printCombinedPatientReceipt(selectedRecord, user?.pharmacy, user)}>
                  <Printer size={15} /> Print Combined Receipt & Discharge Statement
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
