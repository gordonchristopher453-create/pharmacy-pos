import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { Search, X, UserRound, Phone, Calendar, Hash } from 'lucide-react';

export default function PatientSearch({ onSelect, placeholder='Search by name, phone, or patient number...' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef();
  const debounceRef = useRef();

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const searchPatients = async (q) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const { data } = await api.get(`/patients/search?q=${encodeURIComponent(q)}&limit=8`);
      setResults(data.data || []);
      setShowDropdown(true);
    } catch { setResults([]); }
    setLoading(false);
  };

  const handleChange = (e) => {
    setQuery(e.target.value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPatients(e.target.value), 300);
  };

  const handleSelect = (patient) => {
    setQuery(patient.full_name);
    setShowDropdown(false);
    onSelect?.(patient);
  };

  const getAge = (dob) => {
    if (!dob) return '';
    return Math.floor((Date.now() - new Date(dob)) / (365.25*24*60*60*1000)) + 'y';
  };

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <div style={{ position:'relative' }}>
        <Search size={16} style={{ position:'absolute', left:12, top:11, color:'var(--text-faint)' }} />
        <input value={query} onChange={handleChange} placeholder={placeholder}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          style={{ width:'100%', padding:'10px 36px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:10, color:'var(--text-primary)', fontSize:13, outline:'none', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' }} />
        {query && <X size={14} onClick={() => { setQuery(''); setResults([]); }} style={{ position:'absolute', right:10, top:12, color:'var(--text-faint)', cursor:'pointer' }} />}
      </div>

      {showDropdown && results.length > 0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:100, background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:10, marginTop:4, maxHeight:350, overflow:'auto', boxShadow:'0 8px 24px rgba(0,0,0,0.3)' }}>
          {results.map(p => (
            <div key={p.id} onClick={() => handleSelect(p)}
              style={{ padding:'12px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, transition:'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width:40, height:40, borderRadius:10, background:'var(--accent)18', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <UserRound size={18} color="var(--accent)" />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{p.full_name}</div>
                <div style={{ display:'flex', gap:10, fontSize:10, color:'var(--text-muted)', marginTop:3, flexWrap:'wrap' }}>
                  {p.patient_number && <span style={{ display:'flex', alignItems:'center', gap:3 }}><Hash size={9} /> {p.patient_number}</span>}
                  {p.phone && <span style={{ display:'flex', alignItems:'center', gap:3 }}><Phone size={9} /> {p.phone}</span>}
                  {p.date_of_birth && <span style={{ display:'flex', alignItems:'center', gap:3 }}><Calendar size={9} /> {getAge(p.date_of_birth)}</span>}
                </div>
              </div>
              <span style={{ fontSize:10, color:'var(--text-faint)' }}>{p.gender || ''}</span>
            </div>
          ))}
        </div>
      )}
      {showDropdown && query.length >= 2 && results.length === 0 && !loading && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:100, background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:10, marginTop:4, padding:20, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
          No patients found matching "{query}"
        </div>
      )}
    </div>
  );
}
