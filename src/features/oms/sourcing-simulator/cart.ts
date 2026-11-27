/**
 * The cart the simulator builds, and the request it sends on Run (ticket 962, BackOffice 4281 decisions 10–11: the
 * cart form, `level: "full"` and `allPlans`). Pure.
 */
import type { DocumentSourceModel } from '@/core/models/lookups'
import type { AdviseCartRequest } from '@/core/models/sourcing-run'
import { toIsoDate } from '@/core/util/date-format'

/**
 * The channels the advisor serves (BackOffice 4381, `AdvisorChannels`): the app (`IOS`, `ROID`), the site (`WEB`) and
 * the call centre — any order source of category `C`, as the store record counts it. The request's `channel` is that
 * order source code; any other is refused (`ADVISE-421`).
 */
export const SIMULATOR_CHANNELS = ['IOS', 'ROID', 'WEB'] as const

/** The picker's channels: the app and the site, then the call centre's own order sources, read off the source list. */
export const simulatorChannels = (sources: readonly DocumentSourceModel[] | undefined): string[] => [
  ...SIMULATOR_CHANNELS,
  ...(sources ?? []).filter((s) => s.documentSourceCategory?.trim().toUpperCase() === 'C').map((s) => s.documentSource.trim()),
]

/**
 * The unit every hand-built line is sent in. The door converts a line to the stock read's unit through the item's units
 * of measure, and refuses a unit the item does not have (`ADVISE-400` on `lines[i].unit`). SERVER GAP (spec 4354): no
 * door lists an item's units, so the simulator has no unit picker and every line goes as each.
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
