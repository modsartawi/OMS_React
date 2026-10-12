/**
 * Ticket 477 — the Deliverect probe's four flags (contract § `GET DeliverectWeb/Access`). Each leaf
 * and each page reads its flag through one predicate; only an explicit `true` grants, so a missing,
 * errored or malformed answer keeps every Deliverect screen hidden (fail closed).
 */
import { describe, expect, it } from 'vitest'
import type { DeliverectAccessResult } from '@/core/models/deliverect'
import {
  DELIVERECT_FLAGS,
  canManageCatalog,
  canManageStores,
  canManageTerms,
  canViewOrders,
  deliverectGrants,
} from './access'

const all = (value: boolean): DeliverectAccessResult => ({
  canManageStores: value,
  canManageCatalog: value,
  canViewOrders: value,
  canManageTerms: value,
})

describe('deliverectGrants', () => {
  it('names exactly the four contract flags', () => {
    expect([...DELIVERECT_FLAGS].sort()).toEqual(['canManageCatalog', 'canManageStores', 'canManageTerms', 'canViewOrders'])
  })

  it.each([null, undefined])('a %s answer grants nothing', (r) => {
    expect(deliverectGrants(r)).toEqual(all(false))
  })

  it('🚩 a malformed answer grants nothing — an array (an unstubbed drive), a string "true", a 1', () => {
    expect(deliverectGrants([] as unknown as DeliverectAccessResult)).toEqual(all(false))
    expect(deliverectGrants({ canManageStores: 'true', canViewOrders: 1 } as unknown as DeliverectAccessResult)).toEqual(all(false))
  })

  it('each flag reads only its own field, proven true and false', () => {
    for (const flag of DELIVERECT_FLAGS) {
      const grants = deliverectGrants({ ...all(false), [flag]: true })
      for (const other of DELIVERECT_FLAGS) expect([other, grants[other]]).toEqual([other, other === flag])
    }
  })
})

describe('the per-leaf predicates', () => {
  it.each([
    ['canManageStores', canManageStores],
    ['canManageCatalog', canManageCatalog],
    ['canViewOrders', canViewOrders],
    ['canManageTerms', canManageTerms],
  ] as const)('%s follows its own flag', (flag, can) => {
    expect(can({ ...all(false), [flag]: true })).toBe(true)
    expect(can({ ...all(true), [flag]: false })).toBe(false)
    expect(can(undefined)).toBe(false)
  })
})
