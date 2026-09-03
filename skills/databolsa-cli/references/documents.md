# Documents and semantic search

Finding what a company filed, and quoting it with the right date.

Use `listCompanyDocuments` to establish what a company filed and
`searchDocuments` to locate relevant passages. Search is discovery, not a complete
reading: after a hit identifies `citation.protocol` and `citation.source`, use
`readDocument <protocol> --source <source>` and follow `meta.next_cursor` until null
when the conclusion depends on the whole document. `getDocumentTaxonomy` discovers
stable `document_kind` values and the exact raw `category`/`doc_type` labels; prefer
the stable kind unless the source subtype itself matters.

The semantic corpus treats `fiagro` as its own `entity_type` (never as FII) and
`FIAGRO` as an `asset_family`; filter by ticker, CNPJ or either facet when reading
fund documents. Private credit usually has no ticker: combine `issuer_cnpj`
(the registered issuer), `asset_code` (ISIN or instrument code), and `asset_family`
(DEB/CRI/CRA/OTS/FIDC/FIAGRO). `debt_instrument` includes debenture deeds,
securitization terms and amendments; `governing_document` includes fund rules and
constitutive documents; `offering_document` is the offer's essential-information sheet published by an investment crowdfunding platform (Anexo E, CVM Resolution 88), category "Informações Essenciais da Oferta". A securitizer, originator and economic debtor are not the
same role.

For a critical claim:

- in `listCompanyDocuments`, `from`/`to` filter the document's REFERENCE date
  (the period it covers), not the filing date: annual statements for year N are
  filed in year N+1 and still match a from/to range inside year N. The filing
  date is returned as `filed_at`;
- include the ticker and, when useful, year/category/table filters;
- try 3 to 5 domain-specific formulations;
- distinguish “no matching indexed passage” from “no document exists”;
- inspect every page of `readDocument` (or the original document link) before claiming
  that the complete document is silent;
- compare narrative claims with structured financial data from the same period;
- treat `score` as semantic proximity, never factual confidence, and prefer
  `include_context=false` in MCP/CLI loops to avoid duplicating the same excerpts in
  `meta.context`.

Each `searchDocuments` result carries a `citation` with two distinct dates plus
document identity: `reference_date` is the period the document COVERS;
`filed_at` is when it was actually FILED/published (often weeks later);
`protocol`+`source` identify the exact document at the source;
`filed_at_source` is `"source"` when the filing date came from the source and
`null` when unknown (it is never inferred from `reference_date`). Quote
`filed_at` — not `reference_date` — when the claim is about what was known at a
point in time.

For historical reconstruction ("what was known on date X"), pass
`filed_before=<date>`: only documents already filed by that date are returned,
and documents with unknown filing date are excluded (the response `warnings`
notes this). Exact-document filters are also available: `protocol` (semantic search
inside one document), `reference_date`/`reference_from`/`reference_to`,
`filed_after`, and `doc_type`. Searching by protocol still returns ranked passages;
`readDocument` is the deterministic, ordered read.

```bash
# What did the market know about Taurus on 2022-11-03? (2Q22 release is in;
# the 3Q22 release, filed 2022-11-08, and the 2022 annual report are OUT)
npx --yes @databolsa/cli searchDocuments \
  --q "resultados 2T22 receita margem bruta" --tickers TASA4 \
  --filed_before 2022-11-03 --json
```
