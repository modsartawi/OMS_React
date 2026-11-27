/**
 * Ticket 965 (BackOffice spec 4354 §7; 4281 decision 26, `promiseParts`): the promise of each shipment, in parts. A Dawaa
 * Now shipment is a bar of four parts — made ready, courier wait, travel, margin — each with its source, beside the pick
 * end and the usual time; a slot shipment lists the slots skipped and why, the rule that set its pick end and its next
 * two slots; lengtheners that add nothing are marked so. Fed a reply in the server's shape (BackOffice 4365, 4366, 4386:
 * `InputPromiseParts`, `RecordSlotCosts`) and a split plan of two Dawaa Now shipments.
 */
import { describe, expect, it } from 'vitest'
import type { AdvisePlan, AdviseReply } from '@/core/models/sourcing-run'
import fixture from './advise-reply.fixture.json'
import split from './split-plan.fixture.json'
import { promiseBars, wireClock } from './promise-bar-model'

const reply = fixture as unknown as AdviseReply
const plan = (goal: string) => reply.plans.find((p) => p.goal === goal) as AdvisePlan
const splitPlan = split as unknown as AdvisePlan

describe('a Dawaa Now shipment is a bar of four parts', () => {
  const [bar] = promiseBars(plan('BALANCED'))

  it('made ready, courier wait, travel and the margin, in that order, each with its minutes and its source', () => {
    expect(bar.form).toBe('bar')
    expect(bar.segments.map(({ part, minutes, source }) => ({ part, minutes, source }))).toEqual([
      { part: 'madeReady', minutes: 12, source: 'STORES_OWN' },
      { part: 'courierWait', minutes: 6, source: 'STEADIED' },
      { part: 'travel', minutes: 13, source: 'ROAD' },
      { part: 'margin', minutes: 20, source: null },
    ])
  })

  it('each part takes its share of the bar’s width', () => {
    expect(bar.segments[0].share).toBeCloseTo(12 / 51, 5)
    expect(bar.segments[3].share).toBeCloseTo(20 / 51, 5)
  })

  it('the pick end, the promise in minutes and the promise time, as sent; the server sends no usual time and no pick-end rule', () => {
    expect(bar.pickEnd).toBe('2026-11-26 20:01:00')
    expect(bar.minutes).toBe(55)
    expect(bar.by).toBe('2026-11-26 20:35:00')
    expect(bar.usualBy).toBeNull()
    expect(bar.pickEndRule).toBeNull()
  })

  it('a lengthener that moves neither figure is marked "adds nothing"; one that moves the cautious figure is not', () => {
    expect(bar.lengtheners.map((l) => [l.name, l.value, l.state, l.addsNothing])).toEqual([
      ['DELIVERIES_WAITING', 1, 'NO_EFFECT', true],
      ['BASKET_LINES', 1, 'NO_EFFECT', true],
      ['HOUR_OF_DAY', 19, 'ADDS', false],
    ])
  })

  it('travel on the road is not marked straight line', () => {
    expect(bar.straightLine).toBe(false)
  })
})

describe('a slot shipment', () => {
  const [bar] = promiseBars(plan('CHEAPEST'))

  it('names the slot taken and where it came from, and draws no bar', () => {
    expect(bar.form).toBe('slot')
    expect(bar.segments).toEqual([])
    expect(bar.slot).toEqual({ code: '00022724', from: '2026-11-26 22:00:00', to: '2026-11-26 23:59:00', source: 'HYBRIS' })
  })

  it('lists the slots skipped and why, and the rule that set its pick end', () => {
    expect(bar.skipped).toEqual([{ from: '2026-11-26 20:00:00', why: 'INSIDE_LEAD' }])
    expect(bar.pickEnd).toBe('2026-11-26 20:51:00')
  })

  it('lists its next two slots with their sums (its slot costs), and the mark when a later one was cheaper', () => {
    expect(bar.next).toEqual([
      { code: '00022731', from: '2026-11-27 10:00:00', to: '2026-11-27 11:59:00', sum: 50.1 },
      { code: '00022732', from: '2026-11-27 12:00:00', to: '2026-11-27 13:59:00', sum: 52.4 },
    ])
    expect(bar.laterCheaper).toBe(true)
  })

  it('a straight-line distance is marked', () => {
    expect(bar.straightLine).toBe(true)
  })
})

describe('a pick-up shipment', () => {
  it('reads its target and its made-ready figures', () => {
    const [bar] = promiseBars(plan('PICK_UP'))
    expect(bar.form).toBe('pickUp')
    expect(bar.target).toBe(30)
    expect(bar.madeReady).toEqual({ usual: 10, cautious: 16, source: 'STORES_OWN' })
  })
})

describe('a split plan', () => {
  it('has one bar per shipment, each with its own parts', () => {
    const bars = promiseBars(splitPlan)
    expect(bars.map((b) => [b.no, b.store, b.form])).toEqual([
      [1, '1090', 'bar'],
      [2, '1061', 'bar'],
    ])
    expect(bars[1].segments.map((s) => s.minutes)).toEqual([15, 7, 10, 14])
    expect(bars[1].segments[2].source).toBe('STRAIGHT_LINE')
    expect(bars[1].straightLine).toBe(true)
    expect(bars[1].lengtheners[0].addsNothing).toBe(false)
  })
})

describe('a reply at the plans-only level', () => {
  it('carries no promise parts, and the bar says so rather than inventing any', () => {
    const bare = { ...plan('BALANCED'), shipments: plan('BALANCED').shipments.map(({ promiseParts: _, ...s }) => s) }
    const [bar] = promiseBars(bare)
    expect(bar.hasParts).toBe(false)
    expect(bar.segments).toEqual([])
    expect(bar.pickEnd).toBeNull()
    expect(bar.lengtheners).toEqual([])
  })
})

describe('a wire time on the clock', () => {
  it('reads the hours and minutes of a local `yyyy-MM-dd HH:mm:ss` time, without a zone', () => {
    expect(wireClock('2026-11-26 20:51:00')).toBe('20:51')
    expect(wireClock(null)).toBe('')
  })
})
