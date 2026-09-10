import { useSearchParams, useLocation } from 'react-router-dom';
import ResultRenderer from "../components/ResultRenderer";
import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api';
import toast from 'react-hot-toast';
import { FlaskConical, Search, RefreshCw, X, Loader, ChevronRight, CheckCircle, FileText, ArrowLeft, Plus, Trash2, Printer, Download, Calendar, Edit3, Clock, AlertTriangle, User, Activity } from 'lucide-react';
import { printLabResult } from '../utils/printLabResult';

const URGENCY_COLORS = { routine:'var(--text-muted)', urgent:'var(--warning)', emergency:'var(--danger)', stat:'var(--danger)' };
const STATUS_COLORS  = { pending:'var(--warning)', processing:'var(--info)', completed:'var(--accent)', cancelled:'var(--danger)' };
const STATUS_LABELS  = { pending:'Pending', processing:'Processing', completed:'Completed', cancelled:'Cancelled' };
const FLAG_COLORS    = { normal:'var(--accent)', high:'var(--danger)', low:'var(--info)', critical:'var(--danger)' };
const FLAG_LABELS    = { normal:'Normal', high:'HIGH ↑', low:'LOW ↓', critical:'CRITICAL ⚠' };
const TITRE_OPTIONS  = ['Negative', '1:20', '1:40', '1:80', '1:160', '1:320'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const getAge = dob => !dob ? '—' : Math.floor((Date.now()-new Date(dob))/(365.25*24*60*60*1000))+'y';

const TEMPLATES = {
  cbc3: {
    label: "CBC (3-Part Haemogram)",
    keywords: ["cbc3","3part","3-part","basic cbc","basic haemogram"],
    type: "table",
    autoFlag: true,
    sections: [
      { title: "WBC Differential (3-Part)", rows: [
        { param: "WBC", unit: "10³/µL", rangeMin: 4.0, rangeMax: 11.0 },
        { param: "Lymphocytes (LYM%)", unit: "%", rangeMin: 20, rangeMax: 40 },
        { param: "Lymphocytes Abs (LYM#)", unit: "10³/µL", rangeMin: 1.0, rangeMax: 4.0 },
        { param: "Granulocytes (GRA%)", unit: "%", rangeMin: 50, rangeMax: 70 },
        { param: "Granulocytes Abs (GRA#)", unit: "10³/µL", rangeMin: 1.8, rangeMax: 7.5 },
        { param: "Mid Cells (MID%)", unit: "%", rangeMin: 2, rangeMax: 10 },
        { param: "Mid Cells Abs (MID#)", unit: "10³/µL", rangeMin: 0.2, rangeMax: 1.5 },
      ]},
      { title: "RBC Indices", rows: [
        { param: "RBC", unit: "10⁶/µL", rangeMin: 4.2, rangeMax: 5.4 },
        { param: "HGB", unit: "g/dL", rangeMin: 12.0, rangeMax: 16.0 },
        { param: "HCT", unit: "%", rangeMin: 36, rangeMax: 46 },
        { param: "MCV", unit: "fL", rangeMin: 80, rangeMax: 100 },
        { param: "MCH", unit: "pg", rangeMin: 27, rangeMax: 33 },
        { param: "MCHC", unit: "g/dL", rangeMin: 32, rangeMax: 36 },
        { param: "RDW-CV", unit: "%", rangeMin: 11.5, rangeMax: 14.5 },
        { param: "RDW-SD", unit: "fL", rangeMin: 35, rangeMax: 56 },
      ]},
      { title: "Platelets", rows: [
        { param: "PLT", unit: "10³/µL", rangeMin: 150, rangeMax: 400 },
        { param: "MPV", unit: "fL", rangeMin: 7.5, rangeMax: 12.5 },
        { param: "PDW-CV", unit: "%", rangeMin: 10, rangeMax: 17 },
        { param: "PDW-SD", unit: "fL", rangeMin: 9, rangeMax: 17 },
        { param: "PCT", unit: "%", rangeMin: 0.10, rangeMax: 0.28 },
        { param: "P-LCR", unit: "%", rangeMin: 13, rangeMax: 43 },
      ]},
    ],
  },
  cbc5: {
    label: "CBC (5-Part Haemogram)",
    keywords: ["cbc5","5part","5-part","full cbc","full haemogram","cbc","haemogram","hemogram","full blood","blood count","complete blood"],
    type: "table",
    autoFlag: true,
    sections: [
      { title: "WBC Differential (5-Part)", rows: [
        { param: "WBC", unit: "10³/µL", rangeMin: 4.0, rangeMax: 11.0 },
        { param: "Neutrophils (NEU%)", unit: "%", rangeMin: 40, rangeMax: 75 },
        { param: "Neutrophils Abs (NEU#)", unit: "10³/µL", rangeMin: 2.0, rangeMax: 7.5 },
        { param: "Lymphocytes (LYM%)", unit: "%", rangeMin: 20, rangeMax: 40 },
        { param: "Lymphocytes Abs (LYM#)", unit: "10³/µL", rangeMin: 1.0, rangeMax: 4.0 },
        { param: "Monocytes (MON%)", unit: "%", rangeMin: 2, rangeMax: 10 },
        { param: "Monocytes Abs (MON#)", unit: "10³/µL", rangeMin: 0.2, rangeMax: 1.0 },
        { param: "Eosinophils (EOS%)", unit: "%", rangeMin: 1, rangeMax: 6 },
        { param: "Eosinophils Abs (EOS#)", unit: "10³/µL", rangeMin: 0.02, rangeMax: 0.5 },
        { param: "Basophils (BAS%)", unit: "%", rangeMin: 0, rangeMax: 2 },
        { param: "Basophils Abs (BAS#)", unit: "10³/µL", rangeMin: 0.0, rangeMax: 0.1 },
      ]},
      { title: "RBC Indices", rows: [
        { param: "RBC", unit: "10⁶/µL", rangeMin: 4.2, rangeMax: 5.4 },
        { param: "HGB", unit: "g/dL", rangeMin: 12.0, rangeMax: 16.0 },
        { param: "HCT", unit: "%", rangeMin: 36, rangeMax: 46 },
        { param: "MCV", unit: "fL", rangeMin: 80, rangeMax: 100 },
        { param: "MCH", unit: "pg", rangeMin: 27, rangeMax: 33 },
        { param: "MCHC", unit: "g/dL", rangeMin: 32, rangeMax: 36 },
        { param: "RDW-CV", unit: "%", rangeMin: 11.5, rangeMax: 14.5 },
        { param: "RDW-SD", unit: "fL", rangeMin: 35, rangeMax: 56 },
      ]},
      { title: "Platelets", rows: [
        { param: "PLT", unit: "10³/µL", rangeMin: 150, rangeMax: 400 },
        { param: "MPV", unit: "fL", rangeMin: 7.5, rangeMax: 12.5 },
        { param: "PDW-CV", unit: "%", rangeMin: 10, rangeMax: 17 },
        { param: "PDW-SD", unit: "fL", rangeMin: 9, rangeMax: 17 },
        { param: "PCT", unit: "%", rangeMin: 0.10, rangeMax: 0.28 },
        { param: "P-LCR", unit: "%", rangeMin: 13, rangeMax: 43 },
      ]},
    ],
  },
    uecs: {
    label: 'UECS',
    keywords: ['uecs','urea','electrolyte','renal function','kidney'],
    type: 'table',
    sections: [{ title: 'Urea, Electrolytes & Creatinine', rows: [
      { param: 'Urea', unit: 'mmol/L', range: '2.5 - 7.5' },
      { param: 'Creatinine', unit: 'µmol/L', range: '60 - 120' },
      { param: 'Sodium', unit: 'mmol/L', range: '136 - 145' },
      { param: 'Potassium', unit: 'mmol/L', range: '3.5 - 5.1' },
      { param: 'Chloride', unit: 'mmol/L', range: '98 - 107' },
    ]}],
  },
  lfts: {
    label: 'LFTs',
    keywords: ['lft','liver function','hepatic'],
    type: 'table',
    sections: [{ title: 'Liver Function Tests', rows: [
      { param: 'Total Bilirubin', unit: 'µmol/L', range: '3 - 21' },
      { param: 'Direct Bilirubin', unit: 'µmol/L', range: '0 - 5' },
      { param: 'ALT (SGPT)', unit: 'U/L', range: '7 - 40' },
      { param: 'AST (SGOT)', unit: 'U/L', range: '10 - 40' },
      { param: 'ALP', unit: 'U/L', range: '44 - 147' },
      { param: 'GGT', unit: 'U/L', range: '8 - 61' },
      { param: 'Total Protein', unit: 'g/L', range: '60 - 83' },
      { param: 'Albumin', unit: 'g/L', range: '35 - 52' },
    ]}],
  },
  lipid: {
    label: 'Lipid Profile',
    keywords: ['lipid','cholesterol','triglyceride'],
    type: 'table',
    sections: [{ title: 'Lipid Profile', rows: [
      { param: 'Total Cholesterol', unit: 'mmol/L', range: '< 5.2' },
      { param: 'HDL Cholesterol', unit: 'mmol/L', range: '> 1.0' },
      { param: 'LDL Cholesterol', unit: 'mmol/L', range: '< 3.4' },
      { param: 'Triglycerides', unit: 'mmol/L', range: '< 1.7' },
    ]}],
  },
  tfts: {
    label: 'TFTs',
    keywords: ['tft','thyroid','tsh','t3','t4'],
    type: 'table',
    sections: [{ title: 'Thyroid Function Tests', rows: [
      { param: 'TSH', unit: 'mIU/L', range: '0.4 - 4.0' },
      { param: 'T3 (Total)', unit: 'nmol/L', range: '1.2 - 2.8' },
      { param: 'T4 (Total)', unit: 'nmol/L', range: '60 - 150' },
    ]}],
  },
  urinalysis: {
    label: 'Urinalysis',
    keywords: ['urine','urinalysis','ua ','urianalysis'],
    type: 'urinalysis',
    physical: [
      { param: 'Color', options: ['Yellow','Pale Yellow','Dark Yellow','Amber','Red','Brown','Colorless'] },
      { param: 'Clarity', options: ['Clear','Slightly Turbid','Turbid','Very Turbid'] },
      { param: 'pH', options: ['5.0','5.5','6.0','6.5','7.0','7.5','8.0','8.5'] },
      { param: 'Specific Gravity', options: ['1.005','1.010','1.015','1.020','1.025','1.030'] },
    ],
    chemical: [
      { param: 'Glucose', options: ['Negative','Trace','+1','+2','+3','+4'] },
      { param: 'Protein', options: ['Negative','Trace','+1','+2','+3','+4'] },
      { param: 'Blood', options: ['Negative','Trace','+1','+2','+3'] },
      { param: 'Ketones', options: ['Negative','Trace','+1','+2','+3'] },
      { param: 'Nitrites', options: ['Negative','Positive'] },
      { param: 'Leukocytes', options: ['Negative','Trace','+1','+2','+3'] },
      { param: 'Bilirubin', options: ['Negative','+1','+2','+3'] },
      { param: 'Urobilinogen', options: ['Normal','+1','+2','+3'] },
    ],
  },
  widal: {
    label: 'Widal Test',
    keywords: ['widal'],
    type: 'titration',
    rows: [
      { param: 'Salmonella Typhi O (TO)' },
      { param: 'Salmonella Typhi H (TH)' },
      { param: 'Salmonella Paratyphi AO' },
      { param: 'Salmonella Paratyphi BH' },
    ],
  },
  brucella: {
    label: 'Brucella',
    keywords: ['brucella'],
    type: 'titration',
    rows: [
      { param: 'Brucella Abortus' },
      { param: 'Brucella Melitensis' },
    ],
  },
  rf: {
    label: 'Rheumatoid Factor (RF)',
    keywords: ['rheumatoid','rf test',' rf '],
    type: 'titration',
    rows: [{ param: 'Rheumatoid Factor (RF)' }],
  },
  posneg: {
    label: 'Positive / Negative',
    keywords: ['malaria','typhoid','hiv','hepatitis','h.pylori','helicobacter','pregnancy','vdrl','syphilis','rpr','covid','strep','dengue','leptospira','toxoplasma','rotavirus','influenza','aso','antistreptolysin'],
    type: 'posneg',
  },
  single: {
    label: 'Single Value',
    keywords: ['hba1c','glycated','d-dimer','ferritin','troponin','psa','beta-hcg','bhcg','prolactin','fsh','lh','cortisol','insulin','crp','esr','procalcitonin','blood sugar','glucose','haemoglobin','hemoglobin','creatinine','uric acid','amylase','lipase'],
    type: 'single',
  },
};

const detectTemplate = (testName) => {
  if (!testName) return null;
  const lower = testName.toLowerCase();
  for (const [key, tmpl] of Object.entries(TEMPLATES)) {
    if (tmpl.keywords?.some(kw => lower.includes(kw))) return key;
  }
  return null;
};

const Card = ({ children, style={}, ...props }) => (
  <div style={{ background:'var(--bg-surface)', borderRadius:14, border:'1px solid var(--border)', ...style }} {...props}>{children}</div>
);
const Btn = ({ children, variant='primary', size='md', ...props }) => (
  <button {...props} style={{
    display:'inline-flex', alignItems:'center', gap:6,
    padding: size==='sm' ? '6px 12px' : '10px 18px',
    background: variant==='primary'?'var(--accent)':variant==='danger'?'var(--danger)':variant==='success'?'#22c55e':'var(--bg-elevated)',
    border: variant==='ghost'?'1px solid var(--border)':'none', borderRadius:8,
    color: variant==='primary'||variant==='success'?'#0F1612':variant==='danger'?'#fff':'var(--text-primary)',
    fontSize: size==='sm'?11:13, fontWeight:600, cursor:props.disabled?'not-allowed':'pointer',
    opacity:props.disabled?0.6:1, fontFamily:'DM Sans, sans-serif', ...props.style
  }}>{children}</button>
);

const inp = { width:'100%', padding:'8px 10px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:7, color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'monospace' };
const sel = { ...inp, fontFamily:'DM Sans, sans-serif' };

const TableTemplate = ({ sections, values, onChange }) => (
  <div>
    {sections.map(sec => (
      <div key={sec.title} style={{ marginBottom:20 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', textTransform:'uppercase', letterSpacing:1, marginBottom:8, padding:'6px 10px', background:'var(--accent-soft)', borderRadius:6 }}>{sec.title}</div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ borderBottom:'1px solid var(--border)' }}>
              {['Parameter','Value','Unit','Reference Range','Flag'].map(h => (
                <th key={h} style={{ padding:'6px 10px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--text-faint)', textTransform:'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sec.rows.map(row => {
              const key = row.param;
              const val = values[key] || {};
              const flagColor = FLAG_COLORS[val.flag || 'normal'];
              return (
                <tr key={key} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'7px 10px', fontWeight:600, color:'var(--text-primary)', whiteSpace:'nowrap' }}>{row.param}</td>
                  <td style={{ padding:'4px 6px' }}>
                    <input value={val.value||''} onChange={e => onChange(key, 'value', e.target.value)}
                      placeholder="—" style={{ ...inp, width:90, textAlign:'center', fontWeight:700, fontSize:14 }} />
                  </td>
                  <td style={{ padding:'7px 10px', color:'var(--text-muted)', fontSize:12 }}>{row.unit}</td>
                  <td style={{ padding:'7px 10px', color:'var(--text-muted)', fontSize:12, fontFamily:'monospace' }}>{row.rangeMin !== undefined ? `${row.rangeMin} - ${row.rangeMax}` : row.range || '—'}</td>
                  <td style={{ padding:'4px 6px' }}>
                    <select value={val.flag||'normal'} onChange={e => onChange(key, 'flag', e.target.value)} style={{ ...sel, width:90, fontSize:11, color: flagColor }}>
                      <option value="normal">Normal</option>
                      <option value="high">HIGH ↑</option>
                      <option value="low">LOW ↓</option>
                      <option value="critical">CRITICAL</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ))}
  </div>
);

const UrinalysisTemplate = ({ values, onChange }) => {
  const tmpl = TEMPLATES.urinalysis;
  return (
    <div>
      <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', textTransform:'uppercase', letterSpacing:1, marginBottom:8, padding:'6px 10px', background:'var(--accent-soft)', borderRadius:6 }}>Physical Examination</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
        {tmpl.physical.map(row => (
          <div key={row.param}>
            <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>{row.param}</label>
            <select value={values[row.param]||''} onChange={e => onChange(row.param, e.target.value)} style={sel}>
              <option value="">Select...</option>
              {row.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', textTransform:'uppercase', letterSpacing:1, marginBottom:8, padding:'6px 10px', background:'var(--accent-soft)', borderRadius:6 }}>Chemical Examination</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
        {tmpl.chemical.map(row => (
          <div key={row.param}>
            <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>{row.param}</label>
            <select value={values[row.param]||''} onChange={e => onChange(row.param, e.target.value)} style={sel}>
              <option value="">Select...</option>
              {row.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', textTransform:'uppercase', letterSpacing:1, marginBottom:8, padding:'6px 10px', background:'var(--accent-soft)', borderRadius:6 }}>Microscopy</div>
      <textarea value={values['microscopy']||''} onChange={e => onChange('microscopy', e.target.value)}
        rows={4} placeholder="e.g. WBCs: 2-5/hpf, RBCs: 0-2/hpf, No casts seen..."
        style={{ width:'100%', padding:'10px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none', resize:'vertical', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' }} />
    </div>
  );
};

const TitrationTemplate = ({ rows, values, onChange }) => (
  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
    <thead>
      <tr style={{ borderBottom:'1px solid var(--border)' }}>
        {['Antigen / Test','Titre'].map(h => (
          <th key={h} style={{ padding:'6px 10px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--text-faint)', textTransform:'uppercase' }}>{h}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map(row => (
        <tr key={row.param} style={{ borderBottom:'1px solid var(--border)' }}>
          <td style={{ padding:'8px 10px', fontWeight:600, color:'var(--text-primary)' }}>{row.param}</td>
          <td style={{ padding:'4px 6px' }}>
            <select value={values[row.param]||'Negative'} onChange={e => onChange(row.param, e.target.value)} style={{ ...sel, width:120 }}>
              {TITRE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

const PosNegTemplate = ({ testName, values, onChange }) => (
  <div>
    <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)', marginBottom:16 }}>{testName}</div>
    <div style={{ display:'flex', gap:16, marginBottom:20 }}>
      {['Negative','Positive','Indeterminate'].map(opt => (
        <button key={opt} onClick={() => onChange('result', opt)} style={{
          flex:1, padding:'16px 0', borderRadius:10, cursor:'pointer', fontWeight:700, fontSize:15,
          border:`2px solid ${values.result===opt ? (opt==='Positive'?'var(--danger)':opt==='Negative'?'var(--accent)':'var(--warning)') : 'var(--border)'}`,
          background: values.result===opt ? (opt==='Positive'?'rgba(239,68,68,0.15)':opt==='Negative'?'var(--accent-soft)':'rgba(245,158,11,0.15)') : 'var(--bg-elevated)',
          color: values.result===opt ? (opt==='Positive'?'var(--danger)':opt==='Negative'?'var(--accent)':'var(--warning)') : 'var(--text-muted)',
        }}>{opt==='Positive'?'➕ Positive':opt==='Negative'?'➖ Negative':'⚠ Indeterminate'}</button>
      ))}
    </div>
    <div>
      <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>Additional Notes (Optional)</label>
      <textarea value={values.notes||''} onChange={e => onChange('notes', e.target.value)} rows={3}
        placeholder="e.g. Malaria parasites seen, P. falciparum, +2..."
        style={{ width:'100%', padding:'10px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none', resize:'vertical', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' }} />
    </div>
  </div>
);

const SingleTemplate = ({ values, onChange }) => (
  <div>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:14 }}>
      <div>
        <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>Result Value *</label>
        <input value={values.value||''} onChange={e => onChange('value', e.target.value)} placeholder="e.g. 6.5"
          style={{ ...inp, fontSize:18, fontWeight:700, textAlign:'center' }} />
      </div>
      <div>
        <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>Unit</label>
        <input value={values.unit||''} onChange={e => onChange('unit', e.target.value)} placeholder="e.g. mg/dL" style={inp} />
      </div>
      <div>
        <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>Reference Range</label>
        <input value={values.range||''} onChange={e => onChange('range', e.target.value)} placeholder="e.g. 4.0 - 6.0" style={inp} />
      </div>
    </div>
    <div style={{ marginBottom:14 }}>
      <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:8 }}>Flag</label>
      <div style={{ display:'flex', gap:8 }}>
        {Object.entries(FLAG_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => onChange('flag', key)} style={{
            flex:1, padding:'8px 0', borderRadius:8, cursor:'pointer',
            border:`2px solid ${values.flag===key ? FLAG_COLORS[key] : 'var(--border)'}`,
            background: values.flag===key ? `${FLAG_COLORS[key]}20` : 'var(--bg-elevated)',
            color: values.flag===key ? FLAG_COLORS[key] : 'var(--text-muted)',
            fontSize:12, fontWeight:700
          }}>{label}</button>
        ))}
      </div>
    </div>
    <div>
      <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>Interpretation</label>
      <textarea value={values.interpretation||''} onChange={e => onChange('interpretation', e.target.value)} rows={3}
        placeholder="e.g. HbA1c is elevated indicating poor glycaemic control..."
        style={{ width:'100%', padding:'10px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none', resize:'vertical', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' }} />
    </div>
  </div>
);

const FreeTextTemplate = ({ values, onChange }) => (
  <div>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:14 }}>
      <div>
        <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>Result Value</label>
        <input value={values.value||''} onChange={e => onChange('value', e.target.value)} placeholder="—" style={inp} />
      </div>
      <div>
        <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>Unit</label>
        <input value={values.unit||''} onChange={e => onChange('unit', e.target.value)} placeholder="—" style={inp} />
      </div>
      <div>
        <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>Reference Range</label>
        <input value={values.range||''} onChange={e => onChange('range', e.target.value)} placeholder="—" style={inp} />
      </div>
    </div>
    <div style={{ marginBottom:14 }}>
      <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>Result / Interpretation *</label>
      <textarea value={values.result||''} onChange={e => onChange('result', e.target.value)} rows={5}
        placeholder="Enter result details..."
        style={{ width:'100%', padding:'10px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none', resize:'vertical', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' }} />
    </div>
    <div style={{ marginBottom:14 }}>
      <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:8 }}>Flag</label>
      <div style={{ display:'flex', gap:8 }}>
        {Object.entries(FLAG_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => onChange('flag', key)} style={{
            flex:1, padding:'8px 0', borderRadius:8, cursor:'pointer',
            border:`2px solid ${values.flag===key ? FLAG_COLORS[key] : 'var(--border)'}`,
            background: values.flag===key ? `${FLAG_COLORS[key]}20` : 'var(--bg-elevated)',
            color: values.flag===key ? FLAG_COLORS[key] : 'var(--text-muted)',
            fontSize:12, fontWeight:700
          }}>{label}</button>
        ))}
      </div>
    </div>
  </div>
);

// ── MOH 706 Report Component ─────────────────────────────────────────────────
const MOH706Report = ({ user }) => {
  const now = new Date();
  const [reportType, setReportType] = useState('monthly');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [weekStart, setWeekStart] = useState(now.toISOString().split('T')[0]);
  const [weekEnd, setWeekEnd] = useState(now.toISOString().split('T')[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [overrides, setOverrides] = useState({});
  const printRef = useRef(null);
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = '/lab-requests/moh706?';
      if (reportType === 'weekly') {
        url += `week_start=${weekStart}&week_end=${weekEnd}`;
      } else {
        url += `month=${month}&year=${year}`;
      }
      const res = await api.get(url);
      setData(res.data.data);
      setOverrides({});
    } catch { toast.error('Failed to load report data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReport(); }, [month, year, reportType, weekStart, weekEnd]);

  const getVal = (key, def = '') => overrides[key] !== undefined ? overrides[key] : def;
  const setVal = (key, val) => setOverrides(p => ({ ...p, [key]: val }));
  const autoGet = (cat, field) => {
    const key = `auto_${cat}_${field}`;
    if (overrides[key] !== undefined) return overrides[key];
    return data?.summary?.[cat]?.[field] ?? 0;
  };
  const autoSet = (cat, field, val) => setOverrides(p => ({ ...p, [`auto_${cat}_${field}`]: val }));

  const getItemDefault = (itemKey, colIdx, totalCols) => {
    if (!data?.line_items?.[itemKey]) return '';
    const item = data.line_items[itemKey];
    if (totalCols === 1) {
      return item.positive ?? item.completed ?? item.total ?? 0;
    }
    if (totalCols === 2) {
      if (colIdx === 0) return item.completed ?? item.total ?? 0;
      if (colIdx === 1) return item.positive ?? 0;
    }
    if (totalCols === 3) {
      if (colIdx === 0) return item.completed ?? item.total ?? 0;
      if (colIdx === 1) return item.low ?? 0;
      if (colIdx === 2) return item.high ?? item.positive ?? 0;
    }
    return 0;
  };

  const Cell = ({ k, def = '' }) => (
    <input value={getVal(k, def)} onChange={e => setVal(k, e.target.value)}
      style={{ width: 70, textAlign: 'center', padding: '3px 4px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12, outline: 'none' }} />
  );

  const AutoCell = ({ cat, field, color }) => {
    const v = autoGet(cat, field);
    return (
      <input value={v} onChange={e => autoSet(cat, field, e.target.value)}
        style={{ width: 70, textAlign: 'center', padding: '3px 4px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 4, color: color || (v > 0 ? 'var(--accent)' : 'var(--text-muted)'), fontSize: 13, fontWeight: 700, outline: 'none' }} />
    );
  };

  const SectionHeader = ({ num, title }) => (
    <tr>
      <td colSpan={5} style={{ padding: '8px 12px', fontWeight: 700, fontSize: 13, color: '#fff', background: '#1a4a8a', border: '1px solid #1a4a8a' }}>
        {num}. {title}
      </td>
    </tr>
  );

  const SubHeader = ({ label, cols = [] }) => (
    <tr style={{ background: 'var(--bg-elevated)' }}>
      <td style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', border: '1px solid var(--border)' }}>{label}</td>
      {cols.map((c, i) => <td key={i} style={{ padding: '5px 8px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', border: '1px solid var(--border)', textAlign: 'center', whiteSpace: 'nowrap' }}>{c}</td>)}
    </tr>
  );

  const Row = ({ label, k, cols = 1, cat, field, posField, itemKey }) => (
    <tr onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <td style={{ padding: '5px 10px', fontSize: 12, color: 'var(--text-primary)', border: '1px solid var(--border)' }}>{label}</td>
      {itemKey ? (
        Array.from({ length: cols }).map((_, i) => {
          const autoVal = getItemDefault(itemKey, i, cols);
          const cellKey = `item_${itemKey}_${i}`;
          const currentVal = overrides[cellKey] !== undefined ? overrides[cellKey] : autoVal;
          const isPosCol = (cols === 2 && i === 1) || (cols === 3 && (i === 1 || i === 2));
          return (
            <td key={i} style={{ padding: '4px 6px', border: '1px solid var(--border)', textAlign: 'center' }}>
              <input
                value={currentVal}
                onChange={e => setOverrides(p => ({ ...p, [cellKey]: e.target.value }))}
                style={{
                  width: 70,
                  textAlign: 'center',
                  padding: '3px 4px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: isPosCol && Number(currentVal) > 0 ? 'var(--danger)' : Number(currentVal) > 0 ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: 13,
                  fontWeight: Number(currentVal) > 0 ? 700 : 400,
                  outline: 'none'
                }}
              />
            </td>
          );
        })
      ) : cat ? (
        <>
          <td style={{ padding: '4px 6px', border: '1px solid var(--border)', textAlign: 'center' }}>
            <AutoCell cat={cat} field={field || 'completed'} />
          </td>
          <td style={{ padding: '4px 6px', border: '1px solid var(--border)', textAlign: 'center' }}>
            <AutoCell cat={cat} field={posField || 'positive'} color="var(--danger)" />
          </td>
        </>
      ) : (
        Array.from({ length: cols }).map((_, i) => (
          <td key={i} style={{ padding: '4px 6px', border: '1px solid var(--border)', textAlign: 'center' }}>
            <Cell k={`${k}_${i}`} />
          </td>
        ))
      )}
    </tr>
  );

  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>MOH 706</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 10px; margin: 10px; color: #000; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        th, td { border: 1px solid #333; padding: 3px 6px; }
        th { background: #ddd; font-weight: bold; }
        .blue-hdr { background: #1a4a8a; color: white; font-weight: bold; }
        .sub-hdr { background: #e8e8e8; font-weight: bold; }
        input { border: none; background: transparent; width: 100%; text-align: center; font-size: 10px; }
        @media print { @page { size: A3 landscape; margin: 8mm; } }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  return (
    <div>
      <Card style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', borderRadius: 8, padding: 3 }}>
            {['monthly', 'weekly'].map(t => (
              <button key={t} onClick={() => setReportType(t)} style={{
                padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: reportType === t ? 'var(--accent)' : 'transparent',
                color: reportType === t ? '#0F1612' : 'var(--text-muted)'
              }}>{t === 'monthly' ? '📅 Monthly' : '📆 Weekly'}</button>
            ))}
          </div>
          {reportType === 'monthly' ? (
            <>
              <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
                style={{ padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}>
                {MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
              </select>
              <select value={year} onChange={e => setYear(parseInt(e.target.value))}
                style={{ padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>From:</span>
                <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)}
                  style={{ padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>To:</span>
                <input type="date" value={weekEnd} onChange={e => setWeekEnd(e.target.value)}
                  style={{ padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
              </div>
            </>
          )}
          <Btn variant="ghost" onClick={fetchReport}><RefreshCw size={14} /> Refresh</Btn>
          <Btn onClick={handlePrint}><Printer size={14} /> Print MOH 706</Btn>
        </div>
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Loader size={32} color="var(--accent)" style={{ animation: 'spin 0.8s linear infinite' }} /></div>
      ) : data ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Total Tests', value: data.totals.total, color: 'var(--text-primary)' },
              { label: 'Completed', value: data.totals.completed, color: 'var(--accent)' },
              { label: 'Pending', value: data.totals.pending, color: 'var(--warning)' },
              { label: 'Processing', value: data.totals.processing, color: 'var(--info)' },
            ].map(s => (
              <Card key={s.label} style={{ padding: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
              </Card>
            ))}
          </div>

          <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 12, padding: '8px 12px', background: 'var(--warning)15', borderRadius: 8 }}>
            ✏️ Highlighted fields auto-fill from completed lab requests. All fields are editable before printing.
          </div>

          <Card style={{ padding: 20 }}>
            <div ref={printRef}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Republic of Kenya – Ministry of Health</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a4a8a', marginTop: 4 }}>MOH 706 — Laboratory (LAB) Services Summary</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Edition: April 2019</div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 12 }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '5px 10px', fontWeight: 700, border: '1px solid var(--border)', width: '15%' }}>County:</td>
                    <td style={{ padding: '5px 10px', border: '1px solid var(--border)' }}>{user?.pharmacy?.county || <Cell k="county" />}</td>
                    <td style={{ padding: '5px 10px', fontWeight: 700, border: '1px solid var(--border)', width: '15%' }}>Sub-County:</td>
                    <td style={{ padding: '5px 10px', border: '1px solid var(--border)' }}>{user?.pharmacy?.sub_county || <Cell k="sub_county" />}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '5px 10px', fontWeight: 700, border: '1px solid var(--border)' }}>Health Facility:</td>
                    <td style={{ padding: '5px 10px', border: '1px solid var(--border)' }}><strong>{user?.pharmacy?.name}</strong></td>
                    <td style={{ padding: '5px 10px', fontWeight: 700, border: '1px solid var(--border)' }}>KMHFL Code:</td>
                    <td style={{ padding: '5px 10px', border: '1px solid var(--border)' }}>{user?.pharmacy?.mfl_code || <Cell k="mfl" />}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '5px 10px', fontWeight: 700, border: '1px solid var(--border)' }}>Facility Type:</td>
                    <td style={{ padding: '5px 10px', border: '1px solid var(--border)' }}><Cell k="fac_type" /></td>
                    <td style={{ padding: '5px 10px', fontWeight: 700, border: '1px solid var(--border)' }}>Man. Agency:</td>
                    <td style={{ padding: '5px 10px', border: '1px solid var(--border)' }}><Cell k="man_agency" def="Private" /></td>
                  </tr>
                  <tr>
                    <td style={{ padding: '5px 10px', fontWeight: 700, border: '1px solid var(--border)' }}>Start Date:</td>
                    <td style={{ padding: '5px 10px', border: '1px solid var(--border)' }}>{data.period.start}</td>
                    <td style={{ padding: '5px 10px', fontWeight: 700, border: '1px solid var(--border)' }}>End Date:</td>
                    <td style={{ padding: '5px 10px', border: '1px solid var(--border)' }}>{data.period.end}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} style={{ padding: '5px 10px', border: '1px solid var(--border)', fontSize: 11 }}>
                      <strong>Affiliation:</strong>&nbsp;&nbsp;
                      {['GOK', 'Faith Based', 'NGO', 'Private'].map(a => (
                        <span key={a} style={{ marginRight: 16 }}>☐ {a}</span>
                      ))}
                    </td>
                  </tr>
                </tbody>
              </table>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <tbody>
                  <SectionHeader num="1" title="URINE ANALYSIS" />
                  <SubHeader label="Urine Chemistry" cols={['Total Exam', 'Positive']} />
                  <Row label="1.1 Urine Chemistry (Total)" k="u1" cols={2} itemKey="u_chem_total" />
                  <Row label="1.2 Glucose" k="u2" cols={2} itemKey="u_glucose" />
                  <Row label="1.3 Ketones" k="u3" cols={2} itemKey="u_ketones" />
                  <Row label="1.4 Proteins" k="u4" cols={2} itemKey="u_proteins" />
                  <SubHeader label="Urine Microscopy" cols={['Total Exam', 'Positive']} />
                  <Row label="1.5 Urine Microscopy (Total)" k="um0" cols={2} itemKey="u_micro_total" />
                  <Row label="1.6 Pus cells (>5/hpf)" k="um1" cols={2} itemKey="u_pus_cells" />
                  <Row label="1.7 S. haematobium" k="um2" cols={2} itemKey="u_haematobium" />
                  <Row label="1.8 T. vaginalis" k="um3" cols={2} itemKey="u_tvaginalis" />
                  <Row label="1.9 Yeast cells" k="um4" cols={2} itemKey="u_yeast" />
                  <Row label="1.10 Bacteria" k="um5" cols={2} itemKey="u_bacteria" />

                  <SectionHeader num="2" title="BLOOD CHEMISTRY" />
                  <SubHeader label="Blood Sugar Test" cols={['Total Exam', 'Low', 'High']} />
                  <Row label="2.1 Blood Sugar (RBS/FBS)" k="bs1" cols={3} itemKey="blood_sugar" />
                  <Row label="2.2 OGTT" k="bs2" cols={3} itemKey="ogtt" />
                  <SubHeader label="Renal Function Test" cols={['Total Exam', 'Positive']} />
                  <Row label="2.3 Renal Function (UECS - Total)" k="rf0" cols={2} itemKey="uecs_total" />
                  <Row label="2.4 Creatinine" k="rf1" cols={2} itemKey="creatinine" />
                  <Row label="2.5 Urea" k="rf2" cols={2} itemKey="urea" />
                  <Row label="2.5 Sodium" k="rf3" cols={2} itemKey="sodium" />
                  <Row label="2.6 Potassium" k="rf4" cols={2} itemKey="potassium" />
                  <Row label="2.7 Chlorides" k="rf5" cols={2} itemKey="chlorides" />
                  <SubHeader label="Liver Function Test" cols={['Total Exam', 'Positive']} />
                  <Row label="2.8 LFT Total" k="lft0" cols={2} itemKey="lft_total" />
                  <Row label="2.9 Direct Bilirubin" k="lft1" cols={2} itemKey="direct_bilirubin" />
                  <Row label="2.10 Total Bilirubin" k="lft2" cols={2} itemKey="total_bilirubin" />
                  <Row label="2.11 ASAT (SGOT)" k="lft3" cols={2} itemKey="ast_sgot" />
                  <Row label="2.12 ALAT (SGPT)" k="lft4" cols={2} itemKey="alt_sgpt" />
                  <Row label="2.13 Serum Protein" k="lft5" cols={2} itemKey="serum_protein" />
                  <Row label="2.14 Albumin" k="lft6" cols={2} itemKey="albumin" />
                  <Row label="2.15 Alkaline Phosphatase" k="lft7" cols={2} itemKey="alp" />
                  <SubHeader label="Lipid Profile" cols={['Total Exam', 'Positive']} />
                  <Row label="2.16 Lipid Profile Total" k="lp0" cols={2} itemKey="lipid_total" />
                  <Row label="2.17 Total Cholesterol" k="lp1" cols={2} itemKey="cholesterol" />
                  <Row label="2.18 Triglycerides" k="lp2" cols={2} itemKey="triglycerides" />
                  <Row label="2.19 LDL" k="lp3" cols={2} itemKey="ldl" />
                  <SubHeader label="Hormonal Test" cols={['Total Exam', 'Low', 'High']} />
                  <Row label="2.20 T3" k="ht1" cols={3} itemKey="t3" />
                  <Row label="2.21 T4" k="ht2" cols={3} itemKey="t4" />
                  <Row label="2.22 TSH" k="ht3" cols={3} itemKey="tsh" />
                  <SubHeader label="Tumor Markers" cols={['Total Exam', 'Positive']} />
                  <Row label="2.23 PSA" k="tm1" cols={2} itemKey="psa" />
                  <Row label="2.24 CA 15-3" k="tm2" cols={2} itemKey="ca15_3" />
                  <Row label="2.25 CA 19-9" k="tm3" cols={2} itemKey="ca19_9" />
                  <Row label="2.26 CA 125" k="tm4" cols={2} itemKey="ca125" />
                  <Row label="2.27 CEA" k="tm5" cols={2} itemKey="cea" />
                  <Row label="2.28 AFP" k="tm6" cols={2} itemKey="afp" />
                  <SubHeader label="CSF Chemistry" cols={['Total Exam', 'Low', 'High']} />
                  <Row label="2.29 CSF Proteins" k="csf1" cols={3} itemKey="csf_proteins" />
                  <Row label="2.30 CSF Glucose" k="csf2" cols={3} itemKey="csf_glucose" />

                  <SectionHeader num="3" title="PARASITOLOGY" />
                  <SubHeader label="Malaria Test" cols={['Total Exam', 'Number Positive']} />
                  <Row label="3.1 Malaria BS (Under 5 years)" k="mal1" cols={2} itemKey="malaria_bs_u5" />
                  <Row label="3.2 Malaria BS (5 years and above)" k="mal2" cols={2} itemKey="malaria_bs_o5" />
                  <Row label="3.3 Malaria RDT (Under 5 years)" k="mal3" cols={2} itemKey="malaria_rdt_u5" />
                  <Row label="3.4 Malaria RDT (5 years and above)" k="mal4" cols={2} itemKey="malaria_rdt_o5" />
                  <SubHeader label="Stool Examination" cols={['Total Exam', 'Number Positive']} />
                  <Row label="3.5 Taenia spp." k="st1" cols={2} itemKey="taenia" />
                  <Row label="3.6 Hymenolepis nana" k="st2" cols={2} itemKey="h_nana" />
                  <Row label="3.7 Hookworm" k="st3" cols={2} itemKey="hookworm" />
                  <Row label="3.8 Roundworms" k="st4" cols={2} itemKey="roundworms" />
                  <Row label="3.9 S. mansoni" k="st5" cols={2} itemKey="s_mansoni" />
                  <Row label="3.10 Trichuris trichura" k="st6" cols={2} itemKey="trichuris" />
                  <Row label="3.11 Amoeba" k="st7" cols={2} itemKey="amoeba" />

                  <SectionHeader num="4" title="HAEMATOLOGY" />
                  <SubHeader label="Haematology Tests" cols={['Total Exam', 'HB <5 g/dl', 'HB 5-10 g/dl']} />
                  <Row label="4.1 Full Blood Count (FBC)" k="fbc1" cols={3} itemKey="cbc_fbc" />
                  <Row label="4.2 HB Estimation (other techniques)" k="hb2" cols={3} itemKey="hb_estimation" />
                  <Row label="4.3 Hemoglobin A1c (HbA1c)" k="hba1c" cols={3} itemKey="hba1c" />
                  <SubHeader label="Other Haematology Tests" cols={['Total Exam', 'Positive']} />
                  <Row label="4.4 CD4 Count" k="cd4" cols={2} itemKey="cd4" />
                  <Row label="4.5 Sickling Test" k="sickle" cols={2} itemKey="sickling" />
                  <Row label="4.6 Peripheral Blood Films" k="pbf" cols={2} itemKey="pbf" />
                  <Row label="4.7 BMA" k="bma" cols={2} />
                  <Row label="4.8 Coagulation Profile" k="coag" cols={2} itemKey="coagulation" />
                  <Row label="4.9 Reticulocyte Count" k="retic" cols={2} itemKey="reticulocytes" />
                  <Row label="4.10 ESR" k="esr" cols={2} itemKey="esr" />
                  <SubHeader label="Blood Grouping" cols={['Total Exam', 'Number']} />
                  <Row label="4.11 Total Blood Group Tests" k="bg1" cols={2} itemKey="blood_group" />
                  <Row label="4.12 Blood Units Grouped" k="bg2" cols={2} />
                  <SubHeader label="Blood Safety" cols={['Number']} />
                  <Row label="4.13 Blood Units Received from Blood Transfusion Centres" k="bs_1" cols={1} />
                  <Row label="4.14 Blood Units Collected at Facility" k="bs_2" cols={1} />
                  <Row label="4.15 Blood Units Transfused" k="bs_3" cols={1} />
                  <Row label="4.16 Transfusion Reactions Reported and Investigated" k="bs_4" cols={1} />
                  <Row label="4.17 Blood Units Grouped and Cross Matched" k="bs_5" cols={1} />
                  <Row label="4.18 Blood Units Discarded" k="bs_6" cols={1} />
                  <SubHeader label="Blood Screening at Facility" cols={['Number Positive']} />
                  <Row label="4.19 HIV" k="bscreen1" cols={1} />
                  <Row label="4.20 Hepatitis B" k="bscreen2" cols={1} />
                  <Row label="4.21 Hepatitis C" k="bscreen3" cols={1} />
                  <Row label="4.22 Syphilis" k="bscreen4" cols={1} />

                  <SectionHeader num="5" title="BACTERIOLOGY" />
                  <SubHeader label="Bacteriological Sample" cols={['Total Exam', 'Total Cultures', 'Culture Positive']} />
                  <Row label="5.1 Urine" k="bac1" cols={3} itemKey="bac_urine" />
                  <Row label="5.2 Pus Swabs" k="bac2" cols={3} itemKey="bac_pus" />
                  <Row label="5.3 High Vaginal Swabs (HVS)" k="bac3" cols={3} itemKey="bac_hvs" />
                  <Row label="5.4 Throat Swab" k="bac4" cols={3} itemKey="bac_throat" />
                  <Row label="5.5 Rectal Swab" k="bac5" cols={3} itemKey="bac_rectal" />
                  <Row label="5.6 Blood" k="bac6" cols={3} itemKey="bac_blood" />
                  <Row label="5.7 Water" k="bac7" cols={3} itemKey="bac_water" />
                  <Row label="5.8 Food" k="bac8" cols={3} itemKey="bac_food" />
                  <Row label="5.9 Urethral Swabs" k="bac9" cols={3} itemKey="bac_urethral" />
                  <Row label="5.10 Stool Cultures" k="bac10" cols={3} itemKey="bac_stool" />
                  <SubHeader label="SPUTUM / TB" cols={['Total Exam', 'Number Positive']} />
                  <Row label="5.29 Total TB Smears" k="tb1" cols={2} itemKey="tb_smear" />
                  <Row label="5.30 New Presumptive TB Cases" k="tb2" cols={2} />
                  <Row label="5.31 TB Follow Up" k="tb3" cols={2} />
                  <Row label="5.32 Rifampicin Resistant TB" k="tb4" cols={2} />
                  <Row label="5.33 MDR TB" k="tb5" cols={2} />

                  <SectionHeader num="6" title="HISTOLOGY AND CYTOLOGY" />
                  <SubHeader label="Smears" cols={['Total Exam', 'Malignant']} />
                  <Row label="6.1 PAP Smear" k="hist1" cols={2} />
                  <Row label="6.2 Touch Preparations" k="hist2" cols={2} />
                  <SubHeader label="Fine Needle Aspirates (FNA)" cols={['Total Exam', 'Malignant']} />
                  <Row label="6.4 Thyroid" k="fna1" cols={2} />
                  <Row label="6.5 Lymph Nodes" k="fna2" cols={2} />
                  <Row label="6.7 Breast" k="fna3" cols={2} />
                  <Row label="6.13 Prostate" k="fna4" cols={2} />
                  <SubHeader label="Tissue Histology" cols={['Total Exam', 'Malignant']} />
                  <Row label="6.16 Uterus (Cervix)" k="th1" cols={2} />
                  <Row label="6.21 Esophagus" k="th2" cols={2} />
                  <Row label="6.22 Colorectal" k="th3" cols={2} />
                  <Row label="6.23 Hepatobiliary" k="th4" cols={2} />

                  <SectionHeader num="7" title="SEROLOGY" />
                  <SubHeader label="Serological Tests" cols={['Total Exam', 'Number Positive']} />
                  <Row label="7.1 VDRL" k="ser1" cols={2} itemKey="vdrl" />
                  <Row label="7.2 TPHA" k="ser2" cols={2} itemKey="tpha" />
                  <Row label="7.3 ASOT" k="ser3" cols={2} itemKey="asot" />
                  <Row label="7.4 HIV" k="ser4" cols={2} itemKey="hiv" />
                  <Row label="7.5 Brucella" k="ser5" cols={2} itemKey="brucella" />
                  <Row label="7.6 Rheumatoid Factor (RF)" k="ser6" cols={2} itemKey="rf" />
                  <Row label="7.7 Helicobacter pylori" k="ser7" cols={2} itemKey="h_pylori" />
                  <Row label="7.8 Hepatitis A" k="ser8" cols={2} itemKey="hep_a" />
                  <Row label="7.9 Hepatitis B" k="ser9" cols={2} itemKey="hep_b" />
                  <Row label="7.10 Hepatitis C" k="ser10" cols={2} itemKey="hep_c" />
                  <Row label="7.11 HCG (Pregnancy Test)" k="ser11" cols={2} itemKey="hcg_pregnancy" />
                  <Row label="7.12 CRAG Test" k="ser12" cols={2} itemKey="crag" />

                  <SectionHeader num="8" title="SPECIMEN REFERRAL TO HIGHER LEVELS" />
                  <SubHeader label="Referral Type" cols={['Specimens Referred', 'Results Received']} />
                  <Row label="8.1 CD4" k="ref1" cols={2} />
                  <Row label="8.2 Viral Load" k="ref2" cols={2} />
                  <Row label="8.3 EID" k="ref3" cols={2} />
                  <Row label="8.4 Discordant/Discrepant" k="ref4" cols={2} />
                  <Row label="8.5 TB Culture" k="ref5" cols={2} />
                  <Row label="8.6 Virological" k="ref6" cols={2} />
                  <Row label="8.7 Clinical Chemistry" k="ref7" cols={2} />
                  <Row label="8.8 Histology/Cytology" k="ref8" cols={2} />
                  <Row label="8.9 Haematological" k="ref9" cols={2} />
                  <Row label="8.10 Parasitological" k="ref10" cols={2} />
                  <Row label="8.11 Blood for Transfusion Screening" k="ref11" cols={2} />

                </tbody>
              </table>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: 12 }}>
                {['Report Compiled By', 'Designation', 'Date', 'Signature'].map(label => (
                  <div key={label}>
                    <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}:</div>
                    <div style={{ borderBottom: '1px solid var(--border)', height: 28 }} />
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, textAlign: 'right' }}>MOH 706 — Revised April 2019</div>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
};


// ── Main component ────────────────────────────────────────────────────────────
export default function LabPage() {
  const { user } = useSelector(s => s.auth);
  const [searchParams] = useSearchParams();
  const [requests, setRequests] = useState([]);
  const [payStatus, setPayStatus] = useState({});
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [visitTypeFilter, setVisitTypeFilter] = useState('');
  const [flagFilter, setFlagFilter] = useState('');
  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [activeDatePreset, setActiveDatePreset] = useState('today');
  const { pathname: labPathname } = useLocation();
  const getInitialTab = () => {
    if (labPathname.endsWith('/history')) return 'history';
    if (labPathname.endsWith('/reports')) return 'reports';
    return 'requests';
  };
  const [activeTab, setActiveTab] = useState(getInitialTab());

  useEffect(() => {
    if (labPathname.endsWith('/history')) {
      setActiveTab('history');
      setDateFrom(today);
      setDateTo(today);
      setActiveDatePreset('today');
    } else if (labPathname.endsWith('/reports')) {
      setActiveTab('reports');
    } else if (activeTab === 'reports' || activeTab === 'history') {
      setActiveTab('requests');
    }
  }, [labPathname]);

  const [templateKey, setTemplateKey] = useState(null);
  const [tableValues, setTableValues] = useState({});
  const [simpleValues, setSimpleValues] = useState({ flag: 'normal' });
  const [techNotes, setTechNotes] = useState('');

  useEffect(() => { fetchRequests(); }, [statusFilter, urgencyFilter, visitTypeFilter, dateFrom, dateTo, activeTab]);

  const setQuickDate = (preset) => {
    setActiveDatePreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    if (preset === 'today') {
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(Date.now() - 86400000);
      const yStr = y.toISOString().split('T')[0];
      setDateFrom(yStr);
      setDateTo(yStr);
    } else if (preset === 'week') {
      const w = new Date(Date.now() - 7 * 86400000);
      setDateFrom(w.toISOString().split('T')[0]);
      setDateTo(todayStr);
    } else if (preset === 'month') {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      setDateFrom(m.toISOString().split('T')[0]);
      setDateTo(todayStr);
    } else if (preset === 'all') {
      setDateFrom('2020-01-01');
      setDateTo(todayStr);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const dFrom = dateFrom || new Date().toISOString().split('T')[0];
      const dTo = dateTo || new Date().toISOString().split('T')[0];
      const p = { limit: 500 };
      
      if (activeTab === 'history') {
        p.status = statusFilter || 'completed';
        p.start_date = dFrom;
        p.end_date = dTo;
      } else {
        // Active queue: default to 'active' (pending & processing) so completed orders automatically leave the queue
        p.status = statusFilter || 'active';
        if (dateFrom && dateTo) {
          p.start_date = dFrom;
          p.end_date = dTo;
        }
      }

      if (urgencyFilter) p.urgency = urgencyFilter;
      if (search) p.search = search;
      if (activeTab === 'inpatient') {
        p.visit_type = 'inpatient';
      } else if (activeTab === 'requests') {
        p.visit_type = 'outpatient';
      } else if (activeTab === 'history') {
        if (visitTypeFilter) {
          p.visit_type = visitTypeFilter;
        }
      }
      const params = new URLSearchParams(p);
      const res = await api.get(`/lab-requests?${params}`);
      const reqs = res.data.data.requests || [];
      setRequests(reqs);
      setStats(res.data.data.stats || {});
      try {
        const visitIds = [...new Set(reqs.map(r => r.visit_id).filter(Boolean))];
        const statusMap = {};
        await Promise.all(visitIds.map(async vid => {
          try { const pr = await api.get(`/billing/visit/${vid}`); statusMap[vid] = pr.data.data; }
          catch { statusMap[vid] = { items: [] }; }
        }));
        setPayStatus(statusMap);
      } catch { /* optional */ }
    } catch { toast.error('Failed to load lab requests'); }
    finally { setLoading(false); }
  };

  const handleQuickPay = async (visitId, testName) => {
    try {
      const billRes = await api.get(`/billing/visit/${visitId}`);
      const billData = billRes.data?.data;
      if (!billData || !billData.items || billData.items.length === 0) {
        toast.error('No bill items found for this visit');
        return;
      }
      let pendingItems = billData.items.filter(item => item.status === 'pending' && item.item_type === 'laboratory');
      if (testName) {
        const specific = pendingItems.filter(item => item.item_name?.trim().toLowerCase() === testName.trim().toLowerCase());
        if (specific.length > 0) pendingItems = specific;
      }
      if (pendingItems.length === 0) {
        toast.success('Lab test is already paid!');
        fetchRequests();
        return;
      }
      const itemIds = pendingItems.map(item => item.id);
      const totalAmount = pendingItems.reduce((acc, item) => acc + parseFloat(item.total_price || 0), 0);
      await api.post(`/billing/visit/${visitId}/pay`, {
        payment_method: 'cash',
        amount: String(totalAmount),
        reference_number: 'CSH-LAB-BYPASS-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        notes: 'Bypass payment cleared directly from Lab Terminal.',
        item_ids: itemIds
      });
      toast.success(`🎉 Lab test invoice of KES ${totalAmount.toLocaleString()} paid!`);
      fetchRequests();
    } catch {
      toast.error('Failed to bypass payment');
    }
  };

  const openDetail = async (req) => {
    try {
      const res = await api.get(`/lab-requests/${req.id}`);
      const data = res.data.data;
      setSelected(data);
      let key = detectTemplate(data.test_name);
      if (data.result && data.status === "completed") {
        if (data.result.includes("CBC (3-Part")) key = "cbc3";
        else if (data.result.includes("CBC (5-Part")) key = "cbc5";
      }
      setTemplateKey(key);
      setTableValues({});
      setSimpleValues({ flag: 'normal' });
      setTechNotes(data.technician_notes || '');
      setView('detail');
    } catch { toast.error('Failed to load request'); }
  };

  const handleDownloadPDF = (req) => {
    const token = localStorage.getItem('accessToken');
    const url = (import.meta.env.VITE_API_URL || '') + '/api/lab-requests/public/' + req.id + '/pdf';
    window.open(url + '?token=' + token, '_blank');
  };

  const handleStatusUpdate = async (id, status, testName, visitId) => {
    const vid = visitId || selected?.visit_id;
    const tName = testName || selected?.test_name;
    const isReqInpatient = activeTab === 'inpatient' || selected?.visit_type === 'inpatient' || selected?.visit_status === 'inpatient' || selected?.patient_type === 'inpatient' || selected?.notes?.toLowerCase()?.includes('inpatient') || selected?.notes?.toLowerCase()?.includes('ward');
    if (status === "processing" && vid && tName && !isReqInpatient) {
      try {
        const billRes = await api.get(`/billing/visit/${vid}`);
        const items = billRes.data?.data?.items || [];
        const testBill = items.find(i => i.item_type === 'laboratory' && i.item_name?.trim().toLowerCase() === tName.trim().toLowerCase());
        if (testBill && testBill.status === 'pending') {
          toast.error(`Test '${tName}' is unpaid! Balance: KES ${parseFloat(testBill.total_price||0).toLocaleString()}. Patient must pay for this test at reception first.`);
          return;
        }
      } catch (e) {
        const msg = e.response?.data?.message || e.message || 'Payment check failed';
        if (e.response?.status === 402) {
          toast.error('💳 ' + msg);
          return;
        }
      }
    }
    if (status === "processing" && selected?.result) {
      // Detect original template from result text
      if (selected.result.includes("CBC (3-Part")) setTemplateKey("cbc3");
      else if (selected.result.includes("CBC (5-Part")) setTemplateKey("cbc5");
      // Parse existing result to populate form when editing
      const tmpl = TEMPLATES[templateKey];
      if (tmpl?.type === "table") {
        const newTableValues = {};
        tmpl.sections.forEach(sec => {
          sec.rows.forEach(row => {
            const regex = new RegExp(`  ${row.param.replace(/[()]/g, "\\$&")}: ([\\d.]+(?: - [\\d.]+)?)\\s`);
            const match = selected.result.match(regex);
            if (match) {
              newTableValues[row.param] = { value: match[1], flag: "normal" };
            }
          });
        });
        if (Object.keys(newTableValues).length > 0) setTableValues(newTableValues);
      }
    }
    try {
      await api.put(`/lab-requests/${id}/status`, { status });
      toast.success(`Status updated to ${STATUS_LABELS[status] || status}`);
      fetchRequests();
      if (selected?.id === id) setSelected(p => ({ ...p, status }));
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to update status'); }
  };

  const buildResultPayload = () => {
    const tmpl = TEMPLATES[templateKey];
    if (!tmpl) {
      return { result: simpleValues.result || '', result_value: simpleValues.value || null, result_unit: simpleValues.unit || null, reference_range: simpleValues.range || null, result_flag: simpleValues.flag || 'normal', technician_notes: techNotes };
    }
    if (tmpl.type === 'table') {
      let text = `${tmpl.label} Results:\n\n`;
      tmpl.sections.forEach(sec => {
        text += `${sec.title}:\n`;
        sec.rows.forEach(row => {
          const v = tableValues[row.param] || {};
          let flag = v.flag || "normal";
          if (v.value && (row.rangeMin !== undefined || row.rangeMax !== undefined)) {
            const val = parseFloat(v.value);
            if (!isNaN(val)) {
              if (row.rangeMin !== undefined && val < row.rangeMin) flag = "low";
              else if (row.rangeMax !== undefined && val > row.rangeMax) flag = "high";
              else flag = "normal";
            }
          }
          text += `  ${row.param}: ${v.value || '—'} ${row.unit} (Ref: ${row.rangeMin || 0} - ${row.rangeMax || 0}) [${flag.toUpperCase()}]\n`;
        });
        text += '\n';
      });
      const flags = Object.values(tableValues).map(v => v.flag || 'normal');
      const flag = flags.includes('critical') ? 'critical' : flags.includes('high') ? 'high' : flags.includes('low') ? 'low' : 'normal';
      return { result: text, result_value: null, result_unit: null, reference_range: null, result_flag: flag, technician_notes: techNotes };
    }
    if (tmpl.type === 'urinalysis') {
      let text = 'Urinalysis Results:\n\nPhysical:\n';
      TEMPLATES.urinalysis.physical.forEach(r => { text += `  ${r.param}: ${simpleValues[r.param] || '—'}\n`; });
      text += '\nChemical:\n';
      TEMPLATES.urinalysis.chemical.forEach(r => { text += `  ${r.param}: ${simpleValues[r.param] || '—'}\n`; });
      text += `\nMicroscopy:\n  ${simpleValues['microscopy'] || '—'}`;
      return { result: text, result_value: null, result_unit: null, reference_range: null, result_flag: 'normal', technician_notes: techNotes };
    }
    if (tmpl.type === 'titration') {
      let text = `${tmpl.label} Results:\n\n`;
      tmpl.rows.forEach(row => { text += `  ${row.param}: ${simpleValues[row.param] || 'Negative'}\n`; });
      const hasPositive = tmpl.rows.some(r => simpleValues[r.param] && simpleValues[r.param] !== 'Negative');
      return { result: text, result_value: null, result_unit: null, reference_range: null, result_flag: hasPositive ? 'high' : 'normal', technician_notes: techNotes };
    }
    if (tmpl.type === 'posneg') {
      const res = simpleValues.result || 'Negative';
      const text = `Result: ${res}${simpleValues.notes ? '\n\nNotes: ' + simpleValues.notes : ''}`;
      return { result: text, result_value: res, result_unit: null, reference_range: null, result_flag: res === 'Positive' ? 'high' : res === 'Indeterminate' ? 'low' : 'normal', technician_notes: techNotes };
    }
    if (tmpl.type === 'single') {
      return { result: simpleValues.interpretation || '', result_value: simpleValues.value || null, result_unit: simpleValues.unit || null, reference_range: simpleValues.range || null, result_flag: simpleValues.flag || 'normal', technician_notes: techNotes };
    }
    return { result: '', result_flag: 'normal', technician_notes: techNotes };
  };

  const handleSubmitResult = async () => {
    const payload = buildResultPayload();
    if (!payload.result && !payload.result_value) { toast.error('Please enter the result'); return; }
    // payment check before submitting (bypassed for inpatients)
    const isReqInpatient = activeTab === 'inpatient' || selected?.visit_type === 'inpatient' || selected?.visit_status === 'inpatient' || selected?.patient_type === 'inpatient' || selected?.notes?.toLowerCase()?.includes('inpatient') || selected?.notes?.toLowerCase()?.includes('ward');
    if (!isReqInpatient) {
      try {
        const billRes = await api.get(`/billing/visit/${selected.visit_id}`);
        const items = billRes.data?.data?.items || [];
        const testBill = items.find(i => i.item_type === 'laboratory' && i.item_name?.trim().toLowerCase() === selected.test_name?.trim().toLowerCase());
        if (testBill && testBill.status === 'pending') {
          toast.error(`Test '${selected.test_name}' is unpaid! Balance: KES ${parseFloat(testBill.total_price||0).toLocaleString()}. Patient must pay for this test at reception first.`);
          return;
        }
      } catch (e) {
        const msg = e.response?.data?.message || '';
        if (e.response?.status === 402) {
          toast.error('💳 ' + msg);
          return;
        }
      }
    }
    setSaving(true);
    try {
      await api.put(`/lab-requests/${selected.id}/result`, payload);
      toast.success(
        isReqInpatient
          ? '✅ Results saved! Test moved from Queue to Lab History & Inpatient Ward record.'
          : '✅ Results saved! Test moved from Queue to Lab History & sent back to Doctor.'
      );
      setView('list');
      fetchRequests();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to save results'); }
    finally { setSaving(false); }
  };

  const filtered = requests.filter(r => {
    if (flagFilter && r.result_flag !== flagFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.patient_name?.toLowerCase().includes(q) ||
      r.patient_number?.toLowerCase().includes(q) ||
      r.test_name?.toLowerCase().includes(q) ||
      r.doctor_name?.toLowerCase().includes(q) ||
      r.technician_name?.toLowerCase().includes(q) ||
      r.visit_number?.toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    const timeA = new Date(a.created_at || a.requested_at || 0).getTime();
    const timeB = new Date(b.created_at || b.requested_at || 0).getTime();
    if (timeB !== timeA) return timeB - timeA;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });

  // ── DETAIL VIEW ──────────────────────────────────────────────────────────────
  if (view === 'detail' && selected) {
    const urgColor = URGENCY_COLORS[selected.urgency] || 'var(--text-muted)';
    const stColor  = STATUS_COLORS[selected.status]   || 'var(--text-muted)';
    const stLabel  = STATUS_LABELS[selected.status]   || selected.status;
    const tmpl = TEMPLATES[templateKey];

    return (
      <div style={{ height:'100vh', overflow:'auto', padding:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24, flexWrap:'wrap' }}>
          <Btn variant="ghost" onClick={() => setView('list')}><ArrowLeft size={15}/> Back to {activeTab === 'history' ? 'History' : 'Queue'}</Btn>
          <div style={{ flex:1 }}>
            <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)' }}>🔬 {selected.test_name}</h1>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              {selected.test_code && <span style={{ fontFamily:'monospace', color:'var(--accent)', marginRight:8 }}>{selected.test_code}</span>}
              {selected.visit_number}
            </div>
          </div>
          <span style={{ fontSize:12, padding:'4px 12px', borderRadius:20, fontWeight:700, background:`${urgColor}20`, color:urgColor, textTransform:'capitalize' }}>{selected.urgency}</span>
          <span style={{ fontSize:12, padding:'4px 12px', borderRadius:20, fontWeight:700, background:`${stColor}20`, color:stColor }}>{stLabel}</span>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <Card style={{ padding:20 }}>
              <div style={{ textAlign:'center', marginBottom:16 }}>
                <div style={{ fontSize:40, marginBottom:8 }}>{selected.gender==='male'?'👨':selected.gender==='female'?'👩':'👤'}</div>
                <div style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)' }}>{selected.patient_name}</div>
                <div style={{ fontSize:12, color:'var(--accent)', fontFamily:'monospace', marginTop:4 }}>{selected.patient_number}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{selected.gender} · {getAge(selected.date_of_birth)}</div>
              </div>
              {selected.allergies && (
                <div style={{ padding:'8px 12px', background:'var(--danger)15', borderRadius:8 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--danger)', marginBottom:2 }}>⚠ ALLERGIES</div>
                  <div style={{ fontSize:12, color:'var(--text-primary)' }}>{selected.allergies}</div>
                </div>
              )}
            </Card>
            <Card style={{ padding:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>Request Info</div>
              {[
                { label:'Doctor', value:selected.doctor_name },
                { label:'Diagnosis', value:selected.diagnosis||'—' },
                { label:'ICD-11', value:selected.icd_code||'—' },
                { label:'Urgency', value:selected.urgency },
                { label:'Requested', value:new Date(selected.created_at).toLocaleString('en-KE') },
                { label:'Notes', value:selected.notes||'—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                  <span style={{ color:'var(--text-muted)' }}>{label}</span>
                  <span style={{ color:'var(--text-primary)', fontWeight:500, textAlign:'right', maxWidth:160, wordBreak:'break-word' }}>{value}</span>
                </div>
              ))}
            </Card>
            {selected.status !== 'completed' && selected.status !== 'cancelled' && (
              <Card style={{ padding:16 }}>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {selected.status === 'pending' && (
                    <Btn onClick={() => handleStatusUpdate(selected.id, 'processing')} style={{ justifyContent:'center' }}>
                      <FlaskConical size={14}/> Start Processing
                    </Btn>
                  )}
                  <Btn variant="ghost" onClick={() => handleStatusUpdate(selected.id, 'cancelled')} style={{ justifyContent:'center', color:'var(--danger)' }}>
                    <X size={14}/> Cancel Request
                  </Btn>
                </div>
              </Card>
            )}
          </div>

          <div>
            {selected.status === 'completed' ? (
              <Card style={{ padding:24 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, flexWrap:'wrap' }}>
                  <CheckCircle size={20} color="var(--accent)"/>
                  <div style={{ fontSize:16, fontWeight:700, color:'var(--accent)' }}>Results Completed</div>
                  <Btn size="sm" variant="ghost" onClick={() => handleStatusUpdate(selected.id, "processing")} style={{ marginLeft:12 }}>✏️ Edit Results</Btn>
                  {selected.resulted_at && <span style={{ fontSize:12, color:'var(--text-muted)', marginLeft:'auto' }}>Resulted: {new Date(selected.resulted_at).toLocaleString('en-KE')}</span>}
                  <button onClick={() => printLabResult(selected, user?.pharmacy)} style={{ marginLeft:8, padding:"6px 12px", background:"var(--accent)", border:"none", borderRadius:6, color:"#0F1612", fontSize:12, fontWeight:600, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:4 }}><Printer size={13} /> Print Result</button>
                  <button onClick={() => handleDownloadPDF(selected)} style={{ marginLeft:8, padding:"6px 12px", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:6, color:"var(--text-primary)", fontSize:12, fontWeight:600, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:4 }}><Download size={13} /> PDF</button>
                </div>
                <ResultRenderer result={selected.result} testName={selected.test_name} />
                {selected.technician_notes && (
                  <div style={{ padding:16, background:'var(--bg-elevated)', borderRadius:10, marginTop:12 }}>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6, fontWeight:600 }}>TECHNICIAN NOTES</div>
                    <div style={{ fontSize:13, color:'var(--text-primary)' }}>{selected.technician_notes}</div>
                  </div>
                )}
              </Card>
            ) : (
              <Card style={{ padding:24 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
                  <div style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:8 }}>
                    <FlaskConical size={18} color="var(--accent)"/> Enter Test Results
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:12, color:'var(--text-muted)' }}>Template:</span>
                    <select value={templateKey||''} onChange={e => { setTemplateKey(e.target.value||null); setTableValues({}); setSimpleValues({ flag:'normal' }); }}
                      style={{ ...sel, width:'auto', fontSize:12 }}>
                      <option value="">Free Text</option>
                      {Object.entries(TEMPLATES).map(([k, t]) => (
                        <option key={k} value={k}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {selected.status === 'pending' && (
                  <div style={{ padding:12, background:'var(--warning)15', borderRadius:8, marginBottom:16, fontSize:12, color:'var(--warning)' }}>
                    ⚠ Click "Start Processing" first before entering results
                  </div>
                )}

                {tmpl && (
                  <div style={{ padding:'6px 12px', background:'var(--accent-soft)', borderRadius:8, marginBottom:16, fontSize:12, color:'var(--accent)', fontWeight:600 }}>
                    ✓ Template auto-detected: {tmpl.label}
                  </div>
                )}

                {!templateKey && <FreeTextTemplate values={simpleValues} onChange={(k,v) => setSimpleValues(p => ({ ...p, [k]:v }))} />}
                {templateKey && TEMPLATES[templateKey]?.type === 'table' && (
                  <TableTemplate sections={TEMPLATES[templateKey].sections} values={tableValues}
                    onChange={(param, field, val) => setTableValues(p => ({ ...p, [param]: { ...(p[param]||{}), [field]: val } }))} />
                )}
                {templateKey === 'urinalysis' && (
                  <UrinalysisTemplate values={simpleValues} onChange={(k,v) => setSimpleValues(p => ({ ...p, [k]:v }))} />
                )}
                {templateKey && TEMPLATES[templateKey]?.type === 'titration' && (
                  <TitrationTemplate rows={TEMPLATES[templateKey].rows} values={simpleValues}
                    onChange={(k,v) => setSimpleValues(p => ({ ...p, [k]:v }))} />
                )}
                {templateKey && TEMPLATES[templateKey]?.type === 'posneg' && (
                  <PosNegTemplate testName={selected.test_name} values={simpleValues} onChange={(k,v) => setSimpleValues(p => ({ ...p, [k]:v }))} />
                )}
                {templateKey && TEMPLATES[templateKey]?.type === 'single' && (
                  <SingleTemplate values={simpleValues} onChange={(k,v) => setSimpleValues(p => ({ ...p, [k]:v }))} />
                )}

                <div style={{ marginTop:16, paddingTop:16, borderTop:'1px solid var(--border)' }}>
                  <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>Technician Notes (Optional)</label>
                  <textarea value={techNotes} onChange={e => setTechNotes(e.target.value)} rows={2}
                    placeholder="Additional observations..."
                    style={{ width:'100%', padding:'10px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none', resize:'vertical', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' }} />
                </div>

                <Btn onClick={handleSubmitResult} disabled={saving || selected.status==='pending'} style={{ width:'100%', justifyContent:'center', padding:14, marginTop:16 }}>
                  {saving ? <><Loader size={15} style={{ animation:'spin 0.8s linear infinite' }}/> Saving...</> : '✅ Submit Results & Move to History'}
                </Btn>
              </Card>
            )}
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── LIST / REPORTS / HISTORY VIEW ─────────────────────────────────────────────
  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'16px 24px', borderBottom:'1px solid var(--border)', background:'var(--bg-surface)', flexShrink:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:12 }}>
          <div>
            <h1 style={{ fontSize:20, fontWeight:800, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:10 }}>
              {activeTab === 'history' ? '📜 Lab Result History' : activeTab === 'reports' ? '📊 Lab Analytics & Reports' : activeTab === 'inpatient' ? '🏥 Inpatient Laboratory Queue' : '🔬 Outpatient Laboratory Queue'}
              {activeTab !== 'history' && activeTab !== 'reports' && parseInt(stats.pending) > 0 && (
                <span style={{ fontSize:12, padding:'3px 10px', borderRadius:20, background:'var(--warning)20', color:'var(--warning)', fontWeight:700 }}>
                  {stats.pending} pending
                </span>
              )}
            </h1>
            <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              {user?.full_name} · {activeTab === 'history' ? 'Completed Patient Lab Test Records & Official Results' : activeTab === 'reports' ? 'Analytics & MOH 706 Reports' : 'Active Patient Lab Orders (Pending & In-Progress)'}
            </p>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <Btn variant="ghost" onClick={() => window.location.href = '/app/stock/expired'} style={{ borderColor: 'var(--warning)50', color: 'var(--warning)' }}>
              <FlaskConical size={14}/> Reagents Expiry
            </Btn>
            <Btn variant="ghost" onClick={fetchRequests}><RefreshCw size={14}/> Refresh</Btn>
          </div>
        </div>

        {/* Global Tab Switcher for Laboratory Views */}
        <div style={{ display:'flex', background:'var(--bg-elevated)', borderRadius:10, padding:4, width:'fit-content', marginBottom:14, border:'1px solid var(--border)', flexWrap:'wrap', gap:4 }}>
          <button onClick={() => { setActiveTab('requests'); setStatusFilter(''); }}
            style={{ padding:'7px 16px', borderRadius:7, background: activeTab==='requests' ? 'var(--accent)' : 'transparent', color: activeTab==='requests' ? '#0F1612' : 'var(--text-muted)', fontWeight:700, border:'none', cursor:'pointer', fontSize:13, display:'inline-flex', alignItems:'center', gap:6 }}>
            <FlaskConical size={14}/> Outpatient Queue
            {parseInt(stats.pending) > 0 && activeTab !== 'requests' && (
              <span style={{ fontSize:10, padding:'1px 6px', borderRadius:10, background:'var(--warning)', color:'#0F1612', fontWeight:800 }}>{stats.pending}</span>
            )}
          </button>
          <button onClick={() => { setActiveTab('inpatient'); setStatusFilter(''); }}
            style={{ padding:'7px 16px', borderRadius:7, background: activeTab==='inpatient' ? 'var(--accent)' : 'transparent', color: activeTab==='inpatient' ? '#0F1612' : 'var(--text-muted)', fontWeight:700, border:'none', cursor:'pointer', fontSize:13, display:'inline-flex', alignItems:'center', gap:6 }}>
            🏥 Inpatient Queue
          </button>
          <button onClick={() => {
            setActiveTab('history');
            setStatusFilter('completed');
            setDateFrom(today);
            setDateTo(today);
            setActiveDatePreset('today');
          }}
            style={{ padding:'7px 16px', borderRadius:7, background: activeTab==='history' ? 'var(--accent)' : 'transparent', color: activeTab==='history' ? '#0F1612' : 'var(--text-muted)', fontWeight:700, border:'none', cursor:'pointer', fontSize:13, display:'inline-flex', alignItems:'center', gap:6 }}>
            <Clock size={14}/> Lab History
            {parseInt(stats.completed) > 0 && (
              <span style={{ fontSize:10, padding:'1px 6px', borderRadius:10, background: activeTab==='history' ? '#0F1612' : 'var(--accent)', color: activeTab==='history' ? 'var(--accent)' : '#0F1612', fontWeight:800 }}>{stats.completed}</span>
            )}
          </button>
          <button onClick={() => setActiveTab('reports')}
            style={{ padding:'7px 16px', borderRadius:7, background: activeTab==='reports' ? 'var(--accent)' : 'transparent', color: activeTab==='reports' ? '#0F1612' : 'var(--text-muted)', fontWeight:700, border:'none', cursor:'pointer', fontSize:13, display:'inline-flex', alignItems:'center', gap:6 }}>
            <FileText size={14}/> MOH 706 Reports
          </button>
        </div>

        {(activeTab === 'requests' || activeTab === 'inpatient' || activeTab === 'history') && (
          <>
            {/* Quick Stats bar */}
            <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
              {[
                { label:'Total In Filter', value:stats.total||0, color:'var(--text-primary)', filter:'' },
                { label:'Pending Orders', value:stats.pending||0, color:'var(--warning)', filter:'pending' },
                { label:'In Processing', value:stats.processing||0, color:'var(--info)', filter:'processing' },
                { label:'Completed Tests', value:stats.completed||0, color:'var(--accent)', filter:'completed' },
                { label:'Emergency', value:stats.emergency||0, color:'var(--danger)', filter:'' },
                { label:'Urgent', value:stats.urgent||0, color:'var(--warning)', filter:'' },
              ].map(({ label, value, color, filter }) => (
                <div key={label} onClick={() => filter && setStatusFilter(statusFilter===filter?'':filter)}
                  style={{ padding:'8px 14px', borderRadius:8, cursor:filter?'pointer':'default', background:statusFilter===filter&&filter?`${color}20`:'var(--bg-elevated)', border:`1px solid ${statusFilter===filter&&filter?color:'var(--border)'}` }}>
                  <div style={{ fontSize:18, fontWeight:800, color, lineHeight:1 }}>{value}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* History Date Presets when in Lab History */}
            {activeTab === 'history' && (
              <div style={{ display:'flex', gap:6, marginBottom:12, alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ fontSize:12, fontWeight:700, color:'var(--text-muted)', marginRight:4 }}>📅 Date Range:</span>
                {[
                  { key:'today', label:'Today' },
                  { key:'yesterday', label:'Yesterday' },
                  { key:'week', label:'Last 7 Days' },
                  { key:'month', label:'This Month' },
                  { key:'all', label:'All Time' },
                ].map(preset => (
                  <button key={preset.key} onClick={() => setQuickDate(preset.key)}
                    style={{
                      padding:'5px 12px', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer',
                      background: activeDatePreset === preset.key ? 'var(--accent)' : 'var(--bg-elevated)',
                      color: activeDatePreset === preset.key ? '#0F1612' : 'var(--text-primary)',
                      border: '1px solid var(--border)'
                    }}>
                    {preset.label}
                  </button>
                ))}
              </div>
            )}

            {/* Search & Filter Controls */}
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
              <div style={{ flex:1, position:'relative', minWidth:220 }}>
                <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient name, number, test name, doctor..."
                  style={{ width:'100%', padding:'9px 9px 9px 32px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
                {search && <button onClick={() => setSearch('')} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}><X size={13}/></button>}
              </div>

              {activeTab === 'history' ? (
                <select value={visitTypeFilter} onChange={e => setVisitTypeFilter(e.target.value)}
                  style={{ padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none' }}>
                  <option value="">All Care Types</option>
                  <option value="outpatient">Outpatient Only</option>
                  <option value="inpatient">Inpatient Only</option>
                </select>
              ) : null}

              {activeTab === 'history' ? (
                <select value={flagFilter} onChange={e => setFlagFilter(e.target.value)}
                  style={{ padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none' }}>
                  <option value="">All Result Flags</option>
                  <option value="normal">Normal</option>
                  <option value="high">High ↑</option>
                  <option value="low">Low ↓</option>
                  <option value="critical">Critical ⚠</option>
                </select>
              ) : (
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  style={{ padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none' }}>
                  <option value="">All Active (Pending & Processing)</option>
                  <option value="pending">Pending Only</option>
                  <option value="processing">Processing Only</option>
                  <option value="all">All Status (Inc. Completed)</option>
                </select>
              )}

              <select value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value)}
                style={{ padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none' }}>
                <option value="">All Urgency</option>
                <option value="emergency">Emergency</option>
                <option value="urgent">Urgent</option>
                <option value="routine">Routine</option>
              </select>

              <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--bg-elevated)', padding:'4px 8px', borderRadius:8, border:'1px solid var(--border)' }}>
                <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600 }}>From:</span>
                <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setActiveDatePreset('custom'); }}
                  style={{ background:'transparent', border:'none', color:'var(--text-primary)', fontSize:12, outline:'none', cursor:'pointer' }}/>
                <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600 }}>To:</span>
                <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setActiveDatePreset('custom'); }}
                  style={{ background:'transparent', border:'none', color:'var(--text-primary)', fontSize:12, outline:'none', cursor:'pointer' }}/>
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ flex:1, overflow:'auto', padding:20 }}>
        {(activeTab === 'requests' || activeTab === 'inpatient' || activeTab === 'history') && (
          loading ? (
            <div style={{ textAlign:'center', padding:80 }}><Loader size={32} color="var(--accent)" style={{ animation:'spin 0.8s linear infinite' }}/></div>
          ) : filtered.length === 0 ? (
            <Card style={{ padding:60, textAlign:'center' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>{activeTab === 'history' ? '📜' : '🔬'}</div>
              <div style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', marginBottom:6 }}>
                {activeTab === 'history' ? 'No completed lab history found' : 'All caught up! No active lab requests pending'}
              </div>
              <div style={{ fontSize:13, color:'var(--text-muted)' }}>
                {activeTab === 'history'
                  ? 'Completed lab tests for the selected date range will appear here.'
                  : 'New requests from doctors and ward orders will appear here automatically.'}
              </div>
              {activeTab === 'history' && activeDatePreset === 'today' && (
                <div style={{ marginTop:14 }}>
                  <Btn size="sm" variant="ghost" onClick={() => setQuickDate('all')}>
                    <Clock size={12}/> View All Time Lab History
                  </Btn>
                </div>
              )}
            </Card>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {filtered.map(req => {
                const urgColor = URGENCY_COLORS[req.urgency] || 'var(--text-muted)';
                const stColor  = STATUS_COLORS[req.status]   || 'var(--text-muted)';
                const stLabel  = STATUS_LABELS[req.status]   || req.status;
                const autoTmpl = detectTemplate(req.test_name);
                const billData = payStatus[req.visit_id] || {};
                const billItems = billData.items || [];
                const testBill = billItems.find(i => i.item_type === 'laboratory' && i.item_name?.trim().toLowerCase() === req.test_name?.trim().toLowerCase());
                const isInpatient = req.is_inpatient || req.ward_name || req.visit_type === 'inpatient' || req.visit_status === 'inpatient';
                const isPaid = !testBill || testBill.status !== 'pending';
                const isCleared = isPaid || isInpatient;
                const testPrice = testBill ? parseFloat(testBill.total_price || 0) : 0;
                const payBorderColor = isInpatient ? '#3b82f6' : (!testBill ? 'var(--border)' : isPaid ? '#10b981' : '#ef4444');
                const flagColor = FLAG_COLORS[req.result_flag || 'normal'];
                const flagLabel = FLAG_LABELS[req.result_flag || 'normal'];

                return (
                  <Card key={req.id} style={{ padding:0, overflow:'hidden', cursor:'pointer', borderLeft:`4px solid ${urgColor}`, borderTop:`2px solid ${activeTab === 'history' ? flagColor : payBorderColor}` }}
                    onClick={() => openDetail(req)}
                    onMouseEnter={e => e.currentTarget.style.boxShadow='0 0 0 1px var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow='none'}>
                    <div style={{ padding:'14px 18px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                            <span style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>{req.test_name}</span>
                            {req.test_code && <span style={{ fontSize:11, color:'var(--accent)', fontFamily:'monospace', background:'var(--accent-soft)', padding:'1px 6px', borderRadius:4 }}>{req.test_code}</span>}
                            <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:700, background:`${urgColor}20`, color:urgColor, textTransform:'capitalize' }}>{req.urgency}</span>
                            
                            {req.status === 'completed' && req.result_flag && (
                              <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:700, background:`${flagColor}20`, color:flagColor }}>
                                {flagLabel}
                              </span>
                            )}

                            {isInpatient && (
                              <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:700, background:'#3b82f620', color:'#3b82f6' }}>
                                🏥 Inpatient: {req.ward_name || 'Ward'} {req.bed_number ? `(${req.bed_number})` : ''}
                              </span>
                            )}
                            {autoTmpl && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, fontWeight:700, background:'var(--accent-soft)', color:'var(--accent)' }}>📋 {TEMPLATES[autoTmpl].label}</span>}
                          </div>
                          
                          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
                            <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{req.patient_name}</span>
                            <span style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'monospace' }}>{req.patient_number}</span>
                            <span style={{ fontSize:11, color:'var(--text-muted)' }}>{req.gender} · {getAge(req.date_of_birth)}</span>
                          </div>

                          <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
                            <span style={{ fontSize:11, color:'var(--text-muted)' }}>Dr. {req.doctor_name || 'Inpatient Care'}</span>
                            {req.diagnosis && <span style={{ fontSize:11, color:'var(--accent)' }}>Dx: {req.diagnosis}</span>}
                            {req.technician_name && req.status === 'completed' && (
                              <span style={{ fontSize:11, color:'var(--text-muted)' }}>Tech: {req.technician_name}</span>
                            )}
                          </div>

                          {/* Result Snippet for completed records */}
                          {req.status === 'completed' && (req.result_value || req.result) && (
                            <div style={{ marginTop:8, padding:'6px 10px', background:'var(--bg-elevated)', borderRadius:6, fontSize:12, color:'var(--text-primary)', border:'1px solid var(--border)' }}>
                              {req.result_value ? (
                                <span><strong>Result:</strong> {req.result_value} {req.result_unit || ''} {req.reference_range ? `(Ref: ${req.reference_range})` : ''}</span>
                              ) : (
                                <span style={{ fontFamily:'monospace', fontSize:11, color:'var(--text-muted)' }}>
                                  {req.result.slice(0, 120)}{req.result.length > 120 ? '...' : ''}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
                          <span style={{ fontSize:11, padding:'4px 10px', borderRadius:20, fontWeight:700, background:`${stColor}20`, color:stColor }}>{stLabel}</span>
                          {req.status !== 'completed' ? (
                            <span style={{ fontSize:10, padding:'3px 8px', borderRadius:20, fontWeight:700, background: isInpatient ? '#3b82f620' : (isPaid ? '#10b98120' : '#ef444420'), color: isInpatient ? '#3b82f6' : (isPaid ? '#10b981' : '#ef4444') }}>
                              {isInpatient ? '🏥 Inpatient Account' : (isPaid ? '✅ Paid' : `❌ Unpaid KES ${testPrice.toLocaleString()}`)}
                            </span>
                          ) : (
                            <span style={{ fontSize:10, padding:'3px 8px', borderRadius:20, fontWeight:700, background:'#10b98120', color:'#10b981' }}>
                              ✓ Resulted
                            </span>
                          )}
                          <span style={{ fontSize:11, color:'var(--text-faint)' }}>
                            {req.resulted_at
                              ? new Date(req.resulted_at).toLocaleString('en-KE', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
                              : new Date(req.created_at).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})}
                          </span>
                          <ChevronRight size={16} color="var(--accent)"/>
                        </div>
                      </div>

                      {/* Action buttons footer */}
                      <div style={{ display:'flex', gap:6, marginTop:10, paddingTop:10, borderTop:'1px solid var(--border)', flexWrap:'wrap', alignItems:'center' }}
                        onClick={e => e.stopPropagation()}>
                        {req.status === 'completed' ? (
                          <>
                            <Btn size="sm" variant="ghost" onClick={() => openDetail(req)}>
                              <FileText size={12}/> View Full Report
                            </Btn>
                            <Btn size="sm" variant="ghost" onClick={() => printLabResult(req, user?.pharmacy)}>
                              <Printer size={12}/> Print Result
                            </Btn>
                            <Btn size="sm" variant="ghost" onClick={() => handleDownloadPDF(req)}>
                              <Download size={12}/> PDF
                            </Btn>
                            <Btn size="sm" variant="ghost" onClick={() => openDetail(req)} style={{ color:'var(--accent)' }}>
                              <Edit3 size={12}/> Edit Results
                            </Btn>
                          </>
                        ) : (
                          <>
                            {req.status === 'pending' && (
                              <>
                                <Btn size="sm" onClick={() => handleStatusUpdate(req.id, 'processing', req.test_name, req.visit_id)}
                                  style={{ opacity: !isCleared ? 0.5 : 1 }}
                                  title={!isCleared ? 'Payment required before processing' : ''}>
                                  <FlaskConical size={11}/> Start Processing
                                </Btn>
                                {!isCleared && (
                                  <Btn size="sm" onClick={() => handleQuickPay(req.visit_id, req.test_name)} style={{ background: 'var(--accent)', color: '#0F1612' }}>
                                    💳 Instant Settle
                                  </Btn>
                                )}
                              </>
                            )}
                            {req.status === 'processing' && (
                              <Btn size="sm" variant="success" onClick={() => openDetail(req)}>
                                <CheckCircle size={11}/> Enter Results
                              </Btn>
                            )}
                            <Btn size="sm" variant="ghost" onClick={() => openDetail(req)}>
                              <FileText size={11}/> View Details
                            </Btn>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        )}

        {activeTab === 'reports' && <MOH706Report user={user} />}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
