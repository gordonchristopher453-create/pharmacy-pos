import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../store/slices/authSlice';
import {
  ShoppingCart, Package, LayoutDashboard, LogOut, Activity,
  Users, TrendingUp, Settings, ShoppingBag, Truck,
  Menu, X, Building2, Globe, UserRound, DollarSign, Stethoscope,
  FlaskConical, FileText, AlertTriangle, BedDouble, Baby, Shield, Clock, Camera,
  ChevronDown, ChevronRight, Heart, Syringe, ClipboardList, Calendar, Receipt
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

const hasPerm = (user, perm) => {
  if (!user) return false;
  if (user.role === 'super_admin' || user.role === 'facility_admin' || user.role === 'admin') return true;
  const perms = Array.isArray(user.permissions) ? user.permissions : [];
  return perms.includes('*') || perms.includes(perm);
};

export default function Layout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector(state => state.auth);
  const cartCount = useSelector(state => state.cart.items.length);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isSuperAdmin  = user?.role === 'super_admin';
  const isAdmin       = user?.role === 'facility_admin' || user?.role === 'admin' || isSuperAdmin;
  const facilityType  = user?.pharmacy?.facility_type || 'hospital';
  const isPharmacyOnly = facilityType === 'pharmacy';

  const handleLogout = async () => {
    await dispatch(logout());
    toast.success('Logged out');
    navigate('/landing');
    setSidebarOpen(false);
  };

  const ROLE_META = {
    super_admin:      { label: '⚡ Super Admin',       color: '#a855f7' },
    facility_admin:   { label: '👑 Facility Admin',    color: '#10b981' },
    admin:            { label: '👑 Admin',             color: '#10b981' },
    receptionist:     { label: '📋 Receptionist',     color: '#f97316' },
    cashier:          { label: '🧾 Cashier',          color: '#eab308' },
    sha_officer:      { label: '🏥 SHA Officer',      color: '#06b6d4' },
    accountant:       { label: '📊 Accountant',       color: '#8b5cf6' },
    nurse:            { label: '🩺 Nurse',            color: '#ec4899' },
    mch_nurse:        { label: '👶 MCH Nurse',        color: '#f43f5e' },
    clinical_officer: { label: '🩻 Clinical Officer',  color: '#3b82f6' },
    doctor:           { label: '👨‍⚕️ Doctor',           color: '#3b82f6' },
    lab_officer:      { label: '🔬 Lab Officer',        color: '#06b6d4' },
    pharmacist:       { label: '💊 Pharmacist',       color: '#10b981' },
    store_manager:    { label: '📦 Store Manager',    color: '#84cc16' },
  };
  const roleMeta = ROLE_META[user?.role] || { label: user?.role || 'Staff', color: '#888' };

  const allNavItems = [
    // Super Admin
    isSuperAdmin && { to: '/app/super-admin', icon: Globe, label: 'Facilities' },

    // Facility Admin full menu
    isAdmin && !isSuperAdmin && { to: '/app/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
    isAdmin && !isSuperAdmin && !isPharmacyOnly && { to: '/app/patients',    icon: UserRound,        label: 'Patients' },
    isAdmin && !isSuperAdmin && { to: '/app/users',       icon: Users,           label: 'Staff' },

    isAdmin && !isSuperAdmin && { to: '/app/billing',     icon: DollarSign,       label: 'Billing' },
    isAdmin && !isSuperAdmin && { to: '/app/pos',         icon: ShoppingCart,     label: 'Point of Sale', badge: cartCount > 0 ? cartCount : null },
    isAdmin && !isSuperAdmin && !isPharmacyOnly && { to: '/app/dispense',    icon: ShoppingCart,     label: 'Dispense Prescriptions' },
    isAdmin && !isSuperAdmin && !isPharmacyOnly && { to: '/app/doctor',      icon: Stethoscope,      label: 'OPD Queue' },
    isAdmin && !isSuperAdmin && !isPharmacyOnly && { to: '/app/triage',      icon: Activity,         label: 'Triage' },
    isAdmin && !isSuperAdmin && !isPharmacyOnly && { to: '/app/lab',             icon: FlaskConical,  label: 'Lab' },
    isAdmin && !isSuperAdmin && !isPharmacyOnly && { to: '/app/inpatient',   icon: BedDouble,        label: 'Inpatient' },
    isAdmin && !isSuperAdmin && { to: '/app/products',    icon: Package,          label: 'Products' },
    isAdmin && !isSuperAdmin && { to: '/app/stock',       icon: ShoppingBag,      label: 'Stock' },
    isAdmin && !isSuperAdmin && { to: '/app/purchases',   icon: Truck,            label: 'Purchases' },
    isAdmin && !isSuperAdmin && { to: '/app/suppliers',   icon: Building2,        label: 'Suppliers' },
    isAdmin && !isSuperAdmin && { to: '/app/patient-payment-history', icon: Receipt, label: 'Patient Payment History' },
    isAdmin && !isSuperAdmin && { to: '/app/finance',     icon: TrendingUp,       label: 'Finance' },
    isAdmin && !isSuperAdmin && { to: '/app/reports',     icon: FileText,         label: 'Reports' },
    isAdmin && !isSuperAdmin && !isPharmacyOnly && { to: '/app/lab/reports',     icon: FileText,      label: 'Lab Reports' },
    isAdmin && !isSuperAdmin && !isPharmacyOnly && { to: '/app/doctor?tab=reports', icon: FileText,    label: 'OPD Reports' },
    isAdmin && !isSuperAdmin && { to: '/app/expired',     icon: AlertTriangle,    label: 'Expired Drugs' },
    isAdmin && !isSuperAdmin && { to: '/app/settings',    icon: Settings,         label: 'Settings' },
    isAdmin && !isSuperAdmin && { to: "/app/service-prices", icon: DollarSign, label: "Price List" },

    // Permission-based items for non-admin roles
    !isAdmin && hasPerm(user, 'can_register_patients')   && { to: '/app/patients',  icon: UserRound,     label: 'Patients' },
    !isAdmin && hasPerm(user, 'can_manage_queue') && user.role !== 'doctor' && { to: '/app/billing',    icon: DollarSign,      label: 'Billing' },
    !isAdmin && hasPerm(user, 'can_create_bills')        && { to: '/app/billing',   icon: DollarSign,    label: 'Billing' },
    !isAdmin && hasPerm(user, 'can_access_pos')          && { to: '/app/pos',       icon: ShoppingCart,  label: 'Point of Sale', badge: cartCount > 0 ? cartCount : null },
    !isAdmin && hasPerm(user, 'can_submit_sha_claims')   && { to: '/app/billing',   icon: Shield,        label: 'SHA Claims' },
    !isAdmin && hasPerm(user, 'can_view_financial_reports') && user.role !== 'pharmacist' && { to: '/app/finance', icon: TrendingUp,   label: 'Finance' },

    !isAdmin && hasPerm(user, 'can_do_triage') && user.role !== 'doctor' && { to: '/app/triage',    icon: Activity,      label: 'Triage Queue' },
    !isAdmin && hasPerm(user, 'can_manage_injections')   && { to: '/app/injection', icon: Activity,      label: 'Injection Room' },
    !isAdmin && hasPerm(user, "can_request_radiology") && user.role !== 'doctor' && { to: "/app/radiology", icon: Camera, label: "Radiology" },
    !isAdmin && hasPerm(user, 'can_manage_mch')          && { to: '/app/mch',       icon: Baby,          label: 'MCH' },
    !isAdmin && hasPerm(user, 'can_do_consultation')     && { to: '/app/doctor',    icon: Stethoscope,   label: 'OPD Queue' },
    !isAdmin && hasPerm(user, 'can_do_consultation')     && { to: '/app/doctor?tab=history', icon: FileText, label: 'Patient History' },
    !isAdmin && hasPerm(user, 'can_do_consultation')     && { to: '/app/doctor?tab=reports', icon: FileText, label: 'OPD Reports' },
    !isAdmin && hasPerm(user, 'can_manage_admissions')   && { to: '/app/inpatient', icon: BedDouble,     label: 'Inpatient Ward' },
    !isAdmin && hasPerm(user, 'can_manage_lab')          && { to: '/app/lab',             icon: FlaskConical,  label: 'Lab Requests' },
    !isAdmin && hasPerm(user, 'can_manage_lab')          && { to: '/app/lab/history',     icon: Clock,         label: 'Lab History' },
    !isAdmin && hasPerm(user, 'can_manage_lab')          && { to: '/app/lab/reports',     icon: FileText,      label: 'Lab Reports' },
    !isAdmin && hasPerm(user, 'can_manage_pharmacy') && !isPharmacyOnly && { to: '/app/dispense',  icon: ShoppingCart,  label: 'Dispense', badge: null },
    !isAdmin && hasPerm(user, 'can_manage_pharmacy')     && { to: '/app/products',  icon: Package,       label: 'Products' },
    !isAdmin && hasPerm(user, 'can_manage_pharmacy')     && { to: '/app/stock',     icon: ShoppingBag,   label: 'Stock' },
    !isAdmin && hasPerm(user, 'can_manage_pharmacy')     && { to: '/app/purchases', icon: Truck,         label: 'Purchases' },
    !isAdmin && hasPerm(user, 'can_manage_pharmacy')     && { to: '/app/expired',   icon: AlertTriangle, label: 'Expired Drugs' },
    !isAdmin && hasPerm(user, 'can_manage_stock') && !hasPerm(user, 'can_manage_pharmacy') && { to: '/app/stock',     icon: ShoppingBag, label: 'Inventory' },
    !isAdmin && hasPerm(user, 'can_manage_stock') && !hasPerm(user, 'can_manage_pharmacy') && { to: '/app/purchases', icon: Truck,       label: 'Purchases' },
    !isAdmin && hasPerm(user, 'can_manage_stock') && !hasPerm(user, 'can_manage_pharmacy') && { to: '/app/suppliers', icon: Building2,   label: 'Suppliers' },
  ].filter(Boolean);

  // Build Grouped Navigation
  const getNavGroups = () => {
    if (isSuperAdmin) {
      return [
        {
          title: '⚡ Super Admin',
          items: [{ to: '/app/super-admin', icon: Globe, label: 'Facilities' }]
        }
      ];
    }

    const groups = [];

    if (isPharmacyOnly) {
      // ══════════════════════════════════════════════════════════════════════
      // STANDALONE PHARMACY NAVIGATION (Pure POS & Retail Inventory)
      // ══════════════════════════════════════════════════════════════════════

      // 1. Overview
      const overviewItems = [
        (isAdmin || hasPerm(user, 'can_access_dashboard')) && { to: '/app/dashboard', icon: LayoutDashboard, label: 'Pharmacy Dashboard' },
      ].filter(Boolean);
      if (overviewItems.length > 0) groups.push({ title: '⚡ Overview', items: overviewItems });

      // 2. Pharmacy Operations & Inventory (POS Focused)
      const pharmacyItems = [
        (isAdmin || hasPerm(user, 'can_access_pos') || user?.role === 'pharmacist' || user?.role === 'cashier') && { to: '/app/pos', icon: ShoppingCart, label: 'Point of Sale (POS)', badge: cartCount > 0 ? cartCount : null },
        (isAdmin || hasPerm(user, 'can_manage_pharmacy') || hasPerm(user, 'can_manage_stock') || user?.role === 'pharmacist') && { to: '/app/products', icon: Package, label: 'Products & Formulary' },
        (isAdmin || hasPerm(user, 'can_manage_pharmacy') || hasPerm(user, 'can_manage_stock') || user?.role === 'pharmacist') && { to: '/app/stock', icon: ShoppingBag, label: 'Stock & Batches' },
        (isAdmin || hasPerm(user, 'can_manage_pharmacy') || hasPerm(user, 'can_manage_stock') || user?.role === 'pharmacist') && { to: '/app/purchases', icon: Truck, label: 'Purchases & Receiving' },
        (isAdmin || hasPerm(user, 'can_manage_pharmacy') || hasPerm(user, 'can_manage_stock') || user?.role === 'pharmacist') && { to: '/app/suppliers', icon: Building2, label: 'Suppliers Directory' },
        (isAdmin || hasPerm(user, 'can_manage_pharmacy') || user?.role === 'pharmacist') && { to: '/app/expired', icon: AlertTriangle, label: 'Expired Drugs' },
      ].filter(Boolean);
      if (pharmacyItems.length > 0) groups.push({ title: '💊 Pharmacy POS & Inventory', items: pharmacyItems });

      // 3. Sales & Invoicing
      const salesItems = [
        (isAdmin || hasPerm(user, 'can_create_bills') || hasPerm(user, 'can_receive_payments') || user?.role === 'cashier') && { to: '/app/billing', icon: DollarSign, label: 'Sales & Invoicing' },
        (isAdmin || hasPerm(user, 'can_create_bills') || hasPerm(user, 'can_receive_payments') || user?.role === 'cashier') && { to: '/app/patient-payment-history', icon: Receipt, label: 'Customer Receipts' },
        (isAdmin || hasPerm(user, 'can_register_patients')) && { to: '/app/patients', icon: UserRound, label: 'Customers & Refills' },
        (isAdmin || hasPerm(user, 'can_manage_billing_config')) && { to: '/app/service-prices', icon: DollarSign, label: 'Drug Price List' },
      ].filter(Boolean);
      if (salesItems.length > 0) groups.push({ title: '💳 Sales & Billing', items: salesItems });

      // 4. Financials & Reports
      const reportItems = [
        (isAdmin || hasPerm(user, 'can_view_financial_reports')) && { to: '/app/reports', icon: FileText, label: 'Reports Hub' },
        isAdmin && { to: '/app/reports/profit', icon: TrendingUp, label: 'Profit & Loss Report' },
        isAdmin && { to: '/app/reports/sales', icon: FileText, label: 'Sales Summary' },
        (isAdmin || hasPerm(user, 'can_view_financial_reports') || hasPerm(user, 'can_view_revenue_reports')) && { to: '/app/finance', icon: TrendingUp, label: 'Finance & Expenses' },
      ].filter(Boolean);
      if (reportItems.length > 0) groups.push({ title: '📊 Reports & Financials', items: reportItems });

      // 5. Administration
      const adminItems = [
        (isAdmin || hasPerm(user, 'can_manage_users')) && { to: '/app/users', icon: Users, label: 'Staff Directory' },
        isAdmin && { to: '/app/settings', icon: Settings, label: 'Pharmacy Settings' },
      ].filter(Boolean);
      if (adminItems.length > 0) groups.push({ title: '👥 Pharmacy Management', items: adminItems });

      return groups;
    }

    // ══════════════════════════════════════════════════════════════════════
    // FULL HOSPITAL NAVIGATION (Full HMS + Full Clinical Pharmacy Suite)
    // ══════════════════════════════════════════════════════════════════════

    // 1. Overview & Patient Care
    const careItems = [
      (isAdmin || hasPerm(user, 'can_access_dashboard')) && { to: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      (isAdmin || hasPerm(user, 'can_register_patients')) && user?.role !== 'doctor' && user?.role !== 'clinical_officer' && { to: '/app/patients', icon: UserRound, label: 'Patients' },
      (isAdmin || hasPerm(user, 'can_do_triage')) && user?.role !== 'doctor' && user?.role !== 'clinical_officer' && { to: '/app/triage', icon: Activity, label: 'Triage Queue' },
      (isAdmin || hasPerm(user, 'can_do_consultation')) && { to: '/app/doctor', icon: Stethoscope, label: 'OPD Queue' },
      (isAdmin || hasPerm(user, 'can_do_consultation') || hasPerm(user, 'can_manage_lab') || hasPerm(user, 'can_manage_radiology')) && { to: '/app/orders', icon: ClipboardList, label: 'Order Tracking' },
      (isAdmin || hasPerm(user, 'can_do_consultation') || hasPerm(user, 'can_view_clinical_reports')) && { to: '/app/doctor?tab=history', icon: Clock, label: 'Patient History' },
      (isAdmin || hasPerm(user, 'can_manage_injections')) && { to: '/app/injection', icon: Activity, label: 'Injection Room' },
      (isAdmin || hasPerm(user, 'can_manage_admissions') || hasPerm(user, 'can_manage_ward_activities')) && { to: '/app/inpatient', icon: BedDouble, label: 'Inpatient Ward' },
    ].filter(Boolean);
    if (careItems.length > 0) groups.push({ title: '🏠 Clinical Care', items: careItems });

    // 2. Maternal & Child Health
    const mchItems = [
      (isAdmin || hasPerm(user, 'can_manage_mch')) && { to: '/app/mch', icon: LayoutDashboard, label: 'MCH Dashboard' },
      (isAdmin || hasPerm(user, 'can_manage_mch')) && { to: '/app/mch/anc', icon: Heart, label: 'ANC Clinic' },
      (isAdmin || hasPerm(user, 'can_manage_mch')) && { to: '/app/mch/pnc', icon: Stethoscope, label: 'PNC Clinic' },
      (isAdmin || hasPerm(user, 'can_manage_mch')) && { to: '/app/mch/cwc', icon: Baby, label: 'CWC Clinic' },
      (isAdmin || hasPerm(user, 'can_manage_mch')) && { to: '/app/mch/immunization', icon: Syringe, label: 'Immunization' },
      (isAdmin || hasPerm(user, 'can_manage_mch')) && { to: '/app/mch/family-planning', icon: Users, label: 'Family Planning' },
      (isAdmin || hasPerm(user, 'can_manage_mch')) && { to: '/app/mch/delivery', icon: ClipboardList, label: 'Delivery Register' },
      (isAdmin || hasPerm(user, 'can_manage_mch')) && { to: '/app/mch/appointments', icon: Calendar, label: 'Appointments' },
      (isAdmin || hasPerm(user, 'can_manage_mch')) && { to: '/app/mch/stock', icon: ShoppingBag, label: 'MCH Vaccines & Stock' },
      (isAdmin || hasPerm(user, 'can_manage_mch')) && { to: '/app/mch/reports', icon: FileText, label: 'MOH Reports' },
    ].filter(Boolean);
    if (mchItems.length > 0) groups.push({ title: '👶 Maternal & Child', items: mchItems });

    // 3. Radiology Department
    const radItems = [
      (isAdmin || hasPerm(user, 'can_manage_radiology') || user?.role === 'radiologist' || user?.role === 'radiology_tech') && { to: '/app/radiology', icon: Camera, label: 'Radiology' },
    ].filter(Boolean);
    if (radItems.length > 0) groups.push({ title: '📸 Radiology', items: radItems });

    // 4. Laboratory
    const labItems = [
      (isAdmin || hasPerm(user, 'can_manage_lab')) && { to: '/app/lab', icon: FlaskConical, label: 'Lab Requests' },
      (isAdmin || hasPerm(user, 'can_manage_lab')) && { to: '/app/lab/history', icon: Clock, label: 'Lab History' },
      (isAdmin || hasPerm(user, 'can_manage_lab')) && { to: '/app/lab/reports', icon: FileText, label: 'Lab Reports' },
    ].filter(Boolean);
    if (labItems.length > 0) groups.push({ title: '🔬 Laboratory', items: labItems });

    // 5. Full Hospital Pharmacy & Inventory (Prescriptions Queue + POS + Stock)
    const pharmacyItems = [
      (isAdmin || hasPerm(user, 'can_manage_pharmacy') || user?.role === 'pharmacist') && { to: '/app/dispense', icon: ShoppingCart, label: 'Dispense Prescriptions' },
      (isAdmin || hasPerm(user, 'can_access_pos') || user?.role === 'pharmacist' || user?.role === 'cashier') && { to: '/app/pos', icon: ShoppingCart, label: 'Point of Sale (POS)', badge: cartCount > 0 ? cartCount : null },
      (isAdmin || hasPerm(user, 'can_manage_pharmacy') || hasPerm(user, 'can_manage_stock') || user?.role === 'pharmacist') && { to: '/app/products', icon: Package, label: 'Products & Formulary' },
      (isAdmin || hasPerm(user, 'can_manage_pharmacy') || hasPerm(user, 'can_manage_stock') || user?.role === 'pharmacist') && { to: '/app/stock', icon: ShoppingBag, label: 'Stock & Batches' },
      (isAdmin || hasPerm(user, 'can_manage_pharmacy') || hasPerm(user, 'can_manage_stock') || user?.role === 'pharmacist') && { to: '/app/purchases', icon: Truck, label: 'Purchases & Receiving' },
      (isAdmin || hasPerm(user, 'can_manage_pharmacy') || hasPerm(user, 'can_manage_stock') || user?.role === 'pharmacist') && { to: '/app/suppliers', icon: Building2, label: 'Suppliers Directory' },
      (isAdmin || hasPerm(user, 'can_manage_pharmacy') || user?.role === 'pharmacist') && { to: '/app/expired', icon: AlertTriangle, label: 'Expired Drugs' },
    ].filter(Boolean);
    if (pharmacyItems.length > 0) groups.push({ title: '💊 Hospital Pharmacy & Stock', items: pharmacyItems });

    // 6. Billing & Claims (Records / Cashier / SHA Officer / Receptionist / Accountant)
    const isDoctorRole = user?.role === 'doctor' || user?.role === 'clinical_officer';
    const billingItems = [
      (!isDoctorRole && (isAdmin || hasPerm(user, 'can_create_bills') || hasPerm(user, 'can_receive_payments') || user?.role === 'receptionist' || user?.role === 'cashier')) && { to: '/app/billing', icon: DollarSign, label: 'Billing Console' },
      (!isDoctorRole && (isAdmin || hasPerm(user, 'can_create_bills') || hasPerm(user, 'can_receive_payments') || user?.role === 'receptionist' || user?.role === 'cashier')) && { to: '/app/patient-payment-history', icon: Receipt, label: 'Patient Payment History' },
      (!isDoctorRole && (isAdmin || hasPerm(user, 'can_submit_sha_claims') || hasPerm(user, 'can_create_sha_claims') || user?.role === 'sha_officer')) && { to: '/app/claims', icon: Shield, label: 'SHA & KHIE Claims' },
      (!isDoctorRole && (isAdmin || hasPerm(user, 'can_view_financial_reports') || hasPerm(user, 'can_view_revenue_reports'))) && { to: '/app/finance', icon: TrendingUp, label: 'Finance' },
      (!isDoctorRole && (isAdmin || hasPerm(user, 'can_manage_billing_config'))) && { to: '/app/service-prices', icon: DollarSign, label: 'Price List' },
    ].filter(Boolean);
    if (billingItems.length > 0) groups.push({ title: '💳 Billing & Claims', items: billingItems });

    // 7. Reports & Analytics
    const reportItems = [
      (isAdmin || hasPerm(user, 'can_view_financial_reports')) && { to: '/app/reports', icon: FileText, label: 'Reports Hub' },
      isAdmin && { to: '/app/reports/profit', icon: TrendingUp, label: 'Profit Report' },
      isAdmin && { to: '/app/reports/sales', icon: FileText, label: 'Sales Summary' },
    ].filter(Boolean);
    if (reportItems.length > 0) groups.push({ title: '📊 Reports & Analytics', items: reportItems });

    // 8. Administration
    const adminItems = [
      (isAdmin || hasPerm(user, 'can_manage_users')) && { to: '/app/users', icon: Users, label: 'Staff Directory' },
      (isAdmin || hasPerm(user, 'can_manage_users')) && { to: '/app/department/hr', icon: Users, label: 'HR & Payroll' },
      isAdmin && { to: '/app/settings', icon: Settings, label: 'Facility Settings' },
    ].filter(Boolean);
    if (adminItems.length > 0) groups.push({ title: '👥 Administration', items: adminItems });

    return groups;
  };

  const navGroups = getNavGroups();

  const NavItem = ({ to, icon: Icon, label, badge, onClick }) => {
    const loc = window.location;
    const [toPath, toSearch] = to.split('?');
    const toTab = new URLSearchParams(toSearch || '').get('tab');
    const curTab = new URLSearchParams(loc.search).get('tab');
    const exactMatch = loc.pathname === toPath && (toTab ? toTab === curTab : !curTab);
    return (
    <NavLink to={to} onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 8,
      color: exactMatch ? 'var(--accent)' : 'var(--text-muted)',
      background: exactMatch ? 'var(--accent-soft)' : 'transparent',
      textDecoration: 'none', fontSize: 12, fontWeight: exactMatch ? 700 : 500,
      border: exactMatch ? '1px solid rgba(16,185,129,0.2)' : '1px solid transparent',
      marginBottom: 2, whiteSpace: 'nowrap'
    }}>
      <Icon size={15} />
      <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{label}</span>
      {badge && <span style={{ marginLeft: 'auto', background: 'var(--accent)', color: '#0F1612', borderRadius: 10, fontSize: 9, fontWeight: 700, padding: '1px 6px' }}>{badge}</span>}
    </NavLink>
    );
  };

  const [collapsedGroups, setCollapsedGroups] = useState({});
  const toggleGroup = (title) => {
    setCollapsedGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px 10px' }}>
      <div style={{ padding: '8px 14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        {user?.pharmacy?.logo_url && !isSuperAdmin
          ? <img src={user.pharmacy.logo_url} alt="logo" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 9, background: 'white', padding: 2, flexShrink: 0 }} />
          : <div style={{ width: 34, height: 34, background: 'var(--accent)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(16,185,129,0.3)', flexShrink: 0 }}>
              <Activity size={18} color="#0F1612" strokeWidth={2.5} />
            </div>
        }
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{user?.pharmacy?.name || 'Medicare HMS'}</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', display: 'flex', gap: 4, alignItems: 'center' }}>
            <span>v2.1.0</span>
            <span style={{ color: 'var(--accent)', background: 'var(--accent-soft)', padding: '1px 4px', borderRadius: 3, fontWeight: 700, fontSize: 8 }}>ENTERPRISE</span>
          </div>
        </div>
      </div>

      {user?.pharmacy?.name && !isSuperAdmin && (
        <div style={{ margin: '0 4px 10px', padding: '6px 10px', background: 'var(--accent-soft)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.2)' }}>
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Facility</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.pharmacy.name}</div>
        </div>
      )}

      {isSuperAdmin && (
        <div style={{ margin: '0 4px 10px', padding: '6px 10px', background: 'rgba(168,85,247,0.1)', borderRadius: 8, border: '1px solid rgba(168,85,247,0.3)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7' }}>⚡ Super Admin</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Full platform control</div>
        </div>
      )}

      <nav style={{ flex: 1, overflowY: 'auto', paddingRight: 2 }}>
        {navGroups.map(group => {
          const isCollapsed = collapsedGroups[group.title];
          return (
            <div key={group.title} style={{ marginBottom: 12 }}>
              <div
                onClick={() => toggleGroup(group.title)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '4px 8px', fontSize: 10, fontWeight: 800, letterSpacing: '0.5px',
                  color: 'var(--text-muted)', cursor: 'pointer', textTransform: 'uppercase',
                  userSelect: 'none'
                }}
              >
                <span>{group.title}</span>
                {isCollapsed ? <ChevronRight size={12}/> : <ChevronDown size={12}/>}
              </div>
              {!isCollapsed && (
                <div style={{ marginTop: 2 }}>
                  {group.items.map(item => (
                    <NavItem key={item.to + item.label} {...item} onClick={() => setSidebarOpen(false)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div style={{ marginTop: 8 }}>
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', marginBottom: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.full_name}</div>
          <div style={{ fontSize: 11, marginTop: 2, color: roleMeta.color, fontWeight: 600 }}>{roleMeta.label}</div>
        </div>
        <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', borderRadius: 10, color: 'var(--danger)', background: 'transparent', border: '1px solid transparent', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          <LogOut size={16} /><span>Logout</span>
        </button>
      </div>
    </div>
  );

  const flatNavItems = navGroups.flatMap(g => g.items);
  const bottomNavItems = flatNavItems.slice(0, 5);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{ width: 220, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column' }} className="desktop-sidebar">
        <SidebarContent />
      </aside>

      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: '#00000060', zIndex: 40, display: 'none' }} className={`mobile-overlay${sidebarOpen ? " open" : ""}`} />}

      <aside style={{ position: 'fixed', top: 0, left: sidebarOpen ? 0 : '-280px', width: 260, height: '100vh', background: 'var(--bg-surface)', borderRight: '1px solid var(--border)', zIndex: 50, transition: 'left 0.25s ease', display: 'none', flexDirection: 'column' }} className="mobile-sidebar">
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <button onClick={() => setSidebarOpen(false)} style={{ background: 'var(--bg-elevated)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>
        <SidebarContent />
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'none', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }} className="mobile-topbar">
          <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: 4 }}>
            <Menu size={22} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {user?.pharmacy?.logo_url && !isSuperAdmin
              ? <img src={user.pharmacy.logo_url} alt="logo" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 8, background: 'white', padding: 2 }} />
              : <div style={{ width: 28, height: 28, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Activity size={15} color="#0F1612" strokeWidth={2.5} />
                </div>
            }
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{user?.pharmacy?.name || 'Medicare HMS'}</span>
          </div>
          <div style={{ width: 30 }} />
        </div>

        {/* Enterprise Global Telemetry Bar Removed to Clean Up UI */}

        <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg-base)' }}>
          <Outlet />
        </main>

        <nav style={{ display: 'none', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', padding: '6px 4px', flexShrink: 0 }} className="mobile-bottom-nav">
          {bottomNavItems.map(({ to, icon: Icon, label, badge }) => (
            <NavLink key={to + label} to={to} style={({ isActive }) => ({
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '6px 4px', borderRadius: 8, flex: 1,
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              textDecoration: 'none', fontSize: 9, fontWeight: 600,
              background: isActive ? 'var(--accent-soft)' : 'transparent', position: 'relative'
            })}>
              <Icon size={19} />
              <span>{label.split(' ')[0]}</span>
              {badge && <span style={{ position: 'absolute', top: 2, right: 2, background: 'var(--accent)', color: '#0F1612', borderRadius: '50%', fontSize: 8, fontWeight: 700, width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>}
            </NavLink>
          ))}
        </nav>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-topbar { display: flex !important; }
          .mobile-bottom-nav { display: flex !important; }
          .mobile-sidebar { display: flex !important; }
          .mobile-overlay.open { display: block !important; }
        }
      `}</style>
    </div>
  );
}
