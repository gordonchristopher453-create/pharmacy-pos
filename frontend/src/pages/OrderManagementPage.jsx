import React, { useState, useEffect } from 'react';
import {
  ClipboardList, Search, Filter, CheckCircle2, Clock, ShieldCheck,
  Eye, RefreshCw, AlertCircle, CheckSquare, FileText, Send, UserCheck, Activity
} from 'lucide-react';
import api from '../services/api';

const OrderManagementPage = () => {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'analytics'
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [reviewComments, setReviewComments] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchOrders();
    fetchStats();
  }, [selectedType, selectedStatus, selectedPriority]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedType) params.order_type = selectedType;
      if (selectedStatus) params.status = selectedStatus;
      if (selectedPriority) params.priority = selectedPriority;
      if (searchTerm) params.search = searchTerm;

      const res = await api.get('/orders', { params });
      setOrders(res.data?.data || []);
    } catch (err) {
      console.error('Failed to fetch clinical orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/orders/stats');
      setStats(res.data?.data || null);
    } catch (err) {
      console.error('Failed to fetch order stats:', err);
    }
  };

  const handleStatusChange = async (orderId, targetStatus) => {
    setActionLoading(true);
    try {
      await api.put(`/orders/${orderId}/status`, { status: targetStatus });
      fetchOrders();
      fetchStats();
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => ({ ...prev, status: targetStatus }));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update order status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerify = async (orderId) => {
    setActionLoading(true);
    try {
      await api.post(`/orders/${orderId}/verify`, { verification_notes: 'Verified by department supervisor' });
      fetchOrders();
      fetchStats();
      setSelectedOrder(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to verify order result');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRelease = async (orderId) => {
    setActionLoading(true);
    try {
      await api.post(`/orders/${orderId}/release`);
      fetchOrders();
      fetchStats();
      setSelectedOrder(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to release order result');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDoctorReview = async (orderId) => {
    setActionLoading(true);
    try {
      await api.post(`/orders/${orderId}/review`, { review_comments: reviewComments });
      setReviewComments('');
      fetchOrders();
      fetchStats();
      setSelectedOrder(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record doctor review');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'ORDERED':
        return <span className="bg-slate-800 text-slate-300 border border-slate-700 text-xs px-2.5 py-1 rounded-full font-semibold">ORDERED</span>;
      case 'RECEIVED':
      case 'ACCEPTED':
        return <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs px-2.5 py-1 rounded-full font-semibold">{s}</span>;
      case 'IN_PROGRESS':
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs px-2.5 py-1 rounded-full font-semibold animate-pulse">IN PROGRESS</span>;
      case 'COMPLETED':
        return <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 text-xs px-2.5 py-1 rounded-full font-semibold">COMPLETED</span>;
      case 'VERIFIED':
        return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs px-2.5 py-1 rounded-full font-semibold">VERIFIED</span>;
      case 'RELEASED':
        return <span className="bg-purple-500/10 text-purple-400 border border-purple-500/30 text-xs px-2.5 py-1 rounded-full font-semibold">RELEASED</span>;
      case 'REVIEWED':
      case 'CLOSED':
        return <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 inline-flex"><CheckCircle2 size={12} /> REVIEWED</span>;
      default:
        return <span className="bg-slate-800 text-slate-400 border border-slate-700 text-xs px-2.5 py-1 rounded-full font-semibold">{s}</span>;
    }
  };

  const getPriorityBadge = (priority) => {
    const p = (priority || '').toUpperCase();
    if (p === 'EMERGENCY') {
      return <span className="bg-red-500/20 border border-red-500/40 text-red-400 text-xs px-2 py-0.5 rounded font-bold">EMERGENCY</span>;
    } else if (p === 'URGENT') {
      return <span className="bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs px-2 py-0.5 rounded font-bold">URGENT</span>;
    }
    return <span className="bg-slate-800 border border-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded">ROUTINE</span>;
  };

  return (
    <div className="w-full p-4 sm:p-6 space-y-6 font-sans text-slate-100">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-100 flex items-center gap-2.5 tracking-tight">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <ClipboardList className="h-6 w-6" />
            </div>
            Enterprise Order Tracking & Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Standardized lifecycle order tracking, results verification, and clinical review across hospital departments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchOrders(); fetchStats(); }}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border)]">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Orders</p>
            <p className="text-2xl font-black text-slate-100 mt-1">{stats.total_orders}</p>
          </div>
          <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-amber-500/30">
            <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Pending Orders</p>
            <p className="text-2xl font-black text-amber-400 mt-1">{stats.pending_orders}</p>
          </div>
          <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-indigo-500/30">
            <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">Completed / Verified</p>
            <p className="text-2xl font-black text-indigo-400 mt-1">{stats.completed_orders}</p>
          </div>
          <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-purple-500/30">
            <p className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">Awaiting Review</p>
            <p className="text-2xl font-black text-purple-400 mt-1">{stats.awaiting_doctor_review}</p>
          </div>
          <div className="bg-[var(--bg-surface)] p-4 rounded-xl border border-emerald-500/30">
            <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Avg Turnaround</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{stats.avg_turnaround_minutes} mins</p>
          </div>
        </div>
      )}

      {/* Navigation Tabs & Filter Bar */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
        <div className="border-b border-slate-800 p-4 flex flex-wrap items-center justify-between gap-4 bg-slate-900/50">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'orders' ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'}`}
            >
              Order Tracking Lifecycle
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'analytics' ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'}`}
            >
              Order Metrics & Analytics
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search order#, patient, ID..."
                className="pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 text-slate-100 rounded-xl text-xs focus:outline-none focus:border-emerald-500 w-56"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchOrders()}
              />
            </div>

            <select
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-xl text-xs py-1.5 px-3 focus:outline-none focus:border-emerald-500"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="">All Order Types</option>
              <option value="LABORATORY">Laboratory</option>
              <option value="RADIOLOGY">Radiology</option>
              <option value="PHARMACY">Pharmacy</option>
              <option value="PROCEDURE">Procedure</option>
              <option value="PHYSIOTHERAPY">Physiotherapy</option>
              <option value="NUTRITION">Nutrition</option>
              <option value="BLOOD_REQUEST">Blood Request</option>
              <option value="CONSULTATION">Consultation</option>
              <option value="REFERRAL">Referral</option>
            </select>

            <select
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-xl text-xs py-1.5 px-3 focus:outline-none focus:border-emerald-500"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="ORDERED">ORDERED</option>
              <option value="ACCEPTED">ACCEPTED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="VERIFIED">VERIFIED</option>
              <option value="RELEASED">RELEASED</option>
              <option value="REVIEWED">REVIEWED</option>
            </select>
          </div>
        </div>

        {activeTab === 'orders' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Order Number & UUID</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Ordering Doctor</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                      Loading orders...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                      No clinical orders found matching current criteria.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <span className="font-bold text-indigo-400 block">{o.order_number}</span>
                        <span className="text-[10px] text-slate-500 font-mono block">UUID: {o.uuid || 'N/A'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-100 block">{o.patient_first_name} {o.patient_last_name}</span>
                        <span className="text-[11px] text-slate-400">#{o.patient_number}</span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-300">{o.order_type}</td>
                      <td className="py-3 px-4">{getPriorityBadge(o.priority)}</td>
                      <td className="py-3 px-4 text-slate-300">{o.ordering_doctor_name || 'Clinician'}</td>
                      <td className="py-3 px-4">{getStatusBadge(o.status)}</td>
                      <td className="py-3 px-4 text-[11px] text-slate-400">{new Date(o.created_at).toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedOrder(o)}
                          className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 rounded-xl text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Eye size={13} /> Details & Transition
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <h3 className="text-base font-bold text-slate-100">Order Management Departmental Analytics</h3>
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                  <h4 className="text-xs font-bold text-slate-300 mb-3 uppercase tracking-wider">Orders Breakdown by Type</h4>
                  <div className="space-y-2">
                    {stats.orders_by_type?.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800">
                        <span className="text-slate-300 font-medium">{item.order_type}</span>
                        <span className="font-bold text-emerald-400">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                  <h4 className="text-xs font-bold text-slate-300 mb-3 uppercase tracking-wider">Orders Breakdown by Status</h4>
                  <div className="space-y-2">
                    {stats.orders_by_status?.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-800">
                        <span className="text-slate-300 font-medium">{item.status}</span>
                        <span className="font-bold text-indigo-400">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Order Detail & Transition Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 text-slate-100">
            <div className="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Order {selectedOrder.order_number}</h3>
                <p className="text-xs text-slate-400 font-mono">UUID: {selectedOrder.uuid}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-200 text-xl font-bold px-2"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-800 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-400 block text-[11px]">Patient Name:</span>
                <span className="font-bold text-slate-100 text-sm">{selectedOrder.patient_first_name} {selectedOrder.patient_last_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Order Type:</span>
                <span className="font-bold text-slate-100">{selectedOrder.order_type}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Priority:</span>
                <span>{getPriorityBadge(selectedOrder.priority)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Current Lifecycle Status:</span>
                <span>{getStatusBadge(selectedOrder.status)}</span>
              </div>
            </div>

            {/* Lifecycle State Transitions */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Standard Order Lifecycle Transitions</h4>

              <div className="flex flex-wrap gap-2">
                {selectedOrder.status === 'ORDERED' && (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleStatusChange(selectedOrder.id, 'ACCEPTED')}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition"
                  >
                    Accept Order
                  </button>
                )}

                {['ORDERED', 'ACCEPTED'].includes(selectedOrder.status) && (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleStatusChange(selectedOrder.id, 'IN_PROGRESS')}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition"
                  >
                    Mark In Progress
                  </button>
                )}

                {selectedOrder.status === 'IN_PROGRESS' && (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleStatusChange(selectedOrder.id, 'COMPLETED')}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition"
                  >
                    Mark Completed
                  </button>
                )}

                {selectedOrder.status === 'COMPLETED' && (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleVerify(selectedOrder.id)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1"
                  >
                    <ShieldCheck size={14} /> Verify Results
                  </button>
                )}

                {selectedOrder.status === 'VERIFIED' && (
                  <button
                    disabled={actionLoading}
                    onClick={() => handleRelease(selectedOrder.id)}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1"
                  >
                    <Send size={14} /> Release Results
                  </button>
                )}
              </div>

              {/* Doctor Review Section */}
              {['RELEASED', 'VERIFIED', 'COMPLETED'].includes(selectedOrder.status) && (
                <div className="mt-4 p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                  <label className="block text-xs font-bold text-slate-300">
                    Doctor Clinical Result Review & Acknowledgment:
                  </label>
                  <textarea
                    rows={2}
                    className="w-full text-xs p-2.5 bg-slate-900 border border-slate-700 text-slate-100 rounded-xl focus:border-emerald-500 focus:outline-none"
                    placeholder="Enter doctor clinical review comments, recommendations or follow-up plans..."
                    value={reviewComments}
                    onChange={(e) => setReviewComments(e.target.value)}
                  />
                  <button
                    disabled={actionLoading}
                    onClick={() => handleDoctorReview(selectedOrder.id)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
                  >
                    <UserCheck size={14} /> Acknowledge & Mark Reviewed
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-slate-800 pt-3 flex justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManagementPage;
