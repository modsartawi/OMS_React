/**
 * The stock console's grant (oms 940, BackOffice spec 4157 / 4158), read off the one permissions answer (oms 914):
 * `BackOfficeScreen[StockConsole, 03]` (role `STOCK_CONSOLE_VIEWER`). One grant opens the whole console, read-only.
 * There is no `StockConsole/Access` probe: the spec lists one, but oms 914 replaced every probe with `Auth/Permissions`.
 * Apart from `./api` so the Stock menu leaf, which imports it eagerly, costs the main bundle only this. Every console
 * route checks the grant again.
 */
import type { Permissions } from '@/core/permissions'

/** `StockConsole:03` — the leaf and every console page's gate. */
export const canOpenStockConsole = (p: Permissions): boolean => p.has('StockConsole:03')
