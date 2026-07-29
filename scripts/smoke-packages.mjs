#!/usr/bin/env node
/**
 * smoke-packages.mjs — teste de fumaça dos pacotes publicados (@databolsa/sdk·cli·mcp).
 *
 * Instala os pacotes num ambiente ISOLADO (a partir de um tarball idêntico ao do npm,
 * via `npm pack`) FORA deste repositório, e valida fluxos simples ponta a ponta:
 *   - SDK : importa o HttpClient e consulta a API pública ao vivo.
 *   - CLI : roda o binário `databolsa` (--version + algumas operações).
 *   - MCP : faz o handshake JSON-RPC stdio do `databolsa-mcp` e lista as tools.
 *   - Auth: sobe uma instância LOCAL da API com `DATABOLSA_API_KEYS` (sem banco — a
 *           verificação de chave acontece antes de qualquer query) e checa a matriz
 *           401 (sem chave / chave errada → 401; chave certa → passa pela auth),
 *           provando que CLI e SDK anexam `Authorization: Bearer`.
 *
 * Modos (flag --source):
 *   --source=pack      (default) empacota os pacotes locais com `npm pack` (== tarball npm)
 *   --source=registry  instala `@databolsa/<pkg>@<versão>` direto do npm (verificação pós-publish)
 *
 * Outras flags:
 *   --offline          gate mínimo, ZERO rede: só pacote/instalação/import do SDK, bin da
 *                       CLI (--version) e handshake MCP (tools/list). Sem subir API local,
 *                       sem flow, sem matriz de auth. Combina com --source=registry.
 *   --no-live          gate de release: roda o flow + auth SÓ contra a API local (sem rede externa)
 *   --api-url=<url>    API pública para o flow smoke (default: https://api.databolsa.com)
 *   --version=<x.y.z>  versão a instalar no modo registry (default: a do packages/sdk)
 *   --skip-auth        pula a matriz de auth (ex.: ambiente sem `bun` p/ subir a API local)
 *   --keep             não apaga o diretório temporário (debug)
 *
 * Saída: 0 se tudo passou; 1 no primeiro conjunto de falhas (com resumo).
 *
 * Sem dependências externas — só Node (>=18, por causa do fetch global).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PKGS = ["sdk", "cli", "mcp"];

// ---- flags ------------------------------------------------------------------
const args = process.argv.slice(2);
const flag = (name, def) => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return def;
  const eq = hit.indexOf("=");
  return eq >= 0 ? hit.slice(eq + 1) : true;
};
const SOURCE = flag("source", "pack");
const API_URL = String(flag("api-url", process.env.DATABOLSA_API_URL || "https://api.databolsa.com")).replace(/\/+$/, "");
const SKIP_AUTH = flag("skip-auth", false) === true;
// Gate de release: roda TUDO contra uma API local, sem tocar a API pública. Pega
// pacote/instalação/bin/import/MCP/auth quebrados sem depender de rede externa.
const NO_LIVE = flag("no-live", false) === true;
// Gate mínimo (ZERO rede, nenhuma API sobe): só pacote/instalação/import/bin/MCP.
const OFFLINE = flag("offline", false) === true;
const KEEP = flag("keep", false) === true;
const VERSION = String(flag("version", readJson(join(REPO, "packages/sdk/package.json")).version));

if (SOURCE !== "pack" && SOURCE !== "registry") fatal(`--source inválido: ${SOURCE} (use pack|registry)`);

// ---- util -------------------------------------------------------------------
const results = [];
function log(s) {
  process.stdout.write(s + "\n");
}
function fatal(msg) {
  process.stderr.write(`erro: ${msg}\n`);
  process.exit(2);
}
function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
/** roda um comando até o fim; lança com a saída capturada em caso de status != 0. */
function run(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, { encoding: "utf8", ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`${cmd} ${cmdArgs.join(" ")} → exit ${r.status}\n${(r.stderr || r.stdout || "").slice(0, 800)}`);
  }
  return r;
}
async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (e) {
    results.push({ name, ok: false, detail: e?.message || String(e) });
    log(`  ✗ ${name} — ${e?.message || e}`);
  }
}
function which(bin) {
  const r = spawnSync(process.platform === "win32" ? "where" : "which", [bin], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim().split(/\r?\n/)[0] : null;
}
function freePort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.once("error", rej);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
  });
}

// ---- instala os pacotes num diretório isolado -------------------------------
function buildIsolatedEnv(workdir) {
  const consumer = join(workdir, "consumer");
  run("mkdir", ["-p", consumer]);
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ name: "databolsa-smoke-consumer", version: "0.0.0", private: true, type: "module" }, null, 2) + "\n",
  );

  let installArgs;
  if (SOURCE === "pack") {
    log(`==> npm pack (${PKGS.join(", ")}) — prepack builda o dist`);
    const tarballs = [];
    for (const p of PKGS) {
      // O prepack (`bun run build`) imprime um resumo no stdout, então não dá pra
      // confiar no `npm pack --json`; o nome do tarball é determinístico (escopo @ vira
      // prefixo): @databolsa/<p>@<ver> → databolsa-<p>-<ver>.tgz.
      const ver = readJson(join(REPO, "packages", p, "package.json")).version;
      run("npm", ["pack", "--pack-destination", workdir], { cwd: join(REPO, "packages", p) });
      const tgz = join(workdir, `databolsa-${p}-${ver}.tgz`);
      if (!existsSync(tgz)) throw new Error(`tarball esperado não encontrado: ${tgz}`);
      tarballs.push(tgz);
    }
    installArgs = tarballs;
  } else {
    log(`==> instalando do registro npm @${VERSION}`);
    installArgs = PKGS.map((p) => `@databolsa/${p}@${VERSION}`);
  }

  log(`==> npm install no ambiente isolado: ${consumer}`);
  run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error", ...installArgs], { cwd: consumer });
  return consumer;
}

// ---- flow smoke (API pública ao vivo) ---------------------------------------
const SDK_RUNNER = `import { HttpClient } from "@databolsa/sdk";
const [mode, url, key] = process.argv.slice(2);
try {
  if (mode === "flow" || mode === "flow-min") {
    const c = new HttpClient(url);
    const h = await c.getHealth();
    if (!h || typeof h.status !== "string") throw new Error("getHealth sem status");
    if (mode === "flow-min") {
      // flow-min: só health (DB-free), p/ rodar contra a API local sem banco.
      console.log("SDK_FLOW_OK status=" + h.status);
    } else {
      const s = await c.getStock("PETR4");
      if (!JSON.stringify(s).includes("PETR4")) throw new Error("getStock PETR4 inesperado");
      const idx = await c.listIndices();
      if (!Array.isArray(idx) || idx.length === 0) throw new Error("listIndices vazio");
      // superfícies globais (12/07/2026): degradam sem derrubar o smoke enquanto
      // o backfill de prod não roda (catálogos podem estar vazios, nunca 5xx).
      const cr = await c.listCrypto({ limit: 5 });
      if (!Array.isArray(cr?.data)) throw new Error("listCrypto sem data[]");
      const us = await c.listUsAssets({ limit: 5 });
      if (!Array.isArray(us?.data)) throw new Error("listUsAssets sem data[]");
      console.log(
        "SDK_FLOW_OK status=" + h.status + " indices=" + idx.length +
        " crypto=" + cr.data.length + " us=" + us.data.length,
      );
    }
  } else if (mode === "auth") {
    const c = new HttpClient(url, { apiKey: key || null });
    try {
      await c.listIndices();
      console.log("SDK_AUTH_RESULT:ok-2xx");
    } catch (e) {
      console.log("SDK_AUTH_RESULT:" + (e?.message || e));
    }
  }
} catch (e) {
  console.error("SDK_FAIL:" + (e?.message || e));
  process.exit(1);
}
`;

// ---- offline smoke (gate mínimo, zero rede) ---------------------------------
const OFFLINE_SDK_RUNNER = `import { HttpClient } from "@databolsa/sdk";
try {
  const c = new HttpClient("http://127.0.0.1:1", { apiKey: null });
  for (const m of ["getStock", "getHealth", "listIndices"]) {
    if (typeof c[m] !== "function") throw new Error("HttpClient sem " + m);
  }
  console.log("SDK_OFFLINE_OK");
} catch (e) {
  console.error("SDK_FAIL:" + (e?.message || e));
  process.exit(1);
}
`;

/**
 * Gate mínimo: só pacote/instalação/import/bin/MCP, ZERO rede — nenhuma API sobe (nem
 * local, nem pública), sem flow de dados, sem matriz de auth. `DATABOLSA_API_URL` aponta
 * pra uma porta loopback sem listener (falha instantânea/local, nunca sai pra rede
 * externa): o SDK só é instanciado (sem chamada), a CLI só reporta `--version`, e o MCP
 * cai no fallback estático do contrato (ver `openapi.ts`) pra montar as mesmas tools.
 */
async function offlineSmoke(consumer) {
  const runnerPath = join(consumer, "sdk-runner.mjs");
  writeFileSync(runnerPath, OFFLINE_SDK_RUNNER);
  const binDatabolsa = join(consumer, "node_modules", ".bin", "databolsa");
  const binMcp = join(consumer, "node_modules", ".bin", "databolsa-mcp");
  const env = { ...process.env, DATABOLSA_API_URL: "http://127.0.0.1:1", DATABOLSA_API_KEY: "" };

  log(`\n== offline smoke — SDK/CLI/MCP, zero rede ==`);

  await check("SDK importa e instancia o client", () => {
    const r = run("node", [runnerPath], { cwd: consumer });
    const line = r.stdout.trim().split(/\r?\n/).pop();
    assert(line === "SDK_OFFLINE_OK", `saída inesperada: ${line}`);
    return "ok";
  });

  await check("CLI --version casa com a do pacote", () => {
    const r = run(binDatabolsa, ["--version"]);
    const v = r.stdout.trim();
    assert(/^\d+\.\d+\.\d+/.test(v), `versão inesperada: ${v}`);
    return v;
  });

  await check("MCP responde tools/list com tools", async () => {
    const msg = await mcpHandshake(binMcp, env);
    const tools = msg?.result?.tools;
    assert(Array.isArray(tools) && tools.length > 0, "tools/list vazio");
    assert(tools.some((t) => t.name === "getStock"), "tool getStock ausente");
    return `${tools.length} tools`;
  });
}

/**
 * Flow smoke contra `target`. Com `realData=true` (API pública) valida dados reais
 * (getStock PETR4, índices); com `realData=false` (API local sem banco) valida só o
 * que é DB-free (health, --version, MCP tools/list) — mesma cobertura de pacote/bin/
 * import/handshake, sem depender de dados.
 */
async function flowSmoke(consumer, target, realData) {
  const runnerPath = join(consumer, "sdk-runner.mjs");
  writeFileSync(runnerPath, SDK_RUNNER);
  const binDatabolsa = join(consumer, "node_modules", ".bin", "databolsa");
  const binMcp = join(consumer, "node_modules", ".bin", "databolsa-mcp");
  const env = { ...process.env, DATABOLSA_API_URL: target };

  log(`\n== flow smoke — SDK/CLI/MCP contra ${target}${realData ? "" : " (local, sem dados reais)"} ==`);

  await check("SDK importa e consulta a API", () => {
    const r = run("node", [runnerPath, realData ? "flow" : "flow-min", target], { cwd: consumer });
    const line = r.stdout.trim().split(/\r?\n/).pop();
    assert(line.startsWith("SDK_FLOW_OK"), `saída inesperada: ${line}`);
    return line.replace("SDK_FLOW_OK ", "");
  });

  await check("CLI --version casa com a do pacote", () => {
    const r = run(binDatabolsa, ["--version"]);
    const v = r.stdout.trim();
    assert(/^\d+\.\d+\.\d+/.test(v), `versão inesperada: ${v}`);
    return v;
  });

  if (realData) {
    await check("CLI getStock PETR4 retorna o ticker", () => {
      const r = run(binDatabolsa, ["getStock", "PETR4", "--json"], { env });
      assert(r.stdout.includes("PETR4"), "PETR4 ausente na saída");
      return "ok";
    });

    await check("CLI listIndices --json devolve um array", () => {
      const r = run(binDatabolsa, ["listIndices", "--json"], { env });
      const data = JSON.parse(r.stdout);
      assert(Array.isArray(data) && data.length > 0, "listIndices não retornou array não-vazio");
      return `${data.length} índices`;
    });
  } else {
    await check("CLI consulta a API (getHealth)", () => {
      const r = run(binDatabolsa, ["getHealth", "--json"], { env });
      const data = JSON.parse(r.stdout);
      assert(typeof data.status === "string", "getHealth sem status");
      return data.status;
    });
  }

  await check("MCP responde tools/list com tools", async () => {
    const msg = await mcpHandshake(binMcp, env);
    const tools = msg?.result?.tools;
    assert(Array.isArray(tools) && tools.length > 0, "tools/list vazio");
    assert(tools.some((t) => t.name === "getStock"), "tool getStock ausente");
    return `${tools.length} tools`;
  });
}

/** Handshake MCP stdio (newline-delimited JSON-RPC): initialize → initialized → tools/list. */
function mcpHandshake(binMcp, env, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const child = spawn(binMcp, [], { env, stdio: ["pipe", "pipe", "pipe"] });
    let buf = "";
    let stderr = "";
    let done = false;
    const send = (o) => child.stdin.write(JSON.stringify(o) + "\n");
    const finish = (err, val) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        child.kill("SIGKILL");
      } catch {}
      err ? reject(err) : resolve(val);
    };
    const timer = setTimeout(() => finish(new Error(`timeout do MCP. stderr: ${stderr.slice(0, 400)}`)), timeoutMs);

    child.stdout.on("data", (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        let m;
        try {
          m = JSON.parse(line);
        } catch {
          continue;
        }
        if (m.id === 1) {
          // initialize respondido → confirma e pede a lista de tools.
          send({ jsonrpc: "2.0", method: "notifications/initialized" });
          send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
        } else if (m.id === 2) {
          finish(null, m);
        }
      }
    });
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => finish(e));
    child.on("exit", (code) => finish(new Error(`MCP saiu (code ${code}). stderr: ${stderr.slice(0, 400)}`)));

    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke", version: "0" } },
    });
  });
}

/**
 * Sobe uma instância LOCAL da API (sem banco) e roda `fn(local, key)` contra ela,
 * garantindo o teardown. A API é o ponto de apoio tanto da matriz de auth quanto
 * do flow smoke no modo --no-live — nenhuma dependência de rede externa. Só
 * funciona em checkouts que também têm o servidor da API (privado); os gates
 * mirrados usam --offline, que não depende disso.
 */
async function withLocalApi(fn) {
  const bun = which("bun");
  if (!bun) throw new Error("`bun` não encontrado no PATH — necessário p/ subir a API local");

  const KEY = "smoke-test-key";
  const port = await freePort();
  const local = `http://127.0.0.1:${port}`;
  const apiEntry = join(REPO, "packages", "api", "src", "index.ts");
  const env = {
    ...process.env,
    PORT: String(port),
    DATABOLSA_API_KEYS: KEY,
    // DB inexistente de propósito: a auth roda ANTES de qualquer query, então 401 vs
    // não-401 é decidível sem banco; o pool do postgres é lazy e não impede o boot.
    // Sem credenciais embutidas (porta 1 recusa a conexão de qualquer forma).
    DATABASE_URL: "postgresql://127.0.0.1:1/none",
    CACHE_ENABLED: "false",
    REDIS_URL: "",
    PUBLIC_API_URL: local,
  };

  log(`\n==> subindo API local sem banco em ${local}`);
  const server = spawn(bun, [apiEntry], { env, cwd: REPO, stdio: ["ignore", "pipe", "pipe"] });
  let serverLog = "";
  server.stdout.on("data", (d) => (serverLog += d));
  server.stderr.on("data", (d) => (serverLog += d));

  try {
    await waitHealthy(`${local}/v1/health`, server, () => serverLog);
    return await fn(local, KEY);
  } finally {
    try {
      server.kill("SIGKILL");
    } catch {}
  }
}

// ---- auth matrix (contra a API local, SEM banco) ----------------------------
async function authMatrix(consumer, local, KEY) {
  log(`\n== auth matrix — ${local} ==`);

  await check("/v1/health é público (200)", async () => {
      const r = await fetch(`${local}/v1/health`);
      assert(r.status === 200, `status ${r.status}`);
      return "200";
    });

    await check("rota protegida sem chave → 401 problem+json", async () => {
      const r = await fetch(`${local}/v1/indices`);
      assert(r.status === 401, `status ${r.status}`);
      assert((r.headers.get("www-authenticate") || "").includes("Bearer"), "sem www-authenticate: Bearer");
      assert((r.headers.get("content-type") || "").includes("problem+json"), "content-type não é problem+json");
      const body = await r.json();
      assert(String(body.type || "").endsWith("/unauthorized"), `type inesperado: ${body.type}`);
      return "401";
    });

    await check("chave errada → 401", async () => {
      const r = await fetch(`${local}/v1/indices`, { headers: { authorization: "Bearer chave-errada" } });
      assert(r.status === 401, `status ${r.status}`);
      return "401";
    });

    await check("chave certa → passa pela auth (≠ 401)", async () => {
      const r = await fetch(`${local}/v1/indices`, { headers: { authorization: `Bearer ${KEY}` } });
      assert(r.status !== 401, `ainda 401 com a chave válida`);
      return `status ${r.status} (auth ok; erro de DB downstream é esperado)`;
    });

    // Prova de que os pacotes publicados anexam o header Authorization.
    const binDatabolsa = join(consumer, "node_modules", ".bin", "databolsa");
    const runner = join(consumer, "sdk-runner.mjs"); // escrito no flowSmoke

    await check("CLI com chave errada surfaça 401", () => {
      const r = spawnSync(binDatabolsa, ["listIndices"], {
        encoding: "utf8",
        env: { ...process.env, DATABOLSA_API_URL: local, DATABOLSA_API_KEY: "chave-errada" },
      });
      assert(r.status === 1, `exit ${r.status} (esperado 1)`);
      assert((r.stderr || "").includes("401"), `stderr sem 401: ${(r.stderr || "").trim()}`);
      return "401";
    });

    await check("CLI com chave certa passa da auth (não-401)", () => {
      const r = spawnSync(binDatabolsa, ["listIndices"], {
        encoding: "utf8",
        env: { ...process.env, DATABOLSA_API_URL: local, DATABOLSA_API_KEY: KEY },
      });
      assert(!(r.stderr || "").includes("401"), `recebeu 401 com a chave válida: ${(r.stderr || "").trim()}`);
      return "ok";
    });

    await check("SDK anexa Bearer (401 com chave errada, ≠401 com a certa)", () => {
      const wrong = run("node", [runner, "auth", local, "chave-errada"], { cwd: consumer }).stdout;
      const right = run("node", [runner, "auth", local, KEY], { cwd: consumer }).stdout;
      assert(wrong.includes("401"), `chave errada não deu 401: ${wrong.trim()}`);
      assert(!right.includes("401"), `chave certa deu 401: ${right.trim()}`);
      return "ok";
    });
}

async function waitHealthy(url, server, getLog, ms = 25000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (server.exitCode !== null) throw new Error(`API local encerrou cedo (code ${server.exitCode}).\n${getLog().slice(0, 600)}`);
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await sleep(300);
  }
  throw new Error(`API local não respondeu em ${url} (${ms}ms).\n${getLog().slice(0, 600)}`);
}

// ---- main -------------------------------------------------------------------
async function main() {
  const where = OFFLINE ? "offline (zero rede)" : NO_LIVE ? "local-only (gate)" : `api=${API_URL}`;
  log(`DataBolsa — smoke dos pacotes  (source=${SOURCE}, version=${VERSION}, ${where})`);
  const workdir = mkdtempSync(join(tmpdir(), "databolsa-smoke-"));
  log(`==> diretório temporário: ${workdir}`);

  try {
    const consumer = buildIsolatedEnv(workdir);
    if (OFFLINE) {
      // Gate mínimo: pacote/instalação/import/bin/MCP, sem subir nenhuma API.
      await offlineSmoke(consumer);
    } else if (NO_LIVE) {
      // Gate de release: sobe a API local e roda flow + auth contra ela. Sem rede externa.
      await withLocalApi(async (local, key) => {
        await flowSmoke(consumer, local, /* realData */ false);
        await authMatrix(consumer, local, key);
      });
    } else {
      await flowSmoke(consumer, API_URL, /* realData */ true);
      if (SKIP_AUTH) {
        log("\n== auth matrix pulada (--skip-auth) ==");
      } else {
        await withLocalApi(async (local, key) => authMatrix(consumer, local, key));
      }
    }
  } finally {
    if (KEEP) {
      log(`\n(diretório temporário mantido: ${workdir})`);
    } else {
      try {
        rmSync(workdir, { recursive: true, force: true });
      } catch {}
    }
  }

  const failed = results.filter((r) => !r.ok);
  log(`\n${"=".repeat(48)}`);
  log(`resultado: ${results.length - failed.length}/${results.length} checks passaram`);
  if (failed.length) {
    for (const f of failed) log(`  ✗ ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  log("tudo verde ✓");
}

main().catch((e) => fatal(e?.stack || e?.message || String(e)));
