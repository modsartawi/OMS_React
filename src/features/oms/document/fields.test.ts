import { describe, expect, it } from 'vitest'
import type { SdDocumentHeaderModel } from '@/core/models/sd-document'
import {
  addressFallback,
  bandCustomer,
  bandSubIds,
  deliveryWindow,
  documentProvenanceRows,
  overallStatusCode,
  paymentInstrument,
  railCards,
  type CardRow,
  type RailCard,
} from './fields'
import { DOCUMENT_NUMBERS, PAYLOADS, type CapturedDocumentNo } from './__fixtures__/payloads'
import documentEn from '@/locales/en/document.json'

/**
 * The real `document` namespace, resolved the way `t('band.orderNo')` does — the
 * same harness `rail.test.ts` uses, and for the same reason: a key deleted from
 * the shipped JSON fails here instead of rendering a raw key to an operator.
 */
const t = (key: string): string => {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], documentEn)
  if (typeof value !== 'string') throw new Error(`missing document namespace key: ${key}`)
  return value
}

/** A sub-id as the band reads on screen — "Order 100371607". */
const read = (row: { label: string; value: string }): string => `${row.label} ${row.value}`

describe('bandSubIds', () => {
  it('builds the five sub-id rows under the big line, in the band order', () => {
    expect(bandSubIds(PAYLOADS['8000000253'], t).map(read)).toEqual([
      'Order 100371607',
      'Type ECommerce (Hybris)',
      'Delivery doc Delivery',
      'Placed July 14, 2026 · 00:44',
      'Store P001',
    ])
  })

  it('composes Placed from documentDate and entryTime as one row', () => {
    const placed = bandSubIds(PAYLOADS['8000000174'], t).filter((row) => row.key === 'placed')
    // `documentDate` 2025-04-24T12:41 and `entryTime` 2025-04-24T22:29 — one row,
    // the calendar date from the first and the clock time from the second.
    expect(placed).toEqual([
      { key: 'placed', label: 'Placed', value: 'April 24, 2025 · 22:29', isCode: false },
    ])
  })

  it('falls a description back to its code, and marks the echo as a code', () => {
    // `2000000551` carries `documentTypeDescription: 'NUPP'` — the description
    // says nothing the code did not, so it renders as a code.
    const rows = bandSubIds(PAYLOADS['2000000551'], t)
    expect(rows.find((row) => row.key === 'documentType')).toEqual({
      key: 'documentType',
      label: 'Type',
      value: 'NUPP',
      isCode: true,
    })
    // `8000000253` resolves its type properly, and so is not a code.
    expect(bandSubIds(PAYLOADS['8000000253'], t).find((row) => row.key === 'documentType')).toMatchObject({
      value: 'ECommerce (Hybris)',
      isCode: false,
    })
  })

  it('keeps a description that differs from its code only in case', () => {
    // `'Cash'` against `documentType: 'CASH'` is a resolved word, not an echo —
    // the band prints the word rather than shouting the code back.
    expect(bandSubIds(PAYLOADS['8000000121'], t).find((row) => row.key === 'documentType')).toMatchObject({
      value: 'Cash',
      isCode: false,
    })
  })

  it('omits a sub-id the document does not carry rather than dashing it', () => {
    // `deliveryDocumentType` is null on the e-Rx document — the only corpus gap.
    const keys = bandSubIds(PAYLOADS['2000000551'], t).map((row) => row.key)
    expect(keys).toEqual(['orderNo', 'documentType', 'placed', 'storeCode'])
  })

  it('renders every other captured document with all five rows', () => {
    const counts = DOCUMENT_NUMBERS.map((documentNo) => bandSubIds(PAYLOADS[documentNo], t).length)
    expect(counts).toEqual([4, 5, 5, 5, 5])
  })
})

describe('bandCustomer', () => {
  it('joins the phone and the city, and drops the city when the document has none', () => {
    expect(bandCustomer(PAYLOADS['8000000174'])).toEqual({
      name: 'MOHAMMED SARTAWI 33',
      contact: '966501076360 · Riyadh - adh dhubbat',
    })
    // `2000000551` has no `shippingAddress` at all (a pickup) and `8000000253`
    // has one whose `cityName` is `''` — one code path, by D-5.
    expect(bandCustomer(PAYLOADS['2000000551'])).toEqual({
      name: 'Sample Patient',
      contact: '966501076360',
    })
    expect(bandCustomer(PAYLOADS['8000000253']).contact).toBe('966501076360')
  })
})

describe('documentProvenanceRows', () => {
  it('carries refDocumentNo, the source and the entry user out of the band', () => {
    // D-2 sends these three to the All-statuses disclosure's neighbourhood.
    expect(documentProvenanceRows(PAYLOADS['9000000003'], t)).toEqual([
      { label: 'Ref Document No', value: '3000000007' },
      { label: 'Source', value: 'Call Center' },
      { label: 'Entry User', value: 'Outbox' },
    ])
  })

  it('falls the source back to its code, and leaves a blank ref blank', () => {
    // The disclosure's job is completeness, so a blank row stays and is dashed
    // by `FieldGroup` — the band's omit rule does not apply here.
    expect(documentProvenanceRows(PAYLOADS['2000000551'], t)).toEqual([
      { label: 'Ref Document No', value: '' },
      { label: 'Source', value: 'BKOF' },
      { label: 'Entry User', value: 'BackOffice' },
    ])
  })
})

// The unit under test is `overallStatusCode`; the name is ticket 091's Proof
// seam, which is phrased for the lozenge the value decides.
describe('overallLozengeOmitted', () => {
  it('gives the three documents with a blank overall status no lozenge', () => {
    // Spec 083 D-2 counted 3/5 blank, and names `8000000174` as the one that
    // renders. The count holds; the named document does not — `8000000174` is
    // one of the blanks, and the two that carry `C` are `2000000551` and
    // `8000000253` (recorded in ticket 091's Comments).
    for (const documentNo of ['8000000121', '8000000174', '9000000003'] as const) {
      expect(overallStatusCode(PAYLOADS[documentNo])).toBe('')
    }
  })

  it('renders the raw code for the two that carry one', () => {
    expect(overallStatusCode(PAYLOADS['2000000551'])).toBe('C')
    expect(overallStatusCode(PAYLOADS['8000000253'])).toBe('C')
  })
})

/** The rail's cards for one capture, keyed the way the rail renders them. */
const cardsOf = (documentNo: CapturedDocumentNo): RailCard[] => railCards(PAYLOADS[documentNo], t)
const cardKeys = (documentNo: CapturedDocumentNo): string[] =>
  cardsOf(documentNo).map((card) => card.key)
const card = (documentNo: CapturedDocumentNo, key: RailCard['key']): RailCard | undefined =>
  cardsOf(documentNo).find((c) => c.key === key)
/** One card as it reads on screen — "Name Sample Patient". */
const readRows = (rows: readonly CardRow[]): string[] => rows.map((row) => `${row.label} ${row.value}`)

describe('addressFallback', () => {
  it('resolves the chain on every captured document, shortAddress first', () => {
    // Every step is the only thing present on some corpus document (083 D-6):
    // `shortAddress` on `9000000003`, `districtName` on `8000000174`, and
    // nothing at all on the other three.
    expect(DOCUMENT_NUMBERS.map((no) => addressFallback(PAYLOADS[no].shippingAddress))).toEqual([
      '', // 2000000551 — `shippingAddress` is null (a pickup)
      '', // 8000000121 — an address object carrying only `cityName`
      'Adh Dhubbat', // 8000000174 — falls through to the district
      '', // 8000000253 — an address object whose every field is ''
      'RMAB4405', // 9000000003 — `shortAddress` wins over its own `street1`
    ])
  })

  it('leaves the null parent and the all-blank object on name · mobile · loyalty ID', () => {
    // The two ends of D-6's "one code path, not two": `2000000551` has no
    // `shippingAddress` at all, `8000000253` has one whose every field is ''.
    // Both land on three rows, and NEITHER carries a missing-address marker.
    for (const documentNo of ['2000000551', '8000000253'] as const) {
      const rows = card(documentNo, 'customer')?.rows ?? []
      expect(rows.map((row) => row.key)).toEqual(['name', 'mobile', 'loyaltyId'])
    }
    expect(readRows(card('2000000551', 'customer')?.rows ?? [])).toEqual([
      'Name Sample Patient',
      'Mobile 966501076360',
      'Loyalty ID 1000000034',
    ])
  })

  it('puts the city alongside the resolved line', () => {
    expect(readRows(card('9000000003', 'customer')?.rows ?? [])).toEqual([
      'Name Mohammed Sartawi',
      'Mobile 966501076360',
      'Loyalty ID 1000000034',
      'City Riyadh - ad dar al baida',
      'Address RMAB4405',
    ])
    // `8000000121` carries a city and no usable line — the city row stands alone.
    expect(card('8000000121', 'customer')?.rows.map((row) => row.key)).toEqual([
      'name',
      'mobile',
      'loyaltyId',
      'city',
    ])
  })
})

describe('deliveryWindow', () => {
  it('renders the schedule when the pair is a real window, the slot otherwise, nothing else', () => {
    expect(DOCUMENT_NUMBERS.map((no) => deliveryWindow(PAYLOADS[no]))).toEqual([
      '', // 2000000551 — sentinel schedule, blank slot
      'Monday, 8pm - 10 pm', // 8000000121 — From == To, so the slot answers
      '20:00 - 22:00', // 8000000174 — the schedule wins over its own slot text
      '', // 8000000253
      '', // 9000000003
    ])
  })

  it('never renders a zero-length window', () => {
    // `8000000121`'s From and To are the same capture timestamp
    // (`2025-03-05T23:56:36.389`). Strict `<` is what makes it fall through.
    const doc = PAYLOADS['8000000121']
    expect(doc.deliveryScheduleFromTime).toBe(doc.deliveryScheduleToTime)
    expect(deliveryWindow(doc)).not.toContain('23:56')
  })

  it('omits the row from the Fulfilment card when neither source resolves', () => {
    expect(card('8000000253', 'fulfilment')?.rows.map((row) => row.key)).toEqual([
      'deliveryType',
      'store',
    ])
    expect(card('8000000174', 'fulfilment')?.rows.map((row) => row.key)).toEqual([
      'deliveryType',
      'store',
      'window',
      'note',
    ])
  })
})

describe('paymentInstrument', () => {
  it('scans the conditions for the payment FIELDS, not for a condType', () => {
    // Both captures carry the instrument on the `DFEE` condition, which is
    // incidental (D-8) — the scan must not know that word.
    expect(paymentInstrument(PAYLOADS['8000000121'])).toBe('ApplePay · Visa')
    expect(paymentInstrument(PAYLOADS['8000000174'])).toBe('ApplePay · Visa')
  })

  it('falls back to the raw paymentType, and omits when both are blank', () => {
    // `2000000551` has header conditions carrying no payment fields;
    // `8000000253` has no conditions at all. Both fall back to `paymentType`.
    expect(paymentInstrument(PAYLOADS['2000000551'])).toBe('C')
    expect(paymentInstrument(PAYLOADS['8000000253'])).toBe('C')

    const blank = { ...PAYLOADS['8000000253'], paymentType: '' } as SdDocumentHeaderModel
    expect(paymentInstrument(blank)).toBe('')
    expect(railCards(blank, t)
      .find((c) => c.key === 'payment')
      ?.rows.map((row) => row.key)).toEqual([
      'deliveryFees',
      'paidAmount',
      'amountDue',
      'netTotal',
    ])
  })
})

describe('cardCollapse', () => {
  it('renders the e-Rx card only on the prescription document', () => {
    expect(cardKeys('2000000551')).toContain('prescription')
    for (const documentNo of ['8000000121', '8000000174', '8000000253', '9000000003'] as const) {
      expect(cardKeys(documentNo)).not.toContain('prescription')
    }
    // Two rows on today's data — `clinicianName`, `referenceErx` and
    // `prescriptionUrl` are blank on the one real prescription (D-6).
    expect(readRows(card('2000000551', 'prescription')?.rows ?? [])).toEqual([
      'Approval no. c9364852',
      'Patient ID 1197634478',
    ])
  })

  it('collapses Driver & tracking when the courier, the driver and the tracking id are all blank', () => {
    const bare = {
      ...PAYLOADS['2000000551'],
      courierCode: '',
      courierDriverName: '',
      trackingId: '',
    } as SdDocumentHeaderModel
    expect(railCards(bare, t).map((c) => c.key)).toEqual([
      'customer',
      'prescription',
      'fulfilment',
      'payment',
    ])
    // …and NOT on the captured corpus, where `courierCode` is populated on 5/5
    // — including both pick-in-store documents. The card is one row there, not
    // absent (recorded in ticket 092's Comments).
    for (const documentNo of DOCUMENT_NUMBERS) {
      expect(cardKeys(documentNo)).toContain('driver')
    }
    expect(readRows(card('2000000551', 'driver')?.rows ?? [])).toEqual([
      'Courier DAWA',
      'Approved No',
    ])
  })

  it('always renders the money and boolean rows, and never an em dash', () => {
    // `0.00` and `No` are answers; a blank text row is omitted instead (D-5).
    expect(readRows(card('2000000551', 'payment')?.rows ?? [])).toEqual([
      'Payment C',
      'Delivery fees 0.00',
      'Paid 0.00',
      'Amount due 5.70',
      'Net total 5.70',
    ])
    const everyRow = DOCUMENT_NUMBERS.flatMap((no) => cardsOf(no).flatMap((c) => c.rows))
    expect(everyRow.filter((row) => !row.value)).toEqual([])
    expect(everyRow.some((row) => row.value.includes('—'))).toBe(false)
  })

  it('keeps the three always-rendered cards on every captured document', () => {
    for (const documentNo of DOCUMENT_NUMBERS) {
      expect(cardKeys(documentNo)).toEqual(
        expect.arrayContaining(['customer', 'fulfilment', 'payment']),
      )
    }
    // Card order is the rail's reading order, never the document's shape.
    expect(cardKeys('2000000551')).toEqual([
      'customer',
      'prescription',
      'fulfilment',
      'driver',
      'payment',
    ])
  })
})
