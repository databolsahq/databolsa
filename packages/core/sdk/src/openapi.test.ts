import { expect, test } from "bun:test";
import { describeOperation, extractOperations } from "./openapi";

const SPEC = {
  components: {
    schemas: {
      Settings: {
        type: "object",
        required: ["currency"],
        properties: { currency: { type: "string", enum: ["BRL", "USD"] } },
      },
    },
  },
  paths: {
    "/things/{id}": {
      patch: {
        operationId: "updateThing",
        summary: "Atualizar objeto",
        description: "Atualiza os campos informados.",
        tags: ["Things"],
        "x-capability": "things.write",
        "x-lifecycle": "default",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Identificador do objeto.",
            schema: { type: "string", pattern: "^[a-z]+$" },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100 },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["settings"],
                properties: {
                  settings: { $ref: "#/components/schemas/Settings" },
                  labels: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Settings" } },
            },
          },
        },
      },
    },
  },
};

test("extrator preserva semântica usada por todos os consumidores", () => {
  const operation = extractOperations(SPEC)[0]!;
  expect(operation.capability).toBe("things.write");
  expect(operation.lifecycle).toBe("default");
  expect(operation.responseSchema?.$ref).toBe("#/components/schemas/Settings");

  expect(operation.params.find((param) => param.name === "id")).toMatchObject({
    type: "string",
    pattern: "^[a-z]+$",
    description: "Identificador do objeto.",
  });
  expect(operation.params.find((param) => param.name === "limit")).toMatchObject({
    type: "integer",
    minimum: 1,
    maximum: 100,
  });
  expect(operation.params.find((param) => param.name === "settings")).toMatchObject({
    type: "object",
    required: true,
    shape: "campos: currency* (BRL|USD) — * é obrigatório",
  });
  expect(operation.params.find((param) => param.name === "labels")).toMatchObject({
    type: "array",
    items: "string",
  });
});

test("descrição da tool tem uma única composição autoral", () => {
  expect(describeOperation(extractOperations(SPEC)[0]!)).toBe(
    "Atualizar objeto Atualiza os campos informados. Categoria: Things.",
  );
});
