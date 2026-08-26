/**
 * Motor da CLI, parametrizado por casca (`RunCliConfig`): a CLI core (databolsa)
 * e a do Advisor (databolsa-advisor) compartilham TODO o comportamento — só mudam
 * contrato, envs, branding e hints. Carrega o OpenAPI no startup (vivo, com
 * fallback no yaml versionado), resolve o comando pela operação, chama a API e
 * renderiza. Dados vão para stdout; erros e ajuda para stderr.
 *
 * Saídas: 0 ok · 1 erro de API/inesperado · 2 erro de uso · 3 fora do preview.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { ApiClient } from "./api-client";
import { loadOperations } from "./openapi";
import {
  buildCommands,
  cliBranding,
  commandHelp,
  findCommand,
  listText,
  setCliBranding,
  topUsage,
  usageLine,
  type CliBranding,
  type CommandSpec,
} from "./commands";
import { bindArgs, CliError, nearest, parseGlobals } from "./args";
import { render } from "./render";

export interface RunCliConfig {
  version: string;
  branding: CliBranding;
  /** Path do spec vivo (default /openapi.json). */
  specPath?: string;
  /** Fallback estático do contrato (defaults do core quando ausente). */
  staticSpecCandidates?: string[];
  /** Hints de erro por status (401/403 mudam entre core e advisor). */
  apiErrorHint?: (status: number) => string;
}

export async function runCli(config: RunCliConfig): Promise<void> {
  setCliBranding(config.branding);
  try {
    await main(config);
  } catch (err: unknown) {
    if (err instanceof CliError) {
      // Só a linha de uso, não o help inteiro: a mensagem já nomeia o valor
      // rejeitado e despejar a ajuda completa embaixo dela enterra o erro.
      process.stderr.write(`${err.message}\n`);
      if (err.spec) {
        process.stderr.write(
          `Uso: ${usageLine(err.spec)}\nAjuda: ${cliBranding().bin} ${err.spec.operationId} --help\n`,
        );
      }
      process.exitCode = 2;
      return;
    }
    process.stderr.write(`${(err as Error).message ?? String(err)}\n`);
    process.exitCode = 1;
  }
}

async function main(config: RunCliConfig): Promise<void> {
  const b = config.branding;
  const g = parseGlobals(process.argv.slice(2));

  if (g.version) {
    process.stdout.write(`${config.version}\n`);
    return;
  }

  // Ajuda de topo / sem comando — não precisa da API.
  if (!g.command && !g.list) {
    process.stdout.write(topUsage());
    return;
  }

  const api = new ApiClient({
    baseUrl: g.apiUrl ?? process.env[b.envUrl],
    apiKey: process.env[b.envKey],
    specPath: config.specPath,
  });

  const operations = await loadOperations(api, { staticCandidates: config.staticSpecCandidates });
  const commands = buildCommands(operations);

  if (g.list) {
    process.stdout.write(listText(commands, api.origin));
    return;
  }

  const spec = findCommand(commands, g.command!);
  if (!spec) {
    const guess = nearest(g.command!, [...commands.keys()]);
    process.stderr.write(
      `Comando desconhecido: ${g.command}.${guess ? ` Você quis dizer ${guess}?` : ""}\n` +
        `Use '${b.bin} --list' para ver as operações disponíveis.\n`,
    );
    process.exitCode = 2;
    return;
  }

  if (g.help) {
    process.stdout.write(commandHelp(spec));
    return;
  }

  // Conveniência de upload: em operações com body `content_base64`, `--file <caminho>`
  // lê o arquivo local, codifica em base64 e preenche `filename` com o nome dele.
  const filePath = extractFileFlag(g.rest, spec);
  if (filePath) {
    let bytes: Buffer;
    try {
      bytes = readFileSync(filePath);
    } catch {
      throw new CliError(`Não consegui ler o arquivo: ${filePath}`, spec);
    }
    g.rest.push(`--content_base64=${bytes.toString("base64")}`);
    if (!g.rest.some((t) => t === "--filename" || t.startsWith("--filename="))) {
      g.rest.push(`--filename=${basename(filePath)}`);
    }
  }
  const { path, query, body } = bindArgs(spec, g.rest);
  const res = await api.request(
    spec.method.toUpperCase() as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
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

  const hint = (config.apiErrorHint ?? defaultApiErrorHint)(res.status);
  process.stderr.write(`Erro da API (HTTP ${res.status})${res.detail ? `: ${res.detail}` : ""}.\n${hint}`);
  process.exitCode = 1;
}

/** O que fazer a seguir nos erros em que a ação é sempre a mesma (defaults do core). */
function defaultApiErrorHint(status: number): string {
  if (status === 401) {
    return "Defina DATABOLSA_API_KEY com uma chave válida (crie em databolsa.com/conta).\n";
  }
  if (status === 403) {
    return "A chave existe mas não alcança este recurso — confira o escopo e o plano em databolsa.com/conta.\n";
  }
  if (status === 429) {
    return "Limite de uso atingido — espere a janela virar ou reduza a frequência das chamadas.\n";
  }
  return "";
}

/** Remove `--file <caminho>`/`--file=<caminho>` do rest (antes do bindArgs) e devolve o caminho. */
function extractFileFlag(rest: string[], spec: CommandSpec): string | null {
  const supportsFile = spec.options.some((o) => o.in === "body" && o.name === "content_base64");
  const i = rest.findIndex((t) => t === "--file" || t.startsWith("--file="));
  if (i < 0) return null;
  if (!supportsFile) throw new CliError("--file só vale em operações de upload (com content_base64).", spec);
  const tok = rest[i]!;
  if (tok.includes("=")) {
    rest.splice(i, 1);
    return tok.slice(tok.indexOf("=") + 1);
  }
  const value = rest[i + 1];
  if (value === undefined || value.startsWith("--")) throw new CliError("--file requer um caminho de arquivo.", spec);
  rest.splice(i, 2);
  return value;
}
