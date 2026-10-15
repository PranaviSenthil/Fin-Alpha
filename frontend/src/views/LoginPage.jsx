import React, { useState } from 'react';
import { api } from '../api/client';
import {
  TrendingUp,
  ShieldCheck,
  Lock,
  Mail,
  User,
  ArrowRight,
  Sparkles,
  Zap,
  BarChart2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';

export default function LoginPage({ onLoginSuccess, onExploreGuest }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [riskProfile, setRiskProfile] = useState('moderate');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await api.auth.login(email.trim(), password);
      if (res.access_token) {
        onLoginSuccess(res.user);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    try {
      const res = await api.auth.signup(email.trim(), password, fullName.trim());
      if (res.access_token) {
        onLoginSuccess(res.user);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to create account. Email may already be registered.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await api.auth.demoLogin();
      if (res.access_token) {
        onLoginSuccess(res.user);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to start demo session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 20%, #f1f5f9 0%, #e2e8f0 80%)',
        padding: '24px 16px',
        color: 'var(--text-primary)'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1040px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          borderRadius: 'var(--radius-xl)',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-focus)',
          boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.08), 0 0 30px rgba(5, 150, 105, 0.08)',
          overflow: 'hidden'
        }}
      >
        {/* Left Side: Brand & Feature Highlights */}
        <div
          style={{
            padding: '48px 40px',
            background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
            borderRight: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(5, 150, 105, 0.25)'
                }}
              >
                <TrendingUp size={24} color="#ffffff" strokeWidth={2.5} />
              </div>
              <div>
                <span
                  className="font-heading"
                  style={{
                    fontSize: '1.6rem',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    background: 'linear-gradient(90deg, #0f172a 40%, #059669 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                >
                  VibeFinance
                </span>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  INDIAN STOCK MARKET & AI INTELLIGENCE
                </div>
              </div>
            </div>

            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1.25, marginBottom: '14px' }}>
              Invest with Confidence. <br />
              <span style={{ color: 'var(--gain-color)' }}>Zero Financial Risk.</span>
            </h1>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '32px' }}>
              Explore 100 verified Indian stocks across 10 sectors, real-time paper trading with double-entry ledger,
              and AI SWOT company research inspired by Zerodha Kite and INDmoney.
            </p>

            {/* Feature List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                {
                  icon: BarChart2,
                  title: '100 Indian Stocks across 10 Sectors',
                  desc: 'Curated universe with real yfinance quotes and 5-min refresh cadence'
                },
                {
                  icon: Zap,
                  title: 'Real-Time Paper Trading & Deposit Engine',
                  desc: 'Add virtual funds, execute Market/Limit orders, track average cost'
                },
                {
                  icon: Sparkles,
                  title: 'AI Investment Intelligence',
                  desc: 'Macro market pulse, deep company SWOT analysis, and risk audits'
                }
              ].map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div
                      style={{
                        padding: '8px',
                        borderRadius: '8px',
                        background: 'rgba(59, 130, 246, 0.12)',
                        color: 'var(--accent-blue)',
                        marginTop: '2px'
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {f.title}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {f.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Security Note */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              paddingTop: '28px',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '0.75rem',
              color: 'var(--text-muted)'
            }}
          >
            <ShieldCheck size={16} style={{ color: 'var(--gain-color)' }} />
            <span>Isolated User Portfolios • Multi-User Database • Simulated INR Ledger</span>
          </div>
        </div>

        {/* Right Side: Auth Forms */}
        <div style={{ padding: '48px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {/* Mode Switcher Tabs */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-primary)',
              padding: '4px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '28px',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage('');
              }}
              style={{
                flex: 1,
                padding: '9px 16px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: mode === 'login' ? 'var(--bg-card)' : 'transparent',
                color: mode === 'login' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: mode === 'login' ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMessage('');
              }}
              style={{
                flex: 1,
                padding: '9px 16px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: mode === 'signup' ? 'var(--bg-card)' : 'transparent',
                color: mode === 'signup' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: mode === 'signup' ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              Create Account
            </button>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {mode === 'login' ? 'Welcome Back Trader' : 'Open Your Free Trading Account'}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {mode === 'login'
                ? 'Sign in to access your custom portfolio, orders, and watchlists.'
                : 'Sign up to create your isolated portfolio and add virtual funds.'}
            </p>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(235, 91, 60, 0.1)',
                border: '1px solid var(--loss-color)',
                color: 'var(--loss-color)',
                fontSize: '0.82rem',
                marginBottom: '20px'
              }}
            >
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={mode === 'login' ? handleLogin : handleSignup}>
            {mode === 'signup' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Full Name
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px'
                  }}
                >
                  <User size={16} style={{ color: 'var(--text-muted)', marginRight: '10px' }} />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pranav Sharma"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', width: '100%', fontSize: '0.88rem' }}
                  />
                </div>
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Email Address
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px'
                }}
              >
                <Mail size={16} style={{ color: 'var(--text-muted)', marginRight: '10px' }} />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', width: '100%', fontSize: '0.88rem' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Password
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px'
                }}
              >
                <Lock size={16} style={{ color: 'var(--text-muted)', marginRight: '10px' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder={mode === 'signup' ? 'Min 6 characters' : 'Enter password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', width: '100%', fontSize: '0.88rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 4px' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Risk Appetite Selection for Signup */}
            {mode === 'signup' && (
              <div style={{ marginBottom: '22px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Investment Risk Profile
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  {[
                    { id: 'conservative', label: 'Conservative' },
                    { id: 'moderate', label: 'Moderate' },
                    { id: 'aggressive', label: 'Aggressive' }
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setRiskProfile(r.id)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: riskProfile === r.id ? '1px solid var(--gain-color)' : '1px solid var(--border-subtle)',
                        background: riskProfile === r.id ? 'rgba(0, 208, 156, 0.12)' : 'var(--bg-primary)',
                        color: riskProfile === r.id ? 'var(--gain-color)' : 'var(--text-secondary)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, #00d09c 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.92rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(0, 208, 156, 0.35)',
                marginBottom: '18px'
              }}
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : mode === 'login' ? (
                <>
                  <span>Sign In to VibeFinance</span>
                  <ArrowRight size={16} />
                </>
              ) : (
                <>
                  <span>Create Account & Start Trading</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>OR</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
          </div>

          {/* Demo Trader 1-Click Button */}
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-focus)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background var(--transition-fast)',
              marginBottom: '16px'
            }}
          >
            <Zap size={16} style={{ color: 'var(--accent-blue)' }} />
            <span>Instant Demo Trader Login (₹10,00,000 Included)</span>
          </button>

          {/* Guest Explore link */}
          {onExploreGuest && (
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={onExploreGuest}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Explore market screener & indices as guest →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
