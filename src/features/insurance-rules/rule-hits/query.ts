import { fromIsoDate } from '@/core/util/date-format'
import { localToday, windowProblem, type LocalDate, type WindowProblem } from '@/core/util/date-window'

// The Rule hits page's address (BackOffice spec 3972, ticket 3981): `?from&to&rule&payer&store&kind=live|shadow`.
// The window is LOCAL days, both ends counted — last calendar month unless the address says otherwise (door 3980's
// own default). Pure; the page reads it through `useUrlQuery(ruleHitsFromParams, ruleHitsToParams)`.

export const RULE_HIT_KINDS = ['live', 'shadow'] as const
export type RuleHitKind = (typeof RULE_HIT_KINDS)[number]

export interface RuleHitsQuery {
  from: LocalDate
  to: LocalDate
  /** Exact rule id (`BR-3.3`); '' = every rule. */
  rule: string
  /** Exact payer as the check sent it; '' = every payer. */
  payer: string
  /** Exact store code; '' = every store. */
  store: string
  kind: RuleHitKind
}

/** The longest window the door answers (3980: at most 93 days). */
export const MAX_WINDOW_DAYS = 93

const two = (n: number) => String(n).padStart(2, '0')

/** The calendar month before `today`'s: its first and last day. */
export function lastMonth(today: LocalDate): { from: LocalDate; to: LocalDate } {
  const d = fromIsoDate(today) ?? new Date()
  const first = new Date(d.getFullYear(), d.getMonth() - 1, 1, 12)
  const last = new Date(d.getFullYear(), d.getMonth(), 0, 12)
  const iso = (x: Date) => `${x.getFullYear()}-${two(x.getMonth() + 1)}-${two(x.getDate())}`
  return { from: iso(first), to: iso(last) }
}

function defaults(today: LocalDate): RuleHitsQuery {
  return { ...lastMonth(today), rule: '', payer: '', store: '', kind: 'live' }
}

export function readRuleHitsQuery(params: URLSearchParams, today: LocalDate): RuleHitsQuery {
  const d = defaults(today)
  const kind = params.get('kind')
  return {
    from: params.get('from') || d.from,
    to: params.get('to') || d.to,
    rule: params.get('rule')?.trim() ?? '',
    payer: params.get('payer')?.trim() ?? '',
    store: params.get('store')?.trim() ?? '',
    kind: RULE_HIT_KINDS.includes(kind as RuleHitKind) ? (kind as RuleHitKind) : d.kind,
  }
}

const FIELDS = ['from', 'to', 'rule', 'payer', 'store', 'kind'] as const

export function writeRuleHitsQuery(q: RuleHitsQuery, today: LocalDate): URLSearchParams {
  const d = defaults(today)
  const out = new URLSearchParams()
  for (const k of FIELDS) if (q[k] && q[k] !== d[k]) out.set(k, q[k])
  return out
}

/** Stable, module-level readers for `useUrlQuery`. */
export const ruleHitsFromParams = (p: URLSearchParams) => readRuleHitsQuery(p, localToday())
export const ruleHitsToParams = (q: RuleHitsQuery) => writeRuleHitsQuery(q, localToday())

/** Why the window may not be read, or null when it may. */
export function windowOf(q: Pick<RuleHitsQuery, 'from' | 'to'>): WindowProblem | null {
  return windowProblem(q.from, q.to, { maxDays: MAX_WINDOW_DAYS })
}

/** The door's params (rows and Excel alike): the window and kind always, a filter only when set. */
export function ruleHitsParams(q: RuleHitsQuery): Record<string, string> {
  const out: Record<string, string> = { from: q.from, to: q.to, kind: q.kind }
  for (const k of ['rule', 'payer', 'store'] as const) if (q[k]) out[k] = q[k]
  return out
}
