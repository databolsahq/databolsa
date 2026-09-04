#!/usr/bin/env bun
/**
 * CLI da mesa de crédito (Credit Desk) — casca fina sobre o motor de @databolsa/cli
 * (import relativo, bundlado no build). Só muda: contrato (/openapi-credit.json +
 * openapi-credit.yaml bundlado), binário, envs e hints.
 *
 * O contrato aqui é o da ORGANIZAÇÃO (`/v1/desk/*`): notas, termos de regulamento e
 * membros da mesa. Os dados públicos de crédito — debêntures, balcão, curvas, risco de
 * emissor — são `/v1/credit/*` do contrato core, e saem pelo `databolsa` de sempre.
 *
 *   DATABOLSA_CREDIT_API_URL    default https://api.databolsa.com
 *   DATABOLSA_CREDIT_API_KEY    chave pessoal db_live_... (crie em /conta, aba Chaves de API)
 *
 * A organização vem da CHAVE: emita a chave dentro da mesa em que quer agir. Não há variável
 * de workspace — a mesma chave não navega entre organizações.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runCli } from "../../../../packages/core/cli/src/run";

function packageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function staticCandidates(): string[] {
  return [
    // pacote publicado: dist/openapi.yaml (copiado no build; é o contrato da MESA)
    fileURLToPath(new URL("./openapi.yaml", import.meta.url)),
    // árvore de fonte: raiz do repo
    fileURLToPath(new URL("../../../../api/openapi-credit.yaml", import.meta.url)),
  ];
}

await runCli({
  version: packageVersion(),
  specPath: "/openapi-credit.json",
  staticSpecCandidates: staticCandidates(),
  branding: {
    bin: "databolsa-credit",
    title: "DataBolsa Credit Desk CLI",
    blurb: "a mesa pelo terminal: organização, notas, termos de regulamento e revisão de extrações.",
    envUrl: "DATABOLSA_CREDIT_API_URL",
    envKey: "DATABOLSA_CREDIT_API_KEY",
    defaultApi: "https://api.databolsa.com",
    keyHint: "(crie a chave pessoal db_live_... em databolsa.com/conta, aba Chaves de API)",
    examples: [
      "databolsa-credit deskGetMe",
      "databolsa-credit deskListOrgRegulationTerms <org> --status pending",
      "databolsa-credit deskListNotes <org> --json | jq '.data[].body'",
    ],
  },
  apiErrorHint: (status) => {
    if (status === 401) {
      return "Defina DATABOLSA_CREDIT_API_KEY com uma chave db_live_... emitida DENTRO da mesa (crie em databolsa.com/conta com a organização selecionada).\n";
    }
    if (status === 402) {
      return "A licença da organização não está vigente — leitura segue aberta, escrita exige regularizar o contrato.\n";
    }
    if (status === 429) {
      return "Limite de uso atingido — espere a janela virar ou reduza a frequência das chamadas.\n";
    }
    return "";
  },
});
