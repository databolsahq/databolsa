export { DataBolsaWallet, DataBolsaWalletError, type FetchLike, type WalletClientOptions } from "./client";
export type { paths as WalletPaths } from "./schema";
import { DataBolsaWallet, type FetchLike } from "./client";

/**
 * Plugin para `db.use(wallet())` de `@databolsa/sdk`: o cliente da Wallet sobre a origem e a
 * credencial do cliente core. Sem dependência entre os pacotes — o contrato é estrutural
 * (`{ baseUrl, fetch }`).
 */
export function wallet() {
  return (ctx: { baseUrl: string; fetch: FetchLike }): DataBolsaWallet => new DataBolsaWallet({ baseUrl: ctx.baseUrl, fetch: ctx.fetch });
}
