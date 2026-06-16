"""Database connection and utilities for the Stock Analysis API."""
import aiosqlite
import os
import json
from datetime import datetime
from typing import Optional, List, Dict, Any

DB_PATH = os.environ.get("DB_PATH", "/home/z/my-project/db/custom.db")


async def get_db():
    """Get a database connection."""
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db


async def execute_query(query: str, params: tuple = ()) -> List[Dict[str, Any]]:
    """Execute a query and return results as list of dicts."""
    db = await get_db()
    try:
        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        await db.close()


async def execute_insert(query: str, params: tuple = ()) -> str:
    """Execute an insert/update and return the last row id."""
    db = await get_db()
    try:
        cursor = await db.execute(query, params)
        await db.commit()
        return str(cursor.lastrowid)
    finally:
        await db.close()


async def execute_update(query: str, params: tuple = ()) -> int:
    """Execute an update and return affected rows."""
    db = await get_db()
    try:
        cursor = await db.execute(query, params)
        await db.commit()
        return cursor.rowcount
    finally:
        await db.close()


# ============================================================
# Stock operations
# ============================================================

async def upsert_stock(symbol: str, name: str, sector: str = None, industry: str = None,
                       market: str = "B3", description: str = None, market_cap: float = None,
                       employees: int = None, website: str = None) -> str:
    """Insert or update a stock."""
    db = await get_db()
    try:
        await db.execute("""
            INSERT INTO Stock (id, symbol, name, sector, industry, market, description, marketCap, employees, website, lastUpdate, createdAt, updatedAt, isActive)
            VALUES (lower(hex(randomblob(8))), ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'), 1)
            ON CONFLICT(symbol) DO UPDATE SET
                name=excluded.name, sector=excluded.sector, industry=excluded.industry,
                description=excluded.description, marketCap=excluded.marketCap,
                employees=excluded.employees, website=excluded.website,
                lastUpdate=datetime('now'), updatedAt=datetime('now')
        """, (symbol, name, sector, industry, market, description, market_cap, employees, website))
        await db.commit()
        # Get the stock id
        cursor = await db.execute("SELECT id FROM Stock WHERE symbol = ?", (symbol,))
        row = await cursor.fetchone()
        return dict(row)["id"] if row else None
    finally:
        await db.close()


async def get_stock_by_symbol(symbol: str) -> Optional[Dict]:
    """Get a stock by symbol."""
    results = await execute_query("SELECT * FROM Stock WHERE symbol = ?", (symbol,))
    return results[0] if results else None


async def get_all_stocks(active_only: bool = True) -> List[Dict]:
    """Get all stocks."""
    if active_only:
        return await execute_query("SELECT * FROM Stock WHERE isActive = 1 ORDER BY symbol")
    return await execute_query("SELECT * FROM Stock ORDER BY symbol")


async def get_stock_count() -> int:
    """Get total stock count."""
    results = await execute_query("SELECT COUNT(*) as cnt FROM Stock WHERE isActive = 1")
    return results[0]["cnt"] if results else 0


# ============================================================
# Stock price operations
# ============================================================

async def insert_price(stock_id: str, date: str, open_price: float, high: float, low: float,
                       close: float, volume: float, adj_close: float = None) -> str:
    """Insert or update a stock price."""
    db = await get_db()
    try:
        await db.execute("""
            INSERT INTO StockPrice (id, stockId, date, open, high, low, close, volume, adjClose, createdAt)
            VALUES (lower(hex(randomblob(8))), ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(stockId, date) DO UPDATE SET
                open=excluded.open, high=excluded.high, low=excluded.low,
                close=excluded.close, volume=excluded.volume, adjClose=excluded.adjClose
        """, (stock_id, date, open_price, high, low, close, volume, adj_close))
        await db.commit()
        return "ok"
    finally:
        await db.close()


async def get_prices(stock_id: str, limit: int = 365) -> List[Dict]:
    """Get stock prices."""
    return await execute_query(
        "SELECT * FROM StockPrice WHERE stockId = ? ORDER BY date DESC LIMIT ?",
        (stock_id, limit)
    )


async def get_latest_price(stock_id: str) -> Optional[Dict]:
    """Get latest price for a stock."""
    results = await execute_query(
        "SELECT * FROM StockPrice WHERE stockId = ? ORDER BY date DESC LIMIT 1",
        (stock_id,)
    )
    return results[0] if results else None


# ============================================================
# Financial indicator operations
# ============================================================

async def insert_indicators(stock_id: str, indicators: Dict) -> str:
    """Insert financial indicators for a stock."""
    db = await get_db()
    try:
        await db.execute("""
            INSERT INTO FinancialIndicator (
                id, stockId, date, peRatio, pbRatio, roe, roa, roic,
                debtToEquity, currentRatio, quickRatio, grossMargin,
                operatingMargin, netMargin, dividendYield, payoutRatio,
                eps, revenueGrowth, earningsGrowth, freeCashFlow,
                priceToSales, evToEbitda, beta, createdAt
            ) VALUES (
                lower(hex(randomblob(8))), ?, datetime('now'), ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
            )
        """, (
            stock_id,
            indicators.get("peRatio"), indicators.get("pbRatio"),
            indicators.get("roe"), indicators.get("roa"), indicators.get("roic"),
            indicators.get("debtToEquity"), indicators.get("currentRatio"),
            indicators.get("quickRatio"), indicators.get("grossMargin"),
            indicators.get("operatingMargin"), indicators.get("netMargin"),
            indicators.get("dividendYield"), indicators.get("payoutRatio"),
            indicators.get("eps"), indicators.get("revenueGrowth"),
            indicators.get("earningsGrowth"), indicators.get("freeCashFlow"),
            indicators.get("priceToSales"), indicators.get("evToEbitda"),
            indicators.get("beta")
        ))
        await db.commit()
        return "ok"
    finally:
        await db.close()


async def get_indicators(stock_id: str) -> Optional[Dict]:
    """Get latest indicators for a stock."""
    results = await execute_query(
        "SELECT * FROM FinancialIndicator WHERE stockId = ? ORDER BY date DESC LIMIT 1",
        (stock_id,)
    )
    return results[0] if results else None


# ============================================================
# Ranking operations
# ============================================================

async def upsert_ranking(stock_id: str, overall: float, value: float, growth: float,
                         profitability: float, health: float, dividend: float,
                         grade: str, rank: int = None) -> str:
    """Insert or update a stock ranking."""
    db = await get_db()
    try:
        # Check if ranking exists
        existing = await execute_query(
            "SELECT id FROM StockRanking WHERE stockId = ?", (stock_id,)
        )
        if existing:
            await db.execute("""
                UPDATE StockRanking SET
                    overallScore=?, valueScore=?, growthScore=?,
                    profitabilityScore=?, healthScore=?, dividendScore=?,
                    qualityGrade=?, rankPosition=?, updatedAt=datetime('now')
                WHERE stockId=?
            """, (overall, value, growth, profitability, health, dividend, grade, rank, stock_id))
        else:
            await db.execute("""
                INSERT INTO StockRanking (
                    id, stockId, overallScore, valueScore, growthScore,
                    profitabilityScore, healthScore, dividendScore,
                    qualityGrade, rankPosition, createdAt, updatedAt
                ) VALUES (
                    lower(hex(randomblob(8))), ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    datetime('now'), datetime('now')
                )
            """, (stock_id, overall, value, growth, profitability, health, dividend, grade, rank))
        await db.commit()
        return "ok"
    finally:
        await db.close()


async def get_rankings(sort_by: str = "overallScore", limit: int = 50) -> List[Dict]:
    """Get stock rankings."""
    valid_sorts = ["overallScore", "valueScore", "growthScore", "profitabilityScore", "healthScore", "dividendScore"]
    if sort_by not in valid_sorts:
        sort_by = "overallScore"
    return await execute_query(f"""
        SELECT s.*, r.* FROM StockRanking r
        JOIN Stock s ON s.id = r.stockId
        WHERE s.isActive = 1
        ORDER BY r.{sort_by} DESC
        LIMIT ?
    """, (limit,))


# ============================================================
# Analysis operations
# ============================================================

async def insert_analysis(stock_id: str, analysis_type: str, summary: str,
                          strengths: List[str], weaknesses: List[str],
                          opportunities: List[str], threats: List[str],
                          recommendation: str, target_price: float = None,
                          risk_level: str = "medium", justification: str = "",
                          ai_model: str = "glm") -> str:
    """Insert a stock analysis."""
    return await execute_insert("""
        INSERT INTO StockAnalysis (
            id, stockId, analysisType, summary, strengths, weaknesses,
            opportunities, threats, recommendation, targetPrice,
            riskLevel, justification, aiModel, createdAt
        ) VALUES (
            lower(hex(randomblob(8))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
        )
    """, (
        stock_id, analysis_type, summary,
        json.dumps(strengths), json.dumps(weaknesses),
        json.dumps(opportunities), json.dumps(threats),
        recommendation, target_price, risk_level, justification, ai_model
    ))


async def get_analyses(stock_id: str, limit: int = 10) -> List[Dict]:
    """Get analyses for a stock."""
    results = await execute_query(
        "SELECT * FROM StockAnalysis WHERE stockId = ? ORDER BY createdAt DESC LIMIT ?",
        (stock_id, limit)
    )
    for r in results:
        r["strengths"] = json.loads(r.get("strengths", "[]"))
        r["weaknesses"] = json.loads(r.get("weaknesses", "[]"))
        r["opportunities"] = json.loads(r.get("opportunities", "[]"))
        r["threats"] = json.loads(r.get("threats", "[]"))
    return results


async def get_latest_analysis(stock_id: str) -> Optional[Dict]:
    """Get latest analysis for a stock."""
    results = await get_analyses(stock_id, 1)
    return results[0] if results else None


# ============================================================
# Update log operations
# ============================================================

async def create_update_log(update_type: str) -> str:
    """Create an update log entry."""
    return await execute_insert("""
        INSERT INTO UpdateLog (id, updateType, status, stocksProcessed, startedAt)
        VALUES (lower(hex(randomblob(8))), ?, 'running', 0, datetime('now'))
    """, (update_type,))


async def complete_update_log(log_id: str, stocks_processed: int, errors: str = None):
    """Mark an update log as completed."""
    await execute_update("""
        UPDATE UpdateLog SET status='completed', stocksProcessed=?, errors=?, completedAt=datetime('now')
        WHERE id=?
    """, (stocks_processed, errors, log_id))


async def fail_update_log(log_id: str, errors: str):
    """Mark an update log as failed."""
    await execute_update("""
        UPDATE UpdateLog SET status='failed', errors=?, completedAt=datetime('now')
        WHERE id=?
    """, (errors, log_id))


async def get_update_logs(limit: int = 20) -> List[Dict]:
    """Get recent update logs."""
    return await execute_query(
        "SELECT * FROM UpdateLog ORDER BY startedAt DESC LIMIT ?", (limit,)
    )
