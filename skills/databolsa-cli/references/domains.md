# Reading domain data

Do not maintain a second catalogue of operations here. Discover the current
surface with `databolsa --list`, inspect a command with
`databolsa <operation> --help`, and use the live OpenAPI description when the
meaning of a field matters.

Before reporting a value, inspect the operation and response schema for these
five things:

1. **Identity:** determine whether the subject is an issuer, instrument, fund,
   quota, index, indicator, or published series. Use the object graph to resolve
   codes and traverse declared relations instead of joining names.
2. **Grain:** identify what one row represents and which dimensions make it
   unique. Never sum rows until the schema confirms they are additive.
3. **Unit:** preserve the unit declared for the field. Fractions, percentages,
   prices, rates, quantities, and BRL amounts are not interchangeable.
4. **Time and coverage:** distinguish market session, accounting period,
   filing date, reference date, and the available observation window.
5. **Missingness and quality:** keep `null`, flags, match levels, and reasons.
   A withheld, inapplicable, incomparable, stale, or undisclosed value is not
   zero.

## Use the contract as the domain guide

The operation description explains the dataset's scope. Property descriptions
carry local rules such as denominators, cumulative bands, non-additive groups,
point-in-time behavior, and source-specific classifications. Inspect both before
calculating.

Use [openapi.md](openapi.md) to query one operation or reusable schema rather
than loading the entire contract. When working through MCP, read the tool's input
and output schema and the server instructions; they come from the same contract.

## Object-first questions

Start with object resolution when the question connects real-world entities.
The resolved object map declares:

- relations that can be traversed;
- data chapters available for that object;
- the operation and parameters behind each chapter;
- evidence or source links when the contract exposes them.

Do not assume a security is the same object as its issuer, or an economic
indicator is the same object as a series that publishes it. Let the returned
kind and relations decide.

## Research checks

- A current-value claim needs its timestamp and freshness.
- A trend claim needs a suitable history, not two convenient points.
- A ranking needs its universe, filters, sort, date, limit, and missing-value
  treatment.
- A cash-flow claim needs the event/payment date convention.
- A document claim needs the document date, type, source link, and relevant
  passage.
- A derived claim must name its inputs and formula.
- A material interpretation should include contrary evidence or missing
  variables.

Use the focused document, event, ownership, or offering reference from the main
skill when those sources are part of the task. If the contract and a reference
disagree, the current contract and returned metadata win; note the discrepancy
instead of silently substituting an older rule.
