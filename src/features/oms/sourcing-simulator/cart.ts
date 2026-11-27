/**
 * The cart the simulator builds, and the request it sends on Run (ticket 962, BackOffice 4281 decisions 10–11: the
 * cart form, `level: "full"` and `allPlans`). Pure.
 */
import type { AdviseCartRequest } from '@/core/models/sourcing-run'
import { toIsoDate } from '@/core/util/date-format'

/**
 * The channels the picker offers (the order source codes the order door takes).
 * PROVISIONAL (spec 4354: not specified) — 4281 names `IOS`, `ROID`, `WEB` and "a call-centre source" without its code;
 * `CALL_CENTRE` is ours.
 */
export const SIMULATOR_CHANNELS = ['IOS', 'ROID', 'WEB', 'CALL_CENTRE'] as const

/**
 * The unit every hand-built line is sent in.
 * PROVISIONAL (spec 4354: not specified) — the simulator's unit picker is not specified; every line goes as each.
 */
export const LINE_UNIT = 'EA'

/** The decimals a placed point is kept to (4281's example: four, about eleven metres). */
const POINT_DECIMALS = 4

export interface CartLineDraft {
  /** The editor's own key for the row, never sent. */
  key: number
  item: string
  quantity: string
}

export interface CartForm {
  channel: string
  /** `HH:mm`, local, planned on the day the request is built (review 4354 #6); empty plans for now. */
  time: string
  /** Riyals as typed; empty sends none. */
  goodsTotal: string
  lines: CartLineDraft[]
  lat: string
  lng: string
}

export type CartProblem = 'noLines' | 'badLine' | 'noPoint' | 'badPoint' | 'badTotal'

/** A placed point, rounded to the decimals the form keeps. */
export const pointText = (n: number) => n.toFixed(POINT_DECIMALS)

const number = (s: string): number | null => {
  const t = s.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : NaN
}

/** What stops the cart from running, first problem first; null when it can run. */
export function cartProblem(form: CartForm): CartProblem | null {
  // A line with no item is an empty row of the editor, not a line of the cart.
  const filled = form.lines.filter((l) => l.item.trim() !== '')
  if (filled.length === 0) return 'noLines'
  if (filled.some((l) => !/^\d+$/.test(l.quantity.trim()) || Number(l.quantity) <= 0)) return 'badLine'
  const lat = number(form.lat)
  const lng = number(form.lng)
  if (lat === null && lng === null) return 'noPoint'
  if (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return 'badPoint'
  const total = number(form.goodsTotal)
  if (total !== null && (Number.isNaN(total) || total < 0)) return 'badTotal'
  return null
}

/**
 * The request Run sends, or null while the cart cannot run (`cartProblem` says why). A time of day is planned on the day
 * of `now` — read when the request is built, never kept in the form, so a page left open past midnight plans on the new
 * day (review 4354 #6).
 */
export function adviseRequest(form: CartForm, now: Date = new Date()): AdviseCartRequest | null {
  if (cartProblem(form)) return null
  const lines = form.lines
    .filter((l) => l.item.trim() !== '')
    .map((l, i) => ({ lineNo: i + 1, item: l.item.trim(), quantity: Number(l.quantity), unit: LINE_UNIT }))
  const total = number(form.goodsTotal)
  return {
    channel: form.channel,
    lines,
    customer: { point: { lat: Number(form.lat), lng: Number(form.lng) } },
    ...(total !== null ? { goodsTotal: total } : {}),
    ...(form.time ? { plannedFor: `${toIsoDate(now)} ${form.time}:00` } : {}),
    level: 'full',
    allPlans: true,
  }
}
