"""AI-powered stock analysis engine using z-ai-web-dev-sdk."""
import subprocess
import json
import logging
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)


def call_ai(prompt: str, system: str = "Você é um analista financeiro especialista em análise de ações.") -> str:
    """Call the z-ai-web-dev-sdk chat API via CLI."""
    try:
        result = subprocess.run(
            ["npx", "z-ai-web-dev-sdk", "chat",
             "--prompt", prompt,
             "--system", system],
            capture_output=True, text=True, timeout=60,
            cwd="/home/z/my-project"
        )
        if result.returncode == 0:
            return result.stdout.strip()
        logger.error(f"AI call failed: {result.stderr}")
        return ""
    except subprocess.TimeoutExpired:
        logger.error("AI call timed out")
        return ""
    except Exception as e:
        logger.error(f"AI call error: {e}")
        return ""


def calculate_quality_grade(score: float) -> str:
    """Convert a 0-100 score to a letter grade."""
    if score >= 90:
        return "A+"
    elif score >= 80:
        return "A"
    elif score >= 70:
        return "A-"
    elif score >= 60:
        return "B+"
    elif score >= 50:
        return "B"
    elif score >= 40:
        return "B-"
    elif score >= 30:
        return "C+"
    elif score >= 20:
        return "C"
    elif score >= 10:
        return "C-"
    else:
        return "D"


def calculate_ranking_scores(indicators: Dict[str, Any], price_data: List[Dict] = None) -> Dict[str, float]:
    """Calculate ranking scores based on financial indicators.

    Uses a weighted scoring system based on value investing principles.
    Each dimension is scored 0-100.
    """
    scores = {
        "valueScore": 0,
        "growthScore": 0,
        "profitabilityScore": 0,
        "healthScore": 0,
        "dividendScore": 0,
        "overallScore": 0,
    }

    if not indicators:
        return scores

    # Value Score (lower PE, PB = better value)
    value_points = 0
    pe = indicators.get("peRatio")
    pb = indicators.get("pbRatio")
    ps = indicators.get("priceToSales")

    if pe is not None:
        if pe < 0:
            value_points += 10  # Negative PE = losses, some value investors avoid
        elif pe < 8:
            value_points += 95
        elif pe < 12:
            value_points += 85
        elif pe < 15:
            value_points += 75
        elif pe < 20:
            value_points += 60
        elif pe < 25:
            value_points += 45
        elif pe < 35:
            value_points += 30
        else:
            value_points += 15

    if pb is not None:
        if pb < 0.5:
            value_points += 90
        elif pb < 1.0:
            value_points += 80
        elif pb < 1.5:
            value_points += 65
        elif pb < 2.0:
            value_points += 50
        elif pb < 3.0:
            value_points += 35
        else:
            value_points += 20

    if ps is not None:
        if ps < 1:
            value_points += 85
        elif ps < 2:
            value_points += 65
        elif ps < 5:
            value_points += 45
        else:
            value_points += 25

    count = sum(1 for x in [pe, pb, ps] if x is not None)
    scores["valueScore"] = min(100, value_points / max(count, 1))

    # Growth Score
    growth_points = 0
    rev_growth = indicators.get("revenueGrowth")
    earn_growth = indicators.get("earningsGrowth")

    if rev_growth is not None:
        rev_pct = rev_growth * 100
        if rev_pct > 30:
            growth_points += 95
        elif rev_pct > 20:
            growth_points += 85
        elif rev_pct > 10:
            growth_points += 70
        elif rev_pct > 5:
            growth_points += 55
        elif rev_pct > 0:
            growth_points += 40
        else:
            growth_points += 15

    if earn_growth is not None:
        earn_pct = earn_growth * 100
        if earn_pct > 30:
            growth_points += 95
        elif earn_pct > 20:
            growth_points += 85
        elif earn_pct > 10:
            growth_points += 70
        elif earn_pct > 5:
            growth_points += 55
        elif earn_pct > 0:
            growth_points += 40
        else:
            growth_points += 15

    count = sum(1 for x in [rev_growth, earn_growth] if x is not None)
    scores["growthScore"] = min(100, growth_points / max(count, 1))

    # Profitability Score
    profit_points = 0
    roe = indicators.get("roe")
    roa = indicators.get("roa")
    gross_margin = indicators.get("grossMargin")
    net_margin = indicators.get("netMargin")
    op_margin = indicators.get("operatingMargin")

    for metric in [roe, roa]:
        if metric is not None:
            pct = metric * 100
            if pct > 20:
                profit_points += 90
            elif pct > 15:
                profit_points += 80
            elif pct > 10:
                profit_points += 65
            elif pct > 5:
                profit_points += 45
            elif pct > 0:
                profit_points += 30
            else:
                profit_points += 10

    for metric in [gross_margin, net_margin, op_margin]:
        if metric is not None:
            pct = metric * 100
            if pct > 30:
                profit_points += 85
            elif pct > 20:
                profit_points += 70
            elif pct > 10:
                profit_points += 55
            elif pct > 5:
                profit_points += 40
            elif pct > 0:
                profit_points += 25
            else:
                profit_points += 10

    count = sum(1 for x in [roe, roa, gross_margin, net_margin, op_margin] if x is not None)
    scores["profitabilityScore"] = min(100, profit_points / max(count, 1))

    # Health Score (financial health)
    health_points = 0
    debt_to_equity = indicators.get("debtToEquity")
    current_ratio = indicators.get("currentRatio")
    quick_ratio = indicators.get("quickRatio")
    fcf = indicators.get("freeCashFlow")

    if debt_to_equity is not None:
        if debt_to_equity < 20:
            health_points += 95
        elif debt_to_equity < 50:
            health_points += 80
        elif debt_to_equity < 100:
            health_points += 65
        elif debt_to_equity < 200:
            health_points += 45
        else:
            health_points += 20

    for metric in [current_ratio, quick_ratio]:
        if metric is not None:
            if metric > 2.0:
                health_points += 90
            elif metric > 1.5:
                health_points += 75
            elif metric > 1.0:
                health_points += 60
            elif metric > 0.5:
                health_points += 35
            else:
                health_points += 15

    if fcf is not None:
        if fcf > 0:
            health_points += 80
        else:
            health_points += 20

    count = sum(1 for x in [debt_to_equity, current_ratio, quick_ratio, fcf] if x is not None)
    scores["healthScore"] = min(100, health_points / max(count, 1))

    # Dividend Score
    div_points = 0
    div_yield = indicators.get("dividendYield")
    payout = indicators.get("payoutRatio")

    if div_yield is not None:
        pct = div_yield * 100
        if pct > 8:
            div_points += 85  # Very high yield might be unsustainable
        elif pct > 5:
            div_points += 95
        elif pct > 3:
            div_points += 80
        elif pct > 1:
            div_points += 60
        else:
            div_points += 30

    if payout is not None:
        pct = payout * 100
        if pct < 30:
            div_points += 60  # Room to grow
        elif pct < 50:
            div_points += 90  # Sustainable
        elif pct < 70:
            div_points += 70
        elif pct < 90:
            div_points += 40
        else:
            div_points += 15  # Unsustainable

    count = sum(1 for x in [div_yield, payout] if x is not None)
    scores["dividendScore"] = min(100, div_points / max(count, 1))

    # Overall Score (weighted average)
    scores["overallScore"] = round(
        scores["valueScore"] * 0.20 +
        scores["growthScore"] * 0.25 +
        scores["profitabilityScore"] * 0.25 +
        scores["healthScore"] * 0.20 +
        scores["dividendScore"] * 0.10,
        1
    )

    # Round all scores
    for key in scores:
        scores[key] = round(scores[key], 1)

    return scores


def generate_analysis_prompt(stock_name: str, symbol: str, indicators: Dict,
                             price_summary: Dict, ranking_scores: Dict) -> str:
    """Generate a prompt for AI analysis."""
    return f"""Analise a ação {stock_name} ({symbol}) com base nos seguintes dados financeiros:

INDICADORES FINANCEIROS:
- P/L (Preço/Lucro): {indicators.get('peRatio', 'N/A')}
- P/VPA (Preço/Valor Patrimonial): {indicators.get('pbRatio', 'N/A')}
- ROE (Retorno sobre Patrimônio): {indicators.get('roe', 'N/A')}
- ROA (Retorno sobre Ativos): {indicators.get('roa', 'N/A')}
- Margem Bruta: {indicators.get('grossMargin', 'N/A')}
- Margem Líquida: {indicators.get('netMargin', 'N/A')}
- Dívida/Patrimônio: {indicators.get('debtToEquity', 'N/A')}
- Crescimento de Receita: {indicators.get('revenueGrowth', 'N/A')}
- Crescimento de Lucro: {indicators.get('earningsGrowth', 'N/A')}
- Dividend Yield: {indicators.get('dividendYield', 'N/A')}
- Beta: {indicators.get('beta', 'N/A')}

DADOS DE PREÇO:
- Preço Atual: R$ {price_summary.get('current_price', 'N/A')}
- Variação em 30 dias: {price_summary.get('change_30d', 'N/A')}%
- Variação em 12 meses: {price_summary.get('change_12m', 'N/A')}%

PONTUAÇÃO DE QUALIDADE:
- Valor: {ranking_scores.get('valueScore', 'N/A')}/100
- Crescimento: {ranking_scores.get('growthScore', 'N/A')}/100
- Lucratividade: {ranking_scores.get('profitabilityScore', 'N/A')}/100
- Saúde Financeira: {ranking_scores.get('healthScore', 'N/A')}/100
- Dividendos: {ranking_scores.get('dividendScore', 'N/A')}/100
- Geral: {ranking_scores.get('overallScore', 'N/A')}/100

Responda EXATAMENTE no formato JSON abaixo (sem markdown, sem ```):
{{
  "summary": "Resumo executivo em 2-3 frases sobre a ação",
  "strengths": ["ponto forte 1", "ponto forte 2", "ponto forte 3"],
  "weaknesses": ["ponto fraco 1", "ponto fraco 2"],
  "opportunities": ["oportunidade 1", "oportunidade 2"],
  "threats": ["ameaça 1", "ameaça 2"],
  "recommendation": "strong_buy ou buy ou hold ou sell ou strong_sell",
  "targetPrice": null,
  "riskLevel": "low ou medium ou high ou very_high",
  "justification": "Justificativa detalhada da recomendação em 3-4 frases"
}}"""


def parse_ai_response(response: str) -> Optional[Dict]:
    """Parse the AI response into a structured analysis."""
    if not response:
        return None

    # Try to extract JSON from the response
    try:
        # Sometimes the AI wraps in ```json ... ```
        json_str = response.strip()
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0].strip()
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0].strip()

        result = json.loads(json_str)

        # Validate required fields
        required = ["summary", "strengths", "weaknesses", "opportunities", "threats",
                     "recommendation", "riskLevel", "justification"]
        for field in required:
            if field not in result:
                result[field] = "N/A" if isinstance(result.get(field), str) else []

        return result
    except json.JSONDecodeError:
        logger.error(f"Failed to parse AI response as JSON: {response[:200]}")
        return None
