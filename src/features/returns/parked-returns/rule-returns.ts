/**
 * Parked rule returns' pure half (BackOffice ticket 4226, spec 4212 stories 31-33; doors BackOffice 4221
 * `GET Rules/ParkedRuleReturns` and 4222 `POST Rules/ParkedRuleReturns/{id}/Unpark`). No React, no `t`: the state label a
 * row wears, whether Un-park is offered, and a refusal's sentence key — every key in the `parked-returns` namespace.
 *
 * A **parked rule return** is a return whose rule-driven partner leg (`PosRuleReturnQueue`) the till gave up on and
 * parked. The till mirrors it to HQ as `PARKED`, `UNPARKED` (an HQ un-park applied) or `SENT`.
 */
import { apiErrorCode, isBareDenial } from '@/core/api'
import type { ParkedRuleReturnRow, ParkedRuleReturnsPage, ParkedRuleReturnsQuery } from '@/core/models/parked-returns'
import type { Permissions } from '@/core/permissions'
import type { Severity } from '@/core/ui/severity'
import { canSettleParkedReturns } from './access'

export interface Label {
  key: string
  sev: Severity
}

/** What the labels read off a row. */
export interface RuleReturnStateFields {
  state: string
  unparkRequestId: string
  appliedUnparkId: string
}

const has = (v: string) => v.trim() !== ''

/** HQ asked to un-park and the till has not applied that request yet (BackOffice 4221 / 4222). */
export const unparkPending = (row: Pick<RuleReturnStateFields, 'unparkRequestId' | 'appliedUnparkId'>): boolean =>
  has(row.unparkRequestId) && row.unparkRequestId !== row.appliedUnparkId

/**
 * The row's label: sent (the till finally sent it), applied (the till applied an un-park and mirrored `UNPARKED`), and for
 * a `PARKED` row — un-park requested while a request waits for the till, parked again once an applied un-park parked
 * once more, else parked. A state the screen does not know reads "unknown", never the raw code.
 */
export function ruleReturnLabel(row: RuleReturnStateFields): Label {
  switch (row.state) {
    case 'SENT':
      return { key: 'rule.state.sent', sev: 'ok' }
    case 'UNPARKED':
      return { key: 'rule.state.applied', sev: 'go' }
    case 'PARKED':
      if (unparkPending(row)) return { key: 'rule.state.unparkRequested', sev: 'go' }
      if (has(row.appliedUnparkId)) return { key: 'rule.state.parkedAgain', sev: 'warn' }
      return { key: 'rule.state.parked', sev: 'warn' }
    default:
      return { key: 'rule.state.unknown', sev: 'mute' }
  }
}

/**
 * Un-park is offered only with the settle right (`ParkedReturns:06`, story 33), on a `PARKED` row with no request still
 * waiting for the till. A row parked again after an applied un-park can be un-parked again (BackOffice 4222).
 */
export const canUnpark = (row: RuleReturnStateFields, p: Permissions): boolean =>
  canSettleParkedReturns(p) && row.state === 'PARKED' && !unparkPending(row)

/** `ParkedRuleReturnErrorCodes` (BackOffice 4222). `_UNPARK_PENDING` is also the loser of a race. */
export const UNPARK_REFUSAL_CODES = [
  'PARKED_RULE_RETURN_NOT_FOUND',
  'PARKED_RULE_RETURN_NOT_PARKED',
  'PARKED_RULE_RETURN_UNPARK_PENDING',
  'PARKED_RULE_RETURN_NO_REQUESTER',
] as const

/**
 * An un-park refusal as a sentence key (`rule.refusal.<code>`), or `rule.refusal.noSettleRight` for a bare 403 (the grant
 * filter, before any handler). `null` for anything else: the caller shows the server's own message then.
 */
export function unparkRefusalKey(err: unknown): string | null {
  if (isBareDenial(err)) return 'rule.refusal.noSettleRight'
  const code = apiErrorCode(err)
  return code && (UNPARK_REFUSAL_CODES as readonly string[]).includes(code) ? `rule.refusal.${code}` : null
}

/** Every label key the screen can show (for the locale test). */
export const RULE_STATE_KEYS = ['parked', 'unparkRequested', 'applied', 'sent', 'parkedAgain', 'unknown'].map((s) => `rule.state.${s}`)

/** Rows a page (the door's default). */
export const RULE_PAGE_SIZE = 50

/** The list's filters, kept in the address: `?store=&sent=1&page=`. */
export interface RuleFilters {
  store: string
  /** Also list the rows the till finally sent (the door's `includeSent`, off by default). */
  includeSent: boolean
  /** 1-based. */
  page: number
}

export const NO_RULE_FILTERS: RuleFilters = Object.freeze({ store: '', includeSent: false, page: 1 })

export function ruleFiltersFromParams(params: URLSearchParams): RuleFilters {
  const page = Number(params.get('page') ?? '')
  return {
    store: (params.get('store') ?? '').trim(),
    includeSent: params.get('sent') === '1',
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  }
}

export function ruleFiltersToParams(f: RuleFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.store) p.set('store', f.store)
  if (f.includeSent) p.set('sent', '1')
  if (f.page > 1) p.set('page', String(f.page))
  return p
}

/** The door's query. A blank store is dropped by `@/core/api`'s `buildQuery`. */
export const ruleListQuery = (f: RuleFilters): ParkedRuleReturnsQuery => ({
  store: f.store,
  includeSent: f.includeSent,
  page: f.page,
  pageSize: RULE_PAGE_SIZE,
})

type Raw = Record<string, unknown>
const isRaw = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** One row, rebuilt from the agreed fields only (nothing is spread from the wire). */
export const readRuleReturnRow = (r: Raw): ParkedRuleReturnRow => ({
  id: str(r.id),
  storeCode: str(r.storeCode),
  registerId: str(r.registerId),
  transactionId: str(r.transactionId),
  originalTransactionId: str(r.originalTransactionId),
  errorCode: str(r.errorCode),
  errorMessage: str(r.errorMessage),
  attemptsCount: num(r.attemptsCount),
  parkedAt: str(r.parkedAt),
  state: str(r.state),
  lastEventAt: str(r.lastEventAt),
  appliedUnparkId: str(r.appliedUnparkId),
  unparkRequestId: str(r.unparkRequestId),
  unparkRequestedBy: str(r.unparkRequestedBy),
  unparkRequestedTime: str(r.unparkRequestedTime),
})

/** `{ total, page, pageSize, rows }`, oldest first (the server's order). */
export function readRuleReturnsPage(raw: unknown): ParkedRuleReturnsPage {
  if (!isRaw(raw)) return { total: 0, rows: [] }
  return { total: num(raw.total), rows: Array.isArray(raw.rows) ? raw.rows.filter(isRaw).map(readRuleReturnRow) : [] }
}
