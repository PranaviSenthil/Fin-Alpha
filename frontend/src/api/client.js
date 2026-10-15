const RAW_BASE = import.meta.env.VITE_API_BASE_URL || '';
const API_BASE = (RAW_BASE.endsWith('/') ? RAW_BASE.slice(0, -1) : RAW_BASE) + '/api/v1';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('vibefinance_token') || null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('vibefinance_token', token);
    } else {
      localStorage.removeItem('vibefinance_token');
    }
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {}),
      },
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.detail || data?.message || `HTTP Error ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  }

  // Auth Endpoints
  auth = {
    login: (email, password) =>
      this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }).then((res) => {
        if (res.access_token) this.setToken(res.access_token);
        return res;
      }),
    demoLogin: () =>
      this.request('/auth/demo-login', {
        method: 'POST',
      }).then((res) => {
        if (res.access_token) this.setToken(res.access_token);
        return res;
      }),
    signup: (email, password, full_name) =>
      this.request('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, full_name }),
      }).then((res) => {
        if (res.access_token) this.setToken(res.access_token);
        return res;
      }),
    logout: () => {
      this.setToken(null);
      return Promise.resolve({ success: true });
    },
  };

  // User Endpoints
  users = {
    getMe: () => this.request('/users/me'),
    updatePreferences: (prefs) =>
      this.request('/users/me/preferences', {
        method: 'PATCH',
        body: JSON.stringify(prefs),
      }),
  };

  // Stocks Endpoints
  stocks = {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return this.request(`/stocks${query ? `?${query}` : ''}`);
    },
    sectors: () => this.request('/stocks/sectors'),
    sectorDetail: (sectorId) => this.request(`/stocks/sectors/${sectorId}`),
    detail: (symbol) => this.request(`/stocks/${symbol}`),
    quote: (symbol, forceRefresh = false) =>
      this.request(`/stocks/${symbol}/quote${forceRefresh ? '?force_refresh=true' : ''}`),
    history: (symbol, period = '1mo', interval = '1d') =>
      this.request(`/stocks/${symbol}/history?period=${period}&interval=${interval}`),
    fundamentals: (symbol) => this.request(`/stocks/${symbol}/fundamentals`),
  };

  // Market Endpoints
  market = {
    overview: () => this.request('/market/overview'),
    indices: () => this.request('/market/indices'),
    gainers: () => this.request('/market/gainers'),
    losers: () => this.request('/market/losers'),
    sectors: () => this.request('/market/sectors'),
    status: () => this.request('/market/status'),
    refresh: () => this.request('/market/refresh', { method: 'POST' }),
  };

  // Watchlist Endpoints
  watchlists = {
    list: () => this.request('/watchlists'),
    create: (name) =>
      this.request('/watchlists', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    rename: (id, name) =>
      this.request(`/watchlists/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      }),
    delete: (id) => this.request(`/watchlists/${id}`, { method: 'DELETE' }),
    addStock: (id, symbol) =>
      this.request(`/watchlists/${id}/stocks`, {
        method: 'POST',
        body: JSON.stringify({ symbol }),
      }),
    removeStock: (id, symbol) =>
      this.request(`/watchlists/${id}/stocks/${symbol}`, { method: 'DELETE' }),
  };

  // Paper Trading Endpoints
  trading = {
    account: () => this.request('/trading/account'),
    resetAccount: () => this.request('/trading/account/reset', { method: 'POST' }),
    placeOrder: (orderData) =>
      this.request('/trading/orders', {
        method: 'POST',
        body: JSON.stringify(orderData),
      }),
    listOrders: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return this.request(`/trading/orders${query ? `?${query}` : ''}`);
    },
    getOrder: (id) => this.request(`/trading/orders/${id}`),
    cancelOrder: (id) => this.request(`/trading/orders/${id}/cancel`, { method: 'POST' }),
    trades: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return this.request(`/trading/trades${query ? `?${query}` : ''}`);
    },
    ledger: () => this.request('/trading/ledger'),
    depositFunds: async (amount, method = 'UPI (Simulated)', description = null) => {
      if (!this.token) {
        try {
          await this.auth.demoLogin();
        } catch (e) {
          console.warn('Auto demo session init failed:', e);
        }
      }
      return this.request('/trading/funds/deposit', {
        method: 'POST',
        body: JSON.stringify({ amount, method, description }),
      });
    },
    withdrawFunds: async (amount, method = 'Bank Transfer (Simulated)') => {
      if (!this.token) {
        try {
          await this.auth.demoLogin();
        } catch (e) {
          console.warn('Auto demo session init failed:', e);
        }
      }
      return this.request('/trading/funds/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount, method }),
      });
    },
  };

  // Portfolio Endpoints
  portfolio = {
    summary: () => this.request('/portfolio'),
    holdings: () => this.request('/portfolio/holdings'),
    allocation: () => this.request('/portfolio/allocation'),
    transactions: () => this.request('/portfolio/transactions'),
    risk: () => this.request('/portfolio/risk'),
  };

  // AI Intelligence & Specialized Agents Endpoints
  ai = {
    // Specialized Agents
    marketAgent: (symbol = null) =>
      this.request(`/ai/agents/market${symbol ? `?symbol=${encodeURIComponent(symbol)}` : ''}`),
    financialAgent: (symbol, query = null) =>
      this.request(`/ai/agents/financial/${encodeURIComponent(symbol)}${query ? `?query=${encodeURIComponent(query)}` : ''}`),
    portfolioAgent: () =>
      this.request('/ai/agents/portfolio'),
    behaviorAgent: () =>
      this.request('/ai/agents/behavior'),
    orchestrate: (query = 'comprehensive_audit', symbol = null, requested_agents = null) =>
      this.request('/ai/orchestrate', {
        method: 'POST',
        body: JSON.stringify({
          query,
          symbol,
          requested_agents: requested_agents || undefined
        }),
      }),

    // RAG Document Corpus Endpoints
    listDocuments: (symbol = null) =>
      this.request(`/ai/documents${symbol ? `?symbol=${encodeURIComponent(symbol)}` : ''}`),
    getDocument: (docId) =>
      this.request(`/ai/documents/${encodeURIComponent(docId)}`),
    deleteDocument: (docId) =>
      this.request(`/ai/documents/${encodeURIComponent(docId)}`, { method: 'DELETE' }),
    searchDocuments: (symbol, query, topK = 4) =>
      this.request('/ai/documents/search', {
        method: 'POST',
        body: JSON.stringify({ symbol, query, top_k: topK })
      }),
    ingestDocument: (data) =>
      this.request('/ai/documents/ingest', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    seedDocuments: () =>
      this.request('/ai/documents/seed', { method: 'POST' }),
    observabilityMetrics: () =>
      this.request('/ai/observability/metrics'),
    uploadDocument: async (formData) => {
      const url = `${API_BASE}/ai/documents/upload`;
      const headers = {};
      const token = localStorage.getItem('vibefinance_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.detail || data?.message || `Upload Error ${response.status}`);
      }
      return data;
    },

    chat: (query, symbol = null, conversationHistory = [], sessionId = null, section = null) =>
      this.request('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          query,
          symbol: symbol || undefined,
          conversation_history: conversationHistory?.length ? conversationHistory : undefined,
          session_id: sessionId || undefined,
          section: section || undefined
        }),
      }),
    chatStatus: () => this.request('/ai/chat/status'),

    // Legacy Compatibility
    marketAnalysis: (symbol = null) =>
      this.request(`/ai/market-analysis${symbol ? `?symbol=${encodeURIComponent(symbol)}` : ''}`, { method: 'POST' }),
    companyResearch: (symbol) =>
      this.request('/ai/company-research', {
        method: 'POST',
        body: JSON.stringify({ symbol }),
      }),
    portfolioAnalysis: () => this.request('/ai/portfolio-analysis', { method: 'POST' }),
    behaviorAnalysis: () => this.request('/ai/behavior-analysis', { method: 'POST' }),
    comprehensiveAnalysis: (symbol = null) =>
      this.request('/ai/comprehensive-analysis', {
        method: 'POST',
        body: JSON.stringify(symbol ? { symbol } : {}),
      }),
    history: () => this.request('/ai/analysis-history'),
    getRun: (id) => this.request(`/ai/analysis-history/${id}`),
  };
}

export const api = new ApiClient();
