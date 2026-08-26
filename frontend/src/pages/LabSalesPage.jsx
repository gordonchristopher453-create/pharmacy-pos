import { useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function LabSalesPage() {
  const [dates, setDates] = useState({ from: '', to: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    if (!dates.from || !dates.to) return toast.error('Select date range');
    setLoading(true);
    try {
      const res = await api.get('/reports/lab-sales', { params: dates });
      setData(res.data.data);
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>🔬 Lab Sales Summary</h1>
      <div style={{ display: 'flex', gap: 10, margin: '20px 0' }}>
        <input type="date" value={dates.from} onChange={e => setDates({...dates, from: e.target.value})} />
        <span>to</span>
        <input type="date" value={dates.to} onChange={e => setDates({...dates, to: e.target.value})} />
        <button onClick={fetchReport} disabled={loading}>
          {loading ? 'Loading...' : 'Generate Report'}
        </button>
      </div>
      {data && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>Test Name</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Count</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total (KES)</th>
            </tr>
          </thead>
          <tbody>
            {data.breakdown.map((item, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{item.test_name}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>{item.count}</td>
                <td style={{ padding: '12px 16px', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                  KES {parseFloat(item.total).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
