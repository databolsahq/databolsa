#!/usr/bin/env bun
/**
 * Dispatcher de transporte. Default = stdio (uso local com Claude Desktop/Code).
 * `--http` ou `MCP_TRANSPORT=http` sobe o scaffold Streamable HTTP (fase 4).
 */
if (process.argv.includes("--http") || process.env.MCP_TRANSPORT === "http") {
  await import("./http");
} else {
  await import("./stdio");
}

export {};
