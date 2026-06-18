"""Analysis service — pure business logic for stock analysis generation.

These functions have no side effects (no DB calls). They compute derived
values from raw indicators/scores and return them for the caller to persist.
"""

from typing import List, Dict


def calculate_price_summary(prices: List[Dict]) -> Dict:
    """Calculate price change statistics over 30-day and 12-month windows."""
    if not prices or len(prices) < 2:
        return {"current_price": 0, "change_30d": 0, "change_12m": 0}

    current = prices[0]["close"]

    change_30d = 0
    if len(prices) > 22:  # ~22 trading days per month
        change_30d = round((current - prices[22]["close"]) / prices[22]["close"] * 100, 2)

    change_12m = 0
    if len(prices) > 252:  # ~252 trading days per year
        change_12m = round((current - prices[252]["close"]) / prices[252]["close"] * 100, 2)
    elif len(prices) > 1:
        change_12m = round((current - prices[-1]["close"]) / prices[-1]["close"] * 100, 2)

    return {
        "current_price": current,
        "change_30d": change_30d,
        "change_12m": change_12m,
    }


def determine_recommendation(score: float) -> str:
    """Map an overall score to a buy/sell recommendation label."""
    if score >= 80:
        return "strong_buy"
    if score >= 65:
        return "buy"
    if score >= 40:
        return "hold"
    if score >= 25:
        return "sell"
    return "strong_sell"


def determine_risk_level(indicators: Dict) -> str:
    """Determine risk level (low/medium/high/very_high) from beta and D/E ratio.

    Scoring table (from SCORING_METHODOLOGY.md):
      beta > 1.5 OR D/E > 200  → very_high
      beta > 1.5 AND D/E > 200 → high
      beta > 1.0 OR D/E > 100  → medium
      otherwise                 → low
    """
    beta = indicators.get("beta")
    debt = indicators.get("debtToEquity")

    risk_score = 0

    if beta:
        if beta > 1.5:
            risk_score += 3
        elif beta > 1.0:
            risk_score += 2
        else:
            risk_score += 1

    if debt:
        if debt > 200:
            risk_score += 3
        elif debt > 100:
            risk_score += 2
        else:
            risk_score += 1

    if risk_score >= 5:
        return "very_high"
    if risk_score >= 4:
        return "high"
    if risk_score >= 2:
        return "medium"
    return "low"


def generate_strengths(indicators: Dict, scores: Dict) -> List[str]:
    """Generate a list of strength statements from indicator and score data."""
    strengths = []

    if scores.get("profitabilityScore", 0) >= 70:
        strengths.append("Alta lucratividade com margens saudáveis")
    if scores.get("growthScore", 0) >= 70:
        strengths.append("Crescimento consistente de receita e lucro")
    if scores.get("valueScore", 0) >= 70:
        strengths.append("Preço atrativo em relação ao valor fundamental")
    if scores.get("healthScore", 0) >= 70:
        strengths.append("Saúde financeira sólida com baixo endividamento")
    if scores.get("dividendScore", 0) >= 70:
        strengths.append("Histórico consistente de pagamento de dividendos")

    roe = indicators.get("roe")
    if roe and roe > 0.15:
        strengths.append(f"ROE de {roe * 100:.1f}% acima da média do setor")

    if not strengths:
        strengths.append("Empresa estabelecida no mercado")

    return strengths[:5]


def generate_weaknesses(indicators: Dict, scores: Dict) -> List[str]:
    """Generate a list of weakness statements from indicator and score data."""
    weaknesses = []

    if scores.get("valueScore", 0) < 40:
        weaknesses.append("Avaliação elevada em relação aos fundamentos")
    if scores.get("growthScore", 0) < 40:
        weaknesses.append("Crescimento de receita abaixo da média")
    if scores.get("profitabilityScore", 0) < 40:
        weaknesses.append("Margens de lucro abaixo do desejável")
    if scores.get("healthScore", 0) < 40:
        weaknesses.append("Nível de endividamento elevado")

    debt = indicators.get("debtToEquity")
    if debt and debt > 150:
        weaknesses.append(f"Razão dívida/patrimônio de {debt:.0f}% é alta")

    beta = indicators.get("beta")
    if beta and beta > 1.5:
        weaknesses.append(f"Beta de {beta:.1f} indica alta volatilidade")

    if not weaknesses:
        weaknesses.append("Risco de mercado geral")

    return weaknesses[:4]
