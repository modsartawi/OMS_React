/**
 * Ticket 788 — the Insurance section's **Plan** (spec 3389 user stories 55–58): the cover, the clinical
 * facts, who is billed, and the deductible groups with % and cap.
 */
import { describe, expect, it } from 'vitest'
import type { OrderInsuranceRead } from '@/core/models/order-insurance'
import baseJson from './__fixtures__/insurance-1006358459.json'
import { planView } from './insurance-plan'

const BASE = baseJson as unknown as OrderInsuranceRead

describe('insurance plan', () => {
  it('every fact in order, each by its kind', () => {
    const view = planView(BASE.plan, BASE.currency)
    expect(view.facts.map((f) => [f.field, f.kind, f.value])).toEqual([
      ['policyNumber', 'machine', 'POL-55120'],
      ['policyHolder', 'text', 'شركة الراجحي للتجارة'],
      ['contractNumber', 'machine', 'C-2026-0418'],
      ['className', 'machine', 'B'],
      ['memberId', 'machine', 'BUPA-7781230'],
      ['identityNumber', 'machine', '1023456789'],
      ['eligibilityReference', 'machine', 'ELG-99812'],
      ['authorizationId', 'machine', 'AUTH-55410'],
      ['approvalNumber', 'machine', 'APR-120044'],
      ['diagnosis', 'text', 'J02.9 Acute pharyngitis, unspecified'],
      ['visitReason', 'text', 'Sore throat'],
      ['chiefComplaint', 'text', 'Fever and sore throat for three days'],
      ['daysSupply', 'machine', '7'],
      ['insurerCustomer', 'machine', 'C100230 · BUPA Arabia'],
      ['payer', 'machine', 'P-BUPA · BUPA Arabia for Cooperative Insurance'],
    ])
  })

  it('a blank fact on an old order is null (drawn as a word), not an empty string', () => {
    const view = planView({ ...BASE.plan, policyNumber: '  ', daysSupply: null, payer: null }, BASE.currency)
    const value = (f: string) => view.facts.find((x) => x.field === f)?.value
    expect([value('policyNumber'), value('daysSupply'), value('payer')]).toEqual([null, null, null])
  })

  it('deductible groups read percent and cap in the currency decimals; no cap is said, never 0', () => {
    const view = planView({ ...BASE.plan, deductibleGroups: [{ group: 'G1', percentage: 20, cap: 30 }, { group: 'G2', percentage: 12.5, cap: null }] }, 'BHD')
    expect(view.groups).toEqual([
      { group: 'G1', percentage: '20%', cap: { kind: 'amount', text: '30.000' } },
      { group: 'G2', percentage: '12.5%', cap: { kind: 'none' } },
    ])
  })
})
