/**
 * Scope resolution — **mine ∪ one-level reports, never a permission** (ticket 270,
 * spec 267 D2).
 *
 * Two of the three rules here regress silently, which is why they are pinned in a
 * pure module rather than eyeballed on a screen:
 *
 * - an accountant with **no staff row opens unfiltered**, and the screen must not
 *   announce it as an error (user story 6);
 * - **widening is never locked** — the scope ranks and counts, and refuses nothing.
 *
 * The third rule — that the two enumerated lanes ignore the scope entirely — is
 * next door in `worklist.test.ts`, because it is a property of the *lanes* rather
 * than of the scope.
 */
import { describe, expect, it } from 'vitest'
import type { SettlementFleetRow } from '@/core/models/settlement'
import { SETTLEMENT_FLEET } from './fleet-fixture'
import {
  DEFAULT_SCOPE,
  branchesInScope,
  hasAssignment,
  isInScope,
  readScope,
  resolveScope,
} from './scope'

const row = (storeId: string, assignment: SettlementFleetRow['assignment']): SettlementFleetRow => ({
  storeId,
  storeName: `${storeId} Pharmacy`,
  city: 'Riyadh',
  assignment,
  currencyKey: 'SAR',
  openCount: 1,
  shortageTotal: 10,
  surplusTotal: 0,
  signedPosition: 10,
  movedSinceCutoff: 0,
  hasOrphan: false,
  hasUncollectedReceipt: false,
  ageingCount: 1,
})

const ASSIGNED = [row('0142', 'mine'), row('0331', 'unassigned'), row('0455', 'other')]
/** The session finance never seeded: nothing came back as mine. */
const NO_STAFF_ROW = [row('0331', 'unassigned'), row('0455', 'other')]

describe('reading the scope out of a URL', () => {
  it('opens on MY BRANCHES when nothing says otherwise', () => {
    expect(readScope(null)).toBe(DEFAULT_SCOPE)
    expect(readScope('')).toBe('mine')
    expect(DEFAULT_SCOPE).toBe('mine')
  })

  it('takes all three states, and reads a hand-edited value as the default', () => {
    expect(readScope('unassigned')).toBe('unassigned')
    expect(readScope(' ALL ')).toBe('all')
    // Nothing a bad value could unlock — the scope is not a permission.
    expect(readScope('everything')).toBe('mine')
  })
})

describe('🔑 no staff row opens UNFILTERED, and is not an error', () => {
  it('degrades *mine* to the whole estate when nothing is assigned', () => {
    const resolution = resolveScope('mine', NO_STAFF_ROW)

    expect(hasAssignment(NO_STAFF_ROW)).toBe(false)
    expect(resolution.unfiltered).toBe(true)
    expect(resolution.effective).toBe('all')
    // 🚩 …and the CONTROL still says *mine*, because that is what the accountant
    // chose and what they will hold again the moment finance seeds their row.
    expect(resolution.scope).toBe('mine')
    expect(branchesInScope(NO_STAFF_ROW, resolution)).toHaveLength(2)
  })

  it('does NOT degrade a deliberate *unassigned* — that choice has a real answer', () => {
    const resolution = resolveScope('unassigned', NO_STAFF_ROW)
    expect(resolution.unfiltered).toBe(false)
    expect(branchesInScope(NO_STAFF_ROW, resolution).map((r) => r.storeId)).toEqual(['0331'])
  })

  it('leaves a seeded session alone', () => {
    const resolution = resolveScope('mine', ASSIGNED)
    expect(resolution.unfiltered).toBe(false)
    expect(branchesInScope(ASSIGNED, resolution).map((r) => r.storeId)).toEqual(['0142'])
  })
})

describe('the three states over the assignment', () => {
  it('separates mine, nobody’s, and a colleague’s', () => {
    const of = (scope: 'mine' | 'unassigned' | 'all') =>
      branchesInScope(ASSIGNED, resolveScope(scope, ASSIGNED)).map((r) => r.storeId)

    expect(of('mine')).toEqual(['0142'])
    expect(of('unassigned')).toEqual(['0331'])
    // 🔑 *all* is the estate — including the branches somebody else is assigned.
    expect(of('all')).toEqual(['0142', '0331', '0455'])
  })

  it('🔑 widening is never locked — every branch is reachable from *all*', () => {
    const all = resolveScope('all', SETTLEMENT_FLEET)
    expect(SETTLEMENT_FLEET.every((r) => isInScope(r, all))).toBe(true)
  })

  it('scopes the estate fixture to one accountant’s two dozen branches', () => {
    const mine = branchesInScope(SETTLEMENT_FLEET, resolveScope('mine', SETTLEMENT_FLEET))
    const unassigned = branchesInScope(
      SETTLEMENT_FLEET,
      resolveScope('unassigned', SETTLEMENT_FLEET),
    )
    // 🚩 The shape of the problem, in two numbers: the accountant's own scope is
    // 1.7% of the estate, and the unowned remainder is 90% of it.
    expect(mine).toHaveLength(24)
    expect(unassigned).toHaveLength(1255)
  })

  it('tolerates a door that answered nothing — the contract is 274’s to settle', () => {
    const resolution = resolveScope('mine', null)
    expect(resolution.unfiltered).toBe(true)
    expect(branchesInScope(null, resolution)).toEqual([])
  })
})
