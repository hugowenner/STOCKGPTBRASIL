import { COLORS } from './constants';

export function safeArray(val: unknown): string[] {
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

export function formatNumber(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined) return 'N/A';
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (Math.abs(n) >= 1e9)  return `${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6)  return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3)  return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(decimals);
}

export function formatPercent(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'N/A';
  return `${(n * 100).toFixed(1)}%`;
}

export function formatPrice(n: number | null | undefined, currency = 'R$'): string {
  if (n === null || n === undefined) return 'N/A';
  return `${currency} ${n.toFixed(2)}`;
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('pt-BR');
}

export function getScoreColor(score: number): string {
  if (score >= 70) return COLORS.success;
  if (score >= 50) return COLORS.accent;
  if (score >= 30) return '#f97316';
  return COLORS.danger;
}
