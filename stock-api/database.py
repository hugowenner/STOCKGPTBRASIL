"""Database connection helpers.

This module provides the low-level SQLite connection and query primitives.
Domain-specific operations (upsert_stock, get_rankings, etc.) live in repositories/.
"""

import aiosqlite
import os
from typing import List, Dict, Any

DB_PATH = os.environ.get("DB_PATH", "/home/z/my-project/db/custom.db")


async def get_db() -> aiosqlite.Connection:
    """Open an aiosqlite connection with WAL mode and FK enforcement."""
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db


async def execute_query(query: str, params: tuple = ()) -> List[Dict[str, Any]]:
    """Execute a SELECT and return all rows as a list of dicts."""
    db = await get_db()
    try:
        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        await db.close()


async def execute_insert(query: str, params: tuple = ()) -> str:
    """Execute an INSERT and return the lastrowid as a string."""
    db = await get_db()
    try:
        cursor = await db.execute(query, params)
        await db.commit()
        return str(cursor.lastrowid)
    finally:
        await db.close()


async def execute_update(query: str, params: tuple = ()) -> int:
    """Execute an UPDATE/DELETE and return the number of affected rows."""
    db = await get_db()
    try:
        cursor = await db.execute(query, params)
        await db.commit()
        return cursor.rowcount
    finally:
        await db.close()
