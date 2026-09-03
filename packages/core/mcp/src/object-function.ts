/**
 * O NÚCLEO de `executeObjectFunction` — sujeito, validação de input, execução e explicação
 * de recusa. Mora no motor para que toda casca (o servidor MCP aqui, e qualquer outro
 * consumidor do motor) execute EXATAMENTE o mesmo código: paridade por construção, não por
 * promessa. `object-function-tool.ts` é a casca MCP.
 *
 * Não é um `callAnyOperation`: o id vem de um registry FECHADO (`ONTOLOGY.aspects`, o enum do
 * manifesto), a aplicabilidade ao tipo é verificada pelo mapa do objeto e o sujeito nunca pode
 * ser trocado pelos parâmetros (`SubjectOverrideError`). OperationId, path e payload
 * arbitrários não entram.
 */
import {
  AmbiguousObjectError,
  AmbiguousPaperError,
  AspectUnavailableError,
  NotInPreviewError,
  ObjectNotFoundError,
  ONTOLOGY,
  SubjectOverrideError,
  TemporalConflictError,
  TemporalCutUnsupportedError,
  UnboundAspectError,
  type AnyObjectHandle,
  type DataBolsaClient,
  type HandleOf,
  type ObjectKind,
} from "../../sdk/src/index";
import type { Operation, ParamSpec } from "./openapi";

/**
 * Os INPUTS de cada função, derivados do contrato: os parâmetros de query da operação por
 * baixo, menos o sujeito (o parâmetro que o mapa resolve). A primeira sondagem (28/08, P10)
 * mostrou o modelo chutando `perAgency: "fitch"` e `entity_type: "issuer"` em dez chamadas —
 * função sem input publicado é função que o modelo adivinha.
 */
export type InputsPorFuncao = ReadonlyMap<string, readonly ParamSpec[]>;

export function inputsDoContrato(operations: readonly Operation[]): InputsPorFuncao {
  const porOperacao = new Map(operations.map((op) => [op.operationId, op] as const));
  // O sujeito de CADA tipo sai da lista: `credit.ratings.list` é `issuerCnpj` na companhia e
  // `assetCode` no instrumento, e deixar um deles entrar como input trocaria o objeto por
  // baixo (o SDK só recusa a chave que está em `defaults` do tipo corrente).
  const sujeitos = new Map<string, Set<string>>();
  for (const a of ONTOLOGY.aspects) (sujeitos.get(a.id) ?? sujeitos.set(a.id, new Set()).get(a.id)!).add(a.parameter);
  const out = new Map<string, ParamSpec[]>();
  for (const a of ONTOLOGY.aspects) {
    if (out.has(a.id)) continue;
    const op = porOperacao.get(a.operation);
    if (!op) continue;
    const sujeito = sujeitos.get(a.id)!;
    out.set(a.id, op.params.filter((p) => p.in === "query" && !sujeito.has(p.name)));
  }
  return out;
}

function descreverParametro(p: ParamSpec): string {
  const tipo = p.enum?.length ? p.enum.join("|") : p.type;
  return `${p.name}:${tipo}`;
}

/**
 * Confere `input` contra o contrato ANTES de chamar: chave desconhecida e boolean em texto
 * são recusados com a lista certa, em vez de virarem filtro ignorado ou 400 sem explicação.
 * Sem contrato carregado (testes, fonte sem spec), passa como veio.
 */
export function validarInput(fn: string, input: Record<string, unknown>, inputs: InputsPorFuncao): { ok: true; input: Record<string, unknown> } | { ok: false; message: string } {
  const specs = inputs.get(fn);
  if (!specs) return { ok: true, input };
  const aceitos = specs.map(descreverParametro).join(", ") || "nenhum";
  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null || v === "") continue;
    const spec = specs.find((p) => p.name === k);
    if (!spec) return { ok: false, message: `\`${k}\` não é input de ${fn}. Aceitos: ${aceitos}.` };
    if (spec.type === "boolean") {
      if (typeof v === "boolean") saida[k] = v;
      else if (v === "true" || v === "false") saida[k] = v === "true";
      else return { ok: false, message: `\`${k}\` de ${fn} é boolean (true/false), não "${String(v)}". Aceitos: ${aceitos}.` };
      continue;
    }
    if (spec.enum?.length && !spec.enum.includes(String(v))) return { ok: false, message: `\`${k}\` de ${fn} aceita ${spec.enum.join("|")}, não "${String(v)}".` };
    saida[k] = v;
  }
  return { ok: true, input: saida };
}

/** O registry fechado: os ids de função que o contrato publica, sem repetição por tipo. */
export const FUNCOES_DO_REGISTRY: readonly string[] = [...new Set(ONTOLOGY.aspects.map((a) => a.id))].sort();

/** Os tipos que publicam alguma função — o enum do campo `subject.kind`. */
export const KINDS_COM_FUNCAO = [...new Set(ONTOLOGY.aspects.map((a) => a.kind))] as [string, ...string[]];

/**
 * O TETO da enumeração na descrição da tool. A descoberta é PROGRESSIVA: enquanto o registry cabe
 * em algumas dezenas, a linha por função (tipos e inputs) paga o próprio custo, porque é ela que
 * evita o input adivinhado. Passando disso, a mesma lista vira parede de texto em TODA sessão,
 * inclusive nas que nunca executam função nenhuma — então a descrição publica só os ids e diz
 * onde pedir o resto. Hoje o registry tem 20 funções e nada muda: o teto é a decisão tomada
 * ANTES de o catálogo crescer, não um corte retroativo.
 */
export const TETO_DO_CATALOGO = 24;

/**
 * Uma linha por função: os tipos que a publicam e, quando o grão é por papel, o aviso de `series`.
 * Acima de `teto`, só os ids, com a dica de onde está a lista completa.
 */
export function catalogoDeFuncoes(inputs: InputsPorFuncao = new Map(), opts: { teto?: number } = {}): string {
  const porFuncao = new Map<string, string[]>();
  for (const a of ONTOLOGY.aspects) {
    const tipos = porFuncao.get(a.id) ?? [];
    tipos.push(a.grain === "paper" ? `${a.kind} (por papel: passe series)` : a.kind);
    porFuncao.set(a.id, tipos);
  }
  const entradas = [...porFuncao.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (entradas.length > (opts.teto ?? TETO_DO_CATALOGO)) {
    return (
      entradas.map(([id]) => id).join(", ") +
      " — os inputs e os tipos de cada função estão no mapa do objeto (aspects de getObject, ou describeCapabilities quando existir na sessão)"
    );
  }
  return entradas
    .map(([id, tipos]) => {
      const specs = inputs.get(id);
      const entrada = specs ? ` · input: ${specs.length ? specs.map(descreverParametro).join(", ") : "nenhum"}` : "";
      return `${id} → ${tipos.join(", ")}${entrada}`;
    })
    .join("; ");
}

/** A chamada, sem schema: quem valida a FORMA é a casca (zod no agente, ZodRawShape no MCP). */
export interface ObjectFunctionArgs {
  subject: { entity_id?: string; resolve?: string; kind?: string; subkind?: string };
  function: string;
  input?: Record<string, unknown>;
  series?: string;
  at?: string;
}

/**
 * O sujeito vira handle SEM chamada extra quando vem por id (o mapa é lido uma vez em `fnAny`) e
 * com UMA resolução quando vem por texto. Ambiguidade volta com os candidatos, para o modelo
 * escolher pelo id — nunca o primeiro da lista.
 */
type Sujeito = AnyObjectHandle | HandleOf<ObjectKind>;

async function sujeito(db: DataBolsaClient, s: ObjectFunctionArgs["subject"]): Promise<Sujeito> {
  if (s.entity_id) return db.objects.get(s.entity_id);
  if (!s.resolve) throw new Error("`subject` precisa de `entity_id` ou `resolve`.");
  // `kind` do input é o enum dos tipos com função no registry — subconjunto de `ObjectKind`.
  return s.kind ? db.objects.resolveOne(s.resolve, { kind: s.kind as ObjectKind, subkind: s.subkind }) : db.objects.resolveOne(s.resolve, { subkind: s.subkind });
}

export async function executarFuncaoDeObjeto(db: DataBolsaClient, args: ObjectFunctionArgs, inputs: InputsPorFuncao = new Map()): Promise<{ ok: true; body: unknown } | { ok: false; message: string }> {
  const entrada = validarInput(args.function, args.input ?? {}, inputs);
  if (!entrada.ok) return entrada;
  try {
    const h = await sujeito(db, args.subject);
    const alvo = args.at ? h.at(args.at) : h;
    const result = await alvo.fnAny(args.function, entrada.input, { series: args.series });
    return {
      ok: true,
      body: {
        subject: { id: h.id, kind: h.kind, subkind: h.subkind, name: h.name, code: h.code },
        function: args.function,
        ...(args.at ? { at: args.at } : {}),
        result,
      },
    };
  } catch (e) {
    return { ok: false, message: explicar(e) };
  }
}

/** Cada recusa do SDK vira instrução de próximo passo, não stack. */
export function explicar(e: unknown): string {
  if (e instanceof AmbiguousObjectError) {
    const lista = e.candidates.map((c) => `${c.id} (${c.kind}${c.subkind ? `/${c.subkind}` : ""}: ${c.name})`).join("; ");
    return `Sujeito ambíguo entre ${e.candidates.length} objetos: ${lista}. Repita com subject.entity_id do escolhido, ou estreite com kind/subkind.`;
  }
  if (e instanceof ObjectNotFoundError) return `Nenhum objeto para "${e.query}". Confira o código ou use resolveObject/search.`;
  if (e instanceof AspectUnavailableError) return e.message;
  if (e instanceof AmbiguousPaperError) return `${e.message} Repita com series=<ticker>.`;
  if (e instanceof SubjectOverrideError) return `${e.message} O sujeito vem do objeto; tire esse campo de input.`;
  if (e instanceof TemporalConflictError || e instanceof TemporalCutUnsupportedError) return `${e.message} Use só \`at\` para cortar no tempo, ou omita-o.`;
  if (e instanceof UnboundAspectError) return e.message;
  if (e instanceof NotInPreviewError) return `Recurso em preview e fora do plano desta chave: ${e.message}`;
  const msg = e instanceof Error ? e.message : String(e);
  if (/^API (404|501) /.test(msg)) return `Sem dados para este objeto nesta função (${msg}).`;
  return `Erro ao executar a função: ${msg}`;
}
