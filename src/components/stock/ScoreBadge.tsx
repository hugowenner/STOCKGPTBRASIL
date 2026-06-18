'use client';

import { Loader2 } from 'lucide-react';
import { GRADE_COLORS, COLORS } from '@/lib/constants';
import { getScoreColor } from '@/lib/formatters';

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';
  return <Loader2 className={`${s} animate-spin text-emerald-400`} />;
}

const SIZES = {
  sm: 'w-10 h-10 text-xs',
  md: 'w-14 h-14 text-sm',
  lg: 'w-20 h-20 text-lg',
} as const;

interface Props {
  score: number;
  grade?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ScoreBadge({ score, grade, size = 'md' }: Props) {
  const color = getScoreColor(score);

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`${SIZES[size]} rounded-full flex items-center justify-center font-bold text-white`}
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
