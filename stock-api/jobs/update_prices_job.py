"""Job: refresh recent prices for all tracked stocks."""

import asyncio
import logging
from typing import Dict

from yahoo_finance import fetch_historical_prices
from repositories.stock_repo import get_all_stocks
from repositories.price_repo import insert_price
from repositories.update_log_repo import create_update_log, complete_update_log

logger = logging.getLogger(__name__)


async def run_update_prices() -> Dict:
    """Fetch the last 5 trading days of prices for every active stock.

    Returns a result dict compatible with the /api/update/prices response schema.
    """
    log_id = await create_update_log("prices")
    errors = []
    processed = 0

    stocks = await get_all_stocks(active_only=True)

    for stock in stocks:
        symbol = stock["symbol"]
        try:
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
            errors.append(f"{symbol}: {str(e)}")
            logger.error(f"Error updating prices for {symbol}: {e}")

    error_str = "; ".join(errors) if errors else None
    await complete_update_log(log_id, processed, error_str)

    return {"status": "completed", "stocksProcessed": processed, "errors": errors}
