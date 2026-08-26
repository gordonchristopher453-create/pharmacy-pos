import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Heart, Stethoscope, Pill, FlaskConical, Baby, BedDouble, 
  CreditCard, Shield, Users, ArrowRight, Check, X, Star,
  ShoppingCart, Package, Building2, ChevronRight, Menu
} from 'lucide-react';

const plans = [
  {
    id: 'pharmacy',
    name: 'Pharmacy Pro',
    icon: Pill,
    price: '2,999',
    period: '/month',
    color: '#10b981',
    features: [
      'Point of Sale (POS)',
      'Inventory & Stock Management',
      'Sales Reports & Analytics',
      'Expiry Date Tracking',
      'Barcode Scanning',
      'Customer Management',
      'Up to 5 Staff Accounts',
      'Email Support',
    ],
    excluded: [
      'OPD / Doctor Module',
      'Laboratory Management',
      'Inpatient & Wards',
      'MCH Module',
    ]
  },
  {
    id: 'hospital',
    name: 'Complete Hospital EHR',
    icon: Building2,
    price: '7,999',
    period: '/month',
    color: '#3b82f6',
    popular: true,
    features: [
      'Everything in Pharmacy Pro',
      'OPD / Doctor Consultation',
      'Triage & Vitals',
      'Laboratory Management',
      'Radiology Module',
      'Inpatient & Wards',
      'MCH (ANC, PNC, CWC, FP)',
      'Injection Room',
      'Billing & Insurance',
      'MOH Reports (510-515)',
      'Unlimited Staff Accounts',
      'Priority Support',
    ],
  }
];

const features = [
  { icon: Heart, title: 'MCH Module', desc: 'Complete maternal & child health with ANC, PNC, CWC, Immunization & Family Planning', color: '#ec4899' },
  { icon: Stethoscope, title: 'OPD Management', desc: 'Doctor consultations, prescriptions, lab requests & patient history', color: '#3b82f6' },
  { icon: FlaskConical, title: 'Laboratory', desc: 'CBC templates, auto-flagging, results management & MOH reports', color: '#06b6d4' },
  { icon: Pill, title: 'Pharmacy POS', desc: 'Inventory, dispensing, expiry tracking & sales analytics', color: '#10b981' },
  { icon: BedDouble, title: 'Inpatient Wards', desc: 'Bed management, nursing notes, ward rounds & discharge', color: '#f59e0b' },
  { icon: CreditCard, title: 'Billing & Payments', desc: 'Auto-billing, M-Pesa integration, insurance claims & receipts', color: '#8b5cf6' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif', color: 'var(--text-primary)' }}>
      
      {/* ── NAV ── */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 20, fontWeight: 800 }}>
          <Heart size={28} color="var(--accent)" /> Medicare HMS
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="#features" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14 }}>Features</a>
          <a href="#pricing" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14 }}>Pricing</a>
          <button type="button" onClick={() => navigate('/login')} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            Sign In
          </button>
          <button type="button" onClick={() => navigate('/super-admin')} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#0F1612', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            Get Started
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ textAlign: 'center', padding: '80px 20px 60px', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 20, background: 'var(--accent)15', color: 'var(--accent)', fontSize: 13, fontWeight: 600, marginBottom: 24 }}>
          <Star size={14} /> Trusted by hospitals & pharmacies across Kenya
        </div>
        <h1 style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 800, lineHeight: 1.2, marginBottom: 20 }}>
          Complete Hospital Management<br />
          <span style={{ color: 'var(--accent)' }}>Made Simple</span>
        </h1>
        <p style={{ fontSize: 18, color: 'var(--text-muted)', maxWidth: 600, margin: '0 auto 32px', lineHeight: 1.6 }}>
          From patient registration to discharge. Lab results, pharmacy dispensing, 
          inpatient wards, MCH, billing — all in one system. MOH compliant.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => { document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' }); }} 
            style={{ padding: '14px 32px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#0F1612', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            View Plans <ArrowRight size={18} />
          </button>
          <button type="button" onClick={() => navigate('/login')}
            style={{ padding: '14px 32px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
            Sign In
          </button>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: '60px 20px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 700, marginBottom: 12 }}>Everything You Need</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: 48, fontSize: 16 }}>One system. All departments. Zero headaches.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {features.map((f, i) => (
            <div key={i} style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', padding: 28, transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = f.color; e.currentTarget.style.transform = 'translateY(-4px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: `${f.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <f.icon size={24} color={f.color} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ padding: '60px 20px', maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 700, marginBottom: 12 }}>Simple, Transparent Pricing</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: 48, fontSize: 16 }}>Start with what you need. Upgrade anytime.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>
          {plans.map((plan, i) => (
            <div key={i} style={{ 
              background: 'var(--bg-surface)', borderRadius: 20, border: `2px solid ${plan.popular ? plan.color : 'var(--border)'}`, 
              padding: 32, position: 'relative', transition: 'all 0.2s' 
            }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-6px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
              {plan.popular && (
                <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: plan.color, color: '#fff', padding: '4px 20px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                  MOST POPULAR
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: `${plan.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <plan.icon size={24} color={plan.color} />
                </div>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 700 }}>{plan.name}</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Billed monthly</p>
                </div>
              </div>
              <div style={{ fontSize: 40, fontWeight: 800, marginBottom: 4 }}>
                KES {plan.price}<span style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 400 }}>{plan.period}</span>
              </div>
              <div style={{ margin: '24px 0' }}>
                {plan.features.map((f, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', fontSize: 14 }}>
                    <Check size={16} color={plan.color} />
                    <span>{f}</span>
                  </div>
                ))}
                {plan.excluded?.map((f, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', fontSize: 14, color: 'var(--text-faint)' }}>
                    <X size={16} color="var(--text-faint)" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => { setSelectedPlan(plan); setShowCheckout(true); }}
                style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: plan.popular ? plan.color : 'var(--bg-elevated)', color: plan.popular ? '#fff' : 'var(--text-primary)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                Choose {plan.name}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ padding: '40px 20px', borderTop: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        <p>© 2026 Medicare HMS. Made in Kenya 🇰🇪</p>
        <p style={{ marginTop: 8 }}>MOH Compliant • Secure • Reliable</p>
      </footer>

      {/* ── CHECKOUT MODAL ── */}
      {showCheckout && selectedPlan && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 20, border: '1px solid var(--border)', padding: 32, width: '100%', maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>Checkout</h2>
              <button type="button" onClick={() => { setShowCheckout(false); setSelectedPlan(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>{selectedPlan.name}</span>
                <span style={{ fontWeight: 700 }}>KES {selectedPlan.price}/mo</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Billed monthly. Cancel anytime.</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button type="button" onClick={() => navigate('/super-admin')}
                style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid var(--border)', background: '#fff', color: '#000', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                🟢 Sign up with Google
              </button>
              <button type="button" onClick={() => navigate('/login')}
                style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#0F1612', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Continue with Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
