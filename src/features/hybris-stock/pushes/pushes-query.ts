import type { HybrisStockPushStatus, HybrisStockPushType, HybrisStockPushesQuery } from '@/core/models/hybris-stock'
import { PUSH_STATUSES, PUSH_TYPES } from './push-labels'

// The push log's URL ⇄ query ⇄ door mapping (ticket 849), and the drawers' URL keys. Pure.

/** The log reads the newest N: the door takes no `skip` and answers no total. Show more adds a step. */
export const PUSHES_STEP = 50
/** The door's `take` limit (Common: 1–500, else HybrisStockInputInvalid). */
export const PUSHES_MAX = 500
export const LINES_PAGE_SIZE = 200

/** A `yyyy-MM-dd` date, as the date inputs and the door read it. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** `?store=&type=&status=&from=&to=&take=` — a value the door does not know is dropped, a `to` before
 *  `from` reads as the same range with its ends in order (the door refuses it reversed), and `take` is a
 *  step of 50 up to 500. */
export function pushesFromParams(params: URLSearchParams): HybrisStockPushesQuery {
  const type = params.get('type')
  const status = params.get('status')
  const from = params.get('from')
  const to = params.get('to')
  const take = Number(params.get('take'))
  const fromOk = from && ISO_DATE.test(from) ? from : null
  const toOk = to && ISO_DATE.test(to) ? to : null
  const reversed = fromOk !== null && toOk !== null && toOk < fromOk
  return {
    store: params.get('store')?.trim() || null,
    type: PUSH_TYPES.includes(type as HybrisStockPushType) ? (type as HybrisStockPushType) : null,
    status: PUSH_STATUSES.includes(status as HybrisStockPushStatus) ? (status as HybrisStockPushStatus) : null,
    from: reversed ? toOk : fromOk,
    to: reversed ? fromOk : toOk,
    take: Number.isInteger(take) && take >= PUSHES_STEP && take <= PUSHES_MAX && take % PUSHES_STEP === 0 ? take : PUSHES_STEP,
  }
}

/** One end of the date range set; when it passes the other end, the other end moves to it, so the
 *  range never turns over (the door refuses `to` before `from`) and the date just picked is kept. */
export function withDate(q: HybrisStockPushesQuery, end: 'from' | 'to', value: string | null): HybrisStockPushesQuery {
  const next = { ...q, [end]: value }
  if (next.from && next.to && next.to < next.from) {
    if (end === 'from') next.to = next.from
    else next.from = next.to
  }
  return next
}

/** The filters without `take`: Show more keeps it, a filter change does not. */
export const pushesFilterKey = (q: HybrisStockPushesQuery): string => pushesToParams({ ...q, take: PUSHES_STEP }).toString()

/** The filters back to the URL (the drawers' keys are the page's, kept by `withDrawer`). */
export function pushesToParams(q: HybrisStockPushesQuery): URLSearchParams {
  const out = new URLSearchParams()
  if (q.store) out.set('store', q.store)
  if (q.type) out.set('type', q.type)
  if (q.status) out.set('status', q.status)
  if (q.from) out.set('from', q.from)
  if (q.to) out.set('to', q.to)
  if (q.take !== PUSHES_STEP) out.set('take', String(q.take))
  return out
}

/** What `GET HybrisStockWeb/Pushes` is sent: no `skip` (the door has none), `any` left off. */
export function pushesDoorParams(q: HybrisStockPushesQuery) {
  return { store: q.store, type: q.type, status: q.status, from: q.from, to: q.to, take: q.take }
}

/** The next `take` for Show more, or `null` at the door's limit. */
export function moreTake(take: number): number | null {
  return take >= PUSHES_MAX ? null : Math.min(take + PUSHES_STEP, PUSHES_MAX)
}

/** A page that came back full may have more behind it; a short one is the whole match. */
export const mayHoldMore = (rows: number, take: number): boolean => rows >= take

/** The drawer the URL opens: a push's lines (`?push=`), or a material's history at a store (`?history=<store>&material=`). */
export type Drawer = { kind: 'lines'; pushId: string } | { kind: 'material'; storeCode: string; materialNumber: string | null } | null

export function drawerFromParams(params: URLSearchParams): Drawer {
  const push = params.get('push')
  if (push) return { kind: 'lines', pushId: push }
  const store = params.get('history')
  if (store) return { kind: 'material', storeCode: store, materialNumber: params.get('material') || null }
  return null
}

/** `params` with the drawer swapped; the filters untouched. */
export function withDrawer(params: URLSearchParams, drawer: Drawer): URLSearchParams {
  const out = new URLSearchParams(params)
  for (const k of ['push', 'history', 'material']) out.delete(k)
  if (drawer?.kind === 'lines') out.set('push', drawer.pushId)
  if (drawer?.kind === 'material') {
    out.set('history', drawer.storeCode)
    if (drawer.materialNumber) out.set('material', drawer.materialNumber)
  }
  return out
}
