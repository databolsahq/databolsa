/**
 * MEDIDA DA SUPERFÍCIE — quantas tools e quantos bytes de schema uma sessão MCP entrega.
 *
 * Contar operationIds não mede o que o cliente paga: uma tool com 30 parâmetros descritos
 * custa mais contexto do que dez tools de um parâmetro. A régua aqui é o `tools/list` de
 * verdade, obtido por um cliente em memória ligado ao servidor — o mesmo JSON que o
 * claude.ai, o ChatGPT ou o Claude Code recebem antes de escolher qualquer tool.
 *
 * Serve ao snapshot da superfície default (teste do contrato) e ao script de baseline das
 * quatro superfícies do agente. Ligar o servidor consome a única conexão dele: meça um
 * servidor construído para isso, nunca o que vai atender um cliente.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodRawShape } from "zod";

export interface SurfaceMeasure {
  /** Quantidade de tools anunciadas. */
  tools: number;
  /** Bytes (UTF-8) do array `tools` de `tools/list` — nome, descrição, inputSchema, outputSchema, annotations. */
  schemaBytes: number;
  /** Nomes ordenados — o conjunto que o snapshot congela. */
  names: string[];
  /** Bytes por tool, para achar quem pesa. */
  perTool: Record<string, number>;
}

/** Mede um servidor já montado. Consome a conexão dele. */
export async function measureServer(server: McpServer): Promise<SurfaceMeasure> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "databolsa-surface-measure", version: "0" });
  await client.connect(clientTransport);
  try {
    const all: { name: string; [k: string]: unknown }[] = [];
    let cursor: string | undefined;
    do {
      const page = await client.listTools(cursor ? { cursor } : undefined);
      all.push(...(page.tools as { name: string; [k: string]: unknown }[]));
      cursor = page.nextCursor;
    } while (cursor);
    const perTool: Record<string, number> = {};
    for (const t of all) perTool[t.name] = Buffer.byteLength(JSON.stringify(t), "utf8");
    return {
      tools: all.length,
      schemaBytes: Buffer.byteLength(JSON.stringify(all), "utf8"),
      names: all.map((t) => t.name).sort(),
      perTool,
    };
  } finally {
    await client.close();
    await server.close();
  }
}

/** Uma tool avulsa (fora de um servidor): nome, descrição e o shape Zod do input. */
export interface LooseTool {
  name: string;
  description: string;
  inputSchema: ZodRawShape;
}

/**
 * Mede tools que não vivem num McpServer (as do agente, por exemplo) pela MESMA régua:
 * registra num servidor descartável e lê o `tools/list`. Assim agente e MCP são comparáveis
 * em bytes, e não só em contagem.
 */
export async function measureTools(tools: LooseTool[]): Promise<SurfaceMeasure> {
  const server = new McpServer({ name: "databolsa-surface-measure", version: "0" });
  for (const t of tools) {
    server.registerTool(t.name, { description: t.description, inputSchema: t.inputSchema }, async () => ({ content: [] }));
  }
  return measureServer(server);
}
