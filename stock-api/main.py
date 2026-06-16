"""Stock Analysis API - FastAPI Application.

Main entry point for the Python backend that handles:
- Stock data fetching and management
- Financial indicators collection
- AI-powered analysis
- Automatic data updates
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import asyncio
import logging
from datetime import datetime

from database import (
    upsert_stock, get_stock_by_symbol, get_all_stocks, get_stock_count,
    insert_price, get_prices, get_latest_price,
    insert_indicators, get_indicators,
    upsert_ranking, get_rankings,
    insert_analysis, get_analyses, get_latest_analysis,
    create_update_log, complete_update_log, fail_update_log, get_update_logs,
    execute_query
)
from yahoo_finance import (
    fetch_stock_info, fetch_historical_prices, fetch_financial_indicators,
    BRAZILIAN_STOCKS, US_STOCKS, get_all_trackable_stocks
)
from ai_engine import (
    calculate_ranking_scores, calculate_quality_grade,
    generate_analysis_prompt, parse_ai_response, call_ai
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
# Response Models
# ============================================================

class StockDetail(BaseModel):
    stock: Dict[str, Any]
    latest_price: Optional[Dict] = None
    indicators: Optional[Dict] = None
    ranking: Optional[Dict] = None
    latest_analysis: Optional[Dict] = None


class DashboardStats(BaseModel):
    total_stocks: int
    total_analyses: int
    last_update: Optional[str] = None
    top_ranked: List[Dict]


# ============================================================
# Health check
# ============================================================

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


# ============================================================
# Stock endpoints
# ============================================================

@app.get("/api/stocks")
async def list_stocks(market: Optional[str] = None, sector: Optional[str] = None):
    """List all tracked stocks."""
    stocks = await get_all_stocks(active_only=True)

    if market:
        stocks = [s for s in stocks if s.get("market") == market]
    if sector:
        stocks = [s for s in stocks if s.get("sector") and sector.lower() in s["sector"].lower()]

    # Get latest prices for all stocks in a single query
    stock_ids = [s["id"] for s in stocks]
    latest_prices = {}
    if stock_ids:
        placeholders = ",".join(["?"] * len(stock_ids))
        price_rows = await execute_query(f"""
            SELECT sp.* FROM StockPrice sp
            INNER JOIN (
                SELECT stockId, MAX(date) as maxDate
                FROM StockPrice
                WHERE stockId IN ({placeholders})
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
    """Get detailed information about a stock."""
    stock = await get_stock_by_symbol(symbol)
    if not stock:
        raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")

    # Get related data
    latest_price = await get_latest_price(stock["id"])
    indicators = await get_indicators(stock["id"])
    analyses = await get_analyses(stock["id"], limit=1)
    latest_analysis = analyses[0] if analyses else None

    # Get ranking
    rankings = await execute_query(
        "SELECT * FROM StockRanking WHERE stockId = ?", (stock["id"],)
    )
    ranking = rankings[0] if rankings else None

    # Get price history for chart (last 365 days)
    prices = await get_prices(stock["id"], limit=365)

    return {
        "stock": stock,
        "latestPrice": latest_price,
        "indicators": indicators,
        "ranking": ranking,
        "latestAnalysis": latest_analysis,
        "priceHistory": list(reversed(prices)) if prices else [],
    }


# ============================================================
# Price endpoints
# ============================================================

@app.get("/api/stocks/{symbol}/prices")
async def get_stock_prices(symbol: str, days: int = Query(default=365, le=730)):
    """Get price history for a stock."""
    stock = await get_stock_by_symbol(symbol)
    if not stock:
        raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")

    prices = await get_prices(stock["id"], limit=days)
    return {"prices": list(reversed(prices)) if prices else []}


# ============================================================
# Ranking endpoints
# ============================================================

@app.get("/api/rankings")
async def list_rankings(
    sort_by: str = Query(default="overallScore"),
    limit: int = Query(default=50, le=200),
):
    """Get stock rankings."""
    rankings = await get_rankings(sort_by=sort_by, limit=limit)
    return {"rankings": rankings, "total": len(rankings)}


# ============================================================
# Analysis endpoints
# ============================================================

@app.get("/api/stocks/{symbol}/analysis")
async def get_stock_analysis(symbol: str):
    """Get analyses for a stock."""
    stock = await get_stock_by_symbol(symbol)
    if not stock:
        raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")

    analyses = await get_analyses(stock["id"], limit=10)
    return {"analyses": analyses}


@app.post("/api/stocks/{symbol}/analyze")
async def analyze_stock(symbol: str):
    """Trigger AI analysis for a stock."""
    stock = await get_stock_by_symbol(symbol)
    if not stock:
        raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")

    indicators = await get_indicators(stock["id"])
    if not indicators:
        raise HTTPException(status_code=400, detail="No indicators available. Run update first.")

    # Get price summary
    prices = await get_prices(stock["id"], limit=365)
    price_summary = calculate_price_summary(prices)

    # Get ranking scores
    ranking_scores = calculate_ranking_scores(indicators, prices)

    # Generate AI analysis
    prompt = generate_analysis_prompt(
        stock["name"], stock["symbol"], indicators, price_summary, ranking_scores
    )

    ai_response = call_ai(prompt)
    analysis_result = parse_ai_response(ai_response)

    if analysis_result:
        analysis_id = await insert_analysis(
            stock_id=stock["id"],
            analysis_type="on_demand",
            summary=analysis_result.get("summary", ""),
            strengths=analysis_result.get("strengths", []),
            weaknesses=analysis_result.get("weaknesses", []),
            opportunities=analysis_result.get("opportunities", []),
            threats=analysis_result.get("threats", []),
            recommendation=analysis_result.get("recommendation", "hold"),
            target_price=analysis_result.get("targetPrice"),
            risk_level=analysis_result.get("riskLevel", "medium"),
            justification=analysis_result.get("justification", ""),
            ai_model="glm"
        )
        return {"status": "ok", "analysisId": analysis_id, "analysis": analysis_result}
    else:
        # Fallback: create analysis without AI
        grade = calculate_quality_grade(ranking_scores["overallScore"])
        recommendation = determine_recommendation(ranking_scores["overallScore"])

        fallback = {
            "summary": f"Análise baseada em indicadores para {stock['name']}. Pontuação geral: {ranking_scores['overallScore']}/100.",
            "strengths": generate_strengths(indicators, ranking_scores),
            "weaknesses": generate_weaknesses(indicators, ranking_scores),
            "opportunities": ["Crescimento do setor", "Expansão de mercado"],
            "threats": ["Volatilidade do mercado", "Risco macroeconômico"],
            "recommendation": recommendation,
            "riskLevel": determine_risk_level(indicators),
            "justification": f"A ação apresenta pontuação geral de {ranking_scores['overallScore']}/100, classificada como grau {grade}. "
                            f"Os indicadores de {'lucratividade e crescimento são positivos' if ranking_scores['overallScore'] > 50 else 'valor e saúde financeira requerem atenção'}."
        }

        analysis_id = await insert_analysis(
            stock_id=stock["id"],
            analysis_type="on_demand",
            summary=fallback["summary"],
            strengths=fallback["strengths"],
            weaknesses=fallback["weaknesses"],
            opportunities=fallback["opportunities"],
            threats=fallback["threats"],
            recommendation=fallback["recommendation"],
            target_price=None,
            risk_level=fallback["riskLevel"],
            justification=fallback["justification"],
            ai_model="rule_based"
        )
        return {"status": "ok", "analysisId": analysis_id, "analysis": fallback}


# ============================================================
# Dashboard endpoints
# ============================================================

@app.get("/api/dashboard")
async def get_dashboard():
    """Get dashboard data."""
    total_stocks = await get_stock_count()

    # Get total analyses count
    analyses_count = await execute_query("SELECT COUNT(*) as cnt FROM StockAnalysis")
    total_analyses = analyses_count[0]["cnt"] if analyses_count else 0

    # Get last update
    logs = await get_update_logs(limit=1)
    last_update = logs[0]["startedAt"] if logs else None

    # Get top ranked stocks
    top_ranked = await get_rankings(sort_by="overallScore", limit=5)

    # Market overview stats
    market_stats = await execute_query("""
        SELECT s.market, COUNT(*) as count,
               AVG(r.overallScore) as avg_score
        FROM Stock s
        LEFT JOIN StockRanking r ON s.id = r.stockId
        WHERE s.isActive = 1
        GROUP BY s.market
    """)

    # Sector distribution
    sector_stats = await execute_query("""
        SELECT s.sector, COUNT(*) as count,
               AVG(r.overallScore) as avg_score
        FROM Stock s
        LEFT JOIN StockRanking r ON s.id = r.stockId
        WHERE s.isActive = 1 AND s.sector IS NOT NULL
        GROUP BY s.sector
        ORDER BY count DESC
        LIMIT 10
    """)

    # Recent analyses
    recent_analyses = await execute_query("""
        SELECT sa.*, s.symbol, s.name
        FROM StockAnalysis sa
        JOIN Stock s ON s.id = sa.stockId
        ORDER BY sa.createdAt DESC
        LIMIT 5
    """)

    return {
        "totalStocks": total_stocks,
        "totalAnalyses": total_analyses,
        "lastUpdate": last_update,
        "topRanked": top_ranked,
        "marketStats": market_stats,
        "sectorStats": sector_stats,
        "recentAnalyses": recent_analyses,
    }


# ============================================================
# Update / Sync endpoints
# ============================================================

@app.post("/api/update/stocks")
async def update_all_stocks():
    """Fetch and update all trackable stocks."""
    log_id = await create_update_log("full")
    errors = []
    processed = 0

    all_stocks = get_all_trackable_stocks()

    for stock_info in all_stocks:
        try:
            symbol = stock_info["symbol"]

            # Fetch stock info from Yahoo Finance
            info = await fetch_stock_info(symbol)
            if info:
                stock_id = await upsert_stock(
                    symbol=info["symbol"],
                    name=info.get("name") or stock_info["name"],
                    sector=info.get("sector") or stock_info.get("sector"),
                    industry=info.get("industry"),
                    market=info.get("market", "B3"),
                    description=info.get("description"),
                    market_cap=info.get("marketCap"),
                    employees=info.get("employees"),
                    website=info.get("website"),
                )

                # Fetch historical prices
                prices = await fetch_historical_prices(symbol, period="2y")
                for price in prices:
                    await insert_price(
                        stock_id=stock_id,
                        date=price["date"],
                        open_price=price["open"],
                        high=price["high"],
                        low=price["low"],
                        close=price["close"],
                        volume=price["volume"],
                        adj_close=price.get("adjClose"),
                    )

                # Fetch financial indicators
                indicators = await fetch_financial_indicators(symbol)
                if indicators:
                    await insert_indicators(stock_id, indicators)

                    # Calculate and store ranking
                    scores = calculate_ranking_scores(indicators)
                    grade = calculate_quality_grade(scores["overallScore"])
                    await upsert_ranking(
                        stock_id=stock_id,
                        overall=scores["overallScore"],
                        value=scores["valueScore"],
                        growth=scores["growthScore"],
                        profitability=scores["profitabilityScore"],
                        health=scores["healthScore"],
                        dividend=scores["dividendScore"],
                        grade=grade,
                    )

                processed += 1
                logger.info(f"Updated {symbol}: {processed}/{len(all_stocks)}")

            # Small delay to avoid rate limiting
            await asyncio.sleep(0.5)

        except Exception as e:
            errors.append(f"{symbol}: {str(e)}")
            logger.error(f"Error updating {symbol}: {e}")

    error_str = "; ".join(errors) if errors else None
    await complete_update_log(log_id, processed, error_str)

    return {
        "status": "completed",
        "stocksProcessed": processed,
        "errors": errors,
    }


@app.post("/api/update/prices")
async def update_prices():
    """Update prices for all tracked stocks."""
    log_id = await create_update_log("prices")
    errors = []
    processed = 0

    stocks = await get_all_stocks(active_only=True)

    for stock in stocks:
        try:
            symbol = stock["symbol"]
            prices = await fetch_historical_prices(symbol, period="5d")

            for price in prices:
                await insert_price(
                    stock_id=stock["id"],
                    date=price["date"],
                    open_price=price["open"],
                    high=price["high"],
                    low=price["low"],
                    close=price["close"],
                    volume=price["volume"],
                    adj_close=price.get("adjClose"),
                )

            processed += 1
            await asyncio.sleep(0.3)

        except Exception as e:
            errors.append(f"{stock['symbol']}: {str(e)}")

    error_str = "; ".join(errors) if errors else None
    await complete_update_log(log_id, processed, error_str)

    return {"status": "completed", "stocksProcessed": processed, "errors": errors}


@app.post("/api/update/rankings")
async def update_rankings():
    """Recalculate rankings for all stocks."""
    log_id = await create_update_log("rankings")
    processed = 0

    stocks = await get_all_stocks(active_only=True)

    for stock in stocks:
        indicators = await get_indicators(stock["id"])
        if indicators:
            scores = calculate_ranking_scores(indicators)
            grade = calculate_quality_grade(scores["overallScore"])
            await upsert_ranking(
                stock_id=stock["id"],
                overall=scores["overallScore"],
                value=scores["valueScore"],
                growth=scores["growthScore"],
                profitability=scores["profitabilityScore"],
                health=scores["healthScore"],
                dividend=scores["dividendScore"],
                grade=grade,
            )
            processed += 1

    # Update rank positions
    all_rankings = await execute_query("""
        SELECT r.id FROM StockRanking r
        JOIN Stock s ON s.id = r.stockId
        WHERE s.isActive = 1
        ORDER BY r.overallScore DESC
    """)
    for i, ranking in enumerate(all_rankings, 1):
        await execute_update("UPDATE StockRanking SET rankPosition = ? WHERE id = ?", (i, ranking["id"]))

    await complete_update_log(log_id, processed)

    return {"status": "completed", "stocksProcessed": processed}


@app.post("/api/update/analysis")
async def update_analysis_batch():
    """Run AI analysis for all stocks that need it."""
    log_id = await create_update_log("analysis")
    errors = []
    processed = 0

    stocks = await get_all_stocks(active_only=True)

    for stock in stocks:
        try:
            indicators = await get_indicators(stock["id"])
            if not indicators:
                continue

            prices = await get_prices(stock["id"], limit=365)
            price_summary = calculate_price_summary(prices)
            ranking_scores = calculate_ranking_scores(indicators, prices)

            # Use rule-based fallback for batch updates (AI per-stock is slow)
            grade = calculate_quality_grade(ranking_scores["overallScore"])
            recommendation = determine_recommendation(ranking_scores["overallScore"])

            await insert_analysis(
                stock_id=stock["id"],
                analysis_type="daily",
                summary=f"Análise diária para {stock['name']}. Pontuação geral: {ranking_scores['overallScore']}/100 (Grau {grade}).",
                strengths=generate_strengths(indicators, ranking_scores),
                weaknesses=generate_weaknesses(indicators, ranking_scores),
                opportunities=["Crescimento do setor", "Expansão de mercado"],
                threats=["Volatilidade do mercado", "Risco macroeconômico"],
                recommendation=recommendation,
                risk_level=determine_risk_level(indicators),
                justification=f"Pontuação {ranking_scores['overallScore']}/100, grau {grade}. "
                            f"{'Indicadores positivos de lucratividade e crescimento.' if ranking_scores['overallScore'] > 50 else 'Atenção aos indicadores de valor e saúde financeira.'}",
                ai_model="rule_based"
            )
            processed += 1

        except Exception as e:
            errors.append(f"{stock['symbol']}: {str(e)}")

    error_str = "; ".join(errors) if errors else None
    await complete_update_log(log_id, processed, error_str)

    return {"status": "completed", "stocksProcessed": processed, "errors": errors}


@app.get("/api/update/logs")
async def get_logs(limit: int = Query(default=20, le=100)):
    """Get update logs."""
    logs = await get_update_logs(limit=limit)
    return {"logs": logs}


# ============================================================
# Helper functions
# ============================================================

def calculate_price_summary(prices: List[Dict]) -> Dict:
    """Calculate price summary statistics."""
    if not prices or len(prices) < 2:
        return {"current_price": 0, "change_30d": 0, "change_12m": 0}

    current = prices[0]["close"]

    # 30 day change
    change_30d = 0
    if len(prices) > 22:  # ~22 trading days in a month
        change_30d = round((current - prices[22]["close"]) / prices[22]["close"] * 100, 2)

    # 12 month change
    change_12m = 0
    if len(prices) > 252:  # ~252 trading days in a year
        change_12m = round((current - prices[252]["close"]) / prices[252]["close"] * 100, 2)
    elif len(prices) > 1:
        change_12m = round((current - prices[-1]["close"]) / prices[-1]["close"] * 100, 2)

    return {
        "current_price": current,
        "change_30d": change_30d,
        "change_12m": change_12m,
    }


def determine_recommendation(score: float) -> str:
    """Determine recommendation based on overall score."""
    if score >= 80:
        return "strong_buy"
    elif score >= 65:
        return "buy"
    elif score >= 40:
        return "hold"
    elif score >= 25:
        return "sell"
    else:
        return "strong_sell"


def determine_risk_level(indicators: Dict) -> str:
    """Determine risk level based on indicators."""
    beta = indicators.get("beta")
    debt = indicators.get("debtToEquity")

    risk_score = 0

    if beta:
        if beta > 1.5:
            risk_score += 3
        elif beta > 1.0:
            risk_score += 2
        else:
            risk_score += 1

    if debt:
        if debt > 200:
            risk_score += 3
        elif debt > 100:
            risk_score += 2
        else:
            risk_score += 1

    if risk_score >= 5:
        return "very_high"
    elif risk_score >= 4:
        return "high"
    elif risk_score >= 2:
        return "medium"
    else:
        return "low"


def generate_strengths(indicators: Dict, scores: Dict) -> List[str]:
    """Generate strengths based on indicators and scores."""
    strengths = []

    if scores.get("profitabilityScore", 0) >= 70:
        strengths.append("Alta lucratividade com margens saudáveis")
    if scores.get("growthScore", 0) >= 70:
        strengths.append("Crescimento consistente de receita e lucro")
    if scores.get("valueScore", 0) >= 70:
        strengths.append("Preço atrativo em relação ao valor fundamental")
    if scores.get("healthScore", 0) >= 70:
        strengths.append("Saúde financeira sólida com baixo endividamento")
    if scores.get("dividendScore", 0) >= 70:
        strengths.append("Histórico consistente de pagamento de dividendos")

    roe = indicators.get("roe")
    if roe and roe > 0.15:
        strengths.append(f"ROE de {roe*100:.1f}% acima da média do setor")

    if not strengths:
        strengths.append("Empresa estabelecida no mercado")

    return strengths[:5]


def generate_weaknesses(indicators: Dict, scores: Dict) -> List[str]:
    """Generate weaknesses based on indicators and scores."""
    weaknesses = []

    if scores.get("valueScore", 0) < 40:
        weaknesses.append("Avaliação elevada em relação aos fundamentos")
    if scores.get("growthScore", 0) < 40:
        weaknesses.append("Crescimento de receita abaixo da média")
    if scores.get("profitabilityScore", 0) < 40:
        weaknesses.append("Margens de lucro abaixo do desejável")
    if scores.get("healthScore", 0) < 40:
        weaknesses.append("Nível de endividamento elevado")

    debt = indicators.get("debtToEquity")
    if debt and debt > 150:
        weaknesses.append(f"Razão dívida/patrimônio de {debt:.0f}% é alta")

    beta = indicators.get("beta")
    if beta and beta > 1.5:
        weaknesses.append(f"Beta de {beta:.1f} indica alta volatilidade")

    if not weaknesses:
        weaknesses.append("Risco de mercado geral")

    return weaknesses[:4]


# ============================================================
# Startup event - seed initial data
# ============================================================

@app.on_event("startup")
async def startup():
    """Seed initial stocks on startup."""
    logger.info("Stock Analysis API starting up...")

    count = await get_stock_count()
    if count == 0:
        logger.info("No stocks found, seeding initial data...")
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
