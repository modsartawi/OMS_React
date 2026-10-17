import type { RuleSessionBudgetEvent, RuleSessionCall, RuleSessionLookup, RuleSessionMovement } from '@/core/models/rule-session'

// A customer session's Events tab (ticket 527): HQ answers the calls, the budget journal and the
// budget events as separate lists (`Rules/Support/Session`); the tab reads them as ONE story, oldest
// first, by local time. Refusals carry no time: each call shows its own reply's. Pure: no React, no
// i18n.

export type TimelineEntry = { key: string; at: string } & (
  | { kind: 'call'; call: RuleSessionCall }
  | { kind: 'movement'; move: RuleSessionMovement }
  | { kind: 'budgetEvent'; event: RuleSessionBudgetEvent }
)

export type TimelineKind = TimelineEntry['kind']

/** At one moment: the call, then the journal lines it caused, then the events on the counters. */
const KIND_ORDER: readonly TimelineKind[] = ['call', 'movement', 'budgetEvent']

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

const LOCAL = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/

/** Sorts after every moment that reads. */
const UNREAD = '￿'

/** .NET's `DateTime.MinValue`: a stamp HQ never set. */
const NEVER = '0001-01-01'

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

/** A moment shown to the second, local: `2026-10-16 10:05:07`. What does not read shows as it came;
 *  nothing, or a stamp never set (`0001-01-01`), shows as nothing. */
export function momentText(at: string | null | undefined): string {
  if (!at) return ''
  const key = localMomentKey(at)
  if (key === UNREAD) return at
  return key.startsWith(NEVER) ? '' : `${key.slice(0, 10)} ${key.slice(11, 19)}`
}

/** The local day a moment falls on (`yyyy-MM-dd`), or '' when it does not read or was never set. */
export function momentDay(at: string | null | undefined): string {
  if (!at) return ''
  const key = localMomentKey(at)
  return key === UNREAD || key.startsWith(NEVER) ? '' : key.slice(0, 10)
}

/** Every call, journal line and budget event of the session, oldest first by local time. */
export function sessionTimeline(s: Pick<RuleSessionLookup, 'calls' | 'movements' | 'budgetEvents'>): TimelineEntry[] {
  // A request id names one call; should HQ ever list one twice, the repeat is keyed by its index
  // in a namespace of its own, which no request id can reach.
  const seen = new Set<string>()
  const callKey = (call: RuleSessionCall, i: number) => {
    const key = seen.has(call.requestId) ? `repeat-${i}` : `call-${call.requestId}`
    seen.add(call.requestId)
    return key
  }
  const entries: TimelineEntry[] = [
    ...(s.calls ?? []).map((call, i): TimelineEntry => ({ key: callKey(call, i), at: call.at, kind: 'call', call })),
    ...(s.movements ?? []).map((move): TimelineEntry => ({ key: `movement-${move.movementId}`, at: move.at, kind: 'movement', move })),
    ...(s.budgetEvents ?? []).map((event): TimelineEntry => ({ key: `budgetEvent-${event.eventId}`, at: event.at, kind: 'budgetEvent', event })),
  ]
  const keyed = entries.map((e, i) => ({ e, i, t: localMomentKey(e.at ?? ''), k: KIND_ORDER.indexOf(e.kind) }))
  // Equal moment and kind keep HQ's order: the index breaks the last tie.
  keyed.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.k - b.k || a.i - b.i))
  return keyed.map((x) => x.e)
}
