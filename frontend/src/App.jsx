import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { getMe } from './store/slices/authSlice';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const LandingPage = lazy(() => import('./pages/landing/LandingPage'));
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/layout/Layout';
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const DepartmentPage = lazy(() => import('./pages/DepartmentPage'));
const SuperAdminPage = lazy(() => import('./pages/SuperAdminPage'));
const PatientsPage = lazy(() => import('./pages/PatientsPage'));
const DoctorPage = lazy(() => import('./pages/DoctorPage'));
const SpecialClinicsPage = lazy(() => import('./pages/SpecialClinicsPage'));
const OrderManagementPage = lazy(() => import('./pages/OrderManagementPage'));
const LabPage = lazy(() => import('./pages/LabPage'));
const TriagePage = lazy(() => import('./pages/TriagePage'));
const InjectionPage = lazy(() => import('./pages/InjectionPage'));
import RadiologyPage from "./pages/RadiologyPage";
const POSPage = lazy(() => import('./pages/POSPage'));
const DispensePage = lazy(() => import('./pages/DispensePage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const StockPage = lazy(() => import('./pages/StockPage'));
const PurchasesPage = lazy(() => import('./pages/PurchasesPage'));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const FinancePage = lazy(() => import('./pages/FinancePage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const HRDashboardPage = lazy(() => import('./pages/HRDashboardPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const SalesPage = lazy(() => import('./pages/SalesPage'));
const ExpiredDrugsPage = lazy(() => import('./pages/ExpiredDrugsPage'));
const InpatientPage = lazy(() => import('./pages/InpatientPage'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const PatientPaymentHistoryPage = lazy(() => import('./pages/PatientPaymentHistoryPage'));
const ClaimsPage = lazy(() => import('./pages/ClaimsPage'));
const ProfitReportPage = lazy(() => import('./pages/ProfitReportPage'));
const SalesSummaryPage = lazy(() => import('./pages/SalesSummaryPage'));
const LabSalesPage = lazy(() => import('./pages/LabSalesPage'));
import ServicePricesPage from "./pages/ServicePricesPage";
import MCHDashboard from "./pages/mch/MCHDashboard";
import ANCPage from "./pages/mch/ANCPage";
import PNCPage from "./pages/mch/PNCPage";
import CWCPage from "./pages/mch/CWCPage";
import ImmunizationPage from "./pages/mch/ImmunizationPage";
import FamilyPlanningPage from "./pages/mch/FamilyPlanningPage";
import DeliveryPage from "./pages/mch/DeliveryPage";
import MCHReports from "./pages/mch/MCHReports";
import MCHAppointments from "./pages/mch/MCHAppointments";
import MCHPatientRecord from "./pages/mch/MCHPatientRecord";
import MCHHistory from "./pages/mch/MCHHistory";
import MCHStockPage from "./pages/mch/MCHStockPage";

const ProtectedRoute = ({ children, roles }) => {
  const { user } = useSelector(state => state.auth);
  if (!user) return <Navigate to="/landing" replace />;
  if (user.role === 'super_admin') return children;
  if (roles) {
    const userRole = user.role;
    const isAllowed = roles.includes(userRole) ||
      (roles.includes('facility_admin') && userRole === 'admin') ||
      (roles.includes('admin') && userRole === 'facility_admin');
    if (!isAllowed) return <Navigate to={getDefaultRoute(userRole)} replace />;
  }
  return children;
};

const getDefaultRoute = (role) => {
  switch(role) {
    case 'super_admin': return '/app/super-admin';
    case 'facility_admin': return '/app/billing';
    case 'doctor': return '/app/doctor';
    case 'lab_technician': return '/app/lab';
    case 'nurse': return '/app/triage';
    case 'receptionist': return '/app/billing';
    case 'pharmacist': return '/app/pos';
    case 'cashier': return '/app/pos';
    case 'accountant': return '/app/finance';
    case 'sha_officer': return '/app/dashboard';
    case 'store_manager': return '/app/stock';
    default: return '/app/dashboard';
  }
};

function DefaultRedirect() {
  const { user } = useSelector(state => state.auth);
  const isPharmacyOnly = user?.pharmacy?.facility_type === 'pharmacy';
  if (isPharmacyOnly && user?.role === 'facility_admin') {
    return <Navigate to="/app/pos" replace />;
  }
  return <Navigate to={getDefaultRoute(user?.role)} replace />;
}

function DeptIndex() {
  const { dept } = useParams();
  switch(dept) {
    case 'reception':  return <PatientsPage />;
    case 'doctor':     return <DoctorPage />;
    case 'lab_technician': return <LabPage />;
    case 'laboratory':    return <LabPage />;
    case 'pharmacy':   return <POSPage />;
    case 'accountant':         return <UsersPage />;
    case 'finance':    return <FinancePage />;
    case 'hr':         return <HRDashboardPage />;
    default: return <div style={{ padding:40, textAlign:'center', color:'var(--text-faint)' }}>Select a section above</div>;
  }
}

export default function App() {
  const dispatch = useDispatch();
  const { initialized } = useSelector(state => state.auth);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) dispatch(getMe());
    else dispatch({ type: 'auth/getMe/rejected' });
  }, [dispatch]);

  if (!initialized) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg-base)', flexDirection:'column', gap:16 }}>
      <div style={{ width:40, height:40, border:'3px solid var(--accent-soft)', borderTop:'3px solid var(--accent)', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <div style={{ fontSize:13, color:'var(--text-muted)' }}>Loading Medicare HMS...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <Suspense fallback={<div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', fontSize:18, color:'var(--accent)' }}>⏳ Loading Medicare HMS...</div>}>
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        style: { background:'var(--bg-elevated)', color:'var(--text-primary)', border:'1px solid var(--border)', fontFamily:'DM Sans, sans-serif' },
        success: { iconTheme: { primary:'var(--accent)', secondary:'var(--bg-base)' } },
      }} />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/login" element={<ErrorBoundary><LoginPage /></ErrorBoundary>} />
        <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<ErrorBoundary><DefaultRedirect /></ErrorBoundary>} />

          <Route path="super-admin" element={<ProtectedRoute roles={['super_admin']}><SuperAdminPage /></ProtectedRoute>} />
          <Route path="dashboard" element={<ProtectedRoute roles={['facility_admin']}><DashboardPage /></ProtectedRoute>} />

          <Route path="department/:dept" element={<ProtectedRoute roles={['facility_admin']}><DepartmentPage /></ProtectedRoute>}>
            <Route index element={<ErrorBoundary><DeptIndex /></ErrorBoundary>} />
            <Route path="patients"  element={<ErrorBoundary><PatientsPage /></ErrorBoundary>} />
            <Route path="stock"     element={<ErrorBoundary><StockPage /></ErrorBoundary>} />
            <Route path="purchases" element={<ErrorBoundary><PurchasesPage /></ErrorBoundary>} />
            <Route path="suppliers" element={<ErrorBoundary><SuppliersPage /></ErrorBoundary>} />
            <Route path="reports"   element={<ErrorBoundary><ReportsPage /></ErrorBoundary>} />
            <Route path="finance"   element={<ErrorBoundary><FinancePage /></ErrorBoundary>} />
            <Route path="users"     element={<ErrorBoundary><UsersPage /></ErrorBoundary>} />
            <Route path="pos"       element={<ErrorBoundary><POSPage /></ErrorBoundary>} />
            <Route path="products"  element={<ErrorBoundary><ProductsPage /></ErrorBoundary>} />
          </Route>

          {/* Staff direct routes */}
          <Route path="patients"  element={<ProtectedRoute roles={["receptionist","pharmacist","facility_admin","admin","nurse","doctor","cashier","accountant"]}><ErrorBoundary><PatientsPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="injection" element={<ProtectedRoute roles={['nurse','facility_admin','admin','doctor']}><ErrorBoundary><InjectionPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="radiology" element={<ProtectedRoute roles={["nurse","doctor","radiologist","facility_admin","admin"]}><ErrorBoundary><RadiologyPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="triage"    element={<ProtectedRoute roles={['nurse','facility_admin','admin','doctor','receptionist']}><ErrorBoundary><TriagePage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="lab"          element={<ProtectedRoute roles={['lab_technician','nurse','facility_admin','admin','doctor']}><ErrorBoundary><LabPage key="requests" /></ErrorBoundary></ProtectedRoute>} />
          <Route path="lab/history"   element={<ProtectedRoute roles={['lab_technician','facility_admin','admin']}><ErrorBoundary><LabPage key="history" /></ErrorBoundary></ProtectedRoute>} />
          <Route path="lab/reports"   element={<ProtectedRoute roles={['lab_technician','facility_admin','admin']}><ErrorBoundary><LabPage key="reports" /></ErrorBoundary></ProtectedRoute>} />
          <Route path="doctor"    element={<ProtectedRoute roles={['doctor','facility_admin','admin']}><ErrorBoundary><DoctorPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="special-clinics" element={<ProtectedRoute roles={['doctor','nurse','facility_admin','admin']}><ErrorBoundary><SpecialClinicsPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="orders" element={<ProtectedRoute roles={['doctor','nurse','lab_technician','facility_admin','admin','radiologist','pharmacist']}><ErrorBoundary><OrderManagementPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="pos"       element={<ProtectedRoute roles={['pharmacist','facility_admin','admin','cashier','receptionist']}><ErrorBoundary><POSPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="dispense"  element={<ProtectedRoute roles={['pharmacist','facility_admin','admin','cashier']}><ErrorBoundary><DispensePage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="products"  element={<ProtectedRoute roles={['pharmacist','facility_admin','admin','lab_technician']}><ErrorBoundary><ProductsPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="stock"     element={<ProtectedRoute roles={['pharmacist','lab_technician','facility_admin','admin']}><ErrorBoundary><StockPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="purchases" element={<ProtectedRoute roles={['pharmacist','lab_technician','facility_admin','admin']}><ErrorBoundary><PurchasesPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="suppliers" element={<ProtectedRoute roles={['pharmacist','lab_technician','facility_admin','admin']}><ErrorBoundary><SuppliersPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="sales"     element={<ProtectedRoute roles={['pharmacist','facility_admin','admin','cashier','accountant']}><ErrorBoundary><SalesPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="expired"   element={<ProtectedRoute roles={['pharmacist','facility_admin','admin']}><ErrorBoundary><ExpiredDrugsPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="inpatient" element={<ProtectedRoute roles={['doctor','nurse','facility_admin','admin','lab_technician','pharmacist','receptionist','cashier']}><ErrorBoundary><InpatientPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="billing" element={<ProtectedRoute roles={["receptionist","pharmacist","facility_admin","admin","accountant","cashier","doctor","nurse"]}><ErrorBoundary><BillingPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="patient-payment-history" element={<ProtectedRoute roles={["receptionist","pharmacist","facility_admin","admin","accountant","cashier"]}><ErrorBoundary><PatientPaymentHistoryPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="claims" element={<ProtectedRoute roles={["receptionist","accountant","facility_admin","admin","doctor","cashier"]}><ErrorBoundary><ClaimsPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="finance"   element={<ProtectedRoute roles={["accountant","pharmacist","facility_admin","admin","cashier"]}><ErrorBoundary><FinancePage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="reports"   element={<ProtectedRoute roles={['accountant','facility_admin','admin','receptionist','pharmacist','lab_technician','cashier']}><ErrorBoundary><ReportsPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="users"     element={<ProtectedRoute roles={['facility_admin','admin','accountant']}><ErrorBoundary><UsersPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="hr"        element={<ProtectedRoute roles={['facility_admin','admin','accountant']}><ErrorBoundary><HRDashboardPage /></ErrorBoundary></ProtectedRoute>} />
          
          <Route path="reports/profit" element={<ProtectedRoute roles={["facility_admin","admin"]}><ErrorBoundary><ProfitReportPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="reports/sales" element={<ProtectedRoute roles={["facility_admin","admin"]}><ErrorBoundary><SalesSummaryPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="reports/lab" element={<ProtectedRoute roles={["facility_admin","admin"]}><ErrorBoundary><LabSalesPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="service-prices" element={<ProtectedRoute roles={["facility_admin","admin"]}><ErrorBoundary><ServicePricesPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="settings"  element={<ProtectedRoute roles={['facility_admin','admin']}><ErrorBoundary><SettingsPage /></ErrorBoundary></ProtectedRoute>} />
          {/* MCH Routes */}
          <Route path="mch" element={<ProtectedRoute roles={["nurse","doctor","facility_admin","admin"]}><ErrorBoundary><MCHDashboard /></ErrorBoundary></ProtectedRoute>} />
          <Route path="mch/anc" element={<ProtectedRoute roles={["nurse","doctor","facility_admin","admin"]}><ErrorBoundary><ANCPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="mch/anc/:id" element={<ProtectedRoute roles={["nurse","doctor","facility_admin","admin"]}><ErrorBoundary><ANCPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="mch/pnc" element={<ProtectedRoute roles={["nurse","doctor","facility_admin","admin"]}><ErrorBoundary><PNCPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="mch/cwc" element={<ProtectedRoute roles={["nurse","doctor","facility_admin","admin"]}><ErrorBoundary><CWCPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="mch/immunization" element={<ProtectedRoute roles={["nurse","facility_admin","admin"]}><ErrorBoundary><ImmunizationPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="mch/family-planning" element={<ProtectedRoute roles={["nurse","facility_admin","admin"]}><ErrorBoundary><FamilyPlanningPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="mch/delivery" element={<ProtectedRoute roles={["nurse","doctor","facility_admin","admin"]}><ErrorBoundary><DeliveryPage /></ErrorBoundary></ProtectedRoute>} />
          <Route path="mch/reports" element={<ProtectedRoute roles={["nurse","doctor","facility_admin","admin"]}><ErrorBoundary><MCHReports /></ErrorBoundary></ProtectedRoute>} />
          <Route path="mch/appointments" element={<ProtectedRoute roles={["nurse","doctor","facility_admin","admin"]}><ErrorBoundary><MCHAppointments /></ErrorBoundary></ProtectedRoute>} />
          <Route path="mch/history" element={<ProtectedRoute roles={["nurse","doctor","facility_admin","admin"]}><ErrorBoundary><MCHHistory /></ErrorBoundary></ProtectedRoute>} />
          <Route path="mch/patient/:patientId" element={<ProtectedRoute roles={["nurse","doctor","facility_admin","admin"]}><ErrorBoundary><MCHPatientRecord /></ErrorBoundary></ProtectedRoute>} />
          <Route path="mch/stock" element={<ProtectedRoute roles={["nurse","facility_admin","admin"]}><ErrorBoundary><MCHStockPage /></ErrorBoundary></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<ErrorBoundary><Navigate to="/" replace /></ErrorBoundary>} />
      </Routes>
    </BrowserRouter>
  </Suspense>
  );
}
