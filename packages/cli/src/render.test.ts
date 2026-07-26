import { expect, test } from "bun:test";
import { render } from "./render";

// Todo endpoint de listagem responde `{ data, meta }`, e o `meta` guarda o contexto da
// consulta além da paginação. Impresso como blob JSON numa linha, esse contexto some da
// vista de quem está no terminal — o rodapé achata.
test("rodapé achata o meta em pares legíveis", () => {
  const out = render(
    { data: [{ ts: "10:00", price: 1 }], meta: { next_cursor: null, count: 1, ticker: "PETR4", session_date: "2026-07-24" } },
    false,
  );
  expect(out).toContain("count: 1");
  expect(out).toContain("ticker: PETR4");
  expect(out).toContain("session_date: 2026-07-24");
  expect(out).not.toContain('meta: {"next_cursor"');
});

test("--json não é afetado pelo rodapé", () => {
  const body = { data: [], meta: { next_cursor: null, count: 0 } };
  expect(JSON.parse(render(body, true))).toEqual(body);
});
