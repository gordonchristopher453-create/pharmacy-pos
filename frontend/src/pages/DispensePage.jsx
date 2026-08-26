import { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Loader, X, Search, Pill, ShieldAlert, CheckCircle, Clock, Calendar, AlertCircle } from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";

export default function DispensePage({ user: propUser }) {
  const authUser = useSelector(state => state.auth.user);
  const user = propUser || authUser;
  const navigate = useNavigate();

  const isPharmacyOnly = user?.pharmacy?.facility_type === 'pharmacy';

  useEffect(() => {
    if (isPharmacyOnly) {
      toast('Standalone pharmacies operate via Point of Sale (POS)', { icon: '💊' });
      navigate('/app/pos', { replace: true });
    }
  }, [isPharmacyOnly, navigate]);

  const [tab, setTab]               = useState('queue'); // 'queue' | 'inpatient' | 'history'
  const [rxQueue, setRxQueue]       = useState([]);
  const [inpatientRxQueue, setInpatientRxQueue] = useState([]);
  const [rxLoading, setRxLoading]   = useState(false);
  const [selectedRx, setSelectedRx] = useState(null);
  const [rxPayment, setRxPayment]   = useState(null);

  // History
  const [history, setHistory]       = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [search, setSearch]         = useState('');
  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom]     = useState(today);
  const [dateTo, setDateTo]         = useState(today);
  const [queueDate, setQueueDate]   = useState(today);
  const [queueSearch, setQueueSearch] = useState('');

  const fetchRxQueue = useCallback(async (silent = false) => {
    if (!silent) setRxLoading(true);
    try {
      const params = new URLSearchParams();
      if (queueDate) {
        params.append('date_from', queueDate);
        params.append('date_to', queueDate);
      } else {
        params.append('all_dates', 'true');
      }
      if (queueSearch) params.append('search', queueSearch);
      
      let res;
      try {
        res = await api.get('/consultations/pharmacy-queue?' + params.toString());
      } catch (e1) {
        console.warn('Consultations queue endpoint failed, trying /pharmacy/queue fallback:', e1?.message);
        res = await api.get('/pharmacy/queue');
      }

      if (res && res.data) {
        const rawData = res.data.data || [];
        // Normalize prescriptions format if coming from simple fallback
        const formatted = rawData.map(item => {
          if (item.prescriptions && Array.isArray(item.prescriptions)) return item;
          return {
            id: item.visit_id || item.id,
            visit_number: item.visit_number || 'OPD-RX',
            patient_name: item.patient_name || 'Patient',
            created_at: item.created_at || new Date().toISOString(),
            prescriptions: [{
              id: item.id,
              drug_name: item.drug_name,
              dosage: item.dosage,
              frequency: item.frequency,
              duration: item.duration,
              route: item.route || 'oral',
              quantity: item.quantity || 1,
              instructions: item.instructions,
              status: item.status || 'pending',
              price: item.price || 0,
              product_id: item.product_id
            }]
          };
        });
        setRxQueue(formatted);
      }
    } catch (err) { 
      console.error("Prescription queue fetch error:", err);
      if (!silent) toast.error('Unable to sync prescription queue. Please refresh.');
    }
    finally { 
      if (!silent) setRxLoading(false); 
    }
  }, [queueDate, queueSearch]);

  const fetchInpatientQueue = useCallback(async (silent = false) => {
    if (!silent) setRxLoading(true);
    try {
      const res = await api.get('/inpatient/pharmacy-queue');
      setInpatientRxQueue(res.data?.data || []);
    } catch (err) { 
      console.warn("Inpatient queue fetch error:", err?.message);
      setInpatientRxQueue([]);
    }
    finally { 
      if (!silent) setRxLoading(false); 
    }
  }, []);

  const fetchHistory = useCallback(async (silent = false) => {
    if (!silent) setHistLoading(true);
    try {
      const params = new URLSearchParams({ limit: '500' });
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (search) params.append('search', search);
      const res = await api.get('/pharmacy/dispense-history?' + params.toString());
      setHistory(res.data?.data || []);
    } catch (err) { 
      console.error("Dispense history error:", err);
      if (!silent) toast.error('Failed to fetch dispense history'); 
    }
    finally { 
      if (!silent) setHistLoading(false); 
    }
  }, [dateFrom, dateTo, search]);

  useEffect(() => {
    fetchRxQueue(false);
    fetchInpatientQueue(false);
    const interval = setInterval(() => {
      fetchRxQueue(true);
      fetchInpatientQueue(true);
    }, 25000);
    return () => clearInterval(interval);
  }, [fetchRxQueue, fetchInpatientQueue]);

  useEffect(() => {
    if (tab === 'history') fetchHistory();
    if (tab === 'inpatient') fetchInpatientQueue();
  }, [tab, fetchHistory, fetchInpatientQueue]);

  const checkRxPayment = (visitId, isInpatient = false) => {
    if (isInpatient) {
      setRxPayment({ paid: true, balance: 0, is_inpatient: true });
      return;
    }
    api.get("/billing/visit/" + visitId)
      .then(res => {
        const items = res.data?.data?.items || [];
        const pendingDrugs = items.filter(i => i.item_type === 'drug' && i.status === 'pending');
        const drugBalance = pendingDrugs.reduce((acc, i) => acc + parseFloat(i.total_price || 0), 0);
        setRxPayment({
          paid: pendingDrugs.length === 0,
          balance: drugBalance,
          has_bill: items.some(i => i.item_type === 'drug')
        });
      })
      .catch(() => setRxPayment({ paid: true, balance: 0 }));
  };

  const openRx = (rx) => {
    setSelectedRx(rx);
    const isInpatient = rx.is_inpatient || rx.visit_status === 'inpatient' || rx.visit_type === 'inpatient' || rx.ward_name;
    checkRxPayment(rx.id, isInpatient);
  };

  const handleQuickPay = async (visitId) => {
    try {
      const billRes = await api.get(`/billing/visit/${visitId}`);
      const billData = billRes.data?.data;
      if (!billData || !billData.items || billData.items.length === 0) {
        toast.error('No bill items found for this prescription');
        return;
      }
      const pendingItems = billData.items.filter(item => item.status === 'pending' && item.item_type === 'drug');
      if (pendingItems.length === 0) {
        toast.success('Prescription drugs are already fully paid!');
        checkRxPayment(visitId);
        fetchRxQueue();
        return;
      }
      const itemIds = pendingItems.map(item => item.id);
      const totalAmount = pendingItems.reduce((acc, item) => acc + parseFloat(item.total_price || 0), 0);
      await api.post(`/billing/visit/${visitId}/pay`, {
        payment_method: 'cash',
        amount: String(totalAmount),
        reference_number: 'CSH-RX-BYPASS-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        notes: 'Bypass payment cleared directly from Pharmacy Terminal.',
        item_ids: itemIds
      });
      toast.success(`🎉 Prescription invoice of KES ${totalAmount.toLocaleString()} paid!`);
      checkRxPayment(visitId);
      fetchRxQueue();
    } catch {
      toast.error('Failed to clear bill from Pharmacy');
    }
  };

  return (
    <div style={{ padding: 24, height: '100%', overflow: 'auto', background: 'var(--bg-base)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--accent)40' }}>
            <Pill size={24} color="var(--accent)" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.4px', margin: 0 }}>
              Prescription Dispense Workspace
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Real-time electronic prescription queue & audit history
            </p>
          </div>
        </div>

        {tab === 'queue' && (
          <button onClick={() => fetchRxQueue(false)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700 }}>
            <RefreshCw size={15} style={{ color: 'var(--accent)', animation: rxLoading ? 'spin 1s linear infinite' : 'none' }}/> Refresh Queue
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, background: 'var(--bg-surface)', borderRadius: 12, padding: 4, border: '1px solid var(--border)', width: 'fit-content' }}>
        <button onClick={() => setTab('queue')} style={{
          padding: '9px 22px', borderRadius: 8, border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 700,
          background: tab === 'queue' ? 'var(--accent)' : 'transparent',
          color: tab === 'queue' ? '#0F1612' : 'var(--text-muted)',
          transition: 'all 0.2s'
        }}>
          💊 Outpatient OPD Prescriptions {rxQueue.length > 0 ? `(${rxQueue.length})` : ''}
        </button>

        <button onClick={() => setTab('inpatient')} style={{
          padding: '9px 22px', borderRadius: 8, border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 700,
          background: tab === 'inpatient' ? 'var(--accent)' : 'transparent',
          color: tab === 'inpatient' ? '#0F1612' : 'var(--text-muted)',
          transition: 'all 0.2s'
        }}>
          🏥 Inpatient Ward Prescriptions {inpatientRxQueue.length > 0 ? `(${inpatientRxQueue.length})` : ''}
        </button>

        <button onClick={() => setTab('history')} style={{
          padding: '9px 22px', borderRadius: 8, border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 700,
          background: tab === 'history' ? 'var(--accent)' : 'transparent',
          color: tab === 'history' ? '#0F1612' : 'var(--text-muted)',
          transition: 'all 0.2s'
        }}>
          📋 Dispensed History Log
        </button>
      </div>

      {/* QUEUE TAB */}
      {tab === 'queue' && (
        <>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)', padding: 18, marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 14, alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>FILTER DATE</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="date" value={queueDate} onChange={e => setQueueDate(e.target.value)}
                    style={{ padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
                  <button onClick={() => setQueueDate(today)} style={{ padding: '0 12px', background: queueDate === today ? 'var(--accent-soft)' : 'var(--bg-elevated)', border: `1px solid ${queueDate === today ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, color: queueDate === today ? 'var(--accent)' : 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    Today
                  </button>
                  <button onClick={() => setQueueDate('')} style={{ padding: '0 12px', background: !queueDate ? 'var(--accent-soft)' : 'var(--bg-elevated)', border: `1px solid ${!queueDate ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, color: !queueDate ? 'var(--accent)' : 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    All Pending
                  </button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>SEARCH PATIENT</label>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input value={queueSearch} onChange={e => setQueueSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && fetchRxQueue()}
                    placeholder="Search by patient name or MRN number..."
                    style={{ width: '100%', padding: '10px 14px 10px 38px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <button onClick={fetchRxQueue} style={{ padding: '10px 22px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#0F1612', fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>
                Search
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'Total Pending Queue', value: rxQueue.length, color: 'var(--warning)', icon: Clock },
              { label: 'Awaiting Settlement', value: rxQueue.filter(r => !r.paid).length, color: 'var(--danger)', icon: AlertCircle },
              { label: 'Ready for Dispensing', value: rxQueue.filter(r => r.paid).length, color: 'var(--accent)', icon: CheckCircle },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)', padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
                </div>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={22} color={color} />
                </div>
              </div>
            ))}
          </div>

          {rxLoading ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <Loader size={32} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--accent)' }}/>
            </div>
          ) : rxQueue.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 70, background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Pill size={32} color="var(--accent)" />
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>No Active Prescriptions Waiting</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Prescriptions issued during doctor consultations will populate here in real time.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {rxQueue.map(rx => (
                <div key={rx.id} onClick={() => openRx(rx)}
                  style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', padding: 20, cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{rx.patient_name}</span>
                        <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 6 }}>{rx.patient_number}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rx.gender} • Dr. {rx.doctor_name || 'Consultant'}</div>
                      {rx.diagnosis && <div style={{ fontSize: 13, color: 'var(--accent)', marginTop: 4, fontWeight: 700 }}>Diagnosis: {rx.diagnosis}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'var(--accent)20', color: 'var(--accent)', fontWeight: 800 }}>PRESCRIPTION READY</span>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{new Date(rx.visit_date || Date.now()).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>

                  {rx.allergies && (
                    <div style={{ padding: '8px 12px', background: 'var(--danger)15', borderRadius: 8, fontSize: 12, color: 'var(--danger)', marginBottom: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ShieldAlert size={16} /> Patient Allergies Alert: {rx.allergies}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(rx.prescriptions || []).slice(0, 4).map((p, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 10, fontSize: 13 }}>
                        <div>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.drug_name}</span>
                          {p.dosage && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{p.dosage} • {p.frequency} • {p.duration}</span>}
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 800 }}>Qty: {p.quantity || 1}</span>
                      </div>
                    ))}
                    {(rx.prescriptions || []).length > 4 && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600 }}>+{rx.prescriptions.length - 4} more drug items</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* INPATIENT WARD PRESCRIPTIONS TAB */}
      {tab === 'inpatient' && (
        <>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)', padding: 18, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>🏥 Inpatient Ward Prescriptions</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Inpatient drug prescriptions proceed immediately for ward administration without upfront payment collection.</p>
              </div>
              <button onClick={fetchInpatientQueue} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0F1612', fontWeight: 800, cursor: 'pointer', fontSize: 12 }}>
                Refresh Inpatient Queue
              </button>
            </div>
          </div>

          {rxLoading ? (
            <div style={{ textAlign: 'center', padding: 80 }}><Loader size={32} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--accent)' }}/></div>
          ) : inpatientRxQueue.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 70, background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Pill size={32} color="var(--accent)" />
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>No Active Inpatient Prescriptions</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Ward doctor orders and MAR prescriptions will appear here in real time.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {inpatientRxQueue.map(rx => (
                <div key={rx.id} onClick={() => openRx(rx)}
                  style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', padding: 20, cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>🛏️ {rx.patient_name}</span>
                        <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 6 }}>{rx.patient_number}</span>
                        <span style={{ fontSize: 11, background: 'var(--accent)20', color: 'var(--accent)', padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>
                          🏥 {rx.ward_name || 'Ward'} • Bed {rx.bed_number || 'N/A'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rx.gender} • Prescribing Doctor: Dr. {rx.doctor_name || 'Attending'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'var(--accent)20', color: 'var(--accent)', fontWeight: 800 }}>WARD DISPENSE READY</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(rx.prescriptions || []).map((p, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 10, fontSize: 13 }}>
                        <div>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.drug_name}</span>
                          {p.dosage && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{p.dosage} • {p.route || 'IV'} • {p.frequency} • {p.duration}</span>}
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 800 }}>Qty: {p.quantity || 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)', padding: 18, marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Search Patient / Drug</label>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}/>
                  <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchHistory()}
                    placeholder="Patient name, MRN, or drug name..."
                    style={{ width: '100%', padding: '10px 14px 10px 38px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}/>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>From Date</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}/>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>To Date</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}/>
              </div>
              <button onClick={fetchHistory} style={{ padding: '10px 22px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#0F1612', fontWeight: 800, cursor: 'pointer', fontSize: 13, height: 42 }}>
                Search Audit Log
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Quick Filter:</span>
              <button onClick={() => { setDateFrom(today); setDateTo(today); }} style={{ padding: '4px 10px', background: dateFrom === today && dateTo === today ? 'var(--accent-soft)' : 'var(--bg-elevated)', border: `1px solid ${dateFrom === today && dateTo === today ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, color: dateFrom === today && dateTo === today ? 'var(--accent)' : 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Today</button>
              <button onClick={() => { setDateFrom('2026-01-01'); setDateTo(today); }} style={{ padding: '4px 10px', background: dateFrom === '2026-01-01' ? 'var(--accent-soft)' : 'var(--bg-elevated)', border: `1px solid ${dateFrom === '2026-01-01' ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, color: dateFrom === '2026-01-01' ? 'var(--accent)' : 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Year to Date (Jan - Today)</button>
              <button onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ padding: '4px 10px', background: !dateFrom && !dateTo ? 'var(--accent-soft)' : 'var(--bg-elevated)', border: `1px solid ${!dateFrom && !dateTo ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, color: !dateFrom && !dateTo ? 'var(--accent)' : 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>All History Log</button>
            </div>
          </div>

          {histLoading ? (
            <div style={{ textAlign: 'center', padding: 70 }}><Loader size={30} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--accent)' }}/></div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 70, background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>No dispensed records found for selected period.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.map((p, i) => (
                <div key={i} style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)', padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{p.patient_name}</span>
                        <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 6 }}>{p.patient_number}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Dr. {p.doctor_name} • Visit: {p.visit_number}</div>
                      {p.diagnosis && <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 2, fontWeight: 700 }}>Dx: {p.diagnosis}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'var(--accent)20', color: 'var(--accent)', fontWeight: 800 }}>✅ DISPENSED</span>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{new Date(p.dispensed_at).toLocaleString('en-KE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                      {p.dispensed_by_name && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>Pharm: {p.dispensed_by_name}</div>}
                    </div>
                  </div>
                  <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 10, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.drug_name}</span>
                      {p.dosage && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{p.dosage} • {p.frequency} • {p.duration}</span>}
                    </div>
                    <span style={{ color: 'var(--accent)', fontWeight: 800 }}>Qty: {p.quantity || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Dispense Modal */}
      {selectedRx && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 20, border: '1px solid var(--border)', width: '100%', maxWidth: 620, maxHeight: '90vh', overflow: 'auto', padding: 28, boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>💊 {selectedRx.patient_name}</h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>MRN: {selectedRx.patient_number} • Dr. {selectedRx.doctor_name}</p>
                {selectedRx.diagnosis && <p style={{ fontSize: 13, color: 'var(--accent)', marginTop: 4, fontWeight: 700 }}>Diagnosis: {selectedRx.diagnosis}</p>}
              </div>
              <button onClick={() => { setSelectedRx(null); setRxPayment(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}><X size={22}/></button>
            </div>
            {selectedRx.allergies && (
              <div style={{ padding: '10px 14px', background: 'var(--danger)15', borderRadius: 10, marginBottom: 18, fontSize: 12, color: 'var(--danger)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldAlert size={16} /> Allergies Alert: {selectedRx.allergies}
              </div>
            )}
            {rxPayment && (
              <div style={{ padding: '14px 18px', borderRadius: 12, marginBottom: 20, background: rxPayment.paid ? 'var(--accent)15' : 'var(--danger)15', border: '1px solid ' + (rxPayment.paid ? 'var(--accent)' : 'var(--danger)') }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: rxPayment.paid ? 'var(--accent)' : 'var(--danger)', fontSize: 14 }}>
                      {rxPayment.paid ? '✅ PAID & CLEARED' : '❌ UNPAID — KES ' + (rxPayment.balance || 0)}
                    </div>
                    {!rxPayment.paid && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Direct billing settlement from counter:</div>}
                  </div>
                  {!rxPayment.paid && (
                    <button onClick={() => handleQuickPay(selectedRx.id)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#0F1612', fontWeight: 800, fontSize: 12, cursor: 'pointer', boxShadow: '0 2px 8px var(--accent)40' }}>
                      💳 Counter Settlement
                    </button>
                  )}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(selectedRx.prescriptions || []).map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, marginRight: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{p.drug_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      {p.dosage && <span>{p.dosage} • </span>}
                      {p.frequency && <span>{p.frequency} • </span>}
                      {p.duration && <span>{p.duration}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: ['IV','IM','SC'].includes(p.route) ? 'var(--danger)20' : 'var(--accent)15', color: ['IV','IM','SC'].includes(p.route) ? 'var(--danger)' : 'var(--accent)', fontWeight: 700 }}>{p.route || 'Oral'}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>Qty: {p.quantity || 1}</span>
                    <button onClick={async () => {
                      try {
                        await api.put('/pharmacy/dispense/' + p.id, { status: 'dispensed' });
                        toast.success('Dispensed: ' + p.drug_name);
                        if (['IV','IM','SC'].includes(p.route)) {
                          toast('Injectable route — send patient to Injection Room', { icon: '💉' });
                        }
                        const remaining = (selectedRx.prescriptions || []).filter(item => item.id !== p.id);
                        if (remaining.length === 0) {
                          setSelectedRx(null);
                          setRxPayment(null);
                        } else {
                          setSelectedRx(prev => ({ ...prev, prescriptions: remaining }));
                        }
                        fetchRxQueue();
                      } catch (err) { toast.error(err.response?.data?.message || 'Failed to dispense drug'); }
                    }} disabled={!rxPayment?.paid}
                      style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: rxPayment?.paid ? 'var(--accent)' : 'var(--bg-surface)', color: rxPayment?.paid ? '#0F1612' : 'var(--text-faint)', fontWeight: 800, cursor: rxPayment?.paid ? 'pointer' : 'not-allowed', fontSize: 13 }}>
                      Dispense
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => { setSelectedRx(null); setRxPayment(null); }}
              style={{ marginTop: 20, width: '100%', padding: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
              Close
            </button>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
