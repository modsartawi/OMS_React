/**
 * Ticket 646 — whose draft it is, a stale draft, and a whole group added (BackOffice spec 3185, door 3190). The panel
 * draws one of four states: no draft, mine, someone else's (read-only but for Discard), or mine and stale (Publish off,
 * Rebase on).
 */
import { describe, expect, it } from 'vitest'
import { draftEditable, draftPanelState, draftStartRefusal, groupAddResult, type IdfDraft } from './draft'

const draft = (by: string, isStale = false): IdfDraft => ({
  draftId: 'D-1',
  by,
  startedAt: '2026-10-28T10:00:00',
  changedAt: '2026-10-28T10:05:00',
  baseVersionId: 'V-11',
  isStale,
  rows: [],
})

describe('panel state from draft, user and staleness', () => {
  it('no draft is none', () => {
    expect(draftPanelState(null, 'msartawi')).toBe('none')
    expect(draftPanelState(undefined, 'msartawi')).toBe('none')
  })
  it('a draft I started is mine', () => {
    expect(draftPanelState(draft('msartawi'), 'msartawi')).toBe('mine')
  })
  it('user ids compare case-blind and trimmed', () => {
    expect(draftPanelState(draft('MSartawi '), 'msartawi')).toBe('mine')
  })
  it("another user's draft is someone else's, stale or not", () => {
    expect(draftPanelState(draft('nalharbi'), 'msartawi')).toBe('someoneElse')
    expect(draftPanelState(draft('nalharbi', true), 'msartawi')).toBe('someoneElse')
  })
  it('my stale draft is stale', () => {
    expect(draftPanelState(draft('msartawi', true), 'msartawi')).toBe('stale')
  })
  it('without a signed-in user no draft can be claimed as mine', () => {
    expect(draftPanelState(draft('msartawi'), null)).toBe('someoneElse')
  })
  it('only my draft, stale or not, takes edits', () => {
    expect(['none', 'mine', 'someoneElse', 'stale'].filter((s) => draftEditable(s as never))).toEqual(['mine', 'stale'])
  })
})

describe("a refused Start names the open draft's owner and last change", () => {
  it('reads by and changedAt from the refusal data', () => {
    expect(draftStartRefusal({ by: 'nalharbi', changedAt: '2026-10-28T09:00:00' })).toEqual({ by: 'nalharbi', changedAt: '2026-10-28T09:00:00' })
  })
  it('a refusal without an owner is no owner refusal', () => {
    expect(draftStartRefusal(null)).toBeNull()
    expect(draftStartRefusal({ changedAt: 'x' })).toBeNull()
    expect(draftStartRefusal({ by: 'nalharbi' })).toEqual({ by: 'nalharbi', changedAt: null })
  })
})

describe('a group add answers how many were added and the refused members', () => {
  const refused = { itemNumber: '300130', rule: 'notInInsurerItems', messageEn: 'Not in the insurer items.', messageAr: 'ليس ضمن أصناف المؤمّن.' }
  it('reads added and the refused rows, the message in the reader language', () => {
    expect(groupAddResult({ added: 3, rows: [refused] }, 'en')).toEqual({
      added: 3,
      refused: [{ itemNumber: '300130', rule: 'notInInsurerItems', wordKey: 'upload.rule.notInInsurerItems', message: 'Not in the insurer items.' }],
    })
    expect(groupAddResult({ added: 3, rows: [refused] }, 'ar').refused[0].message).toBe('ليس ضمن أصناف المؤمّن.')
  })
  it('reads the same whether the draft is beside the counts or spread into the answer', () => {
    expect(groupAddResult({ draft: draft('msartawi'), added: 2, rows: [] }, 'en')).toEqual({ added: 2, refused: [] })
    expect(groupAddResult({ ...draft('msartawi'), added: 2, rows: [] }, 'en')).toEqual({ added: 2, refused: [] })
  })
  it('an unknown rule keeps its raw code; a missing answer is nothing added', () => {
    expect(groupAddResult({ added: 0, rows: [{ ...refused, rule: 'brandNew' }] }, 'en').refused[0].wordKey).toBeNull()
    expect(groupAddResult(null, 'en')).toEqual({ added: 0, refused: [] })
  })
})
