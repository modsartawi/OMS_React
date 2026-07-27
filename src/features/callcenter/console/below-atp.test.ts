/**
 * The below-availability acceptance, asserted at its edge: **which adds ask the
 * agent**, what the sheet is handed, and what a basket line's frozen
 * availability reads as.
 *
 * 🚩 The fixture is read for SHAPE only (CONTRACT.md §11) — every value a case
 * turns on is set by the test.
 */
import { describe, expect, it } from 'vitest'
import type { AtpAtScan, PendingConfirmation } from '@/core/models/callcenter'
import { BELOW_ATP_CONFIRM } from './__fixtures__/payloads'
import { beginAdd, belowAtpAsk, committingAdd, frozenAvailability, reaskingAdd } from './below-atp'

/** The §5.2 block, with only what a case is about varied. */
const ask = (detail: unknown, over: Partial<PendingConfirmation> = {}): PendingConfirmation => ({
  kind: 'belowAtp',
  confirmToken: 'TOKEN-A',
  expiresInMs: 120_000,
  detail,
  ...over,
})

describe('onlyAKnownShortfallAsksTheAgent', () => {
  it('asks when the requested quantity exceeds a KNOWN availability', () => {
    const asked = belowAtpAsk(ask({ itemNumber: '100001', requested: 5, available: 2, plant: '1101' }))
    expect(asked).toEqual({
      confirmToken: 'TOKEN-A',
      itemNumber: '100001',
      requested: 5,
      available: 2,
      plant: '1101',
    })
  })

  it('asks about none at store — nought is a known figure', () => {
    expect(belowAtpAsk(ask({ itemNumber: '100001', requested: 1, available: 0, plant: '1101' }))?.available).toBe(0)
  })

  it('does not ask within availability, at the boundary or under it', () => {
    expect(belowAtpAsk(ask({ itemNumber: '100001', requested: 2, available: 2, plant: '1101' }))).toBeNull()
    expect(belowAtpAsk(ask({ itemNumber: '100001', requested: 1, available: 2, plant: '1101' }))).toBeNull()
  })

  it('🚩 does not ask where availability is UNKNOWN, at any quantity', () => {
    // The stock read degraded, so there is no number to accept — and unknown ATP
    // has never gated order entry (§5.2, 287's rule). A console that confirmed
    // here would turn a degraded service into a workflow.
    for (const requested of [1, 5, 500]) {
      expect(belowAtpAsk(ask({ itemNumber: '100001', requested, available: null, plant: '1101' }))).toBeNull()
      expect(belowAtpAsk(ask({ itemNumber: '100001', requested }))).toBeNull()
    }
  })

  it('does not draw someone else’s confirmation, or one with nothing to commit', () => {
    // 167's kind reaches its own sheet; a second mechanism would be the defect.
    expect(belowAtpAsk(ask({ requested: 5, available: 2 }, { kind: 'storeChange' }))).toBeNull()
    expect(belowAtpAsk(ask({ requested: 5, available: 2 }, { confirmToken: '' }))).toBeNull()
    expect(belowAtpAsk(null)).toBeNull()
    expect(belowAtpAsk(undefined)).toBeNull()
  })

  it('reads the contract’s own block', () => {
    // Shape, not values: the fixture is provisional (§11).
    const asked = belowAtpAsk(BELOW_ATP_CONFIRM)
    expect(asked?.confirmToken).toBe(BELOW_ATP_CONFIRM.confirmToken)
    expect(typeof asked?.itemNumber).toBe('string')
    expect(asked?.requested).toBeGreaterThan(asked!.available)
  })

  it('survives a detail block it cannot read, rather than inventing a figure', () => {
    // §9 — unknown fields are ignored by rule, and a malformed one is not a
    // number to show the agent. Nothing to accept ⇒ nothing to ask.
    expect(belowAtpAsk(ask(null))).toBeNull()
    expect(belowAtpAsk(ask({ requested: '5', available: '2' }))).toBeNull()
    expect(belowAtpAsk(ask({ requested: 5, available: 2 }))?.plant).toBeNull()
  })
})

describe('oneAddKeepsOneRequestId', () => {
  it('reuses the id across the acceptance and the re-ask', () => {
    const add = beginAdd({ itemNumber: '100001', qty: 5, description: 'Panadol' }, () => 'ADD-1')
    expect(add.requestId).toBe('ADD-1')
    expect(add.confirmToken).toBeUndefined()

    // §4 — the acceptance is the SAME action carrying the token.
    const committing = committingAdd(add, 'TOKEN-A')
    expect(committing).toEqual({ ...add, confirmToken: 'TOKEN-A' })

    // 🚩 A spent token is dropped and the id is not.
    const again = reaskingAdd(committing)
    expect(again.requestId).toBe('ADD-1')
    expect('confirmToken' in again).toBe(false)
  })

  it('mints a new id for a genuinely new add', () => {
    let n = 0
    const mint = () => `ADD-${++n}`
    expect(beginAdd({ itemNumber: '1', qty: 1 }, mint).requestId).not.toBe(
      beginAdd({ itemNumber: '1', qty: 1 }, mint).requestId,
    )
  })
})

describe('theLinesPillIsFrozenNotLive', () => {
  const frozen = (over: Partial<AtpAtScan>): AtpAtScan => ({
    quantity: 5,
    frozenAt: '2026-07-27T09:15:41Z',
    known: true,
    ...over,
  })

  it('classifies the frozen figure the same three ways as a search row', () => {
    expect(frozenAvailability(frozen({ quantity: 5 })).kind).toBe('count')
    expect(frozenAvailability(frozen({ quantity: 0 })).kind).toBe('none')
    expect(frozenAvailability(frozen({ quantity: -3 })).kind).toBe('none')
  })

  it('🚩 reads a degraded freeze as unknown, never as a zero', () => {
    // `known:false` is the stock read that failed at add time. A quantity beside
    // it is not a fact, so it is not shown as one.
    const degraded = frozenAvailability(frozen({ known: false, quantity: 0 }))
    expect(degraded.kind).toBe('unknown')
    expect(degraded.quantity).toBeNull()
    expect(frozenAvailability(frozen({ known: false, quantity: 4 })).kind).toBe('unknown')
    expect(frozenAvailability(null).kind).toBe('unknown')
  })
})
