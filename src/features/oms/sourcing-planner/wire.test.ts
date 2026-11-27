/**
 * Ticket 968 over the real planner doors (BackOffice at pricing2 35a4e56be): three families, each with its own shape —
 * BO 4375 `PlannerStockEndpoints` (buffer overrides, stock confidence), BO 4362 `ProductRuleEndpoints` (rules, the
 * restricted and bulky lists), BO 4361 `PlannerTableEndpoints` (store by mode, carrier contracts, slot rules). The
 * screen keeps one row shape and one history; this module reads each reply into it and writes each change to its door.
 */
import { describe, expect, it } from 'vitest'
import type { BufferOverrideView, PlannerRowReply, ProductRuleListing, StoreConfidenceView } from '@/core/models/sourcing-planner'
import { endCall, historyOf, readCall, rowsOf, saveCall, switchCall, versionsOf } from './wire'

const override = (over: Partial<BufferOverrideView>): BufferOverrideView => ({
  id: '01OV1',
  level: 'STORE_ITEM',
  store: 'P905',
  item: '121007',
  category: '',
  keepUnits: 4,
  firstDay: '2026-11-01',
  reason: 'Clinic orders every Sunday',
  createdBy: 'nalharbi',
  createdAt: '2026-11-01 08:00:00',
  ended: false,
  expired: false,
  ...over,
})

describe('reading each door into rows', () => {
  it('reads the overrides door: only the level\'s keys, figures as sent, the reason kept with the row', () => {
    expect(readCall('overrides', true)).toEqual({ path: 'SourcingAdvisor/BufferOverrides', params: { withEnded: 'true' } })
    const [row] = rowsOf('overrides', [override({ keepDays: 1.5, lastDay: '2026-12-31' })])
    expect(row).toMatchObject({
      id: '01OV1',
      key: '01OV1',
      values: { level: 'STORE_ITEM', store: 'P905', item: '121007', category: null, keepUnits: 4, keepDays: 1.5, firstDay: '2026-11-01', lastDay: '2026-12-31' },
      setAt: '2026-11-01 08:00:00',
      setBy: 'nalharbi',
      reason: 'Clinic orders every Sunday',
      endedAt: null,
    })
    expect(rowsOf('overrides', [override({ expired: true })])[0].flag).toBe('EXPIRED')
  })

  it('reads a store\'s confidence: keyed by its store, ending on `endsOn`', () => {
    const c: StoreConfidenceView = {
      id: '01SC1',
      store: 'P907',
      confidence: 0.8,
      reason: 'Count gaps after the refit',
      endsOn: '2026-12-20',
      createdBy: 'nalharbi',
      createdAt: '2026-11-20 09:00:00',
      ended: false,
      pastEndDate: false,
    }
    expect(readCall('confidence', false)).toEqual({ path: 'SourcingAdvisor/StoreConfidences', params: { withEnded: null } })
    expect(rowsOf('confidence', [c])[0]).toMatchObject({ id: '01SC1', key: 'P907', values: { store: 'P907', confidence: 0.8, endsOn: '2026-12-20' } })
  })

  const listing: ProductRuleListing = {
    rules: [
      { rule: 'PR0011', group: 'COLD_CHAIN', value: '', mode: 'DAWAA_NOW', onlyFrom: [], reason: 'COLD', on: false, note: '', startedBy: 'seed', startedAt: '2026-11-01 07:00:00', ended: true, endedBy: 'nalharbi', endedAt: '2026-11-10 09:00:00' },
      { rule: 'PR0011', group: 'COLD_CHAIN', value: '', mode: 'DAWAA_NOW', onlyFrom: [], reason: 'COLD', on: true, note: 'Cool boxes on every bike', startedBy: 'nalharbi', startedAt: '2026-11-10 09:00:00', ended: false },
      { rule: 'PR0020', group: 'ITEM', value: '121007', mode: '', onlyFrom: ['P901', 'P905'], reason: 'NAMED_STORES', on: true, note: '', startedBy: 'msartawi', startedAt: '2026-11-12 10:00:00', ended: false },
    ],
    lists: [
      { list: 'BULKY', kind: 'SUB_CATEGORY', code: 'B001', note: '', startedBy: 'seed', startedAt: '2026-11-01 07:00:00', ended: false },
      { list: 'RESTRICTED', kind: 'ITEM', code: '300114', note: 'Hospital-only pack', startedBy: 'nalharbi', startedAt: '2026-11-05 12:00:00', ended: false },
    ],
  }

  it('reads the product rules door once for the rules and both lists', () => {
    expect(readCall('rules', true)).toEqual({ path: 'SourcingAdvisor/ProductRules', params: { withHistory: 'true' } })
    expect(readCall('bulky', false)).toEqual({ path: 'SourcingAdvisor/ProductRules', params: { withHistory: null } })
    const rules = rowsOf('rules', listing)
    expect(rules.map((r) => [r.key, r.values.on, r.endedAt ?? null])).toEqual([
      ['PR0011', false, '2026-11-10 09:00:00'],
      ['PR0011', true, null],
      ['PR0020', true, null],
    ])
    expect(rules[2].values).toEqual({ group: 'ITEM', value: '121007', mode: null, onlyFrom: ['P901', 'P905'], reason: 'NAMED_STORES', on: true, note: null })
    expect(rowsOf('restricted', listing).map((r) => [r.key, r.values])).toEqual([['RESTRICTED|ITEM|300114', { code: '300114', note: 'Hospital-only pack' }]])
    expect(rowsOf('bulky', listing).map((r) => r.values)).toEqual([{ kind: 'SUB_CATEGORY', code: 'B001', note: null }])
  })

  it('reads a planner table by its wire name, the row\'s own fields beside its note', () => {
    expect(readCall('contracts', true)).toEqual({ path: 'SourcingAdvisor/PlannerTables', params: { table: 'carrierContracts' } })
    const reply: PlannerRowReply = {
      id: '01CC2',
      key: 'ARX-ND-RUH',
      row: { contract: 'ARX-ND-RUH', mode: 'CARRIER_NEXT_DAY', courier: 'ARAMEX', cities: ['RUH', 'KHJ'], cutOff: '14:00', daysToDeliver: 1, deliverBy: '22:00', rate: 18.5, collectAt: '16:00', keepsCold: false, assumed: true },
      addedBy: 'falotaibi',
      addedAt: '2026-11-12 08:30:40',
      ended: false,
      replaces: '01CC1',
      note: 'Rate from the draft contract',
    }
    expect(rowsOf('contracts', [reply])[0]).toMatchObject({
      id: '01CC2',
      key: 'ARX-ND-RUH',
      replaces: '01CC1',
      values: { contract: 'ARX-ND-RUH', mode: 'CARRIER_NEXT_DAY', courier: 'ARAMEX', cities: ['RUH', 'KHJ'], rate: 18.5, assumed: true, note: 'Rate from the draft contract' },
    })
    expect(readCall('slots', false)).toEqual({ path: 'SourcingAdvisor/PlannerTables', params: { table: 'slotRules' } })
  })
})

describe('a row\'s history', () => {
  it('follows an override\'s chain both ways, and reads each change with its reason; an ending says why', () => {
    const all = rowsOf('overrides', [
      override({ id: 'A', ended: true, endedBy: 'msartawi', endedAt: '2026-11-05 10:00:00', endReason: 'Two more clinics', replacedBy: 'B' }),
      override({ id: 'B', keepUnits: 6, reason: 'Two more clinics', createdBy: 'msartawi', createdAt: '2026-11-05 10:00:00', replaces: 'A', ended: true, endedBy: 'nalharbi', endedAt: '2026-11-20 08:00:00', endReason: 'Clinic closed' }),
      override({ id: 'X', item: '999999' }),
    ])
    const versions = versionsOf('overrides', all, all[1])
    expect(versions.map((v) => v.id)).toEqual(['A', 'B'])
    expect(historyOf('overrides', versions)).toEqual([
      { id: 'B-end', rowId: 'B', action: 'END', diffs: [], reason: 'Clinic closed', by: 'nalharbi', at: '2026-11-20 08:00:00' },
      { id: 'B', rowId: 'B', action: 'CHANGE', diffs: [{ field: 'keepUnits', old: 4, new: 6 }], reason: 'Two more clinics', by: 'msartawi', at: '2026-11-05 10:00:00' },
      {
        id: 'A',
        rowId: 'A',
        action: 'ADD',
        diffs: [
          { field: 'level', old: null, new: 'STORE_ITEM' },
          { field: 'store', old: null, new: 'P905' },
          { field: 'item', old: null, new: '121007' },
          { field: 'keepUnits', old: null, new: 4 },
          { field: 'firstDay', old: null, new: '2026-11-01' },
        ],
        reason: 'Clinic orders every Sunday',
        by: 'nalharbi',
        at: '2026-11-01 08:00:00',
      },
    ])
  })

  it('reads a rule switched as a switch, its rows joined by rule id and time', () => {
    const rules = rowsOf('rules', {
      rules: [
        { rule: 'PR0011', group: 'COLD_CHAIN', value: '', mode: 'DAWAA_NOW', onlyFrom: [], reason: 'COLD', on: true, note: '', startedBy: '', startedAt: '2026-11-01 07:00:00', ended: true, endedBy: 'nalharbi', endedAt: '2026-11-10 09:00:00' },
        { rule: 'PR0011', group: 'COLD_CHAIN', value: '', mode: 'DAWAA_NOW', onlyFrom: [], reason: 'COLD', on: false, note: '', startedBy: 'nalharbi', startedAt: '2026-11-10 09:00:00', ended: false },
      ],
      lists: [],
    })
    expect(historyOf('rules', versionsOf('rules', rules, rules[1])).map((c) => [c.action, c.by])).toEqual([
      ['SWITCH_OFF', 'nalharbi'],
      ['ADD', ''],
    ])
  })
})

describe('writing each change to its door', () => {
  const ov = rowsOf('overrides', [override({})])[0]

  it('an override: a new one, or a change that names the row it replaces, always with the reason', () => {
    const values = { level: 'ITEM', store: null, item: '121007', category: null, keepUnits: null, keepDays: 2, firstDay: '2026-11-27', lastDay: null }
    expect(saveCall('overrides', null, values, ' Flu season ')).toEqual({
      path: 'SourcingAdvisor/BufferOverrides/Save',
      body: { replaces: null, ...values, reason: 'Flu season' },
    })
    expect(saveCall('overrides', ov, values, 'Flu season').body).toMatchObject({ replaces: '01OV1' })
    expect(endCall('overrides', ov, 'Clinic closed')).toEqual({ path: 'SourcingAdvisor/BufferOverrides/End', body: { id: '01OV1', reason: 'Clinic closed' } })
  })

  it('a store\'s confidence: set for the store, ended by the store\'s code', () => {
    const c = rowsOf('confidence', [
      { id: '01SC1', store: 'P907', confidence: 0.8, reason: 'r', endsOn: '2026-12-20', createdBy: 'n', createdAt: '2026-11-20 09:00:00', ended: false, pastEndDate: false },
    ])[0]
    expect(saveCall('confidence', c, { store: 'P907', confidence: 0.75, endsOn: '2026-12-31' }, 'More gaps')).toEqual({
      path: 'SourcingAdvisor/StoreConfidences/Set',
      body: { store: 'P907', confidence: 0.75, reason: 'More gaps', endsOn: '2026-12-31' },
    })
    expect(endCall('confidence', c, 'Recounted')).toEqual({ path: 'SourcingAdvisor/StoreConfidences/End', body: { id: 'P907', reason: 'Recounted' } })
  })

  it('a rule: a new rule names none, a change and a switch name the rule; a rule is switched off, never ended', () => {
    const values = { group: 'ITEM', value: '121007', mode: null, onlyFrom: ['P901'], reason: 'NAMED_STORES', on: true, note: null }
    expect(saveCall('rules', null, values, '')).toEqual({
      path: 'SourcingAdvisor/ProductRules/Change',
      body: { group: 'ITEM', value: '121007', mode: '', onlyFrom: ['P901'], reason: 'NAMED_STORES', on: true, note: '' },
    })
    const row = rowsOf('rules', { rules: [{ rule: 'PR0015', group: 'LIST', value: 'BULKY', mode: 'DAWAA_NOW', onlyFrom: [], reason: 'BULKY', on: true, note: 'seed', startedBy: '', startedAt: '2026-11-01 07:00:00', ended: false }], lists: [] })[0]
    expect(switchCall(row)).toEqual({
      path: 'SourcingAdvisor/ProductRules/Change',
      body: { rule: 'PR0015', group: 'LIST', value: 'BULKY', mode: 'DAWAA_NOW', onlyFrom: [], reason: 'BULKY', on: false, note: 'seed' },
    })
    expect(endCall('rules', row, '')).toBeNull()
  })

  it('a list entry is added or taken off, never changed', () => {
    expect(saveCall('restricted', null, { code: '300114', note: 'Hospital-only pack' }, '')).toEqual({
      path: 'SourcingAdvisor/ProductRules/Lists/Add',
      body: { list: 'RESTRICTED', kind: 'ITEM', code: '300114', note: 'Hospital-only pack' },
    })
    const b = rowsOf('bulky', { rules: [], lists: [{ list: 'BULKY', kind: 'SUB_CATEGORY', code: 'B001', note: '', startedBy: '', startedAt: '2026-11-01 07:00:00', ended: false }] })[0]
    expect(endCall('bulky', b, '')).toEqual({ path: 'SourcingAdvisor/ProductRules/Lists/Remove', body: { list: 'BULKY', kind: 'SUB_CATEGORY', code: 'B001' } })
  })

  it('a planner table row goes in the table\'s own shape with its note; it ends by its key', () => {
    expect(saveCall('storeModes', null, { store: 'P905', mode: 'DAWAA_NOW', gives: false, note: 'Refit until March' }, '')).toEqual({
      path: 'SourcingAdvisor/PlannerTables/Save',
      body: { table: 'storeModes', row: { store: 'P905', mode: 'DAWAA_NOW', gives: false }, note: 'Refit until March' },
    })
    expect(
      saveCall('slots', null, { kind: 'NEXT_DAY_AFTER', from: '21:00', to: null, note: null }, ''),
    ).toEqual({ path: 'SourcingAdvisor/PlannerTables/Save', body: { table: 'slotRules', row: { kind: 'NEXT_DAY_AFTER', from: '21:00', to: null }, note: '' } })
    const row = rowsOf('storeModes', [
      { id: '01SM1', key: 'P905|DAWAA_NOW', row: { store: 'P905', mode: 'DAWAA_NOW', gives: false }, addedBy: 'n', addedAt: '2026-11-01 07:00:00', ended: false, note: '' },
    ])[0]
    expect(endCall('storeModes', row, '')).toEqual({ path: 'SourcingAdvisor/PlannerTables/End', body: { table: 'storeModes', key: 'P905|DAWAA_NOW' } })
  })
})
