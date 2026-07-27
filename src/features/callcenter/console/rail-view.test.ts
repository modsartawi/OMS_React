/**
 * The customer rail's two derivations, asserted at their edge: what the compact
 * card shows, and which address state the rail is in.
 *
 * Shape comes from the contract's fixtures; every value below is set by the test
 * (CONTRACT.md §11 — a fixture value is never evidence of engine behaviour).
 */
import { describe, expect, it } from 'vitest'
import type { LoyaltyMember, SessionCapabilities, SessionHeader } from '@/core/models/callcenter'
import { ATTACHED_SESSION, EMPTY_SESSION } from './__fixtures__/payloads'
import { MAX_RAIL_FIELDS, addressSlot, railFields } from './rail-view'

const CUSTOMER = ATTACHED_SESSION.header.customer!

const MEMBER: LoyaltyMember = {
  loyId: CUSTOMER.customerId,
  mobile: CUSTOMER.mobile,
  fullName: CUSTOMER.name,
  tier: 'Gold',
  pointsBalance: 1240,
  email: 'caller@example.com',
}

const header = (over: Partial<SessionHeader> = {}): SessionHeader => ({
  ...EMPTY_SESSION.header,
  ...over,
})
const caps = (over: Partial<SessionCapabilities> = {}): SessionCapabilities => ({
  ...EMPTY_SESSION.capabilities,
  ...over,
})

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
    // the agent found them. Where they disagree the rail must not read out the
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

describe('addressSlot', () => {
  it('is the no-caller state before anyone is attached', () => {
    expect(addressSlot(header({ customer: null, address: null }), caps({ canOpenAddressBook: false }))).toBe(
      'noCaller',
    )
  })

  it('offers the address book once the SERVER says it will answer', () => {
    expect(
      addressSlot(header({ customer: CUSTOMER, address: null }), caps({ canOpenAddressBook: true })),
    ).toBe('pick')
  })

  it('renders the address once one is set', () => {
    expect(
      addressSlot(ATTACHED_SESSION.header, caps({ canOpenAddressBook: true })),
    ).toBe('set')
    expect(ATTACHED_SESSION.header.address).not.toBeNull()
  })

  it('🚩 never offers the book on a client rule the capability contradicts', () => {
    // A caller IS attached, so a re-derived "attached ⇒ reachable" rule would
    // offer the control — and the door would refuse it. Under `PickInStore` the
    // order has no address at all and the same capability says so (§6.3, v1.1),
    // which is exactly why the capability is the only thing read here.
    expect(
      addressSlot(header({ customer: CUSTOMER, address: null }), caps({ canOpenAddressBook: false })),
    ).toBe('unavailable')
  })

  it('shows the address it has even if the book has since closed', () => {
    expect(addressSlot(ATTACHED_SESSION.header, caps({ canOpenAddressBook: false }))).toBe('set')
  })
})
