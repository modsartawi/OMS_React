/**
 * Ticket 551 — the HungerStation probe's three flags (contract § `GET HungerStationWeb/Access`). Each
 * leaf and each page reads its flag through one predicate; only an explicit `true` grants, so a
 * missing, errored or malformed answer keeps every HungerStation screen hidden (fail closed).
 */
import { describe, expect, it } from 'vitest'
import type { HungerStationAccessResult } from '@/core/models/hungerstation'
import { HUNGERSTATION_FLAGS, canManageCatalog, canManageStores, canViewOrders, hungerStationGrants } from './access'

const all = (value: boolean): HungerStationAccessResult => ({ canManageStores: value, canManageCatalog: value, canViewOrders: value })

describe('hungerStationGrants', () => {
  it('names exactly the three contract flags', () => {
    expect([...HUNGERSTATION_FLAGS].sort()).toEqual(['canManageCatalog', 'canManageStores', 'canViewOrders'])
  })

  it.each([null, undefined])('a %s answer grants nothing', (r) => {
    expect(hungerStationGrants(r)).toEqual(all(false))
  })

  it('🚩 a malformed answer grants nothing — an array (an unstubbed drive), a string "true", a 1', () => {
    expect(hungerStationGrants([] as unknown as HungerStationAccessResult)).toEqual(all(false))
    expect(hungerStationGrants({ canManageStores: 'true', canViewOrders: 1 } as unknown as HungerStationAccessResult)).toEqual(all(false))
  })

  it('🚩 Deliverect’s fourth flag means nothing here', () => {
    expect(hungerStationGrants({ canManageTerms: true } as unknown as HungerStationAccessResult)).toEqual(all(false))
  })

  it('each flag reads only its own field', () => {
    for (const flag of HUNGERSTATION_FLAGS) {
      const grants = hungerStationGrants({ ...all(false), [flag]: true })
      for (const other of HUNGERSTATION_FLAGS) expect([other, grants[other]]).toEqual([other, other === flag])
    }
  })
})

describe('the per-leaf predicates', () => {
  it.each([
    ['canManageStores', canManageStores],
    ['canManageCatalog', canManageCatalog],
    ['canViewOrders', canViewOrders],
  ] as const)('%s follows its own flag', (flag, can) => {
    expect(can({ ...all(false), [flag]: true })).toBe(true)
    expect(can({ ...all(true), [flag]: false })).toBe(false)
    expect(can(undefined)).toBe(false)
  })
})
