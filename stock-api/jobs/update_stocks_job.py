"""Job: fetch and store all trackable stocks from Yahoo Finance."""

import asyncio
import logging
from typing import Dict

from yahoo_finance import get_all_trackable_stocks
from repositories.update_log_repo import create_update_log, complete_update_log
from services.stock_service import fetch_and_store_stock

logger = logging.getLogger(__name__)


async def run_update_all_stocks() -> Dict:
    """Sync all tracked stocks: info, prices, indicators, rankings.

    Returns a result dict compatible with the /api/update/stocks response schema.
    """
    log_id = await create_update_log("full")
    errors = []
    processed = 0

    all_stocks = get_all_trackable_stocks()

    for stock_info in all_stocks:
        symbol = stock_info["symbol"]
        try:
            stock_id = await fetch_and_store_stock(stock_info)
            if stock_id:
                processed += 1
                logger.info(f"Updated {symbol}: {processed}/{len(all_stocks)}")
            # Small delay to avoid Yahoo Finance rate-limiting
            await asyncio.sleep(0.5)
        except Exception as e:
            errors.append(f"{symbol}: {str(e)}")
            logger.error(f"Error updating {symbol}: {e}")

    error_str = "; ".join(errors) if errors else None
    await complete_update_log(log_id, processed, error_str)

    return {"status": "completed", "stocksProcessed": processed, "errors": errors}
