#!/usr/bin/env bun
/**
 * Entry da CLI. Espelha a casca fina do MCP (packages/mcp/src): carrega o
 * contrato OpenAPI no startup (vivo, com fallback no yaml versionado), resolve
 * o comando pela operação, chama a API e renderiza. Dados vão para stdout;
 * erros e ajuda contextual para stderr — piping limpo (`... --json | jq`).
 *
 * Saídas: 0 ok · 1 erro de API/inesperado · 2 erro de uso · 3 fora do preview.
 */
import { readFileSync } from "node:fs";
import { ApiClient } from "./api-client";
import { loadOperations } from "./openapi";
import { buildCommands, commandHelp, findCommand, listText, topUsage } from "./commands";
import { bindArgs, CliError, parseGlobals } from "./args";
import { render } from "./render";

const VERSION = packageVersion();

async function main(): Promise<void> {
  const g = parseGlobals(process.argv.slice(2));

  if (g.version) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  // Ajuda de topo / sem comando — não precisa da API.
  if (!g.command && !g.list) {
    process.stdout.write(topUsage());
    return;
  }

  const api = new ApiClient({
    baseUrl: g.apiUrl ?? process.env.DATABOLSA_API_URL,
    apiKey: process.env.DATABOLSA_API_KEY,
  });

  const operations = await loadOperations(api);
  const commands = buildCommands(operations);

  if (g.list) {
    process.stdout.write(listText(commands, api.origin));
    return;
  }

  const spec = findCommand(commands, g.command!);
  if (!spec) {
    process.stderr.write(
      `Comando desconhecido: ${g.command}\nUse 'databolsa --list' para ver as operações disponíveis.\n`,
    );
    process.exitCode = 2;
    return;
  }

  if (g.help) {
    process.stdout.write(commandHelp(spec));
    return;
  }

  const { path, query, body } = bindArgs(spec, g.rest);
  const res = await api.request(
    spec.method.toUpperCase() as "GET" | "POST" | "DELETE",
    path,
    query,
    Object.keys(body).length > 0 ? body : undefined,
  );

  if (res.ok) {
    process.stdout.write(render(res.body, g.json) + "\n");
    return;
  }

  if (res.status === 501 || res.status === 404) {
    process.stderr.write(
      `Recurso não disponível neste preview da API (HTTP ${res.status})${res.detail ? `: ${res.detail}` : ""}.\n`,
    );
    process.exitCode = 3;
    return;
  }

  process.stderr.write(`Erro da API (HTTP ${res.status})${res.detail ? `: ${res.detail}` : ""}.\n`);
  process.exitCode = 1;
}

main().catch((err: unknown) => {
  if (err instanceof CliError) {
    process.stderr.write(`${err.message}\n`);
    if (err.spec) process.stderr.write("\n" + commandHelp(err.spec));
    process.exitCode = 2;
    return;
  }
  process.stderr.write(`${(err as Error).message ?? String(err)}\n`);
  process.exitCode = 1;
});

function packageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}
