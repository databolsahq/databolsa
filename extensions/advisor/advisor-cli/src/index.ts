#!/usr/bin/env bun
/**
 * CLI do DataBolsa Advisor — casca fina sobre o motor de @databolsa/cli
 * (import relativo, bundlado no build). Só muda: contrato (/openapi-advisor.json
 * + openapi-advisor.yaml bundlado), binário, envs e hints.
 *
 *   DATABOLSA_ADVISOR_API_URL   default https://api.databolsa.com
 *   DATABOLSA_ADVISOR_API_KEY   chave pessoal db_live_... (crie em /conta, aba Chaves de API)
 *
 * A organização vem da CHAVE: emita a chave dentro do escritório em que quer agir. Não há
 * variável de workspace — a mesma chave não navega entre organizações.
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
    // pacote publicado: dist/openapi.yaml (copiado no build; é o contrato ADVISOR)
    fileURLToPath(new URL("./openapi.yaml", import.meta.url)),
    // árvore de fonte: raiz do repo
    fileURLToPath(new URL("../../../../api/openapi-advisor.yaml", import.meta.url)),
  ];
}

await runCli({
  version: packageVersion(),
  specPath: "/openapi-advisor.json",
  staticSpecCandidates: staticCandidates(),
  branding: {
    bin: "databolsa-advisor",
    title: "DataBolsa Advisor CLI",
    blurb: "o escritório inteiro pelo terminal: organização, clientes e carteiras.",
    envUrl: "DATABOLSA_ADVISOR_API_URL",
    envKey: "DATABOLSA_ADVISOR_API_KEY",
    defaultApi: "https://api.databolsa.com",
    keyHint: "(crie a chave pessoal db_live_... em databolsa.com/conta, aba Chaves de API)",
    examples: [
      "databolsa-advisor advisorGetMe",
      "databolsa-advisor advisorListClients <org>",
      "databolsa-advisor advisorGetClientPortfolio <org> <portfolioId> --json | jq .totals",
    ],
  },
  apiErrorHint: (status) => {
    if (status === 401) {
      return "Defina DATABOLSA_ADVISOR_API_KEY com uma chave db_live_... emitida DENTRO do escritório (crie em databolsa.com/conta com a organização selecionada).\n";
    }
    if (status === 402) {
      return "A licença da organização expirou — fale com o DataBolsa para renovar.\n";
    }
    if (status === 429) {
      return "Limite de uso atingido — espere a janela virar ou reduza a frequência das chamadas.\n";
    }
    return "";
  },
});
