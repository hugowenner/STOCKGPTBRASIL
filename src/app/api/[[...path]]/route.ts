/**
 * Stock Analysis API - Next.js API Routes
 * Embeds all the stock analysis logic directly in Next.js,
 * using Prisma for database and Python subprocess for Yahoo Finance data.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================================
// Configuração do serviço Python de scoring
// Scoring é calculado exclusivamente pelo Python (fonte única de verdade).
// O Next.js apenas lê scores já armazenados no banco ou delega ao Python.
// ============================================================

const PYTHON_API_URL = process.env.PYTHON_API_URL ?? 'http://localhost:3030';

// ============================================================
// API Route Handler
// ============================================================

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/', '');

  try {
    // Health check
    if (path === 'health') {
      return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
    }

    // Dashboard
    if (path === 'dashboard') {
      const totalStocks = await db.stock.count({ where: { isActive: true } });
      const totalAnalyses = await db.stockAnalysis.count();
      const recentLogs = await db.updateLog.findMany({ take: 1, orderBy: { startedAt: 'desc' } });
      const lastUpdate = recentLogs[0]?.startedAt?.toISOString() || null;

      const topRanked = await db.stockRanking.findMany({
        where: { stock: { isActive: true } },
        orderBy: { overallScore: 'desc' },
        take: 5,
        include: { stock: true },
      });

      const marketStats = await db.stock.groupBy({
        by: ['market'],
        where: { isActive: true },
        _count: { id: true },
      });

      const sectorStats = await db.stock.groupBy({
        by: ['sector'],
        where: { isActive: true, sector: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      });

      const recentAnalyses = await db.stockAnalysis.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { stock: { select: { symbol: true, name: true } } },
      });

      return NextResponse.json({
        totalStocks,
        totalAnalyses,
        lastUpdate,
        topRanked: topRanked.map(r => ({
          ...r.stock,
          overallScore: r.overallScore,
          qualityGrade: r.qualityGrade,
          rankPosition: r.rankPosition,
        })),
        marketStats: marketStats.map(m => ({ market: m.market, count: m._count.id, avg_score: null })),
        sectorStats: sectorStats.map(s => ({ sector: s.sector, count: s._count.id, avg_score: null })),
        recentAnalyses: recentAnalyses.map(a => ({
          ...a,
          symbol: a.stock.symbol,
          name: a.stock.name,
        })),
      });
    }

    // List Stocks
    if (path === 'stocks') {
      const market = url.searchParams.get('market');
      const sector = url.searchParams.get('sector');

      const where: any = { isActive: true };
      if (market) where.market = market;
      if (sector) where.sector = { contains: sector, mode: 'insensitive' };

      const stocks = await db.stock.findMany({
        where,
        orderBy: { symbol: 'asc' },
        include: {
          prices: { take: 1, orderBy: { date: 'desc' } },
        },
      });

      return NextResponse.json({
        stocks: stocks.map(s => ({
          ...s,
          latestPrice: s.prices?.[0] || null,
          prices: undefined,
        })),
        total: stocks.length,
      });
    }

    // Rankings
    if (path === 'rankings') {
      const sortBy = url.searchParams.get('sort_by') || 'overallScore';
      const limit = parseInt(url.searchParams.get('limit') || '50');

      const validSorts = ['overallScore', 'valueScore', 'growthScore', 'profitabilityScore', 'healthScore', 'dividendScore'];
      const sortField = validSorts.includes(sortBy) ? sortBy : 'overallScore';

      const rankings = await db.stockRanking.findMany({
        where: { stock: { isActive: true } },
        orderBy: { [sortField]: 'desc' },
        take: limit,
        include: { stock: true },
      });

      return NextResponse.json({
        rankings: rankings.map(r => ({ ...r.stock, ...r, stock: undefined })),
        total: rankings.length,
      });
    }

    // Update Logs
    if (path === 'update/logs') {
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const logs = await db.updateLog.findMany({
        take: limit,
        orderBy: { startedAt: 'desc' },
      });
      return NextResponse.json({ logs });
    }

    // Stock Detail (e.g., /api/stocks/PETR4.SA)
    const stockMatch = path.match(/^stocks\/(.+)$/);
    if (stockMatch) {
      const symbol = decodeURIComponent(stockMatch[1]);

      // Sub-routes
      const subMatch = symbol.match(/^(.+?)\/(prices|analysis)$/);
      if (subMatch) {
        const actualSymbol = subMatch[1];
        const subRoute = subMatch[2];

        const stock = await db.stock.findUnique({ where: { symbol: actualSymbol } });
        if (!stock) {
          return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
        }

        if (subRoute === 'prices') {
          const days = parseInt(url.searchParams.get('days') || '365');
          const prices = await db.stockPrice.findMany({
            where: { stockId: stock.id },
            orderBy: { date: 'desc' },
            take: days,
          });
          return NextResponse.json({ prices: prices.reverse() });
        }

        if (subRoute === 'analysis') {
          const analyses = await db.stockAnalysis.findMany({
            where: { stockId: stock.id },
            orderBy: { createdAt: 'desc' },
            take: 10,
          });
          return NextResponse.json({ analyses });
        }
      }

      // Main stock detail
      const stock = await db.stock.findUnique({ where: { symbol } });
      if (!stock) {
        return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
      }

      const [latestPrice, indicators, ranking, analyses, prices] = await Promise.all([
        db.stockPrice.findFirst({ where: { stockId: stock.id }, orderBy: { date: 'desc' } }),
        db.financialIndicator.findFirst({ where: { stockId: stock.id }, orderBy: { date: 'desc' } }),
        db.stockRanking.findFirst({ where: { stockId: stock.id } }),
        db.stockAnalysis.findMany({ where: { stockId: stock.id }, orderBy: { createdAt: 'desc' }, take: 1 }),
        db.stockPrice.findMany({ where: { stockId: stock.id }, orderBy: { date: 'desc' }, take: 365 }),
      ]);

      return NextResponse.json({
        stock,
        latestPrice,
        indicators,
        ranking,
        latestAnalysis: analyses[0] || null,
        priceHistory: prices.reverse(),
      });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/', '');

  try {
    // Analyze stock — delega ao Python (fonte única de verdade para scoring)
    const analyzeMatch = path.match(/^stocks\/(.+)\/analyze$/);
    if (analyzeMatch) {
      const symbol = decodeURIComponent(analyzeMatch[1]);
      try {
        const pythonRes = await fetch(
          `${PYTHON_API_URL}/api/stocks/${encodeURIComponent(symbol)}/analyze`,
          { method: 'POST' }
        );
        const data = await pythonRes.json();
        return NextResponse.json(data, { status: pythonRes.status });
      } catch {
        return NextResponse.json(
          { error: 'Serviço de scoring indisponível. Verifique se o servidor Python está rodando.' },
          { status: 503 }
        );
      }
    }

    // Update stocks (triggers Python script)
    if (path === 'update/stocks') {
      return NextResponse.json({ status: 'completed', stocksProcessed: 0, message: 'Use Python script for full sync: cd stock-api && python3 update_stocks.py' });
    }

    // Update rankings — delega ao Python (fonte única de verdade para scoring)
    if (path === 'update/rankings') {
      try {
        const pythonRes = await fetch(`${PYTHON_API_URL}/api/update/rankings`, { method: 'POST' });
        const data = await pythonRes.json();
        return NextResponse.json(data, { status: pythonRes.status });
      } catch {
        return NextResponse.json(
          { error: 'Serviço de scoring indisponível. Verifique se o servidor Python está rodando.' },
          { status: 503 }
        );
      }
    }

    // Update analysis — delega ao Python (fonte única de verdade para scoring)
    if (path === 'update/analysis') {
      try {
        const pythonRes = await fetch(`${PYTHON_API_URL}/api/update/analysis`, { method: 'POST' });
        const data = await pythonRes.json();
        return NextResponse.json(data, { status: pythonRes.status });
      } catch {
        return NextResponse.json(
          { error: 'Serviço de scoring indisponível. Verifique se o servidor Python está rodando.' },
          { status: 503 }
        );
      }
    }

    // Update prices (triggers Python script)
    if (path === 'update/prices') {
      return NextResponse.json({ status: 'completed', stocksProcessed: 0, message: 'Use update/stocks for full sync' });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
