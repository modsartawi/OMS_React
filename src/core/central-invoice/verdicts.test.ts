/**
 * The central invoice's per-delivery answers (ticket 332), read the one way both
 * the delivery page's dialog and the bulk screen read them.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { CentralInvoiceRaiseResult } from '@/core/models/central-invoice'
import { isGrantRefused } from './api'
import { retryList, verdictOf, verdictTally } from './verdicts'

const row = (deliveryNo: string, verdict: string, code = '', message = ''): CentralInvoiceRaiseResult => ({
  deliveryNo,
  verdict,
  code,
  message,
})

describe('verdictOf', () => {
  it('reads the three wire spellings BackOffice 2099 pins as stable', () => {
    expect(verdictOf('accepted')).toBe('accepted')
    expect(verdictOf('wait')).toBe('wait')
    expect(verdictOf('refused')).toBe('refused')
  })

  it('never reads an unknown spelling as one of the three', () => {
    // A casing drift or a fourth verdict must not arrive labelled "Queued".
    expect(verdictOf('Accepted')).toBe('unknown')
    expect(verdictOf('queued')).toBe('unknown')
    expect(verdictOf('')).toBe('unknown')
  })
})

describe('retryList', () => {
  it('is the refused and wait rows, in the order the server answered, and never an accepted one', () => {
    const results = [
      row('8006456897', 'accepted'),
      row('8006456512', 'wait', 'CINV-CHANGED-RECENTLY'),
      row('6314628864841', 'refused', 'CINV-NOT-A-DELIVERY'),
      row('8006473324', 'refused', 'CINV-PICK-COMPLETE'),
    ]
    expect(retryList(results)).toEqual(['8006456512', '6314628864841', '8006473324'])
  })

  it('keeps a row whose verdict it cannot read: nobody has confirmed it was queued', () => {
    expect(retryList([row('1', 'accepted'), row('2', 'pending')])).toEqual(['2'])
  })
})

describe('verdictTally', () => {
  it('counts each verdict, unknown included', () => {
    expect(
      verdictTally([row('1', 'accepted'), row('2', 'accepted'), row('3', 'wait'), row('4', 'refused'), row('5', 'x')]),
    ).toEqual({ accepted: 2, wait: 1, refused: 1, unknown: 1 })
  })
})

describe('isGrantRefused', () => {
  it('is a 403, bare (the grant filter sends no body) or enveloped', () => {
    expect(isGrantRefused(new ApiError('unknown', 'Unexpected (403)', 403))).toBe(true)
    expect(isGrantRefused(new ApiError('business', 'Forbidden', 403))).toBe(true)
  })

  it('is not a 400 refusal, a server fault, a network failure or a non-ApiError', () => {
    expect(isGrantRefused(new ApiError('business', 'A central invoice needs a reason', 400))).toBe(false)
    expect(isGrantRefused(new ApiError('server', 'boom', 500))).toBe(false)
    expect(isGrantRefused(new ApiError('network', 'offline', 0))).toBe(false)
    expect(isGrantRefused(new Error('403'))).toBe(false)
  })
})
