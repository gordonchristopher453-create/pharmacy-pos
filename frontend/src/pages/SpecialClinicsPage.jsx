import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api';
import toast from 'react-hot-toast';
import ClinicalTimeline from '../components/ClinicalTimeline';
import ICD10Search from '../components/ICD10Search';
import {
  Stethoscope, Activity, Users, Calendar, FileText, Settings, Plus,
  Search, RefreshCw, CheckCircle, Clock, ChevronRight, UserPlus,
  ArrowRightLeft, AlertCircle, DollarSign, ShieldAlert, Heart,
  Building, Filter, Phone, Eye, Play, Pause, Check, Award,
  FlaskConical, Pill, Radio, Syringe, Bed, Send, Trash2
} from 'lucide-react';

const Card = ({ children, className = '', style = {} }) => (
  <div style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)', ...style }} className={className}>
    {children}
  </div>
);

const Btn = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center gap-1.5 font-semibold transition-all rounded-xl border ${
      size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2.5 text-xs'
    } ${
      variant === 'primary'
        ? 'bg-[var(--accent)] border-transparent text-[#0F1612] hover:opacity-90'
        : variant === 'secondary'
        ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20'
        : variant === 'danger'
        ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
        : 'bg-[var(--bg-elevated)] border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--accent)]'
    } ${className}`}
  >
    {children}
  </button>
);

const STATUS_BADGES = {
  WAITING: { label: '⏳ Waiting', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  CALLED: { label: '📢 Called', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  IN_CONSULTATION: { label: '🩺 In Consultation', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  PAUSED: { label: '⏸ Paused', bg: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  REFERRED: { label: '🔄 Referred', bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },
  COMPLETED: { label: '✅ Completed', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' }
};

const EMPTY_DRUG = { drug_name: '', dosage: '', frequency: '', duration: '', route: 'oral', instructions: '', quantity: 1, selling_price: 0, product_id: null };
const EMPTY_TEST = { test_name: '', test_code: '', urgency: 'routine', notes: '' };
const EMPTY_PROCEDURE = { procedure_name: '', procedure_code: '', notes: '', outcome: '' };

export default function SpecialClinicsPage() {
  const { user } = useSelector(s => s.auth);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [clinics, setClinics] = useState([]);
  const [selectedClinic, setSelectedClinic] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // Stats & Queue
  const [stats, setStats] = useState({});
  const [queue, setQueue] = useState([]);
  const [queueFilter, setQueueFilter] = useState('WAITING');
  const [searchTerm, setSearchTerm] = useState('');

  // Active patient for consultation
  const [activeQueueItem, setActiveQueueItem] = useState(null);
  const [patientHistory, setPatientHistory] = useState([]);

  // Specialist Desk Sub-tabs & Form States
  const [consultSubTab, setConsultSubTab] = useState('notes'); // 'notes'|'labs'|'rx'|'radiology'|'injection'|'ward'|'referral'
  const [consultNotes, setConsultNotes] = useState({
    presenting_complaint: '', history_of_illness: '', examination_findings: '',
    impression: '', management_plan: '', doctor_notes: '', nurse_instructions: ''
  });
  const [icdDiagnosis, setIcdDiagnosis] = useState([]);
  const [drugs, setDrugs] = useState([{ ...EMPTY_DRUG }]);
  const [tests, setTests] = useState([{ ...EMPTY_TEST }]);
  const [procedures, setProcedures] = useState([{ ...EMPTY_PROCEDURE }]);
  const [radiologyOrders, setRadiologyOrders] = useState([]);
  const [wardAdmission, setWardAdmission] = useState({
    admit: false, ward: 'General Ward', reason: '', notes: ''
  });
  const [savingConsult, setSavingConsult] = useState(false);

  // Pharmacy catalog search state
  const [productSearchResults, setProductSearchResults] = useState([]);
  const [activeDrugIndex, setActiveDrugIndex] = useState(null);

  // Inter-Clinic Referral Modal
  const [showReferModal, setShowReferModal] = useState(false);
  const [referTargetClinic, setReferTargetClinic] = useState('');
  const [referReason, setReferReason] = useState('');
  const [referUrgency, setReferUrgency] = useState('ROUTINE');
  const [referring, setReferring] = useState(false);

  // Appointments
  const [appointments, setAppointments] = useState([]);
  const [showApptModal, setShowApptModal] = useState(false);

  // Services
  const [services, setServices] = useState([]);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [newService, setNewService] = useState({ service_name: '', service_code: '', fee: '', description: '' });

  // Admin / Create Clinic
  const [showCreateClinicModal, setShowCreateClinicModal] = useState(false);
  const [newClinic, setNewClinic] = useState({
    code: '', name: '', description: '', consultation_fee: 1000,
    working_days: 'Mon,Tue,Wed,Thu,Fri', appointment_duration: 30, location: 'Specialist Wing'
  });

  // Reports
  const [reportsData, setReportsData] = useState(null);

  // Clinic Doctors & Duty Assignment
  const [clinicDoctors, setClinicDoctors] = useState([]);
  const [availableDoctors, setAvailableDoctors] = useState([]);
  const [showAssignDoctorModal, setShowAssignDoctorModal] = useState(false);
  const [assignDoctorForm, setAssignDoctorForm] = useState({
    clinic_id: '',
    user_id: '',
    is_primary: false,
    staff_role: 'Specialist',
    assigned_room: '',
    doctor_type: 'staff',
    external_name: '',
    external_specialty: '',
    external_phone: '',
    external_email: ''
  });
  const [assigningDoctor, setAssigningDoctor] = useState(false);

  // Edit Clinic State
  const [editingClinic, setEditingClinic] = useState(null);
  const [showEditClinicModal, setShowEditClinicModal] = useState(false);

  useEffect(() => {
    fetchClinics();
  }, []);

  useEffect(() => {
    fetchDashboardStats();
    fetchQueue();
    fetchAppointments();
    fetchServices();
    fetchClinicDoctors();
    if (activeTab === 'admin') fetchAvailableDoctors();
    if (activeTab === 'reports') fetchReports();
  }, [selectedClinic, activeTab]);

  const fetchClinicDoctors = async () => {
    try {
      const selectedObj = clinics.find(c => c.code === selectedClinic);
      const url = selectedObj
        ? `/special-clinics/doctors?clinic_id=${selectedObj.id}`
        : '/special-clinics/doctors';
      const res = await api.get(url);
      setClinicDoctors(res.data?.data || []);
    } catch {}
  };

  const fetchAvailableDoctors = async () => {
    try {
      const res = await api.get('/special-clinics/available-doctors');
      setAvailableDoctors(res.data?.data || []);
    } catch {}
  };

  const handleAssignDoctor = async (e) => {
    e.preventDefault();
    if (!assignDoctorForm.clinic_id) {
      toast.error('Please select a target clinic');
      return;
    }
    if (assignDoctorForm.doctor_type === 'staff' && !assignDoctorForm.user_id) {
      toast.error('Please select a staff doctor');
      return;
    }
    if (assignDoctorForm.doctor_type === 'external' && !assignDoctorForm.external_name?.trim()) {
      toast.error('Please enter external doctor name');
      return;
    }
    setAssigningDoctor(true);
    try {
      await api.post('/special-clinics/doctors', assignDoctorForm);
      toast.success('✅ Doctor / Specialist assigned to clinic duty!');
      setShowAssignDoctorModal(false);
      setAssignDoctorForm({
        clinic_id: '',
        user_id: '',
        is_primary: false,
        staff_role: 'Specialist',
        assigned_room: '',
        doctor_type: 'staff',
        external_name: '',
        external_specialty: '',
        external_phone: '',
        external_email: ''
      });
      fetchClinicDoctors();
      fetchClinics();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to assign doctor');
    } finally {
      setAssigningDoctor(false);
    }
  };

  const handleRemoveDoctorAssignment = async (assignmentId) => {
    if (!window.confirm('Are you sure you want to unassign this specialist from clinic duty?')) return;
    try {
      await api.delete(`/special-clinics/doctors/${assignmentId}`);
      toast.success('Specialist unassigned from clinic duty');
      fetchClinicDoctors();
      fetchClinics();
    } catch (e) {
      toast.error('Failed to unassign doctor');
    }
  };

  const handleUpdateClinic = async (e) => {
    e.preventDefault();
    if (!editingClinic) return;
    try {
      await api.put(`/special-clinics/${editingClinic.id}`, editingClinic);
      toast.success('✅ Special clinic updated!');
      setShowEditClinicModal(false);
      setEditingClinic(null);
      fetchClinics();
    } catch (e) {
      toast.error('Failed to update clinic');
    }
  };

  const fetchClinics = async () => {
    try {
      const res = await api.get('/special-clinics?include_inactive=true');
      if (res.data?.data) {
        setClinics(res.data.data);
      }
    } catch (e) {
      toast.error('Failed to load clinics list');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const url = selectedClinic && selectedClinic !== 'ALL'
        ? `/special-clinics/stats?clinic_code=${selectedClinic}`
        : '/special-clinics/stats';
      const res = await api.get(url);
      setStats(res.data?.data || {});
    } catch {}
  };

  const fetchQueue = async () => {
    try {
      let url = '/special-clinics/queue';
      const params = [];
      if (selectedClinic && selectedClinic !== 'ALL') params.push(`clinic_code=${selectedClinic}`);
      if (queueFilter !== 'ALL') params.push(`status=${queueFilter}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const res = await api.get(url);
      setQueue(res.data?.data || []);
    } catch {}
  };

  const fetchAppointments = async () => {
    try {
      const selectedObj = clinics.find(c => c.code === selectedClinic);
      const url = selectedObj
        ? `/special-clinics/appointments?clinic_id=${selectedObj.id}`
        : '/special-clinics/appointments';
      const res = await api.get(url);
      setAppointments(res.data?.data || []);
    } catch {}
  };

  const fetchServices = async () => {
    try {
      const selectedObj = clinics.find(c => c.code === selectedClinic);
      const url = selectedObj
        ? `/special-clinics/services?clinic_id=${selectedObj.id}`
        : '/special-clinics/services';
      const res = await api.get(url);
      setServices(res.data?.data || []);
    } catch {}
  };

  const fetchReports = async () => {
    try {
      const res = await api.get('/special-clinics/reports');
      setReportsData(res.data?.data || null);
    } catch {}
  };

  const updateQueueStatus = async (queueId, status) => {
    try {
      await api.put(`/special-clinics/queue/${queueId}/status`, { status });
      fetchQueue();
      fetchDashboardStats();
    } catch (e) {
      console.error('Failed to update queue status:', e);
    }
  };

  const handleStartConsultation = async (qItem) => {
    setActiveQueueItem(qItem);
    setActiveTab('consultation');
    setConsultSubTab('notes');
    await updateQueueStatus(qItem.id, 'IN_CONSULTATION');

    // Populate initial complaint
    setConsultNotes({
      presenting_complaint: qItem.chief_complaint || qItem.referral_reason || '',
      history_of_illness: '',
      examination_findings: '',
      impression: '',
      management_plan: '',
      doctor_notes: '',
      nurse_instructions: ''
    });
    setIcdDiagnosis([]);
    setDrugs([{ ...EMPTY_DRUG }]);
    setTests([{ ...EMPTY_TEST }]);
    setProcedures([{ ...EMPTY_PROCEDURE }]);
    setRadiologyOrders([]);
    setWardAdmission({ admit: false, ward: 'General Ward', reason: '', notes: '' });

    // Fetch patient history
    try {
      const res = await api.get(`/patients/${qItem.patient_id}/history`);
      setPatientHistory(res.data?.data || []);
    } catch {}
  };

  // Helper to build payload for `/consultations`
  const buildConsultationPayload = (admit = false) => {
    const diagStr = icdDiagnosis.map(d => `${d.code} - ${d.title || d.name}`).join('; ')
      || consultNotes.impression
      || 'Provisional Evaluation (Specialist Clinic)';

    const activeDrugs = drugs.filter(d => d.drug_name?.trim());
    const activeTests = tests.filter(t => t.test_name?.trim());
    const activeProcedures = procedures.filter(p => p.procedure_name?.trim());

    return {
      visit_id: activeQueueItem.visit_id,
      encounter_id: activeQueueItem.encounter_id,
      patient_id: activeQueueItem.patient_id,
      presenting_complaint: consultNotes.presenting_complaint,
      history_of_illness: consultNotes.history_of_illness,
      examination_findings: consultNotes.examination_findings,
      impression: consultNotes.impression,
      diagnosis: diagStr,
      management_plan: consultNotes.management_plan,
      doctor_notes: consultNotes.doctor_notes,
      nurse_instructions: consultNotes.nurse_instructions,
      admit_patient: admit || wardAdmission.admit,
      admission_ward: wardAdmission.ward,
      admission_reason: wardAdmission.reason,
      admission_notes: wardAdmission.notes,
      prescriptions: activeDrugs.map(d => ({
        drug_name: d.drug_name,
        dosage: d.dosage,
        frequency: d.frequency,
        duration: d.duration,
        route: d.route || 'oral',
        instructions: d.instructions,
        quantity: d.quantity || 1,
        selling_price: d.selling_price || 0,
        product_id: d.product_id || null
      })),
      lab_requests: activeTests.map(t => ({
        test_name: t.test_name,
        test_code: t.test_code || '',
        urgency: t.urgency || 'routine',
        notes: t.notes || ''
      })),
      procedures: activeProcedures.map(p => ({
        procedure_name: p.procedure_name,
        procedure_code: p.procedure_code || '',
        notes: p.notes || ''
      }))
    };
  };

  // 1. Send to Pharmacy
  const handleSendToPharmacy = async () => {
    const activeDrugs = drugs.filter(d => d.drug_name?.trim());
    if (activeDrugs.length === 0) {
      toast.error('Please add at least one drug prescription before sending to Pharmacy');
      return;
    }
    setSavingConsult(true);
    try {
      const payload = buildConsultationPayload(false);
      await api.post('/consultations', payload);

      // Auto-bill drug prescriptions
      const drugItems = activeDrugs.map(d => ({
        item_type: 'drug',
        description: `${d.drug_name} ${d.dosage || ''} ${d.frequency || ''}`.trim(),
        quantity: d.quantity || 1,
        unit_price: d.selling_price || 0,
        reference_id: d.product_id || null
      }));
      for (const item of drugItems) {
        await api.post(`/billing/visit/${activeQueueItem.visit_id}/items`, item).catch(() => {});
      }

      // Update visit status to pharmacy & complete queue item
      await api.put(`/patients/visits/${activeQueueItem.visit_id}/status`, { status: 'WAITING_PHARMACY' });
      await updateQueueStatus(activeQueueItem.id, 'COMPLETED');

      toast.success('💊 Prescriptions sent to Pharmacy & Patient billed!');
      setActiveQueueItem(null);
      setActiveTab('queue');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to send to Pharmacy');
    } finally {
      setSavingConsult(false);
    }
  };

  // 2. Send to Lab
  const handleSendToLab = async () => {
    const activeTests = tests.filter(t => t.test_name?.trim());
    if (activeTests.length === 0) {
      toast.error('Please add at least one lab test before sending to Laboratory');
      return;
    }
    setSavingConsult(true);
    try {
      const payload = buildConsultationPayload(false);
      await api.post('/consultations', payload);

      // Auto-bill lab tests
      const labItems = activeTests.map(t => ({
        name: t.test_name,
        code: t.test_code || '',
        category: 'laboratory'
      }));
      await api.post('/billing/auto-bill', {
        visit_id: activeQueueItem.visit_id,
        patient_id: activeQueueItem.patient_id,
        items: labItems
      }).catch(() => {});

      // Update visit status to lab & complete queue item
      await api.put(`/patients/visits/${activeQueueItem.visit_id}/status`, { status: 'lab' });
      await updateQueueStatus(activeQueueItem.id, 'COMPLETED');

      toast.success('🔬 Lab requests sent & Patient queued in Laboratory!');
      setActiveQueueItem(null);
      setActiveTab('queue');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to send to Lab');
    } finally {
      setSavingConsult(false);
    }
  };

  // 3. Send to Radiology
  const handleSendToRadiology = async () => {
    setSavingConsult(true);
    try {
      const payload = buildConsultationPayload(false);
      await api.post('/consultations', payload);

      const radItems = radiologyOrders.length > 0
        ? radiologyOrders.map(r => ({ name: r.name, category: 'radiology' }))
        : [{ name: 'Specialist Radiology Request', category: 'radiology' }];

      await api.post('/billing/auto-bill', {
        visit_id: activeQueueItem.visit_id,
        patient_id: activeQueueItem.patient_id,
        items: radItems
      }).catch(() => {});

      await api.put(`/patients/visits/${activeQueueItem.visit_id}/status`, { status: 'radiology' });
      await updateQueueStatus(activeQueueItem.id, 'COMPLETED');

      toast.success('📸 Radiology request sent!');
      setActiveQueueItem(null);
      setActiveTab('queue');
    } catch (e) {
      toast.error('Failed to send to Radiology');
    } finally {
      setSavingConsult(false);
    }
  };

  // 4. Send to Injection Room
  const handleSendToInjectionRoom = async () => {
    setSavingConsult(true);
    try {
      const payload = buildConsultationPayload(false);
      await api.post('/consultations', payload);

      const activeDrugs = drugs.filter(d => d.drug_name?.trim());
      for (const drug of activeDrugs) {
        await api.post(`/injection-room/visit/${activeQueueItem.visit_id}/orders`, {
          drug_name: drug.drug_name,
          dosage: drug.dosage,
          route: drug.route || 'IV',
          frequency: drug.frequency,
          duration: drug.duration,
          quantity: drug.quantity || 1,
          instructions: consultNotes.nurse_instructions || 'Administer as directed'
        }).catch(() => {});
      }

      await api.put(`/patients/visits/${activeQueueItem.visit_id}/status`, { status: 'injection_room' });
      await updateQueueStatus(activeQueueItem.id, 'COMPLETED');

      toast.success('💉 Sent to Injection Room!');
      setActiveQueueItem(null);
      setActiveTab('queue');
    } catch (e) {
      toast.error('Failed to send to Injection Room');
    } finally {
      setSavingConsult(false);
    }
  };

  // 5. Admit to Ward
  const handleAdmitToWard = async () => {
    if (!wardAdmission.reason?.trim()) {
      toast.error('Please specify the admission reason');
      return;
    }
    setSavingConsult(true);
    try {
      const payload = buildConsultationPayload(true);
      await api.post('/consultations', payload);

      await api.put(`/patients/visits/${activeQueueItem.visit_id}/status`, { status: 'admitted' });
      await updateQueueStatus(activeQueueItem.id, 'COMPLETED');

      toast.success(`🏥 Patient admitted to ${wardAdmission.ward}!`);
      setActiveQueueItem(null);
      setActiveTab('queue');
    } catch (e) {
      toast.error('Failed to admit patient');
    } finally {
      setSavingConsult(false);
    }
  };

  // 6. Complete Consultation & Discharge
  const handleCompleteAndDischarge = async () => {
    setSavingConsult(true);
    try {
      const payload = buildConsultationPayload(false);
      await api.post('/consultations', payload);

      await api.put(`/patients/visits/${activeQueueItem.visit_id}/status`, { status: 'discharged' });
      await updateQueueStatus(activeQueueItem.id, 'COMPLETED');

      toast.success('✅ Specialist consultation completed and patient discharged!');
      setActiveQueueItem(null);
      setActiveTab('queue');
    } catch (e) {
      toast.error('Failed to complete consultation');
    } finally {
      setSavingConsult(false);
    }
  };

  // Search drugs catalog for prescriptions
  const searchProducts = async (term, index) => {
    setActiveDrugIndex(index);
    if (!term || term.length < 2) {
      setProductSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`/products?search=${encodeURIComponent(term)}&limit=10`);
      setProductSearchResults(res.data?.data || res.data || []);
    } catch {
      setProductSearchResults([]);
    }
  };

  const selectProductForDrug = (product, index) => {
    const updated = [...drugs];
    updated[index] = {
      ...updated[index],
      drug_name: product.name || product.product_name,
      product_id: product.id,
      selling_price: product.selling_price || product.price || 0,
      instructions: product.dosage_instructions || updated[index].instructions
    };
    setDrugs(updated);
    setProductSearchResults([]);
    setActiveDrugIndex(null);
  };

  const handleInterClinicReferral = async () => {
    if (!activeQueueItem || !referTargetClinic) {
      toast.error('Please select a destination clinic');
      return;
    }
    setReferring(true);
    try {
      const currentClinicObj = clinics.find(c => c.code === activeQueueItem.clinic_code || c.name === activeQueueItem.clinic_name);
      const targetObj = clinics.find(c => c.code === referTargetClinic || String(c.id) === String(referTargetClinic));

      await api.post('/special-clinics/refer', {
        visit_id: activeQueueItem.visit_id,
        patient_id: activeQueueItem.patient_id,
        clinic_id: targetObj?.id,
        clinic_code: targetObj?.code,
        clinic_name: targetObj?.name,
        from_clinic: currentClinicObj?.name || activeQueueItem.clinic_name || 'Specialist Clinic',
        referral_reason: referReason || 'Referred for specialized evaluation',
        urgency: referUrgency
      });

      toast.success(`✅ Patient referred to ${targetObj?.name || 'Special Clinic'}! New Encounter created.`);
      setShowReferModal(false);
      setReferReason('');
      fetchQueue();
      fetchDashboardStats();
    } catch (e) {
      toast.error('Failed to refer patient');
    } finally {
      setReferring(false);
    }
  };

  const handleCreateClinic = async (e) => {
    e.preventDefault();
    try {
      await api.post('/special-clinics', newClinic);
      toast.success('✅ Special clinic created!');
      setShowCreateClinicModal(false);
      fetchClinics();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to create clinic');
    }
  };

  const handleCreateService = async (e) => {
    e.preventDefault();
    const selClinic = clinics.find(c => c.code === selectedClinic) || clinics[0];
    if (!selClinic) return;
    try {
      await api.post('/special-clinics/services', {
        clinic_id: selClinic.id,
        ...newService
      });
      toast.success('✅ Service added to clinic');
      setShowServiceModal(false);
      setNewService({ service_name: '', service_code: '', fee: '', description: '' });
      fetchServices();
    } catch (e) {
      toast.error('Failed to add service');
    }
  };

  const selectedClinicObj = clinics.find(c => c.code === selectedClinic);

  const filteredQueue = queue.filter(q => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      q.patient_name?.toLowerCase().includes(term) ||
      q.patient_number?.toLowerCase().includes(term) ||
      q.visit_number?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="w-full p-4 sm:p-6 space-y-6 font-sans text-slate-100">
      {/* ── HEADER & CLINIC SELECTOR BAR ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-100 tracking-tight">
                Specialist Clinics Hub
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                Multi-specialty Hospital Information System with Departmental Routing & Billing Integration
              </p>
            </div>
          </div>
        </div>

        {/* Clinic Selector & Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 px-3 py-2 rounded-xl border border-slate-700">
            <Building className="w-4 h-4 text-purple-400" />
            <select
              value={selectedClinic}
              onChange={e => setSelectedClinic(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-100 outline-none cursor-pointer pr-2"
            >
              <option value="ALL" className="bg-slate-900">
                🏥 All Special Clinics ({clinics.length})
              </option>
              {clinics.map(c => (
                <option key={c.id || c.code} value={c.code} className="bg-slate-900">
                  {c.name} ({c.waiting_count || 0} waiting)
                </option>
              ))}
            </select>
          </div>

          <Btn variant="primary" size="sm" onClick={() => setShowCreateClinicModal(true)}>
            <Plus className="w-3.5 h-3.5" /> New Clinic
          </Btn>
        </div>
      </div>

      {/* Selected Clinic Meta Banner */}
      {selectedClinicObj && (
        <Card className="p-4 bg-purple-500/5 border-purple-500/20 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-purple-400 text-sm">{selectedClinicObj.name}</span>
            <span className="text-slate-400">• {selectedClinicObj.description}</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>📍 {selectedClinicObj.location || 'Specialist Wing'}</span>
            <span>💰 Consultation Fee: KES {selectedClinicObj.consultation_fee || 0}</span>
            <span>📅 {selectedClinicObj.working_days}</span>
          </div>
        </Card>
      )}

      {/* ── NAVIGATION TABS ── */}
      <div className="flex items-center gap-2 border-b border-slate-800 overflow-x-auto pb-1">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: Activity },
          { id: 'queue', label: `Patient Queue (${queue.length})`, icon: Users },
          { id: 'consultation', label: 'Specialist Desk', icon: Stethoscope },
          { id: 'appointments', label: `Appointments (${appointments.length})`, icon: Calendar },
          { id: 'services', label: `Services & Fees (${services.length})`, icon: DollarSign },
          { id: 'reports', label: 'Reports & Analytics', icon: FileText },
          { id: 'admin', label: `Clinic Admin & Duty (${clinicDoctors.length})`, icon: Settings },
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                isActive
                  ? 'border-purple-500 text-purple-400 bg-purple-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── 1. CLINIC DASHBOARD TAB ── */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 space-y-1 bg-purple-500/5 border-purple-500/20">
              <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">Today's Patients</span>
              <div className="text-2xl font-black text-slate-100">{stats.today_patients || 0}</div>
              <span className="text-[10px] text-slate-400">Encounters registered today</span>
            </Card>

            <Card className="p-4 space-y-1 bg-amber-500/5 border-amber-500/20">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Waiting Patients</span>
              <div className="text-2xl font-black text-slate-100">{stats.waiting_patients || 0}</div>
              <span className="text-[10px] text-slate-400">Awaiting specialist call</span>
            </Card>

            <Card className="p-4 space-y-1 bg-blue-500/5 border-blue-500/20">
              <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">In Consultation</span>
              <div className="text-2xl font-black text-slate-100">{stats.in_consultation || 0}</div>
              <span className="text-[10px] text-slate-400">Currently being attended</span>
            </Card>

            <Card className="p-4 space-y-1 bg-emerald-500/5 border-emerald-500/20">
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Completed Today</span>
              <div className="text-2xl font-black text-slate-100">{stats.completed_consultations || 0}</div>
              <span className="text-[10px] text-slate-400">Finalized consultations</span>
            </Card>
          </div>

          {/* Active Clinics Quick Overview */}
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Building className="w-4 h-4 text-purple-400" /> Active Special Clinics Overview ({clinics.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {clinics.map(c => (
                <div
                  key={c.id || c.code}
                  onClick={() => {
                    setSelectedClinic(c.code);
                    setActiveTab('queue');
                  }}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all hover:border-purple-500/50 ${
                    selectedClinic === c.code
                      ? 'bg-purple-500/10 border-purple-500/40'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-100">{c.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {c.waiting_count || 0} waiting
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate mt-1">{c.description}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── 2. PATIENT QUEUE TAB ── */}
      {activeTab === 'queue' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Queue Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--bg-surface)] p-3.5 rounded-2xl border border-[var(--border)]">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient, MRN, or visit..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl text-xs text-slate-100 outline-none w-full sm:w-64 focus:border-purple-500"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
              {['WAITING', 'IN_CONSULTATION', 'COMPLETED', 'ALL'].map(st => (
                <button
                  key={st}
                  onClick={() => setQueueFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    queueFilter === st
                      ? 'bg-purple-500 text-slate-950 font-black'
                      : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Queue List Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-100">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="p-3">Queued Time</th>
                    <th className="p-3">Patient Name / MRN</th>
                    <th className="p-3">Clinic</th>
                    <th className="p-3">Visit & Encounter</th>
                    <th className="p-3">Priority</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredQueue.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                        No patients currently in this clinic queue view.
                      </td>
                    </tr>
                  ) : (
                    filteredQueue.map(q => {
                      const stBadge = STATUS_BADGES[q.status] || STATUS_BADGES.WAITING;
                      return (
                        <tr key={q.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 text-slate-400 font-mono text-[11px]">
                            {new Date(q.queued_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-100">{q.patient_name}</div>
                            <span className="text-[10px] text-slate-400">MRN: {q.patient_number} • {q.gender || 'F'}</span>
                          </td>
                          <td className="p-3 font-semibold text-purple-400">
                            {q.clinic_name}
                          </td>
                          <td className="p-3 font-mono text-[11px]">
                            <div>#{q.visit_number}</div>
                            <span className="text-[10px] text-slate-400">{q.encounter_number || 'Encounter Active'}</span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              q.priority === 'URGENT' || q.priority === 'EMERGENCY'
                                ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                                : 'bg-slate-800 border border-slate-700 text-slate-300'
                            }`}>
                              {q.priority}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${stBadge.bg}`}>
                              {stBadge.label}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {q.status === 'WAITING' && (
                                <Btn variant="primary" size="sm" onClick={() => handleStartConsultation(q)}>
                                  <Play className="w-3 h-3" /> Start Consult
                                </Btn>
                              )}
                              {q.status === 'IN_CONSULTATION' && (
                                <Btn variant="secondary" size="sm" onClick={() => handleStartConsultation(q)}>
                                  Resume Consult
                                </Btn>
                              )}
                              <Btn variant="secondary" size="sm" onClick={() => {
                                setActiveQueueItem(q);
                                setShowReferModal(true);
                              }}>
                                <ArrowRightLeft className="w-3 h-3" /> Refer
                              </Btn>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── 3. SPECIALIST CONSULTATION DESK TAB ── */}
      {activeTab === 'consultation' && (
        <div className="space-y-6 animate-fadeIn">
          {activeQueueItem ? (
            <div className="space-y-6">
              {/* Active Patient Banner */}
              <Card className="p-4 bg-purple-500/5 border-purple-500/30 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-black text-slate-100">
                      {activeQueueItem.patient_name}
                    </span>
                    <span className="text-xs text-slate-400">MRN: #{activeQueueItem.patient_number}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 border border-purple-500/30 text-purple-400">
                      {activeQueueItem.clinic_name}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-4">
                    <span>Visit #{activeQueueItem.visit_number}</span>
                    <span>Encounter #{activeQueueItem.encounter_number || activeQueueItem.encounter_id}</span>
                    {activeQueueItem.referral_reason && (
                      <span className="text-amber-400 font-medium">Reason: {activeQueueItem.referral_reason}</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Btn variant="secondary" size="sm" onClick={() => setShowReferModal(true)}>
                    <ArrowRightLeft className="w-3.5 h-3.5" /> Refer Clinic
                  </Btn>
                  <Btn variant="primary" size="sm" onClick={handleCompleteAndDischarge} disabled={savingConsult}>
                    <CheckCircle className="w-3.5 h-3.5" /> {savingConsult ? 'Saving...' : 'Finalize & Discharge'}
                  </Btn>
                </div>
              </Card>

              {/* Consultation Sub-Tabs Header */}
              <div className="flex items-center gap-2 border-b border-slate-800 overflow-x-auto pb-1 bg-slate-900/60 p-2 rounded-xl">
                {[
                  { id: 'notes', label: '1. Notes & ICD-10', icon: FileText },
                  { id: 'labs', label: `2. Lab Tests (${tests.filter(t => t.test_name).length})`, icon: FlaskConical },
                  { id: 'rx', label: `3. Prescriptions (${drugs.filter(d => d.drug_name).length})`, icon: Pill },
                  { id: 'radiology', label: `4. Radiology (${radiologyOrders.length})`, icon: Radio },
                  { id: 'injection', label: '5. Injection Room / Nursing', icon: Syringe },
                  { id: 'ward', label: '6. Ward Admission', icon: Bed },
                ].map(st => {
                  const Icon = st.icon;
                  const isActive = consultSubTab === st.id;
                  return (
                    <button
                      key={st.id}
                      onClick={() => setConsultSubTab(st.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all ${
                        isActive
                          ? 'bg-purple-500 text-slate-950 font-black shadow-sm'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {st.label}
                    </button>
                  );
                })}
              </div>

              {/* Main Desk Layout: 2 Columns */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Cols: Active Order/Notes Panel */}
                <div className="lg:col-span-2 space-y-4">
                  {/* TAB 1: CLINICAL NOTES & DIAGNOSIS */}
                  {consultSubTab === 'notes' && (
                    <Card className="p-5 space-y-4">
                      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
                        🩺 Specialist Clinical Assessment & ICD-10
                      </h3>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 block">Presenting Complaint / Chief Reason</label>
                        <textarea
                          rows={2}
                          value={consultNotes.presenting_complaint}
                          onChange={e => setConsultNotes({ ...consultNotes, presenting_complaint: e.target.value })}
                          placeholder="Chief complaints, presenting symptoms..."
                          className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 outline-none focus:border-purple-500 resize-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 block">History of Presenting Illness (HPI)</label>
                        <textarea
                          rows={2}
                          value={consultNotes.history_of_illness}
                          onChange={e => setConsultNotes({ ...consultNotes, history_of_illness: e.target.value })}
                          placeholder="Duration, severity, onset, associated factors..."
                          className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 outline-none focus:border-purple-500 resize-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 block">Focused Examination & Clinical Findings</label>
                        <textarea
                          rows={3}
                          value={consultNotes.examination_findings}
                          onChange={e => setConsultNotes({ ...consultNotes, examination_findings: e.target.value })}
                          placeholder="Specialist examination findings (e.g., ECG interpretation, Slit-lamp exam, Dental chart notes, ECHO metrics)..."
                          className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 outline-none focus:border-purple-500 resize-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 block">ICD-10 Diagnosis Search & Tagging</label>
                        <ICD10Search onSelect={diag => setIcdDiagnosis([...icdDiagnosis, diag])} />
                        {icdDiagnosis.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {icdDiagnosis.map((d, idx) => (
                              <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
                                {d.code} - {d.title || d.name}
                                <button onClick={() => setIcdDiagnosis(icdDiagnosis.filter((_, i) => i !== idx))} className="hover:text-red-400 font-bold ml-1">×</button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 block">Provisional Impression / Summary</label>
                        <input
                          type="text"
                          value={consultNotes.impression}
                          onChange={e => setConsultNotes({ ...consultNotes, impression: e.target.value })}
                          placeholder="Primary diagnosis / clinical impression..."
                          className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 outline-none focus:border-purple-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 block">Management Plan</label>
                        <textarea
                          rows={2}
                          value={consultNotes.management_plan}
                          onChange={e => setConsultNotes({ ...consultNotes, management_plan: e.target.value })}
                          placeholder="Therapeutic plan, procedural intervention, diet, follow-up..."
                          className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 outline-none focus:border-purple-500 resize-none"
                        />
                      </div>
                    </Card>
                  )}

                  {/* TAB 2: LAB TESTS */}
                  {consultSubTab === 'labs' && (
                    <Card className="p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                          <FlaskConical className="w-4 h-4 text-purple-400" /> Laboratory Orders & Diagnostics
                        </h3>
                        <Btn variant="primary" size="sm" onClick={() => setTests([...tests, { ...EMPTY_TEST }])}>
                          <Plus className="w-3.5 h-3.5" /> Add Lab Test
                        </Btn>
                      </div>

                      <div className="space-y-3">
                        {tests.map((t, idx) => (
                          <div key={idx} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div className="sm:col-span-2">
                                <label className="text-[10px] text-slate-400 block">Test Name (e.g. LFT, Trop-I, Lipid Profile, Renal Function, ECG, HbA1c)</label>
                                <input
                                  type="text"
                                  value={t.test_name}
                                  onChange={e => {
                                    const updated = [...tests];
                                    updated[idx].test_name = e.target.value;
                                    setTests(updated);
                                  }}
                                  placeholder="Enter test name..."
                                  className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 outline-none focus:border-purple-500"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-400 block">Urgency</label>
                                <select
                                  value={t.urgency}
                                  onChange={e => {
                                    const updated = [...tests];
                                    updated[idx].urgency = e.target.value;
                                    setTests(updated);
                                  }}
                                  className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 outline-none"
                                >
                                  <option value="routine" className="bg-slate-900 text-slate-100" style={{ background: '#0f172a', color: '#f8fafc' }}>Routine</option>
                                  <option value="urgent" className="bg-slate-900 text-slate-100" style={{ background: '#0f172a', color: '#f8fafc' }}>Urgent</option>
                                  <option value="stat" className="bg-slate-900 text-slate-100" style={{ background: '#0f172a', color: '#f8fafc' }}>STAT / Emergency</option>
                                </select>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <input
                                type="text"
                                value={t.notes}
                                onChange={e => {
                                  const updated = [...tests];
                                  updated[idx].notes = e.target.value;
                                  setTests(updated);
                                }}
                                placeholder="Clinical notes for Lab Tech..."
                                className="w-full p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none"
                              />
                              {tests.length > 1 && (
                                <button
                                  onClick={() => setTests(tests.filter((_, i) => i !== idx))}
                                  className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-end pt-2 border-t border-slate-800">
                        <Btn variant="primary" size="sm" onClick={handleSendToLab} disabled={savingConsult}>
                          <Send className="w-3.5 h-3.5" /> Dispatch Orders to Laboratory
                        </Btn>
                      </div>
                    </Card>
                  )}

                  {/* TAB 3: PHARMACY PRESCRIPTIONS */}
                  {consultSubTab === 'rx' && (
                    <Card className="p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                          <Pill className="w-4 h-4 text-purple-400" /> Specialist Medication Prescriptions
                        </h3>
                        <Btn variant="primary" size="sm" onClick={() => setDrugs([...drugs, { ...EMPTY_DRUG }])}>
                          <Plus className="w-3.5 h-3.5" /> Add Drug
                        </Btn>
                      </div>

                      <div className="space-y-4">
                        {drugs.map((d, idx) => (
                          <div key={idx} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-3 relative">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="relative">
                                <label className="text-[10px] text-slate-400 block">Drug Name (Search Inventory Catalog)</label>
                                <input
                                  type="text"
                                  value={d.drug_name}
                                  onChange={e => {
                                    const updated = [...drugs];
                                    updated[idx].drug_name = e.target.value;
                                    setDrugs(updated);
                                    searchProducts(e.target.value, idx);
                                  }}
                                  placeholder="Type drug name..."
                                  className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 outline-none focus:border-purple-500"
                                />

                                {/* Search Dropdown */}
                                {activeDrugIndex === idx && productSearchResults.length > 0 && (
                                  <div className="absolute left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-20 max-h-48 overflow-y-auto">
                                    {productSearchResults.map(p => (
                                      <div
                                        key={p.id}
                                        onClick={() => selectProductForDrug(p, idx)}
                                        className="p-2 text-xs hover:bg-slate-800 cursor-pointer flex justify-between border-b border-slate-800"
                                      >
                                        <span className="font-bold text-slate-100">{p.name || p.product_name}</span>
                                        <span className="text-emerald-400 font-mono">KES {p.selling_price || p.price || 0}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-3 gap-1">
                                <div>
                                  <label className="text-[10px] text-slate-400 block">Dosage</label>
                                  <input
                                    type="text"
                                    value={d.dosage}
                                    onChange={e => {
                                      const updated = [...drugs];
                                      updated[idx].dosage = e.target.value;
                                      setDrugs(updated);
                                    }}
                                    placeholder="500mg"
                                    className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-slate-400 block">Frequency</label>
                                  <input
                                    type="text"
                                    value={d.frequency}
                                    onChange={e => {
                                      const updated = [...drugs];
                                      updated[idx].frequency = e.target.value;
                                      setDrugs(updated);
                                    }}
                                    placeholder="1x3 daily"
                                    className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-slate-400 block">Duration</label>
                                  <input
                                    type="text"
                                    value={d.duration}
                                    onChange={e => {
                                      const updated = [...drugs];
                                      updated[idx].duration = e.target.value;
                                      setDrugs(updated);
                                    }}
                                    placeholder="5 days"
                                    className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 outline-none"
                                  />
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <input
                                type="text"
                                value={d.instructions}
                                onChange={e => {
                                  const updated = [...drugs];
                                  updated[idx].instructions = e.target.value;
                                  setDrugs(updated);
                                }}
                                placeholder="Special instructions (e.g. after meals)..."
                                className="w-full p-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none"
                              />
                              {drugs.length > 1 && (
                                <button
                                  onClick={() => setDrugs(drugs.filter((_, i) => i !== idx))}
                                  className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-end pt-2 border-t border-slate-800">
                        <Btn variant="primary" size="sm" onClick={handleSendToPharmacy} disabled={savingConsult}>
                          <Send className="w-3.5 h-3.5" /> Dispatch Prescriptions to Pharmacy
                        </Btn>
                      </div>
                    </Card>
                  )}

                  {/* TAB 4: RADIOLOGY & IMAGING */}
                  {consultSubTab === 'radiology' && (
                    <Card className="p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                          <Radio className="w-4 h-4 text-purple-400" /> Radiology & Medical Imaging Orders
                        </h3>
                        <Btn variant="primary" size="sm" onClick={() => setRadiologyOrders([...radiologyOrders, { name: 'Chest X-Ray', category: 'X-Ray', notes: '' }])}>
                          <Plus className="w-3.5 h-3.5" /> Add Imaging Order
                        </Btn>
                      </div>

                      <div className="space-y-3">
                        {radiologyOrders.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
                            No radiology orders requested yet. Click "Add Imaging Order" to request X-Ray, Ultrasound, CT Scan, MRI, or ECHO.
                          </div>
                        ) : (
                          radiologyOrders.map((r, idx) => (
                            <div key={idx} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  value={r.name}
                                  onChange={e => {
                                    const updated = [...radiologyOrders];
                                    updated[idx].name = e.target.value;
                                    setRadiologyOrders(updated);
                                  }}
                                  placeholder="Imaging Investigation Name (e.g. Echocardiogram, Abdominal USG, Chest X-Ray)"
                                  className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 outline-none"
                                />
                                <select
                                  value={r.category}
                                  onChange={e => {
                                    const updated = [...radiologyOrders];
                                    updated[idx].category = e.target.value;
                                    setRadiologyOrders(updated);
                                  }}
                                  className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 outline-none"
                                >
                                  <option value="X-Ray" className="bg-slate-900 text-slate-100" style={{ background: '#0f172a', color: '#f8fafc' }}>X-Ray</option>
                                  <option value="Ultrasound" className="bg-slate-900 text-slate-100" style={{ background: '#0f172a', color: '#f8fafc' }}>Ultrasound</option>
                                  <option value="CT Scan" className="bg-slate-900 text-slate-100" style={{ background: '#0f172a', color: '#f8fafc' }}>CT Scan</option>
                                  <option value="MRI" className="bg-slate-900 text-slate-100" style={{ background: '#0f172a', color: '#f8fafc' }}>MRI</option>
                                  <option value="Echo" className="bg-slate-900 text-slate-100" style={{ background: '#0f172a', color: '#f8fafc' }}>Echocardiography</option>
                                  <option value="ECG" className="bg-slate-900 text-slate-100" style={{ background: '#0f172a', color: '#f8fafc' }}>ECG / Holter</option>
                                </select>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="flex justify-end pt-2 border-t border-slate-800">
                        <Btn variant="primary" size="sm" onClick={handleSendToRadiology} disabled={savingConsult}>
                          <Send className="w-3.5 h-3.5" /> Dispatch to Radiology Department
                        </Btn>
                      </div>
                    </Card>
                  )}

                  {/* TAB 5: INJECTION ROOM & NURSING */}
                  {consultSubTab === 'injection' && (
                    <Card className="p-5 space-y-4">
                      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center gap-2">
                        <Syringe className="w-4 h-4 text-purple-400" /> Nursing Care & Injection Room Instructions
                      </h3>

                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-bold text-slate-400 block mb-1">Nurse Instructions / Treatment Directives</label>
                          <textarea
                            rows={3}
                            value={consultNotes.nurse_instructions}
                            onChange={e => setConsultNotes({ ...consultNotes, nurse_instructions: e.target.value })}
                            placeholder="e.g. Administer IV fluid drip 500ml Normal Saline stat, IV Lasix 20mg IV bolus, record BP every 15 minutes..."
                            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 outline-none focus:border-purple-500 resize-none"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-2 border-t border-slate-800">
                        <Btn variant="primary" size="sm" onClick={handleSendToInjectionRoom} disabled={savingConsult}>
                          <Send className="w-3.5 h-3.5" /> Transfer to Injection / Treatment Room
                        </Btn>
                      </div>
                    </Card>
                  )}

                  {/* TAB 6: WARD ADMISSION */}
                  {consultSubTab === 'ward' && (
                    <Card className="p-5 space-y-4">
                      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2 flex items-center gap-2">
                        <Bed className="w-4 h-4 text-purple-400" /> Inpatient Ward Admission Order
                      </h3>

                      <div className="space-y-3 text-xs">
                        <div>
                          <label className="font-bold text-slate-400 block mb-1">Select Admission Ward</label>
                          <select
                            value={wardAdmission.ward}
                            onChange={e => setWardAdmission({ ...wardAdmission, ward: e.target.value, admit: true })}
                            className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 outline-none"
                          >
                            <option value="General Ward">General Medical Ward</option>
                            <option value="Male Ward">Male Ward</option>
                            <option value="Female Ward">Female Ward</option>
                            <option value="HDU">High Dependency Unit (HDU)</option>
                            <option value="ICU">Intensive Care Unit (ICU)</option>
                            <option value="Surgical Ward">Surgical Ward</option>
                            <option value="Paediatric Ward">Paediatric Ward</option>
                          </select>
                        </div>

                        <div>
                          <label className="font-bold text-slate-400 block mb-1">Reason for Admission</label>
                          <input
                            type="text"
                            value={wardAdmission.reason}
                            onChange={e => setWardAdmission({ ...wardAdmission, reason: e.target.value, admit: true })}
                            placeholder="Indication for inpatient monitoring / management..."
                            className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 outline-none"
                          />
                        </div>

                        <div>
                          <label className="font-bold text-slate-400 block mb-1">Admission Clinical Directives</label>
                          <textarea
                            rows={3}
                            value={wardAdmission.notes}
                            onChange={e => setWardAdmission({ ...wardAdmission, notes: e.target.value, admit: true })}
                            placeholder="Initial inpatient care directives..."
                            className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 outline-none resize-none"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-2 border-t border-slate-800">
                        <Btn variant="primary" size="sm" onClick={handleAdmitToWard} disabled={savingConsult}>
                          <Bed className="w-3.5 h-3.5" /> Admit Patient to Inpatient Ward
                        </Btn>
                      </div>
                    </Card>
                  )}
                </div>

                {/* Right 1 Col: Patient Vitals & Clinical History */}
                <div className="space-y-4">
                  <Card className="p-4 space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-800 pb-2">
                      📊 Latest Triage Vitals
                    </h4>
                    {activeQueueItem.vitals && activeQueueItem.vitals.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">BP</span>
                          <span className="font-bold text-slate-100">{activeQueueItem.vitals[0].blood_pressure_systolic}/{activeQueueItem.vitals[0].blood_pressure_diastolic} mmHg</span>
                        </div>
                        <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Pulse</span>
                          <span className="font-bold text-slate-100">{activeQueueItem.vitals[0].pulse_rate} bpm</span>
                        </div>
                        <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Temp</span>
                          <span className="font-bold text-slate-100">{activeQueueItem.vitals[0].temperature} °C</span>
                        </div>
                        <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">BMI</span>
                          <span className="font-bold text-slate-100">{activeQueueItem.vitals[0].bmi || '—'}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No triage vitals recorded for this visit.</p>
                    )}
                  </Card>

                  {/* Patient Longitudinal Timeline */}
                  <Card className="p-4 space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-800 pb-2">
                      📜 Patient Medical Timeline
                    </h4>
                    <ClinicalTimeline patientId={activeQueueItem.patient_id} />
                  </Card>
                </div>
              </div>
            </div>
          ) : (
            <Card className="p-12 text-center space-y-3">
              <Stethoscope className="w-12 h-12 text-purple-400 mx-auto opacity-50" />
              <h3 className="text-sm font-bold text-slate-100">No Active Patient Selected</h3>
              <p className="text-xs text-slate-400">Please select a patient from the Patient Queue to open the specialist consultation desk.</p>
              <Btn variant="primary" size="sm" onClick={() => setActiveTab('queue')}>
                Go to Patient Queue
              </Btn>
            </Card>
          )}
        </div>
      )}

      {/* ── 4. APPOINTMENTS TAB ── */}
      {activeTab === 'appointments' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100">Clinic Appointments Schedule</h3>
            <Btn variant="primary" size="sm" onClick={() => setShowApptModal(true)}>
              <Plus className="w-3.5 h-3.5" /> Schedule Appointment
            </Btn>
          </div>

          <Card className="overflow-hidden">
            <table className="w-full text-left text-xs text-slate-100">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="p-3">Date & Time</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Clinic</th>
                  <th className="p-3">Assigned Doctor</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {appointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                      No appointments scheduled.
                    </td>
                  </tr>
                ) : (
                  appointments.map(a => (
                    <tr key={a.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono">
                        {new Date(a.appointment_date).toLocaleDateString()} {a.appointment_time}
                      </td>
                      <td className="p-3 font-bold">{a.patient_name} ({a.patient_number})</td>
                      <td className="p-3 text-purple-400 font-semibold">{a.clinic_name}</td>
                      <td className="p-3">{a.doctor_name || 'Unassigned'}</td>
                      <td className="p-3 text-slate-400">{a.reason || 'Follow-up'}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ── 5. SERVICES & FEES TAB ── */}
      {activeTab === 'services' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100">Clinic Procedures & Services Price List</h3>
            <Btn variant="primary" size="sm" onClick={() => setShowServiceModal(true)}>
              <Plus className="w-3.5 h-3.5" /> Add Service
            </Btn>
          </div>

          <Card className="overflow-hidden">
            <table className="w-full text-left text-xs text-slate-100">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="p-3">Service Code</th>
                  <th className="p-3">Service Name</th>
                  <th className="p-3">Clinic</th>
                  <th className="p-3">Price (KES)</th>
                  <th className="p-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {services.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                      No service tariffs configured for this clinic selection.
                    </td>
                  </tr>
                ) : (
                  services.map(s => (
                    <tr key={s.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-purple-400">{s.service_code || '—'}</td>
                      <td className="p-3 font-bold">{s.service_name}</td>
                      <td className="p-3 text-slate-400">{s.clinic_name}</td>
                      <td className="p-3 font-mono font-bold text-emerald-400">KES {s.fee}</td>
                      <td className="p-3 text-slate-400">{s.description || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* ── 6. REPORTS TAB ── */}
      {activeTab === 'reports' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
                📊 Patient Volume by Special Clinic
              </h3>
              <div className="space-y-2">
                {reportsData?.volume_by_clinic?.map((v, i) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="font-semibold text-slate-100">{v.clinic_name}</span>
                    <span className="font-mono font-bold text-purple-400">{v.patient_count} patients</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
                🔄 Inter-Clinic Referral Statistics
              </h3>
              <div className="space-y-2">
                {reportsData?.referral_stats?.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="font-semibold text-slate-100">Referred to {r.to_clinic_name}</span>
                    <span className="font-mono font-bold text-indigo-400">{r.referral_count} referrals</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── CLINIC ADMIN & DUTY ROSTER TAB ── */}
      {activeTab === 'admin' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Top Bar for Admin */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-purple-400" /> Specialist Duty Roster & Clinic Management
              </h2>
              <p className="text-xs text-slate-400">
                Assign doctors and specialists to clinic duty, set primary clinic consultants, and configure clinic parameters.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Btn variant="primary" size="sm" onClick={() => { setShowAssignDoctorModal(true); fetchAvailableDoctors(); }}>
                <UserPlus className="w-4 h-4" /> Assign Specialist to Duty
              </Btn>
              <Btn variant="secondary" size="sm" onClick={() => setShowCreateClinicModal(true)}>
                <Plus className="w-4 h-4" /> New Special Clinic
              </Btn>
            </div>
          </div>

          {/* Active Specialist Duty Roster */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-purple-400" /> Specialist Duty Assignments ({clinicDoctors.length})
              </h3>
              <Btn variant="secondary" size="sm" onClick={fetchClinicDoctors}>
                <RefreshCw className="w-3.5 h-3.5" /> Refresh Roster
              </Btn>
            </div>

            {clinicDoctors.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                No specialists assigned to duty for the selected clinic filter. Click <strong className="text-purple-400">Assign Specialist to Duty</strong> to set up doctor duties.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900 text-slate-400 font-bold uppercase border-b border-slate-800">
                    <tr>
                      <th className="p-3">Specialist / Doctor</th>
                      <th className="p-3">Assigned Special Clinic</th>
                      <th className="p-3">Email & Contact</th>
                      <th className="p-3">Role / Lead Status</th>
                      <th className="p-3">Duty Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {clinicDoctors.map(doc => (
                      <tr key={doc.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="p-3 font-bold text-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-purple-500/10 text-purple-400 rounded-lg">
                              <Stethoscope className="w-4 h-4" />
                            </div>
                            <div>
                              <div>{doc.doctor_name || doc.full_name}</div>
                              <span className="text-[10px] text-purple-400 font-normal uppercase">{doc.role || 'Doctor'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-purple-300">{doc.clinic_name}</td>
                        <td className="p-3 text-slate-400">
                          <div>{doc.email}</div>
                          <div className="text-[10px] text-slate-500">{doc.phone || 'No phone'}</div>
                        </td>
                        <td className="p-3">
                          {doc.is_primary ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                              ★ Lead Specialist
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400">
                              Attending
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center gap-1 w-max">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" /> Active Duty
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <Btn variant="danger" size="sm" onClick={() => handleRemoveDoctorAssignment(doc.id)}>
                            <Trash2 className="w-3.5 h-3.5" /> Unassign
                          </Btn>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Clinics Management & Head Doctors */}
          <Card className="p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Building className="w-4 h-4 text-purple-400" /> Special Clinics Roster & Parameters
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-slate-400 font-bold uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-3">Clinic Code & Name</th>
                    <th className="p-3">Head Doctor</th>
                    <th className="p-3">Working Days</th>
                    <th className="p-3">Consultation Fee</th>
                    <th className="p-3">Location</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {clinics.map(c => (
                    <tr key={c.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 font-bold text-slate-100">
                        <div>{c.name}</div>
                        <span className="text-[10px] font-mono text-slate-400">{c.code}</span>
                      </td>
                      <td className="p-3 text-slate-300">
                        {c.head_doctor_name ? (
                          <span className="font-semibold text-purple-300">👨‍⚕️ {c.head_doctor_name}</span>
                        ) : (
                          <span className="text-slate-500 italic">Not Assigned</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400">{c.working_days}</td>
                      <td className="p-3 font-mono font-bold text-emerald-400">KES {Number(c.consultation_fee || 0).toLocaleString()}</td>
                      <td className="p-3 text-slate-400">{c.location || 'Specialist Wing'}</td>
                      <td className="p-3">
                        {c.is_active ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Active</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">Inactive</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <Btn variant="secondary" size="sm" onClick={() => { setEditingClinic(c); setShowEditClinicModal(true); }}>
                          Edit Clinic
                        </Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── INTER-CLINIC REFERRAL MODAL ── */}
      {showReferModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleUp text-slate-100">
            <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-purple-400" /> Refer Patient to Special Clinic
            </h3>
            <p className="text-xs text-slate-400">
              This creates a <strong className="text-purple-400">NEW Encounter</strong> under the same Visit #{activeQueueItem?.visit_number}, maintaining the complete inter-clinic referral chain.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-400 block mb-1">Target Special Clinic</label>
                <select
                  value={referTargetClinic}
                  onChange={e => setReferTargetClinic(e.target.value)}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 outline-none focus:border-purple-500"
                >
                  <option value="" className="bg-slate-900 text-slate-100" style={{ background: '#0f172a', color: '#f8fafc' }}>-- Select Destination Clinic --</option>
                  {clinics.map(c => (
                    <option key={c.id || c.code} value={c.code} className="bg-slate-900 text-slate-100" style={{ background: '#0f172a', color: '#f8fafc' }}>
                      {c.name} — {c.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-400 block mb-1">Referral Urgency</label>
                <select
                  value={referUrgency}
                  onChange={e => setReferUrgency(e.target.value)}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 outline-none focus:border-purple-500"
                >
                  <option value="ROUTINE" className="bg-slate-900 text-slate-100" style={{ background: '#0f172a', color: '#f8fafc' }}>Routine</option>
                  <option value="URGENT" className="bg-slate-900 text-slate-100" style={{ background: '#0f172a', color: '#f8fafc' }}>Urgent</option>
                  <option value="EMERGENCY" className="bg-slate-900 text-slate-100" style={{ background: '#0f172a', color: '#f8fafc' }}>Emergency</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-400 block mb-1">Reason for Referral</label>
                <textarea
                  rows={3}
                  value={referReason}
                  onChange={e => setReferReason(e.target.value)}
                  placeholder="Clinical reasons, specialized evaluation needed..."
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 outline-none resize-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <Btn variant="secondary" size="sm" onClick={() => setShowReferModal(false)}>
                Cancel
              </Btn>
              <Btn variant="primary" size="sm" onClick={handleInterClinicReferral} disabled={referring}>
                {referring ? 'Creating Referral Encounter...' : 'Submit Referral'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE CLINIC MODAL ── */}
      {showCreateClinicModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateClinic} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleUp text-slate-100">
            <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-400" /> Create New Special Clinic
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-400 block mb-1">Clinic Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DERMATOLOGY"
                  value={newClinic.code}
                  onChange={e => setNewClinic({ ...newClinic, code: e.target.value })}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 outline-none font-mono uppercase focus:border-purple-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-400 block mb-1">Clinic Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dermatology Clinic"
                  value={newClinic.name}
                  onChange={e => setNewClinic({ ...newClinic, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-400 block mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Skin and Dermatological Services"
                  value={newClinic.description}
                  onChange={e => setNewClinic({ ...newClinic, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Consultation Fee (KES)</label>
                  <input
                    type="number"
                    value={newClinic.consultation_fee}
                    onChange={e => setNewClinic({ ...newClinic, consultation_fee: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 outline-none font-mono focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Location / Room</label>
                  <input
                    type="text"
                    value={newClinic.location}
                    onChange={e => setNewClinic({ ...newClinic, location: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <Btn type="button" variant="secondary" size="sm" onClick={() => setShowCreateClinicModal(false)}>
                Cancel
              </Btn>
              <Btn type="submit" variant="primary" size="sm">
                Create Clinic
              </Btn>
            </div>
          </form>
        </div>
      )}

      {/* ── CREATE SERVICE MODAL ── */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateService} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleUp text-slate-100">
            <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-400" /> Add Service Tariff
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-400 block mb-1">Service Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ECG Recording & Interpretation"
                  value={newService.service_name}
                  onChange={e => setNewService({ ...newService, service_name: e.target.value })}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Service Code</label>
                  <input
                    type="text"
                    placeholder="e.g. CARD-ECG"
                    value={newService.service_code}
                    onChange={e => setNewService({ ...newService, service_code: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 outline-none uppercase font-mono focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Price (KES)</label>
                  <input
                    type="number"
                    required
                    placeholder="1500"
                    value={newService.fee}
                    onChange={e => setNewService({ ...newService, fee: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 outline-none font-mono focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <Btn type="button" variant="secondary" size="sm" onClick={() => setShowServiceModal(false)}>
                Cancel
              </Btn>
              <Btn type="submit" variant="primary" size="sm">
                Save Service
              </Btn>
            </div>
          </form>
        </div>
      )}

      {/* ── ASSIGN DOCTOR TO DUTY MODAL ── */}
      {showAssignDoctorModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleAssignDoctor} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleUp text-slate-100">
            <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-purple-400" /> Assign Specialist / Doctor to Clinic Duty
            </h3>
            <p className="text-xs text-slate-400">
              Assign internal facility doctors or external visiting specialists to special clinic rosters so they can manage consultation queues.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Target Special Clinic *</label>
                <select
                  required
                  value={assignDoctorForm.clinic_id}
                  onChange={e => setAssignDoctorForm({ ...assignDoctorForm, clinic_id: e.target.value })}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 outline-none focus:border-purple-500 font-medium"
                >
                  <option value="" className="bg-slate-900 text-slate-100" style={{ background: '#0f172a', color: '#f8fafc' }}>-- Select Special Clinic --</option>
                  {clinics.map(c => (
                    <option key={c.id} value={c.id} className="bg-slate-900 text-slate-100" style={{ background: '#0f172a', color: '#f8fafc' }}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Doctor Type Source *</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setAssignDoctorForm({ ...assignDoctorForm, doctor_type: 'staff' })}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      assignDoctorForm.doctor_type === 'staff'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    🏢 Facility Staff
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignDoctorForm({ ...assignDoctorForm, doctor_type: 'external' })}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      assignDoctorForm.doctor_type === 'external'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    🩺 Visiting Specialist
                  </button>
                </div>
              </div>

              {assignDoctorForm.doctor_type === 'staff' ? (
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Select Doctor / Specialist from Staff *</label>
                  <select
                    required={assignDoctorForm.doctor_type === 'staff'}
                    value={assignDoctorForm.user_id}
                    onChange={e => setAssignDoctorForm({ ...assignDoctorForm, user_id: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 outline-none focus:border-purple-500 font-medium"
                  >
                    <option value="" className="bg-slate-900 text-slate-100" style={{ background: '#0f172a', color: '#f8fafc' }}>-- Select Specialist / Doctor --</option>
                    {availableDoctors.map(doc => (
                      <option key={doc.id} value={doc.id} className="bg-slate-900 text-slate-100" style={{ background: '#0f172a', color: '#f8fafc' }}>
                        {doc.full_name} ({doc.role}) — {doc.email}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2.5 bg-slate-950/60 p-3 rounded-xl border border-purple-500/20">
                  <span className="text-[11px] font-bold text-purple-400 block uppercase tracking-wider">
                    🩺 External Specialist Information
                  </span>

                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Doctor Full Name *</label>
                    <input
                      type="text"
                      required={assignDoctorForm.doctor_type === 'external'}
                      placeholder="e.g. Dr. Jane Mwangi"
                      value={assignDoctorForm.external_name}
                      onChange={e => setAssignDoctorForm({ ...assignDoctorForm, external_name: e.target.value })}
                      className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-300 block mb-1">Specialty / Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Visiting Consultant Dermatologist"
                      value={assignDoctorForm.external_specialty}
                      onChange={e => setAssignDoctorForm({ ...assignDoctorForm, external_specialty: e.target.value })}
                      className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Phone Number</label>
                      <input
                        type="text"
                        placeholder="0712345678"
                        value={assignDoctorForm.external_phone}
                        onChange={e => setAssignDoctorForm({ ...assignDoctorForm, external_phone: e.target.value })}
                        className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 outline-none focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-300 block mb-1">Email Address</label>
                      <input
                        type="email"
                        placeholder="doctor@specialist.com"
                        value={assignDoctorForm.external_email}
                        onChange={e => setAssignDoctorForm({ ...assignDoctorForm, external_email: e.target.value })}
                        className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_primary_checkbox"
                  checked={assignDoctorForm.is_primary}
                  onChange={e => setAssignDoctorForm({ ...assignDoctorForm, is_primary: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-purple-500 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="is_primary_checkbox" className="font-bold text-slate-200 cursor-pointer select-none">
                  Set as Lead / Primary Specialist for this Clinic
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <Btn type="button" variant="secondary" size="sm" onClick={() => setShowAssignDoctorModal(false)}>
                Cancel
              </Btn>
              <Btn type="submit" variant="primary" size="sm" disabled={assigningDoctor}>
                {assigningDoctor ? 'Assigning...' : 'Assign to Duty'}
              </Btn>
            </div>
          </form>
        </div>
      )}

      {/* ── EDIT CLINIC MODAL ── */}
      {showEditClinicModal && editingClinic && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleUpdateClinic} className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleUp text-slate-100">
            <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
              <Building className="w-5 h-5 text-purple-400" /> Edit Special Clinic Settings
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-400 block mb-1">Clinic Name</label>
                <input
                  type="text"
                  required
                  value={editingClinic.name || ''}
                  onChange={e => setEditingClinic({ ...editingClinic, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-400 block mb-1">Head Doctor / Consultant</label>
                <select
                  value={editingClinic.head_doctor_id || ''}
                  onChange={e => setEditingClinic({ ...editingClinic, head_doctor_id: e.target.value || null })}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 outline-none focus:border-purple-500"
                >
                  <option value="" className="bg-slate-900 text-slate-100" style={{ background: '#0f172a', color: '#f8fafc' }}>-- No Head Doctor Assigned --</option>
                  {availableDoctors.map(doc => (
                    <option key={doc.id} value={doc.id} className="bg-slate-900 text-slate-100" style={{ background: '#0f172a', color: '#f8fafc' }}>
                      {doc.full_name} ({doc.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Consultation Fee (KES)</label>
                  <input
                    type="number"
                    value={editingClinic.consultation_fee || 0}
                    onChange={e => setEditingClinic({ ...editingClinic, consultation_fee: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 outline-none font-mono focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Location / Room</label>
                  <input
                    type="text"
                    value={editingClinic.location || ''}
                    onChange={e => setEditingClinic({ ...editingClinic, location: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-400 block mb-1">Working Days</label>
                <input
                  type="text"
                  value={editingClinic.working_days || ''}
                  onChange={e => setEditingClinic({ ...editingClinic, working_days: e.target.value })}
                  placeholder="e.g. Mon,Tue,Wed,Thu,Fri"
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="edit_is_active"
                  checked={editingClinic.is_active !== false}
                  onChange={e => setEditingClinic({ ...editingClinic, is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-purple-500 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="edit_is_active" className="font-bold text-slate-200 cursor-pointer select-none">
                  Clinic is Active
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <Btn type="button" variant="secondary" size="sm" onClick={() => { setShowEditClinicModal(false); setEditingClinic(null); }}>
                Cancel
              </Btn>
              <Btn type="submit" variant="primary" size="sm">
                Save Changes
              </Btn>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
