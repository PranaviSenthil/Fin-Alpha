import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ShieldAlert,
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  Info,
  Newspaper,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import AISidePanel from '../components/AISidePanel';

export default function MarketsView({ onSelectStock }) {
  const [stocksList, setStocksList] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState('MACRO'); // 'MACRO' or symbol e.g. 'RELIANCE'
  const [agentData, setAgentData] = useState(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    api.stocks.list()
      .then((stocksRes) => {
        setStocksList(stocksRes.stocks || []);
      })
      .catch((err) => {
        console.error('Error loading stock list for markets view:', err);
      });

    fetchAgentAnalysis(selectedEntity);
  }, []);

  const fetchAgentAnalysis = async (entity) => {
    setAgentLoading(true);
    setAgentError(null);
    try {
      const sym = entity === 'MACRO' ? null : entity;
      const res = await api.ai.marketAgent(sym);
      setAgentData(res);
    } catch (err) {
      console.error('Error fetching market agent analysis:', err);
      setAgentError(err.message || 'Failed to retrieve market intelligence.');
    } finally {
      setAgentLoading(false);
    }
  };

  const handleSelectEntity = (val) => {
    setSelectedEntity(val);
    fetchAgentAnalysis(val);
  };

  const supporting = agentData?.supporting_data || {};
  const scenarios = agentData?.scenarios || [];
  const risks = agentData?.risks_and_limitations || [];
  const sentiment = agentData?.news_sentiment || supporting.news_sentiment;
  const isSignalDivergent =
    sentiment &&
    sentiment.classification !== 'Unavailable' &&
    sentiment.classification !== 'Insufficient Evidence' &&
    (
      ((agentData?.signal || '').includes('Bullish') && sentiment.classification === 'Negative') ||
      ((agentData?.signal || '').includes('Bearish') && sentiment.classification === 'Positive')
    );

  return (
    <div className="section-layout-wrapper" style={{ paddingBottom: '40px' }}>
      {/* Left Column: Main Dashboard Content */}
      <div className="section-main-column">
        {/* Top Header Banner with Highlighted Navigation */}
        <div
          className="glass-card"
          style={{
            padding: '20px',
            background: 'linear-gradient(135deg, rgba(20, 28, 46, 0.95) 0%, rgba(31, 43, 69, 0.8) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.3)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={22} style={{ color: 'var(--accent-blue)' }} /> Indian Markets & Technical Intelligence
                </h2>
                <span className="badge badge-fresh" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                  <Sparkles size={12} style={{ marginRight: '4px' }} /> Market Analysis Agent Active
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Conversational market agent grounded in live NSE technical indicators, volume anomaly detection, and model-estimated scenarios
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => fetchAgentAnalysis(selectedEntity)}
                disabled={agentLoading}
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RotateCcw size={14} className={agentLoading ? 'animate-spin' : ''} />
                Re-Calculate Technicals
              </button>
            </div>
          </div>
        </div>

        {/* Technical Indicators & Quantitative Evidence Dashboard */}
        {agentLoading && (
          <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Activity size={28} className="animate-spin" style={{ color: 'var(--accent-blue)', margin: '0 auto 10px' }} />
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Calculating Technical Matrix & Model Indicators...
          </div>
        </div>
      )}

      {agentError && !agentLoading && (
        <div className="glass-card" style={{ padding: '20px', borderLeft: '4px solid var(--loss-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--loss-color)', fontWeight: 700 }}>
            <ShieldAlert size={18} /> Technical Calculation Notice
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px' }}>{agentError}</p>
        </div>
      )}

      {agentData && !agentLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Signal Header Card */}
          <div
            className="glass-card"
            style={{
              padding: '20px',
              borderLeft: `4px solid ${
                (agentData.signal || '').includes('Bullish') ? 'var(--gain-color)' :
                (agentData.signal || '').includes('Bearish') ? 'var(--loss-color)' :
                'var(--accent-blue)'
              }`
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.3rem', fontWeight: 800 }}>
                    {supporting.name ? `${supporting.name} (${agentData.entity})` : 'Macro Indian Market Pulse'}
                  </span>
                  <span
                    className={`badge ${
                      (agentData.signal || '').includes('Bullish') ? 'bg-gain' :
                      (agentData.signal || '').includes('Bearish') ? 'bg-loss' :
                      'badge-outline'
                    }`}
                    style={{ fontSize: '0.85rem', fontWeight: 700 }}
                  >
                    {agentData.signal}
                  </span>
                </div>

                {supporting.current_price !== undefined && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '6px' }}>
                    <span className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                      ₹{supporting.current_price?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className={`badge ${(supporting.change_pct || 0) >= 0 ? 'bg-gain' : 'bg-loss'}`} style={{ fontSize: '0.85rem' }}>
                      {(supporting.change_pct || 0) >= 0 ? '+' : ''}{supporting.change_pct}%
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {supporting.sector} · {supporting.exchange}
                    </span>
                  </div>
                )}
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

          {/* Technical Indicator Metric Cards (when analyzing a stock) */}
          {selectedEntity !== 'MACRO' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
              {/* RSI */}
              <div className="glass-card" style={{ padding: '16px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  RSI (14-Day)
                </span>
                <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px', color: (supporting.rsi_14 || 50) >= 70 ? 'var(--loss-color)' : (supporting.rsi_14 || 50) <= 30 ? 'var(--gain-color)' : 'var(--text-primary)' }}>
                  {supporting.rsi_14 !== null && supporting.rsi_14 !== undefined ? supporting.rsi_14 : 'N/A'}
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {(supporting.rsi_14 || 50) >= 70 ? 'Overbought (> 70)' : (supporting.rsi_14 || 50) <= 30 ? 'Oversold (< 30)' : 'Neutral Momentum'}
                </span>
              </div>

              {/* Volume Anomaly */}
              <div className="glass-card" style={{ padding: '16px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Volume Anomaly Ratio
                </span>
                <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px', color: (supporting.volume_anomaly_ratio || 1) >= 1.75 ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                  {supporting.volume_anomaly_ratio || 1.0}x
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {supporting.volume_status || 'Normal Trading Volume'}
                </span>
              </div>

              {/* 30D Volatility */}
              <div className="glass-card" style={{ padding: '16px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  30D Annualized Volatility
                </span>
                <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px' }}>
                  {supporting.volatility_30d_pct !== null && supporting.volatility_30d_pct !== undefined ? `${supporting.volatility_30d_pct}%` : 'N/A'}
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Historical log-return variance
                </span>
              </div>

              {/* Support & Resistance */}
              <div className="glass-card" style={{ padding: '16px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Support & Resistance
                </span>
                <div className="font-mono" style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: '6px' }}>
                  S: ₹{supporting.support_level || 'N/A'}
                </div>
                <div className="font-mono" style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-blue)', marginTop: '2px' }}>
                  R: ₹{supporting.resistance_level || 'N/A'}
                </div>
              </div>

              {/* Moving Averages */}
              <div className="glass-card" style={{ padding: '16px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Moving Averages (SMA)
                </span>
                <div style={{ fontSize: '0.78rem', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span className="font-mono">SMA 20: <strong>₹{supporting.sma_20 || 'N/A'}</strong></span>
                  <span className="font-mono">SMA 50: <strong>₹{supporting.sma_50 || 'N/A'}</strong></span>
                  <span className="font-mono">SMA 200: <strong>₹{supporting.sma_200 || 'N/A'}</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Financial News Sentiment Analysis Panel (PS 04 Task 2) */}
          <div className="glass-card" style={{ padding: '20px', borderTop: '3px solid var(--accent-blue)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Newspaper size={19} style={{ color: 'var(--accent-blue)' }} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                  Financial News Sentiment Analysis
                </h3>
                {sentiment?.classification && (
                  <span
                    className={`badge ${
                      sentiment.classification === 'Positive' ? 'bg-gain' :
                      sentiment.classification === 'Negative' ? 'bg-loss' :
                      sentiment.classification === 'Neutral' ? 'badge-outline' :
                      sentiment.classification === 'Insufficient Evidence' ? 'bg-warning' :
                      'badge-outline'
                    }`}
                    style={{ fontSize: '0.75rem', fontWeight: 700 }}
                  >
                    {sentiment.classification}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {sentiment?.provider && sentiment.provider !== 'None' && (
                  <span className="badge badge-outline" style={{ fontSize: '0.7rem' }}>
                    Provider: {sentiment.provider}
                  </span>
                )}
                {sentiment?.freshness_status && (
                  <span className={`badge ${sentiment.freshness_status === 'fresh' ? 'badge-fresh' : 'badge-outline'}`} style={{ fontSize: '0.7rem' }}>
                    {sentiment.freshness_status === 'cached' ? 'Cached (15m)' : sentiment.freshness_status === 'fresh' ? 'Fresh News' : sentiment.freshness_status}
                  </span>
                )}
                {sentiment?.evidence_quality && sentiment.evidence_quality !== 'Unavailable' && (
                  <span className="badge badge-outline" style={{ fontSize: '0.7rem', color: sentiment.evidence_quality === 'High' ? 'var(--gain-color)' : 'var(--text-secondary)' }}>
                    Evidence: {sentiment.evidence_quality}
                  </span>
                )}
              </div>
            </div>

            {/* If Sentiment is completely unavailable */}
            {(!sentiment || sentiment.classification === 'Unavailable' || (sentiment.headlines_analyzed === 0 && (!sentiment.headlines || sentiment.headlines.length === 0))) ? (
              <div
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px dashed var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <AlertCircle size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    News Sentiment Currently Unavailable
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    No recent verifiable news headlines returned from public financial feeds for this ticker. Quantitative market indicators and momentum matrix remain 100% operational.
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {/* Metric Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                  <div style={{ padding: '10px 14px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Aggregate Score
                    </div>
                    <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '2px', color: (sentiment.overall_score || 0) >= 0.05 ? 'var(--gain-color)' : (sentiment.overall_score || 0) <= -0.05 ? 'var(--loss-color)' : 'var(--text-primary)' }}>
                      {sentiment.overall_score !== null && sentiment.overall_score !== undefined
                        ? `${sentiment.overall_score > 0 ? '+' : ''}${sentiment.overall_score.toFixed(2)}`
                        : 'N/A'}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Range: -1.0 to +1.0</div>
                  </div>

                  <div style={{ padding: '10px 14px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Headlines Analyzed
                    </div>
                    <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '2px', color: 'var(--text-primary)' }}>
                      {sentiment.headlines_analyzed}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Deduplicated articles</div>
                  </div>

                  <div style={{ padding: '10px 14px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Polarity Distribution
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: '6px', display: 'flex', gap: '8px' }}>
                      <span style={{ color: 'var(--gain-color)' }}>{sentiment.positive_count} Pos</span>
                      <span style={{ color: 'var(--text-muted)' }}>·</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{sentiment.neutral_count} Neu</span>
                      <span style={{ color: 'var(--text-muted)' }}>·</span>
                      <span style={{ color: 'var(--loss-color)' }}>{sentiment.negative_count} Neg</span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>VADER valence threshold ±0.05</div>
                  </div>

                  <div style={{ padding: '10px 14px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Confidence Quality
                    </div>
                    <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '2px', color: 'var(--accent-blue)' }}>
                      {Math.round((sentiment.confidence_score || 0) * 100)}%
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {sentiment.evidence_quality}
                    </div>
                  </div>
                </div>

                {/* Explicit Signal Divergence Alert */}
                {isSignalDivergent && (
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      marginBottom: '14px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px'
                    }}
                  >
                    <ShieldAlert size={18} style={{ color: 'var(--warning-color)', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      <strong style={{ color: 'var(--warning-color)' }}>Momentum vs. News Divergence Detected:</strong>{' '}
                      Technical indicators evaluate momentum as <strong>{agentData?.signal}</strong>, whereas verified news sentiment is <strong>{sentiment.classification} ({sentiment.overall_score > 0 ? '+' : ''}{sentiment.overall_score?.toFixed(2)})</strong>.
                      The agent preserves this disagreement rather than forcing an artificial consensus.
                    </div>
                  </div>
                )}

                {/* Insufficient Evidence Warning Banner */}
                {sentiment.classification === 'Insufficient Evidence' && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(59, 130, 246, 0.08)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      marginBottom: '14px',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <Info size={14} style={{ color: 'var(--accent-blue)', display: 'inline', marginRight: '6px', verticalAlign: '-2px' }} />
                    <strong>Insufficient Evidence Notice:</strong> Limited headline volume ({sentiment.headlines_analyzed} article). Score should be treated as indicative; rely primarily on quantitative indicators.
                  </div>
                )}

                {/* Verified Recent Headlines List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Recent Scored Headlines ({sentiment.headlines?.length || 0})
                  </div>
                  {sentiment.headlines?.map((h, hIdx) => {
                    const isPos = (h.sentiment_score || 0) >= 0.05;
                    const isNeg = (h.sentiment_score || 0) <= -0.05;
                    return (
                      <div
                        key={hIdx}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(15, 23, 42, 0.45)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                          flexWrap: 'wrap'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: '220px' }}>
                          <a
                            href={h.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-blue)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                          >
                            <span>{h.title}</span>
                            <ExternalLink size={12} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                          </a>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{h.publisher}</span>
                            {h.published_at && (
                              <span>• {new Date(h.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            className={`badge ${isPos ? 'bg-gain' : isNeg ? 'bg-loss' : 'badge-outline'}`}
                            style={{ fontSize: '0.72rem', fontWeight: 700 }}
                          >
                            {h.sentiment_score !== null && h.sentiment_score !== undefined
                              ? `${h.sentiment_score > 0 ? '+' : ''}${h.sentiment_score.toFixed(2)}`
                              : '0.00'} {h.sentiment_label || 'Neutral'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer with Metadata */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <span>
                    Scoring Engine: Loughran-McDonald & VADER Normalized ([-1.0, +1.0])
                  </span>
                  {sentiment.retrieved_at && (
                    <span>
                      Retrieved: {new Date(sentiment.retrieved_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quantitative Market Evidence */}
          <div className="glass-card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <CheckCircle2 size={18} style={{ color: 'var(--accent-blue)' }} /> Quantitative Market Evidence
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
              {agentData.key_findings.map((f, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5
                  }}
                >
                  <span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>•</span> {f}
                </div>
              ))}
            </div>
          </div>

          {/* Model-Estimated Scenarios (Bullish, Base, Bearish) */}
          {scenarios.length > 0 && (
            <div className="glass-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={18} style={{ color: 'var(--accent-blue)' }} /> Model-Estimated Scenarios & Technical Targets
                </h3>
                <span className="badge badge-outline" style={{ fontSize: '0.7rem' }}>
                  Model-Estimated Scenarios
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                {scenarios.map((sc, idx) => {
                  const isBull = sc.case.includes('Bullish');
                  const isBear = sc.case.includes('Bearish');
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-sm)',
                        background: isBull ? 'rgba(0, 208, 156, 0.05)' : isBear ? 'rgba(235, 91, 60, 0.05)' : 'rgba(15, 23, 42, 0.7)',
                        border: `1px solid ${isBull ? 'rgba(0, 208, 156, 0.25)' : isBear ? 'rgba(235, 91, 60, 0.25)' : 'var(--border-subtle)'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: isBull ? 'var(--gain-color)' : isBear ? 'var(--loss-color)' : 'var(--text-primary)' }}>
                            {sc.case} Scenario
                          </span>
                          {sc.implied_change_pct !== undefined && (
                            <span className={`badge ${sc.implied_change_pct >= 0 ? 'bg-gain' : 'bg-loss'}`} style={{ fontSize: '0.72rem' }}>
                              {sc.implied_change_pct >= 0 ? '+' : ''}{sc.implied_change_pct}%
                            </span>
                          )}
                        </div>

                        <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 800, margin: '10px 0', color: 'var(--text-primary)' }}>
                          {sc.target_price ? `₹${sc.target_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : sc.target_range}
                        </div>

                        {sc.target_range && sc.target_price && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            Range: {sc.target_range}
                          </div>
                        )}

                        {sc.assumptions && sc.assumptions.length > 0 && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Assumptions:</span>
                            {sc.assumptions.map((a, aIdx) => (
                              <div key={aIdx} style={{ display: 'flex', gap: '6px' }}>
                                <span style={{ color: 'var(--accent-blue)' }}>•</span>
                                <span>{a}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Model Limitations & Volatility Risks */}
          {risks.length > 0 && (
            <div className="glass-card" style={{ padding: '16px 20px', borderLeft: '3px solid #f59e0b' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <ShieldAlert size={15} /> Model Limitations & Volatility Risks
              </div>
              <ul style={{ paddingLeft: '18px', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {risks.map((r, idx) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Educational Disclaimer */}
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>
            {agentData.disclaimer}
          </div>
        </div>
      )}
      </div>

      {/* Right Column: AI Market Side Panel */}
      <div className="section-side-column">
        <AISidePanel
          section="markets"
          currentSymbol={selectedEntity}
          allStocks={stocksList}
          onSelectStock={(sym) => {
            setSelectedEntity(sym);
            fetchAgentAnalysis(sym);
            if (onSelectStock) onSelectStock(sym);
          }}
        />
      </div>

      {/* Mobile Floating Button */}
      <button
        onClick={() => setMobileDrawerOpen(true)}
        className="ai-mobile-floating-btn"
        title="Open AI Market Agent"
      >
        <Sparkles size={16} /> Market AI Agent
      </button>

      {/* Mobile Drawer Overlay */}
      {mobileDrawerOpen && (
        <div className="ai-mobile-drawer-overlay" onClick={() => setMobileDrawerOpen(false)}>
          <div className="ai-mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
            <AISidePanel
              section="markets"
              currentSymbol={selectedEntity}
              allStocks={stocksList}
              isMobile={true}
              onToggleOpen={() => setMobileDrawerOpen(false)}
              onSelectStock={(sym) => {
                setSelectedEntity(sym);
                fetchAgentAnalysis(sym);
                if (onSelectStock) onSelectStock(sym);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
