/**
 * The settlement account's predicate — the fifth grant on the Collections probe
 * (spec 267 D1, ticket 268).
 *
 * Two rules, and they are this slice's whole Proof rather than its plumbing:
 *
 * - **Only an explicit grant admits.** A refusal, a projection that dropped the
 *   flag, a door answering a shape nobody agreed to — all denials.
 * - 🚩 **A four-boolean answer is one of those shapes, and it is the one the LIVE
 *   door returns today.** `CollectionWeb/Access` does not carry
 *   `canOpenSettlement` yet (BackOffice spec 1173; ticket 274 joins the waves), so
 *   the case below where the field is simply absent is not a hypothetical — it is
 *   production, and it must read as a denial rather than as an oversight that
 *   someone later "fixes" with a `?? true`.
 *
 * What the nav does with each answer is pinned next door, in
 * `src/layout/menu-collection.test.ts`, where a feature's menu entry can be read
 * without a feature importing `layout`.
 */
import { describe, expect, it } from 'vitest'
import type { CollectionAccessResult } from '@/core/models/collection'
import { canOpenSettlement } from './api'

const NONE: CollectionAccessResult = {
  canOpenCollections: false,
  canOpenAcrs: false,
  canOpenDeposits: false,
  canOpenAttempts: false,
  canOpenSettlement: false,
}

describe('the settlement account predicate', () => {
  it('admits its own granted flag and denies its own refusal', () => {
    expect(canOpenSettlement({ ...NONE, canOpenSettlement: true })).toBe(true)
    expect(canOpenSettlement(NONE)).toBe(false)
  })

  it('🚩 reads ONLY its own flag — the four inquiry grants never admit it', () => {
    for (const flag of [
      'canOpenCollections',
      'canOpenAcrs',
      'canOpenDeposits',
      'canOpenAttempts',
    ] as const) {
      expect(canOpenSettlement({ ...NONE, [flag]: true })).toBe(false)
    }
    // …nor all four together. An accountant holding every inquiry grant still
    // needs the settlement grant to post money onto a branch.
    expect(
      canOpenSettlement({
        canOpenCollections: true,
        canOpenAcrs: true,
        canOpenDeposits: true,
        canOpenAttempts: true,
        canOpenSettlement: false,
      }),
    ).toBe(false)
  })

  it('🚩 denies the FOUR-boolean answer the live door returns today', () => {
    // The fifth flag absent entirely — every real probe until BackOffice 1173
    // ships it. `=== true` is what makes this a denial instead of `undefined`
    // leaking through a looser check.
    const fourFlags = {
      canOpenCollections: true,
      canOpenAcrs: true,
      canOpenDeposits: true,
      canOpenAttempts: true,
    } as unknown as CollectionAccessResult
    expect(canOpenSettlement(fourFlags)).toBe(false)
  })

  it('🚩 denies a MALFORMED answer rather than reading it loosely', () => {
    const malformed = [
      {},
      { canOpenSettlement: 'true' },
      { canOpenSettlement: 1 },
      { canOpenSettlement: null },
      // The shape a single-grant door would answer — not this contract.
      { canOpen: true },
    ] as unknown as CollectionAccessResult[]
    for (const answer of malformed) expect(canOpenSettlement(answer)).toBe(false)
    // An absent answer is the shape the signature admits, so it needs no cast: a
    // probe can resolve to nothing at all and that is still a denial.
    expect(canOpenSettlement(null)).toBe(false)
    expect(canOpenSettlement(undefined)).toBe(false)
  })
})
