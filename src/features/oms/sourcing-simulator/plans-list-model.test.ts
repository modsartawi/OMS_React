/**
 * Ticket 962 (BackOffice spec 4354 §3, 4281 decisions 24, 29, 50): what stands under the plans — each goal with no plan
 * and each hidden plan, with its reason — and the run's ending. Fed the door's worked example (4281), with its "four
 * kinds of reason" rows put in where a run would carry them.
 */
import { describe, expect, it } from 'vitest'
import type { AdviseReply } from '@/core/models/sourcing-run'
import fixture from './advise-reply.fixture.json'
import { planNotes } from './plans-list-model'

const reply = fixture as unknown as AdviseReply

/** 4281's reasons: no single store holds the whole order for pick-up, and Fewest is nearly the same as Recommended. */
const withReasons: AdviseReply = {
  ...reply,
  plans: reply.plans.filter((p) => p.goal !== 'PICK_UP').map((p) => (p.goal === 'BALANCED' ? { ...p, alsoGoals: ['FASTEST'] } : p)),
  noPlan: [
    {
      goal: 'PICK_UP',
      code: 'NO_SINGLE_STORE',
      lines: [1, 3],
      en: 'No pharmacy near you holds your whole order',
      ar: 'لا توجد صيدلية قريبة يتوفر فيها طلبك كاملًا',
    },
  ],
  hiddenPlans: [{ goal: 'FEWEST', code: 'NEARLY_SAME', as: 'BALANCED', minutesApart: 10, riyalsApart: 0.4 }],
}

describe('the notes under the plans', () => {
  it('a run where every goal has a plan lists nothing under them', () => {
    const notes = planNotes(reply)
    expect(notes.noPlan).toEqual([])
    expect(notes.hidden).toEqual([])
  })

  it('a goal with no plan is listed with its code and the server’s sentence in both languages', () => {
    expect(planNotes(withReasons).noPlan).toEqual([
      { goal: 'PICK_UP', code: 'NO_SINGLE_STORE', sentence: { en: 'No pharmacy near you holds your whole order', ar: 'لا توجد صيدلية قريبة يتوفر فيها طلبك كاملًا' } },
    ])
  })

  it('a hidden plan is listed with its code, the goal it lost to and how far apart they are', () => {
    expect(planNotes(withReasons).hidden).toEqual([{ goal: 'FEWEST', code: 'NEARLY_SAME', as: 'BALANCED', minutesApart: 10, riyalsApart: 0.4, plan: null }])
  })

  it('lists goals in the fixed order of the five, whatever order the reply sends them in', () => {
    const shuffled: AdviseReply = {
      ...withReasons,
      noPlan: [
        { goal: 'PICK_UP', code: 'GOAL_OFF', en: 'p', ar: 'p' },
        { goal: 'FASTEST', code: 'FALLBACK_ANSWERED', en: 'f', ar: 'f' },
      ],
      hiddenPlans: [
        { goal: 'CHEAPEST', code: 'WORSE_ON_EVERYTHING', as: 'BALANCED' },
        { goal: 'FEWEST', code: 'OVER_MOST_SHOWN' },
      ],
    }
    expect(planNotes(shuffled).noPlan.map((n) => n.goal)).toEqual(['FASTEST', 'PICK_UP'])
    expect(planNotes(shuffled).hidden.map((n) => n.goal)).toEqual(['FEWEST', 'CHEAPEST'])
  })

  it('with allPlans a hidden plan carries the plan itself', () => {
    const plan = reply.plans[1]
    const notes = planNotes({ ...reply, hiddenPlans: [{ goal: 'CHEAPEST', code: 'WORSE_ON_EVERYTHING', as: 'BALANCED', plan }] })
    expect(notes.hidden[0].plan?.totals.fee).toBe(12)
  })
})

describe('the run’s ending', () => {
  it('a proven best run raises no banner', () => {
    expect(planNotes(reply)).toMatchObject({ ending: 'PROVEN_BEST', fallbackAnswered: false, why: null })
  })

  it('the simple plan answered: a banner, with what failed in the search', () => {
    const fallback: AdviseReply = {
      ...reply,
      solve: { ...reply.solve, ending: 'FALLBACK_ANSWERED', why: 'the search ran out of memory' },
      plans: [{ ...reply.plans[0], fallback: true, alsoGoals: [] }],
    }
    expect(planNotes(fallback)).toMatchObject({ ending: 'FALLBACK_ANSWERED', fallbackAnswered: true, why: 'the search ran out of memory' })
  })

  it('no plan possible: every line’s reason from the top of the reply', () => {
    const none: AdviseReply = {
      ...reply,
      solve: { ...reply.solve, ending: 'NO_PLAN_POSSIBLE' },
      plans: [],
      missingLines: [{ lineNo: 3, code: 'NO_STOCK_IN_REACH', bestStore: '1090', bestStoreUnits: 1, asked: 3, stockClass: 'BOOK_SHORT', pairsCut: 0, en: '1 item is not available', ar: 'صنف واحد غير متوفر' }],
    }
    expect(planNotes(none).missingLines).toEqual([{ lineNo: 3, code: 'NO_STOCK_IN_REACH', sentence: { en: '1 item is not available', ar: 'صنف واحد غير متوفر' } }])
  })
})
