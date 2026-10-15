import React, { useState } from 'react';
import { api } from '../api/client';
import { X, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';

export default function OrderModal({ stock, onClose, onOrderPlaced, availableCash = 1000000, onOpenAddFunds }) {
  const [side, setSide] = useState('BUY'); // 'BUY' | 'SELL'
  const [orderType, setOrderType] = useState('MARKET'); // 'MARKET' | 'LIMIT'
  const [quantity, setQuantity] = useState(1);
  const [limitPrice, setLimitPrice] = useState(stock.price || 100.0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const price = orderType === 'LIMIT' ? Number(limitPrice) : Number(stock.price || 0);
  const grossValue = Math.round(quantity * price * 100) / 100;
  const brokerageFee = Math.round(grossValue * 0.0005 * 100) / 100; // 0.05%
  const totalImpact = side === 'BUY' ? grossValue + brokerageFee : grossValue - brokerageFee;

  const handleQuickQty = (delta) => {
    setQuantity((prev) => Math.max(1, prev + delta));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      const payload = {
        symbol: stock.symbol,
        side,
        order_type: orderType,
        quantity: Number(quantity),
        limit_price: orderType === 'LIMIT' ? Number(limitPrice) : null,
      };

      const res = await api.trading.placeOrder(payload);
      if (res.success) {
        setSuccessMsg(res.message || 'Simulated order executed successfully!');
        if (onOrderPlaced) onOrderPlaced(res.order);
        setTimeout(() => {
          onClose();
        }, 1400);
      } else {
        setError(res.error || 'Failed to place order');
      }
    } catch (err) {
      setError(err.message || 'Error communicating with trading engine');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{stock.symbol}</h2>
              <span className="badge badge-outline">{stock.exchange || 'NSE'}</span>
              <span className="badge bg-gain" style={{ fontSize: '0.7rem' }}>Simulated Order</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{stock.name}</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Side Toggle */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
            <button
              type="button"
              className="btn"
              onClick={() => setSide('BUY')}
              style={{
                background: side === 'BUY' ? 'var(--gain-color)' : 'transparent',
                color: side === 'BUY' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 700,
              }}
            >
              BUY
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setSide('SELL')}
              style={{
                background: side === 'SELL' ? 'var(--loss-color)' : 'transparent',
                color: side === 'SELL' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 700,
              }}
            >
              SELL
            </button>
          </div>

          {/* Order Type Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Order Type</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className={`btn btn-secondary ${orderType === 'MARKET' ? 'badge-fresh' : ''}`}
                style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                onClick={() => setOrderType('MARKET')}
              >
                Market
              </button>
              <button
                type="button"
                className={`btn btn-secondary ${orderType === 'LIMIT' ? 'badge-fresh' : ''}`}
                style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                onClick={() => setOrderType('LIMIT')}
              >
                Limit
              </button>
            </div>
          </div>

          {/* Quantity Controls */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Quantity (Shares)</label>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Lot size: 1</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="input-field font-mono"
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              {[1, 5, 10, 50, 100].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setQuantity(num)}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '2px 4px', fontSize: '0.75rem' }}
                >
                  +{num}
                </button>
              ))}
            </div>
          </div>

          {/* Limit Price Input if LIMIT */}
          {orderType === 'LIMIT' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Limit Price (₹)
              </label>
              <input
                type="number"
                step="0.05"
                min="0.05"
                value={limitPrice}
                onChange={(e) => setLimitPrice(parseFloat(e.target.value) || 0)}
                className="input-field font-mono"
                required
              />
            </div>
          )}

          {/* Order Summary Box */}
          <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Execution Price:</span>
              <span className="font-mono" style={{ fontWeight: 600 }}>₹{price.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Gross Value:</span>
              <span className="font-mono">₹{grossValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Est. Brokerage (0.05%):</span>
              <span className="font-mono" style={{ color: 'var(--text-muted)' }}>₹{brokerageFee.toFixed(2)}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>{side === 'BUY' ? 'Total Required Funds:' : 'Net Proceeds:'}</span>
              <span className="font-mono" style={{ color: side === 'BUY' ? 'var(--gain-color)' : 'var(--text-primary)' }}>
                ₹{totalImpact.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span>Available Virtual Balance:</span>
              <span className="font-mono">₹{availableCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Error / Success alerts */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'var(--loss-bg)', border: '1px solid var(--loss-border)', borderRadius: 'var(--radius-sm)', color: 'var(--loss-color)', fontSize: '0.82rem' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'var(--gain-bg)', border: '1px solid var(--gain-border)', borderRadius: 'var(--radius-sm)', color: 'var(--gain-color)', fontSize: '0.82rem' }}>
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Insufficient funds helper shortcut */}
          {side === 'BUY' && totalImpact > availableCash && onOpenAddFunds && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(0, 208, 156, 0.1)', border: '1px solid var(--gain-color)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Need more virtual funds?</span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAddFunds();
                }}
                style={{
                  background: 'var(--gain-color)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '3px 8px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                + Add Money Now
              </button>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className={`btn ${side === 'BUY' ? 'btn-buy' : 'btn-sell'}`}
            style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
          >
            {submitting ? 'Executing Simulated Trade...' : `${side} ${quantity} ${stock.symbol}`}
          </button>

          {/* Disclaimer */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <ShieldAlert size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              Simulated paper trade. No real money or exchange broker accounts are touched. Quotes sourced via development yfinance adapter.
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
