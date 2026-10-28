/**
 * Ticket 646 — whose draft it is, a stale draft, and a whole group added (BackOffice spec 3185, door 3190). The panel
 * draws one of four states: no draft, mine, someone else's (read-only but for Discard), or mine and stale (Publish off,
 * Rebase on).
 */
import { describe, expect, it } from 'vitest'
import { draftBaseVersion, draftEditable, draftEditRefusal, draftPanelState, draftRuleWordKey, draftStartRefusal, groupAddResult, rebaseResult, type IdfDraft } from './draft'

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
  it('reads by and changedAt from the refusal data (IDF-00034: data { draftId, by, startedAt, changedAt })', () => {
    expect(draftStartRefusal({ draftId: 'D-9', by: 'nalharbi', startedAt: '2026-10-28T08:00:00', changedAt: '2026-10-28T09:00:00' })).toEqual({ by: 'nalharbi', changedAt: '2026-10-28T09:00:00' })
  })
  it('a refusal without an owner is no owner refusal', () => {
    expect(draftStartRefusal(null)).toBeNull()
    expect(draftStartRefusal({ changedAt: 'x' })).toBeNull()
    expect(draftStartRefusal({ by: 'nalharbi' })).toEqual({ by: 'nalharbi', changedAt: null })
  })
})

describe('a group add answers { draft, added, rows } — the draft nested (BackOffice 3190 as built)', () => {
  const refused = { itemNumber: '300130', edit: 'add', rule: 'notInInsurerItems', messageEn: 'Not in the insurer items.', messageAr: 'ليس ضمن أصناف المؤمّن.' }
  it('reads the draft, added and the refused rows, the message in the reader language', () => {
    expect(groupAddResult({ draft: draft('msartawi'), added: 3, rows: [refused] }, 'en')).toEqual({
      draft: draft('msartawi'),
      added: 3,
      refused: [{ itemNumber: '300130', edit: 'add', rule: 'notInInsurerItems', wordKey: 'upload.rule.notInInsurerItems', message: 'Not in the insurer items.' }],
    })
    expect(groupAddResult({ draft: draft('msartawi'), added: 3, rows: [refused] }, 'ar').refused[0].message).toBe('ليس ضمن أصناف المؤمّن.')
  })
  it('a draft spread into the answer is not read as one (only the nested shape is the door’s)', () => {
    expect(groupAddResult({ ...draft('msartawi'), added: 2, rows: [] }, 'en')).toEqual({ draft: null, added: 2, refused: [] })
  })
  it('an unknown rule keeps its raw code; a missing answer is nothing added', () => {
    expect(groupAddResult({ added: 0, rows: [{ ...refused, rule: 'brandNew' }] }, 'en').refused[0].wordKey).toBeNull()
    expect(groupAddResult(null, 'en')).toEqual({ draft: null, added: 0, refused: [] })
  })
})

describe('a rebase answers { draft, reapplied, rows } — rows the edits that could NOT be re-applied', () => {
  const dropped = { itemNumber: '100110', edit: 'reRank', rule: 'notInDraft', messageEn: 'Item 100110 is no longer ranked by the live version.', messageAr: 'الصنف 100110 لم يعد ضمن الإصدار الحالي.' }
  it('reads the draft, how many re-applied and each dropped edit with its edit, rule word and message', () => {
    expect(rebaseResult({ draft: draft('msartawi'), reapplied: 4, rows: [dropped] }, 'en')).toEqual({
      draft: draft('msartawi'),
      reapplied: 4,
      failed: [{ itemNumber: '100110', edit: 'reRank', rule: 'notInDraft', wordKey: 'draft.ruleWord.notInDraft', message: 'Item 100110 is no longer ranked by the live version.' }],
    })
  })
  it('an add the new live version no longer allows keeps the upload rule word', () => {
    const r = rebaseResult({ draft: null, reapplied: 0, rows: [{ ...dropped, edit: 'add', rule: 'itemNotInGroup' }] }, 'ar')
    expect(r.failed[0]).toMatchObject({ edit: 'add', wordKey: 'upload.rule.itemNotInGroup', message: 'الصنف 100110 لم يعد ضمن الإصدار الحالي.' })
  })
  it('no answer is nothing re-applied and nothing dropped', () => {
    expect(rebaseResult(undefined, 'en')).toEqual({ draft: null, reapplied: 0, failed: [] })
  })
})

describe('the rule words a draft edit can name', () => {
  it('every upload rule (itemNotInGroup included) and the draft’s own notInDraft; anything else has none', () => {
    expect(draftRuleWordKey('itemNotInGroup')).toBe('upload.rule.itemNotInGroup')
    expect(draftRuleWordKey('notInDraft')).toBe('draft.ruleWord.notInDraft')
    expect(draftRuleWordKey('brandNew')).toBeNull()
  })
  it('a refused edit (IDF-00030) reads rule and message from data { rule, messageEn, messageAr }', () => {
    expect(draftEditRefusal({ rule: 'itemNotInGroup', messageEn: 'Item 100302 is not in IDF-AMOX.', messageAr: 'الصنف 100302 ليس في IDF-AMOX.' }, 'en')).toEqual({
      rule: 'itemNotInGroup',
      wordKey: 'upload.rule.itemNotInGroup',
      message: 'Item 100302 is not in IDF-AMOX.',
    })
  })
})

describe('the version a draft diffs against', () => {
  it('a draft started on a master with nothing live has a blank base: there is none to read (every row is added)', () => {
    expect(draftBaseVersion({ ...draft('msartawi'), baseVersionId: '' })).toBeNull()
    expect(draftBaseVersion({ ...draft('msartawi'), baseVersionId: '  ' })).toBeNull()
    expect(draftBaseVersion(null)).toBeNull()
  })
  it('otherwise the base version id', () => {
    expect(draftBaseVersion(draft('msartawi'))).toBe('V-11')
  })
})
