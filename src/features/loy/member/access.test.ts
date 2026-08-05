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
import { canOpenLoyMember } from './api'

describe('canOpenLoyMember — the probe predicate', () => {
  it('admits a granted answer', () => {
    expect(canOpenLoyMember({ canOpenLoyMember: true })).toBe(true)
  })

  it('denies an explicit refusal', () => {
    expect(canOpenLoyMember({ canOpenLoyMember: false })).toBe(false)
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
