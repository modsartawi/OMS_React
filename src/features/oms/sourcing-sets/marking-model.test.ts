/**
 * The marking screen's model (ticket 967; spec 4354 §10 and §18, BO 4395): the figures it shows, the four checks first,
 * and one written reason that must speak to each "too few" or "not steady" figure (the owner's variant A: one reason
 * plus a tick per such figure). Fed the replies the drive serves (`stub-sets.json`, PROVISIONAL shapes).
 */
import { describe, expect, it } from 'vitest'
import type { MarkingReply } from '@/core/models/sourcing-sets'
import stub from './stub-sets.json'
import { markingView, markRequest, markState, refusalLines } from './marking-model'

const reply = (key: string) => structuredClone((stub.marking as unknown as Record<string, MarkingReply>)[key])
const clean = markingView(reply('Express margin|5'))

describe('the figures shown', () => {
  it('the trial: its number, period, plans changed against the candidate set and orders refused, as sent', () => {
    expect(clean.trial).toMatchObject({
      trialId: 'T-0036',
      days: 14,
      endedDaysAgo: 4,
      plansChanged: { count: 2116, of: 42401, percent: 5.0 },
      refused: { count: 717, of: 43118, percent: 1.7 },
    })
  })

  it('the orders refused by reason in the spec order, never re-summed', () => {
    expect(clean.trial!.refusedBy).toEqual([
      { reason: 'REACH_WIDER_THAN_READ', count: 402 },
      { reason: 'HIGHER_PAIR_CAP_ON_CUT_RUN', count: 201 },
      { reason: 'STORE_NEVER_READ', count: 114 },
    ])
  })

  it('the promise check per mode under the new version: Dawaa Now, slot, then pick-up app and site, call centre', () => {
    expect(clean.trial!.promise.map((p) => [p.mode, p.channelGroup, p.percent, p.candidatePercent])).toEqual([
      ['DAWAA_NOW', null, 91.8, 90.4],
      ['SLOT', null, 97.1, 96.9],
      ['PICK_UP', 'APP_SITE', 88.3, 88.1],
      ['PICK_UP', 'CALL_CENTRE', 84.9, 85.2],
    ])
  })

  it('every shelf chance figure that differs, by mode, units asked and units left over, with its reading', () => {
    expect(clean.shelf.map((f) => [f.key, f.reading])).toEqual([
      ['DAWAA_NOW.1.L0', 'ENOUGH_TO_CHANGE'],
      ['DAWAA_NOW.1.L1', 'TOO_FEW'],
      ['SLOT.1.L2', 'ENOUGH_TO_CHANGE'],
      ['SLOT.2.L0', 'NOT_STEADY'],
      ['PICK_UP.1.L0', 'TOO_FEW'],
    ])
  })

  it('a figure the version leaves as it was is not one that differs', () => {
    expect(markingView(reply('Baseline|1')).shelf.map((f) => f.key)).toEqual(['DAWAA_NOW.1.L0'])
  })

  it('the four checks in the spec order; a check passed on an exception says which', () => {
    expect(clean.checks.map((c) => [c.check, c.passed])).toEqual([
      ['BALANCED_ON', true],
      ['NO_WHAT_IF', true],
      ['NO_ASSUMED_CARRIER_ROW', true],
      ['KEPT_TRIAL', true],
    ])
    const back = markingView(reply('Baseline|1'))
    expect(back.checksPass).toBe(true)
    expect(back.checks[3]).toMatchObject({
      passed: true,
      exception: 'BACK_WITHIN_90',
    })
    expect(back.lastCandidate).toEqual({
      until: '2026-11-02 09:15:30',
      daysAgo: 25,
    })
  })
})

describe('a refused marking shows its reason', () => {
  it('no kept trial: the fourth check fails with its reason, and the checks do not pass', () => {
    const v = markingView(reply('Wider slot reach|2'))
    expect(v.checksPass).toBe(false)
    expect(v.refusals).toEqual([{ check: 'KEPT_TRIAL', code: 'NO_TRIAL', figure: null }])
  })

  it('case 87: too short, too old, too many refused and a stop finding, each with its figure', () => {
    expect(markingView(reply('Express margin|3')).refusals.map((r) => [r.code, r.figure])).toEqual([
      ['TRIAL_TOO_SHORT', '10'],
      ['TRIAL_TOO_OLD', '9'],
      ['TRIAL_REFUSED_TOO_MANY', '6.2'],
      ['TRIAL_STOP_FINDING', '1'],
    ])
  })

  it('a trial set is never marked, even if a reply said every check passed', () => {
    const r = reply('Carrier pilot|1')
    expect(markingView(r).checksPass).toBe(false)
    r.checks = r.checks.map((c) => ({ ...c, passed: true, why: [] }))
    expect(markingView(r).checksPass).toBe(false)
  })

  it('a reply that left out one of the four checks never passes', () => {
    const r = reply('Express margin|5')
    r.checks = r.checks.slice(0, 3)
    expect(markingView(r).checksPass).toBe(false)
  })

  it("the mark door's refusal: each code it sent, a code the screen does not know kept with the server's words", () => {
    expect(
      refusalLines([
        {
          errorCode: 'TRIAL_TOO_OLD',
          errorMessage: 'The trial ended 8 days ago.',
        },
        {
          errorCode: 'SOMETHING_NEW',
          errorMessage: 'A rule this screen does not know.',
        },
      ]),
    ).toEqual([
      {
        code: 'TRIAL_TOO_OLD',
        known: true,
        message: 'The trial ended 8 days ago.',
      },
      {
        code: 'SOMETHING_NEW',
        known: false,
        message: 'A rule this screen does not know.',
      },
    ])
  })
})

describe('the written reason must speak to each "too few" or "not steady"', () => {
  it('names the figures it must speak to: every reading but "enough"', () => {
    expect(clean.mustSpeakTo.map((f) => f.key)).toEqual(['DAWAA_NOW.1.L1', 'SLOT.2.L0', 'PICK_UP.1.L0'])
  })

  it('a reading the screen does not know must be spoken to as well (fails safe)', () => {
    const r = reply('Express margin|5')
    r.shelf[1] = { ...r.shelf[1], reading: 'INSIDE_CHANCE' as never }
    expect(markingView(r).mustSpeakTo.map((f) => f.key)).toContain('DAWAA_NOW.1.L0')
  })

  it('Mark stays off until a reason is written and every such figure is ticked', () => {
    expect(markState(clean, '', [])).toEqual({
      canMark: false,
      waitingFor: 'reason',
      spoken: 0,
      of: 3,
    })
    expect(markState(clean, '   ', ['DAWAA_NOW.1.L1'])).toMatchObject({
      canMark: false,
      waitingFor: 'reason',
      spoken: 1,
    })
    expect(markState(clean, 'Evidence read by hand.', ['DAWAA_NOW.1.L1', 'SLOT.2.L0'])).toEqual({ canMark: false, waitingFor: 'figures', spoken: 2, of: 3 })
    expect(markState(clean, 'Evidence read by hand.', ['DAWAA_NOW.1.L1', 'SLOT.2.L0', 'PICK_UP.1.L0'])).toEqual({
      canMark: true,
      waitingFor: null,
      spoken: 3,
      of: 3,
    })
  })

  it('a tick on an "enough" figure counts for nothing', () => {
    expect(markState(clean, 'Why.', ['DAWAA_NOW.1.L0', 'SLOT.1.L2', 'DAWAA_NOW.1.L1'])).toMatchObject({ canMark: false, spoken: 1, of: 3 })
  })

  it('with nothing to speak to, a written reason is enough', () => {
    expect(markState(markingView(reply('Baseline|1')), 'Back to the baseline while version 4 is looked at.', [])).toEqual({
      canMark: true,
      waitingFor: null,
      spoken: 0,
      of: 0,
    })
  })

  it('while a check fails Mark stays off, whatever is written', () => {
    expect(markState(markingView(reply('Wider slot reach|2')), 'Please.', [])).toEqual({ canMark: false, waitingFor: 'checks', spoken: 0, of: 0 })
  })

  it('the body sent: the version, the trimmed reason, and only the figures it must speak to', () => {
    expect(markRequest(clean, '  Read the halves by hand.  ', ['SLOT.1.L2', 'PICK_UP.1.L0', 'DAWAA_NOW.1.L1', 'SLOT.2.L0'])).toEqual({
      name: 'Express margin',
      version: 5,
      reason: 'Read the halves by hand.',
      spokenTo: ['DAWAA_NOW.1.L1', 'SLOT.2.L0', 'PICK_UP.1.L0'],
    })
    expect(markRequest(clean, 'Read.', ['SLOT.2.L0'])).toBeNull()
  })
})
