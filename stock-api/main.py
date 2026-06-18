"""Stock Analysis API — FastAPI entry point.

Responsibilities:
  - FastAPI app setup and CORS middleware
  - Route registration (thin handlers — delegate to services/jobs)
  - Startup migration and initial data seeding

Business logic lives in services/.
Batch operations live in jobs/.
Data access lives in repositories/.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict, Any
import logging
from datetime import datetime

from database import execute_query, execute_update
from repositories import (
    get_stock_by_symbol, get_all_stocks, get_stock_count,
    get_latest_price, get_indicators, get_analyses, get_rankings,
    get_prices, get_update_logs,
    insert_analysis, upsert_stock,
    create_update_log, complete_update_log,
)
from yahoo_finance import get_all_trackable_stocks
from ai_engine import (
    calculate_ranking_scores, calculate_quality_grade,
    generate_analysis_prompt, parse_ai_response, call_ai,
)
from services.analysis_service import (
    calculate_price_summary,
    determine_recommendation,
    determine_risk_level,
    generate_strengths,
    generate_weaknesses,
)
from services.ranking_service import calculate_and_store_ranking
from jobs import (
    run_update_all_stocks,
    run_update_prices,
    run_update_rankings,
    run_update_analysis,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Stock Analysis API",
    description="API automática de análise de ações com IA",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Health
# ============================================================

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


# ============================================================
# Stocks
# ============================================================

@app.get("/api/stocks")
async def list_stocks(market: Optional[str] = None, sector: Optional[str] = None):
    stocks = await get_all_stocks(active_only=True)

    if market:
        stocks = [s for s in stocks if s.get("market") == market]
    if sector:
        stocks = [s for s in stocks if s.get("sector") and sector.lower() in s["sector"].lower()]

    stock_ids = [s["id"] for s in stocks]
    latest_prices = {}
    if stock_ids:
        placeholders = ",".join(["?"] * len(stock_ids))
        price_rows = await execute_query(f"""
            SELECT sp.* FROM StockPrice sp
            INNER JOIN (
                SELECT stockId, MAX(date) as maxDate
                FROM StockPrice WHERE stockId IN ({placeholders})
                GROUP BY stockId
            ) latest ON sp.stockId = latest.stockId AND sp.date = latest.maxDate
        """, tuple(stock_ids))
        for p in price_rows:
            latest_prices[p["stockId"]] = p

    for stock in stocks:
        stock["latestPrice"] = latest_prices.get(stock["id"])

    return {"stocks": stocks, "total": len(stocks)}


@app.get("/api/stocks/{symbol}")
async def get_stock_detail(symbol: str):
    stock = await get_stock_by_symbol(symbol)
    if not stock:
        raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")

    latest_price = await get_latest_price(stock["id"])
    indicators   = await get_indicators(stock["id"])
    analyses     = await get_analyses(stock["id"], limit=1)
    prices       = await get_prices(stock["id"], limit=365)
    rankings     = await execute_query("SELECT * FROM StockRanking WHERE stockId = ?", (stock["id"],))

    return {
        "stock":          stock,
        "latestPrice":    latest_price,
        "indicators":     indicators,
        "ranking":        rankings[0] if rankings else None,
        "latestAnalysis": analyses[0] if analyses else None,
        "priceHistory":   list(reversed(prices)) if prices else [],
    }


@app.get("/api/stocks/{symbol}/prices")
async def get_stock_prices(symbol: str, days: int = Query(default=365, le=730)):
    stock = await get_stock_by_symbol(symbol)
    if not stock:
        raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")
    prices = await get_prices(stock["id"], limit=days)
    return {"prices": list(reversed(prices)) if prices else []}


@app.get("/api/stocks/{symbol}/analysis")
async def get_stock_analysis(symbol: str):
    stock = await get_stock_by_symbol(symbol)
    if not stock:
        raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")
    analyses = await get_analyses(stock["id"], limit=10)
    return {"analyses": analyses}


@app.post("/api/stocks/{symbol}/analyze")
async def analyze_stock(symbol: str):
    """Trigger on-demand AI analysis for a single stock."""
    stock = await get_stock_by_symbol(symbol)
    if not stock:
        raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")

    indicators = await get_indicators(stock["id"])
    if not indicators:
        raise HTTPException(status_code=400, detail="No indicators available. Run update first.")

    prices        = await get_prices(stock["id"], limit=365)
    price_summary = calculate_price_summary(prices)
    scores        = calculate_ranking_scores(indicators, prices)

    prompt      = generate_analysis_prompt(stock["name"], stock["symbol"], indicators, price_summary, scores)
    ai_response = call_ai(prompt)
    result      = parse_ai_response(ai_response)

    if result:
        analysis_id = await insert_analysis(
            stock_id=stock["id"], analysis_type="on_demand",
            summary=result.get("summary", ""),
            strengths=result.get("strengths", []),
            weaknesses=result.get("weaknesses", []),
            opportunities=result.get("opportunities", []),
            threats=result.get("threats", []),
            recommendation=result.get("recommendation", "hold"),
            target_price=result.get("targetPrice"),
            risk_level=result.get("riskLevel", "medium"),
            justification=result.get("justification", ""),
            ai_model="glm",
        )
        return {"status": "ok", "analysisId": analysis_id, "analysis": result}

    # Fallback: rule-based analysis when AI response cannot be parsed
    grade          = calculate_quality_grade(scores["overallScore"])
    recommendation = determine_recommendation(scores["overallScore"])
    fallback = {
        "summary":       f"Análise baseada em indicadores para {stock['name']}. Pontuação geral: {scores['overallScore']}/100.",
        "strengths":     generate_strengths(indicators, scores),
        "weaknesses":    generate_weaknesses(indicators, scores),
        "opportunities": ["Crescimento do setor", "Expansão de mercado"],
        "threats":       ["Volatilidade do mercado", "Risco macroeconômico"],
        "recommendation": recommendation,
        "riskLevel":     determine_risk_level(indicators),
        "justification": (
            f"A ação apresenta pontuação geral de {scores['overallScore']}/100, classificada como grau {grade}. "
            f"Os indicadores de {'lucratividade e crescimento são positivos' if scores['overallScore'] > 50 else 'valor e saúde financeira requerem atenção'}."
        ),
    }
    analysis_id = await insert_analysis(
        stock_id=stock["id"], analysis_type="on_demand",
        summary=fallback["summary"], strengths=fallback["strengths"],
        weaknesses=fallback["weaknesses"], opportunities=fallback["opportunities"],
        threats=fallback["threats"], recommendation=fallback["recommendation"],
        risk_level=fallback["riskLevel"], justification=fallback["justification"],
        ai_model="rule_based",
    )
    return {"status": "ok", "analysisId": analysis_id, "analysis": fallback}


# ============================================================
# Rankings
# ============================================================

@app.get("/api/rankings")
async def list_rankings(
    sort_by: str = Query(default="overallScore"),
    limit: int = Query(default=50, le=200),
):
    rankings = await get_rankings(sort_by=sort_by, limit=limit)
    return {"rankings": rankings, "total": len(rankings)}


# ============================================================
# Dashboard
# ============================================================

@app.get("/api/dashboard")
async def get_dashboard():
    total_stocks   = await get_stock_count()
    analyses_count = await execute_query("SELECT COUNT(*) as cnt FROM StockAnalysis")
    total_analyses = analyses_count[0]["cnt"] if analyses_count else 0
    logs           = await get_update_logs(limit=1)
    last_update    = logs[0]["startedAt"] if logs else None
    top_ranked     = await get_rankings(sort_by="overallScore", limit=5)
    market_stats   = await execute_query("""
        SELECT s.market, COUNT(*) as count, AVG(r.overallScore) as avg_score
        FROM Stock s LEFT JOIN StockRanking r ON s.id = r.stockId
        WHERE s.isActive = 1 GROUP BY s.market
    """)
    sector_stats   = await execute_query("""
        SELECT s.sector, COUNT(*) as count, AVG(r.overallScore) as avg_score
        FROM Stock s LEFT JOIN StockRanking r ON s.id = r.stockId
        WHERE s.isActive = 1 AND s.sector IS NOT NULL
        GROUP BY s.sector ORDER BY count DESC LIMIT 10
    """)
    recent_analyses = await execute_query("""
        SELECT sa.*, s.symbol, s.name FROM StockAnalysis sa
        JOIN Stock s ON s.id = sa.stockId
        ORDER BY sa.createdAt DESC LIMIT 5
    """)
    return {
        "totalStocks":    total_stocks,
        "totalAnalyses":  total_analyses,
        "lastUpdate":     last_update,
        "topRanked":      top_ranked,
        "marketStats":    market_stats,
        "sectorStats":    sector_stats,
        "recentAnalyses": recent_analyses,
    }


# ============================================================
# Update / Sync — thin wrappers that delegate to jobs
# ============================================================

@app.post("/api/update/stocks")
async def update_all_stocks():
    return await run_update_all_stocks()


@app.post("/api/update/prices")
async def update_prices():
    return await run_update_prices()


@app.post("/api/update/rankings")
async def update_rankings():
    return await run_update_rankings()


@app.post("/api/update/analysis")
async def update_analysis_batch():
    return await run_update_analysis()


@app.get("/api/update/logs")
async def get_logs(limit: int = Query(default=20, le=100)):
    logs = await get_update_logs(limit=limit)
    return {"logs": logs}


# ============================================================
# Startup — migration + initial seeding
# ============================================================

@app.on_event("startup")
async def startup():
    logger.info("Stock Analysis API starting up...")

    # Safe migration: add scoreVersion column if not present.
    # SQLite silently errors if the column already exists — we catch and ignore.
    try:
        await execute_update(
            "ALTER TABLE StockRanking ADD COLUMN scoreVersion TEXT NOT NULL DEFAULT '1.0'", ()
        )
        logger.info("Coluna scoreVersion adicionada a StockRanking.")
    except Exception:
        pass  # Column already exists — expected after first run

    count = await get_stock_count()
    if count == 0:
        logger.info("No stocks found — seeding initial stock list...")
        for stock_info in get_all_trackable_stocks():
            try:
                await upsert_stock(
                    symbol=stock_info["symbol"],
                    name=stock_info["name"],
                    sector=stock_info.get("sector"),
                    market="B3" if stock_info["symbol"].endswith(".SA") else "US",
                )
            except Exception as e:
                logger.error(f"Error seeding {stock_info['symbol']}: {e}")

    logger.info(f"Stock Analysis API ready. Tracking {await get_stock_count()} stocks.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3030)
