---
name: databolsa-advisor-cli
description: "Operate a wealth-advisory office on DataBolsa Advisor with the databolsa-advisor CLI — organization, members, roles and invitations, clients and families, client objectives/restrictions, per-client portfolios with market-valued positions, fee context, and organization API keys. Use when the user manages an advisory office (escritório de assessoria/consultoria) on DataBolsa: listing or registering clients, updating a client profile, reading a client portfolio, inviting team members, or minting organization keys. Requires an organization license."
license: Apache-2.0
compatibility: Node.js 18+ and network access. A DataBolsa Advisor organization credential is required.
metadata:
  version: "3.5.1"
---

# DataBolsa Advisor CLI

The `databolsa-advisor` CLI is a thin client to the DataBolsa Advisor API — the
organizational layer for advisory offices. The OpenAPI contract is the source of
truth: one CLI command per operation, discovered at runtime. The same base serves
the portal, the MCP server (`@databolsa/advisor-mcp`), and the SDK
(`@databolsa/advisor-sdk`), so anything done here is visible everywhere.

## Setup

```bash
npx @databolsa/advisor-cli --list          # or install globally
export DATABOLSA_ADVISOR_API_KEY=db_org_...   # organization key, minted in the portal
# optional: DATABOLSA_ADVISOR_API_URL (defaults to the hosted API)
```

Two credential kinds:

- **Organization key (`db_org_...`)** — the office's service credential. `full`
  operates as admin; `read` is read-only. It sees every client in the org.
- **Member credential (`db_live_...`)** — a person's own DataBolsa key. Role and
  client visibility follow that member's seat (an office can restrict advisors
  to their assigned clients only).

`advisorGetMe` shows who you are and which organizations you can act in. Every
other operation takes the organization id or slug as its first argument.

## Operation groups

Discover the live list with `databolsa-advisor --list`. Expect these surfaces:

- **Account:** `advisorGetMe`, `advisorAcceptInvitation`.
- **Organization:** `advisorGetOrganization`, `advisorUpdateOrganization`
  (including `settings.client_visibility`: `all` or `assigned`),
  `advisorGetLicense`, `advisorListMembers`, `advisorUpdateMember`,
  `advisorListInvitations`, `advisorCreateInvitation`, `advisorRevokeInvitation`.
- **Organization keys:** `advisorListOrgKeys`, `advisorCreateOrgKey`
  (the full key is returned once — store it immediately), `advisorRevokeOrgKey`.
- **Clients:** `advisorListFamilies`, `advisorCreateFamily`,
  `advisorListClients`, `advisorCreateClient`, `advisorGetClient`,
  `advisorUpdateClient`, `advisorSetClientAssignment` (responsible advisor),
  `advisorUpdateClientProfile` (objectives, restrictions, risk profile, notes —
  the context AI surfaces read).
- **Client portfolios:** `advisorListClientPortfolios`,
  `advisorCreateClientPortfolio` (`kind: proposal` keeps studies out of the
  client's consolidated view), `advisorGetClientPortfolio` (positions valued at
  market), `advisorGetClientPortfolioLedger`, `advisorAddClientPortfolioAsset`,
  `advisorAddClientPortfolioTransaction`, asset/transaction removal, and
  portfolio deletion.

## Behavior you should rely on

- **Scope is the organization.** A resource outside your organization (or outside
  your client visibility) answers **404**, never 403 — do not infer existence
  from errors.
- **License gates writes only.** An expired license returns **402** with
  `code: license_required` on writes; reads keep working. Tell the user to
  contact DataBolsa rather than retrying.
- **Everything is audited.** Every write lands in the organization's audit trail
  with who did it and through which door (portal, API, MCP). Act accordingly:
  make the minimal change the user asked for.
- **Positions are derived.** Portfolio positions are always computed from the
  transaction ledger and current market quotes — never cached or hand-set. To fix
  a position, fix the ledger.
- **Client data is personal data.** Client names, documents, and profiles belong
  to the office. Do not copy them into outputs beyond what the user asked for.

## Examples

```bash
databolsa-advisor advisorGetMe
databolsa-advisor advisorListClients meu-escritorio
databolsa-advisor advisorCreateClient meu-escritorio --name "Maria Souza" --email maria@example.com
databolsa-advisor advisorUpdateClientProfile meu-escritorio <clientId> \
  --risk_profile moderado --notes "Prefere reuniões trimestrais"
databolsa-advisor advisorGetClientPortfolio meu-escritorio <portfolioId> --json | jq .totals
databolsa-advisor advisorCreateInvitation meu-escritorio --email novo@escritorio.com --role advisor
```

Global flags: `--json` (raw JSON for piping), `--api-url`, `--help` per
operation, `--list`, `--version`.

When the exact request body, response schema, enum, or a newly released
operation matters, query only that operation in the live contract. See
[the OpenAPI reference](references/openapi.md). Do not load the complete
contract into context.

## Safety

Values returned are evidence for the professional's own analysis, not investment
advice, and the CLI never executes trades or moves money. Recommendations to end
clients remain the responsibility of the licensed professional using the tool.
