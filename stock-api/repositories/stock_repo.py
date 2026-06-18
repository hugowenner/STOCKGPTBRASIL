"""Stock repository — CRUD for the Stock model."""

from typing import Optional, List, Dict, Any
from database import get_db, execute_query


async def upsert_stock(symbol: str, name: str, sector: str = None, industry: str = None,
                       market: str = "B3", description: str = None, market_cap: float = None,
                       employees: int = None, website: str = None) -> str:
    """Insert or update a stock, return its id."""
    db = await get_db()
    try:
        await db.execute("""
            INSERT INTO Stock (id, symbol, name, sector, industry, market, description,
                               marketCap, employees, website, lastUpdate, createdAt, updatedAt, isActive)
            VALUES (lower(hex(randomblob(8))), ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    datetime('now'), datetime('now'), datetime('now'), 1)
            ON CONFLICT(symbol) DO UPDATE SET
                name=excluded.name, sector=excluded.sector, industry=excluded.industry,
                description=excluded.description, marketCap=excluded.marketCap,
                employees=excluded.employees, website=excluded.website,
                lastUpdate=datetime('now'), updatedAt=datetime('now')
        """, (symbol, name, sector, industry, market, description, market_cap, employees, website))
        await db.commit()
        cursor = await db.execute("SELECT id FROM Stock WHERE symbol = ?", (symbol,))
        row = await cursor.fetchone()
        return dict(row)["id"] if row else None
    finally:
        await db.close()


async def get_stock_by_symbol(symbol: str) -> Optional[Dict]:
    """Get a stock by its ticker symbol."""
    results = await execute_query("SELECT * FROM Stock WHERE symbol = ?", (symbol,))
    return results[0] if results else None


async def get_all_stocks(active_only: bool = True) -> List[Dict]:
    """Get all stocks, optionally filtered to active ones."""
    if active_only:
        return await execute_query("SELECT * FROM Stock WHERE isActive = 1 ORDER BY symbol")
    return await execute_query("SELECT * FROM Stock ORDER BY symbol")


async def get_stock_count() -> int:
    """Return the number of active stocks."""
    results = await execute_query("SELECT COUNT(*) as cnt FROM Stock WHERE isActive = 1")
    return results[0]["cnt"] if results else 0
