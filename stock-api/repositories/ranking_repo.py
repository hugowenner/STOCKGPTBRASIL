"""Ranking repository — CRUD for StockRanking."""

from typing import List, Dict
from database import get_db, execute_query


async def upsert_ranking(stock_id: str, overall: float, value: float, growth: float,
                         profitability: float, health: float, dividend: float,
                         grade: str, rank: int = None, score_version: str = "1.0") -> str:
    """Insert or update a stock ranking."""
    db = await get_db()
    try:
        existing = await execute_query("SELECT id FROM StockRanking WHERE stockId = ?", (stock_id,))
        if existing:
            await db.execute("""
                UPDATE StockRanking SET
                    overallScore=?, valueScore=?, growthScore=?,
                    profitabilityScore=?, healthScore=?, dividendScore=?,
                    qualityGrade=?, rankPosition=?, scoreVersion=?, updatedAt=datetime('now')
                WHERE stockId=?
            """, (overall, value, growth, profitability, health, dividend, grade, rank, score_version, stock_id))
        else:
            await db.execute("""
                INSERT INTO StockRanking (
                    id, stockId, overallScore, valueScore, growthScore,
                    profitabilityScore, healthScore, dividendScore,
                    qualityGrade, rankPosition, scoreVersion, createdAt, updatedAt
                ) VALUES (
                    lower(hex(randomblob(8))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    datetime('now'), datetime('now')
                )
            """, (stock_id, overall, value, growth, profitability, health, dividend, grade, rank, score_version))
        await db.commit()
        return "ok"
    finally:
        await db.close()


async def get_rankings(sort_by: str = "overallScore", limit: int = 50) -> List[Dict]:
    """Get stock rankings ordered by a score dimension."""
    valid_sorts = {"overallScore", "valueScore", "growthScore", "profitabilityScore", "healthScore", "dividendScore"}
    if sort_by not in valid_sorts:
        sort_by = "overallScore"
    return await execute_query(f"""
        SELECT s.*, r.* FROM StockRanking r
        JOIN Stock s ON s.id = r.stockId
        WHERE s.isActive = 1
        ORDER BY r.{sort_by} DESC
        LIMIT ?
    """, (limit,))
