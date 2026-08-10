/**
 * Entry stdio — fase atual. O cliente (Claude Desktop/Code) spawna este
 * processo e fala JSON-RPC por stdin/stdout. Nada deve ir para stdout fora do
 * protocolo; logs vão para stderr.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server";

const { server, toolCount, apiOrigin } = await createServer();
await server.connect(new StdioServerTransport());

process.stderr.write(`[databolsa-mcp] stdio pronto — ${toolCount} tools, API: ${apiOrigin}\n`);
