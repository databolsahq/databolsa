import type { DataBolsaClient } from "../client";
import { ONTOLOGY } from "../ontology";
import { SubjectOverrideError } from "./errors";

/**
 * A LIGAÇÃO entre o capítulo do mapa e o método flat, DERIVADA DO CONTRATO.
 *
 * `getObject` publica, por capítulo, a operação e a chamada resolvida (`defaults`). O que ele não
 * dizia era qual chave de `defaults` vai no CAMINHO da rota e qual vai na query —
 * `listCorporateEvents` recebe `ticker` posicional, `listCreditRatings` recebe `assetCode` como filtro. Desde 28/08/2026
 * o contrato publica isso em `x-ontology.bindings` (lido do próprio path), e este módulo só o
 * aplica: os métodos do client recebem os parâmetros de caminho na ordem do path e, por último,
 * o objeto de query. Não há tabela à mão; operação nova entra pelo contrato.
 */
export type Defaults = Record<string, string>;

export type ParametroTemporal = "at" | "date" | "to";
type Ligacao = { path_parameters: readonly string[]; temporal_parameter: ParametroTemporal | null };
const LIGACOES: ReadonlyMap<string, Ligacao> = new Map(ONTOLOGY.bindings.map((b) => [b.operation, b]));

/** As operações que o contrato sabe ligar — todas as que o mapa pode apontar. */
export const OPERACOES_LIGADAS: readonly string[] = [...LIGACOES.keys()];

/** Qual parâmetro de query recebe um corte temporal nesta operação; `null` = só responde o vigente. */
export function parametroTemporal(operation: string): ParametroTemporal | null | undefined {
  return LIGACOES.get(operation)?.temporal_parameter;
}

function exigir(d: Defaults, chave: string, operation: string): string {
  const v = d[chave];
  if (v === undefined) throw new Error(`O mapa não trouxe \`${chave}\` em defaults de ${operation}: ${JSON.stringify(d)}`);
  return v;
}

/**
 * Monta e executa a chamada: caminho na ordem do contrato, o resto de `defaults` e os `params`
 * do chamador na query (o chamador vence). Devolve `undefined` quando o contrato não liga a
 * operação — o chamador decide o que dizer.
 */
export function executar(db: DataBolsaClient, operation: string, defaults: Defaults, params: object): Promise<unknown> | undefined {
  const caminho = LIGACOES.get(operation)?.path_parameters;
  const metodo = (db as unknown as Record<string, unknown>)[operation];
  if (!caminho || typeof metodo !== "function") return undefined;
  const posicionais = caminho.map((k) => exigir(defaults, k, operation));
  // `defaults` É o sujeito. Um parâmetro com a mesma chave trocaria o objeto por baixo do handle
  // (a Petrobras pedindo o rating de outro CNPJ), então é recusado — nunca sobrescrito em silêncio.
  for (const k of Object.keys(params)) if (k in defaults) throw new SubjectOverrideError(operation, k);
  const query: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(defaults)) if (!caminho.includes(k)) query[k] = v;
  Object.assign(query, params);
  const args: unknown[] = Object.keys(query).length ? [...posicionais, query] : posicionais;
  return (metodo as (...a: unknown[]) => Promise<unknown>).apply(db, args);
}
