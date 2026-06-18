"""Stock service — orchestrates Yahoo Finance fetch + DB persistence for a single stock."""

from typing import Dict, Optional
from yahoo_finance import fetch_stock_info, fetch_historical_prices, fetch_financial_indicators
from repositories.stock_repo import upsert_stock
from repositories.price_repo import insert_price
from repositories.indicator_repo import insert_indicators
from services.ranking_service import calculate_and_store_ranking


async def fetch_and_store_stock(stock_info: Dict) -> Optional[str]:
    """Fetch data for one stock from Yahoo Finance and persist everything.

    Returns the stock_id on success, None if Yahoo Finance returned no data.
    """
    symbol = stock_info["symbol"]

    info = await fetch_stock_info(symbol)
    if not info:
        return None

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

    indicators = await fetch_financial_indicators(symbol)
    if indicators:
        await insert_indicators(stock_id, indicators)
        await calculate_and_store_ranking(stock_id, indicators)

    return stock_id
