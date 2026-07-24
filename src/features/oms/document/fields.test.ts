import { describe, expect, it } from 'vitest'
import { bandSubIds, overallStatusCode } from './fields'
import { DOCUMENT_NUMBERS, PAYLOADS } from './__fixtures__/payloads'
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
