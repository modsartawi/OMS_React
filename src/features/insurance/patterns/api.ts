/**
 * The pattern doors (oms 922; reconciled with BackOffice 4053 as built: `InsuranceRules/Patterns/Cases...`, a case keyed
 * by its INT case number). Every call goes through `@/core/api` (`.claude/rules/api-envelope.md`): the cookie session,
 * the `X-Web-Client` header, the `{ data, success }` envelope, 401 and the error taxonomy are that module's. 🔑 No call
 * sends an actor — the server reads it off the session.
 *
 * Every answer is read field by field (`./wire`), so nothing the server sends beyond the agreed fields is kept.
 */
import { api } from '@/core/api'
import type { PatternCaseDetail, PatternCasesPage, PatternCasesQuery } from '@/core/models/insurance-patterns'
import { markBody, type MarkDraft } from './mark'
import { readRevealedPatient, revealBody, RevealEmptyError, RevealNotSentError, type RevealedPatient } from './reveal'
import { readCaseDetail, readCasesPage } from './wire'

const CASES = 'InsuranceRules/Patterns/Cases'
const seg = (v: string) => encodeURIComponent(v.trim())

/** Every read sits under this prefix. */
export const PATTERNS_KEY = ['insurance-patterns'] as const
export const casesKey = (query: PatternCasesQuery) => [...PATTERNS_KEY, 'cases', query] as const
/**
 * Every case's read sits under this prefix. A write on a case invalidates the PREFIX (review 10), so whichever read of
 * the case a screen holds is read again.
 */
export const CASE_READS_KEY = [...PATTERNS_KEY, 'case'] as const
export const caseKey = (caseNumber: string) => [...CASE_READS_KEY, caseNumber] as const

/** Thrown before any request when a mark's draft would not be sent (no status, a blank or over-long note). */
export class MarkNotSentError extends Error {
  constructor() {
    super('mark not sent')
    this.name = 'MarkNotSentError'
  }
}

export const patternsApi = {
  /** `GET InsuranceRules/Patterns/Cases` — a page of the list, in the server's order (score, then the last dispense). */
  async cases(query: PatternCasesQuery): Promise<PatternCasesPage> {
    return readCasesPage(await api.get<unknown>(CASES, { ...query }))
  },

  /** `GET InsuranceRules/Patterns/Cases/{caseNumber}` — the case with its timeline, legs, signals, marks and previous cases. */
  async detail(caseNumber: string): Promise<PatternCaseDetail> {
    return readCaseDetail(await api.get<unknown>(`${CASES}/${seg(caseNumber)}`))
  },

  /**
   * `POST …/Cases/{caseNumber}/Reveal` (923) — the investigator's logged reveal: the server writes its log row, then
   * answers `{ caseNumber, patientKey, memberId, revealedAt }`, of which only the patient key and the member id are read.
   * 🔒 The answer goes to the caller only, the reveal dialog's own state: this door is never wrapped in `useQuery` or
   * `useMutation` (both caches would keep it), and it is never logged.
   */
  async reveal(caseNumber: string, reason: string): Promise<RevealedPatient> {
    const body = revealBody(reason)
    if (!body) throw new RevealNotSentError()
    const patient = readRevealedPatient(await api.post<unknown>(`${CASES}/${seg(caseNumber)}/Reveal`, body))
    if (!patient) throw new RevealEmptyError()
    return patient
  },

  /** `POST …/Cases/{caseNumber}/Marks` — answers the whole case again (read as `GET` reads it); the page re-reads anyway. */
  async mark(caseNumber: string, draft: MarkDraft): Promise<PatternCaseDetail> {
    const body = markBody(draft)
    if (!body) throw new MarkNotSentError()
    return readCaseDetail(await api.post<unknown>(`${CASES}/${seg(caseNumber)}/Marks`, body))
  },
}
