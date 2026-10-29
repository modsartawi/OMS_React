/**
 * Ticket 667 — the Check panel's reading of a Check answer: refusals block Send, a price warning
 * never does; refusals are grouped per row (material) and per header field. A Send refused for its
 * checks (DHS-00018) carries the same answer as its `data` (666's assumption), read defensively.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { HungerStationPromotionCheckResult } from '@/core/models/hungerstation'
import { checkOfRefusal, checkSummary } from './check-summary'

const clean: HungerStationPromotionCheckResult = { sendable: true, header: [], rows: [], parts: [], skuCount: 3, changes: null }

describe('checkSummary', () => {
  it('a clean answer: nothing refuses, Send is open', () => {
    const s = checkSummary(clean)
    expect([s.refusals, s.warnings, s.blocksSend, s.rows.size, s.header.size]).toEqual([0, 0, false, 0, 0])
  })

  it('a price warning never blocks Send, and names its stores', () => {
    const s = checkSummary({ ...clean, rows: [{ materialNumber: '101003', refusals: [], priceWarning: { storeCodes: ['2001', '1001'] } }] })
    expect(s.blocksSend).toBe(false)
    expect(s.warnings).toBe(1)
    expect(s.refusedRows).toBe(0)
    expect(s.rows.get('101003')).toEqual({ refusals: [], warningStores: ['2001', '1001'] })
  })

  it('a row refusal blocks Send, grouped on its material', () => {
    const s = checkSummary({
      ...clean,
      sendable: false,
      rows: [
        { materialNumber: '101002', refusals: [{ code: 'NO_SKU', message: 'm1' }], priceWarning: null },
        { materialNumber: '101001', refusals: [{ code: 'PERCENT_RANGE', message: 'm2' }, { code: 'VALUE_DECIMALS', message: 'm3' }], priceWarning: { storeCodes: ['1001'] } },
      ],
    })
    expect(s.blocksSend).toBe(true)
    expect(s.refusals).toBe(3)
    expect(s.refusedRows).toBe(2)
    expect(s.warnings).toBe(1)
    expect(s.rows.get('101001')?.refusals.map((p) => p.code)).toEqual(['PERCENT_RANGE', 'VALUE_DECIMALS'])
    expect(s.rows.get('101002')?.warningStores).toEqual([])
  })

  it('a material named twice is one row', () => {
    const s = checkSummary({
      ...clean,
      sendable: false,
      rows: [
        { materialNumber: '7', refusals: [{ code: 'NO_SKU', message: 'a' }], priceWarning: null },
        { materialNumber: '7', refusals: [{ code: 'VALUE_NOT_POSITIVE', message: 'b' }], priceWarning: { storeCodes: ['1001'] } },
      ],
    })
    expect(s.refusedRows).toBe(1)
    expect(s.rows.get('7')).toEqual({ refusals: [{ code: 'NO_SKU', message: 'a' }, { code: 'VALUE_NOT_POSITIVE', message: 'b' }], warningStores: ['1001'] })
  })

  it('header refusals are grouped per field and block Send', () => {
    const s = checkSummary({
      ...clean,
      sendable: false,
      header: [
        { field: 'endAt', code: 'END_PAST', message: 'x' },
        { field: 'displayNameAr', code: 'DISPLAY_NAME_MISSING', message: 'y' },
        { field: 'endAt', code: 'WINDOW_ORDER', message: 'z' },
      ],
    })
    expect(s.blocksSend).toBe(true)
    expect(s.refusals).toBe(3)
    expect([...s.header.keys()]).toEqual(['endAt', 'displayNameAr'])
    expect(s.header.get('endAt')?.map((p) => p.code)).toEqual(['END_PAST', 'WINDOW_ORDER'])
  })

  it('the server saying not sendable blocks Send even with no refusal listed', () => {
    expect(checkSummary({ ...clean, sendable: false }).blocksSend).toBe(true)
  })

  it('a refusal listed blocks Send even when the server says sendable', () => {
    expect(checkSummary({ ...clean, header: [{ field: 'stores', code: 'NO_STORES', message: 'n' }] }).blocksSend).toBe(true)
  })
})

const refusal = (data: unknown, code = 'DHS-00018') =>
  new ApiError('business', 'A check refuses.', 400, [{ errorCode: code, internalErrorCode: '', errorMessage: 'A check refuses.' }], data)

describe('checkOfRefusal', () => {
  it('reads the Check answer a DHS-00018 carries', () => {
    const data = { ...clean, sendable: false, rows: [{ materialNumber: '101002', refusals: [{ code: 'NO_SKU', message: 'm' }], priceWarning: null }] }
    expect(checkOfRefusal(refusal(data))).toEqual(data)
  })

  it('fills what it cannot read with nothing, and drops a row with no material', () => {
    const got = checkOfRefusal(refusal({ rows: [{ materialNumber: 5 }, { materialNumber: '9', refusals: [{ code: 'X' }] }], header: 'no' }))
    expect(got).toEqual({
      sendable: false,
      header: [],
      rows: [{ materialNumber: '9', refusals: [{ code: 'X', message: '' }], priceWarning: null }],
      parts: [],
      skuCount: 0,
      changes: null,
    })
  })

  it('null for another refusal, a body it cannot read, or not an ApiError', () => {
    expect(checkOfRefusal(refusal(clean, 'DHS-00017'))).toBeNull()
    expect(checkOfRefusal(refusal(null))).toBeNull()
    expect(checkOfRefusal(refusal('no'))).toBeNull()
    expect(checkOfRefusal(new Error('x'))).toBeNull()
  })
})

// Ticket 668 — the part preview: the parts the server will send, as it split them. The page
// never computes them; the summary hands them on as the answer lists them.
const parts = [
  { buyQuantity: 2, getQuantity: 1, subtype: 'PERCENTAGE' as const, value: 50, name: 'Eid · B2G1 50%', skuCount: 600 },
  { buyQuantity: 1, getQuantity: 1, subtype: 'PERCENTAGE' as const, value: 100, name: 'Eid · B1G1 100%', skuCount: 300 },
  { buyQuantity: 2, getQuantity: 1, subtype: 'FINAL_PRICE' as const, value: 9.95, name: 'Eid · B2G1 9.95final', skuCount: 100 },
]

describe('checkSummary — the part preview (668)', () => {
  it('carries the parts in the order the server listed them, with the SKU total', () => {
    const s = checkSummary({ ...clean, parts, skuCount: 1000 })
    expect(s.parts.map((p) => [p.name, p.skuCount])).toEqual([
      ['Eid · B2G1 50%', 600],
      ['Eid · B1G1 100%', 300],
      ['Eid · B2G1 9.95final', 100],
    ])
    expect(s.skuCount).toBe(1000)
  })

  it('a buy/get refusal on a row blocks Send like any row refusal', () => {
    const s = checkSummary({ ...clean, sendable: false, rows: [{ materialNumber: '201004', refusals: [{ code: 'BUY_GET_RANGE', message: 'b' }], priceWarning: null }] })
    expect([s.blocksSend, s.refusedRows]).toEqual([true, 1])
  })
})

describe('checkOfRefusal — the part preview (668)', () => {
  it('reads the parts a DHS-00018 carries', () => {
    expect(checkOfRefusal(refusal({ ...clean, sendable: false, parts }))?.parts).toEqual(parts)
  })

  it('drops a part it cannot read (no name, no SKU count); a blank combination field is null', () => {
    const got = checkOfRefusal(refusal({ parts: [{ name: 'A', skuCount: 2, buyQuantity: 2, getQuantity: '1', subtype: 'HALF' }, { name: 5, skuCount: 1 }, { name: 'B' }, 'x'] }))
    expect(got?.parts).toEqual([{ name: 'A', skuCount: 2, buyQuantity: 2, getQuantity: null, subtype: null, value: null }])
  })
})

// Ticket 670 — an in-place edit's Check answers what changes per part; a refused edit carries it too.
const changes = [
  { buyQuantity: 2, getQuantity: 1, subtype: 'PERCENTAGE' as const, value: 50, partId: 'pt-a', name: 'A', change: 'updated' as const, skuCount: 1, leaving: ['201002'], joining: [] },
  { buyQuantity: 3, getQuantity: 1, subtype: 'PERCENTAGE' as const, value: 50, partId: null, name: 'C', change: 'new' as const, skuCount: 1, leaving: [], joining: ['201002'] },
]

describe('checkSummary — the edit preview (670)', () => {
  it('carries the per-part changes; a draft check carries none', () => {
    expect(checkSummary({ ...clean, changes }).changes?.moved).toEqual([{ materialNumber: '201002', from: 'A', to: 'C' }])
    expect(checkSummary(clean).changes).toBeNull()
  })
})

describe('checkOfRefusal — the edit preview (670)', () => {
  it('reads the changes a DHS-00018 carries, dropping an entry it cannot read', () => {
    const got = checkOfRefusal(refusal({ ...clean, sendable: false, changes: [...changes, { name: 'X' }, 'y'] }))
    expect(got?.changes).toEqual(changes)
  })

  it('no changes array is null', () => {
    expect(checkOfRefusal(refusal({ ...clean, changes: 'no' }))?.changes).toBeNull()
  })
})
