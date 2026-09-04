/**
 * Streamable HTTP transport, stateless mode: one server+transport instance per
 * request. Hosted auth/session/rate-limit concerns stay in front of this process;
 * the MCP server remains a thin contract-driven layer over the API.
 */
import { createServer as createHttpServer, type IncomingMessage } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ApiClient } from "./api-client";
import { createServer } from "./server";

const PORT = Number(process.env.MCP_HTTP_PORT ?? 3333);

/** `Authorization: Bearer <key>` do request; senão a chave do ambiente. */
function requestApiKey(req: IncomingMessage): string | undefined {
  const auth = req.headers.authorization;
  const match = auth?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? process.env.DATABOLSA_API_KEY;
}

const http = createHttpServer(async (req, res) => {
  if (req.url !== "/mcp") {
    res.writeHead(404).end();
    return;
  }
  try {
    // Stateless: nova instância por request evita colisão de request-id.
    // A credencial vem do próprio request, então cada caller usa a sua chave.
    const apiClient = new ApiClient({
      baseUrl: process.env.DATABOLSA_API_URL,
      apiKey: requestApiKey(req),
    });
    const { server } = await createServer({ apiClient });
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
