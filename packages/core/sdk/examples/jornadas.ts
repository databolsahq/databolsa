/**
 * As duas jornadas verticais da superfície object-first, contra a API pública, sem citar um
 * endpoint sequer. Roda com `DATABOLSA_API_KEY=… bun examples/jornadas.ts` (Node 18+ também
 * serve, depois de `bun run build`).
 */
import { DataBolsa } from "../src/index";

const db = new DataBolsa(process.env.DATABOLSA_API_URL ?? "https://api.databolsa.com", {
  apiKey: process.env.DATABOLSA_API_KEY,
});

// Jornada 1 — papel → cotações, fatos, emissor
const petr4 = await db.objects.resolveOne("PETR4", { kind: "equity_security" });
console.log(`${petr4.name} (${petr4.id})`);

const quotes = await petr4.market.quotes.history({ from: "2025-01-01", limit: 3 });
console.log("cotações:", quotes.data.length, "pontos; primeiro:", quotes.data[0]);

const close = await petr4.facts.history("close", { from: "2025-01-01", limit: 3 });
console.log(`${close.label} — ${close.count} pontos, unidade ${close.unit}`);

const emJunho = petr4.at("2025-06-30");
const fatos = await emJunho.facts.latest({ facts: ["pl", "dy_12m"] });
console.log("fatos em 30/06/2025:", fatos.map((f) => `${f.label}=${f.value} ${f.unit} (${f.as_of})`));

const issuer = await petr4.issuer();
if (!issuer) throw new Error("PETR4 sem emissor?");
console.log("emissora:", issuer.name, issuer.id);

// Jornada 2 — companhia → emitiu → instrumento → rating
const instrumentos = await issuer.instruments({ limit: 5 });
console.log("instrumentos emitidos (5 maiores):", instrumentos.map((i) => i.name));

// Rating é por PAPEL ou por EMISSOR. As debêntures antigas da Petrobras não têm nota própria
// (o mapa só publica o capítulo quando há dado), então o exemplo procura a primeira que tem —
// e, se nenhuma tiver, diz isso em vez de fingir que a nota do emissor é a do papel.
let comNota: (typeof instrumentos)[number] | undefined;
for (const i of instrumentos) {
  if ((await i.aspects()).some((a) => a.name === "ratings" && a.available)) {
    comNota = i;
    break;
  }
}
if (comNota) {
  const ratings = await comNota.credit.ratings.list();
  console.log(`ratings de ${comNota.name}:`, ratings.data.map((r) => `${r.agency} ${r.rating_raw} (${r.scale})`));
} else {
  console.log("nenhum dos instrumentos tem rating próprio; o rating é do emissor:");
}

const doEmissor = await issuer.credit.ratings.list({ scale: "national_br", limit: 3 });
console.log("ratings da emissora:", doEmissor.data.map((r) => `${r.agency} ${r.rating_raw} em ${r.action_date ?? r.doc_filed_at}`));

// O grão na assinatura: "o preço da Petrobras" não existe — o SDK obriga a escolher o papel.
try {
  await issuer.market.quotes.history();
} catch (e) {
  console.log("esperado:", (e as Error).message);
}
const petr3 = await issuer.paper("PETR3");
console.log("papel escolhido:", petr3.name, (await petr3.market.quotes.history({ limit: 1 })).data[0]?.date);

// Jornada 3 — conjuntos: muitos textos numa ida, e a coorte enumerada, ordenada e resumida.
// `resolveMany` não lança pelo que faltou: devolve um desfecho por consulta, na ordem pedida.
const carteira = await db.objects.resolveMany(["PETR4", "VALE3", "XXXX9"], { kind: "equity_security" });
console.log("carteira:", carteira.map((o) => (o.status === "resolved" ? `${o.q} → ${o.handle.id}` : `${o.q}: ${o.status}`)));

const fidcs = await db.objects.list({ kind: "fund", subkind: "fidc", total: true, limit: 5 });
console.log("FIDCs no grafo:", fidcs.meta.total ?? fidcs.meta.count, "— primeiros:", fidcs.data.map((o) => o.name));

const maiores = await db.objects.rank({ kind: "fund", subkind: "fidc", fact: "fidc_portfolio", order: "desc", limit: 5 });
console.log("maiores carteiras:", maiores.data.map((r) => `${r.name}: ${r.value}`));

// Censo: `count` sem medida conta OBJETOS por grupo, e o grupo aqui é a gestora do outro lado
// da aresta `manages` — por isso a coorte de fundos está em `in`.
const porGestora = await db.objects.aggregate({ kind: "fund", subkind: "fidc", agg: "count", groupBy: "manages", groupByDirection: "in", orderBy: "objects", limit: 5 });
console.log("gestoras com mais FIDCs:", porGestora.data.map((g) => `${g.label}: ${g.objects}`));
