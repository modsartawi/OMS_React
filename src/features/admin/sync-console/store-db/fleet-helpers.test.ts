import { describe, expect, it } from 'vitest'
import type { StoreDbFleetRow } from '@/core/models/store-database'
import fleet from './__fixtures__/fleet.json'
import { ALL_FLEET, bitnessKey, fleetEditions, fleetEngines, fleetFiltered, fleetRowView, shownFleet } from './fleet-helpers'

const rows = fleet as StoreDbFleetRow[]
const row = (code: string) => rows.find((r) => r.code === code)!

/** Oms 915 proof: rows render state chips and the used/cap bar from a fixture answer. */
describe('a fleet row as drawn', () => {
  it('names and colours each state the door sent, never judging it again', () => {
    expect(fleetRowView(row('P014')).chip).toEqual({ labelKey: 'storeDb.states.Critical', sev: 'bad' })
    expect(fleetRowView(row('C011')).chip).toEqual({ labelKey: 'storeDb.states.DiskLow', sev: 'bad' })
    expect(fleetRowView(row('P102')).chip).toEqual({ labelKey: 'storeDb.states.Watch', sev: 'warn' })
    expect(fleetRowView(row('P050')).chip).toEqual({ labelKey: 'storeDb.states.Ok', sev: 'ok' })
  })

  it('never draws an unreachable store as healthy', () => {
    expect(fleetRowView(row('P300')).chip).toEqual({ labelKey: 'storeDb.states.NotChecked', sev: 'warn' })
  })

  it('shows a state this bundle does not know as its raw code, neutral', () => {
    expect(fleetRowView(row('P900')).chip).toEqual({ labelKey: null, sev: 'mute' })
  })

  it('fills the bar to the percent of the cap the door sent (usedPercent, 0..100)', () => {
    expect(fleetRowView(row('P014')).bar).toEqual({ percent: 95, sev: 'bad' })
    expect(fleetRowView(row('P102')).bar).toEqual({ percent: 72.5, sev: 'warn' })
    expect(fleetRowView(row('P050')).bar).toEqual({ percent: 40, sev: 'ok' })
  })

  it('draws no bar for a store with no cap or no reading', () => {
    expect(fleetRowView(row('C011')).bar).toBeNull()
    expect(fleetRowView(row('P300')).bar).toBeNull()
  })

  it('clamps a share over the cap to a full bar', () => {
    expect(fleetRowView({ ...row('P014'), usedPercent: 107 }).bar?.percent).toBe(100)
    expect(fleetRowView({ ...row('P014'), usedPercent: -20 }).bar?.percent).toBe(0)
  })
})

describe('the fleet as listed', () => {
  const codes = (list: StoreDbFleetRow[]) => list.map((r) => r.code)

  it('lists the worst state first (the server’s rank: Critical, Disk low, Watch, Not checked, OK), then the fewest days to cap', () => {
    expect(codes(shownFleet(rows, ALL_FLEET))).toEqual(['P014', 'P221', 'C011', 'P102', 'P300', 'P050', 'P007', 'P900'])
  })

  it('filters by state, engine and edition together', () => {
    expect(codes(shownFleet(rows, { ...ALL_FLEET, state: 'Critical' }))).toEqual(['P014', 'P221'])
    expect(codes(shownFleet(rows, { ...ALL_FLEET, engine: 'SQL Server 2008' }))).toEqual(['P221', 'P007'])
    expect(codes(shownFleet(rows, { ...ALL_FLEET, engine: 'SQL Server 2008 R2', edition: 'Express Edition' }))).toEqual(['P014', 'P102'])
    expect(codes(shownFleet(rows, { ...ALL_FLEET, state: 'Ok', engine: 'SQL Server 2019' }))).toEqual(['P050'])
  })

  it('ranks the stores on a 4 GB cap by days to cap for the Needs 2019 view', () => {
    // C011 (no cap) and P050 (2019, 10 GB) are not on the 4 GB cap; P300 was never read (no cap known); P007 has no forecast.
    expect(codes(shownFleet(rows, { ...ALL_FLEET, needs2019: true }))).toEqual(['P014', 'P221', 'P102', 'P007'])
  })

  it('keeps the other filters inside the Needs 2019 view', () => {
    expect(codes(shownFleet(rows, { ...ALL_FLEET, needs2019: true, engine: 'SQL Server 2008 R2' }))).toEqual(['P014', 'P102'])
  })

  it('offers each engine the fleet holds once, by release, a store never read offering none', () => {
    expect(fleetEngines(rows)).toEqual(['SQL Server 2008', 'SQL Server 2008 R2', 'SQL Server 2019', 'SQL Server 2022'])
  })

  it('offers each edition the fleet holds once, sorted', () => {
    expect(fleetEditions(rows)).toEqual(['Developer Edition', 'Express Edition', 'Standard Edition'])
  })
})

describe('whether the tab is filtered', () => {
  it('is not, with every filter at All', () => {
    expect(fleetFiltered(ALL_FLEET)).toBe(false)
    expect(fleetFiltered({ state: null, engine: null, edition: null, needs2019: false })).toBe(false)
  })

  it('is, with any one filter set', () => {
    expect(fleetFiltered({ ...ALL_FLEET, state: 'Critical' })).toBe(true)
    expect(fleetFiltered({ ...ALL_FLEET, engine: 'SQL Server 2008' })).toBe(true)
    expect(fleetFiltered({ ...ALL_FLEET, edition: 'Express Edition' })).toBe(true)
    expect(fleetFiltered({ ...ALL_FLEET, needs2019: true })).toBe(true)
  })
})

describe('a store’s bitness', () => {
  it('names the server’s x64 / x86 words, and has none for a value it does not know or no reading', () => {
    expect(bitnessKey('x64')).toBe('storeDb.fleet.bitness.x64')
    expect(bitnessKey('x86')).toBe('storeDb.fleet.bitness.x86')
    expect(bitnessKey('ARM64')).toBeNull()
    expect(bitnessKey(null)).toBeNull()
  })
})
