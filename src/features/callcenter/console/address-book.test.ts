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
    // The editor's five (187). On the wire since the row nests a whole
    // `BusinessAddress`; nothing the picker's list reads.
    phone1: null,
    phone2: null,
    shortAddress: null,
    gpsLat: null,
    gpsLon: null,
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

  // 187 — the editor arrived beside this projection. The five capture-only
  // fields now on the wire model are the editor's seed and must reach neither
  // the composed line nor the choice: the picker's row is what an agent reads
  // out on a call, and a driver's phone number is not part of it.
  it('composes the same line now that the editor’s fields are on the row', () => {
    const [choice] = addressChoices(
      [
        entry({
          address: {
            cityCode: '0021',
            cityName: 'Riyadh',
            districtCode: 'R-114',
            districtName: 'Al Malqa',
            street1: 'King Abdulaziz Rd',
            street2: null,
            buildingNumber: 'Bldg 4',
            phone1: '0551234567',
            phone2: '0559876543',
            shortAddress: 'RIMA6904',
            gpsLat: 24.7743,
            gpsLon: 46.7386,
          },
        }),
      ],
      null,
    )
    expect(choice.line).toBe('King Abdulaziz Rd, Bldg 4, Al Malqa, Riyadh')
    expect(JSON.stringify(choice)).not.toContain('0551234567')
    expect(JSON.stringify(choice)).not.toContain('RIMA6904')
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

  // 187 — the code the editor provokes. The client greys a store-less district,
  // but the server's refusal is the authority (§2.3) and it must not reach the
  // agent as a machine code after they have keyed a whole address.
  it('explains the district no store delivers from', () => {
    expect(addressRefusalKey('NO_DELIVERY_STORE_FOR_DISTRICT')).toBe(
      'address.refusedNoDeliveryStore',
    )
  })

  it('leaves every other refusal to the server’s own words', () => {
    expect(addressRefusalKey('SESSION_BUSY')).toBeNull()
    expect(addressRefusalKey(null)).toBeNull()
    expect(addressRefusalKey('SOMETHING_NEW_IN_A_MINOR_VERSION')).toBeNull()
  })
})
