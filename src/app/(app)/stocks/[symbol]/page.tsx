'use client';

import React, { useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, BarChart3, Brain, RefreshCw,
  ArrowUpRight, ArrowDownRight, Shield, Sparkles, Target, Eye, AlertTriangle, Loader2,
} from 'lucide-react';

import { useStockDetail } from '@/hooks/useStockDetail';
import { ScoreBadge, LoadingSpinner } from '@/components/stock/ScoreBadge';
import { IndicatorGroup } from '@/components/stock/IndicatorGroup';
import { RECOMMENDATION_LABELS, RISK_LABELS } from '@/lib/constants';
import { formatPrice, formatDate, safeArray } from '@/lib/formatters';

export default function StockDetailPage() {
  const params = useParams();
  const symbol = decodeURIComponent(params.symbol as string);
  const { detail, loading, analyzing, load, analyze } = useStockDetail();
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    load(symbol);
  }, [symbol]);

  if (loading && !detail) {
    return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;
  }

  if (!detail) {
    return (
      <div className="text-center py-20 text-slate-400">
        <Eye className="w-12 h-12 mx-auto mb-4 text-slate-600" />
        <p>Ação não encontrada.</p>
      </div>
    );
  }

  const { stock, latestPrice, indicators, ranking, latestAnalysis, priceHistory } = detail;
  const currency = stock.market === 'B3' ? 'R$' : '$';

  const chartData = priceHistory.map(p => ({
    date: p.date ? new Date(p.date).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }) : '',
    close: p.close,
  }));

  const radarData = ranking ? [
    { dimension: 'Valor',        score: ranking.valueScore },
    { dimension: 'Crescimento',  score: ranking.growthScore },
    { dimension: 'Lucratividade',score: ranking.profitabilityScore },
    { dimension: 'Saúde',        score: ranking.healthScore },
    { dimension: 'Dividendos',   score: ranking.dividendScore },
  ] : [];

  const priceChange = priceHistory.length >= 2
    ? ((priceHistory[0]?.close || 0) - (priceHistory[priceHistory.length - 1]?.close || 0))
      / (priceHistory[priceHistory.length - 1]?.close || 1) * 100
    : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
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
                <p className="text-3xl font-bold text-white font-mono">{formatPrice(latestPrice.close, currency)}</p>
                <div className="flex items-center gap-1 justify-end">
                  {priceChange >= 0
                    ? <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                    : <ArrowDownRight className="w-4 h-4 text-red-400" />}
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

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => analyze(symbol)}
          disabled={analyzing}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50"
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {analyzing ? 'Analisando com IA...' : 'Analisar com IA'}
        </button>
        <button
          onClick={() => load(symbol)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-300 font-medium text-sm hover:bg-slate-700/50 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar Dados
        </button>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#111827] border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> Histórico de Preços
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
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
              <Area type="monotone" dataKey="close" stroke="#10b981" strokeWidth={2} fill="url(#priceGradient)" name="Preço" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[#111827] border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-400" /> Perfil de Qualidade
          </h3>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="dimension" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 9 }} />
                <Radar name="Score" dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-slate-500 text-sm">
              Sem dados de ranking
            </div>
          )}
        </div>
      </div>

      {/* Analysis + Indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Analysis */}
        <div className="bg-[#111827] border border-slate-700/50 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-400" />
            Análise {latestAnalysis?.aiModel === 'glm' ? 'IA' : 'Automática'}
          </h3>
          {latestAnalysis ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: (RECOMMENDATION_LABELS[latestAnalysis.recommendation]?.color || '#6b7280') + '20' }}>
                  <span className="text-lg font-bold" style={{ color: RECOMMENDATION_LABELS[latestAnalysis.recommendation]?.color || '#6b7280' }}>
                    {latestAnalysis.recommendation === 'strong_buy' ? '++' :
                     latestAnalysis.recommendation === 'buy'        ? '+' :
                     latestAnalysis.recommendation === 'hold'       ? '=' :
                     latestAnalysis.recommendation === 'sell'       ? '-' : '--'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: RECOMMENDATION_LABELS[latestAnalysis.recommendation]?.color || '#6b7280' }}>
                    {RECOMMENDATION_LABELS[latestAnalysis.recommendation]?.label || latestAnalysis.recommendation}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Shield className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-400">
                      Risco:{' '}
                      <span style={{ color: RISK_LABELS[latestAnalysis.riskLevel]?.color || '#6b7280' }}>
                        {RISK_LABELS[latestAnalysis.riskLevel]?.label || latestAnalysis.riskLevel}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">{latestAnalysis.summary}</p>

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
                onClick={() => analyze(symbol)}
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
            <BarChart3 className="w-4 h-4 text-amber-400" /> Indicadores Financeiros
          </h3>
          {indicators ? (
            <div className="space-y-3">
              <IndicatorGroup title="Avaliação" items={[
                { label: 'P/L',       value: indicators.peRatio,      format: 'number' },
                { label: 'P/VPA',     value: indicators.pbRatio,      format: 'number' },
                { label: 'P/Vendas',  value: indicators.priceToSales, format: 'number' },
                { label: 'EV/EBITDA', value: indicators.evToEbitda,   format: 'number' },
              ]} />
              <IndicatorGroup title="Lucratividade" items={[
                { label: 'ROE',              value: indicators.roe,             format: 'percent' },
                { label: 'ROA',              value: indicators.roa,             format: 'percent' },
                { label: 'Margem Bruta',     value: indicators.grossMargin,     format: 'percent' },
                { label: 'Margem Líquida',   value: indicators.netMargin,       format: 'percent' },
                { label: 'Margem Operacional', value: indicators.operatingMargin, format: 'percent' },
              ]} />
              <IndicatorGroup title="Crescimento" items={[
                { label: 'Receita', value: indicators.revenueGrowth,  format: 'percent' },
                { label: 'Lucro',   value: indicators.earningsGrowth, format: 'percent' },
              ]} />
              <IndicatorGroup title="Saúde Financeira" items={[
                { label: 'Dívida/Patrimônio', value: indicators.debtToEquity, format: 'number' },
                { label: 'Liquidez Corrente', value: indicators.currentRatio,  format: 'number' },
                { label: 'Beta',              value: indicators.beta,          format: 'number' },
              ]} />
              <IndicatorGroup title="Dividendos" items={[
                { label: 'Dividend Yield', value: indicators.dividendYield, format: 'percent' },
                { label: 'Payout Ratio',   value: indicators.payoutRatio,   format: 'percent' },
              ]} />
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-sm">Sem indicadores disponíveis</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
