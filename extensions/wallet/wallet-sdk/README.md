# @databolsa/wallet-sdk

[![npm version](https://img.shields.io/npm/v/@databolsa/wallet-sdk?color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/wallet-sdk)
[![license](https://img.shields.io/npm/l/@databolsa/wallet-sdk?color=2ea44f)](https://github.com/databolsahq/databolsa/blob/main/LICENSE)

Cliente TypeScript tipado da Wallet do DataBolsa: carteiras, transações,
importações e análises por workspace.

## Uso

```bash
npm install @databolsa/wallet-sdk
```

```ts
import { DataBolsaWallet } from "@databolsa/wallet-sdk";

const wallet = new DataBolsaWallet({
  apiKey: process.env.DATABOLSA_API_KEY,
  workspace: process.env.DATABOLSA_WORKSPACE,
});

const { data: portfolios } = await wallet.listPortfolios();
```

Também pode ser conectada ao cliente principal:

```ts
import { DataBolsa } from "@databolsa/sdk";
import { wallet } from "@databolsa/wallet-sdk";

const db = new DataBolsa("https://api.databolsa.com", {
  apiKey: process.env.DATABOLSA_API_KEY,
});
const account = db.use(wallet({ workspace: process.env.DATABOLSA_WORKSPACE }));
```

## Descobrir a superfície atual

- Consulte o [OpenAPI da Wallet](https://api.databolsa.com/openapi-wallet.json)
  para operações, schemas, enums e erros.
- O pacote exporta `WalletPaths`, gerado do mesmo contrato.
- Use `npx -y @databolsa/wallet-cli --list` para descoberta interativa. A CLI
  principal também mantém `databolsa wallet` como atalho de conveniência.

Descobrir o contrato não comprova que a Wallet esteja instalada. Chamadas reais
em workspace sem a extensão respondem `404 wallet_not_installed`; suspensão
mantém leituras e recusa escritas com `403 wallet_suspended`.

`DataBolsaWalletError` expõe `status` e o corpo `problem+json` em `problem`.
A chave e os dados da carteira devem permanecer no escopo da aplicação. Confirme
antes de executar escritas destrutivas ou que alterem o ledger.

O mesmo contrato está disponível em `@databolsa/wallet-cli` e
`@databolsa/wallet-mcp`.

Apache-2.0. O DataBolsa fornece informação e contexto, não recomendação de investimento.
