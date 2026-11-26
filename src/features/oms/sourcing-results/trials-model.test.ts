import { describe, expect, it } from 'vitest'
import type { FactorTableReply, ResultsBeside, TrialRow, TrialsReply } from '@/core/models/sourcing-results'
import stub from './stub-trials.json'
import { besideCellText, besideView, factorTable, trialResult, trialStart, trialsList } from './trials-model'

// The drive's stub: four trials (one done on a trial set with refusals, one running, one waiting, one older), the
// factor table of the trial set's trial, and that trial read beside the candidate set.
const reply = stub as unknown as TrialsReply & { factors: FactorTableReply; beside: ResultsBeside }
const trial = (id: string): TrialRow => reply.trials.find((t) => t.trialId === id)!
const TRIAL_SET = '01JE2A5M4N3B2V1C0X9Z8L7K6J'

describe('trialsList — the list of trials', () => {
  it('lists the trials newest first, by when each was started', () => {
    expect(trialsList(reply).rows.map((r) => [r.set.name, r.set.version, r.state])).toEqual([
      ['Margin ×1.1', 1, 'WAITING'],
      ['Baseline', 2, 'RUNNING'],
      ['Dawaa Now reach 8 km', 1, 'DONE'],
      ['Baseline', 3, 'DONE'],
    ])
  })

  it('names the one trial running and how many wait behind it', () => {
    const list = trialsList(reply)
    expect(list.running?.set).toEqual({ name: 'Baseline', version: 2 })
    expect(list.waiting).toBe(1)
  })

  it('offers "open with this set beside it" only on a trial that is done', () => {
    expect(trialsList(reply).rows.map((r) => r.canOpenBeside)).toEqual([false, false, true, true])
  })

  it('reads an empty list as empty, with nobody running', () => {
    expect(trialsList({ ...reply, trials: [] })).toEqual({ rows: [], running: null, waiting: 0 })
  })
})

describe('trialResult — orders solved, refused by reason, failed', () => {
  it('reads the counts as sent', () => {
    const r = trialResult(trial(TRIAL_SET))
    expect([r.orders, r.solved, r.failed, r.leftOutNoPlan, r.refusedTotal]).toEqual([39870, 38372, 12, 66, 1420])
  })

  it('lists the refusals in the spec order, not the order sent', () => {
    expect(trialResult(trial(TRIAL_SET)).refused).toEqual([
      { reason: 'REACH_WIDER_THAN_READ', count: 1180 },
      { reason: 'STORE_NEVER_READ', count: 240 },
    ])
  })

  it('leaves out a reason with no order', () => {
    const t = { ...trial(TRIAL_SET), refused: [{ reason: 'MODE_SWITCHED_ON' as const, count: 0 }, { reason: 'STORE_NEVER_READ' as const, count: 240 }] }
    expect(trialResult(t).refused).toEqual([{ reason: 'STORE_NEVER_READ', count: 240 }])
  })

  it('checks that solved, refused, failed and left out add up to the orders of the period', () => {
    expect(trialResult(trial(TRIAL_SET)).addsUp).toBe(true)
    expect(trialResult({ ...trial(TRIAL_SET), solved: 38000 }).addsUp).toBe(false)
  })

  it('does not call a running trial\'s counts a result', () => {
    const running = trialResult(trial('01JE3B1H2G3F4D5S6A7P8O9I0U'))
    expect(running.done).toBe(false)
    expect(running.addsUp).toBe(true)
  })
})

describe('factorTable — each cost factor switched in turn', () => {
  it('lists the factors in the spec order, the store record measures together', () => {
    expect(factorTable(reply.factors).rows.map((r) => r.key)).toEqual([
      'SLOT_LOAD',
      'SLOT_TIMING',
      'STORE_RECORD:LATE',
      'STORE_RECORD:RETURNED',
      'STORE_RECORD:PICK_UP_CANCELLED',
      'COVER',
      'SHELF_CHANCE',
      'STORE_OWN_PART',
      'SHORT_FIGURE',
      'NAMED_STORE_STAYS',
      'COUNT_FACTOR',
    ])
  })

  it('reads each factor\'s changed plans as sent, the kinds in the comparison\'s order', () => {
    const shelf = factorTable(reply.factors).rows.find((r) => r.key === 'SHELF_CHANCE')!
    expect(shelf.changed).toEqual({ count: 3105, percent: 8.1 })
    expect(shelf.kinds).toEqual([
      { kind: 'ANOTHER_STORE', count: 2900 },
      { kind: 'MORE_SHIPMENTS', count: 205 },
    ])
  })

  it('says which factors change no plan in the period', () => {
    expect(factorTable(reply.factors).rows.filter((r) => r.changesNone).map((r) => r.key)).toEqual(['SLOT_TIMING', 'COUNT_FACTOR'])
  })

  it('keeps the count factor switched on, every other switched off', () => {
    expect(factorTable(reply.factors).rows.filter((r) => r.switched === 'ON').map((r) => r.key)).toEqual(['COUNT_FACTOR'])
  })

  it('has no rows before the factor table has run', () => {
    const t = factorTable({ trialId: TRIAL_SET, state: 'NOT_STARTED', plans: 0, rows: [] })
    expect([t.state, t.rows.length]).toEqual(['NOT_STARTED', 0])
  })
})

describe('trialStart — the form that starts a trial', () => {
  const set = { name: 'Margin ×1.1', version: 1 }

  it('asks for a saved version by name and number and a period of whole days', () => {
    expect(trialStart({ set, from: '2026-11-12', to: '2026-11-25' }, reply)).toEqual({
      request: { weightSet: 'Margin ×1.1', weightSetVersion: 1, from: '2026-11-12', to: '2026-11-25' },
      days: 14,
      problem: null,
    })
  })

  it('needs a version', () => {
    expect(trialStart({ set: null, from: '2026-11-12', to: '2026-11-25' }, reply)).toMatchObject({ request: null, problem: 'NO_VERSION' })
  })

  it('needs both days, the last not before the first', () => {
    expect(trialStart({ set, from: '', to: '2026-11-25' }, reply).problem).toBe('NO_PERIOD')
    expect(trialStart({ set, from: '2026-11-25', to: '2026-11-12' }, reply).problem).toBe('ENDS_BEFORE_START')
  })

  it('refuses more than 30 days; 30 is allowed', () => {
    expect(trialStart({ set, from: '2026-10-27', to: '2026-11-25' }, reply)).toMatchObject({ days: 30, problem: null })
    expect(trialStart({ set, from: '2026-10-26', to: '2026-11-25' }, reply)).toMatchObject({ days: 31, problem: 'TOO_LONG', request: null })
  })

  it('keeps the period inside the days runs are kept, and before today', () => {
    expect(trialStart({ set, from: '2026-08-28', to: '2026-09-10' }, reply).problem).toBe('BEFORE_KEPT')
    expect(trialStart({ set, from: '2026-11-20', to: '2026-11-27' }, reply).problem).toBe('NOT_ENDED')
  })
})

describe('besideView — the tried set beside the candidate set', () => {
  const view = besideView(reply.beside)

  it('names the set beside it, its period and the orders left out of both', () => {
    expect([view.set, view.trialSet, view.period, view.leftOut]).toEqual([
      { name: 'Dawaa Now reach 8 km', version: 1, trial: true },
      true,
      { from: '2026-11-12', to: '2026-11-25' },
      1420,
    ])
  })

  it('draws the thin second bar from the set against what happened, in the spec order', () => {
    expect(view.bar.segments.map((s) => [s.segment, s.count])).toEqual([
      ['SAME_PLAN', 25110],
      ['SAME_STORES_OTHER_WAY', 3890],
      ['ANOTHER_STORE', 6000],
      ['CALLOUT_FALLBACK', 420],
      ['OUTSIDE_RULES', 1050],
      ['NOT_COMPARABLE', 1980],
    ])
    expect([view.bar.sentence.planPercent, view.bar.sentence.storesPercent, view.bar.addsUp]).toEqual([65.3, 75.4, true])
  })

  it('lists the plans that differ between the two sets by kind, in the comparison\'s order', () => {
    expect(view.differ.share).toEqual({ count: 4210, percent: 10.9 })
    expect(view.differ.kinds.map((k) => [k.kind, k.count])).toEqual([
      ['ANOTHER_STORE', 2630],
      ['ANOTHER_MODE', 1310],
      ['FEWER_SHIPMENTS', 180],
      ['MORE_SHIPMENTS', 90],
    ])
  })

  it('reads the promise check under the set beside it against the band', () => {
    expect(view.promise.map((r) => [r.key, r.percent, r.state])).toEqual([
      ['DAWAA_NOW', 86.9, 'inside'],
      ['SLOT', 93.8, 'inside'],
      ['PICK_UP:APP_SITE', 74.5, 'target'],
      ['PICK_UP:CALL_CENTRE', 56.0, 'target'],
    ])
  })

  it('gives the breakdowns\' one more column its figure as sent, nothing when the row has none', () => {
    expect(besideCellText({ samePlan: { count: 120, percent: 61.2 } })).toBe('61.2%')
    expect(besideCellText(null)).toBe('')
    expect(besideCellText(undefined)).toBe('')
  })
})
