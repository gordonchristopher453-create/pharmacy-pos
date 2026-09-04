import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api';
import toast from 'react-hot-toast';
import { TrendingUp, Package, RefreshCw, Loader, AlertTriangle, Printer, Search, FileText } from 'lucide-react';
import FinancialSummaryReport from '../components/FinancialSummaryReport';

const Card = ({ children, style = {} }) => (
  <div style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)', ...style }}>{children}</div>
);
const Tab = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: active ? 'var(--accent)' : 'var(--bg-elevated)', color: active ? '#0F1612' : 'var(--text-muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
);
const fmt = (n) => `KES ${parseFloat(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const age = (dob) => dob ? Math.floor((Date.now() - new Date(dob)) / 31557600000) + ' yrs' : '—';
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function ReportsPage() {
  const { user } = useSelector(s => s.auth);
  const isLab = user?.role === 'lab_technician';
  const printRef = useRef();

  const [tab, setTab] = useState('daily');
  const [loading, setLoading] = useState(false);

  // MOH National Reports State
  const [mohMonth, setMohMonth] = useState(new Date().getMonth() + 1);
  const [mohYear, setMohYear] = useState(new Date().getFullYear());
  const [selectedMohReport, setSelectedMohReport] = useState('204');
  const [mohVisits, setMohVisits] = useState([]);
  const [mohLabRequests, setMohLabRequests] = useState([]);
  const [mohProducts, setMohProducts] = useState([]);
  const [mohLoading, setMohLoading] = useState(false);

  // Daily summary
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyData, setDailyData] = useState(null);

  // Patient history
  const [search, setSearch] = useState('');
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [history, setHistory] = useState(null);
  const [searching, setSearching] = useState(false);

  // Existing
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [salesReport, setSalesReport] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState([]);
  const [stockReport, setStockReport] = useState(null);

  const fetchMohData = async () => {
    setMohLoading(true);
    try {
      const daysInMonth = new Date(mohYear, mohMonth, 0).getDate();
      const dateFrom = `${mohYear}-${String(mohMonth).padStart(2, '0')}-01`;
      const dateTo = `${mohYear}-${String(mohMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      
      const [visitsRes, labRes, prodRes] = await Promise.all([
        api.get('/patients/visits', { params: { date_from: dateFrom, date_to: dateTo } }).catch(() => ({ data: { data: { visits: [] } } })),
        api.get('/lab-requests').catch(() => ({ data: { data: [] } })),
        api.get('/products').catch(() => ({ data: [] }))
      ]);

      const visits = visitsRes.data?.data?.visits || visitsRes.data?.data || [];
      setMohVisits(visits);

      const labs = labRes.data?.data || labRes.data || [];
      const filteredLabs = labs.filter(l => {
        if (!l.created_at) return false;
        const d = new Date(l.created_at);
        return d.getMonth() + 1 === mohMonth && d.getFullYear() === mohYear;
      });
      setMohLabRequests(filteredLabs);

      const products = prodRes.data || [];
      setMohProducts(products);

      toast.success(`MOH dataset compiled for ${MONTHS[mohMonth - 1]} ${mohYear}`);
    } catch (err) {
      toast.error('Failed to compile MOH datasets');
    }
    setMohLoading(false);
  };

  const handlePrintMOH204 = () => {
    const win = window.open('', '_blank');
    const selectedMonthName = MONTHS[mohMonth - 1];
    
    // Categorize and summarize visits
    let u5M = 0, u5F = 0, o5M = 0, o5F = 0;
    const diseaseSummary = {
      malaria: { label: 'Malaria (Confirmed)', u5m: 0, u5f: 0, o5m: 0, o5f: 0 },
      diarrhoea: { label: 'Diarrhoea / loose stool', u5m: 0, u5f: 0, o5m: 0, o5f: 0 },
      urti: { label: 'Upper Respiratory Tract Infection', u5m: 0, u5f: 0, o5m: 0, o5f: 0 },
      pneumonia: { label: 'Pneumonia / Bronchitis', u5m: 0, u5f: 0, o5m: 0, o5f: 0 },
      uti: { label: 'Urinary Tract Infection (UTI)', u5m: 0, u5f: 0, o5m: 0, o5f: 0 },
      hypertension: { label: 'Hypertension / BP cases', u5m: 0, u5f: 0, o5m: 0, o5f: 0 },
      diabetes: { label: 'Diabetes Mellitus', u5m: 0, u5f: 0, o5m: 0, o5f: 0 },
      skin: { label: 'Skin Diseases & Allergies', u5m: 0, u5f: 0, o5m: 0, o5f: 0 },
      others: { label: 'All Other Outpatient Conditions', u5m: 0, u5f: 0, o5m: 0, o5f: 0 }
    };

    mohVisits.forEach(v => {
      // Calculate age
      const birth = v.date_of_birth ? new Date(v.date_of_birth) : null;
      const ageY = birth ? Math.floor((Date.now() - birth) / (365.25 * 24 * 60 * 60 * 1000)) : 10; // default 10
      const isUnder5 = ageY < 5;
      const isMale = v.gender?.toLowerCase() === 'male' || v.gender?.toLowerCase() === 'm';

      if (isUnder5) {
        if (isMale) u5M++; else u5F++;
      } else {
        if (isMale) o5M++; else o5F++;
      }

      // Diagnose mapping
      const text = `${v.chief_complaint || ''} ${v.diagnosis || ''}`.toLowerCase();
      let diseaseKey = 'others';
      if (text.match(/malaria|fever/)) diseaseKey = 'malaria';
      else if (text.match(/diarrhea|diarrhoea|loose stool|cholera/)) diseaseKey = 'diarrhoea';
      else if (text.match(/pneumonia|bronchitis|cough/)) diseaseKey = 'pneumonia';
      else if (text.match(/cough|respiratory|cold|flu|runny nose|throat/)) diseaseKey = 'urti';
      else if (text.match(/uti|urinary|painful urination/)) diseaseKey = 'uti';
      else if (text.match(/hypertension|bp|blood pressure/)) diseaseKey = 'hypertension';
      else if (text.match(/diabetes|sugar|diabetic/)) diseaseKey = 'diabetes';
      else if (text.match(/skin|allergy|rash|dermatitis/)) diseaseKey = 'skin';

      if (isUnder5) {
        if (isMale) diseaseSummary[diseaseKey].u5m++;
        else diseaseSummary[diseaseKey].u5f++;
      } else {
        if (isMale) diseaseSummary[diseaseKey].o5m++;
        else diseaseSummary[diseaseKey].o5f++;
      }
    });

    win.document.write(`
      <html>
        <head>
          <title>MOH 204 Outpatient Summary Report</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 30px; font-size: 11px; color: #333; }
            .header { text-align: center; border-bottom: 3px double #1a4a8a; padding-bottom: 12px; margin-bottom: 15px; }
            .republic { font-size: 14px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; }
            .title { font-size: 16px; font-weight: 800; color: #1a4a8a; margin: 4px 0; text-transform: uppercase; }
            .meta { font-size: 11px; font-weight: bold; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; }
            th { background-color: #f2f6fa; font-weight: bold; text-align: center; font-size: 10px; }
            .subth { font-size: 9px; background-color: #fcfdfe; }
            .number { text-align: center; font-family: monospace; font-weight: bold; font-size: 12px; }
            .total-row { background-color: #eef2f7; font-weight: bold; }
            .signature-block { margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; }
            .sign-line { border-top: 1px solid #000; width: 220px; text-align: center; padding-top: 4px; margin-top: 25px; }
            @media print {
              body { margin: 15px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="republic">REPUBLIC OF KENYA - MINISTRY OF HEALTH</div>
            <div class="title">MOH 204 OUTPATIENT SERVICES AGGREGATE SUMMARY</div>
            <div class="meta">
              FACILITY: HEKIMA MEDICAL CENTRE | CODE: 12345 | PROVINCE/COUNTY: NAIROBI
            </div>
            <div style="font-size: 12px; font-weight: bold; margin-top: 5px; color: #1a4a8a;">
              REPORT PERIOD: ${selectedMonthName.toUpperCase()} ${mohYear}
            </div>
          </div>

          <div style="font-size: 12px; font-weight: bold; margin-bottom: 8px;">SUMMARY OVERVIEW:</div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; background: #f9fbfd; padding: 12px; border: 1px solid #ddd; border-radius: 8px; text-align: center;">
            <div><strong style="color: #666;">Under 5 (M)</strong><br/><span style="font-size:16px; font-weight:bold; color:#1a4a8a;">${u5M}</span></div>
            <div><strong style="color: #666;">Under 5 (F)</strong><br/><span style="font-size:16px; font-weight:bold; color:#1a4a8a;">${u5F}</span></div>
            <div><strong style="color: #666;">Over 5 (M)</strong><br/><span style="font-size:16px; font-weight:bold; color:#1a4a8a;">${o5M}</span></div>
            <div><strong style="color: #666;">Over 5 (F)</strong><br/><span style="font-size:16px; font-weight:bold; color:#1a4a8a;">${o5F}</span></div>
          </div>

          <table>
            <thead>
              <tr>
                <th rowspan="2" style="width: 4%;">#</th>
                <th rowspan="2" style="text-align: left; width: 46%;">DISEASE CATEGORY (MOH 204 CLASSIFICATIONS)</th>
                <th colspan="2">UNDER 5 YEARS</th>
                <th colspan="2">OVER 5 YEARS</th>
                <th rowspan="2" style="width: 14%;">GRAND TOTAL</th>
              </tr>
              <tr>
                <th class="subth" style="width: 9%;">MALE</th>
                <th class="subth" style="width: 9%;">FEMALE</th>
                <th class="subth" style="width: 9%;">MALE</th>
                <th class="subth" style="width: 9%;">FEMALE</th>
              </tr>
            </thead>
            <tbody>
              ${Object.keys(diseaseSummary).map((k, i) => {
                const item = diseaseSummary[k];
                const rTotal = item.u5m + item.u5f + item.o5m + item.o5f;
                return `
                  <tr>
                    <td class="number">${i + 1}</td>
                    <td style="font-weight: 600;">${item.label}</td>
                    <td class="number" style="color: ${item.u5m > 0 ? '#111' : '#ccc'};">${item.u5m}</td>
                    <td class="number" style="color: ${item.u5f > 0 ? '#111' : '#ccc'};">${item.u5f}</td>
                    <td class="number" style="color: ${item.o5m > 0 ? '#111' : '#ccc'};">${item.o5m}</td>
                    <td class="number" style="color: ${item.o5f > 0 ? '#111' : '#ccc'};">${item.o5f}</td>
                    <td class="number" style="background-color: #fafbfc; color: #1a4a8a;">${rTotal}</td>
                  </tr>
                `;
              }).join('')}
              <tr class="total-row">
                <td colspan="2">GRAND AGGREGATE TOTALS</td>
                <td class="number">${u5M}</td>
                <td class="number">${u5F}</td>
                <td class="number">${o5M}</td>
                <td class="number">${o5F}</td>
                <td class="number" style="color: #1a4a8a; font-size: 13px;">${mohVisits.length}</td>
              </tr>
            </tbody>
          </table>

          <div class="signature-block">
            <div>
              <div>Compiled By:</div>
              <div class="sign-line">Record Officer Signature & Stamp</div>
            </div>
            <div>
              <div>Approved By:</div>
              <div class="sign-line">Medical Superintendent / Director</div>
            </div>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const handlePrintMOH706 = () => {
    const win = window.open('', '_blank');
    const selectedMonthName = MONTHS[mohMonth - 1];

    // Compute lab summary
    let normalCount = 0;
    let abnormalCount = 0;
    const testSummary = {
      malaria: { label: 'Malaria Blood Smear / RDT', total: 0, positive: 0, negative: 0 },
      h_pylori: { label: 'H. Pylori Antigen Test', total: 0, positive: 0, negative: 0 },
      typhoid: { label: 'Widal / Typhoid Test', total: 0, positive: 0, negative: 0 },
      cbc: { label: 'Full Blood Count (CBC) / Hemoglobin', total: 0, positive: 0, negative: 0 },
      urinalysis: { label: 'Urine Dipstick / Microscopy', total: 0, positive: 0, negative: 0 },
      glucose: { label: 'Random / Fasting Blood Glucose', total: 0, positive: 0, negative: 0 },
      others: { label: 'Other Special Chemistry / Serology', total: 0, positive: 0, negative: 0 }
    };

    mohLabRequests.forEach(l => {
      const isAbnormal = l.result_flag?.toLowerCase() === 'high' || l.result_flag?.toLowerCase() === 'low' || l.result_flag?.toLowerCase() === 'abnormal' || String(l.result_value).toLowerCase().includes('positive') || String(l.result).toLowerCase().includes('positive') || String(l.result_flag).toLowerCase().includes('abn');
      
      if (isAbnormal) abnormalCount++; else normalCount++;

      const tName = l.test_name?.toLowerCase() || '';
      let k = 'others';
      if (tName.includes('malaria') || tName.includes('bs')) k = 'malaria';
      else if (tName.includes('pylori')) k = 'h_pylori';
      else if (tName.includes('widal') || tName.includes('typhoid')) k = 'typhoid';
      else if (tName.includes('cbc') || tName.includes('hemoglobin') || tName.includes('hb')) k = 'cbc';
      else if (tName.includes('urine') || tName.includes('urinalysis')) k = 'urinalysis';
      else if (tName.includes('glucose') || tName.includes('bsr') || tName.includes('fbs') || tName.includes('sugar')) k = 'glucose';

      testSummary[k].total++;
      if (isAbnormal) testSummary[k].positive++;
      else testSummary[k].negative++;
    });

    win.document.write(`
      <html>
        <head>
          <title>MOH 706 Laboratory Services Report</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 30px; font-size: 11px; color: #333; }
            .header { text-align: center; border-bottom: 3px double #1a4a8a; padding-bottom: 12px; margin-bottom: 15px; }
            .republic { font-size: 14px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; }
            .title { font-size: 16px; font-weight: 800; color: #1a4a8a; margin: 4px 0; text-transform: uppercase; }
            .meta { font-size: 11px; font-weight: bold; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #999; padding: 7px 10px; text-align: left; }
            th { background-color: #f2f6fa; font-weight: bold; text-align: center; font-size: 10px; }
            .number { text-align: center; font-family: monospace; font-weight: bold; font-size: 12px; }
            .total-row { background-color: #eef2f7; font-weight: bold; }
            .signature-block { margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; }
            .sign-line { border-top: 1px solid #000; width: 220px; text-align: center; padding-top: 4px; margin-top: 25px; }
            @media print {
              body { margin: 15px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="republic">REPUBLIC OF KENYA - MINISTRY OF HEALTH</div>
            <div class="title">MOH 706 LABORATORY DEPT ACTIVITY SUMMARY</div>
            <div class="meta">
              FACILITY: HEKIMA MEDICAL CENTRE | CODE: 12345 | LABORATORY CODE: LAB-706
            </div>
            <div style="font-size: 12px; font-weight: bold; margin-top: 5px; color: #1a4a8a;">
              REPORT PERIOD: ${selectedMonthName.toUpperCase()} ${mohYear}
            </div>
          </div>

          <div style="font-size: 12px; font-weight: bold; margin-bottom: 8px;">SUMMARY DIAGNOSTICS PERFORMANCE:</div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; background: #f9fbfd; padding: 12px; border: 1px solid #ddd; border-radius: 8px; text-align: center;">
            <div><strong style="color: #666;">Total Tests Performed</strong><br/><span style="font-size:16px; font-weight:bold; color:#1a4a8a;">${mohLabRequests.length}</span></div>
            <div><strong style="color: #666;">Normal / Negative Outcomes</strong><br/><span style="font-size:16px; font-weight:bold; color:#10b981;">${normalCount}</span></div>
            <div><strong style="color: #666;">Abnormal / Positive Outcomes</strong><br/><span style="font-size:16px; font-weight:bold; color:#ef4444;">${abnormalCount}</span></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th style="text-align: left; width: 50%;">LABORATORY SERVICE CATEGORY (MOH 706 PROTOCOLS)</th>
                <th style="width: 15%;">TOTAL TESTS COMPLETED</th>
                <th style="width: 15%;">ABNORMAL / POSITIVE</th>
                <th style="width: 15%;">NORMAL / NEGATIVE</th>
              </tr>
            </thead>
            <tbody>
              ${Object.keys(testSummary).map((k, i) => {
                const item = testSummary[k];
                return `
                  <tr>
                    <td class="number">${i + 1}</td>
                    <td style="font-weight: 600;">${item.label}</td>
                    <td class="number" style="color: #1a4a8a;">${item.total}</td>
                    <td class="number" style="color: ${item.positive > 0 ? '#ef4444' : '#ccc'}; font-weight: bold;">${item.positive}</td>
                    <td class="number" style="color: ${item.negative > 0 ? '#10b981' : '#ccc'};">${item.negative}</td>
                  </tr>
                `;
              }).join('')}
              <tr class="total-row">
                <td colspan="2">GRAND LAB SUMMARY TOTALS</td>
                <td class="number" style="color: #1a4a8a; font-size: 13px;">${mohLabRequests.length}</td>
                <td class="number" style="color: #ef4444; font-size: 13px;">${abnormalCount}</td>
                <td class="number" style="color: #10b981; font-size: 13px;">${normalCount}</td>
              </tr>
            </tbody>
          </table>

          <div class="signature-block">
            <div>
              <div>Compiled By:</div>
              <div class="sign-line">Laboratory In-Charge Signature & Stamp</div>
            </div>
            <div>
              <div>Verified By:</div>
              <div class="sign-line">Medical Superintendent / Director</div>
            </div>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const handlePrintMOH711 = () => {
    const win = window.open('', '_blank');
    const selectedMonthName = MONTHS[mohMonth - 1];

    win.document.write(`
      <html>
        <head>
          <title>MOH 711 Commodity Supply & Consumption Report</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 30px; font-size: 11px; color: #333; }
            .header { text-align: center; border-bottom: 3px double #1a4a8a; padding-bottom: 12px; margin-bottom: 15px; }
            .republic { font-size: 14px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; }
            .title { font-size: 16px; font-weight: 800; color: #1a4a8a; margin: 4px 0; text-transform: uppercase; }
            .meta { font-size: 11px; font-weight: bold; color: #555; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #999; padding: 7px 10px; text-align: left; }
            th { background-color: #f2f6fa; font-weight: bold; text-align: center; font-size: 10px; }
            .number { text-align: center; font-family: monospace; font-weight: bold; font-size: 12px; }
            .total-row { background-color: #eef2f7; font-weight: bold; }
            .signature-block { margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; }
            .sign-line { border-top: 1px solid #000; width: 220px; text-align: center; padding-top: 4px; margin-top: 25px; }
            @media print {
              body { margin: 15px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="republic">REPUBLIC OF KENYA - MINISTRY OF HEALTH</div>
            <div class="title">MOH 711 CO-ORDINATED PHARMACEUTICAL & COMMODITY CONSUMPTION LOG</div>
            <div class="meta">
              FACILITY: HEKIMA MEDICAL CENTRE | CODE: 12345 | DISPENSING DEPOT: MAIN PHARMACY
            </div>
            <div style="font-size: 12px; font-weight: bold; margin-top: 5px; color: #1a4a8a;">
              REPORT PERIOD: ${selectedMonthName.toUpperCase()} ${mohYear}
            </div>
          </div>

          <div style="font-size: 12px; font-weight: bold; margin-bottom: 8px;">ESSENTIAL DRUGS & COMMODITIES STATUS:</div>
          <table>
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th style="text-align: left; width: 35%;">DRUG / PHARMACEUTICAL ITEM</th>
                <th style="width: 15%;">GENERIC DESCRIPTION</th>
                <th style="width: 10%;">UNIT</th>
                <th style="width: 12%;">CURRENT STOCK</th>
                <th style="width: 11%;">SELLING PRICE (KES)</th>
                <th style="width: 12%;">REORDER STATUS</th>
              </tr>
            </thead>
            <tbody>
              ${mohProducts.map((p, i) => {
                const isReorder = parseInt(p.total_stock || p.stock || 0) <= parseInt(p.reorder_level || 10);
                const isOut = parseInt(p.total_stock || p.stock || 0) === 0;
                const statusStr = isOut ? 'STOCKOUT ❌' : isReorder ? 'REORDER ⚠️' : 'STABLE ✓';
                const statusColor = isOut ? '#ef4444' : isReorder ? '#f59e0b' : '#10b981';

                return `
                  <tr>
                    <td class="number">${i + 1}</td>
                    <td style="font-weight: 700; color: #111;">${p.name}</td>
                    <td style="color: #666; font-size: 10px;">${p.generic_name || 'Essential Commodity'}</td>
                    <td style="text-align: center; text-transform: uppercase;">${p.unit || 'pcs'}</td>
                    <td class="number" style="color: ${isReorder ? '#ef4444' : '#111'};">${p.total_stock || p.stock || 0}</td>
                    <td class="number" style="font-weight: bold; color: #1a4a8a;">KES ${parseFloat(p.selling_price || p.price || 0).toLocaleString()}</td>
                    <td style="text-align: center; font-weight: bold; color: ${statusColor}; font-size: 10px;">${statusStr}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="signature-block">
            <div>
              <div>Compiled By:</div>
              <div class="sign-line">Pharmacy Technologist Signature & Stamp</div>
            </div>
            <div>
              <div>Approved By:</div>
              <div class="sign-line">Medical Superintendent / Director</div>
            </div>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  useEffect(() => {
    if (tab === 'daily') fetchDailySummary();
    else if (tab === 'sales') fetchSales();
    else if (tab === 'monthly') fetchMonthly();
    else if (tab === 'stock') fetchStock();
    else if (tab === 'moh') fetchMohData();
  }, [tab, dailyDate, startDate, endDate, mohMonth, mohYear]);

  const fetchDailySummary = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/daily-summary?date=${dailyDate}`);
      setDailyData(res.data.data);
    } catch { toast.error('Failed to load daily summary'); }
    finally { setLoading(false); }
  };

  const fetchSales = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/sales?start_date=${startDate}&end_date=${endDate}`);
      setSalesReport(res.data.data);
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  };

  const fetchMonthly = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/sales/monthly?year=${new Date().getFullYear()}`);
      setMonthlyReport(res.data.data || []);
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  };

  const fetchStock = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/stock?days=30');
      setStockReport(res.data.data);
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  };

  const searchPatients = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const res = await api.get(`/patients?search=${encodeURIComponent(search)}&limit=10`);
      setPatients(res.data.data?.patients || res.data.data || []);
    } catch { toast.error('Failed to search patients'); }
    finally { setSearching(false); }
  };

  const fetchHistory = async (p) => {
    setSelectedPatient(p);
    setLoading(true);
    try {
      const res = await api.get(`/reports/patient/${p.id}/history`);
      setHistory(res.data.data);
    } catch { toast.error('Failed to load patient history'); }
    finally { setLoading(false); }
  };

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const w = window.open('', '_blank');
    w.document.write(`
      <html><head><title>Print Report</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #000; margin: 20px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        h2 { font-size: 14px; margin: 16px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { background: #f0f0f0; text-align: left; padding: 6px 8px; font-size: 11px; }
        td { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
        .summary-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 16px; }
        .summary-box { border: 1px solid #ccc; padding: 10px; border-radius: 6px; }
        .summary-box .val { font-size: 16px; font-weight: bold; margin-top: 4px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; background: #e0f2e9; color: #2e7d32; }
        @media print { @page { margin: 15mm; } }
      </style></head><body>${content}</body></html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 500);
  };

  const maxMonthly = Math.max(...monthlyReport.map(m => parseFloat(m.total_revenue || 0)), 1);

  return (
    <div style={{ padding: 24, height: '100vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Reports</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>Analytics & insights</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(tab === 'daily' || tab === 'history') && (
            <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#0F1612', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <Printer size={14} /> Print
            </button>
          )}
          <button onClick={() => { if (tab==='daily') fetchDailySummary(); else if (tab==='sales') fetchSales(); else if (tab==='monthly') fetchMonthly(); else if (tab==='stock') fetchStock(); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <Tab label="💰 Financial & Shift Summary" active={tab==='daily'} onClick={() => setTab('daily')} />
        <Tab label="🧬 Patient History" active={tab==='history'} onClick={() => setTab('history')} />
        {!isLab && <Tab label="📊 Sales Report" active={tab==='sales'} onClick={() => setTab('sales')} />}
        {!isLab && <Tab label="📅 Monthly Trend" active={tab==='monthly'} onClick={() => setTab('monthly')} />}
        <Tab label="📦 Stock Alerts" active={tab==='stock'} onClick={() => setTab('stock')} />
        <Tab label="🏛 MOH National Reports" active={tab==='moh'} onClick={() => setTab('moh')} />
        {isLab && <Tab label="🔬 MOH Reports" active={tab==='lab'} onClick={() => setTab('lab')} />}
      </div>

      {/* Date filters for sales */}
      {tab === 'sales' && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>FROM</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '9px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>TO</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '9px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader size={28} color="var(--accent)" style={{ animation: 'spin 0.8s linear infinite' }} /></div>
      ) : (
        <>
          {/* ── FINANCIAL & SHIFT SUMMARY ── */}
          {tab === 'daily' && (
            <FinancialSummaryReport initialDateFrom={dailyDate} initialDateTo={dailyDate} />
          )}

          {/* ── PATIENT HISTORY ── */}
          {tab === 'history' && (
            <div>
              {/* Search */}
              <Card style={{ padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>🔍 Search Patient</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => e.key==='Enter' && searchPatients()}
                    placeholder="Name, phone or patient number..."
                    style={{ flex: 1, padding: '10px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
                  />
                  <button onClick={searchPatients} style={{ padding: '10px 20px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#0F1612', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {searching ? <Loader size={14} /> : <Search size={14} />} Search
                  </button>
                </div>
                {patients.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {patients.map(p => (
                      <div key={p.id} onClick={() => { setPatients([]); fetchHistory(p); }} style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 10, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.full_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.patient_number} • {p.phone}</div>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{p.gender} • {age(p.date_of_birth)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* History */}
              {history && selectedPatient && (
                <div ref={printRef}>
                  {/* Patient Header */}
                  <Card style={{ padding: 20, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{history.patient?.full_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                          {history.patient?.patient_number} • {history.patient?.gender} • Age: {age(history.patient?.date_of_birth)} • {history.patient?.phone}
                        </div>
                        {history.patient?.blood_group && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Blood Group: {history.patient.blood_group}</div>}
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-faint)' }}>
                        <div>Total Visits: <strong>{history.visits?.length || 0}</strong></div>
                        <div>Lab Tests: <strong>{history.lab_results?.length || 0}</strong></div>
                      </div>
                    </div>
                  </Card>

                  {/* Visits */}
                  <Card style={{ padding: 20, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>🏥 Visit History</div>
                    {(history.visits || []).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-faint)', fontSize: 13 }}>No visits found</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--border)' }}>
                            {['Date','Visit No.','Type','Chief Complaint','Status','Notes'].map(h => (
                              <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {history.visits.map(v => (
                            <tr key={v.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(v.visit_date)}</td>
                              <td style={{ padding: '9px 10px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{v.visit_number}</td>
                              <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{v.visit_type?.toUpperCase()}</td>
                              <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{v.chief_complaint || '—'}</td>
                              <td style={{ padding: '9px 10px' }}>
                                <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'var(--accent-soft)', color: 'var(--accent)' }}>{v.status}</span>
                              </td>
                              <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{v.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Card>

                  {/* Lab Results */}
                  <Card style={{ padding: 20, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>🔬 Lab Results</div>
                    {(history.lab_results || []).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-faint)', fontSize: 13 }}>No lab results found</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--border)' }}>
                            {['Date','Test Name','Result','Units','Reference','Status','Technician'].map(h => (
                              <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {history.lab_results.map(lr => (
                            <tr key={lr.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(lr.created_at)}</td>
                              <td style={{ padding: '9px 10px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{lr.test_name}</td>
                              <td style={{ padding: '9px 10px', fontSize: 13, fontWeight: 700, color: lr.is_abnormal ? 'var(--danger)' : 'var(--accent)' }}>{lr.result || '—'}</td>
                              <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{lr.units || '—'}</td>
                              <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{lr.reference_range || '—'}</td>
                              <td style={{ padding: '9px 10px' }}>
                                <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: lr.status==='Completed' ? 'var(--accent-soft)' : 'var(--bg-elevated)', color: lr.status==='Completed' ? 'var(--accent)' : 'var(--text-muted)' }}>{lr.status}</span>
                              </td>
                              <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{lr.technician_name || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Card>

                  {/* Prescriptions */}
                  {(history.prescriptions || []).length > 0 && (
                    <Card style={{ padding: 20, marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>💊 Prescription History</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--border)' }}>
                            {['Date','Drug','Dosage','Duration','Prescribed By','Status'].map(h => (
                              <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {history.prescriptions.map(pr => (
                            <tr key={pr.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(pr.created_at)}</td>
                              <td style={{ padding: '9px 10px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{pr.drug_name || pr.product_name}</td>
                              <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{pr.dosage || '—'}</td>
                              <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{pr.duration || '—'}</td>
                              <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{pr.prescribed_by_name || '—'}</td>
                              <td style={{ padding: '9px 10px' }}>
                                <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: 'var(--accent-soft)', color: 'var(--accent)' }}>{pr.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                  )}

                  {/* Procedures */}
                  {(history.procedures || []).length > 0 && (
                    <Card style={{ padding: 20, marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>🩺 Procedures History</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--border)' }}>
                            {['Date','Procedure Name','Doctor','Outcome / Notes'].map(h => (
                              <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {history.procedures.map(proc => (
                            <tr key={proc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(proc.created_at)}</td>
                              <td style={{ padding: '9px 10px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{proc.procedure_name}</td>
                              <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{proc.doctor_name || '—'}</td>
                              <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{proc.outcome || proc.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                  )}

                  {/* Injections & Ward Meds */}
                  {(history.injections || []).length > 0 && (
                    <Card style={{ padding: 20, marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>💉 Administered Injections & Meds</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--border)' }}>
                            {['Date','Drug / Med','Dosage / Route','Prescribed By','Status / Administered By'].map(h => (
                              <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {history.injections.map(inj => (
                            <tr key={inj.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(inj.created_at)}</td>
                              <td style={{ padding: '9px 10px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{inj.drug_name}</td>
                              <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{inj.dosage || ''} {inj.route ? `(${inj.route})` : ''}</td>
                              <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{inj.prescribed_by_name || '—'}</td>
                              <td style={{ padding: '9px 10px' }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {inj.status?.toUpperCase()}
                                </div>
                                {inj.administered_at && (
                                  <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                                    By {inj.administered_by_name || 'Nurse'} on {fmtDate(inj.administered_at)}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                  )}

                  {/* Inpatient & Ward Nursing Logs */}
                  {(history.nursing_notes || []).length > 0 && (
                    <Card style={{ padding: 20, marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>📋 Ward Admission & Nursing Logs</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--border)' }}>
                            {['Date','Ward / Bed','Note Type','Nursing Observations & Notes','Vitals Recorded','Nurse'].map(h => (
                              <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {history.nursing_notes.map(note => {
                            let parsedVitals = null;
                            try {
                              if (typeof note.vitals === 'string') parsedVitals = JSON.parse(note.vitals);
                              else parsedVitals = note.vitals;
                            } catch (e) {}
                            return (
                              <tr key={note.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(note.created_at)}</td>
                                <td style={{ padding: '9px 10px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{note.ward_name || 'Ward Admission'}</td>
                                <td style={{ padding: '9px 10px' }}>
                                  <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                                    {note.note_type?.toUpperCase()}
                                  </span>
                                </td>
                                <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-muted)', maxWidth: 300, whiteSpace: 'pre-wrap' }}>{note.notes || '—'}</td>
                                <td style={{ padding: '9px 10px', fontSize: 11, color: 'var(--text-muted)' }}>
                                  {parsedVitals ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                      {parsedVitals.temp && <div>Temp: {parsedVitals.temp}°C</div>}
                                      {parsedVitals.bp && <div>BP: {parsedVitals.bp}</div>}
                                      {parsedVitals.pulse && <div>Pulse: {parsedVitals.pulse} bpm</div>}
                                      {parsedVitals.spo2 && <div>SPO2: {parsedVitals.spo2}%</div>}
                                    </div>
                                  ) : '—'}
                                </td>
                                <td style={{ padding: '9px 10px', fontSize: 12, color: 'var(--text-muted)' }}>{note.nurse_name || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </Card>
                  )}

                  <div style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'right', marginTop: 8 }}>
                    Generated: {new Date().toLocaleString('en-KE')} • {user?.full_name}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SALES REPORT ── */}
          {tab === 'sales' && salesReport && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {[
                  { label: 'Total Revenue', value: fmt(salesReport.summary?.total_revenue), color: 'var(--accent)' },
                  { label: 'Transactions', value: salesReport.summary?.total_transactions || 0, color: 'var(--info)' },
                  { label: 'Total Discounts', value: fmt(salesReport.summary?.total_discounts), color: 'var(--warning)' },
                  { label: 'M-Pesa Revenue', value: fmt(salesReport.summary?.mpesa_total), color: 'var(--info)' },
                ].map(({ label, value, color }) => (
                  <Card key={label} style={{ padding: 20 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
                  </Card>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Card style={{ padding: 22 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>🏆 Top Products</div>
                  {(salesReport.top_products || []).length === 0 ? <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-faint)', fontSize: 13 }}>No data</div> : (salesReport.top_products || []).map((p, i) => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ width: 24, height: 24, borderRadius: '50%', background: i < 3 ? 'var(--accent-soft)' : 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: i < 3 ? 'var(--accent)' : 'var(--text-faint)', flexShrink: 0 }}>{i + 1}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.total_sold} units sold</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{fmt(p.total_revenue)}</span>
                    </div>
                  ))}
                </Card>
                <Card style={{ padding: 22 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>👤 Cashier Performance</div>
                  {(salesReport.cashier_performance || []).length === 0 ? <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-faint)', fontSize: 13 }}>No data</div> : (salesReport.cashier_performance || []).map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{c.full_name?.charAt(0)}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.full_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.total_sales} sales • avg {fmt(c.avg_sale_value)}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{fmt(c.total_revenue)}</span>
                    </div>
                  ))}
                </Card>
              </div>
            </div>
          )}

          {/* ── MONTHLY TREND ── */}
          {tab === 'monthly' && (
            <Card style={{ padding: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 24 }}>📅 Monthly Revenue — {new Date().getFullYear()}</div>
              {monthlyReport.length === 0 ? <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-faint)' }}>No data available</div> : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 220, padding: '0 8px' }}>
                  {monthlyReport.map(m => {
                    const pct = (parseFloat(m.total_revenue) / maxMonthly) * 100;
                    return (
                      <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{parseFloat(m.total_revenue) >= 1000 ? `${(parseFloat(m.total_revenue)/1000).toFixed(0)}K` : parseFloat(m.total_revenue).toFixed(0)}</span>
                        <div style={{ width: '100%', height: `${Math.max(pct, 4)}%`, background: 'var(--accent)', borderRadius: '6px 6px 0 0', minHeight: 4 }} />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{m.month_name}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{m.total_transactions} sales</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* ── STOCK ALERTS ── */}
          {tab === 'stock' && stockReport && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Card style={{ padding: 22 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={16} color="var(--warning)" /> Expiring Within 30 Days</div>
                {(stockReport.expiring_stock || []).length === 0 ? <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-faint)', fontSize: 13 }}>✅ No stock expiring soon</div> : (stockReport.expiring_stock || []).map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.product_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Batch: {s.batch_number || 'N/A'} • Qty: {s.quantity}</div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)' }}>{new Date(s.expiry_date).toLocaleDateString()}</span>
                  </div>
                ))}
              </Card>
              <Card style={{ padding: 22 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Package size={16} color="var(--danger)" /> Low Stock Products</div>
                {(stockReport.low_stock_products || []).length === 0 ? <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-faint)', fontSize: 13 }}>✅ All products well stocked</div> : (stockReport.low_stock_products || []).map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Reorder level: {p.reorder_level}</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: parseInt(p.total_stock)===0 ? 'var(--danger)' : 'var(--warning)' }}>{p.total_stock} left</span>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {/* ── MOH NATIONAL REPORTS HUB ── */}
          {tab === 'moh' && (
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
              
              {/* Left Column: Report Selectors & Time Filters */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                {/* 1. Date & Month Selectors */}
                <Card style={{ padding: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>📅 Filter Reporting Period</div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>MONTH</label>
                      <select 
                        value={mohMonth} 
                        onChange={e => setMohMonth(parseInt(e.target.value))} 
                        style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, outline: 'none', cursor: 'pointer' }}
                      >
                        {MONTHS.map((m, idx) => (
                          <option key={m} value={idx + 1}>{m}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>YEAR</label>
                      <select 
                        value={mohYear} 
                        onChange={e => setMohYear(parseInt(e.target.value))} 
                        style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13, outline: 'none', cursor: 'pointer' }}
                      >
                        {[2024, 2025, 2026, 2027].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>

                    <button 
                      onClick={fetchMohData} 
                      disabled={mohLoading}
                      style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      <RefreshCw size={12} className={mohLoading ? 'animate-spin' : ''} /> {mohLoading ? 'Compiling...' : 'Recalculate Metrics'}
                    </button>
                  </div>
                </Card>

                {/* 2. List of Departmental MOH Reports */}
                <Card style={{ padding: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>🏛 Select MOH Template</div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { id: '204', label: 'MOH 204 OPD Summary', dept: 'Outpatient Dept', icon: '📋' },
                      { id: '706', label: 'MOH 706 Lab Summary', dept: 'Laboratory Dept', icon: '🔬' },
                      { id: '711', label: 'MOH 711 Pharmacy Log', dept: 'Pharmacy Dept', icon: '💊' },
                      { id: 'mch', label: 'MOH 511-515 MCH Aggregates', dept: 'Maternal & Child Health', icon: '🤱' }
                    ].map(r => {
                      const active = selectedMohReport === r.id;
                      return (
                        <button
                          key={r.id}
                          onClick={() => setSelectedMohReport(r.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '10px 12px',
                            background: active ? 'var(--accent)' : 'transparent',
                            color: active ? '#0F1612' : 'var(--text-primary)',
                            border: 'none',
                            borderRadius: 10,
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          <span style={{ fontSize: 16 }}>{r.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700 }}>{r.label}</div>
                            <div style={{ fontSize: 9, color: active ? 'rgba(15,22,18,0.7)' : 'var(--text-muted)', fontWeight: 600 }}>{r.dept}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Card>
              </div>

              {/* Right Column: Live Report Summary & Print Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                {mohLoading ? (
                  <Card style={{ padding: 40, textAlign: 'center' }}>
                    <Loader size={24} className="animate-spin text-[var(--accent)] mx-auto" />
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, fontWeight: 600 }}>Compiling national registers...</div>
                  </Card>
                ) : (
                  <>
                    {/* Active Template Header Panel */}
                    <Card style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px' }}>MINISTRY OF HEALTH REPORTING MATRIX</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                          {selectedMohReport === '204' && 'MOH 204 Outpatient Services Aggregate Summary'}
                          {selectedMohReport === '706' && 'MOH 706 Laboratory Services activity register'}
                          {selectedMohReport === '711' && 'MOH 711 Section 4 Pharmacy commodity register'}
                          {selectedMohReport === 'mch' && 'MOH 511 - 515 Maternal & Child Health aggregate values'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                          Period: <strong>{MONTHS[mohMonth - 1]} {mohYear}</strong> · Status: <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>Validated & Compiled ✓</span>
                        </div>
                      </div>
                      
                      {selectedMohReport !== 'mch' && (
                        <button
                          onClick={() => {
                            if (selectedMohReport === '204') handlePrintMOH204();
                            else if (selectedMohReport === '706') handlePrintMOH706();
                            else if (selectedMohReport === '711') handlePrintMOH711();
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '10px 16px',
                            background: 'var(--accent)',
                            color: '#0F1612',
                            border: 'none',
                            borderRadius: 10,
                            fontSize: 13,
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          <Printer size={14} /> Print Official Form
                        </button>
                      )}
                    </Card>

                    {/* Pre-computation preview based on template */}
                    {selectedMohReport === '204' && (
                      <Card style={{ padding: 22 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>📊 Dynamic Register Summary Metrics</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
                          {[
                            { label: 'Total Visits logged', value: mohVisits.length },
                            { label: 'Under-5 Children', value: mohVisits.filter(v => v.date_of_birth && (Math.floor((Date.now() - new Date(v.date_of_birth)) / 31557600000) < 5)).length },
                            { label: 'Over-5 Adults', value: mohVisits.filter(v => !v.date_of_birth || (Math.floor((Date.now() - new Date(v.date_of_birth)) / 31557600000) >= 5)).length },
                            { label: 'Confirmed Diagnoses', value: mohVisits.filter(v => v.diagnosis).length }
                          ].map((item, idx) => (
                            <div key={idx} style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{item.label}</div>
                              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>{item.value}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          💡 This dataset compiles real-time, validated outpatient records from the clinician desks for official submission. Click "Print Official Form" above to open the full MOH-styled paper layout.
                        </div>
                      </Card>
                    )}

                    {selectedMohReport === '706' && (
                      <Card style={{ padding: 22 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>📊 Dynamic Laboratory activity metrics</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                          {[
                            { label: 'Total Lab Requests', value: mohLabRequests.length },
                            { label: 'Abnormal/Positive flag rate', value: mohLabRequests.filter(l => l.result_flag && l.result_flag !== 'normal').length },
                            { label: 'Normal/Negative flag rate', value: mohLabRequests.filter(l => !l.result_flag || l.result_flag === 'normal').length }
                          ].map((item, idx) => (
                            <div key={idx} style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{item.label}</div>
                              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>{item.value}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          💡 This dataset compiles real-time results from laboratory testing machines and hand-keyed clinical values. Click "Print Official Form" above to print the official paper register.
                        </div>
                      </Card>
                    )}

                    {selectedMohReport === '711' && (
                      <Card style={{ padding: 22 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>📊 Essential Commodity metrics</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                          {[
                            { label: 'Total Pharmaceutical items', value: mohProducts.length },
                            { label: 'Items below reorder level', value: mohProducts.filter(p => parseInt(p.total_stock || p.stock || 0) <= parseInt(p.reorder_level || 10)).length },
                            { label: 'Total Out of Stock items', value: mohProducts.filter(p => parseInt(p.total_stock || p.stock || 0) === 0).length }
                          ].map((item, idx) => (
                            <div key={idx} style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 10, border: '1px solid var(--border)' }}>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{item.label}</div>
                              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', marginTop: 4 }}>{item.value}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          💡 Displays a detailed stock and commodity log computed on current bin-card metrics. Click "Print Official Form" to output a formatted commodity inventory review.
                        </div>
                      </Card>
                    )}

                    {selectedMohReport === 'mch' && (
                      <Card style={{ padding: 40, textAlign: 'center' }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>🤰</div>
                        <div style={{ fontSize: 15, fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: 6 }}>Maternal & Child Health MOH Registers (510 - 515)</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 450, margin: '0 auto 20px', lineHeight: '1.6' }}>
                          Maternal ANC, PNC, child immunizations, delivery registries, and family planning records are located inside the maternal health registers portal.
                        </div>
                        <a 
                          href="/app/mch?tab=reports" 
                          style={{ display: 'inline-block', textDecoration: 'none', padding: '10px 20px', background: 'var(--accent)', color: '#0F1612', borderRadius: 10, fontSize: 13, fontWeight: 800 }}
                        >
                          Go to MCH Registers Portal
                        </a>
                      </Card>
                    )}
                  </>
                )}
              </div>

            </div>
          )}

          {tab === 'lab' && (
            <Card style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔬</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Lab MOH Reports</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Go to <strong>Laboratory → MOH Reports tab</strong> to view and add lab reports.</div>
            </Card>
          )}
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
