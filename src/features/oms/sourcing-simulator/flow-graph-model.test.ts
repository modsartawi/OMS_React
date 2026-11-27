/**
 * Ticket 966 (BackOffice spec 4354 §19, the run record 4242: "the flow graph needs nothing of its own: it is drawn from
 * the stock working and the selected plan"): the flow graph's boxes and lines — the cart lines, the pairs that can
 * serve a line, the shipments of the selected plan and the plan — grey for could have served, coloured for chosen.
 * Fed the door's worked example with the rest of its store lines and "why not" rows put in.
 */
import { describe, expect, it } from 'vitest'
import type { AdviseReply } from '@/core/models/sourcing-run'
import fixture from './advise-reply.fixture.json'
import { flowGraph } from './flow-graph-model'

const reply = fixture as unknown as AdviseReply
const recommended = reply.plans.find((p) => p.goal === 'BALANCED')!
const cheapest = reply.plans.find((p) => p.goal === 'CHEAPEST')!

describe('the flow graph', () => {
  it('lays the cart lines, the pairs, the selected plan’s shipments and the plan in four columns', () => {
    const g = flowGraph(reply, recommended)!
    const column = (kind: string) => g.nodes.filter((n) => n.kind === kind).map((n) => n.id)
    expect(column('line')).toEqual(['line:1', 'line:2', 'line:3'])
    // The chosen pair first, then the candidates in the record's order; a pair a filter removed is not one.
    expect(column('pair')).toEqual(['pair:1090:DAWAA_NOW', 'pair:1061:DAWAA_NOW', 'pair:1055:SLOT', 'pair:1090:SLOT', 'pair:1090:PICK_UP', 'pair:1055:DAWAA_NOW'])
    expect(column('shipment')).toEqual(['ship:1'])
    expect(column('plan')).toEqual(['plan'])
    expect(g.nodes.find((n) => n.id === 'pair:1203:DAWAA_NOW')).toBeUndefined()
  })

  it('a pair serves a line its offered stock covers; the chosen pair serves the lines its shipment carries', () => {
    const g = flowGraph(reply, recommended)!
    const served = (pair: string) => g.edges.filter((e) => e.target === pair).map((e) => e.source)
    expect(served('pair:1090:DAWAA_NOW')).toEqual(['line:1', 'line:2', 'line:3'])
    expect(served('pair:1061:DAWAA_NOW')).toEqual(['line:2'])
    expect(served('pair:1055:SLOT')).toEqual(['line:1', 'line:2'])
    expect(served('pair:1090:SLOT')).toEqual(['line:1', 'line:2', 'line:3'])
  })

  it('colours the selected plan’s path by its shipment and leaves every other line grey', () => {
    const g = flowGraph(reply, recommended)!
    expect(g.edges.filter((e) => e.chosen).map((e) => [e.id, e.slot])).toEqual([
      ['line:1>pair:1090:DAWAA_NOW', 0],
      ['line:2>pair:1090:DAWAA_NOW', 0],
      ['line:3>pair:1090:DAWAA_NOW', 0],
      ['pair:1090:DAWAA_NOW>ship:1', 0],
      ['ship:1>plan', 0],
    ])
    expect(g.edges.filter((e) => !e.chosen)).toHaveLength(11)
    expect(g.edges.filter((e) => !e.chosen).every((e) => e.slot === null)).toBe(true)
    expect(g.nodes.filter((n) => n.kind === 'pair' && n.chosen).map((n) => n.id)).toEqual(['pair:1090:DAWAA_NOW'])
  })

  it('carries what each box says: the line, the pair, the shipment’s promise and cost, the plan’s balanced total', () => {
    const g = flowGraph(reply, recommended)!
    expect(g.nodes.find((n) => n.id === 'line:1')).toMatchObject({ kind: 'line', column: 0, row: 0, lineNo: 1, item: '100234', quantity: 2 })
    expect(g.nodes.find((n) => n.id === 'pair:1055:SLOT')).toMatchObject({ kind: 'pair', column: 1, row: 2, store: '1055', storeName: 'Store 1055', mode: 'SLOT', chosen: false })
    expect(g.nodes.find((n) => n.id === 'ship:1')).toMatchObject({ kind: 'shipment', column: 2, row: 0, no: 1, store: '1090', mode: 'DAWAA_NOW', by: '2026-11-26 20:35:00', companyCost: 17.42, slot: 0 })
    expect(g.nodes.find((n) => n.id === 'plan')).toMatchObject({ kind: 'plan', column: 3, row: 0, goal: 'BALANCED', label: { en: 'Recommended', ar: 'الأنسب' }, balanced: 40.42 })
    expect(g.pairs).toEqual({ serving: 6, candidates: 6 })
  })

  it('another plan draws its own path, a figure-short line included', () => {
    const g = flowGraph(reply, cheapest)!
    expect(g.edges.filter((e) => e.chosen).map((e) => e.id)).toEqual(['line:1>pair:1055:SLOT', 'line:2>pair:1055:SLOT', 'line:3>pair:1055:SLOT', 'pair:1055:SLOT>ship:1', 'ship:1>plan'])
    expect(g.nodes.filter((n) => n.kind === 'pair').map((n) => n.id)).toEqual([
      'pair:1055:SLOT',
      'pair:1061:DAWAA_NOW',
      'pair:1090:SLOT',
      'pair:1090:PICK_UP',
      'pair:1055:DAWAA_NOW',
      'pair:1090:DAWAA_NOW',
    ])
  })

  it('a pair a step removed for one line does not serve that line', () => {
    const ruled: AdviseReply = {
      ...reply,
      filterSteps: [...reply.filterSteps!, { step: 10, code: 'PRODUCT_RULE', before: 19, after: 18, removedCount: 1, removed: [{ store: '1090', mode: 'SLOT', lineNo: 3 }] }],
    }
    const g = flowGraph(ruled, recommended)!
    expect(g.edges.filter((e) => e.target === 'pair:1090:SLOT').map((e) => e.source)).toEqual(['line:1', 'line:2'])
  })

  it('a two-shipment plan gives each shipment its own colour', () => {
    const split = {
      ...recommended,
      shipments: [
        { ...recommended.shipments[0], no: 1, lines: [1, 2] },
        { ...cheapest.shipments[0], no: 2, lines: [3] },
      ],
    }
    const g = flowGraph(reply, split)!
    expect(g.edges.filter((e) => e.chosen).map((e) => [e.id, e.slot])).toEqual([
      ['line:1>pair:1090:DAWAA_NOW', 0],
      ['line:2>pair:1090:DAWAA_NOW', 0],
      ['line:3>pair:1055:SLOT', 1],
      ['pair:1090:DAWAA_NOW>ship:1', 0],
      ['pair:1055:SLOT>ship:2', 1],
      ['ship:1>plan', 0],
      ['ship:2>plan', 1],
    ])
  })

  it('no plan, or a reply without the stock working, draws nothing', () => {
    expect(flowGraph(reply, undefined)).toBeNull()
    expect(flowGraph({ ...reply, inputs: undefined }, recommended)).toBeNull()
  })
})
