import { useState, useEffect, useRef } from 'react';
import { Search, Loader } from 'lucide-react';
import api from '../services/api';

const ENDPOINTS = {
  diagnosis: (term) => `/icd11/search?term=${encodeURIComponent(term)}`,
  procedure: (term) => `/procedures/kenya/search?term=${encodeURIComponent(term)}`,
  lab:       (term) => `/labs/kenya/search?term=${encodeURIComponent(term)}`,
  radiology: (term) => `/radiology/kenya/search?term=${encodeURIComponent(term)}`,
};

const TYPE_COLORS = {
  diagnosis: 'var(--accent)',
  procedure: '#a855f7',
  lab: '#f97316',
  radiology: '#a855f7',
};

const TYPE_LABELS = {
  diagnosis: 'ICD-11 (DHA)',
  procedure: 'Kenya DHA Code',
  lab: 'LOINC / Kenya DHA',
  radiology: 'Kenya DHA Radiology',
};

export default function ICD10Search({ onSelect, value, type = 'diagnosis', label, placeholder }) {
  const [query, setQuery] = useState(value || '');

  useEffect(() => { setQuery(value || ''); }, [value]);
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
      const res = await api.get(ENDPOINTS[type](term));
      const data = res.data;
      const items = data.map(d => ({ 
        code: d.code || '', 
        name: d.test_name || d.name || '',
        category: d.category || ''
      }));
      setResults(items);
      setOpen(items.length > 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 350);
  };

  const handleSelect = (item) => {
    setQuery(item.name); // show clean name only — code stored separately
    setOpen(false);
    onSelect({ name: item.name, code: item.code });
  };

  const color = TYPE_COLORS[type];
  const badge = TYPE_LABELS[type];

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      {label && (
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
          {label}
          <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 4, background: `${color}20`, color, fontWeight: 700 }}>
            {badge}
          </span>
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        {loading && (
          <Loader size={14} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color, animation: 'spin 0.8s linear infinite' }} />
        )}
        <input
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder || `Search ${type}...`}
          style={{ width: '100%', padding: '9px 36px', background: 'var(--bg-elevated)', border: `1px solid var(--border)`, borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }}
        />
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, marginTop: 4, boxShadow: '0 8px 24px #00000040', overflow: 'hidden' }}>
          {results.map((item, idx) => (
            <div key={idx}
              onClick={() => handleSelect(item)}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              style={{ padding: '11px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {item.code && (
                <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: 'monospace', flexShrink: 0, marginTop: 2, minWidth: 70 }}>{item.code}</span>
              )}
              <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>{item.name}</span>
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }`}</style>
    </div>
  );
}
