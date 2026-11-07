import type { HybrisStockPushStatus, HybrisStockPushType, HybrisStockPushesQuery } from '@/core/models/hybris-stock'
import { PUSH_STATUSES, PUSH_TYPES } from './push-labels'

// The push log's URL ⇄ query ⇄ door mapping (ticket 849), and the drawers' URL keys. Pure.

export const PUSHES_PAGE_SIZE = 50
export const LINES_PAGE_SIZE = 200

/** A `yyyy-MM-dd` date, as the date inputs and the door read it. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** `?store=&type=&status=&from=&to=&page=` — a value the door does not know is dropped. */
export function pushesFromParams(params: URLSearchParams): HybrisStockPushesQuery {
  const type = params.get('type')
  const status = params.get('status')
  const from = params.get('from')
  const to = params.get('to')
  const page = Number(params.get('page'))
  return {
    store: params.get('store')?.trim() || null,
    type: PUSH_TYPES.includes(type as HybrisStockPushType) ? (type as HybrisStockPushType) : null,
    status: PUSH_STATUSES.includes(status as HybrisStockPushStatus) ? (status as HybrisStockPushStatus) : null,
    from: from && ISO_DATE.test(from) ? from : null,
    to: to && ISO_DATE.test(to) ? to : null,
    page: Number.isInteger(page) && page > 1 ? page : 1,
  }
}

/** The filters back to the URL (the drawers' keys are the page's, kept by `withDrawer`). */
export function pushesToParams(q: HybrisStockPushesQuery): URLSearchParams {
  const out = new URLSearchParams()
  if (q.store) out.set('store', q.store)
  if (q.type) out.set('type', q.type)
  if (q.status) out.set('status', q.status)
  if (q.from) out.set('from', q.from)
  if (q.to) out.set('to', q.to)
  if (q.page > 1) out.set('page', String(q.page))
  return out
}

export function pushesDoorParams(q: HybrisStockPushesQuery) {
  return { store: q.store, type: q.type, status: q.status, from: q.from, to: q.to, skip: (q.page - 1) * PUSHES_PAGE_SIZE, take: PUSHES_PAGE_SIZE }
}

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
