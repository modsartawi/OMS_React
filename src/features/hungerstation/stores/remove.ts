// Removing a HungerStation store's onboarding (ticket 552; contract § Stores, `DELETE
// HungerStationWeb/Stores/{storeCode}?reason=`). Pure: no React, no `t`.

/**
 * The remove door's path: the store as a path segment, the reason in the QUERY STRING (the contract
 * puts it there, not in a body). `URLSearchParams` percent-encodes it as UTF-8, so Arabic, a line
 * break or an emoji arrive as typed, and a `&` or `#` in the reason stays inside it.
 */
export function removePath(storeCode: string, reason: string): string {
  // The same segment as `storePath` in ./api, spelled here so this module stays pure (no `@/core/api`).
  return `HungerStationWeb/Stores/${encodeURIComponent(storeCode)}?${new URLSearchParams({ reason }).toString()}`
}

/**
 * What the remove confirmation says, in order — each a sentence under `remove.consequences.*`:
 * the stock sync stops and the orders are no longer fetched; the vendor id is free for another
 * store; the logs, orders and history stay readable; and the store is NOT taken off HungerStation
 * (that is done in HungerStation's portal).
 */
export const REMOVE_CONSEQUENCES = ['syncStops', 'vendorIdFree', 'historyStays', 'notOffHungerStation'] as const

export type RemoveConsequence = (typeof REMOVE_CONSEQUENCES)[number]
