/**
 * Ticket 704 — a payer's quirk named once: (payer, wrong URL → canonical URL), proposed by one grant holder and
 * approved by another. The form refuses a pair that says nothing; the screen hides Approve from the author and says why.
 */
import { describe, expect, it } from 'vitest'
import { aliasBody, aliasProblems, approveStanding, type AliasForm, type AliasRow } from './alias-form'

const WRONG = 'http://unitsofmeasure.org/ucum'
const RIGHT = 'http://unitsofmeasure.org'
const form: AliasForm = { payer: '0001100041', wrongUrl: WRONG, canonicalUrl: RIGHT }
const row = (over: Partial<AliasRow> = {}): AliasRow => ({
  id: 'A-1',
  payer: '0001100041',
  wrongUrl: WRONG,
  canonicalUrl: RIGHT,
  state: 'proposed',
  proposedBy: 'nalharbi',
  proposedAt: '2026-10-30T09:00:00',
  approvedBy: null,
  approvedAt: null,
  ...over,
})

describe('aliasProblems', () => {
  it('a complete pair has none', () => {
    expect(aliasProblems(form)).toEqual([])
  })
  it('a payer and both URLs are required, blanks counting as empty', () => {
    expect(aliasProblems({ ...form, payer: '' })).toEqual(['payerMissing'])
    expect(aliasProblems({ ...form, wrongUrl: '  ' })).toEqual(['wrongMissing'])
    expect(aliasProblems({ ...form, canonicalUrl: '' })).toEqual(['canonicalMissing'])
  })
  it('the same URL on both sides is refused, whatever the surrounding spaces', () => {
    expect(aliasProblems({ ...form, canonicalUrl: ` ${WRONG} ` })).toEqual(['sameUrl'])
  })
  it('two empty URLs are missing, never also "the same"', () => {
    expect(aliasProblems({ ...form, wrongUrl: '', canonicalUrl: '' })).toEqual(['wrongMissing', 'canonicalMissing'])
  })
  it('URLs differing only in case are different: a case slip is a quirk an alias may name', () => {
    expect(aliasProblems({ ...form, wrongUrl: 'http://UnitsOfMeasure.org', canonicalUrl: RIGHT })).toEqual([])
  })
})

describe('aliasBody', () => {
  it('the POST body, trimmed', () => {
    expect(aliasBody({ payer: ' 0001100041 ', wrongUrl: ` ${WRONG} `, canonicalUrl: ` ${RIGHT}` })).toEqual({
      payer: '0001100041',
      wrongUrl: WRONG,
      canonicalUrl: RIGHT,
    })
  })
})

describe('approveStanding', () => {
  it('another grant holder may approve a proposed alias', () => {
    expect(approveStanding(row(), 'falotaibi')).toBe('may')
  })
  it('the author may not, whatever the case of their id', () => {
    expect(approveStanding(row(), 'nalharbi')).toBe('ownProposal')
    expect(approveStanding(row(), 'NALHARBI')).toBe('ownProposal')
  })
  it('with no known user or no known author it is refused as if their own', () => {
    expect(approveStanding(row(), null)).toBe('ownProposal')
    expect(approveStanding(row({ proposedBy: null }), 'falotaibi')).toBe('ownProposal')
  })
  it('an approved alias offers nothing, not even to its author', () => {
    expect(approveStanding(row({ state: 'approved', approvedBy: 'falotaibi' }), 'sbakr')).toBe('none')
    expect(approveStanding(row({ state: 'approved', approvedBy: 'falotaibi' }), 'nalharbi')).toBe('none')
  })
})
