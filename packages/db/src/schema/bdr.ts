import { bigint, date, index, pgTable, text } from "drizzle-orm/pg-core";

// mart_bdr__profile — catálogo de BDRs (recibos de ações estrangeiras na B3).
// Cotações vêm da tabela `prices` (codbdi 34/35); aqui é só o cadastro. Sem fonte
// aberta de subjacente/razão/moeda (emissor estrangeiro, fora da CVM).
export const bdrProfile = pgTable(
  "bdr_profile",
  {
    ticker: text("ticker").notNull(),
    name: text("name"),
    isin: text("isin"),
    kind: text("kind"), // patrocinado | nao_patrocinado
    spec: text("spec"),
    firstTraded: date("first_traded", { mode: "string" }),
    lastTraded: date("last_traded", { mode: "string" }),
    sessions: bigint("sessions", { mode: "number" }),
  },
  (t) => [index("bdr_profile_ticker_idx").on(t.ticker)],
);
