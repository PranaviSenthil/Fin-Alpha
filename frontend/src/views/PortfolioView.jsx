import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  PieChart,
  RotateCcw,
  PlusCircle,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  List,
  Layers,
  ArrowRight
} from 'lucide-react';
import AISidePanel from '../components/AISidePanel';

export default function PortfolioView({
  onSelectStock,
  onOpenOrder,
  onResetBalance,
  onOpenAddFunds,
  virtualBalance,
  onFundsUpdated
}) {
  const [activeSubTab, setActiveSubTab] = useState('holdings'); // 'holdings' | 'agent'
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [portfolioData, setPortfolioData] = useState(null);
  const [allocationData, setAllocationData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Portfolio Analysis Agent state
  const [agentData, setAgentData] = useState(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState(null);

  const loadPortfolio = () => {
    Promise.all([
      api.portfolio.summary(),
      api.portfolio.allocation(),
    ])
      .then(([summary, alloc]) => {
        setPortfolioData(summary);
        setAllocationData(alloc);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load portfolio:', err);
        setLoading(false);
      });
  };

  const fetchAgentAudit = async () => {
    setAgentLoading(true);
    setAgentError(null);
    try {
      const res = await api.ai.portfolioAgent();
      setAgentData(res);
    } catch (err) {
      console.error('Failed to load portfolio analysis agent:', err);
      setAgentError(err.message || 'Failed to generate portfolio risk diagnostics.');
    } finally {
      setAgentLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolio();
  }, [virtualBalance]);

  useEffect(() => {
    if (activeSubTab === 'agent' && !agentData) {
      fetchAgentAudit();
    }
  }, [activeSubTab]);

  const summary = portfolioData?.summary || {};
  const holdings = portfolioData?.holdings || [];
  const sectorAlloc = allocationData?.sector_allocation || [];

  const effectiveCash = (virtualBalance !== undefined && virtualBalance !== null)
    ? Number(virtualBalance)
    : Number(summary.available_cash ?? 1000000);

  const marketVal = Number(summary.total_market_value || 0);
  const totalWealth = marketVal + effectiveCash;

  const isUnrealizedUp = (summary.unrealized_pnl || 0) >= 0;
  const isOverallUp = (summary.total_pnl || 0) >= 0;

  const agentSupporting = agentData?.supporting_data || {};
  const agentWarnings = agentData?.warnings || [];
  const agentScenarios = agentData?.scenarios || [];
  const agentSources = agentData?.sources || [];
  const rebalancingSuggestions = agentSupporting.rebalancing_suggestions || [];

  return (
    <div className="section-layout-wrapper" style={{ paddingBottom: '40px' }}>
      {/* Left Column: Portfolio Content */}
      <div className="section-main-column">
        {/* Portfolio Header Bar */}
      <div
        className="glass-card"
        style={{
          padding: '20px',
          background: 'var(--banner-bg)',
          border: '1px solid var(--banner-border)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Briefcase size={22} style={{ color: 'var(--accent-blue)' }} /> Portfolio & Risk Intelligence
              </h2>
              <span className="badge badge-outline" style={{ borderColor: 'rgba(59, 130, 246, 0.5)', color: 'var(--accent-blue)' }}>
                Portfolio Hub
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Real holdings ledger, weighted cost tracking, and integrated Portfolio Analysis Agent
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Sub-tab Toggle */}
            <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
              <button
                onClick={() => setActiveSubTab('holdings')}
                className={`btn btn-secondary ${activeSubTab === 'holdings' ? 'badge-fresh' : ''}`}
                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
              >
                <List size={14} /> Holdings & Allocation
              </button>
              <button
                onClick={() => {
                  setActiveSubTab('agent');
                  if (!agentData) fetchAgentAudit();
                }}
                className={`btn btn-secondary ${activeSubTab === 'agent' ? 'badge-fresh' : ''}`}
                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
              >
                <Sparkles size={14} /> Portfolio Analysis Agent
              </button>
            </div>

            {onOpenAddFunds && (
              <button
                onClick={onOpenAddFunds}
                style={{
                  background: 'linear-gradient(135deg, #00d09c 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(0, 208, 156, 0.3)'
                }}
              >
                <PlusCircle size={14} /> Add Virtual Funds
              </button>
            )}

            {onResetBalance && (
              <button
                onClick={() => {
                  if (confirm('Reset your portfolio holdings and cash balance back to ₹10,00,000?')) {
                    onResetBalance();
                    setTimeout(() => {
                      loadPortfolio();
                      if (activeSubTab === 'agent') fetchAgentAudit();
                    }, 500);
                  }
                }}
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem' }}
              >
                <RotateCcw size={14} /> Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* --- SUBTAB 1: HOLDINGS & ALLOCATION --- */}
      {activeSubTab === 'holdings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Metrics Summary Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div className="glass-card" style={{ padding: '16px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL WEALTH</span>
              <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px' }}>
                ₹{totalWealth.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Invested + Virtual Cash</span>
            </div>

            <div className="glass-card" style={{ padding: '16px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>CURRENT VALUE</span>
              <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px' }}>
                ₹{summary.total_market_value ? summary.total_market_value.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Invested: ₹{summary.total_invested ? summary.total_invested.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</span>
            </div>

            <div className="glass-card" style={{ padding: '16px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>AVAILABLE CASH</span>
              <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px', color: 'var(--gain-color)' }}>
                ₹{effectiveCash.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Simulated virtual funds</span>
            </div>

            <div className="glass-card" style={{ padding: '16px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>UNREALIZED P&L</span>
              <div className={`font-mono ${isUnrealizedUp ? 'text-gain' : 'text-loss'}`} style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px' }}>
                {isUnrealizedUp ? '+' : ''}₹{summary.unrealized_pnl ? summary.unrealized_pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Realized: ₹{summary.realized_pnl || 0}</span>
            </div>

            <div className="glass-card" style={{ padding: '16px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL P&L (%)</span>
              <div className={`font-mono ${isOverallUp ? 'text-gain' : 'text-loss'}`} style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px' }}>
                {isOverallUp ? '+' : ''}{summary.total_pnl_pct || 0}%
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Overall return on invested</span>
            </div>
          </div>

          {/* Sector Allocation Breakdown */}
          {sectorAlloc.length > 0 && (
            <div className="glass-card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PieChart size={16} style={{ color: 'var(--accent-blue)' }} /> Portfolio Asset & Sector Allocation
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>By Total Portfolio Wealth</span>
              </div>

              {/* Allocation Progress Bar */}
              <div style={{ display: 'flex', width: '100%', height: '14px', borderRadius: 'var(--radius-full)', overflow: 'hidden', background: 'var(--bg-secondary)', marginBottom: '14px' }}>
                {sectorAlloc.map((item, idx) => {
                  const colors = ['#3b82f6', '#00d09c', '#ec4899', '#f59e0b', '#8b5cf6', '#06b6d4', '#e2e8f0'];
                  return (
                    <div
                      key={item.sector}
                      style={{
                        width: `${item.weight_pct}%`,
                        background: colors[idx % colors.length],
                        transition: 'width 0.3s'
                      }}
                      title={`${item.sector}: ${item.weight_pct}% (₹${item.value})`}
                    />
                  );
                })}
              </div>

              {/* Allocation Legend */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                {sectorAlloc.map((item, idx) => {
                  const colors = ['#3b82f6', '#00d09c', '#ec4899', '#f59e0b', '#8b5cf6', '#06b6d4', '#e2e8f0'];
                  return (
                    <div key={item.sector} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors[idx % colors.length] }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{item.sector}:</span>
                      <span className="font-mono" style={{ fontWeight: 600 }}>{item.weight_pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Holdings Table */}
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Active Stock Holdings</h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{holdings.length} position(s) active</span>
              </div>
            </div>

            {holdings.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Briefcase size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  No active holdings
                </h4>
                <p style={{ fontSize: '0.82rem' }}>
                  Browse the 100-Stock Universe and place a simulated buy order to begin tracking positions.
                </p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Instrument</th>
                      <th>Quantity</th>
                      <th style={{ textAlign: 'right' }}>Avg. Cost (₹)</th>
                      <th style={{ textAlign: 'right' }}>Latest Price (₹)</th>
                      <th style={{ textAlign: 'right' }}>Invested (₹)</th>
                      <th style={{ textAlign: 'right' }}>Market Value (₹)</th>
                      <th style={{ textAlign: 'right' }}>Unrealized P&L</th>
                      <th style={{ textAlign: 'right' }}>Weight %</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((h) => {
                      const isUp = (h.unrealized_pnl || 0) >= 0;
                      return (
                        <tr
                          key={h.symbol}
                          onClick={() => onSelectStock && onSelectStock(h.symbol)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <strong style={{ fontSize: '0.9rem' }}>{h.symbol}</strong>
                                <span className="badge badge-outline" style={{ fontSize: '0.62rem' }}>{h.exchange || 'NSE'}</span>
                              </div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{h.name}</span>
                            </div>
                          </td>
                          <td className="font-mono" style={{ fontWeight: 600 }}>{h.quantity}</td>
                          <td style={{ textAlign: 'right' }} className="font-mono">₹{h.average_price?.toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }} className="font-mono">₹{h.current_price?.toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }} className="font-mono">₹{h.invested_value?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }} className="font-mono">
                            ₹{h.market_value?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span className={`badge ${isUp ? 'bg-gain' : 'bg-loss'}`} style={{ fontSize: '0.78rem' }}>
                              {isUp ? '+' : ''}₹{h.unrealized_pnl?.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({isUp ? '+' : ''}{h.unrealized_pnl_pct}%)
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)' }} className="font-mono">
                            {h.portfolio_weight_pct || 0}%
                          </td>
                          <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              className="btn btn-sell"
                              style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                              onClick={() => onOpenOrder && onOpenOrder({ ...h, price: h.current_price }, 'SELL')}
                            >
                              Sell Position
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- SUBTAB 2: PORTFOLIO ANALYSIS AGENT --- */}
      {activeSubTab === 'agent' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Controls Bar */}
          <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Auditing Stored Ledger Positions
              </span>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Isolates your authenticated user ledger, computing exact purchase prices and sector concentration
              </p>
            </div>

            <button
              onClick={fetchAgentAudit}
              disabled={agentLoading}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RotateCcw size={14} className={agentLoading ? 'animate-spin' : ''} />
              Re-Audit Portfolio
            </button>
          </div>

          {/* Loading */}
          {agentLoading && (
            <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Sparkles size={32} className="animate-spin" style={{ color: 'var(--accent-blue)', margin: '0 auto 12px' }} />
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Running Portfolio Analysis Agent Audit...
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Evaluating single-stock weights, diversification score, and stress scenarios...
              </p>
            </div>
          )}

          {/* Error */}
          {agentError && !agentLoading && (
            <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid var(--loss-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--loss-color)', fontWeight: 700 }}>
                <ShieldAlert size={18} /> Audit Limitation
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px' }}>{agentError}</p>
            </div>
          )}

          {/* Agent Results */}
          {agentData && !agentLoading && (
            <>
              {/* Signal & Summary Bar */}
              <div
                className="glass-card"
                style={{
                  padding: '20px',
                  borderLeft: `4px solid ${
                    (agentData.signal || '').includes('Well-Diversified') ? 'var(--gain-color)' :
                    (agentData.signal || '').includes('Concentration') ? 'var(--loss-color)' :
                    'var(--accent-blue)'
                  }`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
                      PORTFOLIO RISK & ALLOCATION STATUS
                    </span>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '2px', color: 'var(--text-primary)' }}>
                      {agentData.signal}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="badge badge-fresh">Freshness: {agentData.data_freshness}</span>
                    {agentData.confidence && (
                      <span className="badge badge-outline">
                        Confidence: {Math.round((agentData.confidence.score || 0) * 100)}%
                      </span>
                    )}
                  </div>
                </div>

                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '12px', lineHeight: 1.6 }}>
                  {agentData.summary}
                </p>
              </div>

              {/* Diversification Score & Key Findings */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                      Diversification Score
                    </span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '10px 0' }}>
                      <span className="font-mono" style={{ fontSize: '2.4rem', fontWeight: 900, color: (agentSupporting.diversification_score || 0) >= 60 ? 'var(--gain-color)' : 'var(--accent-blue)' }}>
                        {agentSupporting.diversification_score || 0}
                      </span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/ 100</span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      Evaluates active positions across 10 sectors, single-stock weighting penalties, and liquidity buffer.
                    </p>
                  </div>

                  <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Active Stocks:</span>
                      <strong>{agentSupporting.active_positions_count || 0} positions</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Sectors Covered:</span>
                      <strong>{agentSupporting.sector_count || 0} sectors</strong>
                    </div>
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <CheckCircle2 size={16} style={{ color: 'var(--accent-blue)' }} /> Quantitative Portfolio Findings
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {agentData.key_findings.map((f, idx) => (
                      <div
                        key={idx}
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.4,
                          padding: '6px 8px',
                          background: 'var(--bg-elevated)',
                          borderRadius: 'var(--radius-sm)'
                        }}
                      >
                        <span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>•</span> {f}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Concentration Warnings */}
              {agentWarnings.length > 0 && (
                <div className="glass-card" style={{ padding: '18px 20px', borderLeft: '3px solid var(--loss-color)' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--loss-color)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                    <ShieldAlert size={16} /> Concentration Risks & Imbalance Warnings
                  </div>
                  <ul style={{ paddingLeft: '18px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {agentWarnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Rebalancing Suggestions */}
              {rebalancingSuggestions.length > 0 && (
                <div className="glass-card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <Layers size={18} style={{ color: 'var(--gain-color)' }} /> Evidence-Based Improvement & Rebalancing Scenarios
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                    {rebalancingSuggestions.map((s, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--gain-bg)',
                          border: '1px solid var(--gain-border)',
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.5,
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px'
                        }}
                      >
                        <span style={{ color: 'var(--gain-color)', fontWeight: 700 }}>•</span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stress Scenarios */}
              {agentScenarios.length > 0 && (
                <div className="glass-card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <TrendingUp size={18} style={{ color: 'var(--accent-blue)' }} /> Portfolio Stress-Test & Market Trajectories
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                    {agentScenarios.map((sc, idx) => {
                      const isBull = sc.case.includes('Bullish');
                      const isBear = sc.case.includes('Bearish') || sc.case.includes('Drawdown');
                      return (
                        <div
                          key={idx}
                          style={{
                            padding: '16px',
                            borderRadius: 'var(--radius-sm)',
                            background: isBull ? 'var(--gain-bg)' : isBear ? 'var(--loss-bg)' : 'var(--bg-elevated)',
                            border: `1px solid ${isBull ? 'var(--gain-border)' : isBear ? 'var(--loss-border)' : 'var(--border-subtle)'}`,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: isBull ? 'var(--gain-color)' : isBear ? 'var(--loss-color)' : 'var(--text-primary)' }}>
                                {sc.case}
                              </span>
                              <span className="badge badge-outline" style={{ fontSize: '0.68rem' }}>
                                {sc.probability_assessment}
                              </span>
                            </div>
                            <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 800, margin: '8px 0', color: 'var(--text-primary)' }}>
                              {sc.target_range}
                            </div>
                            <ul style={{ paddingLeft: '16px', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {sc.catalysts?.map((c, cIdx) => <li key={cIdx}>{c}</li>)}
                            </ul>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sources */}
              {agentSources.length > 0 && (
                <div className="glass-card" style={{ padding: '14px 20px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Ledger Audit Sources & Traceability
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {agentSources.map((src, idx) => (
                      <div
                        key={idx}
                        style={{
                          fontSize: '0.75rem',
                          background: 'var(--bg-elevated)',
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)'
                        }}
                      >
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{src.metric}: </span>
                        <span className="font-mono" style={{ color: 'var(--accent-blue)' }}>{String(src.value ?? '')}</span>
                        <span style={{ color: 'var(--text-muted)' }}> via {src.source}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>
                {agentData.disclaimer}
              </div>
            </>
          )}
        </div>
      )}
      </div>

      {/* Right Column: AI Portfolio Side Panel */}
      <div className="section-side-column">
        <AISidePanel
          section="portfolio"
          currentSymbol="PORTFOLIO"
          onSelectStock={onSelectStock}
        />
      </div>

      {/* Mobile Floating Button */}
      <button
        onClick={() => setMobileDrawerOpen(true)}
        className="ai-mobile-floating-btn"
        title="Open Portfolio AI Agent"
      >
        <Sparkles size={16} /> Portfolio AI Agent
      </button>

      {/* Mobile Drawer Overlay */}
      {mobileDrawerOpen && (
        <div className="ai-mobile-drawer-overlay" onClick={() => setMobileDrawerOpen(false)}>
          <div className="ai-mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
            <AISidePanel
              section="portfolio"
              currentSymbol="PORTFOLIO"
              isMobile={true}
              onToggleOpen={() => setMobileDrawerOpen(false)}
              onSelectStock={onSelectStock}
            />
          </div>
        </div>
      )}
    </div>
  );
}
