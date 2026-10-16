import type { RuleSessionListQuery, RuleSessionStatus } from '@/core/models/rule-campaign'
import type { Severity } from '@/core/ui/severity'

// Campaigns ▸ Sessions' URL and its statuses (ticket 518). The list's filter lives in the address
// (`?store=&date=&status=`, replaced), so Back from a session lands on the list as it was left.
// Pure: no React, no i18n.

/** Every status, in a session's life order (spec 2737 "Session states"). */
export const SESSION_STATUSES: readonly RuleSessionStatus[] = ['open', 'paying', 'closed', 'partiallyReturned', 'returned', 'cancelled']

export const SESSION_STATUS_SEV: Record<RuleSessionStatus, Severity> = {
  open: 'go',
  paying: 'go',
  closed: 'ok',
  partiallyReturned: 'warn',
  returned: 'mute',
  cancelled: 'bad',
}

/** The list's filter as the address holds it: '' = not chosen, null status = every status. */
export type SessionsQuery = RuleSessionListQuery

const DAY = /^\d{4}-\d{2}-\d{2}$/

export function sessionsQueryFromParams(params: URLSearchParams): SessionsQuery {
  const status = params.get('status')
  const date = params.get('date') ?? ''
  return {
    store: (params.get('store') ?? '').trim(),
    date: DAY.test(date) ? date : '',
    status: SESSION_STATUSES.includes(status as RuleSessionStatus) ? (status as RuleSessionStatus) : null,
  }
}

export function sessionsQueryToParams(q: SessionsQuery): URLSearchParams {
  const out = new URLSearchParams()
  if (q.store) out.set('store', q.store)
  if (q.date) out.set('date', q.date)
  if (q.status) out.set('status', q.status)
  return out
}

/** What the list door is asked: the chosen day, or `today` (local) when none is chosen. */
export function listQuery(q: SessionsQuery, today: string): RuleSessionListQuery {
  return { store: q.store, date: q.date || today, status: q.status }
}

/**
 * Whether Cancel session is offered: not on a session already cancelled, nor on one wholly
 * returned (nothing is left to roll back). HQ still refuses what it will not cancel.
 */
export function canCancelSession(status: RuleSessionStatus): boolean {
  return status !== 'cancelled' && status !== 'returned'
}

export const sessionPath = (saleId: string) => `/campaigns/sessions/${encodeURIComponent(saleId)}`

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
