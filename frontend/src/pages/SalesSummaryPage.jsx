import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Calendar, DollarSign, TrendingUp, Package, Search, Printer, Filter, ShoppingBag, CreditCard, ShieldCheck, PieChart, RefreshCw, Loader } from 'lucide-react';

export default function SalesSummaryPage() {
  const todayStr = new Date().toISOString().split('T')[0];
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0];

  const [dates, setDates] = useState({ from: thirtyDaysAgoStr, to: todayStr });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('drugs'); // 'drugs' | 'categories'

  const fetchReport = async (range) => {
    const queryDates = range || dates;
    if (!queryDates.from || !queryDates.to) return toast.error('Please select both start and end dates');
    setLoading(true);
    try {
      const res = await api.get('/reports/drug-sales', {
        params: { date_from: queryDates.from, date_to: queryDates.to }
      });
      setData(res.data.data);
    } catch (e) {
      toast.error('Failed to load sales report: ' + (e.response?.data?.message || e.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handlePreset = (days) => {
    let fromDate = new Date();
    if (days === 0) {
      // today
    } else if (days === 1) {
      fromDate.setDate(fromDate.getDate() - 1);
    } else {
      fromDate.setDate(fromDate.getDate() - days);
    }
    const from = fromDate.toISOString().split('T')[0];
    const to = todayStr;
    const newDates = { from, to };
    setDates(newDates);
    fetchReport(newDates);
  };

  const metrics = data?.metrics || {};
  const rxMetrics = data?.prescription_metrics || {};
  const items = data?.items || [];
  const categories = data?.categories || [];

  const filteredItems = items.filter(item =>
    item.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.generic_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalRevenue = parseFloat(metrics.total_revenue || 0) + parseFloat(rxMetrics.total_rx_collected || 0);
  const totalProfit = parseFloat(metrics.estimated_profit || 0);

  return (
    <div style={{ padding: 24, minHeight: '100vh', overflow: 'auto', background: 'var(--bg-main)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            Pharmacy Drug Sales & Revenue Summary
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            Comprehensive performance report for direct over-the-counter sales & doctor prescriptions
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <Printer size={15} /> Print Summary
          </button>
          <button onClick={() => fetchReport()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#0F1612', cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 2px 8px rgba(16,185,129,0.25)' }}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div style={{ background: 'var(--bg-surface)', padding: '16px 20px', borderRadius: 14, border: '1px solid var(--border)', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={16} color="var(--accent)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>From:</span>
            <input type="date" value={dates.from} onChange={e => setDates({ ...dates, from: e.target.value })} style={{ padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>To:</span>
            <input type="date" value={dates.to} onChange={e => setDates({ ...dates, to: e.target.value })} style={{ padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
          </div>
          <button onClick={() => fetchReport()} disabled={loading} style={{ padding: '8px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {loading ? 'Generating...' : 'Apply Dates'}
          </button>
        </div>

        {/* Quick Date Presets */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => handlePreset(0)} style={{ padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Today</button>
          <button onClick={() => handlePreset(7)} style={{ padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>7 Days</button>
          <button onClick={() => handlePreset(30)} style={{ padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>30 Days</button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'var(--bg-surface)', padding: '18px 20px', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Combined Drug Revenue</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={18} color="var(--accent)" />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.5px' }}>
            KES {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            POS (KES {parseFloat(metrics.total_revenue || 0).toLocaleString()}) + OPD Rx (KES {parseFloat(rxMetrics.total_rx_collected || 0).toLocaleString()})
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: '18px 20px', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Estimated Gross Profit</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={18} color="#6366f1" />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#6366f1', letterSpacing: '-0.5px' }}>
            KES {totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Based on stock acquisition vs selling margin
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: '18px 20px', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Units Dispensed</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={18} color="var(--warning)" />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
            {parseInt(metrics.total_units_sold || 0).toLocaleString()} Units
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Across {metrics.total_orders || 0} completed orders
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: '18px 20px', borderRadius: 14, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Prescription Orders</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(14,165,233,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={18} color="#0ea5e9" />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
            {parseInt(rxMetrics.rx_count || 0)} Billed Rx
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Collected: KES {parseFloat(rxMetrics.total_rx_collected || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Payment Channel Breakdown */}
      <div style={{ background: 'var(--bg-surface)', padding: '20px 24px', borderRadius: 14, border: '1px solid var(--border)', marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>
          POS Sales Payment Method Breakdown
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div style={{ background: 'var(--bg-elevated)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>💵 Cash Revenue</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
              KES {parseFloat(metrics.cash_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ background: 'var(--bg-elevated)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>📱 M-PESA Revenue</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', marginTop: 4 }}>
              KES {parseFloat(metrics.mpesa_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ background: 'var(--bg-elevated)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>💳 Card / Bank</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
              KES {parseFloat(metrics.card_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ background: 'var(--bg-elevated)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>🏥 Insurance Billed</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
              KES {parseFloat(metrics.insurance_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setActiveTab('drugs')} style={{ padding: '8px 18px', borderRadius: 9, background: activeTab === 'drugs' ? 'var(--accent)' : 'var(--bg-surface)', border: '1px solid var(--border)', color: activeTab === 'drugs' ? '#0F1612' : 'var(--text-muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Drug-by-Drug Performance ({items.length})
          </button>
          <button onClick={() => setActiveTab('categories')} style={{ padding: '8px 18px', borderRadius: 9, background: activeTab === 'categories' ? 'var(--accent)' : 'var(--bg-surface)', border: '1px solid var(--border)', color: activeTab === 'categories' ? '#0F1612' : 'var(--text-muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Category Distribution ({categories.length})
          </button>
        </div>

        {activeTab === 'drugs' && (
          <div style={{ position: 'relative', width: 280 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Filter drug report..." style={{ width: '100%', padding: '8px 12px 8px 36px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
          </div>
        )}
      </div>

      {/* Detailed Tables */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader size={28} color="var(--accent)" style={{ animation: 'spin 0.8s linear infinite' }} /></div>
      ) : activeTab === 'drugs' ? (
        <div style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                {['Drug Formulation', 'Category', 'Unit Cost', 'Selling Price', 'Units Sold', 'Total Revenue', 'Est. Profit'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: h.includes('Revenue') || h.includes('Profit') || h.includes('Units') || h.includes('Cost') || h.includes('Price') ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>No sales recorded for selected criteria</td></tr>
              ) : filteredItems.map((item) => (
                <tr key={item.product_id} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.product_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.generic_name || '—'} • {item.unit}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>{item.category_name || 'General'}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}><span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>KES {parseFloat(item.buying_price || 0).toFixed(2)}</span></td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}><span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>KES {parseFloat(item.selling_price || 0).toFixed(2)}</span></td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}><span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{item.units_sold} {item.unit}s</span></td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}><span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>KES {parseFloat(item.total_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}><span className="mono" style={{ fontSize: 13, fontWeight: 700, color: '#6366f1' }}>KES {parseFloat(item.profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                {['Drug Category', 'Unique Formulations', 'Total Units Sold', 'Category Revenue'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: h.includes('Revenue') || h.includes('Units') || h.includes('Unique') ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>No category data available</td></tr>
              ) : categories.map((cat, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{cat.category_name}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, color: 'var(--text-muted)' }}>{cat.unique_drugs} drugs</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}><span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{parseInt(cat.units_sold || 0).toLocaleString()}</span></td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}><span className="mono" style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>KES {parseFloat(cat.total_revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
