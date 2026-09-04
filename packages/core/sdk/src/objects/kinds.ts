import { NotIssuedError } from "./errors";
import { ObjectHandle, type Contexto, type Fabrica, type FunctionParams, type RelationAccessors } from "./handle";
import { ONTOLOGY } from "../ontology";
import type { KnownKind, ObjectMap, ObjectStub, OtherKind, RangeOpts, UnknownKind } from "./types";

/**
 * Os handles TIPADOS por tipo — o que a Etapa 0 entrega às duas jornadas verticais:
 *
 *   equity_security → market.corporate_events.list
 *   company → issued → instrument → credit.ratings.list
 *
 * Aspect é acessor direto (`market.corporate_events`, `credit.ratings`), relação tem nome de
 * domínio (`issuer()`, `instruments()`), e o grão aparece na assinatura:
 * `company.market.corporate_events` exige escolher o papel, `equity_security` não.
 */

/** As opções de cada atalho SÃO as da função no registry — nada declarado à mão. */
export type CorporateEventsOpts = FunctionParams<"market.corporate_events.list">;
export type RatingsOpts = FunctionParams<"credit.ratings.list">;

export class EquitySecurityHandle extends ObjectHandle<"equity_security"> {
  /** Atalhos com nome de domínio sobre `fn()` — a tipagem vem do registry, não daqui. */
  readonly market = {
    corporate_events: {
      /** Eventos societários mecânicos (desdobramento, grupamento, bonificação) com o fator de ajuste. */
      list: (opts: CorporateEventsOpts = {}) => this.fn("market.corporate_events.list", opts),
    },
    indicators: {
      /** Indicadores fundamentalistas TTM, na data do handle quando houver. */
      latest: () => this.fn("market.indicators.latest"),
    },
  };

  /** A companhia que emitiu este papel (`issued`, direção `in`). */
  async issuer(): Promise<HandleOf<"company"> | null> {
    const [c] = await this.related("issued", "in", { kind: "company" });
    return (c as HandleOf<"company"> | undefined) ?? null;
  }
}

export class CompanyHandle extends ObjectHandle<"company"> {
  readonly market = {
    corporate_events: {
      /**
       * Eventos societários DE UM PAPEL da companhia: o grão é de papel, então `series` (ticker ou
       * classe) é obrigatório NA ASSINATURA — o desdobramento é carimbado no código negociado, e
       * "o evento da Petrobras" não existe, existe o de PETR3 e o de PETR4. Companhia de um papel
       * só também escolhe; é o que a torna explícita.
       */
      list: (opts: CorporateEventsOpts & { series: string }) => {
        // Chamada sem `series` (JS sem tipos, ou `as never`) cai no runtime: é `AmbiguousPaperError`, não TypeError.
        const { series, ...resto } = opts ?? ({} as CorporateEventsOpts & { series: string });
        return this.fn("market.corporate_events.list", resto, { series });
      },
    },
  };

  readonly credit = {
    ratings: {
      /** Rating vigente do EMISSOR, por agência (`perAgency` = uma linha por agência e escala). */
      list: (opts: RatingsOpts = {}) => this.fn("credit.ratings.list", opts),
    },
  };

  /** Os papéis (ações) que a companhia emitiu. */
  async securities(): Promise<HandleOf<"equity_security">[]> {
    return (await this.related("issued", "out", { kind: "equity_security" })) as HandleOf<"equity_security">[];
  }

  /** Os instrumentos (debêntures, CRI…) que a companhia emitiu; `subkind` filtra pela aresta. */
  async instruments(opts: { subkind?: string; limit?: number } = {}): Promise<HandleOf<"instrument">[]> {
    return (await this.related("issued", "out", { kind: "instrument", subkind: opts.subkind, limit: opts.limit })) as HandleOf<"instrument">[];
  }

  /**
   * Um papel específico DESTA companhia, pelo ticker. Só pelas arestas `issued`: a versão
   * anterior caía numa resolução global e `petrobras.paper("VALE3")` devolvia a VALE3.
   */
  async paper(ticker: string): Promise<HandleOf<"equity_security">> {
    const alvo = ticker.toUpperCase();
    const papeis = await this.related("issued", "out", { kind: "equity_security", all: true });
    const papel = papeis.find((h) => (h.code ?? "").toUpperCase() === alvo || h.name?.toUpperCase().startsWith(alvo));
    if (!papel) throw new NotIssuedError(this.id, alvo);
    return papel as HandleOf<"equity_security">;
  }
}


export class InstrumentHandle extends ObjectHandle<"instrument"> {
  readonly credit = {
    ratings: {
      /** Rating vigente DO PAPEL, por agência, com o documento de onde a nota foi lida. */
      list: (opts: RatingsOpts = {}) => this.fn("credit.ratings.list", opts),
    },
  };

  /** Quem emitiu o papel (`issued`, direção `in`): companhia ou fundo. */
  async issuer(): Promise<HandleOf<"company"> | HandleOf<"fund"> | null> {
    const [e] = await this.related("issued", "in");
    return (e as HandleOf<"company"> | HandleOf<"fund"> | undefined) ?? null;
  }
}

export class FundHandle extends ObjectHandle<"fund"> {
  /** Cadastro: administrador, gestor, taxas, situação. */
  profile = () => this.fn("funds.profile.get");
  // Cota, PL, fluxo e cotistas do fundo NÃO têm atalho de função: são MEDIDAS
  // (`quota`, `quota_raw`, `net_worth`, `inflow`, `outflow`, `net_flow`, `shareholders`)
  // e saem por `facts.history(...)`, como qualquer série do objeto.
  readonly portfolio = {
    /** Carteira declarada (CDA), na competência do handle quando houver. */
    latest: (opts: { limit?: number } = {}) => this.fn("funds.holdings.latest", opts),
  };
}

/** O handle certo para cada tipo do manifesto. */
export type HandleOf<K extends string> = (K extends "equity_security"
  ? EquitySecurityHandle
  : K extends "company"
    ? CompanyHandle
    : K extends "instrument"
      ? InstrumentHandle
      : K extends "fund"
        ? FundHandle
        : ObjectHandle<K>) &
  RelationAccessors<K>;

/**
 * União DISCRIMINADA por `kind` — o que `resolveOne` devolve sem `kind`: `switch (h.kind)`
 * estreita. O ramo genérico cobre os tipos do manifesto sem handle próprio, e o ramo FUTURO
 * (`UnknownKind`, string marcada) cobre tipo que o contrato publique depois deste SDK ser
 * gerado: chega em runtime, cai no `default` do `switch`, e o tipo não mente que é impossível.
 */
export type AnyObjectHandle =
  | (EquitySecurityHandle & RelationAccessors<"equity_security">)
  | (CompanyHandle & RelationAccessors<"company">)
  | (InstrumentHandle & RelationAccessors<"instrument">)
  | (FundHandle & RelationAccessors<"fund">)
  | (ObjectHandle<OtherKind> & RelationAccessors<OtherKind>)
  | (ObjectHandle<UnknownKind> & RelationAccessors<UnknownKind>);

const CONHECIDOS: Record<KnownKind, new (ctx: Contexto, stub: ObjectStub<never>, opts?: { at?: string; mapa?: ObjectMap }) => ObjectHandle<string>> = {
  equity_security: EquitySecurityHandle as never,
  company: CompanyHandle as never,
  instrument: InstrumentHandle as never,
  fund: FundHandle as never,
};

/** A única fábrica de handles: escolhe a classe pelo `kind` do stub. */
export function fabricaDeHandles(db: Contexto["db"]): Fabrica {
  const ctx: Contexto = { db, fabrica: (stub, opts) => criar(ctx, stub, opts) };
  return ctx.fabrica;
}

const DO_MANIFESTO = new Set<string>(ONTOLOGY.kinds);

/** O ramo FUTURO de `AnyObjectHandle`: tipo que o contrato publicou depois deste SDK ser gerado. */
export type FutureObjectHandle = ObjectHandle<UnknownKind> & RelationAccessors<UnknownKind>;

/**
 * Separa o ramo futuro ANTES do `switch (h.kind)`. Medido com o tsc 5.9: string marcada não é
 * excluída por `case "company"` (é comparável a string), e `never` mentiria — então a união só
 * fecha depois deste guard: `if (isFutureKind(h)) … else switch (h.kind) { case "company": h.credit }`.
 */
export function isFutureKind(h: AnyObjectHandle): h is FutureObjectHandle {
  return !DO_MANIFESTO.has(h.kind);
}

function criar(ctx: Contexto, stub: ObjectStub, opts?: { at?: string; mapa?: ObjectMap }): ObjectHandle<string> {
  const Classe = (CONHECIDOS as Record<string, (typeof CONHECIDOS)[KnownKind] | undefined>)[stub.kind];
  if (Classe) return new Classe(ctx, stub as ObjectStub<never>, opts);
  // Tipo do manifesto sem handle próprio, ou tipo que nasceu depois deste SDK: os dois viram o
  // handle genérico; o segundo é tipado como `UnknownKind` para a união discriminada não mentir.
  return DO_MANIFESTO.has(stub.kind) ? new ObjectHandle<OtherKind>(ctx, stub as ObjectStub<OtherKind>, opts) : new ObjectHandle<UnknownKind>(ctx, stub as ObjectStub<UnknownKind>, opts);
}
