/**
 * The item at every store (oms 943, BackOffice spec 4157 story 59, SV 078) — pure. The item page's Other stores tab and
 * Find's Other stores view draw these rows; each opens the same item at its store.
 */
import type { StockConsoleItemStoreRow } from '@/core/models/stock-console'
import { itemHref } from './console-pages'
import type { ReservedFigures } from './figures'

/** An Other stores row opens the same item at that store. */
export const itemStoreHref = (item: string, row: Pick<StockConsoleItemStoreRow, 'plant'>): string => itemHref(row.plant, item)

export interface ItemStoreFigures extends ReservedFigures {
  gap: number
  held: number
  free: number
  reservedState: string
  reservedIncluded: boolean
}

/**
 * The figures the store list draws, for one store's row. SIS.Api may add them [guess]; when it leaves them out they read
 * as the store list's rules make them: gap = SAP − till-side; held = standing + sold not applied; free = till-side − held
 * − reserved (reserved left out when it was never computed, and then free says so).
 */
export function itemStoreFigures(row: StockConsoleItemStoreRow): ItemStoreFigures {
  const computed = row.reserved !== null && row.reserved !== undefined
  const held = row.held ?? row.heldStanding + row.heldSold
  return {
    gap: row.gap ?? row.sapStock - row.tillStock,
    held,
    free: row.free ?? row.tillStock - held - (computed ? (row.reserved as number) : 0),
    reserved: row.reserved ?? null,
    reservedState: row.reservedState ?? (computed ? 'Computed' : 'NeverComputed'),
    reservedIncluded: row.reservedIncluded ?? computed,
  }
}
