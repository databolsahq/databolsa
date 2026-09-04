# Advisor OpenAPI

The live Advisor contract is the source of truth:

```text
https://api.databolsa.com/openapi-advisor.json
```

It is separate from `openapi.json`, which covers market data. Prefer
`databolsa-advisor --list` for discovery and
`databolsa-advisor <operation> --help` for shell syntax. Query the contract
only when the exact request, response, enum, description, or error matters.

## Inspect one operation

Replace `advisorListClients` with the operation id returned by `--list`:

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
      description: .value.description,
      parameters: (.value.parameters // []),
      requestBody: (.value.requestBody // null),
      responses: .value.responses
    }
'
```

Then confirm the generated shell interface:

```bash
databolsa-advisor advisorListClients --help
```

## Inspect one reusable schema

Use the component name found in an operation's `$ref`:

```bash
SCHEMA=Client
curl -fsSL https://api.databolsa.com/openapi-advisor.json | jq --arg schema "$SCHEMA"   '.components.schemas[$schema]'
```

Do not load or reproduce the entire contract. Preserve descriptions, required
fields, units, and error semantics. A 404 does not reveal whether an
out-of-scope resource exists; 402 blocks writes when the organization license is
not active. Every write is audited and requires user confirmation.
