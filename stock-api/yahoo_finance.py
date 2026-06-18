"""Yahoo Finance integration for fetching stock data."""
import yfinance as yf
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
import asyncio
import logging

logger = logging.getLogger(__name__)


# Major Brazilian stocks (B3) for automatic tracking
BRAZILIAN_STOCKS = [
    {"symbol": "PETR4.SA", "name": "Petrobras PN", "sector": "Petróleo, Gás e Biocombustíveis"},
    {"symbol": "VALE3.SA", "name": "Vale ON", "sector": "Mineração"},
    {"symbol": "ITUB4.SA", "name": "Itaú Unibanco PN", "sector": "Intermediários Financeiros"},
    {"symbol": "BBDC4.SA", "name": "Bradesco PN", "sector": "Intermediários Financeiros"},
    {"symbol": "ABEV3.SA", "name": "Ambev ON", "sector": "Bebidas"},
    {"symbol": "WEGE3.SA", "name": "WEG ON", "sector": "Bens de Capital"},
    {"symbol": "MGLU3.SA", "name": "Magazine Luiza ON", "sector": "Comércio Varejista"},
    {"symbol": "BBAS3.SA", "name": "Banco do Brasil ON", "sector": "Intermediários Financeiros"},
    {"symbol": "RENT3.SA", "name": "Localiza ON", "sector": "Comércio Varejista"},
    {"symbol": "SUZB3.SA", "name": "Suzano ON", "sector": "Papel e Celulose"},
    {"symbol": "JBSS3.SA", "name": "JBS ON", "sector": "Alimentos Processados"},
    {"symbol": "RADL3.SA", "name": "Raia Drogasil ON", "sector": "Comércio Varejista"},
    {"symbol": "EQTL3.SA", "name": "Equatorial ON", "sector": "Energia Elétrica"},
    {"symbol": "CSAN3.SA", "name": "Cosan ON", "sector": "Petróleo, Gás e Biocombustíveis"},
    {"symbol": "TAEE11.SA", "name": "Taesa UNT", "sector": "Energia Elétrica"},
    {"symbol": "ELET3.SA", "name": "Eletrobras ON", "sector": "Energia Elétrica"},
    {"symbol": "HYPE3.SA", "name": "Hypera ON", "sector": "Bens de Consumo"},
    {"symbol": "GGBR4.SA", "name": "Gerdau PN", "sector": "Siderurgia"},
    {"symbol": "CPLE6.SA", "name": "Copel PNB", "sector": "Energia Elétrica"},
    {"symbol": "KLBN11.SA", "name": "Klabin UNT", "sector": "Papel e Celulose"},
    {"symbol": "B3SA3.SA", "name": "B3 ON", "sector": "Intermediários Financeiros"},
    {"symbol": "RDOR3.SA", "name": "Rede D'Or ON", "sector": "Saúde"},
    {"symbol": "PRIO3.SA", "name": "PetroRio ON", "sector": "Petróleo, Gás e Biocombustíveis"},
    {"symbol": "CSNA3.SA", "name": "CSN ON", "sector": "Siderurgia"},
    {"symbol": "SANB11.SA", "name": "Santander UNT", "sector": "Intermediários Financeiros"},
    {"symbol": "EMBR3.SA", "name": "Embraer ON", "sector": "Bens de Capital"},
    {"symbol": "VIVT3.SA", "name": "Vivo ON", "sector": "Telecomunicações"},
    {"symbol": "TOTS3.SA", "name": "TOTVS ON", "sector": "Software e Serviços"},
    {"symbol": "LREN3.SA", "name": "Lojas Renner ON", "sector": "Comércio Varejista"},
    {"symbol": "CIEL3.SA", "name": "Cielo ON", "sector": "Intermediários Financeiros"},
]

# Also track major US stocks for comparison
US_STOCKS = [
    {"symbol": "AAPL", "name": "Apple Inc.", "sector": "Technology"},
    {"symbol": "MSFT", "name": "Microsoft Corp.", "sector": "Technology"},
    {"symbol": "GOOGL", "name": "Alphabet Inc.", "sector": "Technology"},
    {"symbol": "AMZN", "name": "Amazon.com Inc.", "sector": "Consumer Cyclical"},
    {"symbol": "NVDA", "name": "NVIDIA Corp.", "sector": "Technology"},
    {"symbol": "META", "name": "Meta Platforms", "sector": "Technology"},
    {"symbol": "TSLA", "name": "Tesla Inc.", "sector": "Consumer Cyclical"},
    {"symbol": "JPM", "name": "JPMorgan Chase", "sector": "Financial Services"},
    {"symbol": "V", "name": "Visa Inc.", "sector": "Financial Services"},
    {"symbol": "WMT", "name": "Walmart Inc.", "sector": "Consumer Defensive"},
]


async def fetch_stock_info(symbol: str) -> Optional[Dict[str, Any]]:
    """Fetch stock info from Yahoo Finance."""
    try:
        loop = asyncio.get_event_loop()
        ticker = yf.Ticker(symbol)
        info = await loop.run_in_executor(None, lambda: ticker.info)

        if not info:
            return None

        return {
            "symbol": symbol,
            "name": info.get("longName") or info.get("shortName") or symbol,
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "market": "US" if not symbol.endswith(".SA") else "B3",
            "description": info.get("longBusinessSummary"),
            "marketCap": info.get("marketCap"),
            "employees": info.get("fullTimeEmployees"),
            "website": info.get("website"),
        }
    except Exception as e:
        logger.error(f"Error fetching info for {symbol}: {e}")
        return None


async def fetch_historical_prices(symbol: str, period: str = "2y") -> List[Dict[str, Any]]:
    """Fetch historical prices from Yahoo Finance."""
    try:
        loop = asyncio.get_event_loop()
        ticker = yf.Ticker(symbol)
        hist = await loop.run_in_executor(None, lambda: ticker.history(period=period))

        if hist.empty:
            return []

        prices = []
        for index, row in hist.iterrows():
            prices.append({
                "date": index.strftime("%Y-%m-%d"),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
                "adjClose": round(float(row.get("Close", 0)), 2),
            })
        return prices
    except Exception as e:
        logger.error(f"Error fetching prices for {symbol}: {e}")
        return []


async def fetch_financial_indicators(symbol: str) -> Optional[Dict[str, Any]]:
    """Fetch financial indicators from Yahoo Finance."""
    try:
        loop = asyncio.get_event_loop()
        ticker = yf.Ticker(symbol)
        info = await loop.run_in_executor(None, lambda: ticker.info)

        if not info:
            return None

        return {
            "peRatio": info.get("trailingPE"),
            "pbRatio": info.get("priceToBook"),
            "roe": info.get("returnOnEquity"),
            "roa": info.get("returnOnAssets"),
            "debtToEquity": info.get("debtToEquity"),
            "currentRatio": info.get("currentRatio"),
            "quickRatio": info.get("quickRatio"),
            "grossMargin": info.get("grossMargins"),
            "operatingMargin": info.get("operatingMargins"),
            "netMargin": info.get("profitMargins"),
            "dividendYield": info.get("dividendYield"),
            "payoutRatio": info.get("payoutRatio"),
            "eps": info.get("trailingEps"),
            "revenueGrowth": info.get("revenueGrowth"),
            "earningsGrowth": info.get("earningsGrowth"),
            "priceToSales": info.get("priceToSalesTrailing12Months"),
            "evToEbitda": info.get("enterpriseToEbitda"),
            "beta": info.get("beta"),
            "freeCashFlow": info.get("freeCashflow"),
        }
    except Exception as e:
        logger.error(f"Error fetching indicators for {symbol}: {e}")
        return None


async def search_stocks(query: str) -> List[Dict[str, Any]]:
    """Search for stocks using Yahoo Finance."""
    try:
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(None, lambda: yf.utils.autotornados)

        # Fallback to our known lists
        all_stocks = BRAZILIAN_STOCKS + US_STOCKS
        query_lower = query.lower()
        return [
            s for s in all_stocks
            if query_lower in s["symbol"].lower() or query_lower in s["name"].lower()
        ]
    except Exception as e:
        logger.error(f"Error searching stocks: {e}")
        return []


def get_all_trackable_stocks() -> List[Dict[str, Any]]:
    """Get the list of all trackable stocks."""
    return BRAZILIAN_STOCKS + US_STOCKS
