"""Indicator repository — CRUD for FinancialIndicator."""

from typing import Optional, Dict
from database import get_db, execute_query


async def insert_indicators(stock_id: str, indicators: Dict) -> str:
    """Insert a new snapshot of financial indicators."""
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
            indicators.get("peRatio"),       indicators.get("pbRatio"),
            indicators.get("roe"),           indicators.get("roa"),
            indicators.get("roic"),          indicators.get("debtToEquity"),
            indicators.get("currentRatio"),  indicators.get("quickRatio"),
            indicators.get("grossMargin"),   indicators.get("operatingMargin"),
            indicators.get("netMargin"),     indicators.get("dividendYield"),
            indicators.get("payoutRatio"),   indicators.get("eps"),
            indicators.get("revenueGrowth"), indicators.get("earningsGrowth"),
            indicators.get("freeCashFlow"),  indicators.get("priceToSales"),
            indicators.get("evToEbitda"),    indicators.get("beta"),
        ))
        await db.commit()
        return "ok"
    finally:
        await db.close()


async def get_indicators(stock_id: str) -> Optional[Dict]:
    """Get the most recent financial indicators for a stock."""
    results = await execute_query(
        "SELECT * FROM FinancialIndicator WHERE stockId = ? ORDER BY date DESC LIMIT 1",
        (stock_id,)
    )
    return results[0] if results else None
