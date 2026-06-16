/**
 * API client for the Stock Analysis FastAPI backend.
 * All requests go through the Caddy gateway using XTransformPort.
 */

const API_PORT = 3030;

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `/api${path}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Types
export interface Stock {
  id: string;
  symbol: string;
  name: string;
  sector: string | null;
  industry: string | null;
  market: string;
  description: string | null;
  marketCap: number | null;
  employees: number | null;
  website: string | null;
  isActive: boolean;
  lastUpdate: string;
  latestPrice?: StockPrice | null;
}

export interface StockPrice {
  id: string;
  stockId: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose: number | null;
}

export interface FinancialIndicator {
  id: string;
  stockId: string;
  date: string;
  peRatio: number | null;
  pbRatio: number | null;
  roe: number | null;
  roa: number | null;
  roic: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  dividendYield: number | null;
  payoutRatio: number | null;
  eps: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  freeCashFlow: number | null;
  priceToSales: number | null;
  evToEbitda: number | null;
  beta: number | null;
}

export interface StockRanking {
  id: string;
  stockId: string;
  overallScore: number;
  valueScore: number;
  growthScore: number;
  profitabilityScore: number;
  healthScore: number;
  dividendScore: number;
  qualityGrade: string;
  rankPosition: number | null;
}

export interface StockAnalysis {
  id: string;
  stockId: string;
  analysisType: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  recommendation: string;
  targetPrice: number | null;
  riskLevel: string;
  justification: string;
  aiModel: string;
  createdAt: string;
}

export interface StockDetail {
  stock: Stock;
  latestPrice: StockPrice | null;
  indicators: FinancialIndicator | null;
  ranking: StockRanking | null;
  latestAnalysis: StockAnalysis | null;
  priceHistory: StockPrice[];
}

export interface DashboardData {
  totalStocks: number;
  totalAnalyses: number;
  lastUpdate: string | null;
  topRanked: (Stock & { overallScore: number; qualityGrade: string })[];
  marketStats: { market: string; count: number; avg_score: number | null }[];
  sectorStats: { sector: string; count: number; avg_score: number | null }[];
  recentAnalyses: (StockAnalysis & { symbol: string; name: string })[];
}

export interface UpdateResult {
  status: string;
  stocksProcessed: number;
  errors: string[];
}

// API functions
export const api = {
  // Health
  health: () => apiFetch<{ status: string; timestamp: string }>('/health'),

  // Dashboard
  getDashboard: () => apiFetch<DashboardData>('/dashboard'),

  // Stocks
  getStocks: (market?: string, sector?: string) => {
    const params = new URLSearchParams();
    if (market) params.set('market', market);
    if (sector) params.set('sector', sector);
    const query = params.toString();
    return apiFetch<{ stocks: Stock[]; total: number }>(`/stocks${query ? `?${query}` : ''}`);
  },

  getStockDetail: (symbol: string) =>
    apiFetch<StockDetail>(`/stocks/${encodeURIComponent(symbol)}`),

  getStockPrices: (symbol: string, days: number = 365) =>
    apiFetch<{ prices: StockPrice[] }>(`/stocks/${encodeURIComponent(symbol)}/prices?days=${days}`),

  // Rankings
  getRankings: (sortBy: string = 'overallScore', limit: number = 50) =>
    apiFetch<{ rankings: (Stock & StockRanking)[]; total: number }>(`/rankings?sort_by=${sortBy}&limit=${limit}`),

  // Analysis
  getStockAnalysis: (symbol: string) =>
    apiFetch<{ analyses: StockAnalysis[] }>(`/stocks/${encodeURIComponent(symbol)}/analysis`),

  analyzeStock: (symbol: string) =>
    apiFetch<{ status: string; analysisId: string; analysis: StockAnalysis }>(
      `/stocks/${encodeURIComponent(symbol)}/analyze`,
      { method: 'POST' }
    ),

  // Updates
  updateAllStocks: () =>
    apiFetch<UpdateResult>('/update/stocks', { method: 'POST' }),

  updatePrices: () =>
    apiFetch<UpdateResult>('/update/prices', { method: 'POST' }),

  updateRankings: () =>
    apiFetch<UpdateResult>('/update/rankings', { method: 'POST' }),

  updateAnalysis: () =>
    apiFetch<UpdateResult>('/update/analysis', { method: 'POST' }),

  getUpdateLogs: (limit: number = 20) =>
    apiFetch<{ logs: any[] }>(`/update/logs?limit=${limit}`),
};
