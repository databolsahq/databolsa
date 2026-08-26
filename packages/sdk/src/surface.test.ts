import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { DataBolsaClient } from "./client";
import { HttpClient } from "./http-client";
import type { operations } from "./schema";

// O contrato é a fonte; o SDK é escrito à mão. Sem uma asserção ligando os dois, uma operação
// nova entra no OpenAPI, a CLI e o MCP a derivam automaticamente, e só o usuário do SDK tipado
// fica de fora — sem erro de compilação, porque método ausente não é erro, é omissão.
// Foi exatamente o que aconteceu: 103 operações no contrato contra 93 métodos, e as 10
// faltantes incluíam as 5 rotas de propriedade recém-publicadas.
//
// operationId por regex e não por parser de YAML de propósito: este arquivo é distribuído
// junto do pacote e não deve arrastar dependência nova só para se auto-verificar.
const specPath = fileURLToPath(new URL("../../../api/openapi.yaml", import.meta.url));
const spec = readFileSync(specPath, "utf8");
const operationIds = [...spec.matchAll(/^\s+operationId:\s*(\S+)\s*$/gm)]
  .map((m) => m[1])
  .filter((id): id is string => !!id);

describe("superfície do SDK × contrato público", () => {
  it("o contrato tem operationIds para conferir", () => {
    expect(operationIds.length).toBeGreaterThan(90);
    expect(new Set(operationIds).size).toBe(operationIds.length);
  });

  it("toda operação do contrato existe como método do client", () => {
    // Os métodos vivem no prototype da classe, não na instância.
    const proto = HttpClient.prototype as unknown as Record<string, unknown>;
    const missing = operationIds.filter((op) => typeof proto[op] !== "function");
    expect(missing).toEqual([]);
  });
});

// A asserção acima guarda a CLASSE. `DataBolsaClient` é a interface e é ela que `index.ts`
// exporta como tipo público — quem escreve `const db: DataBolsaClient = ...` enxerga só o
// que estiver declarado nela. As duas superfícies driftaram em silêncio: a classe tinha os
// 131 métodos e a interface estava sem getIssuerProfile, getPortfolioXray e
// getPortfolioLookThrough. Método ausente numa interface não é erro de compilação, é omissão.
//
// Interface é tipo, apagado em runtime, então o gate tem de ser em tempo de TIPO. Quando
// alguém adicionar operação ao contrato e esquecer a interface, `tsc --noEmit` falha
// NOMEANDO as operações faltantes no lugar de `true`.
//
// A direção é só uma: contrato ⊆ interface. O inverso é permitido de propósito, porque
// existem aliases deprecated deliberados (`listOptionsChain` → `getOptionsChain`) que não
// são, nem deveriam ser, operações do contrato.
type MissingFromInterface = Exclude<keyof operations, keyof DataBolsaClient>;
const _noInterfaceDrift: [MissingFromInterface] extends [never] ? true : MissingFromInterface = true;
void _noInterfaceDrift;

// ── E OS PARÂMETROS DE CADA OPERAÇÃO ────────────────────────────────────────────────
//
// As duas asserções acima guardam o NOME da operação, e por isso deixaram passar um defeito
// inteiro: `resolve` foi publicado no contrato nas sete operações que resolvem id, apareceu na
// referência gerada, e o SDK tipado não o aceitava em nenhuma. `listObjectLinks` existia, então
// nada ficou vermelho — e quem usa o SDK não tinha como alcançar o ramo que herdou o id numa
// cisão, que é justamente o que `resolve=exact` existe para consertar.
//
// Operação faltando é omissão visível. Parâmetro faltando é omissão INVISÍVEL: o método existe,
// compila, responde, e a única coisa que não dá é fazer a pergunta.
//
// A verificação é em tempo de TIPO, sobre o `operations` gerado pelo openapi-typescript — não
// sobre o YAML por regex. Um parâmetro é um campo, não uma linha de texto: o SDK usa tipos
// compartilhados em várias operações e casar string acusaria dezenas de falsos positivos
// (medido: 47 pelo texto contra DOIS de verdade).
//
// A direção é uma só: query do contrato ⊆ params do método. O inverso é permitido, porque o
// SDK tem parâmetros de conveniência que não viajam na query.
type ObjArg<T extends readonly unknown[]> = T extends readonly [infer H, ...infer R]
  ? NonNullable<H> extends Record<string, unknown>
    ? NonNullable<H>
    : ObjArg<R>
  : never;

// `[NonNullable<Q>] extends [never]` e não `NonNullable<Q> extends never`: operação sem query
// nenhuma é gerada como `query?: never`, e `keyof never` é `string | number | symbol` — a lista
// INTEIRA de chaves possíveis. Sem esta guarda, toda rota de escrita aparecia derivando.
type QueryDe<K extends keyof operations> = operations[K] extends { parameters: { query?: infer Q } }
  ? [NonNullable<Q>] extends [never]
    ? never
    : keyof NonNullable<Q>
  : never;

type ParamsDo<K extends keyof DataBolsaClient> = DataBolsaClient[K] extends (...a: infer A) => unknown
  ? ObjArg<A>
  : never;

type OperacoesTipadas = keyof operations & keyof DataBolsaClient;

/** `[operação, parâmetros do contrato que o método não aceita]`, para o erro do `tsc` nomear os dois. */
type DerivaDeParametro = {
  [K in OperacoesTipadas]: Exclude<QueryDe<K>, keyof ParamsDo<K>> extends never
    ? never
    : [K, Exclude<QueryDe<K>, keyof ParamsDo<K>>];
}[OperacoesTipadas];

const _semDerivaDeParametro: [DerivaDeParametro] extends [never] ? true : DerivaDeParametro = true;
void _semDerivaDeParametro;
