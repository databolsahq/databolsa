import { z } from "../zod";

// RFC 9457 problem+json — the API's error envelope (see middleware/errors.ts).
export const problem = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string().optional(),
    instance: z.string().optional(),
  })
  .openapi({ ref: "Problem" });

// Rastreabilidade da métrica à fonte primária (conta CVM, série BCB). `url` is optional:
// API responses carry it (often null), but the web also builds partial lineages for display.
export const lineage = z
  .object({
    source: z.string(),
    reference: z.string(),
    url: z.string().nullable().optional(),
  })
  .openapi({ ref: "Lineage" });

export const listingSegment = z
  .enum(["novo_mercado", "nivel_2", "nivel_1", "basico", "balcao"])
  .openapi({ ref: "ListingSegment" });

// Dígito final do ticker — 3=ON, 4=PN, 11=UNIT.
export const stockType = z.enum(["ON", "PN", "PNA", "PNB", "UNIT"]).openapi({ ref: "StockType" });

export type Lineage = z.infer<typeof lineage>;
