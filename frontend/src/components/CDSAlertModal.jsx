import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';
import axios from 'axios';

const CDSAlertModal = ({ alerts = [], onOverrideSuccess, onClose, patientId, visitId }) => {
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!alerts || alerts.length === 0) return null;

  const handleOverride = async (alert) => {
    if (!overrideReason || overrideReason.trim().length < 3) {
      setError('Please provide a valid clinical override reason.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await axios.post('/api/cds/override', {
        alert_type: alert.type,
        summary: alert.summary,
        override_reason: overrideReason,
        patient_id: patientId,
        visit_id: visitId
      });
      setSelectedAlert(null);
      setOverrideReason('');
      if (onOverrideSuccess) onOverrideSuccess(alert);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit alert override reason.');
    } finally {
      setSubmitting(false);
    }
  };

  const getSeverityBadge = (severity) => {
    switch ((severity || '').toUpperCase()) {
      case 'HIGH':
        return <span className="bg-red-100 text-red-800 text-xs font-semibold px-2.5 py-0.5 rounded flex items-center gap-1"><AlertTriangle size={12} /> High Safety Risk</span>;
      case 'MEDIUM':
        return <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded flex items-center gap-1"><AlertTriangle size={12} /> Caution Required</span>;
      default:
        return <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded flex items-center gap-1"><Info size={12} /> Clinical Reminder</span>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-red-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-red-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <ShieldAlert className="h-6 w-6 text-yellow-300" />
            <span>Clinical Decision Support Safety Alerts ({alerts.length})</span>
          </div>
          <button onClick={onClose} className="text-white hover:bg-red-700 p-1 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <p className="text-sm text-slate-600">
            The automated Clinical Decision Support engine has detected potential safety risks or reminders for this patient encounter:
          </p>

          {alerts.map((alert, idx) => (
            <div key={idx} className="border border-slate-200 rounded-lg p-4 bg-slate-50 hover:bg-slate-100 transition shadow-xs">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="font-semibold text-slate-900 text-base flex items-center gap-2">
                  {alert.summary}
                </div>
                {getSeverityBadge(alert.severity)}
              </div>
              <p className="text-sm text-slate-700 mb-3">{alert.details}</p>

              {selectedAlert === idx ? (
                <div className="mt-3 p-3 bg-white border border-amber-300 rounded-lg">
                  <label className="block text-xs font-semibold text-amber-900 mb-1">
                    Document Clinical Reason for Override (Required for Audit Log):
                  </label>
                  <textarea
                    rows={2}
                    className="w-full text-xs p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    placeholder="e.g. Patient previously tolerated med; Benefits outweigh risk; Adjusted dosing regimen..."
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                  />
                  {error && <p className="text-xs text-red-600 mt-1 font-medium">{error}</p>}
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => { setSelectedAlert(null); setOverrideReason(''); setError(null); }}
                      className="px-3 py-1 text-xs border border-slate-300 rounded text-slate-700 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={submitting}
                      onClick={() => handleOverride(alert)}
                      className="px-3 py-1 text-xs bg-amber-600 text-white font-medium rounded hover:bg-amber-700 flex items-center gap-1 disabled:opacity-50"
                    >
                      <CheckCircle2 size={12} />
                      {submitting ? 'Submitting...' : 'Confirm Override'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <button
                    onClick={() => { setSelectedAlert(idx); setOverrideReason(''); setError(null); }}
                    className="text-xs text-amber-700 font-medium hover:underline bg-amber-50 px-2.5 py-1 rounded border border-amber-200"
                  >
                    Override with Documented Reason &rarr;
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>All alerts and overrides are recorded in the MMHS Clinical Quality Audit Log.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CDSAlertModal;
