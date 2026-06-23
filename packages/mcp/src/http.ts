/**
 * Streamable HTTP transport, stateless mode: one server+transport instance per
 * request. Hosted auth/session/rate-limit concerns stay in front of this process;
 * the MCP server remains a thin read-only layer over the API.
 */
import { createServer as createHttpServer, type IncomingMessage } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server";

const PORT = Number(process.env.MCP_HTTP_PORT ?? 3333);

const http = createHttpServer(async (req, res) => {
  if (req.url !== "/mcp") {
    res.writeHead(404).end();
    return;
  }
  try {
    // Stateless: nova instância por request evita colisão de request-id.
    const { server } = await createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, await readBody(req));
  } catch (err) {
    process.stderr.write(`[databolsa-mcp] erro http: ${(err as Error).message}\n`);
    if (!res.headersSent) res.writeHead(500).end();
  }
});

http.listen(PORT, () => {
  process.stderr.write(`[databolsa-mcp] Streamable HTTP (scaffold) em http://localhost:${PORT}/mcp\n`);
});

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : undefined);
      } catch {
        resolve(undefined);
      }
    });
  });
}
