"""Analysis repository — CRUD for StockAnalysis."""

import json
from typing import Optional, List, Dict
from database import execute_insert, execute_query


async def insert_analysis(stock_id: str, analysis_type: str, summary: str,
                          strengths: List[str], weaknesses: List[str],
                          opportunities: List[str], threats: List[str],
                          recommendation: str, target_price: float = None,
                          risk_level: str = "medium", justification: str = "",
                          ai_model: str = "glm") -> str:
    """Insert a new stock analysis record."""
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
        recommendation, target_price, risk_level, justification, ai_model,
    ))


async def get_analyses(stock_id: str, limit: int = 10) -> List[Dict]:
    """Get analyses for a stock, most recent first."""
    results = await execute_query(
        "SELECT * FROM StockAnalysis WHERE stockId = ? ORDER BY createdAt DESC LIMIT ?",
        (stock_id, limit)
    )
    for r in results:
        r["strengths"]     = json.loads(r.get("strengths",     "[]"))
        r["weaknesses"]    = json.loads(r.get("weaknesses",    "[]"))
        r["opportunities"] = json.loads(r.get("opportunities", "[]"))
        r["threats"]       = json.loads(r.get("threats",       "[]"))
    return results


async def get_latest_analysis(stock_id: str) -> Optional[Dict]:
    """Get the most recent analysis for a stock."""
    results = await get_analyses(stock_id, 1)
    return results[0] if results else None
