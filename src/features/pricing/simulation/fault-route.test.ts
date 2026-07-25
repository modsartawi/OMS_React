import { describe, expect, it } from 'vitest'

import { ApiError } from '@/core/api'
import { faultRoute } from './fault-route'

/**
 * The banner's routing rule (ticket 120). Every case here is an envelope the 098
 * capture session actually produced — the two coded item faults, the code-less
 * determination fault, and the two failures that are not business envelopes at all.
 */
describe('faultRoute', () => {
  const business = (code: string | null, message = 'rejected') =>
    new ApiError(
      'business',
      message,
      400,
      code === null ? [] : [{ errorCode: code, internalErrorCode: '', errorMessage: message }],
    )

  it('routes an unknown material to Items — INVALID_UOM is a basket fault', () => {
    expect(faultRoute(business('INVALID_UOM', "UoM 'EA' is not valid for material '32423333'."))).toBe(
      'items',
    )
  })

  it('routes a manual condition sent at item 0 to Items — the disclosure lives there', () => {
    expect(faultRoute(business('INVALID_CONDITION_ITEM_LEVEL'))).toBe('items')
  })

  it('routes the code-less determination rejection to the run settings', () => {
    expect(
      faultRoute(
        business(null, '[PRICING_ERROR] Distribution channel 99 is not defined for sales organisation 1000.'),
      ),
    ).toBe('settings')
  })

  it('routes an unrecognised business code to the run settings rather than nowhere', () => {
    expect(faultRoute(business('SOME_FUTURE_CODE'))).toBe('settings')
  })

  it('gives a server failure no route — a 500 is not a fault on this screen', () => {
    expect(faultRoute(new ApiError('server', 'Internal Server Error', 500))).toBeNull()
  })

  it('gives a network drop no route', () => {
    expect(faultRoute(new ApiError('network', 'offline', 0))).toBeNull()
  })

  it('gives a non-ApiError no route', () => {
    expect(faultRoute(new Error('boom'))).toBeNull()
    expect(faultRoute(null)).toBeNull()
  })
})
