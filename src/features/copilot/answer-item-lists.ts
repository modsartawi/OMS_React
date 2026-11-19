import { itemListHref } from '@/core/analytics-routes'
import type { AnalyticsLabel } from '@/core/models/analytics'
import type {
  CopilotListPeriods,
  CopilotListPeriodSegment,
  CopilotListPeriodsMember,
  CopilotListPeriodsOverlap,
  CopilotListStatus,
  CopilotUsedList,
} from '@/core/models/copilot'
import { saysIn } from '@/core/rules/sentence'
import { formatRange } from '@/core/util/bidi'

/**
 * oms-react 926 (BackOffice spec 4057, tickets 4060/4061) — pure. An answer that used an item list: the server's "Used"
 * line with a link to the list, and the `list_periods` analysis drawn as a table with a per-status total and its
 * calendar warnings.
 *
 * `itemLists` is BO 4061's real wire (t4061 f374504d9): each entry points at its "Used:" line in `assumptions`. The
 * `listPeriods` part is a PROPOSAL BO never sent (4060 keeps the result to the model), so it is drawn only if a later BO
 * ticket adds it. Every read is in this file, tolerant: a malformed part reads as none.
 *
 * The copilot links the list by route string (`@/core/analytics-routes`), never by importing the item-lists feature.
 */

const text = (v: unknown): string => (typeof v === 'string' ? v : '')
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)
const label = (v: unknown): AnalyticsLabel => {
  const o = obj(v) ?? {}
  return { en: text(o.en), ar: text(o.ar) }
}
const idOf = (v: unknown): string => (typeof v === 'number' && Number.isFinite(v) ? String(v) : text(v)).trim()

/** The statuses, in the order a table's columns take (spec 4057 default 3). */
export const LIST_STATUSES: readonly CopilotListStatus[] = ['unavailable', 'blocked', 'delisted', 'limited', 'available']
const isStatus = (v: unknown): v is CopilotListStatus => typeof v === 'string' && (LIST_STATUSES as readonly string[]).includes(v)

// ── The "Used" line (BO 4061) ────────────────────────────────────────────────────────────────────────────────

/**
 * The `itemLists` entries kept, each with its "Used:" line read from `assumptions` (as sent) at its `line`, and the
 * indices of those lines, which the plain assumption lines then leave out (the line is drawn once, linked). An entry
 * with no id, or whose `line` is not an assumption with words, is left out — and that line stays a plain line.
 */
export function usedListsOf(raw: unknown, assumptions: unknown): { usedLists: CopilotUsedList[]; lines: Set<number> } {
  const lines = new Set<number>()
  const sent = Array.isArray(assumptions) ? assumptions : []
  if (!Array.isArray(raw)) return { usedLists: [], lines }
  const usedLists = raw.flatMap((v): CopilotUsedList[] => {
    const o = obj(v)
    if (!o) return []
    const listId = idOf(o.id)
    const at = o.line
    if (!listId || typeof at !== 'number' || !Number.isInteger(at) || at < 0 || at >= sent.length) return []
    const line = label(sent[at])
    if (!line.en.trim() && !line.ar.trim()) return []
    lines.add(at)
    return [{ listId, name: text(o.name), version: num(o.version) ?? 0, itemsAndGroups: num(o.itemsAndGroups) ?? 0, line }]
  })
  return { usedLists, lines }
}

export interface UsedListRow {
  listId: string
  /** The server's line, as sent, in the line's language (the other when it is missing). */
  text: string
  /** The list's page. */
  href: string
}

export function usedListRows(model: { usedLists: readonly CopilotUsedList[] }, lang: string): UsedListRow[] {
  return model.usedLists.map((u) => ({ listId: u.listId, text: saysIn(u.line, lang), href: itemListHref(u.listId) }))
}

// ── list_periods (BO 4060) ──────────────────────────────────────────────────────────────────────────────────

function segmentsOf(raw: unknown): CopilotListPeriodSegment[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((v): CopilotListPeriodSegment[] => {
    const o = obj(v)
    const perDay = num(o?.perDay)
    return o && isStatus(o.status) && perDay !== null ? [{ status: o.status, days: num(o.days) ?? 0, perDay }] : []
  })
}

function memberOf(v: unknown): CopilotListPeriodsMember[] {
  const o = obj(v)
  if (!o) return []
  const key = idOf(o.key)
  const lbl = text(o.label) || key
  if (!lbl) return []
  return [{ level: text(o.level), key, label: lbl, noPeriods: o.noPeriods === true, segments: segmentsOf(o.segments), change: num(o.change) }]
}

function overlapOf(v: unknown): CopilotListPeriodsOverlap[] {
  const o = obj(v)
  if (!o || !isStatus(o.status) || !text(o.from)) return []
  return [
    {
      member: text(o.member) || null,
      status: o.status,
      from: text(o.from),
      to: text(o.to) || null,
      event: label(o.event),
      eventFrom: text(o.eventFrom),
      eventTo: text(o.eventTo),
    },
  ]
}

/** The `listPeriods` part, or `null` when the answer has none (or it is not readable: no members list). */
export function listPeriodsOf(raw: unknown): CopilotListPeriods | null {
  const o = obj(raw)
  if (!o || !Array.isArray(o.members)) return null
  return {
    step: num(o.step) ?? 0,
    listId: idOf(o.listId),
    measure: o.measure === 'value' ? 'value' : 'units',
    members: o.members.flatMap(memberOf),
    totals: segmentsOf(o.totals),
    overlaps: Array.isArray(o.overlaps) ? o.overlaps.flatMap(overlapOf) : [],
  }
}

export interface ListPeriodsRow {
  /** `level:key`, unique among the members. */
  key: string
  member: string
  level: string
  noPeriods: boolean
  /** The per-day figure under each of the table's `statuses`; `null` where the member had no such period. */
  perDay: (number | null)[]
  change: number | null
}

export interface ListPeriodsTable {
  /** The columns: the statuses any member or the total has, in {@link LIST_STATUSES}' order. */
  statuses: CopilotListStatus[]
  rows: ListPeriodsRow[]
  /** The server's per-status total, under the same columns. */
  totals: (number | null)[]
}

/** The comparison as a table: the server's figures, placed — nothing is computed here. */
export function listPeriodsTable(lp: CopilotListPeriods): ListPeriodsTable {
  const present = new Set<CopilotListStatus>([...lp.totals, ...lp.members.flatMap((m) => m.segments)].map((s) => s.status))
  const statuses = LIST_STATUSES.filter((s) => present.has(s))
  const under = (segments: readonly CopilotListPeriodSegment[]) => statuses.map((s) => segments.find((x) => x.status === s)?.perDay ?? null)
  return {
    statuses,
    rows: lp.members.map((m) => ({ key: `${m.level}:${m.key}`, member: m.label, level: m.level, noPeriods: m.noPeriods, perDay: under(m.segments), change: m.change })),
    totals: under(lp.totals),
  }
}

/** A change (a fraction: 0.18) as a signed percent with one decimal ("+18.0%"); blank when there is none. */
export function formatChange(change: number | null | undefined): string {
  if (change === null || change === undefined || !Number.isFinite(change)) return ''
  const pct = (change * 100).toFixed(1)
  return change > 0 ? `+${pct}%` : Number(pct) === 0 ? '0.0%' : `${pct}%`
}

// ── The calendar warning (BO 4060, spec 3587 B48's calendar check) ─────────────────────────────────────────────

export interface CalendarWarning {
  /** The member's label, or `null` for the total's. */
  member: string | null
  status: CopilotListStatus
  /** The period, one string (`formatRange`); an open one is its first day alone, with `open`. */
  period: string
  open: boolean
  /** The event's name in the line's language. */
  event: string
  eventPeriod: string
}

export function calendarWarnings(lp: CopilotListPeriods, lang: string): CalendarWarning[] {
  return lp.overlaps.map((o) => ({
    member: o.member,
    status: o.status,
    period: o.to ? formatRange(o.from, o.to) : o.from,
    open: !o.to,
    event: saysIn(o.event, lang),
    eventPeriod: formatRange(o.eventFrom, o.eventTo),
  }))
}
