'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface Props {
  label: string;
  icon: React.ReactNode;
  endpoint: keyof typeof api;
}

export function UpdateButton({ label, icon, endpoint }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setResult(null);
    try {
      const fn = api[endpoint] as () => Promise<{ stocksProcessed: number }>;
      const res = await fn();
      setResult(`OK: ${res.stocksProcessed} ações processadas`);
    } catch {
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
