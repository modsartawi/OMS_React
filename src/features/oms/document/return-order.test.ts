import { describe, expect, it } from 'vitest'
import {
  applyPickupDistrict,
  reconcilePickupDistrict,
  buildCreateReturnRequest,
  districtLabel,
  clampReturnQuantity,
  pickupAddressFrom,
  pickupAddressSummary,
  restorePickupDistrict,
  refundableFees,
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
import {
  CREATED_RETURN,
  DUPLICATE_REPLAY,
  REFUSED_NOT_ELIGIBLE,
} from './__fixtures__/return-create'
import { ApiError, apiErrorCode, apiErrorMessage } from '@/core/api'

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

describe('reconcilePickupDistrict', () => {
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

  it('fills the city a code-only match left blank — the pair the courier routes on', () => {
    // The defect: the picker matched `D77` on its code alone because the
    // delivery carried no `cityCode`, showed the district, and left the City box
    // empty — and the return would have posted `districtCode` with `cityCode: ''`.
    const stale = { ...pickupAddressFrom(null), districtCode: 'D77', districtName: 'An-Nakheel' }
    expect(stale.cityCode).toBe('')
    const after = reconcilePickupDistrict(stale, district)
    expect(after.cityCode).toBe('C01')
    expect(after.cityName).toBe('Riyadh')
    expect(after.districtCode).toBe('D77')
  })

  it('corrects a STALE city too, not just a blank one', () => {
    const stale = {
      ...pickupAddressFrom(null),
      districtCode: 'D77',
      districtName: 'An-Nakheel',
      cityCode: 'C99',
      cityName: 'Somewhere Else',
    }
    expect(reconcilePickupDistrict(stale, district).cityCode).toBe('C01')
  })

  it('writes exactly what re-picking the same row would write, and nothing more', () => {
    const stale = { ...pickupAddressFrom(DELIVERY_WITH_ADDRESS.shippingAddress), cityCode: '' }
    expect(reconcilePickupDistrict(stale, district)).toEqual(applyPickupDistrict(stale, district))
  })

  it('hands the SAME object back when the pair already agrees — the caller loops on identity', () => {
    const agreed = applyPickupDistrict(pickupAddressFrom(null), district)
    expect(reconcilePickupDistrict(agreed, district)).toBe(agreed)
  })

  it('leaves the pinned delivery row alone — that row is the way back, not a mismatch', () => {
    const delivered = pickupAddressFrom(DELIVERY_WITH_ADDRESS.shippingAddress)
    expect(reconcilePickupDistrict(delivered, null)).toBe(delivered)
    expect(reconcilePickupDistrict(delivered, undefined)).toBe(delivered)
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

describe('refundableFees', () => {
  // The projection is proved against REAL captured conditions rather than
  // hand-written rows: every trap it exists to avoid — the structural `.000` on
  // `condValue`, the distributed `'H'` copy, a header row of another category —
  // is present on the wire exactly as captured.
  const ERX = PAYLOADS['2000000551'].conditions
  const CANCELLING = PAYLOADS['8000000174'].conditions

  it('keeps only header delivery-fee rows', () => {
    // `2000000551` carries, at item 0, a `DFEE` fee row AND a `PTPA` payment row
    // — and at line 1 a distributed copy of each. Only the first survives.
    expect(refundableFees(ERX).map((fee) => fee.condType)).toEqual(['DFEE'])
  })

  it('reads condAmount — the rate — and never condValue', () => {
    // ⚠ The regression this test exists for is SILENT: on `8000000174`'s header
    // fee row `condValue` is `0` and `condAmount` is `12`. Reading the wrong one
    // throws nothing and displays a fee that costs the customer nothing.
    const header = CANCELLING.find((c) => c.condDocumentLine === 0 && c.condType === 'DFEE')
    expect(header?.condValue).toBe(0)
    expect(refundableFees(CANCELLING).map((fee) => fee.amount)).toEqual([12])
  })

  it('never sums the distributed per-line copies', () => {
    // The same 12 exists as the item-0 row and as one `originOfCond: 'H'` copy
    // per line. Taking both charges the concession twice.
    expect(CANCELLING.filter((c) => c.condType === 'DFEE')).toHaveLength(2)
    const fees = refundableFees(CANCELLING)
    expect(fees).toHaveLength(1)
    expect(fees[0].amount).toBe(12)
  })

  it('names a fee by the server’s own description', () => {
    expect(refundableFees(CANCELLING)[0].description).toBe('Delivery Fees')
  })

  it('projects nothing — and does not crash — on a delivery with no fees', () => {
    expect(refundableFees(PAYLOADS['8000000253'].conditions)).toEqual([])
    expect(refundableFees(null)).toEqual([])
    expect(refundableFees(undefined)).toEqual([])
  })

  it('offers the two header fees the returnable delivery carries', () => {
    expect(refundableFees(DELIVERY_WITH_REMAINING.conditions)).toEqual([
      { condType: 'DFEE', description: 'Delivery Fees', amount: 12 },
      { condType: 'FBBD', description: 'Beyond Border Delivery Fee', amount: 25 },
    ])
  })
})

describe('submitGate — the fee half of the summary (ticket 294)', () => {
  const picked = (quantity: number | null) => ({ picked: true, quantity })

  it('summarises the fees as well as the lines — 3 lines · 1 fee', () => {
    // Spec 289 story 41. The two counts are INDEPENDENT, so they arrive as two
    // keys: one i18n key cannot pluralise two numbers, and *3 lines · 1 fees* is
    // the copy defect that produces.
    expect(submitGate([picked(2), picked(1), picked(3)], 'RTRF', 1)).toEqual({
      ok: true,
      key: 'returnDocument.gate.summary',
      params: { count: 3 },
      fees: { key: 'returnDocument.gate.summaryFees', params: { count: 1 } },
    })
  })

  it('says nothing about fees when none is ticked — the strip stays the lines summary', () => {
    expect(submitGate([picked(2)], 'RF', 0).fees).toBeUndefined()
    expect(submitGate([picked(2)], 'RF')).toEqual({
      ok: true,
      key: 'returnDocument.gate.summary',
      params: { count: 1 },
    })
  })

  it('never puts a fee count on a BLOCKED bar — one missing thing at a time', () => {
    // A ticked fee is not a step towards submitting; naming it beside a
    // complaint would read as progress the operator has not made.
    for (const outcome of [
      submitGate([{ picked: false, quantity: null }], 'RTRF', 2),
      submitGate([picked(null)], 'RTRF', 2),
      submitGate([picked(1)], null, 2),
    ]) {
      expect(outcome.ok).toBe(false)
      expect(outcome.fees).toBeUndefined()
    }
  })
})

describe('buildCreateReturnRequest', () => {
  const ROWS = returnableLines(DELIVERY_WITH_ADDRESS.lines).rows
  const FEES = refundableFees(DELIVERY_WITH_ADDRESS.conditions)
  const ADDRESS = pickupAddressFrom(DELIVERY_WITH_ADDRESS.shippingAddress)

  /** The screen filled in the ordinary way: line 10 ticked in full, no fee. */
  const draft = (over: Partial<Parameters<typeof buildCreateReturnRequest>[0]> = {}) =>
    buildCreateReturnRequest({
      requestId: 'req-0001',
      refDeliveryNo: DELIVERY_WITH_ADDRESS.documentNo,
      reason: 'RTRF',
      rows: ROWS,
      selections: { 10: { picked: true, quantity: 4 } },
      fees: FEES,
      feePicks: {},
      address: ADDRESS,
      note: '',
      ...over,
    })

  it('carries ticked lines only, at their clamped quantities', () => {
    const body = draft({
      selections: {
        10: { picked: true, quantity: 99 },
        20: { picked: false, quantity: 4 },
      },
    })
    expect(body.lines).toEqual([{ lineNumber: 10, itemNumber: '208713', quantity: 4 }])
    // The unticked line's number rode along in state; it must not ride onto the
    // wire, and the ticked one is capped at what is left — 4 of 4, not 99.
    expect(body.lines.map((line) => line.lineNumber)).not.toContain(20)
  })

  it('clamps a cleared, zero or negative quantity to 1 rather than sending it', () => {
    // The gate already blocks a cleared box, so this is the second guard: a body
    // is never built carrying a quantity the server would refuse.
    for (const quantity of [null, 0, -3]) {
      expect(draft({ selections: { 10: { picked: true, quantity } } }).lines[0].quantity).toBe(1)
    }
  })

  it('carries fee TYPES only — the rate the screen displayed is nowhere in the body', () => {
    const body = draft({ feePicks: { DFEE: true, FBBD: false } })
    expect(body.conditionTypes).toEqual(['DFEE'])
    // ⚠ 12 is what the screen displayed as `DFEE`'s rate. The client names WHICH
    // fee carries back and never HOW MUCH — the server re-reads the rate itself.
    // Read off the fee projection rather than typed here, so a fixture whose
    // rate changes cannot quietly stop testing anything.
    const rate = FEES.find((fee) => fee.condType === 'DFEE')?.amount
    expect(rate).toBe(12)
    expect(Object.values(body).flat()).not.toContain(rate)
    expect(body.conditionTypes).not.toContain(String(rate))
  })

  it('cannot carry a fee the projection never offered', () => {
    // A tick left behind by a fee that is no longer on the grid is stale state,
    // not a decision — and `conditionTypes` is the one list the server acts on.
    expect(draft({ feePicks: { DFEE: true, GONE: true } }).conditionTypes).toEqual(['DFEE'])
  })

  it('includes the full address field set under RTRF', () => {
    const body = draft({ reason: 'RTRF' })
    expect(Object.keys(body.shippingAddress ?? {}).sort()).toEqual(
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
    expect(body.shippingAddress).toEqual(ADDRESS)
  })

  it('OMITS shippingAddress under RF — even after the address was expanded and edited', () => {
    // The panel is absent under `RF`, but the draft it left behind is not: the
    // builder drops it independently of what the panel did, so the two cannot
    // disagree about what was posted (spec 289 D5).
    const edited = { ...ADDRESS, street1: 'Somewhere Else Ave', shortAddress: 'CHANGED9999' }
    const body = draft({ reason: 'RF', address: edited })
    expect('shippingAddress' in body).toBe(false)
    expect(JSON.stringify(body)).not.toContain('CHANGED9999')
  })

  it('omits a blank note, and trims the one that is typed', () => {
    expect('note' in draft({ note: '' })).toBe(false)
    expect('note' in draft({ note: '   ' })).toBe(false)
    expect(draft({ note: '  damaged in transit  ' }).note).toBe('damaged in transit')
  })

  it('carries the requestId and the DELIVERY number, and names the reason', () => {
    const body = draft({ requestId: 'abc-123', reason: 'RF' })
    expect(body.requestId).toBe('abc-123')
    expect(body.refDeliveryNo).toBe(DELIVERY_WITH_ADDRESS.documentNo)
    expect(body.reason).toBe('RF')
  })

  it('puts NO amount on the wire — a whole-body walk', () => {
    // ⚠ The one test that catches money creeping back. Not a spot check of the
    // fields today's builder happens to set: a walk of the SERIALIZED body, so a
    // field added later is caught by construction.
    const body = draft({
      selections: { 10: { picked: true, quantity: 4 }, 20: { picked: true, quantity: 3 } },
      feePicks: { DFEE: true, FBBD: true },
      note: 'damaged in transit',
    })
    const keys: string[] = []
    const numbers: number[] = []
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(walk)
      if (typeof value === 'number') return void numbers.push(value)
      if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          keys.push(key)
          walk(child)
        }
      }
    }
    walk(JSON.parse(JSON.stringify(body)))

    // No key ANYWHERE names money, in either direction.
    const money = /price|amount|discount|vat|tax|total|charge|refund|money|cost|rate|net|gross/i
    expect(keys.filter((key) => money.test(key))).toEqual([])

    // And every number in the body is accounted for: two line numbers, two
    // quantities and the delivery's own GPS pair. Nothing else is a number here,
    // so no figure can be a price the client chose.
    expect([...numbers].sort((a, b) => a - b)).toEqual(
      [10, 4, 20, 3, ADDRESS.gpsLat, ADDRESS.gpsLon].sort((a, b) => a - b),
    )
    // The rates the screen displayed as context stay on the screen.
    const displayed = FEES.map((fee) => fee.amount).concat(ROWS.map((row) => row.unitPrice))
    expect(numbers.filter((n) => displayed.includes(n))).toEqual([])
  })
})

describe('the create door’s two answers, as fixtures (ticket 294)', () => {
  it('reads a refusal through the standard readers — and needs no code of its own', () => {
    // The envelope arrives as core/api's typed `ApiError`; the screen shows the
    // server's own sentence with the code beside it. ⚠ It matches on NEITHER —
    // BackOffice spec 1283 §8 mints the values and calls them build detail.
    const refusal = new ApiError(
      'business',
      REFUSED_NOT_ELIGIBLE.message,
      REFUSED_NOT_ELIGIBLE.statusCode,
      REFUSED_NOT_ELIGIBLE.errors,
    )
    expect(REFUSED_NOT_ELIGIBLE.success).toBe(false)
    expect(apiErrorMessage(refusal, 'unexpected')).toBe(REFUSED_NOT_ELIGIBLE.message)
    expect(apiErrorCode(refusal)).toBe(REFUSED_NOT_ELIGIBLE.errors[0].errorCode)
    // A sentence a human can act on, not a code dressed up as one.
    expect(REFUSED_NOT_ELIGIBLE.message).toMatch(/\s/)
  })

  it('carries a replay as a SUCCESS — the same return, not a second one', () => {
    expect(DUPLICATE_REPLAY.success).toBe(true)
    expect(DUPLICATE_REPLAY.statusCode).toBe(200)
    expect(DUPLICATE_REPLAY.data.replayed).toBe(true)
    // The number is the whole point of reporting it: a retry that hands back a
    // DIFFERENT one would mean a second return was created.
    expect(DUPLICATE_REPLAY.data.documentNo).toBe(CREATED_RETURN.data.documentNo)
    expect(CREATED_RETURN.data.replayed).toBe(false)
  })
})
