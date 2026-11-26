/**
 * Ticket 965 (BackOffice spec 4354 §6 "a line on a short stock figure", story 37; 4281 decision 25): a line planned on a
 * short stock figure carries a plain sentence with its own chance — "About 22 in 100 such lines are not handed over at
 * this store" — and its mark's figures. The door's example marks line 3 at store 1055 (book at zero, chance 0.22).
 */
import { describe, expect, it } from 'vitest'
import type { AdvisePlan, AdviseReply } from '@/core/models/sourcing-run'
import fixture from './advise-reply.fixture.json'
import { shortFigures } from './short-figure'

const reply = fixture as unknown as AdviseReply
const plan = (goal: string) => reply.plans.find((p) => p.goal === goal) as AdvisePlan

describe('a line on a short stock figure', () => {
  it('reads its chance as so many in 100, with its stock class, six figures, row, factor and cost', () => {
    expect(shortFigures(plan('CHEAPEST'))).toEqual([
      {
        lineNo: 3,
        store: '1055',
        stockClass: 'BOOK_AT_ZERO',
        inHundred: 22,
        figures: { tillStock: 0, sapStock: 2, heldByOrders: 0, heldByDeliveries: 0, shown: 0, asked: 1 },
        row: 0.22,
        factor: 1,
        cost: 6.6,
      },
    ])
  })

  it('rounds the chance to a whole number in 100', () => {
    const p = plan('CHEAPEST')
    const odd = { ...p, lineMarks: [{ ...p.lineMarks[0], chance: 0.0784 }] }
    expect(shortFigures(odd)[0].inHundred).toBe(8)
  })

  it('a plan with no marked line has none, and a mark of another code is not one', () => {
    expect(shortFigures(plan('BALANCED'))).toEqual([])
    const p = plan('CHEAPEST')
    expect(shortFigures({ ...p, lineMarks: [{ ...p.lineMarks[0], code: 'SOMETHING_ELSE' }] })).toEqual([])
  })
})
