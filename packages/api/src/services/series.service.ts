import { NotFoundError } from "../middleware/errors";
import { marketsRepo } from "../repositories/markets.repo";
import { decodeCursor, paginate, type PaginationQuery } from "../lib/pagination";

export interface SeriesListQuery extends PaginationQuery {
  source?: string;
  search?: string;
}
export interface SeriesQuery {
  from?: string;
  to?: string;
  accumulated?: "none" | "12m";
}

function toMeta(row: NonNullable<Awaited<ReturnType<typeof marketsRepo.seriesMeta>>>) {
  return {
    source: row.source,
    series_id: row.seriesId,
    name: row.name,
    label: row.label,
    unit: row.unit,
    frequency: row.frequency,
    first_date: row.firstDate,
    last_date: row.lastDate,
  };
}

// Acumulado em janela móvel de 12m (soma) — convenção de fluxos % (ex.: IPCA 12m).
function rolling12m(obs: { date: string; value: number | null }[]) {
  return obs.map((o, i) => {
    const window = obs.slice(Math.max(0, i - 11), i + 1);
    if (window.length < 12 || window.some((w) => w.value == null)) {
      return { date: o.date, value: null as number | null };
    }
    return { date: o.date, value: window.reduce((s, w) => s + (w.value ?? 0), 0) };
  });
}

export const seriesService = {
  async list(q: SeriesListQuery) {
    const page = decodeCursor(q.cursor, q.limit);
    const rows = await marketsRepo.seriesCatalog({ source: q.source, search: q.search, ...page });
    return paginate(rows.map(toMeta), page);
  },

  async get(source: string, seriesId: string, q: SeriesQuery) {
    const meta = await marketsRepo.seriesMeta(source, seriesId);
    const observations = await marketsRepo.seriesObservations(source, seriesId, {
      from: q.from,
      to: q.to,
    });
    if (!meta && !observations.length) {
      throw new NotFoundError(`Série ${source}/${seriesId} não encontrada`);
    }
    const obs = q.accumulated === "12m" ? rolling12m(observations) : observations;
    return {
      meta: meta
        ? toMeta(meta)
        : { source, series_id: seriesId, name: seriesId, label: seriesId, unit: null, frequency: null, first_date: null, last_date: null },
      observations: obs,
    };
  },
};
