"""IV e Greeks AMERICANOS para a cadeia vigente, via binomial Cox-Ross-Rubinstein.

Opções de ação na B3 são americanas; o BS europeu (int_options__greeks, em SQL)
ignora o prêmio de exercício antecipado — viés ~0 em call, relevante em PUT ITM /
pagador de dividendo (medido em scripts/verify_options_american.py). Este passo
roda SÓ na cadeia viva (~dezenas de milhares de séries), fora do hot-path SQL.

Binomial VETORIZADO sobre todas as séries de uma vez; IV americana por bisseção
(o preço é monotônico em sigma); Greeks por diferenças finitas no próprio binomial
(mesma convenção do europeu: vega por 1%, theta por dia corrido). Materializa uma
tabela por option_ticker que mart_options__chain faz LEFT JOIN.
"""
from __future__ import annotations

import numpy as np
import pyarrow as pa

N_STEPS = 96
BISECTION_ITERS = 40


def crr(S, K, T, r, q, sig, is_call, n=N_STEPS):
    """Preço americano por binomial CRR, vetorizado sobre as séries (arrays (m,))."""
    dt = T / n
    u = np.exp(sig * np.sqrt(dt))
    d = 1.0 / u
    disc = np.exp(-r * dt)
    p = np.clip((np.exp((r - q) * dt) - d) / (u - d), 1e-6, 1 - 1e-6)
    j = np.arange(n + 1)
    # preço do ativo nos nós terminais (uma exponenciação só); nos passos de volta
    # st_i = st_{i+1}/u (incremental) — evita re-exponenciar a árvore inteira por passo.
    st = S[:, None] * u[:, None] ** (n - j[None, :]) * d[:, None] ** j[None, :]
    v = np.where(is_call[:, None], np.maximum(st - K[:, None], 0.0), np.maximum(K[:, None] - st, 0.0))
    for i in range(n - 1, -1, -1):
        st = st[:, : i + 1] / u[:, None]
        cont = disc[:, None] * (p[:, None] * v[:, :-1] + (1 - p[:, None]) * v[:, 1:])
        ex = np.where(is_call[:, None], st - K[:, None], K[:, None] - st)
        v = np.maximum(cont, np.maximum(ex, 0.0))
    return v[:, 0]


def american_iv(price, S, K, T, r, q, is_call):
    lo = np.full_like(price, 0.01)
    hi = np.full_like(price, 5.0)
    for _ in range(BISECTION_ITERS):
        mid = 0.5 * (lo + hi)
        below = crr(S, K, T, r, q, mid, is_call) < price
        lo = np.where(below, mid, lo)
        hi = np.where(below, hi, mid)
    return 0.5 * (lo + hi)


def model(dbt, session):
    dbt.config(materialized="table")
    src = dbt.ref("int_options__chain_inputs").arrow().read_all()
    if src.num_rows == 0:
        return pa.table({
            "option_ticker": pa.array([], pa.string()),
            **{c: pa.array([], pa.float64()) for c in
               ("iv_amer", "delta_amer", "gamma_amer", "vega_amer", "theta_amer", "early_ex_premium")},
        })

    def npcol(name):
        return src.column(name).to_numpy(zero_copy_only=False).astype(float)

    S, K, T = npcol("s"), npcol("k"), npcol("t")
    r, q = npcol("r"), npcol("q")
    price, iv_e = npcol("price"), npcol("iv_euro")
    is_call = np.array([str(x) == "call" for x in src.column("option_type").to_pylist()])

    iv = american_iv(price, S, K, T, r, q, is_call)

    # Greeks por diferença finita central no binomial, avaliados na IV americana.
    h = np.maximum(0.01 * S, 0.01)
    base = crr(S, K, T, r, q, iv, is_call)
    up, dn = crr(S + h, K, T, r, q, iv, is_call), crr(S - h, K, T, r, q, iv, is_call)
    delta = (up - dn) / (2 * h)
    gamma = (up - 2 * base + dn) / (h * h)
    dv = 0.01
    vega = (crr(S, K, T, r, q, iv + dv, is_call) - crr(S, K, T, r, q, iv - dv, is_call)) / (2 * dv) / 100.0
    dt1 = 1.0 / 365.0
    theta = crr(S, K, np.maximum(T - dt1, 1e-6), r, q, iv, is_call) - base  # decaimento de 1 dia

    # prêmio de exercício antecipado (ao IV europeu): americano − europeu, mesmo sigma
    euro = _bs_euro(S, K, T, r, q, iv_e, is_call)
    amer_at_e = crr(S, K, T, r, q, iv_e, is_call)
    premium = amer_at_e - euro

    # null onde a bisseção não identificou (encostou nos limites)
    bad = ~np.isfinite(iv) | (iv <= 0.0101) | (iv >= 4.99)

    def col(x):
        return pa.array(np.where(bad, np.nan, x).astype(float), mask=bad)

    return pa.table({
        "option_ticker": src["option_ticker"],
        "iv_amer": col(iv),
        "delta_amer": col(delta),
        "gamma_amer": col(gamma),
        "vega_amer": col(vega),
        "theta_amer": col(theta),
        "early_ex_premium": col(premium),
    })


def _bs_euro(S, K, T, r, q, sig, is_call):
    """BS europeu (Merton) p/ o prêmio de exercício; CDF normal por Zelen&Severo."""
    sq = sig * np.sqrt(T)
    d1 = (np.log(S / K) + (r - q + 0.5 * sig * sig) * T) / sq
    d2 = d1 - sq
    nd1, nd2 = _ncdf(d1), _ncdf(d2)
    call = S * np.exp(-q * T) * nd1 - K * np.exp(-r * T) * nd2
    put = K * np.exp(-r * T) * _ncdf(-d2) - S * np.exp(-q * T) * _ncdf(-d1)
    return np.where(is_call, call, put)


def _ncdf(x):
    return 0.5 * (1.0 + np.vectorize(_erf)(x / np.sqrt(2.0)))


def _erf(x):
    # Abramowitz-Stegun 7.1.26 (numpy não traz erf sem scipy)
    t = 1.0 / (1.0 + 0.3275911 * abs(x))
    y = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * np.exp(-x * x)
    return np.sign(x) * y
