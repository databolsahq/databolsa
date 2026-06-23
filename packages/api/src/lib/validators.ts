import { z } from "zod";

// Validates both the YYYY-MM-DD shape AND that it's a real calendar date (rejects
// 2026-13-40), so impossible dates 400 at the edge instead of failing in the DB.
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "data inexistente");

// B3 ticker (PETR4, HGLG11) or index code — matches the contract's path pattern.
// A raiz é quase sempre 4 letras, mas pode conter dígito (B3SA3 = "B3SA" + "3"),
// então: 1ª letra + 3 alfanuméricos + sufixo de classe (0–2 dígitos).
export const tickerParam = z.object({
  ticker: z.string().regex(/^[A-Z][A-Z0-9]{3}[0-9]{0,2}$/, "ticker inválido"),
});

// Rejects an inverted window (from > to). Apply to a schema carrying optional from/to.
export const fromBeforeTo = (q: { from?: string; to?: string }) =>
  !(q.from && q.to) || q.from <= q.to;
