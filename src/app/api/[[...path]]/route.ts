/**
 * Stock Analysis API - Next.js API Routes
 * Embeds all the stock analysis logic directly in Next.js,
 * using Prisma for database and Python subprocess for Yahoo Finance data.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================================
// Helper functions
// ============================================================

function formatPercent(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'N/A';
  return `${(n * 100).toFixed(1)}%`;
}

function getScoreColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  if (score >= 30) return '#f97316';
  return '#ef4444';
}

function calculateQualityGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'A-';
  if (score >= 60) return 'B+';
  if (score >= 50) return 'B';
  if (score >= 40) return 'B-';
  if (score >= 30) return 'C+';
  if (score >= 20) return 'C';
  if (score >= 10) return 'C-';
  return 'D';
}

function calculateRankingScores(indicators: any): Record<string, number> {
  const scores: Record<string, number> = {
    valueScore: 0, growthScore: 0, profitabilityScore: 0,
    healthScore: 0, dividendScore: 0, overallScore: 0,
  };

  if (!indicators) return scores;

  // Value Score
  let valuePoints = 0, count = 0;
  const pe = indicators.peRatio;
  if (pe !== null && pe !== undefined) {
    count++;
    if (pe < 8) valuePoints += 95;
    else if (pe < 12) valuePoints += 85;
    else if (pe < 15) valuePoints += 75;
    else if (pe < 20) valuePoints += 60;
    else if (pe < 25) valuePoints += 45;
    else if (pe < 35) valuePoints += 30;
    else valuePoints += 15;
  }
  const pb = indicators.pbRatio;
  if (pb !== null && pb !== undefined) {
    count++;
    if (pb < 0.5) valuePoints += 90;
    else if (pb < 1.0) valuePoints += 80;
    else if (pb < 1.5) valuePoints += 65;
    else if (pb < 2.0) valuePoints += 50;
    else if (pb < 3.0) valuePoints += 35;
    else valuePoints += 20;
  }
  scores.valueScore = count > 0 ? Math.min(100, valuePoints / count) : 0;

  // Growth Score
  let growthPoints = 0;
  count = 0;
  const rg = indicators.revenueGrowth;
  if (rg !== null && rg !== undefined) {
    count++;
    const pct = rg * 100;
    if (pct > 30) growthPoints += 95;
    else if (pct > 20) growthPoints += 85;
    else if (pct > 10) growthPoints += 70;
    else if (pct > 5) growthPoints += 55;
    else if (pct > 0) growthPoints += 40;
    else growthPoints += 15;
  }
  const eg = indicators.earningsGrowth;
  if (eg !== null && eg !== undefined) {
    count++;
    const pct = eg * 100;
    if (pct > 30) growthPoints += 95;
    else if (pct > 20) growthPoints += 85;
    else if (pct > 10) growthPoints += 70;
    else if (pct > 5) growthPoints += 55;
    else if (pct > 0) growthPoints += 40;
    else growthPoints += 15;
  }
  scores.growthScore = count > 0 ? Math.min(100, growthPoints / count) : 0;

  // Profitability Score
  let profitPoints = 0;
  count = 0;
  for (const metric of [indicators.roe, indicators.roa]) {
    if (metric !== null && metric !== undefined) {
      count++;
      const pct = metric * 100;
      if (pct > 20) profitPoints += 90;
      else if (pct > 15) profitPoints += 80;
      else if (pct > 10) profitPoints += 65;
      else if (pct > 5) profitPoints += 45;
      else if (pct > 0) profitPoints += 30;
      else profitPoints += 10;
    }
  }
  for (const metric of [indicators.grossMargin, indicators.netMargin, indicators.operatingMargin]) {
    if (metric !== null && metric !== undefined) {
      count++;
      const pct = metric * 100;
      if (pct > 30) profitPoints += 85;
      else if (pct > 20) profitPoints += 70;
      else if (pct > 10) profitPoints += 55;
      else if (pct > 5) profitPoints += 40;
      else if (pct > 0) profitPoints += 25;
      else profitPoints += 10;
    }
  }
  scores.profitabilityScore = count > 0 ? Math.min(100, profitPoints / count) : 0;

  // Health Score
  let healthPoints = 0;
  count = 0;
  const dte = indicators.debtToEquity;
  if (dte !== null && dte !== undefined) {
    count++;
    if (dte < 20) healthPoints += 95;
    else if (dte < 50) healthPoints += 80;
    else if (dte < 100) healthPoints += 65;
    else if (dte < 200) healthPoints += 45;
    else healthPoints += 20;
  }
  for (const metric of [indicators.currentRatio, indicators.quickRatio]) {
    if (metric !== null && metric !== undefined) {
      count++;
      if (metric > 2.0) healthPoints += 90;
      else if (metric > 1.5) healthPoints += 75;
      else if (metric > 1.0) healthPoints += 60;
      else if (metric > 0.5) healthPoints += 35;
      else healthPoints += 15;
    }
  }
  scores.healthScore = count > 0 ? Math.min(100, healthPoints / count) : 0;

  // Dividend Score
  let divPoints = 0;
  count = 0;
  const dy = indicators.dividendYield;
  if (dy !== null && dy !== undefined) {
    count++;
    const pct = dy * 100;
    if (pct > 8) divPoints += 85;
    else if (pct > 5) divPoints += 95;
    else if (pct > 3) divPoints += 80;
    else if (pct > 1) divPoints += 60;
    else divPoints += 30;
  }
  const pr = indicators.payoutRatio;
  if (pr !== null && pr !== undefined) {
    count++;
    const pct = pr * 100;
    if (pct < 30) divPoints += 60;
    else if (pct < 50) divPoints += 90;
    else if (pct < 70) divPoints += 70;
    else if (pct < 90) divPoints += 40;
    else divPoints += 15;
  }
  scores.dividendScore = count > 0 ? Math.min(100, divPoints / count) : 0;

  // Overall Score (weighted)
  scores.overallScore = Math.round(
    scores.valueScore * 0.20 +
    scores.growthScore * 0.25 +
    scores.profitabilityScore * 0.25 +
    scores.healthScore * 0.20 +
    scores.dividendScore * 0.10
  );

  for (const key of Object.keys(scores)) {
    scores[key] = Math.round(scores[key] * 10) / 10;
  }

  return scores;
}

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
    // Analyze stock
    const analyzeMatch = path.match(/^stocks\/(.+)\/analyze$/);
    if (analyzeMatch) {
      const symbol = decodeURIComponent(analyzeMatch[1]);
      const stock = await db.stock.findUnique({ where: { symbol } });
      if (!stock) {
        return NextResponse.json({ error: 'Stock not found' }, { status: 404 });
      }

      const indicators = await db.financialIndicator.findFirst({
        where: { stockId: stock.id },
        orderBy: { date: 'desc' },
      });
      if (!indicators) {
        return NextResponse.json({ error: 'No indicators available' }, { status: 400 });
      }

      const scores = calculateRankingScores(indicators);
      const grade = calculateQualityGrade(scores.overallScore);

      const recommendation = scores.overallScore >= 80 ? 'strong_buy'
        : scores.overallScore >= 65 ? 'buy'
        : scores.overallScore >= 40 ? 'hold'
        : scores.overallScore >= 25 ? 'sell' : 'strong_sell';

      const riskLevel = (indicators.beta && indicators.beta > 1.5) || (indicators.debtToEquity && indicators.debtToEquity > 200)
        ? 'high' : (indicators.beta && indicators.beta > 1) || (indicators.debtToEquity && indicators.debtToEquity > 100)
        ? 'medium' : 'low';

      // Generate analysis
      const strengths: string[] = [];
      const weaknesses: string[] = [];

      if (scores.profitabilityScore >= 70) strengths.push('Alta lucratividade com margens saudáveis');
      if (scores.growthScore >= 70) strengths.push('Crescimento consistente de receita e lucro');
      if (scores.valueScore >= 70) strengths.push('Preço atrativo em relação ao valor fundamental');
      if (scores.healthScore >= 70) strengths.push('Saúde financeira sólida com baixo endividamento');
      if (scores.dividendScore >= 70) strengths.push('Histórico consistente de pagamento de dividendos');
      if (indicators.roe && indicators.roe > 0.15) strengths.push(`ROE de ${(indicators.roe * 100).toFixed(1)}% acima da média`);
      if (strengths.length === 0) strengths.push('Empresa estabelecida no mercado');

      if (scores.valueScore < 40) weaknesses.push('Avaliação elevada em relação aos fundamentos');
      if (scores.growthScore < 40) weaknesses.push('Crescimento de receita abaixo da média');
      if (scores.profitabilityScore < 40) weaknesses.push('Margens de lucro abaixo do desejável');
      if (scores.healthScore < 40) weaknesses.push('Nível de endividamento elevado');
      if (indicators.debtToEquity && indicators.debtToEquity > 150) weaknesses.push(`Razão dívida/patrimônio de ${indicators.debtToEquity.toFixed(0)}% é alta`);
      if (weaknesses.length === 0) weaknesses.push('Risco de mercado geral');

      const analysis = await db.stockAnalysis.create({
        data: {
          stockId: stock.id,
          analysisType: 'on_demand',
          summary: `Análise para ${stock.name}. Pontuação geral: ${scores.overallScore}/100 (Grau ${grade}).`,
          strengths: JSON.stringify(strengths.slice(0, 5)),
          weaknesses: JSON.stringify(weaknesses.slice(0, 4)),
          opportunities: JSON.stringify(['Crescimento do setor', 'Expansão de mercado']),
          threats: JSON.stringify(['Volatilidade do mercado', 'Risco macroeconômico']),
          recommendation,
          riskLevel,
          justification: `Pontuação ${scores.overallScore}/100, grau ${grade}. ${scores.overallScore > 50 ? 'Indicadores positivos de lucratividade e crescimento.' : 'Atenção aos indicadores de valor e saúde financeira.'}`,
          aiModel: 'rule_based',
        },
      });

      return NextResponse.json({ status: 'ok', analysisId: analysis.id, analysis });
    }

    // Update stocks (triggers Python script)
    if (path === 'update/stocks') {
      return NextResponse.json({ status: 'completed', stocksProcessed: 0, message: 'Use Python script for full sync: cd stock-api && python3 update_stocks.py' });
    }

    // Update rankings
    if (path === 'update/rankings') {
      const stocks = await db.stock.findMany({ where: { isActive: true } });
      let processed = 0;

      for (const stock of stocks) {
        const indicators = await db.financialIndicator.findFirst({
          where: { stockId: stock.id },
          orderBy: { date: 'desc' },
        });

        if (indicators) {
          const scores = calculateRankingScores(indicators);
          const grade = calculateQualityGrade(scores.overallScore);

          // Check if ranking exists
          const existing = await db.stockRanking.findFirst({
            where: { stockId: stock.id },
          });

          if (existing) {
            await db.stockRanking.update({
              where: { id: existing.id },
              data: {
                overallScore: scores.overallScore,
                valueScore: scores.valueScore,
                growthScore: scores.growthScore,
                profitabilityScore: scores.profitabilityScore,
                healthScore: scores.healthScore,
                dividendScore: scores.dividendScore,
                qualityGrade: grade,
                updatedAt: new Date(),
              },
            });
          } else {
            await db.stockRanking.create({
              data: {
                stockId: stock.id,
                overallScore: scores.overallScore,
                valueScore: scores.valueScore,
                growthScore: scores.growthScore,
                profitabilityScore: scores.profitabilityScore,
                healthScore: scores.healthScore,
                dividendScore: scores.dividendScore,
                qualityGrade: grade,
              },
            });
          }
          processed++;
        }
      }

      // Update rank positions
      const allRankings = await db.stockRanking.findMany({
        where: { stock: { isActive: true } },
        orderBy: { overallScore: 'desc' },
      });

      for (let i = 0; i < allRankings.length; i++) {
        await db.stockRanking.update({
          where: { id: allRankings[i].id },
          data: { rankPosition: i + 1 },
        });
      }

      return NextResponse.json({ status: 'completed', stocksProcessed: processed });
    }

    // Update analysis
    if (path === 'update/analysis') {
      const stocks = await db.stock.findMany({ where: { isActive: true } });
      let processed = 0;

      for (const stock of stocks) {
        const indicators = await db.financialIndicator.findFirst({
          where: { stockId: stock.id },
          orderBy: { date: 'desc' },
        });

        if (indicators) {
          const scores = calculateRankingScores(indicators);
          const grade = calculateQualityGrade(scores.overallScore);
          const recommendation = scores.overallScore >= 80 ? 'strong_buy'
            : scores.overallScore >= 65 ? 'buy'
            : scores.overallScore >= 40 ? 'hold'
            : scores.overallScore >= 25 ? 'sell' : 'strong_sell';

          const riskLevel = (indicators.beta && indicators.beta > 1.5) || (indicators.debtToEquity && indicators.debtToEquity > 200)
            ? 'high' : 'medium';

          const strengths: string[] = [];
          const weaknesses: string[] = [];
          if (scores.profitabilityScore >= 70) strengths.push('Alta lucratividade');
          if (scores.growthScore >= 70) strengths.push('Crescimento consistente');
          if (scores.valueScore >= 70) strengths.push('Preço atrativo');
          if (scores.healthScore >= 70) strengths.push('Saúde financeira sólida');
          if (strengths.length === 0) strengths.push('Empresa estabelecida');
          if (scores.valueScore < 40) weaknesses.push('Avaliação elevada');
          if (scores.growthScore < 40) weaknesses.push('Crescimento baixo');
          if (weaknesses.length === 0) weaknesses.push('Risco de mercado');

          await db.stockAnalysis.create({
            data: {
              stockId: stock.id,
              analysisType: 'daily',
              summary: `Análise diária: ${stock.name}. Pontuação: ${scores.overallScore}/100 (${grade}).`,
              strengths: JSON.stringify(strengths),
              weaknesses: JSON.stringify(weaknesses),
              opportunities: JSON.stringify(['Crescimento do setor', 'Expansão de mercado']),
              threats: JSON.stringify(['Volatilidade do mercado', 'Risco macroeconômico']),
              recommendation,
              riskLevel,
              justification: `Pontuação ${scores.overallScore}/100, grau ${grade}.`,
              aiModel: 'rule_based',
            },
          });
          processed++;
        }
      }

      return NextResponse.json({ status: 'completed', stocksProcessed: processed });
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
