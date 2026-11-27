/**
 * The marking screen's model (ticket 967; spec 4354 §10 and §18), over the real doors (BackOffice 4360 and 4395 at
 * pricing2 35a4e56be: `GET WeightSets/MarkScreen`, `POST WeightSets/Mark`): the figures it shows, the four checks
 * first, and one written reason that must NAME each figure the evidence marks "too few" or "not steady" — the server
 * reads the reason for each figure's name (`ReasonSpeaksToFigures`). The owner's variant A: one reason plus a tick per
 * such figure, the tick naming the figure in the reason. Fed the replies the drive serves (`stub-sets.json`).
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { WeightSetListItem } from '@/core/models/sourcing-run'
import type { MarkScreenReply } from '@/core/models/sourcing-sets'
import stub from './stub-sets.json'
import {
  candidateOf,
  figureName,
  markableVersions,
  markingView,
  markRequest,
  markState,
  refusalLines,
  speaksTo,
  withFigure,
  withoutFigure,
} from './marking-model'

const sets = stub.sets as unknown as WeightSetListItem[]
const reply = (key: string) => structuredClone((stub.markScreen as unknown as Record<string, MarkScreenReply>)[key])
const view = (key: string) => markingView(reply(key), candidateOf(sets))
const clean = view('Express margin|5')

describe('the figures shown', () => {
  it('in place of the candidate set the list marks', () => {
    expect(candidateOf(sets)).toEqual({ name: 'Express margin', version: 4 })
    expect(clean.target).toEqual({ name: 'Express margin', version: 5 })
    expect(clean.candidate).toEqual({ name: 'Express margin', version: 4 })
  })

  it('the trial: its number, days, plans changed against the candidate set and orders refused, as sent', () => {
    expect(clean.trial).toMatchObject({
      trialId: 'T-0036',
      days: 14,
      plansCompared: 42401,
      plansChanged: 2116,
      plansChangedShare: 0.0499,
      orders: 43118,
      refused: 717,
      refusedShare: 0.0166,
    })
  })

  it('the orders refused and the plans changed, most first, never re-summed', () => {
    expect(clean.refusedBy).toEqual([
      ['REACH_WIDER_THAN_READ', 402],
      ['HIGHER_PAIR_CAP_ON_CUT_RUN', 201],
      ['STORE_NEVER_READ', 114],
    ])
    expect(clean.changedBy.map(([k]) => k)).toEqual(['ANOTHER_STORE', 'ANOTHER_MODE', 'FEWER_SHIPMENTS', 'MORE_SHIPMENTS'])
  })

  it('the promise check per mode under the new version: Dawaa Now, slot, then pick-up', () => {
    expect(clean.trial!.promise.map((p) => [p.mode, p.checked, p.within, p.share])).toEqual([
      ['DAWAA_NOW', 9812, 9007, 0.918],
      ['SLOT', 21330, 20710, 0.9709],
      ['PICK_UP', 7281, 6430, 0.8831],
    ])
  })

  it('every shelf chance figure that differs, with what its evidence says', () => {
    expect(clean.shelf.map((f) => [f.figure, f.evidence ?? null])).toEqual([
      ['shelfChance 1/0', 'ENOUGH'],
      ['shelfChance 2/0', 'NOT_STEADY'],
      ['shelfChance 1/1', 'TOO_FEW'],
      ['shelfChance 1/2', null],
      ['shortFigure SLOT bookAtZero', 'TOO_FEW'],
    ])
  })

  it('reads a figure\'s name: a shelf chance cell, or a short-figure row of a mode', () => {
    expect(figureName('shelfChance 2/0')).toEqual({ kind: 'shelf', asked: 2, leftOver: 0 })
    expect(figureName('shortFigure PICK_UP heldByDeliveries')).toEqual({ kind: 'short', mode: 'PICK_UP', row: 'heldByDeliveries' })
    expect(figureName('somethingNew 1')).toBeNull()
  })

  it('the phase 2 bar count a marking starts again', () => {
    expect(clean.bar).toEqual({ counted: true, from: '2026-11-04 00:00:00' })
    expect(view('Wider slot reach|2').bar).toEqual({ counted: false, from: null })
  })
})

describe('the four checks', () => {
  it('pass for a clean version: the reason not yet naming its figures is the reason\'s to answer, not a check', () => {
    expect(clean.checks.map((c) => [c.check, c.passed])).toEqual([
      ['BALANCED_ON', true],
      ['NO_WHAT_IF', true],
      ['NO_ASSUMED_CARRIER_ROW', true],
      ['KEPT_TRIAL', true],
    ])
    expect(clean.checksPass).toBe(true)
    expect(clean.refusals).toEqual([])
  })

  it('no kept trial: the fourth check fails with the server\'s reason', () => {
    const v = view('Wider slot reach|2')
    expect(v.checksPass).toBe(false)
    expect(v.checks.find((c) => c.check === 'KEPT_TRIAL')).toMatchObject({ passed: false, refusals: [{ code: 'NO_TRIAL' }] })
    expect(v.refusals.map((r) => r.code)).toEqual(['NO_TRIAL'])
  })

  it('a trial too old: the newest trial and why it does not qualify', () => {
    const v = view('Baseline|1')
    expect(v.refusals.map((r) => r.code)).toEqual(['TRIAL_TOO_OLD'])
    expect(v.trial!.fails).toEqual(['TRIAL_TOO_OLD'])
  })

  it('a trial set fails the second check and is never offered; its assumed carrier row fails the third', () => {
    const v = view('Carrier pilot|1')
    expect(v.trialSet).toBe(true)
    expect(v.checks.filter((c) => !c.passed).map((c) => c.check)).toEqual(['NO_WHAT_IF', 'NO_ASSUMED_CARRIER_ROW'])
  })

  it('going back within 90 days passes the fourth check on its exception, saying until when it was the candidate', () => {
    const v = view('Express margin|3')
    expect(v.checksPass).toBe(true)
    expect(v.checks[3]).toMatchObject({ passed: true, exception: 'BACK_WITHIN_90_DAYS' })
    expect(v.candidateUntil).toBe('2026-11-18 10:42:05')
  })

  it('a refusal code the screen does not know blocks the marking, kept with the server\'s words', () => {
    const r = reply('Express margin|5')
    r.refusals.push({ code: 'SOMETHING_NEW', why: 'A rule this screen does not know.' })
    const v = markingView(r, null)
    expect(v.checksPass).toBe(false)
    expect(v.refusals).toEqual([{ code: 'SOMETHING_NEW', why: 'A rule this screen does not know.' }])
  })
})

describe('the written reason must name each "too few" or "not steady" figure', () => {
  it('names the figures it must speak to: exactly those the evidence marks too few or not steady', () => {
    expect(clean.mustSpeakTo.map((f) => f.figure)).toEqual(['shelfChance 2/0', 'shelfChance 1/1', 'shortFigure SLOT bookAtZero'])
  })

  it('a figure is spoken to when the reason names it, in any case', () => {
    expect(speaksTo('The SHELFCHANCE 2/0 cell was read by hand.', 'shelfChance 2/0')).toBe(true)
    expect(speaksTo('The shelfChance 2/1 cell.', 'shelfChance 2/0')).toBe(false)
  })

  it('a tick names the figure in the reason; untick takes the name out again', () => {
    const once = withFigure('Read by hand.', 'shelfChance 1/1')
    expect(once).toBe('Read by hand.\nshelfChance 1/1: ')
    expect(withFigure(once, 'shelfChance 1/1')).toBe(once)
    expect(withoutFigure(once, 'shelfChance 1/1')).toBe('Read by hand.')
    expect(withFigure('', 'shelfChance 1/1')).toBe('shelfChance 1/1: ')
  })

  it('Mark stays off until a reason is written and names every such figure', () => {
    expect(markState(clean, '')).toEqual({ canMark: false, waitingFor: 'reason', spoken: 0, of: 3 })
    expect(markState(clean, 'Evidence read by hand: shelfChance 2/0, shelfChance 1/1.')).toEqual({ canMark: false, waitingFor: 'figures', spoken: 2, of: 3 })
    expect(markState(clean, 'shelfChance 2/0, shelfChance 1/1 and shortFigure SLOT bookAtZero read by hand.')).toEqual({
      canMark: true,
      waitingFor: null,
      spoken: 3,
      of: 3,
    })
  })

  it('with nothing to speak to, a written reason is enough', () => {
    expect(markState(view('Express margin|3'), 'Back to version 3 while version 4 is looked at.')).toEqual({ canMark: true, waitingFor: null, spoken: 0, of: 0 })
  })

  it('while a check fails Mark stays off, whatever is written', () => {
    expect(markState(view('Wider slot reach|2'), 'Please.')).toEqual({ canMark: false, waitingFor: 'checks', spoken: 0, of: 0 })
  })

  it('the body sent: the version and the trimmed reason, nothing else (BO 4360 `MarkCandidateRequest`)', () => {
    expect(markRequest(clean, '  shelfChance 2/0, shelfChance 1/1, shortFigure SLOT bookAtZero: read the halves by hand.  ')).toEqual({
      name: 'Express margin',
      version: 5,
      reason: 'shelfChance 2/0, shelfChance 1/1, shortFigure SLOT bookAtZero: read the halves by hand.',
    })
    expect(markRequest(clean, 'Read.')).toBeNull()
  })
})

describe('the mark door\'s refusal', () => {
  it('reads every reason of a refused marking (`WEIGHTSET-423`, `data.refusals`)', () => {
    const err = new ApiError('business', 'The version cannot be marked the candidate set: …', 422, [{ errorCode: 'WEIGHTSET-423', internalErrorCode: '', errorMessage: '…' }], {
      refusals: [
        { code: 'TRIAL_TOO_OLD', why: 'Its newest trial T-0036 ended on 2026-11-23, more than 7 days before the marking.' },
        { code: 'SOMETHING_NEW', why: 'A rule this screen does not know.' },
      ],
    })
    expect(refusalLines(err)).toEqual([
      { code: 'TRIAL_TOO_OLD', known: true, why: 'Its newest trial T-0036 ended on 2026-11-23, more than 7 days before the marking.' },
      { code: 'SOMETHING_NEW', known: false, why: 'A rule this screen does not know.' },
    ])
  })

  it('any other refusal (a conflict, a bad request) carries no reasons of its own', () => {
    expect(refusalLines(new ApiError('business', 'The set is retired.', 409, [{ errorCode: 'WEIGHTSET-409', internalErrorCode: '', errorMessage: 'The set is retired.' }]))).toEqual([])
    expect(refusalLines(new Error('x'))).toEqual([])
  })
})

describe('the versions the marking screen offers (review 2 #9)', () => {
  it('every version but the candidate set\'s, of no retired set and no trial set: a trial set is never marked', () => {
    expect(markableVersions(sets)).toEqual([
      { name: 'Baseline', version: 1 },
      { name: 'Express margin', version: 1 },
      { name: 'Express margin', version: 2 },
      { name: 'Express margin', version: 3 },
      { name: 'Express margin', version: 5 },
      { name: 'Wider slot reach', version: 1 },
      { name: 'Wider slot reach', version: 2 },
    ])
  })
})
