import { RULE_SESSION_STATES, type RuleSessionListQuery, type RuleSessionState } from '@/core/models/rule-session'
import type { Severity } from '@/core/ui/severity'

// Campaigns ▸ Sessions' URL and its states (tickets 518, 527). The list's filter lives in the
// address (`?store=&date=&status=`, replaced), so Back from a session lands on the list as it was
// left; `listQuery` turns it into what `Rules/Support/Sessions` is asked. Pure: no React, no i18n.

export const SESSION_STATUS_SEV: Record<RuleSessionState, Severity> = {
  open: 'go',
  paying: 'go',
  closed: 'ok',
  partiallyReturned: 'warn',
  returned: 'mute',
  cancelled: 'bad',
}

/** The list's filter as the address holds it: '' = not chosen, null status = every state. */
export interface SessionsQuery {
  store: string
  /** One local day, `yyyy-MM-dd`. */
  date: string
  status: RuleSessionState | null
}

/** The most sessions one list asks for (HQ's own cap; its default is 100). */
export const SESSIONS_TAKE = 500

const DAY = /^\d{4}-\d{2}-\d{2}$/

export function sessionsQueryFromParams(params: URLSearchParams): SessionsQuery {
  const status = params.get('status')
  const date = params.get('date') ?? ''
  return {
    store: (params.get('store') ?? '').trim(),
    date: DAY.test(date) ? date : '',
    status: RULE_SESSION_STATES.includes(status as RuleSessionState) ? (status as RuleSessionState) : null,
  }
}

export function sessionsQueryToParams(q: SessionsQuery): URLSearchParams {
  const out = new URLSearchParams()
  if (q.store) out.set('store', q.store)
  if (q.date) out.set('date', q.date)
  if (q.status) out.set('status', q.status)
  return out
}

/**
 * What the list door is asked: the store, the chosen day — or `today` (local) when none is chosen —
 * sent as `from` alone (HQ reads one end as one day), the state when one is chosen, and the cap.
 */
export function listQuery(q: SessionsQuery, today: string): RuleSessionListQuery {
  const asked: RuleSessionListQuery = { storeCode: q.store, from: q.date || today, take: SESSIONS_TAKE }
  if (q.status) asked.state = q.status
  return asked
}

/**
 * Whether Cancel session is offered: on a paying session (its holds are released) and on a closed
 * or partly returned one (a full return of every unit still out). Never on an open one — it never
 * paid, so it holds nothing (`RULES_SESSION_OPEN`) — nor one cancelled or wholly returned. HQ still
 * refuses what it will not cancel.
 */
export function canCancelSession(state: RuleSessionState): boolean {
  return state === 'paying' || state === 'closed' || state === 'partiallyReturned'
}

export function sessionsPath(q?: SessionsQuery): string {
  const qs = q ? sessionsQueryToParams(q).toString() : ''
  return qs ? `/campaigns/sessions?${qs}` : '/campaigns/sessions'
}

/** What the list hands a session it opens: its own address, so Back lands on the list as it was left. */
export interface FromList {
  fromList: string
}

/** The list a session's Back goes to: the one it was opened from, else its store and its day. */
export function backPath(state: unknown, fallback: SessionsQuery | null): string {
  const from = (state as Partial<FromList> | null)?.fromList
  if (typeof from === 'string' && from.startsWith('/campaigns/sessions')) return from
  return sessionsPath(fallback ?? undefined)
}
