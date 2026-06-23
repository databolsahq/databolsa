import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { openAPISpecs } from "hono-openapi";
import { type AppEnv, apiKeyAuth } from "./middleware/auth";
import { cacheMiddleware } from "./middleware/cache";
import { errorHandler, notFoundHandler } from "./middleware/errors";
import { VERSION } from "./lib/config";
import { openApiDocumentation } from "./lib/openapi";
import { routes } from "./routes";

// Pure app assembly — no server bootstrap, no eager I/O — so the `gen:openapi` script can
// import it and read the route metadata offline. index.ts wraps this with Bun.serve.
export const app = new Hono<AppEnv>();

app.use("*", logger());
app.use("*", cors());
app.use("/v1/*", apiKeyAuth); // resolves a Principal (open / env-key / gateway-trust)
app.use("/v1/*", cacheMiddleware); // read-through Redis cache; no-op when caching is off
app.onError(errorHandler);
app.notFound(notFoundHandler); // problem+json for unmatched routes (501 under /v1, else 404)

app.get("/", (c) =>
  c.json({
    name: "DataBolsa API",
    version: VERSION,
    base_path: "/v1",
    contract: "api/openapi.yaml",
    openapi: "/openapi.json",
  }),
);

// Live spec generated from the route definitions. Mounted at root (outside /v1/*), so it
// is not gated by apiKeyAuth and not cached. The same documentation feeds the YAML file.
app.get("/openapi.json", openAPISpecs(app, { documentation: openApiDocumentation }));

app.route("/", routes);
