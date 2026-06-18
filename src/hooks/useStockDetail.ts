'use client';

import { useState, useCallback } from 'react';
import { api, StockDetail } from '@/lib/api';

export function useStockDetail() {
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const load = useCallback(async (symbol: string) => {
    setLoading(true);
    try {
      const data = await api.getStockDetail(symbol);
      setDetail(data);
    } catch (e) {
      console.error('Failed to load stock detail:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const analyze = useCallback(async (symbol: string) => {
    setAnalyzing(true);
    try {
      await api.analyzeStock(symbol);
      // Reload detail after analysis
      const data = await api.getStockDetail(symbol);
      setDetail(data);
    } catch (e) {
      console.error('Analysis failed:', e);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  return { detail, loading, analyzing, load, analyze };
}
