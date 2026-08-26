# Thesis and report workflow

How to build, write, and publish an investment thesis, plus the markdown
format the server compiles.

When asked to create, review, update, or market an investment thesis, do not treat
it as a generic writing task.

1. Run `getHealth` and record freshness.
2. Use `listMyTheses` and `getThesis` to avoid duplicating an existing thesis and
   to preserve the user's prior hypothesis, triggers, and writing style.
3. If the thesis is personal or portfolio-aware, inspect `getPortfolio`, the
   relevant detail, and suitability. Keep exact private values out of the public
   version by default.
4. Build the evidence with the core research workflow: snapshot, history, cash,
   events, documents, peers, benchmark, counter-case, and monitoring triggers.
5. Separate:
   - **facts:** returned values with dates and sources;
   - **interpretation:** what those facts may imply;
   - **assumptions:** subjective scenario inputs;
   - **unknowns:** missing or conflicting evidence.
6. For a public thesis, use a descriptive search-friendly title and subtitle,
   mention the covered ticker/topic naturally, and include dated sources and a
   clear educational disclaimer. Never claim that DataBolsa or a model increased
   returns without a documented baseline and calculation.
7. Produce and review the local thesis markdown before any import or update.
8. Import/create as `private` first. Publishing, changing visibility, exporting,
   reordering, or replacing an existing document is a separate write that requires
   explicit confirmation immediately before execution.
9. Before publication, remove private sections and explain that the full document
   becomes visible according to the selected visibility.

Useful discovery commands:

```bash
npx --yes @databolsa/cli listMyTheses --json
npx --yes @databolsa/cli getThesis <id> --json
npx --yes @databolsa/cli createThesis --help
npx --yes @databolsa/cli importThesisFile --help
npx --yes @databolsa/cli publishThesis --help
```

A thesis is written in **Markdown with a YAML frontmatter**. Only `kind` and
`title` are required; `subtitle`, `ticker`, `date` and `tags` are optional. Do not
write the author, the cover, the section anchors or the disclaimer — the server
fills those in. `kind` is one of `equity`, `fii`, `etf`, `bdr`, `fundo`, `credito`,
`tesouro`, `cripto`, `global`, `macro`, `setor`, `carteira`, `carta`, `outros`, and
natural spellings are accepted.

In the body, `## Title` opens a section, prose is full GFM, a GFM table becomes a
report table, and `> [!risco|tese|catalisador|atenção|info] Title` becomes a
callout. Rich blocks go in ```db:<type> fences with a YAML body, where `<type>` is
`rating`, `keyStats`, `summary`, `chart`, `scenarios`, `sources`, `quote`,
`figure`, `table`, `cover` or `disclaimer`.

A malformed rich block does not reject the thesis. It degrades to an attention
callout inside the document and comes back in `warnings` with the line and the
field. The same holds for any label outside a known set — `rating`, callout tone,
chart type, `kind`: it falls back to the nearest honest default and reports the
substitution. A `201` carrying `warnings` is a partial success: the thesis exists,
so report what degraded and fix it instead of writing the document again.

Two ways to submit the document, and the choice is about where it lives:

- `importThesisFile --file <path>` reads a `.md` file, which is the better path
  for anything large enough to be awkward to quote. The JSON report document is
  still accepted and detected from the file.
- `createThesis --md '<markdown>'` passes the text inline, for short documents.

`getThesis` returns the markdown in `md` — read and edit that field. The compiled
report document is derived from it and only ships with `include=doc`, for a caller
that renders; a reader does not need it.

To change a thesis, prefer `editThesis --old-text ... --new-text ...`, which swaps a
single passage and requires it to occur exactly once — include surrounding lines
until it is unambiguous. `updateThesis` replaces the **whole** markdown and is for
large rewrites.

Do not import a draft merely to validate or preview it.
