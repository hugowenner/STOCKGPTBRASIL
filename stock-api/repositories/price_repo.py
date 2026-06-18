"""Price repository — CRUD for StockPrice."""

from typing import Optional, List, Dict
from database import get_db, execute_query


async def insert_price(stock_id: str, date: str, open_price: float, high: float, low: float,
                       close: float, volume: float, adj_close: float = None) -> str:
    """Insert or update a daily price record."""
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
    """Get price history for a stock (most recent first)."""
    return await execute_query(
        "SELECT * FROM StockPrice WHERE stockId = ? ORDER BY date DESC LIMIT ?",
        (stock_id, limit)
    )


async def get_latest_price(stock_id: str) -> Optional[Dict]:
    """Get the most recent price for a stock."""
    results = await execute_query(
        "SELECT * FROM StockPrice WHERE stockId = ? ORDER BY date DESC LIMIT 1",
        (stock_id,)
    )
    return results[0] if results else None
