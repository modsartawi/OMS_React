/**
 * Ticket 968 (BackOffice spec 4354 §8, BO 4362): one product rule table. A row says an item group may not ship by a
 * mode, or may ship only from named stores, and has a switch. The owner's pick (variant A): the rules are a list of
 * rows, by item group and then by mode, each with its switch.
 */
import { describe, expect, it } from 'vitest'
import type { PlannerRow } from '@/core/models/sourcing-planner'
import { ruleGroups, ruleRows, switchRequest } from './rule-rows-model'

let n = 0
const rule = (values: Record<string, unknown>, over: Partial<PlannerRow> = {}): PlannerRow => ({
  id: `r${++n}`,
  values: { ruleKind: 'NOT_BY_MODE', stores: null, on: true, ...values } as PlannerRow['values'],
  setAt: '2026-11-01 07:00:00',
  setBy: 'seed',
  ...over,
})

const ROWS: PlannerRow[] = [
  rule({ groupKind: 'NAMED_LIST', group: 'BULKY', mode: 'DAWAA_NOW' }, { id: 'bulky-dn' }),
  rule({ groupKind: 'COLD_CHAIN', group: 'COLD', mode: 'CARRIER_NEXT_DAY' }, { id: 'cold-cnd' }),
  rule({ groupKind: 'NAMED_LIST', group: 'RESTRICTED', mode: 'SLOT' }, { id: 'restr-sl' }),
  rule({ groupKind: 'COLD_CHAIN', group: 'COLD', mode: 'DAWAA_NOW', on: false }, { id: 'cold-dn' }),
  rule({ groupKind: 'NAMED_LIST', group: 'RESTRICTED', mode: 'DAWAA_NOW' }, { id: 'restr-dn' }),
  rule(
    { groupKind: 'ITEM', group: '121007', ruleKind: 'ONLY_FROM_STORES', mode: 'SLOT', stores: ['P901', 'P905'], on: false },
    { id: 'insulin-sl', names: { group: 'Insulin glargine pen' } },
  ),
  rule({ groupKind: 'COLD_CHAIN', group: 'COLD', mode: 'SLOT' }, { id: 'cold-sl-ended', endedAt: '2026-11-10 09:00:00' }),
]

describe('rule rows by item group and mode', () => {
  it('lists the rows in force by group kind, then group, then mode in the six modes\' order', () => {
    expect(ruleRows(ROWS).map((r) => r.id)).toEqual(['cold-dn', 'cold-cnd', 'bulky-dn', 'restr-dn', 'restr-sl', 'insulin-sl'])
  })

  it('reads each row\'s switch, rule and stores', () => {
    const insulin = ruleRows(ROWS).find((r) => r.id === 'insulin-sl')!
    expect(insulin).toMatchObject({ groupKind: 'ITEM', group: '121007', groupName: 'Insulin glargine pen', ruleKind: 'ONLY_FROM_STORES', mode: 'SLOT', stores: ['P901', 'P905'], on: false })
    expect(ruleRows(ROWS).find((r) => r.id === 'cold-dn')!.on).toBe(false)
    expect(ruleRows(ROWS).find((r) => r.id === 'restr-dn')!.stores).toEqual([])
  })

  it('groups the rows by item group, counting the switches on and off', () => {
    expect(ruleGroups(ROWS).map((g) => [g.groupKind, g.group, g.rows.map((r) => r.mode), g.on, g.off])).toEqual([
      ['COLD_CHAIN', 'COLD', ['DAWAA_NOW', 'CARRIER_NEXT_DAY'], 1, 1],
      ['NAMED_LIST', 'BULKY', ['DAWAA_NOW'], 1, 0],
      ['NAMED_LIST', 'RESTRICTED', ['DAWAA_NOW', 'SLOT'], 2, 0],
      ['ITEM', '121007', ['SLOT'], 0, 1],
    ])
  })

  it('leaves out an ended row', () => {
    expect(ruleRows(ROWS).some((r) => r.id === 'cold-sl-ended')).toBe(false)
  })
})

describe('switching a row', () => {
  it('asks the door to change only the switch, on the version on screen, with no reason (BO 4362 keeps none)', () => {
    const coldDn = ROWS.find((r) => r.id === 'cold-dn')!
    expect(switchRequest(coldDn)).toEqual({
      rowId: 'cold-dn',
      values: { groupKind: 'COLD_CHAIN', group: 'COLD', ruleKind: 'NOT_BY_MODE', mode: 'DAWAA_NOW', stores: null, on: true },
    })
    expect(switchRequest(ROWS.find((r) => r.id === 'bulky-dn')!).values.on).toBe(false)
  })
})
