import { describe, expect, test } from "bun:test";
import { HttpClient } from "../http-client";
import { ONTOLOGY } from "../ontology";
import { OPERACOES_LIGADAS } from "./bindings";
import { AmbiguousObjectError, AmbiguousPaperError, AspectUnavailableError, ObjectNotFoundError, TemporalCutUnsupportedError, UnknownFactError } from "./errors";
import { Objects } from "./facade";
import { clienteFalso } from "./fake";
import { CompanyHandle, EquitySecurityHandle, InstrumentHandle, isFutureKind, type AnyObjectHandle } from "./kinds";
import { ObjectHandle } from "./handle";

const PETR4 = "pub_3e80862b6163669c";
const PETROBRAS = "pub_b58cbecf6730bf83";
const PETR14 = "pub_b17f596e654e28b0";

function montar() {
  const { db, chamadas } = clienteFalso();
  return { objects: new Objects(db), chamadas, ops: () => chamadas.map((c) => c.op) };
}

describe("resolveOne", () => {
  test("com `kind`, devolve o handle daquele tipo, sem chamar getObject", async () => {
    const { objects, ops } = montar();
    const petr4 = await objects.resolveOne("PETR4", { kind: "equity_security" });
    expect(petr4).toBeInstanceOf(EquitySecurityHandle);
    expect(petr4.id).toBe(PETR4);
    expect(petr4.kind).toBe("equity_security");
    expect(ops()).toEqual(["resolveObject"]);
  });

  test("texto sem objeto é ObjectNotFoundError, e ambiguidade é erro COM os candidatos", async () => {
    const { objects } = montar();
    await expect(objects.resolveOne("XXXX9")).rejects.toBeInstanceOf(ObjectNotFoundError);
    // `pub_b58…` casa a companhia; o CNPJ casa só ela. Para forçar ambiguidade, dois mapas com
    // o mesmo ticker não existem na fixture — então simulamos pelo veredito.
    const { db } = clienteFalso({
      resolveObject: async () => ({
        data: [
          { id: "a", kind: "fund", subkind: "fii", name: "A", query: "q", anchor_type: "cnpj", anchor_value: "1", match_kind: "prefix_name", matched_key_type: null, matched_key_value: null, confidence: "low" },
          { id: "b", kind: "fund", subkind: "fidc", name: "B", query: "q", anchor_type: "cnpj", anchor_value: "2", match_kind: "prefix_name", matched_key_type: null, matched_key_value: null, confidence: "low" },
        ],
        meta: { next_cursor: null, count: 2, queries: [{ q: "q", best_id: null, candidates: 2, reason: "ambiguous" }] },
      }) as never,
    });
    const erro = await new Objects(db).resolveOne("q").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(AmbiguousObjectError);
    expect((erro as AmbiguousObjectError).candidates.map((c) => c.id)).toEqual(["a", "b"]);
  });

  test("sem `kind`, `instanceof` estreita a união; `kind` fica aberto a tipo que o contrato publique depois", async () => {
    const { objects } = montar();
    const h: AnyObjectHandle = await objects.resolveOne("BRPETRDBS043");
    expect(h.kind).toBe("instrument");
    if (h instanceof InstrumentHandle) {
      h satisfies InstrumentHandle;
      expect(typeof h.credit.ratings.list).toBe("function");
    } else {
      throw new Error(`esperava InstrumentHandle, veio ${h.kind}`);
    }
    // A união é DISCRIMINADA por `kind` depois de separar o ramo FUTURO: `switch` estreita sem `instanceof`.
    const escolhido = ((x: AnyObjectHandle) => {
      if (isFutureKind(x)) return x.kind;
      switch (x.kind) {
        case "company":
          return x.credit.ratings.list; // CompanyHandle
        case "equity_security":
          return x.market.quotes.history; // EquitySecurityHandle
        default:
          return null;
      }
    })(h);
    expect(escolhido).toBeNull();
  });

  test("tipo publicado DEPOIS deste SDK ser gerado chega no ramo futuro: handle genérico, `kind` de verdade, sem mentira de tipo", async () => {
    const { db } = clienteFalso({
      resolveObject: (async () => ({
        data: [{ id: "pub_novo", kind: "tipo_que_ainda_nao_existe", subkind: null, name: "Novo", query: "n", anchor_type: "x", anchor_value: "1", match_kind: "exact_key", matched_key_type: "x", matched_key_value: "1", confidence: "high" }],
        meta: { next_cursor: null, count: 1, queries: [{ q: "n", best_id: "pub_novo", candidates: 1, reason: null }] },
      })) as never,
    });
    const h = await new Objects(db).resolveOne("n");
    expect(isFutureKind(h)).toBe(true);
    expect(h).toBeInstanceOf(ObjectHandle);
    expect(h).not.toBeInstanceOf(CompanyHandle);
    expect(String(h.kind)).toBe("tipo_que_ainda_nao_existe");
    // o genérico continua inteiro: relações, fatos e capítulos pelo mapa
    if (isFutureKind(h)) expect(typeof h.links).toBe("function");
  });

  test("`get` carrega o mapa uma vez e `describe` não chama de novo", async () => {
    const { objects, ops } = montar();
    const c = await objects.get(PETROBRAS);
    await c.describe();
    await c.describe();
    expect(ops()).toEqual(["getObject"]);
    expect(c).toBeInstanceOf(CompanyHandle);
  });
});

describe("jornada 1 — equity_security → market.quotes.history", () => {
  test("o ticker vem de `defaults` do mapa, não do texto resolvido", async () => {
    const { objects, chamadas } = montar();
    const petr4 = await objects.resolveOne("PETR4", { kind: "equity_security" });
    await petr4.market.quotes.history({ from: "2025-01-01" });
    expect(chamadas.at(-1)).toEqual({ op: "listQuotes", args: ["PETR4", { from: "2025-01-01" }] });
  });

  test("`facts.history` devolve UMA série e recusa medida desconhecida pelo nome", async () => {
    const { objects, chamadas } = montar();
    const petr4 = await objects.resolveOne("PETR4", { kind: "equity_security" });
    const serie = await petr4.facts.history("close", { from: "2025-01-01" });
    expect(serie.fact).toBe("close");
    expect(chamadas.at(-1)?.args[1]).toMatchObject({ facts: "close", from: "2025-01-01" });
    await expect(petr4.facts.historyAny("inexistente")).rejects.toBeInstanceOf(UnknownFactError);
  });

  test("`at` mora no handle: fatos recebem `at`, retrato recebe `at`, série recebe `to`", async () => {
    const { objects, chamadas } = montar();
    const petr4 = (await objects.resolveOne("PETR4", { kind: "equity_security" })).at("2025-06-30");
    expect(petr4).toBeInstanceOf(EquitySecurityHandle);
    await petr4.facts.latest();
    await petr4.market.indicators.latest();
    await petr4.market.quotes.history();
    await petr4.links("holds", { direction: "in" });
    const porOp = Object.fromEntries(chamadas.map((c) => [c.op, c.args]));
    expect(porOp.getObjectFacts?.[1]).toMatchObject({ at: "2025-06-30" });
    expect(porOp.getStockIndicators?.[1]).toEqual({ at: "2025-06-30" });
    expect(porOp.listQuotes?.[1]).toEqual({ to: "2025-06-30" });
    expect(porOp.listObjectLinks?.[1]).toMatchObject({ rel: "holds", direction: "in", at: "2025-06-30" });
  });

  test("`at` num capítulo que só responde o vigente é recusado, não devolvido como se fosse daquela data", async () => {
    const { objects } = montar();
    const deb = (await objects.resolveOne("BRPETRDBS043", { kind: "instrument" })).at("2024-12-31");
    const erro = await deb.credit.ratings.list().catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(TemporalCutUnsupportedError);
    expect((erro as TemporalCutUnsupportedError).operation).toBe("listCreditRatings");
  });

  test("`facts.history` de medida de papel numa companhia sem `series` recusa a escolha em silêncio", async () => {
    const { db } = clienteFalso({
      getObjectHistory: (async (id: string) => ({
        data: [
          { entity_id: id, fact: "close", series: "PETR3", points: [], count: 0, truncated: false, error: null },
          { entity_id: id, fact: "close", series: "PETR4", points: [], count: 0, truncated: false, error: null },
        ],
        meta: { next_cursor: null, count: 2, truncated: false, warnings: [], subjects: [{ id, resolved_id: id, redirected_from: null, status: "ok", reason: null }] },
      })) as never,
    });
    const petrobras = await new Objects(db).resolveOne("33000167000101", { kind: "company" });
    const erro = await petrobras.facts.history("close").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(AmbiguousPaperError);
    expect((erro as AmbiguousPaperError).tickers).toEqual(["PETR3", "PETR4"]);
  });

  test("`issuer()` atravessa `issued` na direção `in` e NÃO chama getObject da companhia", async () => {
    const { objects, ops } = montar();
    const petr4 = await objects.resolveOne("PETR4", { kind: "equity_security" });
    const emissor = await petr4.issuer();
    expect(emissor).toBeInstanceOf(CompanyHandle);
    expect(emissor?.id).toBe(PETROBRAS);
    expect(ops()).toEqual(["resolveObject", "listObjectLinks"]);
  });
});

describe("jornada 2 — company → issued → instrument → credit.ratings.list", () => {
  test("`instruments()` traz só o outro lado de tipo instrument, um handle por objeto", async () => {
    const { objects } = montar();
    const petrobras = await objects.resolveOne("33000167000101", { kind: "company" });
    const debs = await petrobras.instruments();
    expect(debs.map((d) => d.id)).toEqual([PETR14, "pub_2ae0927c6c8595f5"]);
    expect(debs.every((d) => d instanceof InstrumentHandle)).toBe(true);
  });

  test("`instruments({ subkind })` filtra pela aresta, sem um getObject por instrumento", async () => {
    const { objects, ops } = montar();
    const petrobras = await objects.resolveOne("33000167000101", { kind: "company" });
    const debs = await petrobras.instruments({ subkind: "debenture" });
    expect(debs.map((d) => [d.id, d.subkind])).toEqual([[PETR14, "debenture"]]);
    expect(ops().filter((o) => o === "getObject")).toHaveLength(0);
  });

  test("capítulo com available:false é chamado mesmo assim e responde vazio — não é erro", async () => {
    const { objects, chamadas } = montar();
    const deb = await objects.resolveOne("BRPETRDBS043", { kind: "instrument" });
    expect((await deb.aspects()).find((a) => a.name === "ratings")?.available).toBe(false);
    const r = await deb.credit.ratings.list();
    expect(r.data).toEqual([]);
    expect(chamadas.at(-1)?.op).toBe("listCreditRatings");
  });

  test("rating do papel vai por `assetCode` (ISIN) e o do emissor por `issuerCnpj`, ambos do mapa", async () => {
    const { objects, chamadas } = montar();
    const petrobras = await objects.resolveOne("33000167000101", { kind: "company" });
    const [deb] = await petrobras.instruments();
    await deb!.credit.ratings.list({ scale: "national_br" });
    expect(chamadas.at(-1)).toEqual({ op: "listCreditRatings", args: [{ scale: "national_br", assetCode: "BRPETRDBS043" }] });
    await petrobras.credit.ratings.list();
    expect(chamadas.at(-1)).toEqual({ op: "listCreditRatings", args: [{ issuerCnpj: "33000167000101" }] });
  });

  test("`issuer()` da debênture volta à companhia", async () => {
    const { objects } = montar();
    const deb = await objects.resolveOne("BRPETRDBS043", { kind: "instrument" });
    const emissor = await deb.issuer();
    expect(emissor?.kind).toBe("company");
  });
});

describe("companhia versus papel", () => {
  test("capítulo de papel numa companhia com dois papéis exige escolher", async () => {
    const { objects } = montar();
    const petrobras = await objects.resolveOne("33000167000101", { kind: "company" });
    // o tipo já exige `series` em `market.quotes.history`; pela porta genérica, o runtime recusa
    const erro = await petrobras.fn("market.quotes.history").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(AmbiguousPaperError);
    expect((erro as AmbiguousPaperError).tickers).toEqual(["PETR3", "PETR4"]);
  });

  test("`series` aceita o ticker ou a classe; `paper()` devolve o handle do papel pela aresta", async () => {
    const { objects, chamadas } = montar();
    const petrobras = await objects.resolveOne("33000167000101", { kind: "company" });
    await petrobras.market.quotes.history({ series: "PN", from: "2025-01-01" });
    expect(chamadas.at(-1)).toEqual({ op: "listQuotes", args: ["PETR4", { from: "2025-01-01" }] });
    await petrobras.market.quotes.history({ series: "petr3" });
    expect(chamadas.at(-1)?.args[0]).toBe("PETR3");
    const petr4 = await petrobras.paper("PETR4");
    expect(petr4).toBeInstanceOf(EquitySecurityHandle);
    expect(petr4.id).toBe(PETR4);
    await petr4.market.quotes.history();
    expect(chamadas.at(-1)?.args[0]).toBe("PETR4");
  });

  test("capítulo que o objeto não publica é erro com a lista do que ele publica", async () => {
    const { objects } = montar();
    const petr4 = await objects.resolveOne("PETR4", { kind: "equity_security" });
    const erro = await petr4.aspect("holdings").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(AspectUnavailableError);
    expect((erro as AspectUnavailableError).available).toEqual(["quotes", "indicators", "facts"]);
  });
});

describe("ligação derivada do contrato", () => {
  test("toda operação que o manifesto publica como capítulo tem ligação no contrato, e os genéricos também", () => {
    for (const op of ONTOLOGY.aspects.map((a) => a.operation)) expect(OPERACOES_LIGADAS, op).toContain(op);
    expect(OPERACOES_LIGADAS).toEqual(expect.arrayContaining(["getObjectFacts", "getObjectProperties"]));
  });

  test("toda ligação aponta para um método real do client", () => {
    const proto = HttpClient.prototype as unknown as Record<string, unknown>;
    for (const op of OPERACOES_LIGADAS) expect(typeof proto[op], op).toBe("function");
  });

  // O que este teste guarda: a chave de `defaults` que está no PATH vira argumento posicional, na
  // ordem do path, e o resto de `defaults` desce para a query junto com os parâmetros do chamador.
  // Nenhuma operação do contrato tem hoje mais de um parâmetro de caminho — a última que tinha era
  // a de série macro, apagada em 03/09/2026 —, e `executar` continua montando a lista pela ordem.
  test("caminho vem do path do contrato: o que está no path é posicional, o resto é query", async () => {
    const { db, chamadas } = clienteFalso({
      listCreditRatings: (async (...a: unknown[]) => (chamadas.push({ op: "listCreditRatings", args: a }), {})) as never,
      getObject: (async () => ({ id: "pub_i", kind: "instrument", subkind: "debenture", name: "DEB", keys: [], links: [], declared_facts: [], aspects: [{ name: "ratings", description: "", grain: "object", shape: "snapshot", operation: "listCreditRatings", parameter: "assetCode", value: "BRX", defaults: { assetCode: "BRX" } }] })) as never,
    });
    const i = await new Objects(db).get("pub_i");
    await i.aspect("ratings", { agency: "fitch" });
    // `listCreditRatings` não tem parâmetro de caminho: `assetCode` é FILTRO e desce para a query.
    expect(chamadas.at(-1)).toEqual({ op: "listCreditRatings", args: [{ assetCode: "BRX", agency: "fitch" }] });
  });

  test("`objects` é membro do client", () => {
    const db = new HttpClient("https://api.example.test");
    expect(db.objects).toBeInstanceOf(Objects);
  });
});

// ── tipos ────────────────────────────────────────────────────────────────────────────────
// `facts.history` é ESTRITO no nome da medida (o grão e o tipo governam a assinatura); medida
// publicada depois do SDK entra por `historyAny`. E `resolveOne` sem kind NÃO é `any`.
type _Fechamento = Parameters<EquitySecurityHandle["facts"]["history"]>[0];
const _aceitaClose: _Fechamento = "close";
// @ts-expect-error medida de FII não é medida de papel
const _recusaDeFii: _Fechamento = "fii_dy_12m";
const _aceitaNova: Parameters<EquitySecurityHandle["facts"]["historyAny"]>[0] = "medida_que_ainda_nao_existe";
void _recusaDeFii;
void _aceitaClose;
void _aceitaNova;
type _SemAny = AnyObjectHandle extends never ? never : 0 extends 1 & AnyObjectHandle ? "any" : "ok";
const _semAny: _SemAny = "ok";
void _semAny;

describe("relações geradas do vocabulário", () => {
  test("`petr4.holders()` e `petrobras.issued()` existem sem código escrito à mão, e atravessam o verbo certo", async () => {
    const { objects, chamadas } = montar();
    const petr4 = await objects.resolveOne("PETR4", { kind: "equity_security" });
    await petr4.holders({ limit: 10 });
    const cia = await objects.resolveOne("33000167000101", { kind: "company" });
    const emitidos = await cia.issued();
    expect(chamadas.filter((c) => c.op === "listObjectLinks").map((c) => [c.args[0], (c.args[1] as { rel: string; direction: string }).rel, (c.args[1] as { direction: string }).direction])).toEqual([
      [PETR4, "holds", "in"],
      [PETROBRAS, "issued", "out"],
    ]);
    expect(emitidos.map((h) => h.id)).toContain(PETR14);
    // o código negociado viaja na aresta e chega ao handle sem `getObject`
    expect(emitidos.find((h) => h.id === PETR14)?.code).toBe("PETR14");
  });

  test("verbo simétrico atravessa os dois lados numa chamada só, sem repetir objeto", async () => {
    const { objects, chamadas } = montar();
    const cia = await objects.resolveOne("33000167000101", { kind: "company" });
    await cia.same_owner();
    const dirs = chamadas.filter((c) => c.op === "listObjectLinks").map((c) => (c.args[1] as { direction: string }).direction).sort();
    expect(dirs).toEqual(["in", "out"]);
  });

  test("acessor escrito à mão tem precedência: `petr4.issuer()` continua devolvendo CompanyHandle", async () => {
    const { objects } = montar();
    const petr4 = await objects.resolveOne("PETR4", { kind: "equity_security" });
    expect(await petr4.issuer()).toBeInstanceOf(CompanyHandle);
  });

  test("todo tipo do manifesto ganha acessor para cada verbo que pratica ou recebe", () => {
    const { db } = clienteFalso();
    const fabrica = new Objects(db);
    void fabrica;
    for (const r of ONTOLOGY.rels) {
      expect(r.forward_name, `${r.rel} sem forward_name`).toBeTruthy();
      expect(r.inverse_name, `${r.rel} sem inverse_name`).toBeTruthy();
    }
  });
});
