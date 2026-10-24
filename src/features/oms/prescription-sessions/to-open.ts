/**
 * The To open tab (ticket 546; BackOffice 3015 story 70): the unopened prescription orders, one
 * group per store, oldest first. Pure, pinned by `to-open.test.ts`.
 *
 * - `GET PrescriptionSessionWeb/ToOpen?store` — the store is optional.
 * - The per-store `orders` are capped across the whole read while `count` is exact: a group that
 *   lists fewer orders than its count says so (`capped`).
 * - **Grouped by store only.** `byUpload` is always false today (no upload batch reference); it is
 *   ignored even when true, until a ticket adds the batch reference.
 *
 * The tab key is the page's (`./tab`): this tab's address always writes `tab=toOpen` back.
 */
import type {
  PrescriptionSessionHqToOpen,
  PrescriptionSessionHqToOpenOrder,
  PrescriptionSessionHqToOpenStore,
} from '@/core/models/prescription-session'
import { sourceWord, type CodeWord } from '@/core/prescription-session/words'

export interface ToOpenFilter {
  /** A store code (the order's store), or `''` for every store. */
  store: string
}

const TO_OPEN = 'PrescriptionSessionWeb/ToOpen'

/** `SdDocumentSource` of a NUPCO bulk upload. */
const BULK_UPLOAD_SOURCE = 'BKOF'

export function toOpenFilterFromParams(params: URLSearchParams): ToOpenFilter {
  return { store: (params.get('store') ?? '').trim() }
}

export function toOpenFilterToParams(f: ToOpenFilter): URLSearchParams {
  const qs = new URLSearchParams({ tab: 'toOpen' })
  if (f.store.trim()) qs.set('store', f.store.trim())
  return qs
}

export function toOpenRequest(f: ToOpenFilter): { path: typeof TO_OPEN; params: Record<string, string> } {
  const store = f.store.trim()
  return { path: TO_OPEN, params: store ? { store } : {} }
}

export type ToOpenOrderView = PrescriptionSessionHqToOpenOrder & {
  source: CodeWord
  /** The order came from a NUPCO bulk upload (`documentSource` BKOF). */
  bulkUpload: boolean
}

export interface ToOpenGroup extends Omit<PrescriptionSessionHqToOpenStore, 'orders'> {
  orders: ToOpenOrderView[]
  /** The group lists fewer orders than its exact count; `null` when every order is listed. */
  capped: { shown: number; count: number } | null
}

const time = (v: string | null | undefined) => {
  const ms = v ? Date.parse(v) : NaN
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms
}

/** The store groups, oldest unopened order first (then by store code, so the order is stable). */
export function toOpenGroups(answer: PrescriptionSessionHqToOpen): ToOpenGroup[] {
  return [...(answer.stores ?? [])]
    .sort((a, b) => time(a.oldestOrderedAt) - time(b.oldestOrderedAt) || a.storeCode.localeCompare(b.storeCode))
    .map((s) => {
      const orders = (s.orders ?? []).map((o) => ({
        ...o,
        source: sourceWord(o.sourceKind),
        bulkUpload: (o.documentSource ?? '').trim().toUpperCase() === BULK_UPLOAD_SOURCE,
      }))
      return {
        storeCode: s.storeCode,
        count: s.count,
        oldestAgeDays: s.oldestAgeDays,
        oldestOrderedAt: s.oldestOrderedAt,
        orders,
        capped: orders.length < s.count ? { shown: orders.length, count: s.count } : null,
      }
    })
}
