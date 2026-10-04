/**
 * The caller's compact card, asserted at its edge: what it shows, in what order,
 * and from which source.
 *
 * Shape comes from the contract's fixtures; every value below is set by the test
 * (CONTRACT.md §11 — a fixture value is never evidence of engine behaviour).
 */
import { describe, expect, it } from 'vitest'
import type { LoyaltyMember } from '@/core/models/callcenter'
import { ATTACHED_SESSION } from './__fixtures__/payloads'
import { MAX_RAIL_FIELDS, railFields } from './rail-view'

const CUSTOMER = ATTACHED_SESSION.header.customer!

const MEMBER: LoyaltyMember = {
  loyId: CUSTOMER.customerId,
  mobile: CUSTOMER.mobile,
  fullName: CUSTOMER.name,
  tier: 'Gold',
  pointsBalance: 1240,
  email: 'caller@example.com',
}

describe('railFields', () => {
  it('shows nothing at all before a caller is attached', () => {
    expect(railFields(null, MEMBER)).toEqual([])
  })

  it('renders the projection alone when the lookup is not to hand', () => {
    expect(railFields(CUSTOMER, null).map((f) => f.id)).toEqual(['name', 'mobile', 'member'])
  })

  it('caps the card at six fields, in a fixed order', () => {
    const fields = railFields(CUSTOMER, MEMBER)
    expect(fields.length).toBeLessThanOrEqual(MAX_RAIL_FIELDS)
    expect(fields.map((f) => f.id)).toEqual(['name', 'mobile', 'member', 'tier', 'points', 'email'])
  })

  it('takes the caller identity from the ORDER, not from the lookup', () => {
    // The projection is what the order actually holds; the lookup is only how
    // the agent found them. Where they disagree the card must not read out the
    // loose one.
    const fields = railFields(CUSTOMER, { ...MEMBER, fullName: 'Someone Else', mobile: '0500000000' })
    expect(fields.find((f) => f.id === 'name')?.value).toBe(CUSTOMER.name)
    expect(fields.find((f) => f.id === 'mobile')?.value).toBe(CUSTOMER.mobile)
  })

  it('never decorates one caller with another caller’s lookup', () => {
    // A member left over from the previous search must not enrich the card of
    // the customer actually attached — a tier read out for the wrong caller is
    // worse than no tier at all.
    const fields = railFields(CUSTOMER, { ...MEMBER, loyId: '9999999999' })
    expect(fields.map((f) => f.id)).toEqual(['name', 'mobile', 'member'])
  })

  it('drops an enrichment field the lookup has no value for', () => {
    const fields = railFields(CUSTOMER, { ...MEMBER, tier: null, pointsBalance: null })
    expect(fields.map((f) => f.id)).toEqual(['name', 'mobile', 'member', 'email'])
  })

  it('keeps a zero points balance — it is a value, not an absence', () => {
    const fields = railFields(CUSTOMER, { ...MEMBER, pointsBalance: 0 })
    expect(fields.find((f) => f.id === 'points')?.value).toBe('0')
  })
})
