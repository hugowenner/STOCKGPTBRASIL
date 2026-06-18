'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  BarChart3, Brain, RefreshCw, Search, Clock, Activity,
  PieChart as PieChartIcon, Globe, ChevronRight, Trophy, Zap,
  TrendingUp,
} from 'lucide-react';

import { useDashboard } from '@/hooks/useDashboard';
import { StatCard } from '@/components/ui/stat-card';
import { UpdateButton } from '@/components/stock/UpdateButton';
import { LoadingSpinner } from '@/components/stock/ScoreBadge';
import { CHART_COLORS, COLORS, GRADE_COLORS } from '@/lib/constants';
import { formatDate, formatPrice, getScoreColor } from '@/lib/formatters';

export default function DashboardPage() {
  const router = useRouter();
  const { dashboard, stocks, loading, loadingStocks, loadData, loadStocks } = useDashboard();
  const [searchQuery, setSearchQuery] = useState('');
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    loadData();
    loadStocks();
  }, []);

  const filteredStocks = stocks.filter(s =>
    !searchQuery ||
    s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sectorData = (dashboard?.sectorStats || []).map(s => ({
    name: s.sector && s.sector.length > 18 ? s.sector.substring(0, 18) + '...' : s.sector,
    count: s.count,
  }));

  const marketData = (dashboard?.marketStats || []).map(s => ({
    name: s.market,
    value: s.count,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<BarChart3 className="w-5 h-5" />} label="Ações Monitoradas"   value={dashboard?.totalStocks  || 0} color="#10b981" />
        <StatCard icon={<Brain     className="w-5 h-5" />} label="Análises Geradas"    value={dashboard?.totalAnalyses || 0} color="#6366f1" />
        <StatCard icon={<Clock     className="w-5 h-5" />} label="Última Atualização"  value={dashboard?.lastUpdate ? formatDate(dashboard.lastUpdate) : 'Pendente'} color="#f59e0b" isText />
        <StatCard icon={<Activity  className="w-5 h-5" />} label="Mercados"            value={dashboard?.marketStats?.length || 0} color="#ec4899" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#111827] border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-emerald-400" /> Distribuição por Setor
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={sectorData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={120} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#f8fafc' }} />
              <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} name="Empresas" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#111827] border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-400" /> Distribuição por Mercado
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={marketData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {marketData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Ranked + Stock Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Ranked */}
        <div className="lg:col-span-1 bg-[#111827] border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" /> Top Ranked
          </h3>
          <div className="space-y-3">
            {(dashboard?.topRanked || []).map((stock, i) => (
              <button
                key={stock.id}
                onClick={() => router.push(`/stocks/${encodeURIComponent(stock.symbol)}`)}
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
                Nenhum ranking disponível ainda.<br />Clique em atualizar para sincronizar.
              </div>
            )}
          </div>
        </div>

        {/* Stock Grid */}
        <div className="lg:col-span-2 bg-[#111827] border border-slate-700/50 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" /> Ações Monitoradas
            </h3>
            <div className="flex items-center gap-2">
              {/* Search input — moved from header to dashboard scope */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar ação..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-36 pl-9 pr-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <button
                onClick={() => { loadData(); loadStocks(); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all"
              >
                <RefreshCw className={`w-3 h-3 ${(loading || loadingStocks) ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
          </div>

          {loadingStocks ? (
            <div className="flex justify-center py-10"><LoadingSpinner size="md" /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
              {filteredStocks.map(stock => (
                <button
                  key={stock.id}
                  onClick={() => router.push(`/stocks/${encodeURIComponent(stock.symbol)}`)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 hover:bg-slate-700/50 border border-slate-700/30 transition-all group text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-emerald-400">{stock.symbol.substring(0, 2)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{stock.symbol.replace('.SA', '')}</p>
                    <p className="text-xs text-slate-400 truncate">{stock.name}</p>
                  </div>
                  {stock.latestPrice && (
                    <div className="text-right">
                      <p className="text-sm font-mono text-white">
                        {formatPrice(stock.latestPrice.close, stock.market === 'B3' ? 'R$' : '$')}
                      </p>
                    </div>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Update Controls */}
      <div className="bg-[#111827] border border-slate-700/50 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" /> Controles de Atualização
        </h3>
        <div className="flex flex-wrap gap-3">
          <UpdateButton label="Sincronizar Tudo"     icon={<RefreshCw   className="w-4 h-4" />} endpoint="updateAllStocks" />
          <UpdateButton label="Atualizar Preços"     icon={<TrendingUp  className="w-4 h-4" />} endpoint="updatePrices" />
          <UpdateButton label="Recalcular Rankings"  icon={<Trophy      className="w-4 h-4" />} endpoint="updateRankings" />
          <UpdateButton label="Gerar Análises"       icon={<Brain       className="w-4 h-4" />} endpoint="updateAnalysis" />
        </div>
      </div>
    </motion.div>
  );
}
