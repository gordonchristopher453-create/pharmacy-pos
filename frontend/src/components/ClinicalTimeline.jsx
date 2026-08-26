import React, { useState, useEffect } from 'react';
import {
  Calendar, User, Stethoscope, Activity, TestTube, FileText,
  Syringe, Pill, CreditCard, Home, CheckCircle2, Clock,
  ChevronDown, ChevronRight, Filter, Search, RotateCcw,
  AlertCircle, ChevronUp, Layers, ArrowRight, ShieldAlert,
  Building2, Sparkles, Check, Download, Printer
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function ClinicalTimeline({ patientId, patientName, patientNumber, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Medical History Form & Modal State
  const [showEditHistoryModal, setShowEditHistoryModal] = useState(false);
  const [historyForm, setHistoryForm] = useState({
    allergies: '',
    chronic_conditions: '',
    past_medical_history: '',
    past_surgical_history: '',
    family_history: '',
    social_history: '',
    immunization_history: '',
    blood_group: ''
  });
  const [savingHistory, setSavingHistory] = useState(false);

  // Historical Note Form & Modal State
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [noteForm, setNoteForm] = useState({
    note_title: '',
    note_body: '',
    note_type: 'historical_note',
    date_of_event: new Date().toISOString().split('T')[0]
  });
  const [savingNote, setSavingNote] = useState(false);
  const [historyNotes, setHistoryNotes] = useState([]);

  // Filters State
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedClinic, setSelectedClinic] = useState('all');
  const [selectedDoctor, setSelectedDoctor] = useState('all');
  const [diagnosisQuery, setDiagnosisQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Expand / Collapse State
  const [expandedVisits, setExpandedVisits] = useState(new Set());
  const [expandedEncounters, setExpandedEncounters] = useState(new Set());

  // Fetch Timeline Data & Medical History Notes
  const fetchTimeline = async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (selectedClinic !== 'all') params.append('clinic', selectedClinic);
      if (selectedDoctor !== 'all') params.append('doctor_id', selectedDoctor);
      if (diagnosisQuery.trim()) params.append('diagnosis', diagnosisQuery.trim());
      if (selectedStatus !== 'all') params.append('status', selectedStatus);

      const qs = params.toString() ? `?${params.toString()}` : '';

      let resTimeline;
      try {
        resTimeline = await api.get(`/patients/${patientId}/timeline${qs}`);
      } catch (err1) {
        // Fallback to encounters route
        resTimeline = await api.get(`/encounters/patient/${patientId}/timeline${qs}`);
      }

      const resNotes = await api.get(`/patients/${patientId}/history-notes`).catch(() => ({ data: { data: [] } }));

      const payload = resTimeline.data?.data || {};
      setData(payload);
      setHistoryNotes(resNotes.data?.data || []);

      if (payload.patient) {
        setHistoryForm({
          allergies: payload.patient.allergies || '',
          chronic_conditions: payload.patient.chronic_conditions || '',
          past_medical_history: payload.patient.past_medical_history || '',
          past_surgical_history: payload.patient.past_surgical_history || '',
          family_history: payload.patient.family_history || '',
          social_history: payload.patient.social_history || '',
          immunization_history: payload.patient.immunization_history || '',
          blood_group: payload.patient.blood_group || ''
        });
      }

      // Default expand the first visit and its encounters
      if (payload.visits && payload.visits.length > 0) {
        const firstVisit = payload.visits[0];
        setExpandedVisits(new Set([firstVisit.id]));
        if (firstVisit.encounters) {
          const encIds = firstVisit.encounters.map(e => e.id);
          setExpandedEncounters(new Set(encIds));
        }
      }
    } catch (err) {
      console.error('Timeline error:', err);
      toast.error(err.response?.data?.message || 'Failed to load clinical timeline');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMedicalHistory = async () => {
    if (!patientId) return;
    setSavingHistory(true);
    try {
      const res = await api.put(`/patients/${patientId}/medical-history`, historyForm);
      toast.success('Patient medical history & allergies saved successfully');
      setShowEditHistoryModal(false);
      fetchTimeline();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update medical history');
    } finally {
      setSavingHistory(false);
    }
  };

  const handleSaveHistoricalNote = async () => {
    if (!patientId || !noteForm.note_body.trim()) {
      return toast.error('Please enter the clinical note details');
    }
    setSavingNote(true);
    try {
      await api.post(`/patients/${patientId}/history-notes`, noteForm);
      toast.success('Historical clinical summary note saved');
      setShowAddNoteModal(false);
      setNoteForm({ note_title: '', note_body: '', note_type: 'historical_note', date_of_event: new Date().toISOString().split('T')[0] });
      fetchTimeline();
    } catch (err) {
      toast.error('Failed to record historical note');
    } finally {
      setSavingNote(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, [patientId, dateFrom, dateTo, selectedClinic, selectedDoctor, selectedStatus]);

  // Debounced diagnosis filter fetch
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTimeline();
    }, 400);
    return () => clearTimeout(timer);
  }, [diagnosisQuery]);

  const toggleVisit = (vId) => {
    setExpandedVisits(prev => {
      const next = new Set(prev);
      if (next.has(vId)) next.delete(vId);
      else next.add(vId);
      return next;
    });
  };

  const toggleEncounter = (eId) => {
    setExpandedEncounters(prev => {
      const next = new Set(prev);
      if (next.has(eId)) next.delete(eId);
      else next.add(eId);
      return next;
    });
  };

  const expandAllVisits = () => {
    if (!data?.visits) return;
    const vIds = data.visits.map(v => v.id);
    setExpandedVisits(new Set(vIds));
    const eIds = data.visits.flatMap(v => (v.encounters || []).map(e => e.id));
    setExpandedEncounters(new Set(eIds));
  };

  const collapseAllVisits = () => {
    setExpandedVisits(new Set());
    setExpandedEncounters(new Set());
  };

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedClinic('all');
    setSelectedDoctor('all');
    setDiagnosisQuery('');
    setSelectedStatus('all');
  };

  const getStatusColor = (st) => {
    switch ((st || '').toLowerCase()) {
      case 'discharged':
      case 'completed':
        return '#10b981'; // Green
      case 'doctor':
      case 'with_doctor':
      case 'in_consultation':
      case 'in_progress':
        return '#3b82f6'; // Blue
      case 'triage':
      case 'triaged':
        return '#8b5cf6'; // Purple
      case 'lab':
      case 'radiology':
        return '#06b6d4'; // Cyan
      case 'pharmacy':
        return '#f59e0b'; // Amber
      case 'admitted':
        return '#ef4444'; // Red
      default:
        return '#6b7280'; // Gray
    }
  };

  const activeFiltersCount = [
    dateFrom, dateTo,
    selectedClinic !== 'all',
    selectedDoctor !== 'all',
    diagnosisQuery.trim(),
    selectedStatus !== 'all'
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-xl overflow-hidden border border-[var(--border)]">
      {/* ── HEADER & PATIENT BADGE ── */}
      <div className="p-4 bg-[var(--bg-surface)] border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 flex items-center justify-center font-bold text-lg">
            ⏱️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-[var(--text-primary)]">Patient Medical History & Longitudinal Care</h2>
              <span className="text-[10px] font-mono font-bold bg-[var(--accent)]/15 text-[var(--accent)] px-2 py-0.5 rounded-full uppercase tracking-wider">
                Active EHR Record
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {data?.patient?.full_name || patientName || 'Patient Record'} · <span className="font-mono text-[var(--accent)]">{data?.patient?.patient_number || patientNumber}</span>
              {data?.patient?.gender && ` · ${data.patient.gender.toUpperCase()}`}
              {data?.patient?.blood_group && ` · Blood: ${data.patient.blood_group}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowEditHistoryModal(true)}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-[var(--accent)] text-[#0F1612] hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            ✏️ Edit Patient History & Allergies
          </button>
          <button
            onClick={() => setShowAddNoteModal(true)}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--accent)]/10 transition-all cursor-pointer flex items-center gap-1.5"
          >
            + Add Historical Note
          </button>
          <button
            onClick={expandAllVisits}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-1"
            title="Expand All Visits"
          >
            <ChevronDown size={14} /> Expand All
          </button>
          <button
            onClick={collapseAllVisits}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-1"
            title="Collapse All Visits"
          >
            <ChevronUp size={14} /> Collapse
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── PATIENT MEDICAL BACKGROUND SUMMARY CARD ── */}
      <div className="p-4 bg-[var(--bg-elevated)]/30 border-b border-[var(--border)] space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-extrabold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--accent)]"/> Clinical Background & Medical Profile
          </h3>
          <span className="text-[11px] text-[var(--text-muted)] font-mono">
            {savingHistory ? 'Updating...' : 'Doctor & Nurse Editable Medical History'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Allergies Card */}
          <div className={`p-3 rounded-xl border ${data?.patient?.allergies ? 'bg-red-500/10 border-red-500/40' : 'bg-[var(--bg-surface)] border-[var(--border)]'}`}>
            <span className="font-bold text-red-400 block uppercase text-[10px] tracking-wider mb-1 flex items-center gap-1">
              ⚠️ Known Allergies & Drug Reactions
            </span>
            <p className="text-[var(--text-primary)] leading-relaxed font-mono">
              {data?.patient?.allergies || 'No known drug allergies (NKDA) recorded.'}
            </p>
          </div>

          {/* Chronic Conditions */}
          <div className={`p-3 rounded-xl border ${data?.patient?.chronic_conditions ? 'bg-amber-500/10 border-amber-500/40' : 'bg-[var(--bg-surface)] border-[var(--border)]'}`}>
            <span className="font-bold text-amber-400 block uppercase text-[10px] tracking-wider mb-1 flex items-center gap-1">
              🩺 Chronic Medical Conditions
            </span>
            <p className="text-[var(--text-primary)] leading-relaxed font-mono">
              {data?.patient?.chronic_conditions || 'No chronic illnesses logged.'}
            </p>
          </div>

          {/* Past Surgical / Medical */}
          <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
            <span className="font-bold text-blue-400 block uppercase text-[10px] tracking-wider mb-1 flex items-center gap-1">
              🔪 Past Surgical & Medical Illness History
            </span>
            <p className="text-[var(--text-primary)] leading-relaxed">
              {data?.patient?.past_medical_history || data?.patient?.past_surgical_history || 'No past surgical or prior admission history logged.'}
            </p>
          </div>
        </div>

        {/* Extended History Chips if present */}
        {(data?.patient?.family_history || data?.patient?.social_history || data?.patient?.immunization_history) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1 border-t border-[var(--border)]/50">
            {data?.patient?.family_history && (
              <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]">
                <span className="text-[10px] font-bold text-purple-400 block uppercase">👨‍👩‍👧 Family History</span>
                <p className="text-[var(--text-muted)] text-[11px] mt-0.5">{data.patient.family_history}</p>
              </div>
            )}
            {data?.patient?.social_history && (
              <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]">
                <span className="text-[10px] font-bold text-emerald-400 block uppercase">🏠 Social & Lifestyle</span>
                <p className="text-[var(--text-muted)] text-[11px] mt-0.5">{data.patient.social_history}</p>
              </div>
            )}
            {data?.patient?.immunization_history && (
              <div className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]">
                <span className="text-[10px] font-bold text-cyan-400 block uppercase">💉 Immunizations</span>
                <p className="text-[var(--text-muted)] text-[11px] mt-0.5">{data.patient.immunization_history}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── EDIT MEDICAL HISTORY MODAL ── */}
      {showEditHistoryModal && (
        <div className="fixed inset-0 z-[250] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-2xl w-full p-6 bg-[var(--bg-surface)] rounded-2xl space-y-4 border border-[var(--border)] shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  ✏️ Edit Patient Medical History & Allergies
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Clinical background details recorded here are permanently linked to {data?.patient?.full_name || 'the patient'}'s record.
                </p>
              </div>
              <button onClick={() => setShowEditHistoryModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg">
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1 font-bold text-red-400">
                    ⚠️ Known Allergies & Adverse Reactions
                  </label>
                  <textarea
                    value={historyForm.allergies}
                    onChange={e => setHistoryForm(p => ({ ...p, allergies: e.target.value }))}
                    rows={2}
                    placeholder="e.g. Penicillin (Hives), NSAIDs, Sulfa drugs, Latex, Nuts..."
                    className="w-full bg-[var(--bg-elevated)] border border-red-500/30 rounded-xl p-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1 font-bold text-amber-400">
                    🩺 Chronic Medical Conditions & Comorbidities
                  </label>
                  <textarea
                    value={historyForm.chronic_conditions}
                    onChange={e => setHistoryForm(p => ({ ...p, chronic_conditions: e.target.value }))}
                    rows={2}
                    placeholder="e.g. Hypertension (5 yrs), Diabetes Type 2, Asthma, Sickle Cell..."
                    className="w-full bg-[var(--bg-elevated)] border border-amber-500/30 rounded-xl p-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1 font-bold">
                    📋 Past Medical & Illness History
                  </label>
                  <textarea
                    value={historyForm.past_medical_history}
                    onChange={e => setHistoryForm(p => ({ ...p, past_medical_history: e.target.value }))}
                    rows={3}
                    placeholder="Previous hospitalizations, severe infections, TB treatment history..."
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1 font-bold">
                    🔪 Past Surgical & Procedural History
                  </label>
                  <textarea
                    value={historyForm.past_surgical_history}
                    onChange={e => setHistoryForm(p => ({ ...p, past_surgical_history: e.target.value }))}
                    rows={3}
                    placeholder="e.g. Appendectomy (2021), C-Section (2019), Fracture fixation..."
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1 font-bold">
                    👨‍👩‍👧 Family Medical History
                  </label>
                  <textarea
                    value={historyForm.family_history}
                    onChange={e => setHistoryForm(p => ({ ...p, family_history: e.target.value }))}
                    rows={2}
                    placeholder="Family history of Diabetes, Cardiac disease, Cancer..."
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1 font-bold">
                    🏠 Social & Lifestyle History
                  </label>
                  <textarea
                    value={historyForm.social_history}
                    onChange={e => setHistoryForm(p => ({ ...p, social_history: e.target.value }))}
                    rows={2}
                    placeholder="Smoking, Alcohol, Occupation, Living conditions..."
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1 font-bold">
                    🩸 Blood Group
                  </label>
                  <select
                    value={historyForm.blood_group}
                    onChange={e => setHistoryForm(p => ({ ...p, blood_group: e.target.value }))}
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="">Select Blood Group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>

                  <label className="text-xs text-[var(--text-muted)] block mt-2 mb-1 font-bold">
                    💉 Immunization History
                  </label>
                  <input
                    type="text"
                    value={historyForm.immunization_history}
                    onChange={e => setHistoryForm(p => ({ ...p, immunization_history: e.target.value }))}
                    placeholder="COVID-19, BCG, Tetanus..."
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-[var(--border)]">
              <button
                onClick={() => setShowEditHistoryModal(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMedicalHistory}
                disabled={savingHistory}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-[var(--accent)] text-[#0F1612] hover:opacity-90 disabled:opacity-50"
              >
                {savingHistory ? 'Saving Changes...' : 'Save Patient Medical History'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD HISTORICAL CLINICAL NOTE MODAL ── */}
      {showAddNoteModal && (
        <div className="fixed inset-0 z-[250] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full p-6 bg-[var(--bg-surface)] rounded-2xl space-y-4 border border-[var(--border)] shadow-2xl relative">
            <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                + Record Retrospective Clinical History Entry
              </h3>
              <button onClick={() => setShowAddNoteModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Event Date</label>
                  <input
                    type="date"
                    value={noteForm.date_of_event}
                    onChange={e => setNoteForm(p => ({ ...p, date_of_event: e.target.value }))}
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-2 text-xs text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Note Type</label>
                  <select
                    value={noteForm.note_type}
                    onChange={e => setNoteForm(p => ({ ...p, note_type: e.target.value }))}
                    className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-2 text-xs text-[var(--text-primary)]"
                  >
                    <option value="historical_note">📋 Past Medical History Note</option>
                    <option value="external_transfer">🏥 External Hospital Summary</option>
                    <option value="prior_surgery">🔪 Historical Surgical Log</option>
                    <option value="allergy_alert">⚠️ Critical Allergy Alert</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Title / Heading</label>
                <input
                  type="text"
                  placeholder="e.g. 2024 Admission Summary at KNH for Pneumonia"
                  value={noteForm.note_title}
                  onChange={e => setNoteForm(p => ({ ...p, note_title: e.target.value }))}
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-2 text-xs text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1 font-semibold">Clinical Note & Summary Details *</label>
                <textarea
                  rows={4}
                  placeholder="Type detailed retrospective medical findings, doctor comments, prior discharge summary..."
                  value={noteForm.note_body}
                  onChange={e => setNoteForm(p => ({ ...p, note_body: e.target.value }))}
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-2.5 text-xs text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-[var(--border)]">
              <button onClick={() => setShowAddNoteModal(false)} className="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                Cancel
              </button>
              <button
                onClick={handleSaveHistoricalNote}
                disabled={savingNote}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-[var(--accent)] text-[#0F1612] hover:opacity-90 disabled:opacity-50"
              >
                {savingNote ? 'Saving Note...' : 'Save Clinical Summary Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FILTERS BAR ── */}
      <div className="p-3.5 bg-[var(--bg-elevated)]/50 border-b border-[var(--border)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-center">
        {/* Date From */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Date From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Date To */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Date To</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Clinic / Dept */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Clinic / Dept</label>
          <select
            value={selectedClinic}
            onChange={e => setSelectedClinic(e.target.value)}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] capitalize"
          >
            <option value="all">All Clinics</option>
            {data?.filter_options?.clinics?.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Doctor */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Doctor</label>
          <select
            value={selectedDoctor}
            onChange={e => setSelectedDoctor(e.target.value)}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="all">All Doctors</option>
            {data?.filter_options?.doctors?.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Diagnosis Search */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">Diagnosis / ICD</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search diagnosis..."
              value={diagnosisQuery}
              onChange={e => setDiagnosisQuery(e.target.value)}
              className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg pl-7 pr-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            />
            <Search size={12} className="absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
          </div>
        </div>

        {/* Status & Reset */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Status</label>
            {activeFiltersCount > 0 && (
              <button
                onClick={resetFilters}
                className="text-[10px] font-bold text-[var(--accent)] hover:underline flex items-center gap-1"
              >
                <RotateCcw size={10} /> Reset
              </button>
            )}
          </div>
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] capitalize"
          >
            <option value="all">All Statuses</option>
            {data?.filter_options?.statuses?.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── TIMELINE BODY ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-[var(--text-muted)] font-medium">Assembling chronological clinical timeline...</p>
          </div>
        ) : !data?.visits || data.visits.length === 0 ? (
          <div className="p-12 text-center bg-[var(--bg-surface)] border border-dashed border-[var(--border)] rounded-2xl space-y-3 my-6">
            <Calendar size={32} className="mx-auto text-[var(--text-muted)] opacity-50" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">No Clinical Visits Found</h3>
            <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
              {activeFiltersCount > 0
                ? 'No patient visits match the selected filter criteria. Try resetting or adjusting the filters.'
                : 'No historical care visits or clinical encounters logged for this patient yet.'}
            </p>
            {activeFiltersCount > 0 && (
              <button
                onClick={resetFilters}
                className="px-4 py-2 text-xs font-bold bg-[var(--accent)] text-black rounded-lg hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1.5"
              >
                <RotateCcw size={13} /> Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-[var(--border)]/60">
            {data.visits.map((v, vIdx) => {
              const isVisitExpanded = expandedVisits.has(v.id);
              const stColor = getStatusColor(v.status);

              return (
                <div key={v.id} className="relative pl-10 group">
                  {/* Timeline Node Point */}
                  <div
                    className="absolute left-3 top-4 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-[var(--bg-surface)] flex items-center justify-center transition-transform group-hover:scale-125 z-10 shadow-sm"
                    style={{ backgroundColor: stColor }}
                  />

                  {/* ── VISIT CONTAINER ── */}
                  <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm hover:border-[var(--border)]/90 transition-all">
                    {/* VISIT HEADER */}
                    <div
                      onClick={() => toggleVisit(v.id)}
                      className="p-4 bg-[var(--bg-elevated)]/40 hover:bg-[var(--bg-elevated)] cursor-pointer flex flex-wrap items-center justify-between gap-3 transition-colors border-b border-[var(--border)]/50"
                    >
                      <div className="flex items-center gap-3">
                        <button className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                          {isVisitExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-[var(--text-primary)]">
                              Visit #{v.visit_number || v.id}
                            </span>
                            <span
                              className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border"
                              style={{ backgroundColor: `${stColor}15`, color: stColor, borderColor: `${stColor}30` }}
                            >
                              {v.status?.replace('_', ' ')}
                            </span>
                            <span className="text-xs font-semibold text-[var(--text-muted)]">
                              {new Date(v.visit_date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}
                              {' at '}
                              {new Date(v.visit_date).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <div className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-3 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Building2 size={12} className="text-[var(--accent)]" /> {v.department}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Stethoscope size={12} className="text-[var(--accent)]" /> {v.primary_doctor}
                            </span>
                            {v.primary_diagnosis && (
                              <>
                                <span>•</span>
                                <span className="font-semibold text-[var(--text-primary)] bg-[var(--accent)]/10 px-2 py-0.5 rounded border border-[var(--accent)]/20">
                                  🩺 {v.primary_diagnosis} {v.icd_code ? `(${v.icd_code})` : ''}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex items-center gap-2">
                        <span className="text-xs text-[var(--text-muted)] font-medium">
                          {v.encounters?.length || 0} Encounter(s)
                        </span>
                        <span className="text-[var(--text-muted)]">
                          {isVisitExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </span>
                      </div>
                    </div>

                    {/* EXPANDED VISIT DETAILS */}
                    {isVisitExpanded && (
                      <div className="p-4 space-y-5 bg-[var(--bg-surface)]">
                        {/* ── STEP SEQUENCE FLOW VISUALIZER ── */}
                        <div className="p-3.5 bg-[var(--bg-elevated)]/60 rounded-xl border border-[var(--border)] space-y-2">
                          <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                            <Layers size={12} className="text-[var(--accent)]" /> Care Step Flow Sequence
                          </div>
                          
                          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                            {v.flow_steps?.map((step, idx) => {
                              const isLast = idx === v.flow_steps.length - 1;
                              const isCompleted = step.status === 'completed';
                              const isActive = step.status === 'active' || step.status === 'in_progress';

                              return (
                                <React.Fragment key={step.key}>
                                  <div className={`flex-shrink-0 px-3 py-1.5 rounded-lg border text-xs flex items-center gap-2 transition-all ${
                                    isCompleted 
                                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold'
                                      : isActive 
                                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 font-bold shadow-sm animate-pulse'
                                        : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-muted)] opacity-60'
                                  }`}>
                                    {isCompleted ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                                    <div>
                                      <div className="text-[11px] leading-tight font-bold">{step.title}</div>
                                      {step.detail && <div className="text-[9px] text-[var(--text-muted)] mt-0.5">{step.detail}</div>}
                                    </div>
                                  </div>
                                  {!isLast && <ArrowRight size={12} className="text-[var(--text-muted)] flex-shrink-0 opacity-40" />}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>

                        {/* ── ENCOUNTERS LIST ── */}
                        <div className="space-y-3">
                          <div className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                            <Activity size={14} className="text-[var(--accent)]" /> Encounters under Visit #{v.visit_number || v.id}
                          </div>

                          {v.encounters?.map((enc, encIdx) => {
                            const isEncExpanded = expandedEncounters.has(enc.id);
                            const encStColor = getStatusColor(enc.status);

                            return (
                              <div key={enc.id} className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--bg-surface)] shadow-xs">
                                {/* ENCOUNTER HEADER */}
                                <div
                                  onClick={() => toggleEncounter(enc.id)}
                                  className="p-3 bg-[var(--bg-elevated)]/30 hover:bg-[var(--bg-elevated)]/60 cursor-pointer flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)]/40 transition-colors"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <button className="text-[var(--text-muted)]">
                                      {isEncExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                    </button>
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: encStColor }} />
                                    <span className="text-xs font-bold text-[var(--text-primary)]">
                                      Encounter #{enc.encounter_number || enc.id}
                                    </span>
                                    <span className="text-[10px] font-semibold text-[var(--text-muted)] bg-[var(--bg-surface)] px-2 py-0.5 rounded border border-[var(--border)]">
                                      🏥 {enc.clinic}
                                    </span>
                                    <span className="text-[10px] font-semibold text-[var(--text-muted)]">
                                      👨‍⚕️ {enc.doctor}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span
                                      className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                                      style={{ backgroundColor: `${encStColor}15`, color: encStColor }}
                                    >
                                      {enc.status}
                                    </span>
                                    <span className="text-[10px] text-[var(--text-muted)]">
                                      {enc.started_at ? new Date(enc.started_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : ''}
                                    </span>
                                  </div>
                                </div>

                                {/* ENCOUNTER DETAILED CLINICAL BREAKDOWN */}
                                {isEncExpanded && (
                                  <div className="p-4 space-y-4 text-xs bg-[var(--bg-surface)]">
                                    {/* 1. DIAGNOSES */}
                                    {enc.diagnoses && enc.diagnoses.length > 0 && (
                                      <div className="space-y-1.5 p-3 rounded-xl bg-purple-500/5 border border-purple-500/20">
                                        <div className="font-bold text-purple-400 flex items-center gap-1.5 text-xs">
                                          🩺 Clinical Diagnoses & Impression
                                        </div>
                                        {enc.diagnoses.map((d, dI) => (
                                          <div key={dI} className="bg-[var(--bg-surface)] p-2.5 rounded-lg border border-[var(--border)] space-y-1">
                                            <div className="font-bold text-[var(--text-primary)] flex items-center justify-between">
                                              <span>{d.diagnosis}</span>
                                              {d.icd_code && <span className="font-mono text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded">{d.icd_code}</span>}
                                            </div>
                                            {d.presenting_complaint && <div className="text-[11px] text-[var(--text-muted)]">💬 Complaint: {d.presenting_complaint}</div>}
                                            {d.history_of_illness && <div className="text-[11px] text-[var(--text-muted)]">📜 History: {d.history_of_illness}</div>}
                                            {d.examination_findings && <div className="text-[11px] text-[var(--text-muted)]">🔍 Findings: {d.examination_findings}</div>}
                                            {d.management_plan && <div className="text-[11px] text-[var(--text-muted)]">📋 Plan: {d.management_plan}</div>}
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* 2. VITALS */}
                                    {enc.vitals && enc.vitals.length > 0 && (
                                      <div className="space-y-1.5 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                                        <div className="font-bold text-blue-400 flex items-center gap-1.5 text-xs">
                                          📊 Recorded Triage Vitals
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                          {enc.vitals.map((vt, vtI) => (
                                            <React.Fragment key={vtI}>
                                              {vt.blood_pressure_systolic && <div className="bg-[var(--bg-surface)] p-2 rounded border border-[var(--border)]"><span className="text-[var(--text-muted)] block text-[9px]">Blood Pressure</span><strong className="text-[var(--text-primary)]">{vt.blood_pressure_systolic}/{vt.blood_pressure_diastolic} mmHg</strong></div>}
                                              {vt.pulse_rate && <div className="bg-[var(--bg-surface)] p-2 rounded border border-[var(--border)]"><span className="text-[var(--text-muted)] block text-[9px]">Pulse Rate</span><strong className="text-[var(--text-primary)]">{vt.pulse_rate} bpm</strong></div>}
                                              {vt.temperature && <div className="bg-[var(--bg-surface)] p-2 rounded border border-[var(--border)]"><span className="text-[var(--text-muted)] block text-[9px]">Temperature</span><strong className="text-[var(--text-primary)]">{vt.temperature} °C</strong></div>}
                                              {vt.oxygen_saturation && <div className="bg-[var(--bg-surface)] p-2 rounded border border-[var(--border)]"><span className="text-[var(--text-muted)] block text-[9px]">SpO2</span><strong className="text-[var(--text-primary)]">{vt.oxygen_saturation} %</strong></div>}
                                              {vt.weight && <div className="bg-[var(--bg-surface)] p-2 rounded border border-[var(--border)]"><span className="text-[var(--text-muted)] block text-[9px]">Weight</span><strong className="text-[var(--text-primary)]">{vt.weight} kg</strong></div>}
                                            </React.Fragment>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* 3. LABORATORY */}
                                    {enc.laboratory && enc.laboratory.length > 0 && (
                                      <div className="space-y-1.5 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
                                        <div className="font-bold text-cyan-400 flex items-center gap-1.5 text-xs">
                                          🔬 Laboratory Orders & Diagnostics
                                        </div>
                                        <div className="space-y-1">
                                          {enc.laboratory.map((lab, lI) => (
                                            <div key={lI} className="bg-[var(--bg-surface)] p-2 rounded border border-[var(--border)] flex justify-between items-center">
                                              <div>
                                                <span className="font-bold text-[var(--text-primary)]">{lab.test_name}</span>
                                                {lab.notes && <span className="text-[10px] text-[var(--text-muted)] block">{lab.notes}</span>}
                                                {lab.result_value && <div className="mt-1 text-emerald-400 font-semibold text-[11px]">Result: {lab.result_value}</div>}
                                              </div>
                                              <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase ${lab.status==='completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                                {lab.status}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* 4. RADIOLOGY */}
                                    {enc.radiology && enc.radiology.length > 0 && (
                                      <div className="space-y-1.5 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
                                        <div className="font-bold text-indigo-400 flex items-center gap-1.5 text-xs">
                                          🩻 Radiology & Diagnostic Scans
                                        </div>
                                        <div className="space-y-1">
                                          {enc.radiology.map((rad, rI) => (
                                            <div key={rI} className="bg-[var(--bg-surface)] p-2 rounded border border-[var(--border)] flex justify-between items-center">
                                              <div>
                                                <span className="font-bold text-[var(--text-primary)]">{rad.test_name}</span>
                                                {rad.result_value && <div className="text-emerald-400 text-[11px]">Scan Findings: {rad.result_value}</div>}
                                              </div>
                                              <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-indigo-500/10 text-indigo-400 uppercase">
                                                {rad.status}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* 5. PROCEDURES */}
                                    {enc.procedures && enc.procedures.length > 0 && (
                                      <div className="space-y-1.5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                        <div className="font-bold text-amber-400 flex items-center gap-1.5 text-xs">
                                          💉 Clinical Procedures
                                        </div>
                                        <div className="space-y-1">
                                          {enc.procedures.map((proc, pI) => (
                                            <div key={pI} className="bg-[var(--bg-surface)] p-2 rounded border border-[var(--border)]">
                                              <div className="font-bold text-[var(--text-primary)]">{proc.procedure_name}</div>
                                              {proc.notes && <div className="text-[10px] text-[var(--text-muted)]">{proc.notes}</div>}
                                              {proc.outcome && <div className="text-[10px] text-amber-400 mt-0.5">Outcome: {proc.outcome}</div>}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* 6. PRESCRIPTIONS */}
                                    {enc.prescriptions && enc.prescriptions.length > 0 && (
                                      <div className="space-y-1.5 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                                        <div className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                                          💊 Prescriptions & Pharmacy Dispense
                                        </div>
                                        <div className="space-y-1">
                                          {enc.prescriptions.map((rx, rxI) => (
                                            <div key={rxI} className="bg-[var(--bg-surface)] p-2 rounded border border-[var(--border)] flex justify-between items-center">
                                              <div>
                                                <span className="font-bold text-[var(--text-primary)]">{rx.drug_name}</span>
                                                <div className="text-[10px] text-[var(--text-muted)]">
                                                  {rx.dosage} · {rx.frequency} · {rx.duration} · {rx.route} (Qty: {rx.quantity})
                                                </div>
                                              </div>
                                              <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase ${rx.status==='dispensed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                                {rx.status || 'Prescribed'}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* 7. BILLING */}
                                    {enc.billing && enc.billing.length > 0 && (
                                      <div className="space-y-1.5 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                                        <div className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                                          💳 Billing & Settlement
                                        </div>
                                        <div className="space-y-1">
                                          {enc.billing.map((b, bI) => (
                                            <div key={bI} className="bg-[var(--bg-surface)] p-2 rounded border border-[var(--border)] flex justify-between items-center">
                                              <div>
                                                <span className="font-semibold text-[var(--text-primary)]">{b.item_name}</span>
                                                <span className="text-[10px] text-[var(--text-muted)] block">Type: {b.item_type}</span>
                                              </div>
                                              <div className="text-right">
                                                <div className="font-bold text-[var(--text-primary)]">KES {parseFloat(b.unit_price || 0).toLocaleString()}</div>
                                                <span className={`text-[9px] font-bold uppercase ${b.status==='paid' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                  {b.status}
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* 8. ADMISSIONS */}
                                    {enc.admissions && enc.admissions.length > 0 && (
                                      <div className="space-y-1.5 p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
                                        <div className="font-bold text-rose-400 flex items-center gap-1.5 text-xs">
                                          🏥 Inpatient Ward Admission
                                        </div>
                                        {enc.admissions.map((adm, aI) => (
                                          <div key={aI} className="bg-[var(--bg-surface)] p-2 rounded border border-[var(--border)]">
                                            <div className="font-bold text-[var(--text-primary)]">Ward: {adm.target_ward_id || 'General Ward'}</div>
                                            <div className="text-[10px] text-[var(--text-muted)]">Reason: {adm.reason || 'Clinical observation'}</div>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* 9. DISCHARGE & FOLLOW-UP */}
                                    {(enc.discharge?.is_discharged || enc.follow_up?.date) && (
                                      <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                                        <div className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs">
                                          🏁 Discharge & Follow-up Plan
                                        </div>
                                        {enc.follow_up?.date && (
                                          <div className="text-[11px] text-[var(--text-primary)]">
                                            📅 Scheduled Follow-up: <strong>{new Date(enc.follow_up.date).toLocaleDateString('en-KE')}</strong>
                                          </div>
                                        )}
                                        {enc.follow_up?.notes && (
                                          <div className="text-[10px] text-[var(--text-muted)]">Instructions: {enc.follow_up.notes}</div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
