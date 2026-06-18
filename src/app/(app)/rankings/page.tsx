'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Trophy, RefreshCw } from 'lucide-react';

import { useRankings } from '@/hooks/useRankings';
import { ScoreBadge, LoadingSpinner } from '@/components/stock/ScoreBadge';
import { getScoreColor } from '@/lib/formatters';

const SORT_OPTIONS = [
  { key: 'overallScore',        label: 'Geral' },
  { key: 'valueScore',          label: 'Valor' },
  { key: 'growthScore',         label: 'Crescimento' },
  { key: 'profitabilityScore',  label: 'Lucratividade' },
  { key: 'healthScore',         label: 'Saúde' },
  { key: 'dividendScore',       label: 'Dividendos' },
];

const SCORE_BARS = [
  { key: 'valueScore',         label: 'Valor' },
  { key: 'growthScore',        label: 'Crescimento' },
  { key: 'profitabilityScore', label: 'Lucratividade' },
  { key: 'healthScore',        label: 'Saúde' },
  { key: 'dividendScore',      label: 'Dividendos' },
];

export default function RankingsPage() {
  const router = useRouter();
  const { rankings, loading, sortBy, changeSortBy, load } = useRankings();
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    load();
  }, []);

  const handleSortChange = (sort: string) => {
    changeSortBy(sort);
    load(sort);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <h2 className="text-xl font-bold text-white">Ranking de Qualidade</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800/50 rounded-xl p-1">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => handleSortChange(opt.key)}
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
            onClick={() => load()}
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
              onClick={() => router.push(`/stocks/${encodeURIComponent(rank.symbol)}`)}
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

              <div className="space-y-2">
                {SCORE_BARS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 w-20">{label}</span>
                    <div className="flex-1 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${rank[key] || 0}%`, backgroundColor: getScoreColor(rank[key] || 0) }}
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
    </motion.div>
  );
}
