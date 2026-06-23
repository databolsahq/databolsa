import { z } from "../zod";
import { paginated } from "./pagination";

// mart_bdr__profile — catálogo de BDRs. Sem fonte aberta de subjacente/razão/moeda.
export const bdrProfile = z
  .object({
    ticker: z.string(),
    name: z.string().nullable(),
    isin: z.string().nullable(),
    kind: z.string().nullable().describe("patrocinado | nao_patrocinado"),
    spec: z.string().nullable(),
    first_traded: z.string().nullable(),
    last_traded: z.string().nullable(),
    sessions: z.number().nullable(),
  })
  .openapi({ ref: "BdrProfile" });

export const bdrListResponse = paginated(bdrProfile);

// Cotação EOD de BDR — vem da tabela `prices` (events_only; BDR fica
// adjust_quality='no_event_source', sem fonte de eventos para emissor estrangeiro).
export const bdrQuote = z
  .object({
    date: z.string(),
    open: z.number().nullable(),
    high: z.number().nullable(),
    low: z.number().nullable(),
    close: z.number().nullable(),
    close_raw: z.number().nullable(),
    volume: z.number().nullable(),
    adjust_quality: z.string().nullable(),
  })
  .openapi({ ref: "BdrQuote" });

export const bdrQuotesResponse = paginated(bdrQuote);
