import { useParams, useNavigate, NavLink, Outlet } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const DEPT_CONFIG = {
  reception: {
    label: 'Reception',
    icon: '🏥',
    color: '#f97316',
    nav: [
      { to: '/department/reception', label: 'Patients & Queue', end: true },
    ],
  },
  doctor: {
    label: 'Doctors',
    icon: '👨‍⚕️',
    color: '#3b82f6',
    nav: [
      { to: '/department/doctor', label: 'Consultations Queue', end: true },
      { to: '/department/doctor/patients', label: 'All Patients' },
    ],
  },
  laboratory: {
    label: 'Laboratory',
    icon: '🔬',
    color: '#06b6d4',
    nav: [
      { to: '/department/laboratory', label: 'Lab Requests', end: true },
      { to: '/department/laboratory/stock', label: 'Lab Stock' },
      { to: '/department/laboratory/purchases', label: 'Purchases' },
      { to: '/department/laboratory/suppliers', label: 'Suppliers' },
      { to: '/department/laboratory/reports', label: 'Reports' },
    ],
  },
  pharmacy: {
    label: 'Pharmacy',
    icon: '💊',
    color: '#10b981',
    nav: [
      { to: '/department/pharmacy', label: 'Point of Sale', end: true },
      { to: '/department/pharmacy/patients', label: 'Patients' },
      { to: '/department/pharmacy/products', label: 'Products' },
      { to: '/department/pharmacy/stock', label: 'Stock' },
      { to: '/department/pharmacy/purchases', label: 'Purchases' },
      { to: '/department/pharmacy/suppliers', label: 'Suppliers' },
      { to: '/department/pharmacy/reports', label: 'Reports' },
    ],
  },
  hr: {
    label: 'HR & Finance',
    icon: '👥',
    color: '#a855f7',
    nav: [
      { to: '/department/hr', label: 'Dashboard', end: true },
      { to: '/department/hr/users', label: 'Staff Directory' },
      { to: '/department/hr/finance', label: 'Finance' },
      { to: '/department/hr/reports', label: 'Reports' },
    ],
  },
};

export default function DepartmentPage() {
  const { dept } = useParams();
  const navigate = useNavigate();
  const config = DEPT_CONFIG[dept];

  if (!config) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-faint)' }}>
      Department not found
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Department Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 24px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13 }}>
          <ArrowLeft size={15} /> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>{config.icon}</span>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{config.label}</span>
        </div>

        {/* Department Sub-nav */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 16, flexWrap: 'wrap' }}>
          {config.nav.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end}
              style={({ isActive }) => ({
                padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                textDecoration: 'none',
                background: isActive ? `${config.color}20` : 'transparent',
                color: isActive ? config.color : 'var(--text-muted)',
                border: isActive ? `1px solid ${config.color}40` : '1px solid transparent',
              })}>
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Department Content */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-base)' }}>
        <Outlet />
      </div>
    </div>
  );
}
