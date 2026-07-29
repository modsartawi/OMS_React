/**
 * The address the agent types, and the body the door takes — one pure mapper,
 * because the two rules it obeys are both invisible from the endpoint's
 * signature and both fail silently when they are got wrong.
 *
 * 🚩 **1. The body narrows.** `CallCenterWebAddressCapture` (BackOffice
 * [878](C:\Work\DMSCO\BackOffice\.issues\878-cc-address-capture-and-order-acts.md) §1)
 * accepts exactly CC2's twelve captured values plus `labelCode`, and stamps
 * `CountryKey` / `LanguageKey` / `AddressType` **server-side**. Nothing here
 * sends them: a client that can send `AddressType` can send `"B"`. The thirteen
 * fields CC2 has never filled stay off the wire so the web never writes empty
 * columns into SAP that the WPF path left alone.
 *
 * 🚩 **2. A cleared field is `""`, never `null`.** `UpdateCustomerAddress` is a
 * null-coalescing merge (`existing.X = incoming.X ?? existing.X`, twenty-five
 * times over). That is what makes the narrowing safe — an omitted field is
 * **preserved** — and its flip side is that a field can never be emptied by
 * omitting it. So every one of the twelve is always present, and this mapper
 * must **not** tidy blanks to null, which is precisely the reflex when writing
 * one. `""` clears; `null` would silently mean *keep what is there*.
 *
 * ⚠️ **The GPS pair is carried, not captured.** `GpsLat`/`GpsLon` are
 * non-nullable decimals the service assigns **unconditionally**, so they are the
 * one pair omission cannot preserve — omitting them writes `0` over a real fix.
 * The console has no map and no geolocation control, so it captures nothing
 * here and round-trips whatever the book row already carried (a create sends the
 * zeroes the WPF path would have written for an address keyed without a map).
 *
 * SPL stays **format-only with no verified affordance** (179 ruling 5): CC2's
 * own comment says live verification against `splonline.com.sa` *"is a separate
 * integration that needs an API contract / credentials"* and is unwired. The
 * field reads as a code the agent typed, never as an address the system
 * confirmed.
 */
import type { CustomerAddressBookEntry, CustomerAddressCapture } from '@/core/models/callcenter'

/** What the form holds while the agent types. Strings throughout — a text box
 *  that has been emptied holds `''`, and that is the value that must reach the
 *  wire. */
export interface AddressFormValues {
  labelCode: string
  cityCode: string
  cityName: string
  districtCode: string
  districtName: string
  street1: string
  street2: string
  buildingNumber: string
  /** The DELIVERY phone — the driver's number, not the loyalty mobile (§2). */
  phone1: string
  phone2: string
  /** The Saudi National Address. Optional; format-checked, never verified. */
  shortAddress: string
  /** Carried through from the book row, never edited here — see the module note. */
  gpsLat: number
  gpsLon: number
}

/** CC2's own default for a new address (`ResetForNewAsync`). */
export const DEFAULT_LABEL_CODE = 'HOME'

/** `^[A-Z]{4}[0-9]{4}$` — four letters, four digits, e.g. `RIMA6904`. */
export const SHORT_ADDRESS_PATTERN = /^[A-Z]{4}[0-9]{4}$/

export function emptyAddressForm(): AddressFormValues {
  return {
    labelCode: DEFAULT_LABEL_CODE,
    cityCode: '',
    cityName: '',
    districtCode: '',
    districtName: '',
    street1: '',
    street2: '',
    buildingNumber: '',
    phone1: '',
    phone2: '',
    shortAddress: '',
    gpsLat: 0,
    gpsLon: 0,
  }
}

/**
 * The edit's seed. A book row's nulls become empty boxes — and because the
 * mapper sends what the box holds, an untouched null field is re-sent as `""`
 * rather than omitted. That is the honest reading of the merge: the agent is
 * looking at an empty box and the server should hold an empty column.
 */
export function addressFormOf(entry: CustomerAddressBookEntry): AddressFormValues {
  const a = entry.address
  return {
    // 🚩 Verbatim, blank included — the HOME default is for a NEW address
    // (`ResetForNewAsync`), and defaulting here would let a street correction
    // silently relabel a row the server left unlabelled.
    labelCode: text(entry.labelCode),
    cityCode: text(a?.cityCode),
    cityName: text(a?.cityName),
    districtCode: text(a?.districtCode),
    districtName: text(a?.districtName),
    street1: text(a?.street1),
    street2: text(a?.street2),
    buildingNumber: text(a?.buildingNumber),
    phone1: text(a?.phone1),
    phone2: text(a?.phone2),
    shortAddress: text(a?.shortAddress),
    gpsLat: a?.gpsLat ?? 0,
    gpsLon: a?.gpsLon ?? 0,
  }
}

/** The body of both writes — `POST` mints an address number, `PUT` names one. */
export function addressPayload(form: AddressFormValues): CustomerAddressCapture {
  return {
    // Passed through as the form holds it. A create starts at `HOME`
    // (`emptyAddressForm`) and an edit keeps whatever the row carried — nothing
    // between the two invents a label.
    labelCode: text(form.labelCode),
    address: {
      cityCode: text(form.cityCode),
      cityName: text(form.cityName),
      districtCode: text(form.districtCode),
      districtName: text(form.districtName),
      street1: text(form.street1),
      street2: text(form.street2),
      buildingNumber: text(form.buildingNumber),
      phone1: text(form.phone1),
      phone2: text(form.phone2),
      shortAddress: text(form.shortAddress).toUpperCase(),
      gpsLat: form.gpsLat ?? 0,
      gpsLon: form.gpsLon ?? 0,
    },
  }
}

/**
 * What the form will not send, keyed by field. The value is the i18n key
 * suffix, so the form draws the sentence and this module names the fault.
 *
 * Deliberately short: CC2 validates the national address and nothing else, so
 * neither does this. The **district** is the one addition, and it is not a
 * style choice — it is what the store is derived from, and a capture without one
 * is an address no order can be delivered to.
 */
export function addressFormErrors(form: AddressFormValues): {
  district?: 'district'
  shortAddress?: 'shortAddress'
} {
  const errors: { district?: 'district'; shortAddress?: 'shortAddress' } = {}
  if (text(form.districtCode) === '') errors.district = 'district'
  const spl = text(form.shortAddress).toUpperCase()
  if (spl !== '' && !SHORT_ADDRESS_PATTERN.test(spl)) errors.shortAddress = 'shortAddress'
  return errors
}

/** True when the form may be sent — the same predicate the Save control reads. */
export function addressFormIsSendable(form: AddressFormValues): boolean {
  return Object.keys(addressFormErrors(form)).length === 0
}

const text = (value: string | null | undefined): string => (value ?? '').trim()
