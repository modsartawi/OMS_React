/**
 * The payer-month screen's server calls (oms 896; BackOffice 1628, 1639, 1644). Every one goes through
 * `@/core/api` (`.claude/rules/api-envelope.md`): the cookie session and the `X-Web-Client` CSRF header are that
 * module's, and so is 401. 🔑 No call sends an actor — the server reads it off the session.
 */
import { api } from '@/core/api'
import type {
  CorrectionRegisterEntry,
  PayerMonthAuditEntry,
  PayerMonthCloseAllResponse,
  PayerMonthRow,
} from '@/core/models/insurance-payer-month'
import { actBody, type ActTarget } from './payer-month-rules'

const DOOR = 'InsurancePayerMonthWeb'
const seg = (v: string | number) => encodeURIComponent(String(v).trim())

/** Every read sits under this prefix. */
export const PAYER_MONTH_KEY = ['insurance-payer-month'] as const
export const monthKey = (year: number, month: number, activity: boolean) =>
  [...PAYER_MONTH_KEY, 'month', year, month, activity ? 'activity' : 'ledger'] as const
export const auditKey = (customerId: string, year: number, month: number) =>
  [...PAYER_MONTH_KEY, 'audit', customerId, year, month] as const
export const correctionsKey = (customerId: string, year: number, month: number) =>
  [...PAYER_MONTH_KEY, 'corrections', customerId, year, month] as const

/** Thrown, before any request, when an act's body would not be sent (a blank or over-long reason). */
export class ReasonRequiredError extends Error {
  constructor() {
    super('reason required')
    this.name = 'ReasonRequiredError'
  }
}

function bodyOrThrow(target: ActTarget, reason: string) {
  const body = actBody(target, reason)
  if (!body) throw new ReasonRequiredError()
  return body
}

export const payerMonthApi = {
  /**
   * `GET …/Months/{year}/{month}`. Without `activity` it is the screen's opening read — the ledger's rows and the
   * payers with a correction, no sales scan (BackOffice 1644). With it, `?activity=true` adds every payer with
   * sales in the month: the month-scoped scan, sent only when the team presses for it.
   */
  async month(year: number, month: number, activity: boolean): Promise<PayerMonthRow[]> {
    const rows = await api.get<PayerMonthRow[]>(`${DOOR}/Months/${seg(year)}/${seg(month)}`, activity ? { activity: 'true' } : undefined)
    return rows ?? []
  },

  /** `GET …/Audit/{customerId}/{year}/{month}` — every close and reopen, oldest first. */
  async audit(customerId: string, year: number, month: number): Promise<PayerMonthAuditEntry[]> {
    return (await api.get<PayerMonthAuditEntry[]>(`${DOOR}/Audit/${seg(customerId)}/${seg(year)}/${seg(month)}`)) ?? []
  },

  /** `GET …/Corrections/{customerId}/{year}/{month}` — the corrections register, oldest first (1639). */
  async corrections(customerId: string, year: number, month: number): Promise<CorrectionRegisterEntry[]> {
    return (await api.get<CorrectionRegisterEntry[]>(`${DOOR}/Corrections/${seg(customerId)}/${seg(year)}/${seg(month)}`)) ?? []
  },

  /** `POST …/Close` or `…/Reopen` — one payer-month; answers its row with its correction count. */
  async act(target: Extract<ActTarget, { kind: 'close' | 'reopen' }>, reason: string): Promise<PayerMonthRow> {
    const body = bodyOrThrow(target, reason)
    return api.post<PayerMonthRow>(`${DOOR}/${target.kind === 'close' ? 'Close' : 'Reopen'}`, body)
  },

  /** `POST …/CloseAll` — ONE request for the whole month; the server derives the payers and answers their rows. */
  async closeAll(target: Extract<ActTarget, { kind: 'closeAll' }>, reason: string): Promise<PayerMonthCloseAllResponse> {
    const body = bodyOrThrow(target, reason)
    return api.post<PayerMonthCloseAllResponse>(`${DOOR}/CloseAll`, body)
  },
}
