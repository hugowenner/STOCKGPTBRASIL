/**
 * Stock Analysis App - Complete single-page application
 * Features: Dashboard, Rankings, Stock Detail, AI Analysis
 */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Area, AreaChart,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, BarChart3, Brain, RefreshCw, Search,
  ArrowUpRight, ArrowDownRight, Star, AlertTriangle, Shield,
  Award, ChevronRight, Activity, PieChart as PieChartIcon, Users,
  Globe, Clock, CheckCircle2, XCircle, Loader2, ExternalLink,
  LayoutDashboard, Trophy, Eye, Sparkles, Heart, Zap, Target,
  ChevronDown, Filter, SortAsc
} from 'lucide-react';

import { api, Stock, StockDetail, StockRanking, DashboardData, StockAnalysis } from '@/lib/api';

// ============================================================
// Helper: safely parse JSON-encoded arrays from the database
// ============================================================
function safeArray(val: unknown): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// ============================================================
// Color palette & constants
// ============================================================
const COLORS = {
  primary: '#10b981',     // emerald-500
  secondary: '#6366f1',   // indigo-500
  accent: '#f59e0b',      // amber-500
  danger: '#ef4444',      // red-500
  success: '#22c55e',     // green-500
  info: '#3b82f6',        // blue-500
  muted: '#6b7280',       // gray-500
  bg: '#0f172a',          // slate-900
  card: '#1e293b',        // slate-800
  cardLight: '#334155',   // slate-700
  text: '#f8fafc',        // slate-50
  textMuted: '#94a3b8',   // slate-400
};

const CHART_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6'];

const GRADE_COLORS: Record<string, string> = {
  'A+': '#22c55e', 'A': '#22c55e', 'A-': '#10b981',
  'B+': '#3b82f6', 'B': '#3b82f6', 'B-': '#6366f1',
  'C+': '#f59e0b', 'C': '#f59e0b', 'C-': '#d97706',
  'D': '#ef4444',
};

const RECOMMENDATION_LABELS: Record<string, { label: string; color: string }> = {
  strong_buy: { label: 'Compra Forte', color: '#22c55e' },
  buy: { label: 'Compra', color: '#10b981' },
  hold: { label: 'Manter', color: '#f59e0b' },
  sell: { label: 'Vender', color: '#ef4444' },
  strong_sell: { label: 'Venda Forte', color: '#dc2626' },
};

const RISK_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: 'Baixo', color: '#22c55e' },
  medium: { label: 'Médio', color: '#f59e0b' },
  high: { label: 'Alto', color: '#ef4444' },
  very_high: { label: 'Muito Alto', color: '#dc2626' },
};

// ============================================================
// Helper functions
// ============================================================
function formatNumber(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined) return 'N/A';
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(decimals);
}

function formatPercent(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'N/A';
  return `${(n * 100).toFixed(1)}%`;
}

function formatPrice(n: number | null | undefined, currency = 'R$'): string {
  if (n === null || n === undefined) return 'N/A';
  return `${currency} ${n.toFixed(2)}`;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('pt-BR');
}

function getScoreColor(score: number): string {
  if (score >= 70) return COLORS.success;
  if (score >= 50) return COLORS.accent;
  if (score >= 30) return '#f97316';
  return COLORS.danger;
}

// ============================================================
// Loading Spinner
// ============================================================
function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';
  return <Loader2 className={`${s} animate-spin text-emerald-400`} />;
}

// ============================================================
// Score Badge
// ============================================================
function ScoreBadge({ score, grade, size = 'md' }: { score: number; grade?: string; size?: 'sm' | 'md' | 'lg' }) {
  const color = getScoreColor(score);
  const sizes = {
    sm: 'w-10 h-10 text-xs',
    md: 'w-14 h-14 text-sm',
    lg: 'w-20 h-20 text-lg',
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`${sizes[size]} rounded-full flex items-center justify-center font-bold text-white`}
        style={{ backgroundColor: color }}
      >
        {score.toFixed(0)}
      </div>
      {grade && (
        <span className="text-xs font-semibold" style={{ color: GRADE_COLORS[grade] || COLORS.muted }}>
          {grade}
        </span>
      )}
    </div>
  );
}

// ============================================================
// Main App Component
// ============================================================
export default function StockAnalysisApp() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'rankings' | 'stock'>('dashboard');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [rankings, setRankings] = useState<any[]>([]);
  const [stockDetail, setStockDetail] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [marketFilter, setMarketFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState('overallScore');

  // Load dashboard data
  const loadDashboard = useCallback(async () => {
    setLoading(prev => ({ ...prev, dashboard: true }));
    try {
      const data = await api.getDashboard();
      setDashboard(data);
    } catch (e) {
      console.error('Failed to load dashboard:', e);
    }
    setLoading(prev => ({ ...prev, dashboard: false }));
  }, []);

  // Load stocks
  const loadStocks = useCallback(async () => {
    setLoading(prev => ({ ...prev, stocks: true }));
    try {
      const data = await api.getStocks(marketFilter || undefined);
      setStocks(data.stocks);
    } catch (e) {
      console.error('Failed to load stocks:', e);
    }
    setLoading(prev => ({ ...prev, stocks: false }));
  }, [marketFilter]);

  // Load rankings
  const loadRankings = useCallback(async () => {
    setLoading(prev => ({ ...prev, rankings: true }));
    try {
      const data = await api.getRankings(sortBy, 50);
      setRankings(data.rankings);
    } catch (e) {
      console.error('Failed to load rankings:', e);
    }
    setLoading(prev => ({ ...prev, rankings: false }));
  }, [sortBy]);

  // Load stock detail
  const loadStockDetail = useCallback(async (symbol: string) => {
    setLoading(prev => ({ ...prev, stock: true }));
    try {
      const data = await api.getStockDetail(symbol);
      setStockDetail(data);
      setSelectedSymbol(symbol);
      setActiveTab('stock');
    } catch (e) {
      console.error('Failed to load stock detail:', e);
    }
    setLoading(prev => ({ ...prev, stock: false }));
  }, []);

  // Initial load using a ref to avoid cascading renders
  const initialLoadRef = React.useRef(false);
  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      const loadAll = async () => {
        await Promise.all([loadDashboard(), loadStocks(), loadRankings()]);
      };
      loadAll();
    }
  }, []);

  // Filter stocks by search
  const filteredStocks = stocks.filter(s =>
    !searchQuery ||
    s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Tab navigation
  const tabs = [
    { key: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
    { key: 'rankings' as const, label: 'Rankings', icon: Trophy },
    { key: 'stock' as const, label: 'Análise', icon: Eye },
  ];

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-700/50 bg-[#0a0e1a]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">StockAI</h1>
              <p className="text-[10px] text-slate-400">Análise Automática de Ações</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="flex gap-1 bg-slate-800/50 rounded-xl p-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => {
                  if (tab.key === 'stock' && !selectedSymbol) return;
                  setActiveTab(tab.key);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                } ${tab.key === 'stock' && !selectedSymbol ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar ação..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-48 pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <DashboardView
                dashboard={dashboard}
                stocks={filteredStocks}
                loading={loading.dashboard}
                onRefresh={loadDashboard}
                onSelectStock={loadStockDetail}
              />
            </motion.div>
          )}

          {activeTab === 'rankings' && (
            <motion.div key="rankings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <RankingsView
                rankings={rankings}
                loading={loading.rankings}
                sortBy={sortBy}
                onSortChange={setSortBy}
                onRefresh={loadRankings}
                onSelectStock={loadStockDetail}
              />
            </motion.div>
          )}

          {activeTab === 'stock' && selectedSymbol && (
            <motion.div key="stock" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <StockDetailView
                detail={stockDetail}
                loading={loading.stock}
                symbol={selectedSymbol}
                onRefresh={() => loadStockDetail(selectedSymbol)}
                onAnalyze={async () => {
                  setLoading(prev => ({ ...prev, analyze: true }));
                  try {
                    await api.analyzeStock(selectedSymbol);
                    await loadStockDetail(selectedSymbol);
                  } catch (e) {
                    console.error('Analysis failed:', e);
                  }
                  setLoading(prev => ({ ...prev, analyze: false }));
                }}
                analyzing={loading.analyze || false}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ============================================================
// Dashboard View
// ============================================================
function DashboardView({
  dashboard,
  stocks,
  loading,
  onRefresh,
  onSelectStock,
}: {
  dashboard: DashboardData | null;
  stocks: Stock[];
  loading: boolean;
  onRefresh: () => void;
  onSelectStock: (symbol: string) => void;
}) {
  // Prepare sector chart data
  const sectorData = (dashboard?.sectorStats || []).map(s => ({
    name: s.sector?.length > 18 ? s.sector.substring(0, 18) + '...' : s.sector,
    count: s.count,
    score: s.avg_score || 0,
  }));

  // Prepare market distribution for pie chart
  const marketData = (dashboard?.marketStats || []).map(s => ({
    name: s.market,
    value: s.count,
  }));

  return (
    <div className="space-y-6">
      {/* Top Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<BarChart3 className="w-5 h-5" />}
          label="Ações Monitoradas"
          value={dashboard?.totalStocks || 0}
          color="#10b981"
        />
        <StatCard
          icon={<Brain className="w-5 h-5" />}
          label="Análises Geradas"
          value={dashboard?.totalAnalyses || 0}
          color="#6366f1"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Última Atualização"
          value={dashboard?.lastUpdate ? formatDate(dashboard.lastUpdate) : 'Pendente'}
          color="#f59e0b"
          isText
        />
        <StatCard
          icon={<Activity className="w-5 h-5" />}
          label="Mercados"
          value={dashboard?.marketStats?.length || 0}
          color="#ec4899"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sector Distribution */}
        <div className="bg-[#111827] border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-emerald-400" />
            Distribuição por Setor
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={sectorData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={120} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#f8fafc' }}
              />
              <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} name="Empresas" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Market Distribution */}
        <div className="bg-[#111827] border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-400" />
            Distribuição por Mercado
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={marketData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {marketData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Ranked & Stock List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Ranked */}
        <div className="lg:col-span-1 bg-[#111827] border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            Top Ranked
          </h3>
          <div className="space-y-3">
            {(dashboard?.topRanked || []).map((stock, i) => (
              <button
                key={stock.id}
                onClick={() => onSelectStock(stock.symbol)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + '30', color: CHART_COLORS[i % CHART_COLORS.length] }}>
                  {i + 1}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-white">{stock.symbol?.replace('.SA', '')}</p>
                  <p className="text-xs text-slate-400">{stock.name?.substring(0, 20)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold" style={{ color: getScoreColor(stock.overallScore || 0) }}>
                    {stock.overallScore?.toFixed(0) || 'N/A'}
                  </p>
                  <p className="text-xs" style={{ color: GRADE_COLORS[stock.qualityGrade] || COLORS.muted }}>
                    {stock.qualityGrade || 'N/A'}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
              </button>
            ))}
            {(!dashboard?.topRanked || dashboard.topRanked.length === 0) && (
              <div className="text-center py-8 text-slate-500 text-sm">
                Nenhum ranking disponível ainda.
                <br />Clique em atualizar para sincronizar.
              </div>
            )}
          </div>
        </div>

        {/* Stock Grid */}
        <div className="lg:col-span-2 bg-[#111827] border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Ações Monitoradas
            </h3>
            <button
              onClick={onRefresh}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
            {stocks.map(stock => (
              <button
                key={stock.id}
                onClick={() => onSelectStock(stock.symbol)}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 hover:bg-slate-700/50 border border-slate-700/30 transition-all group text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-emerald-400">
                    {stock.symbol.substring(0, 2)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{stock.symbol.replace('.SA', '')}</p>
                  <p className="text-xs text-slate-400 truncate">{stock.name}</p>
                </div>
                {stock.latestPrice && (
                  <div className="text-right">
                    <p className="text-sm font-mono text-white">{formatPrice(stock.latestPrice.close, stock.market === 'B3' ? 'R$' : '$')}</p>
                  </div>
                )}
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Update Controls */}
      <div className="bg-[#111827] border border-slate-700/50 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          Controles de Atualização
        </h3>
        <div className="flex flex-wrap gap-3">
          <UpdateButton label="Sincronizar Tudo" icon={<RefreshCw className="w-4 h-4" />} endpoint="updateAllStocks" />
          <UpdateButton label="Atualizar Preços" icon={<TrendingUp className="w-4 h-4" />} endpoint="updatePrices" />
          <UpdateButton label="Recalcular Rankings" icon={<Trophy className="w-4 h-4" />} endpoint="updateRankings" />
          <UpdateButton label="Gerar Análises" icon={<Brain className="w-4 h-4" />} endpoint="updateAnalysis" />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Stat Card
// ============================================================
function StatCard({ icon, label, value, color, isText }: {
  icon: React.ReactNode; label: string; value: number | string; color: string; isText?: boolean;
}) {
  return (
    <div className="bg-[#111827] border border-slate-700/50 rounded-2xl p-4 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + '20' }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className={`font-bold ${isText ? 'text-base' : 'text-2xl'}`} style={{ color }}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Update Button
// ============================================================
function UpdateButton({ label, icon, endpoint }: { label: string; icon: React.ReactNode; endpoint: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setResult(null);
    try {
      const apiMethod = endpoint as keyof typeof api;
      const res = await (api[apiMethod] as () => Promise<any>)();
      setResult(`OK: ${res.stocksProcessed} ações processadas`);
    } catch (e) {
      setResult('Erro na atualização');
    }
    setLoading(false);
    setTimeout(() => setResult(null), 5000);
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-sm font-medium text-slate-300 hover:bg-slate-700/50 hover:text-white transition-all disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
      {result && <span className="text-xs text-emerald-400 ml-2">{result}</span>}
    </button>
  );
}

// ============================================================
// Rankings View
// ============================================================
function RankingsView({
  rankings,
  loading,
  sortBy,
  onSortChange,
  onRefresh,
  onSelectStock,
}: {
  rankings: any[];
  loading: boolean;
  sortBy: string;
  onSortChange: (s: string) => void;
  onRefresh: () => void;
  onSelectStock: (symbol: string) => void;
}) {
  const sortOptions = [
    { key: 'overallScore', label: 'Geral' },
    { key: 'valueScore', label: 'Valor' },
    { key: 'growthScore', label: 'Crescimento' },
    { key: 'profitabilityScore', label: 'Lucratividade' },
    { key: 'healthScore', label: 'Saúde' },
    { key: 'dividendScore', label: 'Dividendos' },
  ];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <h2 className="text-xl font-bold text-white">Ranking de Qualidade</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800/50 rounded-xl p-1">
            {sortOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => onSortChange(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  sortBy === opt.key
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Rankings Grid */}
      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      ) : rankings.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Trophy className="w-12 h-12 mx-auto mb-4 text-slate-600" />
          <p>Nenhum ranking disponível. Sincronize os dados primeiro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rankings.map((rank, i) => (
            <motion.button
              key={rank.id || rank.stockId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onSelectStock(rank.symbol)}
              className="bg-[#111827] border border-slate-700/50 rounded-2xl p-5 hover:border-emerald-500/30 transition-all group text-left"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-md bg-slate-700/50 text-slate-300 font-mono">
                      #{rank.rankPosition || i + 1}
                    </span>
                    <span className="text-xs text-slate-400">{rank.market}</span>
                  </div>
                  <p className="text-lg font-bold text-white">{rank.symbol?.replace('.SA', '')}</p>
                  <p className="text-xs text-slate-400">{rank.name}</p>
                </div>
                <ScoreBadge score={rank.overallScore} grade={rank.qualityGrade} size="md" />
              </div>

              {/* Score bars */}
              <div className="space-y-2">
                {[
                  { key: 'valueScore', label: 'Valor' },
                  { key: 'growthScore', label: 'Crescimento' },
                  { key: 'profitabilityScore', label: 'Lucratividade' },
                  { key: 'healthScore', label: 'Saúde' },
                  { key: 'dividendScore', label: 'Dividendos' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 w-20">{label}</span>
                    <div className="flex-1 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${rank[key] || 0}%`,
                          backgroundColor: getScoreColor(rank[key] || 0),
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono" style={{ color: getScoreColor(rank[key] || 0) }}>
                      {(rank[key] || 0).toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Stock Detail View
// ============================================================
function StockDetailView({
  detail,
  loading,
  symbol,
  onRefresh,
  onAnalyze,
  analyzing,
}: {
  detail: StockDetail | null;
  loading: boolean;
  symbol: string;
  onRefresh: () => void;
  onAnalyze: () => void;
  analyzing: boolean;
}) {
  if (loading && !detail) {
    return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;
  }

  if (!detail) {
    return (
      <div className="text-center py-20 text-slate-400">
        <Eye className="w-12 h-12 mx-auto mb-4 text-slate-600" />
        <p>Selecione uma ação para ver os detalhes.</p>
      </div>
    );
  }

  const { stock, latestPrice, indicators, ranking, latestAnalysis, priceHistory } = detail;
  const isB3 = stock.market === 'B3';
  const currency = isB3 ? 'R$' : '$';

  // Prepare price chart data
  const chartData = priceHistory.map(p => ({
    date: p.date ? new Date(p.date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }) : '',
    close: p.close,
    volume: p.volume,
    high: p.high,
    low: p.low,
  }));

  // Prepare radar chart data
  const radarData = ranking ? [
    { dimension: 'Valor', score: ranking.valueScore },
    { dimension: 'Crescimento', score: ranking.growthScore },
    { dimension: 'Lucratividade', score: ranking.profitabilityScore },
    { dimension: 'Saúde', score: ranking.healthScore },
    { dimension: 'Dividendos', score: ranking.dividendScore },
  ] : [];

  // Calculate price change
  const priceChange = priceHistory.length >= 2
    ? ((priceHistory[0]?.close || 0) - (priceHistory[priceHistory.length - 1]?.close || 0)) / (priceHistory[priceHistory.length - 1]?.close || 1) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#111827] border border-slate-700/50 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
              <span className="text-2xl font-bold text-emerald-400">{stock.symbol.substring(0, 2)}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-white">{stock.symbol.replace('.SA', '')}</h2>
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-700/50 text-slate-300">{stock.market}</span>
              </div>
              <p className="text-slate-400">{stock.name}</p>
              {stock.sector && <p className="text-xs text-slate-500">{stock.sector}</p>}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {latestPrice && (
              <div className="text-right">
                <p className="text-3xl font-bold text-white font-mono">
                  {formatPrice(latestPrice.close, currency)}
                </p>
                <div className="flex items-center gap-1 justify-end">
                  {priceChange >= 0 ? (
                    <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-red-400" />
                  )}
                  <span className={`text-sm font-medium ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                  </span>
                  <span className="text-xs text-slate-500">12m</span>
                </div>
              </div>
            )}
            {ranking && <ScoreBadge score={ranking.overallScore} grade={ranking.qualityGrade} size="lg" />}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onAnalyze}
          disabled={analyzing}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50"
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {analyzing ? 'Analisando com IA...' : 'Analisar com IA'}
        </button>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300 font-medium text-sm hover:bg-slate-700/50 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar Dados
        </button>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Price Chart */}
        <div className="lg:col-span-2 bg-[#111827] border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Histórico de Preços
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={20} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#f8fafc' }}
                formatter={(value: number) => [formatPrice(value, currency), 'Preço']}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#priceGradient)"
                name="Preço"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Radar Chart */}
        <div className="bg-[#111827] border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-400" />
            Perfil de Qualidade
          </h3>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="dimension" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 9 }} />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-slate-500 text-sm">
              Sem dados de ranking
            </div>
          )}
        </div>
      </div>

      {/* Analysis & Indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Analysis */}
        <div className="bg-[#111827] border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-400" />
            Análise {latestAnalysis?.aiModel === 'glm' ? 'IA' : 'Automática'}
          </h3>
          {latestAnalysis ? (
            <div className="space-y-4">
              {/* Recommendation */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: (RECOMMENDATION_LABELS[latestAnalysis.recommendation]?.color || '#6b7280') + '20' }}>
                  <span className="text-lg font-bold" style={{ color: RECOMMENDATION_LABELS[latestAnalysis.recommendation]?.color || '#6b7280' }}>
                    {latestAnalysis.recommendation === 'strong_buy' ? '++' :
                     latestAnalysis.recommendation === 'buy' ? '+' :
                     latestAnalysis.recommendation === 'hold' ? '=' :
                     latestAnalysis.recommendation === 'sell' ? '-' : '--'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: RECOMMENDATION_LABELS[latestAnalysis.recommendation]?.color || '#6b7280' }}>
                    {RECOMMENDATION_LABELS[latestAnalysis.recommendation]?.label || latestAnalysis.recommendation}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Shield className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-400">
                      Risco: <span style={{ color: RISK_LABELS[latestAnalysis.riskLevel]?.color || '#6b7280' }}>
                        {RISK_LABELS[latestAnalysis.riskLevel]?.label || latestAnalysis.riskLevel}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <p className="text-sm text-slate-300 leading-relaxed">{latestAnalysis.summary}</p>

              {/* SWOT */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                  <p className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Pontos Fortes
                  </p>
                  <ul className="space-y-1">
                    {safeArray(latestAnalysis.strengths).map((s, i) => (
                      <li key={i} className="text-xs text-slate-400 flex items-start gap-1">
                        <span className="text-emerald-500 mt-0.5">•</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                  <p className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1">
                    <TrendingDown className="w-3 h-3" /> Pontos Fracos
                  </p>
                  <ul className="space-y-1">
                    {safeArray(latestAnalysis.weaknesses).map((w, i) => (
                      <li key={i} className="text-xs text-slate-400 flex items-start gap-1">
                        <span className="text-red-500 mt-0.5">•</span> {w}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                  <p className="text-xs font-semibold text-blue-400 mb-2 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Oportunidades
                  </p>
                  <ul className="space-y-1">
                    {safeArray(latestAnalysis.opportunities).map((o, i) => (
                      <li key={i} className="text-xs text-slate-400 flex items-start gap-1">
                        <span className="text-blue-500 mt-0.5">•</span> {o}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                  <p className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Ameaças
                  </p>
                  <ul className="space-y-1">
                    {safeArray(latestAnalysis.threats).map((t, i) => (
                      <li key={i} className="text-xs text-slate-400 flex items-start gap-1">
                        <span className="text-amber-500 mt-0.5">•</span> {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Justification */}
              <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
                <p className="text-xs font-semibold text-slate-400 mb-1">Justificativa</p>
                <p className="text-xs text-slate-300 leading-relaxed">{latestAnalysis.justification}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Brain className="w-10 h-10 mx-auto mb-3 text-slate-600" />
              <p className="text-slate-400 text-sm mb-3">Nenhuma análise disponível ainda.</p>
              <button
                onClick={onAnalyze}
                className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-all"
              >
                Gerar Análise com IA
              </button>
            </div>
          )}
        </div>

        {/* Financial Indicators */}
        <div className="bg-[#111827] border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            Indicadores Financeiros
          </h3>
          {indicators ? (
            <div className="space-y-3">
              {/* Valuation */}
              <IndicatorGroup title="Avaliação" items={[
                { label: 'P/L', value: indicators.peRatio, format: 'number' },
                { label: 'P/VPA', value: indicators.pbRatio, format: 'number' },
                { label: 'P/Vendas', value: indicators.priceToSales, format: 'number' },
                { label: 'EV/EBITDA', value: indicators.evToEbitda, format: 'number' },
              ]} />

              {/* Profitability */}
              <IndicatorGroup title="Lucratividade" items={[
                { label: 'ROE', value: indicators.roe, format: 'percent' },
                { label: 'ROA', value: indicators.roa, format: 'percent' },
                { label: 'Margem Bruta', value: indicators.grossMargin, format: 'percent' },
                { label: 'Margem Líquida', value: indicators.netMargin, format: 'percent' },
                { label: 'Margem Operacional', value: indicators.operatingMargin, format: 'percent' },
              ]} />

              {/* Growth */}
              <IndicatorGroup title="Crescimento" items={[
                { label: 'Receita', value: indicators.revenueGrowth, format: 'percent' },
                { label: 'Lucro', value: indicators.earningsGrowth, format: 'percent' },
              ]} />

              {/* Financial Health */}
              <IndicatorGroup title="Saúde Financeira" items={[
                { label: 'Dívida/Patrimônio', value: indicators.debtToEquity, format: 'number' },
                { label: 'Liquidez Corrente', value: indicators.currentRatio, format: 'number' },
                { label: 'Beta', value: indicators.beta, format: 'number' },
              ]} />

              {/* Dividends */}
              <IndicatorGroup title="Dividendos" items={[
                { label: 'Dividend Yield', value: indicators.dividendYield, format: 'percent' },
                { label: 'Payout Ratio', value: indicators.payoutRatio, format: 'percent' },
              ]} />
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-sm">
              Sem indicadores disponíveis
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Indicator Group
// ============================================================
function IndicatorGroup({ title, items }: { title: string; items: { label: string; value: number | null; format: 'percent' | 'number' }[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        {items.map(item => (
          <div key={item.label} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30">
            <span className="text-xs text-slate-400">{item.label}</span>
            <span className="text-xs font-mono font-medium text-white">
              {item.value !== null && item.value !== undefined
                ? item.format === 'percent'
                  ? formatPercent(item.value)
                  : item.value.toFixed(2)
                : 'N/A'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
