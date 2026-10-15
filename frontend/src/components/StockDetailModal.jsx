import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import StockChart from './StockChart';
import { X, Sparkles, Plus, Check, TrendingUp, TrendingDown, Clock, ShieldCheck, Activity } from 'lucide-react';

export default function StockDetailModal({
  symbol,
  onClose,
  onOpenOrder,
  isInWatchlist = false,
  onToggleWatchlist
}) {
  const [activeTab, setActiveTab] = useState('chart'); // 'chart' | 'ai' | 'fundamentals'
  const [period, setPeriod] = useState('1mo');
  const [stockDetail, setStockDetail] = useState(null);
  const [historyBars, setHistoryBars] = useState([]);
  const [indicators, setIndicators] = useState({});
  const [aiResearch, setAiResearch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load stock details & history
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      api.stocks.detail(symbol),
      api.stocks.history(symbol, period, '1d'),
    ])
      .then(([detail, hist]) => {
        if (!isMounted) return;
        setStockDetail(detail);
        setHistoryBars(hist.bars || []);
        setIndicators(hist.indicators || {});
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Failed to load stock data');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [symbol, period]);

  // Load AI Deep Research when tab clicked
  const handleLoadAiResearch = async () => {
    setActiveTab('ai');
    if (aiResearch) return;

    setAiLoading(true);
    try {
      const res = await api.ai.companyResearch(symbol);
      setAiResearch(res);
    } catch (err) {
      console.error('Failed to load AI research:', err);
    } finally {
      setAiLoading(false);
    }
  };

  if (!symbol) return null;

  const quote = stockDetail?.quote || {};
  const inst = stockDetail?.instrument || {};
  const funds = stockDetail?.fundamentals || {};
  const isGain = (quote.change_pct || 0) >= 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px', maxHeight: '92vh' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{inst.name || symbol}</h1>
              <span className="badge badge-outline">{inst.exchange || 'NSE'}</span>
              <span className="badge badge-outline" style={{ color: 'var(--accent-blue)' }}>{inst.sector_name || 'Large Cap'}</span>
              <span className={`badge badge-${quote.data_status || 'fresh'}`}>
                {quote.data_status === 'fresh' ? 'Latest Quote' : (quote.data_status || 'fresh')}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
              <span className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                ₹{quote.price !== null && quote.price !== undefined ? quote.price.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '---'}
              </span>
              <span className={`badge ${isGain ? 'bg-gain' : 'bg-loss'}`} style={{ fontSize: '0.85rem' }}>
                {isGain ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {isGain ? '+' : ''}{quote.change || 0} ({isGain ? '+' : ''}{quote.change_pct || 0}%)
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> Fetched {quote.fetched_at ? new Date(quote.fetched_at).toLocaleTimeString() : 'now'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onToggleWatchlist && (
              <button
                className={`btn btn-secondary ${isInWatchlist ? 'bg-gain' : ''}`}
                onClick={() => onToggleWatchlist(symbol)}
                title={isInWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
              >
                {isInWatchlist ? <Check size={16} /> : <Plus size={16} />}
                {isInWatchlist ? 'Watchlisted' : 'Watchlist'}
              </button>
            )}
            <button
              className="btn btn-buy"
              onClick={() => onOpenOrder && onOpenOrder({ ...inst, price: quote.price }, 'BUY')}
            >
              Buy
            </button>
            <button
              className="btn btn-sell"
              onClick={() => onOpenOrder && onOpenOrder({ ...inst, price: quote.price }, 'SELL')}
            >
              Sell
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', padding: '0 24px' }}>
          <button
            onClick={() => setActiveTab('chart')}
            style={{
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'chart' ? '2px solid var(--accent-blue)' : '2px solid transparent',
              color: activeTab === 'chart' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Activity size={16} /> Chart & Technicals
          </button>
          <button
            onClick={handleLoadAiResearch}
            style={{
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'ai' ? '2px solid var(--accent-blue)' : '2px solid transparent',
              color: activeTab === 'ai' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Sparkles size={16} style={{ color: '#ec4899' }} /> AI Deep Research
          </button>
          <button
            onClick={() => setActiveTab('fundamentals')}
            style={{
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'fundamentals' ? '2px solid var(--accent-blue)' : '2px solid transparent',
              color: activeTab === 'fundamentals' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Fundamentals & Overview
          </button>
        </div>

        {/* Tab Body */}
        <div style={{ padding: '20px 24px' }}>
          {loading ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading instrument market data...
            </div>
          ) : error ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--loss-color)' }}>
              {error}
            </div>
          ) : activeTab === 'chart' ? (
            <div>
              {/* Timeframe Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {['1d', '5d', '1mo', '3mo', '6mo', '1y', '5y'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`btn btn-secondary ${period === p ? 'badge-fresh' : ''}`}
                      style={{ padding: '4px 10px', fontSize: '0.75rem', textTransform: 'uppercase' }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Source: Yahoo Finance via yfinance (Development adapter)
                </div>
              </div>

              {/* Interactive Candlestick / Line Chart */}
              <StockChart bars={historyBars} indicators={indicators} symbol={symbol} />

              {/* Day / 52W High-Low Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '20px' }}>
                <div className="glass-card" style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Day Range</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.85rem' }} className="font-mono">
                    <span>₹{quote.day_low || '---'}</span>
                    <span>₹{quote.day_high || '---'}</span>
                  </div>
                </div>
                <div className="glass-card" style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>52-Week Range</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.85rem' }} className="font-mono">
                    <span>₹{funds.low_52w || '---'}</span>
                    <span>₹{funds.high_52w || '---'}</span>
                  </div>
                </div>
                <div className="glass-card" style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Volume</span>
                  <div style={{ marginTop: '4px', fontSize: '0.9rem', fontWeight: 600 }} className="font-mono">
                    {quote.volume ? quote.volume.toLocaleString() : '---'}
                  </div>
                </div>
                <div className="glass-card" style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Market Cap</span>
                  <div style={{ marginTop: '4px', fontSize: '0.9rem', fontWeight: 600 }} className="font-mono">
                    {funds.market_cap ? `₹${(funds.market_cap / 10000000).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr` : '---'}
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'ai' ? (
            <div>
              {aiLoading ? (
                <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Synthesizing technical indicators, valuation multiples, and business profile for {symbol}...
                </div>
              ) : aiResearch ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Summary Banner */}
                  <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Sparkles size={18} style={{ color: 'var(--accent-blue)' }} />
                      <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Executive Research Summary</h3>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                      {aiResearch.summary}
                    </p>
                  </div>

                  {/* SWOT Grid */}
                  {aiResearch.details?.swot_analysis && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div className="glass-card" style={{ padding: '14px', borderLeft: '4px solid var(--gain-color)' }}>
                        <h4 style={{ fontSize: '0.85rem', color: 'var(--gain-color)', fontWeight: 700, marginBottom: '8px' }}>STRENGTHS</h4>
                        <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {aiResearch.details.swot_analysis.strengths.map((s, idx) => (
                            <li key={idx}>{s}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="glass-card" style={{ padding: '14px', borderLeft: '4px solid var(--loss-color)' }}>
                        <h4 style={{ fontSize: '0.85rem', color: 'var(--loss-color)', fontWeight: 700, marginBottom: '8px' }}>WEAKNESSES</h4>
                        <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {aiResearch.details.swot_analysis.weaknesses.map((w, idx) => (
                            <li key={idx}>{w}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="glass-card" style={{ padding: '14px', borderLeft: '4px solid #0284c7' }}>
                        <h4 style={{ fontSize: '0.85rem', color: '#0284c7', fontWeight: 700, marginBottom: '8px' }}>OPPORTUNITIES</h4>
                        <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {aiResearch.details.swot_analysis.opportunities.map((o, idx) => (
                            <li key={idx}>{o}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="glass-card" style={{ padding: '14px', borderLeft: '4px solid #f59e0b' }}>
                        <h4 style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: 700, marginBottom: '8px' }}>THREATS & RISKS</h4>
                        <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {aiResearch.details.swot_analysis.threats.map((t, idx) => (
                            <li key={idx}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Evidence Citations */}
                  <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>SOURCE EVIDENCE & CITATIONS:</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '6px' }}>
                      {aiResearch.evidence_citations?.map((c, i) => (
                        <span key={i} className="badge badge-outline" style={{ fontSize: '0.72rem' }}>
                          <ShieldCheck size={12} style={{ color: 'var(--gain-color)' }} /> {c.source} ({c.metric})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            /* Fundamentals Tab */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                <div className="glass-card" style={{ padding: '14px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>P/E Ratio (TTM)</span>
                  <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '4px' }}>
                    {funds.pe_ratio ? funds.pe_ratio.toFixed(2) : '---'}
                  </div>
                </div>
                <div className="glass-card" style={{ padding: '14px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Price-to-Book (P/B)</span>
                  <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '4px' }}>
                    {funds.pb_ratio ? funds.pb_ratio.toFixed(2) : '---'}
                  </div>
                </div>
                <div className="glass-card" style={{ padding: '14px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Return on Equity (ROE)</span>
                  <div className="font-mono text-gain" style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '4px' }}>
                    {funds.roe ? `${funds.roe.toFixed(2)}%` : '---'}
                  </div>
                </div>
                <div className="glass-card" style={{ padding: '14px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Debt-to-Equity</span>
                  <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '4px' }}>
                    {funds.debt_to_equity ? funds.debt_to_equity.toFixed(2) : '0.00'}
                  </div>
                </div>
                <div className="glass-card" style={{ padding: '14px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dividend Yield</span>
                  <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '4px' }}>
                    {funds.dividend_yield ? `${(funds.dividend_yield * 100).toFixed(2)}%` : '1.25%'}
                  </div>
                </div>
                <div className="glass-card" style={{ padding: '14px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Earnings Per Share (EPS)</span>
                  <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '4px' }}>
                    ₹{funds.eps ? funds.eps.toFixed(2) : '---'}
                  </div>
                </div>
              </div>

              {/* Company Description */}
              <div className="glass-card" style={{ padding: '18px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '8px' }}>About {inst.name}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {funds.business_summary || inst.subsector}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
