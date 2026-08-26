import { useState, useRef, useEffect } from 'react';
import { Search, Loader, X } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://pharmacy-pos-backend-wf0t.onrender.com';

export default function DiagnosisSearch({ value, onChange }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = async (term) => {
    if (!term || term.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/icd11/search?term=${encodeURIComponent(term)}`);
      const data = await res.json();
      setResults(data);
      setOpen(data.length > 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (!val) { onChange(null); }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 350);
  };

  const handleSelect = (item) => {
    setQuery(`${item.code} — ${item.name}`);
    setOpen(false);
    onChange(item);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    onChange(null);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>
        Diagnosis / Indication
        <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--accent)20', color: 'var(--accent)', fontWeight: 700 }}>ICD-11 (DHA)</span>
        <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--text-faint)' }}>(optional)</span>
      </div>
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        {loading && <Loader size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />}
        {!loading && query && <X size={13} onClick={handleClear} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer' }} />}
        <input
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="e.g. fever, pain, cough..."
          style={{ width: '100%', padding: '9px 32px', background: 'var(--bg-elevated)', border: `1px solid ${value ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>
      {value && (
        <div style={{ marginTop: 5, fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{value.code}</span>
          <span style={{ color: 'var(--text-muted)' }}>{value.name}</span>
        </div>
      )}
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, marginTop: 4, boxShadow: '0 8px 24px #00000040', overflow: 'hidden' }}>
          {results.map((item) => (
            <div key={item.code} onClick={() => handleSelect(item)}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace', flexShrink: 0, minWidth: 65 }}>{item.code}</span>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>{item.name}</span>
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }`}</style>
    </div>
  );
}
