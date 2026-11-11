import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { CopilotPromptVersion } from '@/core/models/copilot'
import {
  RULES_MAX,
  canSaveRules,
  curatorRefused,
  draftOf,
  fromPromptWire,
  fromVersionWire,
  historyRows,
  isRulesDirty,
  mergeOffer,
  READINGS_MAX,
  readingsTooLong,
  refusedField,
  rulesTooLong,
  saveRequest,
  tryRequest,
} from './rules'

const noBuiltIn = { builtInDefaultReadings: '', defaultReadingsMaxLength: 2000 }

const v = (version: number, over: Partial<CopilotPromptVersion> = {}): CopilotPromptVersion => ({
  version,
  text: `rules ${version}`,
  savedBy: 'a.curator',
  savedAt: '2026-11-06T09:00:00',
  note: null,
  revertedFrom: null,
  defaultReadings: '',
  ...over,
})

describe('the house-rules editor (ticket 790)', () => {
  it('isRulesDirty_whenTheTextOrTheNoteChanged', () => {
    const active = v(1)
    expect(isRulesDirty({ text: 'rules 1', note: '', readings: '' }, active, noBuiltIn)).toBe(false)
    expect(isRulesDirty({ text: 'rules 1 and more', note: '', readings: '' }, active, noBuiltIn)).toBe(true)
    expect(isRulesDirty({ text: 'rules 1', note: 'tables', readings: '' }, active, noBuiltIn)).toBe(true)
    // A blank note is no note.
    expect(isRulesDirty({ text: 'rules 1', note: '   ', readings: '' }, active, noBuiltIn)).toBe(false)
    // Nothing loaded yet: nothing to lose.
    expect(isRulesDirty({ text: 'x', note: '', readings: '' }, null, noBuiltIn)).toBe(false)
  })

  it('canSaveRules_dirtyNotBlankAtMostFourThousandNothingInFlight', () => {
    const active = v(1)
    expect(RULES_MAX).toBe(4000)
    expect(canSaveRules({ text: 'new', note: '', readings: '' }, active, false, noBuiltIn)).toBe(true)
    // Unchanged.
    expect(canSaveRules({ text: 'rules 1', note: '', readings: '' }, active, false, noBuiltIn)).toBe(false)
    // Blank.
    expect(canSaveRules({ text: '   \n', note: 'cleared', readings: '' }, active, false, noBuiltIn)).toBe(false)
    // At the limit, and one over.
    expect(canSaveRules({ text: 'a'.repeat(4000), note: '', readings: '' }, active, false, noBuiltIn)).toBe(true)
    expect(canSaveRules({ text: 'a'.repeat(4001), note: '', readings: '' }, active, false, noBuiltIn)).toBe(false)
    expect(rulesTooLong('a'.repeat(4001))).toBe(true)
    expect(rulesTooLong('a'.repeat(4000))).toBe(false)
    // A save or a restore already out.
    expect(canSaveRules({ text: 'new', note: '', readings: '' }, active, true, noBuiltIn)).toBe(false)
    // Nothing loaded.
    expect(canSaveRules({ text: 'new', note: '', readings: '' }, null, false, noBuiltIn)).toBe(false)
  })

  it('mergeOffer_showsTheirsAndMine_andSavesMineOnTheirVersion', () => {
    const theirs = v(4, { text: 'their rules', savedBy: 'b.curator', note: 'tables' })
    const offer = mergeOffer(theirs, { text: 'my rules', note: 'markdown', readings: '' }, noBuiltIn)
    expect(offer.theirs).toEqual({ version: 4, text: 'their rules', readings: '', savedBy: 'b.curator', savedAt: '2026-11-06T09:00:00' })
    expect(offer.mine).toEqual({ text: 'my rules', note: 'markdown', readings: '' })
    // "Save mine on top" re-posts mine on their version.
    expect(offer.saveMineOnTop).toEqual({ houseRules: 'my rules', note: 'markdown', baseVersion: 4, defaultReadings: '' })
    // A blank note is sent as none.
    expect(mergeOffer(theirs, { text: 'my rules', note: ' ', readings: '' }, noBuiltIn).saveMineOnTop.note).toBeNull()
  })

  it('historyRows_newestFirst_twenty_revertedFromAndTheActiveMark', () => {
    const history = [v(1), v(3, { revertedFrom: 1 }), v(2, { note: 'rule 12' })]
    expect(historyRows(history, 3, noBuiltIn)).toEqual([
      { version: 3, savedBy: 'a.curator', savedAt: '2026-11-06T09:00:00', note: null, revertedFrom: 1, active: true, text: 'rules 3', readings: '' },
      { version: 2, savedBy: 'a.curator', savedAt: '2026-11-06T09:00:00', note: 'rule 12', revertedFrom: null, active: false, text: 'rules 2', readings: '' },
      { version: 1, savedBy: 'a.curator', savedAt: '2026-11-06T09:00:00', note: null, revertedFrom: null, active: false, text: 'rules 1', readings: '' },
    ])
    const many = Array.from({ length: 25 }, (_, i) => v(i + 1))
    const rows = historyRows(many, 25, noBuiltIn)
    expect(rows).toHaveLength(20)
    expect(rows[0].version).toBe(25)
    expect(rows[19].version).toBe(6)
    // A blank note reads as none; an odd reply reads as no history.
    expect(historyRows([v(1, { note: '  ' })], 1, noBuiltIn)[0].note).toBeNull()
    expect(historyRows(null, 1, noBuiltIn)).toEqual([])
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
      active: { version: 1, text: '- Rule 8\n- Rule 12', savedBy: 'seed', savedAt: '2026-11-06T09:00:00', note: null, revertedFrom: null, defaultReadings: '' },
      builtInDefaultReadings: '',
      defaultReadingsMaxLength: 2000,
    })
    // Version 0: nothing stored, the built-in text, no saver and no time.
    expect(fromPromptWire({ core: 'c', houseRules: 'built-in', version: 0, savedBy: '', savedAt: '', note: '', maxLength: 4000 }).active).toEqual({
      version: 0,
      text: 'built-in',
      savedBy: null,
      savedAt: null,
      note: null,
      revertedFrom: null,
      defaultReadings: '',
    })
    // A bare or odd reply never throws.
    expect(fromPromptWire(null)).toEqual({
      core: '',
      active: { version: 0, text: '', savedBy: null, savedAt: null, note: null, revertedFrom: null, defaultReadings: '' },
      builtInDefaultReadings: '',
      defaultReadingsMaxLength: 2000,
    })
  })

  it('fromVersionWire_readsAHistoryRow', () => {
    expect(
      fromVersionWire({ version: 3, houseRules: 'v1 text', note: '  ', savedBy: 'a.curator', savedAt: '2026-11-06T10:00:00', revertedFrom: 1 }),
    ).toEqual({ version: 3, text: 'v1 text', savedBy: 'a.curator', savedAt: '2026-11-06T10:00:00', note: null, revertedFrom: 1, defaultReadings: '' })
    expect(fromVersionWire({ version: 2, houseRules: 'x', note: 'why', savedBy: 'b', savedAt: 's', revertedFrom: null }).note).toBe('why')
  })

  it('saveRequest_sendsTheTextAsHouseRules', () => {
    expect(saveRequest({ text: 'new rules', note: ' ', readings: '' }, 4, noBuiltIn)).toEqual({ houseRules: 'new rules', note: null, baseVersion: 4, defaultReadings: '' })
  })
})

describe('the default readings on the house-rules screen (ticket 874, BackOffice 3593)', () => {
  const frame = { builtInDefaultReadings: 'Sales means net sales.', defaultReadingsMaxLength: 2000 }

  it('fromPromptWire_carriesTheDefaultReadings_theBuiltInText_andTheirOwnLimit', () => {
    const wire = {
      core: 'c',
      houseRules: 'rules',
      version: 2,
      savedBy: 'a.curator',
      savedAt: '2026-11-06T09:00:00',
      note: '',
      maxLength: 4000,
      defaultReadings: 'Last month means the calendar month.',
      builtInDefaultReadings: 'Sales means net sales.',
      defaultReadingsMaxLength: 2000,
    }
    const p = fromPromptWire(wire)
    expect(p.active.defaultReadings).toBe('Last month means the calendar month.')
    expect(p.builtInDefaultReadings).toBe('Sales means net sales.')
    expect(p.defaultReadingsMaxLength).toBe(2000)
    // An older server or an odd reply: none of its own, no built-in text, the 2,000 limit.
    const bare = fromPromptWire(null)
    expect(bare.active.defaultReadings).toBe('')
    expect(bare.builtInDefaultReadings).toBe('')
    expect(bare.defaultReadingsMaxLength).toBe(2000)
  })

  it('draftOf_showsTheVersionsOwnReadings_orTheBuiltInTextWhenItHasNone', () => {
    expect(draftOf(v(2, { defaultReadings: 'Own readings.' }), frame)).toEqual({ text: 'rules 2', note: '', readings: 'Own readings.' })
    expect(draftOf(v(1), frame)).toEqual({ text: 'rules 1', note: '', readings: 'Sales means net sales.' })
  })

  it('historyRows_showEachVersionsDefaultReadings_theBuiltInTextWhenItHasNone', () => {
    const rows = historyRows([v(1), v(2, { defaultReadings: 'Own readings.' })], 2, frame)
    expect(rows.map((r) => [r.version, r.readings])).toEqual([
      [2, 'Own readings.'],
      [1, 'Sales means net sales.'],
    ])
  })

  it('saveRequest_carriesBothTextsAndTheBaseVersion_theBuiltInTextGoesBackAsNone', () => {
    expect(saveRequest({ text: 'new rules', note: 'why', readings: 'Own readings.' }, 4, frame)).toEqual({
      houseRules: 'new rules',
      note: 'why',
      baseVersion: 4,
      defaultReadings: 'Own readings.',
    })
    // Unchanged from the built-in text, or cleared: the version has none of its own (send "", not the built-in text).
    expect(saveRequest({ text: 'r', note: '', readings: 'Sales means net sales.' }, 4, frame).defaultReadings).toBe('')
    expect(saveRequest({ text: 'r', note: '', readings: '  \n' }, 4, frame).defaultReadings).toBe('')
  })

  it('isRulesDirty_andCanSaveRules_followAChangeToTheDefaultReadingsAlone', () => {
    const active = v(2, { defaultReadings: '' })
    const shown = draftOf(active, frame)
    expect(isRulesDirty(shown, active, frame)).toBe(false)
    const edited = { ...shown, readings: 'Own readings.' }
    expect(isRulesDirty(edited, active, frame)).toBe(true)
    expect(canSaveRules(edited, active, false, frame)).toBe(true)
  })

  it('mergeOffer_saveMineOnTop_carriesMyDefaultReadings', () => {
    const offer = mergeOffer(v(5, { defaultReadings: 'Theirs.' }), { text: 'mine', note: '', readings: 'Mine.' }, frame)
    expect(offer.theirs.readings).toBe('Theirs.')
    expect(offer.mine.readings).toBe('Mine.')
    expect(offer.saveMineOnTop).toEqual({ houseRules: 'mine', note: null, baseVersion: 5, defaultReadings: 'Mine.' })
  })

  it('tryRequest_carriesTheDraftDefaultReadingsWithTheDraftHouseRules', () => {
    expect(tryRequest({ text: 'draft rules', note: 'n', readings: 'Draft readings.' }, 'Sales last month?', frame)).toEqual({
      houseRules: 'draft rules',
      question: 'Sales last month?',
      defaultReadings: 'Draft readings.',
    })
    // Still the built-in text: the trial uses the built-in text.
    expect(tryRequest({ text: 'r', note: '', readings: 'Sales means net sales.' }, 'q', frame).defaultReadings).toBe('')
  })

  it('readingsTooLong_overTheirOwnTwoThousand_disablesTheSave_notTheHouseRulesFourThousand', () => {
    const active = v(2)
    expect(READINGS_MAX).toBe(2000)
    expect(readingsTooLong('a'.repeat(2000), frame)).toBe(false)
    expect(readingsTooLong('a'.repeat(2001), frame)).toBe(true)
    expect(canSaveRules({ text: 'rules 2', note: '', readings: 'a'.repeat(2000) }, active, false, frame)).toBe(true)
    expect(canSaveRules({ text: 'rules 2', note: '', readings: 'a'.repeat(2001) }, active, false, frame)).toBe(false)
    // The limit is the read door's, not the house rules' 4,000.
    expect(readingsTooLong('a'.repeat(2001), { ...frame, defaultReadingsMaxLength: 2500 })).toBe(false)
    expect(canSaveRules({ text: 'a'.repeat(4000), note: '', readings: 'b'.repeat(2000) }, active, false, frame)).toBe(true)
  })

  it('refusedField_aCopilot412NamingTheDefaultReadingsMarksThatField_noFieldIsTheHouseRules', () => {
    const refused = (code: string, data: unknown = null) =>
      new ApiError('business', 'too long', 400, [{ errorCode: code, errorMessage: 'too long' } as never], data)
    expect(refusedField(refused('COPILOT-412', { field: 'defaultReadings' }))).toBe('defaultReadings')
    expect(refusedField(refused('COPILOT-412'))).toBe('houseRules')
    expect(refusedField(refused('COPILOT-412', { other: 1 }))).toBe('houseRules')
    // A starter's path (875) is named as it came.
    expect(refusedField(refused('COPILOT-412', { field: 'starters.executive[0].proof' }))).toBe('starters.executive[0].proof')
    // Not a field refusal at all.
    expect(refusedField(refused('COPILOT-411', { field: 'defaultReadings' }))).toBeNull()
    expect(refusedField(new Error('x'))).toBeNull()
  })

  it('fromVersionWire_readsTheVersionsDefaultReadings_noneIsEmpty', () => {
    expect(fromVersionWire({ version: 3, houseRules: 'x', defaultReadings: 'Own.' }).defaultReadings).toBe('Own.')
    expect(fromVersionWire({ version: 3, houseRules: 'x' }).defaultReadings).toBe('')
  })
})
