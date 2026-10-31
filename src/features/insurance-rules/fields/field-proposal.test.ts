/** Oms 696 (BackOffice spec 3271 story 21; 3262 V6): who may decide a proposed field, and the inbox's order. */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-fields.json'
import ar from '@/locales/ar/insurance-fields.json'
import areaEn from '@/locales/en/insurance-rules.json'
import areaAr from '@/locales/ar/insurance-rules.json'
import { hasLocaleKey } from '@/core/test/locale'
import { FIELD_PROPOSAL_STATES, inboxOrder, proposalStanding, rejectBody, type FieldProposal } from './field-proposal'

const OPEN = { state: 'proposed', proposedBy: 'NAlharbi' } as const
const GRANTED = { approver: true }
const READER = { approver: false }

describe('who may act on a proposal', () => {
  it('another grant holder may approve or reject', () => {
    expect(proposalStanding(OPEN, 'falotaibi', GRANTED)).toBe('may')
  })
  it('the author may not, whatever the case of the user id, and is told why', () => {
    expect(proposalStanding(OPEN, 'nalharbi', GRANTED)).toBe('ownProposal')
    expect(proposalStanding(OPEN, 'NALHARBI', GRANTED)).toBe('ownProposal')
  })
  it('a reader without the grant may not', () => {
    expect(proposalStanding(OPEN, 'falotaibi', READER)).toBe('reader')
  })
  it('a reader who is also the author reads as a reader: the grant is what is missing', () => {
    expect(proposalStanding(OPEN, 'nalharbi', READER)).toBe('reader')
  })
  it('a decided proposal offers nothing to anyone', () => {
    expect(proposalStanding({ state: 'approved', proposedBy: 'nalharbi' }, 'falotaibi', GRANTED)).toBe('none')
    expect(proposalStanding({ state: 'rejected', proposedBy: 'nalharbi' }, 'nalharbi', GRANTED)).toBe('none')
  })
  it('an unknown user or author offers nothing, and claims no authorship', () => {
    expect(proposalStanding(OPEN, null, GRANTED)).toBe('none')
    expect(proposalStanding({ state: 'proposed', proposedBy: null }, 'falotaibi', GRANTED)).toBe('none')
  })
})

describe('a rejection', () => {
  it('needs its reason, trimmed', () => {
    expect(rejectBody('   ')).toBeNull()
    expect(rejectBody('  Duplicates the line copay. ')).toEqual({ reason: 'Duplicates the line copay.' })
  })
})

describe('the inbox', () => {
  const row = (id: string, state: FieldProposal['state'], proposedAt: string) => ({ id, state, proposedAt })
  it('puts what waits first, oldest first; what is decided follows, newest first', () => {
    const rows = [row('d1', 'approved', '2026-10-01T09:00:00'), row('o2', 'proposed', '2026-10-20T09:00:00'), row('d2', 'rejected', '2026-10-05T09:00:00'), row('o1', 'proposed', '2026-10-10T09:00:00')]
    expect(inboxOrder(rows).map((r) => r.id)).toEqual(['o1', 'o2', 'd2', 'd1'])
  })
})

describe('the proposals words', () => {
  function leaves(node: unknown, prefix = ''): string[] {
    if (typeof node !== 'object' || node === null) return [prefix]
    return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
  }
  it('en and ar hold the same keys', () => {
    expect(leaves(ar.proposals).sort()).toEqual(leaves(en.proposals).sort())
  })
  it.each([en, ar])('every state has words, and the Patient warning takes the path', (locale) => {
    for (const s of FIELD_PROPOSAL_STATES) expect([s, hasLocaleKey(locale, `proposals.state.${s}`)]).toEqual([s, true])
    expect(locale.proposals.patientWarning).toContain('{{path}}')
  })
  it.each([areaEn, areaAr])('the menu leaf, in the area namespace', (locale) => {
    expect(hasLocaleKey(locale, 'menu.fieldProposals')).toBe(true)
  })
})
