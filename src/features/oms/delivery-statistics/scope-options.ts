/**
 * The store picker's and the order-type leave-out's options (ticket 485), shaped from the EXISTING
 * session lookups (`@/core/services/lookups`) — no new door. Pure, pinned by `scope-options.test.ts`.
 */
import type { SdDocumentTypeModel, StoreDetailModel } from '@/core/models/lookups'
import { formatPair } from '@/core/util/bidi'

export interface ScopeOption {
  /** The code the door is sent. */
  value: string
  /** What the reader sees, built whole; the caller isolates it once. */
  text: string
}

/** The order and Erx categories: the summary's type is always the ORDER's (the till's own filter). */
const ORDER_CATEGORIES = new Set(['O', 'X'])

/** Each store once, in code order, labelled as one `code · city` pair. */
export function storeOptions(rows: readonly StoreDetailModel[] | undefined): ScopeOption[] {
  const byCode = new Map<string, ScopeOption>()
  for (const row of rows ?? []) {
    const code = (row.storeCode ?? '').trim()
    if (code && !byCode.has(code)) byCode.set(code, { value: code, text: formatPair(code, (row.city ?? '').trim()) })
  }
  return [...byCode.values()].sort((a, b) => a.value.localeCompare(b.value))
}

/**
 * The order types a reader can leave out, as on the till (`OmsStatisticsDashboard.ReadOrderTypesAsync`):
 * the order and Erx types only, each code once, captioned by its description (or its code when it
 * has none), in caption order.
 */
export function orderTypeOptions(rows: readonly SdDocumentTypeModel[] | undefined): ScopeOption[] {
  const byCode = new Map<string, ScopeOption>()
  for (const row of rows ?? []) {
    const code = (row.documentType ?? '').trim()
    if (!code || byCode.has(code) || !ORDER_CATEGORIES.has((row.documentCategory ?? '').trim().toUpperCase())) continue
    byCode.set(code, { value: code, text: (row.description ?? '').trim() || code })
  }
  return [...byCode.values()].sort((a, b) => a.text.localeCompare(b.text, undefined, { sensitivity: 'base' }))
}
