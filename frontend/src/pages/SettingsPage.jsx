import { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { getMe } from '../store/slices/authSlice';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Loader, Save, Building2, Receipt, CreditCard, Bell, ShieldCheck, KeyRound, Info } from 'lucide-react';

// ⚠️ CRITICAL: All components defined OUTSIDE the page component
// so they don't recreate on every keystroke (fixes focus loss bug)

const Section = ({ title, icon: Icon, children }) => (
  <div style={{ background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)', marginBottom: 20 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
      <Icon size={18} color="var(--accent)" />
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
    </div>
    <div style={{ padding: 24 }}>{children}</div>
  </div>
);

const inputStyle = {
  width: '100%', padding: '10px 14px',
  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
  borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, outline: 'none'
};

const Grid = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>{children}</div>
);

const FieldWrap = ({ label, hint, children }) => (
  <div style={{ marginBottom: 18 }}>
    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{label}</label>
    {children}
    {hint && <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>{hint}</div>}
  </div>
);

const SaveBtn = ({ onClick, loading: l }) => (
  <button onClick={onClick} disabled={l} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#0F1612', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
    {l ? <Loader size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Save size={15} />}
    {l ? 'Saving...' : 'Save Changes'}
  </button>
);

export default function SettingsPage() {
  const { user } = useSelector(s => s.auth);
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);

  const [info, setInfo] = useState({ name: '', phone: '', address: '', city: '', country: 'Kenya', license_number: '' });
  const [settings, setSettings] = useState({
    receipt_header: '', receipt_footer: '',
    mpesa_till_number: '', mpesa_paybill: '', mpesa_account_name: '',
    bank_name: '', bank_account: '', bank_branch: '',
    currency: 'KES', tax_rate: 0, tax_name: 'VAT',
    low_stock_alert_days: 7, expiry_alert_days: 30
  });
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm_password: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/pharmacy/me');
      const p = res.data.data;
      setLogoPreview(p.logo_url || '');
      setInfo({ name: p.name || '', phone: p.phone || '', address: p.address || '', city: p.city || '', country: p.country || 'Kenya', license_number: p.license_number || '' });
      setSettings({
        receipt_header: p.receipt_header || '', receipt_footer: p.receipt_footer || '',
        mpesa_till_number: p.mpesa_till_number || '', mpesa_paybill: p.mpesa_paybill || '',
        mpesa_account_name: p.mpesa_account_name || '', bank_name: p.bank_name || '',
        bank_account: p.bank_account || '', bank_branch: p.bank_branch || '',
        currency: p.currency || 'KES', tax_rate: p.tax_rate || 0, tax_name: p.tax_name || 'VAT',
        low_stock_alert_days: p.low_stock_alert_days || 7, expiry_alert_days: p.expiry_alert_days || 30
      });
    } catch { toast.error('Failed to load settings'); }
    finally { setLoading(false); }
  };

  const saveInfo = async () => {
    setSaving(true);
    try {
      await api.put('/pharmacy/me', info);
      toast.success('Pharmacy info updated');
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/pharmacy/me/settings', settings);
      toast.success('Settings saved');
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (!pw.current_password || !pw.new_password) return toast.error('Fill in all fields');
    if (pw.new_password !== pw.confirm_password) return toast.error('Passwords do not match');
    if (pw.new_password.length < 6) return toast.error('Password must be at least 6 characters');
    setPwSaving(true);
    try {
      await api.put('/auth/change-password', { current_password: pw.current_password, new_password: pw.new_password });
      toast.success('Password changed');
      setPw({ current_password: '', new_password: '', confirm_password: '' });
    } catch (e) { toast.error(e.response?.data?.message || 'Failed to change password'); }
    finally { setPwSaving(false); }
  };

  const uploadLogo = async () => {
    if (!logo) return;
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', logo);
      const res = await api.post('/upload/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setLogoPreview(res.data.data.logo_url);
      setLogo(null);
      await dispatch(getMe());
      toast.success('Logo uploaded!');
    } catch (e) { toast.error('Logo upload failed'); }
    finally { setLogoUploading(false); }
  };

  const si = (k) => (e) => setInfo(p => ({ ...p, [k]: e.target.value }));
  const ss = (k) => (e) => setSettings(p => ({ ...p, [k]: e.target.value }));
  const sp = (k) => (e) => setPw(p => ({ ...p, [k]: e.target.value }));

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Loader size={28} color="var(--accent)" style={{ animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ padding: 24, overflowY: 'auto', maxWidth: 860, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Settings</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>Manage your pharmacy configuration</p>
      </div>

      {/* Pharmacy Info */}
      <Section title="Pharmacy Information" icon={Building2}>
        <Grid>
          <FieldWrap label="Pharmacy Name"><input style={inputStyle} value={info.name} onChange={si('name')} /></FieldWrap>
          <FieldWrap label="Phone"><input style={inputStyle} value={info.phone} onChange={si('phone')} /></FieldWrap>
          <FieldWrap label="City"><input style={inputStyle} value={info.city} onChange={si('city')} /></FieldWrap>
          <FieldWrap label="Country"><input style={inputStyle} value={info.country} onChange={si('country')} /></FieldWrap>
          <div style={{ gridColumn: '1/-1' }}><FieldWrap label="Address"><input style={inputStyle} value={info.address} onChange={si('address')} /></FieldWrap></div>
          <FieldWrap label="License Number"><input style={inputStyle} value={info.license_number} onChange={si('license_number')} /></FieldWrap>
          <div style={{ gridColumn: '1/-1' }}>
            <FieldWrap label="Facility Logo">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                {logoPreview
                  ? <img src={logoPreview} alt="logo" style={{ width: 80, height: 80, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-elevated)' }} />
                  : <div style={{ width: 80, height: 80, borderRadius: 10, border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: 11 }}>No Logo</div>
                }
                <div>
                  <input type="file" accept="image/*" onChange={e => { if(e.target.files[0]){ setLogo(e.target.files[0]); setLogoPreview(URL.createObjectURL(e.target.files[0])); }}} style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }} />
                  <button onClick={uploadLogo} disabled={!logo || logoUploading} style={{ padding: '8px 16px', background: logo ? 'var(--accent)' : 'var(--border)', border: 'none', borderRadius: 8, color: '#0F1612', fontWeight: 700, cursor: logo ? 'pointer' : 'not-allowed', fontSize: 13 }}>
                    {logoUploading ? 'Uploading...' : 'Upload Logo'}
                  </button>
                </div>
              </div>
            </FieldWrap>
          </div>
          <FieldWrap label="Currency" hint="e.g. KES, USD, UGX"><input style={inputStyle} value={settings.currency} onChange={ss('currency')} /></FieldWrap>
        </Grid>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><SaveBtn onClick={saveInfo} loading={saving} /></div>
      </Section>

      {/* Receipt Settings */}
      <Section title="Receipt Settings" icon={Receipt}>
        <FieldWrap label="Receipt Header">
          <textarea value={settings.receipt_header} onChange={ss('receipt_header')} rows={3} placeholder="Pharmacy name, address, phone..." style={{ ...inputStyle, resize: 'vertical', fontFamily: 'DM Sans, sans-serif' }} />
        </FieldWrap>
        <FieldWrap label="Receipt Footer">
          <textarea value={settings.receipt_footer} onChange={ss('receipt_footer')} rows={2} placeholder="Thank you message..." style={{ ...inputStyle, resize: 'vertical', fontFamily: 'DM Sans, sans-serif' }} />
        </FieldWrap>
        <Grid>
          <FieldWrap label="Tax Name"><input style={inputStyle} value={settings.tax_name} onChange={ss('tax_name')} placeholder="VAT" /></FieldWrap>
          <FieldWrap label="Tax Rate (%)"><input style={inputStyle} type="number" value={settings.tax_rate} onChange={ss('tax_rate')} placeholder="0" /></FieldWrap>
        </Grid>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><SaveBtn onClick={saveSettings} loading={saving} /></div>
      </Section>

      {/* Payment Settings */}
      <Section title="Payment Settings" icon={CreditCard}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>M-Pesa</div>
        <Grid>
          <FieldWrap label="Till Number"><input style={inputStyle} value={settings.mpesa_till_number} onChange={ss('mpesa_till_number')} placeholder="e.g. 123456" /></FieldWrap>
          <FieldWrap label="Paybill Number"><input style={inputStyle} value={settings.mpesa_paybill} onChange={ss('mpesa_paybill')} placeholder="e.g. 654321" /></FieldWrap>
          <div style={{ gridColumn: '1/-1' }}><FieldWrap label="Account Name"><input style={inputStyle} value={settings.mpesa_account_name} onChange={ss('mpesa_account_name')} placeholder="e.g. Demo Pharmacy" /></FieldWrap></div>
        </Grid>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-faint)', margin: '8px 0 12px', textTransform: 'uppercase', letterSpacing: 1 }}>Bank</div>
        <Grid>
          <FieldWrap label="Bank Name"><input style={inputStyle} value={settings.bank_name} onChange={ss('bank_name')} placeholder="e.g. Equity Bank" /></FieldWrap>
          <FieldWrap label="Account Number"><input style={inputStyle} value={settings.bank_account} onChange={ss('bank_account')} placeholder="e.g. 0123456789" /></FieldWrap>
          <FieldWrap label="Branch"><input style={inputStyle} value={settings.bank_branch} onChange={ss('bank_branch')} placeholder="e.g. Nairobi CBD" /></FieldWrap>
        </Grid>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><SaveBtn onClick={saveSettings} loading={saving} /></div>
      </Section>

      {/* Alert Settings */}
      <Section title="Alert Thresholds" icon={Bell}>
        <Grid>
          <FieldWrap label="Low Stock Alert (days)" hint="Alert when stock covers less than X days">
            <input style={inputStyle} type="number" value={settings.low_stock_alert_days} onChange={ss('low_stock_alert_days')} />
          </FieldWrap>
          <FieldWrap label="Expiry Alert (days)" hint="Alert when product expires within X days">
            <input style={inputStyle} type="number" value={settings.expiry_alert_days} onChange={ss('expiry_alert_days')} />
          </FieldWrap>
        </Grid>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><SaveBtn onClick={saveSettings} loading={saving} /></div>
      </Section>

      {/* Account Security & Change Password */}
      <Section title="Account Security & Change Password" icon={ShieldCheck}>
        <div style={{
          background: 'rgba(99, 179, 237, 0.08)',
          border: '1px solid rgba(99, 179, 237, 0.25)',
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 20,
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start'
        }}>
          <Info size={20} color="#63b3ed" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#63b3ed', marginBottom: 4 }}>
              🛡️ Security Advice for Facility Admins & Staff
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              For optimal system security, please immediately update your initial or temporary password below upon your first access. Ensure your new password contains at least 6 characters.
            </div>
          </div>
        </div>

        <Grid>
          <div style={{ gridColumn: '1/-1' }}>
            <FieldWrap label="Current Password" hint="Enter your current or temporary password">
              <input style={inputStyle} type="password" value={pw.current_password} onChange={sp('current_password')} placeholder="••••••••" />
            </FieldWrap>
          </div>
          <FieldWrap label="New Password" hint="Minimum 6 characters">
            <input style={inputStyle} type="password" value={pw.new_password} onChange={sp('new_password')} placeholder="••••••••" />
          </FieldWrap>
          <FieldWrap label="Confirm New Password" hint="Re-enter your new password">
            <input style={inputStyle} type="password" value={pw.confirm_password} onChange={sp('confirm_password')} placeholder="••••••••" />
          </FieldWrap>
        </Grid>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={14} color="var(--accent)" />
            <span>Passwords are encrypted using industry-standard Bcrypt security</span>
          </div>
          <button onClick={changePassword} disabled={pwSaving} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#0F1612', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {pwSaving ? <Loader size={15} style={{ animation: 'spin 0.8s linear infinite' }} /> : <KeyRound size={15} />}
            {pwSaving ? 'Updating Password...' : 'Update Password'}
          </button>
        </div>
      </Section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
