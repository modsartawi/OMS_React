/**
 * Ticket 968 (BackOffice spec 4354 §8, BO 4362 `ProductRuleEndpoints` at pricing2 35a4e56be): one product rule table.
 * A row keeps an item group off a mode, or on named stores only, says why (one of the simulator's sentences), and has a
 * switch. The owner's pick (variant A): the rules are a list of rows, by item group and then by mode, each with its switch.
 */
import { describe, expect, it } from 'vitest'
import type { ProductRuleRow } from '@/core/models/sourcing-planner'
import { ruleGroups, ruleRows, switchEnded, switchStarted } from './rule-rows-model'
import { rowsOf } from './wire'

const rule = (over: Partial<ProductRuleRow> & Pick<ProductRuleRow, 'rule' | 'group' | 'value' | 'mode' | 'reason'>): ProductRuleRow => ({
  onlyFrom: [],
  on: true,
  note: '',
  startedBy: '',
  startedAt: '2026-11-01 07:00:00',
  ended: false,
  ...over,
})

const ROWS = rowsOf('rules', {
  rules: [
    rule({ rule: 'PR0015', group: 'LIST', value: 'BULKY', mode: 'DAWAA_NOW', reason: 'BULKY' }),
    rule({ rule: 'PR0013', group: 'COLD_CHAIN', value: '', mode: 'CARRIER_NEXT_DAY', reason: 'COLD' }),
    rule({ rule: 'PR0007', group: 'LIST', value: 'RESTRICTED', mode: 'SLOT', reason: 'RESTRICTED' }),
    rule({ rule: 'PR0011', group: 'COLD_CHAIN', value: '', mode: 'DAWAA_NOW', reason: 'COLD', on: false }),
    rule({ rule: 'PR0006', group: 'LIST', value: 'RESTRICTED', mode: 'DAWAA_NOW', reason: 'RESTRICTED' }),
    rule({ rule: 'PR0001', group: 'SAP_STATUS', value: 'Restricted Drugs', mode: 'DAWAA_NOW', reason: 'RESTRICTED' }),
    rule({ rule: 'PR0020', group: 'ITEM', value: '121007', mode: '', onlyFrom: ['P901', 'P905'], reason: 'NAMED_STORES', on: false }),
    rule({ rule: 'PR0012', group: 'COLD_CHAIN', value: '', mode: 'SLOT', reason: 'COLD', ended: true, endedAt: '2026-11-10 09:00:00' }),
  ],
  lists: [],
})

describe('rule rows by item group and mode', () => {
  it('lists the rows in force by group (the server\'s order), then value, then mode in the six modes\' order', () => {
    expect(ruleRows(ROWS).map((r) => r.rule)).toEqual(['PR0011', 'PR0013', 'PR0001', 'PR0015', 'PR0006', 'PR0007', 'PR0020'])
  })

  it('reads each row\'s switch, why, and stores', () => {
    const named = ruleRows(ROWS).find((r) => r.rule === 'PR0020')!
    expect(named).toMatchObject({ group: 'ITEM', value: '121007', mode: null, onlyFrom: ['P901', 'P905'], reason: 'NAMED_STORES', on: false })
    expect(ruleRows(ROWS).find((r) => r.rule === 'PR0006')!.onlyFrom).toEqual([])
  })

  it('groups the rows by item group, counting the switches on and off', () => {
    expect(ruleGroups(ROWS).map((g) => [g.group, g.value, g.rows.map((r) => r.mode), g.on, g.off])).toEqual([
      ['COLD_CHAIN', null, ['DAWAA_NOW', 'CARRIER_NEXT_DAY'], 1, 1],
      ['SAP_STATUS', 'Restricted Drugs', ['DAWAA_NOW'], 1, 0],
      ['LIST', 'BULKY', ['DAWAA_NOW'], 1, 0],
      ['LIST', 'RESTRICTED', ['DAWAA_NOW', 'SLOT'], 2, 0],
      ['ITEM', '121007', [null], 0, 1],
    ])
  })

  it('leaves out an ended row', () => {
    expect(ruleRows(ROWS).some((r) => r.rule === 'PR0012')).toBe(false)
  })
})

describe('switching a row', () => {
  it('a row whose switch is waiting on its answer cannot be switched again; another row may switch meanwhile (review 2 #5)', () => {
    const a = switchStarted(new Set(), 'cold-dn')!
    expect([...a]).toEqual(['cold-dn'])
    expect(switchStarted(a, 'cold-dn')).toBeNull()
    const both = switchStarted(a, 'bulky-dn')!
    expect([...both].sort()).toEqual(['bulky-dn', 'cold-dn'])
    // B's answer coming back leaves A waiting still.
    expect([...switchEnded(both, 'bulky-dn')]).toEqual(['cold-dn'])
    expect(switchStarted(switchEnded(both, 'bulky-dn'), 'cold-dn')).toBeNull()
    expect(switchStarted(switchEnded(a, 'cold-dn'), 'cold-dn')).not.toBeNull()
  })
})
