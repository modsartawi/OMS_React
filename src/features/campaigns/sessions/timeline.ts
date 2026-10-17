import type { RuleSession, RuleSessionBudgetMove, RuleSessionCall, RuleSessionJournalMove, RuleSessionRefusal } from '@/core/models/rule-campaign'

// A customer session's Events tab (ticket 518): HQ answers the calls, the holds, the budget and
// journal movements and the refusals as separate lists; the tab reads them as ONE story, oldest
// first, by local time. Pure: no React, no i18n.

export type TimelineEntry = { key: string; at: string } & (
  | { kind: 'call'; call: RuleSessionCall }
  | { kind: 'refusal'; refusal: RuleSessionRefusal }
  | { kind: 'hold'; move: RuleSessionBudgetMove }
  | { kind: 'budget'; move: RuleSessionBudgetMove }
  | { kind: 'journal'; move: RuleSessionJournalMove }
)

export type TimelineKind = TimelineEntry['kind']

/** At one moment: the call, then its refusal, then the movements it caused. */
const KIND_ORDER: readonly TimelineKind[] = ['call', 'refusal', 'hold', 'budget', 'journal']

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

const LOCAL = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/

/** Sorts after every moment that reads. */
const UNREAD = '￿'

/**
 * A moment as a key that sorts as time: `yyyy-MM-ddTHH:mm:ss.fff`, local. A local moment is read
 * as written — no `Date`, so no time zone can move it. One that carries a `Z` or an offset (never
 * expected on this wire) is read in the reader's local time, so it still falls in its place. One
 * that does not read at all sorts last.
 */
export function localMomentKey(at: string): string {
  const m = LOCAL.exec(at.trim())
  if (m) return `${m[1]}T${m[2]}:${m[3]}:${m[4] ?? '00'}.${(m[5] ?? '').slice(0, 3).padEnd(3, '0')}`
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(at.trim())) return UNREAD
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return UNREAD
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

/** A moment shown to the second, local: `2026-10-16 10:05:07`. What does not read shows as it came. */
export function momentText(at: string | null | undefined): string {
  if (!at) return ''
  const key = localMomentKey(at)
  return key === UNREAD ? at : `${key.slice(0, 10)} ${key.slice(11, 19)}`
}

/** The local day a moment falls on (`yyyy-MM-dd`), or '' when it does not read. */
export function momentDay(at: string | null | undefined): string {
  if (!at) return ''
  const key = localMomentKey(at)
  return key === UNREAD ? '' : key.slice(0, 10)
}

/** Every call and movement of the session, oldest first by local time. */
export function sessionTimeline(s: Pick<RuleSession, 'calls' | 'holds' | 'budgets' | 'journal' | 'refusals'>): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...(s.calls ?? []).map((call, i): TimelineEntry => ({ key: `call-${i}`, at: call.at, kind: 'call', call })),
    ...(s.refusals ?? []).map((refusal, i): TimelineEntry => ({ key: `refusal-${i}`, at: refusal.at, kind: 'refusal', refusal })),
    ...(s.holds ?? []).map((move, i): TimelineEntry => ({ key: `hold-${i}`, at: move.at, kind: 'hold', move })),
    ...(s.budgets ?? []).map((move, i): TimelineEntry => ({ key: `budget-${i}`, at: move.at, kind: 'budget', move })),
    ...(s.journal ?? []).map((move, i): TimelineEntry => ({ key: `journal-${i}`, at: move.at, kind: 'journal', move })),
  ]
  const keyed = entries.map((e, i) => ({ e, i, t: localMomentKey(e.at ?? ''), k: KIND_ORDER.indexOf(e.kind) }))
  // Equal moment and kind keep HQ's order: the index breaks the last tie.
  keyed.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.k - b.k || a.i - b.i))
  return keyed.map((x) => x.e)
}
