'use client';

import React from 'react';

interface Props {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  isText?: boolean;
}

export function StatCard({ icon, label, value, color, isText }: Props) {
  return (
    <div className="bg-[#111827] border border-slate-700/50 rounded-2xl p-4 flex items-center gap-4">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: color + '20' }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className={`font-bold ${isText ? 'text-base' : 'text-2xl'}`} style={{ color }}>
          {value}
        </p>
      </div>
    </div>
  );
}
