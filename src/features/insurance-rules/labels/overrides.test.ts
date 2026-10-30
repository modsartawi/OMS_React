/**
 * Ticket 707 — a curated label needs at least one of English or Arabic, and only someone who is not its author may
 * approve it. The client only hides the action: HQ still decides.
 */
import { describe, expect, it } from 'vitest'
import { approveStanding, overrideBody, overrideProblems, pendingFor, type LabelOverride } from './overrides'

const SYSTEM = 'http://nphies.sa/terminology/CodeSystem/benefit-category'

const proposal = (code: string, over: Partial<LabelOverride> = {}): LabelOverride => ({
  id: `O-${code}`,
  system: SYSTEM,
  code,
  en: null,
  ar: 'عناية الأسنان',
  state: 'proposed',
  proposedBy: 'nalharbi',
  proposedAt: '2026-10-30T09:00:00',
  approvedBy: null,
  approvedAt: null,
  ...over,
})

describe('overrideProblems', () => {
  const form = (en: string, ar: string) => ({ system: SYSTEM, code: '12', en, ar })

  it('takes Arabic alone, English alone, or both', () => {
    expect(overrideProblems(form('', 'عناية'))).toEqual([])
    expect(overrideProblems(form('Dental care', ''))).toEqual([])
    expect(overrideProblems(form('Dental care', 'عناية'))).toEqual([])
  })

  it('refuses neither, and spaces are not a label', () => {
    expect(overrideProblems(form('', ''))).toEqual(['labelMissing'])
    expect(overrideProblems(form('   ', '\t'))).toEqual(['labelMissing'])
  })

  it('names a missing code system and a missing code', () => {
    expect(overrideProblems({ system: ' ', code: '', en: 'Dental', ar: '' })).toEqual(['systemMissing', 'codeMissing'])
  })
})

describe('overrideBody', () => {
  it('trims, and an untouched language is null so it keeps what it has', () => {
    expect(overrideBody({ system: ` ${SYSTEM} `, code: ' 12 ', en: '  ', ar: ' عناية ' })).toEqual({ system: SYSTEM, code: '12', en: null, ar: 'عناية' })
  })
})

describe('approveStanding', () => {
  it('offers Approve to someone else, whatever the case of the name', () => {
    expect(approveStanding(proposal('12'), 'falotaibi')).toBe('may')
  })

  it('never to its author, even in another case', () => {
    expect(approveStanding(proposal('12'), 'nalharbi')).toBe('ownProposal')
    expect(approveStanding(proposal('12'), 'NALHARBI')).toBe('ownProposal')
  })

  it('never without knowing who is asking or who wrote it', () => {
    expect(approveStanding(proposal('12'), null)).toBe('ownProposal')
    expect(approveStanding(proposal('12', { proposedBy: null }), 'falotaibi')).toBe('ownProposal')
  })

  it('never once approved', () => {
    expect(approveStanding(proposal('12', { state: 'approved' }), 'falotaibi')).toBe('none')
  })
})

describe('pendingFor', () => {
  const list = [proposal('12'), proposal('81'), proposal('12', { id: 'O-other', system: 'http://nphies.sa/other' })]

  it('finds the proposal by code system and code together', () => {
    expect(pendingFor(list, SYSTEM, '81')?.id).toBe('O-81')
    expect(pendingFor(list, 'http://nphies.sa/other', '12')?.id).toBe('O-other')
  })

  it('finds nothing for a code with none, or one already approved', () => {
    expect(pendingFor(list, SYSTEM, '99')).toBeUndefined()
    expect(pendingFor([proposal('12', { state: 'approved' })], SYSTEM, '12')).toBeUndefined()
  })
})
