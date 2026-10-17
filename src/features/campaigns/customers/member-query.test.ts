/** Ticket 519 — Customers keeps the member looked up in the address. */
import { describe, expect, it } from 'vitest'
import { memberQueryFromParams, memberQueryToParams } from './member-query'

const read = (qs: string) => memberQueryFromParams(new URLSearchParams(qs))

describe('memberQuery_keepsOneKeyInTheAddress', () => {
  it('reads a loyalty id or a mobile, trimmed', () => {
    expect(read('loyaltyId=%20M-100231%20')).toEqual({ by: 'loyaltyId', value: 'M-100231' })
    expect(read('mobile=0551234567')).toEqual({ by: 'mobile', value: '0551234567' })
  })

  it('a loyalty id wins over a mobile', () => {
    expect(read('mobile=0551234567&loyaltyId=M-100231')).toEqual({ by: 'loyaltyId', value: 'M-100231' })
  })

  it('nothing asked reads blank, by loyalty id', () => {
    expect(read('')).toEqual({ by: 'loyaltyId', value: '' })
  })

  it('writes the one key it holds, and nothing when blank', () => {
    expect(memberQueryToParams({ by: 'mobile', value: ' 0551234567 ' }).toString()).toBe('mobile=0551234567')
    expect(memberQueryToParams({ by: 'loyaltyId', value: '' }).toString()).toBe('')
  })

  it('round-trips', () => {
    for (const qs of ['loyaltyId=M-100231', 'mobile=0551234567', '']) expect(memberQueryToParams(read(qs)).toString()).toBe(qs)
  })
})
