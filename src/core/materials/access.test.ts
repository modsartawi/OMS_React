/**
 * Ticket 451 — the Materials probe's three flags (contract § `GET MaterialWeb/Access`). Each leaf
 * and each page reads its flag through one predicate; only an explicit `true` grants, so a missing,
 * errored or malformed answer keeps every Materials screen hidden (fail closed).
 */
import { describe, expect, it } from 'vitest'
import type { MaterialAccessResult } from '@/core/models/materials'
import {
  MATERIAL_FLAGS,
  canCheckGs1,
  canCheckStock,
  canSearchMaterials,
  canSeeMaterialStock,
  materialGrants,
} from './access'

const all = (value: boolean): MaterialAccessResult => ({ canSearchMaterials: value, canCheckStock: value, canCheckGs1: value })

describe('materialGrants', () => {
  it('names exactly the three contract flags', () => {
    expect([...MATERIAL_FLAGS].sort()).toEqual(['canCheckGs1', 'canCheckStock', 'canSearchMaterials'])
  })

  it.each([null, undefined])('a %s answer grants nothing', (r) => {
    expect(materialGrants(r)).toEqual(all(false))
  })

  it('🚩 a malformed answer grants nothing — an array (an unstubbed drive), a string "true", a 1', () => {
    expect(materialGrants([] as unknown as MaterialAccessResult)).toEqual(all(false))
    expect(materialGrants({ canSearchMaterials: 'true', canCheckStock: 1 } as unknown as MaterialAccessResult)).toEqual(all(false))
  })

  it('each flag reads only its own field, proven true and false', () => {
    for (const flag of MATERIAL_FLAGS) {
      const grants = materialGrants({ ...all(false), [flag]: true })
      for (const other of MATERIAL_FLAGS) expect([other, grants[other]]).toEqual([other, other === flag])
    }
  })
})

describe('the per-leaf predicates', () => {
  it('each follows its own flag', () => {
    expect(canSearchMaterials({ ...all(false), canSearchMaterials: true })).toBe(true)
    expect(canSearchMaterials({ ...all(true), canSearchMaterials: false })).toBe(false)
    expect(canCheckStock({ ...all(false), canCheckStock: true })).toBe(true)
    expect(canCheckStock({ ...all(true), canCheckStock: false })).toBe(false)
    expect(canCheckGs1({ ...all(false), canCheckGs1: true })).toBe(true)
    expect(canCheckGs1({ ...all(true), canCheckGs1: false })).toBe(false)
  })

  it("the detail's Stock tab needs BOTH the search and the stock grant", () => {
    expect(canSeeMaterialStock(all(true))).toBe(true)
    expect(canSeeMaterialStock({ ...all(true), canCheckStock: false })).toBe(false)
    expect(canSeeMaterialStock({ ...all(true), canSearchMaterials: false })).toBe(false)
    expect(canSeeMaterialStock(undefined)).toBe(false)
  })
})
