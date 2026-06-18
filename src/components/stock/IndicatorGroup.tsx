'use client';

import { formatPercent } from '@/lib/formatters';

interface IndicatorItem {
  label: string;
  value: number | null | undefined;
  format: 'percent' | 'number';
}

interface Props {
  title: string;
  items: IndicatorItem[];
}

export function IndicatorGroup({ title, items }: Props) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        {items.map(item => (
          <div key={item.label} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/30">
            <span className="text-xs text-slate-400">{item.label}</span>
            <span className="text-xs font-mono font-medium text-white">
              {item.value !== null && item.value !== undefined
                ? item.format === 'percent'
                  ? formatPercent(item.value)
                  : item.value.toFixed(2)
                : 'N/A'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
