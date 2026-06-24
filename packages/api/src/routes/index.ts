import { Hono } from "hono";
import { v1 } from "./v1";

// The contract's server base path is `/v1`. AppType is exported here for hc.ts.
export const routes = new Hono().route("/v1", v1);

export type AppType = typeof routes;
