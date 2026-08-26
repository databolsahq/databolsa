#!/usr/bin/env bun
/**
 * Entry da CLI core (databolsa) — casca fina sobre o motor parametrizado em
 * `run.ts` (compartilhado com a casca do Advisor). Comportamento publicado
 * idêntico ao histórico: mesmas envs, mesmos textos, mesmos exit codes.
 */
import { readFileSync } from "node:fs";
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
  branding: {
    bin: "databolsa",
    title: "DataBolsa CLI",
    blurb: "cliente de terminal sobre a Serving API aberta.",
    envUrl: "DATABOLSA_API_URL",
    envKey: "DATABOLSA_API_KEY",
    defaultApi: "https://api.databolsa.com",
    keyHint: "(crie a chave em databolsa.com/conta)",
    examples: [
      "databolsa getStock PETR4",
      "databolsa screenStocks --sector Bancos --limit 20",
      "databolsa getStock PETR4 --json | jq .ticker",
    ],
  },
});
