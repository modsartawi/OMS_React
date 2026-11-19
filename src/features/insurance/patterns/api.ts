/**
 * The pattern doors (oms 922; BackOffice 4053, NOT BUILT — every path and shape here is GUESSED, see the model). Every
 * call goes through `@/core/api` (`.claude/rules/api-envelope.md`): the cookie session, the `X-Web-Client` header, 401
 * and the error taxonomy are that module's. 🔑 No call sends an actor — the server reads it off the session.
 *
 * Every answer is read field by field (`./wire`), so nothing the server sends beyond the agreed fields is kept.
 */
import { api } from '@/core/api'
import type { PatternCaseDetail, PatternCasesPage, PatternCasesQuery, PatternMark } from '@/core/models/insurance-patterns'
import { markBody, type MarkDraft } from './mark'
import { readRevealedPatient, revealBody, RevealEmptyError, RevealNotSentError, type RevealedPatient } from './reveal'
import { readCaseDetail, readCasesPage, readMark } from './wire'

const CASES = 'Insurance/Patterns/Cases'
const seg = (v: string) => encodeURIComponent(v.trim())

/** Every read sits under this prefix. */
export const PATTERNS_KEY = ['insurance-patterns'] as const
export const casesKey = (query: PatternCasesQuery) => [...PATTERNS_KEY, 'cases', query] as const
export const caseKey = (caseId: string) => [...PATTERNS_KEY, 'case', caseId] as const

/** Thrown before any request when a mark's draft would not be sent (no status, a blank or over-long note). */
export class MarkNotSentError extends Error {
  constructor() {
    super('mark not sent')
    this.name = 'MarkNotSentError'
  }
}

export const patternsApi = {
  /** `GET Insurance/Patterns/Cases` — a page of the list, in the server's order (score, then the last dispense). */
  async cases(query: PatternCasesQuery): Promise<PatternCasesPage> {
    return readCasesPage(await api.get<unknown>(CASES, { ...query }))
  },

  /** `GET Insurance/Patterns/Cases/{caseId}` — the case with its timeline, legs, signals, marks and previous cases. */
  async detail(caseId: string): Promise<PatternCaseDetail> {
    return readCaseDetail(await api.get<unknown>(`${CASES}/${seg(caseId)}`))
  },

  /**
   * `POST …/Cases/{caseId}/Reveal` (923) — the investigator's logged reveal: the server writes its log row, then answers
   * the patient key and member id. 🔒 The answer goes to the caller only, the reveal dialog's own state: this door is
   * never wrapped in `useQuery` or `useMutation` (both caches would keep it), and it is never logged.
   */
  async reveal(caseId: string, reason: string): Promise<RevealedPatient> {
    const body = revealBody(reason)
    if (!body) throw new RevealNotSentError()
    const patient = readRevealedPatient(await api.post<unknown>(`${CASES}/${seg(caseId)}/Reveal`, body))
    if (!patient) throw new RevealEmptyError()
    return patient
  },

  /** `POST …/Cases/{caseId}/Marks` — answers the new mark; the page then re-reads the case. */
  async mark(caseId: string, draft: MarkDraft): Promise<PatternMark> {
    const body = markBody(draft)
    if (!body) throw new MarkNotSentError()
    const answer = await api.post<unknown>(`${CASES}/${seg(caseId)}/Marks`, body)
    return readMark(typeof answer === 'object' && answer !== null ? (answer as Record<string, unknown>) : {})
  },
}
