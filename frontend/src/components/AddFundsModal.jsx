import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import {
  Wallet,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Zap,
  Building2,
  CreditCard
} from 'lucide-react';

export default function AddFundsModal({ isOpen, onClose, currentBalance = 0, onFundsUpdated }) {
  const [activeTab, setActiveTab] = useState('deposit'); // 'deposit' | 'withdraw'
  const [amount, setAmount] = useState('50000');
  const [paymentMethod, setPaymentMethod] = useState('UPI (Google Pay / PhonePe)');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null); // { type: 'success'|'error', text }
  const [displayBalance, setDisplayBalance] = useState(currentBalance);

  useEffect(() => {
    setDisplayBalance(currentBalance);
  }, [currentBalance]);

  if (!isOpen) return null;

  const quickAmounts = [10000, 25000, 50000, 100000, 500000];

  const handleQuickSelect = (val) => {
    setAmount(String(val));
    setStatusMessage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!num || num <= 0) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid positive amount.' });
      return;
    }

    if (activeTab === 'withdraw' && num > (displayBalance || currentBalance)) {
      setStatusMessage({
        type: 'error',
        text: `Insufficient funds. Maximum withdrawable amount is ₹${(displayBalance || currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      if (activeTab === 'deposit') {
        const res = await api.trading.depositFunds(num, paymentMethod);
        const newBal = (res && typeof res.virtual_balance === 'number')
          ? res.virtual_balance
          : ((displayBalance || currentBalance) + num);

        // Immediately update modal balance display
        setDisplayBalance(newBal);

        // Immediately update global app balance and views
        if (onFundsUpdated) {
          onFundsUpdated(newBal);
        }

        setStatusMessage({
          type: 'success',
          text: res?.message || `Successfully added ₹${num.toLocaleString('en-IN')} to your trading buying power!`
        });

        setTimeout(() => {
          onClose();
        }, 750);
      } else {
        const res = await api.trading.withdrawFunds(num, paymentMethod);
        const newBal = (res && typeof res.virtual_balance === 'number')
          ? res.virtual_balance
          : Math.max(0, (displayBalance || currentBalance) - num);

        setDisplayBalance(newBal);

        if (onFundsUpdated) {
          onFundsUpdated(newBal);
        }

        setStatusMessage({
          type: 'success',
          text: res?.message || `Successfully withdrew ₹${num.toLocaleString('en-IN')} from your virtual cash.`
        });

        setTimeout(() => {
          onClose();
        }, 750);
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message || `Failed to process ${activeTab}.`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-focus)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '480px',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-xl)',
          animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-secondary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: activeTab === 'deposit' ? 'rgba(0, 208, 156, 0.15)' : 'rgba(235, 91, 60, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Wallet size={18} style={{ color: activeTab === 'deposit' ? 'var(--gain-color)' : 'var(--loss-color)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                {activeTab === 'deposit' ? 'Add Virtual Funds' : 'Withdraw Virtual Funds'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Zerodha Kite-inspired simulated paper trading funds
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Tabs: Deposit vs Withdraw */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
          <button
            onClick={() => {
              setActiveTab('deposit');
              setStatusMessage(null);
            }}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'deposit' ? '2px solid var(--gain-color)' : '2px solid transparent',
              color: activeTab === 'deposit' ? 'var(--gain-color)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'deposit' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <ArrowDownLeft size={16} />
            Deposit (Add Money)
          </button>
          <button
            onClick={() => {
              setActiveTab('withdraw');
              setStatusMessage(null);
            }}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'withdraw' ? '2px solid var(--loss-color)' : '2px solid transparent',
              color: activeTab === 'withdraw' ? 'var(--loss-color)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'withdraw' ? 700 : 500,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <ArrowUpRight size={16} />
            Withdraw Funds
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {/* Current Buying Power Summary */}
          <div
            style={{
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              marginBottom: '20px',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current Buying Power</div>
              <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                ₹{(displayBalance !== undefined ? displayBalance : currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <span className="badge bg-gain" style={{ fontSize: '0.72rem', padding: '4px 8px' }}>
              Instant Virtual Credit
            </span>
          </div>

          {/* Amount Input */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              {activeTab === 'deposit' ? 'Enter Deposit Amount (₹)' : 'Enter Withdrawal Amount (₹)'}
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 14px'
              }}
            >
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-muted)', marginRight: '8px' }}>₹</span>
              <input
                type="number"
                min="100"
                step="100"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setStatusMessage(null);
                }}
                placeholder="50,000"
                required
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>
          </div>

          {/* Quick Amount Chips */}
          {activeTab === 'deposit' && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Quick Selection:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {quickAmounts.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleQuickSelect(q)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-full)',
                      background: parseFloat(amount) === q ? 'var(--gain-color)' : 'var(--bg-secondary)',
                      color: parseFloat(amount) === q ? '#ffffff' : 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    + ₹{(q / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Simulated Payment Channel */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              {activeTab === 'deposit' ? 'Simulated Payment Mode' : 'Simulated Payout Mode'}
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { id: 'UPI (Google Pay / PhonePe)', label: 'UPI Instant (GPay / PhonePe / Paytm)', icon: Zap },
                { id: 'Net Banking (HDFC / ICICI / SBI)', label: 'Net Banking (HDFC / ICICI / SBI)', icon: Building2 },
                { id: 'Virtual IMPS Transfer', label: 'Instant Virtual IMPS / NEFT', icon: CreditCard },
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-primary)',
                      border: isSelected ? '1px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <Icon size={16} style={{ color: isSelected ? 'var(--accent-blue)' : 'var(--text-muted)' }} />
                    <span style={{ flex: 1, fontWeight: isSelected ? 600 : 400 }}>{m.label}</span>
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={isSelected}
                      onChange={() => setPaymentMethod(m.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status feedback message */}
          {statusMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                fontSize: '0.8rem',
                background: statusMessage.type === 'success' ? 'rgba(0, 208, 156, 0.1)' : 'rgba(235, 91, 60, 0.1)',
                border: `1px solid ${statusMessage.type === 'success' ? 'var(--gain-color)' : 'var(--loss-color)'}`,
                color: statusMessage.type === 'success' ? 'var(--gain-color)' : 'var(--loss-color)'
              }}
            >
              {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Action Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              background: activeTab === 'deposit'
                ? 'linear-gradient(135deg, #00d09c 0%, #059669 100%)'
                : 'linear-gradient(135deg, #eb5b3c 0%, #dc2626 100%)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: activeTab === 'deposit'
                ? '0 4px 15px rgba(0, 208, 156, 0.3)'
                : '0 4px 15px rgba(235, 91, 60, 0.3)',
              transition: 'all var(--transition-fast)'
            }}
          >
            {loading ? (
              <span>Simulating Transaction...</span>
            ) : activeTab === 'deposit' ? (
              <>
                <ArrowDownLeft size={18} />
                <span>Deposit ₹{parseFloat(amount || 0).toLocaleString('en-IN')} to Buying Power</span>
              </>
            ) : (
              <>
                <ArrowUpRight size={18} />
                <span>Withdraw ₹{parseFloat(amount || 0).toLocaleString('en-IN')}</span>
              </>
            )}
          </button>

          {/* Paper Trading Notice */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '16px',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              justifyContent: 'center'
            }}
          >
            <ShieldCheck size={14} style={{ color: 'var(--accent-blue)' }} />
            <span>Virtual Paper Trading simulation • No actual bank transactions occur</span>
          </div>
        </form>
      </div>
    </div>
  );
}
