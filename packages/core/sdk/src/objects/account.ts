import type { DataBolsaClient } from "../client";
import type { ObjectHandle } from "./handle";

/**
 * `db.account` — a porta de ESCRITA do mesmo SDK, ao lado de `db.objects`, para a "porta única"
 * não virar duas.
 *
 * As CARTEIRAS saíram daqui: viraram a extensão `databolsa.wallet`, com contrato e SDK
 * próprios (`@databolsa/wallet-sdk`). O que fica é a ponte de identidade — um handle de
 * `db.objects` vira `{ entityId }`, que é o único vocabulário que os dois lados
 * compartilham, e é o que o SDK da Wallet aceita onde pede um ativo.
 *
 * Camada fina sobre os métodos flat: nenhuma regra de domínio mora aqui.
 */
/** Uma referência de ativo OU qualquer handle de `db.objects` (só `id` e `kind` importam aqui). */
export type AssetRef = { entityId?: string; assetType?: string; symbol?: string };
export type AssetLike = AssetRef | Pick<ObjectHandle<string>, "id" | "kind">;

/**
 * O handle vira `{ entityId }` — e SÓ isso. Quem traduz o objeto para tipo e símbolo da
 * carteira é o servidor, que lê o spine (é lá que BDR é `instrument/bdr`); o que os dois lados
 * compartilham é o `entity_id`. Objeto que não entra na carteira volta como 400 com o motivo.
 */
export function assetRefOf(a: AssetLike): AssetRef {
  return "kind" in a ? { entityId: a.id } : a;
}

// Os métodos que traduzem o handle são `async` de propósito: a recusa de `assetRefOf` vira
// rejeição, como qualquer erro de rede, e não uma exceção síncrona que `await` não pega.
export class Account {
  constructor(private readonly db: DataBolsaClient) {}}
