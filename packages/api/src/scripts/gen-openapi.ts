// Writes api/openapi.yaml from the live route definitions. Code-first: the routes
// (describeRoute + the zod validators) are the source of truth; this spec is generated,
// then feeds the web's `gen:api-types`. generateSpecs is static — it reads route
// metadata, never runs handlers or touches the DB — so this is safe to run offline / in CI.
import { generateSpecs } from "hono-openapi";
import { stringify } from "yaml";
import { app } from "../app";
import { openApiDocumentation } from "../lib/openapi";

// Defaults to the canonical api/openapi.yaml; OPENAPI_OUT overrides (preview / CI diff).
const out =
  process.env.OPENAPI_OUT ?? Bun.fileURLToPath(new URL("../../../../api/openapi.yaml", import.meta.url));

const spec = await generateSpecs(app, { documentation: openApiDocumentation });
await Bun.write(out, stringify(spec));

console.log(`[gen-openapi] wrote ${out} — ${Object.keys(spec.paths ?? {}).length} paths`);
