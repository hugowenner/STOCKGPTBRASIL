'use client';

import { useState, useCallback } from 'react';
import { api, DashboardData, Stock } from '@/lib/api';

interface DashboardState {
  data: DashboardData | null;
  stocks: Stock[];
  loading: boolean;
  loadingStocks: boolean;
}

export function useDashboard() {
  const [state, setState] = useState<DashboardState>({
    data: null,
    stocks: [],
    loading: false,
    loadingStocks: false,
  });

  const loadData = useCallback(async () => {
    setState(s => ({ ...s, loading: true }));
    try {
      const data = await api.getDashboard();
      setState(s => ({ ...s, data }));
    } catch (e) {
      console.error('Failed to load dashboard:', e);
    } finally {
      setState(s => ({ ...s, loading: false }));
    }
  }, []);

  const loadStocks = useCallback(async (market?: string) => {
    setState(s => ({ ...s, loadingStocks: true }));
    try {
      const res = await api.getStocks(market);
      setState(s => ({ ...s, stocks: res.stocks }));
    } catch (e) {
      console.error('Failed to load stocks:', e);
    } finally {
      setState(s => ({ ...s, loadingStocks: false }));
    }
  }, []);

  return {
    dashboard: state.data,
    stocks: state.stocks,
    loading: state.loading,
    loadingStocks: state.loadingStocks,
    loadData,
    loadStocks,
  };
}
