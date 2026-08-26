import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Building2, Users, TrendingUp, X, CheckCircle, XCircle, Loader, Globe, Hospital, Pill, Calendar, RefreshCw, ShieldCheck, Key, Lock, Eye, EyeOff } from 'lucide-react';

const Card = ({ children, style = {} }) => (
  <div style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)', ...style }}>
    {children}
  </div>
);

const Input = ({ label, ...props }) => (
  <div>
    {label && <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>{label}</label>}
    <input {...props} style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'DM Sans, sans-serif' }} />
  </div>
);

const Btn = ({ children, variant = 'primary', ...props }) => (
  <button {...props} style={{
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px',
    background: variant === 'primary' ? 'var(--accent)' : variant === 'danger' ? 'var(--danger)' : 'var(--bg-elevated)',
    border: variant === 'ghost' ? '1px solid var(--border)' : 'none',
    borderRadius: 8, color: variant === 'primary' ? '#0F1612' : 'var(--text-primary)',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', ...props.style
  }}>{children}</button>
);

const maskEmail = (email) => {
  if (!email || typeof email !== 'string' || !email.includes('@')) return email || '';
  const [name, domain] = email.split('@');
  if (name.length <= 3) return `${name[0]}***@${domain}`;
  return `${name.substring(0, 2)}***${name.substring(name.length - 2)}@${domain}`;
};

export default function SuperAdminPage() {
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Subscription modal state
  const [subModalFacility, setSubModalFacility] = useState(null);
  const [subForm, setSubForm] = useState({ plan: 'premium', status: 'active', add_days: '30', expires_at: '' });
  const [updatingSub, setUpdatingSub] = useState(false);

  // Reset Admin Password modal state
  const [resetAdminFacility, setResetAdminFacility] = useState(null);
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminOtp, setAdminOtp] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [resettingAdmin, setResettingAdmin] = useState(false);
  const [sendingAdminOtp, setSendingAdminOtp] = useState(false);
  const [otpSentToAdmin, setOtpSentToAdmin] = useState(false);

  const initialForm = {
    name: '', email: '', phone: '', address: '', city: '', license_number: '',
    admin_name: '', admin_email: '', admin_password: '', facility_type: 'hospital',
    plan: 'premium', active_period: '1_year'
  };

  const [form, setForm] = useState(initialForm);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const pharRes = await api.get('/pharmacy/all');
      if (Array.isArray(pharRes.data?.data)) {
        setPharmacies(pharRes.data.data);
      }
    } catch (error) {
      toast.error('Failed to load data');
    } finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.admin_email || !form.admin_password) {
      toast.error('Fill in all required fields'); return;
    }
    setCreating(true);
    try {
      const res = await api.post('/pharmacy/create', form);
      toast.success(`Facility "${form.name}" created! Onboarding email with login credentials and setup guides sent to ${maskEmail(form.admin_email)}.`, { duration: 10000 });
      setShowCreate(false);
      
      if (res.data?.data?.pharmacy) {
        const ph = res.data.data.pharmacy;
        const newPh = {
          ...ph,
          plan: res.data.data.subscription?.plan || form.plan || 'premium',
          subscription_status: 'active',
          expires_at: res.data.data.subscription?.expires_at,
          admin_email: res.data.data.admin?.email || form.admin_email,
          admin_name: form.admin_name || `${form.name} Admin`,
          admin_user_id: res.data.data.admin?.id,
          user_count: 1,
          is_active: true,
          facility_type: form.facility_type || 'hospital',
        };
        setPharmacies(prev => [newPh, ...prev.filter(p => p.id !== newPh.id)]);
      }

      setForm(initialForm);
      await fetchAll();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create facility');
    } finally { setCreating(false); }
  };

  const handleDelete = async (pharmacy) => {
    try {
      await api.delete(`/pharmacy/${pharmacy.id}`, { data: { confirm: true } });
      toast.success(`${pharmacy.name} deleted`);
      fetchAll();
    } catch { toast.error("Failed to delete facility"); }
  };

  const handleToggle = async (pharmacy) => {
    try {
      await api.put(`/pharmacy/${pharmacy.id}/toggle`);
      toast.success(`${pharmacy.name} ${pharmacy.is_active ? 'deactivated' : 'activated'}`);
      fetchAll();
    } catch { toast.error('Failed to update facility'); }
  };

  const handleOpenSubModal = (pharmacy) => {
    setSubModalFacility(pharmacy);
    const existingExpires = pharmacy.expires_at ? new Date(pharmacy.expires_at).toISOString().split('T')[0] : '';
    setSubForm({
      plan: pharmacy.plan || 'premium',
      status: (pharmacy.subscription_status === 'expired' || (pharmacy.expires_at && new Date(pharmacy.expires_at) < new Date())) ? 'active' : (pharmacy.subscription_status || 'active'),
      add_days: '30',
      expires_at: existingExpires,
      current_expires_at: pharmacy.expires_at
    });
  };

  const handleSaveSubscription = async () => {
    if (!subModalFacility) return;
    setUpdatingSub(true);
    try {
      const payload = {
        plan: subForm.plan,
        status: subForm.status,
      };
      if (subForm.add_days) {
        payload.add_days = subForm.add_days;
        payload.current_expires_at = subModalFacility.expires_at;
      } else if (subForm.expires_at) {
        payload.expires_at = new Date(subForm.expires_at).toISOString();
      }

      await api.put(`/pharmacy/${subModalFacility.id}/subscription`, payload);
      toast.success(`Subscription updated for ${subModalFacility.name}`);
      setSubModalFacility(null);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update subscription');
    } finally {
      setUpdatingSub(false);
    }
  };

  const handleOpenResetAdminModal = (pharmacy) => {
    setResetAdminFacility(pharmacy);
    setAdminNewPassword('');
    setAdminOtp('');
    setShowAdminPassword(true);
    setOtpSentToAdmin(false);

    // Auto send OTP to facility admin email on modal open
    setSendingAdminOtp(true);
    api.post(`/pharmacy/${pharmacy.id}/request-admin-otp`)
      .then(res => {
        const rawEmail = res.data?.data?.email || pharmacy.admin_email || pharmacy.email;
        const masked = maskEmail(rawEmail);
        setOtpSentToAdmin(true);
        const codeMsg = res.data?.data?.dev_otp ? ` | Dev Code: ${res.data.data.dev_otp}` : '';
        toast.success(`Security OTP sent to facility admin (${masked})!${codeMsg}`, { duration: 12000 });
      })
      .catch(err => {
        toast.error(err.response?.data?.message || 'Failed to send OTP to facility admin');
      })
      .finally(() => {
        setSendingAdminOtp(false);
      });
  };

  const handleSendAdminOtp = async () => {
    if (!resetAdminFacility) return;
    setSendingAdminOtp(true);
    try {
      const res = await api.post(`/pharmacy/${resetAdminFacility.id}/request-admin-otp`);
      const rawEmail = res.data?.data?.email || resetAdminFacility.admin_email || resetAdminFacility.email;
      const masked = maskEmail(rawEmail);
      setOtpSentToAdmin(true);
      const codeMsg = res.data?.data?.dev_otp ? ` | Code: ${res.data.data.dev_otp}` : '';
      toast.success(`Security OTP sent to facility admin email (${masked})!${codeMsg}`, { duration: 12000 });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP code');
    } finally {
      setSendingAdminOtp(false);
    }
  };

  const generateRandomAdminPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAdminNewPassword(pass);
    setShowAdminPassword(true);
  };

  const handleResetAdminPassword = async () => {
    if (!adminNewPassword || adminNewPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (!adminOtp || adminOtp.trim().length < 6) {
      toast.error('6-digit security OTP code is strictly required to reset password');
      return;
    }
    setResettingAdmin(true);
    try {
      const res = await api.put(`/pharmacy/${resetAdminFacility.id}/reset-admin-password`, {
        password: adminNewPassword,
        otp: adminOtp.trim(),
        user_id: resetAdminFacility.admin_user_id
      });
      const adminEmail = resetAdminFacility.admin_email || resetAdminFacility.email;
      toast.success(res.data?.message || `Admin password reset for ${resetAdminFacility.name}! Confirmation sent to ${adminEmail}`, { duration: 10000 });
      setResetAdminFacility(null);
      setAdminNewPassword('');
      setAdminOtp('');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset admin password');
    } finally {
      setResettingAdmin(false);
    }
  };

  const planColors = { trial: 'var(--warning)', basic: 'var(--info)', premium: 'var(--accent)', enterprise: '#a855f7' };
  const typeColors = { hospital: 'var(--info)', pharmacy: 'var(--accent)' };

  const isExpiredSub = (p) => {
    if (!p) return false;
    if (p.subscription_status === 'expired') return true;
    if (p.expires_at && new Date(p.expires_at) < new Date()) return true;
    return false;
  };

  return (
    <div style={{ padding: 24, height: '100vh', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Globe size={24} color="#a855f7" /> Platform Management
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Manage all facilities and subscriptions on the platform</p>
        </div>
        <Btn onClick={() => setShowCreate(true)}><Plus size={15} /> Add Facility</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Facilities', value: pharmacies.length, icon: Building2, color: '#a855f7' },
          { label: 'Active Facilities', value: pharmacies.filter(p => p.is_active && !isExpiredSub(p)).length, icon: CheckCircle, color: 'var(--accent)' },
          { label: 'Expired Subscriptions', value: pharmacies.filter(p => isExpiredSub(p)).length, icon: XCircle, color: 'var(--danger)' },
          { label: 'Hospitals', value: pharmacies.filter(p => (p.facility_type || 'hospital') === 'hospital').length, icon: Building2, color: 'var(--info)' },
          { label: 'Pharmacies', value: pharmacies.filter(p => p.facility_type === 'pharmacy').length, icon: Users, color: 'var(--warning)' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
                <div className="mono" style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} color={color} />
              </div>
            </div>
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
                  {['Facility', 'Facility Admin Login', 'Type', 'Location', 'Plan', 'Expiry Date', 'Subscription', 'Account Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pharmacies.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>No facilities yet. Create your first one.</td></tr>
                ) : pharmacies.map(p => {
                  const expired = isExpiredSub(p);
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.email}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <ShieldCheck size={13} color="var(--accent)" /> {p.admin_name || 'Admin'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{p.admin_email || p.email}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 700, textTransform: 'capitalize', background: `${typeColors[p.facility_type || 'hospital']}20`, color: typeColors[p.facility_type || 'hospital'] }}>
                          {p.facility_type === 'pharmacy' ? '💊 Pharmacy' : '🏥 Hospital'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>{p.city || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 700, textTransform: 'capitalize', background: `${planColors[p.plan] || 'var(--text-muted)'}20`, color: planColors[p.plan] || 'var(--text-muted)' }}>
                          {p.plan || 'trial'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: expired ? 'var(--danger)' : 'var(--text-muted)', fontWeight: expired ? 700 : 400 }}>
                        {p.expires_at ? (new Date(p.expires_at).getFullYear() > 2090 ? '♾️ Unlimited' : new Date(p.expires_at).toLocaleDateString()) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 600,
                          background: expired ? "var(--danger)20" : "var(--accent)20",
                          color: expired ? "var(--danger)" : "var(--accent)"
                        }}>
                          {expired ? "🚨 Expired" : "✓ Active"}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 600,
                          background: p.deleted_at ? "var(--danger)20" : p.is_active ? "var(--accent)20" : "var(--warning)20",
                          color: p.deleted_at ? "var(--danger)" : p.is_active ? "var(--accent)" : "var(--warning)"
                        }}>
                          {p.deleted_at ? "🗑 Deleted" : p.is_active ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <button onClick={() => handleOpenResetAdminModal(p)} style={{
                          padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)',
                          background: 'var(--bg-elevated)', color: 'var(--accent)',
                          display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 4
                        }}>
                          <Key size={12} /> Reset Admin Pass
                        </button>
                        <button onClick={() => handleOpenSubModal(p)} style={{
                          padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)',
                          background: expired ? 'var(--danger)15' : 'var(--bg-elevated)',
                          color: expired ? 'var(--danger)' : 'var(--text-primary)',
                          display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 4
                        }}>
                          <RefreshCw size={12} /> {expired ? 'Renew Sub' : 'Subscription'}
                        </button>
                        <button onClick={() => handleToggle(p)} style={{
                          padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                          background: p.is_active ? 'var(--danger)20' : 'var(--accent)20',
                          color: p.is_active ? 'var(--danger)' : 'var(--accent)', marginRight: 4
                        }}>
                          {p.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => {
                          if (window.confirm(`Are you sure you want to DELETE ${p.name}? This cannot be undone.`)) {
                            handleDelete(p);
                          }
                        }} style={{
                          padding: "6px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                          background: "var(--danger)20", color: "var(--danger)"
                        }}>
                          🗑
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Subscription Management Modal */}
      {subModalFacility && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <Card style={{ padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={20} color="var(--accent)" /> Manage Subscription
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subModalFacility.name}</p>
              </div>
              <button onClick={() => setSubModalFacility(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>

            {isExpiredSub(subModalFacility) && (
              <div style={{ padding: '12px 14px', background: 'var(--danger)15', border: '1px solid var(--danger)30', borderRadius: 8, fontSize: 12, color: 'var(--danger)', marginBottom: 16 }}>
                🚨 <strong>Subscription is Expired.</strong> Staff cannot log in until renewed. Select a duration below to activate.
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Quick Renewal Duration</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 6 }}>
                {[
                  { days: '30', label: '1 Month' },
                  { days: '90', label: '3 Months' },
                  { days: '180', label: '6 Months' },
                  { days: '365', label: '1 Year' },
                  { days: '36500', label: 'Unlimited' },
                ].map(opt => (
                  <button key={opt.days} onClick={() => setSubForm(p => ({ ...p, add_days: opt.days, expires_at: '' }))}
                    style={{
                      padding: '8px 4px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', textAlign: 'center',
                      border: subForm.add_days === opt.days ? '2px solid var(--accent)' : '1px solid var(--border)',
                      background: subForm.add_days === opt.days ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                      color: subForm.add_days === opt.days ? 'var(--accent)' : 'var(--text-primary)'
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Plan</label>
              <select value={subForm.plan} onChange={e => setSubForm(p => ({ ...p, plan: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}>
                <option value="trial">Trial (Free)</option>
                <option value="basic">Basic</option>
                <option value="premium">Premium</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Status</label>
              <select value={subForm.status} onChange={e => setSubForm(p => ({ ...p, status: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="ghost" onClick={() => setSubModalFacility(null)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
              <Btn onClick={handleSaveSubscription} style={{ flex: 1, justifyContent: 'center' }} disabled={updatingSub}>
                {updatingSub ? <><Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Updating...</> : <><CheckCircle size={14} /> Save & Renew</>}
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <Card style={{ padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>Register New Facility</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>

            {/* Facility Type Selector */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Facility Type</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { value: 'hospital', label: '🏥 Full Hospital HMS', desc: 'Full clinical care, OPD/triage, doctor queue, lab, wards & full hospital pharmacy (dispensary + POS)' },
                  { value: 'pharmacy', label: '💊 Standalone Pharmacy', desc: 'Pure retail POS, medicine catalog, stock batches, purchases & sales invoicing' },
                ].map(opt => (
                  <button key={opt.value} onClick={() => setForm(p => ({ ...p, facility_type: opt.value }))}
                    style={{
                      padding: '14px 16px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                      border: form.facility_type === opt.value ? '2px solid var(--accent)' : '1px solid var(--border)',
                      background: form.facility_type === opt.value ? 'var(--accent-soft)' : 'var(--bg-elevated)',
                    }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: form.facility_type === opt.value ? 'var(--accent)' : 'var(--text-primary)', marginBottom: 4 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Facility Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Input label="Facility Name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="ABC Hospital" />
                <Input label="Business Email *" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="info@abchospital.com" />
                <Input label="Phone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+254 700 000 000" />
                <Input label="City" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="Nairobi" />
                <div style={{ gridColumn: '1 / -1' }}><Input label="Address" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Street address" /></div>
                <div style={{ gridColumn: '1 / -1' }}><Input label="License Number" value={form.license_number} onChange={e => setForm(p => ({ ...p, license_number: e.target.value }))} placeholder="PPB/2026/001" /></div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Subscription & Active Period</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Subscription Plan</label>
                  <select value={form.plan} onChange={e => setForm(p => ({ ...p, plan: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}>
                    <option value="premium">Premium</option>
                    <option value="trial">Trial (Free)</option>
                    <option value="basic">Basic</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Active Duration</label>
                  <select value={form.active_period} onChange={e => setForm(p => ({ ...p, active_period: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}>
                    <option value="1_year">1 Year (Premium)</option>
                    <option value="1_month">1 Month</option>
                    <option value="3_months">3 Months</option>
                    <option value="6_months">6 Months</option>
                    <option value="unlimited">Unlimited (Lifetime)</option>
                    <option value="trial">30 Days Trial</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>Admin Account</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1 / -1' }}><Input label="Admin Full Name" value={form.admin_name} onChange={e => setForm(p => ({ ...p, admin_name: e.target.value }))} placeholder="John Doe" /></div>
                <Input label="Admin Email *" value={form.admin_email} onChange={e => setForm(p => ({ ...p, admin_email: e.target.value }))} placeholder="admin@facility.com" />
                <Input label="Admin Password *" type="password" value={form.admin_password} onChange={e => setForm(p => ({ ...p, admin_password: e.target.value }))} placeholder="Min 8 characters" />
              </div>
              <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                {form.facility_type === 'pharmacy'
                  ? '💊 Admin will have Pharmacy Admin role — can manage staff and access pharmacy modules only'
                  : '🏥 Admin will have full Hospital Admin role — access to all modules'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="ghost" onClick={() => setShowCreate(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
              <Btn onClick={handleCreate} style={{ flex: 1, justifyContent: 'center' }} disabled={creating}>
                {creating ? <><Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Creating...</> : <><CheckCircle size={14} /> Create Facility</>}
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {/* Reset Admin Password Modal */}
      {resetAdminFacility && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <Card style={{ padding: 28, width: '100%', maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Key size={20} color="var(--accent)" /> Reset Facility Admin Password
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{resetAdminFacility.name}</p>
              </div>
              <button onClick={() => setResetAdminFacility(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>

            <div style={{ padding: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Facility Admin Login Account</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{resetAdminFacility.admin_name || 'Facility Admin'}</div>
              <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginTop: 2 }}>{resetAdminFacility.admin_email || resetAdminFacility.email}</div>
            </div>

            <div style={{ marginBottom: 16, position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 700 }}>New Admin Password *</label>
                <button type="button" onClick={generateRandomAdminPassword} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  ⚡ Generate Secure Password
                </button>
              </div>
              <input
                type={showAdminPassword ? 'text' : 'password'}
                value={adminNewPassword}
                onChange={e => setAdminNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 chars)"
                style={{ width: '100%', padding: '10px 36px 10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'DM Sans, sans-serif' }}
              />
              <button type="button" onClick={() => setShowAdminPassword(!showAdminPassword)} style={{ position: 'absolute', right: 10, bottom: 9, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showAdminPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Mandatory OTP Section */}
            <div style={{ marginBottom: 20, padding: 14, background: 'var(--bg-base)', border: '1px solid var(--accent)', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  🔐 6-Digit Verification OTP *
                </span>
                <button
                  type="button"
                  onClick={handleSendAdminOtp}
                  disabled={sendingAdminOtp}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 6,
                    background: 'var(--accent)', color: '#0F1612', border: 'none', cursor: sendingAdminOtp ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4
                  }}
                >
                  {sendingAdminOtp ? <Loader size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : '✉️ Resend OTP to Email'}
                </button>
              </div>
              
              <input
                type="text"
                maxLength={6}
                value={adminOtp}
                onChange={e => setAdminOtp(e.target.value)}
                placeholder="Enter 6-digit OTP code"
                style={{
                  width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)',
                  border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--accent)',
                  fontSize: 18, fontWeight: 700, letterSpacing: 4, outline: 'none', fontFamily: 'monospace'
                }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>Dispatched to: <strong>{maskEmail(resetAdminFacility.admin_email || resetAdminFacility.email)}</strong></span>
                <span>(Valid 15 mins)</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="ghost" onClick={() => setResetAdminFacility(null)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</Btn>
              <Btn onClick={handleResetAdminPassword} disabled={resettingAdmin} style={{ flex: 1, justifyContent: 'center' }}>
                {resettingAdmin ? <Loader size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> : '🔑 Reset & Email Password'}
              </Btn>
            </div>
          </Card>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
