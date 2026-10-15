import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import {
  Brain,
  ShieldAlert,
  CheckCircle,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  Scale,
  Zap,
  Info,
  ArrowRight,
  Clock,
  Activity
} from 'lucide-react';

export default function TradingBehaviorView({ onSelectStock }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBehaviorData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.ai.behaviorAgent();
      setData(res);
    } catch (err) {
      console.error('Error fetching behavior agent data:', err);
      setError(err.message || 'Failed to analyze trading behavior records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBehaviorData();
  }, []);

  const supporting = data?.supporting_data || {};
  const patterns = supporting.observable_patterns || [];
  const mistakes = supporting.recurring_mistakes || [];
  const suggestions = supporting.discipline_suggestions || [];
  const scenarios = data?.scenarios || [];
  const sources = data?.sources || [];
  const warnings = data?.warnings || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      {/* Header Banner */}
      <div
        className="glass-card"
        style={{
          padding: '24px',
          background: 'var(--banner-ai-bg)',
          border: '1px solid var(--banner-ai-border)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Brain size={24} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Trading Behavior Analysis Agent</h2>
                <span className="badge badge-outline" style={{ borderColor: 'rgba(139, 92, 246, 0.6)', color: '#7c3aed' }}>
                  AI Agent 4
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Empirical transaction audit evaluating execution cadence, position-sizing consistency, turnover rate, and discipline rules
              </p>
            </div>
          </div>

          <button
            onClick={fetchBehaviorData}
            disabled={loading}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh Behavioral Audit
          </button>
        </div>

        {/* Methodology notice */}
        <div
          style={{
            marginTop: '16px',
            padding: '10px 14px',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Info size={14} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
          <span>
            <strong>Deterministic Behavioral Standard:</strong> All observations are computed directly from mathematical properties of your completed paper-trading transactions. This agent detects observable execution habits and does NOT make clinical, psychological, or medical diagnoses.
          </span>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Brain size={32} className="animate-spin" style={{ color: 'var(--accent-blue)', margin: '0 auto 14px' }} />
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Auditing User Transaction Records...
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Evaluating fill intervals, position-sizing standard deviation, and execution cadence...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="glass-card" style={{ padding: '30px', borderLeft: '4px solid var(--loss-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--loss-color)', fontWeight: 700 }}>
            <ShieldAlert size={20} /> Analysis Error
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>{error}</p>
          <button onClick={fetchBehaviorData} className="btn btn-secondary" style={{ marginTop: '14px', fontSize: '0.8rem' }}>
            Try Again
          </button>
        </div>
      )}

      {/* Data Loaded View */}
      {data && !loading && (
        <>
          {/* Signal & Summary Bar */}
          <div
            className="glass-card"
            style={{
              padding: '20px',
              borderLeft: `4px solid ${
                data.signal?.includes('Disciplined') ? 'var(--gain-color)' :
                data.signal?.includes('Insufficient') ? 'var(--accent-blue)' :
                'var(--loss-color)'
              }`
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
                  OBSERVED EXECUTION DISCIPLINE SIGNAL
                </span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '2px', color: 'var(--text-primary)' }}>
                  {data.signal}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="badge badge-fresh">Freshness: {data.data_freshness}</span>
                {data.confidence && (
                  <span className="badge badge-outline">
                    Confidence: {Math.round((data.confidence.score || 0) * 100)}%
                  </span>
                )}
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '12px', lineHeight: 1.6 }}>
              {data.summary}
            </p>

            {/* Stated Risk Alignment */}
            {supporting.risk_alignment && (
              <div
                style={{
                  marginTop: '14px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: supporting.risk_alignment.includes('Misaligned') ? 'rgba(235, 91, 60, 0.12)' : 'rgba(0, 208, 156, 0.12)',
                  border: `1px solid ${supporting.risk_alignment.includes('Misaligned') ? 'rgba(235, 91, 60, 0.3)' : 'rgba(0, 208, 156, 0.3)'}`,
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Scale size={16} style={{ color: supporting.risk_alignment.includes('Misaligned') ? 'var(--loss-color)' : 'var(--gain-color)' }} />
                <span>
                  <strong>Risk Preference Congruence:</strong> Stated profile is <strong>{supporting.stated_risk_profile}</strong>. Assessment: {supporting.risk_alignment}
                </span>
              </div>
            )}
          </div>

          {/* Empty State if 0 trades */}
          {supporting.total_trades === 0 ? (
            <div className="glass-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(59, 130, 246, 0.12)',
                  color: 'var(--accent-blue)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px'
                }}
              >
                <Clock size={28} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '6px' }}>
                Awaiting Initial Trade Executions
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '540px', margin: '0 auto 20px', lineHeight: 1.5 }}>
                To calculate observable behavioral metrics (such as trade turnover velocity, sizing standard deviation, and rapid re-entry patterns), at least 1 to 3 completed market or limit orders are needed.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <span className="badge badge-outline" style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
                  Step 1: Open Markets or Stocks
                </span>
                <span className="badge badge-outline" style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
                  Step 2: Place a simulated Buy order
                </span>
                <span className="badge badge-outline" style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
                  Step 3: Return here for live feedback
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* Activity Summary Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                <div className="glass-card" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Total Fills
                  </span>
                  <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px' }}>
                    {supporting.total_trades}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {supporting.buy_trades_count} Buys · {supporting.sell_trades_count} Sells
                  </span>
                </div>

                <div className="glass-card" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Average Fill Size
                  </span>
                  <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px' }}>
                    ₹{supporting.average_trade_size ? supporting.average_trade_size.toLocaleString('en-IN', { minimumFractionDigits: 0 }) : 0}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Std Dev: ±₹{supporting.std_dev_trade_size ? supporting.std_dev_trade_size.toLocaleString('en-IN', { minimumFractionDigits: 0 }) : 0}
                  </span>
                </div>

                <div className="glass-card" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Sizing Consistency
                  </span>
                  <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px', color: (supporting.sizing_cv_pct || 0) > 60 ? 'var(--loss-color)' : 'var(--gain-color)' }}>
                    {supporting.sizing_cv_pct}%
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {(supporting.sizing_cv_pct || 0) > 60 ? 'High Variance (> 60%)' : 'Controlled (< 60%)'}
                  </span>
                </div>

                <div className="glass-card" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Trading Cadence
                  </span>
                  <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px' }}>
                    {supporting.trades_per_active_day} /day
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Across {supporting.active_days_count} active market day(s)
                  </span>
                </div>

                <div className="glass-card" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Rapid Re-Entries
                  </span>
                  <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px', color: (supporting.rapid_reentries_count || 0) > 0 ? 'var(--loss-color)' : 'var(--text-primary)' }}>
                    {supporting.rapid_reentries_count || 0}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Within 15 mins of prior fill
                  </span>
                </div>
              </div>

              {/* Observable Behavioral Patterns with Transparent Rules */}
              <div className="glass-card" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <Activity size={18} style={{ color: 'var(--accent-blue)' }} /> Observable Behavioral Patterns & Calculations
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {patterns.map((p, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {p.pattern}
                        </span>
                        <span className="badge badge-outline" style={{ fontSize: '0.7rem' }}>
                          Rule-Based Calculation
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        <strong>Evidence:</strong> {p.evidence}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        <strong>Threshold Rule:</strong> {p.rule}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warnings and Recurring Mistakes */}
              {(warnings.length > 0 || mistakes.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                  {warnings.length > 0 && (
                    <div className="glass-card" style={{ padding: '18px', borderLeft: '3px solid var(--loss-color)' }}>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--loss-color)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                        <AlertTriangle size={16} /> Risk-Management Warnings
                      </h4>
                      <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {warnings.map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {mistakes.length > 0 && (
                    <div className="glass-card" style={{ padding: '18px', borderLeft: '3px solid #f59e0b' }}>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                        <ShieldAlert size={16} /> Potential Recurring Mistakes
                      </h4>
                      <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {mistakes.map((m, idx) => (
                          <li key={idx}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Personalized Consistency Suggestions */}
              {suggestions.length > 0 && (
                <div className="glass-card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <CheckCircle size={18} style={{ color: 'var(--gain-color)' }} /> Evidence-Based Discipline Rules & Suggestions
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                    {suggestions.map((s, idx) => (
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

              {/* Behavioral Scenarios */}
              {scenarios.length > 0 && (
                <div className="glass-card" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <TrendingUp size={18} style={{ color: 'var(--accent-blue)' }} /> Projected Execution Trajectories
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                    {scenarios.map((sc, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '16px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {sc.case}
                            </span>
                            <span className="badge badge-outline" style={{ fontSize: '0.7rem' }}>
                              {sc.probability_assessment}
                            </span>
                          </div>
                          <div className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-blue)', margin: '8px 0' }}>
                            {sc.target_range}
                          </div>
                          <ul style={{ paddingLeft: '16px', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {sc.catalysts?.map((c, cIdx) => (
                              <li key={cIdx}>{c}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sources & Citations */}
              {sources.length > 0 && (
                <div className="glass-card" style={{ padding: '16px 20px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Verified Audit Citations
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {sources.map((src, idx) => (
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
                        <span className="font-mono" style={{ color: 'var(--accent-blue)' }}>{String(src.value)}</span>
                        <span style={{ color: 'var(--text-muted)' }}> via {src.source}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Legal Disclaimer */}
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>
            {data.disclaimer}
          </div>
        </>
      )}
    </div>
  );
}
