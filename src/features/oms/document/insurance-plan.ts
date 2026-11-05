/**
 * Document Details' Insurance section, **Plan** (ticket 788, door 3390 / spec 3389 user stories
 * 55–58): the patient's cover (policy, holder, contract, class, member, identity, eligibility,
 * authorization; the server sends no approval number), the clinical facts (diagnosis, visit reason, chief complaint, days
 * supply), who is billed (insurer customer, payer), and the deductible groups with % and cap.
 *
 * Pure: no React, no network, no i18n. Each fact says its kind so the part isolates it the bidi way:
 * `machine` → `Ltr` (a code, an ID, a `code · name` pair), `text` → `<bdi>` (a name, a diagnosis).
 * A blank fact (common on an old order) is `null`, drawn as a word, never an empty cell.
 */
import { formatPair } from '@/core/util/bidi'
import type { CodedParty, InsurancePlan } from '@/core/models/order-insurance'
import { moneyCell, type MoneyCell } from './insurance-section'

/** The plan's facts, top to bottom; their words are `document:insurance.plan.fields.<field>`. */
export const PLAN_FIELDS = [
  ['policyNumber', 'machine'],
  ['policyHolder', 'text'],
  ['contractNumber', 'machine'],
  ['className', 'machine'],
  ['memberId', 'machine'],
  ['identityNumber', 'machine'],
  ['eligibilityReference', 'machine'],
  ['authorizationId', 'machine'],
  ['diagnosis', 'text'],
  ['visitReason', 'text'],
  ['chiefComplaint', 'text'],
  ['daysSupply', 'machine'],
  ['insurerCustomer', 'machine'],
  ['payer', 'machine'],
] as const satisfies readonly (readonly [keyof InsurancePlan, 'machine' | 'text'])[]

export type PlanField = (typeof PLAN_FIELDS)[number][0]

export interface PlanFact {
  field: PlanField
  kind: 'machine' | 'text'
  /** The value as one string, or `null` when the plan has none. */
  value: string | null
}

export interface DeductibleGroupView {
  group: string
  /** `20%` — a machine value. */
  percentage: string
  /** `none` = no cap, never 0. */
  cap: MoneyCell
}

export interface PlanView {
  facts: PlanFact[]
  groups: DeductibleGroupView[]
}

const party = (p: CodedParty | null | undefined) => (p ? formatPair(p.code ?? '', p.name ?? '') : '')

const percent = (n: number) => (n / 100).toLocaleString('en-US', { style: 'percent', maximumFractionDigits: 3 })

export function planView(plan: InsurancePlan, currency: string | null): PlanView {
  const facts = PLAN_FIELDS.map(([field, kind]): PlanFact => {
    const raw = plan[field]
    const text =
      field === 'insurerCustomer' || field === 'payer'
        ? party(raw as CodedParty | null)
        : typeof raw === 'number'
          ? String(raw)
          : typeof raw === 'string'
            ? raw.trim()
            : ''
    return { field, kind, value: text === '' ? null : text }
  })
  const groups = (plan.deductibleGroups ?? []).map((g) => ({
    group: g.group,
    percentage: percent(g.percentage),
    cap: moneyCell(g.cap, currency, { kind: 'none' }),
  }))
  return { facts, groups }
}
