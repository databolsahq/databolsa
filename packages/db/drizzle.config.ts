import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { defineConfig } from "drizzle-kit";

// Sobe do cwd até achar o .env da RAIZ do monorepo. Garante que drizzle-kit
// (rodando de packages/db) use a MESMA DATABASE_URL do loader (scripts/load_postgres.py)
// e da API — sem isso, drizzle-kit não enxerga o .env da raiz e cairia num default.
function findRootEnv(start = process.cwd()): string | undefined {
  let dir = start;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

function envValue(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const envPath = findRootEnv();
  if (!envPath) return undefined;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (t.startsWith(`${key}=`)) {
      return t.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  return undefined;
}

const DATABASE_URL = envValue("DATABASE_URL");
// SEM default silencioso de propósito: um default escondido foi o que mascarou
// "migrei no banco errado?". Falhar alto é melhor que migrar no lugar errado.
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL não definido. Configure no .env da raiz do monorepo (veja .env.example) " +
      "ou exporte no ambiente antes de rodar comandos de schema.",
  );
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: DATABASE_URL },
  // Marts are the source of truth; these tables are a serving mirror. Keep the
  // migration history readable — one statement per table.
  verbose: true,
  strict: true,
});
