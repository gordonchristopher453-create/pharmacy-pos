import { useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function ProfitReportPage() {
  const [dates, setDates] = useState({ from: '', to: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    if (!dates.from || !dates.to) return toast.error('Select date range');
    setLoading(true);
    try {
      const res = await api.get('/reports/profit', { params: dates });
      setData(res.data.data);
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>💰 Profit Report</h1>
      <div style={{ display: 'flex', gap: 10, margin: '20px 0' }}>
        <input type="date" value={dates.from} onChange={e => setDates({...dates, from: e.target.value})} />
        <span>to</span>
        <input type="date" value={dates.to} onChange={e => setDates({...dates, to: e.target.value})} />
        <button onClick={fetchReport} disabled={loading}>
          {loading ? 'Loading...' : 'Generate Report'}
        </button>
      </div>
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
          <Card title="Revenue" value={`KES ${data.revenue.toLocaleString()}`} color="#10b981" />
          <Card title="Expenses" value={`KES ${data.expenses.toLocaleString()}`} color="#ef4444" />
          <Card title="Profit" value={`KES ${data.profit.toLocaleString()}`} color={data.profit >= 0 ? '#3b82f6' : '#ef4444'} />
        </div>
      )}
    </div>
  );
}

const Card = ({ title, value, color }) => (
  <div style={{ padding: 20, background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)' }}>
    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{title}</div>
    <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
  </div>
);
