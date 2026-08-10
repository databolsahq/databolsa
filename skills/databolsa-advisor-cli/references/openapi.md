# OpenAPI reference

The live contract is the source of truth for DataBolsa Advisor operations,
parameters, request bodies, enums, response schemas, and descriptions:

```text
https://api.databolsa.com/openapi-advisor.json
```

This contract is **separate** from the main DataBolsa contract
(`openapi.json`). Advisor operations never appear there, and market-data
operations never appear here. Query the one that matches the task.

Do not copy the complete schema into the conversation. Query only the operation
or component required for the task, then confirm the shell syntax with the CLI
help.

## Find an operation

Replace `advisorListClients` with the current `operationId`:

```bash
OPERATION=advisorListClients
curl -fsSL https://api.databolsa.com/openapi-advisor.json | jq --arg operation "$OPERATION" '
  .paths | to_entries[]
  | .key as $path
  | .value | to_entries[]
  | select(.value.operationId == $operation)
  | {
      path: $path,
      method: (.key | ascii_upcase),
      summary: .value.summary,
      parameters: (.value.parameters // []),
      requestBody: (.value.requestBody // null)
    }
'
```

Then check the generated CLI interface before running it:

```bash
npx --yes @databolsa/advisor-cli advisorListClients --help
```

Every path except the account ones is scoped to an organization, so the first
positional argument is the org `slug` or `id`. `advisorGetMe` reports which
organizations the current credential can act in.

## List the operations of one area

The contract groups operations by tag — `Advisor · Conta`, `· Organização`,
`· Clientes`, `· Carteiras`, `· Taxas`, `· Auditoria`:

```bash
TAG='Advisor · Clientes'
curl -fsSL https://api.databolsa.com/openapi-advisor.json | jq -r --arg tag "$TAG" '
  .paths | to_entries[]
  | .key as $path
  | .value | to_entries[]
  | select(.value.tags // [] | index($tag))
  | "\(.value.operationId)\t\(.key | ascii_upcase) \($path)"
'
```

## Inspect a request body

Write operations carry their schema inline. Read it before composing flags,
especially for the client profile, whose objectives and restrictions are
structured arrays:

```bash
curl -fsSL https://api.databolsa.com/openapi-advisor.json | jq '
  .paths["/v1/advisor/orgs/{org}/clients/{clientId}/profile"].patch.requestBody
  .content["application/json"].schema
'
```

## Rules

- Prefer the CLI's `--list` and `<command> --help` for normal use; they are more
  concise and map the contract to shell arguments.
- Fetch the contract only when the precise request/response shape, enum, or body
  schema matters.
- The live contract can change. Never rely on a previously saved schema without
  checking it again.
- A resource outside the caller's organization — or outside their client
  visibility — answers **404**, never 403. The contract cannot tell you whether a
  record exists; do not infer existence from an error.
- An expired license answers **402** with `code: license_required` on writes;
  reads keep working. Report it instead of retrying.
- Every write lands in the organization's audit trail. Read freely; confirm with
  the user before creating, changing, or deleting.
- Portfolio positions are derived from the transaction ledger and current market
  quotes. There is no operation that sets a position — fix the ledger instead.
- Client names, documents, and profiles are the office's personal data. Preserve
  the returned field names and units, and do not copy that data beyond what the
  task requires or turn a response into investment advice.
