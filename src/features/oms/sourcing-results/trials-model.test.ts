import { describe, expect, it } from 'vitest'
import type { FactorTableReply, TrialReply, TrialsBeside } from '@/core/models/sourcing-results'
import stub from './stub-trials.json'
import { besideView, candidateTrialFor, factorTable, trialResult, trialStart, trialsList } from './trials-model'

// BO 4394, record JSON: `GET SourcingAdvisor/Trials` (five trials: one waiting, one running, a trial set done, the
// candidate set done over the same period, one failed), the trial set's factor table, and the two read side by side.
const trials = stub.trials as unknown as TrialReply[]
const table = stub.factorTable as unknown as FactorTableReply
const beside = stub.beside as unknown as TrialsBeside
const trial = (id: string): TrialReply => trials.find((t) => t.trialId === id)!
const TRIAL_SET = '01JE2A5M4N3B2V1C0X9Z8L7K6J'
const CANDIDATE = '01JE1Z9Y8X7W6V5T4S3R2Q1P0N'

describe('trialsList — the list of trials', () => {
  it('lists the trials newest first, by when each was added', () => {
    expect(trialsList(trials).rows.map((r) => [r.name, r.version, r.state])).toEqual([
      ['Margin ×1.1', 1, 'WAITING'],
      ['Baseline', 2, 'RUNNING'],
      ['Dawaa Now reach 8 km', 1, 'DONE'],
      ['Baseline', 3, 'DONE'],
      ['Baseline', 2, 'FAILED'],
    ])
  })

  it('names the one trial running and how many wait behind it', () => {
    const list = trialsList(trials)
    expect(list.running?.trialId).toBe('01JE3C1B2N3M4K5J6H7G8F9D0S')
    expect(list.waiting).toBe(1)
  })

  it('offers "open with this set beside it" only on a done trial of a set other than the candidate it ran beside', () => {
    expect(trialsList(trials).rows.map((r) => r.canOpenBeside)).toEqual([false, false, true, false, false])
  })

  it('leaves out a factor table\'s own rows, which are trials too', () => {
    const row = { ...trial(TRIAL_SET), trialId: 'X', factorOff: 'COVER', factorTableOf: TRIAL_SET }
    expect(trialsList([...trials, row]).rows.map((r) => r.trialId)).not.toContain('X')
  })
})

describe('trialResult — orders solved, refused by reason, failed', () => {
  it('reads the counts as sent', () => {
    const r = trialResult(trial(TRIAL_SET))
    expect([r.orders, r.solved, r.refusedTotal, r.noPlan, r.notEnded, r.failed]).toEqual([39870, 38372, 1420, 66, 0, 12])
  })

  it('lists the refusals in the server\'s order, not the order sent', () => {
    expect(trialResult(trial(TRIAL_SET)).refused).toEqual([
      { reason: 'NEEDS_WIDER_READ', count: 1180 },
      { reason: 'STORE_NOT_READ', count: 240 },
    ])
  })

  it('checks that solved, refused, no plan, not ended and failed add up to the orders of the period', () => {
    expect(trialResult(trial(TRIAL_SET)).addsUp).toBe(true)
    expect(trialResult({ ...trial(TRIAL_SET), solved: 38000 }).addsUp).toBe(false)
  })

  it('does not call a running trial\'s counts a result, and lets them fall short of the whole', () => {
    const r = trialResult(trial('01JE3C1B2N3M4K5J6H7G8F9D0S'))
    expect(r.done).toBe(false)
    expect(r.addsUp).toBe(true)
  })
})

describe('factorTable — the plans each factor changes', () => {
  it('lists the fifteen factors in the server\'s order with the plans changed and their share as sent', () => {
    const t = factorTable(table)
    expect(t.rows).toHaveLength(15)
    expect(t.rows[0]).toMatchObject({ factor: 'SLOT_LOAD', state: 'DONE', compared: 38300, changed: 1840, share: 4.8 })
  })

  it('lists the kinds of change in the comparison\'s order, a kind with no plan left out', () => {
    expect(factorTable(table).rows.find((r) => r.factor === 'COVER')!.kinds).toEqual([
      { kind: 'ANOTHER_STORE', count: 1900 },
      { kind: 'FEWER_SHIPMENTS', count: 310 },
      { kind: 'MORE_SHIPMENTS', count: 150 },
    ])
  })

  it('says a finished factor that changes no plan earns nothing, and a factor still running is not read', () => {
    const rows = factorTable(table).rows
    expect(rows.find((r) => r.factor === 'NAMED_STORE_STAYS')!.changesNone).toBe(true)
    expect(rows.find((r) => r.factor === 'COUNT_FACTOR_ON')).toMatchObject({ state: 'RUNNING', changesNone: false })
  })

  it('says whether the table was started at all', () => {
    expect(factorTable(table).started).toBe(true)
    expect(factorTable({ ...table, rows: table.rows.map((r) => ({ ...r, state: '' as const, trialId: '' })) }).started).toBe(false)
  })
})

describe('trialStart — the form that starts a trial', () => {
  const today = '2026-11-27'
  const form = { name: 'Margin ×1.1', version: 1, from: '2026-11-13', to: '2026-11-26' }

  it('asks for a saved version and whole local days, as the server reads them', () => {
    expect(trialStart(form, today)).toEqual({
      request: { name: 'Margin ×1.1', version: 1, from: '2026-11-13 00:00:00', to: '2026-11-26 00:00:00' },
      days: 14,
      problem: null,
    })
  })

  it('refuses a form with no version or no period', () => {
    expect(trialStart({ ...form, name: ' ' }, today).problem).toBe('NO_VERSION')
    expect(trialStart({ ...form, version: 0 }, today).problem).toBe('NO_VERSION')
    expect(trialStart({ ...form, to: '' }, today).problem).toBe('NO_PERIOD')
  })

  it('refuses a period that ends before it starts, has not ended, is longer than 30 days, or starts before the 90 days kept', () => {
    expect(trialStart({ ...form, to: '2026-11-12' }, today).problem).toBe('ENDS_BEFORE_START')
    expect(trialStart({ ...form, to: '2026-11-27' }, today).problem).toBe('NOT_ENDED')
    expect(trialStart({ ...form, from: '2026-10-27' }, today).problem).toBe('TOO_LONG')
    expect(trialStart({ ...form, from: '2026-08-28', to: '2026-09-10' }, today).problem).toBe('BEFORE_KEPT')
  })
})

describe('candidateTrialFor — the trial a set is read beside', () => {
  it('finds the done trial of the candidate the set ran beside, over the very same period', () => {
    expect(candidateTrialFor(trial(TRIAL_SET), trials)?.trialId).toBe(CANDIDATE)
  })

  it('finds none when the candidate has no done trial over that period', () => {
    expect(candidateTrialFor(trial(TRIAL_SET), trials.filter((t) => t.trialId !== CANDIDATE))).toBeNull()
  })
})

describe('besideView — the set beside the candidate set', () => {
  it('names the set beside it and the candidate, under the trial set\'s banner', () => {
    const v = besideView(beside)
    expect([v.set.name, v.set.version, v.set.trialSet, v.candidate.name, v.candidate.version]).toEqual(['Dawaa Now reach 8 km', 1, true, 'Baseline', 3])
  })

  it('counts the orders compared, and those left out of both by reason', () => {
    const v = besideView(beside)
    expect([v.orders, v.compared, v.leftOut]).toEqual([39870, 38300, 1570])
    expect(v.leftOutBy).toEqual([
      { reason: 'NEEDS_WIDER_READ', count: 1180 },
      { reason: 'STORE_NOT_READ', count: 240 },
      { reason: 'NO_PLAN', count: 136 },
      { reason: 'FAILED', count: 14 },
    ])
  })

  it('reads the plans that differ between the two sets: count, share and kind in the comparison\'s order', () => {
    expect(besideView(beside).differ).toEqual({
      count: 2140,
      share: 5.6,
      kinds: [
        { kind: 'ANOTHER_STORE', count: 1320 },
        { kind: 'ANOTHER_MODE', count: 610 },
        { kind: 'FEWER_SHIPMENTS', count: 150 },
        { kind: 'MORE_SHIPMENTS', count: 60 },
      ],
    })
  })

  it('reads each set against what happened, the same plan and the same stores counted', () => {
    expect(besideView(beside).against).toEqual({
      candidate: { samePlan: 27310, sameStores: 30800 },
      beside: { samePlan: 26180, sameStores: 29600 },
    })
  })

  it('reads the estimate between the sets, a minus the set beside it earlier, and none when none is sent', () => {
    expect(besideView(beside).estimate).toEqual({ middle: -4, low: -12, high: 1 })
    const { minutesMiddle: _m, minutesMiddleHalfFrom: _f, minutesMiddleHalfTo: _t, ...none } = beside
    expect(besideView(none).estimate).toBeNull()
  })

  it('reads the promise check under the set beside it, and the fee order by order', () => {
    const v = besideView(beside)
    expect(v.promise.map((p) => [p.mode, p.checked, p.within, p.share])).toEqual([
      ['DAWAA_NOW', 8110, 6935, 85.5],
      ['PICK_UP', 51800, 38100, 73.6],
    ])
    expect(v.fee).toEqual({ lower: 820, same: 37100, higher: 380 })
    expect(v.shipments).toEqual({ candidate: 40210, beside: 39980 })
  })
})
