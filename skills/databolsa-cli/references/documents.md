# Documents and semantic search

Finding what a company filed, and quoting it with the right date.

Use `listCompanyDocuments` to establish what a company filed and
`searchDocuments` to locate relevant passages. For a critical claim:

- in `listCompanyDocuments`, `from`/`to` filter the document's REFERENCE date
  (the period it covers), not the filing date: annual statements for year N are
  filed in year N+1 and still match a from/to range inside year N. The filing
  date is returned as `filed_at`;
- include the ticker and, when useful, year/category/table filters;
- try 3 to 5 domain-specific formulations;
- distinguish “no matching indexed passage” from “no document exists”;
- inspect the original document link for context before a consequential conclusion;
- compare narrative claims with structured financial data from the same period.

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
notes this). Exact-document filters are also available: `protocol` (search
inside one document), `reference_date`/`reference_from`/`reference_to`,
`filed_after`, and `doc_type`.

```bash
# What did the market know about Taurus on 2022-11-03? (2Q22 release is in;
# the 3Q22 release, filed 2022-11-08, and the 2022 annual report are OUT)
npx --yes @databolsa/cli searchDocuments \
  --q "resultados 2T22 receita margem bruta" --tickers TASA4 \
  --filed_before 2022-11-03 --json
```
