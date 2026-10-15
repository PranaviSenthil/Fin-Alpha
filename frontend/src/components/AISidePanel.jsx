import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import MarkdownRenderer from './MarkdownRenderer';
import {
  Sparkles,
  Send,
  RotateCcw,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  X,
  Database,
  Activity,
  Cpu,
  AlertTriangle,
  Info,
  Maximize2,
  Minimize2,
  TrendingUp,
  Building2,
  Briefcase,
  Layers,
  ArrowRight
} from 'lucide-react';

export default function AISidePanel({
  section = 'stocks', // 'stocks' | 'markets' | 'ai' | 'portfolio'
  currentSymbol = 'TCS',
  allStocks = [],
  onSelectStock,
  isOpen = true,
  onToggleOpen,
  isMobile = false
}) {
  const [selectedSymbol, setSelectedSymbol] = useState(currentSymbol || 'TCS');
  const [messages, setMessages] = useState([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stockContext, setStockContext] = useState(null);
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const [poolStatus, setPoolStatus] = useState(null);
  const [errorBanner, setErrorBanner] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Sync selectedSymbol when currentSymbol prop changes
  useEffect(() => {
    if (currentSymbol && currentSymbol !== selectedSymbol) {
      setSelectedSymbol(currentSymbol);
    }
  }, [currentSymbol]);

  // Load Gemini pool status
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
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // Section-specific titles, badges, and suggested prompts
  const getSectionConfig = () => {
    switch (section) {
      case 'markets':
        return {
          title: 'Market Pulse Agent',
          badge: 'Macro & Sector Breadth',
          placeholder: 'Ask about NIFTY, SENSEX, sector momentum, or volatility...',
          prompts: [
            'What is the current NIFTY 50 and SENSEX trend?',
            'Which sectors are showing relative strength today?',
            'Analyze market volatility and key support levels',
            'Explain Indian benchmark market breadth this week'
          ]
        };
      case 'portfolio':
        return {
          title: 'Portfolio Research Agent',
          badge: 'Holdings & Risk Audit',
          placeholder: 'Ask about your holdings, unrealized P&L, or cash allocation...',
          prompts: [
            'How is my overall portfolio performing today?',
            'What is my sector allocation and concentration risk?',
            'Analyze my active stock holdings and cash balance',
            'What factors should I research before rebalancing?'
          ]
        };
      case 'ai':
        return {
          title: 'AI Intelligence Agent',
          badge: 'Deep Equity & Multi-Agent',
          placeholder: `Ask fundamental, valuation, or comparison questions...`,
          prompts: [
            `Compare ${selectedSymbol || 'TCS'} valuation with sector peers`,
            `Explain the difference between ROE and ROCE for ${selectedSymbol || 'TCS'}`,
            `What are the major structural business risks for ${selectedSymbol || 'TCS'}?`,
            `Evaluate debt solvency and cash flow for ${selectedSymbol || 'TCS'}`
          ]
        };
      case 'stocks':
      default:
        return {
          title: 'Stock Intelligence Agent',
          badge: selectedSymbol ? `${selectedSymbol} Active` : 'NSE Equities',
          placeholder: selectedSymbol
            ? `Ask anything about ${selectedSymbol} (business, P/E, RSI, trends)...`
            : 'Select a stock or ask a question...',
          prompts: selectedSymbol
            ? [
                `What does ${selectedSymbol} do?`,
                `What is ${selectedSymbol}'s current P/E ratio?`,
                `Explain ${selectedSymbol}'s RSI in simple terms`,
                `Is ${selectedSymbol} trading above its 50-day moving average?`,
                `What are the main risks associated with ${selectedSymbol}?`,
                `How does ${selectedSymbol} compare with Infosys?`
              ]
            : [
                'What does TCS do?',
                'Explain P/E ratio vs historical range',
                'What is RSI and how is it used?',
                'Which Indian IT stocks have the lowest debt?'
              ]
        };
    }
  };

  const config = getSectionConfig();

  const handleSendMessage = async (textToSend = inputQuery) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isLoading) return;

    const userMessage = {
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInputQuery('');
    setIsLoading(true);
    setErrorBanner(null);

    try {
      const apiHistory = newHistory.map((m) => ({ role: m.role, content: m.content }));
      const symToSend = section === 'markets' ? null : (selectedSymbol === 'MACRO' ? null : selectedSymbol);

      const res = await api.ai.chat(trimmed, symToSend, apiHistory, null, section);

      if (res.pool_status) {
        setPoolStatus(res.pool_status);
      }
      if (res.stock_context) {
        setStockContext(res.stock_context);
      }

      if (res.success && res.reply) {
        const assistantMessage = {
          role: 'assistant',
          content: res.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true
        };
        setMessages([...newHistory, failMessage]);
      }
    } catch (err) {
      console.error('AI chat error:', err);
      const errMsg = err.message || 'Network communication error connecting to AI agent.';
      setErrorBanner(errMsg);
      setMessages([
        ...newHistory,
        {
          role: 'assistant',
          content: `⚠️ **Error:** ${errMsg}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleResetChat = () => {
    setMessages([]);
    setErrorBanner(null);
  };

  // If collapsed on desktop, show a compact vertical expander bar
  if (collapsed && !isMobile) {
    return (
      <div
        onClick={() => setCollapsed(false)}
        className="glass-card"
        style={{
          width: '48px',
          height: 'calc(100vh - 120px)',
          position: 'sticky',
          top: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 0',
          cursor: 'pointer',
          border: '1px solid var(--border-subtle)',
          background: 'var(--bg-card)',
          transition: 'all 0.2s ease',
          userSelect: 'none'
        }}
        title="Click to open AI Research Assistant panel"
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} style={{ color: 'var(--accent-blue)' }} />
          <ChevronLeft size={16} style={{ color: 'var(--text-muted)' }} />
        </div>
        <div
          style={{
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            fontSize: '0.78rem',
            fontWeight: 700,
            letterSpacing: '1px',
            color: 'var(--text-secondary)'
          }}
        >
          {config.title} • {selectedSymbol || 'RESEARCH'}
        </div>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: poolStatus?.active_available > 0 ? 'var(--gain-color)' : '#f59e0b' }} />
      </div>
    );
  }

  return (
    <div
      className="glass-card ai-side-panel"
      style={{
        width: isMobile ? '100%' : '390px',
        maxWidth: isMobile ? '100%' : '390px',
        height: isMobile ? '100%' : 'calc(100vh - 120px)',
        position: isMobile ? 'relative' : 'sticky',
        top: isMobile ? '0' : '24px',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: isMobile ? '0' : 'var(--radius-md, 12px)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        zIndex: isMobile ? 1000 : 30
      }}
    >
      {/* 1. Header Bar */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(37, 99, 235, 0.15) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Sparkles size={16} style={{ color: 'var(--accent-blue)' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {config.title}
              </h4>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>Gemini AI</span>
              <span>•</span>
              <span style={{ color: poolStatus?.active_available > 0 ? 'var(--gain-color)' : '#f59e0b' }}>
                {poolStatus?.active_available > 0 ? 'Online' : 'Pending Key'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={handleResetChat}
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.7rem', height: '28px' }}
            title="Reset conversation"
          >
            <RotateCcw size={12} />
          </button>
          {isMobile ? (
            <button
              onClick={onToggleOpen}
              className="btn btn-secondary"
              style={{ padding: '4px 8px', fontSize: '0.7rem', height: '28px' }}
              title="Close Panel"
            >
              <X size={14} />
            </button>
          ) : (
            <button
              onClick={() => setCollapsed(true)}
              className="btn btn-secondary"
              style={{ padding: '4px 8px', fontSize: '0.7rem', height: '28px' }}
              title="Collapse to side tab"
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Context & Stock Selector Bar */}
      <div
        style={{
          padding: '8px 14px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Target:
          </span>
          {section === 'markets' ? (
            <span className="badge badge-fresh" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
              🌐 Indian Macro Market Pulse
            </span>
          ) : section === 'portfolio' ? (
            <span className="badge badge-outline" style={{ fontSize: '0.72rem', padding: '2px 8px', borderColor: 'rgba(59, 130, 246, 0.4)' }}>
              💼 User Portfolio & Active Holdings
            </span>
          ) : (
            <select
              value={selectedSymbol || ''}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedSymbol(val);
                if (onSelectStock) onSelectStock(val);
              }}
              className="input-field"
              style={{
                fontSize: '0.75rem',
                padding: '4px 8px',
                height: '28px',
                minWidth: '120px',
                flex: 1,
                borderRadius: '6px'
              }}
            >
              {allStocks.length > 0 ? (
                allStocks.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol} ({s.name})
                  </option>
                ))
              ) : (
                <option value={selectedSymbol || 'TCS'}>{selectedSymbol || 'TCS'}</option>
              )}
            </select>
          )}
        </div>

        {stockContext && (
          <button
            onClick={() => setShowContextDrawer(!showContextDrawer)}
            className="btn btn-secondary"
            style={{ padding: '3px 8px', fontSize: '0.68rem', height: '26px', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Inspect verified figures fed to Gemini"
          >
            <Database size={11} />
            <span>Data</span>
            {showContextDrawer ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        )}
      </div>

      {/* 3. Grounded Data Drawer (if toggled) */}
      {showContextDrawer && stockContext && (
        <div
          style={{
            padding: '10px 14px',
            background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border-subtle)',
            maxHeight: '160px',
            overflowY: 'auto',
            fontSize: '0.72rem'
          }}
        >
          <div style={{ fontWeight: 700, color: 'var(--accent-blue)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Database size={12} /> Grounded Exchange Context ({stockContext.symbol || 'ACTIVE'})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Price:</span>{' '}
              <strong className="font-mono">₹{stockContext.price || 'N/A'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>RSI(14):</span>{' '}
              <strong className="font-mono">{stockContext.rsi_14 ?? 'N/A'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>SMA 50:</span>{' '}
              <strong className="font-mono">₹{stockContext.sma_50 ?? 'N/A'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Trailing P/E:</span>{' '}
              <strong className="font-mono">{stockContext.pe_ratio ? `${stockContext.pe_ratio}x` : 'N/A'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>RoE:</span>{' '}
              <strong className="font-mono">{stockContext.roe_pct ? `${stockContext.roe_pct}%` : 'N/A'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Debt/Eq:</span>{' '}
              <strong className="font-mono">{stockContext.debt_to_equity_ratio !== null ? `${stockContext.debt_to_equity_ratio}x` : 'N/A'}</strong>
            </div>
          </div>
        </div>
      )}

      {/* 4. Scrollable Chat Conversation Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        {messages.length === 0 ? (
          <div style={{ margin: 'auto 0', textAlign: 'center', padding: '20px 10px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px'
              }}
            >
              <Sparkles size={20} style={{ color: 'var(--accent-blue)' }} />
            </div>
            <h5 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
              {section === 'markets' ? 'Indian Markets AI Assistant' : section === 'portfolio' ? 'Portfolio Intelligence' : `${selectedSymbol || 'Stock'} Research Assistant`}
            </h5>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '16px' }}>
              Ask specific questions about business models, valuation multiples, technical momentum, or compare stocks.
            </p>

            {/* Quick Prompt Chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Suggested Questions:
              </span>
              {config.prompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(p)}
                  disabled={isLoading}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.76rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent-blue)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  <span>{p}</span>
                  <ArrowRight size={12} style={{ color: 'var(--accent-blue)', opacity: 0.7, flexShrink: 0 }} />
                </button>
              ))}
            </div>
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
                  maxWidth: isUser ? '85%' : '94%',
                  gap: '3px'
                }}
              >
                <div
                  style={{
                    padding: isUser ? '10px 14px' : '12px 14px',
                    borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
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
                    boxShadow: isUser ? '0 2px 8px rgba(37, 99, 235, 0.25)' : 'none'
                  }}
                >
                  {isUser ? (
                    <div style={{ fontSize: '0.84rem', color: '#ffffff', lineHeight: 1.45 }}>{m.content}</div>
                  ) : (
                    <MarkdownRenderer content={m.content} />
                  )}
                </div>

                <div
                  style={{
                    fontSize: '0.65rem',
                    color: 'var(--text-muted)',
                    padding: '0 4px',
                    alignSelf: isUser ? 'flex-end' : 'flex-start'
                  }}
                >
                  {m.timestamp}
                </div>
              </div>
            );
          })
        )}

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <Activity size={14} className="animate-spin" style={{ color: 'var(--accent-blue)' }} />
            <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              Analyzing verified data with Gemini...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 5. Fixed Input Bar at Bottom */}
      <div
        style={{
          padding: '12px 14px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={config.placeholder}
            disabled={isLoading}
            className="input-field"
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '0.82rem',
              resize: 'none',
              borderRadius: '8px',
              maxHeight: '80px',
              minHeight: '36px',
              lineHeight: 1.4
            }}
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isLoading}
            className="btn btn-primary"
            style={{
              height: '36px',
              padding: '0 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px'
            }}
            title="Send query"
          >
            <Send size={15} />
          </button>
        </form>

        <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3 }}>
          Educational research assistant • Not SEBI financial advice
        </div>
      </div>
    </div>
  );
}
