import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { HttpClient } from "./http-client";

// O contrato é a fonte; o SDK é escrito à mão. Sem uma asserção ligando os dois, uma operação
// nova entra no OpenAPI, a CLI e o MCP a derivam automaticamente, e só o usuário do SDK tipado
// fica de fora — sem erro de compilação, porque método ausente não é erro, é omissão.
// Foi exatamente o que aconteceu: 103 operações no contrato contra 93 métodos, e as 10
// faltantes incluíam as 5 rotas de propriedade recém-publicadas.
//
// operationId por regex e não por parser de YAML de propósito: este arquivo é distribuído
// junto do pacote e não deve arrastar dependência nova só para se auto-verificar.
const specPath = fileURLToPath(new URL("../../../api/openapi.yaml", import.meta.url));
const spec = readFileSync(specPath, "utf8");
const operationIds = [...spec.matchAll(/^\s+operationId:\s*(\S+)\s*$/gm)]
  .map((m) => m[1])
  .filter((id): id is string => !!id);

describe("superfície do SDK × contrato público", () => {
  it("o contrato tem operationIds para conferir", () => {
    expect(operationIds.length).toBeGreaterThan(90);
    expect(new Set(operationIds).size).toBe(operationIds.length);
  });

  it("toda operação do contrato existe como método do client", () => {
    // Os métodos vivem no prototype da classe, não na instância.
    const proto = HttpClient.prototype as unknown as Record<string, unknown>;
    const missing = operationIds.filter((op) => typeof proto[op] !== "function");
    expect(missing).toEqual([]);
  });
});
