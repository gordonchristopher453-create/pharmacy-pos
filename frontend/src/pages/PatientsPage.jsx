import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api';
import { connectSocket } from '../services/socket';
import { useSearchParams } from "react-router-dom";
import toast from 'react-hot-toast';
import ClinicalTimeline from '../components/ClinicalTimeline';
import {
  UserRound, Plus, Search, X, Loader, ChevronRight,
  Phone, Calendar, Activity, Clock, AlertTriangle,
  CheckCircle, Users, ArrowLeft, Edit2, Heart,
  RefreshCw, Stethoscope, FlaskConical, Pill,
  CreditCard, BedDouble, Zap, TrendingUp, Filter,
  FileText, Shield, MapPin, CheckCircle2, User,
  HeartPulse, Thermometer, ChevronDown, Award,
  ClipboardList, DollarSign, Printer, Receipt,
  Wallet, Smartphone, Building, Check, CheckSquare, Square,
  ReceiptText, Coins
} from 'lucide-react';
import { printTreatmentSummary } from '../utils/printTreatmentSummary';
import { printLabResult } from '../utils/printLabResult';
import { printBillingReceipt } from '../utils/printBillingReceipt';

// ── Primitives ────────────────────────────────────────────────────────────────
const Card = ({ children, style={}, className="", ...props }) => (
  <div 
    className={`bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-md hover:shadow-lg transition-all duration-300 ${className}`} 
    style={{ ...style }} 
    {...props}
  >
    {children}
  </div>
);

const Input = ({ label, icon: Icon, error, ...props }) => (
  <div className="w-full">
    {label && (
      <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5 uppercase tracking-wider">
        {label}
      </label>
    )}
    <div className="relative">
      {Icon && (
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
          <Icon size={16} />
        </div>
      )}
      <input 
        {...props} 
        className={`w-full ${Icon ? 'pl-10' : 'px-4'} py-2.5 bg-[var(--bg-elevated)] border ${error ? 'border-[var(--danger)]' : 'border-[var(--border)]'} rounded-xl text-[var(--text-primary)] text-sm outline-none transition-all duration-200 focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 font-sans`} 
      />
    </div>
    {error && <span className="text-xs text-[var(--danger)] mt-1 block">{error}</span>}
  </div>
);

const Select = ({ label, icon: Icon, children, ...props }) => (
  <div className="w-full">
    {label && (
      <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1.5 uppercase tracking-wider">
        {label}
      </label>
    )}
    <div className="relative">
      {Icon && (
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
          <Icon size={16} />
        </div>
      )}
      <select 
        {...props} 
        className={`w-full ${Icon ? 'pl-10' : 'px-4'} py-2.5 pr-8 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] text-sm outline-none transition-all duration-200 appearance-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 cursor-pointer`}
      >
        {children}
      </select>
      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
        <ChevronDown size={16} />
      </div>
    </div>
  </div>
);

const Btn = ({ children, variant='primary', size='md', icon: Icon, className="", ...props }) => {
  const getStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-[#0F1612] shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99]';
      case 'danger':
        return 'bg-[var(--danger)] hover:bg-[var(--danger)]/90 text-white shadow-sm';
      case 'warning':
        return 'bg-[var(--warning)] hover:bg-[var(--warning)]/90 text-[#0F1612] shadow-sm';
      case 'ghost':
        return 'bg-transparent hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border)]';
      default:
        return 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border)]';
    }
  };

  const getSize = () => {
    switch (size) {
      case 'sm': return 'px-3 py-1.5 text-xs';
      case 'lg': return 'px-6 py-3.5 text-base';
      default: return 'px-4 py-2.5 text-sm';
    }
  };

  return (
    <button 
      {...props} 
      className={`inline-flex items-center justify-center gap-2 font-bold rounded-xl cursor-pointer transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${getStyles()} ${getSize()} ${className}`}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 18 : 16} />}
      {children}
    </button>
  );
};

// ── Constants ─────────────────────────────────────────────────────────────────
const INSURANCE_PROVIDERS = [
  { value: 'cash', label: 'Cash Tender / Self Pay' },
  { value: 'mpesa', label: 'M-Pesa Mobile Money' },
  { value: 'sha', label: 'SHA (Social Health Authority)' },
  { value: 'sha_comp', label: 'SHA Comprehensive Cover' },
  { value: 'jubilee', label: 'Jubilee Insurance' },
  { value: 'britam', label: 'Britam Insurance' },
  { value: 'apa', label: 'APA Insurance' },
  { value: 'aar', label: 'AAR Insurance' },
  { value: 'cic', label: 'CIC General Insurance' },
  { value: 'first_assoc', label: 'First Assurance' },
  { value: 'madison', label: 'Madison Insurance' },
  { value: 'ga', label: 'GA Insurance' },
  { value: 'old_mutual', label: 'Old Mutual / UAP Insurance' },
  { value: 'equity_afia', label: 'Equity Afia Insurance' },
  { value: 'heritage', label: 'Heritage Insurance' },
  { value: 'mtiba', label: 'M-TIBA Health Cover' },
  { value: 'waiver', label: 'Approved Waiver / Free' }
];

const CLINICS_LIST = [
  { value: 'opd', label: '🩺 OPD (General Outpatient Doctor)', fee: 500 },
  { value: 'mch', label: '🤰 Maternal & Child Health (MCH)', fee: 500 },
  { value: 'dental', label: '🦷 Dental Clinic', fee: 1000 },
  { value: 'eye', label: '👁 Eye / Ophthalmology Clinic', fee: 800 },
  { value: 'lab', label: '🔬 Laboratory Diagnostics', fee: 300 },
  { value: 'pharmacy', label: '💊 Pharmacy Desk', fee: 200 },
  { value: 'physio', label: '🏃 Physiotherapy Unit', fee: 1000 },
  { value: 'emergency', label: '🚨 Emergency Ward', fee: 1000 },
];

const STATUS_META = {
  waiting:          { label: 'Waiting Triage', color: 'var(--warning)',  icon: Clock,       bg: '#eab308' },
  WAITING_TRIAGE:   { label: 'Waiting Triage', color: 'var(--warning)',  icon: Clock,       bg: '#eab308' },
  waiting_triage:   { label: 'Waiting Triage', color: 'var(--warning)',  icon: Clock,       bg: '#eab308' },
  REGISTERED:       { label: 'Registered',     color: 'var(--info)',     icon: Activity,    bg: '#06b6d4' },
  triage:           { label: 'Triage',         color: 'var(--info)',     icon: Activity,    bg: '#06b6d4' },
  triaged:          { label: 'Triaged',        color: 'var(--info)',     icon: Activity,    bg: '#06b6d4' },
  IN_TRIAGE:        { label: 'In Triage',      color: 'var(--info)',     icon: Activity,    bg: '#06b6d4' },
  with_doctor:      { label: 'With Doctor',    color: '#a855f7',         icon: Stethoscope, bg: '#a855f7' },
  WAITING_DOCTOR:   { label: 'Waiting Doctor', color: 'var(--warning)',  icon: Clock,       bg: '#eab308' },
  IN_CONSULTATION:  { label: 'In Consultation',color: '#a855f7',         icon: Stethoscope, bg: '#a855f7' },
  lab:              { label: 'In Lab',         color: '#f97316',         icon: FlaskConical,bg: '#f97316' },
  radiology:        { label: 'Radiology',      color: '#06b6d4',         icon: Activity,    bg: '#06b6d4' },
  pharmacy:         { label: 'Pharmacy',       color: 'var(--accent)',   icon: Pill,        bg: 'var(--accent)' },
  billing:          { label: 'Billing',        color: 'var(--warning)',  icon: CreditCard,  bg: '#eab308' },
  admitted:         { label: 'Admitted',       color: 'var(--danger)',   icon: BedDouble,   bg: '#ef4444' },
  discharged:       { label: 'Discharged',     color: 'var(--text-muted)',icon: CheckCircle, bg: '#6b7280' },
  COMPLETED:        { label: 'Completed',      color: 'var(--text-muted)',icon: CheckCircle, bg: '#6b7280' },
};

const isStatusMatch = (vStatus, targetKey) => {
  if (!vStatus) return false;
  const s = vStatus.toString().toLowerCase();
  if (targetKey === 'waiting') return ['waiting', 'waiting_triage', 'registered', 'open'].includes(s);
  if (targetKey === 'triage') return ['triage', 'triaged', 'in_triage', 'waiting_triage'].includes(s);
  if (targetKey === 'with_doctor') return ['with_doctor', 'doctor', 'in_consultation', 'waiting_doctor', 'opd'].includes(s);
  if (targetKey === 'lab') return ['lab', 'waiting_lab', 'in_lab', 'waiting_results'].includes(s);
  if (targetKey === 'pharmacy') return ['pharmacy', 'waiting_pharmacy', 'in_pharmacy'].includes(s);
  if (targetKey === 'billing') return ['billing', 'waiting_payment', 'reception'].includes(s);
  return s === targetKey.toLowerCase();
};

const PRIORITY = {
  normal:    { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)', label: 'Normal' },
  urgent:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'Urgent' },
  emergency: { color: '#ef4444', bg: 'rgba(239,68,68,0.2)', label: 'EMERGENCY' },
};

const getAge = dob => {
  if (!dob) return '—';
  return Math.floor((Date.now() - new Date(dob)) / (365.25*24*60*60*1000)) + 'y';
};

const EMPTY_PATIENT = {
  full_name:'', date_of_birth:'', gender:'',
  id_type:'national_id', national_id:'', passport_number:'',
  phone:'', email:'', address:'', county:'', marital_status:'',
  occupation:'', insurance_provider:'cash',
  next_of_kin_name:'', next_of_kin_phone:'', next_of_kin_relation:''
};

const EMPTY_VISIT = {
  visit_type:'routine', department:'opd', priority:'normal',
  consultation_fee:500, fee_paid:false, payment_method:'cash',
  insurance_provider:'cash', notes:'', mch_service:'',
  reference_number:'', member_number:'', auth_code:'', copay_amount:'', print_receipt:true
};

export default function PatientsPage() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") || "queue");
  const [patients, setPatients] = useState([]);
  const [stats, setStats] = useState({});
  const [visits, setVisits] = useState([]);
  const [visitStats, setVisitStats] = useState({});
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [queueSearch, setQueueSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [historyVisits, setHistoryVisits] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const todayStr = new Date().toISOString().split('T')[0];
  const [historyDateFrom, setHistoryDateFrom] = useState(todayStr);
  const [historyDateTo, setHistoryDateTo] = useState(todayStr);
  const [saving, setSaving] = useState(false);
  
  // Registration and wizard state
  const [registerStep, setRegisterStep] = useState(1);
  const [patientForm, setPatientForm] = useState(EMPTY_PATIENT);
  const [visitForm, setVisitForm] = useState(EMPTY_VISIT);
  const [vitalsForm, setVitalsForm] = useState({
    blood_pressure_systolic:'', blood_pressure_diastolic:'',
    pulse_rate:'', temperature:'', respiratory_rate:'',
    oxygen_saturation:'', weight:'', height:'', blood_glucose:'', notes:''
  });
  
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileModalTab, setProfileModalTab] = useState('timeline');
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [expandedVisitId, setExpandedVisitId] = useState(null);
  const [expandedVisitDetail, setExpandedVisitDetail] = useState(null);
  const [expandedVisitLoading, setExpandedVisitLoading] = useState(false);
  const [billingQueue, setBillingQueue] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [clock, setClock] = useState(new Date());

  // Reception Payment Collection States
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [collectVisit, setCollectVisit] = useState(null);
  const [collectBill, setCollectBill] = useState({ items: [], total: 0, paid: 0, waived: 0, balance: 0 });
  const [collectLoading, setCollectLoading] = useState(false);
  const [collectSaving, setCollectSaving] = useState(false);
  const [selectedCollectItems, setSelectedCollectItems] = useState([]);
  const [collectForm, setCollectForm] = useState({
    payment_method: 'cash',
    amount: '',
    cash_tendered: '',
    reference_number: '',
    notes: '',
    insurance_provider: 'SHA / Social Health Authority',
    member_number: '',
    auth_code: '',
    copay_amount: '',
    print_receipt_on_save: true
  });
  const [showQuickPickerModal, setShowQuickPickerModal] = useState(false);
  const [quickPickerSearch, setQuickPickerSearch] = useState('');

  const { user } = useSelector(state => state.auth);
  const isReceptionist = user?.role === 'receptionist';

  const pf  = (k,v) => setPatientForm(p => ({...p,[k]:v}));
  const vf  = (k,v) => setVisitForm(p => ({...p,[k]:v}));
  const vtf = (k,v) => setVitalsForm(p => ({...p,[k]:v}));

  const getRevisitInfo = () => {
    if (!selectedPatient || !selectedPatient.visits || selectedPatient.visits.length === 0) {
      return null;
    }
    const lastVisit = selectedPatient.visits[0];
    const lastVisitDate = new Date(lastVisit.visit_date || lastVisit.created_at);
    const today = new Date();
    const diffTime = Math.abs(today - lastVisitDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isWithin7Days = diffDays <= 7;
    return {
      lastVisitDate: lastVisitDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      diffDays,
      isWithin7Days,
      lastVisitNumber: lastVisit.visit_number
    };
  };

  const revisitInfo = getRevisitInfo();

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetchQueue();
    const iv = setInterval(fetchQueue, 10000);
    const socket = connectSocket();
    if (socket && user?.pharmacy_id) {
      socket.on(`queue_update_${user.pharmacy_id}`, fetchQueue);
      socket.on(`visit_opened_${user.pharmacy_id}`, fetchQueue);
      socket.on(`visit_updated_${user.pharmacy_id}`, fetchQueue);
    }
    return () => {
      clearInterval(iv);
      if (socket && user?.pharmacy_id) {
        socket.off(`queue_update_${user.pharmacy_id}`, fetchQueue);
        socket.off(`visit_opened_${user.pharmacy_id}`, fetchQueue);
        socket.off(`visit_updated_${user.pharmacy_id}`, fetchQueue);
      }
    };
  }, [dateFrom, dateTo, user]);
  useEffect(() => { const t = setTimeout(fetchPatients, 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { fetchHistory(); }, [historyDateFrom, historyDateTo]);

  const fetchAll = () => { fetchPatients(); fetchQueue(); fetchHistory(); };

  const handleRestorePatients = async () => {
    try {
      toast.loading('Restoring & synchronizing past patient database...', { id: 'restore-patients' });
      const res = await api.post('/patients/restore-records');
      toast.success(res.data?.message || 'Patient database synchronized!', { id: 'restore-patients' });
      fetchAll();
    } catch (err) {
      toast.error('Failed to sync patient records: ' + (err.response?.data?.message || err.message), { id: 'restore-patients' });
    }
  };

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/patients?search=${search}&limit=100`);
      setPatients(res.data.data.patients || []);
      setStats(res.data.data.stats || {});
    } catch { toast.error('Failed to load patients'); }
    finally { setLoading(false); }
  };

  const fetchPaymentHistory = async () => {
    try {
      const res = await api.get('/billing/payments?limit=50');
      setPaymentHistory(res.data.data || []);
    } catch { toast.error('Failed to load payment history'); }
  };
  
  const fetchQueue = async () => {
    try {
      const res = await api.get('/patients/visits', {
        params: {
          date_from: dateFrom,
          date_to: dateTo,
          limit: 1000
        }
      });
      setVisits(res.data.data.visits || []);
      setVisitStats(res.data.data.stats || {});
    } catch {}
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const dFrom = historyDateFrom || todayStr;
      const dTo = historyDateTo || todayStr;
      const params = new URLSearchParams({ date_from: dFrom, date_to: dTo, limit: 500 });
      if (historySearch) params.append('search', historySearch);
      const res = await api.get(`/patients/history/search?` + params.toString());
      setHistoryVisits(res.data.data || []);
    } catch { toast.error('Failed to load history'); }
    finally { setHistoryLoading(false); }
  };

  const fetchPatientProfile = async (id) => {
    try {
      const res = await api.get(`/patients/${id}`);
      setSelectedPatient(res.data.data);
      setShowProfileModal(true);
    } catch { toast.error('Failed to load patient'); }
  };

  const handleOpenCheckIn = (patient) => {
    if (!patient) return;
    const pastVisits = patient.visits || [];
    if (pastVisits.length > 0) {
      const lastVisit = pastVisits[0];
      const lastVisitDate = new Date(lastVisit.visit_date || lastVisit.created_at);
      const today = new Date();
      const diffTime = Math.abs(today - lastVisitDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 7) {
        setVisitForm({
          ...EMPTY_VISIT,
          visit_type: 'revisit',
          consultation_fee: 0,
          payment_method: 'waiver'
        });
      } else {
        setVisitForm({
          ...EMPTY_VISIT,
          visit_type: 'revisit',
          consultation_fee: 500,
          payment_method: 'cash'
        });
      }
    } else {
      setVisitForm(EMPTY_VISIT);
    }
    setShowVisitModal(true);
  };

  const handleRegisterPatient = async () => {
    if (!patientForm.full_name?.trim()) { toast.error('Full legal name is required'); return; }
    if (!patientForm.date_of_birth) { toast.error('Date of birth is required'); return; }
    if (!patientForm.gender) { toast.error('Gender is required'); return; }
    if (!patientForm.phone?.trim()) { toast.error('Phone contact number is required'); return; }

    if (patientForm.id_type === 'national_id' && !patientForm.national_id?.trim()) {
      toast.error('National ID Card Number is mandatory for National ID option');
      return;
    }
    if (patientForm.id_type === 'passport' && !patientForm.passport_number?.trim()) {
      toast.error('Passport Number is mandatory for Passport option');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...patientForm,
        national_id: patientForm.id_type === 'national_id' ? patientForm.national_id : (patientForm.id_type === 'passport' ? patientForm.passport_number : patientForm.national_id || null)
      };
      const res = await api.post('/patients', payload);
      toast.success(`✅ Patient registered: ${res.data.data.patient_number}`);
      setShowRegisterModal(false);
      setPatientForm(EMPTY_PATIENT);
      setVisitForm(EMPTY_VISIT);
      setRegisterStep(1);
      fetchPatients();
      fetchPatientProfile(res.data.data.id); 
      setShowVisitModal(true);
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to register patient'); }
    finally { setSaving(false); }
  };

  const handleCreateVisit = async () => {
    if (!selectedPatient) return;
    setSaving(true);
    try {
      const payload = {
        ...visitForm,
        department: visitForm.department || visitForm.visit_type || 'opd'
      };
      const visitRes = await api.post(`/patients/${selectedPatient.id}/visits`, payload);
      const createdVisitId = visitRes.data.data.id;
      
      if ((visitForm.department === 'mch' || visitForm.visit_type === 'mch') && visitForm.mch_service) {
        await api.put(`/patients/visits/${createdVisitId}/status`, { status: 'mch', mch_service: visitForm.mch_service }).catch(()=>{});
      }

      // If fee was collected/settled at check-in, process payment record and trigger receipt
      if (visitForm.fee_paid && parseFloat(visitForm.consultation_fee || 0) > 0) {
        try {
          const feeNum = parseFloat(visitForm.consultation_fee);
          await api.post(`/billing/visit/${createdVisitId}/pay`, {
            visit_id: createdVisitId,
            payment_method: visitForm.payment_method || 'cash',
            amount: feeNum,
            reference_number: visitForm.reference_number || null,
            insurance_provider: visitForm.insurance_provider || null,
            member_number: visitForm.member_number || null,
            auth_code: visitForm.auth_code || null,
            copay_amount: visitForm.copay_amount ? parseFloat(visitForm.copay_amount) : 0,
            notes: 'Encounter check-in fee collected at reception'
          });

          if (visitForm.print_receipt) {
            printBillingReceipt({
              patient_name: selectedPatient.full_name,
              patient_number: selectedPatient.patient_number,
              visit_number: visitRes.data.data.visit_number,
              total_amount: feeNum,
              payment_method: visitForm.payment_method || 'cash',
              reference_number: visitForm.reference_number,
              created_at: new Date().toISOString(),
              items: [{ item_name: 'Consultation Fee (' + (visitForm.department || 'OPD').toUpperCase() + ')', item_type: 'consultation', unit_price: feeNum, quantity: 1, total_price: feeNum }]
            }, user?.pharmacy);
          }
        } catch (payErr) {
          console.error('Auto payment collection error on visit creation:', payErr);
        }
      }

      toast.success('✅ Patient checked in & pushed to clinic queue');
      setShowVisitModal(false);
      setVisitForm(EMPTY_VISIT);
      fetchQueue();
      if (showProfileModal) fetchPatientProfile(selectedPatient.id);
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to check in patient'); }
    finally { setSaving(false); }
  };

  const handleOpenCollectModal = async (visit) => {
    if (!visit) return;
    setCollectVisit(visit);
    setCollectLoading(true);
    setShowCollectModal(true);
    try {
      const vid = visit.id || visit.visit_id;
      const res = await api.get(`/billing/visit/${vid}`);
      const billData = res.data.data || { items: [], total: 0, paid: 0, waived: 0, balance: 0 };
      setCollectBill(billData);
      
      const pendingItems = (billData.items || []).filter(i => i.status === 'pending' || i.status === 'partial');
      setSelectedCollectItems(pendingItems.map(i => i.id));
      
      const pendingTotal = pendingItems.reduce((sum, item) => {
        const tot = parseFloat(item.total_price || 0);
        const paid = parseFloat(item.paid_amount || 0);
        return sum + Math.max(0, tot - paid);
      }, 0) || (parseFloat(visit.consultation_fee || 0) > 0 && !visit.fee_paid ? parseFloat(visit.consultation_fee) : 0);

      setCollectForm({
        payment_method: visit.payment_method || 'cash',
        amount: pendingTotal > 0 ? String(pendingTotal) : (billData.total > 0 ? String(billData.balance || billData.total) : '500'),
        cash_tendered: '',
        reference_number: visit.reference_number || '',
        notes: '',
        insurance_provider: visit.insurance_provider || 'SHA / Social Health Authority',
        member_number: visit.member_number || visit.sha_number || '',
        auth_code: visit.auth_code || '',
        copay_amount: visit.copay_amount ? String(visit.copay_amount) : '',
        print_receipt_on_save: true
      });
    } catch (err) {
      toast.error('Failed to load bill details');
    } finally {
      setCollectLoading(false);
    }
  };

  const handleProcessCollection = async () => {
    if (!collectVisit) return;
    if (!collectForm.amount || parseFloat(collectForm.amount) <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    setCollectSaving(true);
    try {
      const vid = collectVisit.id || collectVisit.visit_id;
      const payload = {
        ...collectForm,
        visit_id: vid,
        item_ids: selectedCollectItems,
        amount: parseFloat(collectForm.amount)
      };
      const res = await api.post(`/billing/visit/${vid}/pay`, payload);
      toast.success(`✅ Payment of KES ${parseFloat(collectForm.amount).toLocaleString('en-KE')} processed via ${collectForm.payment_method.toUpperCase()}`);
      
      if (collectForm.print_receipt_on_save) {
        try {
          const receiptData = {
            patient_name: collectVisit.patient_name || selectedPatient?.full_name,
            patient_number: collectVisit.patient_number || selectedPatient?.patient_number,
            visit_number: collectVisit.visit_number,
            total_amount: parseFloat(collectForm.amount),
            payment_method: collectForm.payment_method,
            reference_number: collectForm.reference_number,
            created_at: new Date().toISOString(),
            items: (collectBill.items && collectBill.items.length > 0)
              ? collectBill.items.filter(i => selectedCollectItems.includes(i.id) || selectedCollectItems.length === 0)
              : [{ item_name: 'Consultation Fee', item_type: 'consultation', total_price: parseFloat(collectForm.amount), quantity: 1, unit_price: parseFloat(collectForm.amount) }]
          };
          printBillingReceipt(receiptData, user?.pharmacy);
        } catch (prErr) {
          console.error('Receipt print error:', prErr);
        }
      }

      setShowCollectModal(false);
      fetchQueue();
      if (selectedPatient) {
        fetchPatientProfile(selectedPatient.id);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Payment collection failed');
    } finally {
      setCollectSaving(false);
    }
  };

  const handleAddVitals = async () => {
    if (!selectedVisit) return;
    setSaving(true);
    try {
      await api.post(`/patients/visits/${selectedVisit.id}/vitals`, vitalsForm);
      toast.success('✅ Vitals recorded — patient sent to doctor');
      setShowVitalsModal(false);
      setVitalsForm({ blood_pressure_systolic:'', blood_pressure_diastolic:'', pulse_rate:'', temperature:'', respiratory_rate:'', oxygen_saturation:'', weight:'', height:'', blood_glucose:'', notes:'' });
      fetchQueue();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to record vitals'); }
    finally { setSaving(false); }
  };

  const handleToggleVisit = async (visitId) => {
    if (expandedVisitId === visitId) {
      setExpandedVisitId(null);
      setExpandedVisitDetail(null);
      return;
    }
    setExpandedVisitId(visitId);
    setExpandedVisitLoading(true);
    setExpandedVisitDetail(null);
    try {
      const { data: res } = await api.get('/consultations/visit/' + visitId);
      setExpandedVisitDetail(res.data);
    } catch (err) {
      toast.error('Failed to load visit details');
    }
    setExpandedVisitLoading(false);
  };

  const handleUpdateStatus = async (visitId, status) => {
    try {
      await api.put(`/patients/visits/${visitId}/status`, { status });
      toast.success(`Status → ${STATUS_META[status]?.label || status}`);
      if (status === 'discharged') {
        try {
          const [visRes, conRes, injRes, vitalsRes] = await Promise.allSettled([
            api.get('/patients/visits/' + visitId),
            api.get('/consultations/visit/' + visitId),
            api.get('/injection-room/visit/' + visitId),
            api.get('/patients/visits/' + visitId + '/vitals')
          ]);
          const visitData = visRes.status === 'fulfilled' ? visRes.value.data.data : {};
          const patRes = visitData?.patient_id ? await api.get('/patients/' + visitData.patient_id).catch(() => null) : null;
          const patientData = patRes?.data?.data || visitData?.patient || {};
          const vitals = vitalsRes.status === 'fulfilled' ? (vitalsRes.value.data.data || []) : [];
          const detail = {
            patient: patientData,
            consultation: conRes.status === 'fulfilled' ? conRes.value.data.data : null,
            injection_orders: injRes.status === 'fulfilled' ? (injRes.value.data.data || []) : [],
            vitals,
            visit: visitData
          };
          printTreatmentSummary(detail, user?.pharmacy);
        } catch (sumErr) {
          console.error('Failed to autogenerate treatment summary:', sumErr);
        }
      }
      fetchQueue();
    } catch { toast.error('Failed to update status'); }
  };

  // Status index for clinical progress timeline
  const getStatusIndex = (status) => {
    switch (status) {
      case 'open':
      case 'waiting':
        return 0;
      case 'triage':
      case 'triaged':
        return 1;
      case 'with_doctor':
      case 'doctor':
        return 2;
      case 'lab':
      case 'radiology':
        return 3;
      case 'pharmacy':
        return 4;
      case 'billing':
        return 5;
      case 'discharged':
      case 'admitted':
        return 6;
      default:
        return 0;
    }
  };

  // ── Filtered queue ─────────────────────────────────────────────────────────
  const filteredVisits = visits.filter(v => {
    const matchSearch = !queueSearch ||
      v.patient_name?.toLowerCase().includes(queueSearch.toLowerCase()) ||
      v.patient_number?.toLowerCase().includes(queueSearch.toLowerCase()) ||
      v.phone?.includes(queueSearch);
    const matchStatus = statusFilter === 'all' || isStatusMatch(v.status, statusFilter);
    const vDate = v.visit_date?.split('T')[0] || v.created_at?.split('T')[0];
    const matchDate = (!dateFrom || vDate >= dateFrom) && (!dateTo || vDate <= dateTo);
    return matchSearch && matchStatus && matchDate;
  });

  const filteredHistory = historyVisits.filter(v => {
    return !historySearch ||
      v.patient_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
      v.patient_number?.toLowerCase().includes(historySearch.toLowerCase()) ||
      v.phone?.includes(historySearch);
  });

  const counties = ['Nairobi','Mombasa','Kisumu','Nakuru','Eldoret','Thika','Malindi','Kitale','Garissa','Kakamega','Nyeri','Machakos','Meru','Embu','Kisii','Kericho','Bomet','Migori','Homa Bay','Siaya','Bungoma','Busia','Trans Nzoia','Uasin Gishu','Nandi','Baringo','Laikipia','Samburu','Turkana','West Pokot','Marsabit','Isiolo','Tharaka Nithi','Kitui','Makueni','Nyandarua','Muranga','Kirinyaga','Kajiado','Narok','Vihiga','Kwale','Kilifi','Tana River','Lamu','Taita Taveta','Mandera','Wajir'];

  // ── QUEUE TAB ──────────────────────────────────────────────────────────────
  const QueueTab = () => (
    <div className="space-y-6">
      {/* Live Status Control Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-10 gap-3">
        {Object.entries(STATUS_META).filter(([k]) => ['waiting','triage','with_doctor','lab','radiology','pharmacy','billing','admitted'].includes(k)).map(([key, s]) => {
          const count = visits.filter(v => isStatusMatch(v.status, key)).length;
          const isSelected = statusFilter === key;
          const IconComp = s.icon;
          return (
            <div 
              key={key} 
              id={`status-card-${key}`}
              onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
              className={`p-3.5 rounded-xl cursor-pointer transition-all duration-300 relative overflow-hidden group select-none border ${
                isSelected 
                  ? 'bg-[var(--accent)]/10 border-[var(--accent)] shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
                  : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border-[var(--border)] hover:border-[var(--text-muted)]/30'
              }`}
            >
              {/* Dynamic light indicator for active items */}
              {count > 0 && (
                <span className="absolute top-2 right-2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]"></span>
                </span>
              )}
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-[var(--accent)]/20' : 'bg-[var(--bg-elevated)] group-hover:bg-[var(--bg-surface)]'} transition-colors`}>
                  <IconComp size={16} style={{ color: isSelected ? 'var(--accent)' : s.color }} />
                </div>
                <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide truncate">{s.label}</div>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className={`text-2xl font-extrabold ${count > 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-faint)]'}`}>
                  {count}
                </span>
                {count > 0 && <span className="text-[10px] text-[var(--accent)] font-semibold">active</span>}
              </div>
            </div>
          );
        })}
        <div 
          onClick={() => setStatusFilter('all')}
          className={`p-3.5 rounded-xl cursor-pointer transition-all duration-300 border col-span-2 sm:col-span-1 select-none ${
            statusFilter === 'all' 
              ? 'bg-[var(--accent)]/15 border-[var(--accent)] shadow-md' 
              : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] border-[var(--border)]'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-[var(--bg-elevated)] text-[var(--accent)]">
              <Users size={16} />
            </div>
            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">All Today</div>
          </div>
          <div className="text-2xl font-extrabold text-[var(--accent)] mt-1">{visits.length}</div>
        </div>
      </div>

      {/* Control Panel: Search & Date Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)]">
        <div className="flex-1 min-w-[280px] relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
            <Search size={16} />
          </div>
          <input 
            value={queueSearch} 
            onChange={e => setQueueSearch(e.target.value)}
            placeholder="Filter current queue by name, patient number, phone..."
            className="w-full pl-10 pr-10 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30"
          />
          {queueSearch && (
            <button 
              onClick={() => setQueueSearch('')} 
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-[var(--bg-elevated)] px-3 py-1.5 rounded-xl border border-[var(--border)]">
            <Calendar size={14} className="text-[var(--text-muted)]" />
            <input 
              type="date" 
              value={dateFrom} 
              onChange={e => setDateFrom(e.target.value)}
              className="bg-transparent text-xs text-[var(--text-primary)] outline-none cursor-pointer border-none"
            />
            <span className="text-xs text-[var(--text-muted)] px-1">to</span>
            <input 
              type="date" 
              value={dateTo} 
              onChange={e => setDateTo(e.target.value)}
              className="bg-transparent text-xs text-[var(--text-primary)] outline-none cursor-pointer border-none"
            />
          </div>

          <Btn variant="ghost" onClick={fetchQueue} icon={RefreshCw}>
            Sync
          </Btn>

          <Btn id="register-patient-btn" onClick={() => { setRegisterStep(1); setShowRegisterModal(true); }} icon={Plus}>
            New Registration
          </Btn>
        </div>
      </div>

      {/* Queue List / Cards */}
      {filteredVisits.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--bg-elevated)] flex items-center justify-center border border-[var(--border)] mb-4 text-3xl animate-bounce">
            🏢
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">
            {statusFilter !== 'all' ? `No patients matches ${STATUS_META[statusFilter]?.label}` : 'No Patients in Queue'}
          </h3>
          <p className="text-sm text-[var(--text-muted)] max-w-sm mb-6">
            There are currently no patients checked in for this queue. Start by registering a new patient or lookup an existing one to check-in.
          </p>
          <Btn onClick={() => { setRegisterStep(1); setShowRegisterModal(true); }} icon={Plus}>
            Check in a Patient
          </Btn>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredVisits.map((v) => {
            const st = STATUS_META[v.status] || { label: v.status, color: 'var(--text-muted)', icon: Clock, bg: '#6b7280' };
            const pr = PRIORITY[v.priority] || PRIORITY.normal;
            const currentStepIdx = getStatusIndex(v.status);
            
            // Steps for timeline
            const timelineSteps = [
              { label: 'Register', idx: 0 },
              { label: 'Triage', idx: 1 },
              { label: 'Consult', idx: 2 },
              { label: 'Diagnostics', idx: 3 },
              { label: 'Pharmacy', idx: 4 },
              { label: 'Billing', idx: 5 },
              { label: 'Completed', idx: 6 }
            ];

            return (
              <Card 
                key={v.id} 
                id={`queue-item-${v.id}`}
                className="overflow-hidden border-l-[4px] relative transition-transform hover:-translate-y-[2px]" 
                style={{ borderLeftColor: st.color }}
              >
                {/* Upper Details Grid */}
                <div className="p-5">
                  <div className="flex flex-col lg:flex-row justify-between items-start gap-4 lg:gap-6">
                    {/* Primary details */}
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0" style={{ background: `${st.color}15`, border: `1px solid ${st.color}35` }}>
                        <st.icon size={20} style={{ color: st.color }} />
                      </div>
                      
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="text-base font-bold text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors cursor-pointer" onClick={() => fetchPatientProfile(v.patient_id)}>
                            {v.patient_name}
                          </span>
                          <span className="text-[11px] font-mono bg-[var(--bg-elevated)] border border-[var(--border)] px-2 py-0.5 rounded-md text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                            {v.patient_number}
                          </span>
                          {v.priority !== 'normal' && (
                            <span 
                              className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse"
                              style={{ background: pr.bg, color: pr.color, border: `1px solid ${pr.color}30` }}
                            >
                              {v.priority === 'emergency' ? '🚨 EMERGENCY' : '⚡ URGENT'}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-[var(--text-muted)] flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <span className="capitalize font-semibold text-[var(--text-primary)]">{v.gender}</span>
                          <span className="text-[var(--border)]">•</span>
                          <span>Age: <strong className="text-[var(--text-primary)]">{getAge(v.date_of_birth)}</strong></span>
                          <span className="text-[var(--border)]">•</span>
                          <span>Contact: <strong className="text-[var(--text-primary)]">{v.phone}</strong></span>
                          <span className="text-[var(--border)]">•</span>
                          <span className="px-1.5 py-0.5 bg-[var(--bg-elevated)] rounded-md text-[10px] uppercase font-bold text-[var(--accent)] border border-[var(--border)]">
                            {v.visit_type?.replace('_',' ')}
                          </span>
                        </div>

                        {v.chief_complaint && (
                          <div className="mt-2 text-xs text-[var(--text-primary)] bg-[var(--bg-elevated)] border border-[var(--border)] px-3 py-2 rounded-xl inline-block max-w-xl">
                            <span className="text-[var(--text-muted)] font-semibold">Chief Complaint:</span> {v.chief_complaint}
                          </div>
                        )}

                        {/* Vitals Quick Grid */}
                        {(v.blood_pressure_systolic || v.temperature || v.pulse_rate || v.oxygen_saturation) && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {v.blood_pressure_systolic && (
                              <div className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg font-bold">
                                <Heart size={10} /> BP {v.blood_pressure_systolic}/{v.blood_pressure_diastolic}
                              </div>
                            )}
                            {v.temperature && (
                              <div className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg font-bold">
                                <Thermometer size={10} /> T {v.temperature}°C
                              </div>
                            )}
                            {v.pulse_rate && (
                              <div className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-lg font-bold">
                                <Activity size={10} /> HR {v.pulse_rate} bpm
                              </div>
                            )}
                            {v.oxygen_saturation && (
                              <div className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg font-bold">
                                <HeartPulse size={10} /> SpO2 {v.oxygen_saturation}%
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right summary block */}
                    <div className="flex lg:flex-col items-end justify-between lg:justify-start gap-4 lg:gap-2.5 w-full lg:w-auto border-t lg:border-t-0 pt-3 lg:pt-0 border-[var(--border)] flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] px-3 py-1 rounded-full font-bold flex items-center gap-1 uppercase tracking-wider" style={{ background: `${st.color}15`, color: st.color, border: `1px solid ${st.color}35` }}>
                          <span className={`w-1.5 h-1.5 rounded-full bg-current ${v.status !== 'discharged' ? 'animate-pulse' : ''}`}></span>
                          {st.label}
                        </span>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-xs text-[var(--text-muted)] font-semibold flex items-center justify-end gap-1">
                          <Clock size={12} /> {new Date(v.visit_date).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})}
                        </div>
                        {v.consultation_fee > 0 && (
                          <div className="mt-1.5">
                            {v.fee_paid ? (
                              <button 
                                onClick={() => handleOpenCollectModal(v)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-md border border-[var(--accent)]/20 hover:bg-[var(--accent)]/20 transition-all cursor-pointer"
                                title="View payment receipt"
                              >
                                <Shield size={10} /> Paid KES {parseFloat(v.consultation_fee).toLocaleString()}
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleOpenCollectModal(v)}
                                className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/40 hover:bg-emerald-500/30 transition-all cursor-pointer animate-pulse shadow-sm"
                                title="Click to collect payment"
                              >
                                <CreditCard size={12} /> 💰 Collect KES {parseFloat(v.consultation_fee).toLocaleString()}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* PREMIUM FEATURE: Patient Journey Timeline (Mini Clinical Progress Stepper) */}
                  <div className="mt-5 p-3.5 bg-[var(--bg-elevated)] border border-[var(--border)]/60 rounded-xl">
                    <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-3 flex items-center justify-between">
                      <span>Clinical Journey Tracker</span>
                      <span className="text-[var(--accent)] font-mono text-[9px]">Live Progress Map</span>
                    </div>
                    
                    <div className="relative flex items-center justify-between w-full px-2">
                      {/* Connecting Line background */}
                      <div className="absolute top-[11px] left-0 right-0 h-[2.5px] bg-[var(--border)] z-0 rounded-full" />
                      
                      {/* Active green connecting line */}
                      <div 
                        className="absolute top-[11px] left-0 h-[2.5px] bg-[var(--accent)] z-0 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                        style={{ width: `${(Math.min(currentStepIdx, 6) / 6) * 100}%` }}
                      />

                      {timelineSteps.map((step) => {
                        const isCompleted = step.idx < currentStepIdx;
                        const isActive = step.idx === currentStepIdx;
                        
                        return (
                          <div key={step.idx} className="flex flex-col items-center z-10 relative">
                            {/* Circle Node */}
                            <div 
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold border transition-all duration-300 ${
                                isCompleted 
                                  ? 'bg-[var(--accent)] text-black border-[var(--accent)] shadow-[0_0_6px_rgba(16,185,129,0.3)]' 
                                  : isActive 
                                    ? 'bg-[var(--bg-surface)] text-[var(--accent)] border-[var(--accent)] scale-110 shadow-[0_0_10px_rgba(16,185,129,0.6)] animate-pulse' 
                                    : 'bg-[var(--bg-surface)] text-[var(--text-faint)] border-[var(--border)]'
                              }`}
                            >
                              {isCompleted ? '✓' : step.idx + 1}
                            </div>
                            <span 
                              className={`text-[9px] font-bold uppercase mt-1.5 tracking-wider transition-colors ${
                                isActive ? 'text-[var(--accent)]' : isCompleted ? 'text-[var(--text-primary)]' : 'text-[var(--text-faint)]'
                              }`}
                            >
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action Buttons Strip */}
                  <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-[var(--border)]">
                    <Btn size="sm" variant="ghost" onClick={() => fetchPatientProfile(v.patient_id)} icon={UserRound}>
                      Health Record
                    </Btn>
                    
                    {/* Primary Reception Payment Collection Button */}
                    {(() => {
                      const hasPending = (parseInt(v.pending_bills || 0) > 0) || !v.fee_paid;
                      const pendingAmt = parseFloat(v.pending_amount || (v.fee_paid ? 0 : v.consultation_fee) || 0);
                      return (
                        <Btn 
                          size="sm" 
                          onClick={() => handleOpenCollectModal(v)} 
                          className={hasPending ? "bg-emerald-500 text-black font-extrabold hover:bg-emerald-400 border border-emerald-400 shadow-md" : "text-[var(--accent)] border-[var(--accent)]/30 hover:bg-[var(--accent)]/10"}
                          icon={hasPending ? CreditCard : Receipt}
                        >
                          {hasPending 
                            ? `Collect Payment ${pendingAmt > 0 ? `(KES ${pendingAmt.toLocaleString()})` : ''}`
                            : 'View Receipt / Settlement'}
                        </Btn>
                      );
                    })()}
                    
                    {isReceptionist && (['waiting', 'WAITING_TRIAGE', 'waiting_triage', 'open', 'REGISTERED'].includes(v.status)) && (
                      <Btn size="sm" variant="ghost" onClick={() => handleUpdateStatus(v.id, 'triaged')} className="text-[var(--info)] border-[var(--info)]/30 hover:bg-[var(--info)]/10" icon={Activity}>
                        Send to Triage
                      </Btn>
                    )}
                    
                    {!isReceptionist && v.status === 'waiting' && (
                      <Btn size="sm" variant="ghost" onClick={() => handleUpdateStatus(v.id, 'with_doctor')} className="text-[#a855f7] border-[#a855f7]/30 hover:bg-[#a855f7]/10" icon={Stethoscope}>
                        Start Consultation
                      </Btn>
                    )}
                    
                    {v.status === 'lab' && (
                      <Btn size="sm" variant="ghost" onClick={() => handleUpdateStatus(v.id, 'with_doctor')} className="text-[#a855f7] border-[#a855f7]/30 hover:bg-[#a855f7]/10">
                        → Return to Doctor
                      </Btn>
                    )}
                    
                    {!isReceptionist && v.status === 'with_doctor' && (
                      <Btn size="sm" variant="ghost" onClick={() => handleUpdateStatus(v.id, 'pharmacy')} className="text-[var(--accent)] border-[var(--accent)]/30 hover:bg-[var(--accent)]/10" icon={Pill}>
                        Send to Pharmacy
                      </Btn>
                    )}
                    
                    {!isReceptionist && v.status === 'pharmacy' && (
                      <Btn size="sm" variant="ghost" onClick={() => handleUpdateStatus(v.id, 'billing')} className="text-[var(--warning)] border-[var(--warning)]/30 hover:bg-[var(--warning)]/10" icon={CreditCard}>
                        Route to Billing
                      </Btn>
                    )}
                    
                    {!isReceptionist && v.status === 'radiology' && (
                      <Btn size="sm" variant="ghost" onClick={() => handleUpdateStatus(v.id, 'with_doctor')} className="text-[#a855f7] border-[#a855f7]/30 hover:bg-[#a855f7]/10">
                        → Return to Doctor
                      </Btn>
                    )}
                    
                    {!isReceptionist && v.status !== 'discharged' && v.status !== 'admitted' && (
                      <Btn size="sm" variant="ghost" onClick={() => handleUpdateStatus(v.id, 'discharged')} className="text-[var(--accent)] border-[var(--accent)]/30 hover:bg-[var(--accent)]/10" icon={CheckCircle2}>
                        Discharge Patient
                      </Btn>
                    )}
                    
                    {!isReceptionist && v.status !== 'admitted' && v.status !== 'discharged' && (
                      <Btn size="sm" variant="ghost" onClick={() => handleUpdateStatus(v.id, 'admitted')} className="text-[var(--danger)] border-[var(--danger)]/30 hover:bg-[var(--danger)]/10" icon={BedDouble}>
                        Admit Patient
                      </Btn>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── PATIENTS TAB ──────────────────────────────────────────────────────────
  const PatientsTab = () => (
    <div className="space-y-4">
      {/* Search & Setup Header */}
      <div className="flex flex-col sm:flex-row gap-3.5 items-center justify-between p-4 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)]">
        <div className="w-full sm:flex-1 relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
            <Search size={16} />
          </div>
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            placeholder="Global search by name, system patient number, contact phone, or ID..."
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30"
          />
        </div>
        <Btn onClick={() => { setRegisterStep(1); setShowRegisterModal(true); }} icon={Plus} className="w-full sm:w-auto">
          Register New Patient
        </Btn>
      </div>

      {/* Main Database Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)]/50">
                {['Patient No.','Name','Gender/Age','Phone','SHA No.','Blood Group','Visits','Last Checked In',''].map(h => (
                  <th key={h} className="px-5 py-4 text-left text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider white-space-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/70">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center">
                    <div className="inline-flex items-center gap-3">
                      <Loader size={20} className="animate-spin text-[var(--accent)]" />
                      <span className="text-sm font-semibold text-[var(--text-muted)]">Loading Patient Registry...</span>
                    </div>
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center text-[var(--text-faint)]">
                    <div className="text-3xl mb-2">📂</div>
                    <div className="font-bold text-sm text-[var(--text-muted)]">No records matched your lookup</div>
                    <div className="text-xs text-[var(--text-faint)] mt-1">Try refining your filter words or register them as a new patient profile.</div>
                  </td>
                </tr>
              ) : patients.map(p => (
                <tr 
                  key={p.id} 
                  id={`patient-row-${p.id}`}
                  className="hover:bg-[var(--bg-elevated)]/40 transition-colors cursor-pointer group" 
                  onClick={() => fetchPatientProfile(p.id)}
                >
                  <td className="px-5 py-4">
                    <span className="text-xs font-bold text-[var(--accent)] font-mono bg-[var(--accent)]/5 px-2 py-1 rounded-md border border-[var(--accent)]/15">
                      {p.patient_number}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">{p.full_name}</div>
                    {p.chronic_conditions && (
                      <div className="text-[10px] text-amber-400 font-bold mt-1 flex items-center gap-1">
                        <AlertTriangle size={10} /> {p.chronic_conditions.split(',')[0]}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs font-medium text-[var(--text-primary)] capitalize">
                    {p.gender||'—'} <span className="text-[var(--text-muted)]">/</span> {getAge(p.date_of_birth)}
                  </td>
                  <td className="px-5 py-4 text-xs font-semibold text-[var(--text-muted)]">{p.phone}</td>
                  <td className="px-5 py-4 text-xs text-[var(--text-muted)]">{p.sha_number||'—'}</td>
                  <td className="px-5 py-4">
                    {p.blood_group ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/15">
                        {p.blood_group}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--text-faint)]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs font-mono font-bold text-[var(--text-primary)]">{p.total_visits||0}</td>
                  <td className="px-5 py-4 text-xs text-[var(--text-muted)] font-medium">
                    {p.last_visit ? new Date(p.last_visit).toLocaleDateString('en-KE', {month:'short', day:'numeric', year:'numeric'}) : 'No visits recorded'}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-faint)] group-hover:text-[var(--accent)] group-hover:bg-[var(--accent)]/10 transition-all">
                      <ChevronRight size={16} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg-surface)]/20">

      {/* ── TOP HEADER CONTROL CENTER ── */}
      <div className="p-6 border-b border-[var(--border)] bg-[var(--bg-surface)] flex-shrink-0 shadow-sm relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-black text-[var(--text-primary)] flex items-center gap-3 tracking-tight">
              <span>🏥 Command Receptionist</span>
              <span className="flex items-center gap-1.5 text-xs font-extrabold bg-[var(--accent)]/10 text-[var(--accent)] px-3 py-1 rounded-full border border-[var(--accent)]/20 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"></span>
                {visits.filter(v => ['waiting', 'WAITING_TRIAGE', 'waiting_triage', 'open', 'REGISTERED'].includes(v.status)).length} Waiting
              </span>
            </h1>
            <div className="text-xs text-[var(--text-muted)] font-semibold flex items-center gap-1.5 flex-wrap">
              <span>{clock.toLocaleDateString('en-KE',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span>
              <span className="text-[var(--border)]">•</span>
              <span className="font-mono text-[var(--accent)] bg-[var(--accent)]/5 px-2 py-0.5 rounded border border-[var(--accent)]/10">{clock.toLocaleTimeString('en-KE')}</span>
              <span className="text-[var(--border)]">•</span>
              <span className="text-emerald-400 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping"></span> Live Hospital Sync Active</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            <Btn variant="ghost" size="sm" onClick={handleRestorePatients} icon={RefreshCw} className="flex-1 md:flex-none text-[var(--accent)] border-[var(--accent)]/30 hover:bg-[var(--accent)]/10" title="Sync & restore database patient archives">
              Restore / Sync Database
            </Btn>
            <Btn variant="ghost" size="sm" onClick={fetchAll} icon={RefreshCw} className="flex-1 md:flex-none">
              Refresh
            </Btn>
            <Btn size="sm" id="top-collect-payment-btn" onClick={() => setShowQuickPickerModal(true)} icon={CreditCard} className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold shadow-md flex-1 md:flex-none">
              💰 Collect Payment
            </Btn>
            <Btn size="sm" id="top-register-btn" onClick={() => { setRegisterStep(1); setShowRegisterModal(true); }} icon={Plus} className="flex-1 md:flex-none">
              Register Patient
            </Btn>
          </div>
        </div>

        {/* Executive Stats Dashboard Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
          {[
            { label:'Total Registered Database', value: stats.total_patients||0, color:'var(--accent)', icon: Users, desc: 'Master patient records' },
            { label:'Today’s New Profiles', value: stats.registered_today||0, color:'#06b6d4', icon: Plus, desc: 'Registered today' },
            { label:"Active Patient Visits", value: visitStats.total_visits||0, color:'#a855f7', icon: ClipboardList, desc: 'Today\'s clinical flow' },
            { label:'System Revenue Today', value: `KES ${(parseFloat(visitStats.revenue||0)).toLocaleString()}`, color:'var(--accent)', icon: DollarSign, desc: 'Accrued billables' },
            { label:'Settled Cashiers Fees', value: visitStats.fees_collected||0, color:'var(--warning)', icon: CreditCard, desc: 'Paid entries' },
          ].map(({ label, value, color, icon: IconComp, desc }) => (
            <div key={label} className="bg-[var(--bg-elevated)]/60 border border-[var(--border)]/80 p-4 rounded-xl flex items-start gap-3.5 hover:bg-[var(--bg-elevated)] transition-colors duration-200">
              <div className="p-2.5 rounded-xl flex-shrink-0" style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
                <IconComp size={18} style={{ color }} />
              </div>
              <div>
                <div className="text-lg font-black tracking-tight text-[var(--text-primary)]" style={{ color }}>{value}</div>
                <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mt-0.5">{label}</div>
                <div className="text-[9px] text-[var(--text-faint)] mt-0.5">{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation Selector Tabs */}
        <div className="flex gap-1 mt-6 bg-[var(--bg-elevated)] rounded-xl p-1 w-full sm:w-fit border border-[var(--border)]">
          {[
            { id:'queue', label:'🏥 Active Patient Queue', count: visits.length, icon: CreditCard },
            { id:'patients', label:'👥 Master Patients Directory', count: stats.total_patients, icon: Users },
            { id:'history', label:'📜 Clinical History & Archives', count: null, icon: Clock },
          ].map(t => {
            const IconComponent = t.icon;
            const isActive = tab === t.id;
            return (
              <button 
                key={t.id} 
                onClick={() => setTab(t.id)} 
                className={`flex-1 sm:flex-none py-2.5 px-4 rounded-lg font-bold text-xs uppercase tracking-wider border-none cursor-pointer transition-all duration-200 flex items-center justify-center gap-2 ${
                  isActive 
                    ? 'bg-[var(--accent)] text-[#0F1612] shadow-sm font-black' 
                    : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]/40'
                }`}
              >
                <IconComponent size={14} />
                <span>{t.label}</span>
                {t.count !== null && t.count !== undefined && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${isActive ? 'bg-[#0F1612]/20 text-[#0F1612] font-extrabold' : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'}`}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── CENTRAL VIEWPORTS ── */}
      <div className="flex-1 overflow-auto p-6">
        {tab === 'queue' && QueueTab()}
        {tab === 'patients' && PatientsTab()}
        {tab === 'history' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)]">
              <div className="flex-1 min-w-[280px] relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input 
                  value={historySearch} 
                  onChange={e => setHistorySearch(e.target.value)}
                  placeholder="Lookup past records by patient name or file number..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                />
              </div>
              
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-1.5 bg-[var(--bg-elevated)] px-3 py-1.5 rounded-xl border border-[var(--border)]">
                  <Calendar size={14} className="text-[var(--text-muted)]" />
                  <input 
                    type="date" 
                    value={historyDateFrom} 
                    onChange={e => setHistoryDateFrom(e.target.value)}
                    className="bg-transparent text-xs text-[var(--text-primary)] outline-none border-none cursor-pointer"
                  />
                  <span className="text-xs text-[var(--text-muted)] px-1">to</span>
                  <input 
                    type="date" 
                    value={historyDateTo} 
                    onChange={e => setHistoryDateTo(e.target.value)}
                    className="bg-transparent text-xs text-[var(--text-primary)] outline-none border-none cursor-pointer"
                  />
                </div>
                
                <Btn onClick={fetchHistory} icon={Search}>
                  Search Records
                </Btn>
              </div>
            </div>

            {historyLoading ? (
              <div className="py-20 text-center">
                <Loader size={28} className="animate-spin text-[var(--accent)] mx-auto" />
                <div className="text-xs text-[var(--text-muted)] font-semibold mt-3">Loading historical audit trails...</div>
              </div>
            ) : filteredHistory.length === 0 ? (
              <Card className="py-20 text-center">
                <div className="text-4xl mb-3">📁</div>
                <div className="text-sm font-bold text-[var(--text-muted)]">No archival records matches your query</div>
                <p className="text-xs text-[var(--text-faint)] mt-1">Refine your search timeframe or details, then execute search.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {filteredHistory.map(v => {
                  const st = STATUS_META[v.status] || { label: v.status, color: 'var(--text-muted)', icon: Clock };
                  return (
                    <Card key={v.id} className="p-4.5 border-l-[3px] hover:bg-[var(--bg-elevated)]/20" style={{ borderLeftColor: st.color }}>
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[var(--text-primary)]">{v.patient_name}</span>
                            <span className="text-[10px] font-mono bg-[var(--bg-elevated)] border border-[var(--border)] px-1.5 py-0.5 rounded text-[var(--text-muted)] font-bold">{v.patient_number}</span>
                          </div>
                          <div className="text-xs text-[var(--text-muted)] font-medium flex items-center gap-2">
                            <span className="capitalize">{v.gender}</span>
                            <span>•</span>
                            <span>{v.phone}</span>
                            <span>•</span>
                            <span className="uppercase text-[var(--accent)] font-semibold text-[10px]">{v.visit_type?.replace('_',' ')}</span>
                          </div>
                          {v.chief_complaint && (
                            <div className="text-xs text-[var(--text-primary)] bg-[var(--bg-elevated)] px-2.5 py-1 rounded-lg border border-[var(--border)] inline-block mt-1">
                              💬 {v.chief_complaint}
                            </div>
                          )}
                        </div>
                        
                        <div className="text-left sm:text-right flex sm:flex-col justify-between sm:justify-start w-full sm:w-auto border-t sm:border-0 pt-2 sm:pt-0 border-[var(--border)]">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: `${st.color}15`, color: st.color }}>
                            {st.label}
                          </span>
                          <div className="text-[10px] text-[var(--text-muted)] font-bold mt-1.5">
                            {new Date(v.visit_date).toLocaleDateString('en-KE')} at {new Date(v.visit_date).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})}
                          </div>
                          {v.consultation_fee > 0 && (
                            <div className={`text-[10px] font-extrabold mt-1 ${v.fee_paid ? 'text-[var(--accent)]' : 'text-amber-400'}`}>
                              {v.fee_paid ? '✓ Fully Settled' : '⚠ Action Required'} · KES {parseFloat(v.consultation_fee).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── RECEPTION PATIENT SUMMARY PROFILE MODAL ── */}
      {showProfileModal && selectedPatient && (
        <div className="fixed inset-0 bg-[#00000085] backdrop-blur-xs z-[1000] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] w-full max-w-5xl h-[92vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Header */}
            <div className="p-5 border-b border-[var(--border)] bg-[var(--bg-surface)] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/25 flex items-center justify-center font-bold text-lg">
                  {selectedPatient.full_name?.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-black text-[var(--text-primary)] leading-tight">{selectedPatient.full_name}</h3>
                  <span className="text-xs font-mono text-[var(--accent)] font-bold">{selectedPatient.patient_number}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center p-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl mr-2">
                  <button
                    onClick={() => setProfileModalTab('timeline')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      profileModalTab === 'timeline'
                        ? 'bg-[var(--accent)] text-[#0F1612] shadow-sm'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Activity size={14} /> Clinical Timeline
                  </button>
                  <button
                    onClick={() => setProfileModalTab('overview')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                      profileModalTab === 'overview'
                        ? 'bg-[var(--accent)] text-[#0F1612] shadow-sm'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <User size={14} /> Patient Dossier
                  </button>
                </div>

                <Btn size="sm" onClick={() => { handleOpenCheckIn(selectedPatient); }} icon={Plus}>
                  Check In Patient
                </Btn>
                <button 
                  onClick={() => setShowProfileModal(false)} 
                  className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            {profileModalTab === 'timeline' ? (
              <div className="flex-1 overflow-hidden p-2">
                <ClinicalTimeline patientId={selectedPatient.id} patientName={selectedPatient.full_name} patientNumber={selectedPatient.patient_number} />
              </div>
            ) : (
              /* Dossier Body */
              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left Column - Demographic Card */}
                <div className="md:col-span-6 space-y-4">
                  <div className="p-5 bg-[var(--bg-elevated)]/60 border border-[var(--border)]/70 rounded-2xl text-center relative overflow-hidden">
                    <div className="text-5xl mb-3">
                      {selectedPatient.gender === 'male' ? '👨' : selectedPatient.gender === 'female' ? '👩' : '👤'}
                    </div>
                    <h4 className="text-md font-extrabold text-[var(--text-primary)]">{selectedPatient.full_name}</h4>
                    <p className="text-xs text-[var(--text-muted)] font-semibold mt-1">
                      {selectedPatient.gender} · {getAge(selectedPatient.date_of_birth)}
                    </p>
                  </div>

                  {/* Details List */}
                  <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl space-y-3.5">
                    {[
                      { label: 'Primary Contact Phone', value: selectedPatient.phone, icon: Phone },
                      { label: 'National ID / Passport Number', value: selectedPatient.national_id || selectedPatient.passport_number || '—', icon: Shield },
                      { label: 'Insurance / Payment Scheme', value: selectedPatient.insurance_provider || 'Cash Tender', icon: CreditCard },
                      { label: 'Residential County', value: selectedPatient.county || '—', icon: MapPin },
                      { label: 'Marital Status', value: selectedPatient.marital_status || '—', icon: User },
                      { label: 'Occupation / Work', value: selectedPatient.occupation || '—', icon: UserRound },
                      { label: 'Residential Address', value: selectedPatient.address || '—', icon: MapPin },
                    ].map(({ label, value, icon: IconC }) => (
                      <div key={label} className="flex justify-between items-center text-xs pb-2.5 border-b border-[var(--border)]/50 last:border-0 last:pb-0">
                        <span className="text-[var(--text-muted)] font-semibold flex items-center gap-1.5">
                          <IconC size={13} className="text-[var(--text-muted)]/70" />
                          {label}
                        </span>
                        <span className="text-[var(--text-primary)] font-bold capitalize">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Column - Kin & Check In Status */}
                <div className="md:col-span-6 space-y-4">
                  {/* Emergency Next of Kin Card */}
                  <div className="p-5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl space-y-3">
                    <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-1.5">
                      <User size={13} /> Emergency Next of Kin
                    </div>
                    <div className="text-sm font-black text-[var(--text-primary)]">
                      {selectedPatient.next_of_kin_name || 'No Next of Kin Logged'}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] font-semibold space-y-1">
                      <div>Relation: <strong className="text-[var(--text-primary)]">{selectedPatient.next_of_kin_relation || '—'}</strong></div>
                      <div>Phone Contact: <strong className="text-[var(--accent)]">{selectedPatient.next_of_kin_phone || '—'}</strong></div>
                    </div>
                  </div>

                  {/* Quick Check-In CTA Box */}
                  <div className="p-5 bg-[var(--bg-elevated)]/80 border border-[var(--accent)]/30 rounded-2xl space-y-3">
                    <div className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-widest flex items-center gap-1.5">
                      <Activity size={13} /> Reception Queue Dispatch
                    </div>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      Patient registration is active. Push patient to designated clinic queue (OPD, MCH, Dental, Eye, Lab, Pharmacy) for immediate service.
                    </p>
                    <Btn onClick={() => handleOpenCheckIn(selectedPatient)} className="w-full" icon={Plus}>
                      Check In to Clinic Queue
                    </Btn>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ── REGISTER NEW PATIENT MODAL WITH WIZARD ── */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-[#00000085] backdrop-blur-xs z-[1000] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] w-full max-w-xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-[var(--border)] bg-[var(--bg-surface)] flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-[var(--text-primary)]">➕ Register New Patient Profile</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">Complete patient demographic and contact details to issue a system medical record card.</p>
              </div>
              <button 
                onClick={() => { setShowRegisterModal(false); setRegisterStep(1); }} 
                className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Step Wizard Progress Bar */}
            <div className="bg-[var(--bg-elevated)]/60 px-5 py-3.5 border-b border-[var(--border)] flex items-center justify-between">
              {[
                { step: 1, label: 'Personal & Contact' },
                { step: 2, label: 'Identification & Kin' }
              ].map((s) => (
                <div key={s.step} className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border transition-all ${
                    registerStep === s.step 
                      ? 'bg-[var(--accent)] text-black border-[var(--accent)] shadow-[0_0_8px_rgba(16,185,129,0.5)]' 
                      : registerStep > s.step 
                        ? 'bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]/30' 
                        : 'bg-transparent text-[var(--text-faint)] border-[var(--border)]'
                  }`}>
                    {s.step}
                  </div>
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${
                    registerStep === s.step ? 'text-[var(--text-primary)]' : 'text-[var(--text-faint)]'
                  }`}>
                    {s.label}
                  </span>
                  {s.step < 2 && <div className="w-12 h-[1px] bg-[var(--border)] hidden sm:block" />}
                </div>
              ))}
            </div>

            {/* Modal Scrollable Contents */}
            <div className="flex-1 overflow-y-auto p-6">
              
              {/* STEP 1: Personal Profile */}
              {registerStep === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <Input 
                    label="Full Name *" 
                    value={patientForm.full_name} 
                    onChange={e => pf('full_name', e.target.value)} 
                    placeholder="Enter patient full legal name" 
                    icon={User} 
                  />
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input 
                      label="Date of Birth *" 
                      type="date" 
                      value={patientForm.date_of_birth} 
                      onChange={e => pf('date_of_birth', e.target.value)} 
                      icon={Calendar} 
                    />
                    
                    <Select 
                      label="Biological Gender *" 
                      value={patientForm.gender} 
                      onChange={e => pf('gender', e.target.value)}
                      icon={UserRound}
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input 
                      label="Phone Contact Number *" 
                      value={patientForm.phone} 
                      onChange={e => pf('phone', e.target.value)} 
                      placeholder="+254 7XX XXX XXX" 
                      icon={Phone} 
                    />
                    <Input 
                      label="Email Address" 
                      type="email" 
                      value={patientForm.email} 
                      onChange={e => pf('email', e.target.value)} 
                      placeholder="e.g. pat@gmail.com" 
                      icon={Plus} 
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: Demographics, Identification & Kin */}
              {registerStep === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select 
                      label="ID Document Type *" 
                      value={patientForm.id_type || 'national_id'} 
                      onChange={e => pf('id_type', e.target.value)}
                      icon={Shield}
                    >
                      <option value="national_id">National ID Card</option>
                      <option value="passport">Passport</option>
                      <option value="child">Child (Underage / Birth Cert)</option>
                    </Select>

                    {patientForm.id_type === 'passport' ? (
                      <Input 
                        label="Passport Number *" 
                        value={patientForm.passport_number || ''} 
                        onChange={e => pf('passport_number', e.target.value)} 
                        placeholder="Enter valid passport number" 
                        icon={Shield} 
                      />
                    ) : patientForm.id_type === 'child' ? (
                      <Input 
                        label="Child / Parent National ID" 
                        value={patientForm.national_id || ''} 
                        onChange={e => pf('national_id', e.target.value)} 
                        placeholder="e.g. Parent ID or Birth Cert No" 
                        icon={Shield} 
                      />
                    ) : (
                      <Input 
                        label="National ID Card Number *" 
                        value={patientForm.national_id || ''} 
                        onChange={e => pf('national_id', e.target.value)} 
                        placeholder="Enter national identification number" 
                        icon={Shield} 
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select 
                      label="Primary Insurance Provider / Scheme" 
                      value={patientForm.insurance_provider || 'cash'} 
                      onChange={e => pf('insurance_provider', e.target.value)}
                      icon={Award}
                    >
                      {INSURANCE_PROVIDERS.map(i => (
                        <option key={i.value} value={i.value}>{i.label}</option>
                      ))}
                    </Select>

                    <Select 
                      label="County of Residence" 
                      value={patientForm.county} 
                      onChange={e => pf('county', e.target.value)}
                      icon={MapPin}
                    >
                      <option value="">Select county</option>
                      {counties.map(c => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select 
                      label="Marital Status" 
                      value={patientForm.marital_status} 
                      onChange={e => pf('marital_status', e.target.value)}
                      icon={User}
                    >
                      <option value="">Select status</option>
                      <option value="single">Single</option>
                      <option value="married">Married</option>
                      <option value="divorced">Divorced</option>
                      <option value="widowed">Widowed</option>
                    </Select>

                    <Input 
                      label="Occupation / Industry" 
                      value={patientForm.occupation} 
                      onChange={e => pf('occupation', e.target.value)} 
                      placeholder="e.g. Civil Servant, Trader" 
                      icon={UserRound} 
                    />
                  </div>

                  <Input 
                    label="Residential Address" 
                    value={patientForm.address} 
                    onChange={e => pf('address', e.target.value)} 
                    placeholder="Estate, street, house number" 
                    icon={MapPin} 
                  />

                  <div className="p-4 bg-[var(--bg-elevated)]/60 border border-[var(--border)]/70 rounded-2xl space-y-3.5">
                    <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Emergency Next of Kin Identity</div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input 
                        label="Kin Full Name" 
                        value={patientForm.next_of_kin_name} 
                        onChange={e => pf('next_of_kin_name', e.target.value)} 
                        placeholder="Name of kin" 
                      />
                      <Input 
                        label="Kin Phone" 
                        value={patientForm.next_of_kin_phone} 
                        onChange={e => pf('next_of_kin_phone', e.target.value)} 
                        placeholder="Kin contact" 
                      />
                      <Input 
                        label="Kin Relation" 
                        value={patientForm.next_of_kin_relation} 
                        onChange={e => pf('next_of_kin_relation', e.target.value)} 
                        placeholder="e.g. Spouse, Parent" 
                      />
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Actions Footer */}
            <div className="p-5 border-t border-[var(--border)] bg-[var(--bg-surface)] flex gap-3">
              {registerStep > 1 ? (
                <Btn variant="ghost" onClick={() => setRegisterStep(registerStep - 1)} className="flex-1">
                  Previous Step
                </Btn>
              ) : (
                <Btn variant="ghost" onClick={() => { setShowRegisterModal(false); setRegisterStep(1); }} className="flex-1">
                  Cancel Registration
                </Btn>
              )}

              {registerStep < 2 ? (
                <Btn onClick={() => {
                  if (!patientForm.full_name) { toast.error('Full legal name is required'); return; }
                  if (!patientForm.date_of_birth) { toast.error('Date of Birth is required'); return; }
                  if (!patientForm.gender) { toast.error('Biological Gender is required'); return; }
                  if (!patientForm.phone) { toast.error('Primary contact phone is required'); return; }
                  setRegisterStep(registerStep + 1);
                }} className="flex-1">
                  Continue Step
                </Btn>
              ) : (
                <Btn onClick={handleRegisterPatient} disabled={saving} className="flex-1.5" icon={CheckCircle2}>
                  {saving ? 'Creating record...' : 'Finalize & Register'}
                </Btn>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ── NEW VISIT & CLINIC PUSH MODAL ── */}
      {showVisitModal && selectedPatient && (
        <div className="fixed inset-0 bg-[#00000085] backdrop-blur-xs z-[1001] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-[var(--border)] bg-[var(--bg-surface)] flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-[var(--text-primary)]">🎟 Designated Clinic Visit Check-In</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">Register encounter & push <span className="text-[var(--accent)] font-bold">{selectedPatient.full_name}</span> ({selectedPatient.patient_number}) to clinic queue</p>
              </div>
              <button 
                onClick={() => setShowVisitModal(false)} 
                className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Split screen content */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Left Column - Inputs */}
              <div className="md:col-span-7 space-y-4">
                {revisitInfo && (
                  <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                    revisitInfo.isWithin7Days 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    <Clock size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                    <div>
                      <div className="font-bold text-[var(--text-primary)]">
                        🔄 Revisit Detected ({revisitInfo.diffDays} {revisitInfo.diffDays === 1 ? 'day' : 'days'} since last visit)
                      </div>
                      <p className="mt-0.5 text-[var(--text-muted)] leading-relaxed">
                        Last visit: <strong className="text-[var(--accent)]">{revisitInfo.lastVisitNumber}</strong> on <strong>{revisitInfo.lastVisitDate}</strong>.
                        {revisitInfo.isWithin7Days ? (
                          <span className="text-emerald-400 font-semibold block mt-0.5">
                            ✅ Within 7-day window: Consultation fee waived!
                          </span>
                        ) : (
                          <span className="text-amber-400 font-semibold block mt-0.5">
                            ⚠️ Outside 7-day window: Standard fee applies.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <Select 
                    label="Designated Clinic Destination *" 
                    value={visitForm.department || 'opd'} 
                    onChange={e => {
                      const dept = e.target.value;
                      const clinicObj = CLINICS_LIST.find(c => c.value === dept);
                      const fee = clinicObj ? clinicObj.fee : 500;
                      setVisitForm(p => ({
                        ...p,
                        department: dept,
                        visit_type: dept === 'mch' ? 'mch' : (dept === 'emergency' ? 'emergency' : 'routine'),
                        mch_service: dept === 'mch' ? (p.mch_service || 'mch_anc') : '',
                        consultation_fee: fee
                      }));
                    }}
                    icon={Activity}
                  >
                    {CLINICS_LIST.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </Select>

                  <Select 
                    label="Flow Triage Priority" 
                    value={visitForm.priority} 
                    onChange={e => vf('priority', e.target.value)}
                    icon={Zap}
                  >
                    <option value="normal">Normal Queue Line</option>
                    <option value="urgent">⚡ Urgent Priority</option>
                    <option value="emergency">🚨 Emergency Priority</option>
                  </Select>
                </div>

                {/* Sub services for MCH */}
                {(visitForm.department === 'mch' || visitForm.visit_type === 'mch') && (
                  <div className="p-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl space-y-3">
                    <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Maternal Sub-Service Selector</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value:'mch_anc', label:'🤰 ANC Clinic', fee: 500 },
                        { value:'mch_pnc', label:'🤱 PNC Clinic', fee: 500 },
                        { value:'mch_cwc', label:'👶 CWC Clinic', fee: 300 },
                        { value:'mch_immunization', label:'💉 Immunization', fee: 200 },
                        { value:'mch_fp', label:'👥 Family Planning', fee: 300 },
                      ].map(s => {
                        const isSelected = visitForm.mch_service === s.value;
                        return (
                          <button 
                            key={s.value} 
                            onClick={() => {
                              setVisitForm(p => ({ ...p, mch_service: s.value, consultation_fee: s.fee }));
                            }} 
                            className={`p-2.5 rounded-xl border text-left transition-all text-xs font-bold ${
                              isSelected 
                                ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)] shadow-sm' 
                                : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--text-muted)]/40'
                            }`}
                          >
                            <div>{s.label}</div>
                            <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">KES {s.fee}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input 
                    label="Encounter Fee (KES)" 
                    type="number" 
                    value={visitForm.consultation_fee} 
                    onChange={e => vf('consultation_fee', e.target.value)} 
                    placeholder="500" 
                    icon={DollarSign}
                  />

                  <Select 
                    label="Insurance / Payment Mode" 
                    value={visitForm.insurance_provider || visitForm.payment_method || 'cash'} 
                    onChange={e => {
                      const val = e.target.value;
                      setVisitForm(p => ({
                        ...p,
                        insurance_provider: val,
                        payment_method: (val === 'cash' || val === 'mpesa' || val === 'waiver') ? val : 'insurance'
                      }));
                    }}
                    icon={CreditCard}
                  >
                    {INSURANCE_PROVIDERS.map(i => (
                      <option key={i.value} value={i.value}>{i.label}</option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl">
                    <label htmlFor="fee_paid" className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2.5 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        id="fee_paid" 
                        checked={visitForm.fee_paid} 
                        onChange={e => vf('fee_paid', e.target.checked)} 
                        className="w-4.5 h-4.5 rounded border-[var(--border)] text-[var(--accent)] bg-transparent cursor-pointer focus:ring-0"
                      />
                      <span>Collect & Settle payment at Reception now</span>
                    </label>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${visitForm.fee_paid ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'}`}>
                      {visitForm.fee_paid ? 'PAID AT RECEPTION' : 'BILL PENDING'}
                    </span>
                  </div>

                  {visitForm.fee_paid && (
                    <div className="p-4 bg-[var(--bg-elevated)]/90 border border-emerald-500/30 rounded-2xl space-y-3 animate-fade-in">
                      <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                        <CreditCard size={13} /> Reception Settlement Details
                      </div>

                      {visitForm.payment_method === 'mpesa' && (
                        <Input 
                          label="M-Pesa Transaction Code *" 
                          value={visitForm.reference_number || ''} 
                          onChange={e => vf('reference_number', e.target.value.toUpperCase())} 
                          placeholder="e.g. SL934KD891" 
                          icon={Smartphone}
                        />
                      )}

                      {['sha', 'insurance', 'nhif', 'corporate'].includes(visitForm.payment_method) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Input 
                            label="Member / Card Number" 
                            value={visitForm.member_number || ''} 
                            onChange={e => vf('member_number', e.target.value)} 
                            placeholder="e.g. 10928374" 
                            icon={Shield}
                          />
                          <Input 
                            label="Pre-Authorization Code" 
                            value={visitForm.auth_code || ''} 
                            onChange={e => vf('auth_code', e.target.value)} 
                            placeholder="e.g. AUTH-8821" 
                            icon={Check}
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1 text-xs">
                        <input 
                          type="checkbox" 
                          id="print_receipt_visit" 
                          checked={visitForm.print_receipt} 
                          onChange={e => vf('print_receipt', e.target.checked)} 
                          className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] bg-transparent cursor-pointer"
                        />
                        <label htmlFor="print_receipt_visit" className="text-xs text-[var(--text-muted)] cursor-pointer select-none flex items-center gap-1">
                          <Printer size={13} /> Print official thermal/A4 receipt immediately
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column - Invoice Preview */}
              <div className="md:col-span-5 space-y-4">
                <div className="p-5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl relative overflow-hidden flex flex-col justify-between h-full">
                  <div className="absolute top-0 right-0 p-8 opacity-5 text-8xl pointer-events-none select-none">🧾</div>
                  
                  <div className="space-y-4">
                    <div className="text-center pb-4 border-b border-[var(--border)]/70">
                      <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Encounter Invoice</div>
                      <div className="text-xl font-black text-[var(--accent)] mt-1">KES {(parseFloat(visitForm.consultation_fee || 0)).toLocaleString()}</div>
                      <div className="text-[10px] text-[var(--text-faint)] mt-1 uppercase font-semibold">Queue Ticket Voucher</div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Destination Clinic</div>
                      <div className="flex justify-between text-xs font-bold text-[var(--text-primary)]">
                        <span>Clinic Station:</span>
                        <span className="uppercase text-[var(--accent)]">{visitForm.department || visitForm.visit_type || 'OPD'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-[var(--text-muted)] font-semibold">Payment Method:</span>
                        <span className="font-bold text-[var(--text-primary)] uppercase">{visitForm.insurance_provider || visitForm.payment_method}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-[var(--text-muted)] font-semibold">Payment Status:</span>
                        <span className={`font-bold ${visitForm.fee_paid ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {visitForm.fee_paid ? '✓ Settle Now' : 'Pending / Pay Later'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[var(--border)]/70 space-y-2">
                    <Btn onClick={handleCreateVisit} disabled={saving} className="w-full" icon={CheckCircle2}>
                      {saving ? 'Processing...' : (visitForm.fee_paid ? '💳 Settle Payment & Check In' : 'Confirm Check-In & Push')}
                    </Btn>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ── RECEPTION PAYMENT & CASHIER COLLECTION MODAL ── */}
      {showCollectModal && collectVisit && (
        <div className="fixed inset-0 bg-[#00000085] backdrop-blur-xs z-[1002] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] w-full max-w-4xl max-h-[94vh] overflow-hidden flex flex-col shadow-2xl">
            
            {/* Header */}
            <div className="p-5 border-b border-[var(--border)] bg-[var(--bg-surface)] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 flex items-center justify-center font-bold text-lg">
                  💰
                </div>
                <div>
                  <h3 className="text-base font-black text-[var(--text-primary)] flex items-center gap-2">
                    <span>Reception Cashier & Payment Collection</span>
                    <span className="text-xs font-mono font-bold bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-0.5 rounded-md border border-[var(--accent)]/20">
                      {collectVisit.visit_number}
                    </span>
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Patient: <strong className="text-[var(--text-primary)]">{collectVisit.patient_name || selectedPatient?.full_name}</strong> ({collectVisit.patient_number || selectedPatient?.patient_number}) · {collectVisit.gender}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setShowCollectModal(false)} 
                className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Bill Summary & Items */}
              <div className="lg:col-span-6 space-y-4">
                <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between">
                  <span>Encounter Bill Items</span>
                  <button 
                    onClick={() => {
                      const allIds = (collectBill.items || []).map(i => i.id);
                      if (selectedCollectItems.length === allIds.length) {
                        setSelectedCollectItems([]);
                        setCollectForm(p => ({ ...p, amount: '0' }));
                      } else {
                        setSelectedCollectItems(allIds);
                        const totalPending = (collectBill.items || []).filter(i => i.status === 'pending' || i.status === 'partial')
                          .reduce((s, i) => s + (parseFloat(i.total_price || 0) - parseFloat(i.paid_amount || 0)), 0);
                        setCollectForm(p => ({ ...p, amount: String(totalPending > 0 ? totalPending : (collectBill.balance || collectBill.total || 500)) }));
                      }
                    }}
                    className="text-[10px] text-[var(--accent)] font-bold hover:underline cursor-pointer"
                  >
                    {selectedCollectItems.length === (collectBill.items || []).length ? 'Deselect All' : 'Select All Items'}
                  </button>
                </div>

                {/* Items List */}
                <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl p-3 divide-y divide-[var(--border)] max-h-[300px] overflow-y-auto space-y-2">
                  {collectLoading ? (
                    <div className="py-12 text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-2">
                      <Loader size={16} className="animate-spin text-[var(--accent)]" /> Loading bill items...
                    </div>
                  ) : (!collectBill.items || collectBill.items.length === 0) ? (
                    <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                      <p className="font-bold text-[var(--text-primary)]">Encounter Consultation Fee</p>
                      <p className="text-[11px] mt-1 text-[var(--accent)] font-mono">KES {(parseFloat(collectVisit.consultation_fee || 500)).toLocaleString()}</p>
                    </div>
                  ) : (
                    collectBill.items.map(item => {
                      const isSelected = selectedCollectItems.includes(item.id);
                      const isPaid = ['paid', 'insurance', 'nhif', 'sha', 'corporate'].includes(item.status);
                      const itemBalance = parseFloat(item.total_price || 0) - parseFloat(item.paid_amount || 0);

                      return (
                        <div 
                          key={item.id} 
                          onClick={() => {
                            if (isPaid) return;
                            let nextSelected;
                            if (isSelected) {
                              nextSelected = selectedCollectItems.filter(id => id !== item.id);
                            } else {
                              nextSelected = [...selectedCollectItems, item.id];
                            }
                            setSelectedCollectItems(nextSelected);
                            const nextTotal = (collectBill.items || [])
                              .filter(i => nextSelected.includes(i.id))
                              .reduce((s, i) => s + Math.max(0, parseFloat(i.total_price || 0) - parseFloat(i.paid_amount || 0)), 0);
                            setCollectForm(p => ({ ...p, amount: String(nextTotal) }));
                          }}
                          className={`pt-2.5 pb-2.5 flex items-center justify-between gap-3 text-xs transition-colors rounded-xl px-2.5 cursor-pointer ${
                            isPaid ? 'opacity-60 bg-transparent' : (isSelected ? 'bg-[var(--accent)]/10 text-[var(--text-primary)] font-semibold' : 'hover:bg-[var(--bg-surface)]')
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {isPaid ? (
                              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                            ) : (
                              <input 
                                type="checkbox" 
                                checked={isSelected} 
                                onChange={() => {}} 
                                className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] cursor-pointer"
                              />
                            )}
                            <div>
                              <div className="font-bold text-[var(--text-primary)]">{item.item_name}</div>
                              <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-1.5 mt-0.5">
                                <span className="uppercase font-mono">{item.item_type || 'service'}</span>
                                <span>•</span>
                                <span>Qty: {item.quantity || 1}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="font-mono font-bold text-[var(--text-primary)]">
                              KES {(parseFloat(item.total_price || 0)).toLocaleString()}
                            </div>
                            <div className="mt-0.5">
                              {isPaid ? (
                                <span className="text-[9px] font-bold uppercase text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                  PAID ({item.payment_method || 'SETTLED'})
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold uppercase text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                  DUE: KES {itemBalance.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Financial Totals Pill Summary */}
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="p-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl">
                    <div className="text-[9px] font-bold uppercase text-[var(--text-muted)]">Total Bill</div>
                    <div className="text-xs font-mono font-bold text-[var(--text-primary)] mt-0.5">
                      KES {(parseFloat(collectBill.total || collectVisit.consultation_fee || 0)).toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <div className="text-[9px] font-bold uppercase text-emerald-400">Total Settled</div>
                    <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                      KES {(parseFloat(collectBill.paid || (collectVisit.fee_paid ? collectVisit.consultation_fee : 0))).toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <div className="text-[9px] font-bold uppercase text-amber-400">Balance Due</div>
                    <div className="text-xs font-mono font-black text-amber-400 mt-0.5">
                      KES {(parseFloat(collectBill.balance || (collectVisit.fee_paid ? 0 : (collectVisit.consultation_fee || 500)))).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Payment Form & Channels */}
              <div className="lg:col-span-6 space-y-4">
                <div className="p-5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl space-y-4">
                  <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    Select Payment Channel
                  </div>

                  {/* Payment Channel Badges */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'cash', label: '💵 Cash', sub: 'Instant' },
                      { id: 'mpesa', label: '📱 M-Pesa', sub: 'Paybill/Till' },
                      { id: 'sha', label: '🛡️ SHA/NHIF', sub: 'Gov Scheme' },
                      { id: 'insurance', label: '🏢 Insurance', sub: 'Corporate' },
                      { id: 'card', label: '💳 POS Card', sub: 'Debit/Credit' },
                      { id: 'waiver', label: '🏷️ Waiver', sub: 'Exempt' }
                    ].map(ch => {
                      const isActive = collectForm.payment_method === ch.id;
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => setCollectForm(p => ({ ...p, payment_method: ch.id }))}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            isActive 
                              ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow-sm' 
                              : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]/50'
                          }`}
                        >
                          <div className="text-xs font-black text-[var(--text-primary)]">{ch.label}</div>
                          <div className="text-[9px] text-[var(--text-muted)] mt-0.5">{ch.sub}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Amount to Pay */}
                  <div className="space-y-3 pt-2">
                    <Input 
                      label="Amount to Collect (KES) *" 
                      type="number"
                      value={collectForm.amount}
                      onChange={e => setCollectForm(p => ({ ...p, amount: e.target.value }))}
                      placeholder="Enter amount to receive"
                      icon={DollarSign}
                    />

                    {/* Cash Tendered & Change Due Calculator */}
                    {collectForm.payment_method === 'cash' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl">
                        <Input 
                          label="Cash Tendered (KES)" 
                          type="number"
                          value={collectForm.cash_tendered}
                          onChange={e => setCollectForm(p => ({ ...p, cash_tendered: e.target.value }))}
                          placeholder="e.g. 1000"
                          icon={Coins}
                        />
                        <div className="flex flex-col justify-center">
                          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Change Due</span>
                          <span className={`text-base font-mono font-black mt-1 ${
                            (parseFloat(collectForm.cash_tendered || 0) >= parseFloat(collectForm.amount || 0))
                              ? 'text-emerald-400' 
                              : 'text-[var(--text-muted)]'
                          }`}>
                            KES {Math.max(0, (parseFloat(collectForm.cash_tendered || 0) - parseFloat(collectForm.amount || 0))).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* M-Pesa Transaction Reference */}
                    {collectForm.payment_method === 'mpesa' && (
                      <Input 
                        label="M-Pesa Reference / Confirmation Code *" 
                        value={collectForm.reference_number}
                        onChange={e => setCollectForm(p => ({ ...p, reference_number: e.target.value.toUpperCase() }))}
                        placeholder="e.g. QJD94KZ992"
                        icon={Smartphone}
                      />
                    )}

                    {/* SHA / Insurance Inputs */}
                    {['sha', 'insurance', 'nhif', 'corporate'].includes(collectForm.payment_method) && (
                      <div className="space-y-3 animate-fade-in">
                        <Select 
                          label="Insurance / Scheme Provider"
                          value={collectForm.insurance_provider}
                          onChange={e => setCollectForm(p => ({ ...p, insurance_provider: e.target.value }))}
                          icon={Shield}
                        >
                          {INSURANCE_PROVIDERS.map(i => (
                            <option key={i.value} value={i.label}>{i.label}</option>
                          ))}
                        </Select>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Input 
                            label="Member / Policy Number" 
                            value={collectForm.member_number}
                            onChange={e => setCollectForm(p => ({ ...p, member_number: e.target.value }))}
                            placeholder="e.g. SHA-992019"
                            icon={User}
                          />
                          <Input 
                            label="Pre-Authorization Code" 
                            value={collectForm.auth_code}
                            onChange={e => setCollectForm(p => ({ ...p, auth_code: e.target.value }))}
                            placeholder="e.g. AUTH-4910"
                            icon={Check}
                          />
                        </div>
                      </div>
                    )}

                    {/* Reference / Note */}
                    <Input 
                      label="Payment Notes / Cashier Memo" 
                      value={collectForm.notes}
                      onChange={e => setCollectForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Optional receipt note or memo"
                      icon={FileText}
                    />

                    {/* Print Receipt Toggle */}
                    <div className="flex items-center gap-2 pt-2">
                      <input 
                        type="checkbox" 
                        id="collect_print_receipt" 
                        checked={collectForm.print_receipt_on_save}
                        onChange={e => setCollectForm(p => ({ ...p, print_receipt_on_save: e.target.checked }))}
                        className="w-4.5 h-4.5 rounded border-[var(--border)] text-[var(--accent)] bg-transparent cursor-pointer"
                      />
                      <label htmlFor="collect_print_receipt" className="text-xs font-bold text-[var(--text-primary)] cursor-pointer select-none flex items-center gap-1.5">
                        <Printer size={14} className="text-[var(--accent)]" /> Generate & Print Official Receipt upon submission
                      </label>
                    </div>
                  </div>

                  {/* Submission Action */}
                  <div className="pt-3 border-t border-[var(--border)] flex gap-3">
                    <Btn variant="ghost" onClick={() => setShowCollectModal(false)} className="flex-1">
                      Cancel
                    </Btn>
                    <Btn 
                      onClick={handleProcessCollection} 
                      disabled={collectSaving || !collectForm.amount || parseFloat(collectForm.amount) <= 0} 
                      className="flex-2 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold shadow-lg"
                      icon={CheckCircle2}
                    >
                      {collectSaving ? 'Processing Collection...' : `Collect KES ${(parseFloat(collectForm.amount || 0)).toLocaleString()}`}
                    </Btn>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ── QUICK CASHIER PATIENT / VISIT SELECTOR MODAL ── */}
      {showQuickPickerModal && (
        <div className="fixed inset-0 bg-[#00000085] backdrop-blur-xs z-[1001] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col shadow-2xl">
            
            <div className="p-5 border-b border-[var(--border)] bg-[var(--bg-surface)] flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-[var(--text-primary)] flex items-center gap-2">
                  <span>💰 Quick Reception Payment Collection</span>
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Select an active patient encounter or search the database to process billing collection
                </p>
              </div>
              <button 
                onClick={() => setShowQuickPickerModal(false)} 
                className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 border-b border-[var(--border)] bg-[var(--bg-elevated)]/50">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input 
                  value={quickPickerSearch}
                  onChange={e => setQuickPickerSearch(e.target.value)}
                  placeholder="Filter active queue by name, phone, patient number or visit ID..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 divide-y divide-[var(--border)] space-y-2">
              <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider pb-2">
                Active Queue Visits ({visits.filter(v => !quickPickerSearch || (v.patient_name||'').toLowerCase().includes(quickPickerSearch.toLowerCase()) || (v.patient_number||'').toLowerCase().includes(quickPickerSearch.toLowerCase())).length})
              </div>

              {visits
                .filter(v => !quickPickerSearch || (v.patient_name||'').toLowerCase().includes(quickPickerSearch.toLowerCase()) || (v.patient_number||'').toLowerCase().includes(quickPickerSearch.toLowerCase()) || (v.phone||'').includes(quickPickerSearch))
                .map(v => (
                  <div 
                    key={v.id} 
                    className="pt-3 pb-3 flex items-center justify-between gap-3 hover:bg-[var(--bg-elevated)]/60 px-3 rounded-xl transition-all cursor-pointer"
                    onClick={() => {
                      setShowQuickPickerModal(false);
                      handleOpenCollectModal(v);
                    }}
                  >
                    <div>
                      <div className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                        <span>{v.patient_name}</span>
                        <span className="text-xs font-mono text-[var(--accent)] font-semibold bg-[var(--accent)]/10 px-1.5 py-0.5 rounded">
                          {v.patient_number}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-2">
                        <span className="capitalize">{v.gender}</span>
                        <span>•</span>
                        <span>{v.phone}</span>
                        <span>•</span>
                        <span className="uppercase text-[var(--accent)] font-semibold">{v.visit_type}</span>
                      </div>
                    </div>

                    <div className="text-right flex items-center gap-3">
                      <div>
                        <div className="text-xs font-mono font-bold text-[var(--text-primary)]">
                          KES {(parseFloat(v.consultation_fee || 0)).toLocaleString()}
                        </div>
                        <div className={`text-[10px] font-bold mt-0.5 ${v.fee_paid ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {v.fee_paid ? '✓ Fully Paid' : '⚠ Unsettled'}
                        </div>
                      </div>
                      <Btn size="sm" className="bg-emerald-500 text-black font-extrabold hover:bg-emerald-400">
                        Collect
                      </Btn>
                    </div>
                  </div>
                ))}

              {visits.length === 0 && (
                <div className="py-12 text-center text-xs text-[var(--text-muted)]">
                  No active visits found in today's clinic queue.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fadeIn 0.25s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
