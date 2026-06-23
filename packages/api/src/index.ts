import { app } from "./app";

const port = Number(process.env.PORT) || 8080;
console.log(`[databolsa-api] listening on http://localhost:${port}  (base path /v1)`);

export default { port, fetch: app.fetch };
