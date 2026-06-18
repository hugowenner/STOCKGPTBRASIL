"""Job: recalculate scores and rank positions for all active stocks."""

import logging
from typing import Dict

from database import execute_query, execute_update
from repositories.stock_repo import get_all_stocks
from repositories.indicator_repo import get_indicators
from repositories.update_log_repo import create_update_log, complete_update_log
from services.ranking_service import calculate_and_store_ranking

logger = logging.getLogger(__name__)


async def run_update_rankings() -> Dict:
    """Recalculate ranking scores for all stocks and update rank positions.

    Returns a result dict compatible with the /api/update/rankings response schema.
    """
    log_id = await create_update_log("rankings")
    processed = 0

    stocks = await get_all_stocks(active_only=True)

    for stock in stocks:
        indicators = await get_indicators(stock["id"])
        if indicators:
            await calculate_and_store_ranking(stock["id"], indicators)
            processed += 1

    # Assign sequential rank positions ordered by overall score
    all_rankings = await execute_query("""
        SELECT r.id FROM StockRanking r
        JOIN Stock s ON s.id = r.stockId
        WHERE s.isActive = 1
        ORDER BY r.overallScore DESC
    """)
    for position, ranking in enumerate(all_rankings, start=1):
        await execute_update(
            "UPDATE StockRanking SET rankPosition = ? WHERE id = ?",
            (position, ranking["id"])
        )

    await complete_update_log(log_id, processed)

    return {"status": "completed", "stocksProcessed": processed}
