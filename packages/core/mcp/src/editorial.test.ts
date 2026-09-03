import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { extractOperations } from "./openapi";

/**
 * Orçamento editorial do contrato que humanos e agentes compartilham.
 *
 * O OpenAPI é a fonte autoral; MCP, CLI e agente apenas projetam esse texto. Estes limites
 * evitam que medições pontuais de produção, históricos de migração e explicações repetidas
 * voltem a ocupar o contexto de toda tool. Não impõem frases mínimas: exigem presença,
 * estabilidade e um teto que ainda comporta caveats financeiros importantes.
 */
const contracts = {
  core: {
    file: "../../../../api/openapi.yaml",
    maxDescriptionBytes: 75_000,
    maxInputContextBytes: 52_000,
  },
  advisor: {
    file: "../../../../api/openapi-advisor.yaml",
    maxDescriptionBytes: 5_500,
    maxInputContextBytes: 6_000,
  },
  credit: {
    file: "../../../../api/openapi-credit.yaml",
    maxDescriptionBytes: 5_500,
    maxInputContextBytes: 5_000,
  },
  wallet: {
    file: "../../../../api/openapi-wallet.yaml",
    maxDescriptionBytes: 9_000,
    maxInputContextBytes: 3_500,
  },
} as const;

const datedEvidence = /\b(?:cobertura hoje|medid[oa] em \d{2}\/\d{2}\/\d{4}|desde \d{2}\/\d{2}\/\d{4})\b/i;
const bytes = (value: string) => new TextEncoder().encode(value).length;

function findDatedDescriptions(value: unknown, path = "$", found: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findDatedDescriptions(item, `${path}[${index}]`, found));
    return found;
  }
  if (!value || typeof value !== "object") return found;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = `${path}.${key}`;
    if ((key === "description" || key === "note") && typeof child === "string" && datedEvidence.test(child)) {
      found.push(childPath);
    }
    findDatedDescriptions(child, childPath, found);
  }
  return found;
}

for (const [name, contract] of Object.entries(contracts)) {
  test(`${name}: descrições são completas, estáveis e cabem no orçamento`, () => {
    const spec = parseYaml(readFileSync(new URL(contract.file, import.meta.url), "utf8"));
    const operations = extractOperations(spec);
    const problems = findDatedDescriptions(spec).map((path) => `${path}: evidência datada`);
    let descriptionBytes = 0;
    let inputContextBytes = 0;

    for (const operation of operations) {
      const summary = operation.summary?.trim() ?? "";
      const description = operation.description?.trim() ?? "";
      descriptionBytes += bytes(description);

      if (!summary) problems.push(`${operation.operationId}: sem summary`);
      if (!description) problems.push(`${operation.operationId}: sem description`);
      if (bytes(summary) > 160) problems.push(`${operation.operationId}: summary > 160 bytes`);
      if (bytes(description) > 2_400) problems.push(`${operation.operationId}: description > 2.400 bytes`);
      if (datedEvidence.test(description)) problems.push(`${operation.operationId}: evidência datada na description`);

      for (const parameter of operation.params) {
        const context = [parameter.description, parameter.shape].filter(Boolean).join(" ");
        inputContextBytes += bytes(context);
        if (!parameter.description?.trim()) {
          problems.push(`${operation.operationId}.${parameter.name}: sem description`);
        }
        if (bytes(context) > 1_700) {
          problems.push(`${operation.operationId}.${parameter.name}: contexto > 1.700 bytes`);
        }
        if (datedEvidence.test(context)) {
          problems.push(`${operation.operationId}.${parameter.name}: evidência datada`);
        }
      }
    }

    if (descriptionBytes > contract.maxDescriptionBytes) {
      problems.push(`descrições: ${descriptionBytes} > ${contract.maxDescriptionBytes} bytes`);
    }
    if (inputContextBytes > contract.maxInputContextBytes) {
      problems.push(`contexto de inputs: ${inputContextBytes} > ${contract.maxInputContextBytes} bytes`);
    }

    expect(problems).toEqual([]);
  });
}
