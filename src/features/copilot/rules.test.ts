import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { CopilotAnswer, CopilotPromptVersion } from '@/core/models/copilot'
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
  trialProof,
  applyTrial,
  editStarter,
  starterIssue,
  canAddStarter,
  addStarter,
  starterOfField,
  removeStarter,
  trialIsOf,
  trialOf,
  type StarterDraft,
  type StartersDraft,
} from './rules'

/** The starters without their client-only ids, to compare by content. */
const bare = (s: StartersDraft) => ({
  executive: s.executive.map(({ en, ar, blank, proof }) => ({ en, ar, blank, proof })),
  operations: s.operations.map(({ en, ar, blank, proof }) => ({ en, ar, blank, proof })),
})

/** No starters (the 875 switch off in the frames of 790 and 874). */
const NONE: StartersDraft = { executive: [], operations: [] }
const switchOff = { startersOn: false, startersPerKind: 6, starterMaxLength: 200 }
const noBuiltIn = { builtInDefaultReadings: '', defaultReadingsMaxLength: 2000, ...switchOff }

const v = (version: number, over: Partial<CopilotPromptVersion> = {}): CopilotPromptVersion => ({
  version,
  text: `rules ${version}`,
  savedBy: 'a.curator',
  savedAt: '2026-11-06T09:00:00',
  note: null,
  revertedFrom: null,
  defaultReadings: '',
  starters: { executive: [], operations: [] },
  ...over,
})

describe('the house-rules editor (ticket 790)', () => {
  it('isRulesDirty_whenTheTextOrTheNoteChanged', () => {
    const active = v(1)
    expect(isRulesDirty({ text: 'rules 1', note: '', readings: '', starters: NONE }, active, noBuiltIn)).toBe(false)
    expect(isRulesDirty({ text: 'rules 1 and more', note: '', readings: '', starters: NONE }, active, noBuiltIn)).toBe(true)
    expect(isRulesDirty({ text: 'rules 1', note: 'tables', readings: '', starters: NONE }, active, noBuiltIn)).toBe(true)
    // A blank note is no note.
    expect(isRulesDirty({ text: 'rules 1', note: '   ', readings: '', starters: NONE }, active, noBuiltIn)).toBe(false)
    // Nothing loaded yet: nothing to lose.
    expect(isRulesDirty({ text: 'x', note: '', readings: '', starters: NONE }, null, noBuiltIn)).toBe(false)
  })

  it('canSaveRules_dirtyNotBlankAtMostFourThousandNothingInFlight', () => {
    const active = v(1)
    expect(RULES_MAX).toBe(4000)
    expect(canSaveRules({ text: 'new', note: '', readings: '', starters: NONE }, active, false, noBuiltIn)).toBe(true)
    // Unchanged.
    expect(canSaveRules({ text: 'rules 1', note: '', readings: '', starters: NONE }, active, false, noBuiltIn)).toBe(false)
    // Blank.
    expect(canSaveRules({ text: '   \n', note: 'cleared', readings: '', starters: NONE }, active, false, noBuiltIn)).toBe(false)
    // At the limit, and one over.
    expect(canSaveRules({ text: 'a'.repeat(4000), note: '', readings: '', starters: NONE }, active, false, noBuiltIn)).toBe(true)
    expect(canSaveRules({ text: 'a'.repeat(4001), note: '', readings: '', starters: NONE }, active, false, noBuiltIn)).toBe(false)
    expect(rulesTooLong('a'.repeat(4001))).toBe(true)
    expect(rulesTooLong('a'.repeat(4000))).toBe(false)
    // A save or a restore already out.
    expect(canSaveRules({ text: 'new', note: '', readings: '', starters: NONE }, active, true, noBuiltIn)).toBe(false)
    // Nothing loaded.
    expect(canSaveRules({ text: 'new', note: '', readings: '', starters: NONE }, null, false, noBuiltIn)).toBe(false)
  })

  it('mergeOffer_showsTheirsAndMine_andSavesMineOnTheirVersion', () => {
    const theirs = v(4, { text: 'their rules', savedBy: 'b.curator', note: 'tables' })
    const sent = saveRequest({ text: 'my rules', note: 'markdown', readings: '', starters: NONE }, v(3), noBuiltIn)
    const offer = mergeOffer(theirs, sent, noBuiltIn)
    expect(offer.theirs).toEqual({ version: 4, text: 'their rules', readings: '', starters: NONE, savedBy: 'b.curator', savedAt: '2026-11-06T09:00:00' })
    expect(offer.mine).toEqual({ text: 'my rules', note: 'markdown', readings: '', starters: NONE })
    // "Save mine on top" re-posts mine on their version.
    expect(offer.saveMineOnTop).toEqual({ houseRules: 'my rules', note: 'markdown', baseVersion: 4, defaultReadings: '' })
    // A blank note was sent as none, and is again.
    const blankNote = saveRequest({ text: 'my rules', note: ' ', readings: '', starters: NONE }, v(3), noBuiltIn)
    expect(mergeOffer(theirs, blankNote, noBuiltIn).saveMineOnTop.note).toBeNull()
  })

  it('historyRows_newestFirst_twenty_revertedFromAndTheActiveMark', () => {
    const history = [v(1), v(3, { revertedFrom: 1 }), v(2, { note: 'rule 12' })]
    expect(historyRows(history, 3, noBuiltIn)).toEqual([
      { version: 3, savedBy: 'a.curator', savedAt: '2026-11-06T09:00:00', note: null, revertedFrom: 1, active: true, text: 'rules 3', readings: '', starters: NONE },
      { version: 2, savedBy: 'a.curator', savedAt: '2026-11-06T09:00:00', note: 'rule 12', revertedFrom: null, active: false, text: 'rules 2', readings: '', starters: NONE },
      { version: 1, savedBy: 'a.curator', savedAt: '2026-11-06T09:00:00', note: null, revertedFrom: null, active: false, text: 'rules 1', readings: '', starters: NONE },
    ])
    const many = Array.from({ length: 25 }, (_, i) => v(i + 1))
    const rows = historyRows(many, 25, noBuiltIn)
    expect(rows).toHaveLength(20)
    expect(rows[0].version).toBe(25)
    expect(rows[19].version).toBe(6)
    // A blank note reads as none; an odd reply reads as no history.
    expect(historyRows([fromVersionWire({ version: 1, houseRules: 'r', note: '  ' })], 1, noBuiltIn)[0].note).toBeNull()
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
      active: { version: 1, text: '- Rule 8\n- Rule 12', savedBy: 'seed', savedAt: '2026-11-06T09:00:00', note: null, revertedFrom: null, defaultReadings: '', starters: NONE },
      builtInDefaultReadings: '',
      defaultReadingsMaxLength: 2000,
      ...switchOff,
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
      starters: NONE,
    })
    // A bare or odd reply never throws.
    expect(fromPromptWire(null)).toEqual({
      core: '',
      active: { version: 0, text: '', savedBy: null, savedAt: null, note: null, revertedFrom: null, defaultReadings: '', starters: NONE },
      builtInDefaultReadings: '',
      defaultReadingsMaxLength: 2000,
      ...switchOff,
    })
  })

  it('fromVersionWire_readsAHistoryRow', () => {
    expect(
      fromVersionWire({ version: 3, houseRules: 'v1 text', note: '  ', savedBy: 'a.curator', savedAt: '2026-11-06T10:00:00', revertedFrom: 1 }),
    ).toEqual({ version: 3, text: 'v1 text', savedBy: 'a.curator', savedAt: '2026-11-06T10:00:00', note: null, revertedFrom: 1, defaultReadings: '', starters: NONE })
    expect(fromVersionWire({ version: 2, houseRules: 'x', note: 'why', savedBy: 'b', savedAt: 's', revertedFrom: null }).note).toBe('why')
  })

  it('saveRequest_sendsTheTextAsHouseRules', () => {
    expect(saveRequest({ text: 'new rules', note: ' ', readings: '', starters: NONE }, v(4), noBuiltIn)).toEqual({ houseRules: 'new rules', note: null, baseVersion: 4, defaultReadings: '' })
  })
})

describe('the default readings on the house-rules screen (ticket 874, BackOffice 3593)', () => {
  const frame = { builtInDefaultReadings: 'Sales means net sales.', defaultReadingsMaxLength: 2000, ...switchOff }

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
    expect(draftOf(v(2, { defaultReadings: 'Own readings.' }), frame)).toEqual({ text: 'rules 2', note: '', readings: 'Own readings.', starters: NONE })
    expect(draftOf(v(1), frame)).toEqual({ text: 'rules 1', note: '', readings: 'Sales means net sales.', starters: NONE })
  })

  it('historyRows_showEachVersionsDefaultReadings_theBuiltInTextWhenItHasNone', () => {
    const rows = historyRows([v(1), v(2, { defaultReadings: 'Own readings.' })], 2, frame)
    expect(rows.map((r) => [r.version, r.readings])).toEqual([
      [2, 'Own readings.'],
      [1, 'Sales means net sales.'],
    ])
  })

  it('saveRequest_carriesBothTextsAndTheBaseVersion_theBuiltInTextGoesBackAsNone', () => {
    expect(saveRequest({ text: 'new rules', note: 'why', readings: 'Own readings.', starters: NONE }, v(4), frame)).toEqual({
      houseRules: 'new rules',
      note: 'why',
      baseVersion: 4,
      defaultReadings: 'Own readings.',
    })
    // Unchanged from the built-in text, or cleared: the version has none of its own (send "", not the built-in text).
    expect(saveRequest({ text: 'r', note: '', readings: 'Sales means net sales.', starters: NONE }, v(4), frame).defaultReadings).toBe('')
    expect(saveRequest({ text: 'r', note: '', readings: '  \n', starters: NONE }, v(4), frame).defaultReadings).toBe('')
  })

  it('aVersionWhoseOwnReadingsAreTheBuiltInText_isCleanOnLoad_andASaveKeepsThem (3586 review item 5)', () => {
    const own = v(3, { defaultReadings: 'Sales means net sales.' })
    const shown = draftOf(own, frame)
    expect(shown.readings).toBe('Sales means net sales.')
    // Not dirty as loaded.
    expect(isRulesDirty(shown, own, frame)).toBe(false)
    // A save for another reason sends its own readings as they are, never "" (which would wipe them).
    expect(saveRequest({ ...shown, text: 'changed' }, own, frame).defaultReadings).toBe('Sales means net sales.')
    // Cleared by the curator: none of its own.
    expect(saveRequest({ ...shown, readings: ' ' }, own, frame).defaultReadings).toBe('')
  })

  it('isRulesDirty_andCanSaveRules_followAChangeToTheDefaultReadingsAlone', () => {
    const active = v(2, { defaultReadings: '' })
    const shown = draftOf(active, frame)
    expect(isRulesDirty(shown, active, frame)).toBe(false)
    const edited = { ...shown, readings: 'Own readings.', starters: NONE }
    expect(isRulesDirty(edited, active, frame)).toBe(true)
    expect(canSaveRules(edited, active, false, frame)).toBe(true)
  })

  it('mergeOffer_saveMineOnTop_carriesMyDefaultReadings', () => {
    const sent = saveRequest({ text: 'mine', note: '', readings: 'Mine.', starters: NONE }, v(4), frame)
    const offer = mergeOffer(v(5, { defaultReadings: 'Theirs.' }), sent, frame)
    expect(offer.theirs.readings).toBe('Theirs.')
    expect(offer.mine.readings).toBe('Mine.')
    expect(offer.saveMineOnTop).toEqual({ houseRules: 'mine', note: null, baseVersion: 5, defaultReadings: 'Mine.' })
    // Mine had none of its own (shown as the built-in text): theirs having their own does not make mine store it.
    const none = saveRequest({ text: 'mine', note: '', readings: 'Sales means net sales.', starters: NONE }, v(4), frame)
    const onTop = mergeOffer(v(5, { defaultReadings: 'Theirs.' }), none, frame)
    expect(onTop.mine.readings).toBe('Sales means net sales.')
    expect(onTop.saveMineOnTop.defaultReadings).toBe('')
  })

  it('mergeOffer_showsTheirStartersBesideMine_sinceSaveMineOnTopReplacesThem (3586 review item 4)', () => {
    const on = { ...frame, startersOn: true }
    const theirs = v(5, { starters: { executive: [{ question: { en: 'Their question?', ar: 'سؤالهم؟' }, blank: true }], operations: [] } })
    const mine: StartersDraft = { executive: [], operations: [{ id: 'm', en: 'My question?', ar: 'سؤالي؟', blank: true, proof: null }] }
    const offer = mergeOffer(theirs, saveRequest({ text: 'mine', note: '', readings: 'Mine.', starters: mine }, v(4), on), on)
    expect(bare(offer.theirs.starters)).toEqual({ executive: [{ en: 'Their question?', ar: 'سؤالهم؟', blank: true, proof: null }], operations: [] })
    expect(bare(offer.mine.starters)).toEqual(bare(mine))
    expect(offer.saveMineOnTop.starters).toEqual({ executive: [], operations: [{ question: { en: 'My question?', ar: 'سؤالي؟' }, blank: true }] })
  })

  it('tryRequest_carriesTheDraftDefaultReadingsWithTheDraftHouseRules', () => {
    expect(tryRequest({ text: 'draft rules', note: 'n', readings: 'Draft readings.', starters: NONE }, 'Sales last month?', frame)).toEqual({
      houseRules: 'draft rules',
      question: 'Sales last month?',
      defaultReadings: 'Draft readings.',
    })
    // Still the built-in text: the trial uses the built-in text.
    expect(tryRequest({ text: 'r', note: '', readings: 'Sales means net sales.', starters: NONE }, 'q', frame).defaultReadings).toBe('')
  })

  it('readingsTooLong_overTheirOwnTwoThousand_disablesTheSave_notTheHouseRulesFourThousand', () => {
    const active = v(2)
    expect(READINGS_MAX).toBe(2000)
    expect(readingsTooLong('a'.repeat(2000), frame)).toBe(false)
    expect(readingsTooLong('a'.repeat(2001), frame)).toBe(true)
    expect(canSaveRules({ text: 'rules 2', note: '', readings: 'a'.repeat(2000), starters: NONE }, active, false, frame)).toBe(true)
    expect(canSaveRules({ text: 'rules 2', note: '', readings: 'a'.repeat(2001), starters: NONE }, active, false, frame)).toBe(false)
    // The limit is the read door's, not the house rules' 4,000.
    expect(readingsTooLong('a'.repeat(2001), { ...frame, defaultReadingsMaxLength: 2500 })).toBe(false)
    expect(canSaveRules({ text: 'a'.repeat(4000), note: '', readings: 'b'.repeat(2000), starters: NONE }, active, false, frame)).toBe(true)
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

describe('the starters on the house-rules screen (ticket 875, BackOffice 3600)', () => {
  const call = (tool: string, input: Record<string, unknown>, ok = true) => ({ tool, input, rows: 3, ms: 40, ok })
  const answer = (over: Partial<CopilotAnswer> = {}): CopilotAnswer => ({
    conversationId: '',
    questionNo: 1,
    answer: 'Sales were 1,200.',
    orderRefs: [],
    trace: [],
    outcome: 'answered',
    stoppedEarly: false,
    servedBy: 'test',
    askedAt: '2026-11-12T09:00:00',
    ...over,
  })
  let ids = 0
  const starter = (en: string, over: Partial<StarterDraft> = {}): StarterDraft => ({ id: `t${++ids}`, en, ar: `${en} (ar)`, blank: false, proof: null, ...over })

  it('trialProof_keepsTheLastSuccessfulToolCall_noLookupOrCannotAnswerKeepsNone', () => {
    const answered = answer({
      trace: [call('sales_summary', { from: '2026-11-01' }), call('semantic_query', { measure: 'net' }), call('semantic_query', { measure: 'bad' }, false)],
    })
    expect(trialProof(answered)).toEqual({ tool: 'semantic_query', input: { measure: 'net' } })
    // Answered with no lookup.
    expect(trialProof(answer({ trace: [] }))).toBeNull()
    // "Can't answer", even with a call made.
    expect(trialProof(answer({ outcome: 'cannot-answer', trace: [call('sales_summary', {})] }))).toBeNull()
    // Only failed calls.
    expect(trialProof(answer({ trace: [call('sales_summary', {}, false)] }))).toBeNull()
  })

  it('trialProof_aMissingOutcomeIsAnAnswer_asThePanelReadsIt (3586 review item 6)', () => {
    const noOutcome = { ...answer({ trace: [call('sales_summary', { from: '2026-11-01' })] }), outcome: undefined } as unknown as CopilotAnswer
    expect(trialProof(noOutcome)).toEqual({ tool: 'sales_summary', input: { from: '2026-11-01' } })
  })

  it('applyTrial_setsTheTriedStartersProof_onlyWhileItsTextIsTheOneTried', () => {
    const starters: StartersDraft = { executive: [starter('Sales this month?')], operations: [starter('Late deliveries?')] }
    const tried = answer({ trace: [call('sales_summary', { from: '2026-11-01' })] })
    const trial = trialOf('executive', starters.executive[0])
    const after = applyTrial(starters, trial, tried)
    expect(after.executive[0].proof).toEqual({ tool: 'sales_summary', input: { from: '2026-11-01' } })
    expect(after.operations[0].proof).toBeNull()
    // A try that keeps none takes a proof away.
    expect(applyTrial(after, trial, answer()).executive[0].proof).toBeNull()
    // The text changed while the try was out, in either language: the answer is not about it.
    expect(applyTrial(editStarter(starters, 'executive', 0, { en: 'Sales last month?' }), trial, tried).executive[0].proof).toBeNull()
    expect(applyTrial(editStarter(starters, 'executive', 0, { ar: 'other' }), trial, tried).executive[0].proof).toBeNull()
  })

  it('aTrysAnswer_followsItsStarter_throughARemovalAbove_andGoesWithItsEdit (3586 review item 3)', () => {
    const first = starter('Sales this month?')
    const second = starter('Sales last month?')
    const starters: StartersDraft = { executive: [first, second], operations: [] }
    const tried = answer({ trace: [call('sales_summary', { from: '2026-10-01' })] })
    const trial = trialOf('executive', second)
    // The first is removed while the second's try is out: the answer lands on the second, now at index 0.
    const after = applyTrial(removeStarter(starters, 'executive', 0), trial, tried)
    expect(after.executive.map((s) => [s.en, s.proof?.tool ?? null])).toEqual([['Sales last month?', 'sales_summary']])
    // The shown answer belongs to that starter wherever it sits, and to no other in its old place.
    expect(trialIsOf(trial, after.executive[0])).toBe(true)
    expect(trialIsOf(trial, first)).toBe(false)
    // The tried starter itself removed: the answer goes nowhere.
    expect(applyTrial(removeStarter(starters, 'executive', 1), trial, tried)).toEqual(removeStarter(starters, 'executive', 1))
    // Its text edited: the answer and its "no proof kept" note are no longer shown for it.
    expect(trialIsOf(trial, editStarter(after, 'executive', 0, { en: 'Sales last week?' }).executive[0])).toBe(false)
    expect(trialIsOf(trial, editStarter(after, 'executive', 0, { ar: 'other' }).executive[0])).toBe(false)
    // The blank mark is not its text.
    expect(trialIsOf(trial, editStarter(after, 'executive', 0, { blank: true }).executive[0])).toBe(true)
    // None tried: nothing shown.
    expect(trialIsOf(undefined, second)).toBe(false)
  })

  it('editStarter_aTextChangeInEitherLanguageClearsTheProof_anUnchangedTextKeepsIt', () => {
    const proof = { tool: 'sales_summary', input: { from: '2026-11-01' } }
    const starters: StartersDraft = { executive: [starter('Sales this month?', { proof })], operations: [starter('Late?', { proof })] }
    expect(editStarter(starters, 'executive', 0, { en: 'Sales this week?' }).executive[0]).toEqual({
      id: starters.executive[0].id,
      en: 'Sales this week?',
      ar: 'Sales this month? (ar)',
      blank: false,
      proof: null,
    })
    expect(editStarter(starters, 'executive', 0, { ar: 'other' }).executive[0].proof).toBeNull()
    // The other starters keep theirs.
    expect(editStarter(starters, 'executive', 0, { ar: 'other' }).operations[0].proof).toEqual(proof)
    // The same text typed again, or the blank mark, is no text change.
    expect(editStarter(starters, 'executive', 0, { en: 'Sales this month?' }).executive[0].proof).toEqual(proof)
    expect(editStarter(starters, 'executive', 0, { blank: true }).executive[0]).toEqual({ ...starters.executive[0], blank: true })
  })

  const on = { builtInDefaultReadings: '', defaultReadingsMaxLength: 2000, startersOn: true, startersPerKind: 6, starterMaxLength: 200 }
  const proof = { tool: 'sales_summary', input: { from: '2026-11-01' } }

  it('starterIssue_blocksTheSaveWhileAStarterHasNoProof_namingIt_aStarterWithABlankIsExempt', () => {
    const active = v(1)
    const starters: StartersDraft = {
      executive: [starter('Sales this month?', { proof })],
      operations: [starter('Late deliveries?', { proof }), starter('Where is order ___?', { blank: true }), starter('Returns today?')],
    }
    const draft = { text: 'rules 1', note: '', readings: '', starters }
    // The third operations starter, counted from 1 on the screen, 0 here.
    expect(starterIssue(starters, on)).toEqual({ kind: 'operations', index: 2, problem: 'unproven' })
    expect(canSaveRules(draft, active, false, on)).toBe(false)
    // Tried: the save opens; the blank one never needed a proof.
    const proven = { ...draft, starters: { ...starters, operations: [starters.operations[0], starters.operations[1], { ...starters.operations[2], proof }] } }
    expect(starterIssue(proven.starters, on)).toBeNull()
    expect(canSaveRules(proven, active, false, on)).toBe(true)
  })

  it('addStarter_aSeventhForOneKindCannotBeAdded_201CharactersOrAMissingLanguageBlocksTheSave', () => {
    const six = Array.from({ length: 6 }, (_, i) => starter(`Question ${i + 1}?`, { proof }))
    const full: StartersDraft = { executive: six, operations: [] }
    expect(canAddStarter(full, 'executive', on)).toBe(false)
    expect(addStarter(full, 'executive', on)).toBe(full)
    // The other kind still has room; a new starter is empty, unmarked and unproven.
    expect(canAddStarter(full, 'operations', on)).toBe(true)
    expect(bare(addStarter(full, 'operations', on)).operations).toEqual([{ en: '', ar: '', blank: false, proof: null }])

    const active = v(1)
    const one = (s: StarterDraft): StartersDraft => ({ executive: [], operations: [s] })
    // 200 characters after trimming is the limit; 201 is over it, in either language.
    expect(starterIssue(one(starter('a'.repeat(200), { ar: ` ${'b'.repeat(200)} `, proof })), on)).toBeNull()
    expect(starterIssue(one(starter('a'.repeat(201), { proof })), on)).toEqual({ kind: 'operations', index: 0, problem: 'tooLong', lang: 'en' })
    expect(starterIssue(one(starter('q?', { ar: 'b'.repeat(201), proof })), on)).toEqual({ kind: 'operations', index: 0, problem: 'tooLong', lang: 'ar' })
    // A missing (or blank) language, even on a starter with a blank for the reader.
    expect(starterIssue(one(starter('q?', { ar: '  ', proof })), on)).toEqual({ kind: 'operations', index: 0, problem: 'missing', lang: 'ar' })
    expect(starterIssue(one(starter('', { blank: true })), on)).toEqual({ kind: 'operations', index: 0, problem: 'missing', lang: 'en' })
    expect(canSaveRules({ text: 'rules 1', note: '', readings: '', starters: one(starter('a'.repeat(201), { proof })) }, active, false, on)).toBe(false)
    // The limit is the read door's.
    expect(starterIssue(one(starter('a'.repeat(201), { proof })), { ...on, starterMaxLength: 250 })).toBeNull()
  })

  it('saveRequest_carriesEveryStarterWithItsProof_besideTheTwoTexts', () => {
    const starters: StartersDraft = {
      executive: [starter(' Sales this month? ', { ar: 'كيف المبيعات هذا الشهر؟', proof })],
      operations: [starter('Where is order ___?', { ar: 'أين الطلب ___؟', blank: true })],
    }
    expect(saveRequest({ text: 'new rules', note: 'starters', readings: 'Own.', starters }, v(4), on)).toEqual({
      houseRules: 'new rules',
      note: 'starters',
      baseVersion: 4,
      defaultReadings: 'Own.',
      starters: {
        executive: [{ question: { en: 'Sales this month?', ar: 'كيف المبيعات هذا الشهر؟' }, blank: false, proof }],
        // A starter with a blank goes without a proof.
        operations: [{ question: { en: 'Where is order ___?', ar: 'أين الطلب ___؟' }, blank: true }],
      },
    })
    // None: two empty lists, so the new version has none.
    expect(saveRequest({ text: 'r', note: '', readings: '', starters: NONE }, v(4), on).starters).toEqual({ executive: [], operations: [] })
    // The switch off: no starters at all, and the server keeps the ones it cannot show.
    expect(saveRequest({ text: 'r', note: '', readings: '', starters }, v(4), noBuiltIn)).not.toHaveProperty('starters')
  })

  it('aStoredStartersProof_comesBackUnchangedOnASave_andTheHistoryShowsAndRestoresTheStarters', () => {
    const stored = {
      executive: [{ question: { en: 'Sales this month?', ar: 'المبيعات؟' }, blank: false, proof }],
      operations: [{ question: { en: 'Order ___?', ar: 'الطلب ___؟' }, blank: true }],
    }
    const prompt = fromPromptWire({ core: 'c', houseRules: 'r', version: 3, starters: stored, startersPerKind: 6, starterMaxLength: 200 })
    expect(prompt.startersOn).toBe(true)
    const draft = draftOf(prompt.active, prompt)
    expect(bare(draft.starters)).toEqual({
      executive: [{ en: 'Sales this month?', ar: 'المبيعات؟', blank: false, proof }],
      operations: [{ en: 'Order ___?', ar: 'الطلب ___؟', blank: true, proof: null }],
    })
    // Untouched: not dirty, and a save for the note alone sends the stored proof back as it came.
    expect(isRulesDirty(draft, prompt.active, prompt)).toBe(false)
    expect(saveRequest({ ...draft, note: 'why' }, prompt.active, prompt).starters).toEqual(stored)
    // An older server or the switch off: no starters, the default limits.
    expect(fromPromptWire({ core: 'c', houseRules: 'r', version: 3 })).toMatchObject({ startersOn: false, startersPerKind: 6, starterMaxLength: 200 })
    expect(fromPromptWire({ core: 'c', houseRules: 'r', version: 3 }).active.starters).toEqual({ executive: [], operations: [] })

    // The history shows each version's starters; a restore's reply opens with them.
    const rows = historyRows([fromVersionWire({ version: 2, houseRules: 'old', starters: stored }), fromVersionWire({ version: 3, houseRules: 'r' })], 3, prompt)
    expect(rows.map((r) => [r.version, r.starters.executive.map((s) => s.en)])).toEqual([
      [3, []],
      [2, ['Sales this month?']],
    ])
    const restored = fromVersionWire({ version: 4, houseRules: 'old', revertedFrom: 2, starters: stored })
    expect(bare(draftOf(restored, prompt).starters)).toEqual(bare(draft.starters))
  })

  it('starterOfField_aRefusalNamingAStarterMarksThatStarter_orItsKindsList', () => {
    expect(starterOfField('starters.executive[0].proof')).toEqual({ kind: 'executive', index: 0 })
    expect(starterOfField('starters.operations[3].question.ar')).toEqual({ kind: 'operations', index: 3 })
    expect(starterOfField('starters.operations[1]')).toEqual({ kind: 'operations', index: 1 })
    // Over 6 for the kind: the list, not one starter.
    expect(starterOfField('starters.executive')).toEqual({ kind: 'executive', index: null })
    // Not a starter.
    expect(starterOfField('defaultReadings')).toBeNull()
    expect(starterOfField('houseRules')).toBeNull()
    expect(starterOfField('starters.managers[0]')).toBeNull()
    expect(starterOfField(null)).toBeNull()
  })
})
