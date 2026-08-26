import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { login, clearError } from '../store/slices/authSlice';
import { Activity, Eye, EyeOff, Key, X, Loader, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, user } = useSelector(state => state.auth);
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1 = request email, 2 = verify OTP & set password
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    const isPharmacyOnly = user?.pharmacy?.facility_type === 'pharmacy';
    const routes = {
      super_admin: '/app/super-admin',
      facility_admin: isPharmacyOnly ? '/app/pos' : '/app/dashboard',
      doctor: '/app/doctor', lab_technician: '/app/lab', nurse: '/app/triage',
      receptionist: '/app/billing', pharmacist: '/app/pos', cashier: '/app/pos',
      accountant: '/app/finance', sha_officer: '/app/dashboard', store_manager: '/app/stock'
    };
    if (user) navigate(routes[user.role] || '/app/dashboard');
  }, [user, navigate]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(login(form));
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error('Please enter your account email address');
      return;
    }
    setSendingOtp(true);
    setForgotOtp('');
    try {
      const res = await api.post('/auth/forgot-password/request-otp', { email: forgotEmail });
      const codeMsg = res.data?.data?.dev_otp ? ` | Code: ${res.data.data.dev_otp}` : '';
      toast.success((res.data?.message || `OTP sent to ${forgotEmail}`) + codeMsg, { duration: 12000 });
      setForgotStep(2);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP code');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtpAndReset = async (e) => {
    e.preventDefault();
    if (!forgotOtp || forgotOtp.length < 6) {
      toast.error('Please enter the 6-digit OTP code');
      return;
    }
    if (!forgotNewPassword || forgotNewPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setResettingPassword(true);
    try {
      const res = await api.post('/auth/forgot-password/verify-otp', {
        email: forgotEmail,
        otp: forgotOtp,
        new_password: forgotNewPassword
      });
      toast.success(res.data?.message || 'Password reset successfully! Please sign in.');
      setForm(prev => ({ ...prev, email: forgotEmail, password: forgotNewPassword }));
      setShowForgotModal(false);
      setForgotStep(1);
      setForgotEmail('');
      setForgotOtp('');
      setForgotNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      {/* Background pattern */}
      <div style={{
        position: 'fixed', inset: 0, opacity: 0.03,
        backgroundImage: 'radial-gradient(var(--accent) 1px, transparent 1px)',
        backgroundSize: '32px 32px', pointerEvents: 'none'
      }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, background: 'var(--accent)',
            borderRadius: 18, display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 16px',
            boxShadow: '0 0 40px var(--accent)40'
          }}>
            <Activity size={32} color="#0F1612" strokeWidth={2.5} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>Medicare HMS</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 6 }}>Sign in to your account</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-surface)', borderRadius: 16,
          border: '1px solid var(--border)', padding: 32,
          boxShadow: '0 20px 60px #00000040'
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                Email Address
              </label>
              <input
                type="email" required
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="admin@pharmacy.com"
                style={{
                  width: '100%', padding: '12px 16px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 10, color: 'var(--text-primary)', fontSize: 14,
                  outline: 'none', fontFamily: 'DM Sans, sans-serif'
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(form.email);
                    setForgotStep(1);
                    setShowForgotModal(true);
                  }}
                  style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                >
                  Forgot Password?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'} required
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  style={{
                    width: '100%', padding: '12px 44px 12px 16px',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: 10, color: 'var(--text-primary)', fontSize: 14,
                    outline: 'none', fontFamily: 'DM Sans, sans-serif'
                  }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)'
                }}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} style={{
              padding: '13px', background: loading ? 'var(--text-faint)' : 'var(--accent)',
              border: 'none', borderRadius: 10, color: '#0F1612',
              fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 4, letterSpacing: 0.3,
              boxShadow: loading ? 'none' : '0 4px 20px var(--accent)40'
            }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-faint)', marginTop: 24 }}>
          Medicare HMS System v1.0.0
        </p>
      </div>

      {/* Forgot Password OTP Modal */}
      {showForgotModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000080', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', padding: 28, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px #00000060' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Key size={20} color="var(--accent)" /> Reset Account Password
                </h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {forgotStep === 1 ? 'Step 1: Request Security OTP Code' : 'Step 2: Enter OTP & New Password'}
                </p>
              </div>
              <button onClick={() => setShowForgotModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>

            {forgotStep === 1 ? (
              <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    Your Account Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="e.g. admin@facility.com"
                    style={{
                      width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)',
                      fontSize: 14, outline: 'none'
                    }}
                  />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: 10, borderRadius: 8 }}>
                  ℹ️ A 6-digit security OTP code will be dispatched to your registered email address.
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button type="button" onClick={() => setShowForgotModal(false)} style={{ flex: 1, padding: 10, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancel</button>
                  <button type="submit" disabled={sendingOtp} style={{ flex: 1, padding: 10, background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0F1612', cursor: sendingOtp ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {sendingOtp ? <Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : 'Send OTP Code'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtpAndReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ padding: 10, background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                  OTP sent to <strong style={{ color: 'var(--accent)' }}>{forgotEmail}</strong>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    6-Digit Verification OTP *
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={forgotOtp}
                    onChange={e => setForgotOtp(e.target.value)}
                    placeholder="e.g. 582910"
                    style={{
                      width: '100%', padding: '10px 14px', background: 'var(--bg-elevated)',
                      border: '1px solid var(--accent)', borderRadius: 8, color: 'var(--accent)',
                      fontSize: 18, fontWeight: 700, letterSpacing: 4, outline: 'none', fontFamily: 'monospace'
                    }}
                  />
                </div>

                <div style={{ position: 'relative' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    New Password *
                  </label>
                  <input
                    type={showForgotNewPassword ? 'text' : 'password'}
                    required
                    value={forgotNewPassword}
                    onChange={e => setForgotNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    style={{
                      width: '100%', padding: '10px 40px 10px 14px', background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)',
                      fontSize: 14, outline: 'none'
                    }}
                  />
                  <button type="button" onClick={() => setShowForgotNewPassword(!showForgotNewPassword)} style={{ position: 'absolute', right: 12, bottom: 9, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    {showForgotNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button type="button" onClick={() => setForgotStep(1)} style={{ flex: 1, padding: 10, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Resend OTP</button>
                  <button type="submit" disabled={resettingPassword} style={{ flex: 1, padding: 10, background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0F1612', cursor: resettingPassword ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {resettingPassword ? <Loader size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <><CheckCircle size={14} /> Reset Password</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
