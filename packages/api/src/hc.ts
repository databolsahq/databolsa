import { hc } from "hono/client";
import type { AppType } from "./routes";

// Materialize the client type at compile time, then export a typed factory — the
// recommended hono RPC pattern. The web app swaps its fixture client for this to get
// end-to-end types from the same source of truth as the server.
const client = hc<AppType>("");
export type Client = typeof client;

export const hcWithType = (...args: Parameters<typeof hc>): Client => hc<AppType>(...args);
