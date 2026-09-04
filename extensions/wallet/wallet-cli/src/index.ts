#!/usr/bin/env bun
/**
 * CLI da Wallet do DataBolsa — casca fina sobre o motor de @databolsa/cli (import relativo,
 * bundlado no build). Só muda: contrato (/openapi-wallet.json + openapi-wallet.yaml
 * bundlado), binário, envs e hints.
 *
 *   DATABOLSA_API_URL     default https://api.databolsa.com
 *   DATABOLSA_API_KEY     chave db_live_... (a mesma da plataforma)
 *
 * O workspace vem da CHAVE: uma chave emitida no pessoal age no pessoal, uma emitida numa
 * organização age nela. Não há variável de workspace.
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
    // pacote publicado: dist/openapi.yaml (copiado no build; é o contrato da WALLET)
    fileURLToPath(new URL("./openapi.yaml", import.meta.url)),
    // árvore de fonte: raiz do repo
    fileURLToPath(new URL("../../../../api/openapi-wallet.yaml", import.meta.url)),
  ];
}

await runCli({
  version: packageVersion(),
  specPath: "/openapi-wallet.json",
  staticSpecCandidates: staticCandidates(),
  branding: {
    bin: "databolsa-wallet",
    title: "DataBolsa Wallet CLI",
    blurb: "suas carteiras pelo terminal: posição, transações, importação da B3, custos e raio-X.",
    envUrl: "DATABOLSA_API_URL",
    envKey: "DATABOLSA_API_KEY",
    defaultApi: "https://api.databolsa.com",
    keyHint: "(crie a chave db_live_... em databolsa.com/conta)",
    examples: [
      "databolsa-wallet listPortfolios",
      "databolsa-wallet getPortfolioDetail <id> --json | jq .totals",
      "databolsa-wallet importPortfolioFile <id> --file extrato-b3.xlsx",
    ],
  },
  apiErrorHint: (status) => {
    if (status === 401) return "Defina DATABOLSA_API_KEY com uma chave db_live_... válida (crie em databolsa.com/conta).\n";
    if (status === 402) return "Este recurso pede um plano superior — veja databolsa.com/conta.\n";
    if (status === 429) return "Limite de uso atingido — espere a janela virar ou reduza a frequência das chamadas.\n";
    return "";
  },
});
