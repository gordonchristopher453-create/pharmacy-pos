import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  Users, UserPlus, UserCheck, Calendar, Clock, AlertTriangle,
  Shield, Award, Briefcase, FileText, CheckCircle2, XCircle,
  Search, Filter, Plus, RefreshCw, ChevronRight, Edit3, Trash2,
  Printer, ArrowUpRight, Phone, Mail, MapPin, Building,
  DollarSign, Check, X, Eye, FileSpreadsheet, Sparkles
} from 'lucide-react';

const DEPARTMENTS = [
  'Clinical',
  'Nursing',
  'Pharmacy',
  'Laboratory',
  'Radiology',
  'MCH & Maternity',
  'Administration',
  'Accounts & Billing',
  'Support & Transport'
];

const EMPLOYMENT_TYPES = [
  { id: 'full_time', label: 'Full-Time (Permanent)' },
  { id: 'contract', label: 'Fixed-Term Contract' },
  { id: 'part_time', label: 'Part-Time' },
  { id: 'locum', label: 'Locum / On-Call' },
  { id: 'intern', label: 'Medical Intern' },
];

const LEAVE_TYPES = [
  { id: 'annual', label: 'Annual Leave', days: 21, color: '#3b82f6' },
  { id: 'sick', label: 'Sick Leave', days: 14, color: '#f59e0b' },
  { id: 'maternity', label: 'Maternity Leave', days: 90, color: '#ec4899' },
  { id: 'paternity', label: 'Paternity Leave', days: 14, color: '#8b5cf6' },
  { id: 'compassionate', label: 'Compassionate', days: 5, color: '#64748b' },
  { id: 'study', label: 'Study Leave', days: 30, color: '#06b6d4' },
  { id: 'unpaid', label: 'Unpaid Leave', days: 0, color: '#94a3b8' },
];

const SHIFT_TYPES = [
  { id: 'morning', label: 'Morning Shift (07:30 - 15:30)', short: 'Morning', color: '#10b981', time: '07:30 - 15:30' },
  { id: 'evening', label: 'Evening Shift (14:30 - 22:30)', short: 'Evening', color: '#f59e0b', time: '14:30 - 22:30' },
  { id: 'night', label: 'Night Shift (21:30 - 08:00)', short: 'Night', color: '#8b5cf6', time: '21:30 - 08:00' },
  { id: 'locum', label: 'Locum 24H Coverage', short: 'Locum 24H', color: '#06b6d4', time: '08:00 - 08:00' },
  { id: 'on_call', label: 'On-Call Emergency', short: 'On-Call', color: '#ec4899', time: 'Emergency Call' },
  { id: 'off', label: 'Scheduled Day Off', short: 'Off Duty', color: '#64748b', time: 'Off' },
];

const Card = ({ children, style = {}, ...props }) => (
  <div
    style={{
      background: 'var(--bg-surface)',
      borderRadius: 14,
      border: '1px solid var(--border)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
      ...style
    }}
    {...props}
  >
    {children}
  </div>
);

const fmt = (n) => `KES ${parseFloat(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function HRDashboardPage() {
  const { user } = useSelector(state => state.auth);
  const pharmacy = user?.pharmacy;
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('Staff');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Data States
  const [staff, setStaff] = useState([]);
  const [metrics, setMetrics] = useState({
    totalStaff: 0, activeStaff: 0, onLeaveStaff: 0,
    pendingLeaveRequests: 0, todayShifts: 0, nightShifts: 0, expiringLicenses: 0
  });
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [shiftSchedules, setShiftSchedules] = useState([]);

  // Filter States
  const [staffSearch, setStaffSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [leaveStatusFilter, setLeaveStatusFilter] = useState('all');
  const [shiftDeptFilter, setShiftDeptFilter] = useState('all');
  const [shiftDateFilter, setShiftDateFilter] = useState(new Date().toISOString().split('T')[0]);

  // Modal States
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [selectedStaffDetail, setSelectedStaffDetail] = useState(null);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showBatchShiftModal, setShowBatchShiftModal] = useState(false);
  const [reviewingLeave, setReviewingLeave] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');

  // Initial Form Data
  const EMPTY_STAFF_FORM = {
    employee_number: '', full_name: '', email: '', phone: '', national_id: '',
    gender: 'Male', date_of_birth: '', date_joined: new Date().toISOString().split('T')[0],
    department: 'Clinical', designation: '', employment_type: 'full_time', contract_end_date: '',
    kra_pin: '', nssf_number: '', sha_number: '', license_board: '', license_number: '',
    license_expiry: '', basic_salary: '', house_allowance: '', transport_allowance: '',
    other_allowances: '', bank_name: '', bank_branch: '', bank_account: '', mpesa_number: '',
    annual_leave_days: 21, leave_balance: 21, status: 'active', emergency_contact_name: '',
    emergency_contact_phone: '', emergency_contact_relation: '', notes: ''
  };

  const [staffForm, setStaffForm] = useState(EMPTY_STAFF_FORM);
  const [staffModalTab, setStaffModalTab] = useState('personal');

  const [leaveForm, setLeaveForm] = useState({
    user_id: '', employee_name: '', department: 'Clinical', leave_type: 'annual',
    start_date: new Date().toISOString().split('T')[0], end_date: new Date().toISOString().split('T')[0],
    days_count: 1, reason: '', handover_staff: ''
  });

  const [shiftForm, setShiftForm] = useState({
    user_id: '', employee_name: '', department: 'Clinical', shift_type: 'morning',
    shift_date: new Date().toISOString().split('T')[0], start_time: '07:30', end_time: '15:30',
    notes: '', status: 'scheduled'
  });

  const [batchRosterDate, setBatchRosterDate] = useState(new Date().toISOString().split('T')[0]);
  const [batchRosterDept, setBatchRosterDept] = useState('Clinical');

  // Load All HR Data
  const loadHRData = async () => {
    setLoading(true);
    try {
      const [staffRes, leavesRes, shiftsRes] = await Promise.all([
        api.get('/hr/staff'),
        api.get('/hr/leave'),
        api.get(`/hr/shifts?shift_date=${shiftDateFilter}`),
      ]);

      setStaff(staffRes.data.data?.staff || []);
      setMetrics(staffRes.data.data?.metrics || {});
      setLeaveRequests(leavesRes.data.data || []);
      setShiftSchedules(shiftsRes.data.data || []);
    } catch (error) {
      toast.error('Failed to load HR data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHRData();
  }, [shiftDateFilter]);

  // Handle Staff Save
  const handleSaveStaff = async () => {
    if (!staffForm.full_name) {
      toast.error('Full Name is required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/hr/staff', {
        ...staffForm,
        id: editingStaff ? editingStaff.id : undefined,
        basic_salary: parseFloat(staffForm.basic_salary || 0),
        house_allowance: parseFloat(staffForm.house_allowance || 0),
        transport_allowance: parseFloat(staffForm.transport_allowance || 0),
        other_allowances: parseFloat(staffForm.other_allowances || 0),
        annual_leave_days: parseInt(staffForm.annual_leave_days || 21),
        leave_balance: parseInt(staffForm.leave_balance || 21),
      });

      toast.success(editingStaff ? 'Staff profile updated!' : 'Staff profile registered successfully!');
      setShowStaffModal(false);
      setEditingStaff(null);
      setStaffForm(EMPTY_STAFF_FORM);
      loadHRData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save staff profile');
    } finally {
      setSaving(false);
    }
  };

  // Open Edit Staff
  const handleEditStaff = (st) => {
    setEditingStaff(st);
    setStaffForm({
      ...st,
      date_of_birth: st.date_of_birth ? st.date_of_birth.split('T')[0] : '',
      date_joined: st.date_joined ? st.date_joined.split('T')[0] : '',
      contract_end_date: st.contract_end_date ? st.contract_end_date.split('T')[0] : '',
      license_expiry: st.license_expiry ? st.license_expiry.split('T')[0] : '',
    });
    setStaffModalTab('personal');
    setShowStaffModal(true);
  };

  // Delete Staff
  const handleDeleteStaff = async (id) => {
    if (!window.confirm('Are you sure you want to remove this staff profile?')) return;
    try {
      await api.delete(`/hr/staff/${id}`);
      toast.success('Staff profile removed');
      loadHRData();
    } catch {
      toast.error('Failed to delete staff profile');
    }
  };

  // Leave Submit
  const handleSaveLeave = async () => {
    if (!leaveForm.employee_name || !leaveForm.start_date || !leaveForm.end_date) {
      toast.error('Please fill in required leave details');
      return;
    }
    setSaving(true);
    try {
      await api.post('/hr/leave', leaveForm);
      toast.success('Leave application submitted successfully!');
      setShowLeaveModal(false);
      setLeaveForm({
        user_id: '', employee_name: '', department: 'Clinical', leave_type: 'annual',
        start_date: new Date().toISOString().split('T')[0], end_date: new Date().toISOString().split('T')[0],
        days_count: 1, reason: '', handover_staff: ''
      });
      loadHRData();
    } catch (err) {
      toast.error('Failed to submit leave request');
    } finally {
      setSaving(false);
    }
  };

  // Review Leave
  const handleReviewLeave = async (status) => {
    if (!reviewingLeave) return;
    setSaving(true);
    try {
      await api.patch(`/hr/leave/${reviewingLeave.id}/review`, {
        status,
        review_notes: reviewNotes
      });
      toast.success(`Leave request ${status}`);
      setReviewingLeave(null);
      setReviewNotes('');
      loadHRData();
    } catch (err) {
      toast.error('Failed to review leave request');
    } finally {
      setSaving(false);
    }
  };

  // Shift Submit
  const handleSaveShift = async () => {
    if (!shiftForm.employee_name || !shiftForm.shift_date) {
      toast.error('Staff name and shift date are required');
      return;
    }
    setSaving(true);
    try {
      await api.post('/hr/shifts', shiftForm);
      toast.success('Shift assigned successfully!');
      setShowShiftModal(false);
      loadHRData();
    } catch {
      toast.error('Failed to assign shift');
    } finally {
      setSaving(false);
    }
  };

  // Batch Roster Generator
  const handleGenerateBatchRoster = async () => {
    const deptStaff = staff.filter(s => s.department === batchRosterDept && s.status === 'active');
    if (deptStaff.length === 0) {
      toast.error(`No active staff found in ${batchRosterDept} department`);
      return;
    }

    setSaving(true);
    try {
      const shiftsToCreate = deptStaff.map((st, idx) => {
        // Distribute morning, evening, night shifts
        const shiftType = idx % 3 === 0 ? 'morning' : (idx % 3 === 1 ? 'evening' : 'night');
        const shiftMeta = SHIFT_TYPES.find(s => s.id === shiftType);
        return {
          user_id: st.user_id,
          employee_name: st.full_name,
          department: st.department,
          shift_type: shiftType,
          shift_date: batchRosterDate,
          start_time: shiftMeta?.time.split(' - ')[0] || '08:00',
          end_time: shiftMeta?.time.split(' - ')[1] || '17:00',
          notes: 'Auto-assigned batch department roster',
          status: 'scheduled'
        };
      });

      await api.post('/hr/shifts/batch', { shifts: shiftsToCreate });
      toast.success(`Generated duty roster for ${shiftsToCreate.length} staff!`);
      setShowBatchShiftModal(false);
      loadHRData();
    } catch {
      toast.error('Failed to generate batch roster');
    } finally {
      setSaving(false);
    }
  };

  // Delete Shift
  const handleDeleteShift = async (id) => {
    try {
      await api.delete(`/hr/shifts/${id}`);
      toast.success('Shift removed');
      loadHRData();
    } catch {
      toast.error('Failed to delete shift');
    }
  };

  // Print Roster
  const handlePrintRoster = () => {
    const w = window.open('', '_blank');
    const html = `<!DOCTYPE html><html><head><title>Duty Roster - ${shiftDateFilter}</title>
    <style>
      body{font-family:'Segoe UI',sans-serif;padding:30px;color:#0f172a;max-width:850px;margin:0 auto;}
      .header{border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:20px;display:flex;justify-content:space-between;}
      .title{font-size:20px;font-weight:800;text-transform:uppercase;}
      table{width:100%;border-collapse:collapse;margin-top:16px;}
      td,th{padding:9px 12px;border:1px solid #cbd5e1;font-size:12px;}
      th{background:#0f172a;color:#fff;text-align:left;font-weight:700;text-transform:uppercase;font-size:11px;}
      .badge{padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;}
    </style></head><body>
      <div class="header">
        <div>
          <div class="title">🏥 ${pharmacy?.name || 'Healthcare Facility'}</div>
          <div style="font-size:13px;color:#475569;margin-top:4px;">Official Hospital Duty Roster & Shift Schedule</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">Date: ${shiftDateFilter}</div>
        </div>
        <div style="text-align:right;font-size:11px;color:#64748b;">
          Generated: ${new Date().toLocaleDateString('en-KE')}<br/>
          HR & Operations Management
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Staff Name</th>
            <th>Department</th>
            <th>Shift Type</th>
            <th>Time Slot</th>
            <th>Duty Notes</th>
          </tr>
        </thead>
        <tbody>
          ${shiftSchedules.map(s => `
            <tr>
              <td><strong>${s.employee_name}</strong></td>
              <td>${s.department}</td>
              <td>${s.shift_type?.toUpperCase()}</td>
              <td>${s.start_time} - ${s.end_time}</td>
              <td>${s.notes || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="display:flex;justify-content:space-between;margin-top:40px;font-size:11px;">
        <div>Medical Superintendent: _______________________</div>
        <div>Chief Nursing Officer: _______________________</div>
      </div>
      <script>window.onload=function(){window.print();}</script>
    </body></html>`;
    w.document.write(html);
    w.document.close();
  };

  // Filtered Staff
  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      const matchSearch = !staffSearch ||
        s.full_name?.toLowerCase().includes(staffSearch.toLowerCase()) ||
        s.designation?.toLowerCase().includes(staffSearch.toLowerCase()) ||
        s.employee_number?.toLowerCase().includes(staffSearch.toLowerCase()) ||
        s.phone?.includes(staffSearch);

      const matchDept = deptFilter === 'all' || s.department === deptFilter;
      const matchStatus = statusFilter === 'all' || s.status === statusFilter;

      return matchSearch && matchDept && matchStatus;
    });
  }, [staff, staffSearch, deptFilter, statusFilter]);

  // Expiring Licenses List
  const expiringLicensesList = useMemo(() => {
    const now = new Date();
    const threshold = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days
    return staff.filter(s => {
      if (!s.license_expiry) return false;
      const expiry = new Date(s.license_expiry);
      return expiry <= threshold;
    });
  }, [staff]);

  return (
    <div style={{ padding: 24, height: '100vh', overflowY: 'auto', background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              👥 Human Resources & Workforce Operations
            </h1>
            <span style={{ fontSize: 11, background: '#3b82f620', color: '#3b82f6', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
              ENTERPRISE HR
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Staff roster, leave management, duty schedules, clinical license tracking, and payroll sync.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={loadHRData}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>

          <button
            onClick={() => navigate('/app/finance')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer'
            }}
          >
            <DollarSign size={14} color="#10b981" /> Open Finance & Payroll →
          </button>

          <button
            onClick={() => {
              setEditingStaff(null);
              setStaffForm(EMPTY_STAFF_FORM);
              setStaffModalTab('personal');
              setShowStaffModal(true);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
              background: 'var(--accent)', border: 'none', borderRadius: 8,
              color: '#0F1612', fontSize: 13, fontWeight: 700, cursor: 'pointer'
            }}
          >
            <UserPlus size={15} /> Add Staff Profile
          </button>
        </div>
      </div>

      {/* Top HR KPI Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Card style={{ padding: 16, borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Workforce</span>
            <div style={{ padding: 6, background: '#3b82f615', borderRadius: 8, color: '#3b82f6' }}><Users size={16} /></div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
            {metrics.activeStaff || staff.length} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>/ {staff.length} Total</span>
          </div>
          <div style={{ fontSize: 11, color: '#10b981', marginTop: 4, fontWeight: 600 }}>Enrolled Clinic Staff</div>
        </Card>

        <Card style={{ padding: 16, borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>On Leave</span>
            <div style={{ padding: 6, background: '#f59e0b15', borderRadius: 8, color: '#f59e0b' }}><Calendar size={16} /></div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b', fontFamily: 'monospace' }}>
            {metrics.onLeaveStaff || 0}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {metrics.pendingLeaveRequests || 0} pending approvals
          </div>
        </Card>

        <Card style={{ padding: 16, borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Today's Duty Roster</span>
            <div style={{ padding: 6, background: '#10b98115', borderRadius: 8, color: '#10b981' }}><Clock size={16} /></div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
            {shiftSchedules.length} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Shifts Assigned</span>
          </div>
          <div style={{ fontSize: 11, color: '#10b981', marginTop: 4, fontWeight: 600 }}>
            {shiftSchedules.filter(s => s.shift_type === 'night').length} on Night duty
          </div>
        </Card>

        <Card style={{ padding: 16, borderLeft: `4px solid ${expiringLicensesList.length > 0 ? '#ef4444' : '#10b981'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>License Compliance</span>
            <div style={{ padding: 6, background: expiringLicensesList.length > 0 ? '#ef444415' : '#10b98115', borderRadius: 8, color: expiringLicensesList.length > 0 ? '#ef4444' : '#10b981' }}>
              <Shield size={16} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: expiringLicensesList.length > 0 ? '#ef4444' : '#10b981', fontFamily: 'monospace' }}>
            {expiringLicensesList.length > 0 ? `${expiringLicensesList.length} Expiring` : '100% Compliant'}
          </div>
          <div style={{ fontSize: 11, color: expiringLicensesList.length > 0 ? '#ef4444' : 'var(--text-muted)', marginTop: 4, fontWeight: 600 }}>
            Board registrations & licenses
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { id: 'Staff', label: '👥 Staff Directory & Profiles', icon: Users, badge: staff.length },
          { id: 'Leave', label: '🏖️ Leave Management', icon: Calendar, badge: metrics.pendingLeaveRequests || null },
          { id: 'Roster', label: '📅 Duty Roster & Shifts', icon: Clock, badge: shiftSchedules.length || null },
          { id: 'Licenses', label: '🛡️ Professional Licensing & Compliance', icon: Award, badge: expiringLicensesList.length || null },
        ].map(t => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? '#0F1612' : 'var(--text-muted)',
                borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none',
                cursor: 'pointer', transition: 'all 0.15s ease'
              }}
            >
              <Icon size={16} /> {t.label}
              {t.badge ? (
                <span style={{
                  padding: '1px 6px', borderRadius: 10, fontSize: 10, fontWeight: 800,
                  background: active ? '#0F1612' : 'var(--bg-elevated)',
                  color: active ? 'var(--accent)' : 'var(--text-primary)',
                  border: active ? 'none' : '1px solid var(--border)'
                }}>
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: STAFF DIRECTORY ── */}
      {activeTab === 'Staff' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Filters Bar */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search staff by name, designation, phone, ID..."
                value={staffSearch}
                onChange={e => setStaffSearch(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px 9px 36px', background: 'var(--bg-surface)',
                  border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)',
                  fontSize: 13, outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>

            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              style={{
                padding: '9px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none'
              }}
            >
              <option value="all">All Departments</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                padding: '9px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none'
              }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="on_leave">On Leave</option>
              <option value="suspended">Suspended</option>
              <option value="terminated">Terminated</option>
            </select>

            <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
              Showing {filteredStaff.length} of {staff.length} staff
            </div>
          </div>

          {/* Staff Table */}
          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                    {['Staff Member', 'Department & Role', 'Contact Details', 'Statutory / KRA', 'Remuneration', 'Leave Bal.', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '11px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>
                        No staff members found matching your search. Click "Add Staff Profile" to register an employee.
                      </td>
                    </tr>
                  ) : filteredStaff.map(st => (
                    <tr key={st.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-soft)',
                            color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, fontWeight: 800, flexShrink: 0
                          }}>
                            {st.full_name?.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{st.full_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {st.employee_number ? `EMP-${st.employee_number}` : `ID-${st.id}`} · {st.gender || '—'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{st.designation || 'Staff'}</div>
                        <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>{st.department || 'Clinical'}</div>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Phone size={12} color="var(--text-muted)" /> {st.phone || '—'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Mail size={12} color="var(--text-muted)" /> {st.email || '—'}
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px', fontSize: 11, fontFamily: 'monospace' }}>
                        <div>KRA: <strong style={{ color: 'var(--text-primary)' }}>{st.kra_pin || '—'}</strong></div>
                        <div>SHA: <strong style={{ color: 'var(--text-primary)' }}>{st.sha_number || '—'}</strong></div>
                      </td>

                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#10b981' }}>
                        {fmt(st.basic_salary)}
                        {parseFloat(st.house_allowance || 0) > 0 && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
                            +{fmt(parseFloat(st.house_allowance || 0) + parseFloat(st.transport_allowance || 0))} Allowances
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700 }}>
                        <span style={{ color: st.leave_balance > 5 ? '#10b981' : '#f59e0b' }}>
                          {st.leave_balance ?? 21} Days
                        </span>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                          textTransform: 'capitalize',
                          background: st.status === 'active' ? '#10b98120' : (st.status === 'on_leave' ? '#f59e0b20' : '#ef444420'),
                          color: st.status === 'active' ? '#10b981' : (st.status === 'on_leave' ? '#f59e0b' : '#ef4444'),
                        }}>
                          {st.status?.replace('_', ' ') || 'Active'}
                        </span>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => setSelectedStaffDetail(st)}
                            title="View Full Profile"
                            style={{
                              padding: '5px 8px', borderRadius: 6, border: 'none',
                              background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                              cursor: 'pointer'
                            }}
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            onClick={() => handleEditStaff(st)}
                            title="Edit Profile"
                            style={{
                              padding: '5px 8px', borderRadius: 6, border: 'none',
                              background: '#3b82f620', color: '#3b82f6', cursor: 'pointer'
                            }}
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteStaff(st.id)}
                            title="Delete Profile"
                            style={{
                              padding: '5px 8px', borderRadius: 6, border: 'none',
                              background: '#ef444420', color: '#ef4444', cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB 2: LEAVE MANAGEMENT ── */}
      {activeTab === 'Leave' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Filter Status:</span>
              <select
                value={leaveStatusFilter}
                onChange={e => setLeaveStatusFilter(e.target.value)}
                style={{
                  padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                }}
              >
                <option value="all">All Applications</option>
                <option value="pending">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <button
              onClick={() => setShowLeaveModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
                background: 'var(--accent)', border: 'none', borderRadius: 8,
                color: '#0F1612', fontSize: 13, fontWeight: 700, cursor: 'pointer'
              }}
            >
              <Plus size={15} /> Apply for Leave
            </button>
          </div>

          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                    {['Employee Name', 'Department', 'Leave Type', 'Period / Dates', 'Duration', 'Reason & Handover', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '11px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>
                        No leave applications recorded. Click "Apply for Leave" to create an application.
                      </td>
                    </tr>
                  ) : leaveRequests.map(lr => (
                    <tr key={lr.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {lr.employee_name}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                        {lr.department || 'Clinical'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                          background: '#3b82f620', color: '#3b82f6', textTransform: 'capitalize'
                        }}>
                          {lr.leave_type} Leave
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-primary)' }}>
                        {new Date(lr.start_date).toLocaleDateString('en-KE')} → {new Date(lr.end_date).toLocaleDateString('en-KE')}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        {lr.days_count} Days
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                        <div>{lr.reason || '—'}</div>
                        {lr.handover_staff && <div style={{ fontSize: 10, color: '#10b981' }}>Handover: {lr.handover_staff}</div>}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                          textTransform: 'capitalize',
                          background: lr.status === 'approved' ? '#10b98120' : (lr.status === 'pending' ? '#f59e0b20' : '#ef444420'),
                          color: lr.status === 'approved' ? '#10b981' : (lr.status === 'pending' ? '#f59e0b' : '#ef4444'),
                        }}>
                          {lr.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {lr.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => { setReviewingLeave(lr); setReviewNotes(''); }}
                              style={{
                                padding: '5px 10px', borderRadius: 6, border: 'none',
                                background: '#10b98120', color: '#10b981', fontSize: 11, fontWeight: 700,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                              }}
                            >
                              <Check size={12} /> Review
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Reviewed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB 3: DUTY ROSTER & SHIFT SCHEDULES ── */}
      {activeTab === 'Roster' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Roster Date:</span>
              <input
                type="date"
                value={shiftDateFilter}
                onChange={e => setShiftDateFilter(e.target.value)}
                style={{
                  padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                }}
              />
              <select
                value={shiftDeptFilter}
                onChange={e => setShiftDeptFilter(e.target.value)}
                style={{
                  padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none'
                }}
              >
                <option value="all">All Departments</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handlePrintRoster}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}
              >
                <Printer size={14} /> Print Roster
              </button>

              <button
                onClick={() => setShowBatchShiftModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer'
                }}
              >
                <Sparkles size={14} color="var(--accent)" /> Auto-Generate Roster
              </button>

              <button
                onClick={() => setShowShiftModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
                  background: 'var(--accent)', border: 'none', borderRadius: 8,
                  color: '#0F1612', fontSize: 13, fontWeight: 700, cursor: 'pointer'
                }}
              >
                <Plus size={15} /> Assign Shift
              </button>
            </div>
          </div>

          {/* Shift Schedule Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {SHIFT_TYPES.map(st => {
              const shiftsInType = shiftSchedules.filter(s => s.shift_type === st.id);
              return (
                <Card key={st.id} style={{ padding: 16, borderTop: `4px solid ${st.color}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        {st.label}
                      </h4>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{st.time}</div>
                    </div>
                    <span style={{
                      padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 800,
                      background: `${st.color}20`, color: st.color
                    }}>
                      {shiftsInType.length} Assigned
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
                    {shiftsInType.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', padding: '20px 0' }}>
                        No personnel assigned to this shift
                      </div>
                    ) : shiftsInType.map(s => (
                      <div
                        key={s.id}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 8,
                          border: '1px solid var(--border)'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{s.employee_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.department} · {s.start_time}-{s.end_time}</div>
                        </div>
                        <button
                          onClick={() => handleDeleteShift(s.id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 4: LICENSING & COMPLIANCE ── */}
      {activeTab === 'Licenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            <Card style={{ padding: 20, borderLeft: '4px solid #3b82f6' }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={18} color="#3b82f6" /> Statutory Regulatory Compliance
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                All medical professionals (Doctors, Pharmacists, Clinical Officers, Nurses, Lab Technicians) must maintain active practice licenses registered with Pharmacy and Poisons Board (PPB), KMPDC, Nursing Council of Kenya (NCK), or KMLTTB.
              </p>
            </Card>

            <Card style={{ padding: 20, borderLeft: `4px solid ${expiringLicensesList.length > 0 ? '#ef4444' : '#10b981'}` }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} color={expiringLicensesList.length > 0 ? '#ef4444' : '#10b981'} />
                Upcoming Renewals & Expirations (Next 60 Days)
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {expiringLicensesList.length} staff members have licenses requiring renewal action.
              </p>
            </Card>
          </div>

          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                    {['Staff Member', 'Department', 'Regulatory Board', 'License Number', 'Expiry Date', 'Status & Action'].map(h => (
                      <th key={h} style={{ padding: '11px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staff.filter(s => s.license_number || s.license_board).map(st => {
                    const isExpiring = st.license_expiry && new Date(st.license_expiry) <= new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
                    return (
                      <tr key={st.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{st.full_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{st.designation}</div>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{st.department}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>{st.license_board || 'Medical Board'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13, fontFamily: 'monospace', fontWeight: 700 }}>{st.license_number || '—'}</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: isExpiring ? '#ef4444' : 'var(--text-primary)', fontWeight: isExpiring ? 800 : 500 }}>
                          {st.license_expiry ? new Date(st.license_expiry).toLocaleDateString('en-KE') : 'No Expiry Date'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                            background: isExpiring ? '#ef444420' : '#10b98120',
                            color: isExpiring ? '#ef4444' : '#10b981'
                          }}>
                            {isExpiring ? '⚠️ Action Required' : 'Active & Verified'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT STAFF PROFILE ── */}
      {showStaffModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
        }}>
          <div style={{
            background: 'var(--bg-surface)', width: '100%', maxWidth: 780, maxHeight: '90vh',
            borderRadius: 16, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  {editingStaff ? '✏️ Edit Staff Profile' : '👤 Register New Staff Member'}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  Complete personnel file, statutory details, remuneration, and leave balance.
                </p>
              </div>
              <button onClick={() => setShowStaffModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Sub-tabs */}
            <div style={{ display: 'flex', gap: 6, padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', flexWrap: 'wrap' }}>
              {[
                { id: 'personal', label: '1. Personal Details' },
                { id: 'employment', label: '2. Role & Department' },
                { id: 'statutory', label: '3. KRA & Licensing' },
                { id: 'salary', label: '4. Remuneration & Bank' },
                { id: 'emergency', label: '5. Emergency Contact' },
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => setStaffModalTab(st.id)}
                  style={{
                    padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: 'none',
                    background: staffModalTab === st.id ? 'var(--accent)' : 'transparent',
                    color: staffModalTab === st.id ? '#0F1612' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {staffModalTab === 'personal' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Full Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. Jane Mutua"
                      value={staffForm.full_name}
                      onChange={e => setStaffForm(f => ({ ...f, full_name: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Staff ID / Employee Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 1042"
                      value={staffForm.employee_number}
                      onChange={e => setStaffForm(f => ({ ...f, employee_number: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>National ID / Passport</label>
                    <input
                      type="text"
                      placeholder="e.g. 32415890"
                      value={staffForm.national_id}
                      onChange={e => setStaffForm(f => ({ ...f, national_id: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 0712345678"
                      value={staffForm.phone}
                      onChange={e => setStaffForm(f => ({ ...f, phone: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Email Address</label>
                    <input
                      type="email"
                      placeholder="e.g. jane@clinic.com"
                      value={staffForm.email}
                      onChange={e => setStaffForm(f => ({ ...f, email: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Gender</label>
                    <select
                      value={staffForm.gender}
                      onChange={e => setStaffForm(f => ({ ...f, gender: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Date of Birth</label>
                    <input
                      type="date"
                      value={staffForm.date_of_birth}
                      onChange={e => setStaffForm(f => ({ ...f, date_of_birth: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              )}

              {staffModalTab === 'employment' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Primary Department</label>
                    <select
                      value={staffForm.department}
                      onChange={e => setStaffForm(f => ({ ...f, department: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    >
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Designation / Job Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Senior Medical Officer / Pharmacist"
                      value={staffForm.designation}
                      onChange={e => setStaffForm(f => ({ ...f, designation: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Employment Contract Type</label>
                    <select
                      value={staffForm.employment_type}
                      onChange={e => setStaffForm(f => ({ ...f, employment_type: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    >
                      {EMPLOYMENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Employment Status</label>
                    <select
                      value={staffForm.status}
                      onChange={e => setStaffForm(f => ({ ...f, status: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    >
                      <option value="active">Active</option>
                      <option value="on_leave">On Leave</option>
                      <option value="suspended">Suspended</option>
                      <option value="terminated">Terminated</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Date of Joining</label>
                    <input
                      type="date"
                      value={staffForm.date_joined}
                      onChange={e => setStaffForm(f => ({ ...f, date_joined: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Contract Expiry Date (if applicable)</label>
                    <input
                      type="date"
                      value={staffForm.contract_end_date}
                      onChange={e => setStaffForm(f => ({ ...f, contract_end_date: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              )}

              {staffModalTab === 'statutory' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>KRA PIN Number</label>
                    <input
                      type="text"
                      placeholder="e.g. A012345678Z"
                      value={staffForm.kra_pin}
                      onChange={e => setStaffForm(f => ({ ...f, kra_pin: e.target.value.toUpperCase() }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>NSSF Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 10234567"
                      value={staffForm.nssf_number}
                      onChange={e => setStaffForm(f => ({ ...f, nssf_number: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>SHA / NHIF Number</label>
                    <input
                      type="text"
                      placeholder="e.g. SHA-89210"
                      value={staffForm.sha_number}
                      onChange={e => setStaffForm(f => ({ ...f, sha_number: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Professional Licensing Board</label>
                    <input
                      type="text"
                      placeholder="e.g. Pharmacy and Poisons Board / KMPDC"
                      value={staffForm.license_board}
                      onChange={e => setStaffForm(f => ({ ...f, license_board: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>License / Registration No.</label>
                    <input
                      type="text"
                      placeholder="e.g. PPB/P/2024/091"
                      value={staffForm.license_number}
                      onChange={e => setStaffForm(f => ({ ...f, license_number: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>License Expiry Date</label>
                    <input
                      type="date"
                      value={staffForm.license_expiry}
                      onChange={e => setStaffForm(f => ({ ...f, license_expiry: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              )}

              {staffModalTab === 'salary' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Basic Monthly Salary (KES) *</label>
                    <input
                      type="number"
                      placeholder="e.g. 60000"
                      value={staffForm.basic_salary}
                      onChange={e => setStaffForm(f => ({ ...f, basic_salary: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>House Allowance (KES)</label>
                    <input
                      type="number"
                      placeholder="e.g. 10000"
                      value={staffForm.house_allowance}
                      onChange={e => setStaffForm(f => ({ ...f, house_allowance: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Transport / Commuter (KES)</label>
                    <input
                      type="number"
                      placeholder="e.g. 5000"
                      value={staffForm.transport_allowance}
                      onChange={e => setStaffForm(f => ({ ...f, transport_allowance: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Annual Leave Entitlement (Days)</label>
                    <input
                      type="number"
                      value={staffForm.annual_leave_days}
                      onChange={e => setStaffForm(f => ({ ...f, annual_leave_days: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g. KCB Bank / Equity Bank"
                      value={staffForm.bank_name}
                      onChange={e => setStaffForm(f => ({ ...f, bank_name: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Bank Account Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 1102938475"
                      value={staffForm.bank_account}
                      onChange={e => setStaffForm(f => ({ ...f, bank_account: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Mobile Money (M-Pesa) Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 0712345678"
                      value={staffForm.mpesa_number}
                      onChange={e => setStaffForm(f => ({ ...f, mpesa_number: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              )}

              {staffModalTab === 'emergency' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Emergency Contact Name</label>
                    <input
                      type="text"
                      placeholder="e.g. John Mutua"
                      value={staffForm.emergency_contact_name}
                      onChange={e => setStaffForm(f => ({ ...f, emergency_contact_name: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Emergency Contact Phone</label>
                    <input
                      type="text"
                      placeholder="e.g. 0722000000"
                      value={staffForm.emergency_contact_phone}
                      onChange={e => setStaffForm(f => ({ ...f, emergency_contact_phone: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Relationship</label>
                    <input
                      type="text"
                      placeholder="e.g. Spouse / Parent / Sibling"
                      value={staffForm.emergency_contact_relation}
                      onChange={e => setStaffForm(f => ({ ...f, emergency_contact_relation: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>HR Notes & Appraisals</label>
                    <textarea
                      rows={3}
                      placeholder="Additional notes, certifications, or contract specifications..."
                      value={staffForm.notes}
                      onChange={e => setStaffForm(f => ({ ...f, notes: e.target.value }))}
                      style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => setShowStaffModal(false)}
                style={{ padding: '9px 16px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>

              <div style={{ display: 'flex', gap: 8 }}>
                {staffModalTab !== 'personal' && (
                  <button
                    onClick={() => {
                      const tabs = ['personal', 'employment', 'statutory', 'salary', 'emergency'];
                      const idx = tabs.indexOf(staffModalTab);
                      if (idx > 0) setStaffModalTab(tabs[idx - 1]);
                    }}
                    style={{ padding: '9px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    ← Previous
                  </button>
                )}

                {staffModalTab !== 'emergency' ? (
                  <button
                    onClick={() => {
                      const tabs = ['personal', 'employment', 'statutory', 'salary', 'emergency'];
                      const idx = tabs.indexOf(staffModalTab);
                      if (idx < tabs.length - 1) setStaffModalTab(tabs[idx + 1]);
                    }}
                    style={{ padding: '9px 16px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0F1612', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Next Step →
                  </button>
                ) : (
                  <button
                    onClick={handleSaveStaff}
                    disabled={saving}
                    style={{ padding: '9px 20px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0F1612', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
                  >
                    {saving ? 'Saving...' : '💾 Save Staff Profile'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: APPLY FOR LEAVE ── */}
      {showLeaveModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
        }}>
          <div style={{
            background: 'var(--bg-surface)', width: '100%', maxWidth: 540,
            borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>🏖️ Apply for Leave</h3>
              <button onClick={() => setShowLeaveModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Staff Member</label>
                <select
                  value={leaveForm.employee_name}
                  onChange={e => {
                    const selected = staff.find(s => s.full_name === e.target.value);
                    setLeaveForm(f => ({
                      ...f,
                      employee_name: e.target.value,
                      user_id: selected?.user_id || null,
                      department: selected?.department || 'Clinical'
                    }));
                  }}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                >
                  <option value="">Select Employee</option>
                  {staff.map(s => <option key={s.id} value={s.full_name}>{s.full_name} ({s.department})</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Leave Type</label>
                <select
                  value={leaveForm.leave_type}
                  onChange={e => setLeaveForm(f => ({ ...f, leave_type: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                >
                  {LEAVE_TYPES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Start Date</label>
                  <input
                    type="date"
                    value={leaveForm.start_date}
                    onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>End Date</label>
                  <input
                    type="date"
                    value={leaveForm.end_date}
                    onChange={e => setLeaveForm(f => ({ ...f, end_date: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Number of Working Days</label>
                <input
                  type="number"
                  value={leaveForm.days_count}
                  onChange={e => setLeaveForm(f => ({ ...f, days_count: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Handover Colleague</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Kamau / Nurse Lucy"
                  value={leaveForm.handover_staff}
                  onChange={e => setLeaveForm(f => ({ ...f, handover_staff: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Reason for Leave</label>
                <textarea
                  rows={2}
                  placeholder="State the reason or clinical handover plan..."
                  value={leaveForm.reason}
                  onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowLeaveModal(false)} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13 }}>Cancel</button>
              <button onClick={handleSaveLeave} disabled={saving} style={{ padding: '8px 18px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0F1612', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                {saving ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: REVIEW LEAVE REQUEST ── */}
      {reviewingLeave && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
        }}>
          <div style={{ background: 'var(--bg-surface)', width: '100%', maxWidth: 480, borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Review Leave Application</h3>
              <button onClick={() => setReviewingLeave(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{reviewingLeave.employee_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{reviewingLeave.department} · {reviewingLeave.leave_type} Leave ({reviewingLeave.days_count} Days)</div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 6 }}>
                  Dates: {new Date(reviewingLeave.start_date).toLocaleDateString('en-KE')} to {new Date(reviewingLeave.end_date).toLocaleDateString('en-KE')}
                </div>
                {reviewingLeave.reason && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Reason: {reviewingLeave.reason}</div>}
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Supervisor / HR Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional approval/rejection remarks..."
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => handleReviewLeave('rejected')}
                disabled={saving}
                style={{ padding: '8px 16px', background: '#ef444420', border: '1px solid #ef444440', borderRadius: 8, color: '#ef4444', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                Reject Request
              </button>
              <button
                onClick={() => handleReviewLeave('approved')}
                disabled={saving}
                style={{ padding: '8px 18px', background: '#10b981', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
              >
                Approve & Deduct Days
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ASSIGN SHIFT ── */}
      {showShiftModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
        }}>
          <div style={{ background: 'var(--bg-surface)', width: '100%', maxWidth: 500, borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>📅 Assign Shift</h3>
              <button onClick={() => setShowShiftModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Staff Member</label>
                <select
                  value={shiftForm.employee_name}
                  onChange={e => {
                    const selected = staff.find(s => s.full_name === e.target.value);
                    setShiftForm(f => ({
                      ...f,
                      employee_name: e.target.value,
                      user_id: selected?.user_id || null,
                      department: selected?.department || 'Clinical'
                    }));
                  }}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                >
                  <option value="">Select Employee</option>
                  {staff.map(s => <option key={s.id} value={s.full_name}>{s.full_name} ({s.department})</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Shift Type</label>
                <select
                  value={shiftForm.shift_type}
                  onChange={e => {
                    const st = SHIFT_TYPES.find(t => t.id === e.target.value);
                    const times = st?.time.split(' - ') || ['08:00', '17:00'];
                    setShiftForm(f => ({
                      ...f,
                      shift_type: e.target.value,
                      start_time: times[0],
                      end_time: times[1] || '17:00'
                    }));
                  }}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                >
                  {SHIFT_TYPES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Shift Date</label>
                <input
                  type="date"
                  value={shiftForm.shift_date}
                  onChange={e => setShiftForm(f => ({ ...f, shift_date: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Start Time</label>
                  <input
                    type="text"
                    value={shiftForm.start_time}
                    onChange={e => setShiftForm(f => ({ ...f, start_time: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>End Time</label>
                  <input
                    type="text"
                    value={shiftForm.end_time}
                    onChange={e => setShiftForm(f => ({ ...f, end_time: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Notes / Ward Assignment</label>
                <input
                  type="text"
                  placeholder="e.g. Inpatient Ward A, Triage, Night Coverage"
                  value={shiftForm.notes}
                  onChange={e => setShiftForm(f => ({ ...f, notes: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowShiftModal(false)} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13 }}>Cancel</button>
              <button onClick={handleSaveShift} disabled={saving} style={{ padding: '8px 18px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0F1612', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                {saving ? 'Saving...' : 'Assign Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: AUTO GENERATE ROSTER ── */}
      {showBatchShiftModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
        }}>
          <div style={{ background: 'var(--bg-surface)', width: '100%', maxWidth: 480, borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>✨ Auto-Generate Department Roster</h3>
              <button onClick={() => setShowBatchShiftModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                Automatically distributes active staff in the selected department across Morning, Evening, and Night shifts.
              </p>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Department</label>
                <select
                  value={batchRosterDept}
                  onChange={e => setBatchRosterDept(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                >
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Date</label>
                <input
                  type="date"
                  value={batchRosterDate}
                  onChange={e => setBatchRosterDate(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowBatchShiftModal(false)} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13 }}>Cancel</button>
              <button onClick={handleGenerateBatchRoster} disabled={saving} style={{ padding: '8px 18px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0F1612', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                {saving ? 'Generating...' : '⚡ Generate Roster'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: STAFF FULL PROFILE VIEW ── */}
      {selectedStaffDetail && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
        }}>
          <div style={{ background: 'var(--bg-surface)', width: '100%', maxWidth: 640, borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}>
                  {selectedStaffDetail.full_name?.charAt(0)}
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>{selectedStaffDetail.full_name}</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedStaffDetail.designation} · {selectedStaffDetail.department}</div>
                </div>
              </div>
              <button onClick={() => setSelectedStaffDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div style={{ padding: 20, maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 12, background: 'var(--bg-elevated)', borderRadius: 10 }}>
                <div><div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Employee ID</div><div style={{ fontSize: 13, fontWeight: 700 }}>EMP-{selectedStaffDetail.employee_number || selectedStaffDetail.id}</div></div>
                <div><div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>National ID</div><div style={{ fontSize: 13, fontWeight: 700 }}>{selectedStaffDetail.national_id || '—'}</div></div>
                <div><div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Phone</div><div style={{ fontSize: 13, fontWeight: 700 }}>{selectedStaffDetail.phone || '—'}</div></div>
                <div><div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Email</div><div style={{ fontSize: 13, fontWeight: 700 }}>{selectedStaffDetail.email || '—'}</div></div>
                <div><div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Date of Joining</div><div style={{ fontSize: 13, fontWeight: 700 }}>{selectedStaffDetail.date_joined ? new Date(selectedStaffDetail.date_joined).toLocaleDateString('en-KE') : '—'}</div></div>
                <div><div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Contract Type</div><div style={{ fontSize: 13, fontWeight: 700, textTransform: 'capitalize' }}>{selectedStaffDetail.employment_type?.replace('_', ' ') || 'Full-time'}</div></div>
              </div>

              <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#3b82f6' }}>Statutory & Remuneration Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div>KRA PIN: <strong>{selectedStaffDetail.kra_pin || '—'}</strong></div>
                  <div>SHA Number: <strong>{selectedStaffDetail.sha_number || '—'}</strong></div>
                  <div>NSSF Number: <strong>{selectedStaffDetail.nssf_number || '—'}</strong></div>
                  <div>Basic Salary: <strong style={{ color: '#10b981' }}>{fmt(selectedStaffDetail.basic_salary)}</strong></div>
                  <div>Bank: <strong>{selectedStaffDetail.bank_name || '—'}</strong> ({selectedStaffDetail.bank_account || '—'})</div>
                  <div>M-Pesa: <strong>{selectedStaffDetail.mpesa_number || '—'}</strong></div>
                </div>
              </div>

              {selectedStaffDetail.license_number && (
                <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b' }}>Professional Board & Licensing</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    Board: <strong>{selectedStaffDetail.license_board}</strong> | License No: <strong>{selectedStaffDetail.license_number}</strong>
                  </div>
                  <div style={{ fontSize: 12, marginTop: 2 }}>
                    License Expiry: <strong>{selectedStaffDetail.license_expiry ? new Date(selectedStaffDetail.license_expiry).toLocaleDateString('en-KE') : 'No Expiry'}</strong>
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedStaffDetail(null)} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0F1612', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Close Profile</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
