import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { CopilotPromptVersion } from '@/core/models/copilot'
import {
  RULES_MAX,
  canSaveRules,
  curatorRefused,
  fromPromptWire,
  fromVersionWire,
  historyRows,
  isRulesDirty,
  mergeOffer,
  rulesTooLong,
  saveRequest,
} from './rules'

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
    expect(offer.saveMineOnTop).toEqual({ houseRules: 'my rules', note: 'markdown', baseVersion: 4 })
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

  it('curatorRefused_onTheFiltersBare403OrCopilot410', () => {
    const refusal = (code: string) =>
      new ApiError('business', 'no', 409, [{ errorCode: code, errorMessage: 'no' } as never])
    expect(curatorRefused(refusal('COPILOT-410'))).toBe(true)
    // BackOffice 3395: the grant filter answers first, with a bare 403 (no envelope, no code).
    expect(curatorRefused(new ApiError('auth', 'Unexpected API error (HTTP 403)', 403))).toBe(true)
    expect(curatorRefused(refusal('COPILOT-411'))).toBe(false)
    expect(curatorRefused(new ApiError('server', 'boom', 500))).toBe(false)
    expect(curatorRefused(new Error('x'))).toBe(false)
  })

  it('fromPromptWire_readsTheFlatViewAndHouseRules_emptyIsNone (BackOffice 3395 wire)', () => {
    const wire = {
      core: 'The core.',
      houseRules: '- Rule 8\n- Rule 12',
      version: 1,
      savedBy: 'seed',
      savedAt: '2026-11-06T09:00:00',
      note: '',
      maxLength: 4000,
    }
    expect(fromPromptWire(wire)).toEqual({
      core: 'The core.',
      active: { version: 1, text: '- Rule 8\n- Rule 12', savedBy: 'seed', savedAt: '2026-11-06T09:00:00', note: null, revertedFrom: null },
    })
    // Version 0: nothing stored, the built-in text, no saver and no time.
    expect(fromPromptWire({ core: 'c', houseRules: 'built-in', version: 0, savedBy: '', savedAt: '', note: '', maxLength: 4000 }).active).toEqual({
      version: 0,
      text: 'built-in',
      savedBy: null,
      savedAt: null,
      note: null,
      revertedFrom: null,
    })
    // A bare or odd reply never throws.
    expect(fromPromptWire(null)).toEqual({ core: '', active: { version: 0, text: '', savedBy: null, savedAt: null, note: null, revertedFrom: null } })
  })

  it('fromVersionWire_readsAHistoryRow', () => {
    expect(
      fromVersionWire({ version: 3, houseRules: 'v1 text', note: '  ', savedBy: 'a.curator', savedAt: '2026-11-06T10:00:00', revertedFrom: 1 }),
    ).toEqual({ version: 3, text: 'v1 text', savedBy: 'a.curator', savedAt: '2026-11-06T10:00:00', note: null, revertedFrom: 1 })
    expect(fromVersionWire({ version: 2, houseRules: 'x', note: 'why', savedBy: 'b', savedAt: 's', revertedFrom: null }).note).toBe('why')
  })

  it('saveRequest_sendsTheTextAsHouseRules', () => {
    expect(saveRequest({ text: 'new rules', note: ' ' }, 4)).toEqual({ houseRules: 'new rules', note: null, baseVersion: 4 })
  })
})
