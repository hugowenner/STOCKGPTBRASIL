"""Repositories package — domain-specific data access layers."""

from .stock_repo import upsert_stock, get_stock_by_symbol, get_all_stocks, get_stock_count
from .price_repo import insert_price, get_prices, get_latest_price
from .indicator_repo import insert_indicators, get_indicators
from .ranking_repo import upsert_ranking, get_rankings
from .analysis_repo import insert_analysis, get_analyses, get_latest_analysis
from .update_log_repo import create_update_log, complete_update_log, fail_update_log, get_update_logs

__all__ = [
    "upsert_stock", "get_stock_by_symbol", "get_all_stocks", "get_stock_count",
    "insert_price", "get_prices", "get_latest_price",
    "insert_indicators", "get_indicators",
    "upsert_ranking", "get_rankings",
    "insert_analysis", "get_analyses", "get_latest_analysis",
    "create_update_log", "complete_update_log", "fail_update_log", "get_update_logs",
]
