import { canSeeMaterialStock } from '@/core/materials/access'
import { stockRequest } from '@/core/materials/stock'
import type { MaterialAccessResult, MaterialStockCell, MaterialStockRequest } from '@/core/models/materials'

// The material detail's tabs, its Stock tab's one question, and its simulator link (ticket 452,
// spec 2544 stories 18–22). Pure: no React, no `t`.

export type DetailTab = 'master' | 'barcodes' | 'batches' | 'stock'

/** The tabs a material has, in order. Batches only for a serialised material (story 19). */
export function detailTabs(serialised: boolean): DetailTab[] {
  return serialised ? ['master', 'barcodes', 'batches', 'stock'] : ['master', 'barcodes', 'stock']
}

/** `?tab=` as the open tab. An unknown value, or Batches on a material without it, is Master. */
export function resolveDetailTab(param: string | null, serialised: boolean): DetailTab {
  return detailTabs(serialised).find((tab) => tab === param) ?? 'master'
}

/**
 * Whether the Stock tab may ask for stock: it needs BOTH the search grant (the page's own) and the
 * stock grant (spec 2544, Grants). Without them the tab shows "not permitted" and asks nothing.
 */
export const stockTabVisible = (access: MaterialAccessResult | null | undefined): boolean => canSeeMaterialStock(access)

/**
 * The Stock tab's ONE question: this material at every store (`stores: null`), closed stores left
 * out, zeros only when "show zero stores" is on. 🚩 `null` without the grant — and a `null` request
 * is a disabled query (`materialStockQuery`), so the door is never called.
 */
export function detailStockRequest(
  materialNumber: string,
  access: MaterialAccessResult | null | undefined,
  includeZero: boolean,
): MaterialStockRequest | null {
  if (!stockTabVisible(access)) return null
  return stockRequest({ materials: [materialNumber], stores: null, includeZero, includeClosed: false })
}

/**
 * The cells the Stock tab draws: every store whose ATP is not zero — or every store, zeros
 * included, once they are asked for — highest ATP first (story 20). A negative ATP is not zero.
 * Equal ATP falls back to the store code, so the order never flickers between answers.
 */
export function detailStockRows(cells: readonly MaterialStockCell[], includeZero: boolean): MaterialStockCell[] {
  return cells
    .filter((c) => includeZero || c.atp !== 0)
    .sort((a, b) => b.atp - a.atp || a.storeCode.localeCompare(b.storeCode))
}

/**
 * The pricing simulator, prefilled with this material (story 22): a plain path, so the detail
 * imports nothing from the simulator. The simulator reads `?material=` itself and guards itself
 * on its own grant.
 */
export function simulatorHref(materialNumber: string): string {
  return `/pricing/simulation?${new URLSearchParams({ material: materialNumber }).toString()}`
}
