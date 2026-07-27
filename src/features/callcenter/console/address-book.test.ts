/**
 * The address book's projection, asserted at its edge: wire rows in, pickable
 * choices out. Every value below is set by the test — the door's read has no
 * committed fixture (BackOffice 801 specifies it, 136 froze the session payloads
 * only), so this suite asserts the SHAPE the model declares and nothing about
 * what any particular customer's book contains.
 */
import { describe, expect, it } from 'vitest'
import type { CustomerAddressBookEntry } from '@/core/models/callcenter'
import { addressChoices, addressRefusalKey } from './address-book'

const entry = (over: Partial<CustomerAddressBookEntry> = {}): CustomerAddressBookEntry => ({
  addressNumber: '77120',
  labelCode: 'HOME',
  labelNameEn: 'Home',
  isDefault: false,
  address: {
    cityCode: '0021',
    cityName: 'Riyadh',
    districtCode: 'R-114',
    districtName: 'Al Malqa',
    street1: 'King Abdulaziz Rd',
    street2: null,
    buildingNumber: 'Bldg 4',
  },
  ...over,
})

describe('addressChoices', () => {
  it('composes the line in CC2’s order, dropping the blanks', () => {
    const [choice] = addressChoices([entry()], null)
    expect(choice.line).toBe('King Abdulaziz Rd, Bldg 4, Al Malqa, Riyadh')
    expect(choice.label).toBe('Home')
  })

  it('puts the default first and keeps the server’s order after it', () => {
    const choices = addressChoices(
      [
        entry({ addressNumber: 'A1' }),
        entry({ addressNumber: 'A2', isDefault: true }),
        entry({ addressNumber: 'A3' }),
      ],
      null,
    )
    expect(choices.map((c) => c.addressNumber)).toEqual(['A2', 'A1', 'A3'])
    expect(choices[0].isDefault).toBe(true)
  })

  it('marks the address the order already holds', () => {
    const choices = addressChoices([entry({ addressNumber: 'A1' }), entry({ addressNumber: 'A2' })], 'A2')
    expect(choices.map((c) => c.isCurrent)).toEqual([false, true])
  })

  it('falls back to the label code, and to no label at all', () => {
    expect(addressChoices([entry({ labelNameEn: '  ' })], null)[0].label).toBe('HOME')
    expect(addressChoices([entry({ labelNameEn: null, labelCode: null })], null)[0].label).toBeNull()
  })

  it('survives a row with nothing to compose from', () => {
    const [choice] = addressChoices([entry({ address: null })], null)
    expect(choice.line).toBeNull()
    // Still pickable — the row exists on the customer and the door will answer
    // for it; only the words are missing.
    expect(choice.addressNumber).toBe('77120')
  })

  it('drops a row that could never be picked', () => {
    // No `addressNumber` means there is nothing for `setAddress` to be given.
    expect(addressChoices([entry({ addressNumber: '' }), entry({ addressNumber: 'A1' })], null)).toHaveLength(1)
    expect(addressChoices(null, null)).toEqual([])
  })
})

describe('addressRefusalKey', () => {
  it('explains the two refusals the address door has of its own', () => {
    expect(addressRefusalKey('NO_CUSTOMER_ATTACHED')).toBe('address.refusedNoCaller')
    // 🚩 Never "not found": an address that belongs to someone else is a
    // different fact, and support needs to be able to tell them apart (§6.3).
    expect(addressRefusalKey('ADDRESS_NOT_FOR_CUSTOMER')).toBe('address.refusedNotTheirs')
    expect(addressRefusalKey('ADDRESS_NOT_FOR_CUSTOMER')).not.toBe(
      addressRefusalKey('NO_CUSTOMER_ATTACHED'),
    )
  })

  it('leaves every other refusal to the server’s own words', () => {
    expect(addressRefusalKey('SESSION_BUSY')).toBeNull()
    expect(addressRefusalKey(null)).toBeNull()
    expect(addressRefusalKey('SOMETHING_NEW_IN_A_MINOR_VERSION')).toBeNull()
  })
})
