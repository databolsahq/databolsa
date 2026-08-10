#!/usr/bin/env bun
/**
 * CLI do DataBolsa Advisor — casca fina sobre o motor de @databolsa/cli
 * (import relativo, bundlado no build). Só muda: contrato (/openapi-advisor.json
 * + openapi-advisor.yaml bundlado), binário, envs e hints.
 *
 *   DATABOLSA_ADVISOR_API_URL   default https://api.databolsa.com
 *   DATABOLSA_ADVISOR_API_KEY   chave db_org_... (ou db_live_... de membro)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runCli } from "../../cli/src/run";

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
    fileURLToPath(new URL("../../../api/openapi-advisor.yaml", import.meta.url)),
  ];
}

await runCli({
  version: packageVersion(),
  specPath: "/openapi-advisor.json",
  staticSpecCandidates: staticCandidates(),
  branding: {
    bin: "databolsa-advisor",
    title: "DataBolsa Advisor CLI",
    blurb: "o escritório inteiro pelo terminal: organização, clientes, carteiras e chaves.",
    envUrl: "DATABOLSA_ADVISOR_API_URL",
    envKey: "DATABOLSA_ADVISOR_API_KEY",
    defaultApi: "https://api.databolsa.com",
    keyHint: "(emita a chave db_org_... no portal, em app.databolsa.com/advisor)",
    examples: [
      "databolsa-advisor advisorGetMe",
      "databolsa-advisor advisorListClients <org>",
      "databolsa-advisor advisorGetClientPortfolio <org> <portfolioId> --json | jq .totals",
    ],
  },
  apiErrorHint: (status) => {
    if (status === 401) {
      return "Defina DATABOLSA_ADVISOR_API_KEY com uma chave db_org_... válida (emita no portal Advisor).\n";
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
