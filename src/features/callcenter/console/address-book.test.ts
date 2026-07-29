/**
 * The address book's projection, asserted at its edge: wire rows in, pickable
 * choices out. Every value below is set by the test — the door's read has no
 * committed fixture (BackOffice 801 specifies it, 136 froze the session payloads
 * only), so this suite asserts the SHAPE the model declares and nothing about
 * what any particular customer's book contains.
 */
import { describe, expect, it } from 'vitest'
import type { CustomerAddressBookEntry } from '@/core/models/callcenter'
import { addressChoices, addressRefusalKey, rePinAfterEdit } from './address-book'

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

  // 188 — the delete control's whole rule, read off this projection. The server
  // refuses `ADDRESS_IN_USE_BY_ORDER` and that refusal is the guard; `isCurrent`
  // is the courtesy, and it must mark EXACTLY the row the order holds — one row
  // too few offers a control the door will refuse, one row too many hides a
  // delete the caller asked for.
  it('marks exactly one row as the order’s, and that is what suppresses delete', () => {
    const book = [entry({ addressNumber: 'A1' }), entry({ addressNumber: 'A2' }), entry({ addressNumber: 'A3' })]
    const held = addressChoices(book, 'A2')
    expect(held.filter((c) => c.isCurrent).map((c) => c.addressNumber)).toEqual(['A2'])
    expect(held.filter((c) => !c.isCurrent)).toHaveLength(2)
    // No address on the order — every row is deletable, and none is "held".
    expect(addressChoices(book, null).some((c) => c.isCurrent)).toBe(false)
    // An order holding an address that is not in this book suppresses nothing:
    // the projection never invents a current row.
    expect(addressChoices(book, 'A9').some((c) => c.isCurrent)).toBe(false)
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

  // 188 — the delete refusal. The console omits the control on the row the order
  // holds, so its OWN UI should never provoke this; it is handled anyway,
  // because the refusal is the guard and a second implementation of the rule on
  // the client is exactly what §6.5 refuses to have.
  it('explains a delete the open order refuses', () => {
    expect(addressRefusalKey('ADDRESS_IN_USE_BY_ORDER')).toBe('address.refusedInUseByOrder')
    // It is its OWN phrase — collapsing it into the not-theirs sentence would
    // tell an agent their caller's own address belongs to someone else.
    expect(addressRefusalKey('ADDRESS_IN_USE_BY_ORDER')).not.toBe(
      addressRefusalKey('ADDRESS_NOT_FOR_CUSTOMER'),
    )
  })

  it('leaves every other refusal to the server’s own words', () => {
    expect(addressRefusalKey('SESSION_BUSY')).toBeNull()
    expect(addressRefusalKey(null)).toBeNull()
    expect(addressRefusalKey('SOMETHING_NEW_IN_A_MINOR_VERSION')).toBeNull()
    // The degradation is the point: a code minted in a future minor version
    // still reaches the agent as the server's own sentence, never as a blank.
    expect(addressRefusalKey('ADDRESS_IN_USE_BY_SOMETHING_ELSE')).toBeNull()
  })
})

/**
 * 188 / §6.5 rule 1 — the one derivation that turns a BOOK write into an ORDER
 * act. A `PUT` carries no store, `setAddress` carries only an `addressNumber`,
 * and an edit does not change it: so unless the console re-issues, an edit
 * across districts leaves the order on a plant derived from a district the
 * address has left, with nothing on the wire saying so.
 */
describe('rePinAfterEdit', () => {
  it('re-issues after an edit of the address the order holds', () => {
    expect(rePinAfterEdit('77120', '77120')).toBe('77120')
  })

  // 🚩 The assertion that would fail if anyone treated the two alike. A console
  // that re-pinned after every edit would re-price a live basket — and raise
  // §5.1's confirmation — for a correction to an address the order never had.
  it('re-issues nothing after an edit of any OTHER address', () => {
    expect(rePinAfterEdit('88220', '77120')).toBeNull()
    expect(rePinAfterEdit('77120', '88220')).toBeNull()
  })

  it('re-issues nothing when the order holds no address at all', () => {
    expect(rePinAfterEdit('77120', null)).toBeNull()
    expect(rePinAfterEdit('77120', undefined)).toBeNull()
    expect(rePinAfterEdit('77120', '')).toBeNull()
  })

  it('re-issues nothing for an edit that names no address', () => {
    expect(rePinAfterEdit('', '77120')).toBeNull()
    expect(rePinAfterEdit(null, '77120')).toBeNull()
  })

  // The book's spelling and the order's are the SAME address written twice —
  // `CallCenterAddressScope` resolves them trim/case-insensitively server-side,
  // so a match here must too, or an edit made from a row whose number came back
  // padded would silently skip the re-pin.
  it('matches the two spellings the way the door does', () => {
    expect(rePinAfterEdit(' 77120 ', '77120')).toBe('77120')
    expect(rePinAfterEdit('a77120', 'A77120')).toBe('A77120')
  })

  // And what it hands back is the ORDER's spelling, not the book row's: it is
  // the order being re-pinned, and `setAddress` is the order's verb.
  it('re-issues with the number the ORDER holds', () => {
    expect(rePinAfterEdit('77120  ', ' 77120')).toBe(' 77120')
  })
})
