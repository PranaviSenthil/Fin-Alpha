import React, { useState, useMemo, useEffect } from 'react';
import { api } from '../api/client';
import {
  Search,
  Filter,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  LayoutGrid,
  List,
  Sparkles,
  BarChart3,
  ShieldAlert,
  RotateCcw,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Building2,
  DollarSign,
  UploadCloud,
  BookOpen,
  Scale,
  Send,
  X,
  Plus
} from 'lucide-react';
import AISidePanel from '../components/AISidePanel';

export default function StocksView({ stocks = [], onSelectStock, onOpenOrder, sectors = [] }) {
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'research'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState('');
  const [selectedExchange, setSelectedExchange] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'gainers' | 'losers'
  const [sortBy, setSortBy] = useState('market_cap');
  const [sortOrder, setSortOrder] = useState('desc');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'

  // Financial Research Agent & RAG state
  const [researchSymbol, setResearchSymbol] = useState('TCS');
  const [selectedStockForAI, setSelectedStockForAI] = useState('TCS');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [researchData, setResearchData] = useState(null);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchError, setResearchError] = useState(null);
  const [researchQuery, setResearchQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');

  // Ingest Document Modal state
  const [ingestModalOpen, setIngestModalOpen] = useState(false);
  const [ingestForm, setIngestForm] = useState({
    title: '',
    doc_type: 'annual_report',
    publisher: 'Company Investor Relations',
    source_url: '',
    publication_date: new Date().toISOString().split('T')[0],
    page_or_section: '',
    content: ''
  });
  const [uploadFile, setUploadFile] = useState(null);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestSuccess, setIngestSuccess] = useState(null);
  const [ingestError, setIngestError] = useState(null);

  const filteredStocks = useMemo(() => {
    return stocks.filter((s) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchSym = s.symbol.toLowerCase().includes(term);
        const matchName = s.name.toLowerCase().includes(term);
        const matchSub = s.subsector?.toLowerCase().includes(term);
        if (!matchSym && !matchName && !matchSub) return false;
      }
      if (selectedSector && s.sector_id !== selectedSector) return false;
      if (selectedExchange && s.exchange !== selectedExchange) return false;
      if (filterType === 'gainers' && (s.change_pct || 0) <= 0) return false;
      if (filterType === 'losers' && (s.change_pct || 0) >= 0) return false;
      return true;
    }).sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];
      if (valA === undefined || valA === null) valA = 0;
      if (valB === undefined || valB === null) valB = 0;
      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [stocks, searchTerm, selectedSector, selectedExchange, filterType, sortBy, sortOrder]);

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const fetchResearch = async (symbol, query = null) => {
    setResearchLoading(true);
    setResearchError(null);
    try {
      const res = await api.ai.financialAgent(symbol, query);
      setResearchData(res);
      setActiveQuery(query || '');
    } catch (err) {
      console.error('Error fetching financial research:', err);
      setResearchError(err.message || 'Failed to generate financial research report.');
    } finally {
      setResearchLoading(false);
    }
  };

  const handleQuerySubmit = (e) => {
    if (e) e.preventDefault();
    if (!researchQuery.trim()) return;
    fetchResearch(researchSymbol, researchQuery.trim());
  };

  const handleSeedCorpus = async () => {
    try {
      await api.ai.seedDocuments();
      fetchResearch(researchSymbol, researchQuery);
    } catch (err) {
      console.error('Failed to seed corpus:', err);
    }
  };

  const handleIngestSubmit = async (e) => {
    e.preventDefault();
    setIngestLoading(true);
    setIngestError(null);
    setIngestSuccess(null);
    try {
      if (uploadFile) {
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('symbol', researchSymbol);
        formData.append('title', ingestForm.title || uploadFile.name);
        formData.append('doc_type', ingestForm.doc_type);
        formData.append('publisher', ingestForm.publisher);
        if (ingestForm.source_url) formData.append('source_url', ingestForm.source_url);
        if (ingestForm.publication_date) formData.append('publication_date', ingestForm.publication_date);
        if (ingestForm.page_or_section) formData.append('page_or_section', ingestForm.page_or_section);

        const res = await api.ai.uploadDocument(formData);
        setIngestSuccess(res.message || 'Document uploaded and chunked successfully!');
      } else {
        if (!ingestForm.content.trim()) {
          throw new Error('Please enter document content or select a file to upload.');
        }
        const res = await api.ai.ingestDocument({
          symbol: researchSymbol,
          title: ingestForm.title,
          doc_type: ingestForm.doc_type,
          publisher: ingestForm.publisher,
          source_url: ingestForm.source_url || undefined,
          publication_date: ingestForm.publication_date || undefined,
          page_or_section: ingestForm.page_or_section || undefined,
          content: ingestForm.content
        });
        setIngestSuccess(res.message || 'Document ingested and indexed successfully!');
      }

      setTimeout(() => {
        setIngestModalOpen(false);
        setUploadFile(null);
        setIngestForm({
          title: '',
          doc_type: 'annual_report',
          publisher: 'Company Investor Relations',
          source_url: '',
          publication_date: new Date().toISOString().split('T')[0],
          page_or_section: '',
          content: ''
        });
        setIngestSuccess(null);
        fetchResearch(researchSymbol, researchQuery);
      }, 1200);
    } catch (err) {
      setIngestError(err.message || 'Failed to ingest document.');
    } finally {
      setIngestLoading(false);
    }
  };

  const handleOpenResearchForStock = (symbol) => {
    setResearchSymbol(symbol);
    setSelectedStockForAI(symbol);
    setActiveTab('research');
    fetchResearch(symbol);
  };

  useEffect(() => {
    if (activeTab === 'research' && !researchData) {
      fetchResearch(researchSymbol);
    }
  }, [activeTab]);

  const supporting = researchData?.supporting_data || {};
  const swot = supporting.swot_analysis || {};
  const verifiedMetrics = supporting.verified_metrics || [];
  const estimatedMetrics = supporting.estimated_metrics || [];
  const announcements = supporting.announcements || [];
  const scenarios = researchData?.scenarios || [];
  const sources = researchData?.sources || [];
  const risks = researchData?.risks_and_limitations || [];
  const docCitations = sources.filter((s) => s.citation_id);
  const ragSynthesis = supporting.rag_synthesis;
  const conflictingEvidence = researchData?.conflicting_evidence || supporting.conflicting_evidence || [];
  const retrievalStatus = researchData?.retrieval_status || supporting.retrieval_status;

  return (
    <div className="section-layout-wrapper" style={{ paddingBottom: '40px' }}>
      {/* Left Column: Main Stocks Content */}
      <div className="section-main-column">
        {/* Header with Navigation Toggle */}
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
                <BarChart3 size={22} style={{ color: 'var(--accent-blue)' }} /> Stock Directory & Corporate Research
              </h2>
              <span className="badge badge-outline" style={{ borderColor: 'rgba(59, 130, 246, 0.5)', color: 'var(--accent-blue)' }}>
                Stocks Hub
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Full 100-constituent Indian screener with integrated Financial Research Agent
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
            <button
              onClick={() => setActiveTab('directory')}
              className={`btn btn-secondary ${activeTab === 'directory' ? 'badge-fresh' : ''}`}
              style={{ fontSize: '0.8rem', padding: '6px 14px' }}
            >
              <List size={14} /> Stock Screener (100)
            </button>
            <button
              onClick={() => {
                setActiveTab('research');
                if (!researchData) fetchResearch(researchSymbol);
              }}
              className={`btn btn-secondary ${activeTab === 'research' ? 'badge-fresh' : ''}`}
              style={{ fontSize: '0.8rem', padding: '6px 14px' }}
            >
              <Sparkles size={14} /> Financial Research Agent
            </button>
          </div>
        </div>
      </div>

      {/* --- SUBTAB 1: DIRECTORY & SCREENER --- */}
      {activeTab === 'directory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Controls Bar */}
          <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Showing <strong>{filteredStocks.length}</strong> of 100 verified Indian stocks
              </span>

              {/* View Mode Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
                <button
                  onClick={() => setViewMode('table')}
                  className={`btn btn-secondary ${viewMode === 'table' ? 'badge-fresh' : ''}`}
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                >
                  <List size={14} /> Table
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`btn btn-secondary ${viewMode === 'grid' ? 'badge-fresh' : ''}`}
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                >
                  <LayoutGrid size={14} /> Cards
                </button>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search ticker, name, or subsector..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: '32px' }}
                />
              </div>

              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="input-field"
                style={{ width: 'auto', minWidth: '180px' }}
              >
                <option value="">All 10 Sectors</option>
                {sectors.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name} ({sec.stock_count || 10})
                  </option>
                ))}
              </select>

              <select
                value={selectedExchange}
                onChange={(e) => setSelectedExchange(e.target.value)}
                className="input-field"
                style={{ width: 'auto' }}
              >
                <option value="">All Exchanges</option>
                <option value="NSE">NSE Only</option>
                <option value="BSE">BSE Only</option>
              </select>

              <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '2px', borderRadius: 'var(--radius-sm)' }}>
                {['all', 'gainers', 'losers'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`btn btn-secondary ${filterType === type ? 'badge-fresh' : ''}`}
                    style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table View */}
          {viewMode === 'table' ? (
            <div className="glass-card" style={{ padding: '0', overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => toggleSort('symbol')} style={{ cursor: 'pointer' }}>
                      Symbol <ArrowUpDown size={12} style={{ display: 'inline' }} />
                    </th>
                    <th onClick={() => toggleSort('name')} style={{ cursor: 'pointer' }}>
                      Company Name <ArrowUpDown size={12} style={{ display: 'inline' }} />
                    </th>
                    <th>Sector</th>
                    <th onClick={() => toggleSort('price')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                      Price (₹) <ArrowUpDown size={12} style={{ display: 'inline' }} />
                    </th>
                    <th onClick={() => toggleSort('change_pct')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                      24h Change <ArrowUpDown size={12} style={{ display: 'inline' }} />
                    </th>
                    <th style={{ textAlign: 'center' }}>AI Research</th>
                    <th style={{ textAlign: 'right' }}>Trade</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStocks.map((stock) => {
                    const isUp = (stock.change_pct || 0) >= 0;
                    return (
                      <tr key={stock.symbol} style={{ cursor: 'pointer' }} onClick={() => { setSelectedStockForAI(stock.symbol); if (onSelectStock) onSelectStock(stock.symbol); }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong className="font-mono">{stock.symbol}</strong>
                            <span className="badge badge-outline" style={{ fontSize: '0.65rem' }}>{stock.exchange}</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{stock.name}</td>
                        <td>
                          <span className="badge badge-outline" style={{ fontSize: '0.7rem' }}>{stock.sector_name}</span>
                        </td>
                        <td className="font-mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                          ₹{stock.price ? stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '---'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={`badge ${isUp ? 'bg-gain' : 'bg-loss'}`}>
                            {isUp ? '+' : ''}{stock.change_pct || 0}%
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenResearchForStock(stock.symbol)}
                            className="btn btn-secondary"
                            style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title="Open Financial Research Agent report"
                          >
                            <Sparkles size={12} color="var(--accent-blue)" /> Research
                          </button>
                        </td>
                        <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              className="btn btn-buy"
                              style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                              onClick={() => onOpenOrder && onOpenOrder(stock, 'BUY')}
                            >
                              Buy
                            </button>
                            <button
                              className="btn btn-sell"
                              style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                              onClick={() => onOpenOrder && onOpenOrder(stock, 'SELL')}
                            >
                              Sell
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Grid View */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
              {filteredStocks.map((stock) => {
                const isUp = (stock.change_pct || 0) >= 0;
                return (
                  <div
                    key={stock.symbol}
                    className="glass-card"
                    style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer' }}
                    onClick={() => { setSelectedStockForAI(stock.symbol); if (onSelectStock) onSelectStock(stock.symbol); }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ fontSize: '1rem' }}>{stock.symbol}</strong>
                          <span className="badge badge-outline">{stock.exchange}</span>
                        </div>
                        <span className={`badge ${isUp ? 'bg-gain' : 'bg-loss'}`}>
                          {isUp ? '+' : ''}{stock.change_pct || 0}%
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                        {stock.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <span className="font-mono" style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                          ₹{stock.price ? stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '---'}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {stock.sector_name}
                        </span>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenResearchForStock(stock.symbol)}
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Sparkles size={12} color="var(--accent-blue)" /> Research
                      </button>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          className="btn btn-buy"
                          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                          onClick={() => onOpenOrder && onOpenOrder(stock, 'BUY')}
                        >
                          Buy
                        </button>
                        <button
                          className="btn btn-sell"
                          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                          onClick={() => onOpenOrder && onOpenOrder(stock, 'SELL')}
                        >
                          Sell
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- SUBTAB 2: FINANCIAL RESEARCH AGENT --- */}
      {activeTab === 'research' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* RAG Research Controls & Question Input */}
          <div className="glass-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Target Company:
                </span>
                <select
                  value={researchSymbol}
                  onChange={(e) => {
                    setResearchSymbol(e.target.value);
                    fetchResearch(e.target.value, researchQuery);
                  }}
                  className="input-field"
                  style={{ width: 'auto', minWidth: '240px', padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  {stocks.map((s) => (
                    <option key={s.symbol} value={s.symbol}>
                      {s.symbol} — {s.name} ({s.sector_name})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setIngestModalOpen(true)}
                  className="btn btn-primary"
                  style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <UploadCloud size={14} /> Ingest Financial Document
                </button>
                <button
                  onClick={handleSeedCorpus}
                  className="btn btn-secondary"
                  title="Seed official sample filings for TCS, Reliance, Infosys & HDFC Bank"
                  style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <BookOpen size={14} /> Load Authentic Disclosures
                </button>
                <button
                  onClick={() => fetchResearch(researchSymbol, researchQuery)}
                  disabled={researchLoading}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <RotateCcw size={14} className={researchLoading ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>
            </div>

            {/* Natural Language Financial Question Input Form */}
            <form onSubmit={handleQuerySubmit} style={{ display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={researchQuery}
                  onChange={(e) => setResearchQuery(e.target.value)}
                  placeholder={`Ask a specific question about ${researchSymbol}'s filings (e.g., 'What are the operating margins and AI pipeline?')`}
                  className="input-field"
                  style={{ paddingLeft: '38px', fontSize: '0.85rem' }}
                />
              </div>
              <button
                type="submit"
                disabled={researchLoading || !researchQuery.trim()}
                className="btn btn-primary"
                style={{ fontSize: '0.82rem', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Send size={14} /> Query RAG
              </button>
            </form>

            {/* Quick Prompt Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Quick Filings Focus:</span>
              {[
                'Operating margins and forward guidance',
                'AI and cloud transformation pipeline',
                'Balance sheet debt and capital allocation',
                'Major business risks and disclosures'
              ].map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setResearchQuery(chip);
                    fetchResearch(researchSymbol, chip);
                  }}
                  className="badge badge-outline"
                  style={{ cursor: 'pointer', background: 'transparent', fontSize: '0.68rem', padding: '3px 8px' }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Loading */}
          {researchLoading && (
            <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Building2 size={32} className="animate-spin" style={{ color: 'var(--accent-blue)', margin: '0 auto 12px' }} />
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Generating Deep Financial Research Report...
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Analyzing balance sheet solvency, trailing P/E multiples, audited RoE, and regulatory disclosures...
              </p>
            </div>
          )}

          {/* Error */}
          {researchError && !researchLoading && (
            <div className="glass-card" style={{ padding: '24px', borderLeft: '4px solid var(--loss-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--loss-color)', fontWeight: 700 }}>
                <ShieldAlert size={18} /> Research Limitation
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px' }}>{researchError}</p>
            </div>
          )}

          {/* Loaded Report */}
          {researchData && !researchLoading && (
            <>
              {/* Document Corpus Status & Missing-Source Notification */}
              {retrievalStatus === 'corpus_empty' && (
                <div
                  className="glass-card"
                  style={{
                    padding: '16px 20px',
                    borderLeft: '4px solid #f59e0b',
                    background: 'rgba(245, 158, 11, 0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <AlertTriangle size={20} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f59e0b' }}>
                        Document Corpus Empty for {researchSymbol}
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        No official corporate filings, earnings transcripts, or exchange notices have been ingested for {researchSymbol} yet.
                        The quantitative fundamentals below reflect live/cached market data.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIngestModalOpen(true)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.74rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <UploadCloud size={14} /> Ingest {researchSymbol} Filing
                  </button>
                </div>
              )}

              {/* Contradictory Evidence & Conflict Detection Card */}
              {conflictingEvidence && conflictingEvidence.length > 0 && (
                <div className="glass-card" style={{ padding: '18px 20px', borderLeft: '4px solid #f59e0b', background: 'rgba(245, 158, 11, 0.04)' }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Scale size={18} /> Disclosure Divergence Preserved (Conflicting Filing Statements)
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    The RAG pipeline isolated diverging disclosures across different filing dates. Neither statement is suppressed:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {conflictingEvidence.map((conf, cIdx) => (
                      <div key={cIdx} style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(245, 158, 11, 0.25)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: '4px' }}>{conf.topic}</div>
                        <div>{conf.explanation}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* RAG Evidence Grounded Synthesis Card */}
              {ragSynthesis && (
                <div
                  className="glass-card"
                  style={{
                    padding: '20px',
                    borderLeft: '4px solid var(--accent-blue)',
                    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sparkles size={18} style={{ color: 'var(--accent-blue)' }} />
                      <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Document-Grounded Research Synthesis
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <span className="badge badge-outline" style={{ fontSize: '0.68rem', borderColor: 'var(--accent-blue)', color: 'var(--accent-blue)' }}>
                        {supporting.llm_synthesis_status === 'gemini_synthesized' ? '✓ Google Gemini Grounded' : '✓ Deterministic Grounded'}
                      </span>
                      {activeQuery && (
                        <span className="badge badge-outline" style={{ fontSize: '0.68rem' }}>
                          Query: "{activeQuery.length > 25 ? activeQuery.slice(0, 25) + '...' : activeQuery}"
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.65, whiteSpace: 'pre-line' }}>
                    {ragSynthesis}
                  </div>
                </div>
              )}

              {/* Executive Summary Card */}
              <div
                className="glass-card"
                style={{
                  padding: '20px',
                  borderLeft: `4px solid ${
                    (researchData.signal || '').includes('Strong') ? 'var(--gain-color)' :
                    (researchData.signal || '').includes('Caution') || (researchData.signal || '').includes('Stretched') ? 'var(--loss-color)' :
                    'var(--accent-blue)'
                  }`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                        {supporting.company_name} ({researchData.entity})
                      </span>
                      <span
                        className={`badge ${
                          (researchData.signal || '').includes('Strong') ? 'bg-gain' :
                          (researchData.signal || '').includes('Caution') ? 'bg-loss' :
                          'badge-outline'
                        }`}
                        style={{ fontSize: '0.85rem', fontWeight: 700 }}
                      >
                        {researchData.signal}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginTop: '6px' }}>
                      <span className="font-mono" style={{ fontSize: '1.6rem', fontWeight: 800 }}>
                        ₹{supporting.current_price?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Sector: <strong>{supporting.sector}</strong> ({supporting.subsector})
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="badge badge-fresh">Freshness: {researchData.data_freshness}</span>
                    {researchData.confidence && (
                      <span className="badge badge-outline">
                        Confidence: {Math.round((researchData.confidence.score || 0) * 100)}%
                      </span>
                    )}
                  </div>
                </div>

                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '12px', lineHeight: 1.6 }}>
                  {researchData.summary}
                </p>

                {/* Business summary */}
                <div style={{ marginTop: '14px', padding: '12px 14px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong>Corporate Profile:</strong> {supporting.business_summary}
                </div>
              </div>

              {/* Verified vs Estimated Financial Data Verification Badges */}
              <div className="glass-card" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <CheckCircle2 size={18} style={{ color: 'var(--gain-color)' }} /> Verified Disclosures vs. Model Estimations
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  {verifiedMetrics.map((vm, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(0, 208, 156, 0.05)',
                        border: '1px solid rgba(0, 208, 156, 0.25)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{vm.metric}</div>
                        <div className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '2px' }}>
                          {String(vm.value)}
                        </div>
                      </div>
                      <span className="badge bg-gain" style={{ fontSize: '0.65rem' }}>{vm.status}</span>
                    </div>
                  ))}

                  {estimatedMetrics.map((em, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(245, 158, 11, 0.05)',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{em.metric}</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '2px' }}>
                          {String(em.value)}
                        </div>
                      </div>
                      <span className="badge" style={{ background: '#f59e0b', color: '#000', fontSize: '0.65rem' }}>{em.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fundamental Metrics Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                <div className="glass-card" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>TRAILING P/E</span>
                  <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px' }}>
                    {supporting.pe_ratio ? `${supporting.pe_ratio}x` : 'N/A'}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{supporting.valuation_verdict}</span>
                </div>

                <div className="glass-card" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>PRICE TO BOOK (P/B)</span>
                  <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px' }}>
                    {supporting.pb_ratio ? `${supporting.pb_ratio}x` : 'N/A'}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Book Value Multiple</span>
                </div>

                <div className="glass-card" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>RETURN ON EQUITY (ROE)</span>
                  <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px', color: (supporting.roe || 0) > 18 ? 'var(--gain-color)' : 'var(--text-primary)' }}>
                    {supporting.roe ? `${supporting.roe}%` : 'N/A'}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Shareholder capital efficiency</span>
                </div>

                <div className="glass-card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>DEBT-TO-EQUITY</span>
                    {supporting.debt_classification && (
                      <span
                        className={`badge ${
                          supporting.debt_classification.includes('Low') ? 'bg-gain' :
                          supporting.debt_classification.includes('Moderate') ? 'badge-outline' :
                          supporting.debt_classification.includes('High') ? 'bg-loss' :
                          'badge-outline'
                        }`}
                        style={{ fontSize: '0.62rem', padding: '2px 6px' }}
                      >
                        {supporting.debt_classification}
                      </span>
                    )}
                  </div>
                  <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px', color: (supporting.debt_to_equity || 0) > 2.0 ? 'var(--loss-color)' : (supporting.debt_to_equity || 0) <= 0.5 ? 'var(--gain-color)' : 'var(--text-primary)' }}>
                    {supporting.debt_to_equity !== null && supporting.debt_to_equity !== undefined ? `${supporting.debt_to_equity}x` : 'Prudent (<0.8x)'}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {supporting.balance_sheet_debt?.total_debt
                      ? `Debt ₹${(supporting.balance_sheet_debt.total_debt / 1e7).toFixed(0)} Cr / Eq ₹${(supporting.balance_sheet_debt.stockholders_equity / 1e7).toFixed(0)} Cr`
                      : 'Balance Sheet Solvency'}
                  </span>
                </div>

                <div className="glass-card" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>MARKET CAPITALIZATION</span>
                  <div className="font-mono" style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '4px' }}>
                    ₹{supporting.market_cap ? (supporting.market_cap / 1e7).toLocaleString('en-IN', { maximumFractionDigits: 0 }) + ' Cr' : 'Large-Cap'}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>NSE Benchmark Weight</span>
                </div>
              </div>

              {/* SWOT Analysis */}
              <div className="glass-card" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <FileText size={18} style={{ color: 'var(--accent-blue)' }} /> Strategic SWOT Analysis
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                  {/* Strengths */}
                  <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', background: 'rgba(0, 208, 156, 0.05)', border: '1px solid rgba(0, 208, 156, 0.2)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--gain-color)', marginBottom: '8px' }}>STRENGTHS</div>
                    <ul style={{ paddingLeft: '16px', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {swot.strengths?.map((item, idx) => <li key={idx}>{item}</li>)}
                    </ul>
                  </div>

                  {/* Weaknesses */}
                  <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', background: 'rgba(235, 91, 60, 0.05)', border: '1px solid rgba(235, 91, 60, 0.2)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--loss-color)', marginBottom: '8px' }}>WEAKNESSES</div>
                    <ul style={{ paddingLeft: '16px', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {swot.weaknesses?.map((item, idx) => <li key={idx}>{item}</li>)}
                    </ul>
                  </div>

                  {/* Opportunities */}
                  <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: '8px' }}>OPPORTUNITIES</div>
                    <ul style={{ paddingLeft: '16px', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {swot.opportunities?.map((item, idx) => <li key={idx}>{item}</li>)}
                    </ul>
                  </div>

                  {/* Threats */}
                  <div style={{ padding: '14px', borderRadius: 'var(--radius-sm)', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f59e0b', marginBottom: '8px' }}>THREATS</div>
                    <ul style={{ paddingLeft: '16px', fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {swot.threats?.map((item, idx) => <li key={idx}>{item}</li>)}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Verifiable Documentary Evidence & Filings */}
              <div className="glass-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BookOpen size={18} style={{ color: 'var(--accent-blue)' }} /> Verifiable Documentary Evidence & Filings ({docCitations.length})
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="badge badge-outline" style={{ fontSize: '0.68rem' }}>
                      {supporting.document_corpus_count || 0} Ingested in Corpus
                    </span>
                    <button
                      onClick={() => setIngestModalOpen(true)}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.72rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Plus size={12} /> Add Filing
                    </button>
                  </div>
                </div>

                {docCitations.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(15, 23, 42, 0.4)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      No retrieved filing passages for this query or no documents have been ingested for {researchSymbol} yet.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '12px' }}>
                      <button
                        onClick={handleSeedCorpus}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                      >
                        <BookOpen size={13} /> Load Sample Filings (TCS/RIL/INFY)
                      </button>
                      <button
                        onClick={() => setIngestModalOpen(true)}
                        className="btn btn-primary"
                        style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                      >
                        <UploadCloud size={13} /> Ingest {researchSymbol} Filing
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {docCitations.map((cit, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '16px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(15, 23, 42, 0.6)',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', fontWeight: 800, fontSize: '0.72rem' }}>
                              {cit.citation_id}
                            </span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {cit.document_title}
                            </span>
                            {cit.source_url && (
                              <a
                                href={cit.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--accent-blue)', textDecoration: 'none' }}
                              >
                                View Source <ExternalLink size={12} />
                              </a>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {cit.relevance_score !== null && cit.relevance_score !== undefined && (
                              <span className="badge bg-gain" style={{ fontSize: '0.65rem' }}>
                                Relevance: {Math.round(cit.relevance_score * 100)}%
                              </span>
                            )}
                            {cit.publication_date && (
                              <span className="badge badge-outline" style={{ fontSize: '0.65rem' }}>
                                {cit.publication_date}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '16px', fontSize: '0.74rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                          <span>Publisher: <strong style={{ color: 'var(--text-secondary)' }}>{cit.publisher}</strong></span>
                          <span>Section / Reference: <strong style={{ color: 'var(--text-secondary)' }}>{cit.page_or_section || 'Filing Disclosure'}</strong></span>
                        </div>

                        {cit.passage && (
                          <blockquote
                            style={{
                              margin: '4px 0 0 0',
                              padding: '10px 14px',
                              borderRadius: 'var(--radius-sm)',
                              background: 'rgba(0, 0, 0, 0.35)',
                              borderLeft: '3px solid var(--accent-blue)',
                              fontSize: '0.8rem',
                              color: 'var(--text-secondary)',
                              lineHeight: 1.6,
                              fontStyle: 'normal'
                            }}
                          >
                            "{cit.passage}"
                          </blockquote>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Model-Estimated Scenarios */}
              {scenarios.length > 0 && (
                <div className="glass-card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TrendingUp size={18} style={{ color: 'var(--accent-blue)' }} /> Model-Estimated Scenarios & Valuation Targets
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

              {/* Educational Notice */}
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                Educational equity research intelligence based on audited exchange disclosures. Not SEBI-registered financial advice. Does not provide direct buy, sell, or hold instructions.
              </div>
            </>
          )}
        </div>
      )}
      </div>

      {/* Right Column: AI Stock Research Side Panel */}
      <div className="section-side-column">
        <AISidePanel
          section="stocks"
          currentSymbol={selectedStockForAI}
          allStocks={stocks}
          onSelectStock={(sym) => {
            setSelectedStockForAI(sym);
            setResearchSymbol(sym);
            if (onSelectStock) onSelectStock(sym);
          }}
        />
      </div>

      {/* Mobile Floating Button */}
      <button
        onClick={() => setMobileDrawerOpen(true)}
        className="ai-mobile-floating-btn"
        title="Open AI Stock Research Agent"
      >
        <Sparkles size={16} /> AI Stock Agent ({selectedStockForAI})
      </button>

      {/* Mobile Drawer Overlay */}
      {mobileDrawerOpen && (
        <div className="ai-mobile-drawer-overlay" onClick={() => setMobileDrawerOpen(false)}>
          <div className="ai-mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
            <AISidePanel
              section="stocks"
              currentSymbol={selectedStockForAI}
              allStocks={stocks}
              isMobile={true}
              onToggleOpen={() => setMobileDrawerOpen(false)}
              onSelectStock={(sym) => {
                setSelectedStockForAI(sym);
                setResearchSymbol(sym);
                if (onSelectStock) onSelectStock(sym);
              }}
            />
          </div>
        </div>
      )}

      {/* --- INGEST DOCUMENT MODAL --- */}
      {ingestModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setIngestModalOpen(false)}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '620px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <UploadCloud size={22} style={{ color: 'var(--accent-blue)' }} />
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Ingest Financial Document</h3>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Add official corporate filing, annual report, or transcript for {researchSymbol}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIngestModalOpen(false)}
                className="btn btn-secondary"
                style={{ padding: '6px', borderRadius: '50%' }}
              >
                <X size={16} />
              </button>
            </div>

            {ingestSuccess && (
              <div style={{ padding: '12px 16px', marginBottom: '14px', borderRadius: 'var(--radius-sm)', background: 'rgba(0, 208, 156, 0.15)', border: '1px solid var(--gain-color)', color: 'var(--gain-color)', fontSize: '0.85rem' }}>
                ✓ {ingestSuccess}
              </div>
            )}

            {ingestError && (
              <div style={{ padding: '12px 16px', marginBottom: '14px', borderRadius: 'var(--radius-sm)', background: 'rgba(235, 91, 60, 0.15)', border: '1px solid var(--loss-color)', color: 'var(--loss-color)', fontSize: '0.85rem' }}>
                ✕ {ingestError}
              </div>
            )}

            <form onSubmit={handleIngestSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Target Stock Symbol
                  </label>
                  <select
                    value={researchSymbol}
                    onChange={(e) => setResearchSymbol(e.target.value)}
                    className="input-field"
                    style={{ width: '100%' }}
                  >
                    {stocks.map((s) => (
                      <option key={s.symbol} value={s.symbol}>{s.symbol} — {s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Document Type
                  </label>
                  <select
                    value={ingestForm.doc_type}
                    onChange={(e) => setIngestForm({ ...ingestForm, doc_type: e.target.value })}
                    className="input-field"
                    style={{ width: '100%' }}
                  >
                    <option value="annual_report">Annual Report (Audited)</option>
                    <option value="earnings_transcript">Earnings Call Transcript</option>
                    <option value="exchange_filing">Exchange / SEBI Filing</option>
                    <option value="announcement">Corporate Announcement</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                  Document Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FY24 Audited Financial Statement & SEBI Listing Disclosure"
                  value={ingestForm.title}
                  onChange={(e) => setIngestForm({ ...ingestForm, title: e.target.value })}
                  className="input-field"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Publisher / Source *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NSE India / Company IR"
                    value={ingestForm.publisher}
                    onChange={(e) => setIngestForm({ ...ingestForm, publisher: e.target.value })}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Publication Date
                  </label>
                  <input
                    type="date"
                    value={ingestForm.publication_date}
                    onChange={(e) => setIngestForm({ ...ingestForm, publication_date: e.target.value })}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Source URL (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://www.nseindia.com/..."
                    value={ingestForm.source_url}
                    onChange={(e) => setIngestForm({ ...ingestForm, source_url: e.target.value })}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Page / Section Reference
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Page 14, Management Remarks"
                    value={ingestForm.page_or_section}
                    onChange={(e) => setIngestForm({ ...ingestForm, page_or_section: e.target.value })}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Upload File vs Paste Text */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                  Upload Document File (PDF, TXT, HTML, MD)
                </label>
                <input
                  type="file"
                  accept=".pdf,.txt,.html,.htm,.md"
                  onChange={(e) => setUploadFile(e.target.files[0] || null)}
                  className="input-field"
                  style={{ width: '100%', padding: '8px' }}
                />
              </div>

              {!uploadFile && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
                    Or Paste Document Content / Regulatory Text *
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Paste official statement text, earnings transcript excerpts, or regulatory disclosures here..."
                    value={ingestForm.content}
                    onChange={(e) => setIngestForm({ ...ingestForm, content: e.target.value })}
                    className="input-field"
                    style={{ width: '100%', resize: 'vertical', fontSize: '0.8rem', lineHeight: 1.5 }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setIngestModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={ingestLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ingestLoading}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {ingestLoading ? (
                    <>
                      <RotateCcw size={14} className="animate-spin" /> Ingesting & Chunking...
                    </>
                  ) : (
                    <>
                      <UploadCloud size={14} /> Ingest & Index Document
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
