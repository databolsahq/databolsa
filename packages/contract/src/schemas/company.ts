import { z } from "../zod";

// Matches company.service.ts `toCompany`. DB-sourced text/flags are modelled nullable
// (honest about the marts) — wider than the old hand-written yaml, which had drifted.
export const company = z
  .object({
    cvm_code: z.number().int(),
    cnpj: z.string().nullable(),
    name: z.string().nullable(),
    trade_name: z.string().nullable().describe("Nome de pregão — null nas fontes abertas"),
    sector: z.string().nullable(),
    subsector: z.string().nullable(),
    listing_segment: z.string().nullable(),
    tickers: z.array(z.string()),
    shares_outstanding: z
      .object({
        common: z.number().nullable(),
        preferred: z.number().nullable(),
        total: z.number().nullable(),
      })
      .describe("Capital emitido (fontes cruzadas FRE/CVM e B3)"),
    free_float_pct: z.number().nullable().describe("% de ações em circulação (FRE)"),
    status: z.string().nullable(),
    has_active_ticker: z.boolean().nullable(),
  })
  .openapi({ ref: "Company" });

// Matches company.service.ts `documents` row mapping.
export const document = z
  .object({
    cvm_code: z.number().int(),
    category: z.string().nullable(),
    type: z.string().nullable(),
    subject: z.string().nullable(),
    reference_date: z.string().nullable(),
    filed_at: z.string().nullable(),
    protocol: z.string().nullable(),
    download_url: z.string().nullable(),
    has_text: z.boolean(),
  })
  .openapi({ ref: "Document" });
