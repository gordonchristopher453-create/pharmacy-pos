import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api';
import toast from 'react-hot-toast';
import ClinicalTimeline from '../components/ClinicalTimeline';
import ICD10Search from '../components/ICD10Search';
import { 
  Plus, X, Loader, RefreshCw, Search, BedDouble, Users, Settings,
  Activity, ClipboardList, Pill, Stethoscope, TestTube, AlertTriangle,
  CheckCircle2, Clock, Calendar, ArrowLeft, Printer, UserCheck,
  ShieldAlert, Heart, Thermometer, FileText, DollarSign, Filter,
  Layers, LayoutGrid, List, Sparkles, ChevronRight, Check, Droplets, User,
  ArrowRightLeft, Receipt
} from 'lucide-react';
import { printTreatmentSummary } from '../utils/printTreatmentSummary';
import { printInpatientBill } from '../utils/printInpatientBill';

const getAge = dob => {
  if (!dob) return '—';
  const y = Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000));
  return y < 1 ? Math.floor((Date.now() - new Date(dob)) / (30.44 * 24 * 60 * 60 * 1000)) + 'mo' : y + 'y';
};

const getLengthOfStay = admittedAt => {
  if (!admittedAt) return 'Just Admitted';
  const diffMs = Date.now() - new Date(admittedAt).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (days === 0) return `${hours} hrs admitted`;
  return `${days}d ${remainingHours}h admitted`;
};

const Card = ({ children, className = '', style = {}, ...props }) => (
  <div 
    className={`bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] transition-all duration-200 ${className}`} 
    style={style} 
    {...props}
  >
    {children}
  </div>
);

const Btn = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
  const base = "inline-flex items-center gap-2 rounded-xl font-bold transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none";
  const sizes = {
    sm: "px-3.5 py-1.5 text-xs font-bold",
    md: "px-4.5 py-2.5 text-sm font-bold",
    lg: "px-6 py-3 text-base font-bold"
  };
  const variants = {
    primary: "bg-[var(--accent)] text-[#0F1612] hover:brightness-105 shadow-sm active:scale-95",
    secondary: "bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--border)] active:scale-95",
    ghost: "bg-transparent text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--bg-elevated)] active:scale-95",
    danger: "bg-red-500/15 text-red-500 border border-red-500/30 hover:bg-red-500/25 active:scale-95",
    success: "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/25 active:scale-95",
    warning: "bg-amber-500/15 text-amber-500 border border-amber-500/30 hover:bg-amber-500/25 active:scale-95"
  };
  return (
    <button 
      {...props} 
      className={`${base} ${sizes[size] || sizes.md} ${variants[variant] || variants.primary} ${className}`}
    >
      {children}
    </button>
  );
};

const inpStyle = "w-full px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-all placeholder:text-[var(--text-muted)]";

export default function InpatientPage() {
  const { user } = useSelector(s => s.auth);
  const userRole = (user?.role || '').toLowerCase();
  const isDoctor = ['doctor', 'admin', 'super_admin', 'facility_admin'].includes(userRole) || userRole.includes('doc') || userRole.includes('physician');
  const isNurse = userRole.includes('nurse');
  const isBillingStaff = ['cashier', 'receptionist', 'accountant', 'billing', 'admin', 'super_admin', 'facility_admin'].includes(userRole);
  const defaultNoteType = isNurse ? 'nurse_shift' : isDoctor ? 'doctor_review' : 'general';

  const [tab, setTab] = useState('patients'); // 'patients' | 'map' | 'wards' | 'queue'
  const [inpatients, setInpatients] = useState([]);
  const [wards, setWards] = useState([]);
  const [selectedWard, setSelectedWard] = useState(null);
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [wardFilter, setWardFilter] = useState('ALL');
  const [acuityFilter, setAcuityFilter] = useState('ALL');

  // Modals & Drawers
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [showWardModal, setShowWardModal] = useState(false);
  const [admitVisitId, setAdmitVisitId] = useState('');
  const [admitBedId, setAdmitBedId] = useState('');
  const [admitNotes, setAdmitNotes] = useState('');
  const [admitPaymentMethod, setAdmitPaymentMethod] = useState('insurance');
  const [admitInsuranceProvider, setAdmitInsuranceProvider] = useState('SHA / Social Health Authority');
  const [admitMemberNumber, setAdmitMemberNumber] = useState('');
  const [admitAuthCode, setAdmitAuthCode] = useState('');
  const [admitCopayAmount, setAdmitCopayAmount] = useState('');
  const [wardQueue, setWardQueue] = useState([]);
  const [saving, setSaving] = useState(false);
  const [wardForm, setWardForm] = useState({ name: '', ward_type: 'general', total_beds: 10 });

  // Selected Inpatient EHR Chart
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [detailTab, setDetailTab] = useState('notes'); // 'notes' | 'meds' | 'labs' | 'procs' | 'vitals' | 'billing'
  const [acuityState, setAcuityState] = useState('stable'); // 'stable' | 'monitoring' | 'critical' | 'discharge_ready'

  // Detailed Record States
  const [nursingNotes, setNursingNotes] = useState([]);
  const [drugOrders, setDrugOrders] = useState([]);
  const [labRequests, setLabRequests] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [vitalsHistory, setVitalsHistory] = useState([]);
  const [billingItems, setBillingItems] = useState([]);

  // Form States
  const [newNote, setNewNote] = useState({ notes: '', note_type: defaultNoteType });
  const [newOrder, setNewOrder] = useState({ drug_name: '', dosage: '', route: 'IV', frequency: '', duration: '', quantity: '1', product_id: null });
  const [newLab, setNewLab] = useState({ test_name: '', test_code: '', notes: '', urgency: 'routine' });
  const [newProcedure, setNewProcedure] = useState({ procedure_name: '', procedure_code: '', notes: '' });
  const [newVitals, setNewVitals] = useState({
    blood_pressure_systolic: '', blood_pressure_diastolic: '',
    pulse_rate: '', temperature: '', oxygen_saturation: '',
    respiratory_rate: '', blood_sugar: '', urine_output: ''
  });

  // Pharmacy Inventory Stock Search States
  const [pharmacyStockSearch, setPharmacyStockSearch] = useState('');
  const [pharmacyStockResults, setPharmacyStockResults] = useState([]);
  const [searchingStock, setSearchingStock] = useState(false);
  const [selectedStockProduct, setSelectedStockProduct] = useState(null);

  // Nurse MAR Administration Modal State
  const [selectedOrderToAdminister, setSelectedOrderToAdminister] = useState(null);
  const [nurseAdminReport, setNurseAdminReport] = useState('');

  const [noteSaving, setNoteSaving] = useState(false);
  const [orderSaving, setOrderSaving] = useState(false);
  const [labSaving, setLabSaving] = useState(false);
  const [procedureSaving, setProcedureSaving] = useState(false);
  const [vitalsSaving, setVitalsSaving] = useState(false);
  const [administering, setAdministering] = useState(null);

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showLabForm, setShowLabForm] = useState(false);
  const [showProcedureForm, setShowProcedureForm] = useState(false);
  const [showVitalsForm, setShowVitalsForm] = useState(false);

  // Admission Notes & Management Plan Modal State
  const [showAdmitNotesModal, setShowAdmitNotesModal] = useState(false);
  const [admitNotesForm, setAdmitNotesForm] = useState({ admission_notes: '', management_plan: '' });
  const [admitNotesSaving, setAdmitNotesSaving] = useState(false);
  const [noteRoleFilter, setNoteRoleFilter] = useState('all'); // 'all', 'doctor', 'nurse'

  // Payment & Deposit Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payForm, setPayForm] = useState({ payment_method: 'cash', amount: '', reference_number: '', notes: '' });
  const [paySaving, setPaySaving] = useState(false);
  const [selectedPayItems, setSelectedPayItems] = useState([]);

  // Inpatient Discharge Modal State
  const [showDischargeModal, setShowDischargeModal] = useState(false);

  const openPaymentModal = () => {
    const vid = selectedPatient?.current_visit_id || selectedPatient?.visit_id;
    if (!vid) return toast.error('Visit ID not found');
    const pendingItems = (billingItems || []).filter(i => i.status === 'pending' || i.status === 'partial');
    const pendingSum = pendingItems.reduce((s, i) => {
      const tot = parseFloat(i.unit_price || 0) * (parseInt(i.quantity) || 1);
      const paid = parseFloat(i.paid_amount || 0);
      return s + Math.max(0, tot - paid);
    }, 0);
    setSelectedPayItems(pendingItems.map(i => i.id));
    setPayForm({
      payment_method: 'cash',
      amount: pendingSum > 0 ? String(pendingSum) : '',
      reference_number: '',
      notes: ''
    });
    setShowPaymentModal(true);
  };

  const handleRecordInpatientPayment = async () => {
    const vid = selectedPatient?.current_visit_id || selectedPatient?.visit_id;
    if (!vid) return toast.error('Visit ID missing');
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) return toast.error('Enter a valid payment / deposit amount');

    setPaySaving(true);
    try {
      await api.post(`/billing/visit/${vid}/pay`, {
        payment_method: payForm.payment_method,
        amount: payForm.amount,
        reference_number: payForm.reference_number,
        notes: payForm.notes,
        item_ids: selectedPayItems
      });

      toast.success(`Payment / Deposit of KES ${parseFloat(payForm.amount).toLocaleString()} recorded!`);
      setShowPaymentModal(false);

      // Refresh billing items
      const billRes = await api.get(`/billing/visit/${vid}`);
      const updatedItems = billRes.data?.data?.items || billRes.data?.data || [];
      setBillingItems(Array.isArray(updatedItems) ? updatedItems : []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setPaySaving(false);
    }
  };

  const handleSaveManagementPlan = async () => {
    const admitId = selectedPatient?.admission_id || selectedPatient?.id;
    if (!admitId) return toast.error('No admission record found');
    setAdmitNotesSaving(true);
    try {
      await api.put(`/inpatient/admissions/${admitId}/management-plan`, admitNotesForm);
      toast.success('Admission notes & management plan saved successfully');
      setSelectedPatient(p => ({ ...p, admission_notes: admitNotesForm.admission_notes, management_plan: admitNotesForm.management_plan }));
      setShowAdmitNotesModal(false);
    } catch { toast.error('Failed to update management plan'); }
    finally { setAdmitNotesSaving(false); }
  };

  const [servicePrices, setServicePrices] = useState([]);
  const [procOutcomeNotes, setProcOutcomeNotes] = useState({});
  const [completingProc, setCompletingProc] = useState(null);

  const fetchServicePrices = async () => {
    try {
      const { data } = await api.get('/billing/service-prices');
      setServicePrices(data.data || []);
    } catch {}
  };

  useEffect(() => {
    fetchData();
    fetchServicePrices();
    fetchAdmitQueue();
  }, [tab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ptsRes, wardsRes] = await Promise.all([
        api.get('/inpatient/patients'),
        api.get('/inpatient/wards')
      ]);
      setInpatients(ptsRes.data.data || []);
      setWards(wardsRes.data.data || []);
    } catch (e) {
      toast.error('Failed to load inpatient ward data');
    } finally {
      setLoading(false);
    }
  };

  const fetchWardBeds = async (ward) => {
    setSelectedWard(ward);
    try {
      const res = await api.get(`/inpatient/wards/${ward.id}/beds`);
      setBeds(res.data.data || []);
    } catch {
      toast.error('Failed to load ward beds');
    }
  };

  const fetchAdmitQueue = async () => {
    try {
      const res = await api.get('/patients/visits?status=admitted');
      setWardQueue(res.data.data?.visits || []);
    } catch {}
  };

  const openPatient = async (patient) => {
    setSelectedPatient(patient);
    setDetailTab('notes');
    setAcuityState(patient.priority === 'emergency' ? 'critical' : 'stable');
    
    const bedId = patient.bed_id || patient.id;
    const visitId = patient.current_visit_id || patient.visit_id;

    if (!bedId && !visitId) {
      toast.error('Unable to locate admission details for this patient');
      return;
    }

    try {
      const requests = [
        bedId ? api.get(`/inpatient/${bedId}/nursing-notes`).catch(() => ({ data: { data: [] } })) : Promise.resolve({ data: { data: [] } }),
        visitId ? api.get(`/inpatient/visit/${visitId}/orders`).catch(() => ({ data: { data: [] } })) : Promise.resolve({ data: { data: [] } }),
        visitId ? api.get(`/inpatient/visit/${visitId}/lab-requests`).catch(() => ({ data: { data: [] } })) : Promise.resolve({ data: { data: [] } }),
        visitId ? api.get(`/inpatient/visit/${visitId}/procedures`).catch(() => ({ data: { data: [] } })) : Promise.resolve({ data: { data: [] } }),
        visitId ? api.get(`/patients/visits/${visitId}/vitals`).catch(() => ({ data: { data: [] } })) : Promise.resolve({ data: { data: [] } }),
        visitId ? api.get(`/billing/visit/${visitId}`).catch(() => ({ data: { data: { items: [] } } })) : Promise.resolve({ data: { data: { items: [] } } })
      ];

      const [notesRes, ordersRes, labsRes, procsRes, vitalsRes, billRes] = await Promise.allSettled(requests);

      setNursingNotes(notesRes.status === 'fulfilled' && notesRes.value?.data?.data ? notesRes.value.data.data : []);
      setDrugOrders(ordersRes.status === 'fulfilled' && ordersRes.value?.data?.data ? ordersRes.value.data.data : []);
      setLabRequests(labsRes.status === 'fulfilled' && labsRes.value?.data?.data ? labsRes.value.data.data : []);
      setProcedures(procsRes.status === 'fulfilled' && procsRes.value?.data?.data ? procsRes.value.data.data : []);
      setVitalsHistory(vitalsRes.status === 'fulfilled' && vitalsRes.value?.data?.data ? vitalsRes.value.data.data : []);
      
      const billData = billRes.status === 'fulfilled' && billRes.value?.data?.data ? (billRes.value.data.data.items || billRes.value.data.data) : [];
      setBillingItems(Array.isArray(billData) ? billData : []);
    } catch (err) {
      console.error('Error fetching patient records:', err);
    }
  };

  // Record Handlers
  const addNursingNote = async () => {
    if (!newNote.notes.trim()) return toast.error('Enter note details or clinical observations first');
    const bedId = selectedPatient?.bed_id || selectedPatient?.id || selectedPatient?.current_visit_id || selectedPatient?.visit_id;
    if (!bedId) return toast.error('Missing bed or visit ID');
    setNoteSaving(true);
    try {
      const payload = {
        notes: newNote.notes,
        note_type: newNote.note_type || defaultNoteType
      };
      const res = await api.post(`/inpatient/${bedId}/nursing-notes`, payload);
      const savedNote = res.data?.data || {};
      setNursingNotes(p => [savedNote, ...p]);
      setNewNote({ notes: '', note_type: defaultNoteType });
      setShowNoteForm(false);
      toast.success('Clinical note saved successfully');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to save note');
    } finally {
      setNoteSaving(false);
    }
  };

  const searchPharmacyStock = async (query) => {
    setPharmacyStockSearch(query);
    setNewOrder(p => ({ ...p, drug_name: query, product_id: null }));
    setSelectedStockProduct(null);
    if (!query || query.length < 2) {
      setPharmacyStockResults([]);
      return;
    }
    setSearchingStock(true);
    try {
      const res = await api.get(`/products?search=${encodeURIComponent(query)}&limit=8`);
      setPharmacyStockResults(res.data.data || []);
    } catch {
      setPharmacyStockResults([]);
    } finally {
      setSearchingStock(false);
    }
  };

  const selectStockProduct = (product) => {
    setSelectedStockProduct(product);
    setPharmacyStockSearch(product.name);
    setPharmacyStockResults([]);

    // Extract dosage / strength pattern if present
    const dosageRegex = /(\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|iu|units|%)(?:\/\d+\s*(?:ml|g))?)/gi;
    const match = (product.name || '').match(dosageRegex);
    const parsedDosage = match ? match[0] : '';

    let route = 'IV';
    const lname = (product.name || '').toLowerCase();
    if (lname.includes('inj') || lname.includes('vial') || lname.includes('amp')) route = 'IV';
    else if (lname.includes('syrup') || lname.includes('tab') || lname.includes('cap')) route = 'Oral';
    else if (lname.includes('cream') || lname.includes('ointment')) route = 'Topical';

    setNewOrder(p => ({
      ...p,
      product_id: product.id,
      drug_name: product.name,
      dosage: parsedDosage || p.dosage || '500mg',
      route: route,
      quantity: '1'
    }));

    if (parseFloat(product.total_stock || 0) <= 0) {
      toast.error(`Warning: ${product.name} is currently OUT OF STOCK in pharmacy!`, { duration: 4000 });
    }
  };

  const addDrugOrder = async () => {
    if (!newOrder.drug_name.trim()) return toast.error('Drug name required');
    if (selectedStockProduct && parseFloat(selectedStockProduct.total_stock || 0) <= 0) {
      return toast.error('Cannot prescribe drug that is out of stock in pharmacy!');
    }
    const visitId = selectedPatient?.current_visit_id || selectedPatient?.visit_id;
    if (!visitId) return toast.error('Missing visit ID');
    setOrderSaving(true);
    try {
      const res = await api.post(`/inpatient/visit/${visitId}/orders`, newOrder);
      setDrugOrders(p => [res.data.data, ...p]);
      setNewOrder({ drug_name: '', dosage: '', route: 'IV', frequency: '', duration: '', quantity: '1', product_id: null });
      setPharmacyStockSearch('');
      setSelectedStockProduct(null);
      setShowOrderForm(false);
      toast.success('Doctor drug prescription added to MAR');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add drug order');
    } finally {
      setOrderSaving(false);
    }
  };

  const handleConfirmAdminister = async () => {
    if (!selectedOrderToAdminister) return;
    const orderId = selectedOrderToAdminister.id;
    const visitId = selectedPatient?.current_visit_id || selectedPatient?.visit_id;
    const bedId = selectedPatient?.bed_id;
    setAdministering(orderId);

    try {
      const reportText = nurseAdminReport.trim() || 'Medication administered as per MAR doctor prescription.';
      await api.put(`/inpatient/orders/${orderId}/administer`, {
        nurse_report: reportText,
        notes: reportText
      });

      setDrugOrders(p => p.map(o => o.id === orderId ? { 
        ...o, 
        status: 'administered', 
        administered_at: new Date().toISOString(),
        administered_by_name: user?.full_name || 'Nurse'
      } : o));

      // Auto log nursing shift note
      if (bedId) {
        api.post(`/inpatient/${bedId}/nursing-notes`, {
          notes: `💊 [MEDICATION ADMINISTERED] ${selectedOrderToAdminister.drug_name} (${selectedOrderToAdminister.dosage || ''}) - ${reportText}`,
          note_type: 'mar_admin'
        }).then(res => {
          if (res.data?.data) setNursingNotes(n => [res.data.data, ...n]);
        }).catch(() => {});
      }

      toast.success('Medication administered & pharmacy stock deducted');
      setSelectedOrderToAdminister(null);
      setNurseAdminReport('');

      if (visitId) {
        api.get(`/billing/visit/${visitId}`).then(r => setBillingItems(r.data?.data?.items || r.data?.data || [])).catch(() => {});
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to administer medication');
    } finally {
      setAdministering(null);
    }
  };

  const addLabRequest = async () => {
    if (!newLab.test_name.trim()) return toast.error('Lab test name required');
    const visitId = selectedPatient?.current_visit_id || selectedPatient?.visit_id;
    if (!visitId) return toast.error('Missing visit ID');
    setLabSaving(true);
    try {
      const res = await api.post(`/inpatient/visit/${visitId}/lab-requests`, newLab);
      setLabRequests(p => [res.data.data, ...p]);
      setNewLab({ test_name: '', test_code: '', notes: '', urgency: 'routine' });
      setShowLabForm(false);
      toast.success('Lab test order submitted');
      if (visitId) {
        api.get(`/billing/visit/${visitId}`).then(r => setBillingItems(r.data?.data?.items || r.data?.data || [])).catch(()=>{});
      }
    } catch {
      toast.error('Failed to order lab test');
    } finally {
      setLabSaving(false);
    }
  };

  const addProcedure = async () => {
    if (!newProcedure.procedure_name.trim()) return toast.error('Procedure name required');
    const visitId = selectedPatient?.current_visit_id || selectedPatient?.visit_id;
    if (!visitId) return toast.error('Missing visit ID');
    setProcedureSaving(true);
    try {
      const res = await api.post(`/inpatient/visit/${visitId}/procedures`, newProcedure);
      setProcedures(p => [res.data.data, ...p]);
      setNewProcedure({ procedure_name: '', procedure_code: '', notes: '' });
      setShowProcedureForm(false);
      toast.success('Procedure order submitted');
      if (visitId) {
        api.get(`/billing/visit/${visitId}`).then(r => setBillingItems(r.data?.data?.items || r.data?.data || [])).catch(()=>{});
      }
    } catch {
      toast.error('Failed to order procedure');
    } finally {
      setProcedureSaving(false);
    }
  };

  const handleCompleteProcedure = async (procedureId) => {
    const outcomeText = procOutcomeNotes[procedureId] || '';
    if (!outcomeText.trim()) return toast.error('Enter outcome details or notes to complete procedure');
    setCompletingProc(procedureId);
    try {
      const res = await api.put(`/inpatient/procedures/${procedureId}/complete`, {
        outcome: 'Completed: ' + outcomeText,
        notes: outcomeText
      });
      setProcedures(p => p.map(item => item.id === procedureId ? { ...item, outcome: res.data.data.outcome, notes: res.data.data.notes } : item));
      toast.success('Procedure completed and recorded');
    } catch {
      toast.error('Failed to complete procedure');
    } finally {
      setCompletingProc(null);
    }
  };

  const addVitalsRecord = async () => {
    if (!newVitals.blood_pressure_systolic && !newVitals.temperature && !newVitals.pulse_rate) {
      return toast.error('Enter at least one vital sign reading');
    }
    const visitId = selectedPatient?.current_visit_id || selectedPatient?.visit_id;
    if (!visitId) return toast.error('Missing visit ID');
    setVitalsSaving(true);
    try {
      const res = await api.post(`/patients/visits/${visitId}/vitals`, newVitals);
      setVitalsHistory(p => [res.data.data, ...p]);
      setNewVitals({
        blood_pressure_systolic: '', blood_pressure_diastolic: '',
        pulse_rate: '', temperature: '', oxygen_saturation: '',
        respiratory_rate: '', blood_sugar: '', urine_output: ''
      });
      setShowVitalsForm(false);
      toast.success('Vitals recorded');
    } catch {
      toast.error('Failed to record vitals');
    } finally {
      setVitalsSaving(false);
    }
  };

  const openAdmitModal = async (bedId) => {
    setAdmitBedId(bedId);
    setAdmitVisitId('');
    setAdmitNotes('');
    setAdmitPaymentMethod('insurance');
    setAdmitInsuranceProvider('SHA / Social Health Authority');
    setAdmitMemberNumber('');
    setAdmitAuthCode('');
    setAdmitCopayAmount('');
    await fetchAdmitQueue();
    setShowAdmitModal(true);
  };

  const admitPatient = async () => {
    if (!admitVisitId || !admitBedId) return toast.error('Select a patient');
    setSaving(true);
    try {
      await api.post('/inpatient/admit', { 
        visit_id: admitVisitId, 
        bed_id: admitBedId, 
        notes: admitNotes,
        payment_method: admitPaymentMethod,
        insurance_provider: admitPaymentMethod === 'cash' ? 'Cash Tender' : admitInsuranceProvider,
        member_number: admitMemberNumber,
        auth_code: admitAuthCode,
        copay_amount: admitCopayAmount
      });
      toast.success('Patient admitted to ward with insurance cover details!');
      setShowAdmitModal(false);
      if (selectedWard) fetchWardBeds(selectedWard);
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to admit patient');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintDischargeSummary = async (targetPatient) => {
    const p = targetPatient || selectedPatient;
    if (!p) return toast.error('No patient selected');
    const visitId = p.current_visit_id || p.visit_id;
    const patientId = p.patient_id || p.id;

    const toastId = toast.loading('Compiling Patient Discharge Treatment Summary...');
    try {
      const [visRes, patRes, conRes, ordersRes, labsRes, procsRes, notesRes, vitalsRes] = await Promise.allSettled([
        visitId ? api.get(`/patients/visits/${visitId}`) : Promise.resolve({ data: { data: {} } }),
        patientId ? api.get(`/patients/${patientId}`) : Promise.resolve({ data: { data: {} } }),
        visitId ? api.get(`/consultations/visit/${visitId}`) : Promise.resolve({ data: { data: {} } }),
        visitId ? api.get(`/inpatient/visit/${visitId}/orders`) : Promise.resolve({ data: { data: [] } }),
        visitId ? api.get(`/inpatient/visit/${visitId}/lab-requests`) : Promise.resolve({ data: { data: [] } }),
        visitId ? api.get(`/inpatient/visit/${visitId}/procedures`) : Promise.resolve({ data: { data: [] } }),
        (p.id || visitId) ? api.get(`/inpatient/${p.id || visitId}/nursing-notes`) : Promise.resolve({ data: { data: [] } }),
        visitId ? api.get(`/patients/visits/${visitId}/vitals`) : Promise.resolve({ data: { data: [] } }),
      ]);

      const visitData = visRes.status === 'fulfilled' ? (visRes.value.data?.data || {}) : {};
      const patientData = patRes.status === 'fulfilled' ? (patRes.value.data?.data || {}) : {};
      const consultation = conRes.status === 'fulfilled' ? (conRes.value.data?.data || {}) : {};
      const inpatientOrders = ordersRes.status === 'fulfilled' ? (ordersRes.value.data?.data || []) : [];
      const inpatientLabs = labsRes.status === 'fulfilled' ? (labsRes.value.data?.data || []) : [];
      const inpatientProcs = procsRes.status === 'fulfilled' ? (procsRes.value.data?.data || []) : [];
      const nursingNotes = notesRes.status === 'fulfilled' ? (notesRes.value.data?.data || []) : [];
      const vitalsList = vitalsRes.status === 'fulfilled' ? (vitalsRes.value.data?.data || []) : [];

      // Combine lab requests from consultation and inpatient requests
      const opdLabs = consultation.lab_requests || [];
      const allLabsMap = new Map();
      [...opdLabs, ...inpatientLabs, ...labRequests].forEach(l => {
        if (l.id) allLabsMap.set(l.id, l);
        else if (l.test_name) allLabsMap.set(l.test_name + (l.created_at || ''), l);
      });

      const detail = {
        patient: { ...p, ...patientData },
        visit: { ...p, ...visitData },
        consultation: consultation,
        prescriptions: consultation.prescriptions || [],
        injection_orders: inpatientOrders.length > 0 ? inpatientOrders : drugOrders,
        lab_requests: Array.from(allLabsMap.values()),
        procedures: inpatientProcs.length > 0 ? inpatientProcs : procedures,
        nursing_notes: nursingNotes.length > 0 ? nursingNotes : nursingNotesList,
        vitals: vitalsList.length > 0 ? vitalsList : vitalsHistory,
        patient_name: p.patient_name || patientData.full_name || p.full_name,
        is_discharge: true
      };

      toast.dismiss(toastId);
      printTreatmentSummary(detail, user?.pharmacy);
    } catch (err) {
      toast.dismiss(toastId);
      console.error('Failed to fetch discharge summary data:', err);
      toast.error('Opening summary...');
      printTreatmentSummary({ patient: p, vitals: vitalsHistory, patient_name: p.patient_name }, user?.pharmacy);
    }
  };

  const dischargePatient = async (visitId, patientName) => {
    if (!window.confirm(`Discharge ${patientName} from inpatient care?`)) return;
    try {
      const res = await api.put(`/inpatient/discharge/${visitId}`);
      const disData = res.data?.data || {};
      toast.success('Patient discharged & full treatment invoice compiled!');

      // Auto-print full inpatient treatment invoice & statement of account
      try {
        const invPatient = disData.patient || selectedPatient || { patient_name: patientName };
        const invBilling = disData.billing_items || billingItems || [];
        const invOrders = disData.drug_orders || drugOrders || [];
        const invLabs = disData.lab_requests || labRequests || [];
        const invProcs = disData.procedures || procedures || [];
        printInpatientBill(invPatient, invBilling, invOrders, invLabs, invProcs, user?.pharmacy, user);
      } catch (invErr) {
        console.error('Failed to print full treatment invoice:', invErr);
      }

      // Auto-generate Patient Clinical Treatment Summary
      try {
        await handlePrintDischargeSummary(selectedPatient);
      } catch (sumErr) {
        console.error('Failed to autogenerate treatment summary:', sumErr);
      }

      fetchData();
      if (selectedWard) fetchWardBeds(selectedWard);
      if (selectedPatient?.current_visit_id === visitId || selectedPatient?.visit_id === visitId) setSelectedPatient(null);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to discharge patient');
    }
  };

  const createWard = async () => {
    if (!wardForm.name) return toast.error('Ward name required');
    setSaving(true);
    try {
      await api.post('/inpatient/wards', wardForm);
      toast.success(`Ward ${wardForm.name} created with ${wardForm.total_beds} beds!`);
      setShowWardModal(false);
      setWardForm({ name: '', ward_type: 'general', total_beds: 10 });
      fetchData();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to create ward');
    } finally {
      setSaving(false);
    }
  };

  // Filtered Lists
  const filteredInpatients = inpatients.filter(p => {
    const matchesSearch = !search ||
      p.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.patient_number?.toLowerCase().includes(search.toLowerCase()) ||
      p.ward_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.bed_number?.toLowerCase().includes(search.toLowerCase()) ||
      p.diagnosis?.toLowerCase().includes(search.toLowerCase());

    const matchesWard = wardFilter === 'ALL' || p.ward_name === wardFilter;
    const matchesAcuity = acuityFilter === 'ALL' || 
      (acuityFilter === 'HIGH' && p.priority === 'emergency') ||
      (acuityFilter === 'STABLE' && p.priority !== 'emergency');

    return matchesSearch && matchesWard && matchesAcuity;
  });

  const totalBeds = wards.reduce((s, w) => s + parseInt(w.total_beds || 0), 0);
  const occupiedBeds = wards.reduce((s, w) => s + parseInt(w.occupied_beds || 0), 0);
  const availableBeds = wards.reduce((s, w) => s + parseInt(w.available_beds || 0), 0);
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  const proceduresList = servicePrices.filter(s =>
    s.is_active && (
      s.category?.toLowerCase()?.includes('proc') ||
      s.category?.toLowerCase()?.includes('surg') ||
      s.name?.toLowerCase()?.includes('proc') ||
      s.name?.toLowerCase()?.includes('dressing') ||
      s.name?.toLowerCase()?.includes('injection') ||
      s.name?.toLowerCase()?.includes('care')
    )
  );

  const labsList = servicePrices.filter(s =>
    s.is_active && (
      s.category?.toLowerCase()?.includes('lab') ||
      s.category?.toLowerCase()?.includes('test') ||
      s.category?.toLowerCase()?.includes('scan') ||
      s.name?.toLowerCase()?.includes('blood') ||
      s.name?.toLowerCase()?.includes('urine') ||
      s.name?.toLowerCase()?.includes('culture')
    )
  );

  // ═════════════════════════════════════════════════════════════════════════
  // PATIENT ELECTRONIC HEALTH RECORD (EHR) CHART VIEW
  // ═════════════════════════════════════════════════════════════════════════
  if (selectedPatient) {
    const totalBilled = (billingItems || []).reduce((acc, item) => acc + (parseFloat(item?.unit_price || 0) * (parseInt(item?.quantity) || 1)), 0);
    const paidBilled = (billingItems || []).filter(i => i?.status === 'paid').reduce((acc, item) => acc + (parseFloat(item?.unit_price || 0) * (parseInt(item?.quantity) || 1)), 0);
    const pendingBilled = totalBilled - paidBilled;

    const acuityBadges = {
      stable: { label: '🟢 Stable Condition', bg: 'bg-emerald-500/15', text: 'text-emerald-500', border: 'border-emerald-500/30' },
      monitoring: { label: '🟡 Active Monitoring', bg: 'bg-amber-500/15', text: 'text-amber-500', border: 'border-amber-500/30' },
      critical: { label: '🔴 High Priority / Critical', bg: 'bg-red-500/15', text: 'text-red-500', border: 'border-red-500/30' },
      discharge_ready: { label: '🔵 Ready for Discharge', bg: 'bg-blue-500/15', text: 'text-blue-500', border: 'border-blue-500/30' }
    };
    const currentBadge = acuityBadges[acuityState] || acuityBadges.stable;

    return (
      <div className="w-full min-h-full p-4 sm:p-6 lg:p-8 space-y-6 pb-20">
        {/* Top Header Workspace Navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-surface)] p-5 sm:p-6 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center gap-4">
            <Btn variant="ghost" size="sm" onClick={() => setSelectedPatient(null)}>
              <ArrowLeft className="w-4 h-4"/> Back to Roster
            </Btn>
            <div className="h-6 w-px bg-[var(--border)] hidden sm:block"/>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-black text-[var(--text-primary)]">
                  🛏️ {selectedPatient.patient_name}
                </h1>
                <span className="px-2.5 py-1 rounded-md bg-[var(--bg-elevated)] border border-[var(--border)] text-xs font-mono font-bold text-[var(--text-muted)]">
                  {selectedPatient.patient_number || selectedPatient.patient_id}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${currentBadge.bg} ${currentBadge.text} ${currentBadge.border}`}>
                  {currentBadge.label}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 mt-1.5 text-sm text-[var(--text-muted)] font-medium">
                <span className="font-bold text-[var(--accent)]">🏥 {selectedPatient.ward_name || 'Ward'}</span>
                <span>•</span>
                <span className="font-bold">Bed {selectedPatient.bed_number || 'N/A'}</span>
                <span>•</span>
                <span>{selectedPatient.gender || '—'}</span>
                <span>•</span>
                <span>{getAge(selectedPatient.date_of_birth)}</span>
                <span>•</span>
                <span className="text-[var(--text-primary)] font-medium">📞 {selectedPatient.phone || '—'}</span>
                {selectedPatient.blood_group && (
                  <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-500 font-bold text-xs">
                    🩸 {selectedPatient.blood_group}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Btn variant="ghost" size="sm" onClick={() => openPatient(selectedPatient)}>
              <RefreshCw className="w-4 h-4"/> Refresh
            </Btn>
            <Btn variant="secondary" size="sm" onClick={() => printInpatientBill(selectedPatient, billingItems, drugOrders, labRequests, procedures, user?.pharmacy, user)}>
              <Receipt className="w-4 h-4 text-emerald-400"/> Inpatient Invoice
            </Btn>
            <Btn variant="secondary" size="sm" onClick={() => handlePrintDischargeSummary(selectedPatient)}>
              <Printer className="w-4 h-4 text-emerald-400"/> Patient Discharge Treatment Summary
            </Btn>
            {isDoctor && (
              <Btn variant="danger" size="sm" onClick={() => dischargePatient(selectedPatient.current_visit_id || selectedPatient.visit_id, selectedPatient.patient_name)}>
                🏥 Discharge Inpatient
              </Btn>
            )}
          </div>
        </div>

        {/* Clinical Patient Overview Banner */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 sm:p-5 bg-[var(--bg-surface)] space-y-1">
            <span className="text-xs sm:text-sm font-semibold text-[var(--text-muted)] block">Admitted Length of Stay</span>
            <div className="text-xl font-black text-[var(--accent)] flex items-center gap-2">
              <Clock className="w-5 h-5"/> {getLengthOfStay(selectedPatient.admitted_at)}
            </div>
            <span className="text-xs text-[var(--text-muted)] block pt-1">
              Admitted: {selectedPatient.admitted_at ? new Date(selectedPatient.admitted_at).toLocaleString() : '—'}
            </span>
          </Card>

          <Card className="p-4 sm:p-5 bg-[var(--bg-surface)] space-y-1">
            <span className="text-xs sm:text-sm font-semibold text-[var(--text-muted)] block">Primary Admission Diagnosis</span>
            <div className="text-base font-bold text-[var(--text-primary)] line-clamp-2">
              {selectedPatient.diagnosis || selectedPatient.chief_complaint || 'N/A'}
            </div>
            {selectedPatient.allergies && (
              <span className="text-xs text-red-500 font-bold block pt-1">
                ⚠️ Allergies: {selectedPatient.allergies}
              </span>
            )}
          </Card>

          <Card className="p-4 sm:p-5 bg-[var(--bg-surface)] space-y-1">
            <span className="text-xs sm:text-sm font-semibold text-[var(--text-muted)] block">Attending Physician</span>
            <div className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-purple-400"/> Dr. {selectedPatient.doctor_name || 'Unassigned'}
            </div>
            <span className="text-xs text-[var(--text-muted)] block pt-1 font-mono">Visit #{selectedPatient.visit_number}</span>
          </Card>

          <Card className="p-4 sm:p-5 bg-[var(--bg-surface)] space-y-1">
            <span className="text-xs sm:text-sm font-semibold text-[var(--text-muted)] block">Patient Acuity Status</span>
            <select
              value={acuityState}
              onChange={e => setAcuityState(e.target.value)}
              className="w-full mt-1 px-3.5 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl text-sm font-bold text-[var(--text-primary)] outline-none"
            >
              <option value="stable">🟢 Stable Condition</option>
              <option value="monitoring">🟡 Active Monitoring</option>
              <option value="critical">🔴 High Priority / Critical</option>
              <option value="discharge_ready">🔵 Ready for Discharge</option>
            </select>
          </Card>
        </div>

        {/* PATIENT ADMISSION NOTES & MANAGEMENT PLAN BANNER */}
        <Card className="p-4 bg-[var(--bg-surface)] border-[var(--border)] rounded-2xl space-y-3">
          <div className="flex justify-between items-center flex-wrap gap-2 border-b border-[var(--border)] pb-2.5">
            <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--accent)]"/> Admission Notes & Inpatient Management Plan
            </h3>
            <Btn size="sm" variant="ghost" onClick={() => {
              setAdmitNotesForm({
                admission_notes: selectedPatient.admission_notes || '',
                management_plan: selectedPatient.management_plan || ''
              });
              setShowAdmitNotesModal(true);
            }}>
              ✏️ Edit Admission Notes & Plan
            </Btn>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] space-y-1">
              <span className="font-bold text-[var(--accent)] block uppercase text-[10px] tracking-wider">📝 Admission Notes / History & Examination</span>
              <p className="text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                {selectedPatient.admission_notes || 'No admission notes recorded yet. Click Edit to document patient history and physical exam at admission.'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] space-y-1">
              <span className="font-bold text-emerald-400 block uppercase text-[10px] tracking-wider">🎯 Inpatient Management & Treatment Plan</span>
              <p className="text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                {selectedPatient.management_plan || 'No management plan defined yet. Click Edit to outline daily targets, IV fluids, lab schedules & discharge goals.'}
              </p>
            </div>
          </div>
        </Card>

        {/* Tabbed Inpatient EHR Sections */}
        <div className="flex bg-[var(--bg-surface)] border border-[var(--border)] p-1.5 rounded-2xl gap-1.5 overflow-x-auto">
          {[
            { key: 'notes', label: '📋 Nursing & Clinical Notes', count: nursingNotes.length },
            { key: 'meds', label: '💊 Medication Orders (MAR)', count: drugOrders.length },
            { key: 'labs', label: '🔬 Lab Requests', count: labRequests.length },
            { key: 'procs', label: '🩺 Ward Procedures', count: procedures.length },
            { key: 'vitals', label: '🩺 Vitals & Chart', count: vitalsHistory.length },
            { key: 'billing', label: '🧾 Inpatient Bill', count: `KES ${totalBilled.toLocaleString()}` },
            { key: 'history', label: '📜 Full Medical History', count: 'Timeline' },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setDetailTab(key)}
              className={`px-4.5 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                detailTab === key 
                  ? 'bg-[var(--accent)] text-[#0F1612] shadow-sm' 
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <span>{label}</span>
              {count !== undefined && (
                <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${detailTab === key ? 'bg-black/20 text-black' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 2-COLUMN MAIN EHR WORKSPACE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main EHR Tab Content (8 Columns) */}
          <div className="lg:col-span-8 space-y-6">

        {/* SECTION 1: NURSING & CLINICAL NOTES */}
        {detailTab === 'notes' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)]">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-[var(--accent)]"/> Inpatient Daily Review & Clinical Notes
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Separate daily ward round notes for Doctors (SOAP review) and Nurses (shift treatment sheet & nursing logs).
                </p>
              </div>
              <div className="flex gap-2">
                <Btn size="sm" onClick={() => setShowNoteForm(p => !p)}>
                  <Plus className="w-3.5 h-3.5"/> + Add Clinical Note
                </Btn>
              </div>
            </div>

            {/* Note Role Filter Pills */}
            <div className="flex gap-2 border-b border-[var(--border)] pb-2">
              {[
                { id: 'all', label: 'All Daily Notes' },
                { id: 'doctor', label: '👨‍⚕️ Doctor Daily Review Notes' },
                { id: 'nurse', label: '👩‍⚕️ Nurse Treatment Sheet' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => {
                    setNoteRoleFilter(f.id);
                    if (f.id === 'doctor') {
                      setNewNote(p => ({ ...p, note_type: 'doctor_review' }));
                    } else if (f.id === 'nurse') {
                      setNewNote(p => ({ ...p, note_type: 'nurse_shift' }));
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    noteRoleFilter === f.id ? 'bg-[var(--accent)] text-[#0F1612]' : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {showNoteForm && (
              <Card className="p-5 bg-[var(--bg-elevated)] space-y-4 border-[var(--accent)]/50">
                <h4 className="text-sm font-bold text-[var(--text-primary)]">Record New Daily Clinical Note / Review</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">
                      Note Type & Category ({isNurse ? 'Nurse View' : isDoctor ? 'Doctor View' : 'General View'})
                    </label>
                    <select
                      value={newNote.note_type}
                      onChange={e => setNewNote(p => ({ ...p, note_type: e.target.value }))}
                      className={inpStyle}
                    >
                      {isNurse && noteRoleFilter !== 'doctor' ? (
                        <>
                          <option value="nurse_shift">👩‍⚕️ Nurse Shift Progress Note & Treatment Sheet</option>
                          <option value="medication">💊 Medication Administration Note</option>
                          <option value="vitals">🩺 Vitals & Fluid Intake/Output Log</option>
                          <option value="incident">⚠️ Special Directive / Incident</option>
                          <option value="doctor_review">👨‍⚕️ Doctor Daily Ward Round Note (SOAP)</option>
                        </>
                      ) : isDoctor || noteRoleFilter === 'doctor' ? (
                        <>
                          <option value="doctor_review">👨‍⚕️ Doctor Daily Ward Round Note (SOAP)</option>
                          <option value="nurse_shift">👩‍⚕️ Nurse Shift Progress Note & Treatment Sheet</option>
                          <option value="medication">💊 Medication Administration Note</option>
                          <option value="vitals">🩺 Vitals & Fluid Intake/Output Log</option>
                          <option value="incident">⚠️ Special Directive / Incident</option>
                        </>
                      ) : (
                        <>
                          <option value="doctor_review">👨‍⚕️ Doctor Daily Ward Round Note (SOAP)</option>
                          <option value="nurse_shift">👩‍⚕️ Nurse Shift Progress Note & Treatment Sheet</option>
                          <option value="general">📋 General Clinical Note</option>
                          <option value="medication">💊 Medication Administration Note</option>
                          <option value="vitals">🩺 Vitals & Fluid Intake/Output Log</option>
                          <option value="incident">⚠️ Special Directive / Incident</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Note Details / Clinical Observations *</label>
                  <textarea
                    value={newNote.notes}
                    onChange={e => setNewNote(p => ({ ...p, notes: e.target.value }))}
                    rows={4}
                    placeholder="Subjective complaints, objective findings, daily treatment plan, nursing interventions..."
                    className={inpStyle}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Btn variant="ghost" size="sm" onClick={() => setShowNoteForm(false)}>Cancel</Btn>
                  <Btn size="sm" onClick={addNursingNote} disabled={noteSaving}>
                    {noteSaving ? 'Saving Note...' : 'Save Clinical Note'}
                  </Btn>
                </div>
              </Card>
            )}

            {nursingNotes.filter(n => {
              const isDoctorAuthor = (n.nurse_name || '').toLowerCase().includes('dr') ||
                                     (n.nurse_name || '').toLowerCase().includes('doctor') ||
                                     (n.author_role || '').toLowerCase().includes('doc');
              const isDocNote = n.note_type === 'doctor_review' || isDoctorAuthor;
              if (noteRoleFilter === 'doctor') return isDocNote;
              if (noteRoleFilter === 'nurse') return !isDocNote;
              return true;
            }).length === 0 ? (
              <Card className="p-10 text-center text-[var(--text-muted)]">
                <ClipboardList className="w-8 h-8 opacity-20 mx-auto mb-2"/>
                No notes found matching selected filter.
              </Card>
            ) : (
              <div className="space-y-3">
                {nursingNotes.filter(n => {
                  const isDoctorAuthor = (n.nurse_name || '').toLowerCase().includes('dr') ||
                                         (n.nurse_name || '').toLowerCase().includes('doctor') ||
                                         (n.author_role || '').toLowerCase().includes('doc');
                  const isDocNote = n.note_type === 'doctor_review' || isDoctorAuthor;
                  if (noteRoleFilter === 'doctor') return isDocNote;
                  if (noteRoleFilter === 'nurse') return !isDocNote;
                  return true;
                }).map(n => {
                  const isDoctorAuthor = (n.nurse_name || '').toLowerCase().includes('dr') ||
                                         (n.nurse_name || '').toLowerCase().includes('doctor') ||
                                         (n.author_role || '').toLowerCase().includes('doc');
                  const isDocNote = n.note_type === 'doctor_review' || isDoctorAuthor;
                  return (
                    <Card key={n.id} className={`p-4 space-y-2 border-l-4 ${isDocNote ? 'border-l-purple-500' : 'border-l-emerald-500'}`}>
                      <div className="flex justify-between items-center text-xs">
                        <span className={`font-bold flex items-center gap-1.5 ${isDocNote ? 'text-purple-400' : 'text-emerald-400'}`}>
                          {isDocNote ? '👨‍⚕️ Doctor Daily Review Note' : '👩‍⚕️ Nurse Treatment Sheet'} • {n.nurse_name || 'Clinician'}
                        </span>
                        <span className="text-[var(--text-muted)] font-mono">
                          {new Date(n.created_at).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">{n.notes}</p>
                      <span className="inline-block px-2 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border)] text-[10px] text-[var(--text-muted)] uppercase font-mono">
                        Category: {isDocNote ? 'Doctor Review' : (n.note_type || 'Treatment Sheet')}
                      </span>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: MEDICATION ADMINISTRATION RECORD (MAR) */}
        {detailTab === 'meds' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)]">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Pill className="w-5 h-5 text-emerald-400"/> Medication Administration Record (MAR)
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Doctors prescribe drugs from facility pharmacy stock. Nurses administer doses, write shift reports & auto-deduct stock.
                </p>
              </div>
              {isDoctor ? (
                <Btn size="sm" onClick={() => setShowOrderForm(p => !p)}>
                  <Plus className="w-3.5 h-3.5"/> {showOrderForm ? 'Close Prescribe Form' : '+ Prescribe Drug Order'}
                </Btn>
              ) : (
                <div className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400">
                  📋 Doctor Authors MAR Prescriptions • Nurse Administers Below
                </div>
              )}
            </div>

            {showOrderForm && (
              <Card className="p-5 bg-[var(--bg-elevated)] space-y-4 border-[var(--accent)]/50 shadow-lg relative">
                <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
                  <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400"/> Doctor Inpatient Drug Prescription
                  </h4>
                  <span className="text-xs text-[var(--text-muted)]">
                    Pulls directly from facility pharmacy stock
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Pharmacy Stock Live Search */}
                  <div className="relative sm:col-span-2">
                    <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">
                      Search Facility Pharmacy Stock *
                    </label>
                    <div className="relative">
                      <input
                        value={pharmacyStockSearch || newOrder.drug_name}
                        onChange={e => searchPharmacyStock(e.target.value)}
                        placeholder="Type drug name (e.g. Paracetamol, Ceftriaxone, Amoxicillin)..."
                        className={inpStyle}
                      />
                      {searchingStock && (
                        <div className="absolute right-3 top-3.5">
                          <Loader className="w-4 h-4 animate-spin text-[var(--accent)]"/>
                        </div>
                      )}
                    </div>

                    {pharmacyStockResults.length > 0 && (
                      <div className="absolute top-[100%] left-0 right-0 z-[120] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl mt-1 max-h-[220px] overflow-y-auto divide-y divide-[var(--border)]/50">
                        {pharmacyStockResults.map(prod => (
                          <div
                            key={prod.id}
                            onClick={() => selectStockProduct(prod)}
                            className="p-3 cursor-pointer hover:bg-[var(--bg-elevated)] flex justify-between items-center transition-all text-xs"
                          >
                            <div>
                              <span className="font-bold text-[var(--text-primary)] block">{prod.name}</span>
                              <span className="text-[10px] text-[var(--text-muted)]">
                                Category: {prod.category_name || 'General'} • KES {parseFloat(prod.selling_price || 0).toLocaleString()}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${parseFloat(prod.total_stock || 0) > 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                                Stock: {prod.total_stock || 0}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedStockProduct && (
                      <div className="mt-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs flex justify-between items-center">
                        <span className="text-emerald-400 font-semibold">
                          Selected: <strong>{selectedStockProduct.name}</strong> (Available Stock: {selectedStockProduct.total_stock || 0})
                        </span>
                        <span className="font-bold text-[var(--text-primary)]">
                          KES {parseFloat(selectedStockProduct.selling_price || 0).toLocaleString()} / unit
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Dosage / Strength *</label>
                    <input
                      value={newOrder.dosage}
                      onChange={e => setNewOrder(p => ({ ...p, dosage: e.target.value }))}
                      placeholder="e.g. 1g IV, 500mg"
                      className={inpStyle}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Route of Admin</label>
                    <select
                      value={newOrder.route}
                      onChange={e => setNewOrder(p => ({ ...p, route: e.target.value }))}
                      className={inpStyle}
                    >
                      <option value="IV">IV (Intravenous)</option>
                      <option value="IM">IM (Intramuscular)</option>
                      <option value="Oral">Oral (Tablet/Syrup)</option>
                      <option value="SC">SC (Subcutaneous)</option>
                      <option value="Topical">Topical / Ointment</option>
                      <option value="Inhalation">Inhalation / Nebulizer</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Frequency</label>
                    <input
                      value={newOrder.frequency}
                      onChange={e => setNewOrder(p => ({ ...p, frequency: e.target.value }))}
                      placeholder="e.g. BD (Twice daily), TDS (3x daily), STAT"
                      className={inpStyle}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Duration (Days)</label>
                    <input
                      value={newOrder.duration}
                      onChange={e => setNewOrder(p => ({ ...p, duration: e.target.value }))}
                      placeholder="e.g. 5 days"
                      className={inpStyle}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Dose Quantity Unit</label>
                    <input
                      type="number"
                      value={newOrder.quantity}
                      onChange={e => setNewOrder(p => ({ ...p, quantity: e.target.value }))}
                      placeholder="1"
                      min="1"
                      className={inpStyle}
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2 border-t border-[var(--border)]">
                  <Btn variant="ghost" size="sm" onClick={() => setShowOrderForm(false)}>Cancel</Btn>
                  <Btn size="sm" onClick={addDrugOrder} disabled={orderSaving}>
                    {orderSaving ? 'Saving...' : 'Prescribe & Add to MAR'}
                  </Btn>
                </div>
              </Card>
            )}

            {drugOrders.length === 0 ? (
              <Card className="p-10 text-center text-[var(--text-muted)]">
                <Pill className="w-8 h-8 opacity-20 mx-auto mb-2"/>
                No active medication orders for this inpatient.
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {drugOrders.map(o => (
                  <Card key={o.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-[var(--text-primary)]">{o.drug_name}</span>
                        {o.dosage && <span className="px-2 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border)] text-xs font-semibold">{o.dosage}</span>}
                        <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 font-bold text-xs">{o.route || 'IV'}</span>
                        {o.frequency && <span className="text-xs text-[var(--text-muted)] font-mono">({o.frequency})</span>}
                        {o.duration && <span className="text-xs text-[var(--text-muted)]">• {o.duration}</span>}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        Prescribed by: <strong className="text-[var(--text-primary)]">{o.prescribed_by_name || 'Dr. Attending'}</strong>
                        {o.created_at && ` • ${new Date(o.created_at).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' })}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {o.status === 'administered' ? (
                        <div className="text-right">
                          <span className="px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-500 font-bold text-xs border border-emerald-500/30 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5"/> Administered
                          </span>
                          <span className="block text-[11px] text-[var(--text-faint)] mt-0.5">
                            By {o.administered_by_name || 'Nurse'} • {o.administered_at ? new Date(o.administered_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                      ) : (
                        <Btn
                          variant="success"
                          size="sm"
                          disabled={administering === o.id}
                          onClick={() => {
                            setSelectedOrderToAdminister(o);
                            setNurseAdminReport(`Administered ${o.drug_name} ${o.dosage || ''} ${o.route || 'IV'} dose. Site clean, vitals stable, patient tolerated well.`);
                          }}
                        >
                          💉 Administer Dose
                        </Btn>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ADMISSION NOTES & MANAGEMENT PLAN MODAL */}
        {showAdmitNotesModal && (
          <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="max-w-xl w-full p-6 bg-[var(--bg-surface)] space-y-4 border-[var(--border)] shadow-2xl relative">
              <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
                <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[var(--accent)]"/> Edit Admission Notes & Management Plan
                </h3>
                <button onClick={() => setShowAdmitNotesModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <X className="w-5 h-5"/>
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">
                    Patient Admission Notes (History, Physical Exam, Presenting Complaints)
                  </label>
                  <textarea
                    value={admitNotesForm.admission_notes}
                    onChange={e => setAdmitNotesForm(p => ({ ...p, admission_notes: e.target.value }))}
                    rows={4}
                    placeholder="Document admission history, presenting complaints, vitals upon admission, physical examination..."
                    className={inpStyle}
                  />
                </div>

                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">
                    Inpatient Management & Treatment Plan (Daily Targets, IV Fluids, Antibiotics, Labs, Discharge Goals)
                  </label>
                  <textarea
                    value={admitNotesForm.management_plan}
                    onChange={e => setAdmitNotesForm(p => ({ ...p, management_plan: e.target.value }))}
                    rows={4}
                    placeholder="Detail clinical management plan, target O2 saturation, IV fluid rates, planned labs, discharge criteria..."
                    className={inpStyle}
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-[var(--border)]">
                <Btn variant="ghost" size="sm" onClick={() => setShowAdmitNotesModal(false)}>Cancel</Btn>
                <Btn size="sm" onClick={handleSaveManagementPlan} disabled={admitNotesSaving}>
                  {admitNotesSaving ? 'Saving Plan...' : 'Save Admission Plan'}
                </Btn>
              </div>
            </Card>
          </div>
        )}

        {/* NURSE MAR ADMINISTRATION MODAL */}
        {selectedOrderToAdminister && (
          <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="max-w-md w-full p-6 bg-[var(--bg-surface)] space-y-4 border-[var(--border)] shadow-2xl relative">
              <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
                <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Pill className="w-5 h-5 text-emerald-400"/> Nurse MAR Administration
                </h3>
                <button onClick={() => setSelectedOrderToAdminister(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <X className="w-5 h-5"/>
                </button>
              </div>

              <div className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)] space-y-1">
                <div className="font-bold text-sm text-[var(--text-primary)]">{selectedOrderToAdminister.drug_name}</div>
                <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                  <span>Dosage: <strong>{selectedOrderToAdminister.dosage || 'Standard'}</strong></span>
                  <span>• Route: <strong>{selectedOrderToAdminister.route || 'IV'}</strong></span>
                </div>
                <div className="text-[11px] text-emerald-400 font-medium">
                  Prescribed by: {selectedOrderToAdminister.prescribed_by_name || 'Doctor'}
                </div>
              </div>

              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">
                  Nurse Shift Administration Report & Patient Notes *
                </label>
                <textarea
                  value={nurseAdminReport}
                  onChange={e => setNurseAdminReport(e.target.value)}
                  rows={3}
                  placeholder="Record administration observations, site condition, vital check, patient response..."
                  className={inpStyle}
                />
              </div>

              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-400">
                ⚠️ Confirming will automatically deduct 1 unit from facility pharmacy stock & post to patient's IPD visit invoice.
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Btn variant="ghost" size="sm" onClick={() => setSelectedOrderToAdminister(null)}>
                  Cancel
                </Btn>
                <Btn variant="success" size="sm" onClick={handleConfirmAdminister} disabled={administering === selectedOrderToAdminister.id}>
                  {administering === selectedOrderToAdminister.id ? 'Deducting & Billing...' : 'Confirm Administration'}
                </Btn>
              </div>
            </Card>
          </div>
        )}

        {/* SECTION 3: LABS & DIAGNOSTICS */}
        {detailTab === 'labs' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <TestTube className="w-5 h-5 text-blue-400"/> Inpatient Lab & Diagnostic Requests
              </h3>
              <div className="flex gap-2">
                <Btn size="sm" variant="outline" onClick={() => {
                  const visitId = selectedPatient?.current_visit_id || selectedPatient?.visit_id;
                  if (visitId) {
                    api.get(`/inpatient/visit/${visitId}/lab-requests`).then(r => {
                      setLabRequests(r.data?.data || []);
                      toast.success('Lab results updated');
                    }).catch(()=>{});
                  }
                }}>
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </Btn>
                <Btn size="sm" onClick={() => setShowLabForm(p => !p)}>
                  <Plus className="w-3.5 h-3.5"/> Order Lab Test
                </Btn>
              </div>
            </div>

            {showLabForm && (
              <Card className="p-5 bg-[var(--bg-elevated)] space-y-4 border-[var(--accent)]/50">
                <h4 className="text-sm font-bold text-[var(--text-primary)]">New Inpatient Laboratory Order</h4>
                <div className="space-y-3">
                  <div>
                    <ICD10Search
                      type="lab"
                      label="Test Name (LOINC / Kenya DHA) *"
                      placeholder="e.g. Full Blood Count, Urinalysis, Malaria RDT, Liver Function Tests..."
                      value={newLab.test_name ? `${newLab.test_code ? newLab.test_code + ' — ' : ''}${newLab.test_name}` : ''}
                      onSelect={({ name, code }) => {
                        setNewLab(p => ({ ...p, test_name: name, test_code: code }));
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Urgency Status</label>
                      <select
                        value={newLab.urgency}
                        onChange={e => setNewLab(p => ({ ...p, urgency: e.target.value }))}
                        className={inpStyle}
                      >
                        <option value="routine">Routine</option>
                        <option value="urgent">Urgent</option>
                        <option value="stat">STAT (Immediate)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Clinical Indications / Special Notes</label>
                      <input
                        value={newLab.notes}
                        onChange={e => setNewLab(p => ({ ...p, notes: e.target.value }))}
                        placeholder="Reason for test..."
                        className={inpStyle}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Btn variant="ghost" size="sm" onClick={() => setShowLabForm(false)}>Cancel</Btn>
                  <Btn size="sm" onClick={addLabRequest} disabled={labSaving}>
                    {labSaving ? 'Ordering...' : 'Order Lab Test'}
                  </Btn>
                </div>
              </Card>
            )}

            {labRequests.length === 0 ? (
              <Card className="p-10 text-center text-[var(--text-muted)]">
                <TestTube className="w-8 h-8 opacity-20 mx-auto mb-2"/>
                No lab requests created for this inpatient visit.
              </Card>
            ) : (
              <div className="space-y-3">
                {labRequests.map(l => (
                  <Card key={l.id} className="p-4 space-y-3 border-[var(--border)]">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[var(--border)] pb-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-[var(--text-primary)]">🧪 {l.test_name}</span>
                          {l.test_code && (
                            <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                              {l.test_code}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            l.urgency === 'stat' ? 'bg-red-500/20 text-red-500' : l.urgency === 'urgent' ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {l.urgency}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            l.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {l.status === 'completed' ? '✅ RESULT RETURNED' : (l.status === 'processing' ? '⚙️ IN LAB PROCESSING' : (l.status || 'PENDING LAB'))}
                          </span>
                        </div>
                        <div className="text-xs text-[var(--text-muted)] mt-1">
                          Ordered by: Dr. {l.doctor_name || 'Physician'} • {new Date(l.created_at).toLocaleString('en-KE')}
                          {l.notes && <span className="ml-2 text-purple-400 font-medium">({l.notes})</span>}
                        </div>
                      </div>
                    </div>

                    {/* LAB RESULT FINDINGS & REPORT (RETURNED FROM LABORATORY) */}
                    {(l.status === 'completed' || l.result || l.result_value) ? (
                      <div className="p-3.5 bg-[var(--bg-elevated)] rounded-xl border border-emerald-500/30 space-y-2.5">
                        <div className="flex flex-wrap justify-between items-center gap-2">
                          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4"/> Official Laboratory Results
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)] font-mono">
                            Tech: <strong className="text-[var(--text-primary)]">{l.technician_name || 'Lab Technician'}</strong> • Resulted: {l.resulted_at || l.result_date ? new Date(l.resulted_at || l.result_date).toLocaleString('en-KE') : 'Returned'}
                          </span>
                        </div>

                        {/* Parameter Value Banner if present */}
                        {(l.result_value || l.result_flag) && (
                          <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <span className="text-xs text-[var(--text-muted)] block">Reading / Value:</span>
                              <span className="text-base font-extrabold text-[var(--text-primary)] font-mono">
                                {l.result_value} {l.result_unit || ''}
                              </span>
                            </div>
                            {l.reference_range && (
                              <div className="text-right">
                                <span className="text-[11px] text-[var(--text-muted)] block">Ref Range:</span>
                                <span className="text-xs font-medium text-[var(--text-primary)] font-mono">
                                  {l.reference_range}
                                </span>
                              </div>
                            )}
                            {l.result_flag && (
                              <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase ${
                                ['high', 'critical', 'abnormal', 'positive'].includes(l.result_flag.toLowerCase())
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : ['low'].includes(l.result_flag.toLowerCase())
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              }`}>
                                {l.result_flag}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Detailed Text / Report */}
                        {l.result && (
                          <div className="text-xs text-[var(--text-primary)] font-mono whitespace-pre-wrap bg-[var(--bg-surface)] p-3 rounded-lg border border-[var(--border)] leading-relaxed">
                            {l.result}
                          </div>
                        )}

                        {!l.result && !l.result_value && (
                          <div className="text-xs text-[var(--text-primary)] font-mono bg-[var(--bg-surface)] p-2.5 rounded-lg border border-[var(--border)]">
                            Lab Work Completed — Parameters within normal reference limits.
                          </div>
                        )}

                        {l.technician_notes && (
                          <div className="text-[11px] text-[var(--text-muted)] italic bg-purple-500/5 p-2 rounded border border-purple-500/10">
                            💡 <strong>Lab Tech Note:</strong> {l.technician_notes}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 text-xs text-amber-400 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Clock className="w-4 h-4 animate-spin"/> Inpatient Specimen Received by Lab — Processing Diagnostic Results...
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">Inpatient Ward Order</span>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION 4: PROCEDURES */}
        {detailTab === 'procs' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-amber-400"/> Ward Procedures & Interventions
              </h3>
              <Btn size="sm" onClick={() => setShowProcedureForm(p => !p)}>
                <Plus className="w-3.5 h-3.5"/> Order Procedure
              </Btn>
            </div>

            {showProcedureForm && (
              <Card className="p-5 bg-[var(--bg-elevated)] space-y-4 border-[var(--accent)]/50">
                <h4 className="text-sm font-bold text-[var(--text-primary)]">New Inpatient Ward Procedure</h4>
                <div className="space-y-3">
                  <div>
                    <ICD10Search
                      type="procedure"
                      label="Procedure Name (Kenya DHA Code) *"
                      placeholder="e.g. Wound Dressing, Catheterization, Nebulization, IV Cannulation..."
                      value={newProcedure.procedure_name ? `${newProcedure.procedure_code ? newProcedure.procedure_code + ' — ' : ''}${newProcedure.procedure_name}` : ''}
                      onSelect={({ name, code }) => {
                        setNewProcedure(p => ({ ...p, procedure_name: name, procedure_code: code }));
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Clinical Indications / Notes</label>
                    <input
                      value={newProcedure.notes}
                      onChange={e => setNewProcedure(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Procedure instructions or clinical notes..."
                      className={inpStyle}
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Btn variant="ghost" size="sm" onClick={() => setShowProcedureForm(false)}>Cancel</Btn>
                  <Btn size="sm" onClick={addProcedure} disabled={procedureSaving}>
                    {procedureSaving ? 'Saving...' : 'Order Procedure'}
                  </Btn>
                </div>
              </Card>
            )}

            {procedures.length === 0 ? (
              <Card className="p-10 text-center text-[var(--text-muted)]">
                <Stethoscope className="w-8 h-8 opacity-20 mx-auto mb-2"/>
                No procedure records for this inpatient.
              </Card>
            ) : (
              <div className="space-y-3">
                {procedures.map(pr => (
                  <Card key={pr.id} className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-bold text-[var(--text-primary)]">{pr.procedure_name}</div>
                        <div className="text-xs text-[var(--text-muted)]">
                          Ordered by Dr. {pr.doctor_name || 'Physician'} • {new Date(pr.created_at).toLocaleString()}
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                        pr.outcome?.includes('Completed') ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'
                      }`}>
                        {pr.outcome || 'Pending'}
                      </span>
                    </div>

                    {!pr.outcome?.includes('Completed') && (
                      <div className="pt-2 border-t border-[var(--border)] flex items-center gap-2">
                        <input
                          placeholder="Enter procedure outcome notes / findings to mark completed..."
                          value={procOutcomeNotes[pr.id] || ''}
                          onChange={e => setProcOutcomeNotes(p => ({ ...p, [pr.id]: e.target.value }))}
                          className={inpStyle}
                        />
                        <Btn size="sm" onClick={() => handleCompleteProcedure(pr.id)} disabled={completingProc === pr.id}>
                          Complete
                        </Btn>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION 5: VITALS & CHARTING */}
        {detailTab === 'vitals' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400"/> Vital Signs & Inpatient Care Charting
              </h3>
              <Btn size="sm" onClick={() => setShowVitalsForm(p => !p)}>
                <Plus className="w-3.5 h-3.5"/> Record Vitals
              </Btn>
            </div>

            {showVitalsForm && (
              <Card className="p-5 bg-[var(--bg-elevated)] space-y-4 border-[var(--accent)]/50">
                <h4 className="text-sm font-bold text-[var(--text-primary)]">Record Vital Signs</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">BP Systolic</label>
                    <input
                      value={newVitals.blood_pressure_systolic}
                      onChange={e => setNewVitals(p => ({ ...p, blood_pressure_systolic: e.target.value }))}
                      placeholder="e.g. 120"
                      className={inpStyle}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">BP Diastolic</label>
                    <input
                      value={newVitals.blood_pressure_diastolic}
                      onChange={e => setNewVitals(p => ({ ...p, blood_pressure_diastolic: e.target.value }))}
                      placeholder="e.g. 80"
                      className={inpStyle}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Pulse (bpm)</label>
                    <input
                      value={newVitals.pulse_rate}
                      onChange={e => setNewVitals(p => ({ ...p, pulse_rate: e.target.value }))}
                      placeholder="e.g. 72"
                      className={inpStyle}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Temp (°C)</label>
                    <input
                      value={newVitals.temperature}
                      onChange={e => setNewVitals(p => ({ ...p, temperature: e.target.value }))}
                      placeholder="e.g. 36.8"
                      className={inpStyle}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">SpO2 (%)</label>
                    <input
                      value={newVitals.oxygen_saturation}
                      onChange={e => setNewVitals(p => ({ ...p, oxygen_saturation: e.target.value }))}
                      placeholder="e.g. 98"
                      className={inpStyle}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Resp Rate (/min)</label>
                    <input
                      value={newVitals.respiratory_rate}
                      onChange={e => setNewVitals(p => ({ ...p, respiratory_rate: e.target.value }))}
                      placeholder="e.g. 18"
                      className={inpStyle}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Blood Glucose (mmol/L)</label>
                    <input
                      value={newVitals.blood_sugar}
                      onChange={e => setNewVitals(p => ({ ...p, blood_sugar: e.target.value }))}
                      placeholder="e.g. 5.5"
                      className={inpStyle}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Urine Output (mL)</label>
                    <input
                      value={newVitals.urine_output}
                      onChange={e => setNewVitals(p => ({ ...p, urine_output: e.target.value }))}
                      placeholder="e.g. 400"
                      className={inpStyle}
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Btn variant="ghost" size="sm" onClick={() => setShowVitalsForm(false)}>Cancel</Btn>
                  <Btn size="sm" onClick={addVitalsRecord} disabled={vitalsSaving}>
                    {vitalsSaving ? 'Saving...' : 'Save Vitals'}
                  </Btn>
                </div>
              </Card>
            )}

            {vitalsHistory.length === 0 ? (
              <Card className="p-10 text-center text-[var(--text-muted)]">
                <Activity className="w-8 h-8 opacity-20 mx-auto mb-2"/>
                No vital signs logged yet for this visit.
              </Card>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
                <table className="w-full text-left text-xs text-[var(--text-primary)]">
                  <thead className="bg-[var(--bg-elevated)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase font-semibold">
                    <tr>
                      <th className="p-3">Recorded Time</th>
                      <th className="p-3">Blood Pressure</th>
                      <th className="p-3">Pulse</th>
                      <th className="p-3">Temp (°C)</th>
                      <th className="p-3">SpO2 (%)</th>
                      <th className="p-3">Resp Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {vitalsHistory.map(v => (
                      <tr key={v.id} className="hover:bg-[var(--bg-elevated)]">
                        <td className="p-3 font-mono">{new Date(v.recorded_at || v.created_at).toLocaleString()}</td>
                        <td className="p-3 font-bold">{v.blood_pressure_systolic ? `${v.blood_pressure_systolic}/${v.blood_pressure_diastolic}` : '—'}</td>
                        <td className="p-3">{v.pulse_rate ? `${v.pulse_rate} bpm` : '—'}</td>
                        <td className="p-3 font-bold text-amber-400">{v.temperature ? `${v.temperature} °C` : '—'}</td>
                        <td className="p-3 font-bold text-blue-400">{v.oxygen_saturation ? `${v.oxygen_saturation}%` : '—'}</td>
                        <td className="p-3">{v.respiratory_rate ? `${v.respiratory_rate}/min` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SECTION 6: INPATIENT BILLING */}
        {detailTab === 'billing' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)]">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400"/> Inpatient Running Bill & Account Statement
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Automated charges accrued for daily bed stay, drugs, lab tests & clinical procedures.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {isBillingStaff && (
                  <Btn
                    size="sm"
                    variant="success"
                    onClick={openPaymentModal}
                  >
                    <DollarSign className="w-4 h-4"/> 💳 Record Deposit / Payment
                  </Btn>
                )}
                <Btn
                  size="sm"
                  variant="secondary"
                  onClick={() => printInpatientBill(selectedPatient, billingItems, drugOrders, labRequests, procedures, user?.pharmacy, user)}
                >
                  <Receipt className="w-4 h-4 text-emerald-400"/> Print Invoice Statement
                </Btn>
              </div>
            </div>

            {!isBillingStaff && (
              <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-400 flex items-center gap-2.5">
                <span className="text-base">ℹ️</span>
                <span>
                  <strong>Clinical View:</strong> As medical staff, you are viewing the accrued patient bill summary for clinical awareness. Financial collections, partial deposits, and payment receipts are handled by <strong>Receptionists & Cashiers</strong>.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4 bg-[var(--bg-surface)]">
                <span className="text-xs text-[var(--text-muted)] block font-semibold">Total Accrued Bill</span>
                <span className="text-xl font-black text-[var(--text-primary)] mt-1 block font-mono">
                  KES {totalBilled.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                </span>
              </Card>

              <Card className="p-4 bg-[var(--bg-surface)]">
                <span className="text-xs text-[var(--text-muted)] block font-semibold">Paid Amount / Deposits Received</span>
                <span className="text-xl font-black text-emerald-500 mt-1 block font-mono">
                  KES {paidBilled.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                </span>
              </Card>

              <Card className="p-4 bg-[var(--bg-surface)]">
                <span className="text-xs text-[var(--text-muted)] block font-semibold">Outstanding Net Balance</span>
                <span className={`text-xl font-black mt-1 block font-mono ${pendingBilled > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  KES {pendingBilled.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                </span>
              </Card>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
              <table className="w-full text-left text-xs text-[var(--text-primary)]">
                <thead className="bg-[var(--bg-elevated)] border-b border-[var(--border)] text-[var(--text-muted)] uppercase font-semibold">
                  <tr>
                    <th className="p-3">Item Description / Service</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Unit Price</th>
                    <th className="p-3">Qty</th>
                    <th className="p-3">Total Amount</th>
                    <th className="p-3">Paid Amount</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {billingItems.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-6 text-center text-[var(--text-muted)]">
                        No billable items logged for this admission yet.
                      </td>
                    </tr>
                  ) : (
                    billingItems.map(item => {
                      const itemTot = parseFloat(item.unit_price || 0) * (parseInt(item.quantity) || 1);
                      const itemPaid = parseFloat(item.paid_amount || (['paid', 'insurance', 'nhif', 'sha', 'corporate'].includes(item.status) ? itemTot : 0));
                      const isPaid = ['paid', 'insurance', 'nhif', 'sha', 'corporate'].includes(item.status);
                      const isPartial = item.status === 'partial';

                      return (
                        <tr key={item.id} className="hover:bg-[var(--bg-elevated)]">
                          <td className="p-3 font-semibold">{item.item_name || item.description}</td>
                          <td className="p-3 capitalize font-mono text-[var(--text-muted)]">{item.item_type}</td>
                          <td className="p-3">KES {parseFloat(item.unit_price || 0).toLocaleString()}</td>
                          <td className="p-3 font-bold">{item.quantity}</td>
                          <td className="p-3 font-bold text-[var(--accent)] font-mono">
                            KES {itemTot.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 font-bold text-emerald-400 font-mono">
                            KES {itemPaid.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase ${
                              isPaid 
                                ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' 
                                : isPartial 
                                ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30' 
                                : 'bg-red-500/15 text-red-500 border border-red-500/30'
                            }`}>
                              {isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'PENDING'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECTION 7: FULL PATIENT MEDICAL HISTORY & ENCOUNTER TIMELINE */}
        {detailTab === 'history' && (
          <div className="space-y-4">
            <Card className="p-4 bg-[var(--bg-surface)] border-[var(--border)]">
              <ClinicalTimeline
                patientId={selectedPatient.patient_id || selectedPatient.id}
                patientName={selectedPatient.patient_name || selectedPatient.full_name}
                patientNumber={selectedPatient.patient_number}
              />
            </Card>
          </div>
        )}
          </div>

          {/* RIGHT CLINICAL SIDEBAR SUMMARY (4 Columns) */}
          <div className="lg:col-span-4 space-y-5">
            {/* Vitals Summary Card */}
            <Card className="p-5 bg-[var(--bg-surface)] space-y-4">
              <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400"/> Vital Signs Summary
                </h3>
                <Btn variant="ghost" size="sm" onClick={() => setDetailTab('vitals')}>
                  + Add Vitals
                </Btn>
              </div>
              {vitalsHistory.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block text-[11px] font-semibold">Blood Pressure</span>
                    <span className="text-base font-black text-[var(--text-primary)]">
                      {vitalsHistory[0].blood_pressure_systolic || '—'}/{vitalsHistory[0].blood_pressure_diastolic || '—'}
                    </span>
                  </div>
                  <div className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block text-[11px] font-semibold">Pulse Rate</span>
                    <span className="text-base font-black text-emerald-400 flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5"/> {vitalsHistory[0].pulse_rate || '—'} <span className="text-[10px] font-normal text-[var(--text-muted)]">bpm</span>
                    </span>
                  </div>
                  <div className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block text-[11px] font-semibold">Temperature</span>
                    <span className="text-base font-black text-amber-400">
                      {vitalsHistory[0].temperature ? `${vitalsHistory[0].temperature}°C` : '—'}
                    </span>
                  </div>
                  <div className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block text-[11px] font-semibold">Oxygen Sat. (SpO2)</span>
                    <span className="text-base font-black text-cyan-400">
                      {vitalsHistory[0].spo2 ? `${vitalsHistory[0].spo2}%` : '—'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-[var(--bg-elevated)] rounded-xl text-center text-xs text-[var(--text-muted)]">
                  No vitals logged yet for this admission.
                </div>
              )}
            </Card>

            {/* Active MAR Meds Card */}
            <Card className="p-5 bg-[var(--bg-surface)] space-y-4">
              <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Pill className="w-4 h-4 text-emerald-400"/> Active MAR Orders ({drugOrders.length})
                </h3>
                <Btn variant="ghost" size="sm" onClick={() => setDetailTab('meds')}>
                  Manage MAR
                </Btn>
              </div>
              {drugOrders.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {drugOrders.map(d => (
                    <div key={d.id} className="p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)] text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[var(--text-primary)]">{d.drug_name}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${d.status === 'administered' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                          {d.status || 'ordered'}
                        </span>
                      </div>
                      <div className="text-[var(--text-muted)] text-[11px] font-medium">
                        {d.dosage} • {d.route} • {d.frequency}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-[var(--bg-elevated)] rounded-xl text-center text-xs text-[var(--text-muted)]">
                  No active drug orders listed.
                </div>
              )}
            </Card>

            {/* Accrued Inpatient Bill Breakdown Card (Cashier / Receptionist / Billing Role) OR Clinical Profile Card (Doctor / Nurse) */}
            {isBillingStaff ? (
              <Card className="p-5 bg-[var(--bg-surface)] space-y-4">
                <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
                  <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[var(--accent)]"/> Accrued Bill Breakdown
                  </h3>
                  <Btn variant="ghost" size="sm" onClick={() => setDetailTab('billing')}>
                    Full Bill
                  </Btn>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] font-semibold">Total Billed:</span>
                    <span className="text-base font-black text-[var(--accent)]">KES {totalBilled.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    <span className="text-[var(--text-muted)] font-medium">Paid Charges:</span>
                    <span className="font-bold text-emerald-400">KES {paidBilled.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 bg-red-500/10 rounded-xl border border-red-500/20">
                    <span className="text-[var(--text-muted)] font-medium">Pending Balance:</span>
                    <span className="font-bold text-red-400">KES {pendingBilled.toLocaleString()}</span>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-5 bg-[var(--bg-surface)] space-y-3">
                <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
                  <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400"/> Patient Clinical Profile
                  </h3>
                  <Btn variant="ghost" size="sm" onClick={() => setDetailTab('history')}>
                    EHR History
                  </Btn>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <span className="text-[10px] font-bold text-red-400 block uppercase mb-0.5">⚠️ Known Allergies</span>
                    <span className="font-mono text-[var(--text-primary)] text-[11px] font-semibold">
                      {selectedPatient?.allergies || 'No known drug allergies (NKDA)'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] block uppercase mb-0.5">🩺 Primary Diagnosis</span>
                    <span className="text-[var(--text-primary)] text-[11px]">
                      {selectedPatient?.diagnosis || 'Inpatient Evaluation'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] block uppercase mb-0.5">🩸 Blood Group</span>
                    <span className="font-mono text-[var(--text-primary)] text-[11px] font-bold">
                      {selectedPatient?.blood_group || 'Not Recorded'}
                    </span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // MAIN INPATIENT WARD DASHBOARD / ROSTER VIEW
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div className="w-full min-h-full p-4 sm:p-6 lg:p-8 space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border)] shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-[var(--text-primary)]">
              🏥 Inpatient Ward & Bed Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30 text-xs font-bold">
              Live Control Center
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Real-time hospital ward occupancy, bed allocation, nursing care plans, MAR & patient discharge.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Btn variant="ghost" onClick={fetchData}>
            <RefreshCw className="w-4 h-4"/> Refresh
          </Btn>          <Btn onClick={() => setShowWardModal(true)}>
            <Plus className="w-4 h-4"/> Add Ward
          </Btn>
        </div>
      </div>

      {/* Hospital Ward Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-5 bg-[var(--bg-surface)] relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-[var(--text-muted)] block">Total Hospital Beds</span>
              <span className="text-3xl font-black text-[var(--text-primary)] mt-1 block">{totalBeds}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
              🛏️
            </div>
          </div>
          <span className="text-[11px] text-[var(--text-faint)] mt-2 block">In {wards.length} Active Wards</span>
        </Card>

        <Card className="p-5 bg-[var(--bg-surface)] relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-[var(--text-muted)] block">Occupied Beds</span>
              <span className="text-3xl font-black text-red-500 mt-1 block">{occupiedBeds}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center font-bold">
              🔴
            </div>
          </div>
          <div className="w-full bg-[var(--bg-elevated)] h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-red-500 h-full transition-all" style={{ width: `${occupancyRate}%` }}/>
          </div>
        </Card>

        <Card className="p-5 bg-[var(--bg-surface)] relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-[var(--text-muted)] block">Available Beds</span>
              <span className="text-3xl font-black text-emerald-500 mt-1 block">{availableBeds}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
              🟢
            </div>
          </div>
          <span className="text-[11px] text-emerald-500/80 font-semibold mt-2 block">Ready for Admission</span>
        </Card>

        <Card className="p-5 bg-[var(--bg-surface)] relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-semibold text-[var(--text-muted)] block">Occupancy Rate</span>
              <span className="text-3xl font-black text-[var(--accent)] mt-1 block">{occupancyRate}%</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center font-bold">
              📊
            </div>
          </div>
          <span className="text-[11px] text-[var(--text-muted)] mt-2 block">Facility Capacity Meter</span>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex bg-[var(--bg-surface)] border border-[var(--border)] p-1.5 rounded-2xl gap-1 overflow-x-auto">
        {[
          { key: 'patients', label: '🛏️ Active Inpatient Roster', icon: Users, badge: inpatients.length },
          { key: 'map', label: '🗺️ Bed Floorplan Map', icon: BedDouble },
          { key: 'wards', label: '🏨 Wards & Bed Directory', icon: Settings, badge: wards.length },
          { key: 'queue', label: '📥 Admission Queue', icon: Clock, badge: wardQueue.length },
        ].map(({ key, label, badge }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
              tab === key 
                ? 'bg-[var(--accent)] text-[#0F1612] shadow-sm' 
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
            }`}
          >
            <span>{label}</span>
            {badge !== undefined && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-black ${tab === key ? 'bg-black/20 text-black' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'}`}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="p-16 text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto text-[var(--accent)] mb-3"/>
          <p className="text-base font-semibold text-[var(--text-muted)]">Loading inpatient ward data...</p>
        </Card>
      ) : tab === 'patients' ? (
        /* TAB 1: ACTIVE INPATIENT ROSTER */
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"/>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search patient name, Reg #, Ward, Bed or Dx..."
                className={`${inpStyle} pl-10`}
              />
            </div>

            <div>
              <select
                value={wardFilter}
                onChange={e => setWardFilter(e.target.value)}
                className={inpStyle}
              >
                <option value="ALL">All Wards</option>
                {wards.map(w => (
                  <option key={w.id} value={w.name}>{w.name}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={acuityFilter}
                onChange={e => setAcuityFilter(e.target.value)}
                className={inpStyle}
              >
                <option value="ALL">All Acuity Levels</option>
                <option value="HIGH">🔴 High Priority / Critical</option>
                <option value="STABLE">🟢 Stable Condition</option>
              </select>
            </div>
          </div>

          {filteredInpatients.length === 0 ? (
            <Card className="p-16 text-center text-[var(--text-muted)] space-y-2">
              <BedDouble className="w-12 h-12 opacity-20 mx-auto mb-2"/>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">No Admitted Inpatients Found</h3>
              <p className="text-sm">Adjust your search or filter parameters, or admit a new patient from the queue.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredInpatients.map(p => (
                <Card 
                  key={p.id} 
                  className="p-5 hover:border-[var(--accent)] transition-all cursor-pointer space-y-4 group shadow-sm hover:shadow-md"
                  onClick={() => openPatient(p)}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] flex items-center justify-center text-xl font-bold flex-shrink-0 group-hover:scale-105 transition-transform">
                        🛏️
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-black text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                            {p.patient_name}
                          </h3>
                          <span className="px-2 py-0.5 rounded bg-[var(--bg-elevated)] border text-xs font-mono font-semibold text-[var(--text-muted)]">
                            {p.patient_number}
                          </span>
                        </div>
                        <div className="text-sm text-[var(--text-muted)] mt-1 flex items-center gap-2 flex-wrap font-medium">
                          <span>{p.gender}</span>
                          <span>•</span>
                          <span>{getAge(p.date_of_birth)}</span>
                          <span>•</span>
                          <span className="text-[var(--text-primary)]">📞 {p.phone}</span>
                          {p.blood_group && (
                            <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-500 font-bold text-xs">
                              {p.blood_group}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="px-3 py-1 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] font-bold text-xs border border-[var(--accent)]/30">
                        {p.ward_name} — Bed {p.bed_number}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5 font-medium">
                        <Clock className="w-3.5 h-3.5 text-[var(--accent)]"/> {getLengthOfStay(p.admitted_at)}
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)] text-sm space-y-1">
                    {p.diagnosis ? (
                      <div className="text-[var(--text-primary)]">
                        <strong className="text-[var(--accent)]">Dx:</strong> {p.diagnosis}
                      </div>
                    ) : p.chief_complaint ? (
                      <div className="text-[var(--text-muted)]">
                        <strong>Chief Complaint:</strong> {p.chief_complaint}
                      </div>
                    ) : (
                      <div className="text-[var(--text-faint)] italic">No diagnostic notes provided</div>
                    )}
                    {p.doctor_name && (
                      <div className="text-[var(--text-muted)] pt-1 flex items-center gap-1 text-xs">
                        <Stethoscope className="w-3.5 h-3.5 text-purple-400"/> Attending: Dr. {p.doctor_name}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-[var(--border)] text-sm">
                    <span className="text-[var(--accent)] font-bold flex items-center gap-1">
                      Open EHR Chart <ChevronRight className="w-4 h-4"/>
                    </span>
                    {isDoctor && (
                      <Btn 
                        variant="danger" 
                        size="sm" 
                        onClick={(e) => { e.stopPropagation(); dischargePatient(p.current_visit_id || p.visit_id, p.patient_name); }}
                      >
                        Discharge
                      </Btn>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : tab === 'map' ? (
        /* TAB 2: BED FLOORPLAN MAP */
        <div className="space-y-6">
          {wards.map(ward => {
            const wardInpatients = inpatients.filter(i => i.ward_name === ward.name);
            return (
              <Card key={ward.id} className="p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
                  <div>
                    <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                      🏨 {ward.name} <span className="text-sm font-normal text-[var(--text-muted)] capitalize">({ward.ward_type} Ward)</span>
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-bold">
                    <span className="text-emerald-500">🟢 {ward.available_beds} Free</span>
                    <span className="text-red-500">🔴 {ward.occupied_beds} Occupied</span>
                    <span className="text-[var(--text-muted)]">Total: {ward.total_beds}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {wardInpatients.map(patient => (
                    <div
                      key={patient.id}
                      onClick={() => openPatient(patient)}
                      className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-center space-y-1 hover:border-red-500 cursor-pointer transition-all"
                    >
                      <div className="text-xl">🔴</div>
                      <div className="text-sm font-bold text-[var(--text-primary)] truncate">Bed {patient.bed_number}</div>
                      <div className="text-xs font-bold text-red-400 truncate">{patient.patient_name}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">{getLengthOfStay(patient.admitted_at)}</div>
                    </div>
                  ))}

                  {Array.from({ length: Math.max(0, parseInt(ward.available_beds || 0)) }).map((_, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center space-y-1 opacity-80 hover:opacity-100 transition-all cursor-pointer"
                    >
                      <div className="text-xl">🟢</div>
                      <div className="text-sm font-bold text-[var(--text-primary)]">Bed {String(idx + 1).padStart(2, '0')}</div>
                      <div className="text-xs text-emerald-500 font-bold">Available</div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      ) : tab === 'wards' ? (
        /* TAB 3: WARDS DIRECTORY */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {wards.map(w => (
            <Card key={w.id} className="p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">🏨 {w.name}</h3>
                  <span className="text-xs text-[var(--text-muted)] capitalize">{w.ward_type} Ward</span>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] font-bold text-xs">
                  {w.total_beds} Beds
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <div className="font-bold text-emerald-500 text-base">{w.available_beds}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Free</div>
                </div>
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <div className="font-bold text-red-500 text-base">{w.occupied_beds}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Occupied</div>
                </div>
                <div className="p-2 bg-[var(--bg-elevated)] rounded-lg">
                  <div className="font-bold text-[var(--text-primary)] text-base">{w.total_beds}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Total</div>
                </div>
              </div>

              <Btn 
                variant="ghost" 
                size="sm" 
                className="w-full justify-center" 
                onClick={() => fetchWardBeds(w)}
              >
                Manage Ward Beds
              </Btn>
            </Card>
          ))}
        </div>
      ) : (
        /* TAB 4: ADMISSION QUEUE */
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              📥 Waiting Inpatient Admissions ({wardQueue.length})
            </h3>
            <Btn variant="ghost" size="sm" onClick={fetchAdmitQueue}>
              <RefreshCw className="w-3.5 h-3.5"/> Refresh Queue
            </Btn>
          </div>

          {wardQueue.length === 0 ? (
            <Card className="p-16 text-center text-[var(--text-muted)]">
              <Clock className="w-10 h-10 opacity-20 mx-auto mb-2"/>
              No patients waiting in the inpatient admission queue.
            </Card>
          ) : (
            <div className="space-y-3">
              {wardQueue.map(v => (
                <Card key={v.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[var(--text-primary)]">{v.patient_name}</span>
                      <span className="px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-xs font-mono text-[var(--text-muted)]">{v.patient_number}</span>
                      <span className="px-2 py-0.5 rounded bg-[var(--accent)]/15 text-[var(--accent)] font-bold text-xs">Visit #{v.visit_number}</span>
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">
                      Reason: {v.chief_complaint || 'Forwarded for IPD admission'}
                    </div>
                  </div>

                  <Btn size="sm" onClick={() => openAdmitModal(v.id)}>
                    🛏️ Assign Bed & Admit
                  </Btn>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ADMIT PATIENT MODAL */}
      {showAdmitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 space-y-4 bg-[var(--bg-surface)]">
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-primary)]">🛏️ Admit Patient to Ward Bed</h3>
              <button onClick={() => setShowAdmitModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Select Patient from Queue</label>
                <select
                  value={admitVisitId}
                  onChange={e => {
                    const vid = e.target.value;
                    setAdmitVisitId(vid);
                    const qItem = wardQueue.find(q => String(q.id) === String(vid));
                    if (qItem) {
                      setAdmitMemberNumber(qItem.sha_number || qItem.member_number || qItem.national_id || '');
                      if (qItem.insurance_provider) setAdmitInsuranceProvider(qItem.insurance_provider);
                    }
                  }}
                  className={inpStyle}
                >
                  <option value="">-- Choose Patient --</option>
                  {wardQueue.map(v => (
                    <option key={v.id} value={v.id}>{v.patient_name} ({v.patient_number})</option>
                  ))}
                </select>
              </div>

              {/* INSURANCE COVER & SETTLEMENT SCHEME SECTION */}
              <div style={{ background: '#3b82f610', border: '1px solid #3b82f630', padding: 14, borderRadius: 10 }} className="space-y-2.5">
                <div style={{ fontSize: 12, fontWeight: 800, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Shield className="w-4 h-4"/> Admission Payment & Insurance Cover
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] block mb-1 font-semibold">Payment Category</label>
                    <select value={admitPaymentMethod} onChange={e => setAdmitPaymentMethod(e.target.value)} className={inpStyle}>
                      <option value="insurance">🛡️ Insurance / Scheme</option>
                      <option value="sha">🏥 SHA (Social Health Authority)</option>
                      <option value="corporate">🏢 Corporate Direct</option>
                      <option value="cash">💵 Cash / Self-Pay</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-[var(--text-muted)] block mb-1 font-semibold">Insurance Provider / Scheme</label>
                    <select 
                      value={admitInsuranceProvider} 
                      onChange={e => setAdmitInsuranceProvider(e.target.value)} 
                      className={inpStyle}
                      disabled={admitPaymentMethod === 'cash'}
                    >
                      <option value="SHA / Social Health Authority">SHA / Social Health Authority</option>
                      <option value="Jubilee Health Insurance">Jubilee Health Insurance</option>
                      <option value="Britam General Insurance">Britam General Insurance</option>
                      <option value="APA Insurance">APA Insurance</option>
                      <option value="AAR Insurance">AAR Insurance</option>
                      <option value="CIC General Insurance">CIC General Insurance</option>
                      <option value="Madison Insurance">Madison Insurance</option>
                      <option value="GA Insurance">GA Insurance</option>
                      <option value="Old Mutual / UAP">Old Mutual / UAP Insurance</option>
                      <option value="Equity Afia Insurance">Equity Afia Insurance</option>
                      <option value="Heritage Insurance">Heritage Insurance</option>
                      <option value="Corporate Scheme">Corporate Scheme</option>
                    </select>
                  </div>
                </div>

                {admitPaymentMethod !== 'cash' && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-[var(--text-muted)] block mb-1 font-semibold">Member / SHA Number</label>
                        <input 
                          value={admitMemberNumber} 
                          onChange={e => setAdmitMemberNumber(e.target.value)} 
                          placeholder="e.g. SHA-902188" 
                          className={inpStyle} 
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-[var(--text-muted)] block mb-1 font-semibold">Pre-Auth / Approval Code</label>
                        <input 
                          value={admitAuthCode} 
                          onChange={e => setAdmitAuthCode(e.target.value)} 
                          placeholder="e.g. AUTH-2026-99" 
                          className={inpStyle} 
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-[var(--text-muted)] block mb-1 font-semibold">Expected Co-Pay Deposit (KES)</label>
                      <input 
                        type="number" 
                        value={admitCopayAmount} 
                        onChange={e => setAdmitCopayAmount(e.target.value)} 
                        placeholder="0.00 (Leave blank if 100% covered by scheme)" 
                        className={inpStyle} 
                      />
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Admission Directive Notes</label>
                <textarea
                  value={admitNotes}
                  onChange={e => setAdmitNotes(e.target.value)}
                  rows={2}
                  placeholder="Primary admission reason, bed allocation notes..."
                  className={inpStyle}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Btn variant="ghost" onClick={() => setShowAdmitModal(false)}>Cancel</Btn>
              <Btn onClick={admitPatient} disabled={saving || !admitVisitId}>
                {saving ? 'Admitting...' : 'Confirm Admission'}
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {/* CREATE WARD MODAL */}
      {showWardModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 space-y-4 bg-[var(--bg-surface)]">
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-primary)]">🏨 Create Hospital Ward Unit</h3>
              <button onClick={() => setShowWardModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Ward Unit Name *</label>
                <input
                  value={wardForm.name}
                  onChange={e => setWardForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Male Medical Ward, Surgical ICU, Maternity"
                  className={inpStyle}
                />
              </div>

              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Ward Specialty Category</label>
                <select
                  value={wardForm.ward_type}
                  onChange={e => setWardForm(p => ({ ...p, ward_type: e.target.value }))}
                  className={inpStyle}
                >
                  <option value="general">General Medical Ward</option>
                  <option value="surgical">Surgical Ward</option>
                  <option value="paediatric">Paediatric Ward</option>
                  <option value="maternity">Maternity & Labour Ward</option>
                  <option value="icu">Intensive Care Unit (ICU)</option>
                  <option value="isolation">Isolation Ward</option>
                  <option value="private">Private VIP Suite</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Number of Hospital Beds</label>
                <input
                  type="number"
                  value={wardForm.total_beds}
                  onChange={e => setWardForm(p => ({ ...p, total_beds: e.target.value }))}
                  min={1}
                  max={100}
                  className={inpStyle}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Btn variant="ghost" onClick={() => setShowWardModal(false)}>Cancel</Btn>
              <Btn onClick={createWard} disabled={saving || !wardForm.name}>
                {saving ? 'Creating...' : 'Create Ward Unit'}
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {/* RECORD INPATIENT DEPOSIT / PAYMENT MODAL */}
      {showPaymentModal && selectedPatient && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[200] flex items-center justify-center p-4">
          <Card className="w-full max-w-xl p-6 space-y-4 bg-[var(--bg-surface)] border-[var(--border)] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="text-lg font-black text-[var(--text-primary)] flex items-center gap-2">
                  💳 Record Inpatient Deposit / Payment
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Patient: <strong className="text-[var(--text-primary)]">{selectedPatient.patient_name}</strong> • Reg #: <span className="font-mono">{selectedPatient.patient_number}</span>
                </p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[var(--text-muted)] block mb-2 uppercase tracking-wider">
                  Select Pending / Partial Charge Items to Apply Payment
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(billingItems || []).filter(i => i.status === 'pending' || i.status === 'partial').length === 0 ? (
                    <div className="p-4 rounded-xl bg-[var(--bg-elevated)] text-center text-xs text-[var(--text-muted)]">
                      All items are fully paid or waived for this inpatient stay.
                    </div>
                  ) : (
                    (billingItems || []).filter(i => i.status === 'pending' || i.status === 'partial').map(item => {
                      const itemTot = parseFloat(item.unit_price || 0) * (parseInt(item.quantity) || 1);
                      const itemPaid = parseFloat(item.paid_amount || 0);
                      const itemPending = Math.max(0, itemTot - itemPaid);

                      return (
                        <label key={item.id} className="flex items-center gap-3 p-3 bg-[var(--bg-elevated)] rounded-xl border border-[var(--border)] cursor-pointer hover:border-[var(--accent)] transition-all">
                          <input
                            type="checkbox"
                            checked={selectedPayItems.includes(item.id)}
                            onChange={e => {
                              const newSel = e.target.checked
                                ? [...selectedPayItems, item.id]
                                : selectedPayItems.filter(id => id !== item.id);
                              setSelectedPayItems(newSel);

                              const newPendingSum = (billingItems || [])
                                .filter(i => newSel.includes(i.id))
                                .reduce((s, i) => {
                                  const tot = parseFloat(i.unit_price || 0) * (parseInt(i.quantity) || 1);
                                  const paid = parseFloat(i.paid_amount || 0);
                                  return s + Math.max(0, tot - paid);
                                }, 0);

                              setPayForm(p => ({ ...p, amount: newPendingSum > 0 ? String(newPendingSum) : '' }));
                            }}
                            className="w-4 h-4 rounded text-[var(--accent)] cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-xs text-[var(--text-primary)] truncate">{item.item_name || item.description}</div>
                            <div className="text-[11px] text-[var(--text-muted)] capitalize">{item.item_type} x{item.quantity}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-mono font-bold text-[var(--accent)]">KES {itemPending.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</div>
                            <div className="text-[10px] text-[var(--text-muted)]">Pending</div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Payment Channel / Method *</label>
                  <select
                    value={payForm.payment_method}
                    onChange={e => setPayForm(p => ({ ...p, payment_method: e.target.value }))}
                    className={inpStyle}
                  >
                    <option value="cash">💵 CASH</option>
                    <option value="mpesa">📱 M-PESA</option>
                    <option value="insurance">🛡️ INSURANCE (SHA / PRIVATE / CORPORATE)</option>
                    <option value="sha">🏛️ SHA / GOVERNMENT COVER</option>
                    <option value="bank">🏦 BANK TRANSFER / CHEQUE</option>
                    <option value="corporate">🏢 CORPORATE / CREDIT ACCOUNT</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Amount to Collect (KES) *</label>
                  <input
                    type="number"
                    value={payForm.amount}
                    onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="Enter deposit or payment amount"
                    className={inpStyle}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Transaction Reference / M-Pesa Code / Claim ID</label>
                <input
                  value={payForm.reference_number}
                  onChange={e => setPayForm(p => ({ ...p, reference_number: e.target.value }))}
                  placeholder="e.g. QX8901234, SHA-CLAIM-12003"
                  className={inpStyle}
                />
              </div>

              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Deposit / Payment Notes</label>
                <textarea
                  value={payForm.notes}
                  onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  placeholder="Additional billing remarks or receipt note..."
                  className={inpStyle}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-[var(--border)]">
              <Btn variant="ghost" onClick={() => setShowPaymentModal(false)}>Cancel</Btn>
              <Btn variant="success" onClick={handleRecordInpatientPayment} disabled={paySaving || !payForm.amount}>
                {paySaving ? 'Processing Payment...' : `✅ Collect KES ${parseFloat(payForm.amount || 0).toLocaleString()}`}
              </Btn>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
