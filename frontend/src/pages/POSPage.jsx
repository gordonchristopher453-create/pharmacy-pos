import { printReceipt } from '../utils/printReceipt';
import DiagnosisSearch from '../components/DiagnosisSearch';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addItem, removeItem, updateQuantity, setDiscount, setPaymentMethod, clearCart } from '../store/slices/cartSlice';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  Search, Barcode, Plus, Minus, Trash2, ShoppingCart,
  CreditCard, Smartphone, Banknote, CheckCircle, X, Loader,
  History, Printer, Eye, RefreshCw, ArrowLeft, ClipboardList,
  Pill, AlertTriangle, ShieldAlert, Sparkles, Filter, Grid, List,
  Check, DollarSign, Calendar, Zap, FileText, ChevronRight, UserCheck,
  AlertCircle
} from 'lucide-react';

const CATEGORY_PILLS = [
  { id: 'all', label: 'All Stock', icon: Pill },
  { id: 'antibiotics', label: 'Antibiotics', icon: Sparkles },
  { id: 'analgesics', label: 'Pain & Fever', icon: Zap },
  { id: 'syrups', label: 'Syrups & Liquids', icon: FileText },
  { id: 'injections', label: 'Injections & IV', icon: ShieldAlert },
  { id: 'otc', label: 'OTC & Topical', icon: CheckCircle },
  { id: 'low_stock', label: '⚠️ Low Stock', icon: AlertTriangle },
];

const PaymentButton = ({ id, label, Icon, selected, onClick }) => (
  <button onClick={() => onClick(id)} style={{
    flex: 1, padding: '12px 8px', borderRadius: 12,
    border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
    background: selected ? 'var(--accent-soft)' : 'var(--bg-elevated)',
    color: selected ? 'var(--accent)' : 'var(--text-muted)',
    cursor: 'pointer', fontSize: 12, fontWeight: 700,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
  }}>
    <Icon size={18} />{label}
  </button>
);

const CartItem = ({ item, onRemove, onDecrease, onIncrease }) => (
  <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: '12px 14px', border: '1px solid var(--border)', marginBottom: 8, transition: 'all 0.2s' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
      <div style={{ flex: 1, marginRight: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {item.name}
          {item.requires_prescription && <span style={{ fontSize: 9, background: 'var(--warning)20', color: 'var(--warning)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>Rx</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>KES {item.selling_price.toFixed(2)} / {item.unit || 'unit'}</div>
      </div>
      <button onClick={() => onRemove(item.product_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4, borderRadius: 6 }}>
        <Trash2 size={15} />
      </button>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-surface)', padding: '3px 6px', borderRadius: 10, border: '1px solid var(--border)' }}>
        <button onClick={() => onDecrease(item.product_id, item.quantity)} style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Minus size={13} />
        </button>
        <span className="mono" style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', minWidth: 28, textAlign: 'center' }}>{item.quantity}</span>
        <button onClick={() => onIncrease(item.product_id, item.quantity, item.total_stock)} style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={13} />
        </button>
      </div>
      <span className="mono" style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>KES {(item.selling_price * item.quantity).toFixed(2)}</span>
    </div>
  </div>
);

// ── Preview Screen ────────────────────────────────────────────────────────────
const PreviewScreen = ({ items, subtotal, discountAmt, total, paymentMethod, mpesaCode, setMpesaCode, tenderedAmount, processing, onBackToCart, onConfirm }) => {
  const pmIcons = { cash: Banknote, mpesa: Smartphone, card: CreditCard };
  const pmColors = { cash: 'var(--accent)', mpesa: 'var(--info)', card: 'var(--warning)' };
  const PmIcon = pmIcons[paymentMethod] || Banknote;
  const changeAmt = Math.max(0, (parseFloat(tenderedAmount) || 0) - total);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 16px', minHeight: '100%', background: 'var(--bg-base)', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 540 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <button onClick={onBackToCart} style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Checkout Order Summary</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Review items and confirm payment clearance</p>
          </div>
        </div>

        {/* Items */}
        <div style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', marginBottom: 16, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={18} color="var(--accent)" />
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>Prescription & OTC Items ({items.length})</span>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Unit Pricing</span>
          </div>
          <div style={{ padding: '6px 0' }}>
            {items.map((item, i) => (
              <div key={item.product_id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 20px',
                borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {item.name}
                    {item.requires_prescription && <span style={{ marginLeft: 6, fontSize: 10, background: 'var(--warning)20', color: 'var(--warning)', padding: '1px 5px', borderRadius: 4 }}>Rx</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.quantity} × KES {item.selling_price.toFixed(2)}</div>
                </div>
                <span className="mono" style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>KES {(item.selling_price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals & Tender */}
        <div style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', padding: '20px', marginBottom: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Subtotal</span>
            <span className="mono" style={{ fontSize: 13, color: 'var(--text-primary)' }}>KES {subtotal.toFixed(2)}</span>
          </div>
          {discountAmt > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--warning)' }}>Discount Applied</span>
              <span className="mono" style={{ fontSize: 13, color: 'var(--warning)' }}>- KES {discountAmt.toFixed(2)}</span>
            </div>
          )}
          <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: paymentMethod === 'cash' && tenderedAmount ? 12 : 0 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Net Total Payable</span>
            <span className="mono" style={{ fontSize: 26, fontWeight: 900, color: 'var(--accent)' }}>KES {total.toFixed(2)}</span>
          </div>

          {paymentMethod === 'cash' && parseFloat(tenderedAmount) > 0 && (
            <div style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)', marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                <span>Cash Received</span>
                <span className="mono">KES {parseFloat(tenderedAmount).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>
                <span>Balance / Change Due</span>
                <span className="mono">KES {changeAmt.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Payment Method Details */}
        <div style={{ background: 'var(--bg-surface)', borderRadius: 16, border: `1px solid ${pmColors[paymentMethod]}50`, padding: '18px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: `${pmColors[paymentMethod]}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <PmIcon size={22} color={pmColors[paymentMethod]} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>SELECTED SETTLEMENT METHOD</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: pmColors[paymentMethod], textTransform: 'uppercase', letterSpacing: '0.5px' }}>{paymentMethod}</div>
            </div>
          </div>

          {paymentMethod === 'mpesa' && (
            <div style={{ marginTop: 16 }}>
              <div style={{ height: 1, background: 'var(--border)', marginBottom: 14 }} />
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>
                M-Pesa Transaction Ref Code <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                value={mpesaCode}
                onChange={e => setMpesaCode(e.target.value.toUpperCase())}
                placeholder="e.g. QAB1234XYZ"
                maxLength={20}
                style={{
                  width: '100%', padding: '12px 16px',
                  background: 'var(--bg-elevated)', border: `2px solid ${mpesaCode ? 'var(--info)' : 'var(--border)'}`,
                  borderRadius: 12, color: 'var(--text-primary)', fontSize: 16,
                  outline: 'none', fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 800, letterSpacing: 1.5,
                  boxSizing: 'border-box'
                }}
              />
              {!mpesaCode ? (
                <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={14} /> Enter M-Pesa confirmation code from customer handset
                </div>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--info)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                  <CheckCircle size={14} /> Code validated — will display on printed receipt
                </div>
              )}
            </div>
          )}
        </div>

        {/* Confirm Action */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onBackToCart} style={{
            flex: 1, padding: 16, background: 'var(--bg-surface)',
            border: '1px solid var(--border)', borderRadius: 12,
            color: 'var(--text-primary)', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
            <ArrowLeft size={16} /> Back
          </button>
          <button
            onClick={onConfirm}
            disabled={processing || (paymentMethod === 'mpesa' && !mpesaCode.trim())}
            style={{
              flex: 2, padding: 16, background: 'var(--accent)',
              border: 'none', borderRadius: 12, color: '#0F1612',
              fontSize: 15, fontWeight: 800,
              cursor: (processing || (paymentMethod === 'mpesa' && !mpesaCode.trim())) ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 20px var(--accent)50',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: (processing || (paymentMethod === 'mpesa' && !mpesaCode.trim())) ? 0.6 : 1
            }}
          >
            {processing
              ? <><Loader size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> Processing Sale...</>
              : <><CheckCircle size={18} /> Confirm Payment (KES {total.toFixed(2)})</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Cart Panel ────────────────────────────────────────────────────────────
const CartPanel = ({
  items, paymentMethod, discountInput, setDiscountInput,
  discountAmt, subtotal, total, tenderedAmount, setTenderedAmount,
  onClearCart, onRemove, onDecrease, onIncrease, onPaymentMethod,
  onDiscountBlur, onPreview, diagnosisCode, setDiagnosisCode
}) => {
  const changeAmt = Math.max(0, (parseFloat(tenderedAmount) || 0) - total);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-surface)' }}>
      {/* Panel Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingCart size={18} color="var(--accent)" />
          </div>
          <div>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Terminal Cart</span>
            {items.length > 0 && <span style={{ marginLeft: 8, fontSize: 12, background: 'var(--accent)20', color: 'var(--accent)', padding: '2px 8px', borderRadius: 12, fontWeight: 800 }}>{items.length} items</span>}
          </div>
        </div>
        {items.length > 0 && (
          <button onClick={onClearCart} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Cart Items List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-faint)' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <ShoppingCart size={26} style={{ opacity: 0.4 }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>Cart is Empty</p>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>Search products or scan barcodes to begin a sale</p>
          </div>
        ) : items.map(item => (
          <CartItem key={item.product_id} item={item} onRemove={onRemove} onDecrease={onDecrease} onIncrease={onIncrease} />
        ))}
      </div>

      {/* Cart Controls & Tender */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>PAYMENT METHOD</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <PaymentButton id="cash" label="Cash" Icon={Banknote} selected={paymentMethod === 'cash'} onClick={onPaymentMethod} />
            <PaymentButton id="mpesa" label="M-Pesa" Icon={Smartphone} selected={paymentMethod === 'mpesa'} onClick={onPaymentMethod} />
            <PaymentButton id="card" label="Card" Icon={CreditCard} selected={paymentMethod === 'card'} onClick={onPaymentMethod} />
          </div>
        </div>

        {/* Cash Tender Calculation */}
        {paymentMethod === 'cash' && items.length > 0 && (
          <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>CASH TENDERED (KES)</label>
              {parseFloat(tenderedAmount) > 0 && (
                <span className="mono" style={{ fontSize: 12, fontWeight: 800, color: changeAmt >= 0 ? 'var(--accent)' : 'var(--danger)' }}>
                  Change: KES {changeAmt.toFixed(2)}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input
                type="text" inputMode="decimal"
                value={tenderedAmount}
                onChange={e => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) setTenderedAmount(val); }}
                placeholder={`e.g. ${Math.ceil(total / 100) * 100}`}
                style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}
              />
              <button onClick={() => setTenderedAmount(total.toString())} style={{ padding: '0 10px', background: 'var(--accent-soft)', border: '1px solid var(--accent)40', borderRadius: 8, color: 'var(--accent)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                Exact
              </button>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[100, 200, 500, 1000].map(amt => (
                <button key={amt} onClick={() => setTenderedAmount(amt.toString())} style={{ flex: 1, padding: '4px 0', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  +{amt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Diagnosis Code Search Optional */}
        <DiagnosisSearch value={diagnosisCode} onChange={setDiagnosisCode} />

        {/* Discount */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Discount (KES)</span>
          <input
            type="text" inputMode="decimal" value={discountInput}
            onChange={e => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) setDiscountInput(val); }}
            onBlur={onDiscountBlur} placeholder="0"
            style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}
          />
        </div>

        {/* Totals Summary */}
        <div style={{ marginBottom: 14, background: 'var(--bg-elevated)', padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Subtotal</span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 700 }}>KES {subtotal.toFixed(2)}</span>
          </div>
          {discountAmt > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--warning)' }}>Discount</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 700 }}>- KES {discountAmt.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border)', alignItems: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Total Due</span>
            <span className="mono" style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)' }}>KES {total.toFixed(2)}</span>
          </div>
        </div>

        {/* Preview Action Button */}
        <button onClick={onPreview} disabled={items.length === 0} style={{
          width: '100%', padding: 15,
          background: items.length === 0 ? 'var(--bg-elevated)' : 'var(--accent)',
          border: 'none', borderRadius: 12,
          color: items.length === 0 ? 'var(--text-faint)' : '#0F1612',
          fontSize: 15, fontWeight: 800,
          cursor: items.length === 0 ? 'not-allowed' : 'pointer',
          boxShadow: items.length > 0 ? '0 4px 16px var(--accent)40' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'all 0.2s'
        }}>
          <ClipboardList size={18} /> Checkout & Preview (KES {total.toFixed(2)})
        </button>
      </div>
    </div>
  );
};

// ── Sales History Panel ────────────────────────────────────────────────────────────
const HistoryPanel = ({ sales, loading, onReprint, onViewDetail, onRefresh }) => {
  const pmColors = { cash: 'var(--accent)', mpesa: 'var(--info)', card: 'var(--warning)' };
  return (
    <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Today's Sales Register Log</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Audit history for cleared pharmacy transactions</p>
        </div>
        <button onClick={onRefresh} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
          <RefreshCw size={14} color="var(--accent)" /> Refresh
        </button>
      </div>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Loader size={28} color="var(--accent)" style={{ animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : sales.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80, background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
          <History size={44} style={{ opacity: 0.2, marginBottom: 14 }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-muted)' }}>No Sales Recorded Today</p>
          <p style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 4 }}>Completed transactions will appear here</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sales.map(sale => (
            <div key={sale.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', transition: 'border-color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="mono" style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>{sale.receipt_number}</span>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 700, textTransform: 'uppercase', background: `${pmColors[sale.payment_method]}20`, color: pmColors[sale.payment_method] }}>
                      {sale.payment_method}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    {new Date(sale.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })} · Cashier: {sale.cashier_name || 'Staff'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)' }}>KES {parseFloat(sale.total).toLocaleString()}</div>
                  {sale.mpesa_code && <div style={{ fontSize: 11, color: 'var(--info)', fontWeight: 700, marginTop: 2 }}>M-Pesa: {sale.mpesa_code}</div>}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                {sale.items_summary || `${sale.item_count || '?'} item(s) dispensed`}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => onViewDetail(sale)} style={{ flex: 1, padding: '9px 0', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Eye size={14} /> View Items
                </button>
                <button onClick={() => onReprint(sale.id)} style={{ flex: 1, padding: '9px 0', background: 'var(--accent-soft)', border: '1px solid var(--accent)40', borderRadius: 8, color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Printer size={14} /> Print Receipt
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Sale Detail Modal ────────────────────────────────────────────────────────────
const SaleDetailModal = ({ sale, onClose, onReprint }) => {
  if (!sale) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--bg-surface)', borderRadius: 18, border: '1px solid var(--border)', padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{sale.receipt_number}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(sale.created_at).toLocaleString('en-KE')} · {sale.cashier_name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={20} /></button>
        </div>
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          {sale.items?.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < sale.items.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 13, color: 'var(--text-primary)' }}>
              <span>{item.product_name} ×{item.quantity}</span>
              <span className="mono" style={{ fontWeight: 700 }}>KES {parseFloat(item.total_price).toFixed(2)}</span>
            </div>
          ))}
          {parseFloat(sale.discount) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, color: 'var(--warning)' }}>
              <span>Discount</span>
              <span className="mono">- KES {parseFloat(sale.discount).toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, marginTop: 4, borderTop: '1px solid var(--border)', fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>
            <span>Total Paid</span>
            <span className="mono">KES {parseFloat(sale.total).toFixed(2)}</span>
          </div>
          {sale.mpesa_code && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--info)' }}>
              M-Pesa Ref: <strong>{sale.mpesa_code}</strong>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Close</button>
          <button onClick={() => { onReprint(sale.id); onClose(); }} style={{ flex: 1, padding: 13, background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#0F1612', cursor: 'pointer', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Printer size={16} /> Reprint Receipt
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function POSPage() {
  const dispatch = useDispatch();
  const { items, discount, paymentMethod } = useSelector(state => state.cart);
  const { user } = useSelector(state => state.auth);

  const [tab, setTab] = useState('pos'); // 'pos' | 'rx_queue' | 'history'
  const [screen, setScreen] = useState('pos'); // 'pos' | 'preview' | 'receipt'
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [products, setProducts] = useState([]);
  const [searching, setSearching] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [rxQueue, setRxQueue] = useState([]);
  const [selectedRx, setSelectedRx] = useState(null);
  const [rxPayment, setRxPayment] = useState(null);
  const [rxLoading, setRxLoading] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [discountInput, setDiscountInput] = useState('');
  const [mpesaCode, setMpesaCode] = useState('');
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [diagnosisCode, setDiagnosisCode] = useState(null);

  const [sales, setSales] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);

  const searchRef = useRef(null);

  const subtotal = items.reduce((sum, i) => sum + i.selling_price * i.quantity, 0);
  const discountAmt = parseFloat(discountInput) || 0;
  const total = Math.max(0, subtotal - discountAmt);

  const handleDiscountBlur = () => { dispatch(setDiscount(discountAmt)); };

  // Global keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await api.get(`/sales?start_date=${today}&end_date=${today}&limit=50`);
      setSales(res.data.data?.data || []);
    } catch { toast.error('Failed to load history'); }
    finally { setHistoryLoading(false); }
  }, []);

  const fetchRxQueue = useCallback(async () => {
    setRxLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await api.get(`/consultations/pharmacy-queue?date_from=${today}&date_to=${today}`);
      setRxQueue(res.data.data || []);
    } catch {}
    finally { setRxLoading(false); }
  }, []);

  useEffect(() => {
    fetchRxQueue();
    const interval = setInterval(fetchRxQueue, 20000);
    return () => clearInterval(interval);
  }, [fetchRxQueue]);

  useEffect(() => { if (tab === 'history') fetchHistory(); }, [tab, fetchHistory]);

  const handleReprint = useCallback(async (saleId) => {
    try {
      const res = await api.get(`/sales/${saleId}`);
      printReceipt(res.data.data, res.data.data.pharmacy || user?.pharmacy);
      toast.success('Receipt sent to printer');
    } catch { toast.error('Failed to reprint receipt'); }
  }, [user]);

  const handleViewDetail = useCallback(async (sale) => {
    try {
      const res = await api.get(`/sales/${sale.id}`);
      setSelectedSale(res.data.data);
    } catch { toast.error('Failed to load sale details'); }
  }, []);

  // Product Search Debounce
  useEffect(() => {
    if (!search.trim() && selectedCategory === 'all') {
      setProducts([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        let url = `/products?search=${encodeURIComponent(search)}`;
        if (selectedCategory === 'low_stock') {
          url += '&low_stock=true';
        }
        const res = await api.get(url);
        let list = res.data.data || [];

        // Apply visual category filters if needed
        if (selectedCategory !== 'all' && selectedCategory !== 'low_stock') {
          list = list.filter(p => {
            const cat = (p.category_name || '').toLowerCase();
            const name = (p.name || '').toLowerCase();
            if (selectedCategory === 'antibiotics') return cat.includes('antibiot') || name.includes('amox') || name.includes('cipro');
            if (selectedCategory === 'analgesics') return cat.includes('analges') || cat.includes('pain') || name.includes('para') || name.includes('ibu');
            if (selectedCategory === 'syrups') return cat.includes('syrup') || cat.includes('liquid') || name.includes('syrup');
            if (selectedCategory === 'injections') return cat.includes('inject') || cat.includes('iv') || p.requires_prescription;
            if (selectedCategory === 'otc') return !p.requires_prescription;
            return true;
          });
        }
        setProducts(list);
      } catch { toast.error('Search failed'); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, selectedCategory]);

  const handleSearchKey = useCallback(async (e) => {
    if (e.key === 'Enter' && search.trim()) {
      setSearching(true);
      try {
        const res = await api.get(`/products/barcode/${search.trim()}`);
        if (res.data.data) {
          handleAddToCart(res.data.data);
          setSearch('');
          setProducts([]);
        }
      } catch {}
      finally { setSearching(false); }
    }
  }, [search]);

  const handleAddToCart = useCallback((product) => {
    if (parseInt(product.total_stock) <= 0) {
      toast.error(`${product.name} is out of stock!`);
      return;
    }
    dispatch(addItem({
      product_id: product.id, name: product.name,
      generic_name: product.generic_name, unit: product.unit,
      selling_price: parseFloat(product.selling_price),
      total_stock: parseInt(product.total_stock),
      requires_prescription: product.requires_prescription,
    }));
    toast.success(`${product.name} added to cart`);
  }, [dispatch]);

  const handleRemove = useCallback((id) => { dispatch(removeItem(id)); }, [dispatch]);
  const handleDecrease = useCallback((id, qty) => { dispatch(updateQuantity({ product_id: id, quantity: qty - 1 })); }, [dispatch]);
  const handleIncrease = useCallback((id, qty, stock) => {
    if (qty >= stock) { toast.error('Stock limit reached for this item'); return; }
    dispatch(updateQuantity({ product_id: id, quantity: qty + 1 }));
  }, [dispatch]);

  const handlePreview = () => {
    if (items.length === 0) { toast.error('Cart is empty'); return; }
    dispatch(setDiscount(discountAmt));
    setMpesaCode('');
    setShowCart(false);
    setScreen('preview');
  };

  const handleConfirm = async () => {
    if (paymentMethod === 'mpesa' && !mpesaCode.trim()) {
      toast.error('Please enter the M-Pesa transaction code');
      return;
    }
    setProcessing(true);
    try {
      const res = await api.post('/sales', {
        items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
        payment_method: paymentMethod,
        discount: discountAmt,
        mpesa_code: mpesaCode.trim() || null,
        notes: mpesaCode ? `M-Pesa: ${mpesaCode}` : ''
      });
      const saleData = { ...res.data.data, mpesa_code: mpesaCode.trim() || null };
      setReceipt(saleData);
      dispatch(clearCart());
      setDiscountInput('');
      setMpesaCode('');
      setTenderedAmount('');
      setScreen('receipt');
      toast.success('Sale completed successfully!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Sale transaction failed');
    } finally { setProcessing(false); }
  };

  // Check payment for a Rx Queue visit
  const checkRxPayment = (visitId) => {
    api.get("/billing/visit/" + visitId)
      .then(res => {
        const itemsList = res.data?.data?.items || [];
        const pendingDrugs = itemsList.filter(i => i.item_type === 'drug' && i.status === 'pending');
        const drugBalance = pendingDrugs.reduce((acc, i) => acc + parseFloat(i.total_price || 0), 0);
        setRxPayment({
          paid: pendingDrugs.length === 0,
          balance: drugBalance,
          has_bill: itemsList.some(i => i.item_type === 'drug')
        });
      })
      .catch(() => setRxPayment({ paid: true, balance: 0 }));
  };

  const openRxModal = (rx) => {
    setSelectedRx(rx);
    checkRxPayment(rx.id);
  };

  const handleQuickPay = async (visitId) => {
    try {
      const billRes = await api.get(`/billing/visit/${visitId}`);
      const billData = billRes.data?.data;
      if (!billData || !billData.items || billData.items.length === 0) {
        toast.error('No bill items found for this prescription');
        return;
      }
      const pendingItems = billData.items.filter(item => item.status === 'pending' && item.item_type === 'drug');
      if (pendingItems.length === 0) {
        toast.success('Prescription drugs are already fully settled!');
        checkRxPayment(visitId);
        fetchRxQueue();
        return;
      }
      const itemIds = pendingItems.map(item => item.id);
      const totalAmount = pendingItems.reduce((acc, item) => acc + parseFloat(item.total_price || 0), 0);
      await api.post(`/billing/visit/${visitId}/pay`, {
        payment_method: 'cash',
        amount: String(totalAmount),
        reference_number: 'CSH-RX-POS-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        notes: 'Cleared directly at Pharmacy Counter Terminal.',
        item_ids: itemIds
      });
      toast.success(`🎉 Invoice of KES ${totalAmount.toLocaleString()} paid!`);
      checkRxPayment(visitId);
      fetchRxQueue();
    } catch {
      toast.error('Failed to clear bill from Pharmacy counter');
    }
  };

  // Receipt Screen
  if (screen === 'receipt' && receipt) {
    return (
      <div style={{ padding: 24, display: 'flex', justifyContent: 'center', minHeight: '100%', background: 'var(--bg-base)', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 20, border: '1px solid var(--border)', padding: 32, textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ width: 68, height: 68, background: 'var(--accent-soft)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '2px solid var(--accent)' }}>
              <CheckCircle size={36} color="var(--accent)" />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Sale Completed!</h2>
            <p className="mono" style={{ color: 'var(--accent)', fontSize: 14, marginTop: 4, fontWeight: 800 }}>{receipt.receipt_number}</p>
            
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 14, padding: 20, margin: '20px 0', textAlign: 'left', border: '1px solid var(--border)' }}>
              {receipt.items?.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text-primary)' }}>
                  <span>{item.product_name} ×{item.quantity}</span>
                  <span className="mono" style={{ fontWeight: 700 }}>KES {parseFloat(item.total_price).toFixed(2)}</span>
                </div>
              ))}
              {parseFloat(receipt.discount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 13, color: 'var(--warning)' }}>
                  <span>Discount</span>
                  <span className="mono">- KES {parseFloat(receipt.discount).toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, fontSize: 18, fontWeight: 900, color: 'var(--accent)' }}>
                <span>Total Settled</span>
                <span className="mono">KES {parseFloat(receipt.total).toFixed(2)}</span>
              </div>
            </div>

            <div style={{ marginBottom: receipt.mpesa_code ? 8 : 20, padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>Payment Method</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 800, textTransform: 'uppercase' }}>{receipt.payment_method}</span>
            </div>

            {receipt.mpesa_code && (
              <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>M-Pesa Reference</span>
                <span className="mono" style={{ color: 'var(--info)', fontWeight: 800 }}>{receipt.mpesa_code}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => printReceipt(receipt, receipt.pharmacy || user?.pharmacy)} style={{ flex: 1, padding: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Printer size={16} /> Print Receipt
              </button>
              <button onClick={() => { setReceipt(null); setScreen('pos'); setTab('history'); fetchHistory(); }} style={{ flex: 1, padding: 14, background: 'var(--accent)', border: 'none', borderRadius: 12, color: '#0F1612', cursor: 'pointer', fontSize: 14, fontWeight: 800 }}>
                Start New Sale
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Preview Screen Mode
  if (screen === 'preview') {
    return (
      <PreviewScreen
        items={items} subtotal={subtotal} discountAmt={discountAmt}
        total={total} paymentMethod={paymentMethod}
        mpesaCode={mpesaCode} setMpesaCode={setMpesaCode}
        tenderedAmount={tenderedAmount}
        processing={processing}
        onBackToCart={() => setScreen('pos')}
        onConfirm={handleConfirm}
      />
    );
  }

  const cartPanel = (
    <CartPanel
      items={items} paymentMethod={paymentMethod}
      discountInput={discountInput} setDiscountInput={setDiscountInput}
      discountAmt={discountAmt} subtotal={subtotal} total={total}
      tenderedAmount={tenderedAmount} setTenderedAmount={setTenderedAmount}
      onClearCart={() => dispatch(clearCart())}
      onRemove={handleRemove} onDecrease={handleDecrease} onIncrease={handleIncrease}
      onPaymentMethod={(id) => dispatch(setPaymentMethod(id))}
      onDiscountBlur={handleDiscountBlur} onPreview={handlePreview}
      diagnosisCode={diagnosisCode} setDiagnosisCode={setDiagnosisCode}
    />
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      {/* Executive Header & Navigation Bar */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', padding: '12px 20px 0 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--accent)40' }}>
              <Pill size={22} color="var(--accent)" />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.3px', margin: 0 }}>Pharmacy POS & Dispense Terminal</h1>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Counter dispensing, stock search & billing clearance</p>
            </div>
          </div>

          {/* Quick Metrics KPI Cards */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Rx Queue</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: rxQueue.length > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>{rxQueue.length} Waiting</div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--info)' }} />
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Cart Items</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{items.length} Selected</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { id: 'pos', label: 'Point of Sale Catalog', icon: ShoppingCart },
            { id: 'rx_queue', label: `Doctor Prescriptions Queue (${rxQueue.length})`, icon: Pill, badge: rxQueue.length },
            { id: 'history', label: 'Sales History Log', icon: History },
          ].map(({ id, label, icon: Icon, badge }) => (
            <button key={id} onClick={() => setTab(id)} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 18px', background: 'none', border: 'none',
              borderBottom: tab === id ? '3px solid var(--accent)' : '3px solid transparent',
              color: tab === id ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer', fontSize: 13, fontWeight: tab === id ? 800 : 600,
              transition: 'all 0.2s ease', position: 'relative'
            }}>
              <Icon size={16} />{label}
              {badge > 0 && id !== tab && (
                <span style={{ background: 'var(--warning)', color: '#000', borderRadius: 10, fontSize: 10, fontWeight: 800, padding: '1px 6px' }}>{badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* TAB 1: POINT OF SALE */}
        {tab === 'pos' && (
          <>
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }} className="pos-search-panel">
              {/* Search Header */}
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  {searching ? <Loader size={18} color="var(--accent)" style={{ animation: 'spin 0.8s linear infinite' }} /> : <Search size={18} color="var(--text-muted)" />}
                </div>
                <input
                  ref={searchRef}
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={handleSearchKey}
                  placeholder="Search drug by brand name, generic formulation, or scan barcode... (Press / to focus)"
                  style={{
                    width: '100%', padding: '14px 48px',
                    background: 'var(--bg-surface)', border: '1px solid var(--border)',
                    borderRadius: 14, color: 'var(--text-primary)', fontSize: 15,
                    outline: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {search && (
                    <button onClick={() => { setSearch(''); setProducts([]); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <X size={16} />
                    </button>
                  )}
                  <Barcode size={20} color="var(--text-muted)" />
                </div>
              </div>

              {/* Category Filter Pills */}
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 16, scrollbarWidth: 'none' }}>
                {CATEGORY_PILLS.map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => setSelectedCategory(id)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 20,
                    border: selectedCategory === id ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: selectedCategory === id ? 'var(--accent-soft)' : 'var(--bg-surface)',
                    color: selectedCategory === id ? 'var(--accent)' : 'var(--text-muted)',
                    cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                    transition: 'all 0.2s'
                  }}>
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>

              {/* Product Catalog Grid */}
              {products.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                  {products.map(product => {
                    const inStock = parseInt(product.total_stock) > 0;
                    const lowStock = parseInt(product.total_stock) <= 10 && inStock;
                    const cartItem = items.find(i => i.product_id === product.id);

                    return (
                      <div key={product.id} onClick={() => handleAddToCart(product)}
                        style={{
                          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14,
                          padding: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.borderColor = 'var(--accent)';
                          e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.1)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}>
                        
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                              {product.name}
                            </div>
                            {product.requires_prescription && (
                              <span style={{ fontSize: 10, background: 'var(--warning)20', color: 'var(--warning)', padding: '2px 6px', borderRadius: 4, fontWeight: 800, flexShrink: 0 }}>Rx</span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                            {product.generic_name || 'Standard formulation'} {product.category_name ? `• ${product.category_name}` : ''}
                          </div>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                            <div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Unit Price</div>
                              <div className="mono" style={{ fontSize: 16, fontWeight: 900, color: 'var(--accent)' }}>
                                KES {parseFloat(product.selling_price).toFixed(2)}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{
                                fontSize: 10, padding: '3px 8px', borderRadius: 12, fontWeight: 800,
                                background: !inStock ? 'var(--danger)20' : lowStock ? 'var(--warning)20' : 'var(--accent)15',
                                color: !inStock ? 'var(--danger)' : lowStock ? 'var(--warning)' : 'var(--accent)'
                              }}>
                                {!inStock ? 'Out of Stock' : lowStock ? `Low: ${product.total_stock}` : `${product.total_stock} in stock`}
                              </span>
                            </div>
                          </div>

                          {cartItem && (
                            <div style={{ marginTop: 10, padding: '4px 8px', background: 'var(--accent-soft)', border: '1px solid var(--accent)30', borderRadius: 8, fontSize: 11, fontWeight: 800, color: 'var(--accent)', textAlign: 'center' }}>
                              ✓ {cartItem.quantity} in cart
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : search && !searching ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
                  <Search size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>No matching drugs found for "{search}"</p>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Check spelling or try searching by generic name</p>
                </div>
              ) : !search ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
                  <Pill size={40} style={{ color: 'var(--accent)', opacity: 0.4, marginBottom: 14 }} />
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Ready for Product Lookup</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 420, margin: '6px auto 0' }}>Type a medication name or select a category pill above to display inventory items.</p>
                </div>
              ) : null}
            </div>

            {/* Desktop Cart Sidebar Panel */}
            <div style={{ width: 380, flexShrink: 0, borderLeft: '1px solid var(--border)' }} className="desktop-cart">
              {cartPanel}
            </div>

            {/* Mobile Cart Bottom Sheet */}
            {showCart && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
                <div onClick={() => setShowCart(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '90vh', borderRadius: '24px 24px 0 0', overflow: 'hidden', boxShadow: '0 -10px 30px rgba(0,0,0,0.3)' }}>
                  <button onClick={() => setShowCart(false)} style={{ position: 'absolute', top: 12, right: 16, zIndex: 10, background: 'var(--bg-elevated)', border: 'none', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={18} />
                  </button>
                  {cartPanel}
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 2: DOCTOR PRESCRIPTION QUEUE */}
        {tab === 'rx_queue' && (
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Doctor Prescriptions Dispense Queue</h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Electronic prescriptions sent from doctor consultation rooms</p>
              </div>
              <button onClick={fetchRxQueue} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                <RefreshCw size={14} color="var(--accent)" /> Refresh Queue
              </button>
            </div>

            {rxLoading ? (
              <div style={{ textAlign: 'center', padding: 80 }}><Loader size={32} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--accent)' }}/></div>
            ) : rxQueue.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <Pill size={28} color="var(--accent)" />
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>No Pending Prescriptions</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Prescriptions dispatched by doctors will automatically appear here</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {rxQueue.map(rx => (
                  <div key={rx.id} onClick={() => openRxModal(rx)}
                    style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', padding: 20, cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{rx.patient_name}</span>
                          <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 6 }}>{rx.patient_number}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Dr. {rx.doctor_name || 'Consultant Doctor'} • Gender: {rx.gender || '—'}</div>
                        {rx.diagnosis && <div style={{ fontSize: 13, color: 'var(--accent)', marginTop: 4, fontWeight: 700 }}>Diagnosis: {rx.diagnosis}</div>}
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, background: 'var(--accent)20', color: 'var(--accent)', fontWeight: 800 }}>PRESCRIPTION READY</span>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{new Date(rx.visit_date || Date.now()).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </div>

                    {rx.allergies && (
                      <div style={{ padding: '8px 12px', background: 'var(--danger)15', borderRadius: 8, fontSize: 12, color: 'var(--danger)', marginBottom: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ShieldAlert size={16} /> Patient Allergies: {rx.allergies}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(rx.prescriptions || []).slice(0, 4).map((p, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 10, fontSize: 13 }}>
                          <div>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.drug_name}</span>
                            {p.dosage && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{p.dosage} • {p.frequency} • {p.duration}</span>}
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 800 }}>Qty: {p.quantity || 1}</span>
                        </div>
                      ))}
                      {(rx.prescriptions || []).length > 4 && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', fontWeight: 600 }}>+{rx.prescriptions.length - 4} more drug items</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SALES HISTORY */}
        {tab === 'history' && (
          <HistoryPanel sales={sales} loading={historyLoading} onReprint={handleReprint} onViewDetail={handleViewDetail} onRefresh={fetchHistory} />
        )}
      </div>

      {/* Floating Action Mobile Cart Trigger */}
      {tab === 'pos' && (
        <button onClick={() => setShowCart(true)} className="mobile-cart-fab"
          style={{ display: 'none', position: 'fixed', bottom: 80, right: 20, zIndex: 30, width: 60, height: 60, borderRadius: '50%', background: 'var(--accent)', border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px var(--accent)60', alignItems: 'center', justifyContent: 'center' }}>
          <ShoppingCart size={24} color="#0F1612" />
          {items.length > 0 && (
            <span style={{ position: 'absolute', top: -4, right: -4, background: 'var(--danger)', color: 'white', borderRadius: '50%', fontSize: 11, fontWeight: 800, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg-base)' }}>
              {items.length}
            </span>
          )}
        </button>
      )}

      {selectedSale && <SaleDetailModal sale={selectedSale} onClose={() => setSelectedSale(null)} onReprint={handleReprint} />}

      {/* Prescription Dispense Modal */}
      {selectedRx && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 20, border: '1px solid var(--border)', width: '100%', maxWidth: 620, maxHeight: '90vh', overflow: 'auto', padding: 28, boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>
                  💊 {selectedRx.patient_name}
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  MRN: {selectedRx.patient_number} • Dr. {selectedRx.doctor_name}
                </p>
                {selectedRx.diagnosis && <p style={{ fontSize: 13, color: 'var(--accent)', marginTop: 4, fontWeight: 700 }}>Diagnosis: {selectedRx.diagnosis}</p>}
              </div>
              <button onClick={() => { setSelectedRx(null); setRxPayment(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}><X size={22}/></button>
            </div>

            {selectedRx.allergies && (
              <div style={{ padding: '10px 14px', background: 'var(--danger)15', borderRadius: 10, marginBottom: 18, fontSize: 12, color: 'var(--danger)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldAlert size={16} /> Allergies Warning: {selectedRx.allergies}
              </div>
            )}
            
            {/* Payment Status Bar */}
            {rxPayment && (
              <div style={{ padding: '14px 18px', borderRadius: 12, marginBottom: 20, background: rxPayment.paid ? 'var(--accent)15' : 'var(--danger)15', border: '1px solid ' + (rxPayment.paid ? 'var(--accent)' : 'var(--danger)') }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: rxPayment.paid ? 'var(--accent)' : 'var(--danger)', fontSize: 14 }}>
                      {rxPayment.paid ? '✅ BILLING CLEARED & PAID' : '❌ UNPAID PRESCRIPTION — KES ' + (rxPayment.balance || 0)}
                    </div>
                    {!rxPayment.paid && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Patient can pay at cashier or settle directly below:</div>}
                  </div>
                  {!rxPayment.paid && (
                    <button onClick={() => handleQuickPay(selectedRx.id)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#0F1612', fontWeight: 800, fontSize: 12, cursor: 'pointer', boxShadow: '0 2px 8px var(--accent)40' }}>
                      💳 Counter Instant Settlement
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Drug List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(selectedRx.prescriptions || []).map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, marginRight: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{p.drug_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      {p.dosage && <span>{p.dosage} • </span>}
                      {p.frequency && <span>{p.frequency} • </span>}
                      {p.duration && <span>{p.duration}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: ['IV','IM','SC'].includes(p.route) ? 'var(--danger)20' : 'var(--accent)15', color: ['IV','IM','SC'].includes(p.route) ? 'var(--danger)' : 'var(--accent)', fontWeight: 700 }}>{p.route || 'Oral'}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>Qty: {p.quantity || 1}</span>
                    <button onClick={async () => {
                      try {
                        await api.put('/pharmacy/dispense/' + p.id, { status: 'dispensed' });
                        toast.success('Dispensed: ' + p.drug_name);
                        if (['IV','IM','SC'].includes(p.route)) {
                          toast('Injectable route — prompt patient to Injection Room', { icon: '💉' });
                        }
                        setSelectedRx(null);
                        fetchRxQueue();
                      } catch { toast.error('Failed to dispense drug'); }
                    }} disabled={!rxPayment?.paid} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: rxPayment?.paid ? 'var(--accent)' : 'var(--bg-surface)', color: rxPayment?.paid ? '#0F1612' : 'var(--text-faint)', fontWeight: 800, cursor: rxPayment?.paid ? 'pointer' : 'not-allowed', fontSize: 13 }}>
                      Dispense
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => { setSelectedRx(null); setRxPayment(null); }}
              style={{ marginTop: 20, width: '100%', padding: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
              Close Modal
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .desktop-cart { display: none !important; }
          .mobile-cart-fab { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
