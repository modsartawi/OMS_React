/**
 * The Rule hits page's doors (BackOffice spec 3972, door ticket 3980, oms side 3981). Both cookie-session, gated on
 * `BackOfficeScreen[InsuranceRuleHits, 03]`: a session without it is answered a bare 403 (`isBareDenial`); the menu
 * hides the leaf off the area probe's `canRuleHits`.
 *
 * 🚩 The rows carry national ids (`patientKey`) — never log them client-side.
 */
import { api, type FileResponse } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from '@/core/insurance-rules/api'
import type { LocalDate } from '@/core/util/date-window'
import { ruleHitsParams, type RuleHitKind, type RuleHitsQuery } from './query'

/** What happened after the rule fired (3980). */
export const RULE_HIT_OUTCOMES = ['acknowledged', 'overridden', 'passedByException', 'refused', 'unanswered', 'notShown'] as const
export type RuleHitOutcome = (typeof RULE_HIT_OUTCOMES)[number]

/** One rule firing on one line of one check. `checkId` + `lineNumber` + `ruleId` is unique. */
export interface RuleHit {
  /** Local moment. */
  firedAt: string
  store: string
  staff: string
  /** The patient's national id / iqama. */
  patientKey: string
  payer: string
  policy: string
  item: string
  ruleId: string
  version: number
  checkpoint: 'submit' | 'dispense'
  channel: string
  requestReference: string
  quantity: number
  severity: string
  outcome: RuleHitOutcome | string
  exceptionId: string
  kind: RuleHitKind
  messageEn: string
  messageAr: string
  checkId: string
  lineNumber: number
}

export interface RuleHitsReply {
  from: string
  to: string
  kind: RuleHitKind
  rows: RuleHit[]
}

export const ruleHitsApi = {
  /** `GET InsuranceRules/RuleHits?from&to&rule&payer&store&kind` — the hits, oldest first. */
  async rows(q: RuleHitsQuery): Promise<RuleHitsReply> {
    const reply = await api.get<RuleHitsReply | null>(`${INSURANCE_RULES_BASE}/RuleHits`, ruleHitsParams(q))
    return { from: reply?.from ?? q.from, to: reply?.to ?? q.to, kind: reply?.kind ?? q.kind, rows: reply?.rows ?? [] }
  },
  /** `GET InsuranceRules/RuleHits/Excel` — the same query as the `.xlsx`, named by the server. */
  excel(q: RuleHitsQuery): Promise<FileResponse> {
    return api.blob(`${INSURANCE_RULES_BASE}/RuleHits/Excel`, ruleHitsParams(q))
  },
}

/** The file name when the server sends none — 3980's own spelling. */
export function ruleHitsFileName(q: { from: LocalDate; to: LocalDate; kind: RuleHitKind }): string {
  const day = (d: string) => d.replace(/-/g, '')
  return `rule-hits-${day(q.from)}-to-${day(q.to)}${q.kind === 'shadow' ? '-shadow' : ''}.xlsx`
}

export const RULE_HITS_KEY = [...INSURANCE_RULES_KEY, 'rule-hits'] as const

export function ruleHitsQuery(q: RuleHitsQuery) {
  const p = ruleHitsParams(q)
  return {
    queryKey: [...RULE_HITS_KEY, p.from, p.to, p.kind, p.rule ?? '', p.payer ?? '', p.store ?? ''],
    queryFn: () => ruleHitsApi.rows(q),
    retry: false,
  } as const
}
