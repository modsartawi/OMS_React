/**
 * The loyalty-groups probe's predicates (oms ticket 629, BackOffice spec 3173).
 *
 * 🚩 Only an explicit `true` admits, and `canMaintain` sits BESIDE `canView`, never instead of it: a
 * session that may maintain but not view gets nothing. The shapes below are the ones the type forbids
 * and a real projection can still emit, hence the cast.
 */
import { describe, expect, it } from 'vitest'
import type { LoyGroupAccess } from '@/core/models/loy-groups'
import { canMaintainLoyGroups, canViewLoyGroups } from './api'

const answer = (flags: unknown) => flags as LoyGroupAccess

describe('loy-groups access predicates fail closed', () => {
  it('admits an explicit view grant, and a maintain grant only on top of it', () => {
    expect(canViewLoyGroups(answer({ canView: true, canMaintain: false }))).toBe(true)
    expect(canMaintainLoyGroups(answer({ canView: true, canMaintain: false }))).toBe(false)
    expect(canMaintainLoyGroups(answer({ canView: true, canMaintain: true }))).toBe(true)
  })

  it('🚩 hides on an absent, malformed or false answer', () => {
    const denials = [
      { canView: false, canMaintain: false },
      {},
      { canView: 'true' },
      { canView: 1 },
      { canView: null },
      { canOpen: true },
      'true',
      [],
    ]
    for (const d of denials) {
      expect(canViewLoyGroups(answer(d))).toBe(false)
      expect(canMaintainLoyGroups(answer(d))).toBe(false)
    }
    for (const nothing of [null, undefined]) {
      expect(canViewLoyGroups(nothing)).toBe(false)
      expect(canMaintainLoyGroups(nothing)).toBe(false)
    }
  })

  it('🚩 canMaintain without canView still hides', () => {
    for (const d of [{ canMaintain: true }, { canView: false, canMaintain: true }, { canView: 'true', canMaintain: true }]) {
      expect(canViewLoyGroups(answer(d))).toBe(false)
      expect(canMaintainLoyGroups(answer(d))).toBe(false)
    }
  })
})
