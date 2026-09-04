/**
 * Carrega o contrato OpenAPI e extrai a lista de operações que viram comandos.
 *
 * Fonte primária: `/openapi.json` vivo da API, então os comandos acompanham a
 * API sozinhos.
 * Fallback: o `api/openapi.yaml` versionado no repo, para `--list`
 * funcionar mesmo se a API estiver momentaneamente fora (as chamadas, claro,
 * ainda exigem a API no ar).
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { extractOperations } from "@databolsa/sdk/openapi";
import type { Operation } from "@databolsa/sdk/openapi";
import { parse as parseYaml } from "yaml";
import type { ApiClient } from "./api-client";

export { extractOperations };
export type { Operation, ParamSpec } from "@databolsa/sdk/openapi";

/**
 * Caminhos candidatos do `openapi.yaml` estático, em ordem de tentativa. O layout
 * difere entre o pacote PUBLICADO e a árvore de FONTE:
 *   1) `./openapi.yaml` — ao lado do bundle no pacote publicado (`dist/openapi.yaml`,
 *      copiado pelo build; incluído via `files: ["dist"]`).
 *   2) `../../../../api/openapi.yaml` — layout de fonte no repo (`packages/core/cli/src/` → raiz).
 * O publicado acha (1); rodando do fonte em dev acha (2). Antes esta era a única
 * tentativa e, no publicado, `import.meta.url`=`…/dist/index.js` resolvia p/
 * `…/node_modules/api/openapi.yaml` (inexistente) → fallback offline morto.
 */
export function staticSpecCandidates(moduleUrl: string = import.meta.url): string[] {
  return [
    fileURLToPath(new URL("./openapi.yaml", moduleUrl)),
    fileURLToPath(new URL("../../../../api/openapi.yaml", moduleUrl)),
  ];
}

export interface LoadOperationsOptions {
  /** Fallback estático próprio (a casca advisor aponta o openapi-advisor.yaml bundlado). */
  staticCandidates?: string[];
}

export async function loadOperations(api: ApiClient, opts?: LoadOperationsOptions): Promise<Operation[]> {
  return extractOperations(await loadSpec(api, opts));
}

async function loadSpec(api: ApiClient, opts?: LoadOperationsOptions): Promise<unknown> {
  try {
    return await api.fetchOpenApi();
  } catch (liveErr) {
    let staticErr: unknown;
    for (const path of opts?.staticCandidates ?? staticSpecCandidates()) {
      try {
        return parseYaml(await readFile(path, "utf8"));
      } catch (err) {
        staticErr = err;
      }
    }
    throw new Error(
      `Não foi possível carregar o OpenAPI. A API em ${api.origin} está no ar? ` +
        `(live: ${(liveErr as Error).message}; estático: ${(staticErr as Error).message})`,
    );
  }
}
