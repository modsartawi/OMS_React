/**
 * What the agent typed, turned into the body the address door takes — the one
 * mapper on this feature whose two rules a reading of the endpoint signature
 * alone would get exactly backwards (179's answer, BackOffice 878 §1):
 *
 * 1. the body **narrows** to CC2's twelve captured values plus the label, and
 *    the three constants (`CountryKey` / `LanguageKey` / `AddressType`) are
 *    server-stamped — a client that can send `AddressType` can send `"B"`;
 * 2. `UpdateCustomerAddress` is a **null-coalescing merge**, so a field can
 *    never be emptied by omission — a cleared box must serialise as `""` and
 *    **never** `null`, and the tidying reflex is what this suite fails on.
 */
import { describe, expect, it } from 'vitest'
import type { CustomerAddressBookEntry } from '@/core/models/callcenter'
import {
  addressFormErrors,
  addressFormOf,
  addressPayload,
  emptyAddressForm,
  type AddressFormValues,
} from './address-capture'

const form = (over: Partial<AddressFormValues> = {}): AddressFormValues => ({
  ...emptyAddressForm(),
  cityCode: '0021',
  cityName: 'Riyadh',
  districtCode: 'R-114',
  districtName: 'Al Malqa',
  street1: 'King Abdulaziz Rd',
  street2: 'Exit 5',
  buildingNumber: '4',
  phone1: '0551234567',
  phone2: '',
  shortAddress: 'RIMA6904',
  ...over,
})

const entry = (over: Partial<CustomerAddressBookEntry> = {}): CustomerAddressBookEntry => ({
  addressNumber: '77120',
  labelCode: 'WORK',
  labelNameEn: 'Work',
  isDefault: false,
  address: {
    cityCode: '0021',
    cityName: 'Riyadh',
    districtCode: 'R-114',
    districtName: 'Al Malqa',
    street1: 'King Abdulaziz Rd',
    street2: null,
    buildingNumber: 'Bldg 4',
    phone1: '0551234567',
    phone2: null,
    shortAddress: 'RIMA6904',
    gpsLat: 24.7743,
    gpsLon: 46.7386,
  },
  ...over,
})

describe('addressPayload — the narrowing', () => {
  it('sends the label and the twelve captured values, and nothing else', () => {
    const body = addressPayload(form())
    expect(Object.keys(body).sort()).toEqual(['address', 'labelCode'])
    expect(Object.keys(body.address).sort()).toEqual(
      [
        'buildingNumber',
        'cityCode',
        'cityName',
        'districtCode',
        'districtName',
        'gpsLat',
        'gpsLon',
        'phone1',
        'phone2',
        'shortAddress',
        'street1',
        'street2',
      ].sort(),
    )
  })

  it('carries none of the three constants — they are stamped server-side', () => {
    const body = addressPayload(form()) as unknown as Record<string, unknown>
    const address = body.address as Record<string, unknown>
    expect('countryKey' in address).toBe(false)
    expect('languageKey' in address).toBe(false)
    expect('addressType' in address).toBe(false)
    expect(JSON.stringify(body)).not.toContain('"H"')
  })

  it('carries none of the thirteen fields CC2 has never filled', () => {
    const address = addressPayload(form()).address as unknown as Record<string, unknown>
    for (const never of ['postalCode', 'poBox', 'houseNumber', 'floorNumber', 'apartmentNumber', 'name1', 'name2', 'titleCode', 'phone1Ext']) {
      expect(never in address).toBe(false)
    }
  })
})

describe('addressPayload — a cleared field is "" and never null', () => {
  it('serialises an emptied box as an empty string', () => {
    const body = addressPayload(form({ street2: '', phone2: '' }))
    expect(body.address.street2).toBe('')
    expect(body.address.phone2).toBe('')
  })

  it('puts no null anywhere in the body — the merge would read one as “keep it”', () => {
    const body = addressPayload(
      form({ street1: '', street2: '', buildingNumber: '', phone1: '', phone2: '', shortAddress: '' }),
    )
    expect(JSON.stringify(body)).not.toContain('null')
    for (const value of Object.values(body.address)) {
      expect(value).not.toBeNull()
      expect(value).not.toBeUndefined()
    }
  })

  it('keeps every one of the twelve present even when the agent typed nothing', () => {
    const body = addressPayload(emptyAddressForm())
    expect(Object.keys(body.address)).toHaveLength(12)
  })
})

describe('addressPayload — the values themselves', () => {
  it('trims what the agent typed but never turns a blank into an absence', () => {
    const body = addressPayload(form({ street1: '  King Abdulaziz Rd  ', street2: '   ' }))
    expect(body.address.street1).toBe('King Abdulaziz Rd')
    expect(body.address.street2).toBe('')
  })

  it('upper-cases the national address, CC2’s own normalisation', () => {
    expect(addressPayload(form({ shortAddress: 'rima6904' })).address.shortAddress).toBe('RIMA6904')
  })

  it('starts a NEW address at HOME, as CC2 does', () => {
    expect(addressPayload(emptyAddressForm()).labelCode).toBe('HOME')
  })

  it('never invents a label on an edit — an unlabelled row stays unlabelled', () => {
    // Defaulting here would let a street correction silently relabel a row the
    // server left blank; CC2's HOME default is for a new address only.
    expect(addressPayload(form({ labelCode: '' })).labelCode).toBe('')
  })

  it('carries the GPS pair through as numbers — omission would write zeroes over a real fix', () => {
    const body = addressPayload(form({ gpsLat: 24.7743, gpsLon: 46.7386 }))
    expect(body.address.gpsLat).toBe(24.7743)
    expect(body.address.gpsLon).toBe(46.7386)
  })
})

describe('addressFormOf — seeding the edit', () => {
  it('fills the form from the book row, blanks where the row carries null', () => {
    expect(addressFormOf(entry({ labelCode: '' })).labelCode).toBe('')
    expect(addressFormOf(entry())).toEqual({
      labelCode: 'WORK',
      cityCode: '0021',
      cityName: 'Riyadh',
      districtCode: 'R-114',
      districtName: 'Al Malqa',
      street1: 'King Abdulaziz Rd',
      street2: '',
      buildingNumber: 'Bldg 4',
      phone1: '0551234567',
      phone2: '',
      shortAddress: 'RIMA6904',
      gpsLat: 24.7743,
      gpsLon: 46.7386,
    })
  })

  it('round-trips the GPS the console cannot capture, so an edit never zeroes it', () => {
    const body = addressPayload(addressFormOf(entry()))
    expect(body.address.gpsLat).toBe(24.7743)
    expect(body.address.gpsLon).toBe(46.7386)
  })

  it('survives a book row with no address behind it', () => {
    expect(addressFormOf(entry({ address: null })).districtCode).toBe('')
  })
})

describe('addressFormErrors', () => {
  it('accepts an empty national address — it is optional', () => {
    expect(addressFormErrors(form({ shortAddress: '' })).shortAddress).toBeUndefined()
  })

  it('accepts the Saudi National Address in any case', () => {
    expect(addressFormErrors(form({ shortAddress: ' rima6904 ' })).shortAddress).toBeUndefined()
  })

  it('refuses a malformed national address — format only, never a verification', () => {
    expect(addressFormErrors(form({ shortAddress: 'RIMA69' })).shortAddress).toBe('shortAddress')
    expect(addressFormErrors(form({ shortAddress: '6904RIMA' })).shortAddress).toBe('shortAddress')
  })

  it('refuses a capture with no district — it is what the store is derived from', () => {
    expect(addressFormErrors(form({ districtCode: '' })).district).toBe('district')
  })

  it('asks for nothing else, because CC2 asks for nothing else', () => {
    const errors = addressFormErrors(
      form({ street1: '', street2: '', buildingNumber: '', phone1: '', phone2: '', shortAddress: '' }),
    )
    expect(errors).toEqual({})
  })
})
