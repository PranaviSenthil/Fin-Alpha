import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { TrendingUp, TrendingDown, Sparkles, Activity, ShieldCheck, ArrowRight, BarChart2 } from 'lucide-react';

export default function MarketOverviewView({ onSelectStock, onOpenOrder }) {
  const [overview, setOverview] = useState(null);
  const [aiMarketPulse, setAiMarketPulse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    api.market.overview()
      .then((data) => {
        if (isMounted) {
          setOverview(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load market overview:', err);
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  const handleGenerateAiPulse = async () => {
    setAiLoading(true);
    try {
      const res = await api.ai.marketAnalysis();
      setAiMarketPulse(res);
    } catch (err) {
      console.error('Failed to generate AI pulse:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const indices = overview?.indices || [
    { symbol: 'NIFTY50', name: 'NIFTY 50', price: 24850.2, change: 104.5, change_pct: 0.42 },
    { symbol: 'SENSEX', name: 'S&P BSE SENSEX', price: 81420.5, change: 310.2, change_pct: 0.38 }
  ];

  const gainers = overview?.gainers || [];
  const losers = overview?.losers || [];
  const mostActive = overview?.most_active || [];
  const sectorPerf = overview?.sector_performance || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      {/* Benchmark Indices Header Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {indices.map((idx) => {
          const isGain = (idx.change_pct || 0) >= 0;
          return (
            <div key={idx.symbol} className="glass-card" style={{ padding: '18px 20px', borderLeft: `4px solid ${isGain ? 'var(--gain-color)' : 'var(--loss-color)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{idx.name}</span>
                <span className="badge badge-outline">{idx.exchange || 'NSE'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '8px' }}>
                <span className="font-mono" style={{ fontSize: '1.6rem', fontWeight: 800 }}>
                  ₹{idx.price !== null ? idx.price?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '---'}
                </span>
                <span className={`badge ${isGain ? 'bg-gain' : 'bg-loss'}`} style={{ fontSize: '0.8rem' }}>
                  {isGain ? '+' : ''}{idx.change || 0} ({isGain ? '+' : ''}{idx.change_pct || 0}%)
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                Source: Yahoo Finance via yfinance (^NSEI / ^BSESN)
              </div>
            </div>
          );
        })}

        {/* Market Status Tile */}
        <div className="glass-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Indian Market Status</span>
              <span className="badge badge-fresh">Simulated Environment</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--gain-color)', boxShadow: '0 0 10px var(--gain-color)' }} />
              <span style={{ fontSize: '1.05rem', fontWeight: 700, textTransform: 'capitalize' }}>
                {overview?.market_status || 'Open (Regular Trading)'}
              </span>
            </div>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Curated 100-Stock Universe across 10 Distinct Sectors
          </div>
        </div>
      </div>

      {/* AI Market Pulse Feature Banner */}
      <div className="glass-card" style={{ padding: '20px', background: 'var(--banner-bg)', border: '1px solid var(--banner-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ maxWidth: '680px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Sparkles size={18} style={{ color: '#ec4899' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>AI Market Intelligence & Sector Rotation</h2>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {aiMarketPulse?.summary ||
                "VibeFinance AI synthesizes live Indian index momentum, top stock movements, and sector leadership using verified data points to generate macro pulse insights."}
            </p>
          </div>
          <button
            onClick={handleGenerateAiPulse}
            disabled={aiLoading}
            className="btn btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <Sparkles size={15} />
            {aiLoading ? 'Synthesizing Pulse...' : 'Generate Fresh AI Pulse'}
          </button>
        </div>

        {aiMarketPulse?.evidence_citations && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={12} style={{ color: 'var(--gain-color)' }} /> Verified Source Citations:
            </span>
            {aiMarketPulse.evidence_citations.map((c, i) => (
              <span key={i} className="badge badge-outline" style={{ fontSize: '0.7rem' }}>
                {c.source} ({c.metric})
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Sector Performance Grid */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} style={{ color: 'var(--accent-blue)' }} /> Sector Performance Breakdown (10 Sectors)
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Average price change across constituents</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {Object.entries(sectorPerf).map(([id, perf]) => {
            const isUp = (perf.avg_change_pct || 0) >= 0;
            return (
              <div key={id} className="glass-card" style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{perf.sector_name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <span className={`badge ${isUp ? 'bg-gain' : 'bg-loss'}`}>
                    {isUp ? '+' : ''}{perf.avg_change_pct}%
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{perf.stock_count} stocks</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Gainers, Losers, and Most Active Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Top Gainers */}
        <div className="glass-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--gain-color)' }}>
              <TrendingUp size={16} /> Top Gainers
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>100-Stock Universe</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {gainers.slice(0, 5).map((stock) => (
              <div
                key={stock.symbol}
                onClick={() => onSelectStock(stock.symbol)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  background: 'var(--bg-secondary)',
                  transition: 'background var(--transition-fast)'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{stock.symbol}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{stock.exchange}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="font-mono" style={{ fontWeight: 600, fontSize: '0.85rem' }}>₹{stock.price || '---'}</div>
                  <div className="text-gain font-mono" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                    +{stock.change_pct}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Losers */}
        <div className="glass-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--loss-color)' }}>
              <TrendingDown size={16} /> Top Losers
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>100-Stock Universe</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {losers.slice(0, 5).map((stock) => (
              <div
                key={stock.symbol}
                onClick={() => onSelectStock(stock.symbol)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  background: 'var(--bg-secondary)',
                  transition: 'background var(--transition-fast)'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{stock.symbol}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{stock.exchange}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="font-mono" style={{ fontWeight: 600, fontSize: '0.85rem' }}>₹{stock.price || '---'}</div>
                  <div className="text-loss font-mono" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                    {stock.change_pct}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Most Active by Volume */}
        <div className="glass-card" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-blue)' }}>
              <BarChart2 size={16} /> Most Active Stocks
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Volume Activity</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {mostActive.slice(0, 5).map((stock) => (
              <div
                key={stock.symbol}
                onClick={() => onSelectStock(stock.symbol)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  background: 'var(--bg-secondary)',
                  transition: 'background var(--transition-fast)'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{stock.symbol}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Vol: {stock.volume?.toLocaleString() || '---'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="font-mono" style={{ fontWeight: 600, fontSize: '0.85rem' }}>₹{stock.price || '---'}</div>
                  <span className={`badge ${(stock.change_pct || 0) >= 0 ? 'bg-gain' : 'bg-loss'}`} style={{ fontSize: '0.68rem' }}>
                    {(stock.change_pct || 0) >= 0 ? '+' : ''}{stock.change_pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
