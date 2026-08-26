import { useState, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Upload, X, Loader, CheckCircle, Camera, FileText, Plus, AlertCircle, Package, Edit2 } from 'lucide-react';

export default function AIScanner({ type = 'products', onImport, onClose }) {
  const [files, setFiles] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [results, setResults] = useState([]);
  const [importing, setImporting] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const fileInputRef = useRef();
  const imageInputRef = useRef();

  const handleFiles = (e) => {
    const newFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...newFiles].slice(0, 10));
  };

  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));
  const removeItem = (i) => setResults(prev => prev.filter((_, idx) => idx !== i));

  const updateItem = (i, field, value) => {
    setResults(prev => prev.map((item, idx) =>
      idx === i ? { ...item, [field]: value } : item
    ));
  };

  const handleScan = async () => {
    if (files.length === 0) return toast.error('Select files first');
    setScanning(true);
    setScanProgress('Uploading files...');
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files', f));
      formData.append('type', type);

      // Check if any file is a PDF with multiple pages
      const hasPDF = files.some(f => f.name.toLowerCase().endsWith('.pdf'));
      if (hasPDF) setScanProgress('Scanning PDF pages... this may take a moment');

      const { data } = await api.post('/ai/scan-invoice', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000 // 5 min timeout for large PDFs
      });

      setResults(data.data.items || []);
      if (data.data.items.length === 0) {
        toast.error('No items found. Try a clearer image or different file.');
      } else {
        toast.success(`✅ Extracted ${data.data.items.length} items!`);
      }
    } catch (e) {
      toast.error('Scan failed: ' + (e.response?.data?.message || e.message));
    }
    setScanning(false);
    setScanProgress('');
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      await api.post('/ai/bulk-import', { items: results, type });
      toast.success(`🎉 Imported ${results.length} items successfully!`);
      onImport?.();
      onClose?.();
    } catch (e) {
      toast.error('Import failed: ' + (e.response?.data?.message || e.message));
    }
    setImporting(false);
  };

  const totalValue = results.reduce((sum, item) =>
    sum + (parseFloat(item.buying_price) || 0) * (parseInt(item.quantity) || 1), 0
  );

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'var(--bg-surface)', borderRadius:16, border:'1px solid var(--border)', width:'100%', maxWidth:750, maxHeight:'92vh', overflow:'auto', padding:24 }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div>
            <h2 style={{ fontSize:18, fontWeight:700, display:'flex', alignItems:'center', gap:8 }}>
              <Camera size={20} color="var(--accent)" />
              AI Invoice Scanner
            </h2>
            <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>
              Upload an image or PDF — items will be extracted automatically
            </p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:4 }}>
            <X size={20}/>
          </button>
        </div>

        {/* Upload Area - only show if no results yet */}
        {results.length === 0 && (
          <>
            {/* Two upload buttons */}
            <div style={{ display:'flex', gap:10, marginBottom:16 }}>
              <button onClick={() => imageInputRef.current?.click()}
                style={{ flex:1, padding:'14px', borderRadius:10, border:'2px dashed var(--border)', background:'var(--bg-elevated)', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:6, transition:'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                <Camera size={24} color="var(--accent)" />
                <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>Upload Image</span>
                <span style={{ fontSize:11, color:'var(--text-muted)' }}>JPG, PNG, WEBP</span>
              </button>

              <button onClick={() => fileInputRef.current?.click()}
                style={{ flex:1, padding:'14px', borderRadius:10, border:'2px dashed var(--border)', background:'var(--bg-elevated)', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:6, transition:'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                <FileText size={24} color="var(--accent)" />
                <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>Upload PDF</span>
                <span style={{ fontSize:11, color:'var(--text-muted)' }}>All pages scanned</span>
              </button>

              <input ref={imageInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp" onChange={handleFiles} style={{ display:'none' }} />
              <input ref={fileInputRef} type="file" multiple accept=".pdf" onChange={handleFiles} style={{ display:'none' }} />
            </div>

            {/* PDF note */}
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'rgba(var(--accent-rgb),0.08)', borderRadius:8, marginBottom:16, fontSize:12, color:'var(--text-muted)' }}>
              <AlertCircle size={14} color="var(--accent)" />
              <span>PDF files will have all pages scanned automatically. Large PDFs may take 1-2 minutes.</span>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)', marginBottom:8 }}>
                  {files.length} file(s) ready to scan
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', background:'var(--bg-elevated)', borderRadius:8, fontSize:12, border:'1px solid var(--border)' }}>
                      {f.name.endsWith('.pdf') ? <FileText size={14} color="var(--accent)" /> : <Camera size={14} color="var(--accent)" />}
                      <span style={{ maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</span>
                      <span style={{ color:'var(--text-faint)', fontSize:10 }}>({(f.size/1024).toFixed(0)}KB)</span>
                      <button onClick={() => removeFile(i)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0 }}><X size={12}/></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scanning progress */}
            {scanning && (
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'var(--bg-elevated)', borderRadius:10, marginBottom:16 }}>
                <Loader size={18} color="var(--accent)" style={{ animation:'spin 0.8s linear infinite', flexShrink:0 }} />
                <div>
                  <div style={{ fontSize:13, fontWeight:600 }}>Scanning in progress...</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{scanProgress}</div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div style={{ marginBottom:16 }}>
            {/* Summary bar */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'rgba(var(--accent-rgb),0.08)', borderRadius:10, marginBottom:12, border:'1px solid rgba(var(--accent-rgb),0.2)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <CheckCircle size={16} color="var(--accent)" />
                <span style={{ fontSize:13, fontWeight:700, color:'var(--accent)' }}>{results.length} items extracted</span>
              </div>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                Total value: <span style={{ fontWeight:700, color:'var(--text-primary)' }}>KES {totalValue.toLocaleString()}</span>
              </div>
            </div>

            {/* Table header */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 90px 90px 32px', gap:8, padding:'6px 10px', fontSize:11, fontWeight:600, color:'var(--text-muted)', borderBottom:'1px solid var(--border)', marginBottom:4 }}>
              <span>PRODUCT NAME</span>
              <span>QTY</span>
              <span>BUY PRICE</span>
              <span>SELL PRICE</span>
              <span></span>
            </div>

            {/* Items list */}
            <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:320, overflow:'auto' }}>
              {results.map((item, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 80px 90px 90px 32px', gap:8, padding:'8px 10px', background:'var(--bg-elevated)', borderRadius:8, alignItems:'center', fontSize:12 }}>
                  {editIndex === i ? (
                    <>
                      <input value={item.name} onChange={e => updateItem(i, 'name', e.target.value)}
                        style={{ background:'var(--bg-surface)', border:'1px solid var(--accent)', borderRadius:6, padding:'3px 6px', color:'var(--text-primary)', fontSize:12 }} />
                      <input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)}
                        style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:6, padding:'3px 6px', color:'var(--text-primary)', fontSize:12 }} />
                      <input type="number" value={item.buying_price} onChange={e => updateItem(i, 'buying_price', e.target.value)}
                        style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:6, padding:'3px 6px', color:'var(--text-primary)', fontSize:12 }} />
                      <input type="number" value={item.selling_price} onChange={e => updateItem(i, 'selling_price', e.target.value)}
                        style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:6, padding:'3px 6px', color:'var(--text-primary)', fontSize:12 }} />
                    </>
                  ) : (
                    <>
                      <div>
                        <span style={{ fontWeight:600 }}>{item.name}</span>
                        {item.expiry_date && <span style={{ fontSize:10, color:'var(--warning)', marginLeft:6 }}>Exp:{item.expiry_date}</span>}
                      </div>
                      <span style={{ color:'var(--text-muted)' }}>x{item.quantity || 1}</span>
                      <span style={{ color:'var(--text-primary)' }}>KES {item.buying_price}</span>
                      <span style={{ color:'var(--accent)', fontWeight:600 }}>KES {item.selling_price}</span>
                    </>
                  )}
                  <div style={{ display:'flex', gap:4 }}>
                    <button onClick={() => setEditIndex(editIndex === i ? null : i)}
                      style={{ background:'none', border:'none', cursor:'pointer', color: editIndex === i ? 'var(--accent)' : 'var(--text-faint)', padding:2 }}>
                      <Edit2 size={12}/>
                    </button>
                    <button onClick={() => removeItem(i)}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-faint)', padding:2 }}>
                      <X size={12}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', paddingTop:12, borderTop:'1px solid var(--border)' }}>
          {results.length === 0 ? (
            <>
              <button onClick={onClose}
                style={{ padding:'9px 18px', borderRadius:8, background:'var(--bg-elevated)', border:'1px solid var(--border)', color:'var(--text-muted)', cursor:'pointer', fontSize:13 }}>
                Cancel
              </button>
              <button onClick={handleScan} disabled={files.length === 0 || scanning}
                style={{ padding:'10px 24px', borderRadius:8, border:'none', background: files.length > 0 && !scanning ? 'var(--accent)' : 'var(--bg-elevated)', color: files.length > 0 && !scanning ? '#0F1612' : 'var(--text-faint)', fontWeight:600, cursor: files.length > 0 && !scanning ? 'pointer' : 'not-allowed', fontSize:14, display:'flex', alignItems:'center', gap:6 }}>
                {scanning ? <Loader size={16} style={{ animation:'spin 0.8s linear infinite' }} /> : <Camera size={16} />}
                {scanning ? 'Scanning...' : 'Scan Now'}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setResults([]); setFiles([]); setEditIndex(null); }}
                style={{ padding:'9px 18px', borderRadius:8, background:'var(--bg-elevated)', border:'1px solid var(--border)', color:'var(--text-muted)', cursor:'pointer', fontSize:13 }}>
                Scan Again
              </button>
              <button onClick={handleImport} disabled={importing}
                style={{ padding:'10px 24px', borderRadius:8, border:'none', background:'var(--accent)', color:'#0F1612', fontWeight:600, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', gap:6 }}>
                {importing ? <Loader size={16} style={{ animation:'spin 0.8s linear infinite' }} /> : <Package size={16} />}
                {importing ? 'Importing...' : `Add ${results.length} Items to Stock`}
              </button>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
