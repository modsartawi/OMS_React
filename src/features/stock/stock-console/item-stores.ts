/**
 * The item at every store (oms 943, BackOffice spec 4157 story 59, BO 4161) — pure. The item page's Other stores tab and
 * Find's Other stores view draw these rows (each carries the store list's figures: gap, held, free with reserved's
 * state); each opens the same item at its store.
 */
import type { StockConsoleItemStoreRow } from '@/core/models/stock-console'
import { itemHref } from './console-pages'

/** An Other stores row opens the same item at that store. */
export const itemStoreHref = (item: string, row: Pick<StockConsoleItemStoreRow, 'plant'>): string => itemHref(row.plant, item)
