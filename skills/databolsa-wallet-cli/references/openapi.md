# Wallet OpenAPI

The live contract is the source of truth:

```text
https://api.databolsa.com/openapi-wallet.json
```

Prefer `@databolsa/wallet-cli --list` for discovery and
`@databolsa/wallet-cli <operation> --help` for shell syntax. Query the contract
only when an exact request, response, enum, description, unit, or error matters.

## Inspect one operation

```bash
OPERATION=listPortfolios
curl -fsSL https://api.databolsa.com/openapi-wallet.json | jq --arg operation "$OPERATION" '
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

Replace `listPortfolios` with an id returned by `--list`, then confirm the
generated interface with:

```bash
npx --yes @databolsa/wallet-cli listPortfolios --help
```

For a reusable schema, use the component name found in an operation's `$ref`:

```bash
SCHEMA=PortfolioHolding
curl -fsSL https://api.databolsa.com/openapi-wallet.json | jq --arg schema "$SCHEMA" \
  '.components.schemas[$schema]'
```

Do not load or reproduce the entire contract. Preserve descriptions, required
fields, currencies, units, nulls, valuation semantics, permissions, and errors.
Discovery alone does not establish Wallet access in a workspace.
