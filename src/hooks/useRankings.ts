'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';

export function useRankings(initialSortBy = 'overallScore') {
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState(initialSortBy);

  const load = useCallback(async (sort?: string) => {
    const activeSort = sort ?? sortBy;
    setLoading(true);
    try {
      const res = await api.getRankings(activeSort, 50);
      setRankings(res.rankings);
    } catch (e) {
      console.error('Failed to load rankings:', e);
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  const changeSortBy = useCallback((sort: string) => {
    setSortBy(sort);
  }, []);

  return { rankings, loading, sortBy, changeSortBy, load };
}
