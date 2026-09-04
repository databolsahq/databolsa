// Marco 1 do plano object-first Fase 2: a façade responde por CONJUNTOS, não só por um objeto.
// Resolver muitos textos, enumerar a coorte, ordená-la e resumi-la — sem que o consumidor
// escreva `rel_to` nem descubra sozinho que `resolveObject` só aceita 20 consultas por chamada.
import { afterEach, describe, expect, test } from "bun:test";
import { HttpClient } from "../http-client";
import type { DataBolsaClient, ObjectListResponse } from "../index";
import { Objects } from "./facade";
import { clienteFalso, type Chamada } from "./fake";
import { EquitySecurityHandle, type AnyObjectHandle, type HandleOf } from "./kinds";

const PETR4 = "pub_3e80862b6163669c";
const PETROBRAS = "pub_b58cbecf6730bf83";
const PETR14 = "pub_b17f596e654e28b0";

function montar(over: Partial<DataBolsaClient> = {}) {
  const { db, chamadas } = clienteFalso(over);
  return { db, objects: new Objects(db), chamadas, ops: () => chamadas.map((c) => c.op) };
}

/** Um `resolveObject` de lote governado por uma tabela consulta → candidatos, como o servidor faz. */
function resolvedorDeLote(tabela: Record<string, { id: string; kind?: string; name?: string }[]>, chamadas: Chamada[]) {
  return (async (p: { q: string | string[]; kind?: string; limit?: number }) => {
    chamadas.push({ op: "resolveObject", args: [p] });
    const consultas = Array.isArray(p.q) ? p.q : [p.q];
    const porConsulta = consultas.map((q) => ({
      q,
      candidatos: (tabela[q] ?? []).map((c) => ({ query: q, id: c.id, kind: c.kind ?? "equity_security", subkind: null, name: c.name ?? q, anchor_type: "ticker", anchor_value: q, match_kind: "exact_key", matched_key_type: "ticker", matched_key_value: q, confidence: "high" })),
    }));
    return {
      data: porConsulta.flatMap((c) => c.candidatos),
      meta: {
        next_cursor: null,
        count: porConsulta.reduce((n, c) => n + c.candidatos.length, 0),
        queries: porConsulta.map((c) => ({ q: c.q, best_id: c.candidatos.length === 1 ? c.candidatos[0]!.id : null, candidates: c.candidatos.length, reason: c.candidatos.length === 0 ? "no_match" : c.candidatos.length > 1 ? "ambiguous" : null })),
      },
    };
  }) as never;
}

describe("resolveMany", () => {
  test("três consultas viajam numa chamada só e voltam na ordem em que foram pedidas", async () => {
    const { objects, chamadas, ops } = montar();
    const qs = ["33000167000101", "BRPETRDBS043", "PETR4F"];
    const saida = await objects.resolveMany(qs);
    expect(ops()).toEqual(["resolveObject"]);
    expect((chamadas[0]!.args[0] as { q: string[] }).q).toEqual(qs);
    expect(saida.map((o) => o.q)).toEqual(qs);
    expect(saida.map((o) => (o.status === "resolved" ? o.handle.id : o.status))).toEqual([PETROBRAS, PETR14, PETR4]);
  });

  test("lote parcial devolve os três desfechos lado a lado, sem lançar por causa dos que falharam", async () => {
    const chamadas: Chamada[] = [];
    const { db } = clienteFalso({
      resolveObject: resolvedorDeLote(
        {
          PETR4: [{ id: PETR4, name: "PETR4 (PN)" }],
          PETR: [
            { id: PETR4, name: "PETR4 (PN)" },
            { id: "pub_petr3", name: "PETR3 (ON)" },
          ],
        },
        chamadas,
      ),
    });
    const saida = await new Objects(db).resolveMany(["PETR4", "NAOEXISTE", "PETR"]);
    expect(saida.map((o) => o.status)).toEqual(["resolved", "not_found", "ambiguous"]);
    const [ok, , ambiguo] = saida;
    expect(ok!.status === "resolved" && ok!.handle.id).toBe(PETR4);
    // Ambiguidade traz os candidatos: "não achei" sem o que existe no lugar é o que faz um
    // agente tatear. E `best_id` é nulo nos DOIS casos — por isso o motivo é testado primeiro.
    expect(ambiguo!.status === "ambiguous" && ambiguo!.candidates.map((c) => c.id)).toEqual([PETR4, "pub_petr3"]);
  });

  test("25 consultas viram 2 chamadas (20 + 5) e a ordem GLOBAL atravessa os lotes", async () => {
    const chamadas: Chamada[] = [];
    const qs = Array.from({ length: 25 }, (_, i) => `Q${String(i).padStart(2, "0")}`);
    const tabela = Object.fromEntries(qs.map((q) => [q, [{ id: `pub_${q}` }]]));
    const { db } = clienteFalso({ resolveObject: resolvedorDeLote(tabela, chamadas) });
    const saida = await new Objects(db).resolveMany(qs);
    expect(chamadas.map((c) => (c.args[0] as { q: string[] }).q.length)).toEqual([20, 5]);
    expect(saida.map((o) => o.q)).toEqual(qs);
    expect(saida.map((o) => (o.status === "resolved" ? o.handle.id : null))).toEqual(qs.map((q) => `pub_${q}`));
  });

  test("com `kind`, o handle de cada desfecho já vem estreitado", async () => {
    const { objects } = montar();
    const saida = await objects.resolveMany(["PETR4"], { kind: "equity_security" });
    const primeiro = saida[0]!;
    expect(primeiro.status).toBe("resolved");
    if (primeiro.status !== "resolved") throw new Error("esperava resolved");
    const papel: HandleOf<"equity_security"> = primeiro.handle; // prova de tipo
    expect(papel).toBeInstanceOf(EquitySecurityHandle);
    expect(typeof papel.market.corporate_events.list).toBe("function");
  });
});

// ── tipos ────────────────────────────────────────────────────────────────────────────────
// Sem `kind` o desfecho carrega a UNIÃO, e o compilador recusa tratá-la como um tipo só.
type _Resolvido = Extract<Awaited<ReturnType<Objects["resolveMany"]>>[number], { status: "resolved" }>;
const _uniao: _Resolvido["handle"] extends AnyObjectHandle ? "ok" : "não" = "ok";
const _naoEstreita: _Resolvido["handle"] extends HandleOf<"equity_security"> ? "estreitou" : "ok" = "ok";
void _uniao;
void _naoEstreita;

describe("list", () => {
  test("`relTo`/`relDirection` chegam como `rel_to`/`rel_direction`, e o envelope volta INTACTO", async () => {
    const envelope = { data: [], meta: { next_cursor: "c2", count: 0, total: 412, filterable_properties: [] } } as unknown as ObjectListResponse;
    const chamadas: Chamada[] = [];
    const { db } = clienteFalso({
      listObjects: (async (p: unknown) => (chamadas.push({ op: "listObjects", args: [p] }), envelope)) as never,
    });
    const r = await new Objects(db).list({ kind: "fund", subkind: "fidc", rel: "manages", relTo: PETROBRAS, relDirection: "in", at: "2025-06-30", where: "situation=Em Funcionamento", total: true, limit: 50, cursor: "c1" });
    expect(chamadas[0]!.args[0]).toEqual({ kind: "fund", subkind: "fidc", rel: "manages", rel_to: PETROBRAS, rel_direction: "in", at: "2025-06-30", where: "situation=Em Funcionamento", total: true, limit: 50, cursor: "c1" });
    // Mesmo OBJETO, não uma cópia: cursor, total e o resto do meta sobrevivem à façade.
    expect(r).toBe(envelope);
    expect(r.meta.next_cursor).toBe("c2");
    expect(r.meta.total).toBe(412);
  });
});

describe("rank", () => {
  test("`sinceFrom` e `expandDirection` são traduzidos; `where`, `at` e `from` passam como vieram", async () => {
    const { objects, chamadas } = montar();
    await objects.rank({ kind: "fund", subkind: "fidc", fact: "fidc_impaired_ratio", measure: "delta", at: "2025-06-30", from: "2025-01-31", since: "2025-05-01", sinceFrom: "2025-01-01", expand: "issued", expandDirection: "out", where: "fidc_portfolio>1000000", order: "asc", limit: 10, excludeOutOfPrior: true });
    expect(chamadas.at(-1)).toEqual({
      op: "rankObjects",
      args: [{ kind: "fund", subkind: "fidc", fact: "fidc_impaired_ratio", measure: "delta", at: "2025-06-30", from: "2025-01-31", since: "2025-05-01", since_from: "2025-01-01", expand: "issued", expand_direction: "out", where: "fidc_portfolio>1000000", order: "asc", limit: 10, exclude_out_of_prior: true }],
    });
  });
});

describe("aggregate", () => {
  test("o censo dispensa `fact`; `groupBy` e `orderBy` chegam em snake_case", async () => {
    const { objects, chamadas } = montar();
    const r = await objects.aggregate({ kind: "fund", subkind: "fidc", agg: "count", groupBy: "manages", groupByDirection: "in", orderBy: "objects", limit: 20 });
    expect(chamadas.at(-1)).toEqual({ op: "aggregateObjects", args: [{ kind: "fund", subkind: "fidc", agg: "count", group_by: "manages", group_by_direction: "in", order_by: "objects", limit: 20 }] });
    expect((chamadas.at(-1)!.args[0] as Record<string, unknown>).fact).toBeUndefined();
    expect(r.data[0]?.objects).toBe(3);
  });
});

const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

describe("no fio", () => {
  test("`rank` manda os nomes do CONTRATO na query, e nenhum camelCase sobra", async () => {
    let url = "";
    globalThis.fetch = (async (entrada: string | URL | Request) => {
      url = String(entrada);
      return new Response(JSON.stringify({ data: [], meta: { next_cursor: null, count: 0 } }), { headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const db = new HttpClient("https://api.example.test", { apiKey: "k" });
    await db.objects.rank({ kind: "fund", fact: "fidc_impaired_ratio", sinceFrom: "2025-01-01", expandDirection: "out", excludeOutOfPrior: true, where: "fidc_portfolio>1000000" });
    const q = new URL(url).searchParams;
    expect(q.get("since_from")).toBe("2025-01-01");
    expect(q.get("expand_direction")).toBe("out");
    expect(q.get("exclude_out_of_prior")).toBe("true");
    expect(q.get("where")).toBe("fidc_portfolio>1000000");
    expect(url).not.toContain("sinceFrom");
    expect(url).not.toContain("expandDirection");
    expect(url).not.toContain("excludeOutOfPrior");
  });
});
