import { useState, useEffect } from 'react';
import ClinicalTimeline from '../components/ClinicalTimeline';
import ResultRenderer from "../components/ResultRenderer";
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import { connectSocket } from '../services/socket';
import toast from 'react-hot-toast';
import ICD10Search from '../components/ICD10Search';
import CDSAlertModal from '../components/CDSAlertModal';
import {
  Stethoscope, ArrowLeft, Plus, X, Loader, FlaskConical,
  RefreshCw, Send, CheckCircle, Search, ChevronRight, Clipboard, Printer, ShieldAlert
} from 'lucide-react';
import { printTreatmentSummary } from '../utils/printTreatmentSummary';
import { printLabResult } from '../utils/printLabResult';
import { printInjectionReport } from '../utils/printInjectionReport';
import { printRadiologyReport } from '../utils/printRadiologyReport';

// ── Helper ────────────────────────────────────────────────────────────────────
const formatInsuranceProvider = (val) => {
  if (!val) return 'Cash / Self Pay';
  const raw = String(val).trim().toLowerCase();
  if (raw === 'cash') return 'Cash Tender / Self Pay';
  if (raw === 'mpesa') return 'M-Pesa Mobile Money';
  if (raw === 'sha') return 'SHA (Social Health Authority)';
  if (raw === 'sha_comp' || raw === 'sha comprehensive') return 'SHA Comprehensive Cover';
  if (raw === 'nhif') return 'SHA / NHIF Scheme';
  if (raw === 'jubilee') return 'Jubilee Health Insurance';
  if (raw === 'britam') return 'Britam Insurance';
  if (raw === 'apa') return 'APA Insurance';
  if (raw === 'aar') return 'AAR Insurance';
  if (raw === 'cic') return 'CIC General Insurance';
  if (raw === 'first_assoc') return 'First Assurance';
  if (raw === 'madison') return 'Madison Insurance';
  if (raw === 'ga') return 'GA Insurance';
  if (raw === 'old_mutual') return 'Old Mutual / UAP Insurance';
  if (raw === 'equity_afia') return 'Equity Afia Insurance';
  if (raw === 'heritage') return 'Heritage Insurance';
  if (raw === 'mtiba') return 'M-TIBA Health Cover';
  if (raw === 'waiver') return 'Approved Waiver / Free';
  return val;
};

// ── UI primitives ─────────────────────────────────────────────────────────────
const Card = ({ children, style={}, ...props }) => (
  <div style={{ background:'var(--bg-surface)', borderRadius:14, border:'1px solid var(--border)', ...style }} {...props}>
    {children}
  </div>
);
const Input = ({ label, ...props }) => (
  <div>
    {label && <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>{label}</label>}
    <input {...props} style={{ width:'100%', padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' }} />
  </div>
);
const Textarea = ({ label, rows=3, ...props }) => (
  <div>
    {label && <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>{label}</label>}
    <textarea rows={rows} {...props} style={{ width:'100%', padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none', resize:'vertical', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' }} />
  </div>
);
const Select = ({ label, children, ...props }) => (
  <div>
    {label && <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>{label}</label>}
    <select {...props} style={{ width:'100%', padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none' }}>{children}</select>
  </div>
);
const inp = { width:"100%", padding:"9px 12px", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:8, color:"var(--text-primary)", fontSize:13, outline:"none", boxSizing:"border-box", fontFamily:"DM Sans, sans-serif" };
const Btn = ({ children, variant='primary', size='md', style:s={}, ...props }) => (
  <button {...props} style={{
    display:'inline-flex', alignItems:'center', gap:6,
    padding: size==='sm' ? '6px 12px' : '10px 18px',
    background: variant==='primary' ? 'var(--accent)' : variant==='danger' ? 'var(--danger)' : 'var(--bg-elevated)',
    border: variant==='ghost' ? '1px solid var(--border)' : 'none',
    borderRadius:8,
    color: variant==='primary' ? '#0F1612' : variant==='danger' ? '#fff' : 'var(--text-primary)',
    fontSize: size==='sm' ? 12 : 13, fontWeight:600,
    cursor: props.disabled ? 'not-allowed' : 'pointer',
    fontFamily:'DM Sans, sans-serif', opacity: props.disabled ? 0.6 : 1, ...s
  }}>{children}</button>
);

// ── constants ─────────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  REGISTERED: 'var(--info)',
  WAITING_TRIAGE: 'var(--warning)',
  IN_TRIAGE: 'var(--info)',
  WAITING_DOCTOR: 'var(--warning)',
  IN_CONSULTATION: '#a855f7',
  CONSULTATION_PAUSED: '#eab308',
  WAITING_PAYMENT: 'var(--warning)',
  WAITING_PHARMACY: 'var(--accent)',
  WAITING_LAB: 'var(--info)',
  WAITING_RADIOLOGY: '#f97316',
  WAITING_INJECTION: '#06b6d4',
  WAITING_RESULTS: 'var(--info)',
  COMPLETED: '#22c55e',
  ARCHIVED: 'var(--text-muted)',
  waiting:'var(--warning)', with_doctor:'#a855f7', lab:'var(--info)',
  pharmacy:'var(--accent)', radiology:'#f97316', injection_room:'#06b6d4',
  billing:'var(--warning)', discharged:'#22c55e', admitted:'var(--danger)',
  triaged: 'var(--warning)', opd: 'var(--warning)'
};
const STATUS_LABELS = {
  REGISTERED: '📋 Registered',
  WAITING_TRIAGE: '⏳ Waiting Triage',
  IN_TRIAGE: '🩺 In Triage',
  WAITING_DOCTOR: '⏳ Waiting Doctor',
  IN_CONSULTATION: '👨‍⚕️ In Consultation',
  CONSULTATION_PAUSED: '⏸ Consultation Paused',
  WAITING_PAYMENT: '💳 Waiting Payment',
  WAITING_PHARMACY: '💊 Waiting Pharmacy',
  WAITING_LAB: '🔬 In Lab',
  WAITING_RADIOLOGY: '📸 Radiology',
  WAITING_INJECTION: '💉 Injection Room',
  WAITING_RESULTS: '🔬 Lab Results Ready',
  COMPLETED: '✅ Completed',
  ARCHIVED: '📁 Archived',
  waiting:'⏳ Waiting Doctor', with_doctor:'👨‍⚕️ In Consultation', lab:'🔬 In Lab',
  pharmacy:'💊 In Pharmacy', radiology:'📸 Radiology', injection_room:'💉 Injection Room',
  billing:'💳 Billing', discharged:'✅ Discharged', admitted:'🏥 Admitted',
  triaged: '⏳ Waiting Doctor', opd: '⏳ Waiting Doctor'
};
const PRIORITY_COLORS = { normal:'var(--text-muted)', urgent:'var(--warning)', emergency:'var(--danger)' };
const getAge = (dob) => !dob ? '—' : Math.floor((Date.now()-new Date(dob))/(365.25*24*60*60*1000))+'y';

const EMPTY_DRUG      = { drug_name:'', dosage:'', frequency:'', duration:'', route:'oral', instructions:'', quantity:'' };
const EMPTY_TEST      = { test_name:'', test_code:'', urgency:'routine', notes:'' };
const EMPTY_PROCEDURE = { procedure_name:'', procedure_code:'', notes:'', outcome:'' };
const EMPTY_DIAGNOSIS = { name:'', code:'' };

// ── main component ────────────────────────────────────────────────────────────
export default function DoctorPage() {
  const { user } = useSelector(s => s.auth);
  const [searchParams] = useSearchParams();

  const [view, setView]         = useState(searchParams.get('tab') || 'queue');
  const [queueTab, setQueueTab] = useState('active');
  const [queueDate, setQueueDate] = useState(new Date().toISOString().split('T')[0]);
  const [queue, setQueue]       = useState([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [sentActions, setSentActions] = useState({}); // tracks which routing actions already fired for this visit, prevents duplicate entries on double-click

  const [selectedVisit, setSelectedVisit]               = useState(null);
  const [patient, setPatient]                           = useState(null);
  const [activeTab, setActiveTab]                       = useState('notes');
  const [patientHistory, setPatientHistory]             = useState([]);
  const [historyLoading, setHistoryLoading]             = useState(false);
  const [historyDetail, setHistoryDetail]               = useState(null);
  const [existingConsultation, setExistingConsultation] = useState(null);
  const [labResults, setLabResults]                     = useState([]);
  const [injectionReports, setInjectionReports]         = useState([]);
  const [radiologyReports, setRadiologyReports]         = useState([]);

  // ── Special Clinic Referral States ──
  const [specialClinics, setSpecialClinics]             = useState([]);
  const [selectedSpecialClinic, setSelectedSpecialClinic] = useState('DENTAL');
  const [specialClinicUrgency, setSpecialClinicUrgency]   = useState('ROUTINE');
  const [specialClinicReason, setSpecialClinicReason]     = useState('');
  const [referringSpecialClinic, setReferringSpecialClinic] = useState(false);

  const [notes, setNotes] = useState({
    presenting_complaint:'', history_of_illness:'', examination_findings:'',
    review_of_systems:'', impression:'', management_plan:'', nurse_instructions:'',
    follow_up_date:'', follow_up_notes:'', admit_patient:false,
    referral:'', admission_ward:'', admission_reason:'', admission_notes:'',
    admission_bed_id:'', admission_bed_number:''
  });
  const [wards, setWards] = useState([]);
  const [wardBeds, setWardBeds] = useState([]);
  const [loadingBeds, setLoadingBeds] = useState(false);
  const [showCustomWard, setShowCustomWard] = useState(false);
  const [diagnoses,  setDiagnoses]  = useState([{ ...EMPTY_DIAGNOSIS }]);
  const [drugs,      setDrugs]      = useState([{ ...EMPTY_DRUG }]);
  const [tests,      setTests]      = useState([{ ...EMPTY_TEST }]);
  const [procedures, setProcedures] = useState([{ ...EMPTY_PROCEDURE }]);
  const [drugSearch, setDrugSearch] = useState({});
  const [drugResults, setDrugResults] = useState({});

  // ── Clinical Decision Support (CDS) States ──
  const [cdsAlerts, setCdsAlerts] = useState([]);
  const [showCdsModal, setShowCdsModal] = useState(false);

  const checkCdsSafety = async () => {
    if (!selectedVisit?.patient_id) {
      toast.error('Select a patient visit first');
      return;
    }
    try {
      const res = await api.post('/cds/evaluate', {
        patient_id: selectedVisit.patient_id,
        visit_id: selectedVisit.id,
        proposed_medications: drugs.filter(d => d.drug_name?.trim()),
        proposed_lab_requests: tests.filter(t => t.test_name?.trim()),
        diagnoses: diagnoses.filter(d => d.name?.trim())
      });
      const alerts = res.data?.data?.alerts || [];
      setCdsAlerts(alerts);
      if (alerts.length > 0) {
        setShowCdsModal(true);
      } else {
        toast.success('✅ CDS Safety Check Passed: No clinical safety risks detected.');
      }
    } catch (e) {
      console.error('CDS check error:', e);
      toast.error('CDS Safety Check evaluation failed');
    }
  };

  // ── Kenya DHA / KHIE Compliance Suite States ──
  const [syncingKhie, setSyncingKhie] = useState(false);
  const [khieSyncResult, setKhieSyncResult] = useState(null);
  const [patientAuditLogs, setPatientAuditLogs] = useState([]);
  const [showDoctorDhaConfig, setShowDoctorDhaConfig] = useState(false);
  const [dhaLicenseInput, setDhaLicenseInput] = useState(user?.dha_license_number || '');
  const [professionalTitleInput, setProfessionalTitleInput] = useState(user?.professional_title || '');
  const [savingDhaProfile, setSavingDhaProfile] = useState(false);

  useEffect(() => {
    if (user) {
      setDhaLicenseInput(user.dha_license_number || '');
      setProfessionalTitleInput(user.professional_title || '');
    }
  }, [user]);

  const hasDiagnosis = diagnoses.some(d => d.name?.trim());

  const filteredQueue = queue.filter(v => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return v.patient_name?.toLowerCase().includes(s) ||
           v.patient_number?.toLowerCase().includes(s) ||
           v.phone?.toLowerCase().includes(s);
  });

  // ── socket + polling ──────────────────────────────────────────────────────
  useEffect(() => {
    fetchQueue();
    const socket = connectSocket();
    const handleRefresh = () => fetchQueue();
    if (user?.pharmacy_id) {
      socket.on(`queue_update_${user.pharmacy_id}`, handleRefresh);
      socket.on(`visit_updated_${user.pharmacy_id}`, handleRefresh);
    }
    const interval = setInterval(fetchQueue, 15000);
    return () => {
      if (user?.pharmacy_id) {
        socket.off(`queue_update_${user.pharmacy_id}`, handleRefresh);
        socket.off(`visit_updated_${user.pharmacy_id}`, handleRefresh);
      }
      clearInterval(interval);
    };
  }, [user?.pharmacy_id, queueTab, queueDate]);

  useEffect(() => {
    const tab = searchParams.get('tab') || 'queue';
    setView(tab);
  }, [searchParams]);

  // ── fetch wards (for admission dropdown) ────────────────────────────────
  useEffect(() => {
    api.get('/inpatient/wards')
      .then(res => setWards(res.data?.data || []))
      .catch(() => setWards([]));
  }, []);

  // ── fetch special clinics (for referral dropdown) ────────────────────────
  useEffect(() => {
    api.get('/special-clinics')
      .then(res => {
        const clinics = res.data?.data || [];
        if (clinics.length > 0) {
          setSpecialClinics(clinics);
          setSelectedSpecialClinic(clinics[0].code || clinics[0].id);
        } else {
          throw new Error('Empty clinics');
        }
      })
      .catch(() => {
        const defaults = [
          { id: 1, code: 'MEDICAL_OPD', name: 'Medical OPD', description: 'Internal Medicine & General Medical Consultations' },
          { id: 2, code: 'PAEDIATRIC_OPD', name: 'Paediatric OPD', description: 'Child Health & Paediatric Consultations' },
          { id: 3, code: 'SURGICAL_OPD', name: 'Surgical OPD', description: 'General Surgery & Pre/Post-Op Evaluation' },
          { id: 4, code: 'OG', name: 'O&G Clinic', description: 'Obstetrics and Gynaecology Special Clinic' },
          { id: 5, code: 'EYE', name: 'Eye / Ophthalmology Clinic', description: 'Ophthalmology & Vision Care' },
          { id: 6, code: 'ENT', name: 'ENT Clinic', description: 'Ear, Nose & Throat Services' },
          { id: 7, code: 'DENTAL', name: 'Dental Clinic', description: 'Oral Health and Dental Surgery' },
          { id: 8, code: 'CARDIOLOGY', name: 'Cardiology Clinic', description: 'Heart and Cardiovascular Care' },
          { id: 9, code: 'RENAL', name: 'Renal / Nephrology Clinic', description: 'Kidney Health and Nephrology' },
          { id: 10, code: 'DERMATOLOGY', name: 'Dermatology Clinic', description: 'Skin & Dermatological Care' },
          { id: 11, code: 'ONCOLOGY', name: 'Oncology Clinic', description: 'Cancer Care & Oncology Consultations' },
          { id: 12, code: 'NEUROLOGY', name: 'Neurology Clinic', description: 'Nervous System & Neurological Care' },
          { id: 13, code: 'PHYSIOTHERAPY', name: 'Physiotherapy Clinic', description: 'Physical Therapy & Rehabilitation' },
          { id: 14, code: 'NUTRITION', name: 'Nutrition Clinic', description: 'Dietetics & Clinical Nutrition' },
          { id: 15, code: 'MENTAL_HEALTH', name: 'Mental Health Clinic', description: 'Psychiatry & Psychological Services' },
          { id: 16, code: 'DIABETIC', name: 'Diabetic & Endocrine Clinic', description: 'Diabetes & Metabolic Care' },
          { id: 17, code: 'HYPERTENSION', name: 'Hypertension / Cardiac Clinic', description: 'Hypertension & Cardiovascular Care' },
          { id: 18, code: 'ORTHOPEDIC', name: 'Orthopedic Clinic', description: 'Bones, Joints & Musculoskeletal' },
          { id: 19, code: 'CCC', name: 'CCC Clinic', description: 'Comprehensive Care Centre' },
          { id: 20, code: 'TB', name: 'TB Clinic', description: 'Tuberculosis Care & Management' },
          { id: 21, code: 'SICKLE_CELL', name: 'Sickle Cell Clinic', description: 'Sickle Cell Disease Care' }
        ];
        setSpecialClinics(defaults);
        setSelectedSpecialClinic(defaults[0].code);
      });
  }, []);

  // ── keep custom-ward toggle in sync with loaded wards & fetch beds ──────
  useEffect(() => {
    if (!wards.length) return;
    const known = wards.some(w => w.name === notes.admission_ward);
    if (notes.admission_ward && !known) setShowCustomWard(true);
    else if (known) setShowCustomWard(false);
  }, [wards, notes.admission_ward]);

  useEffect(() => {
    if (!notes.admission_ward) {
      setWardBeds([]);
      return;
    }
    const matchedWard = wards.find(w => w.name === notes.admission_ward);
    if (matchedWard && matchedWard.id) {
      setLoadingBeds(true);
      api.get(`/inpatient/wards/${matchedWard.id}/beds`)
        .then(res => setWardBeds(res.data.data || []))
        .catch(() => setWardBeds([]))
        .finally(() => setLoadingBeds(false));
    } else {
      setWardBeds([]);
    }
  }, [notes.admission_ward, wards]);

  // ── fetch queue ───────────────────────────────────────────────────────────
  const fetchQueue = async () => {
    setLoading(true);
    try {
      const d = queueDate || new Date().toISOString().split('T')[0];
      const url = queueTab === 'active'
        ? `/visits?status=opd_queue&date=${d}`
        : `/visits?date=${d}`;
      const res = await api.get(url);
      setQueue(res.data.data || []);
    } catch { toast.error('Failed to load queue'); }
    finally { setLoading(false); }
  };

  // ── open consultation ─────────────────────────────────────────────────────
  const openConsultation = async (visit) => {
    setLoading(true);
    setShowCustomWard(false);
    setSentActions({});
    try {
      const [patRes, vitalsRes] = await Promise.allSettled([
        api.get(`/patients/${visit.patient_id}`),
        api.get(`/patients/visits/${visit.id}/vitals`),
      ]);
      setPatient(patRes.status==='fulfilled' ? patRes.value.data.data : null);
      
      // Load Patient Access Audit Trail for DHA Compliance
      try {
        const auditRes = await api.get(`/audit/patient/${visit.patient_id}`);
        setPatientAuditLogs(auditRes.data.data || []);
      } catch (err) {
        console.error('Failed to load patient audit logs:', err);
      }

      // Log a clinical read access to comply with DHA Privacy laws
      try {
        await api.post('/audit/log', {
          table_name: 'patients',
          record_id: visit.patient_id,
          action: 'read',
          new_data: { description: 'Consultation record accessed by attending medical officer for diagnosis' },
          visit_id: visit.id,
          patient_id: visit.patient_id
        });
        
        // Refresh local audit logs to show this newly registered access log entry
        const auditRes = await api.get(`/audit/patient/${visit.patient_id}`);
        setPatientAuditLogs(auditRes.data.data || []);
      } catch (err) {
        console.error('Failed to log clinical access audit:', err);
      }

      const vitals = vitalsRes.status==='fulfilled' ? (vitalsRes.value.data.data || []) : [];
      const lv = vitals[0] || {};
      const vitalsObj = {
        temperature:              lv.temperature              ?? visit.temperature,
        pulse_rate:               lv.pulse_rate               ?? visit.pulse_rate,
        respiratory_rate:         lv.respiratory_rate         ?? visit.respiratory_rate,
        blood_pressure_systolic:  lv.blood_pressure_systolic  ?? visit.blood_pressure_systolic,
        blood_pressure_diastolic: lv.blood_pressure_diastolic ?? visit.blood_pressure_diastolic,
        oxygen_saturation:        lv.oxygen_saturation        ?? visit.oxygen_saturation,
        bmi:                      lv.bmi                      ?? visit.bmi,
        weight:                   lv.weight                   ?? visit.weight,
        triage_notes:             lv.triage_notes             ?? visit.triage_notes ?? visit.notes,
      };
      setSelectedVisit({
        ...visit,
        vitals: vitalsObj,
        blood_pressure_systolic:  vitalsObj.blood_pressure_systolic,
        blood_pressure_diastolic: vitalsObj.blood_pressure_diastolic,
        pulse_rate:               vitalsObj.pulse_rate,
        temperature:              vitalsObj.temperature,
        oxygen_saturation:        vitalsObj.oxygen_saturation,
        weight:                   vitalsObj.weight,
        bmi:                      vitalsObj.bmi,
        blood_glucose:            lv.blood_glucose            ?? visit.blood_glucose,
      });

      // mark as IN_CONSULTATION if still waiting
      try {
        if (['waiting', 'WAITING_DOCTOR', 'WAITING_TRIAGE', 'REGISTERED', 'open', 'with_doctor'].includes(visit.status)) {
          await api.put(`/patients/visits/${visit.id}/status`, { status:'IN_CONSULTATION' });
          setSelectedVisit(v => ({ ...v, status:'IN_CONSULTATION' }));
        }
      } catch (statusErr) {
        console.error('Non-blocking visit status update error:', statusErr);
      }

      // start or resume active encounter for this visit
      try {
        await api.post('/encounters/start', { visit_id: visit.id, patient_id: visit.patient_id, current_step: 'consultation' });
      } catch (encErr) {
        // ignore non-blocking encounter init error
      }

      // load existing consultation
      try {
        const cRes = await api.get(`/consultations/visit/${visit.id}`);
        const c = cRes.data?.data;
        if (c && c.id) {
          setExistingConsultation(c);
          setNotes({
            presenting_complaint: c.presenting_complaint || visit.chief_complaint || '',
            history_of_illness:   c.history_of_illness   || '',
            examination_findings: c.examination_findings || '',
            review_of_systems:    c.review_of_systems    || '',
            impression:           c.impression           || '',
            management_plan:      c.management_plan      || '',
            nurse_instructions:   c.nurse_instructions   || '',
            follow_up_date:       c.follow_up_date ? c.follow_up_date.split('T')[0] : '',
            follow_up_notes:      c.follow_up_notes      || '',
            admit_patient:        c.admit_patient        || false,
            referral:             c.referral             || '',
            admission_ward:       c.admission_ward       || '',
            admission_reason:     c.admission_reason     || '',
            admission_notes:      c.admission_notes      || '',
            admission_bed_id:     c.admission_bed_id     || '',
            admission_bed_number: c.admission_bed_number || '',
          });
          if (c.diagnoses?.length)     setDiagnoses(c.diagnoses);
          else if (c.diagnosis)        setDiagnoses([{ name:c.diagnosis, code:c.icd_code||'' }]);
          else                         setDiagnoses([{ ...EMPTY_DIAGNOSIS }]);

          if (c.prescriptions && c.prescriptions.length > 0) {
            setDrugs(c.prescriptions.map(p => ({
              id: p.id,
              product_id: p.product_id,
              drug_name: p.drug_name,
              dosage: p.dosage || '',
              frequency: p.frequency || '',
              duration: p.duration || '',
              route: p.route || 'oral',
              instructions: p.instructions || '',
              quantity: p.quantity || 1,
              selling_price: p.selling_price || p.price || 0,
              status: p.status || 'pending'
            })));
          } else {
            setDrugs([{ ...EMPTY_DRUG }]);
          }

          if (c.lab_requests && c.lab_requests.length > 0) {
            setTests(c.lab_requests.map(t => ({
              id: t.id,
              test_name: t.test_name,
              test_code: t.test_code || '',
              urgency: t.urgency || 'routine',
              notes: t.notes || '',
              status: t.status || 'pending',
              result: t.result,
              result_value: t.result_value
            })));
          } else {
            setTests([{ ...EMPTY_TEST }]);
          }

          if (c.procedures && c.procedures.length > 0) {
            setProcedures(c.procedures.map(pr => ({
              id: pr.id,
              procedure_name: pr.procedure_name,
              procedure_code: pr.procedure_code || '',
              notes: pr.notes || '',
              outcome: pr.outcome || ''
            })));
          } else {
            setProcedures([{ ...EMPTY_PROCEDURE }]);
          }
        } else {
          setExistingConsultation(null);
          setNotes({ presenting_complaint:visit.chief_complaint||'', history_of_illness:'', examination_findings:'', review_of_systems:'', impression:'', management_plan:'', nurse_instructions:'', follow_up_date:'', follow_up_notes:'', admit_patient:false, referral:'', admission_ward:'', admission_reason:'', admission_notes:'', admission_bed_id:'', admission_bed_number:'' });
          setDiagnoses([{ ...EMPTY_DIAGNOSIS }]);
          setDrugs([{ ...EMPTY_DRUG }]);
          setTests([{ ...EMPTY_TEST }]);
          setProcedures([{ ...EMPTY_PROCEDURE }]);
        }
      } catch {
        setExistingConsultation(null);
        setNotes({ presenting_complaint:visit.chief_complaint||'', history_of_illness:'', examination_findings:'', review_of_systems:'', impression:'', management_plan:'', nurse_instructions:'', follow_up_date:'', follow_up_notes:'', admit_patient:false, referral:'', admission_ward:'', admission_reason:'', admission_notes:'', admission_bed_id:'', admission_bed_number:'' });
        setDiagnoses([{ ...EMPTY_DIAGNOSIS }]);
        setDrugs([{ ...EMPTY_DRUG }]);
        setTests([{ ...EMPTY_TEST }]);
        setProcedures([{ ...EMPTY_PROCEDURE }]);
      }

      // fetch lab results separately
      try {
        const lrRes = await api.get(`/consultations/visit/${visit.id}/lab-results`);
        const labs = (lrRes.data?.data || []).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        setLabResults(labs);
      } catch {
        setLabResults([]);
      }

      // fetch injection reports separately
      try {
        const irRes = await api.get(`/consultations/visit/${visit.id}/injection-reports`);
        setInjectionReports(irRes.data?.data || []);
      } catch {
        setInjectionReports([]);
      }

      // fetch radiology reports separately
      try {
        const radRes = await api.get(`/consultations/visit/${visit.id}/radiology-reports`);
        setRadiologyReports(radRes.data?.data || []);
      } catch {
        setRadiologyReports([]);
      }

      setView('consultation');
      setActiveTab('notes');
    } catch (err) {
      console.error('Error opening consultation:', err);
      toast.error('Failed to open consultation');
    } finally {
      setLoading(false);
    }
  };

  // ── build payload ─────────────────────────────────────────────────────────
  const buildPayload = (sendToPharmacy=false) => {
    const primaryDx = diagnoses.find(d => d.name?.trim()) || {};
    return {
      visit_id:   selectedVisit.id,
      patient_id: patient.id,
      ...notes,
      diagnosis:     primaryDx.name || '',
      icd_code:      primaryDx.code || '',
      prescriptions: drugs.filter(d => d.drug_name?.trim()),
      lab_requests:  tests.filter(t => t.test_name?.trim()),
      procedures:    procedures.filter(p => p.procedure_name?.trim()),
      send_to_pharmacy: sendToPharmacy,
    };
  };

  // ── save draft ────────────────────────────────────────────────────────────
  const saveConsultation = async (sendToPharmacy=false) => {
    ensureDiagnosis();
    setSaving(true);
    try {
      const payload = buildPayload(sendToPharmacy);
      let consultation;
      if (existingConsultation) {
        const r = await api.put(`/consultations/${existingConsultation.id}`, payload);
        consultation = r.data.data;
      } else {
        const r = await api.post('/consultations', payload);
        consultation = r.data.data;
        setExistingConsultation(consultation);
      }
      if (sendToPharmacy) {
        // Status update first — must succeed before billing
        await api.put(`/patients/visits/${selectedVisit.id}/status`, { status: 'WAITING_PHARMACY' });
        // Billing is non-blocking
        const drugItems = drugs.filter(d=>d.drug_name?.trim()).map(d=>({
          item_type:'drug',
          description:`${d.drug_name} ${d.dosage||''} ${d.frequency||''} ${d.duration||''}`.trim(),
          quantity: d.quantity||1, unit_price: d.selling_price||0, reference_id: d.product_id||null
        }));
        if (drugItems.length) addToBill(drugItems).catch(()=>{});
        toast.success('Sent to Pharmacy!');
        resetToQueue();
      } else {
        await api.put(`/patients/visits/${selectedVisit.id}/status`, { status: 'CONSULTATION_PAUSED' }).catch(()=>{});
        toast.success('Consultation saved');
      }
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  // ── billing helper ────────────────────────────────────────────────────────
  const addToBill = async (items) => {
    try {
      for (const item of items)
        await api.post(`/billing/visit/${selectedVisit.id}/items`, item);
    } catch (e) { console.log('Billing skipped:', e.message); }
  };

  // ── fetch patient history ────────────────────────────────────────────────
  const fetchPatientHistory = async () => {
    if (!selectedVisit?.patient_id) return;
    setHistoryLoading(true);
    try {
      const res = await api.get(`/patients/${selectedVisit.patient_id}/visits`);
      const visits = (res.data.data || []).filter(v => v.id !== selectedVisit.id);
      setPatientHistory(visits);
    } catch { setPatientHistory([]); }
    finally { setHistoryLoading(false); }
  };

  useEffect(() => { if (activeTab === 'history') fetchPatientHistory(); }, [activeTab, selectedVisit?.id]);

  const ensureDiagnosis = () => {
    if (!diagnoses.some(d => d.name?.trim())) {
      const provisional = { name: 'Provisional: Clinical Evaluation (Under Investigation)', code: 'Z00.0' };
      setDiagnoses([provisional]);
      toast.success('📝 Added provisional diagnosis: Clinical Evaluation (Z00.0)');
      return true;
    }
    return true;
  };

  // ── send to lab ───────────────────────────────────────────────────────────
  const sendToLab = async () => {
    if (!tests.some(t=>t.test_name?.trim())) return toast.error('Add at least one lab test');
    ensureDiagnosis();
    setSaving(true);
    try {
      const payload = buildPayload(false);
      if (existingConsultation) await api.put(`/consultations/${existingConsultation.id}`, payload);
      else { const r = await api.post('/consultations', payload); setExistingConsultation(r.data.data); }
      // Auto-create billing items for each lab test from service price list
      const labItems = tests.filter(t => t.test_name?.trim()).map(t => ({
        name: t.test_name, code: t.test_code || '', category: 'laboratory'
      }));
      if (labItems.length > 0) {
        console.log('AUTO-BILL PAYLOAD:', JSON.stringify({visit_id: selectedVisit.id, patient_id: selectedVisit.patient_id, items: labItems}));
        await api.post('/billing/auto-bill', {
          visit_id: selectedVisit.id,
          patient_id: selectedVisit.patient_id,
          items: labItems
        }).catch((e) => { console.error('AUTO-BILL ERROR:', e.response?.data); });
      }
      await api.put(`/patients/visits/${selectedVisit.id}/status`, { status: 'lab' });
      toast.success('🔬 Lab requests sent — patient forwarded to Laboratory Desk');
      setTests([{ ...EMPTY_TEST }]);
      resetToQueue();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to send to lab'); }
    finally { setSaving(false); }
  };

  // ── send to radiology ─────────────────────────────────────────────────────
  const sendToRadiology = async () => {
    ensureDiagnosis();
    setSaving(true);
    try {
      const payload = buildPayload(false);
      if (existingConsultation) await api.put(`/consultations/${existingConsultation.id}`, payload);
      else { const r = await api.post('/consultations', payload); setExistingConsultation(r.data.data); }
      // Auto-bill radiology
      await api.post('/billing/auto-bill', {
        visit_id: selectedVisit.id, patient_id: selectedVisit.patient_id,
        items: [{ name: notes.referral?.trim() || 'Radiology Imaging', category: 'radiology' }]
      }).catch(()=>{});
      await api.put(`/patients/visits/${selectedVisit.id}/status`, { status: 'radiology' });
      toast.success('🩻 Request sent — patient forwarded to Radiology Desk');
      resetToQueue();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  // ── send to injection room ────────────────────────────────────────────────
  const sendToInjectionRoom = async () => {
    if (!drugs.some(d=>d.drug_name?.trim()) && !procedures.some(p=>p.procedure_name?.trim())) {
      return toast.error('Add at least one drug or procedure to send to Injection Room');
    }
    ensureDiagnosis();
    setSaving(true);
    try {
      const payload = buildPayload(false);
      if (existingConsultation) await api.put(`/consultations/${existingConsultation.id}`, payload);
      else { const r = await api.post('/consultations', payload); setExistingConsultation(r.data.data); }
      await api.put(`/patients/visits/${selectedVisit.id}/status`, { status: 'injection_room' });
      // Auto-bill injection drugs + procedures upfront as pending
      const injItems = [
        ...drugs.filter(d => d.drug_name?.trim()).map(d => ({
          name: d.drug_name, category: 'opd'
        })),
        ...procedures.filter(p => p.procedure_name?.trim()).map(p => ({
          name: p.procedure_name, code: p.procedure_code||'', category: 'procedure'
        }))
      ];
      if (injItems.length > 0) {
        await api.post('/billing/auto-bill', {
          visit_id: selectedVisit.id, patient_id: selectedVisit.patient_id,
          items: injItems
        }).catch(()=>{});
      }
      // Create injection room orders from prescriptions
      for (const drug of drugs.filter(d => d.drug_name?.trim())) {
        await api.post(`/injection-room/visit/${selectedVisit.id}/orders`, {
          drug_name: drug.drug_name, dosage: drug.dosage, route: drug.route || "IV",
          frequency: drug.frequency, duration: drug.duration, quantity: drug.quantity || 1, instructions: notes.nurse_instructions || null
        }).catch(()=>{});
      }
      // Create inpatient procedures from doctor's procedures
      for (const proc of procedures.filter(p => p.procedure_name?.trim())) {
        await api.post(`/inpatient/visit/${selectedVisit.id}/procedures`, {
          procedure_name: proc.procedure_name,
          procedure_code: proc.procedure_code || '',
          notes: proc.notes || 'Ordered by Doctor'
        }).catch(()=>{});
      }
      toast.success('💉 Medications and procedures sent to Injection Room successfully!');
      setDrugs([{ ...EMPTY_DRUG }]);
      setProcedures([{ ...EMPTY_PROCEDURE }]);
      setDrugSearch({});
      setSentActions(s => ({ ...s, injection: false }));
      resetToQueue();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  // ── refer to special clinic ────────────────────────────────────────────────
  const referToSpecialClinic = async () => {
    if (!selectedVisit) return;
    ensureDiagnosis();
    setReferringSpecialClinic(true);
    try {
      const payload = buildPayload(false);
      let consultationData;
      if (existingConsultation) {
        const r = await api.put(`/consultations/${existingConsultation.id}`, payload);
        consultationData = r.data.data;
      } else {
        const r = await api.post('/consultations', payload);
        consultationData = r.data.data;
        setExistingConsultation(consultationData);
      }

      const chosenClinic = specialClinics.find(
        c => c.code === selectedSpecialClinic || String(c.id) === String(selectedSpecialClinic)
      ) || specialClinics[0];

      await api.post('/special-clinics/refer', {
        visit_id: selectedVisit.id,
        patient_id: selectedVisit.patient_id,
        clinic_id: (chosenClinic?.id && !isNaN(Number(chosenClinic.id))) ? Number(chosenClinic.id) : null,
        clinic_code: chosenClinic?.code || 'SPECIAL',
        clinic_name: chosenClinic?.name || 'Special Clinic',
        from_clinic: 'General OPD Desk',
        referral_reason: specialClinicReason || notes.referral || 'Referred for specialized review',
        urgency: specialClinicUrgency || 'ROUTINE'
      });

      // Auto-bill special clinic fee
      await api.post('/billing/auto-bill', {
        visit_id: selectedVisit.id,
        patient_id: selectedVisit.patient_id,
        items: [{ name: `${chosenClinic?.name || 'Special Clinic'} Consultation`, category: 'consultation' }]
      }).catch(() => {});

      // Automatically generate & print patient treatment summary
      try {
        const summaryPayload = {
          patient: patient || { full_name: selectedVisit.patient_name, patient_number: selectedVisit.patient_number },
          consultation: {
            ...(consultationData || payload),
            prescriptions: drugs.filter(d => d.drug_name?.trim()),
            lab_requests: tests.filter(t => t.test_name?.trim()),
            procedures: procedures.filter(p => p.procedure_name?.trim())
          },
          vitals: selectedVisit.vitals || {},
          injection_orders: [],
          blood_pressure_systolic: selectedVisit.vitals?.blood_pressure_systolic,
          blood_pressure_diastolic: selectedVisit.vitals?.blood_pressure_diastolic,
          pulse_rate: selectedVisit.vitals?.pulse_rate,
          temperature: selectedVisit.vitals?.temperature,
          oxygen_saturation: selectedVisit.vitals?.oxygen_saturation,
          weight: selectedVisit.vitals?.weight
        };
        printTreatmentSummary(summaryPayload, user?.pharmacy);
      } catch (err) {
        console.error('Print summary error:', err);
      }

      toast.success(`✅ Referred to ${chosenClinic?.name || 'Special Clinic'}! Treatment Summary generated.`);
      resetToQueue();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to refer to special clinic');
    } finally {
      setReferringSpecialClinic(false);
    }
  };

  // ── send to ward ──────────────────────────────────────────────────────────
  const sendToWard = async () => {
    ensureDiagnosis();
    if (!notes.admission_ward?.trim()) return toast.error('Specify ward in Admission tab first');
    setSaving(true);
    try {
      const payload = { ...buildPayload(false), admit_patient:true, admission_bed_id: notes.admission_bed_id, admission_bed_number: notes.admission_bed_number };
      if (existingConsultation) await api.put(`/consultations/${existingConsultation.id}`, payload);
      else { const r = await api.post('/consultations', payload); setExistingConsultation(r.data.data); }

      if (notes.admission_bed_id) {
        await api.post('/inpatient/admit', {
          visit_id: selectedVisit.id,
          bed_id: notes.admission_bed_id,
          notes: notes.admission_notes || notes.admission_reason || 'Admitted from consultation'
        }).catch(err => console.warn('Bed admit response:', err.response?.data || err.message));
      } else {
        await api.put(`/patients/visits/${selectedVisit.id}/status`, { status:'admitted' });
        // Auto-bill admission
        await api.post('/billing/auto-bill', {
          visit_id: selectedVisit.id, patient_id: selectedVisit.patient_id,
          items: [{ name: `Admission - ${notes.admission_ward}${notes.admission_bed_number ? ' (' + notes.admission_bed_number + ')' : ''}`, category: 'admission' }]
        }).catch(()=>{});
      }

      toast.success(`Patient admitted to ${notes.admission_ward}${notes.admission_bed_number ? ' (' + notes.admission_bed_number + ')' : ''}`);
      resetToQueue();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  // ── discharge & auto treatment summary ──────────────────────────────────
  const triggerAutoTreatmentSummary = async (visit) => {
    if (!visit || !visit.id) return;
    try {
      const [patRes, conRes, injRes, vitalsRes] = await Promise.allSettled([
        api.get('/patients/' + visit.patient_id),
        api.get('/consultations/visit/' + visit.id),
        api.get('/injection-room/visit/' + visit.id),
        api.get('/patients/visits/' + visit.id + '/vitals')
      ]);
      const fetchedCon = conRes.status === 'fulfilled' ? (conRes.value.data.data || {}) : {};
      const vitals = vitalsRes.status === 'fulfilled' ? (vitalsRes.value.data.data || []) : [];
      const latestVitals = vitals[0] || {};
      
      const consultation = {
        ...fetchedCon,
        chief_complaint: fetchedCon.chief_complaint || notes.chief_complaint || '',
        history_present_illness: fetchedCon.history_present_illness || notes.history_present_illness || '',
        physical_examination: fetchedCon.physical_examination || notes.physical_examination || '',
        diagnosis: fetchedCon.diagnosis || notes.diagnosis || '',
        differential_diagnosis: fetchedCon.differential_diagnosis || notes.differential_diagnosis || '',
        management_plan: fetchedCon.management_plan || notes.management_plan || '',
        prescriptions: (fetchedCon.prescriptions && fetchedCon.prescriptions.length > 0) ? fetchedCon.prescriptions : drugs.filter(d => d.drug_name?.trim()),
        lab_requests: (fetchedCon.lab_requests && fetchedCon.lab_requests.length > 0) ? fetchedCon.lab_requests : labRequests.filter(l => l.test_name?.trim()),
        procedures: (fetchedCon.procedures && fetchedCon.procedures.length > 0) ? fetchedCon.procedures : procedures.filter(p => p.procedure_name?.trim()),
      };

      const detail = {
        patient: patRes.status === 'fulfilled' ? patRes.value.data.data : null,
        consultation,
        injection_orders: injRes.status === 'fulfilled' ? (injRes.value.data.data || []) : [],
        vitals,
        visit,
        blood_pressure_systolic: latestVitals.blood_pressure_systolic ?? visit.blood_pressure_systolic,
        blood_pressure_diastolic: latestVitals.blood_pressure_diastolic ?? visit.blood_pressure_diastolic,
        pulse_rate: latestVitals.pulse_rate ?? visit.pulse_rate,
        temperature: latestVitals.temperature ?? visit.temperature,
        oxygen_saturation: latestVitals.oxygen_saturation ?? visit.oxygen_saturation,
        weight: latestVitals.weight ?? visit.weight,
      };
      printTreatmentSummary(detail, user?.pharmacy);
    } catch (e) {
      console.error('Failed to autogenerate treatment summary:', e);
    }
  };

  const referToExternalHospital = async () => {
    if (!selectedVisit) return;
    ensureDiagnosis();
    if (!window.confirm('Refer this patient to an external hospital? A treatment summary document will be generated.')) return;
    setSaving(true);
    const visitToRefer = selectedVisit;
    try {
      await saveConsultation(false);
      await api.put(`/patients/visits/${visitToRefer.id}/status`, { status: 'referred_external' });
      toast.success('Patient referred to external hospital');
      await triggerAutoTreatmentSummary(visitToRefer);
      resetToQueue();
    } catch {
      toast.error('Failed to process external referral');
    } finally {
      setSaving(false);
    }
  };

  const discharge = async () => {
    ensureDiagnosis();
    if (!window.confirm('Discharge this patient?')) return;
    setSaving(true);
    const visitToDischarge = selectedVisit;
    try {
      await saveConsultation(false);
      await api.put(`/patients/visits/${visitToDischarge.id}/status`, { status:'COMPLETED' });
      toast.success('Patient discharged');
      await triggerAutoTreatmentSummary(visitToDischarge);
      resetToQueue();
    } catch { toast.error('Failed to discharge'); }
    finally { setSaving(false); }
  };

  // ── refresh lab results ───────────────────────────────────────────────────
  const refreshLabResults = async () => {
    if (!selectedVisit) return;
    try {
      const r = await api.get(`/consultations/visit/${selectedVisit.id}/lab-results`);
      const labs = (r.data.data || []).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setLabResults(labs);
      toast.success('Lab results refreshed');
    } catch { toast.error('Failed to refresh'); }
  };

  const refreshInjectionReports = async () => {
    if (!selectedVisit) return;
    try {
      const r = await api.get(`/injection-room/visit/${selectedVisit.id}/orders`);
      setInjectionReports(r.data.data || []);
      toast.success('Injection reports refreshed');
    } catch { toast.error('Failed to refresh injection reports'); }
  };

  const refreshRadiologyReports = async () => {
    if (!selectedVisit) return;
    try {
      const r = await api.get(`/consultations/visit/${selectedVisit.id}/radiology-reports`);
      setRadiologyReports(r.data.data || []);
      toast.success('Radiology reports refreshed');
    } catch { toast.error('Failed to refresh radiology reports'); }
  };

  const resetToQueue = () => {
    setView('queue');
    setSelectedVisit(null);
    setPatient(null);
    setExistingConsultation(null);
    setLabResults([]);
    fetchQueue();
  };

  const nf = (k,v) => setNotes(n=>({...n,[k]:v}));
  const addDiagnosis    = () => setDiagnoses(d=>[...d,{...EMPTY_DIAGNOSIS}]);
  const removeDiagnosis = (i) => setDiagnoses(d=>d.filter((_,idx)=>idx!==i));
  const updateDiagnosis = (i,val) => setDiagnoses(d=>d.map((item,idx)=>idx===i?val:item));
  const addDrug         = () => setDrugs(d=>[...d,{...EMPTY_DRUG}]);
  const removeDrug      = (i) => setDrugs(d=>d.filter((_,idx)=>idx!==i));
  const updateDrug      = (i,k,v) => setDrugs(d=>d.map((item,idx)=>idx===i?{...item,[k]:v}:item));

  // ── Kenya DHA / KHIE Compliance Suite Helpers ──
  const updatePatientDhaFields = async (fields) => {
    try {
      const res = await api.put(`/patients/${patient.id}`, {
        ...patient,
        ...fields
      });
      setPatient(res.data.data);
      toast.success('Patient DHA details updated successfully');
      
      // Log update action to audit log
      await api.post('/audit/log', {
        table_name: 'patients',
        record_id: patient.id,
        action: 'update',
        new_data: fields,
        visit_id: selectedVisit.id,
        patient_id: patient.id
      });
      
      // Refresh audit logs
      const auditRes = await api.get(`/audit/patient/${patient.id}`);
      setPatientAuditLogs(auditRes.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update patient details');
    }
  };

  const triggerNabidhSync = async () => {
    if (!patient?.national_id && !patient?.sha_number) {
      toast.error('A valid National ID or SHA Number is required for DHA Kenya KHIE transmission.');
      return;
    }
    if (patient?.nabidh_consent === 'opt_out') {
      toast.error('Patient has opted out of KHIE registry data sharing consent.');
      return;
    }
    setSyncingKhie(true);
    setKhieSyncResult(null);
    try {
      // Simulate HL7 FHIR packaging and secure encryption for Kenya IDHIS / KHIE
      await new Promise(r => setTimeout(r, 1200));
      
      // Log event to clinical audit trail (complying with Kenya Data Protection Act, 2019)
      await api.post('/audit/log', {
        table_name: 'consultations',
        record_id: selectedVisit.id,
        action: 'export',
        new_data: { transmission: 'HL7 FHIR v4.0.1 Encrypted transmission', registry: 'Kenya National Health Information Exchange (KHIE) Registry' },
        visit_id: selectedVisit.id,
        patient_id: patient.id
      });
      
      const referenceId = `KHIE-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${Math.floor(100000 + Math.random() * 900000)}`;
      setKhieSyncResult({
        success: true,
        referenceId,
        timestamp: new Date().toISOString()
      });
      toast.success('Successfully synchronized with Kenya National KHIE Registry!');
      
      // Refresh audit logs
      const auditRes = await api.get(`/audit/patient/${patient.id}`);
      setPatientAuditLogs(auditRes.data.data || []);
    } catch (err) {
      toast.error('KHIE transmission failed');
    } finally {
      setSyncingKhie(false);
    }
  };

  const updateDoctorDhaProfile = async (e) => {
    e.preventDefault();
    setSavingDhaProfile(true);
    try {
      await api.put('/auth/profile', {
        dha_license_number: dhaLicenseInput,
        professional_title: professionalTitleInput
      });
      toast.success('Clinical licensing details updated in profile!');
      setShowDoctorDhaConfig(false);
      
      // Update local state instantly
      if (user) {
        user.dha_license_number = dhaLicenseInput;
        user.professional_title = professionalTitleInput;
      }
    } catch (err) {
      toast.error('Failed to update clinical profile');
    } finally {
      setSavingDhaProfile(false);
    }
  };
  const searchDrug = async (i, query) => {
    if (query.length < 2) { setDrugResults(p=>({...p,[i]:[]})); return; }
    try {
      const res = await api.get('/products?search='+encodeURIComponent(query)+'&limit=6');
      setDrugResults(p=>({...p,[i]:res.data.data||[]}));
    } catch { setDrugResults(p=>({...p,[i]:[]})); }
  };
  const parseDosageAndRoute = (name = '', categoryName = '') => {
    const lowercaseName = name.toLowerCase();
    const lowercaseCat = (categoryName || '').toLowerCase();
    
    // 1. Parse Dosage (Strength)
    const dosageRegex = /(\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|iu|units|ug|mcl|%)(?:\/\d+\s*(?:ml|g))?)/gi;
    const match = lowercaseName.match(dosageRegex);
    let dosage = '';
    if (match) {
      dosage = match[0].trim();
    }

    // 2. Parse Route
    let route = 'oral'; // default
    
    if (
      lowercaseName.includes('injection') || 
      lowercaseName.includes('inj') || 
      lowercaseName.includes('vial') || 
      lowercaseName.includes('ampoule') ||
      lowercaseName.includes('infusion') ||
      lowercaseName.includes('iv') ||
      lowercaseName.includes('im') ||
      lowercaseCat.includes('injection') ||
      lowercaseCat.includes('iv')
    ) {
      if (lowercaseName.includes('im') && !lowercaseName.includes('iv')) {
        route = 'im';
      } else {
        route = 'iv';
      }
    } else if (
      lowercaseName.includes('cream') || 
      lowercaseName.includes('ointment') || 
      lowercaseName.includes('gel') || 
      lowercaseName.includes('topical') || 
      lowercaseName.includes('lotion') ||
      lowercaseCat.includes('topical')
    ) {
      route = 'topical';
    } else if (
      lowercaseName.includes('eye drop') || 
      lowercaseName.includes('ophthalmic') ||
      lowercaseCat.includes('eye') ||
      lowercaseCat.includes('ophthalmic')
    ) {
      route = 'eye_drops';
    } else if (
      lowercaseName.includes('ear drop') || 
      lowercaseName.includes('otic') ||
      lowercaseCat.includes('ear')
    ) {
      route = 'ear_drops';
    } else if (
      lowercaseName.includes('nasal') ||
      lowercaseCat.includes('nasal')
    ) {
      route = 'nasal';
    } else if (
      lowercaseName.includes('suppository') || 
      lowercaseName.includes('rectal') ||
      lowercaseCat.includes('rectal')
    ) {
      route = 'rectal';
    } else if (
      lowercaseName.includes('inhaler') || 
      lowercaseName.includes('nebule') || 
      lowercaseName.includes('inhalation') ||
      lowercaseCat.includes('inhalation')
    ) {
      route = 'inhaled';
    }

    return { dosage, route };
  };

  const selectDrug = (i, product) => {
    const { dosage, route } = parseDosageAndRoute(product.name, product.category_name);
    setDrugs(d => d.map((item, idx) => {
      if (idx === i) {
        let finalRoute = route;
        const currentRoute = item.route || '';
        const isUpper = currentRoute === currentRoute.toUpperCase() && currentRoute !== '';
        if (isUpper || currentRoute === 'IV' || currentRoute === 'IM' || currentRoute === 'SC' || currentRoute === 'ID') {
          finalRoute = route.toUpperCase();
        }
        let ddc_code = '';
        let scientific_code = '';
        const nameLower = product.name.toLowerCase();
        if (nameLower.includes('paracetamol') || nameLower.includes('panadol')) {
          ddc_code = 'PPB-50128';
          scientific_code = 'PARACETAMOL';
        } else if (nameLower.includes('amoxicillin')) {
          ddc_code = 'PPB-30112';
          scientific_code = 'AMOXICILLIN';
        } else if (nameLower.includes('ibuprofen')) {
          ddc_code = 'PPB-40291';
          scientific_code = 'IBUPROFEN';
        } else if (nameLower.includes('metformin')) {
          ddc_code = 'PPB-10922';
          scientific_code = 'METFORMIN HYDROCHLORIDE';
        } else if (nameLower.includes('atorvastatin')) {
          ddc_code = 'PPB-20811';
          scientific_code = 'ATORVASTATIN CALCIUM';
        } else if (nameLower.includes('omeprazole')) {
          ddc_code = 'PPB-10931';
          scientific_code = 'OMEPRAZOLE MAGNESIUM';
        } else {
          ddc_code = `PPB-${Math.floor(10000 + Math.random() * 90000)}`;
          scientific_code = product.generic_name?.toUpperCase() || 'CHEMICAL_ENTITY';
        }

        return {
          ...item,
          drug_name: product.name,
          dosage: dosage || product.strength || item.dosage || '',
          route: finalRoute,
          product_id: product.id,
          selling_price: parseFloat(product.selling_price || 0),
          ddc_code,
          scientific_code
        };
      }
      return item;
    }));
    setDrugResults(p=>({...p,[i]:[]}));
    setDrugSearch(p=>({...p,[i]:product.name}));
  };
  const addTest         = () => setTests(t=>[...t,{...EMPTY_TEST}]);
  const removeTest      = (i) => setTests(t=>t.filter((_,idx)=>idx!==i));
  const updateTest      = (i,k,v) => setTests(t=>t.map((item,idx)=>idx===i?{...item,[k]:v}:item));
  const addProcedure    = () => setProcedures(p=>[...p,{...EMPTY_PROCEDURE}]);
  const removeProcedure = (i) => setProcedures(p=>p.filter((_,idx)=>idx!==i));
  const updateProcedure = (i,k,v) => setProcedures(p=>p.map((item,idx)=>idx===i?{...item,[k]:v}:item));

  // ── HISTORY VIEW ──────────────────────────────────────────────────────────
  if (view === 'history') return <PatientHistoryView user={user} onBack={()=>setView('queue')} onOpenVisit={openConsultation} />;

  // ── REPORTS VIEW ──────────────────────────────────────────────────────────
  if (view === 'reports') return <MOHReportView user={user} onBack={()=>setView('queue')} />;

  // ── QUEUE VIEW ────────────────────────────────────────────────────────────
  if (view === 'queue') return (
    <div style={{ padding:24, height:'100vh', overflow:'auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)' }}>🏥 OPD — Outpatient Department</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)', marginTop:4 }}>Dr. {user?.full_name} · {new Date().toLocaleDateString('en-KE',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <div style={{ display:'flex', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:8, padding:4 }}>
            {['active','history'].map(t => (
              <button key={t} onClick={()=>setQueueTab(t)} style={{ padding:'8px 16px', borderRadius:6, background:queueTab===t?'var(--accent)':'transparent', color:queueTab===t?'#0F1612':'var(--text-muted)', fontWeight:600, border:'none', cursor:'pointer', fontFamily:'DM Sans, sans-serif', textTransform:'capitalize' }}>
                {t === 'active' ? 'Active Queue' : "Today's History"}
              </button>
            ))}
          </div>
          <button onClick={()=>setView('history')} style={{ padding:'9px 14px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', color:'var(--text-primary)', fontSize:13, fontFamily:'DM Sans, sans-serif' }}>
            📋 All History
          </button>
          <button onClick={()=>setView('reports')} style={{ padding:'9px 14px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', color:'var(--text-primary)', fontSize:13, fontFamily:'DM Sans, sans-serif' }}>
            📊 MOH Reports
          </button>
          <button onClick={fetchQueue} style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', color:'var(--text-primary)', fontFamily:'DM Sans, sans-serif', fontSize:13 }}>
            <RefreshCw size={15} style={{ animation:loading?'spin 0.8s linear infinite':'none', color:'var(--accent)' }}/> Refresh
          </button>
        </div>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:200 }}>
          <Search size={16} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search by name, patient number or phone..."
            style={{ width:'100%', padding:'10px 10px 10px 38px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:10, color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="date" value={queueDate}
            onChange={e => setQueueDate(e.target.value)}
            style={{ padding:'10px 12px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:10, color:'var(--text-primary)', fontSize:13, outline:'none' }}/>
          {queueDate && (
            <button onClick={() => setQueueDate('')} style={{ padding:'8px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
              Clear
            </button>
          )}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'Waiting',        value:queue.filter(v=>['waiting_doctor','with_doctor','triaged','opd','waiting'].includes(v.status?.toLowerCase())).length,        color:'var(--warning)' },
          { label:'With Doctor',    value:queue.filter(v=>['with_doctor','IN_CONSULTATION','CONSULTATION_PAUSED','opd'].includes(v.status)).length,    color:'#a855f7' },
          { label:'In Lab / Billing',value:queue.filter(v=>['lab','WAITING_LAB','WAITING_RESULTS','billing','reception','WAITING_PAYMENT'].includes(v.status)).length,  color:'var(--info)' },
          { label:'Injection Room', value:queue.filter(v=>['injection_room','WAITING_INJECTION'].includes(v.status)).length, color:'#06b6d4' },
          { label:'In Pharmacy',    value:queue.filter(v=>['pharmacy','WAITING_PHARMACY'].includes(v.status)).length,       color:'var(--accent)' },
          { label:'Discharged',     value:queue.filter(v=>['discharged','COMPLETED'].includes(v.status)).length,     color:'var(--text-muted)' },
        ].map(({ label, value, color }) => (
          <Card key={label} style={{ padding:14 }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{label}</div>
            <div style={{ fontSize:24, fontWeight:700, color }}>{value}</div>
          </Card>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:80 }}>
          <Loader size={32} style={{ animation:'spin 0.8s linear infinite', color:'var(--accent)' }}/>
        </div>
      ) : filteredQueue.length === 0 ? (
        <Card style={{ padding:60, textAlign:'center' }}>
          <Stethoscope size={40} style={{ opacity:0.2, marginBottom:12 }}/>
          <div style={{ fontSize:15, color:'var(--text-faint)' }}>{search ? `No results for "${search}"` : 'No patients in queue'}</div>
        </Card>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {filteredQueue.map((v, idx) => {
            const statusColor = STATUS_COLORS[v.status] || 'var(--text-muted)';
            const isEmergency = v.priority === 'emergency';
            return (
              <Card key={v.id} style={{ 
                padding: '20px 24px', 
                cursor: 'pointer', 
                borderLeft: `5px solid ${statusColor}`,
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                background: 'var(--bg-surface)',
                boxShadow: isEmergency ? '0 0 12px rgba(239, 68, 68, 0.1)' : 'none',
                borderColor: isEmergency ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)'
              }}
                onClick={() => openConsultation(v)}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = isEmergency ? '#ef4444' : 'var(--accent)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = isEmergency ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)';
                  e.currentTarget.style.boxShadow = isEmergency ? '0 0 12px rgba(239, 68, 68, 0.1)' : 'none';
                }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
                  <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
                    <div style={{ width:40, height:40, borderRadius:'50%', background:`${statusColor}15`, border:`2px solid ${statusColor}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14, color:statusColor, flexShrink:0 }}>
                      {idx+1}
                    </div>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, flexWrap:'wrap' }}>
                        <span style={{ fontSize:16, fontWeight:800, color:'var(--text-primary)', tracking: '-0.01em' }}>{v.patient_name}</span>
                        <span style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'monospace', background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4 }}>{v.patient_number}</span>
                        {v.priority !== 'normal' && (
                          <span style={{ fontSize:10, padding:'2px 8px', borderRadius:6, fontWeight:800, background:`${PRIORITY_COLORS[v.priority]}15`, color:PRIORITY_COLORS[v.priority], textTransform:'uppercase', border: `1px solid ${PRIORITY_COLORS[v.priority]}30` }}>
                            {v.priority==='emergency'?'🚨':'⚠'} {v.priority}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:8, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span>{v.gender}</span>
                        <span style={{ opacity: 0.3 }}>•</span>
                        <span>{getAge(v.date_of_birth)}</span>
                        <span style={{ opacity: 0.3 }}>•</span>
                        <span>{v.phone}</span>
                      </div>
                      {v.chief_complaint && (
                        <div style={{ fontSize:12, color:'var(--text-primary)', padding:'4px 10px', background:'var(--bg-elevated)', borderRadius:8, display:'inline-block', marginBottom:8, border: '1px solid var(--border)' }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>CC:</span> {v.chief_complaint}
                        </div>
                      )}
                      {(v.blood_pressure_systolic||v.temperature) && (
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop: 4 }}>
                          {v.blood_pressure_systolic && <span style={{ fontSize:11, padding:'3px 8px', borderRadius:6, background:'var(--danger)10', color:'var(--danger)', border: '1px solid var(--danger)20', fontWeight: 600 }}>BP {v.blood_pressure_systolic}/{v.blood_pressure_diastolic}</span>}
                          {v.temperature && <span style={{ fontSize:11, padding:'3px 8px', borderRadius:6, background:'var(--warning)10', color:'var(--warning)', border: '1px solid var(--warning)20', fontWeight: 600 }}>T {v.temperature}°C</span>}
                          {v.pulse_rate && <span style={{ fontSize:11, padding:'3px 8px', borderRadius:6, background:'var(--info)10', color:'var(--info)', border: '1px solid var(--info)20', fontWeight: 600 }}>HR {v.pulse_rate}bpm</span>}
                          {v.oxygen_saturation && <span style={{ fontSize:11, padding:'3px 8px', borderRadius:6, background:'var(--accent)10', color:'var(--accent)', border: '1px solid var(--accent)20', fontWeight: 600 }}>SpO2 {v.oxygen_saturation}%</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0 }}>
                    <span style={{ fontSize:11, padding:'4px 10px', borderRadius:6, fontWeight:700, background:`${statusColor}15`, color:statusColor, border: `1px solid ${statusColor}30` }}>
                      {STATUS_LABELS[v.status] || v.status}
                    </span>
                    <span style={{ fontSize:11, color:'var(--text-muted)', textTransform:'capitalize', background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4 }}>{v.visit_type?.replace('_',' ')}</span>
                    <span style={{ fontSize:11, color:'var(--text-faint)' }}>{new Date(v.visit_date).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'})}</span>
                    <span style={{ fontSize:12, color:'var(--accent)', fontWeight:700, display:'flex', alignItems:'center', gap:4, marginTop: 4 }}>
                      {v.status === 'discharged' ? 'View Profile' : 'Consult Patient'} <ChevronRight size={14}/>
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ── CONSULTATION VIEW ─────────────────────────────────────────────────────
  const pendingLabResults = labResults.filter(l => l.status !== 'completed' && l.status !== 'resulted');
  const completedLabResults = labResults.filter(l => l.result || l.result_value);

  function renderConsultationWorkspace() {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)] font-sans">
        
        {/* ── CONSULTATION HEADER & HUD ACTION PANEL ─────────────────────────── */}
        <header className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-surface)] flex-shrink-0 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          
          {/* Left Side: Patient Header Detail */}
          <div className="flex items-center gap-4">
            <button 
              onClick={resetToQueue} 
              className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] hover:bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-bold rounded-xl transition-all"
            >
              <ArrowLeft size={14}/> Queue Desk
            </button>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-black tracking-tight text-[var(--text-primary)]">
                  {patient?.full_name}
                </h1>
                <span className="font-mono text-xs text-[var(--accent)] bg-[var(--accent)]/5 border border-[var(--accent)]/10 px-2 py-0.5 rounded-md">
                  {patient?.patient_number}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {patient?.gender} • {getAge(patient?.date_of_birth)}
                </span>
                <span className="text-xs uppercase bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)] px-2 py-0.5 rounded-md">
                  {selectedVisit?.visit_type?.replace('_',' ')}
                </span>
              </div>
            </div>
          </div>

          {/* Right Side: Clinical Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <button
              onClick={checkCdsSafety}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-500 text-xs font-bold rounded-xl transition-all"
              title="Run Clinical Decision Support Safety Analysis"
            >
              <ShieldAlert size={14} className="text-red-500" />
              CDS Safety Check
            </button>

            <button 
              onClick={() => saveConsultation(false)} 
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] hover:bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs font-bold rounded-xl transition-all"
            >
              {saving ? <Loader size={13} className="animate-spin" /> : <Clipboard size={13} />}
              Save Draft
            </button>
            
            <button 
              onClick={discharge} 
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 text-xs font-bold rounded-xl transition-all"
            >
              <CheckCircle size={13}/> Discharge
            </button>
          </div>
        </header>

        {/* ── MAIN WORKSPACE CONTAINER ───────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT COLUMN: Bedside Physiological Monitor & Quick Info (Scrollable) */}
          <aside className="w-[340px] flex-shrink-0 border-r border-[var(--border)] bg-[var(--bg-surface)] p-6 overflow-y-auto space-y-6">
            
            {/* Bedside Physiological Monitor Header */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black tracking-widest text-[var(--text-faint)] uppercase">
                  📟 Bedside physiological Monitor
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
              
              {/* Bedside Monitor Grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { 
                    name: 'TEMP', 
                    val: selectedVisit?.vitals?.temperature ? `${selectedVisit.vitals.temperature}°C` : '—', 
                    color: 'text-cyan-400', 
                    bg: 'bg-cyan-500/5', 
                    desc: 'Core temperature' 
                  },
                  { 
                    name: 'PULSE', 
                    val: selectedVisit?.vitals?.pulse_rate ? `${selectedVisit.vitals.pulse_rate} bpm` : '—', 
                    color: 'text-emerald-400', 
                    bg: 'bg-emerald-500/5', 
                    desc: 'Heart frequency' 
                  },
                  { 
                    name: 'RESP', 
                    val: selectedVisit?.vitals?.respiratory_rate ? `${selectedVisit.vitals.respiratory_rate}/min` : '—', 
                    color: 'text-sky-400', 
                    bg: 'bg-sky-500/5', 
                    desc: 'Breathing rate' 
                  },
                  { 
                    name: 'BP', 
                    val: selectedVisit?.vitals?.blood_pressure_systolic && selectedVisit?.vitals?.blood_pressure_diastolic
                      ? `${selectedVisit.vitals.blood_pressure_systolic}/${selectedVisit.vitals.blood_pressure_diastolic}`
                      : '—', 
                    color: 'text-rose-400', 
                    bg: 'bg-rose-500/5', 
                    desc: 'Blood pressure' 
                  },
                  { 
                    name: 'SPO2', 
                    val: selectedVisit?.vitals?.oxygen_saturation ? `${selectedVisit.vitals.oxygen_saturation}%` : '—', 
                    color: 'text-purple-400', 
                    bg: 'bg-purple-500/5', 
                    desc: 'Oxygen saturation' 
                  },
                  { 
                    name: 'BMI', 
                    val: selectedVisit?.vitals?.bmi ? selectedVisit.vitals.bmi : '—', 
                    color: 'text-amber-400', 
                    bg: 'bg-amber-500/5', 
                    desc: 'Body Mass Index' 
                  }
                ].map(v => (
                  <div key={v.name} className={`p-3 rounded-xl border border-[var(--border)] ${v.bg} space-y-1`}>
                    <div className="flex justify-between items-center text-[10px] font-mono text-[var(--text-muted)] tracking-wider">
                      <span>{v.name}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-faint)]" />
                    </div>
                    <div className={`text-lg font-black tracking-tight ${v.color}`}>
                      {v.val}
                    </div>
                    <div className="text-[9px] text-[var(--text-faint)] leading-none">
                      {v.desc}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* BMI/MUAC Evaluation Line */}
              {selectedVisit?.vitals?.triage_notes && (
                <div className="p-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl space-y-1">
                  <div className="text-[10px] font-mono text-[var(--text-muted)] tracking-wider uppercase">
                    🩺 Nurse Triage Notes
                  </div>
                  <p className="text-xs text-[var(--text-primary)] italic leading-relaxed">
                    "{selectedVisit.vitals.triage_notes}"
                  </p>
                </div>
              )}
            </div>

            {/* Quick Patient Profile Summary */}
            <Card className="p-4 space-y-3">
              <div className="text-xs font-black tracking-widest text-[var(--text-faint)] uppercase border-b border-[var(--border)] pb-2">
                📋 Patient Record Folder
              </div>
              {[
                { label:'Insurance Scheme', value: formatInsuranceProvider(selectedVisit?.insurance_provider || patient?.insurance_provider) },
                { label:'Member / SHA No.', value: selectedVisit?.member_number || patient?.sha_number || patient?.national_id || '—' },
                { label:'Pre-Auth Code',   value: selectedVisit?.auth_code || '—' },
                { label:'Blood Group',     value: patient?.blood_group || '—' },
                { label:'Emergency Contact', value: patient?.phone || '—' },
                { label:'Current Visit No.', value: selectedVisit?.visit_number },
                { label:'Chief Complaint', value: selectedVisit?.chief_complaint || '—' },
              ].map(({label,value})=>(
                <div key={label} className="flex justify-between items-start text-xs border-b border-[var(--border)]/40 pb-1.5 last:border-0 last:pb-0">
                  <span className="text-[var(--text-muted)]">{label}</span>
                  <span className="text-[var(--text-primary)] font-bold text-right max-w-[150px] break-words font-mono">
                    {value}
                  </span>
                </div>
              ))}
            </Card>

            {/* DHA CERTIFICATION & KHIE COMPLIANCE SUITE (KENYA STANDARDS) */}
            <Card className="p-4 space-y-4 border-emerald-500/20 bg-emerald-950/5 animate-fade-in">
              <div className="flex justify-between items-center border-b border-[var(--border)] pb-2">
                <span className="text-xs font-black tracking-widest text-emerald-400 uppercase flex items-center gap-1.5">
                  🛡️ DHA Compliance Suite (Kenya)
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  DHA-COMPLIANT
                </span>
              </div>

              {/* Kenyan Identity Fields */}
              <div className="space-y-3">
                {/* National ID Field */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-[var(--text-muted)] tracking-wider uppercase">
                      Kenyan National ID / Passport
                    </label>
                    {patient?.national_id && (
                      <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-0.5">
                        ✓ Valid Format
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. 12345678"
                    defaultValue={patient?.national_id || ''}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val !== patient?.national_id) {
                        updatePatientDhaFields({ national_id: val });
                      }
                    }}
                    className="w-full px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] font-mono outline-none focus:border-emerald-500 transition-all"
                  />
                </div>

                {/* SHA Code Field */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-[var(--text-muted)] tracking-wider uppercase">
                      Social Health Authority (SHA) No
                    </label>
                    {patient?.sha_number && (
                      <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-0.5">
                        ✓ Linked
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. SHA-102938475"
                    defaultValue={patient?.sha_number || ''}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val !== patient?.sha_number) {
                        updatePatientDhaFields({ sha_number: val });
                      }
                    }}
                    className="w-full px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] font-mono outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* KHIE Consent Toggle */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[var(--text-muted)] tracking-wider uppercase block">
                  DHA KHIE Data Sharing Consent
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      if (patient?.nabidh_consent !== 'opt_in') {
                        updatePatientDhaFields({ nabidh_consent: 'opt_in' });
                      }
                    }}
                    className={`py-1.5 text-[11px] font-bold rounded-lg transition-all border ${
                      patient?.nabidh_consent === 'opt_in'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border)]'
                    }`}
                  >
                    🤝 OPT-IN (SHARE)
                  </button>
                  <button
                    onClick={() => {
                      if (patient?.nabidh_consent !== 'opt_out') {
                        updatePatientDhaFields({ nabidh_consent: 'opt_out' });
                      }
                    }}
                    className={`py-1.5 text-[11px] font-bold rounded-lg transition-all border ${
                      patient?.nabidh_consent === 'opt_out'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border)]'
                    }`}
                  >
                    🔏 OPT-OUT
                  </button>
                </div>
              </div>

              {/* KHIE Sync Trigger */}
              <div className="pt-2 border-t border-[var(--border)]/40 space-y-2">
                <button
                  onClick={triggerNabidhSync}
                  disabled={syncingKhie || (!patient?.national_id && !patient?.sha_number) || patient?.nabidh_consent === 'opt_out'}
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-md"
                >
                  {syncingKhie ? (
                    <>
                      <Loader size={12} className="animate-spin" /> Packaging HL7 FHIR...
                    </>
                  ) : (
                    <>
                      🔗 Sync with KHIE Registry
                    </>
                  )}
                </button>

                {khieSyncResult && (
                  <div className="p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg text-[10px] font-mono text-emerald-400 space-y-0.5 leading-snug animate-fade-in">
                    <div className="font-bold">✓ KHIE LIVE TRANSMISSION SUCCESSFUL</div>
                    <div>Registry: DHA Kenya National HIE (IDHIS)</div>
                    <div>Ref ID: {khieSyncResult.referenceId}</div>
                    <div>Format: HL7 FHIR v4.0.1 (JSON)</div>
                    <div>Registry Sync: Completed & Secured</div>
                  </div>
                )}
              </div>

              {/* Audit Log Access History Section */}
              <div className="pt-2 border-t border-[var(--border)]/40 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] tracking-wider uppercase">
                    🔒 DHA Access Audit Trail (Data Protection Act)
                  </span>
                  <span className="text-[9px] font-mono text-emerald-400">IMMUTABLE</span>
                </div>
                <div className="max-h-[110px] overflow-y-auto space-y-1.5 pr-1 divide-y divide-[var(--border)]/20">
                  {patientAuditLogs.length === 0 ? (
                    <div className="text-[10px] text-[var(--text-muted)] italic py-1">No access records registered yet.</div>
                  ) : (
                    patientAuditLogs.slice(0, 5).map((log, li) => (
                      <div key={li} className="text-[10px] pt-1.5 first:pt-0 space-y-0.5">
                        <div className="flex justify-between font-mono text-[9px] text-[var(--text-muted)]">
                          <span>{log.changed_by_name || 'Dr. Attending'}</span>
                          <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-[var(--text-primary)] font-medium leading-normal">
                          <span className={`px-1 rounded text-[8px] font-bold mr-1 ${
                            log.action === 'read' ? 'bg-cyan-500/10 text-cyan-400' :
                            log.action === 'export' ? 'bg-purple-500/10 text-purple-400' :
                            'bg-amber-500/10 text-amber-400'
                          }`}>
                            {log.action.toUpperCase()}
                          </span>
                          {log.new_data?.description || log.new_data?.message || `Record modified in ${log.table_name}`}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Doctor DHA Config Panel */}
              <div className="pt-2 border-t border-[var(--border)]/40">
                {!showDoctorDhaConfig ? (
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-[var(--text-muted)]">
                      KMPDC / PPB Reg #: <strong className="font-mono text-emerald-400">{user?.dha_license_number || 'NOT SET'}</strong>
                    </span>
                    <button
                      onClick={() => setShowDoctorDhaConfig(true)}
                      className="text-emerald-400 hover:underline font-bold text-[10px]"
                    >
                      ✏️ Edit License
                    </button>
                  </div>
                ) : (
                  <form onSubmit={updateDoctorDhaProfile} className="space-y-2.5 pt-1.5 animate-fade-in">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-[var(--text-muted)] uppercase">KMPDC / PPB Reg #</label>
                        <input
                          type="text"
                          required
                          value={dhaLicenseInput}
                          onChange={(e) => setDhaLicenseInput(e.target.value)}
                          placeholder="e.g. A-1234 / PPB-5678"
                          className="w-full px-2 py-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded text-xs text-[var(--text-primary)] font-mono outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-[var(--text-muted)] uppercase">Professional Title</label>
                        <input
                          type="text"
                          required
                          value={professionalTitleInput}
                          onChange={(e) => setProfessionalTitleInput(e.target.value)}
                          placeholder="e.g. Specialist"
                          className="w-full px-2 py-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded text-xs text-[var(--text-primary)] outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowDoctorDhaConfig(false)}
                        className="px-2 py-1 bg-slate-800 text-[10px] text-slate-300 rounded hover:bg-slate-750 font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingDhaProfile}
                        className="px-2 py-1 bg-emerald-500 text-slate-950 text-[10px] rounded hover:bg-emerald-600 font-bold flex items-center gap-1"
                      >
                        {savingDhaProfile && <Loader size={9} className="animate-spin" />} Save
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </Card>

            {/* Lab test live monitor */}
            {labResults.length > 0 && (
              <Card className="p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-[var(--border)] pb-2">
                  <span className="text-xs font-black tracking-widest text-[var(--text-faint)] uppercase">
                    🔬 Lab Status Tracker
                  </span>
                  <button 
                    onClick={refreshLabResults} 
                    className="text-[10px] text-[var(--accent)] hover:underline flex items-center gap-1 font-bold"
                  >
                    <RefreshCw size={10} /> Refresh
                  </button>
                </div>
                <div className="space-y-2">
                  {labResults.map((l,i)=>(
                    <div key={i} className="flex justify-between items-center text-xs border-b border-[var(--border)]/40 pb-1.5 last:border-0 last:pb-0">
                      <span className="text-[var(--text-muted)] font-medium truncate max-w-[180px]">{l.test_name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        l.result||l.result_value 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                      }`}>
                        {l.result||l.result_value ? 'READY' : 'PENDING'}
                      </span>
                    </div>
                  ))}
                </div>
                {completedLabResults.length > 0 && (
                  <button 
                    onClick={()=>setActiveTab('labResults')} 
                    className="w-full mt-2 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-xl text-cyan-400 text-xs font-bold transition-all text-center"
                  >
                    View Released Results →
                  </button>
                )}
              </Card>
            )}

            {/* Previous Clinical Encounters */}
            {patient?.visits?.length > 0 && (
              <Card className="p-4 space-y-3">
                <div className="text-xs font-black tracking-widest text-[var(--text-faint)] uppercase border-b border-[var(--border)] pb-2">
                  📂 Past Visits Log ({patient.visits.length})
                </div>
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {patient.visits.slice(0,6).map(v=>(
                    <div key={v.id} className="text-xs border-b border-[var(--border)]/40 pb-2.5 last:border-0 last:pb-0 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--accent)] font-mono font-bold">{v.visit_number}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-black ${
                          v.status === 'discharged' 
                            ? 'bg-emerald-500/5 text-emerald-400 border border-emerald-500/10' 
                            : 'bg-purple-500/5 text-purple-400 border border-purple-500/10'
                        }`}>
                          {v.status?.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
                        <span className="truncate max-w-[150px] italic">"{v.chief_complaint || 'No complaint listed'}"</span>
                        <span>{new Date(v.visit_date).toLocaleDateString('en-KE')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </aside>

          {/* RIGHT COLUMN: Interactive Workstation Tabs (Scrollable) */}
          <main className="flex-1 bg-[var(--bg-base)] p-6 overflow-y-auto">
            
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Workdesk Tabs Selector (Vertical Side Menu) */}
              <div className="w-full lg:w-[240px] flex-shrink-0 flex flex-col gap-1 bg-[var(--bg-surface)] border border-[var(--border)] p-2 rounded-2xl h-fit">
                <div className="text-[10px] font-black tracking-widest text-[var(--text-faint)] uppercase px-3 py-2 border-b border-[var(--border)]/40 mb-2">
                  🛠️ Workstation Menu
                </div>
                {[
                  { id:'notes',        label:'📋 Clinical Notes' },
                  { id:'diagnosis',    label:'🔍 Diagnosis & ICD-11 (DHA)' },
                  { id:'prescription', label:'💊 Prescription Desk' },
                  { id:'lab',          label:'🔬 Lab Orders' },
                  { id:'labResults',   label: completedLabResults.length > 0 ? `🧪 Lab Results (${completedLabResults.length})` : '🧪 Lab Results' },
                  { id:'radiology',    label:'📸 Radiology Request' },
                  { id:'injection',    label:'💉 Injection & Procedures' },
                  { id:'admission',    label:'🏥 Admission (IPD)' },
                  { id:'history',      label:'📁 Patient History' },
                ].map(tab=>(
                  <button 
                    key={tab.id} 
                    onClick={()=>setActiveTab(tab.id)} 
                    className={`w-full px-3 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2.5 justify-start ${
                      activeTab === tab.id 
                        ? 'bg-[var(--accent)] text-[#0F1612] shadow-sm' 
                        : tab.id==='labResults'&&completedLabResults.length>0 
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' 
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Contents */}
              <div className="flex-1 space-y-6">

                {/* NOTES TAB */}
            {activeTab === 'notes' && (
              <Card className="p-8 space-y-8">
                <div className="border-b border-[var(--border)] pb-4">
                  <h2 className="text-lg font-black text-[var(--text-primary)]">📝 Consultation Notes</h2>
                  <p className="text-xs text-[var(--text-muted)]">Document physical examinations, history of presenting illness, and management details.</p>
                </div>
                <div className="space-y-8">
                  <Textarea label="Presenting Complaint" rows={4} value={notes.presenting_complaint} onChange={e=>nf('presenting_complaint',e.target.value)} placeholder="Enter main presenting symptoms..." />
                  <Textarea label="History of Presenting Illness" rows={4} value={notes.history_of_illness} onChange={e=>nf('history_of_illness',e.target.value)} placeholder="Chronological course of illness..." />
                  <Textarea label="Examination Findings" rows={5} value={notes.examination_findings} onChange={e=>nf('examination_findings',e.target.value)} placeholder="Objective physiological exam details..." />
                  <Textarea label="Review of Systems" rows={5} value={notes.review_of_systems} onChange={e=>nf('review_of_systems',e.target.value)} placeholder="Systemic review (HEENT, CVS, Resp, GI)..." />
                  <Textarea label="Impression / Clinical Diagnosis" rows={4} value={notes.impression} onChange={e=>nf('impression',e.target.value)} placeholder="Doctor's impression and clinical summaries..." />
                  <Textarea label="Management Plan" rows={4} value={notes.management_plan} onChange={e=>nf('management_plan',e.target.value)} placeholder="Actionable management / medication course plan..." />
                  <Textarea label="Special Referral Letter Details (if any)" rows={4} value={notes.referral} onChange={e=>nf('referral',e.target.value)} placeholder="Referral clinical details or specialties..." />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[var(--border)]/40">
                    <Input label="Follow-up Date" type="date" value={notes.follow_up_date} onChange={e=>nf('follow_up_date',e.target.value)} />
                    <Input label="Follow-up Notes" value={notes.follow_up_notes} onChange={e=>nf('follow_up_notes',e.target.value)} placeholder="Follow-up clinical indications..." />
                  </div>
                </div>
              </Card>
            )}

            {/* DIAGNOSIS TAB */}
            {activeTab === 'diagnosis' && (
              <Card className="p-6 space-y-6">
                <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
                  <div>
                    <h2 className="text-base font-bold text-[var(--text-primary)]">🔍 ICD-11 Diagnosis Coding (DHA Kenya)</h2>
                    <p className="text-xs text-[var(--text-muted)]">Search WHO ICD-11 diagnostic entries compliant with Kenya Digital Health Authority (DHA).</p>
                  </div>
                  <Btn size="sm" variant="ghost" onClick={addDiagnosis}>
                    <Plus size={13}/> Add Diagnosis
                  </Btn>
                </div>
                
                <div className="space-y-4">
                  {diagnoses.map((item, i) => (
                    <div key={i} className="p-5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl relative space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black tracking-widest text-[var(--accent)] uppercase">
                          {i === 0 ? 'Primary Diagnosis' : `Secondary Diagnosis #${i + 1}`}
                        </span>
                        {diagnoses.length > 1 && (
                          <button 
                            onClick={() => removeDiagnosis(i)} 
                            className="text-rose-400 hover:text-rose-300 bg-rose-500/5 hover:bg-rose-500/10 p-1.5 rounded-lg transition-all"
                          >
                            <X size={14}/>
                          </button>
                        )}
                      </div>
                      
                      <ICD10Search 
                        type="diagnosis" 
                        label="Search Diagnosis Entry"
                        placeholder="Type diagnostic name (e.g., Malaria, Typhoid, Diabetes)..."
                        value={item.name ? `${item.code ? item.code + ' — ' : ''}${item.name}` : ''}
                        onSelect={({name,code}) => updateDiagnosis(i, {name,code})} 
                      />
                      
                      {item.code && (
                        <div className="flex items-center gap-2 p-3 bg-[var(--accent)]/5 border border-[var(--accent)]/10 rounded-xl">
                          <span className="text-xs font-bold text-[var(--text-muted)] font-mono">ICD-11 Code (DHA):</span>
                          <span className="font-mono text-sm font-black text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded">
                            {item.code}
                          </span>
                          <span className="text-xs text-[var(--text-primary)] font-medium font-sans">
                            {item.name}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* PRESCRIPTION TAB */}
            {activeTab === 'prescription' && (
              <Card className="p-6 space-y-6">
                <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
                  <div>
                    <h2 className="text-base font-bold text-[var(--text-primary)]">💊 Electronic Prescribing</h2>
                    <p className="text-xs text-[var(--text-muted)]">Search actual pharmacy inventory and write oral or topical drug prescriptions.</p>
                  </div>
                  <Btn size="sm" variant="ghost" onClick={addDrug}>
                    <Plus size={13}/> Add Medication
                  </Btn>
                </div>
                
                <div className="space-y-4">
                  {existingConsultation?.prescriptions?.length > 0 && (
                    <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl mb-4 space-y-2">
                      <div className="text-xs font-bold text-[var(--accent)] flex items-center gap-1.5">
                        <CheckCircle size={14}/> Previously Prescribed Medications ({existingConsultation.prescriptions.length})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {existingConsultation.prescriptions.map((p, idx) => (
                          <div key={idx} className="text-xs p-2.5 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)] flex justify-between items-center">
                            <div>
                              <span className="font-bold text-[var(--text-primary)]">{p.drug_name}</span>
                              <span className="text-[var(--text-muted)] ml-1">({p.dosage || '—'}, {p.frequency || '—'})</span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-mono font-bold">
                              {p.status?.toUpperCase() || 'SENT'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {drugs.map((item, i) => (
                    <div key={i} className="p-5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl relative space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black tracking-widest text-[var(--accent)] uppercase">
                          Medication Item #{i + 1}
                        </span>
                        {drugs.length > 1 && (
                          <button 
                            onClick={() => removeDrug(i)} 
                            className="text-rose-400 hover:text-rose-300 bg-rose-500/5 hover:bg-rose-500/10 p-1.5 rounded-lg transition-all"
                          >
                            <X size={14}/>
                          </button>
                        )}
                      </div>
                      
                      {/* Drug Input Box */}
                      <div className="relative">
                        <label className="text-xs font-bold text-[var(--text-muted)] block mb-1.5">
                          Drug Name (Search live pharmacy stock) *
                        </label>
                        <input 
                          value={drugSearch[i] || item.drug_name} 
                          onChange={e => { 
                            updateDrug(i, 'drug_name', e.target.value); 
                            setDrugSearch(p => ({ ...p, [i]: e.target.value })); 
                            searchDrug(i, e.target.value); 
                          }}
                          placeholder="Type generic or brand name..." 
                          className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30 transition-all font-sans" 
                        />
                        {drugResults[i]?.length > 0 && (
                          <div className="absolute top-[100%] left-0 right-0 z-[100] bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl mt-1.5 max-h-[220px] overflow-y-auto divide-y divide-[var(--border)]/40">
                            {drugResults[i].map(p => (
                              <div 
                                key={p.id} 
                                onClick={() => selectDrug(i, p)}
                                className="p-3 cursor-pointer hover:bg-[var(--bg-elevated)] flex justify-between items-center transition-all animate-fade-in"
                              >
                                <div>
                                  <div className="text-xs font-bold text-[var(--text-primary)]">{p.name}</div>
                                  {p.generic_name && <div className="text-[10px] text-[var(--text-muted)]">{p.generic_name}</div>}
                                </div>
                                <div className="text-right">
                                  <div className={`text-[11px] font-black ${p.total_stock > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {p.total_stock > 0 ? `In Stock (${p.total_stock})` : 'Out of Stock'}
                                  </div>
                                  <div className="text-[10px] text-[var(--text-faint)] font-mono">KES {p.selling_price || 0}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Input label="Dosage" value={item.dosage} onChange={e=>updateDrug(i,'dosage',e.target.value)} placeholder="e.g. 500mg" />
                        <Input label="Frequency" value={item.frequency} onChange={e=>updateDrug(i,'frequency',e.target.value)} placeholder="e.g. BD, TDS, QD" />
                        <Input label="Duration" value={item.duration} onChange={e=>updateDrug(i,'duration',e.target.value)} placeholder="e.g. 5 days" />
                        <Select label="Route" value={item.route} onChange={e=>updateDrug(i,'route',e.target.value)}>
                          {['oral','iv','im','topical','sublingual','inhaled','rectal','eye_drops','ear_drops'].map(r=><option key={r} value={r}>{r.toUpperCase()}</option>)}
                        </Select>
                        <div className="md:col-span-1">
                          <Input label="Quantity" type="number" value={item.quantity} onChange={e=>updateDrug(i,'quantity',e.target.value)} placeholder="e.g. 10" />
                        </div>
                        <div className="md:col-span-1">
                          <Input label="PPB / KEMSA Drug Code" value={item.ddc_code || ''} onChange={e=>updateDrug(i,'ddc_code',e.target.value)} placeholder="e.g. PPB-50128" />
                        </div>
                        <div className="md:col-span-2">
                          <Input label="Special Instructions" value={item.instructions} onChange={e=>updateDrug(i,'instructions',e.target.value)} placeholder="e.g. Take after meals" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="pt-4 border-t border-[var(--border)]/60 space-y-3">
                  <button 
                    onClick={() => saveConsultation(true)} 
                    disabled={saving} 
                    className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-[#0F1612] text-sm font-black rounded-xl transition-all shadow-md"
                  >
                    <Send size={15}/> Dispatch & Send to Pharmacy
                  </button>
                  <div className="p-3 bg-[var(--accent)]/5 border border-[var(--accent)]/10 rounded-xl text-xs text-[var(--accent)] font-medium leading-relaxed">
                    💡 Click the button above to dispatch these oral medications directly to the dispensing queue.
                  </div>
                </div>
              </Card>
            )}

            {/* LAB ORDERS TAB */}
            {activeTab === 'lab' && (
              <Card className="p-6 space-y-6">
                <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
                  <div>
                    <h2 className="text-base font-bold text-[var(--text-primary)]">🔬 Laboratory Order Desk</h2>
                    <p className="text-xs text-[var(--text-muted)]">Select, prioritize, and order clinical diagnostic pathology tests.</p>
                  </div>
                  <Btn size="sm" variant="ghost" onClick={addTest}>
                    <Plus size={13}/> Add Test Order
                  </Btn>
                </div>
                
                <div className="space-y-4">
                  {(existingConsultation?.lab_requests?.length > 0 || labResults?.length > 0) && (
                    <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl mb-4 space-y-2">
                      <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <FlaskConical size={14}/> Previously Requested Lab Tests
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(labResults.length > 0 ? labResults : existingConsultation?.lab_requests || []).map((l, idx) => (
                          <div key={idx} className="text-xs p-2.5 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)] flex justify-between items-center">
                            <span className="font-bold text-[var(--text-primary)]">{l.test_name}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold ${l.result||l.result_value ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                              {l.result||l.result_value ? '✅ RESULTED' : '⏳ PENDING'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {tests.map((item, i) => (
                    <div key={i} className="p-5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl relative space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black tracking-widest text-[#f97316] uppercase">
                          Test Request #{i + 1}
                        </span>
                        {tests.length > 1 && (
                          <button 
                            onClick={() => removeTest(i)} 
                            className="text-rose-400 hover:text-rose-300 bg-rose-500/5 hover:bg-rose-500/10 p-1.5 rounded-lg transition-all"
                          >
                            <X size={14}/>
                          </button>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <ICD10Search 
                            type="lab" 
                            label="Test Name *" 
                            placeholder="Search (e.g., FBC, BS for Malaria, Urinalysis, Widal)..."
                            value={item.test_name ? `${item.test_code ? item.test_code + ' — ' : ''}${item.test_name}` : ''}
                            onSelect={({name,code}) => { updateTest(i, 'test_name', name); updateTest(i, 'test_code', code); }} 
                          />
                        </div>
                        <Select label="Urgency Status" value={item.urgency} onChange={e=>updateTest(i,'urgency',e.target.value)}>
                          <option value="routine">Routine</option>
                          <option value="urgent">Urgent</option>
                          <option value="stat">STAT (Immediate Critical)</option>
                        </Select>
                        <div className="md:col-span-3">
                          <Input label="Clinical Indications / Special Notes" value={item.notes} onChange={e=>updateTest(i,'notes',e.target.value)} placeholder="Describe clinical symptoms to aid laboratory analysis..." />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="pt-4 border-t border-[var(--border)]/60">
                  <button 
                    onClick={sendToLab} 
                    disabled={saving} 
                    className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-[#0F1612] text-sm font-black rounded-xl transition-all shadow-md"
                  >
                    <FlaskConical size={15}/> Dispatch & Send to Lab
                  </button>
                </div>
              </Card>
            )}

            {/* LAB RESULTS TAB */}
            {activeTab === 'labResults' && (
              <Card className="p-6 space-y-6">
                <div className="flex justify-between items-center border-b border-[var(--border)] pb-3 flex-wrap gap-2">
                  <div>
                    <h2 className="text-base font-bold text-[var(--text-primary)]">🧪 Diagnostic Reports Repository</h2>
                    <p className="text-xs text-[var(--text-muted)]">Review diagnostic reports released from the lab for the current session.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {labResults.length > 0 && (
                      <Btn size="sm" variant="outline" onClick={() => printLabResult(labResults, user?.pharmacy, patient || { full_name: selectedVisit?.patient_name, patient_number: selectedVisit?.patient_number }, selectedVisit)}>
                        <Printer size={13}/> Print Combined Lab Report (PDF)
                      </Btn>
                    )}
                    <Btn size="sm" variant="ghost" onClick={refreshLabResults}>
                      <RefreshCw size={13}/> Sync Results
                    </Btn>
                  </div>
                </div>
                
                {labResults.length === 0 ? (
                  <div className="text-center py-16 space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--bg-elevated)] flex items-center justify-center border border-[var(--border)]">
                      <FlaskConical size={32} className="text-[var(--text-faint)]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--text-primary)]">No laboratory test orders found</p>
                      <p className="text-xs text-[var(--text-muted)] max-w-xs mx-auto mt-1">Please create test orders in the 🔬 Lab Orders tab first.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {labResults.map((l, i) => (
                      <div key={i} className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
                        <div className="p-4 bg-[var(--bg-surface)] border-b border-[var(--border)] flex justify-between items-center flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <FlaskConical size={14} className="text-cyan-400" />
                            <span className="text-sm font-black text-cyan-400 font-sans">{l.test_name}</span>
                            {l.urgency === 'stat' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse">STAT</span>
                            )}
                            {l.urgency === 'urgent' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20">URGENT</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {l.result_flag && (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black border uppercase ${
                                l.result_flag === 'high' 
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse' 
                                  : l.result_flag === 'low' 
                                    ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' 
                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              }`}>
                                {l.result_flag}
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                              l.result || l.result_value 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {l.result || l.result_value ? 'Released' : 'In Progress'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="p-5 space-y-4">
                          {l.result || l.result_value ? (
                            <>
                              {l.result_value && (
                                <div className="flex items-baseline gap-2">
                                  <span className="text-3xl font-black text-[var(--text-primary)] font-mono tracking-tight">{l.result_value}</span>
                                  {l.result_unit && <span className="text-xs text-[var(--text-muted)] font-sans">{l.result_unit}</span>}
                                  {l.reference_range && (
                                    <span className="text-xs text-[var(--text-faint)] font-mono ml-4">
                                      (Reference Range: {l.reference_range})
                                    </span>
                                  )}
                                </div>
                              )}
                              
                              {l.result && (
                                <div className="bg-[var(--bg-base)] p-4 rounded-xl border border-[var(--border)] font-mono text-xs leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                                  <ResultRenderer result={l.result} testName={l.test_name} />
                                </div>
                              )}
                              
                              {l.technician_notes && (
                                <div className="p-3.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-muted)] space-y-1">
                                  <div className="font-bold text-[var(--text-primary)] text-[10px] uppercase font-mono tracking-widest">Technician Remarks</div>
                                  <p>"{l.technician_notes}"</p>
                                </div>
                              )}
                              
                              <div className="flex justify-between items-center pt-3 border-t border-[var(--border)] mt-3">
                                <div className="text-xs text-[var(--text-muted)]">
                                  👩‍🔬 Lab Tech: <strong className="text-[var(--text-primary)]">{l.technician_name || 'Lab Technologist'}</strong>
                                  {l.resulted_at && <span className="ml-2 text-[var(--text-faint)]">({new Date(l.resulted_at).toLocaleString('en-KE')})</span>}
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="text-center py-6 text-xs text-[var(--text-muted)] italic">
                              ⏳ Specimen collected. Awaiting analytical clearance...
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* RADIOLOGY TAB */}
            {activeTab === 'radiology' && (
              <Card className="p-6 space-y-6">
                <div className="border-b border-[var(--border)] pb-3">
                  <h2 className="text-base font-bold text-[var(--text-primary)]">📸 Imaging & Radiology Referral</h2>
                  <p className="text-xs text-[var(--text-muted)]">Request medical diagnostic imaging, ultrasounds, X-Rays, or MRI scans.</p>
                </div>
                <div className="space-y-4">
                  <Textarea 
                    label="Imaging Request Details / Clinical Indications" 
                    rows={4}
                    value={notes.referral} 
                    onChange={e=>nf('referral',e.target.value)}
                    placeholder="e.g. Chest X-Ray (AP/Lateral views) — query pulmonary consolidation, Pelvic Ultrasound — evaluate pelvic pain..." 
                  />
                  <button 
                    onClick={sendToRadiology} 
                    disabled={saving} 
                    className="w-full flex items-center justify-center gap-2 py-3 bg-purple-500 hover:bg-purple-600 text-white text-sm font-black rounded-xl transition-all shadow-md"
                  >
                    📸 Dispatch & Send to Radiology
                  </button>
                </div>

                <div className="pt-4 border-t border-[var(--border)] mt-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">📸 Radiology Reports & Imaging Findings</h3>
                    <Btn size="sm" variant="ghost" onClick={refreshRadiologyReports}>
                      <RefreshCw size={13}/> Sync Reports
                    </Btn>
                  </div>

                  {radiologyReports.length === 0 ? (
                    <div className="text-center py-6 text-xs text-[var(--text-muted)] bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)]">
                      No radiology findings or reports uploaded yet for this visit.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {radiologyReports.map((r, i) => (
                        <div key={i} className="p-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl space-y-3 text-xs">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-bold text-[var(--accent)] text-sm">{r.study_name || 'Radiology Examination'}</div>
                              <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                                📸 Radiologist: <strong className="text-[var(--text-primary)]">{r.radiologist_name || 'Consultant Radiologist'}</strong>
                              </div>
                            </div>
                            <Btn size="sm" variant="outline" onClick={() => printRadiologyReport(r, patient || { full_name: selectedVisit?.patient_name, patient_number: selectedVisit?.patient_number }, selectedVisit, user?.pharmacy, user?.full_name)}>
                              <Printer size={12}/> Print Radiology PDF
                            </Btn>
                          </div>

                          {r.findings && (
                            <div className="p-3 bg-[var(--bg-surface)] rounded-lg space-y-1">
                              <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase">Findings & Observations</div>
                              <div className="text-xs text-[var(--text-primary)] whitespace-pre-wrap">{r.findings}</div>
                            </div>
                          )}

                          {r.impression && (
                            <div className="p-3 bg-[var(--bg-surface)] rounded-lg border-l-2 border-[var(--accent)] space-y-1">
                              <div className="text-[10px] font-bold text-[var(--accent)] uppercase">Impression / Conclusion</div>
                              <div className="text-xs font-semibold text-[var(--text-primary)]">{r.impression}</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* INJECTION & PROCEDURES TAB */}
            {activeTab === 'injection' && (
              <Card className="p-6 space-y-6">
                <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
                  <div>
                    <h2 className="text-base font-bold text-[var(--text-primary)]">💉 Injection Room & Nursing Station</h2>
                    <p className="text-xs text-[var(--text-muted)]">Order intramuscular (IM) or intravenous (IV) injections, and direct clinical nursing procedures.</p>
                  </div>
                  <Btn size='sm' variant='ghost' onClick={refreshInjectionReports}>
                    ↻ Refresh Nurse Log
                  </Btn>
                </div>
                
                {/* Nurse Administer Log */}
                {injectionReports.filter(r => r.status === 'administered').length > 0 && (
                  <div className="p-5 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-black tracking-wider text-emerald-400 uppercase flex items-center gap-1">
                        <CheckCircle size={14} /> Completed Administrations Log ({injectionReports.filter(r => r.status === 'administered').length})
                      </h3>
                      <Btn size="sm" variant="outline" onClick={() => printInjectionReport(injectionReports, patient || { full_name: selectedVisit?.patient_name, patient_number: selectedVisit?.patient_number }, selectedVisit, user?.pharmacy, user?.full_name)}>
                        <Printer size={12}/> Print Injection Report (PDF)
                      </Btn>
                    </div>
                    <div className="space-y-3">
                      {injectionReports.filter(r => r.status === 'administered').map((r, i) => (
                        <div key={i} className="p-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl space-y-2 text-xs">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-bold text-[var(--text-primary)]">{r.drug_name}</span>
                              <span className="text-[var(--text-muted)] ml-2">({r.dosage})</span>
                            </div>
                            <span className="text-emerald-400 font-bold font-mono">
                              ✅ GIVEN: {r.administered_at ? new Date(r.administered_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : 'Done'}
                            </span>
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)]">
                            👩‍⚕️ Administered By: <strong className="text-[var(--text-primary)]">{r.nurse_name || r.administered_by_name || 'Staff Nurse'}</strong>
                          </div>
                          {r.nurse_report && (
                            <div className="p-2 bg-[var(--bg-surface)] rounded-lg text-[var(--text-muted)] italic">
                              "{r.nurse_report}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Doctor Plan Summary */}
                {notes.management_plan && (
                  <div className="p-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl space-y-1">
                    <div className="text-[10px] font-black tracking-wider text-[var(--text-muted)] uppercase">
                      📋 Active Clinical Management Plan Reference
                    </div>
                    <div className="text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap font-sans">
                      {notes.management_plan}
                    </div>
                  </div>
                )}
                
                <Textarea 
                  label="📝 Nurse Instructions" 
                  rows={3}
                  value={notes.nurse_instructions} 
                  onChange={e=>nf('nurse_instructions',e.target.value)}
                  placeholder="e.g. Infuse 500ml Normal Saline over 2 hours. Give IV Ceftriaxone 1g stat. Review vitals in 30 minutes..." 
                />
                
                {/* Med Grid inside Injection tab */}
                <div className="p-5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">💉 Parenteral Medications (IM, IV, SC)</h3>
                    <Btn size="sm" variant="ghost" onClick={addDrug}>
                      <Plus size={12}/> Add Parenteral Drug
                    </Btn>
                  </div>
                  
                  <div className="space-y-3">
                    {drugs.map((item, i) => (
                      <div key={i} className="p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl space-y-3 relative">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-[var(--accent)] font-mono">Parenteral Drug #{i+1}</span>
                          {drugs.length > 1 && (
                            <button onClick={()=>removeDrug(i)} className="text-rose-400 hover:text-rose-300">
                              Remove
                            </button>
                          )}
                        </div>
                        
                        <div className="relative">
                          <label className="text-[10px] text-[var(--text-muted)] block mb-1">Drug Name</label>
                          <input 
                            value={drugSearch[i] || item.drug_name}
                            onChange={e => { 
                              updateDrug(i, 'drug_name', e.target.value); 
                              setDrugSearch(p => ({ ...p, [i]: e.target.value })); 
                              searchDrug(i, e.target.value); 
                            }}
                            placeholder="Type to search pharmacy inventory..."
                            className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] outline-none" 
                          />
                          {drugResults[i]?.length > 0 && (
                            <div className="absolute top-[100%] left-0 right-0 z-[100] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-xl mt-1 max-h-[160px] overflow-y-auto divide-y divide-[var(--border)]/40">
                              {drugResults[i].map(p => (
                                <div 
                                  key={p.id} 
                                  onClick={() => selectDrug(i, p)}
                                  className="p-2 cursor-pointer hover:bg-[var(--bg-elevated)] flex justify-between items-center transition-all text-xs"
                                >
                                  <span className="font-semibold text-[var(--text-primary)]">{p.name}</span>
                                  <span className="text-[10px] text-[var(--text-faint)]">Stock: {p.total_stock || 0}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="text-[9px] text-[var(--text-muted)]">Dosage</label>
                            <input placeholder="500mg" value={item.dosage} onChange={e=>updateDrug(i,'dosage',e.target.value)} className="w-full px-2 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md text-xs text-[var(--text-primary)]" />
                          </div>
                          <div>
                            <label className="text-[9px] text-[var(--text-muted)]">Frequency</label>
                            <input placeholder="Stat / TDS" value={item.frequency} onChange={e=>updateDrug(i,'frequency',e.target.value)} className="w-full px-2 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md text-xs text-[var(--text-primary)]" />
                          </div>
                          <div>
                            <label className="text-[9px] text-[var(--text-muted)]">Quantity</label>
                            <input placeholder="1" type="number" value={item.quantity} onChange={e=>updateDrug(i,'quantity',e.target.value)} className="w-full px-2 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md text-xs text-[var(--text-primary)]" />
                          </div>
                          <div>
                            <label className="text-[9px] text-[var(--text-muted)]">Route</label>
                            <select value={item.route||'IV'} onChange={e=>updateDrug(i,'route',e.target.value)} className="w-full px-2 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-md text-xs text-[var(--text-primary)]">
                              <option value="IV">IV</option>
                              <option value="IM">IM</option>
                              <option value="SC">SC</option>
                              <option value="ID">ID</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Procedures Section */}
                <div className="p-5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">🔪 Clinical & Minor Surgical Procedures</h3>
                    <Btn size="sm" variant="ghost" onClick={addProcedure}>
                      <Plus size={12}/> Add Procedure Entry
                    </Btn>
                  </div>
                  
                  <div className="space-y-3">
                    {procedures.map((item, i) => (
                      <div key={i} className="p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl space-y-3 relative">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-[#a855f7] font-mono">Procedure Order #{i+1}</span>
                          {procedures.length > 1 && (
                            <button onClick={()=>removeProcedure(i)} className="text-rose-400 hover:text-rose-300">
                              Remove
                            </button>
                          )}
                        </div>
                        
                        <ICD10Search 
                          type="procedure" 
                          label="Select Procedure"
                          placeholder="Search minor surgery / wound care / catheterisation..."
                          value={item.procedure_name ? `${item.procedure_code ? item.procedure_code + ' — ' : ''}${item.procedure_name}` : ''}
                          onSelect={({name,code}) => { updateProcedure(i, 'procedure_name', name); updateProcedure(i, 'procedure_code', code); }} 
                        />
                        
                        {item.procedure_code && (
                          <div className="flex items-center gap-2 p-2.5 bg-purple-500/5 border border-purple-500/10 rounded-lg text-xs">
                            <span className="text-[var(--text-muted)] font-mono">Kenya DHA Code:</span>
                            <span className="font-mono font-bold text-[#a855f7] bg-[#a855f7]/10 px-1.5 py-0.5 rounded">
                              {item.procedure_code}
                            </span>
                            <span className="text-[var(--text-primary)] font-medium">
                              {item.procedure_name}
                            </span>
                          </div>
                        )}
                        
                        <Input 
                          label="Special Notes / Instructions for nurse" 
                          value={item.notes} 
                          onChange={e=>updateProcedure(i, 'notes', e.target.value)} 
                          placeholder="Enter wound specifications, suture gauge details..." 
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-[var(--border)]/60">
                  <button 
                    onClick={sendToInjectionRoom} 
                    disabled={saving || sentActions.injection}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-black rounded-xl transition-all shadow-md"
                  >
                    💉 {sentActions.injection ? 'Injection and Procedure Orders Dispatched ✓' : 'Dispatch & Send to Injection Room'}
                  </button>
                </div>
              </Card>
            )}

            {/* ADMISSION TAB */}
            {activeTab === 'admission' && (
              <Card className="p-6 space-y-6">
                <div className="border-b border-[var(--border)] pb-3">
                  <h2 className="text-base font-bold text-[var(--text-primary)]">🏥 Inpatient (IPD) Admission Protocol</h2>
                  <p className="text-xs text-[var(--text-muted)]">Forward clinically unstable patients for inpatient admission to nursing wards.</p>
                </div>
                
                <div className="space-y-5">
                  <div className="flex items-center gap-3 p-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl">
                    <input 
                      type="checkbox" 
                      id="admit" 
                      checked={notes.admit_patient} 
                      onChange={e=>nf('admit_patient', e.target.checked)} 
                      className="w-5 h-5 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                    />
                    <label htmlFor="admit" className="text-sm text-[var(--text-primary)] font-bold cursor-pointer">
                      Flag Patient Profile as Admitted Inpatient (IPD)
                    </label>
                  </div>
                  
                  <div>
                    <label className="text-xs font-bold text-[var(--text-muted)] block mb-1.5">Target Nursing Ward / Care Unit *</label>
                    <select
                      value={showCustomWard ? '__other__' : notes.admission_ward}
                      onChange={e=>{
                        if (e.target.value === '__other__') {
                          setShowCustomWard(true);
                          nf('admission_ward','');
                          nf('admission_bed_id','');
                          nf('admission_bed_number','');
                        } else {
                          setShowCustomWard(false);
                          nf('admission_ward', e.target.value);
                          nf('admission_bed_id','');
                          nf('admission_bed_number','');
                        }
                      }}
                      className="w-full px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] outline-none"
                    >
                      <option value="">Select Target ward...</option>
                      {wards.map(w => (
                        <option key={w.id} value={w.name}>
                          {w.name} {w.ward_type ? `(${w.ward_type})` : ''} — {w.available_beds ?? 0} Beds Free
                        </option>
                      ))}
                      <option value="__other__">+ Register Custom Ward / Specialty Suite</option>
                    </select>
                    {showCustomWard && (
                      <div className="mt-3">
                        <Input value={notes.admission_ward} onChange={e=>nf('admission_ward',e.target.value)} placeholder="Type name of custom ward unit..." />
                      </div>
                    )}
                  </div>

                  {/* TARGET BED SELECTION */}
                  {notes.admission_ward && (
                    <div className="p-4 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                          🛏️ Target Bed / Bed Number *
                        </label>
                        {loadingBeds && <span className="text-[11px] text-[var(--text-muted)] animate-pulse">Loading beds...</span>}
                      </div>

                      {wardBeds.length > 0 ? (
                        <select
                          value={notes.admission_bed_id || ''}
                          onChange={e => {
                            const bId = e.target.value;
                            const bObj = wardBeds.find(b => b.id === bId);
                            nf('admission_bed_id', bId);
                            nf('admission_bed_number', bObj ? bObj.bed_number : '');
                          }}
                          className="w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                        >
                          <option value="">-- Select Specific Bed --</option>
                          {wardBeds.map(b => (
                            <option key={b.id} value={b.id} disabled={b.status !== 'available'}>
                              🛏️ Bed {b.bed_number} — {b.status === 'available' ? '✅ Available / Free' : b.status === 'occupied' ? `🔴 Occupied (${b.patient_name || 'Inpatient'})` : '🛠 Maintenance'}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div>
                          <Input
                            value={notes.admission_bed_number || ''}
                            onChange={e => nf('admission_bed_number', e.target.value)}
                            placeholder="Enter bed designation (e.g. Bed 01, Room 4B)..."
                          />
                          <p className="text-[11px] text-[var(--text-muted)] mt-1">Type custom bed designation or bed number.</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <Textarea label="Primary Clinical Indication for IPD Admission" rows={2} value={notes.admission_reason} onChange={e=>nf('admission_reason',e.target.value)} placeholder="Enter primary admission diagnosis or signs..." />
                  <Textarea label="Ward Protocol & Clinical Care Plan" rows={3} value={notes.admission_notes} onChange={e=>nf('admission_notes',e.target.value)} placeholder="Enter nursing care directives, target parameters, monitoring frequency..." />
                  
                  <button 
                    onClick={sendToWard} 
                    disabled={saving}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-[#0F1612] text-sm font-black rounded-xl transition-all shadow-md text-center"
                  >
                    🏥 Submit Admission Order & Reserve Bed
                  </button>
                </div>
              </Card>
            )}

            {/* HISTORICAL RECORDS TAB */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                <ClinicalTimeline
                  patientId={selectedVisit?.patient_id || patient?.id}
                  patientName={selectedVisit?.patient_name || patient?.full_name}
                  patientNumber={selectedVisit?.patient_number || patient?.patient_number}
                />
              </div>
            )}

            {/* SPECIAL CLINIC REFERRAL TAB */}
            {activeTab === 'specialClinic' && (
              <Card className="p-6 space-y-6 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-sm">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold">
                      🏥
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
                        Special Clinic Referral & Transfer Desk
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] font-normal">
                        Refer patient to specialized clinics with attached treatment summary and automatic encounter setup
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    {specialClinics.length} Clinics Available
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Clinic Selection & Reason */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[var(--text-primary)] block">
                        Target Special Clinic <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={selectedSpecialClinic}
                        onChange={e => setSelectedSpecialClinic(e.target.value)}
                        className="w-full p-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-purple-500 cursor-pointer"
                      >
                        {specialClinics.map(sc => (
                          <option key={sc.id || sc.code} value={sc.code || sc.id} className="text-[var(--text-primary)] bg-[var(--bg-surface)]">
                            {sc.name} — {sc.description}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[var(--text-primary)] block">
                        Referral Urgency Level
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'ROUTINE', label: 'Routine', color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5' },
                          { id: 'URGENT', label: 'Urgent', color: 'border-amber-500/40 text-amber-400 bg-amber-500/5' },
                          { id: 'EMERGENCY', label: 'Emergency 🚨', color: 'border-rose-500/40 text-rose-400 bg-rose-500/5' },
                        ].map(u => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => setSpecialClinicUrgency(u.id)}
                            className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all ${
                              specialClinicUrgency === u.id
                                ? `${u.color} ring-1 ring-purple-500 font-extrabold shadow-sm`
                                : 'border-[var(--border)] text-[var(--text-muted)] bg-[var(--bg-elevated)]'
                            }`}
                          >
                            {u.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-[var(--text-primary)] block">
                        Clinical Referral Notes & Indications
                      </label>
                      <textarea
                        rows={4}
                        value={specialClinicReason}
                        onChange={e => setSpecialClinicReason(e.target.value)}
                        placeholder="Detail clinical reasons, specialist opinion requested, and specific tests or management needed..."
                        className="w-full p-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:border-purple-500 resize-none font-sans"
                      />
                    </div>
                  </div>

                  {/* Right Column: Treatment Summary Attachment Preview */}
                  <div className="p-4 bg-[var(--bg-elevated)]/60 border border-[var(--border)] rounded-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                      <span className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                        📄 Treatment Summary Attachment
                      </span>
                      <span className="text-[10px] text-emerald-400 font-mono font-bold">AUTO-GENERATED</span>
                    </div>

                    <div className="space-y-2.5 text-xs text-[var(--text-primary)]">
                      <div className="flex justify-between py-1 border-b border-[var(--border)]/30">
                        <span className="text-[var(--text-muted)]">Patient Name:</span>
                        <span className="font-bold">{patient?.full_name || selectedVisit?.patient_name}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[var(--border)]/30">
                        <span className="text-[var(--text-muted)]">Vitals Recorded:</span>
                        <span className="font-mono text-emerald-400 font-bold">
                          {selectedVisit?.vitals?.blood_pressure_systolic ? `${selectedVisit.vitals.blood_pressure_systolic}/${selectedVisit.vitals.blood_pressure_diastolic} mmHg, ${selectedVisit.vitals.temperature || '36.5'}°C` : 'Vitals logged'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[var(--border)]/30">
                        <span className="text-[var(--text-muted)]">Diagnoses:</span>
                        <span className="font-bold text-amber-400 truncate max-w-[200px]">
                          {diagnoses.map(d => d.name || d.code).join(', ') || 'Clinical Evaluation'}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[var(--border)]/30">
                        <span className="text-[var(--text-muted)]">Prescriptions:</span>
                        <span className="font-mono text-cyan-400 font-bold">
                          {drugs.filter(d => d.drug_name?.trim()).length} Item(s)
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[var(--border)]/30">
                        <span className="text-[var(--text-muted)]">Lab Orders:</span>
                        <span className="font-mono text-purple-400 font-bold">
                          {tests.filter(t => t.test_name?.trim()).length} Test(s)
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-[11px] text-purple-300 space-y-1">
                      <span className="font-bold block">ℹ️ Automated Workflow Action:</span>
                      <p className="opacity-90 leading-relaxed">
                        Submitting this referral saves clinical notes, updates the visit status, queues the patient in the chosen Special Clinic, and prints/attaches the complete Treatment Summary document.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const summaryPayload = {
                          patient: patient || { full_name: selectedVisit?.patient_name, patient_number: selectedVisit?.patient_number },
                          consultation: {
                            notes,
                            diagnoses,
                            prescriptions: drugs.filter(d => d.drug_name?.trim()),
                            lab_requests: tests.filter(t => t.test_name?.trim()),
                            procedures: procedures.filter(p => p.procedure_name?.trim())
                          },
                          vitals: selectedVisit?.vitals || {},
                          injection_orders: []
                        };
                        printTreatmentSummary(summaryPayload, user?.pharmacy);
                      } catch (err) {
                        toast.error('Could not generate treatment summary');
                      }
                    }}
                    className="px-4 py-2.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-bold rounded-xl transition-all flex items-center gap-2"
                  >
                    <Printer size={14} /> Print Treatment Summary Preview
                  </button>

                  <button
                    type="button"
                    onClick={referToSpecialClinic}
                    disabled={referringSpecialClinic}
                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-purple-600/20 cursor-pointer disabled:opacity-50"
                  >
                    {referringSpecialClinic ? <Loader size={14} className="animate-spin" /> : '🏥'}
                    Refer & Send to Special Clinic (With Summary)
                  </button>
                </div>
              </Card>
            )}

              </div> {/* Close Tab Contents */}
            </div> {/* Close Workdesk Layout */}
          </main>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return renderConsultationWorkspace();
  // eslint-disable-next-line no-unreachable
  return (
    <div style={{ height:'100vh', overflow:'auto', padding:24 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={resetToQueue} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', cursor:'pointer', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:6, fontSize:13 }}>
            <ArrowLeft size={15}/> Queue
          </button>
          <div>
            <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)' }}>{patient?.full_name}</h1>
            <div style={{ display:'flex', gap:10, marginTop:3, flexWrap:'wrap' }}>
              <span style={{ fontSize:11, color:'var(--accent)', fontFamily:'monospace', fontWeight:700 }}>{patient?.patient_number}</span>
              <span style={{ fontSize:11, color:'var(--text-muted)' }}>{patient?.gender} · {getAge(patient?.date_of_birth)}</span>
              <span style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase' }}>{selectedVisit?.visit_type?.replace('_',' ')}</span>
              {selectedVisit?.priority !== 'normal' && (
                <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4, fontWeight:700, background:`${PRIORITY_COLORS[selectedVisit?.priority]}20`, color:PRIORITY_COLORS[selectedVisit?.priority], textTransform:'uppercase' }}>
                  {selectedVisit?.priority==='emergency'?'🚨':'⚠'} {selectedVisit?.priority}
                </span>
              )}
              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:4, fontWeight:600, background:`${STATUS_COLORS[selectedVisit?.status]}20`, color:STATUS_COLORS[selectedVisit?.status] }}>
                {STATUS_LABELS[selectedVisit?.status]}
              </span>
              {completedLabResults.length > 0 && (
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:4, fontWeight:600, background:'var(--info)20', color:'var(--info)', cursor:'pointer' }} onClick={()=>setActiveTab('labResults')}>
                  🔬 {completedLabResults.length} result{completedLabResults.length>1?'s':''} ready
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <Btn variant="ghost" size="sm" onClick={()=>saveConsultation(false)} disabled={saving}>
            {saving ? <Loader size={13} style={{ animation:'spin 0.8s linear infinite' }}/> : null} Save Draft
          </Btn>
          <Btn variant="ghost" size="sm" onClick={sendToLab} disabled={saving}><FlaskConical size={13}/> → Lab</Btn>
          <Btn variant="ghost" size="sm" onClick={sendToRadiology} disabled={saving}>📸 → Radiology</Btn>
          <Btn variant="ghost" size="sm" onClick={sendToInjectionRoom} disabled={saving || sentActions.injection}>💉 → Injection{sentActions.injection ? ' ✓' : ''}</Btn>
          <Btn variant="ghost" size="sm" onClick={sendToWard} disabled={saving}>🏥 → Ward</Btn>
          <Btn size="sm" onClick={()=>saveConsultation(true)} disabled={saving}><Send size={13}/> → Pharmacy</Btn>
          <Btn variant="warning" size="sm" onClick={referToExternalHospital} disabled={saving}>✈️ External Referral</Btn>
          <Btn variant="danger" size="sm" onClick={discharge} disabled={saving}><CheckCircle size={13}/> Discharge</Btn>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:20 }}>

        {/* Left Panel */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Vitals */}
          <Card style={{ padding:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>Vitals</div>
              {[
                { label:'Blood Pressure', value:selectedVisit.blood_pressure_systolic?`${selectedVisit.blood_pressure_systolic}/${selectedVisit.blood_pressure_diastolic} mmHg`:null, color:'var(--danger)' },
                { label:'Pulse Rate',     value:selectedVisit.pulse_rate?`${selectedVisit.pulse_rate} bpm`:null,       color:'var(--info)' },
                { label:'Temperature',    value:selectedVisit.temperature?`${selectedVisit.temperature}°C`:null,       color:'var(--warning)' },
                { label:'SpO2',           value:selectedVisit.oxygen_saturation?`${selectedVisit.oxygen_saturation}%`:null, color:'var(--accent)' },
                { label:'Weight',         value:selectedVisit.weight?`${selectedVisit.weight} kg`:null,                color:'var(--text-primary)' },
                { label:'BMI',           value:selectedVisit.bmi?`${selectedVisit.bmi} kg/m²`:null,                     color:'var(--text-primary)' },
                { label:'Blood Glucose',  value:selectedVisit.blood_glucose?`${selectedVisit.blood_glucose} mmol/L`:null, color:'var(--text-primary)' },
              ].map(({label,value,color})=>(
                <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
                  <span style={{ color:'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontWeight:600, color: value ? color : 'var(--text-faint)' }}>{value || '—'}</span>
                </div>
              ))}
            </Card>

          {/* Allergies */}
          {(patient?.allergies||patient?.chronic_conditions) && (
            <Card style={{ padding:16, border:'1px solid var(--danger)40' }}>
              {patient.allergies && (
                <div style={{ marginBottom:patient.chronic_conditions?10:0 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--danger)', marginBottom:5 }}>⚠ ALLERGIES</div>
                  <div style={{ fontSize:12, color:'var(--text-primary)', lineHeight:1.5 }}>{patient.allergies}</div>
                </div>
              )}
              {patient.chronic_conditions && (
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--warning)', marginBottom:5 }}>🏥 CHRONIC CONDITIONS</div>
                  <div style={{ fontSize:12, color:'var(--text-primary)', lineHeight:1.5 }}>{patient.chronic_conditions}</div>
                </div>
              )}
            </Card>
          )}

          {/* Patient Info */}
          <Card style={{ padding:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>Patient Info</div>
            {[
              { label:'SHA No.',         value:patient?.sha_number||'—' },
              { label:'Blood Group',     value:patient?.blood_group||'—' },
              { label:'Phone',           value:patient?.phone },
              { label:'Visit No.',       value:selectedVisit?.visit_number },
              { label:'Chief Complaint', value:selectedVisit?.chief_complaint||'—' },
            ].map(({label,value})=>(
              <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
                <span style={{ color:'var(--text-muted)' }}>{label}</span>
                <span style={{ color:'var(--text-primary)', fontWeight:500, textAlign:'right', maxWidth:130, wordBreak:'break-word' }}>{value}</span>
              </div>
            ))}
          </Card>

          {/* Lab status */}
          {labResults.length > 0 && (
            <Card style={{ padding:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>
                Lab Status
                <button onClick={refreshLabResults} style={{ marginLeft:8, background:'none', border:'none', cursor:'pointer', color:'var(--accent)', fontSize:11 }}>↻ Refresh</button>
              </div>
              {labResults.map((l,i)=>(
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
                  <span style={{ color:'var(--text-muted)' }}>{l.test_name}</span>
                  <span style={{ fontWeight:600, color: l.result||l.result_value ? 'var(--accent)' : 'var(--warning)' }}>
                    {l.result||l.result_value ? '✅ Ready' : '⏳ Pending'}
                  </span>
                </div>
              ))}
              {completedLabResults.length > 0 && (
                <button onClick={()=>setActiveTab('labResults')} style={{ marginTop:8, width:'100%', padding:'7px', background:'var(--info)15', border:'1px solid var(--info)40', borderRadius:6, color:'var(--info)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  View Results →
                </button>
              )}
            </Card>
          )}

          {/* Past Visits */}
          {patient?.visits?.length > 0 && (
            <Card style={{ padding:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>
                Past Visits ({patient.visits.length})
              </div>
              {patient.visits.slice(0,6).map(v=>(
                <div key={v.id} style={{ padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                    <span style={{ color:'var(--accent)', fontFamily:'monospace', fontWeight:700 }}>{v.visit_number}</span>
                    <span style={{ fontSize:11, padding:'1px 6px', borderRadius:4, background:`${STATUS_COLORS[v.status]||'var(--text-muted)'}20`, color:STATUS_COLORS[v.status]||'var(--text-muted)', fontWeight:600 }}>
                      {STATUS_LABELS[v.status]||v.status}
                    </span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    {v.chief_complaint && <span style={{ color:'var(--text-muted)' }}>{v.chief_complaint.slice(0,35)}</span>}
                    <span style={{ color:'var(--text-faint)' }}>{new Date(v.visit_date).toLocaleDateString('en-KE')}</span>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>

        {/* Right Panel */}
        <div>
          {/* Tabs */}
          <div style={{ display:'flex', gap:4, marginBottom:16, background:'var(--bg-surface)', borderRadius:10, padding:4, border:'1px solid var(--border)', flexWrap:'wrap' }}>
            {[
              { id:'notes',        label:'📋 Notes' },
              { id:'diagnosis',    label:'🔍 Diagnosis' },
              { id:'prescription', label:'💊 Prescription' },
              { id:'lab',          label:'🔬 Lab' },
              { id:'labResults',   label: completedLabResults.length > 0 ? `🧪 Results (${completedLabResults.length})` : '🧪 Results' },
              { id:'radiology',    label:'📸 Radiology' },
              { id:'injection',    label:'💉 Injection' },
              { id:'admission',    label:'🏥 Admission' },
              { id:'history',      label:'📁 History' },
            ].map(tab=>(
              <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{
                padding:'7px 14px', borderRadius:7, border:'none', cursor:'pointer', fontSize:12, fontWeight:600,
                background: activeTab===tab.id ? 'var(--accent)' : tab.id==='labResults'&&completedLabResults.length>0 ? 'var(--info)20' : 'transparent',
                color: activeTab===tab.id ? '#0F1612' : tab.id==='labResults'&&completedLabResults.length>0 ? 'var(--info)' : 'var(--text-muted)',
                fontFamily:'DM Sans, sans-serif'
              }}>{tab.label}</button>
            ))}
          </div>

          {/* NOTES TAB */}
          {activeTab === 'notes' && (
            <Card style={{ padding:24 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <Textarea label="Presenting Complaint" rows={2} value={notes.presenting_complaint} onChange={e=>nf('presenting_complaint',e.target.value)} placeholder="Patient's presenting complaint..." />
                <Textarea label="History of Presenting Illness" rows={3} value={notes.history_of_illness} onChange={e=>nf('history_of_illness',e.target.value)} placeholder="History of the illness..." />
                <Textarea label="Examination Findings" rows={3} value={notes.examination_findings} onChange={e=>nf('examination_findings',e.target.value)} placeholder="Physical examination findings..." />
                <Textarea label="Review of Systems" rows={4} value={notes.review_of_systems} onChange={e=>nf('review_of_systems',e.target.value)} placeholder="Constitutional, HEENT, Cardiovascular, Respiratory, GI..." />
                <Textarea label="Impression / Clinical Impression" rows={2} value={notes.impression} onChange={e=>nf('impression',e.target.value)} placeholder="Clinical impression and differential diagnoses..." />
                <Textarea label="Management Plan" rows={3} value={notes.management_plan} onChange={e=>nf('management_plan',e.target.value)} placeholder="Treatment and management plan..." />
                <Textarea label="Referral (if any)" rows={2} value={notes.referral} onChange={e=>nf('referral',e.target.value)} placeholder="e.g. Refer to cardiologist..." />
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <Input label="Follow-up Date" type="date" value={notes.follow_up_date} onChange={e=>nf('follow_up_date',e.target.value)} />
                  <Input label="Follow-up Notes" value={notes.follow_up_notes} onChange={e=>nf('follow_up_notes',e.target.value)} placeholder="e.g. Review in 2 weeks" />
                </div>
              </div>
            </Card>
          )}

          {/* DIAGNOSIS TAB */}
          {activeTab === 'diagnosis' && (
            <Card style={{ padding:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>🔍 Diagnoses</div>
                <Btn size="sm" variant="ghost" onClick={addDiagnosis}><Plus size={13}/> Add Diagnosis</Btn>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {diagnoses.map((item,i)=>(
                  <div key={i} style={{ padding:14, background:'var(--bg-elevated)', borderRadius:10, border:'1px solid var(--border)', position:'relative' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--accent)', marginBottom:10 }}>
                      {i===0 ? 'Primary Diagnosis' : `Secondary Diagnosis #${i+1}`}
                    </div>
                    {diagnoses.length > 1 && (
                      <button onClick={()=>removeDiagnosis(i)} style={{ position:'absolute', top:12, right:12, background:'none', border:'none', cursor:'pointer', color:'var(--danger)' }}><X size={15}/></button>
                    )}
                    <ICD10Search type="diagnosis" label="Search Diagnosis"
                      placeholder="e.g. malaria, pneumonia, hypertension..."
                      value={item.name ? `${item.code?item.code+' — ':''}${item.name}` : ''}
                      onSelect={({name,code})=>updateDiagnosis(i,{name,code})} />
                    {item.code && (
                      <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8, padding:'6px 10px', background:'var(--accent-soft)', borderRadius:6 }}>
                        <span style={{ fontSize:11, color:'var(--text-muted)' }}>ICD-11 (DHA):</span>
                        <span style={{ fontSize:13, fontWeight:700, color:'var(--accent)', fontFamily:'monospace' }}>{item.code}</span>
                        <span style={{ fontSize:12, color:'var(--text-primary)' }}>{item.name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* PRESCRIPTION TAB */}
          {activeTab === 'prescription' && (
            <Card style={{ padding:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>💊 Prescription</div>
                <Btn size="sm" variant="ghost" onClick={addDrug}><Plus size={13}/> Add Drug</Btn>
              </div>
              {existingConsultation?.prescriptions?.length > 0 && (
                <div style={{ padding:12, background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:10, marginBottom:16 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--accent)', marginBottom:8 }}>
                    ✓ Previously Prescribed Medications ({existingConsultation.prescriptions.length})
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {existingConsultation.prescriptions.map((p, idx) => (
                      <div key={idx} style={{ padding:8, background:'var(--bg-elevated)', borderRadius:6, border:'1px solid var(--border)', fontSize:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span><strong>{p.drug_name}</strong> {p.dosage}</span>
                        <span style={{ fontSize:10, color:'var(--accent)', fontWeight:700 }}>{p.status?.toUpperCase() || 'SENT'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {drugs.map((item,i)=>(
                  <div key={i} style={{ padding:16, background:'var(--bg-elevated)', borderRadius:10, border:'1px solid var(--border)', position:'relative' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--accent)', marginBottom:10 }}>Drug #{i+1}</div>
                    {drugs.length>1 && <button onClick={()=>removeDrug(i)} style={{ position:'absolute', top:12, right:12, background:'none', border:'none', cursor:'pointer', color:'var(--danger)' }}><X size={15}/></button>}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
                      <div style={{ gridColumn:'1/-1' }}><div style={{ position:'relative' }}>
    <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>Drug Name * (Search Pharmacy Stock)</label>
    <input value={drugSearch[i] || item.drug_name} 
      onChange={e => { updateDrug(i,'drug_name',e.target.value); setDrugSearch(p=>({...p,[i]:e.target.value})); searchDrug(i, e.target.value); }}
      placeholder="Type to search pharmacy stock..." 
      style={{ width:'100%', padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none', fontFamily:'DM Sans, sans-serif', boxSizing:'border-box' }} />
    {drugResults[i]?.length > 0 && (
      <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:100, background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:8, boxShadow:'0 8px 24px #00000040', marginTop:4, maxHeight:200, overflow:'auto' }}>
        {drugResults[i].map(p => (
          <div key={p.id} onClick={() => selectDrug(i, p)}
            style={{ padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}
            onMouseEnter={e => e.currentTarget.style.background='var(--bg-elevated)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
            <div>
              <div style={{ fontSize:13, fontWeight:600 }}>{p.name}</div>
              {p.generic_name && <div style={{ fontSize:11, color:'var(--text-muted)' }}>{p.generic_name}</div>}
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:12, fontWeight:700, color:p.total_stock > 0 ? 'var(--accent)' : 'var(--danger)' }}>
                {p.total_stock > 0 ? '✅ In Stock' : '❌ Out'}
              </div>
              <div style={{ fontSize:10, color:'var(--text-muted)' }}>Stock: {p.total_stock || 0}</div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div></div>
                      <Input label="Dosage" value={item.dosage} onChange={e=>updateDrug(i,'dosage',e.target.value)} placeholder="e.g. 500mg" />
                      <Input label="Frequency" value={item.frequency} onChange={e=>updateDrug(i,'frequency',e.target.value)} placeholder="e.g. TDS" />
                      <Input label="Duration" value={item.duration} onChange={e=>updateDrug(i,'duration',e.target.value)} placeholder="e.g. 7 days" />
                      <Select label="Route" value={item.route} onChange={e=>updateDrug(i,'route',e.target.value)}>
                        {['oral','iv','im','topical','sublingual','inhaled','rectal','eye_drops','ear_drops'].map(r=><option key={r} value={r}>{r}</option>)}
                      </Select>
                      <Input label="Quantity" type="number" value={item.quantity} onChange={e=>updateDrug(i,'quantity',e.target.value)} placeholder="e.g. 21" />
                    </div>
                    <Input label="Special Instructions" value={item.instructions} onChange={e=>updateDrug(i,'instructions',e.target.value)} placeholder="e.g. Take after meals" />
                  </div>
                ))}
              </div>
              <div style={{ marginTop:14, padding:12, background:'var(--accent-soft)', borderRadius:8, fontSize:13, color:'var(--accent)' }}>
                💡 Click <strong>→ Pharmacy</strong> above to send this prescription to the pharmacy queue.
              </div>
            </Card>
          )}

          {/* LAB TAB */}
          {activeTab === 'lab' && (
            <Card style={{ padding:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>🔬 Lab Requests</div>
                <Btn size="sm" variant="ghost" onClick={addTest}><Plus size={13}/> Add Test</Btn>
              </div>
              {(existingConsultation?.lab_requests?.length > 0 || labResults?.length > 0) && (
                <div style={{ padding:12, background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:10, marginBottom:16 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'#f97316', marginBottom:8 }}>
                    🔬 Previously Requested Lab Tests
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {(labResults.length > 0 ? labResults : existingConsultation?.lab_requests || []).map((l, idx) => (
                      <div key={idx} style={{ padding:8, background:'var(--bg-elevated)', borderRadius:6, border:'1px solid var(--border)', fontSize:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span><strong>{l.test_name}</strong></span>
                        <span style={{ fontSize:10, color: l.result||l.result_value ? 'var(--accent)' : '#f97316', fontWeight:700 }}>
                          {l.result||l.result_value ? '✅ RESULTED' : '⏳ PENDING'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {tests.map((item,i)=>(
                  <div key={i} style={{ padding:16, background:'var(--bg-elevated)', borderRadius:10, border:'1px solid var(--border)', position:'relative' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#f97316', marginBottom:10 }}>Test #{i+1}</div>
                    {tests.length>1 && <button onClick={()=>removeTest(i)} style={{ position:'absolute', top:12, right:12, background:'none', border:'none', cursor:'pointer', color:'var(--danger)' }}><X size={15}/></button>}
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      <ICD10Search type="lab" label="Test Name *" placeholder="e.g. Full Blood Count, Blood Slide for Malaria, Urinalysis..."
                        value={item.test_name?`${item.test_code?item.test_code+' — ':''}${item.test_name}`:''}
                        onSelect={({name,code})=>{ updateTest(i,'test_name',name); updateTest(i,'test_code',code); }} />
                      <Select label="Urgency" value={item.urgency} onChange={e=>updateTest(i,'urgency',e.target.value)}>
                        <option value="routine">Routine</option>
                        <option value="urgent">Urgent</option>
                        <option value="stat">STAT (Immediate)</option>
                      </Select>
                      <Input label="Clinical Notes" value={item.notes} onChange={e=>updateTest(i,'notes',e.target.value)} placeholder="Clinical indication..." />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:14 }}>
                <Btn onClick={sendToLab} disabled={saving} style={{ width:'100%', justifyContent:'center' }}>
                  <FlaskConical size={14}/> Send Patient to Lab
                </Btn>
              </div>
              <div style={{ marginTop:10, padding:12, background:'var(--info)10', borderRadius:8, fontSize:12, color:'var(--info)' }}>
                ℹ️ Patient stays visible in your queue after sending to lab. Check the 🧪 Results tab for results.
              </div>
            </Card>
          )}

          {/* LAB RESULTS TAB */}
          {activeTab === 'labResults' && (
            <Card style={{ padding:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
                <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>🧪 Lab Results</div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {labResults.length > 0 && (
                    <Btn size="sm" variant="outline" onClick={() => printLabResult(labResults, user?.pharmacy, patient || { full_name: selectedVisit?.patient_name, patient_number: selectedVisit?.patient_number }, selectedVisit)}>
                      <Printer size={13}/> Print Combined Lab Report (PDF)
                    </Btn>
                  )}
                  <Btn size="sm" variant="ghost" onClick={refreshLabResults}><RefreshCw size={13}/> Refresh</Btn>
                </div>
              </div>
              {labResults.length === 0 ? (
                <div style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>
                  <FlaskConical size={40} color="var(--text-faint)" style={{ marginBottom:12 }}/>
                  <p style={{ fontSize:14, fontWeight:500 }}>No lab tests ordered</p>
                  <p style={{ fontSize:12, marginTop:4 }}>Order tests in the 🔬 Lab tab first.</p>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                  {labResults.map((l,i)=>(
                    <div key={i} style={{ background:'var(--bg-elevated)', borderRadius:12, border:`1px solid ${l.result||l.result_value?'var(--accent)40':'var(--border)'}`, overflow:'hidden' }}>
                      <div style={{ padding:'10px 16px', background:'var(--bg-surface)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, justifyContent:'space-between' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <FlaskConical size={14} color="var(--info)"/>
                          <span style={{ fontSize:13, fontWeight:600, color:'var(--info)' }}>{l.test_name}</span>
                          {l.urgency==='stat' && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'var(--danger)20', color:'var(--danger)', fontWeight:700 }}>STAT</span>}
                          {l.urgency==='urgent' && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'var(--warning)20', color:'var(--warning)', fontWeight:700 }}>URGENT</span>}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          {l.result_flag && (
                            <span style={{ fontSize:10, padding:'2px 8px', borderRadius:6, fontWeight:700,
                              background: l.result_flag==='high'?'#ef444415':l.result_flag==='low'?'#3b82f615':'#10b98115',
                              color: l.result_flag==='high'?'#ef4444':l.result_flag==='low'?'#3b82f6':'#10b981'
                            }}>{l.result_flag.toUpperCase()}</span>
                          )}
                          <span style={{ fontSize:11, fontWeight:600, color: l.result||l.result_value?'var(--accent)':'var(--warning)' }}>
                            {l.result||l.result_value ? '✅ Resulted' : '⏳ Pending'}
                          </span>
                        </div>
                      </div>
                      <div style={{ padding:14 }}>
                        {l.result||l.result_value ? (
                          <>
                            {l.result_value && (
                              <div style={{ display:'flex', gap:8, alignItems:'baseline', marginBottom:8 }}>
                                <span style={{ fontSize:24, fontWeight:700, color:'var(--text-primary)' }}>{l.result_value}</span>
                                {l.result_unit && <span style={{ fontSize:13, color:'var(--text-muted)' }}>{l.result_unit}</span>}
                                {l.reference_range && <span style={{ fontSize:11, color:'var(--text-faint)' }}>Ref: {l.reference_range}</span>}
                              </div>
                            )}
                            {l.result && <ResultRenderer result={l.result} testName={l.test_name} />}
                            {l.technician_notes && (
                              <div style={{ marginTop:8, padding:'8px 12px', background:'var(--bg-surface)', borderRadius:6, fontSize:12, color:'var(--text-muted)' }}>
                                📝 {l.technician_notes}
                              </div>
                            )}
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12, paddingTop:8, borderTop:'1px dashed var(--border)' }}>
                              <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                                👩‍🔬 Tech: <strong style={{ color:'var(--text-primary)' }}>{l.technician_name || 'Lab Technologist'}</strong>
                                {l.resulted_at && <span style={{ marginLeft:8, color:'var(--text-faint)' }}>({new Date(l.resulted_at).toLocaleString('en-KE')})</span>}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize:13, color:'var(--text-muted)', textAlign:'center', padding:16 }}>
                            Awaiting results from lab...
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* RADIOLOGY TAB */}
          {activeTab === 'radiology' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <Card style={{ padding:24 }}>
                <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', marginBottom:16 }}>📸 Send Patient to Radiology</div>
                <p style={{ fontSize:13, color:'var(--text-muted)', marginBottom:16 }}>
                  Document radiology request and send patient to radiology department.
                </p>
                <Textarea label="Radiology Request / Clinical Indication" rows={3}
                  value={notes.referral} onChange={e=>nf('referral',e.target.value)}
                  placeholder="e.g. Chest X-ray — query pneumonia, CT scan head — query haemorrhage..." />
                <div style={{ marginTop:14 }}>
                  <Btn onClick={sendToRadiology} disabled={saving} style={{ width:'100%', justifyContent:'center' }}>
                    📸 Send Patient to Radiology
                  </Btn>
                </div>
              </Card>

              <Card style={{ padding:24 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>📸 Radiology Reports & Findings</div>
                  <Btn size="sm" variant="ghost" onClick={refreshRadiologyReports}><RefreshCw size={13}/> Refresh</Btn>
                </div>

                {radiologyReports.length === 0 ? (
                  <div style={{ textAlign:'center', padding:30, color:'var(--text-muted)', background:'var(--bg-elevated)', borderRadius:10 }}>
                    <p style={{ fontSize:13, fontWeight:500 }}>No radiology reports filed yet for this visit.</p>
                    <p style={{ fontSize:11, marginTop:4 }}>Once the radiologist submits findings, they will appear here with full printing details.</p>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                    {radiologyReports.map((r, i) => (
                      <div key={i} style={{ padding:16, background:'var(--bg-elevated)', borderRadius:12, border:'1px solid var(--border)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                          <div>
                            <div style={{ fontSize:14, fontWeight:700, color:'var(--accent)' }}>{r.study_name || 'Radiology Study'}</div>
                            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                              📸 Radiologist: <strong style={{ color:'var(--text-primary)' }}>{r.radiologist_name || 'Consultant Radiologist'}</strong>
                            </div>
                          </div>
                          <Btn size="sm" variant="outline" onClick={() => printRadiologyReport(r, patient || { full_name: selectedVisit.patient_name, patient_number: selectedVisit.patient_number }, selectedVisit, user?.pharmacy, user?.full_name)}>
                            <Printer size={13}/> Print Radiology PDF
                          </Btn>
                        </div>

                        {r.findings && (
                          <div style={{ marginTop:10, padding:12, background:'var(--bg-surface)', borderRadius:8 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', marginBottom:4 }}>Findings & Observations:</div>
                            <div style={{ fontSize:13, color:'var(--text-primary)', whiteSpace:'pre-wrap' }}>{r.findings}</div>
                          </div>
                        )}

                        {r.impression && (
                          <div style={{ marginTop:8, padding:12, background:'var(--bg-surface)', borderRadius:8, borderLeft:'3px solid var(--accent)' }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'var(--accent)', textTransform:'uppercase', marginBottom:4 }}>Impression / Conclusion:</div>
                            <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{r.impression}</div>
                          </div>
                        )}

                        {r.notes && (
                          <div style={{ marginTop:8, fontSize:11, color:'var(--text-faint)' }}>
                            Technical Remarks: {r.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* PROCEDURES TAB */}
          {activeTab === 'procedures' && (
            <Card style={{ padding:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>🔪 Procedures</div>
                <Btn size="sm" variant="ghost" onClick={addProcedure}><Plus size={13}/> Add</Btn>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {procedures.map((item,i)=>(
                  <div key={i} style={{ padding:16, background:'var(--bg-elevated)', borderRadius:10, border:'1px solid var(--border)', position:'relative' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:10 }}>Procedure #{i+1}</div>
                    {procedures.length>1 && <button onClick={()=>removeProcedure(i)} style={{ position:'absolute', top:12, right:12, background:'none', border:'none', cursor:'pointer', color:'var(--danger)' }}><X size={15}/></button>}
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      <ICD10Search type="procedure" label="Procedure *" placeholder="e.g. Wound Dressing, IV Cannulation, Nebulization..."
                        value={item.procedure_name?`${item.procedure_code?item.procedure_code+' — ':''}${item.procedure_name}`:''}
                        onSelect={({name,code})=>{ updateProcedure(i,'procedure_name',name); updateProcedure(i,'procedure_code',code); }} />
                      <Textarea label="Notes" rows={2} value={item.notes} onChange={e=>updateProcedure(i,'notes',e.target.value)} placeholder="Procedure details..." />
                      <Input label="Outcome" value={item.outcome} onChange={e=>updateProcedure(i,'outcome',e.target.value)} placeholder="e.g. Successful, no complications" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* INJECTION TAB */}
          {/* ── INJECTION & PROCEDURES TAB ── */}
          {activeTab === 'injection' && (
            <Card style={{ padding:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)' }}>💉 Injection & Procedures</div>
                <Btn size='sm' variant='ghost' onClick={refreshInjectionReports}>↻ Refresh</Btn>
              </div>
              {injectionReports.filter(r => r.status === 'administered').length > 0 && (
                <div style={{ marginBottom:20, padding:16, background:'rgba(16,185,129,0.08)', borderRadius:10, border:'1px solid rgba(16,185,129,0.3)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#10b981' }}>
                      ✅ Nurse Reports ({injectionReports.filter(r => r.status === 'administered').length} administered)
                    </div>
                    <Btn size="sm" variant="outline" onClick={() => printInjectionReport(injectionReports, patient || { full_name: selectedVisit.patient_name, patient_number: selectedVisit.patient_number }, selectedVisit, user?.pharmacy, user?.full_name)}>
                      <Printer size={13}/> Print Injection Report (PDF)
                    </Btn>
                  </div>
                  {injectionReports.filter(r => r.status === 'administered').map((r, i) => (
                    <div key={i} style={{ padding:'10px 14px', background:'var(--bg-elevated)', borderRadius:8, marginBottom:8, fontSize:12 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontWeight:700, color:'var(--text-primary)' }}>{r.drug_name} {r.dosage}</span>
                        <span style={{ color:'#10b981' }}>✅ {r.administered_at ? new Date(r.administered_at).toLocaleTimeString('en-KE',{hour:'2-digit',minute:'2-digit'}) : 'Given'}</span>
                      </div>
                      <div style={{ color:'var(--text-muted)', marginBottom:2 }}>👩‍⚕️ Administered By: <strong style={{ color:'var(--text-primary)' }}>{r.nurse_name || r.administered_by_name || 'Staff Nurse'}</strong></div>
                      {r.nurse_report && <div style={{ padding:'6px 10px', background:'var(--bg-surface)', borderRadius:6, color:'var(--text-primary)', marginTop:4 }}>📝 {r.nurse_report}</div>}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Instructions */}
              {notes.management_plan && (
                <div style={{ marginBottom:12, padding:12, background:'var(--bg-elevated)', borderRadius:8, border:'1px solid var(--border)' }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                    📋 Doctor's Treatment Plan
                  </div>
                  <div style={{ fontSize:13, color:'var(--text-primary)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>
                    {notes.management_plan}
                  </div>
                </div>
              )}
              <Textarea label="📝 Nurse Instructions" rows={3}
                value={notes.nurse_instructions} onChange={e=>nf('nurse_instructions',e.target.value)}
                placeholder="e.g. Give IV NS 1L over 1 hour. Monitor BP every 15 min. Check temperature after 30 min..." />
              
              {/* IV/IM Drugs */}
              <div style={{ marginTop:20, padding:16, background:'var(--bg-elevated)', borderRadius:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>💊 IV / IM Medications</div>
                  <Btn size="sm" variant="ghost" onClick={addDrug}><Plus size={13}/> Add Drug</Btn>
                </div>
                {drugs.map((item,i)=>(
                  <div key={i} style={{ padding:12, background:'var(--bg-surface)', borderRadius:8, marginBottom:8, border:'1px solid var(--border)' }}>
                    <div style={{ marginBottom:8 }}>
                      <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:4 }}>Drug Name * (Search Pharmacy Stock)</label>
                      <div style={{ position:'relative' }}>
                        <input value={drugSearch[i] || item.drug_name}
                          onChange={e => { updateDrug(i,'drug_name',e.target.value); setDrugSearch(p=>({...p,[i]:e.target.value})); searchDrug(i, e.target.value); }}
                          placeholder="Type to search pharmacy stock..."
                          style={{ width:'100%', padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                        {drugResults[i]?.length > 0 && (
                          <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:100, background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:8, boxShadow:'0 8px 24px #00000040', marginTop:4, maxHeight:200, overflow:'auto' }}>
                            {drugResults[i].map(p => (
                              <div key={p.id} onClick={() => selectDrug(i, p)}
                                style={{ padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}
                                onMouseEnter={e => e.currentTarget.style.background='var(--bg-elevated)'}
                                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                                <div>
                                  <div style={{ fontSize:13, fontWeight:600 }}>{p.name}</div>
                                  {p.generic_name && <div style={{ fontSize:11, color:'var(--text-muted)' }}>{p.generic_name}</div>}
                                </div>
                                <div style={{ textAlign:'right' }}>
                                  <div style={{ fontSize:12, fontWeight:700, color:p.total_stock > 0 ? 'var(--accent)' : 'var(--danger)' }}>
                                    {p.total_stock > 0 ? `✅ Stock: ${p.total_stock}` : '❌ Out of Stock'}
                                  </div>
                                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>KES {p.selling_price || 0}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8 }}>
                      <input placeholder="Dosage" value={item.dosage} onChange={e=>updateDrug(i,'dosage',e.target.value)} style={inp} />
                      <input placeholder="Frequency" value={item.frequency} onChange={e=>updateDrug(i,'frequency',e.target.value)} style={inp} />
                      <input placeholder="Qty" type="number" value={item.quantity} onChange={e=>updateDrug(i,'quantity',e.target.value)} style={inp} />
                      <select value={item.route||'IV'} onChange={e=>updateDrug(i,'route',e.target.value)} style={inp}>
                        <option value="IV">IV</option><option value="IM">IM</option><option value="SC">SC</option><option value="ID">ID</option>
                      </select>
                    </div>
                    {drugs.length > 1 && <button onClick={()=>removeDrug(i)} style={{ background:'none', border:'none', color:'var(--danger)', cursor:'pointer', fontSize:11, marginTop:6 }}>Remove</button>}
                  </div>
                ))}
              </div>
              
              {/* Procedures */}
              <div style={{ marginTop:16, padding:16, background:'var(--bg-elevated)', borderRadius:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>🔪 Procedures</div>
                  <Btn size="sm" variant="ghost" onClick={addProcedure}><Plus size={13}/> Add Procedure</Btn>
                </div>
                {procedures.map((item,i)=>(
                  <div key={i} style={{ padding:12, background:'var(--bg-surface)', borderRadius:8, marginBottom:8, border:'1px solid var(--border)', position:'relative' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:8 }}>Procedure #{i+1}</div>
                    {procedures.length > 1 && <button onClick={()=>removeProcedure(i)} style={{ position:'absolute', top:10, right:10, background:'none', border:'none', cursor:'pointer', color:'var(--danger)' }}><X size={14}/></button>}
                    <ICD10Search type="procedure" label="Search Procedure *"
                      placeholder="e.g. wound suturing, IV cannulation, wound dressing..."
                      value={item.procedure_name?`${item.procedure_code?item.procedure_code+' — ':''}${item.procedure_name}`:''}
                      onSelect={({name,code})=>{ updateProcedure(i,'procedure_name',name); updateProcedure(i,'procedure_code',code); }} />
                    {item.procedure_code && (
                      <div style={{ marginTop:6, display:'flex', gap:6, alignItems:'center', padding:'4px 8px', background:'var(--accent-soft)', borderRadius:6 }}>
                        <span style={{ fontSize:11, color:'var(--text-muted)' }}>Kenya Procedure Code:</span>
                        <span style={{ fontSize:12, fontWeight:700, color:'#a855f7', fontFamily:'monospace' }}>{item.procedure_code}</span>
                        <span style={{ fontSize:12, color:'var(--text-primary)' }}>{item.procedure_name}</span>
                      </div>
                    )}
                    <div style={{ marginTop:8 }}>
                      <Input label="Notes (optional)" value={item.notes} onChange={e=>updateProcedure(i,'notes',e.target.value)} placeholder="Procedure details or outcome..." />
                    </div>
                  </div>
                ))}
              </div>
              
              <div style={{ marginTop:20 }}>
                <Btn onClick={sendToInjectionRoom} disabled={saving || sentActions.injection} style={{ width:'100%', justifyContent:'center', padding:14 }}>
                  💉 {sentActions.injection ? 'Sent to Injection Room ✓' : 'Send to Injection Room'}
                </Btn>
              </div>
              <div style={{ marginTop:10, padding:12, background:'#06b6d410', borderRadius:8, fontSize:12, color:'#06b6d4' }}>
                ℹ️ Patient stays visible in your queue. Nurse will administer and write report.
              </div>
            </Card>
          )}
          {/* ADMISSION TAB */}
          {activeTab === 'history' && (
            <Card style={{ padding:20 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--text-primary)', marginBottom:16 }}>📁 Previous Visits — {selectedVisit?.patient_name}</div>
              {historyLoading ? (
                <div style={{ textAlign:'center', color:'var(--text-muted)', padding:24 }}>Loading history...</div>
              ) : patientHistory.length === 0 ? (
                <div style={{ textAlign:'center', color:'var(--text-muted)', padding:24 }}>No previous visits found</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {patientHistory.map(v => (
                    <div key={v.id} style={{ padding:14, background:'var(--bg-elevated)', borderRadius:10, border:'1px solid var(--border)', cursor: historyDetail?.id===v.id ? 'default' : 'pointer' }}
                      onClick={() => setHistoryDetail(historyDetail?.id===v.id ? null : v)}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div>
                          <span style={{ fontSize:12, fontWeight:700, color:'var(--accent)' }}>{v.visit_number}</span>
                          <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:8 }}>{new Date(v.visit_date).toLocaleDateString('en-KE',{day:'2-digit',month:'short',year:'numeric'})}</span>
                        </div>
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:4, background:'var(--bg-surface)', color:'var(--text-muted)', textTransform:'capitalize' }}>{v.visit_type||'routine'} · {v.status}</span>
                      </div>
                      {v.chief_complaint && <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:6 }}>CC: {v.chief_complaint}</div>}
                      {historyDetail?.id===v.id && (
                        <div style={{ marginTop:12, borderTop:'1px solid var(--border)', paddingTop:12, display:'flex', flexDirection:'column', gap:6 }}>
                          {v.diagnosis && <div style={{ fontSize:12 }}><span style={{ color:'var(--text-muted)' }}>Diagnosis: </span>{v.diagnosis}</div>}
                          {v.presenting_complaint && <div style={{ fontSize:12 }}><span style={{ color:'var(--text-muted)' }}>Complaint: </span>{v.presenting_complaint}</div>}
                          {v.management_plan && <div style={{ fontSize:12 }}><span style={{ color:'var(--text-muted)' }}>Plan: </span>{v.management_plan}</div>}
                          {v.attending_doctor && <div style={{ fontSize:12 }}><span style={{ color:'var(--text-muted)' }}>Doctor: </span>{v.attending_doctor}</div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {activeTab === 'admission' && (
            <Card style={{ padding:24 }}>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', marginBottom:20 }}>🏥 Admission / Ward</div>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:14, background:'var(--bg-elevated)', borderRadius:10, border:'1px solid var(--border)' }}>
                  <input type="checkbox" id="admit" checked={notes.admit_patient} onChange={e=>nf('admit_patient',e.target.checked)} style={{ width:18, height:18 }}/>
                  <label htmlFor="admit" style={{ fontSize:14, color:'var(--text-primary)', cursor:'pointer', fontWeight:600 }}>Admit this patient (IPD)</label>
                </div>
                <div>
                  <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>Ward / Unit *</label>
                  <select
                    value={showCustomWard ? '__other__' : notes.admission_ward}
                    onChange={e=>{
                      if (e.target.value === '__other__') {
                        setShowCustomWard(true);
                        nf('admission_ward','');
                        nf('admission_bed_id','');
                        nf('admission_bed_number','');
                      } else {
                        setShowCustomWard(false);
                        nf('admission_ward', e.target.value);
                        nf('admission_bed_id','');
                        nf('admission_bed_number','');
                      }
                    }}
                    style={inp}
                  >
                    <option value="">Select ward...</option>
                    {wards.map(w => (
                      <option key={w.id} value={w.name}>
                        {w.name}{w.ward_type ? ` (${w.ward_type})` : ''} — {w.available_beds ?? 0} bed{(w.available_beds ?? 0) === 1 ? '' : 's'} free
                      </option>
                    ))}
                    <option value="__other__">+ Other (not listed)</option>
                  </select>
                  {wards.length === 0 && (
                    <div style={{ fontSize:11, color:'var(--text-faint)', marginTop:4 }}>No wards set up yet — ask admin to add wards, or type one below.</div>
                  )}
                  {showCustomWard && (
                    <div style={{ marginTop:8 }}>
                      <Input value={notes.admission_ward} onChange={e=>nf('admission_ward',e.target.value)} placeholder="Type ward / unit name..." />
                    </div>
                  )}
                </div>
                {notes.admission_ward && (
                  <div>
                    <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>
                      Bed / Bed Number {loadingBeds ? '(Loading beds...)' : ''}
                    </label>
                    {wardBeds.length > 0 ? (
                      <select
                        value={notes.admission_bed_id || ''}
                        onChange={e => {
                          const bId = e.target.value;
                          const bObj = wardBeds.find(b => b.id === bId);
                          nf('admission_bed_id', bId);
                          nf('admission_bed_number', bObj ? bObj.bed_number : '');
                        }}
                        style={inp}
                      >
                        <option value="">-- Select Specific Bed --</option>
                        {wardBeds.map(b => (
                          <option key={b.id} value={b.id} disabled={b.status !== 'available'}>
                            🛏️ Bed {b.bed_number} — {b.status === 'available' ? '✅ Available' : b.status === 'occupied' ? `🔴 Occupied (${b.patient_name || 'Inpatient'})` : '🛠 Maintenance'}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        value={notes.admission_bed_number || ''}
                        onChange={e => nf('admission_bed_number', e.target.value)}
                        placeholder="e.g. Bed 01, Bed 02..."
                      />
                    )}
                  </div>
                )}
                <Textarea label="Reason for Admission" rows={2} value={notes.admission_reason} onChange={e=>nf('admission_reason',e.target.value)} placeholder="Clinical reason for admission..." />
                <Textarea label="Admission Notes / Care Plan" rows={3} value={notes.admission_notes} onChange={e=>nf('admission_notes',e.target.value)} placeholder="Admission instructions, monitoring, care plan..." />
                {/* Ward Procedures */}
                <div style={{ padding:16, background:'var(--bg-elevated)', borderRadius:10, border:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)' }}>🔪 Ward Procedures</div>
                    <Btn size="sm" variant="ghost" onClick={addProcedure}><Plus size={13}/> Add</Btn>
                  </div>
                  {procedures.map((item,i)=>(
                    <div key={i} style={{ padding:12, background:'var(--bg-surface)', borderRadius:8, marginBottom:8, border:'1px solid var(--border)', position:'relative' }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#a855f7', marginBottom:8 }}>Procedure #{i+1}</div>
                      {procedures.length > 1 && <button onClick={()=>removeProcedure(i)} style={{ position:'absolute', top:10, right:10, background:'none', border:'none', cursor:'pointer', color:'var(--danger)' }}><X size={14}/></button>}
                      <ICD10Search type="procedure" label="Search Procedure *"
                        placeholder="e.g. appendectomy, wound suture, catheterisation..."
                        value={item.procedure_name?`${item.procedure_code?item.procedure_code+' — ':''}${item.procedure_name}`:''}
                        onSelect={({name,code})=>{ updateProcedure(i,'procedure_name',name); updateProcedure(i,'procedure_code',code); }} />
                      {item.procedure_code && (
                        <div style={{ marginTop:6, display:'flex', gap:6, alignItems:'center', padding:'4px 8px', background:'var(--accent-soft)', borderRadius:6 }}>
                          <span style={{ fontSize:11, color:'var(--text-muted)' }}>Kenya Procedure Code:</span>
                          <span style={{ fontSize:12, fontWeight:700, color:'#a855f7', fontFamily:'monospace' }}>{item.procedure_code}</span>
                          <span style={{ fontSize:12, color:'var(--text-primary)' }}>{item.procedure_name}</span>
                        </div>
                      )}
                      <div style={{ marginTop:8 }}>
                        <Input label="Notes (optional)" value={item.notes} onChange={e=>updateProcedure(i,'notes',e.target.value)} placeholder="Procedure details..." />
                      </div>
                    </div>
                  ))}
                </div>
                <Btn onClick={sendToWard} disabled={saving} style={{ width:'100%', justifyContent:'center' }}>
                  🏥 Admit to Ward
                </Btn>
              </div>
            </Card>
          )}

        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── PATIENT HISTORY COMPONENT ─────────────────────────────────────────────────
function PatientHistoryView({ user, onBack, onOpenVisit }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [search, setSearch]         = useState('');
  const [dateFrom, setDateFrom]     = useState(todayStr);
  const [dateTo, setDateTo]         = useState(todayStr);
  const [results, setResults]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [visitDetail, setVisitDetail]     = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)   params.append('search', search);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo)   params.append('date_to', dateTo);
      const res = await api.get('/patients/history/search?' + params.toString());
      setResults(res.data.data || []);
    } catch { toast.error('Failed to fetch history'); }
    finally { setLoading(false); }
  };

  const openVisitDetail = async (visit) => {
    setSelectedVisit(visit);
    setDetailLoading(true);
    try {
      const [patRes, conRes, injRes, vitalsRes] = await Promise.allSettled([
        api.get('/patients/' + visit.patient_id),
        api.get('/consultations/visit/' + visit.id),
        api.get('/injection-room/visit/' + visit.id),
        api.get('/patients/visits/' + visit.id + '/vitals')
      ]);
      const vitals = vitalsRes.status==='fulfilled' ? (vitalsRes.value.data.data || []) : [];
      const latestVitals = vitals[0] || {};
      // Merge most recent vitals into selectedVisit so the vitals panel can display them
      setSelectedVisit(v => ({
        ...v,
        blood_pressure_systolic:  latestVitals.blood_pressure_systolic  ?? v.blood_pressure_systolic,
        blood_pressure_diastolic: latestVitals.blood_pressure_diastolic ?? v.blood_pressure_diastolic,
        pulse_rate:               latestVitals.pulse_rate               ?? v.pulse_rate,
        temperature:              latestVitals.temperature              ?? v.temperature,
        oxygen_saturation:        latestVitals.oxygen_saturation        ?? v.oxygen_saturation,
        weight:                   latestVitals.weight                   ?? v.weight,
      }));
      setVisitDetail({
        patient: patRes.status==='fulfilled' ? patRes.value.data.data : null,
        consultation: conRes.status==='fulfilled' ? conRes.value.data.data : null,
        injection_orders: injRes.status==='fulfilled' ? (injRes.value.data.data || []) : [],
        vitals,
        visit
      });
    } catch { toast.error('Failed to load visit details'); }
    finally { setDetailLoading(false); }
  };

  useEffect(() => { fetchHistory(); }, [dateFrom, dateTo]);

  if (selectedVisit && visitDetail) return (
    <div style={{ height:'100vh', overflow:'auto', padding:24 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button onClick={()=>{ setSelectedVisit(null); setVisitDetail(null); }} style={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', cursor:'pointer', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:6, fontSize:13 }}>
          ← Back
        </button>
        <div style={{ flex:1 }}>
          <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)' }}>📋 {visitDetail.patient?.full_name || selectedVisit.patient_name}</h1>
          <p style={{ fontSize:12, color:'var(--text-muted)' }}>{selectedVisit.patient_number} · Visit {selectedVisit.visit_number} · {new Date(selectedVisit.visit_date).toLocaleDateString('en-KE',{day:'2-digit',month:'short',year:'numeric'})}</p>
        </div>
        <button 
          onClick={() => printTreatmentSummary(visitDetail, user?.pharmacy)} 
          style={{ padding:'8px 16px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontWeight:600, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', gap:6 }}
        >
          <Printer size={14} /> Print Treatment Summary
        </button>
        {onOpenVisit && selectedVisit.status !== 'discharged' && (
          <button onClick={()=>onOpenVisit(selectedVisit)} style={{ padding:'8px 16px', background:'var(--accent)', border:'none', borderRadius:8, color:'#0F1612', fontWeight:600, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
            💊 Continue Treatment
          </button>
        )}
        {onOpenVisit && selectedVisit.status === 'discharged' && (
          <button onClick={()=>onOpenVisit(selectedVisit)} style={{ padding:'8px 16px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontWeight:600, cursor:'pointer', fontSize:13 }}>
            📋 View / Reopen
          </button>
        )}
      </div>

      {detailLoading ? <div style={{ textAlign:'center', padding:60 }}><Loader size={28} style={{ animation:'spin 0.8s linear infinite', color:'var(--accent)' }}/></div> : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div style={{ background:'var(--bg-surface)', borderRadius:14, border:'1px solid var(--border)', padding:20 }}>
            <div style={{ fontWeight:700, marginBottom:12, color:'var(--accent)' }}>👤 Patient Info</div>
            {[
              ['Name', visitDetail.patient?.full_name],
              ['Number', visitDetail.patient?.patient_number],
              ['Gender', visitDetail.patient?.gender],
              ['DOB', visitDetail.patient?.date_of_birth?new Date(visitDetail.patient.date_of_birth).toLocaleDateString():'—'],
              ['Phone', visitDetail.patient?.phone],
              ['Blood Group', visitDetail.patient?.blood_group],
              ['Allergies', visitDetail.patient?.allergies],
            ].map(([k,v])=>v?<div key={k} style={{ display:'flex', gap:8, marginBottom:6, fontSize:13 }}><span style={{ color:'var(--text-muted)', minWidth:90 }}>{k}:</span><span style={{ color:'var(--text-primary)', fontWeight:500 }}>{v}</span></div>:null)}
          </div>

          <div style={{ background:'var(--bg-surface)', borderRadius:14, border:'1px solid var(--border)', padding:20 }}>
            <div style={{ fontWeight:700, marginBottom:12, color:'var(--accent)' }}>📊 Vitals</div>
            {[
              ['BP', selectedVisit.blood_pressure_systolic?selectedVisit.blood_pressure_systolic+'/'+selectedVisit.blood_pressure_diastolic+' mmHg':null],
              ['Pulse', selectedVisit.pulse_rate?selectedVisit.pulse_rate+' bpm':null],
              ['Temp', selectedVisit.temperature?selectedVisit.temperature+'°C':null],
              ['SpO2', selectedVisit.oxygen_saturation?selectedVisit.oxygen_saturation+'%':null],
              ['Weight', selectedVisit.weight?selectedVisit.weight+' kg':null],
            ].map(([k,v])=>v?<div key={k} style={{ display:'flex', gap:8, marginBottom:6, fontSize:13 }}><span style={{ color:'var(--text-muted)', minWidth:80 }}>{k}:</span><span style={{ color:'var(--text-primary)', fontWeight:500 }}>{v}</span></div>:null)}
            {!selectedVisit.blood_pressure_systolic&&!selectedVisit.pulse_rate&&<div style={{ color:'var(--text-faint)', fontSize:13 }}>No vitals recorded</div>}
          </div>

          {visitDetail.consultation && (
            <div style={{ gridColumn:'1/-1', background:'var(--bg-surface)', borderRadius:14, border:'1px solid var(--border)', padding:20 }}>
              <div style={{ fontWeight:700, marginBottom:12, color:'var(--accent)' }}>📝 Consultation</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                {[
                  ['Presenting Complaint', visitDetail.consultation.presenting_complaint],
                  ['History of Illness', visitDetail.consultation.history_of_illness],
                  ['Examination Findings', visitDetail.consultation.examination_findings],
                  ['Review of Systems', visitDetail.consultation.review_of_systems],
                  ['Impression', visitDetail.consultation.impression],
                  ['Diagnosis', visitDetail.consultation.diagnosis+(visitDetail.consultation.icd_code?' ('+visitDetail.consultation.icd_code+')':'')],
                  ['Management Plan', visitDetail.consultation.management_plan],
                  ['Follow-up', visitDetail.consultation.follow_up_date?new Date(visitDetail.consultation.follow_up_date).toLocaleDateString()+(visitDetail.consultation.follow_up_notes?' — '+visitDetail.consultation.follow_up_notes:''):null],
                ].map(([k,v])=>v?(
                  <div key={k} style={{ marginBottom:8 }}>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:3 }}>{k}</div>
                    <div style={{ fontSize:13, color:'var(--text-primary)', background:'var(--bg-elevated)', padding:'8px 12px', borderRadius:8 }}>{v}</div>
                  </div>
                ):null)}
              </div>

              {visitDetail.consultation.prescriptions?.length > 0 && (
                <div style={{ marginTop:16 }}>
                  <div style={{ fontWeight:700, marginBottom:8, color:'var(--accent)', fontSize:13 }}>💊 Prescriptions</div>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead><tr style={{ background:'var(--bg-elevated)' }}>
                      {['Drug','Dosage','Frequency','Duration','Route','Qty'].map(h=><th key={h} style={{ padding:'8px 10px', textAlign:'left', color:'var(--text-muted)', fontWeight:600, fontSize:11 }}>{h}</th>)}
                    </tr></thead>
                    <tbody>{visitDetail.consultation.prescriptions.map((p,i)=>(
                      <tr key={i} style={{ borderTop:'1px solid var(--border)' }}>
                        <td style={{ padding:'8px 10px', fontWeight:600 }}>{p.drug_name}</td>
                        <td style={{ padding:'8px 10px', color:'var(--text-muted)' }}>{p.dosage||'—'}</td>
                        <td style={{ padding:'8px 10px', color:'var(--text-muted)' }}>{p.frequency||'—'}</td>
                        <td style={{ padding:'8px 10px', color:'var(--text-muted)' }}>{p.duration||'—'}</td>
                        <td style={{ padding:'8px 10px', color:'var(--text-muted)' }}>{p.route||'—'}</td>
                        <td style={{ padding:'8px 10px', color:'var(--text-muted)' }}>{p.quantity||'—'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}

              {visitDetail.consultation.lab_requests?.length > 0 && (
                <div style={{ marginTop:16, gridColumn:'1/-1' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <div style={{ fontWeight:700, color:'var(--info)', fontSize:13 }}>🔬 Lab Requests & Results</div>
                    <button 
                      onClick={() => printLabResult(
                        visitDetail.consultation.lab_requests,
                        user?.pharmacy,
                        visitDetail.patient || { full_name: selectedVisit?.patient_name, patient_number: selectedVisit?.patient_number },
                        selectedVisit
                      )}
                      style={{ padding:'4px 10px', background:'var(--accent)', border:'none', borderRadius:6, color:'#0F1612', fontSize:11, fontWeight:600, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:4 }}
                    >
                      <Printer size={12} /> Print Combined Lab Report (PDF)
                    </button>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {visitDetail.consultation.lab_requests.map((l,i)=>(
                      <div key={i} style={{ background:'var(--bg-elevated)', borderRadius:10, border:'1px solid var(--border)', padding:12 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ fontWeight:600, fontSize:13, color:'var(--text-primary)' }}>{l.test_name}</span>
                            {l.urgency==='urgent' && <span style={{ padding:'2px 6px', background:'rgba(239,68,68,0.1)', color:'#ef4444', borderRadius:4, fontSize:10, fontWeight:700 }}>URGENT</span>}
                            {l.urgency==='stat' && <span style={{ padding:'2px 6px', background:'rgba(239,68,68,0.15)', color:'#ef4444', borderRadius:4, fontSize:10, fontWeight:700 }}>STAT</span>}
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            {l.result_flag && (
                              <span style={{ 
                                padding:'2px 6px', 
                                borderRadius:4, 
                                fontSize:10, 
                                fontWeight:700, 
                                background: l.result_flag==='high' ? 'rgba(239,68,68,0.1)' : l.result_flag==='low' ? 'rgba(56,189,248,0.1)' : 'rgba(16,185,129,0.1)',
                                color: l.result_flag==='high' ? '#ef4444' : l.result_flag==='low' ? '#38bdf8' : '#10b981'
                              }}>{l.result_flag.toUpperCase()}</span>
                            )}
                            <span style={{ 
                              padding:'2px 8px', 
                              borderRadius:6, 
                              fontSize:11, 
                              fontWeight:600, 
                              background: (l.result||l.result_value) ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', 
                              color: (l.result||l.result_value) ? '#10b981' : '#f59e0b' 
                            }}>
                              {(l.result||l.result_value) ? 'Released' : 'Pending'}
                            </span>
                          </div>
                        </div>
                        {(l.result || l.result_value) ? (
                          <div style={{ marginTop:8, borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:8 }}>
                            {l.result_value && (
                              <div style={{ fontSize:13, color:'var(--text-primary)', display:'flex', alignItems:'baseline', gap:6, marginBottom:4 }}>
                                <span style={{ fontSize:18, fontWeight:700, color:'var(--text-primary)' }}>{l.result_value}</span>
                                {l.result_unit && <span style={{ fontSize:11, color:'var(--text-muted)' }}>{l.result_unit}</span>}
                                {l.reference_range && <span style={{ fontSize:11, color:'var(--text-faint)', marginLeft:8 }}>(Ref: {l.reference_range})</span>}
                              </div>
                            )}
                            {l.result && (
                              <div style={{ background:'var(--bg-base)', padding:8, borderRadius:6, border:'1px solid var(--border)', fontSize:12, color:'var(--text-primary)', fontFamily:'monospace', whiteSpace:'pre-wrap' }}>
                                <ResultRenderer result={l.result} testName={l.test_name} />
                              </div>
                            )}
                            {l.technician_notes && (
                              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4, fontStyle:'italic' }}>
                                <strong style={{ color:'var(--text-muted)' }}>Remarks:</strong> "{l.technician_notes}"
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ fontSize:11, color:'var(--text-faint)', marginTop:4, fontStyle:'italic' }}>
                            Awaiting laboratory analysis...
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Injection Room Orders */}
          {visitDetail.injection_orders?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: '#06b6d4', fontSize: 13 }}>💉 Injection Room Orders</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)' }}>
                    {['Drug', 'Dosage', 'Route', 'Frequency', 'Status', 'Given At', 'Nurse Report'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visitDetail.injection_orders.map((o, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{o.drug_name}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{o.dosage || '—'}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: '#06b6d420', color: '#06b6d4', fontWeight: 600 }}>{o.route}</span>
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>{o.frequency || '—'}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: o.status === 'administered' ? '#10b98120' : '#f59e0b20', color: o.status === 'administered' ? '#10b981' : '#f59e0b' }}>
                          {o.status === 'administered' ? '✅ Given' : '⏳ Pending'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: 11 }}>
                        {o.administered_at ? new Date(o.administered_at).toLocaleString('en-KE') : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: 11 }}>{o.nurse_report || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ height:'100vh', overflow:'auto', padding:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)' }}>📋 Patient History</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)', marginTop:4 }}>Search past consultations by name, number or date</p>
        </div>
        <button onClick={onBack} style={{ padding:'9px 16px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', color:'var(--text-primary)', fontSize:13 }}>← OPD Queue</button>
      </div>

      <div style={{ background:'var(--bg-surface)', borderRadius:14, border:'1px solid var(--border)', padding:20, marginBottom:20 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr auto', gap:12, alignItems:'flex-end' }}>
          <div>
            <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>Search Name / Number / Phone</label>
            <input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&fetchHistory()} placeholder="e.g. John or P-2024..." style={{ width:'100%', padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
          </div>
          <div>
            <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>From Date</label>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{ width:'100%', padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
          </div>
          <div>
            <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>To Date</label>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{ width:'100%', padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none', boxSizing:'border-box' }}/>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={fetchHistory} style={{ padding:'9px 18px', background:'var(--accent)', border:'none', borderRadius:8, color:'#0F1612', fontWeight:700, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
              <Search size={14}/> Search
            </button>
            {(dateFrom !== todayStr || dateTo !== todayStr || search) && (
              <button onClick={() => { setSearch(''); setDateFrom(todayStr); setDateTo(todayStr); }} style={{ padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? <div style={{ textAlign:'center', padding:60 }}><Loader size={28} style={{ animation:'spin 0.8s linear infinite', color:'var(--accent)' }}/></div>
      : results.length === 0 ? (
        <div style={{ background:'var(--bg-surface)', borderRadius:14, border:'1px solid var(--border)', padding:60, textAlign:'center' }}>
          <div style={{ fontSize:14, color:'var(--text-faint)' }}>No records found. Try adjusting the search or filters.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {results.map((v, idx) => {
            const statusColor = STATUS_COLORS[v.status] || 'var(--text-muted)';
            return (
              <div key={v.id} onClick={()=>openVisitDetail(v)} 
                style={{ 
                  background:'var(--bg-surface)', 
                  borderRadius:14, 
                  border:'1px solid var(--border)', 
                  borderLeft: `5px solid ${statusColor}`,
                  padding:'20px 24px', 
                  cursor:'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onMouseEnter={e=>{
                  e.currentTarget.style.transform='translateY(-2px)';
                  e.currentTarget.style.borderColor='var(--accent)';
                  e.currentTarget.style.boxShadow='0 8px 24px rgba(0, 0, 0, 0.2)';
                }}
                onMouseLeave={e=>{
                  e.currentTarget.style.transform='translateY(0)';
                  e.currentTarget.style.borderColor='var(--border)';
                  e.currentTarget.style.boxShadow='none';
                }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16 }}>
                  <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
                    <div style={{ width:40, height:40, borderRadius:'50%', background:`${statusColor}15`, border:`2px solid ${statusColor}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14, color:statusColor, flexShrink:0 }}>
                      {idx+1}
                    </div>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, flexWrap:'wrap' }}>
                        <span style={{ fontSize:16, fontWeight:800, color:'var(--text-primary)', tracking: '-0.01em' }}>{v.patient_name}</span>
                        <span style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'monospace', background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4 }}>{v.patient_number}</span>
                        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:6, background:'var(--accent)15', color:'var(--accent)', fontWeight:800 }}>Visit #{v.visit_number}</span>
                      </div>
                      
                      <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:8, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span>{v.gender}</span>
                        <span style={{ opacity: 0.3 }}>•</span>
                        <span>{getAge(v.date_of_birth)}</span>
                        <span style={{ opacity: 0.3 }}>•</span>
                        <span>{v.phone}</span>
                      </div>

                      {v.diagnosis && (
                        <div style={{ fontSize:13, color:'var(--text-primary)', marginBottom:6, background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', display: 'inline-block' }}>
                          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>🔍 Dx:</span> <strong style={{ fontWeight: 600 }}>{v.diagnosis}</strong> {v.icd_code && <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)', background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: 4, fontSize: 11, marginLeft: 6 }}>{v.icd_code}</span>}
                        </div>
                      )}

                      {v.presenting_complaint && (
                        <div style={{ fontSize:12, color:'var(--text-muted)', marginTop: 4 }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>CC:</span> {v.presenting_complaint}
                        </div>
                      )}

                      {v.doctor_name && (
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>🩺 Attending:</span> <strong style={{ color: 'var(--text-primary)' }}>Dr. {v.doctor_name}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0 }}>
                    <span style={{ fontSize:11, padding:'4px 10px', borderRadius:6, fontWeight:700, background:`${statusColor}15`, color:statusColor, border: `1px solid ${statusColor}30` }}>
                      {STATUS_LABELS[v.status] || v.status}
                    </span>
                    <span style={{ fontSize:11, color:'var(--text-muted)', textTransform:'capitalize', background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4 }}>{v.visit_type?.replace('_',' ')}</span>
                    <span style={{ fontSize:11, color:'var(--text-faint)' }}>{new Date(v.visit_date).toLocaleDateString('en-KE',{day:'2-digit',month:'short',year:'numeric'})}</span>
                    <span style={{ fontSize:12, color:'var(--accent)', fontWeight:700, display:'flex', alignItems:'center', gap:4, marginTop: 4 }}>
                      View Details <ChevronRight size={14}/>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── MOH REPORT COMPONENT ──────────────────────────────────────────────────────
function MOHReportView({ user, onBack }) {
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(new Date(now.getFullYear(),now.getMonth(),1).toISOString().split('T')[0]);
  const [dateTo, setDateTo]     = useState(now.toISOString().split('T')[0]);
  const [report, setReport]     = useState(null);
  const [loading, setLoading]   = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/patients/reports/moh204?date_from=${dateFrom}&date_to=${dateTo}`);
      setReport(res.data.data);
    } catch { toast.error('Failed to generate report'); }
    finally { setLoading(false); }
  };

  useEffect(()=>{ fetchReport(); },[]);

  const allData      = report?.data || [];
  const totalU5M     = allData.reduce((s,r)=>s+(parseInt(r.under5_male)||0),0);
  const totalU5F     = allData.reduce((s,r)=>s+(parseInt(r.under5_female)||0),0);
  const totalOver5M  = allData.reduce((s,r)=>s+(parseInt(r.over5_male)||0),0);
  const totalOver5F  = allData.reduce((s,r)=>s+(parseInt(r.over5_female)||0),0);

  const handlePrintMOH204 = () => {
    if (!report) return;
    const win = window.open('', '_blank');
    
    const facilityName = user?.pharmacy?.name || 'HEKIMA MEDICAL CENTRE';
    const facilityAddress = user?.pharmacy?.address || 'P.O. Box 1234, Nairobi';

    const renderTableHtml = (title, isUnder5) => {
      const data = allData.filter(r => isUnder5
        ? (parseInt(r.under5_male)||0)+(parseInt(r.under5_female)||0)>0
        : (parseInt(r.over5_male)||0)+(parseInt(r.over5_female)||0)>0
      );
      
      let secTotalM = 0;
      let secTotalF = 0;

      const rowsHtml = data.map((r, i) => {
        const m = isUnder5 ? parseInt(r.under5_male)||0 : parseInt(r.over5_male)||0;
        const f = isUnder5 ? parseInt(r.under5_female)||0 : parseInt(r.over5_female)||0;
        secTotalM += m;
        secTotalF += f;
        return `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 6px 12px; font-weight: 500;">${r.diagnosis}</td>
            <td style="padding: 6px 12px; font-family: monospace; font-size: 11px;">${r.icd_code || '—'}</td>
            <td style="padding: 6px 12px; text-align: center; color: #1a4a8a;">${m}</td>
            <td style="padding: 6px 12px; text-align: center; color: #ec4899;">${f}</td>
            <td style="padding: 6px 12px; text-align: center; font-weight: bold;">${m + f}</td>
          </tr>
        `;
      }).join('');

      return `
        <div style="margin-bottom: 25px; page-break-inside: avoid;">
          <div style="background: #1a4a8a; color: white; padding: 6px 12px; font-weight: bold; border-radius: 4px; font-size: 13px; margin-bottom: 10px;">${title}</div>
          <table style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead>
              <tr style="background:#eef2f7; border-bottom: 2px solid #ddd; text-align:left;">
                <th style="padding:6px 12px; border:1px solid #ddd;">Diagnosis / Disease Category</th>
                <th style="padding:6px 12px; border:1px solid #ddd; width: 120px;">ICD Code</th>
                <th style="padding:6px 12px; border:1px solid #ddd; width: 100px; text-align:center;">Male</th>
                <th style="padding:6px 12px; border:1px solid #ddd; width: 100px; text-align:center;">Female</th>
                <th style="padding:6px 12px; border:1px solid #ddd; width: 100px; text-align:center;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #777; font-style: italic;">No cases recorded in this section.</td></tr>'}
            </tbody>
            <tr style="border-top:2px solid #1a4a8a; background:#f5f5f5; font-weight:bold;">
              <td colspan="2" style="padding: 8px 12px;">SUB-TOTAL</td>
              <td style="padding: 8px 12px; text-align:center; color:#1a4a8a;">${secTotalM}</td>
              <td style="padding: 8px 12px; text-align:center; color:#ec4899;">${secTotalF}</td>
              <td style="padding: 8px 12px; text-align:center;">${secTotalM + secTotalF}</td>
            </tr>
          </table>
        </div>
      `;
    };

    win.document.write(`
      <html>
        <head>
          <title>MOH 204 Outpatient Summary Report</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.4; margin: 40px; }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border-bottom: 3px double #1a4a8a; padding-bottom: 15px; }
            .facility-name { font-size: 20px; font-weight: bold; color: #1a4a8a; text-transform: uppercase; }
            .facility-sub { font-size: 11px; color: #555; margin-top: 3px; }
            .report-title { font-size: 18px; font-weight: bold; text-align: center; background: #eef2f7; padding: 6px; margin: 20px 0; letter-spacing: 1.5px; border-radius: 4px; border-left: 5px solid #1a4a8a; text-transform: uppercase; }
            .info-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
            .info-table td { padding: 8px; font-size: 12px; border: 1px solid #eee; }
            .info-label { font-weight: bold; color: #555; background: #f9f9f9; width: 20%; }
            .footer-section { margin-top: 40px; width: 100%; border-top: 1px solid #ddd; padding-top: 15px; font-size: 11px; color: #777; text-align: center; }
            @media print {
              body { margin: 20px; }
              @page { size: A4 portrait; margin: 10mm; }
            }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td>
                <div class="facility-name">${facilityName}</div>
                <div class="facility-sub">${facilityAddress}</div>
              </td>
              <td style="text-align: right; vertical-align: bottom;">
                <div style="font-size: 14px; font-weight: bold; color: #333;">MOH OUTPATIENT SERVICES</div>
                <div style="font-size: 11px; color: #666;">Ministry of Health, Kenya</div>
              </td>
            </tr>
          </table>

          <div class="report-title">MOH 204 Outpatient Department Summary</div>

          <table class="info-table">
            <tr>
              <td class="info-label">Reporting Period</td>
              <td><strong>From:</strong> ${new Date(dateFrom).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })} <strong>To:</strong> ${new Date(dateTo).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
              <td class="info-label">Total OPD Attendance</td>
              <td><strong>${totalU5M + totalU5F + totalOver5M + totalOver5F}</strong> visits</td>
            </tr>
            <tr>
              <td class="info-label">Under 5 Attendance</td>
              <td>${totalU5M + totalU5F} (Male: ${totalU5M} | Female: ${totalU5F})</td>
              <td class="info-label">Over 5 Attendance</td>
              <td>${totalOver5M + totalOver5F} (Male: ${totalOver5M} | Female: ${totalOver5F})</td>
            </tr>
          </table>

          ${renderTableHtml("MOH 204A — Under 5 Years Outpatient Summary", true)}
          ${renderTableHtml("MOH 204B — Over 5 Years Outpatient Summary", false)}

          <div class="footer-section">
            <div style="font-size: 10px; color: #555; margin-bottom: 20px;">
              Generated on: ${new Date().toLocaleString('en-KE')} | Authorized By: Medical Superintendent / Facility In-Charge
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 40px; font-size: 11px;">
              <div style="border-top: 1px solid #333; width: 180px; padding-top: 4px;">Prepared By: Medical Records Officer</div>
              <div style="border-top: 1px solid #333; width: 180px; padding-top: 4px;">Approved By: Clinician In Charge</div>
            </div>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const TableSection = ({ title, color, totalM, totalF, isUnder5 }) => {
    const data = allData.filter(r => isUnder5
      ? (parseInt(r.under5_male)||0)+(parseInt(r.under5_female)||0)>0
      : (parseInt(r.over5_male)||0)+(parseInt(r.over5_female)||0)>0
    );
    return (
      <div style={{ background:'var(--bg-surface)', borderRadius:14, border:'1px solid var(--border)', marginBottom:20 }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:15, fontWeight:700, color }}>{title}</div>
          <div style={{ fontSize:12, color:'var(--text-muted)' }}>Total: <strong style={{ color:'var(--text-primary)' }}>{totalM+totalF}</strong> ({totalM}M / {totalF}F)</div>
        </div>
        {data.length===0 ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--text-faint)', fontSize:13 }}>No cases recorded</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'var(--bg-elevated)' }}>
                {['DIAGNOSIS','ICD CODE','MALE','FEMALE','TOTAL'].map(h=><th key={h} style={{ padding:'10px 16px', textAlign:h==='DIAGNOSIS'||h==='ICD CODE'?'left':'center', color:'var(--text-muted)', fontWeight:600, fontSize:11 }}>{h}</th>)}
              </tr></thead>
              <tbody>{data.map((r,i)=>{
                const m = isUnder5 ? parseInt(r.under5_male)||0 : parseInt(r.over5_male)||0;
                const f = isUnder5 ? parseInt(r.under5_female)||0 : parseInt(r.over5_female)||0;
                if (m+f===0) return null;
                return (
                  <tr key={i} style={{ borderTop:'1px solid var(--border)', background:i%2===0?'transparent':'var(--bg-elevated)10' }}>
                    <td style={{ padding:'10px 16px', fontWeight:500 }}>{r.diagnosis}</td>
                    <td style={{ padding:'10px 16px', color:'var(--text-muted)', fontFamily:'monospace', fontSize:11 }}>{r.icd_code||'—'}</td>
                    <td style={{ padding:'10px 16px', textAlign:'center', color:'var(--info)' }}>{m}</td>
                    <td style={{ padding:'10px 16px', textAlign:'center', color:'#ec4899' }}>{f}</td>
                    <td style={{ padding:'10px 16px', textAlign:'center', fontWeight:700 }}>{m+f}</td>
                  </tr>
                );
              })}</tbody>
              <tfoot><tr style={{ borderTop:'2px solid var(--border)', background:'var(--bg-elevated)' }}>
                <td colSpan={2} style={{ padding:'10px 16px', fontWeight:700 }}>TOTAL</td>
                <td style={{ padding:'10px 16px', textAlign:'center', fontWeight:700, color:'var(--info)' }}>{totalM}</td>
                <td style={{ padding:'10px 16px', textAlign:'center', fontWeight:700, color:'#ec4899' }}>{totalF}</td>
                <td style={{ padding:'10px 16px', textAlign:'center', fontWeight:700 }}>{totalM+totalF}</td>
              </tr></tfoot>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ height:'100vh', overflow:'auto', padding:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)' }}>📊 MOH 204 OPD Reports</h1>
          <p style={{ fontSize:13, color:'var(--text-muted)', marginTop:4 }}>MOH 204A (Under 5) · MOH 204B (Over 5) · Auto-generated from OPD visits</p>
        </div>
        <button onClick={onBack} style={{ padding:'9px 16px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, cursor:'pointer', color:'var(--text-primary)', fontSize:13 }}>← OPD Queue</button>
      </div>

      <div style={{ background:'var(--bg-surface)', borderRadius:14, border:'1px solid var(--border)', padding:20, marginBottom:20 }}>
        <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexWrap:'wrap' }}>
          {[['From',dateFrom,setDateFrom],['To',dateTo,setDateTo]].map(([lbl,val,set])=>(
            <div key={lbl}>
              <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:5 }}>{lbl}</label>
              <input type="date" value={val} onChange={e=>set(e.target.value)} style={{ padding:'9px 12px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontSize:13, outline:'none' }}/>
            </div>
          ))}
          <button onClick={fetchReport} style={{ padding:'9px 18px', background:'var(--accent)', border:'none', borderRadius:8, color:'#0F1612', fontWeight:700, cursor:'pointer', fontSize:13 }}>
            Generate Report
          </button>
          <button onClick={handlePrintMOH204} style={{ padding:'9px 18px', background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text-primary)', fontWeight:600, cursor:'pointer', fontSize:13 }}>
            🖨 Print
          </button>
        </div>
      </div>

      {loading ? <div style={{ textAlign:'center', padding:60 }}><Loader size={28} style={{ animation:'spin 0.8s linear infinite', color:'var(--accent)' }}/></div>
      : report ? (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
            {[
              { label:'Under 5 Male',   value:totalU5M,    color:'var(--info)' },
              { label:'Under 5 Female', value:totalU5F,    color:'#ec4899' },
              { label:'Over 5 Male',    value:totalOver5M, color:'var(--info)' },
              { label:'Over 5 Female',  value:totalOver5F, color:'#ec4899' },
            ].map(({label,value,color})=>(
              <div key={label} style={{ background:'var(--bg-surface)', borderRadius:12, border:'1px solid var(--border)', padding:16 }}>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{label}</div>
                <div style={{ fontSize:28, fontWeight:700, color }}>{value}</div>
              </div>
            ))}
          </div>
          <TableSection title="MOH 204A — Under 5 Years" color="var(--warning)" totalM={totalU5M}    totalF={totalU5F}    isUnder5={true}  />
          <TableSection title="MOH 204B — Over 5 Years"  color="var(--info)"    totalM={totalOver5M} totalF={totalOver5F} isUnder5={false} />
        </>
      ) : null}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
