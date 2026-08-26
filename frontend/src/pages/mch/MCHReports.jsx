import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FileText, ArrowLeft, Download, Eye, Printer } from 'lucide-react';

const inp = { width:'100%', padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' };
const lbl = { fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5, fontWeight:600 };
const Card = ({ children, style={}, ...p }) => <div style={{ background:'var(--bg-surface)', borderRadius:14, border:'1px solid var(--border)', ...style }} {...p}>{children}</div>;
const Btn = ({ children, variant='primary', size='md', ...p }) => (
  <button {...p} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:size==='sm'?'6px 13px':'10px 20px',
    background:variant==='primary'?'var(--accent)':variant==='danger'?'#ef4444':'var(--bg-elevated)',
    border:variant==='ghost'?'1px solid var(--border)':'none', borderRadius:9,
    color:variant==='primary'?'#0F1612':variant==='danger'?'#fff':'var(--text-primary)',
    fontSize:size==='sm'?11:13, fontWeight:600, cursor:p.disabled?'not-allowed':'pointer',
    opacity:p.disabled?0.6:1, fontFamily:'DM Sans, sans-serif', ...p.style }}>{children}</button>
);

const REPORTS = [
  { id:'510', moh:'MOH 510', title:'ANC Register', endpoint:'moh-510-anc', color:'#ec4899', icon:'🤰', desc:'Antenatal care attendance register' },
  { id:'511', moh:'MOH 511', title:'PNC Register', endpoint:'moh-511-pnc', color:'#8b5cf6', icon:'🤱', desc:'Postnatal care register' },
  { id:'512', moh:'MOH 512', title:'CWC Register', endpoint:'moh-512-cwc', color:'#06b6d4', icon:'👶', desc:'Child welfare clinic growth register' },
  { id:'513', moh:'MOH 513', title:'Immunization Register', endpoint:'moh-513-immunization', color:'#f59e0b', icon:'💉', desc:'Vaccination register per KEPI schedule' },
  { id:'514', moh:'MOH 514', title:'Family Planning Register', endpoint:'moh-514-family-planning', color:'#10b981', icon:'🌸', desc:'FP new acceptors and revisits' },
  { id:'515', moh:'MOH 515', title:'Delivery Register', endpoint:'moh-515-delivery', color:'#ef4444', icon:'🍼', desc:'Labour & delivery outcomes' },
  { id:'summary', moh:'Summary', title:'MCH Monthly Summary', endpoint:'mch-monthly-summary', color:'#a855f7', icon:'📊', desc:'Aggregate monthly statistics' },
];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function MCHReports() {
  const navigate = useNavigate();
  const [active, setActive] = useState('510');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState('');

  const rep = REPORTS.find(r=>r.id===active) || REPORTS[0];

  const fetchReport = async () => {
    setLoading(true);
    setData(null);
    try {
      const { data: res } = await api.get('/mch/reports/'+rep.endpoint+'?month='+month+'&year='+year);
      setData(res.data);
      toast.success('Report loaded — '+((res.data?.data||res.data||[]).length||0)+' records');
    } catch { toast.error('Failed to load report'); }
    setLoading(false);
  };

  const downloadReport = async fmt => {
    setDownloading(fmt);
    try {
      const resp = await api.get('/mch/reports/'+rep.endpoint+'?month='+month+'&year='+year+'&format='+fmt, { responseType:'blob' });
      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `${rep.moh}_${rep.title}_${MONTHS[month-1]}_${year}.${fmt==='excel'?'xlsx':'pdf'}`;
      a.click();
      toast.success(fmt.toUpperCase()+' downloaded');
    } catch { toast.error('Download failed'); }
    setDownloading('');
  };

  const handlePrintRegister = () => {
    if (!rows.length) return;
    const win = window.open('', '_blank');
    
    const facilityName = 'HEKIMA MEDICAL CENTRE';
    const facilityAddress = 'P.O. Box 1234, Nairobi';

    win.document.write(`
      <html>
        <head>
          <title>${rep.moh} Register - ${MONTHS[month-1]} ${year}</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 10px; margin: 15px; color: #000; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 8px; }
            .title { font-size: 14px; font-weight: bold; margin-bottom: 4px; text-transform: uppercase; }
            .sub { font-size: 11px; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #444; padding: 4px 6px; text-align: left; }
            th { background: #f2f2f2; font-weight: bold; text-transform: uppercase; font-size: 9px; white-space: nowrap; }
            tr:nth-child(even) { background-color: #fafafa; }
            @media print {
              @page { size: A3 landscape; margin: 10mm; }
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${facilityName}</div>
            <div class="sub">${facilityAddress}</div>
            <div style="font-size: 12px; font-weight: bold; margin-top: 8px; color: #1a4a8a;">
              MINISTRY OF HEALTH REGISTER - ${rep.moh} (${rep.title})
            </div>
            <div style="font-size: 10px; font-weight: bold; margin-top: 4px;">
              MONTH: ${MONTHS[month-1].toUpperCase()} ${year} | TOTAL RECORDS: ${rows.length}
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                ${cols.map(c => `<th>${c.replace(/_/g, ' ').toUpperCase()}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${rows.map((row, idx) => `
                <tr>
                  <td><strong>${idx + 1}</strong></td>
                  ${cols.map(c => {
                    const val = row[c];
                    const disp = val !== null && val !== undefined
                      ? (String(val).match(/^\d{4}-\d{2}-\d{2}/)
                          ? new Date(val).toLocaleDateString('en-KE')
                          : String(val))
                      : '—';
                    return `<td>${disp}</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px;">
            <div>Printed on: ${new Date().toLocaleString('en-KE')}</div>
            <div style="border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 4px; margin-top: 15px;">
              Officer Signature & Stamp
            </div>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  const cols = rows.length > 0 ? Object.keys(rows[0]).filter(k=>!['id','pharmacy_id','created_at','updated_at'].includes(k)) : [];

  return (
    <div style={{ padding:28, height:'100vh', overflow:'auto' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <button onClick={()=>navigate('/app/mch')} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><ArrowLeft size={20}/></button>
        <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', margin:0, display:'flex', alignItems:'center', gap:9 }}><FileText size={22} color="var(--accent)"/> MOH Reports</h1>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:24 }}>

        {/* Sidebar */}
        <div>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'0.5px', marginBottom:10, padding:'0 4px' }}>SELECT REGISTER</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:20 }}>
            {REPORTS.map(r=>(
              <button key={r.id} onClick={()=>{ setActive(r.id); setData(null); }} style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:11,
                border:'1px solid', borderColor:active===r.id?r.color:'var(--border)',
                background:active===r.id?`${r.color}12`:'var(--bg-surface)',
                cursor:'pointer', textAlign:'left', transition:'all 0.15s', width:'100%'
              }}>
                <span style={{ fontSize:18 }}>{r.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:active===r.id?r.color:'var(--text-primary)' }}>{r.moh}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>{r.title}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main */}
        <div>
          <Card style={{ padding:20, marginBottom:18 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <span style={{ fontSize:22 }}>{rep.icon}</span>
              <div>
                <h2 style={{ fontSize:16, fontWeight:800, color:'var(--text-primary)', margin:0 }}>{rep.moh} — {rep.title}</h2>
                <p style={{ fontSize:12, color:'var(--text-muted)', margin:0 }}>{rep.desc}</p>
              </div>
            </div>
            <div style={{ display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap' }}>
              <div>
                <label style={lbl}>Month</label>
                <select value={month} onChange={e=>setMonth(Number(e.target.value))} style={{ ...inp, width:140 }}>
                  {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Year</label>
                <select value={year} onChange={e=>setYear(Number(e.target.value))} style={{ ...inp, width:100 }}>
                  {[2023,2024,2025,2026].map(y=><option key={y}>{y}</option>)}
                </select>
              </div>
              <Btn onClick={fetchReport} disabled={loading}><Eye size={13}/> {loading?'Loading...':'Preview'}</Btn>
              <Btn variant="ghost" onClick={handlePrintRegister} disabled={loading || !rows.length}><Printer size={13}/> Print</Btn>
              <Btn variant="ghost" onClick={()=>downloadReport('excel')} disabled={!!downloading}><Download size={13}/> {downloading==='excel'?'Downloading...':'Excel'}</Btn>
              <Btn variant="ghost" onClick={()=>downloadReport('pdf')} disabled={!!downloading}><Download size={13}/> {downloading==='pdf'?'Downloading...':'PDF'}</Btn>
            </div>
          </Card>

          {loading && <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}>Loading report data...</div>}

          {!loading && data && rows.length === 0 && (
            <Card style={{ textAlign:'center', padding:60 }}>
              <FileText size={42} color="var(--text-faint)" style={{ marginBottom:12 }}/>
              <p style={{ color:'var(--text-muted)', fontWeight:600 }}>No records for {MONTHS[month-1]} {year}</p>
            </Card>
          )}

          {!loading && rows.length > 0 && (
            <Card style={{ overflow:'auto' }}>
              <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>{rep.moh} — {MONTHS[month-1]} {year}</span>
                <span style={{ fontSize:12, color:'var(--text-muted)' }}>{rows.length} records</span>
              </div>
              <div style={{ overflow:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr style={{ background:'var(--bg-elevated)' }}>
                      <th style={{ padding:'10px 12px', textAlign:'left', color:'var(--text-muted)', fontWeight:700, fontSize:11, whiteSpace:'nowrap', borderBottom:'1px solid var(--border)' }}>#</th>
                      {cols.map(c=>(
                        <th key={c} style={{ padding:'10px 12px', textAlign:'left', color:'var(--text-muted)', fontWeight:700, fontSize:11, whiteSpace:'nowrap', borderBottom:'1px solid var(--border)' }}>
                          {c.replace(/_/g,' ').toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row,i)=>(
                      <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}
                        onMouseEnter={e=>e.currentTarget.style.background='var(--bg-elevated)'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{ padding:'10px 12px', color:'var(--text-muted)', fontWeight:600 }}>{i+1}</td>
                        {cols.map(c=>(
                          <td key={c} style={{ padding:'10px 12px', color:'var(--text-primary)', whiteSpace:'nowrap' }}>
                            {row[c] !== null && row[c] !== undefined
                              ? (String(row[c]).match(/^\d{4}-\d{2}-\d{2}/)
                                  ? new Date(row[c]).toLocaleDateString('en-KE')
                                  : String(row[c]))
                              : <span style={{ color:'var(--text-faint)' }}>—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {!loading && !data && (
            <Card style={{ textAlign:'center', padding:64, border:'2px dashed var(--border)' }}>
              <FileText size={44} color="var(--text-faint)" style={{ marginBottom:14 }}/>
              <p style={{ color:'var(--text-muted)', fontSize:14, fontWeight:600 }}>Select month & year, then click Preview</p>
              <p style={{ color:'var(--text-faint)', fontSize:12, marginTop:4 }}>All MOH registers (510–515) are available for preview and export</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
