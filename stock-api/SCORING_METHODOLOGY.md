# Metodologia de Scoring — StockGPT Brasil

**Versão atual:** `1.0`
**Arquivo de implementação:** `ai_engine.py` → `calculate_ranking_scores()`
**Fonte de dados:** Yahoo Finance via `yfinance`
**Fonte única de verdade:** Python. O Next.js não calcula scores — apenas lê do banco.

---

## Princípio Geral

O score avalia ações em 5 dimensões independentes (0–100 cada) e combina em um **overallScore ponderado**.
Cada dimensão usa os indicadores disponíveis: se um indicador está ausente no Yahoo Finance, ele não entra no cálculo daquela dimensão.

A fórmula é inspirada em **Value Investing clássico** (Graham/Buffett): favorece empresas baratas, lucrativas, com baixo endividamento e dividendos sustentáveis.

---

## Dimensões e Pesos

| Dimensão           | Peso | Indicadores Utilizados                                      |
|--------------------|------|-------------------------------------------------------------|
| Crescimento        | 25%  | revenueGrowth, earningsGrowth                               |
| Lucratividade      | 25%  | ROE, ROA, grossMargin, netMargin, operatingMargin           |
| Valor              | 20%  | peRatio, pbRatio, priceToSales                              |
| Saúde Financeira   | 20%  | debtToEquity, currentRatio, quickRatio, freeCashFlow        |
| Dividendos         | 10%  | dividendYield, payoutRatio                                  |

```
overallScore = valueScore×0.20 + growthScore×0.25 + profitabilityScore×0.25
             + healthScore×0.20 + dividendScore×0.10
```

---

## Tabelas de Pontuação por Indicador

### Score de Valor (`valueScore`)

**P/L (peRatio)**
| Faixa        | Pontos |
|--------------|--------|
| PE < 0       | 10     |
| PE < 8       | 95     |
| PE < 12      | 85     |
| PE < 15      | 75     |
| PE < 20      | 60     |
| PE < 25      | 45     |
| PE < 35      | 30     |
| PE ≥ 35      | 15     |

**P/VPA (pbRatio)**
| Faixa        | Pontos |
|--------------|--------|
| PB < 0.5     | 90     |
| PB < 1.0     | 80     |
| PB < 1.5     | 65     |
| PB < 2.0     | 50     |
| PB < 3.0     | 35     |
| PB ≥ 3.0     | 20     |

**P/Vendas (priceToSales)**
| Faixa        | Pontos |
|--------------|--------|
| PS < 1       | 85     |
| PS < 2       | 65     |
| PS < 5       | 45     |
| PS ≥ 5       | 25     |

`valueScore = min(100, soma_pontos / qtd_indicadores_presentes)`

---

### Score de Crescimento (`growthScore`)

Mesma escala para `revenueGrowth` e `earningsGrowth` (valores como decimal, ex: 0.15 = 15%):

| Crescimento % | Pontos |
|---------------|--------|
| > 30%         | 95     |
| > 20%         | 85     |
| > 10%         | 70     |
| > 5%          | 55     |
| > 0%          | 40     |
| ≤ 0%          | 15     |

`growthScore = min(100, soma / qtd_presentes)`

---

### Score de Lucratividade (`profitabilityScore`)

**ROE e ROA** (valores como decimal):
| Faixa %   | Pontos |
|-----------|--------|
| > 20%     | 90     |
| > 15%     | 80     |
| > 10%     | 65     |
| > 5%      | 45     |
| > 0%      | 30     |
| ≤ 0%      | 10     |

**Margens** (grossMargin, netMargin, operatingMargin — valores como decimal):
| Faixa %   | Pontos |
|-----------|--------|
| > 30%     | 85     |
| > 20%     | 70     |
| > 10%     | 55     |
| > 5%      | 40     |
| > 0%      | 25     |
| ≤ 0%      | 10     |

`profitabilityScore = min(100, soma_dos_5_indicadores / qtd_presentes)`

---

### Score de Saúde Financeira (`healthScore`)

**Dívida/Patrimônio (debtToEquity)**
| Faixa         | Pontos |
|---------------|--------|
| D/E < 20      | 95     |
| D/E < 50      | 80     |
| D/E < 100     | 65     |
| D/E < 200     | 45     |
| D/E ≥ 200     | 20     |

**Liquidez** (currentRatio e quickRatio — mesma escala):
| Faixa         | Pontos |
|---------------|--------|
| > 2.0         | 90     |
| > 1.5         | 75     |
| > 1.0         | 60     |
| > 0.5         | 35     |
| ≤ 0.5         | 15     |

**Fluxo de Caixa Livre (freeCashFlow)**
| Condição      | Pontos |
|---------------|--------|
| FCF > 0       | 80     |
| FCF ≤ 0       | 20     |

`healthScore = min(100, soma / qtd_presentes)`

---

### Score de Dividendos (`dividendScore`)

**Dividend Yield** (valor como decimal):
| Faixa %       | Pontos | Observação                                   |
|---------------|--------|----------------------------------------------|
| DY > 8%       | 85     | Yield muito alto pode indicar "yield trap"   |
| DY > 5%       | 95     | Faixa ideal                                  |
| DY > 3%       | 80     |                                              |
| DY > 1%       | 60     |                                              |
| DY ≤ 1%       | 30     |                                              |

**Payout Ratio** (valor como decimal):
| Faixa %       | Pontos | Observação        |
|---------------|--------|-------------------|
| Payout < 30%  | 60     | Espaço para crescer |
| Payout < 50%  | 90     | Sustentável        |
| Payout < 70%  | 70     |                   |
| Payout < 90%  | 40     |                   |
| Payout ≥ 90%  | 15     | Insustentável      |

`dividendScore = min(100, soma / qtd_presentes)`

---

## Grau de Qualidade

Conversão do `overallScore` para grau de letra:

| Score    | Grau |
|----------|------|
| ≥ 90     | A+   |
| ≥ 80     | A    |
| ≥ 70     | A-   |
| ≥ 60     | B+   |
| ≥ 50     | B    |
| ≥ 40     | B-   |
| ≥ 30     | C+   |
| ≥ 20     | C    |
| ≥ 10     | C-   |
| < 10     | D    |

---

## Recomendação

Derivada do `overallScore` calculado:

| Score    | Recomendação  |
|----------|---------------|
| ≥ 80     | strong_buy    |
| ≥ 65     | buy           |
| ≥ 40     | hold          |
| ≥ 25     | sell          |
| < 25     | strong_sell   |

---

## Nível de Risco

Calculado separadamente do score — usa `beta` e `debtToEquity`:

| Condição                                    | Risco      |
|---------------------------------------------|------------|
| beta > 1.5 **ou** D/E > 200                 | very_high  |
| beta > 1.5 **e** D/E > 200 (ambos)         | high       |
| beta > 1.0 **ou** D/E > 100                 | medium     |
| demais casos                                 | low        |

Implementação via `determine_risk_level()` em `main.py`.

---

## Indicadores Coletados mas Não Utilizados no Score v1.0

Os indicadores abaixo são coletados e armazenados no banco mas **não participam da fórmula atual**:

| Indicador    | Motivo não incluído         | Candidato para versão |
|--------------|-----------------------------|-----------------------|
| `beta`       | Usado apenas em risco       | v1.1 (Momentum)       |
| `roic`       | Não disponível via yfinance | v1.1                  |
| `evToEbitda` | Não incluído na v1.0        | v1.1 (Valor)          |
| `eps`        | Não incluído na v1.0        | v1.1                  |

---

## Limitações Conhecidas da v1.0

1. **Viés setorial**: D/E alto penaliza bancos e utilities que operam com alavancagem estrutural por natureza.
2. **Sem ajuste setorial**: thresholds são absolutos — não comparam empresa com o peer group do setor.
3. **Snapshot temporal**: não considera tendência dos indicadores (empresa melhorando vs. deteriorando).
4. **Pesos fixos**: não há perfis distintos (value, growth, income). Todos os investidores recebem a mesma pontuação.
5. **Dado ausente distorce score**: empresa com menos indicadores disponíveis pode ter score diferente de empresa com dados completos, por efeito matemático do denominador.
6. **FCF binário**: positivo/negativo — não considera magnitude.

---

## Versionamento

Ao modificar **qualquer peso, threshold ou indicador** da fórmula:

1. Incrementar `SCORE_VERSION` em `ai_engine.py`
2. Atualizar este documento com a nova tabela
3. Reprocessar todos os rankings (`POST /api/update/rankings`)
4. Registrar a mudança no git com a mensagem: `feat(scoring): bump score version to X.Y — <motivo>`

O campo `scoreVersion` em `StockRanking` permite identificar quais scores foram gerados com qual versão da fórmula, tornando comparações históricas confiáveis.
