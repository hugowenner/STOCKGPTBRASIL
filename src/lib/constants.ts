export const COLORS = {
  primary: '#10b981',
  secondary: '#6366f1',
  accent: '#f59e0b',
  danger: '#ef4444',
  success: '#22c55e',
  info: '#3b82f6',
  muted: '#6b7280',
  bg: '#0f172a',
  card: '#1e293b',
  cardLight: '#334155',
  text: '#f8fafc',
  textMuted: '#94a3b8',
};

export const CHART_COLORS = [
  '#10b981', '#6366f1', '#f59e0b', '#ef4444',
  '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6',
];

export const GRADE_COLORS: Record<string, string> = {
  'A+': '#22c55e', 'A': '#22c55e', 'A-': '#10b981',
  'B+': '#3b82f6', 'B': '#3b82f6', 'B-': '#6366f1',
  'C+': '#f59e0b', 'C': '#f59e0b', 'C-': '#d97706',
  'D': '#ef4444',
};

export const RECOMMENDATION_LABELS: Record<string, { label: string; color: string }> = {
  strong_buy:  { label: 'Compra Forte', color: '#22c55e' },
  buy:         { label: 'Compra',       color: '#10b981' },
  hold:        { label: 'Manter',       color: '#f59e0b' },
  sell:        { label: 'Vender',       color: '#ef4444' },
  strong_sell: { label: 'Venda Forte',  color: '#dc2626' },
};

export const RISK_LABELS: Record<string, { label: string; color: string }> = {
  low:       { label: 'Baixo',      color: '#22c55e' },
  medium:    { label: 'Médio',      color: '#f59e0b' },
  high:      { label: 'Alto',       color: '#ef4444' },
  very_high: { label: 'Muito Alto', color: '#dc2626' },
};
