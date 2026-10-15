import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import MarkdownRenderer from './MarkdownRenderer';
import {
  MessageSquare,
  Send,
  Sparkles,
  RotateCcw,
  Search,
  Database,
  TrendingUp,
  TrendingDown,
  Info,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Activity,
  Cpu,
  RefreshCw
} from 'lucide-react';

export default function AIAgentChat({
  initialSymbol = 'TCS',
  stocksList = [],
  title = 'Market Analysis & Research Assistant',
  subtitle = 'Interactive Indian Equity AI powered by official Google Gemini API and verified exchange data',
  onSelectStock
}) {
  const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol || 'TCS');
  const [messages, setMessages] = useState([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stockContext, setStockContext] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const [poolStatus, setPoolStatus] = useState(null);
  const [errorBanner, setErrorBanner] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load Gemini status on mount and auto-refresh
  const fetchStatus = () => {
    api.ai.chatStatus()
      .then((res) => {
        setPoolStatus(res.pool);
      })
      .catch((err) => {
        console.warn('Failed to check Gemini status:', err);
      });
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  // Update selectedSymbol when initialSymbol changes
  useEffect(() => {
    if (initialSymbol && initialSymbol !== selectedSymbol) {
      setSelectedSymbol(initialSymbol);
    }
  }, [initialSymbol]);

  // Suggested prompts
  const suggestedPrompts = selectedSymbol === 'MACRO'
    ? [
        'Analyze the current NIFTY 50 and SENSEX trend & momentum',
        'Which sectors are showing relative strength vs laggards?',
        'Break down market breadth and key risk factors for this week',
        'Explain current technical support and resistance levels for Indian benchmarks'
      ]
    : [
        `Evaluate ${selectedSymbol}'s debt solvency & balance sheet health`,
        `Break down Bullish vs Bearish technical scenarios for ${selectedSymbol}`,
        `Analyze trailing P/E valuation vs historical Return on Equity (RoE)`,
        `What are the key operational risks and catalysts for ${selectedSymbol}?`
      ];

  const handleSendMessage = async (textToSend = inputQuery) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isLoading) return;

    const userMessage = { role: 'user', content: trimmed, timestamp: new Date().toLocaleTimeString() };
    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInputQuery('');
    setIsLoading(true);
    setErrorBanner(null);

    try {
      const apiHistory = newHistory.map((m) => ({ role: m.role, content: m.content }));
      const sym = selectedSymbol === 'MACRO' ? null : selectedSymbol;

      const res = await api.ai.chat(trimmed, sym, apiHistory);

      if (res.pool_status) {
        setPoolStatus(res.pool_status);
      }

      if (res.stock_context) {
        setStockContext(res.stock_context);
      }
      if (res.scenarios && res.scenarios.length > 0) {
        setScenarios(res.scenarios);
      }

      if (res.pool_status) {
        setPoolStatus(res.pool_status);
      }

      if (res.success && res.reply) {
        const assistantMessage = {
          role: 'assistant',
          content: res.reply,
          timestamp: new Date().toLocaleTimeString(),
          keyMasked: res.key_masked,
          model: res.model
        };
        setMessages([...newHistory, assistantMessage]);
      } else {
        const errMsg = res.error || 'The AI assistant is temporarily unavailable. Please retry in a moment.';
        setErrorBanner(errMsg);
        const failMessage = {
          role: 'assistant',
          content: `⚠️ **Notice:** ${errMsg}`,
          timestamp: new Date().toLocaleTimeString(),
          isError: true
        };
        setMessages([...newHistory, failMessage]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      const errMsg = err.message || 'Network communication error connecting to AI agent.';
      setErrorBanner(errMsg);
      setMessages([
        ...newHistory,
        {
          role: 'assistant',
          content: `⚠️ **Error:** ${errMsg}`,
          timestamp: new Date().toLocaleTimeString(),
          isError: true
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages([]);
    setErrorBanner(null);
  };

  // Render assistant message content with clean formatting
  const renderFormattedContent = (content) => {
    const lines = content.split('\n');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} style={{ height: '4px' }} />;

          if (trimmed.startsWith('### ')) {
            return (
              <h4 key={idx} style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0' }}>
                {trimmed.replace('### ', '')}
              </h4>
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h3 key={idx} style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-blue)', margin: '6px 0' }}>
                {trimmed.replace('## ', '')}
              </h3>
            );
          }
          if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            return (
              <div key={idx} style={{ display: 'flex', gap: '8px', paddingLeft: '8px' }}>
                <span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>•</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {trimmed.substring(2)}
                </span>
              </div>
            );
          }
          return (
            <p key={idx} style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {line}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header Bar */}
      <div
        className="glass-card"
        style={{
          padding: '16px 20px',
          background: 'var(--banner-bg)',
          border: '1px solid var(--banner-border)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={20} style={{ color: 'var(--accent-blue)' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{title}</h3>
              <span className="badge badge-outline" style={{ fontSize: '0.7rem', borderColor: 'rgba(59, 130, 246, 0.5)', color: 'var(--accent-blue)' }}>
                Powered by Google Gemini
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {subtitle}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {poolStatus && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <Cpu size={14} style={{ color: poolStatus.active_available > 0 ? 'var(--gain-color)' : '#f59e0b' }} />
                <span>
                  {poolStatus.total_keys > 0
                    ? `Keys: ${poolStatus.active_available}/${poolStatus.total_keys} Active`
                    : 'Gemini Key Pending'}
                </span>
              </div>
            )}

            <button
              onClick={fetchStatus}
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
              title="Refresh Gemini key status from backend"
            >
              <RefreshCw size={12} /> Sync
            </button>

            <button
              onClick={handleResetChat}
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Clear chat session"
            >
              <RotateCcw size={12} /> New Chat
            </button>
          </div>
        </div>
      </div>

      {/* Target Selector & Context Toggle */}
      <div
        className="glass-card"
        style={{
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Research Target:
          </span>

          <select
            value={selectedSymbol}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedSymbol(val);
              if (onSelectStock && val !== 'MACRO') {
                onSelectStock(val);
              }
            }}
            className="input-field"
            style={{ width: 'auto', minWidth: '220px', fontSize: '0.82rem', padding: '6px 10px' }}
          >
            <option value="MACRO">🌐 Macro Indian Market Pulse (NIFTY & SENSEX)</option>
            <optgroup label="100-Stock Universe (NSE)">
              {stocksList.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol} — {s.name} ({s.sector_name})
                </option>
              ))}
            </optgroup>
          </select>

          {stockContext?.price && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
              <span className="font-mono" style={{ fontWeight: 800 }}>
                ₹{stockContext.price?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <span className={`badge ${(stockContext.change_pct || 0) >= 0 ? 'bg-gain' : 'bg-loss'}`} style={{ fontSize: '0.72rem' }}>
                {(stockContext.change_pct || 0) >= 0 ? '+' : ''}{stockContext.change_pct}%
              </span>
              {stockContext.debt_classification && (
                <span className="badge badge-outline" style={{ fontSize: '0.7rem' }}>
                  {stockContext.debt_classification}
                </span>
              )}
            </div>
          )}
        </div>

        {stockContext && (
          <button
            onClick={() => setShowContextDrawer(!showContextDrawer)}
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Database size={13} />
            {showContextDrawer ? 'Hide Grounded Data' : 'Inspect Grounded Data'}
            {showContextDrawer ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>

      {/* Grounded Data Inspection Drawer */}
      {showContextDrawer && stockContext && (
        <div
          className="glass-card"
          style={{
            padding: '16px 20px',
            background: 'var(--bg-secondary)',
            borderLeft: '4px solid var(--accent-blue)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <CheckCircle2 size={16} style={{ color: 'var(--accent-blue)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
              Live Data Injected into Gemini Context ({stockContext.symbol || 'MARKET'})
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', fontSize: '0.78rem' }}>
            <div style={{ padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Latest Price:</span>{' '}
              <strong className="font-mono">₹{stockContext.price || 'N/A'}</strong>
            </div>
            <div style={{ padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--text-muted)' }}>RSI(14):</span>{' '}
              <strong className="font-mono">{stockContext.rsi_14 ?? 'N/A'}</strong>
            </div>
            <div style={{ padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Moving Avg (SMA20):</span>{' '}
              <strong className="font-mono">₹{stockContext.sma_20 ?? 'N/A'}</strong>
            </div>
            <div style={{ padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Trailing P/E:</span>{' '}
              <strong className="font-mono">{stockContext.pe_ratio ? `${stockContext.pe_ratio}x` : 'N/A'}</strong>
            </div>
            <div style={{ padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Return on Equity (RoE):</span>{' '}
              <strong className="font-mono">{stockContext.roe_pct ? `${stockContext.roe_pct}%` : 'N/A'}</strong>
            </div>
            <div style={{ padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Debt-to-Equity:</span>{' '}
              <strong className="font-mono">{stockContext.debt_to_equity_ratio !== null ? `${stockContext.debt_to_equity_ratio}x` : 'N/A'}</strong>
              <div style={{ fontSize: '0.7rem', color: 'var(--accent-blue)', marginTop: '2px' }}>
                {stockContext.debt_classification || 'Verified Balance Sheet'}
              </div>
            </div>
            {stockContext.balance_sheet_debt?.total_debt && (
              <div style={{ padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-muted)' }}>Balance Sheet Audit:</span>{' '}
                <span>Total Debt: ₹{(stockContext.balance_sheet_debt.total_debt / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr vs Equity: ₹{(stockContext.balance_sheet_debt.stockholders_equity / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dynamic Model-Estimated Scenario Cards (if available) */}
      {scenarios.length > 0 && (
        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={16} style={{ color: 'var(--accent-blue)' }} /> Model-Estimated Scenarios ({selectedSymbol})
            </h4>
            <span className="badge badge-outline" style={{ fontSize: '0.68rem' }}>
              Dynamic Projections
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            {scenarios.map((sc, idx) => {
              const isBull = sc.case.includes('Bullish');
              const isBear = sc.case.includes('Bearish');
              return (
                <div
                  key={idx}
                  style={{
                    padding: '14px',
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
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isBull ? 'var(--gain-color)' : isBear ? 'var(--loss-color)' : 'var(--text-primary)' }}>
                        {sc.case}
                      </span>
                      {sc.implied_change_pct !== undefined && (
                        <span className={`badge ${sc.implied_change_pct >= 0 ? 'bg-gain' : 'bg-loss'}`} style={{ fontSize: '0.7rem' }}>
                          {sc.implied_change_pct >= 0 ? '+' : ''}{sc.implied_change_pct}%
                        </span>
                      )}
                    </div>

                    <div className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 800, margin: '8px 0', color: 'var(--text-primary)' }}>
                      {sc.target_price ? `₹${sc.target_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : sc.target_range}
                    </div>

                    {sc.target_range && sc.target_price && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        Band: {sc.target_range}
                      </div>
                    )}

                    {sc.assumptions && sc.assumptions.length > 0 && (
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
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

      {/* Suggested Prompt Chips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
          Suggested Research Inquiries:
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {suggestedPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(p)}
              disabled={isLoading}
              className="btn btn-secondary"
              style={{
                fontSize: '0.78rem',
                padding: '6px 12px',
                borderRadius: '16px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                textAlign: 'left'
              }}
            >
              💬 {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Stream */}
      <div
        className="glass-card"
        style={{
          minHeight: '360px',
          maxHeight: '520px',
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          background: 'var(--bg-card)'
        }}
      >
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', maxWidth: '440px', padding: '40px 0' }}>
            <MessageSquare size={36} style={{ color: 'var(--accent-blue)', opacity: 0.8, margin: '0 auto 12px' }} />
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Ask anything about {selectedSymbol === 'MACRO' ? 'Indian Markets' : selectedSymbol}
            </h4>
            <p style={{ fontSize: '0.8rem', marginTop: '6px', lineHeight: 1.5 }}>
              Inquire about technical momentum, balance sheet solvency, Trailing P/E multiples, Return on Equity, or Bullish vs Bearish scenarios.
            </p>
          </div>
        ) : (
          messages.map((m, idx) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: isUser ? '75%' : '88%'
                }}
              >
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: isUser
                      ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                      : m.isError
                      ? 'rgba(220, 38, 38, 0.1)'
                      : 'var(--bg-elevated)',
                    border: isUser
                      ? '1px solid rgba(37, 99, 235, 0.5)'
                      : m.isError
                      ? '1px solid rgba(220, 38, 38, 0.3)'
                      : '1px solid var(--border-subtle)',
                    color: isUser ? '#ffffff' : 'var(--text-primary)'
                  }}
                >
                  {isUser ? (
                    <div style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>{m.content}</div>
                  ) : (
                    <MarkdownRenderer content={m.content} />
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.68rem',
                    color: 'var(--text-muted)',
                    marginTop: '4px',
                    padding: '0 4px',
                    justifyContent: isUser ? 'flex-end' : 'flex-start'
                  }}
                >
                  <span>{m.timestamp}</span>
                  {m.keyMasked && <span>• Key {m.keyMasked}</span>}
                  {m.model && <span>• {m.model}</span>}
                </div>
              </div>
            );
          })
        )}

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-blue)', fontSize: '0.82rem', padding: '10px' }}>
            <Activity size={16} className="animate-spin" />
            <span>Consulting Google Gemini AI & analyzing grounded market data...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Query Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        style={{ display: 'flex', gap: '10px' }}
      >
        <input
          type="text"
          placeholder={`Ask about ${selectedSymbol === 'MACRO' ? 'market trends, NIFTY, sector matrix' : `${selectedSymbol} fundamentals, debt, technical targets`}...`}
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          disabled={isLoading}
          className="input-field"
          style={{ flex: 1, padding: '12px 16px', fontSize: '0.88rem' }}
        />

        <button
          type="submit"
          disabled={!inputQuery.trim() || isLoading}
          className="btn btn-primary"
          style={{ padding: '0 20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}
        >
          <Send size={16} /> Send
        </button>
      </form>

      {/* Safety & Educational Disclaimer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.72rem',
          color: 'var(--text-muted)'
        }}
      >
        <Info size={14} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
        <span>
          <strong>Educational Notice:</strong> VibeFinance AI Assistant provides research analysis grounded in public exchange disclosures. It does not provide SEBI-registered financial advisory services and does not issue direct buy, sell, or hold recommendations.
        </span>
      </div>
    </div>
  );
}
