/**
 * The customer rail's two derivations, asserted at their edge: what the compact
 * card shows, and which address state the rail is in.
 *
 * Shape comes from the contract's fixtures; every value below is set by the test
 * (CONTRACT.md §11 — a fixture value is never evidence of engine behaviour).
 */
import { describe, expect, it } from 'vitest'
import type {
  LoyaltyMember,
  SessionAddress,
  SessionCapabilities,
  SessionHeader,
} from '@/core/models/callcenter'
import { ATTACHED_SESSION, EMPTY_SESSION } from './__fixtures__/payloads'
import { MAX_RAIL_FIELDS, addressPlace, addressSlot, railFields } from './rail-view'

const CUSTOMER = ATTACHED_SESSION.header.customer!

const MEMBER: LoyaltyMember = {
  loyId: CUSTOMER.customerId,
  mobile: CUSTOMER.mobile,
  fullName: CUSTOMER.name,
  tier: 'Gold',
  pointsBalance: 1240,
  email: 'caller@example.com',
}

/**
 * An address the way `setAddress` leaves one on the header.
 *
 * 🚩 Stated here rather than read off `ATTACHED_SESSION`: the v1.2 capture's
 * attached caller has `address: null` — the capture environment reached the
 * loyalty attach but not the address book — and *attached caller, no address
 * yet* is itself a console state 135 drew. So the fixture supplies the shape of
 * an attached CALLER and this supplies the shape of a set ADDRESS, which is what
 * the file's own rule said all along.
 */
const ADDRESS: SessionAddress = {
  addressNumber: '77120',
  label: 'Home',
  cityCode: '0021',
  cityName: 'Riyadh',
  districtCode: 'R-114',
  districtName: 'Al Malqa',
  line: '…',
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
      addressSlot(header({ customer: CUSTOMER, address: ADDRESS }), caps({ canOpenAddressBook: true })),
    ).toBe('set')
  })

  it('is the pick state on the capture’s own attached-but-address-less caller', () => {
    // 🚩 The v1.2 capture's settled order carries a caller and NO address, which
    // is the state 137's ordering constraint produces: the book only becomes
    // reachable at attach, so every order passes through here. It must read as
    // *a thing left to do*, never as the no-caller state.
    expect(ATTACHED_SESSION.header.customer).not.toBeNull()
    expect(ATTACHED_SESSION.header.address).toBeNull()
    expect(addressSlot(ATTACHED_SESSION.header, ATTACHED_SESSION.capabilities)).toBe('pick')
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
    expect(
      addressSlot(header({ customer: CUSTOMER, address: ADDRESS }), caps({ canOpenAddressBook: false })),
    ).toBe('set')
  })
})

describe('addressPlace', () => {
  it('names where the order is going, from the two fields the projection sends', () => {
    expect(addressPlace(ADDRESS)).toEqual({ district: 'Al Malqa', city: 'Riyadh' })
  })

  it('🚩 does not depend on the line, which is the STREET and only the street', () => {
    // The defect this exists for: server-side `line` is
    // `JoinAddressLine(AddressLine1, AddressLine2)`, so a book row with no
    // street left the rail showing the LABEL alone — *Home*, on the one fact
    // that decides which store serves the order.
    expect(addressPlace({ ...ADDRESS, line: '' })).toEqual({ district: 'Al Malqa', city: 'Riyadh' })
  })

  it('keeps either half on its own — a district with no city named is still a place', () => {
    expect(addressPlace({ ...ADDRESS, cityName: '' })).toEqual({ district: 'Al Malqa', city: null })
    expect(addressPlace({ ...ADDRESS, districtName: '   ' })).toEqual({ district: null, city: 'Riyadh' })
  })

  it('is absent, not empty, when there is nothing to say', () => {
    // Absent-not-empty, the rail's rule everywhere else: a blank run under the
    // label reads as a fact that failed to arrive rather than one that is not
    // there. Under `PickInStore` the whole address leaves the projection (§2.2),
    // which is the shape `null` most has to survive.
    expect(addressPlace({ ...ADDRESS, districtName: '', cityName: '' })).toBeNull()
    expect(addressPlace(null)).toBeNull()
    expect(addressPlace(undefined)).toBeNull()
  })
})
