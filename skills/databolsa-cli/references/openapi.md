# OpenAPI reference

The live API contract is the source of truth for DataBolsa operations, parameters,
request bodies, enums, response schemas, and descriptions:

```text
https://api.databolsa.com/openapi.json
```

Do not copy the complete schema into the conversation. Query only the operation
or component required for the task, then confirm the shell syntax with the CLI
help.

## Find an operation

Replace `getStock` with the current `operationId`:

```bash
OPERATION=getStock
curl -fsSL https://api.databolsa.com/openapi.json | jq --arg operation "$OPERATION" '
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
npx --yes @databolsa/cli getStock --help
```

## Inspect a reusable schema

Use the schema name found in an operation's `$ref`:

```bash
SCHEMA=Stock
curl -fsSL https://api.databolsa.com/openapi.json | jq --arg schema "$SCHEMA" \
  '.components.schemas[$schema]'
```

## Rules

- Prefer the CLI's `--list` and `<command> --help` for normal use; they are more
  concise and map the contract to shell arguments.
- Fetch the contract only when the precise request/response shape, enum, or body
  schema matters.
- The live contract can change. Never rely on a previously saved schema without
  checking it again.
- Preserve the returned field names and units. Do not infer unavailable data or
  convert an endpoint's response into investment advice.
