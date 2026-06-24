import { marketsRepo } from "../repositories/markets.repo";
import { decodeCursor, paginate, type PaginationQuery } from "../lib/pagination";

export interface TesouroQuery extends PaginationQuery {
  type?: string;
  maturity?: string;
  date?: string;
}

const avg = (a: number | null, b: number | null): number | null => {
  if (a != null && b != null) return (a + b) / 2;
  return a ?? b ?? null;
};

export const bondsService = {
  async tesouro(q: TesouroQuery) {
    const page = decodeCursor(q.cursor, q.limit);
    const rows = await marketsRepo.tesouroBonds({
      type: q.type,
      maturity: q.maturity,
      date: q.date,
      ...page,
    });
    const data = rows.map((r) => ({
      type: r.type,
      name: r.name,
      maturity: r.maturity,
      date: r.date,
      buy_rate: r.buyRate,
      sell_rate: r.sellRate,
      buy_price: r.buyPrice,
      sell_price: r.sellPrice,
    }));
    return paginate(data, page);
  },

  async yieldCurve(kind: "nominal" | "real", date?: string) {
    const { date: base, rows } = await marketsRepo.tesouroCurve(kind, date);
    // Um ponto por vencimento: NTN-B e NTN-B-Principal compartilham maturity — média
    // das taxas evita pontos sobrepostos/segmento vertical no gráfico.
    const byMaturity = new Map<string, { years: number | null; rates: number[] }>();
    for (const r of rows) {
      const rate = avg(r.buyRate, r.sellRate);
      if (rate == null || (r.maturityYears ?? 0) <= 0) continue;
      const e = byMaturity.get(r.maturity) ?? { years: r.maturityYears, rates: [] };
      e.rates.push(rate);
      byMaturity.set(r.maturity, e);
    }
    const points = [...byMaturity.entries()]
      .map(([maturity, e]) => ({
        maturity,
        years: e.years,
        rate: e.rates.reduce((s, x) => s + x, 0) / e.rates.length,
      }))
      .sort((a, b) => (a.years ?? 0) - (b.years ?? 0));
    return { date: base, kind, points };
  },
};
