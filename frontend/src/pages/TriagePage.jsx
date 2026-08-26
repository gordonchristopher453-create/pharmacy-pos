import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api';
import { connectSocket } from '../services/socket';
import toast from 'react-hot-toast';
import { 
  Activity, Search, RefreshCw, X, Loader, CheckCircle, Clock, ChevronRight, 
  Thermometer, Heart, HeartPulse, Wind, Droplets, Scale, Ruler, AlertTriangle, Info,
  TrendingUp, Send, Check, Sparkles, User, ArrowRight, Clipboard, ShieldAlert,
  ChevronLeft, Flame, Calendar, Stethoscope, ArrowLeft, Filter, UserCheck, AlertCircle
} from 'lucide-react';

const DEPARTMENTS = [
  { value: 'opd', label: 'OPD (Doctor)', icon: '🩺', color: '#3b82f6', desc: 'General Outpatient Department' },
  { value: 'mch', label: 'MCH Clinic', icon: '🤰', color: '#ec4899', desc: 'Maternal & Child Health' },
  { value: 'emergency', label: 'Emergency Room', icon: '🚨', color: '#ef4444', desc: 'Urgent Trauma & Resuscitation' },
  { value: 'lab', label: 'Laboratory', icon: '🔬', color: '#06b6d4', desc: 'Diagnostic & Pathology Labs' },
  { value: 'radiology', label: 'Radiology', icon: '🩻', color: '#a855f7', desc: 'Imaging, X-Ray & Ultrasound' },
  { value: 'pharmacy', label: 'Pharmacy Desk', icon: '💊', color: '#10b981', desc: 'Medication Dispense Station' },
  { value: 'dental', label: 'Dental Unit', icon: '🦷', color: '#f59e0b', desc: 'Oral Health & Surgery' },
  { value: 'physio', label: 'Physiotherapy', icon: '🏃', color: '#8b5cf6', desc: 'Physical Rehab & Therapy' },
  { value: 'nutrition', label: 'Nutrition Desk', icon: '🥗', color: '#84cc16', desc: 'Dietary Counseling & Support' },
];

const PRIORITY = [
  { value: 'normal', label: 'Normal Priority', color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: '🟢', desc: 'Routine assessment, clinically stable' },
  { value: 'urgent', label: 'Urgent Attention', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '🟡', desc: 'Acutely unwell, require prompt treatment' },
  { value: 'emergency', label: 'High Alert (Emergency)', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: '🔴', desc: 'Life-threatening condition, immediate care' },
];

const getAge = dob => {
  if (!dob) return '—';
  const diff = Date.now() - new Date(dob);
  const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  if (years < 1) {
    const months = Math.floor(diff / (30.44 * 24 * 60 * 60 * 1000));
    return `${months} month${months !== 1 ? 's' : ''}`;
  }
  return `${years} yr${years !== 1 ? 's' : ''}`;
};

const isUnder5 = dob => {
  if (!dob) return false;
  return (Date.now() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000) < 5;
};

const flagVital = (key, value) => {
  const v = parseFloat(value);
  if (isNaN(v)) return null;
  const rules = {
    temperature: { low: 35.5, high: 37.5, critical_low: 34, critical_high: 39.5 },
    pulse_rate: { low: 60, high: 100, critical_low: 40, critical_high: 130 },
    respiratory_rate: { low: 12, high: 20, critical_low: 8, critical_high: 28 },
    blood_pressure_systolic: { low: 90, high: 140, critical_low: 75, critical_high: 170 },
    blood_pressure_diastolic: { low: 60, high: 90, critical_low: 40, critical_high: 110 },
  };
  const r = rules[key];
  if (!r) return null;
  if (r.critical_low && v < r.critical_low) return 'critical';
  if (r.critical_high && v > r.critical_high) return 'critical';
  if (r.low && v < r.low) return 'low';
  if (r.high && v > r.high) return 'high';
  return 'normal';
};

const flagBMI = (bmi) => {
  if (!bmi) return null;
  const b = parseFloat(bmi);
  if (b < 16 || b > 35) return 'critical';
  if (b < 18.5) return 'low';
  if (b <= 24.9) return 'normal';
  if (b <= 29.9) return 'high';
  return 'critical';
};

const flagMUAC = (muac) => {
  if (!muac) return null;
  const m = parseFloat(muac);
  if (m < 11.5) return 'critical';
  if (m < 12.5) return 'low';
  return 'normal';
};

const flagSpO2 = (spo2) => {
  const v = parseFloat(spo2);
  if (isNaN(v)) return null;
  if (v < 90) return 'critical';
  if (v < 95) return 'low';
  return 'normal';
};

const FLAG_COLORS = { 
  normal: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5', 
  low: 'text-sky-400 border-sky-500/30 bg-sky-500/5', 
  high: 'text-amber-400 border-amber-500/30 bg-amber-500/5', 
  critical: 'text-rose-400 border-rose-500/40 bg-rose-500/10 animate-pulse' 
};

export default function TriagePage() {
  const { user } = useSelector(s => s.auth);
  const [tab, setTab] = useState('queue');
  const [visits, setVisits] = useState([]);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [histLoading, setHistLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [triageDate, setTriageDate] = useState(new Date().toISOString().split('T')[0]);
  const [histSearch, setHistSearch] = useState('');
  const [histDate, setHistDate] = useState(new Date().toISOString().split('T')[0]);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [clock, setClock] = useState(new Date());

  const FALLBACK_SPECIAL_CLINICS = [
    { id: 1, code: 'MEDICAL_OPD', name: 'Medical OPD', description: 'Internal Medicine and General Medical Consultations' },
    { id: 2, code: 'PAEDIATRIC_OPD', name: 'Paediatric OPD', description: 'Child Health and Paediatric Consultations' },
    { id: 3, code: 'SURGICAL_OPD', name: 'Surgical OPD', description: 'General Surgery & Pre/Post-Op Evaluation' },
    { id: 4, code: 'OG', name: 'O&G', description: 'Obstetrics and Gynaecology Special Clinic' },
    { id: 5, code: 'EYE', name: 'Eye', description: 'Ophthalmology & Optical Care' },
    { id: 6, code: 'ENT', name: 'ENT', description: 'Ear, Nose & Throat Services' },
    { id: 7, code: 'DENTAL', name: 'Dental', description: 'Oral Health and Dental Surgery' },
    { id: 8, code: 'CARDIOLOGY', name: 'Cardiology', description: 'Heart and Cardiovascular Care' },
    { id: 9, code: 'RENAL', name: 'Renal', description: 'Kidney Health and Nephrology' },
    { id: 10, code: 'DERMATOLOGY', name: 'Dermatology', description: 'Skin & Dermatological Care' },
    { id: 11, code: 'ONCOLOGY', name: 'Oncology', description: 'Cancer Care & Oncology Consultations' },
    { id: 12, code: 'NEUROLOGY', name: 'Neurology', description: 'Nervous System & Neurological Care' },
    { id: 13, code: 'PHYSIOTHERAPY', name: 'Physiotherapy', description: 'Physical Therapy & Rehabilitation' },
    { id: 14, code: 'NUTRITION', name: 'Nutrition', description: 'Dietetics & Clinical Nutrition' },
    { id: 15, code: 'MENTAL_HEALTH', name: 'Mental Health', description: 'Psychiatry & Psychological Services' },
    { id: 16, code: 'DIABETES', name: 'Diabetes', description: 'Diabetes Management Clinic' },
    { id: 17, code: 'HYPERTENSION', name: 'Hypertension', description: 'Hypertension Management Clinic' },
    { id: 18, code: 'CCC', name: 'CCC', description: 'Comprehensive Care Centre' },
    { id: 19, code: 'TB', name: 'TB', description: 'Tuberculosis Care & Management' },
    { id: 20, code: 'SICKLE_CELL', name: 'Sickle Cell', description: 'Sickle Cell Disease Care' },
  ];

  const [specialClinics, setSpecialClinics] = useState(FALLBACK_SPECIAL_CLINICS);

  const [form, setForm] = useState({
    blood_pressure_systolic: '', blood_pressure_diastolic: '',
    pulse_rate: '', temperature: '', respiratory_rate: '',
    oxygen_saturation: '', weight: '', height: '',
    muac: '', triage_notes: '',
    department: 'opd', priority: 'normal',
    mch_service: '',
    disposition: 'opd',
    selectedSpecialClinic: 'MEDICAL_OPD',
    referralNotes: '',
    blood_group: '', allergies: '', chronic_conditions: '',
  });

  useEffect(() => {
    fetchSpecialClinics();
  }, []);

  const fetchSpecialClinics = async () => {
    try {
      const res = await api.get('/special-clinics');
      if (res.data?.data && res.data.data.length > 0) {
        setSpecialClinics(res.data.data);
      }
    } catch {
      // Keep fallback
    }
  };

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetchVisits();
    const interval = setInterval(fetchVisits, 10000);
    const socket = connectSocket();
    if (socket && user?.pharmacy_id) {
      socket.on(`queue_update_${user.pharmacy_id}`, fetchVisits);
      socket.on(`visit_opened_${user.pharmacy_id}`, fetchVisits);
      socket.on(`visit_updated_${user.pharmacy_id}`, fetchVisits);
    }
    return () => {
      clearInterval(interval);
      if (socket && user?.pharmacy_id) {
        socket.off(`queue_update_${user.pharmacy_id}`, fetchVisits);
        socket.off(`visit_opened_${user.pharmacy_id}`, fetchVisits);
        socket.off(`visit_updated_${user.pharmacy_id}`, fetchVisits);
      }
    };
  }, [user, triageDate]);

  useEffect(() => { if (tab === 'history') fetchHistory(); }, [tab, histDate]);

  const fetchVisits = async () => {
    setLoading(true);
    try {
      const d = triageDate || new Date().toISOString().split('T')[0];
      const params = {
        status: 'WAITING_TRIAGE,waiting_triage,triage,IN_TRIAGE,waiting,open,triaged,REGISTERED,registered',
        date: d
      };
      const res = await api.get('/patients/visits', { params });
      setVisits(res.data?.data?.visits || []);
      setStats(res.data?.data?.stats || {});
    } catch { toast.error('Failed to load triage queue'); }
    finally { setLoading(false); }
  };

  const fetchHistory = async () => {
    setHistLoading(true);
    try {
      const url = histDate ? `/patients/visits?date=${histDate}` : '/patients/visits';
      const res = await api.get(url);
      setHistory(res.data?.data?.visits || []);
    } catch { toast.error('Failed to load history'); }
    finally { setHistLoading(false); }
  };

  const ff = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const bmi = form.weight && form.height
    ? (parseFloat(form.weight) / Math.pow(parseFloat(form.height) / 100, 2)).toFixed(1)
    : null;

  const bmiCategory = bmi
    ? parseFloat(bmi) < 18.5 ? 'Underweight' : parseFloat(bmi) < 25 ? 'Normal' : parseFloat(bmi) < 30 ? 'Overweight' : 'Obese'
    : null;

  const openTriage = (visit) => {
    setSelected(visit);
    setForm({
      blood_pressure_systolic: '', blood_pressure_diastolic: '',
      pulse_rate: '', temperature: '', respiratory_rate: '',
      oxygen_saturation: '', weight: '', height: '',
      muac: '', triage_notes: '',
      department: 'opd', priority: visit.priority || 'normal',
      mch_service: '',
      disposition: 'opd',
      selectedSpecialClinic: specialClinics[0]?.code || 'MEDICAL_OPD',
      referralNotes: '',
      blood_group: visit.blood_group || '',
      allergies: visit.allergies || '',
      chronic_conditions: visit.chronic_conditions || '',
    });
  };

  const fillNormals = () => {
    setForm(p => ({
      ...p,
      temperature: '36.6',
      pulse_rate: '72',
      respiratory_rate: '16',
      blood_pressure_systolic: '120',
      blood_pressure_diastolic: '80',
      oxygen_saturation: '98',
      triage_notes: p.triage_notes || 'All basic parameters are clinically normal. Patient is fully alert and responsive.'
    }));
    toast.success('✨ Filled standard healthy baseline values!');
  };

  const handleSubmit = async () => {
    if (!form.temperature && !form.pulse_rate && !form.blood_pressure_systolic) {
      toast.error('Please enter at least Temperature, Pulse or Blood Pressure');
      return;
    }
    if (form.department === 'mch' && !form.mch_service) {
      toast.error('Please select an MCH Clinic Service');
      return;
    }
    setSaving(true);
    try {
      if (selected.patient_id) {
        await api.put(`/patients/${selected.patient_id}`, {
          blood_group: form.blood_group,
          allergies: form.allergies,
          chronic_conditions: form.chronic_conditions,
        }).catch(() => {});
      }
      await api.post(`/patients/visits/${selected.id}/vitals`, {
        ...form, bmi, department: form.department,
        triage_notes: form.triage_notes, priority: form.priority,
      });

      const deptStatus = form.department === 'mch' ? 'mch' : form.department === 'lab' ? 'lab' : form.department === 'radiology' ? 'radiology' : 'with_doctor';
      await api.put(`/patients/visits/${selected.id}/status`, { status: deptStatus, department: form.department || 'opd', mch_service: form.mch_service || null });
      toast.success(`✅ Triage Complete! Forwarded to ${DEPARTMENTS.find(d => d.value === form.department)?.label || 'OPD Doctor'}`);

      setSelected(null);
      fetchVisits();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to save triage data');
    } finally { setSaving(false); }
  };

  const filtered = visits.filter(v => {
    const matchesSearch = !search ||
      v.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
      v.patient_number?.toLowerCase().includes(search.toLowerCase()) ||
      v.phone?.includes(search) ||
      v.visit_number?.toLowerCase().includes(search.toLowerCase());
    
    const matchesPriority = priorityFilter === 'all' || v.priority === priorityFilter;

    return matchesSearch && matchesPriority;
  });

  const filteredHistory = history.filter(v =>
    !histSearch ||
    v.patient_name?.toLowerCase().includes(histSearch.toLowerCase()) ||
    v.patient_number?.toLowerCase().includes(histSearch.toLowerCase()) ||
    v.phone?.includes(histSearch) ||
    v.visit_number?.toLowerCase().includes(histSearch.toLowerCase())
  );

  const STATUS_COLORS = {
    waiting: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    waiting_triage: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    with_doctor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    lab: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    pharmacy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    discharged: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
    emergency: 'text-rose-400 bg-rose-500/15 border-rose-500/30 animate-pulse'
  };

  const STATUS_LABELS = {
    waiting: '⏳ Waiting',
    waiting_triage: '📋 Waiting Triage',
    with_doctor: '🩺 With Doctor', 
    lab: '🔬 In Lab',
    pharmacy: '💊 Pharmacy', 
    discharged: '✅ Discharged', 
    emergency: '🚨 Emergency'
  };

  const flaggedCount = selected ? [
    flagVital('temperature', form.temperature),
    flagVital('pulse_rate', form.pulse_rate),
    flagVital('respiratory_rate', form.respiratory_rate),
    flagSpO2(form.oxygen_saturation),
    flagVital('blood_pressure_systolic', form.blood_pressure_systolic),
    flagVital('blood_pressure_diastolic', form.blood_pressure_diastolic),
    flagBMI(bmi),
  ].filter(f => f && f !== 'normal').length : 0;

  const under5 = selected ? isUnder5(selected.date_of_birth) : false;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)] font-sans">
      
      {/* ── HEADER HUD BAR ────────────────────────────────────────────────── */}
      <header className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-surface)] flex-shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center border border-[var(--accent)]/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <Activity className="text-[var(--accent)] animate-pulse" size={18} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
                Triage Station
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block" />
              </h1>
              <p className="text-xs text-[var(--text-muted)] font-mono flex items-center gap-1.5">
                <span>Active Personnel: <strong className="text-[var(--text-primary)]">{user?.full_name || 'Nurse'}</strong></span>
                <span className="text-[var(--border)]">•</span>
                <span>System Time: <strong className="text-[var(--accent)]">{clock.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong></span>
              </p>
            </div>
          </div>
        </div>

        {/* Action center */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Tabs */}
          <div className="bg-[var(--bg-elevated)] border border-[var(--border)] p-1 rounded-xl flex gap-1">
            <button 
              onClick={() => { setTab('queue'); setSelected(null); }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                tab === 'queue' 
                  ? 'bg-[var(--accent)] text-[#0F1612] shadow-sm' 
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-base)]'
              }`}
            >
              <Clock size={13} />
              Queue Desk {filtered.length > 0 && <span className="ml-1 bg-red-500 text-white rounded-full px-1.5 py-0.5 text-[9px] animate-bounce">{filtered.length}</span>}
            </button>
            <button 
              onClick={() => { setTab('history'); setSelected(null); }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                tab === 'history' 
                  ? 'bg-[var(--accent)] text-[#0F1612] shadow-sm' 
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-base)]'
              }`}
            >
              <Clipboard size={13} />
              Encounter Logs
            </button>
          </div>

          <button 
            onClick={tab === 'queue' ? fetchVisits : fetchHistory} 
            className="p-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] hover:bg-[var(--bg-surface)] rounded-xl transition-all text-[var(--text-primary)]"
            title="Refresh list"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </header>

      {/* ── METRICS SUMMARY BOARD ─────────────────────────────────────────── */}
      {tab === 'queue' && !selected && (
        <section className="px-6 py-4 bg-[var(--bg-elevated)]/20 border-b border-[var(--border)] grid grid-cols-2 md:grid-cols-4 gap-4 flex-shrink-0">
          {[
            { 
              label: 'Waiting Triage', 
              value: filtered.length, 
              color: 'text-amber-400', 
              bg: 'bg-amber-500/10 border-amber-500/20',
              desc: 'Stable patients in lobby'
            },
            { 
              label: 'Today Total Visits', 
              value: stats.total_visits || visits.length || 0, 
              color: 'text-[var(--accent)]', 
              bg: 'bg-emerald-500/10 border-emerald-500/20',
              desc: 'All recorded encounters'
            },
            { 
              label: 'Urgent Red Alerts', 
              value: stats.emergencies || visits.filter(v => v.priority === 'emergency').length, 
              color: 'text-rose-400', 
              bg: 'bg-rose-500/10 border-rose-500/20 animate-pulse',
              desc: 'Require immediate triage'
            },
            { 
              label: 'Discharged / Complete', 
              value: stats.discharged || 0, 
              color: 'text-blue-400', 
              bg: 'bg-blue-500/10 border-blue-500/20',
              desc: 'Cleared clinical visits'
            }
          ].map(s => (
            <div key={s.label} className={`p-4 rounded-2xl border ${s.bg} flex items-center justify-between shadow-sm`}>
              <div className="space-y-1">
                <span className="text-[10px] font-mono tracking-wider text-[var(--text-muted)] uppercase block">{s.label}</span>
                <span className="text-xs text-[var(--text-faint)]">{s.desc}</span>
              </div>
              <span className={`text-2xl md:text-3xl font-black font-mono ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </section>
      )}

      {/* ── WORKSPACE AREA ───────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden flex flex-col">
        
        {/* ─── FULL-WIDTH WORKLIST (SHOWN WHEN NO PATIENT IS CURRENTLY SELECTED) ─── */}
        {!selected ? (
          <div className="flex-1 overflow-y-auto flex flex-col bg-[var(--bg-surface)]">
            
            {/* Filter & Controls Toolbar */}
            <div className="p-4 md:px-6 border-b border-[var(--border)] bg-[var(--bg-elevated)]/30 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
              
              <div className="flex items-center gap-3 flex-1">
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-[var(--accent)] whitespace-nowrap flex items-center gap-2">
                  <Clipboard size={15} />
                  {tab === 'queue' ? 'Pending Triage Worklist' : 'Encounter Logs & Past Triages'}
                </span>

                {/* Priority quick filters for queue */}
                {tab === 'queue' && (
                  <div className="hidden sm:flex items-center gap-1.5 ml-3 bg-[var(--bg-base)] p-1 rounded-xl border border-[var(--border)]">
                    <button
                      onClick={() => setPriorityFilter('all')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                        priorityFilter === 'all'
                          ? 'bg-[var(--accent)] text-[#0F1612]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      All ({visits.length})
                    </button>
                    {PRIORITY.map(p => {
                      const count = visits.filter(v => v.priority === p.value).length;
                      return (
                        <button
                          key={p.value}
                          onClick={() => setPriorityFilter(p.value)}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 ${
                            priorityFilter === p.value
                              ? 'bg-[var(--accent)] text-[#0F1612]'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <span>{p.icon}</span>
                          <span className="capitalize">{p.value}</span>
                          {count > 0 && <span className="text-[10px] opacity-80">({count})</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Search & Date Controls */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative flex-1 sm:w-72">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input 
                    value={tab === 'queue' ? search : histSearch} 
                    onChange={e => tab === 'queue' ? setSearch(e.target.value) : setHistSearch(e.target.value)} 
                    placeholder="Search patient, record #, phone..."
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl pl-9 pr-8 py-2 text-xs focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)] transition-all"
                  />
                  {(tab === 'queue' ? search : histSearch) && (
                    <button 
                      onClick={() => tab === 'queue' ? setSearch('') : setHistSearch('')} 
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-2.5 py-1.5">
                  <Calendar size={13} className="text-[var(--text-muted)]" />
                  <input 
                    type="date" 
                    value={tab === 'queue' ? triageDate : histDate} 
                    onChange={e => tab === 'queue' ? setTriageDate(e.target.value) : setHistDate(e.target.value)}
                    className="bg-transparent text-xs text-[var(--text-primary)] focus:outline-none"
                  />
                  {tab === 'queue' && (
                    triageDate ? (
                      <button
                        onClick={() => setTriageDate('')}
                        className="text-[10px] text-amber-400 hover:underline font-mono ml-1 font-bold"
                        title="Show all pending queue across all dates"
                      >
                        All
                      </button>
                    ) : (
                      <button
                        onClick={() => setTriageDate(new Date().toISOString().split('T')[0])}
                        className="text-[10px] text-[var(--accent)] hover:underline font-mono ml-1 font-bold"
                      >
                        Today
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Worklist Main Content View */}
            <div className="flex-1 p-4 md:p-6 overflow-y-auto">
              {tab === 'queue' ? (
                loading ? (
                  <div className="flex flex-col items-center justify-center py-28 text-[var(--text-muted)]">
                    <Loader className="animate-spin text-[var(--accent)] mb-3" size={28} />
                    <p className="text-sm font-semibold">Fetching active triage worklist...</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-20 px-6 border-2 border-dashed border-[var(--border)] rounded-3xl max-w-2xl mx-auto bg-[var(--bg-elevated)]/10">
                    <div className="text-4xl mb-3">🎉</div>
                    <h3 className="font-black text-lg text-[var(--text-primary)]">Triage Queue Cleared</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1.5 max-w-md mx-auto leading-relaxed">
                      There are no pending patients waiting for triage at this moment. Newly registered arrivals from reception will appear here automatically in real time.
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-[var(--accent)] font-mono font-bold bg-[var(--accent)]/5 border border-[var(--accent)]/15 px-3 py-1.5 rounded-xl w-fit mx-auto">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      Queue live & listening for reception check-ins
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="hidden lg:grid grid-cols-12 gap-4 px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] font-bold border-b border-[var(--border)]/60">
                      <div className="col-span-1">Token</div>
                      <div className="col-span-3">Patient Record</div>
                      <div className="col-span-2">Demographics</div>
                      <div className="col-span-3">Chief Complaint</div>
                      <div className="col-span-1">Wait Time</div>
                      <div className="col-span-2 text-right">Action</div>
                    </div>

                    {filtered.map((v, index) => {
                      const pr = PRIORITY.find(p => p.value === v.priority) || PRIORITY[0];
                      const waitMins = Math.floor((Date.now() - new Date(v.visit_date || v.created_at)) / 60000);
                      const longWait = waitMins > 30;
                      const under5Child = isUnder5(v.date_of_birth);

                      return (
                        <div 
                          key={v.id}
                          onClick={() => openTriage(v)}
                          className="group bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)]/40 border border-[var(--border)] hover:border-[var(--accent)]/50 rounded-2xl p-4 transition-all shadow-sm cursor-pointer"
                          style={{ borderLeftWidth: '5px', borderLeftColor: pr.color }}
                        >
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                            
                            {/* Token / Position */}
                            <div className="lg:col-span-1 flex items-center gap-2">
                              <span className="w-8 h-8 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center font-mono font-black text-xs text-[var(--text-primary)] group-hover:border-[var(--accent)]/30 group-hover:text-[var(--accent)]">
                                #{index + 1}
                              </span>
                              <span className="lg:hidden text-xs font-mono text-[var(--accent)] font-bold">{v.visit_number}</span>
                            </div>

                            {/* Patient Info */}
                            <div className="lg:col-span-3 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-sm text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                                  {v.patient_name}
                                </h4>
                                <span className="hidden lg:inline-block text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded border border-[var(--border)]">
                                  {v.visit_number}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--text-muted)]">
                                <span className="text-[var(--accent)] font-bold">{v.patient_number}</span>
                                {v.phone && (
                                  <>
                                    <span>•</span>
                                    <span>{v.phone}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Demographics */}
                            <div className="lg:col-span-2 flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-[var(--accent)] border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                {v.gender?.toUpperCase() || '—'}
                              </span>
                              <span className="text-xs font-bold text-[var(--text-primary)]">
                                {getAge(v.date_of_birth)}
                              </span>
                              {under5Child && (
                                <span className="text-[9px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded">
                                  👶 Pediatric
                                </span>
                              )}
                            </div>

                            {/* Chief Complaint */}
                            <div className="lg:col-span-3 text-xs text-[var(--text-muted)]">
                              {v.chief_complaint ? (
                                <p className="line-clamp-2 italic bg-[var(--bg-elevated)]/60 p-2 rounded-xl border border-[var(--border)]/40">
                                  💬 "{v.chief_complaint}"
                                </p>
                              ) : (
                                <span className="text-[var(--text-faint)] italic">General medical consultation</span>
                              )}
                            </div>

                            {/* Wait Time & Priority */}
                            <div className="lg:col-span-1 space-y-1">
                              <div className={`font-mono text-xs flex items-center gap-1 font-bold ${longWait ? 'text-rose-400 animate-pulse' : 'text-[var(--text-muted)]'}`}>
                                <Clock size={12} />
                                {waitMins < 60 ? `${waitMins}m` : `${Math.floor(waitMins / 60)}h ${waitMins % 60}m`}
                              </div>
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: pr.color }}>
                                <span>{pr.icon}</span> {pr.value}
                              </span>
                            </div>

                            {/* Action Button */}
                            <div className="lg:col-span-2 flex justify-end">
                              <button
                                onClick={(e) => { e.stopPropagation(); openTriage(v); }}
                                className="w-full lg:w-auto px-4 py-2 rounded-xl bg-[var(--accent)] hover:opacity-90 text-[#0F1612] font-black text-xs flex items-center justify-center gap-2 shadow-sm transition-all group-hover:scale-102"
                              >
                                <Stethoscope size={14} />
                                <span>Start Triage</span>
                                <ChevronRight size={14} />
                              </button>
                            </div>

                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                histLoading ? (
                  <div className="flex flex-col items-center justify-center py-28 text-[var(--text-muted)]">
                    <Loader className="animate-spin text-[var(--accent)] mb-3" size={28} />
                    <p className="text-sm">Loading encounter logs...</p>
                  </div>
                ) : filteredHistory.length === 0 ? (
                  <div className="text-center py-20 px-6 border-2 border-dashed border-[var(--border)] rounded-3xl max-w-md mx-auto text-[var(--text-muted)]">
                    <Clipboard size={32} className="mx-auto mb-2 opacity-50 text-[var(--accent)]" />
                    <h4 className="font-bold text-sm text-[var(--text-primary)]">No Records Found</h4>
                    <p className="text-xs mt-1">No triage encounters found for {new Date(histDate).toLocaleDateString()}.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="hidden lg:grid grid-cols-12 gap-4 px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] font-bold border-b border-[var(--border)]/60">
                      <div className="col-span-4">Patient Encounter</div>
                      <div className="col-span-3">Assigned Routing Desk</div>
                      <div className="col-span-3">Chief Complaint / Note</div>
                      <div className="col-span-2 text-right">Status & Time</div>
                    </div>

                    {filteredHistory.map(v => {
                      const pr = PRIORITY.find(p => p.value === v.priority) || PRIORITY[0];
                      const dept = DEPARTMENTS.find(d => d.value === v.department);
                      const stColorClass = STATUS_COLORS[v.status] || 'text-[var(--text-muted)] bg-[var(--bg-elevated)] border-[var(--border)]';

                      return (
                        <div 
                          key={v.id}
                          className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 text-xs space-y-2 shadow-sm"
                          style={{ borderLeftWidth: '4px', borderLeftColor: pr.color }}
                        >
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                            <div className="lg:col-span-4 space-y-0.5">
                              <h5 className="font-bold text-sm text-[var(--text-primary)]">{v.patient_name}</h5>
                              <p className="text-[11px] font-mono text-[var(--text-muted)]">
                                <span className="text-[var(--accent)] font-bold">{v.patient_number}</span> · {v.visit_number} · {v.gender} · {getAge(v.date_of_birth)}
                              </p>
                            </div>

                            <div className="lg:col-span-3">
                              <span className="font-bold text-xs text-[var(--text-primary)] flex items-center gap-1.5 bg-[var(--bg-elevated)] p-2 rounded-xl border border-[var(--border)]/50">
                                <span>{dept?.icon || '🏢'}</span>
                                <span>{dept?.label || v.department || 'Outpatient Department'}</span>
                              </span>
                            </div>

                            <div className="lg:col-span-3 text-[11px] text-[var(--text-muted)]">
                              {v.chief_complaint ? (
                                <p className="line-clamp-1 italic bg-[var(--bg-elevated)]/40 p-2 rounded-lg border border-[var(--border)]/30">
                                  {v.chief_complaint}
                                </p>
                              ) : (
                                <span className="text-[var(--text-faint)] italic">—</span>
                              )}
                            </div>

                            <div className="lg:col-span-2 flex flex-col lg:items-end justify-center gap-1">
                              <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${stColorClass}`}>
                                {STATUS_LABELS[v.status] || (v.status || '').toUpperCase()}
                              </span>
                              <span className="text-[10px] text-[var(--text-faint)] font-mono">
                                {new Date(v.visit_date || v.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>

          </div>
        ) : (
          /* ─── ACTIVE CLINICAL WORKSHEET (SHOWN WHEN A PATIENT IS SELECTED) ─── */
          <div className="flex-1 overflow-y-auto bg-[var(--bg-base)] p-4 md:p-6 space-y-6">
            
            {/* WORKSTATION BANNER & BACK ACTION */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--bg-surface)] p-4 rounded-2xl border border-[var(--border)] shadow-sm">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelected(null)}
                  className="px-3 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] border border-[var(--border)] hover:border-[var(--accent)] rounded-xl text-xs font-bold text-[var(--text-primary)] transition-all flex items-center gap-1.5 shadow-sm"
                  title="Return to Triage Worklist"
                >
                  <ArrowLeft size={15} />
                  <span>Back to Queue</span>
                </button>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--text-muted)]">Active Encounter</span>
                    <span className="text-[10px] bg-[var(--accent)]/10 border border-[var(--accent)]/25 text-[var(--accent)] px-2 py-0.5 rounded font-mono font-bold">
                      {selected.visit_number}
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-[var(--text-primary)]">
                    {selected.patient_name}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button 
                  onClick={fillNormals}
                  className="flex-1 sm:flex-initial px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-400 transition-all flex items-center justify-center gap-1.5"
                >
                  <Sparkles size={13} />
                  Fill Baseline Normals
                </button>
                {flaggedCount > 0 && (
                  <div className="px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-bold flex items-center gap-1.5 animate-pulse">
                    <AlertTriangle size={13} />
                    <span>{flaggedCount} Anomalous Alert{flaggedCount > 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
            </div>

            {/* WORKSHEET GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* COLUMN 1: PATIENT DEMOGRAPHICS & DISPOSITION (4/12 width) */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Clinical Demographics File */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-elevated)]/40 flex items-center gap-2.5">
                    <User size={14} className="text-[var(--accent)]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">Patient Medical File</span>
                  </div>
                  <div className="p-5 space-y-4">
                    
                    {/* Avatar & Key attributes */}
                    <div className="flex items-center gap-4 pb-4 border-b border-[var(--border)]/50">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/5 border border-[var(--accent)]/30 flex items-center justify-center text-2xl font-black shadow-inner select-none text-[var(--accent)]">
                        {selected.patient_name?.charAt(0)}
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono bg-emerald-500/10 text-[var(--accent)] border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
                          {selected.gender?.toUpperCase()}
                        </span>
                        <p className="text-xs font-bold text-[var(--text-primary)]">
                          {getAge(selected.date_of_birth)}
                        </p>
                        {under5 && (
                          <span className="inline-block text-[9px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded">
                            👶 Pediatric (Under 5)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Info details */}
                    <div className="space-y-3.5 text-xs">
                      <div className="flex justify-between items-center py-1">
                        <span className="text-[var(--text-muted)]">Record ID</span>
                        <span className="font-mono font-bold text-[var(--text-primary)]">{selected.patient_number}</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-[var(--text-muted)]">Contact Number</span>
                        <span className="font-mono text-[var(--text-primary)]">{selected.phone || 'None'}</span>
                      </div>
                      {selected.chief_complaint && (
                        <div className="mt-2.5 p-3.5 bg-[var(--bg-elevated)]/80 border border-[var(--border)] rounded-xl space-y-1">
                          <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">Intake Chief Complaint</span>
                          <p className="text-xs text-[var(--text-primary)] font-medium leading-relaxed italic">
                            "{selected.chief_complaint}"
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Triage Clinical History Record */}
                    <div className="pt-3 border-t border-[var(--border)]/60 space-y-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
                        <HeartPulse size={12} /> Clinical Dossier (Triage Record)
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-[var(--text-muted)] block uppercase">Blood Group</label>
                        <select 
                          value={form.blood_group} 
                          onChange={e => ff('blood_group', e.target.value)}
                          className="w-full p-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] font-bold outline-none focus:border-[var(--accent)]"
                        >
                          <option value="">Unknown / Select</option>
                          {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => (
                            <option key={bg} value={bg}>{bg}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-[var(--text-muted)] block uppercase">Known Allergies</label>
                        <textarea 
                          value={form.allergies} 
                          onChange={e => ff('allergies', e.target.value)}
                          rows={2}
                          placeholder="e.g. Penicillin, Peanuts, Latex..."
                          className="w-full p-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-[var(--text-muted)] block uppercase">Chronic Conditions</label>
                        <textarea 
                          value={form.chronic_conditions} 
                          onChange={e => ff('chronic_conditions', e.target.value)}
                          rows={2}
                          placeholder="e.g. Hypertension, Asthma, Diabetes..."
                          className="w-full p-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-none"
                        />
                      </div>
                    </div>

                  </div>
                </div>

                {/* Clinical Disposition Desk */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-elevated)]/40 flex items-center gap-2.5">
                    <Send size={14} className="text-[var(--accent)]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">Disposition & Routing</span>
                  </div>
                  <div className="p-5 space-y-4">
                    
                    {/* Priority selector */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[var(--text-muted)]">Severity/Priority Class</label>
                      <div className="grid grid-cols-1 gap-2">
                        {PRIORITY.map(p => (
                          <button 
                            key={p.value} 
                            onClick={() => ff('priority', p.value)} 
                            type="button"
                            className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                              form.priority === p.value 
                                ? 'border-transparent text-white shadow-md font-bold' 
                                : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                            }`}
                            style={{ 
                              background: form.priority === p.value ? p.color : '',
                              color: form.priority === p.value ? '#0F1612' : ''
                            }}
                          >
                            <span className="text-base">{p.icon}</span>
                            <div className="space-y-0.5">
                              <span className="text-xs font-black block leading-none">{p.label}</span>
                              <span className="text-[9px] opacity-75 block leading-none font-normal">{p.desc}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Transfer Clinic Desk */}
                    <div className="space-y-2 pt-2 border-t border-[var(--border)]/40">
                      <label className="text-xs font-bold text-[var(--text-muted)] block">Transfer Clinic Desk</label>
                      <select 
                        value={form.department} 
                        onChange={e => ff('department', e.target.value)}
                        className="w-full p-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] font-bold focus:outline-none focus:ring-1 focus:ring-[var(--accent)] cursor-pointer"
                      >
                        {DEPARTMENTS.map(d => (
                          <option key={d.value} value={d.value} className="text-[var(--text-primary)]">
                            {d.icon} {d.label} — {d.desc}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* specialized MCH Clinic selection if department is selected as mch */}
                    {form.department === 'mch' && (
                      <div className="mt-3 p-3.5 bg-pink-500/5 border border-pink-500/20 rounded-xl space-y-2.5 animate-fadeIn">
                        <span className="text-[10px] font-mono text-pink-400 uppercase tracking-widest font-black block">🤰 MCH Service Selection</span>
                        <div className="grid grid-cols-1 gap-2">
                          {[
                            { value: 'mch_anc', label: '🤰 ANC - Antenatal Care', color: '#ec4899' },
                            { value: 'mch_pnc', label: '🤱 PNC - Postnatal Care', color: '#8b5cf6' },
                            { value: 'mch_cwc', label: '👶 CWC - Child Welfare', color: '#06b6d4' },
                            { value: 'mch_immunization', label: '💉 Immunization Service', color: '#f59e0b' },
                            { value: 'mch_fp', label: '👥 Family Planning Desk', color: '#10b981' },
                          ].map(s => (
                            <button 
                              key={s.value} 
                              type="button"
                              onClick={() => ff('mch_service', s.value)} 
                              className={`w-full p-2.5 rounded-lg border text-left text-xs font-bold transition-all ${
                                form.mch_service === s.value 
                                  ? 'bg-pink-500 text-white border-transparent' 
                                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)] hover:bg-[var(--bg-elevated)]'
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                </div>

              </div>

              {/* COLUMN 2: BED-SIDE VITAL SIGNS MONITOR (8/12 width) */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* ICU Beds Monitor layout card */}
                <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
                  
                  {/* Header */}
                  <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-elevated)]/40 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Activity size={14} className="text-red-500 animate-pulse" />
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">ICU physiological monitor</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      Live Vitals Feed
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    
                    {/* BLOOD PRESSURE MONITOR CONSOLE */}
                    <div className="p-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Heart className="text-rose-400" size={16} />
                          <span className="text-xs font-bold text-[var(--text-primary)]">Arterial Blood Pressure (ABP)</span>
                        </div>
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">Normal range: 120 / 80 mmHg</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                        
                        {/* Systolic */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-[var(--text-muted)] font-mono">SYSTOLIC (Upper)</span>
                            <span className="text-amber-400 font-mono">Goal: 90-140</span>
                          </div>
                          <div className="relative">
                            <input 
                              type="number" 
                              placeholder="120"
                              value={form.blood_pressure_systolic} 
                              onChange={e => ff('blood_pressure_systolic', e.target.value)}
                              className={`w-full p-3.5 bg-[var(--bg-base)] border rounded-xl text-center font-mono font-black text-lg focus:outline-none focus:ring-1 focus:ring-[var(--accent)] ${
                                flagVital('blood_pressure_systolic', form.blood_pressure_systolic) ? FLAG_COLORS[flagVital('blood_pressure_systolic', form.blood_pressure_systolic)] : 'border-[var(--border)] text-[var(--text-primary)]'
                              }`}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)] font-mono">SYS</span>
                          </div>
                          {flagVital('blood_pressure_systolic', form.blood_pressure_systolic) && flagVital('blood_pressure_systolic', form.blood_pressure_systolic) !== 'normal' && (
                            <p className="text-[10px] font-bold text-center text-rose-400">
                              🚨 Abnormal Systolic: {flagVital('blood_pressure_systolic', form.blood_pressure_systolic).toUpperCase()}
                            </p>
                          )}
                        </div>

                        {/* Diastolic */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-[var(--text-muted)] font-mono">DIASTOLIC (Lower)</span>
                            <span className="text-amber-400 font-mono">Goal: 60-90</span>
                          </div>
                          <div className="relative">
                            <input 
                              type="number" 
                              placeholder="80"
                              value={form.blood_pressure_diastolic} 
                              onChange={e => ff('blood_pressure_diastolic', e.target.value)}
                              className={`w-full p-3.5 bg-[var(--bg-base)] border rounded-xl text-center font-mono font-black text-lg focus:outline-none focus:ring-1 focus:ring-[var(--accent)] ${
                                flagVital('blood_pressure_diastolic', form.blood_pressure_diastolic) ? FLAG_COLORS[flagVital('blood_pressure_diastolic', form.blood_pressure_diastolic)] : 'border-[var(--border)] text-[var(--text-primary)]'
                              }`}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)] font-mono">DIA</span>
                          </div>
                          {flagVital('blood_pressure_diastolic', form.blood_pressure_diastolic) && flagVital('blood_pressure_diastolic', form.blood_pressure_diastolic) !== 'normal' && (
                            <p className="text-[10px] font-bold text-center text-rose-400">
                              🚨 Abnormal Diastolic: {flagVital('blood_pressure_diastolic', form.blood_pressure_diastolic).toUpperCase()}
                            </p>
                          )}
                        </div>

                      </div>
                    </div>

                    {/* THREE-CHANNEL MONITOR FEED: TEMP, PULSE, RESP */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                      
                      {/* Temperature */}
                      <div className="p-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl space-y-3">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-[var(--text-muted)] font-bold uppercase flex items-center gap-1">
                            <Thermometer size={12} className="text-amber-400" /> Temperature
                          </span>
                          <span className="font-mono text-amber-500/80">35.5 - 37.5</span>
                        </div>
                        <div className="relative">
                          <input 
                            type="number" 
                            step="0.1"
                            placeholder="36.5"
                            value={form.temperature} 
                            onChange={e => ff('temperature', e.target.value)}
                            className={`w-full p-3 bg-[var(--bg-base)] border rounded-xl text-center font-mono font-black focus:outline-none text-base ${
                              flagVital('temperature', form.temperature) ? FLAG_COLORS[flagVital('temperature', form.temperature)] : 'border-[var(--border)] text-[var(--text-primary)]'
                            }`}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)] font-mono">°C</span>
                        </div>
                        {flagVital('temperature', form.temperature) && flagVital('temperature', form.temperature) !== 'normal' && (
                          <div className="text-[10px] text-center font-bold text-rose-400">
                            {flagVital('temperature', form.temperature).toUpperCase()} TEMP
                          </div>
                        )}
                      </div>

                      {/* Pulse */}
                      <div className="p-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl space-y-3">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-[var(--text-muted)] font-bold uppercase flex items-center gap-1">
                            <Heart size={12} className="text-rose-500 animate-ping" /> Pulse Rate
                          </span>
                          <span className="font-mono text-rose-500/80">60 - 100</span>
                        </div>
                        <div className="relative">
                          <input 
                            type="number" 
                            placeholder="75"
                            value={form.pulse_rate} 
                            onChange={e => ff('pulse_rate', e.target.value)}
                            className={`w-full p-3 bg-[var(--bg-base)] border rounded-xl text-center font-mono font-black focus:outline-none text-base ${
                              flagVital('pulse_rate', form.pulse_rate) ? FLAG_COLORS[flagVital('pulse_rate', form.pulse_rate)] : 'border-[var(--border)] text-[var(--text-primary)]'
                            }`}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)] font-mono">bpm</span>
                        </div>
                        {flagVital('pulse_rate', form.pulse_rate) && flagVital('pulse_rate', form.pulse_rate) !== 'normal' && (
                          <div className="text-[10px] text-center font-bold text-rose-400">
                            {flagVital('pulse_rate', form.pulse_rate).toUpperCase()} PULSE
                          </div>
                        )}
                      </div>

                      {/* Respiratory */}
                      <div className="p-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl space-y-3">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-[var(--text-muted)] font-bold uppercase flex items-center gap-1">
                            <Wind size={12} className="text-cyan-400" /> Resp. Rate
                          </span>
                          <span className="font-mono text-cyan-500/80">12 - 20</span>
                        </div>
                        <div className="relative">
                          <input 
                            type="number" 
                            placeholder="16"
                            value={form.respiratory_rate} 
                            onChange={e => ff('respiratory_rate', e.target.value)}
                            className={`w-full p-3 bg-[var(--bg-base)] border rounded-xl text-center font-mono font-black focus:outline-none text-base ${
                              flagVital('respiratory_rate', form.respiratory_rate) ? FLAG_COLORS[flagVital('respiratory_rate', form.respiratory_rate)] : 'border-[var(--border)] text-[var(--text-primary)]'
                            }`}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)] font-mono">/min</span>
                        </div>
                        {flagVital('respiratory_rate', form.respiratory_rate) && flagVital('respiratory_rate', form.respiratory_rate) !== 'normal' && (
                          <div className="text-[10px] text-center font-bold text-rose-400">
                            {flagVital('respiratory_rate', form.respiratory_rate).toUpperCase()} RR
                          </div>
                        )}
                      </div>

                    </div>

                    {/* SpO2 OXYGENATION PANEL */}
                    <div className="p-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl space-y-3">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-[var(--text-muted)] font-bold uppercase flex items-center gap-1.5">
                          <Droplets size={12} className="text-sky-400" /> Pulse Oximetry (SpO2 / Oxygen Saturation)
                        </span>
                        <span className="font-mono text-sky-400 font-bold">Safe threshold: 95% - 100%</span>
                      </div>
                      <div className="relative">
                        <input 
                          type="number" 
                          placeholder="98"
                          value={form.oxygen_saturation} 
                          onChange={e => ff('oxygen_saturation', e.target.value)}
                          className={`w-full p-3.5 bg-[var(--bg-base)] border rounded-xl text-center font-mono font-black text-lg focus:outline-none ${
                            flagSpO2(form.oxygen_saturation) ? FLAG_COLORS[flagSpO2(form.oxygen_saturation)] : 'border-[var(--border)] text-[var(--text-primary)]'
                          }`}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] font-mono">%</span>
                      </div>
                      {flagSpO2(form.oxygen_saturation) === 'critical' && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-start gap-2.5 animate-bounce">
                          <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                          <div>
                            <strong className="block font-black">CRITICAL HYPOXIA DETECTED</strong>
                            <span>Blood oxygen level is severely low. Recommend immediate supplemental oxygen flow.</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* PHYSICAL METRICS GRID: WEIGHT, HEIGHT, BMI */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-4 border-t border-[var(--border)]/40">
                      
                      {/* Weight */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[var(--text-muted)] flex items-center gap-1">
                          <Scale size={12} className="text-emerald-400" /> Body Weight
                        </label>
                        <div className="relative">
                          <input 
                            type="number" 
                            step="0.1"
                            placeholder="70.0"
                            value={form.weight} 
                            onChange={e => ff('weight', e.target.value)}
                            className="w-full p-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl text-center font-mono font-bold focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)] font-mono">kg</span>
                        </div>
                      </div>

                      {/* Height */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[var(--text-muted)] flex items-center gap-1">
                          <Ruler size={12} className="text-emerald-400" /> Height Index
                        </label>
                        <div className="relative">
                          <input 
                            type="number" 
                            placeholder="170"
                            value={form.height} 
                            onChange={e => ff('height', e.target.value)}
                            className="w-full p-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl text-center font-mono font-bold focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)]"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-muted)] font-mono">cm</span>
                        </div>
                      </div>

                      {/* Calculated BMI */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-[var(--text-muted)] flex items-center gap-1.5">
                          <Activity size={12} className="text-emerald-400" /> Body Mass Index (BMI)
                        </label>
                        <div className={`p-2.5 rounded-xl border text-center flex flex-col justify-center h-11.5 font-mono ${
                          bmi ? FLAG_COLORS[flagBMI(bmi)] : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-faint)]'
                        }`}>
                          {bmi ? (
                            <div className="flex items-center justify-around gap-1">
                              <span className="text-sm font-black">{bmi}</span>
                              <span className="text-[9px] font-bold uppercase opacity-85">({bmiCategory})</span>
                            </div>
                          ) : (
                            <span className="text-[10px]">Enter W & H</span>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* PEDIATRIC MUAC ASSESSMENTS FOR CHILD UNDER 5 */}
                    {under5 && (
                      <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-3.5 animate-fadeIn">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Flame size={14} className="text-amber-500 animate-pulse" />
                            <span className="text-xs font-bold text-amber-400">Mid-Upper Arm Circumference (MUAC)</span>
                          </div>
                          <span className="text-[10px] font-mono text-amber-500">Child is Under 5 Years</span>
                        </div>
                        <div className="relative">
                          <input 
                            type="number" 
                            step="0.1"
                            placeholder="13.5"
                            value={form.muac} 
                            onChange={e => ff('muac', e.target.value)}
                            className={`w-full p-3.5 bg-[var(--bg-base)] border rounded-xl text-center font-mono font-black text-lg focus:outline-none ${
                              flagMUAC(form.muac) ? FLAG_COLORS[flagMUAC(form.muac)] : 'border-[var(--border)] text-[var(--text-primary)]'
                            }`}
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] font-mono">cm</span>
                        </div>
                        {flagMUAC(form.muac) === 'critical' && (
                          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-start gap-2 animate-pulse">
                            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                            <div>
                              <strong className="font-black block uppercase">Severe Acute Malnutrition (SAM) Alert</strong>
                              <span>MUAC index falls below critical threshold of 11.5cm. Flag patient profile for immediate specialist intervention.</span>
                            </div>
                          </div>
                        )}
                        {flagMUAC(form.muac) === 'low' && (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-xl">
                            <strong className="font-black block uppercase">Moderate Acute Malnutrition (MAM) Trigger</strong>
                            <span>MUAC falls in sub-normal 11.5cm - 12.5cm band. Monitor and provide supplementary feeding guidelines.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* NOTES & OBSERVATIONS */}
                    <div className="space-y-2 pt-2 border-t border-[var(--border)]/40">
                      <label className="text-xs font-bold text-[var(--text-muted)] block">Clinical Observations & General Condition</label>
                      <textarea 
                        value={form.triage_notes} 
                        onChange={e => ff('triage_notes', e.target.value)} 
                        rows={3}
                        placeholder="General appearance, alert levels, skin conditions, respiratory distress markers..."
                        className="w-full p-3.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
                      />
                    </div>

                  </div>

                  {/* ACTIONS FOOTER */}
                  <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-elevated)]/40 flex justify-between sm:justify-end items-center gap-3">
                    <button 
                      type="button"
                      onClick={() => setSelected(null)}
                      className="px-5 py-2.5 text-xs font-bold rounded-xl bg-transparent hover:bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border)] transition-all flex items-center gap-1.5"
                    >
                      <ArrowLeft size={14} />
                      <span>Back to Worklist</span>
                    </button>
                    <button 
                      type="button"
                      onClick={handleSubmit} 
                      disabled={saving}
                      className="px-7 py-2.5 text-xs font-black rounded-xl bg-[var(--accent)] hover:opacity-90 text-[#0F1612] flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <Loader className="animate-spin" size={14} />
                          <span>Saving records...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle size={14} />
                          <span>Commit Vitals & Send to {DEPARTMENTS.find(d => d.value === form.department)?.label}</span>
                        </>
                      )}
                    </button>
                  </div>

                </div>

              </div>

            </div>

          </div>
        )}

      </main>

    </div>
  );
}
