import type { ObjectKind } from "../ontology";
import type { ObjectFactsResponse, ObjectHistoryResponse, ObjectLinksResponse, ObjectResolveResponse, ObjectResponse } from "../types";

export type ObjectMap = ObjectResponse;
export type ObjectAspect = ObjectResponse["aspects"][number];
export type ObjectDeclaredFact = ObjectResponse["declared_facts"][number];
export type ObjectEdge = ObjectLinksResponse["data"][number];
export type ObjectFact = ObjectFactsResponse["data"][number];
export type ObjectHistorySeries = ObjectHistoryResponse["data"][number];
export type ObjectCandidate = ObjectResolveResponse["data"][number];

/** O mínimo para construir um handle sem chamar `getObject`: o que uma aresta ou um candidato trazem. */
export interface ObjectStub<K extends string = string> {
  id: string;
  kind: K;
  subkind: string | null;
  name: string | null;
  /** O código negociado (PETR4, PETR14), quando a aresta ou o candidato o trouxe. */
  code?: string | null;
}

/**
 * Um tipo que o contrato publicou DEPOIS deste SDK ser gerado. É `string`, mas marcado: não é
 * nenhum dos literais do manifesto, então `switch (h.kind)` continua estreitando os tipos
 * conhecidos e o ramo futuro cai no `default` — sem o tipo mentir que ele é impossível.
 */
export type UnknownKind = string & { readonly __unknownKind: true };

/** Os tipos que ganharam handle próprio na Etapa 0; os demais chegam como `ObjectHandle` genérico. */
export type KnownKind = "equity_security" | "company" | "instrument" | "fund";
export type OtherKind = Exclude<ObjectKind, KnownKind>;

export interface RangeOpts {
  from?: string;
  to?: string;
  limit?: number;
}
