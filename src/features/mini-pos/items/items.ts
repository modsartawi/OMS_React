/**
 * The Mini POS items screen's pure half (oms 915, BackOffice 4043): the two add forms' checks (the DDL widths of
 * `MiniPosAllowedCategory` / `MiniPosRefusedItem`) and the lists after an add or a removal, so the screen shows the
 * change the moment the server says yes.
 */
import type { MiniPosAllowedCategory, MiniPosRefusedItem } from '@/core/models/mini-pos'

/** The DDL widths (`MiniPosAllowedCategory.Widths`, `MiniPosRefusedItem.Widths`). */
export const WIDTHS = { aCode: 30, itemNumber: 30, reasonNote: 200 } as const

/** Why a category cannot be added yet (`category.problem.*`), or null. */
export function categoryProblem(aCode: string): 'required' | 'tooLong' | null {
  const code = aCode.trim()
  if (!code) return 'required'
  return code.length > WIDTHS.aCode ? 'tooLong' : null
}

/** Why an item cannot be refused yet (`refused.problem.*`), or null. A reason is required. */
export function refusalProblem(itemNumber: string, reasonNote: string): 'item' | 'itemTooLong' | 'reason' | 'reasonTooLong' | null {
  const item = itemNumber.trim()
  if (!item) return 'item'
  if (item.length > WIDTHS.itemNumber) return 'itemTooLong'
  const reason = reasonNote.trim()
  if (!reason) return 'reason'
  return reason.length > WIDTHS.reasonNote ? 'reasonTooLong' : null
}

/** The list with `row` in it — replacing the row with the same key — in key order (the server's own order). */
export function withRow<T>(list: readonly T[], row: T, key: (r: T) => string): T[] {
  const k = key(row)
  return [...list.filter((r) => key(r) !== k), row].sort((a, b) => key(a).localeCompare(key(b)))
}

/** The list without the row whose key is `k`. */
export function withoutRow<T>(list: readonly T[], k: string, key: (r: T) => string): T[] {
  return list.filter((r) => key(r) !== k)
}

export const categoryKey = (r: MiniPosAllowedCategory): string => r.aCode
export const refusedKey = (r: MiniPosRefusedItem): string => r.itemNumber
