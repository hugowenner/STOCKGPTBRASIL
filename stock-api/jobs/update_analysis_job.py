"""Job: generate rule-based analysis for all active stocks."""

import logging
from typing import Dict

from ai_engine import calculate_ranking_scores, calculate_quality_grade
from repositories.stock_repo import get_all_stocks
from repositories.indicator_repo import get_indicators
from repositories.price_repo import get_prices
from repositories.analysis_repo import insert_analysis
from repositories.update_log_repo import create_update_log, complete_update_log
from services.analysis_service import (
    calculate_price_summary,
    determine_recommendation,
    determine_risk_level,
    generate_strengths,
    generate_weaknesses,
)

logger = logging.getLogger(__name__)


async def run_update_analysis() -> Dict:
    """Run rule-based analysis for every active stock that has indicators.

    Uses rule-based fallback (not AI) for batch efficiency.
    Returns a result dict compatible with the /api/update/analysis response schema.
    """
    log_id = await create_update_log("analysis")
    errors = []
    processed = 0

    stocks = await get_all_stocks(active_only=True)

    for stock in stocks:
        try:
            indicators = await get_indicators(stock["id"])
            if not indicators:
                continue

            prices = await get_prices(stock["id"], limit=365)
            price_summary = calculate_price_summary(prices)
            scores = calculate_ranking_scores(indicators)
            grade = calculate_quality_grade(scores["overallScore"])
            recommendation = determine_recommendation(scores["overallScore"])

            await insert_analysis(
                stock_id=stock["id"],
                analysis_type="daily",
                summary=(
                    f"Análise diária para {stock['name']}. "
                    f"Pontuação geral: {scores['overallScore']}/100 (Grau {grade})."
                ),
                strengths=generate_strengths(indicators, scores),
                weaknesses=generate_weaknesses(indicators, scores),
                opportunities=["Crescimento do setor", "Expansão de mercado"],
                threats=["Volatilidade do mercado", "Risco macroeconômico"],
                recommendation=recommendation,
                risk_level=determine_risk_level(indicators),
                justification=(
                    f"Pontuação {scores['overallScore']}/100, grau {grade}. "
                    + (
                        "Indicadores positivos de lucratividade e crescimento."
                        if scores["overallScore"] > 50
                        else "Atenção aos indicadores de valor e saúde financeira."
                    )
                ),
                ai_model="rule_based",
            )
            processed += 1

        except Exception as e:
            errors.append(f"{stock['symbol']}: {str(e)}")
            logger.error(f"Error in analysis job for {stock['symbol']}: {e}")

    error_str = "; ".join(errors) if errors else None
    await complete_update_log(log_id, processed, error_str)

    return {"status": "completed", "stocksProcessed": processed, "errors": errors}
