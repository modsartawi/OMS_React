/**
 * Ticket 962 (BackOffice spec 4354 §19, SIMT decision 1): the plans as one table — a row per measure, a column per plan.
 * Fed the door's own worked example (BackOffice 4281), cut to the full level the simulator asks for. Figures are read as
 * sent, never re-summed.
 */
import { describe, expect, it } from 'vitest'
import type { AdviseReply } from '@/core/models/sourcing-run'
import fixture from './advise-reply.fixture.json'
import { PLAN_MEASURES, plansTable } from './plans-table-model'

const reply = fixture as unknown as AdviseReply

describe('the plans table of a real reply', () => {
  it('has one column per plan, in the order the reply sends them, each with its label and its tags', () => {
    const table = plansTable(reply)
    expect(table.columns.map((c) => c.goal)).toEqual(['BALANCED', 'CHEAPEST', 'PICK_UP'])
    expect(table.columns[0].label).toEqual({ en: 'Recommended', ar: 'الأنسب' })
    expect(table.columns[0].tags).toEqual(['FASTEST', 'FEWEST'])
    expect(table.columns[1].tags).toEqual([])
  })

  it('has a row per measure, in the fixed order: promise, deliveries, stores and modes, fee, company’s cost, waiting, balanced total', () => {
    expect(plansTable(reply).rows.map((r) => r.measure)).toEqual([
      'promise',
      'deliveries',
      'storesAndModes',
      'fee',
      'companyCost',
      'waiting',
      'balanced',
    ])
    expect(PLAN_MEASURES).toHaveLength(7)
  })

  it('reads every cell as the server sent it', () => {
    const row = (m: string) => plansTable(reply).rows.find((r) => r.measure === m)!.cells
    expect(row('promise')).toEqual([
      { kind: 'text', text: { en: 'Everything by 8:35 pm today', ar: 'كل طلبك يصلك اليوم قبل 8:35 م' } },
      { kind: 'text', text: { en: 'Everything today between 10:00 and 11:59 pm', ar: 'كل طلبك يصلك اليوم بين 10:00 و11:59 م' } },
      { kind: 'text', text: { en: 'Ready to collect at Store 1090 in 30 minutes', ar: 'جاهز للاستلام من صيدلية 1090 خلال 30 دقيقة' } },
    ])
    expect(row('deliveries')).toEqual([
      { kind: 'count', value: 1 },
      { kind: 'count', value: 1 },
      { kind: 'count', value: 1 },
    ])
    expect(row('storesAndModes')[1]).toEqual({ kind: 'shipments', shipments: [{ no: 1, store: '1055', storeName: 'Store 1055', mode: 'SLOT' }] })
    expect(row('fee')[0]).toEqual({ kind: 'money', value: 16, perShipment: [16] })
    expect(row('companyCost').map((c) => (c.kind === 'money' ? c.value : null))).toEqual([17.42, 22.95, 2.31])
    expect(row('waiting').map((c) => (c.kind === 'money' ? c.value : null))).toEqual([7, 9.8, 45])
    expect(row('balanced').map((c) => (c.kind === 'money' ? c.value : null))).toEqual([40.42, 51.35, 47.31])
  })

  it('a reply below the middle level has no sum: waiting and the balanced total read empty, not zero', () => {
    const plansOnly: AdviseReply = { ...reply, level: 'plans', plans: reply.plans.map(({ sum: _sum, ...p }) => p) }
    const row = (m: string) => plansTable(plansOnly).rows.find((r) => r.measure === m)!.cells
    expect(row('waiting')).toEqual([
      { kind: 'money', value: null },
      { kind: 'money', value: null },
      { kind: 'money', value: null },
    ])
    expect(row('balanced')[0]).toEqual({ kind: 'money', value: null })
  })

  it('a column says when the simple plan answered, the budget ran out, or a trial set planned it', () => {
    const fallback: AdviseReply = { ...reply, plans: [{ ...reply.plans[0], fallback: true, bestFound: false, trialSet: true }] }
    expect(plansTable(fallback).columns[0]).toMatchObject({ fallback: true, bestFound: false, trialSet: true })
  })

  it('no plans, no columns: every row is empty', () => {
    const none = plansTable({ ...reply, plans: [] })
    expect(none.columns).toEqual([])
    expect(none.rows.every((r) => r.cells.length === 0)).toBe(true)
  })
})
