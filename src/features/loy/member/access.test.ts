/**
 * The Loyalty probe's predicate (ticket 234, spec 231 §11).
 *
 * One rule, and it is the ticket's point rather than its plumbing: **only an
 * explicit grant admits**. Everything else — a refusal, a projection that
 * dropped the flag, a door answering a shape nobody agreed to — is a denial.
 *
 * 🚩 The failure being designed against is a customer-PII lookup left open
 * because the client read a loose answer as "probably fine". What the nav does
 * with each of these answers is pinned next door, in
 * `src/layout/menu-loy.test.ts`, where a feature's menu entry can be read
 * without a feature importing `layout`.
 */
import { describe, expect, it } from 'vitest'
import type { LoyAccessResult } from '@/core/models/loy'
import {
  canEditLoyMember,
  canOpenLoyMember,
  canRemoveLoyMemberMobile,
  memberAuthority,
} from './api'

/**
 * A probe answer built from the flags a scenario cares about. The cast is the
 * point rather than a convenience: the shapes worth testing here are the ones
 * the *type* forbids — a door that dropped a flag, or answered a string — and
 * every one of them is a shape a real projection can emit.
 */
const answer = (flags: Record<string, unknown>) => flags as unknown as LoyAccessResult

describe('canOpenLoyMember — the probe predicate', () => {
  it('admits a granted answer', () => {
    expect(canOpenLoyMember(answer({ canOpenLoyMember: true }))).toBe(true)
  })

  it('denies an explicit refusal', () => {
    expect(canOpenLoyMember(answer({ canOpenLoyMember: false }))).toBe(false)
  })

  it('🚩 denies a MALFORMED answer rather than reading it loosely', () => {
    // `=== true` is what makes each of these a denial instead of an accident of
    // truthiness — including the two that a lenient check would admit
    // (`'true'`, `1`) and the two that would throw on a bare property read.
    const malformed = [
      {},
      { canOpenLoyMember: 'true' },
      { canOpenLoyMember: 1 },
      { canOpenLoyMember: null },
      { canOpen: true },
    ] as unknown as LoyAccessResult[]
    for (const answer of malformed) expect(canOpenLoyMember(answer)).toBe(false)
    // An absent answer is the shape the signature admits, so it needs no cast:
    // a probe can resolve to nothing at all and that is still a denial.
    expect(canOpenLoyMember(null)).toBe(false)
    expect(canOpenLoyMember(undefined)).toBe(false)
  })
})

/**
 * Spec 301's second and third tiers (ticket 302, ADR 0001). Same rule as above,
 * and it is stated a second time rather than inherited because these two flags
 * guard *writes*: the first one being wrong shows a screen, these two show a
 * control that edits a customer's record or destroys their login.
 */
describe('theEditAndRemovePredicatesAdmitOnlyLiteralTrue', () => {
  const predicates = [
    ['canEditLoyMember', canEditLoyMember],
    ['canRemoveLoyMemberMobile', canRemoveLoyMemberMobile],
  ] as const

  it('admits an explicit grant, and only its own flag', () => {
    for (const [flag, predicate] of predicates) {
      expect(predicate(answer({ canOpenLoyMember: true, [flag]: true }))).toBe(true)
      // 🚩 The tiers do not leak into one another: holding *may look* — or the
      // OTHER write flag — says nothing about this one.
      const other = predicates.find(([name]) => name !== flag)![0]
      expect(predicate(answer({ canOpenLoyMember: true, [other]: true }))).toBe(false)
    }
  })

  it('🚩 reads every not-literally-true answer as a denial', () => {
    for (const [flag, predicate] of predicates) {
      const denials = [
        { canOpenLoyMember: true, [flag]: false },
        // The door dropped the flag — an older API, or a projection that was
        // never updated. Absence is not permission.
        { canOpenLoyMember: true },
        {},
        { canOpenLoyMember: true, [flag]: 'true' },
        { canOpenLoyMember: true, [flag]: 1 },
        { canOpenLoyMember: true, [flag]: null },
        { canOpenLoyMember: true, [flag]: {} },
      ]
      for (const denial of denials) expect(predicate(answer(denial))).toBe(false)
      // An errored probe resolves to nothing at all, and a pending one has not
      // resolved yet. Both reach the predicate as an absent answer, and both are
      // *no* — there is no 404-tolerant catch anywhere on this path.
      expect(predicate(null)).toBe(false)
      expect(predicate(undefined)).toBe(false)
    }
  })
})

describe('memberAuthority', () => {
  it('reads the three tiers off ONE answer', () => {
    expect(
      memberAuthority(
        answer({
          canOpenLoyMember: true,
          canEditLoyMember: true,
          canRemoveLoyMemberMobile: true,
        }),
      ),
    ).toEqual({ mayLook: true, mayEdit: true, mayRemoveMobile: true })
  })

  it('draws the look-only session with no write authority at all', () => {
    expect(memberAuthority(answer({ canOpenLoyMember: true }))).toEqual({
      mayLook: true,
      mayEdit: false,
      mayRemoveMobile: false,
    })
  })

  it('🚩 anchors every tier on may-look — an editor who cannot open the screen edits nothing', () => {
    // A door that answered this is malformed rather than generous: ADR 0001 has
    // the write grants sitting BESIDE the screen grant, not instead of it.
    expect(
      memberAuthority(
        answer({
          canOpenLoyMember: false,
          canEditLoyMember: true,
          canRemoveLoyMemberMobile: true,
        }),
      ),
    ).toEqual({ mayLook: false, mayEdit: false, mayRemoveMobile: false })
  })

  it('denies everything on a pending or errored probe', () => {
    for (const nothing of [null, undefined]) {
      expect(memberAuthority(nothing)).toEqual({
        mayLook: false,
        mayEdit: false,
        mayRemoveMobile: false,
      })
    }
  })
})
