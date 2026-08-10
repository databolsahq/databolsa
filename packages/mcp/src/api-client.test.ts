import { afterEach, expect, test } from "bun:test";
import { ApiClient } from "./api-client";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function captureFetch(): { headers: () => Record<string, string> } {
  let captured: Record<string, string> = {};
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    captured = { ...(init?.headers as Record<string, string>) };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { headers: () => captured };
}

test("get(): headers extras vão em toda requisição, sem sobrescrever o Bearer", async () => {
  const spy = captureFetch();
  const api = new ApiClient({
    baseUrl: "https://example.test",
    apiKey: "db_live_abc",
    headers: { "x-extra": "1" },
  });
  await api.get("/v1/health");
  expect(spy.headers()["x-extra"]).toBe("1");
  expect(spy.headers().authorization).toBe("Bearer db_live_abc");
});

test("fetchOpenApi(): headers extras também são enviados", async () => {
  const spy = captureFetch();
  const api = new ApiClient({ baseUrl: "https://example.test", headers: { "x-extra": "1" } });
  await api.fetchOpenApi();
  expect(spy.headers()["x-extra"]).toBe("1");
  expect(spy.headers().authorization).toBeUndefined();
});
