/**
 * Os erros da superfície object-first. Cada um carrega o que o chamador precisa para decidir
 * o próximo passo — a lista de candidatos, os papéis entre os quais escolher, os capítulos
 * que existem — porque "não encontrado" sem o que existe no lugar é a resposta que faz um
 * agente tatear por sete ferramentas.
 */

export interface ObjectCandidateRef {
  id: string;
  kind: string;
  subkind: string | null;
  name: string | null;
}

/** `resolveOne` não achou objeto para o texto. */
export class ObjectNotFoundError extends Error {
  readonly query: string;
  constructor(query: string) {
    super(`Nenhum objeto encontrado para "${query}"`);
    this.name = "ObjectNotFoundError";
    this.query = query;
  }
}

/** `resolveOne` achou mais de um objeto plausível e se recusa a escolher em silêncio. */
export class AmbiguousObjectError extends Error {
  readonly query: string;
  readonly candidates: ObjectCandidateRef[];
  constructor(query: string, candidates: ObjectCandidateRef[]) {
    const lista = candidates.slice(0, 5).map((c) => `${c.id} (${c.kind}${c.subkind ? `/${c.subkind}` : ""}: ${c.name ?? "?"})`);
    super(`"${query}" é ambíguo entre ${candidates.length} objetos: ${lista.join(", ")}. Passe \`kind\`/\`subkind\` ou use \`objects.get(id)\`.`);
    this.name = "AmbiguousObjectError";
    this.query = query;
    this.candidates = candidates;
  }
}

/** O TIPO deste objeto não tem esse capítulo. `available` é o que o mapa publica (com ou sem dado). */
export class AspectUnavailableError extends Error {
  readonly objectId: string;
  readonly kind: string;
  readonly aspect: string;
  readonly available: string[];
  constructor(objectId: string, kind: string, aspect: string, available: string[]) {
    super(`${objectId} (${kind}) não tem o capítulo "${aspect}". Disponíveis: ${available.length ? available.join(", ") : "nenhum"}`);
    this.name = "AspectUnavailableError";
    this.objectId = objectId;
    this.kind = kind;
    this.aspect = aspect;
    this.available = available;
  }
}

/**
 * O capítulo é DE PAPEL e a companhia tem mais de um: "o preço da Petrobras" não tem resposta.
 * Escolha o papel (`paper("PETR4")` ou `{ series: "PN" }`), não some.
 */
export class AmbiguousPaperError extends Error {
  readonly aspect: string;
  readonly tickers: string[];
  constructor(aspect: string, tickers: string[]) {
    super(`"${aspect}" é por papel e esta companhia tem ${tickers.length}: ${tickers.join(", ")}. Escolha um com \`paper(ticker)\` ou \`series\`.`);
    this.name = "AmbiguousPaperError";
    this.aspect = aspect;
    this.tickers = tickers;
  }
}

/** A medida pedida não existe para este objeto (`getObjectHistory` respondeu `unknown_fact`). */
export class UnknownFactError extends Error {
  readonly objectId: string;
  readonly fact: string;
  constructor(objectId: string, fact: string, reason: string | null) {
    super(`${objectId} não publica a medida "${fact}"${reason ? `: ${reason}` : ""}`);
    this.name = "UnknownFactError";
    this.objectId = objectId;
    this.fact = fact;
  }
}

/**
 * O handle tem `at` e a operação do capítulo só responde o VIGENTE (sem `at` nem `to` no contrato).
 * Devolver o de hoje como se fosse o daquela data é o bug que o handle temporal existe para impedir.
 */
export class TemporalCutUnsupportedError extends Error {
  readonly aspect: string;
  readonly operation: string;
  readonly at: string;
  constructor(aspect: string, operation: string, at: string) {
    super(`"${aspect}" (${operation}) só responde o vigente: não aceita corte em ${at}. Chame sem \`at()\` ou use a operação de histórico correspondente.`);
    this.name = "TemporalCutUnsupportedError";
    this.aspect = aspect;
    this.operation = operation;
    this.at = at;
  }
}

/** O mapa devolveu um capítulo cuja chamada o SDK não sabe montar — é defeito do SDK, não do dado. */
export class UnboundAspectError extends Error {
  readonly operation: string;
  constructor(aspect: string, operation: string) {
    super(`O capítulo "${aspect}" aponta para "${operation}", que o SDK ainda não liga a um método. Use o método flat correspondente.`);
    this.name = "UnboundAspectError";
    this.operation = operation;
  }
}

/** O chamador tentou trocar o SUJEITO da chamada (o `ticker`, o `issuerCnpj`) — isso é outro objeto, não um parâmetro. */
export class SubjectOverrideError extends Error {
  constructor(
    readonly operation: string,
    readonly parameter: string,
  ) {
    super(`\`${parameter}\` é o sujeito de ${operation} e vem do objeto; para outro sujeito, resolva outro handle`);
    this.name = "SubjectOverrideError";
  }
}

/** O handle tem um corte (`at`) e o chamador pediu outro no parâmetro temporal — o handle vence, e a divergência é erro. */
export class TemporalConflictError extends Error {
  constructor(
    readonly parameter: string,
    readonly handleAt: string,
    readonly requested: string,
  ) {
    super(`o handle está em ${handleAt} e a chamada pediu \`${parameter}=${requested}\`; use \`at()\` para mudar a data`);
    this.name = "TemporalConflictError";
  }
}

/** `paper(ticker)` pediu um código que ESTA companhia não emitiu — não se resolve outro papel no lugar. */
export class NotIssuedError extends Error {
  constructor(
    readonly issuerId: string,
    readonly ticker: string,
  ) {
    super(`${issuerId} não emitiu o papel ${ticker}`);
    this.name = "NotIssuedError";
  }
}
