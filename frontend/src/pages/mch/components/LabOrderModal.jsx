import { X } from 'lucide-react';

export default function LabOrderModal({
  isOpen,
  onClose,
  onConfirm,
  labOrderId,
  loading
}) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 400,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 16,
        border: '1px solid var(--border)', padding: 24,
        maxWidth: 420, width: '100%'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>💰 Lab Order Billing</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} color="var(--text-muted)" />
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Please confirm payment at reception to proceed with lab processing.
        </p>
        <div style={{
          background: 'var(--bg-elevated)', borderRadius: 10,
          padding: 12, marginBottom: 16
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Order ID</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>#{labOrderId?.slice(0,8) || '...'}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: 10, background: 'var(--bg-elevated)',
              border: '1px solid var(--border)', borderRadius: 9,
              cursor: 'pointer', fontSize: 13, fontWeight: 600
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 2, padding: 10, background: 'var(--accent)',
              border: 'none', borderRadius: 9, color: '#0F1612',
              fontWeight: 600, cursor: 'pointer', fontSize: 13,
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? '⏳ Processing...' : '✅ Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
