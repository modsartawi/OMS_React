/**
 * The Collections probe's four predicates (ticket 253, 244 §10).
 *
 * Two rules, and they are the ticket's point rather than its plumbing:
 *
 * - **Only an explicit grant admits.** A refusal, a projection that dropped a
 *   flag, a door answering a shape nobody agreed to — all denials.
 * - **The four are independent.** One grant admits one screen and never its
 *   neighbours, which is what makes the ragged group honest about what the
 *   server will actually serve.
 *
 * What the nav does with each of these answers is pinned next door, in
 * `src/layout/menu-collection.test.ts`, where a feature's menu entry can be read
 * without a feature importing `layout`.
 */
import { describe, expect, it } from 'vitest'
import type { CollectionAccessResult } from '@/core/models/collection'
import {
  canOpenAcrs,
  canOpenAssignment,
  canOpenAttempts,
  canOpenCollections,
  canOpenDeposits,
} from './api'

const NONE: CollectionAccessResult = {
  canOpenCollections: false,
  canOpenAcrs: false,
  canOpenDeposits: false,
  canOpenAttempts: false,
  canOpenAssignment: false,
}

const PREDICATES = [
  ['canOpenCollections', canOpenCollections],
  ['canOpenAcrs', canOpenAcrs],
  ['canOpenDeposits', canOpenDeposits],
  ['canOpenAttempts', canOpenAttempts],
  // 1169's fifth door, in the same matrix as the four reads — because the one
  // thing that must never happen is a read grant lighting the screen that
  // rewrites what those reads filter by.
  ['canOpenAssignment', canOpenAssignment],
] as const

describe('the Collection probe predicates', () => {
  it('each admits its own granted flag and denies its own refusal', () => {
    for (const [flag, can] of PREDICATES) {
      expect(can({ ...NONE, [flag]: true })).toBe(true)
      expect(can(NONE)).toBe(false)
    }
  })

  it('🚩 each reads ONLY its own flag — one grant never admits a neighbour', () => {
    for (const [flag] of PREDICATES) {
      const answer = { ...NONE, [flag]: true }
      for (const [otherFlag, other] of PREDICATES) {
        expect(other(answer)).toBe(otherFlag === flag)
      }
    }
  })

  it('🚩 denies a MALFORMED answer rather than reading it loosely', () => {
    // `=== true` is what makes each of these a denial instead of an accident of
    // truthiness — including the ones a lenient check would admit (`'true'`,
    // `1`, `{}`) and the two that would throw on a bare property read.
    const malformed = [
      {},
      { canOpenCollections: 'true' },
      { canOpenCollections: 1 },
      { canOpenCollections: null },
      // The shape a single-grant door would answer — not this contract.
      { canOpen: true },
    ] as unknown as CollectionAccessResult[]
    for (const [, can] of PREDICATES) {
      for (const answer of malformed) expect(can(answer)).toBe(false)
      // An absent answer is the shape the signature admits, so it needs no cast:
      // a probe can resolve to nothing at all and that is still a denial.
      expect(can(null)).toBe(false)
      expect(can(undefined)).toBe(false)
    }
  })
})
