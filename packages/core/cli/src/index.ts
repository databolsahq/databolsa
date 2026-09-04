#!/usr/bin/env bun
/**
 * Entry da CLI core (databolsa) — casca fina sobre o motor parametrizado em
 * `run.ts` (compartilhado com a casca do Advisor). Comportamento publicado
 * idêntico ao histórico: mesmas envs, mesmos textos, mesmos exit codes.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runCli } from "./run";

function packageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

await runCli({
  version: packageVersion(),
  modules: {
    // `databolsa wallet <operação>`: a Wallet pelo contrato dela (o mesmo de @databolsa/wallet-cli).
    wallet: {
      specPath: "/openapi-wallet.json",
      staticSpecCandidates: [
        fileURLToPath(new URL("./openapi-wallet.yaml", import.meta.url)),
        fileURLToPath(new URL("../../../../api/openapi-wallet.yaml", import.meta.url)),
      ],
      blurb: "Wallet; acesso depende da instalação no workspace (DATABOLSA_WORKSPACE escolhe a organização)",
    },
  },
  branding: {
    bin: "databolsa",
    title: "DataBolsa CLI",
    blurb: "cliente de terminal sobre a Serving API aberta.",
    envUrl: "DATABOLSA_API_URL",
    envKey: "DATABOLSA_API_KEY",
    envWorkspace: "DATABOLSA_WORKSPACE",
    defaultApi: "https://api.databolsa.com",
    keyHint: "(crie a chave em databolsa.com/conta)",
    examples: [
      "databolsa getObjectHistory pub_3e80862b6163669c --facts close --limit 5",
      "databolsa screenStocks --sector Bancos --limit 20",
      "databolsa getStockIndicators PETR4 --json | jq .data",
      "databolsa wallet listPortfolios",
    ],
  },
});
