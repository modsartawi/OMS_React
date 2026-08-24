import { describe, expect, it } from 'vitest'
import {
  applyPickupDistrict,
  districtLabel,
  clampReturnQuantity,
  pickupAddressFrom,
  pickupAddressSummary,
  restorePickupDistrict,
  returnableLines,
  submitGate,
} from './return-order'
import type { SdDistrictModel } from '@/core/models/lookups'
import {
  DELIVERY_WITH_ADDRESS,
  DELIVERY_WITH_REMAINING,
  FULLY_RETURNED_LINES,
} from './__fixtures__/return-lines'
import { DOCUMENT_NUMBERS, PAYLOADS } from './__fixtures__/payloads'

describe('returnableLines', () => {
  it('reports remaining as delivered minus returned, and omits a line with nothing left', () => {
    const { rows, hiddenCount } = returnableLines(DELIVERY_WITH_REMAINING.lines)
    expect(rows.map((r) => r.lineNumber)).toEqual([10, 20])
    expect(rows.map((r) => r.remaining)).toEqual([4, 4])
    // The fully-returned line is not a row — it is the tally.
    expect(hiddenCount).toBe(1)
  })

  it('reports an untouched line at its full delivered quantity', () => {
    const untouched = returnableLines(DELIVERY_WITH_REMAINING.lines).rows[0]
    expect(untouched).toEqual({
      lineNumber: 10,
      itemNumber: '208713',
      itemDescription: expect.any(String),
      uom: expect.any(String),
      unitPrice: expect.any(Number),
      delivered: 4,
      returned: 0,
      remaining: 4,
    })
  })

  it('handles a non-trivial history — two earlier partial returns', () => {
    // Delivered 9, returns of 2 then 3 already taken: the answer is 4, which is
    // neither the delivered quantity, nor zero, nor the last return's quantity.
    const partly = returnableLines(DELIVERY_WITH_REMAINING.lines).rows[1]
    expect(partly.delivered).toBe(9)
    expect(partly.returned).toBe(5)
    expect(partly.remaining).toBe(4)
    expect(partly.remaining).not.toBe(partly.delivered)
    expect(partly.remaining).not.toBe(0)
    expect(partly.remaining).not.toBe(3)
  })

  it('treats a missing returnedQuantity as nothing returned — never NaN', () => {
    for (const documentNo of DOCUMENT_NUMBERS) {
      const lines = PAYLOADS[documentNo].lines
      // The captures carry no `returnedQuantity` at all — the live shape today.
      expect(lines.every((l) => l.returnedQuantity === undefined)).toBe(true)
      for (const row of returnableLines(lines).rows) {
        expect(Number.isNaN(row.returned)).toBe(false)
        expect(Number.isNaN(row.remaining)).toBe(false)
        expect(row.returned).toBe(0)
        expect(row.remaining).toBe(row.delivered)
      }
    }
  })

  it('never offers a struck line, and does not count it as one that came back', () => {
    // `deleted` lines render STRUCK in the Items grid rather than vanishing, so
    // they are visibly part of the delivery — but they are not goods a customer
    // can send back, and nothing was ever returned off them.
    const struck = [
      { ...DELIVERY_WITH_REMAINING.lines[0], quantity: 4, deleted: true },
      { ...DELIVERY_WITH_REMAINING.lines[1], quantity: 9, returnedQuantity: 5 },
    ]
    const projection = returnableLines(struck)
    expect(projection.rows.map((r) => r.lineNumber)).toEqual([20])
    expect(projection.hiddenCount).toBe(0)
    expect(projection.notReturnableCount).toBe(1)
  })

  it('treats a line delivered in no quantity the same way — nothing to give back, nothing taken', () => {
    const nothing = [{ ...DELIVERY_WITH_REMAINING.lines[0], quantity: 0 }]
    expect(returnableLines(nothing)).toEqual({
      rows: [],
      hiddenCount: 0,
      notReturnableCount: 1,
    })
  })

  it('projects an exhausted delivery to no rows at all', () => {
    const { rows, hiddenCount } = returnableLines(FULLY_RETURNED_LINES.lines)
    expect(rows).toEqual([])
    expect(hiddenCount).toBe(2)
  })

  it('clamps a remainder to what was delivered, and survives a document with no lines', () => {
    const overReturned = [{ ...DELIVERY_WITH_REMAINING.lines[0], quantity: 2, returnedQuantity: 5 }]
    expect(returnableLines(overReturned)).toEqual({ rows: [], hiddenCount: 1, notReturnableCount: 0 })
    // `returnedQuantity` is still an unconfirmed 1283 §2b spelling, so a
    // negative sign convention is a shape that could arrive. It must never
    // project a cap ABOVE what was delivered.
    const negative = [{ ...DELIVERY_WITH_REMAINING.lines[0], quantity: 4, returnedQuantity: -3 }]
    expect(returnableLines(negative).rows[0].remaining).toBe(4)
    expect(returnableLines(null)).toEqual({ rows: [], hiddenCount: 0, notReturnableCount: 0 })
    expect(returnableLines([])).toEqual({ rows: [], hiddenCount: 0, notReturnableCount: 0 })
  })
})

describe('clampReturnQuantity', () => {
  it('holds a stepper inside [1, remaining]', () => {
    expect(clampReturnQuantity(2, 4)).toBe(2)
    expect(clampReturnQuantity(0, 4)).toBe(1)
    expect(clampReturnQuantity(5, 4)).toBe(4)
    expect(clampReturnQuantity(4, 4)).toBe(4)
    expect(clampReturnQuantity(1, 4)).toBe(1)
  })

  it('holds TYPED input inside the same range — the keyboard is not a way round the stepper', () => {
    // Everything a quantity box can be handed: a paste, a sign, a cap breach,
    // a word, an empty box. None of them may leave the range.
    expect(clampReturnQuantity('0', 3)).toBe(1)
    expect(clampReturnQuantity('-2', 3)).toBe(1)
    expect(clampReturnQuantity('99', 3)).toBe(3)
    expect(clampReturnQuantity('abc', 3)).toBe(1)
    expect(clampReturnQuantity('', 3)).toBe(1)
    expect(clampReturnQuantity(null, 3)).toBe(1)
    expect(clampReturnQuantity(undefined, 3)).toBe(1)
    expect(clampReturnQuantity(Number.NaN, 3)).toBe(1)
    expect(clampReturnQuantity('2', 3)).toBe(2)
  })

  it('never returns zero, even when the line has nothing left', () => {
    // A row with nothing left is not rendered at all (the projection hides it),
    // so the low end wins over a zero cap rather than producing a zero quantity.
    expect(clampReturnQuantity(0, 0)).toBe(1)
    expect(clampReturnQuantity(9, 0)).toBe(1)
  })
})

describe('submitGate', () => {
  const picked = (quantity: number | null) => ({ picked: true, quantity })
  const unpicked = { picked: false, quantity: null }

  it('names the lines sentence when nothing is ticked', () => {
    expect(submitGate([unpicked, unpicked], 'RTRF')).toEqual({
      ok: false,
      key: 'returnDocument.gate.selectLines',
    })
    expect(submitGate([], 'RTRF')).toEqual({ ok: false, key: 'returnDocument.gate.selectLines' })
  })

  it('names the quantity sentence when a ticked line has a cleared quantity', () => {
    const outcome = submitGate([picked(2), picked(null), unpicked], 'RTRF')
    // One complaint at a time, and in the order the operator must act: a line
    // IS ticked, so the lines sentence is answered and must not be repeated.
    expect(outcome).toEqual({ ok: false, key: 'returnDocument.gate.quantityAtLeastOne' })
    expect(outcome.key).not.toBe('returnDocument.gate.selectLines')
  })

  it('ignores the quantity on a line that is not ticked', () => {
    expect(submitGate([picked(1), { picked: false, quantity: null }], 'RTRF').ok).toBe(true)
  })

  it('treats a zero or negative ticked quantity as the same missing thing', () => {
    expect(submitGate([picked(0)], 'RTRF').key).toBe('returnDocument.gate.quantityAtLeastOne')
    expect(submitGate([picked(-1)], 'RTRF').key).toBe('returnDocument.gate.quantityAtLeastOne')
  })

  it('flips to a summary of what is selected once nothing is missing', () => {
    expect(submitGate([picked(2), picked(1)], 'RTRF')).toEqual({
      ok: true,
      key: 'returnDocument.gate.summary',
      params: { count: 2 },
    })
  })

  it('returns a key and its parameters, never a sentence — t() lives at the call site', () => {
    const outcomes = [
      submitGate([], 'RTRF'),
      submitGate([picked(null)], 'RTRF'),
      submitGate([picked(1)], null),
      submitGate([picked(1)], 'RTRF'),
    ]
    for (const outcome of outcomes) {
      // A key, not prose: no spaces, no full stop, and namespaced under the
      // block the dialog's copy lives in.
      expect(outcome.key).toMatch(/^returnDocument\.gate\.[A-Za-z]+$/)
      expect(outcome.key).not.toContain(' ')
      const values = Object.values(outcome.params ?? {})
      expect(values.every((v) => typeof v === 'number')).toBe(true)
    }
  })
})

describe('submitGate — the third sentence (ticket 292)', () => {
  const picked = (quantity: number | null) => ({ picked: true, quantity })
  const unpicked = { picked: false, quantity: null }

  it('names the reason sentence once lines and quantities are valid — and only then', () => {
    // The whole order, end to end, on the SAME unchosen reason: the bar never
    // reaches the reason sentence while an earlier thing is still missing, so
    // the operator is given one next step at a time rather than a list.
    expect(submitGate([unpicked], null).key).toBe('returnDocument.gate.selectLines')
    expect(submitGate([picked(null)], null).key).toBe('returnDocument.gate.quantityAtLeastOne')
    expect(submitGate([picked(2)], null)).toEqual({
      ok: false,
      key: 'returnDocument.gate.chooseReason',
    })
  })

  it('holds the bar shut on an unchosen reason — a refund is never reached by clicking through', () => {
    expect(submitGate([picked(2), picked(1)], null).ok).toBe(false)
  })

  it('flips to a summary — 3 lines — once nothing is missing', () => {
    for (const reason of ['RTRF', 'RF'] as const) {
      expect(submitGate([picked(2), picked(1), picked(3)], reason)).toEqual({
        ok: true,
        key: 'returnDocument.gate.summary',
        params: { count: 3 },
      })
    }
  })
})

describe('pickupAddressFrom', () => {
  const shipping = DELIVERY_WITH_ADDRESS.shippingAddress

  it('carries the delivery’s own shipping address across, GPS included and unedited', () => {
    const draft = pickupAddressFrom(shipping)
    expect(draft.districtCode).toBe(shipping?.districtCode)
    expect(draft.districtName).toBe(shipping?.districtName)
    expect(draft.cityCode).toBe(shipping?.cityCode)
    expect(draft.cityName).toBe(shipping?.cityName)
    expect(draft.street1).toBe(shipping?.street1)
    expect(draft.buildingNumber).toBe(shipping?.buildingNumber)
    expect(draft.postalCode).toBe(shipping?.postalCode)
    expect(draft.shortAddress).toBe(shipping?.shortAddress)
    // No map picker: the delivery's coordinates are carried through as they are.
    expect(draft.gpsLat).toBe(shipping?.gpsLat)
    expect(draft.gpsLon).toBe(shipping?.gpsLon)
  })

  it('carries exactly the field set 1283 §2 names, and nothing else', () => {
    // The draft IS the wire shape: an extra field here is one that would have to
    // be dropped later, and a missing one is a field the carrier never reads.
    expect(Object.keys(pickupAddressFrom(shipping)).sort()).toEqual(
      [
        'buildingNumber',
        'cityCode',
        'cityName',
        'districtCode',
        'districtName',
        'gpsLat',
        'gpsLon',
        'postalCode',
        'shortAddress',
        'street1',
        'street2',
      ].sort(),
    )
  })

  it('yields an empty, editable draft when the delivery carries no address at all', () => {
    // Every string blank, every coordinate zero — never `undefined`, which would
    // make a controlled input uncontrolled the moment it was typed into.
    const draft = pickupAddressFrom(null)
    expect(draft).toEqual({
      street1: '',
      street2: '',
      cityCode: '',
      cityName: '',
      districtCode: '',
      districtName: '',
      postalCode: '',
      buildingNumber: '',
      shortAddress: '',
      gpsLat: 0,
      gpsLon: 0,
    })
  })
})

describe('applyPickupDistrict', () => {
  const district: SdDistrictModel = {
    districtCode: 'D77',
    cityCode: 'C01',
    cityNameAr: 'الرياض',
    cityNameEn: 'Riyadh',
    magentoCityEn: '',
    magentoCityAr: '',
    districtNameAr: 'النخيل',
    districtNameEn: 'An-Nakheel',
    storeCode: '1000',
    insuranceStoreCode: '',
    tempStoreCode: '',
    createdOn: '',
    createdBy: '',
    updatedOn: '',
    updatedBy: '',
    latitude: 0,
    longitude: 0,
  }

  it('derives the city from the chosen district, the way change-store already does it', () => {
    const before = pickupAddressFrom(DELIVERY_WITH_ADDRESS.shippingAddress)
    const after = applyPickupDistrict(before, district)
    expect(after.districtCode).toBe('D77')
    expect(after.districtName).toBe('An-Nakheel')
    expect(after.cityCode).toBe('C01')
    expect(after.cityName).toBe('Riyadh')
  })

  it('falls back to the Arabic names when the English ones are blank', () => {
    const arabicOnly = { ...district, districtNameEn: '', cityNameEn: '' }
    const after = applyPickupDistrict(pickupAddressFrom(null), arabicOnly)
    expect(after.districtName).toBe('النخيل')
    expect(after.cityName).toBe('الرياض')
  })

  it('leaves the street, the building and the GPS alone — a district is not an address', () => {
    const before = pickupAddressFrom(DELIVERY_WITH_ADDRESS.shippingAddress)
    const after = applyPickupDistrict(before, district)
    expect(after.street1).toBe(before.street1)
    expect(after.street2).toBe(before.street2)
    expect(after.buildingNumber).toBe(before.buildingNumber)
    expect(after.postalCode).toBe(before.postalCode)
    expect(after.shortAddress).toBe(before.shortAddress)
    expect(after.gpsLat).toBe(before.gpsLat)
    expect(after.gpsLon).toBe(before.gpsLon)
  })

  it('changes nothing at all when handed no district', () => {
    const before = pickupAddressFrom(DELIVERY_WITH_ADDRESS.shippingAddress)
    expect(applyPickupDistrict(before, null)).toEqual(before)
    expect(applyPickupDistrict(before, undefined)).toEqual(before)
  })
})

describe('pickupAddressSummary', () => {
  it('reads as the one line the collapsed panel shows, blanks dropped', () => {
    const parts = pickupAddressSummary({
      ...pickupAddressFrom(null),
      districtName: 'An-Nakheel',
      cityName: 'Riyadh',
      street1: 'King Abdulaziz Rd',
      buildingNumber: '7420',
      shortAddress: 'RIYD2938',
    })
    expect(parts).toEqual(['An-Nakheel, Riyadh', 'King Abdulaziz Rd 7420', 'RIYD2938'])
  })

  it('never emits a part built out of separators alone', () => {
    // A delivery with a city and nothing else must read *Riyadh*, not *, Riyadh*.
    expect(pickupAddressSummary({ ...pickupAddressFrom(null), cityName: 'Riyadh' })).toEqual([
      'Riyadh',
    ])
    expect(pickupAddressSummary(pickupAddressFrom(null))).toEqual([])
  })
})

describe('districtLabel and restorePickupDistrict', () => {
  const district: SdDistrictModel = {
    ...({} as SdDistrictModel),
    districtCode: 'D77',
    cityCode: 'C01',
    districtNameEn: 'An-Nakheel',
    districtNameAr: 'النخيل',
    cityNameEn: 'Riyadh',
    cityNameAr: 'الرياض',
  }

  it('names a district English-first, then Arabic, then by its own code', () => {
    expect(districtLabel(district)).toBe('An-Nakheel')
    expect(districtLabel({ ...district, districtNameEn: '' })).toBe('النخيل')
    expect(districtLabel({ ...district, districtNameEn: '', districtNameAr: '' })).toBe('D77')
  })

  it('labels a district exactly as applying it spells it — a picked name never blanks the field', () => {
    // The `<option>` the operator read and the value written into the draft are
    // the same string, so choosing a district can never empty the field the
    // label just showed.
    const arabicOnly = { ...district, districtNameEn: '' }
    expect(applyPickupDistrict(pickupAddressFrom(null), arabicOnly).districtName).toBe(
      districtLabel(arabicOnly),
    )
  })

  it('puts the delivery’s own district and city back, and touches nothing else', () => {
    const delivered = pickupAddressFrom(DELIVERY_WITH_ADDRESS.shippingAddress)
    const moved = applyPickupDistrict({ ...delivered, street1: 'Corrected St' }, district)
    const back = restorePickupDistrict(moved, delivered)
    expect(back.districtCode).toBe(delivered.districtCode)
    expect(back.districtName).toBe(delivered.districtName)
    expect(back.cityCode).toBe(delivered.cityCode)
    expect(back.cityName).toBe(delivered.cityName)
    // The street correction survives: going back to the delivery's district is
    // not a way of undoing everything else the operator typed.
    expect(back.street1).toBe('Corrected St')
  })
})
