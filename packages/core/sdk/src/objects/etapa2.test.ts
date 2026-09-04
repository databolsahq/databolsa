// Etapa 2 do plano object-first: os tipos do manifesto GOVERNAM as chamadas. Cada ponto abaixo
// tem o teste que o prende; o que é de tipo é provado por atribuição (compila ou não).
import { describe, expect, test } from "bun:test";
import { HttpClient } from "../http-client";
import type { RelationTargetsByKind, FunctionOperations } from "../ontology";
import type { DataBolsaClient, ObjectLinksResponse, ObjectResponse } from "../index";
import { Account, assetRefOf } from "./account";
import { AmbiguousPaperError, AspectUnavailableError, NotIssuedError, SubjectOverrideError, TemporalConflictError } from "./errors";
import { Objects, TIPOS_DE_CODIGO } from "./facade";
import { clienteFalso, MAPAS } from "./fake";
import { CompanyHandle, EquitySecurityHandle, FundHandle, InstrumentHandle, type HandleOf } from "./kinds";

const PETR4 = "pub_3e80862b6163669c";
const PETROBRAS = "pub_b58cbecf6730bf83";
const PETR14 = "pub_b17f596e654e28b0";
const FUNDO = "pub_fundo_fii";

const aresta = (o: Partial<ObjectLinksResponse["data"][number]>) =>
  ({ rel: "holds", shape: "snapshot", direction: "in", other_id: FUNDO, other_kind: "fund", other_subkind: "fii", other_name: "FUNDO XPTO FII", other_code: "XPTO11", other_key_type: "cnpj", other_key: "11111111000191", source: "cvm_cda", valid_from: null, valid_to: null, observations: 1, magnitude: null, magnitude_unit: null, evidence: null, evidence_unit: null, confidence: "high", ...o }) as ObjectLinksResponse["data"][number];

const MAPA_DO_FUNDO = {
  id: FUNDO, kind: "fund", subkind: "fii", name: "FUNDO XPTO FII", anchor_type: "cnpj", anchor_value: "11111111000191", cnpj: "11111111000191", cd_cvm: null, isin: null, tickers: ["XPTO11"], redirected_from: null, has_ambiguous_key: false,
  keys: [{ key_type: "cnpj", key_value: "11111111000191", confidence: "high", is_anchor: true }, { key_type: "ticker", key_value: "XPTO11", confidence: "high", is_anchor: false }],
  aspects: [
    { name: "holdings", function: "funds.holdings.latest", description: "", grain: "object", shape: "snapshot", operation: "listFundHoldings", parameter: "cnpj", value: "11111111000191", defaults: { cnpj: "11111111000191" }, available: true },
  ],
  links: [], declared_facts: [], share_classes: [],
} as unknown as ObjectResponse;

function montar(over: Partial<DataBolsaClient> = {}) {
  const { db, chamadas } = clienteFalso({
    listObjectLinks: async (id: string, p: { rel?: string; direction?: string }) => {
      chamadas.push({ op: "listObjectLinks", args: [id, p] });
      if (id === PETR4 && p.rel === "holds" && p.direction === "in") return { data: [aresta({})], meta: { next_cursor: null, count: 1 } };
      // as arestas de emissão de produção, resumidas (as mesmas do `clienteFalso`)
      const base = clienteFalso();
      return base.db.listObjectLinks(id, p as never);
    },
    getObject: async (id: string) => {
      chamadas.push({ op: "getObject", args: [id] });
      if (id === FUNDO) return MAPA_DO_FUNDO;
      const m = MAPAS[id];
      if (!m) throw new Error(`fixture sem ${id}`);
      return m;
    },
    listFundHoldings: async (c: string, p?: unknown) => (chamadas.push({ op: "listFundHoldings", args: [c, p] }), { data: [], meta: { next_cursor: null, count: 0 } }),
    addPortfolioAsset: async (id: string, a: unknown) => (chamadas.push({ op: "addPortfolioAsset", args: [id, a] }), {}),
    addPortfolioTransaction: async (id: string, a: unknown, tx: unknown) => (chamadas.push({ op: "addPortfolioTransaction", args: [id, a, tx] }), {} as never),
    createThesis: async (i: unknown) => (chamadas.push({ op: "createThesis", args: [i] }), {} as never),
    ...over,
  } as Partial<DataBolsaClient>);
  return { db, objects: new Objects(db), account: new Account(db), chamadas, ops: () => chamadas.map((c) => c.op) };
}

describe("1. `fn()` — a função do registry, tipada pelo manifesto", () => {
  test("parâmetros e resposta vêm do método flat que serve a função; o caminho vem de `defaults`", async () => {
    const { objects, chamadas } = montar();
    const petr4 = await objects.resolveOne("PETR4", { kind: "equity_security" });
    // `from`/`to` compilam porque o tipo é o de `db.listCorporateEvents(ticker, opts)`, não a query crua
    await petr4.fn("market.corporate_events.list", { from: "2025-01-01", to: "2025-06-30" });
    expect(chamadas.at(-1)).toEqual({ op: "listCorporateEvents", args: ["PETR4", { from: "2025-01-01", to: "2025-06-30" }] });
    const cia = await objects.resolveOne("33000167000101", { kind: "company" });
    await cia.fn("documents.company.list", { category: "FRE" });
    expect(chamadas.at(-1)).toEqual({ op: "listCompanyDocuments", args: ["9512", { category: "FRE" }] });
    // prova de tipo: a função da companhia é servida por `listCompanyDocuments`
    const op: FunctionOperations["documents.company.list"] = "listCompanyDocuments";
    expect(op).toBe("listCompanyDocuments");
  });

  test("função que o tipo não publica é AspectUnavailableError listando as funções que existem", async () => {
    const { objects } = montar();
    const petr4 = await objects.resolveOne("PETR4", { kind: "equity_security" });
    // `documents.company.list` não é função de papel: o tipo recusa, e em runtime o erro diz o que há
    const erro = await petr4.fn("documents.company.list" as never).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(AspectUnavailableError);
    expect((erro as AspectUnavailableError).message).toContain("market.corporate_events.list");
  });

  test("mapa de servidor antigo, sem `function`, ainda resolve pelo nome do capítulo", async () => {
    const semFuncao = structuredClone(MAPAS[PETR4]!) as ObjectResponse;
    for (const a of semFuncao.aspects) delete (a as { function?: string }).function;
    const { objects, chamadas } = montar({ getObject: async () => semFuncao });
    const petr4 = await objects.get(PETR4);
    await (petr4 as HandleOf<"equity_security">).fn("market.corporate_events.list");
    expect(chamadas.at(-1)?.op).toBe("listCorporateEvents");
  });

  test("os atalhos por tipo são só nomes de domínio sobre `fn()` — mesma chamada, mesmos parâmetros", async () => {
    const { objects, chamadas } = montar();
    const petr4 = await objects.resolveOne("PETR4", { kind: "equity_security" });
    await petr4.market.corporate_events.list({ from: "2025-01-01" });
    await petr4.fn("market.corporate_events.list", { from: "2025-01-01" });
    const [a, b] = chamadas.filter((c) => c.op === "listCorporateEvents");
    expect(a).toEqual(b!);
  });
});

describe("2. relações tipadas nas duas pontas", () => {
  test("`petr4.holders()` devolve FundHandle — nome do vocabulário, tipo do `range_kinds`", async () => {
    const { objects } = montar();
    const petr4 = await objects.resolveOne("PETR4", { kind: "equity_security" });
    const detentores: HandleOf<"fund">[] = await petr4.holders(); // prova de tipo
    expect(detentores[0]).toBeInstanceOf(FundHandle);
    expect(detentores[0]?.code).toBe("XPTO11");
    const alvo: RelationTargetsByKind["equity_security"]["holders"] = "fund"; // e só fundo
    expect(alvo).toBe("fund");
  });

  test("`issuer()` escrito à mão devolve CompanyHandle tipado; `issued()` gerado devolve a união emitida", async () => {
    const { objects } = montar();
    const petr4 = await objects.resolveOne("PETR4", { kind: "equity_security" });
    const cia: HandleOf<"company"> | null = await petr4.issuer();
    expect(cia).toBeInstanceOf(CompanyHandle);
    const emitidos = await cia!.issued();
    expect(emitidos.some((h) => h instanceof InstrumentHandle)).toBe(true);
    expect(emitidos.some((h) => h instanceof EquitySecurityHandle)).toBe(true);
  });
});

describe("3. arestas lidas uma vez por handle", () => {
  test("`securities()` + `instruments()` + `issued()` = UMA chamada de listObjectLinks", async () => {
    const { objects, ops } = montar();
    const cia = await objects.resolveOne("33000167000101", { kind: "company" });
    await Promise.all([cia.securities(), cia.instruments({ subkind: "debenture" }), cia.issued()]);
    expect(ops().filter((o) => o === "listObjectLinks")).toHaveLength(1);
  });

  test("falha não fica memorizada: a chamada seguinte tenta de novo", async () => {
    let n = 0;
    const { objects, ops } = montar({
      listObjectLinks: async () => {
        n += 1;
        if (n === 1) throw new Error("rede");
        return { data: [], meta: { next_cursor: null, count: 0 } };
      },
    });
    const cia = await objects.resolveOne("33000167000101", { kind: "company" });
    await expect(cia.securities()).rejects.toThrow("rede");
    expect(await cia.securities()).toEqual([]);
    expect(n).toBe(2);
  });

  test("limite diferente é leitura diferente — memo não devolve 5 quando pediram 50", async () => {
    const { objects, chamadas } = montar();
    const cia = await objects.resolveOne("33000167000101", { kind: "company" });
    await cia.instruments({ limit: 5 });
    await cia.instruments({ limit: 50 });
    expect(chamadas.filter((c) => c.op === "listObjectLinks").map((c) => (c.args[1] as { limit?: number }).limit)).toEqual([5, 50]);
  });
});

describe("4. `code` chega sem getObject", () => {
  test("do candidato de resolveObject (âncora que é código) e do mapa (chave de código)", async () => {
    const { objects } = montar();
    const petr4 = await objects.resolveOne("PETR4", { kind: "equity_security" });
    expect(petr4.code).toBe("PETR4");
    const cia = await objects.resolveOne("33000167000101", { kind: "company" });
    expect(cia.code).toBeNull(); // CNPJ é identidade, não código negociado
    const deb = await objects.get(PETR14);
    expect(deb.code).toBe("PETR14"); // ISIN é a âncora; o código ANBIMA está em `keys`
    expect(TIPOS_DE_CODIGO).toContain("anbima_code");
  });

  test("`at()` preserva o código no clone", async () => {
    const { objects } = montar();
    const petr4 = await objects.resolveOne("PETR4", { kind: "equity_security" });
    expect(petr4.at("2025-06-30").code).toBe("PETR4");
  });
});

describe("5. FundHandle", () => {
  test("carteira e cadastro pelo CNPJ do mapa; cota é MEDIDA e não tem atalho de função", async () => {
    const { objects, chamadas } = montar();
    const fundo = (await objects.get(FUNDO)) as HandleOf<"fund">;
    expect(fundo).toBeInstanceOf(FundHandle);
    // `funds.quotes.history` foi apagada com a rota: cota, PL, fluxo e cotistas são medidas
    // (`quota`, `quota_raw`, `net_worth`, `inflow`…) e saem por `facts.history`.
    expect((fundo as unknown as { market?: unknown }).market).toBeUndefined();
    await fundo.portfolio.latest({ limit: 10 });
    expect(chamadas.at(-1)?.op).toBe("listFundHoldings");
  });
});

describe("6. `db.account` — a porta de escrita aceita o handle", () => {
  /**
   * As carteiras saíram do SDK core (viraram `@databolsa/wallet-sdk`); o que ficou aqui é
   * a PONTE de identidade que o SDK da Wallet consome: um handle vira `{ entityId }` e só
   * isso — quem traduz para tipo e símbolo é o servidor, pelo spine.
   */
  test("handle vira `{ entityId }` e SÓ isso", async () => {
    const { objects } = montar();
    const petr4 = await objects.resolveOne("PETR4", { kind: "equity_security" });
    expect(assetRefOf(petr4)).toEqual({ entityId: PETR4 });
    const [fii] = await petr4.holders();
    expect(assetRefOf(fii!)).toEqual({ entityId: FUNDO });
    // referência crua passa intacta — a chave natural continua valendo
    expect(assetRefOf({ assetType: "tesouro", symbol: "Tesouro Selic 2029" })).toEqual({ assetType: "tesouro", symbol: "Tesouro Selic 2029" });
  });

});

describe("revisão da Etapa 2 — o handle é o sujeito e o tempo", () => {
  test("[P1] o parâmetro de sujeito não troca o objeto: outro issuerCnpj é SubjectOverrideError", async () => {
    const { objects, chamadas } = montar();
    const cia = await objects.resolveOne("33000167000101", { kind: "company" });
    // o tipo já recusa (`issuerCnpj` sai de FunctionParams); em runtime, também
    await expect(cia.fnAny("documents.company.list", { company: "9999" })).rejects.toBeInstanceOf(SubjectOverrideError);
    const petr4 = await objects.resolveOne("PETR4", { kind: "equity_security" });
    // @ts-expect-error `ticker` é o sujeito e não existe em FunctionParams<"market.corporate_events.list">
    await expect(petr4.fn("market.corporate_events.list", { ticker: "VALE3" })).rejects.toBeInstanceOf(SubjectOverrideError);
    expect(chamadas.filter((c) => c.op === "listCompanyDocuments" || c.op === "listCorporateEvents")).toHaveLength(0);
  });

  test("[P1] o corte do handle vence: `to` divergente é TemporalConflictError, igual é aceito", async () => {
    const { objects, chamadas } = montar();
    const petr4 = await objects.resolveOne("PETR4", { kind: "equity_security" });
    const em2024 = petr4.at("2024-12-31");
    await expect(em2024.market.corporate_events.list({ to: "2026-01-01" })).rejects.toBeInstanceOf(TemporalConflictError);
    await em2024.market.corporate_events.list({ to: "2024-12-31", from: "2024-01-01" });
    expect(chamadas.at(-1)).toEqual({ op: "listCorporateEvents", args: ["PETR4", { to: "2024-12-31", from: "2024-01-01" }] });
    await expect(em2024.facts.history("close", { to: "2026-01-01" })).rejects.toBeInstanceOf(TemporalConflictError);
    await em2024.facts.history("close", { from: "2024-01-01" });
    expect((chamadas.at(-1)?.args[1] as { to?: string }).to).toBe("2024-12-31");
  });

  test("[P1] `paper()` só conhece o que ESTA companhia emitiu — VALE3 na Petrobras é NotIssuedError, sem resolução global", async () => {
    const { objects, ops } = montar();
    const cia = await objects.resolveOne("33000167000101", { kind: "company" });
    await expect(cia.paper("VALE3")).rejects.toBeInstanceOf(NotIssuedError);
    expect(ops().filter((o) => o === "resolveObject")).toHaveLength(1); // só a resolução da própria companhia
    expect((await cia.paper("petr4")).id).toBe(PETR4);
  });

  test("[P2] relação paginada: uma página por default, `all` segue o cursor até o fim", async () => {
    const paginas: Record<string, ObjectLinksResponse> = {
      "": { data: [aresta({ other_id: "f1", other_code: "F1" })], meta: { next_cursor: "c2", count: 1 } },
      c2: { data: [aresta({ other_id: "f2", other_code: "F2" })], meta: { next_cursor: null, count: 1 } },
    };
    const { objects, chamadas } = montar({
      listObjectLinks: async (id: string, p: { cursor?: string }) => (chamadas.push({ op: "listObjectLinks", args: [id, p] }), paginas[p.cursor ?? ""]!),
    });
    const petr4 = await objects.resolveOne("PETR4", { kind: "equity_security" });
    expect((await petr4.holders()).map((h) => h.id)).toEqual(["f1"]);
    expect((await petr4.holders({ all: true })).map((h) => h.id)).toEqual(["f1", "f2"]);
    expect((await petr4.holders({ cursor: "c2" })).map((h) => h.id)).toEqual(["f2"]);
    // a primeira página foi lida UMA vez (memo por cursor), a segunda também
    expect(chamadas.filter((c) => c.op === "listObjectLinks").map((c) => (c.args[1] as { cursor?: string }).cursor ?? "")).toEqual(["", "c2"]);
  });

  test("[P2] `fn()` é estrito em compilação; `fnAny()` é a porta explícita para função nova", async () => {
    const { objects, chamadas } = montar();
    const petr4 = await objects.resolveOne("PETR4", { kind: "equity_security" });
    // @ts-expect-error `documents.company.list` não é função de equity_security
    await petr4.fn("documents.company.list").catch(() => undefined);
    // `market.corporate_events.list` é função do papel e continua; `fnAny` é a porta para o id
    // que o tipo ainda não conhece.
    await petr4.fnAny("market.corporate_events.list", { from: "2025-01-01" });
    expect(chamadas.at(-1)?.op).toBe("listCorporateEvents");
  });

  test("[P2] `date` é corte temporal: `fund.at(d).portfolio.latest()` manda a competência", async () => {
    const { objects, chamadas } = montar();
    const fundo = (await objects.get(FUNDO)) as HandleOf<"fund">;
    await fundo.at("2025-06-30").portfolio.latest({ limit: 10 });
    expect(chamadas.at(-1)).toEqual({ op: "listFundHoldings", args: ["11111111000191", { limit: 10, date: "2025-06-30" }] });
  });
});

describe("o grão e o tipo governam a assinatura", () => {
  test("`company.market.corporate_events.list` exige `series` em compilação; `fn` genérico ainda recusa em runtime", async () => {
    const { objects, chamadas } = montar();
    const cia = await objects.resolveOne("33000167000101", { kind: "company" });
    // @ts-expect-error o grão é de papel: sem `series` não compila — e, forçado, é AmbiguousPaperError em runtime
    await expect(cia.market.corporate_events.list()).rejects.toBeInstanceOf(AmbiguousPaperError);
    await cia.market.corporate_events.list({ series: "PETR4", from: "2025-01-01" });
    expect(chamadas.at(-1)).toEqual({ op: "listCorporateEvents", args: ["PETR4", { from: "2025-01-01" }] });
  });

  test("`PropertyName<K>` governa `property()`: nome de outro tipo não compila, e o valor vem do mapa de propriedades", async () => {
    const { objects, chamadas } = montar({
      getObjectProperties: (async (id: string) => (chamadas.push({ op: "getObjectProperties", args: [id] }), {
        data: [{ name: "listing_segment", value: "Novo Mercado", description: "", source: "b3", as_of: null, vocabulary: null }],
        meta: { next_cursor: null, count: 1 },
      })) as never,
    });
    const cia = await objects.resolveOne("33000167000101", { kind: "company" });
    expect((await cia.property("listing_segment"))?.value).toBe("Novo Mercado");
    // @ts-expect-error `fii_segment` é propriedade de fundo, não de companhia
    await cia.property("fii_segment");
    const props = await cia.properties();
    const nome: "listing_segment" | "sector" | (typeof props)[number]["name"] = props[0]!.name;
    void nome;
  });
});
