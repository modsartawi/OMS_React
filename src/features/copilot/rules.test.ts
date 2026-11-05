import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { CopilotPromptVersion } from '@/core/models/copilot'
import { RULES_MAX, canSaveRules, curatorRefused, historyRows, isRulesDirty, mergeOffer, rulesTooLong } from './rules'

const v = (version: number, over: Partial<CopilotPromptVersion> = {}): CopilotPromptVersion => ({
  version,
  text: `rules ${version}`,
  savedBy: 'a.curator',
  savedAt: '2026-11-06T09:00:00',
  note: null,
  revertedFrom: null,
  ...over,
})

describe('the house-rules editor (ticket 790)', () => {
  it('isRulesDirty_whenTheTextOrTheNoteChanged', () => {
    const active = v(1)
    expect(isRulesDirty({ text: 'rules 1', note: '' }, active)).toBe(false)
    expect(isRulesDirty({ text: 'rules 1 and more', note: '' }, active)).toBe(true)
    expect(isRulesDirty({ text: 'rules 1', note: 'tables' }, active)).toBe(true)
    // A blank note is no note.
    expect(isRulesDirty({ text: 'rules 1', note: '   ' }, active)).toBe(false)
    // Nothing loaded yet: nothing to lose.
    expect(isRulesDirty({ text: 'x', note: '' }, null)).toBe(false)
  })

  it('canSaveRules_dirtyNotBlankAtMostFourThousandNothingInFlight', () => {
    const active = v(1)
    expect(RULES_MAX).toBe(4000)
    expect(canSaveRules({ text: 'new', note: '' }, active, false)).toBe(true)
    // Unchanged.
    expect(canSaveRules({ text: 'rules 1', note: '' }, active, false)).toBe(false)
    // Blank.
    expect(canSaveRules({ text: '   \n', note: 'cleared' }, active, false)).toBe(false)
    // At the limit, and one over.
    expect(canSaveRules({ text: 'a'.repeat(4000), note: '' }, active, false)).toBe(true)
    expect(canSaveRules({ text: 'a'.repeat(4001), note: '' }, active, false)).toBe(false)
    expect(rulesTooLong('a'.repeat(4001))).toBe(true)
    expect(rulesTooLong('a'.repeat(4000))).toBe(false)
    // A save or a restore already out.
    expect(canSaveRules({ text: 'new', note: '' }, active, true)).toBe(false)
    // Nothing loaded.
    expect(canSaveRules({ text: 'new', note: '' }, null, false)).toBe(false)
  })

  it('mergeOffer_showsTheirsAndMine_andSavesMineOnTheirVersion', () => {
    const theirs = v(4, { text: 'their rules', savedBy: 'b.curator', note: 'tables' })
    const offer = mergeOffer(theirs, { text: 'my rules', note: 'markdown' })
    expect(offer.theirs).toEqual({ version: 4, text: 'their rules', savedBy: 'b.curator', savedAt: '2026-11-06T09:00:00' })
    expect(offer.mine).toEqual({ text: 'my rules', note: 'markdown' })
    // "Save mine on top" re-posts mine on their version.
    expect(offer.saveMineOnTop).toEqual({ text: 'my rules', note: 'markdown', baseVersion: 4 })
    // A blank note is sent as none.
    expect(mergeOffer(theirs, { text: 'my rules', note: ' ' }).saveMineOnTop.note).toBeNull()
  })

  it('historyRows_newestFirst_twenty_revertedFromAndTheActiveMark', () => {
    const history = [v(1), v(3, { revertedFrom: 1 }), v(2, { note: 'rule 12' })]
    expect(historyRows(history, 3)).toEqual([
      { version: 3, savedBy: 'a.curator', savedAt: '2026-11-06T09:00:00', note: null, revertedFrom: 1, active: true, text: 'rules 3' },
      { version: 2, savedBy: 'a.curator', savedAt: '2026-11-06T09:00:00', note: 'rule 12', revertedFrom: null, active: false, text: 'rules 2' },
      { version: 1, savedBy: 'a.curator', savedAt: '2026-11-06T09:00:00', note: null, revertedFrom: null, active: false, text: 'rules 1' },
    ])
    const many = Array.from({ length: 25 }, (_, i) => v(i + 1))
    const rows = historyRows(many, 25)
    expect(rows).toHaveLength(20)
    expect(rows[0].version).toBe(25)
    expect(rows[19].version).toBe(6)
    // A blank note reads as none; an odd reply reads as no history.
    expect(historyRows([v(1, { note: '  ' })], 1)[0].note).toBeNull()
    expect(historyRows(null, 1)).toEqual([])
  })

  it('curatorRefused_onCopilot410Only', () => {
    const refusal = (code: string) =>
      new ApiError('business', 'no', 403, [{ errorCode: code, errorMessage: 'no' } as never])
    expect(curatorRefused(refusal('COPILOT-410'))).toBe(true)
    expect(curatorRefused(refusal('COPILOT-411'))).toBe(false)
    expect(curatorRefused(new Error('x'))).toBe(false)
  })
})
