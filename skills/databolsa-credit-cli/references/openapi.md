# Credit OpenAPI

The live contract is the source of truth:

```text
https://api.databolsa.com/openapi-credit.json
```

Prefer `databolsa-credit --list` for discovery and
`databolsa-credit <operation> --help` for shell syntax. Query the contract
only when an exact request, response, enum, description, unit, or error matters.

## Inspect one operation

```bash
OPERATION=deskListWatchlists
curl -fsSL https://api.databolsa.com/openapi-credit.json | jq --arg operation "$OPERATION" '
  .paths | to_entries[]
  | .key as $path
  | .value | to_entries[]
  | select(.value.operationId == $operation)
  | {
      path: $path,
      method: (.key | ascii_upcase),
      summary: .value.summary,
      description: .value.description,
      parameters: (.value.parameters // []),
      requestBody: (.value.requestBody // null),
      responses: .value.responses
    }
'
```

Replace `deskListWatchlists` with an id returned by `--list`, then confirm the
generated interface with:

```bash
databolsa-credit deskListWatchlists --help
```

Credit response schemas are currently inline. Inspect the selected operation
rather than guessing a reusable component or loading the whole contract.
Preserve descriptions, required fields, source units, nulls, permissions,
RFC 9457 errors, and audit semantics.
