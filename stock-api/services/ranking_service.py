"""Ranking service — orchestrates score calculation + persistence."""

from typing import Dict
from ai_engine import calculate_ranking_scores, calculate_quality_grade
from repositories.ranking_repo import upsert_ranking


async def calculate_and_store_ranking(stock_id: str, indicators: Dict) -> Dict:
    """Calculate scores for a stock and persist the ranking row.

    Returns the scores dict (including scoreVersion) so callers can log/inspect.
    """
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
        score_version=scores.get("scoreVersion", "1.0"),
    )
    return scores
