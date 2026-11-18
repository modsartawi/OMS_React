/**
 * The Stock health page's grant (oms 912, BackOffice 4012 / grant 3994), read off the one permissions answer (oms 914):
 * `BackOfficeScreen[StockHealth, 03]` (role `STOCK_HEALTH_VIEWER`, BackOffice `Seed-StockHealth-Screen-Authorization.sql`).
 * Apart from `./api` so the OMS menu leaf, which imports it eagerly, costs the main bundle only this. The door checks the
 * grant again.
 */
import type { Permissions } from '@/core/permissions'

/** `StockHealth:03` — the leaf and the page's gate. */
export const canOpenStockHealth = (p: Permissions): boolean => p.has('StockHealth:03')
