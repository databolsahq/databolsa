import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { DataBolsaClient } from "./client";
import { HttpClient } from "./http-client";
import type { operations } from "./schema";

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

// A asserção acima guarda a CLASSE. `DataBolsaClient` é a interface e é ela que `index.ts`
// exporta como tipo público — quem escreve `const db: DataBolsaClient = ...` enxerga só o
// que estiver declarado nela. As duas superfícies driftaram em silêncio: a classe tinha os
// 131 métodos e a interface estava sem getIssuerProfile, getPortfolioXray e
// getPortfolioLookThrough. Método ausente numa interface não é erro de compilação, é omissão.
//
// Interface é tipo, apagado em runtime, então o gate tem de ser em tempo de TIPO. Quando
// alguém adicionar operação ao contrato e esquecer a interface, `tsc --noEmit` falha
// NOMEANDO as operações faltantes no lugar de `true`.
//
// A direção é só uma: contrato ⊆ interface. O inverso é permitido de propósito, porque
// existem aliases deprecated deliberados (`listOptionsChain` → `getOptionsChain`) que não
// são, nem deveriam ser, operações do contrato.
type MissingFromInterface = Exclude<keyof operations, keyof DataBolsaClient>;
const _noInterfaceDrift: [MissingFromInterface] extends [never] ? true : MissingFromInterface = true;
void _noInterfaceDrift;
