import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Plus, X, Loader, Shield, Eye, EyeOff, ChevronDown, ChevronUp, Check, RefreshCw, Lock, Sliders } from 'lucide-react';

const PERMISSION_GROUPS = {
  'Patient & Registration': [
    { key: 'can_register_patients',         label: 'Register Patients' },
    { key: 'can_manage_visits',             label: 'Manage Visits' },
    { key: 'can_book_appointments',         label: 'Book Appointments' },
    { key: 'can_manage_queue',              label: 'Manage Queue' },
    { key: 'can_search_patients',           label: 'Search Patients' },
    { key: 'can_view_patient_demographics', label: 'View Patient Demographics' },
  ],
  'Billing & Payments': [
    { key: 'can_create_bills',           label: 'Create Bills' },
    { key: 'can_receive_payments',       label: 'Receive Payments' },
    { key: 'can_print_receipts',         label: 'Print Receipts' },
    { key: 'can_print_invoices',         label: 'Print Invoices' },
    { key: 'can_view_daily_collections', label: 'View Daily Collections' },
    { key: 'can_view_cash_reports',      label: 'View Cash Reports' },
    { key: 'can_access_pos',             label: 'Access POS' },
  ],
  'SHA / Claims': [
    { key: 'can_verify_sha_patients',     label: 'Verify SHA Patients' },
    { key: 'can_create_sha_claims',       label: 'Create Claims' },
    { key: 'can_submit_sha_claims',       label: 'Submit Claims' },
    { key: 'can_track_sha_claims',        label: 'Track Claims' },
    { key: 'can_manage_claim_rejections', label: 'Manage Rejections' },
    { key: 'can_view_claim_reports',      label: 'View Claim Reports' },
  ],
  'Finance & Accounting': [
    { key: 'can_view_financial_reports',    label: 'Financial Reports' },
    { key: 'can_view_revenue_reports',      label: 'Revenue Reports' },
    { key: 'can_view_reconciliation',       label: 'Reconciliation Reports' },
    { key: 'can_view_outstanding_balances', label: 'Outstanding Balances' },
    { key: 'can_view_audit_reports',        label: 'Audit Reports' },
    { key: 'can_view_executive_dashboard',  label: 'Executive Dashboard' },
    { key: 'can_view_all_reports',          label: 'All Reports' },
  ],
  'Nursing': [
    { key: 'can_do_triage',              label: 'Triage' },
    { key: 'can_record_vitals',          label: 'Record Vitals' },
    { key: 'can_add_nursing_notes',      label: 'Nursing Notes' },
    { key: 'can_manage_injections',      label: 'Injections' },
    { key: 'can_manage_ward_activities', label: 'Ward Activities' },
  ],
  'MCH': [
    { key: 'can_manage_anc',             label: 'ANC' },
    { key: 'can_manage_pnc',             label: 'PNC' },
    { key: 'can_manage_immunization',    label: 'Immunization' },
    { key: 'can_manage_cwc',             label: 'Child Welfare Clinic' },
    { key: 'can_manage_family_planning', label: 'Family Planning' },
    { key: 'can_manage_mch',             label: 'MCH Reports' },
  ],
  'Clinical': [
    { key: 'can_do_consultation',           label: 'Consultation' },
    { key: 'can_make_diagnoses',            label: 'Diagnoses' },
    { key: 'can_write_prescriptions',       label: 'Prescriptions' },
    { key: 'can_request_lab',               label: 'Lab Requests' },
    { key: 'can_request_radiology',         label: 'Radiology Requests' },
    { key: 'can_manage_admissions',         label: 'Admissions' },
    { key: 'can_write_discharge_summaries', label: 'Discharge Summaries' },
    { key: 'can_view_clinical_reports',     label: 'Clinical Reports' },
  ],
  'Laboratory': [
    { key: 'can_manage_lab',           label: 'Manage Lab Queue' },
    { key: 'can_record_lab_results',   label: 'Record Results' },
    { key: 'can_validate_lab_results', label: 'Validate Results' },
    { key: 'can_print_lab_reports',    label: 'Print Lab Reports' },
  ],
  'Pharmacy': [
    { key: 'can_dispense_medication',    label: 'Dispense Medication' },
    { key: 'can_manage_pharmacy',        label: 'Manage Pharmacy Stock' },
    { key: 'can_manage_drug_batches',    label: 'Drug Batches' },
    { key: 'can_manage_expiry_tracking', label: 'Expiry Tracking' },
    { key: 'can_view_pharmacy_reports',  label: 'Pharmacy Reports' },
  ],
  'Inventory & Store': [
    { key: 'can_manage_stock',           label: 'Inventory Management' },
    { key: 'can_manage_purchases',       label: 'Purchases' },
    { key: 'can_manage_suppliers',       label: 'Suppliers' },
    { key: 'can_manage_stock_transfers', label: 'Stock Transfers' },
    { key: 'can_do_stock_audits',        label: 'Stock Audits' },
  ],
  'Admin & System': [
    { key: 'can_manage_users',          label: 'Manage Users' },
    { key: 'can_assign_roles',          label: 'Assign Roles' },
    { key: 'can_assign_permissions',    label: 'Assign Permissions' },
    { key: 'can_manage_departments',    label: 'Manage Departments' },
    { key: 'can_manage_billing_config', label: 'Configure Billing' },
    { key: 'can_manage_sha_settings',   label: 'Configure SHA' },
    { key: 'can_manage_mch_config',     label: 'Configure MCH' },
    { key: 'can_manage_wards',          label: 'Manage Wards' },
    { key: 'can_manage_beds',           label: 'Manage Beds' },
  ],
};

const ROLE_META = {
  facility_admin:   { label: 'Facility Admin',   icon: '👑', color: '#10b981' },
  receptionist:     { label: 'Receptionist',     icon: '📋', color: '#f97316' },
  cashier:          { label: 'Cashier',          icon: '🧾', color: '#eab308' },
  sha_officer:      { label: 'SHA Officer',      icon: '🏥', color: '#06b6d4' },
  accountant:       { label: 'Accountant',       icon: '📊', color: '#8b5cf6' },
  nurse:            { label: 'Nurse',            icon: '🩺', color: '#ec4899' },
  mch_nurse:        { label: 'MCH Nurse',        icon: '👶', color: '#f43f5e' },
  clinical_officer: { label: 'Clinical Officer', icon: '🩻', color: '#3b82f6' },
  doctor:           { label: 'Doctor',           icon: '👨‍⚕️', color: '#3b82f6' },
  lab_technician:      { label: 'Lab Technologist',      icon: '🔬', color: '#06b6d4' },
  pharmacist:       { label: 'Pharmacist',       icon: '💊', color: '#10b981' },
  store_manager:    { label: 'Store Manager',    icon: '📦', color: '#84cc16' },
};

const Card = ({ children, style = {} }) => (
  <div style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)', ...style }}>
    {children}
  </div>
);

const Input = ({ label, ...props }) => (
  <div>
    {label && <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>{label}</label>}
    <input {...props} style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }} />
  </div>
);

const Btn = ({ children, variant = 'primary', size = 'md', ...props }) => (
  <button {...props} style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: size === 'sm' ? '6px 12px' : '10px 18px',
    background: variant === 'primary' ? 'var(--accent)' : variant === 'danger' ? 'var(--danger)' : 'var(--bg-elevated)',
    border: variant === 'ghost' ? '1px solid var(--border)' : 'none',
    borderRadius: 8, color: variant === 'primary' ? '#0F1612' : 'var(--text-primary)',
    fontSize: size === 'sm' ? 12 : 13, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'DM Sans, sans-serif', ...props.style
  }}>{children}</button>
);

const RoleBadge = ({ role }) => {
  const meta = ROLE_META[role] || { label: role, icon: '👤', color: '#888' };
  return (
    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 600, background: `${meta.color}22`, color: meta.color, whiteSpace: 'nowrap' }}>
      {meta.icon} {meta.label}
    </span>
  );
};

function PermissionEditor({ permissions, onChange, roleDefaults }) {
  const [expanded, setExpanded] = useState({});
  const permsSet = new Set(permissions);

  const togglePerm = (key) => {
    const next = new Set(permsSet);
    if (next.has(key)) next.delete(key); else next.add(key);
    onChange([...next]);
  };

  const toggleGroup = (group, items) => {
    const allOn = items.every(p => permsSet.has(p.key));
    const next = new Set(permsSet);
    items.forEach(p => allOn ? next.delete(p.key) : next.add(p.key));
    onChange([...next]);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {roleDefaults && (
          <Btn size="sm" variant="ghost" onClick={() => onChange([...roleDefaults])}>
            <RefreshCw size={12} /> Reset to Role Defaults
          </Btn>
        )}
        <Btn size="sm" variant="ghost" onClick={() => onChange(Object.values(PERMISSION_GROUPS).flat().map(p => p.key))}>Select All</Btn>
        <Btn size="sm" variant="ghost" onClick={() => onChange([])}>Clear All</Btn>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(PERMISSION_GROUPS).map(([group, items]) => {
          const activeCount = items.filter(p => permsSet.has(p.key)).length;
          const allOn = activeCount === items.length;
          const isOpen = expanded[group];
          return (
            <div key={group} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div onClick={() => setExpanded(e => ({ ...e, [group]: !e[group] }))}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer', background: 'var(--bg-elevated)', userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div onClick={e => { e.stopPropagation(); toggleGroup(group, items); }}
                    style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${allOn ? 'var(--accent)' : 'var(--border)'}`, background: allOn ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    {allOn && <Check size={10} color="#0F1612" strokeWidth={3} />}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{group}</span>
                  <span style={{ fontSize: 11, color: activeCount > 0 ? 'var(--accent)' : 'var(--text-faint)', background: activeCount > 0 ? 'var(--accent-soft)' : 'transparent', padding: '1px 7px', borderRadius: 10, fontWeight: 600 }}>
                    {activeCount}/{items.length}
                  </span>
                </div>
                {isOpen ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
              </div>
              {isOpen && (
                <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                  {items.map(({ key, label }) => {
                    const on = permsSet.has(key);
                    return (
                      <div key={key} onClick={() => togglePerm(key)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', background: on ? 'var(--accent-soft)' : 'transparent', border: `1px solid ${on ? 'rgba(16,185,129,0.25)' : 'var(--border)'}` }}>
                        <div style={{ width: 15, height: 15, borderRadius: 3, border: `2px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {on && <Check size={9} color="#0F1612" strokeWidth={3} />}
                        </div>
                        <span style={{ fontSize: 12, color: on ? 'var(--accent)' : 'var(--text-muted)', fontWeight: on ? 600 : 400 }}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const maskEmail = (email) => {
  if (!email || typeof email !== 'string' || !email.includes('@')) return email || '';
  const [name, domain] = email.split('@');
  if (name.length <= 3) return `${name[0]}***@${domain}`;
  return `${name.substring(0, 2)}***${name.substring(name.length - 2)}@${domain}`;
};

export default function UsersPage() {
  const [users, setUsers]               = useState([]);
  const [roles, setRoles]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState('staff');

  const [showCreate, setShowCreate]     = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCustomPerms, setShowCustomPerms] = useState(false);
  const [form, setForm]                 = useState({ full_name: '', email: '', password: '', role: 'receptionist' });
  const [formPerms, setFormPerms]       = useState([]);

  const [showPermModal, setShowPermModal] = useState(false);
  const [permUser, setPermUser]           = useState(null);
  const [editPerms, setEditPerms]         = useState([]);

  const [showResetModal, setShowResetModal]   = useState(false);
  const [selectedUser, setSelectedUser]       = useState(null);
  const [newPassword, setNewPassword]         = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [staffOtp, setStaffOtp]               = useState('');
  const [sendingStaffOtp, setSendingStaffOtp] = useState(false);
  const [otpSentToStaff, setOtpSentToStaff]   = useState(false);

  useEffect(() => { fetchUsers(); fetchRoles(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try { const res = await api.get('/users'); setUsers(res.data.data); }
    catch { toast.error('Failed to load staff'); }
    finally { setLoading(false); }
  };

  const fetchRoles = async () => {
    try { const res = await api.get('/users/roles'); setRoles(res.data.data); }
    catch { /* non-critical */ }
  };

  const getRoleDefaults = (role) => {
    const r = roles.find(r => r.value === role);
    return r ? r.default_permissions : [];
  };

  const handleRoleChange = (role) => {
    setForm(p => ({ ...p, role }));
    setFormPerms(getRoleDefaults(role));
  };

  const handleCreate = async () => {
    if (!form.full_name || !form.email || !form.password) { toast.error('All fields required'); return; }
    if (form.password.length < 6) { toast.error('Password min 6 chars'); return; }
    try {
      await api.post('/users', { ...form, custom_permissions: showCustomPerms ? formPerms : undefined });
      toast.success(`${form.full_name} added!`);
      setShowCreate(false);
      setForm({ full_name: '', email: '', password: '', role: 'receptionist' });
      setFormPerms([]); setShowCustomPerms(false);
      fetchUsers();
    } catch (error) { toast.error(error.response?.data?.message || 'Failed to create'); }
  };

  const handleToggle = async (user) => {
    try {
      await api.put(`/users/${user.id}`, { full_name: user.full_name, role: user.role, is_active: !user.is_active });
      toast.success(`${user.full_name} ${user.is_active ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch (error) { toast.error(error.response?.data?.message || 'Failed'); }
  };

  const openPermModal = (user) => {
    let perms = user.permissions;
    if (typeof perms === 'string') { try { perms = JSON.parse(perms); } catch { perms = []; } }
    if (!Array.isArray(perms)) perms = [];
    setPermUser(user); setEditPerms(perms); setShowPermModal(true);
  };

  const handleSavePerms = async () => {
    try {
      await api.put(`/users/${permUser.id}/permissions`, { permissions: editPerms });
      toast.success('Permissions updated');
      setShowPermModal(false); fetchUsers();
    } catch (error) { toast.error(error.response?.data?.message || 'Failed'); }
  };

  const handleOpenResetStaffModal = async (u) => {
    setSelectedUser(u);
    setNewPassword('');
    setStaffOtp('');
    setOtpSentToStaff(true);
    setShowResetModal(true);

    // Auto-send OTP code to staff user email
    setSendingStaffOtp(true);
    try {
      const res = await api.post(`/users/${u.id}/request-otp`);
      const masked = maskEmail(u.email);
      const codeMsg = res.data?.data?.dev_otp ? ` | Code: ${res.data.data.dev_otp}` : '';
      toast.success(`Security OTP sent to ${masked}!${codeMsg}`, { duration: 12000 });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send OTP code to staff email');
    } finally {
      setSendingStaffOtp(false);
    }
  };

  const handleSendStaffOtp = async () => {
    if (!selectedUser) return;
    setSendingStaffOtp(true);
    try {
      const res = await api.post(`/users/${selectedUser.id}/request-otp`);
      const masked = maskEmail(selectedUser.email);
      setOtpSentToStaff(true);
      const codeMsg = res.data?.data?.dev_otp ? ` | Code: ${res.data.data.dev_otp}` : '';
      toast.success(`Security OTP sent to ${masked}!${codeMsg}`, { duration: 12000 });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send OTP code');
    } finally {
      setSendingStaffOtp(false);
    }
  };

  const handleResetPassword = async () => {
    if (!staffOtp || staffOtp.length < 6) { toast.error('Please enter the 6-digit security OTP verification code'); return; }
    if (!newPassword || newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    try {
      await api.put(`/users/${selectedUser.id}/password`, { password: newPassword, otp: staffOtp });
      toast.success(`Password reset for ${selectedUser.full_name}! New password: ${newPassword}`, { duration: 8000 });
      setShowResetModal(false); setNewPassword(''); setStaffOtp(''); setOtpSentToStaff(false);
    } catch (error) { toast.error(error.response?.data?.message || 'Failed to reset password'); }
  };

  const roleCounts = users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {});
  const totalPerms = Object.values(PERMISSION_GROUPS).flat().length;
  const getUserPerms = (u) => { let p = u.permissions; if (typeof p === 'string') { try { p = JSON.parse(p); } catch { p = []; } } return Array.isArray(p) ? p : []; };

  return (
    <div style={{ padding: 24, height: '100vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Staff & Permissions</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{users.length} staff · Permission-based access control</p>
        </div>
        <Btn onClick={() => { setShowCreate(true); setFormPerms(getRoleDefaults('receptionist')); }}>
          <Plus size={15} /> Add Staff
        </Btn>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-elevated)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {[{ id: 'staff', label: 'Staff List' }, { id: 'roles', label: 'Role Overview' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: activeTab === t.id ? 'var(--accent)' : 'transparent',
            color: activeTab === t.id ? '#0F1612' : 'var(--text-muted)',
          }}>{t.label}</button>
        ))}
      </div>

      {activeTab === 'staff' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Staff', value: users.length,                        color: 'var(--accent)' },
              { label: 'Active',      value: users.filter(u => u.is_active).length, color: 'var(--accent)' },
              { label: 'Inactive',    value: users.filter(u => !u.is_active).length, color: 'var(--danger)' },
            ].map(({ label, value, color }) => (
              <Card key={label} style={{ padding: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
                <div className="mono" style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
              </Card>
            ))}
          </div>

          <Card>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>
                <Loader size={24} style={{ animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                      {['Name', 'Email', 'Role', 'Permissions', 'Last Login', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>No staff yet.</td></tr>
                    ) : users.map(u => {
                      const perms = getUserPerms(u);
                      return (
                        <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{u.full_name}</td>
                          <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>{u.email}</td>
                          <td style={{ padding: '12px 16px' }}><RoleBadge role={u.role} /></td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 60, height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.round((perms.length / totalPerms) * 100)}%`, background: 'var(--accent)', borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{perms.length}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {u.last_login ? new Date(u.last_login).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 600, background: u.is_active ? 'var(--accent)20' : 'var(--danger)20', color: u.is_active ? 'var(--accent)' : 'var(--danger)' }}>
                              {u.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <button onClick={() => openPermModal(u)} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'var(--accent)20', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Sliders size={11} />Permissions
                              </button>
                              <button onClick={() => handleOpenResetStaffModal(u)} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'var(--info)20', color: 'var(--info)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Lock size={11} />Password
                              </button>
                              <button onClick={() => handleToggle(u)} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', background: u.is_active ? 'var(--danger)20' : 'var(--accent)20', color: u.is_active ? 'var(--danger)' : 'var(--accent)' }}>
                                {u.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {activeTab === 'roles' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {Object.entries(ROLE_META).map(([role, meta]) => {
            const count = roleCounts[role] || 0;
            const defaultPerms = getRoleDefaults(role);
            return (
              <Card key={role} style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${meta.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{meta.icon}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{meta.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{count} member{count !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: `${meta.color}22`, color: meta.color }}>{defaultPerms.length} perms</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {defaultPerms.slice(0, 8).map(p => (
                    <span key={p} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                      {p.replace('can_', '').replace(/_/g, ' ')}
                    </span>
                  ))}
                  {defaultPerms.length > 8 && (
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: `${meta.color}22`, color: meta.color }}>+{defaultPerms.length - 8} more</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: 20, overflowY: 'auto' }}>
          <Card style={{ padding: 28, width: '100%', maxWidth: 560, marginTop: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Add Staff Member</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Input label="Full Name *" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="John Doe" />
              <Input label="Email *" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="john@facility.com" />
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Role *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                  {Object.entries(ROLE_META).map(([role, meta]) => (
                    <div key={role} onClick={() => handleRoleChange(role)}
                      style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: `2px solid ${form.role === role ? meta.color : 'var(--border)'}`, background: form.role === role ? `${meta.color}15` : 'var(--bg-elevated)' }}>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{meta.icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: form.role === role ? meta.color : 'var(--text-primary)' }}>{meta.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ position: 'relative' }}>
                <Input label="Password *" type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 characters" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, bottom: 9, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div onClick={() => { setShowCustomPerms(!showCustomPerms); if (!showCustomPerms) setFormPerms(getRoleDefaults(form.role)); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                <Shield size={15} color="var(--accent)" />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>Customise Permissions</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{showCustomPerms ? 'Hide' : `Default: ${getRoleDefaults(form.role).length} permissions`}</span>
                {showCustomPerms ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
              </div>
              {showCustomPerms && (
                <div style={{ maxHeight: 350, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
                  <PermissionEditor permissions={formPerms} onChange={setFormPerms} roleDefaults={getRoleDefaults(form.role)} />
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <Btn variant="ghost" onClick={() => setShowCreate(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
              <Btn onClick={handleCreate} style={{ flex: 1, justifyContent: 'center' }}>Add Staff Member</Btn>
            </div>
          </Card>
        </div>
      )}

      {/* Permission Editor Modal */}
      {showPermModal && permUser && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: 20, overflowY: 'auto' }}>
          <Card style={{ padding: 28, width: '100%', maxWidth: 680, marginTop: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Edit Permissions</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{permUser.full_name}</span>
                  <RoleBadge role={permUser.role} />
                </div>
              </div>
              <button onClick={() => setShowPermModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ maxHeight: '55vh', overflowY: 'auto', marginBottom: 20 }}>
              <PermissionEditor permissions={editPerms} onChange={setEditPerms} roleDefaults={getRoleDefaults(permUser.role)} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="ghost" onClick={() => setShowPermModal(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
              <Btn onClick={handleSavePerms} style={{ flex: 1, justifyContent: 'center' }}><Check size={14} /> Save Permissions</Btn>
            </div>
          </Card>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && selectedUser && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <Card style={{ padding: 28, width: '100%', maxWidth: 400 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Reset Staff Password</h3>
              <button onClick={() => { setShowResetModal(false); setNewPassword(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-elevated)', borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedUser.full_name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedUser.email}</div>
            </div>

            {/* OTP Section */}
            <div style={{ marginBottom: 16, padding: 14, background: 'var(--bg-base)', border: '1px solid var(--accent)', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  🔐 6-Digit Verification OTP *
                </span>
                <button
                  type="button"
                  onClick={handleSendStaffOtp}
                  disabled={sendingStaffOtp}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 6,
                    background: 'var(--accent)', color: '#0F1612', border: 'none', cursor: sendingStaffOtp ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4
                  }}
                >
                  {sendingStaffOtp ? <Loader size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : '⚡ Resend OTP to Email'}
                </button>
              </div>

              <input
                type="text"
                maxLength={6}
                value={staffOtp}
                onChange={e => setStaffOtp(e.target.value)}
                placeholder="Enter 6-digit OTP code (e.g. 582910)"
                style={{
                  width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)',
                  border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--accent)',
                  fontSize: 18, fontWeight: 700, letterSpacing: 4, outline: 'none', fontFamily: 'monospace'
                }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>Code dispatched to: <strong>{maskEmail(selectedUser.email)}</strong></span>
                <span>(Valid 15 mins)</span>
              </div>
            </div>

            <div style={{ position: 'relative', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>New Password *</label>
                <button type="button" onClick={() => {
                  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
                  let pass = '';
                  for (let i = 0; i < 10; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
                  setNewPassword(pass);
                  setShowNewPassword(true);
                }} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  ⚡ Generate Random
                </button>
              </div>
              <Input type={showNewPassword ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
              <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} style={{ position: 'absolute', right: 12, bottom: 9, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="ghost" onClick={() => { setShowResetModal(false); setNewPassword(''); }} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
              <Btn onClick={handleResetPassword} style={{ flex: 1, justifyContent: 'center' }}>Reset Password</Btn>
            </div>
          </Card>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
