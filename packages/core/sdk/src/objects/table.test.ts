import { afterEach, describe, expect, test } from "bun:test";
import { HttpClient } from "../http-client";

const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

describe("objects.table", () => {
  test("vários sujeitos viajam como UMA lista separada por vírgula, codificada uma vez só", async () => {
    // Em 28/08/2026 "pub_a,pub_b" chegava ao servidor como `pub_a%2Cpub_b` (vírgula codificada
    // duas vezes) e a comparação entre dois objetos respondia "objeto não encontrado".
    let url = "";
    globalThis.fetch = (async (entrada: string | URL | Request) => {
      url = String(entrada);
      return new Response(JSON.stringify({ schema: { columns: [] }, rows: [], meta: { count: 0, warnings: [] } }), { headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const db = new HttpClient("https://api.example.test", { apiKey: "k" });
    await db.objects.table({ operation: "getObjectHistory", subject: { entity_id: "pub_a,pub_b" }, input: { facts: "pl" } });
    const q = new URL(url).searchParams;
    expect(q.get("id")).toBe("pub_a,pub_b");
    expect(url).not.toContain("%252C");
  });
});
