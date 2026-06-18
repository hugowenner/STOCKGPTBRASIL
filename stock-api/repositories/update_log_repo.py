"""Update log repository — CRUD for UpdateLog."""

from typing import Optional, List, Dict
from database import execute_insert, execute_update, execute_query


async def create_update_log(update_type: str) -> str:
    """Create a running update log entry, return its id."""
    return await execute_insert("""
        INSERT INTO UpdateLog (id, updateType, status, stocksProcessed, startedAt)
        VALUES (lower(hex(randomblob(8))), ?, 'running', 0, datetime('now'))
    """, (update_type,))


async def complete_update_log(log_id: str, stocks_processed: int, errors: str = None):
    """Mark an update log as completed."""
    await execute_update("""
        UPDATE UpdateLog
        SET status='completed', stocksProcessed=?, errors=?, completedAt=datetime('now')
        WHERE id=?
    """, (stocks_processed, errors, log_id))


async def fail_update_log(log_id: str, errors: str):
    """Mark an update log as failed."""
    await execute_update("""
        UPDATE UpdateLog
        SET status='failed', errors=?, completedAt=datetime('now')
        WHERE id=?
    """, (errors, log_id))


async def get_update_logs(limit: int = 20) -> List[Dict]:
    """Get recent update logs."""
    return await execute_query(
        "SELECT * FROM UpdateLog ORDER BY startedAt DESC LIMIT ?", (limit,)
    )
