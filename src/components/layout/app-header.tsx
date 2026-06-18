'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, LayoutDashboard, Trophy, Eye } from 'lucide-react';

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { key: 'rankings',  label: 'Rankings',  icon: Trophy,          href: '/rankings' },
  { key: 'stock',     label: 'Análise',   icon: Eye,             href: null },
] as const;

export function AppHeader() {
  const pathname = usePathname();
  const isStockPage = pathname?.startsWith('/stocks/');

  return (
    <header className="sticky top-0 z-50 border-b border-slate-700/50 bg-[#0a0e1a]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">StockAI</h1>
            <p className="text-[10px] text-slate-400">Análise Automática de Ações</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex gap-1 bg-slate-800/50 rounded-xl p-1">
          {TABS.map(tab => {
            const isActive =
              tab.key === 'stock'
                ? isStockPage
                : pathname === tab.href;

            if (tab.key === 'stock') {
              const href = isStockPage ? pathname : null;
              if (!href) {
                return (
                  <span
                    key={tab.key}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 opacity-50 cursor-not-allowed"
                  >
                    <tab.icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </span>
                );
              }
              return (
                <Link
                  key={tab.key}
                  href={href}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-400"
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </Link>
              );
            }

            return (
              <Link
                key={tab.key}
                href={tab.href!}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Spacer — keeps layout balanced */}
        <div className="w-36" />
      </div>
    </header>
  );
}
