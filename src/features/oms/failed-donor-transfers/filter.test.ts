/**
 * The queue's client-side filter (ticket 434, spec 430 D12): stores trimmed and case-insensitive,
 * the last-attempt day range, and an unset attempt time always kept.
 */
import { describe, expect, it } from 'vitest'
import type { FailedDonorTransferRow } from '@/core/models/failed-donor-transfer'
import { failedLine } from './failed-line'
import { EMPTY_FILTER, isFiltering, isReversed, keepsLine, type LineFilter } from './filter'

const line = (over: Partial<FailedDonorTransferRow> = {}) =>
  failedLine(
    {
      requestNo: 'DR-1001',
      deliveryNo: '8000000501',
      donorStore: 'P019',
      orderStore: 'P001',
      requestState: 'FULFILLED',
      transferStoNo: null,
      outboxId: 'OB-77',
      outboxStatus: 'F',
      attemptCount: 3,
      lastAttemptTime: '2026-10-07T09:41:00',
      retryDeadline: '2026-10-08T09:00:00',
      errorMessage: null,
      reverseByHand: false,
      ...over,
    },
    true,
  )

const f = (over: Partial<LineFilter>): LineFilter => ({ ...EMPTY_FILTER, ...over })

describe('keepsLine — stores', () => {
  it('no filter keeps every line', () => {
    expect(keepsLine(line(), EMPTY_FILTER)).toBe(true)
  })

  it('a store matches trimmed and case-insensitive, on either side', () => {
    expect(keepsLine(line(), f({ donorStore: ' p019 ' }))).toBe(true)
    expect(keepsLine(line({ donorStore: ' P019' }), f({ donorStore: 'p019' }))).toBe(true)
    expect(keepsLine(line(), f({ orderStore: 'p001' }))).toBe(true)
  })

  it('a store is a whole match, not a prefix', () => {
    expect(keepsLine(line(), f({ donorStore: 'P01' }))).toBe(false)
    expect(keepsLine(line(), f({ orderStore: 'P019' }))).toBe(false)
  })

  it('both store filters must hold', () => {
    expect(keepsLine(line(), f({ donorStore: 'P019', orderStore: 'P002' }))).toBe(false)
  })

  it('a blank filter is no filter', () => {
    expect(keepsLine(line(), f({ donorStore: '   ' }))).toBe(true)
  })
})

describe('keepsLine — the last-attempt day range', () => {
  it('keeps a line inside the range, both ends inclusive', () => {
    expect(keepsLine(line(), f({ from: '2026-10-07', to: '2026-10-07' }))).toBe(true)
    expect(keepsLine(line(), f({ from: '2026-10-01' }))).toBe(true)
    expect(keepsLine(line(), f({ to: '2026-10-07' }))).toBe(true)
  })

  it('hides a line outside it', () => {
    expect(keepsLine(line(), f({ from: '2026-10-08' }))).toBe(false)
    expect(keepsLine(line(), f({ to: '2026-10-06' }))).toBe(false)
  })

  it('reads the attempt by its day, not its time: late in the day is still that day', () => {
    expect(keepsLine(line({ lastAttemptTime: '2026-10-07T23:59:00' }), f({ to: '2026-10-07' }))).toBe(true)
  })

  it('🚩 a line with no attempt time is never hidden by the dates', () => {
    const noAttempt = line({ lastAttemptTime: '0001-01-01T00:00:00', reverseByHand: true, outboxId: '' })
    expect(keepsLine(noAttempt, f({ from: '2026-10-08', to: '2026-10-09' }))).toBe(true)
  })

  it('…but still by the stores', () => {
    const noAttempt = line({ lastAttemptTime: '0001-01-01T00:00:00' })
    expect(keepsLine(noAttempt, f({ from: '2026-10-08', donorStore: 'P002' }))).toBe(false)
  })
})

describe('isFiltering', () => {
  it('is false for the empty filter and blank stores, true once anything is set', () => {
    expect(isFiltering(EMPTY_FILTER)).toBe(false)
    expect(isFiltering(f({ donorStore: '  ' }))).toBe(false)
    expect(isFiltering(f({ orderStore: 'P001' }))).toBe(true)
    expect(isFiltering(f({ from: '2026-10-07' }))).toBe(true)
  })
})

describe('isReversed', () => {
  it('is true only when both days are set and the range ends before it starts', () => {
    expect(isReversed(f({ from: '2026-10-08', to: '2026-10-01' }))).toBe(true)
    expect(isReversed(f({ from: '2026-10-01', to: '2026-10-01' }))).toBe(false)
    expect(isReversed(f({ from: '2026-10-08' }))).toBe(false)
    expect(isReversed(EMPTY_FILTER)).toBe(false)
  })
})
