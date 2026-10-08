/**
 * The slip rules (ticket 320, BackOffice 2034's `## Web contract`) — the pure half
 * of the Slips column, the "No slip" filter and the probe.
 *
 * 🔑 Every case here is about one sentence: **null is UNKNOWN, never "no slip"**.
 * The mutation this file exists to catch is the one that reads right — `== 0` or
 * `!row.slipCount` in the filter, `String.includes` or truthiness in the probe —
 * and lets an unknown day or a malformed answer through.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiEnvelope } from '@/core/api'
import { holdsCategory } from '@/core/attachments/rules'
import { attachmentUploadForm } from '@/core/attachments/upload'
import type { AttachmentAccess, CollectionReadyRow, SlipCountedSiblings } from '@/core/models/collection'
import {
  CASH_CLOSE,
  ECR_SLIP,
  SLIP_ABSENT,
  STORE_DAY,
  canSeeSlips,
  isKnownSlipCount,
  isNoSlipRow,
  slipCountText,
  slipCountedRows,
  slipDayOf,
  slipTarget,
  storeDayOwnerKey,
  withSlipColumn,
} from './slips'
import { READY_DAY, READY_DAY_NO_Z, READY_RECEIPT } from './ready-fixture'

describe('the slip count cell', () => {
  it('draws a real 0 as 0 — a day with no slip is a figure, not an absence', () => {
    expect(slipCountText(0)).toBe('0')
  })

  it('draws a count as sent', () => {
    expect(slipCountText(2)).toBe('2')
    expect(slipCountText(17)).toBe('17')
  })

  it('draws null — and anything that is not a count — as the dash, never 0', () => {
    for (const unknown of [null, undefined, '', '0', NaN, -1, 1.5, true])
      expect(slipCountText(unknown), String(unknown)).toBe(SLIP_ABSENT)
  })

  it('knows a count only when it is a whole, non-negative number', () => {
    expect(isKnownSlipCount(0)).toBe(true)
    expect(isKnownSlipCount(3)).toBe(true)
    expect(isKnownSlipCount(null)).toBe(false)
    expect(isKnownSlipCount(undefined)).toBe(false)
  })
})

describe('the "No slip" filter', () => {
  it('keeps a row whose count is exactly 0', () => {
    expect(isNoSlipRow({ slipCount: 0 })).toBe(true)
    expect(isNoSlipRow(READY_DAY_NO_Z)).toBe(true)
  })

  it('🔑 drops null — an unknown count never falls into "No slip"', () => {
    expect(isNoSlipRow({ slipCount: null })).toBe(false)
    // A receipt is not a store day: its count is null and it is never "no slip".
    expect(isNoSlipRow(READY_RECEIPT)).toBe(false)
  })

  it('drops an absent count and an absent row', () => {
    expect(isNoSlipRow({})).toBe(false)
    expect(isNoSlipRow({ slipCount: undefined })).toBe(false)
    expect(isNoSlipRow(undefined)).toBe(false)
    expect(isNoSlipRow(null)).toBe(false)
  })

  it('drops every positive count', () => {
    for (const n of [1, 2, 10, 1000]) expect(isNoSlipRow({ slipCount: n }), String(n)).toBe(false)
    expect(isNoSlipRow(READY_DAY)).toBe(false)
  })

  it('filters a mixed list down to the 0 rows alone', () => {
    const rows = [READY_DAY, READY_RECEIPT, READY_DAY_NO_Z, { ...READY_DAY, slipCount: null }]
    expect(rows.filter(isNoSlipRow)).toEqual([READY_DAY_NO_Z])
  })

  it('is not fooled by a count that only LOOKS like zero', () => {
    // `'0' == 0` and `!''` are both true; `=== 0` is neither.
    expect(isNoSlipRow({ slipCount: '0' as never })).toBe(false)
    expect(isNoSlipRow({ slipCount: '' as never })).toBe(false)
    expect(isNoSlipRow({ slipCount: false as never })).toBe(false)
  })
})

describe('the slip probe (AttachmentWeb/Access)', () => {
  const access = (over: Partial<AttachmentAccess>): AttachmentAccess => ({ categories: [], ...over })

  it('admits a categories ARRAY that holds CASH_CLOSE', () => {
    expect(canSeeSlips(access({ categories: [CASH_CLOSE] }))).toBe(true)
    expect(canSeeSlips(access({ categories: ['OTHER', CASH_CLOSE] }))).toBe(true)
    // withdrawCategories is 323's to read; it neither admits nor denies the column.
    expect(canSeeSlips(access({ categories: [CASH_CLOSE], withdrawCategories: [] }))).toBe(true)
  })

  it('🔑 refuses CASH_CLOSE as a bare string — the String.includes trap', () => {
    expect(canSeeSlips({ categories: CASH_CLOSE } as never)).toBe(false)
    expect(canSeeSlips({ categories: 'CASH_CLOSE,OTHER' } as never)).toBe(false)
    expect(holdsCategory(CASH_CLOSE, CASH_CLOSE)).toBe(false)
  })

  it('refuses an empty array, and a list without CASH_CLOSE', () => {
    expect(canSeeSlips(access({ categories: [] }))).toBe(false)
    expect(canSeeSlips(access({ categories: ['OTHER'] }))).toBe(false)
    // …and a near-miss spelling: membership is exact.
    expect(canSeeSlips(access({ categories: ['cash_close', 'CASH_CLOSE '] }))).toBe(false)
    // Holding only the WITHDRAW grant does not draw the column.
    expect(canSeeSlips(access({ categories: [], withdrawCategories: [CASH_CLOSE] }))).toBe(false)
  })

  it('refuses a refusal, a pending probe and a malformed answer — it fails closed', () => {
    // A refused (503 NOT_SET_UP, 403, network) or pending query has no data.
    expect(canSeeSlips(undefined)).toBe(false)
    expect(canSeeSlips(null)).toBe(false)
    // A missing field, `{}`, a null list.
    expect(canSeeSlips({} as never)).toBe(false)
    expect(canSeeSlips({ categories: null } as never)).toBe(false)
    expect(canSeeSlips({ withdrawCategories: [CASH_CLOSE] } as never)).toBe(false)
    expect(canSeeSlips('CASH_CLOSE' as never)).toBe(false)
  })
})

describe('the slip-counted read', () => {
  const answer = (over: Partial<ApiEnvelope<CollectionReadyRow[], SlipCountedSiblings>>) =>
    ({ statusCode: 200, success: true, message: '', errors: [], data: [READY_DAY], ...over }) as ApiEnvelope<
      CollectionReadyRow[],
      SlipCountedSiblings
    >

  it('keeps the rows and the flag beside them', () => {
    expect(slipCountedRows(answer({ slipCountsUnavailable: true }))).toEqual({
      rows: [READY_DAY],
      slipCountsUnavailable: true,
    })
    expect(slipCountedRows(answer({ slipCountsUnavailable: false })).slipCountsUnavailable).toBe(false)
  })

  it('reads the flag as true only when the server said true', () => {
    expect(slipCountedRows(answer({})).slipCountsUnavailable).toBe(false)
    expect(slipCountedRows(answer({ slipCountsUnavailable: 'true' as never })).slipCountsUnavailable).toBe(false)
  })

  it('an absent row array is an empty list, as `get` callers already read it', () => {
    expect(slipCountedRows(answer({ data: null as never })).rows).toEqual([])
  })
})

describe('placing the Slips column', () => {
  const base = ['a', 'cardTotal', 'b']

  it('lands right after cardTotal when the session may see slips', () => {
    expect(withSlipColumn(base, true)).toEqual(['a', 'cardTotal', 'slipCount', 'b'])
  })

  it('leaves the list alone — and unshared — when it may not', () => {
    const out = withSlipColumn(base, false)
    expect(out).toEqual(['a', 'cardTotal', 'b'])
    expect(out).not.toBe(base)
  })

  it('appends it when the anchor is absent', () => {
    expect(withSlipColumn(['a', 'b'], true)).toEqual(['a', 'b', 'slipCount'])
  })
})

/* ═══════════════════════ the drawer (ticket 321) ═══════════════════════ */

describe('storeDayOwnerKey — <storeId>/<yyyy-MM-dd>, by string handling only', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('takes the date part of an ISO businessDay with a time part', () => {
    expect(storeDayOwnerKey('P019', '2026-09-20T00:00:00')).toBe('P019/2026-09-20')
  })

  it('takes a bare date as it is', () => {
    expect(storeDayOwnerKey('P019', '2026-09-20')).toBe('P019/2026-09-20')
  })

  it('never shifts a day near midnight — the proof no Date or zone is in the way', () => {
    // A Date round-trip moves each of these to a neighbouring day in some zone:
    // 23:59 local read as UTC lands on the 21st east of Greenwich, a `Z` stamp at
    // 23:30 is the 21st in Riyadh, and 00:00:30 is the 19th west of it.
    expect(storeDayOwnerKey('P019', '2026-09-20T23:59:59')).toBe('P019/2026-09-20')
    expect(storeDayOwnerKey('P019', '2026-09-20T23:30:00Z')).toBe('P019/2026-09-20')
    expect(storeDayOwnerKey('P019', '2026-09-20T00:00:30')).toBe('P019/2026-09-20')
    expect(storeDayOwnerKey('P019', '2026-09-20T00:00:00+03:00')).toBe('P019/2026-09-20')
    expect(storeDayOwnerKey('P019', '2026-12-31T23:59:59.9999999')).toBe('P019/2026-12-31')
  })

  it('does not touch Date at all (a Date that throws changes nothing)', () => {
    vi.stubGlobal(
      'Date',
      class {
        constructor() {
          throw new Error('Date must not be used')
        }
        static parse() {
          throw new Error('Date.parse must not be used')
        }
      },
    )
    expect(storeDayOwnerKey('P019', '2026-09-20T23:59:59')).toBe('P019/2026-09-20')
  })

  it('trims the store, as the server’s StoreDayKey does', () => {
    expect(storeDayOwnerKey(' P019 ', '2026-09-20T00:00:00')).toBe('P019/2026-09-20')
  })

  it('has no key without a day or a store — a settlement row never builds one', () => {
    expect(storeDayOwnerKey('P019', null)).toBeNull()
    expect(storeDayOwnerKey('P019', undefined)).toBeNull()
    expect(storeDayOwnerKey('P019', '')).toBeNull()
    expect(storeDayOwnerKey('', '2026-09-20')).toBeNull()
    expect(storeDayOwnerKey('  ', '2026-09-20')).toBeNull()
    expect(storeDayOwnerKey(null, '2026-09-20')).toBeNull()
  })

  it('refuses anything that is not an ISO date at the head — never a guessed day', () => {
    for (const day of ['20/09/2026', '2026-9-20', 'Sep 20 2026', '2026-09-20X', '٢٠٢٦-٠٩-٢٠'])
      expect(storeDayOwnerKey('P019', day), day).toBeNull()
  })
})

describe('slipDayOf — which counts open the drawer', () => {
  it('a known count opens its row’s own day, named as the grid names the store', () => {
    expect(slipDayOf(READY_DAY)).toEqual({
      ownerKey: 'P019/2026-09-20',
      store: 'PH-019',
      businessDate: '2026-09-20',
    })
  })

  it('a 0 opens too — that is where Add goes', () => {
    expect(slipDayOf(READY_DAY_NO_Z)?.ownerKey).toBe('P019/2026-09-24')
  })

  it('a null count is unknown and opens nothing', () => {
    expect(slipDayOf({ ...READY_DAY, slipCount: null })).toBeNull()
    expect(slipDayOf(READY_RECEIPT)).toBeNull()
  })

  it('a row with no businessDay has no owner, even with a count', () => {
    expect(slipDayOf({ ...READY_DAY, businessDay: null, slipCount: 1 })).toBeNull()
  })

  it('falls back to the store id when there is no store text', () => {
    expect(slipDayOf({ ...READY_DAY, storeText: '' })?.store).toBe('P019')
  })
})

/* ═══════════════════════ Add slip (ticket 322) ═══════════════════════ */

const file = (name: string, type: string, size = 1024) => new File([new Uint8Array(size)], name, { type })

describe('the slip form — POST AttachmentWeb/Upload, byte-identical since 322', () => {
  const row = { storeId: 'P019', businessDay: '2026-09-20T00:00:00' }
  const ownerKey = storeDayOwnerKey(row.storeId, row.businessDay)!
  const slip = file('ecr slip.jpg', 'image/jpeg')
  const form = attachmentUploadForm({ clientRequestId: 'id-1', file: slip }, slipTarget(ownerKey))

  it('carries exactly the six parts the contract names, and no SourceDevice', () => {
    expect([...form.keys()]).toEqual(['ClientRequestId', 'OwnerKind', 'OwnerKey', 'Category', 'Kind', 'File'])
    expect(form.has('SourceDevice')).toBe(false)
  })

  it('fills them from the contract’s constants and the day’s own owner key', () => {
    expect(form.get('ClientRequestId')).toBe('id-1')
    expect(form.get('OwnerKind')).toBe(STORE_DAY)
    expect(form.get('OwnerKey')).toBe('P019/2026-09-20')
    expect(form.get('OwnerKey')).toBe(ownerKey)
    expect(form.get('Category')).toBe(CASH_CLOSE)
    expect(form.get('Kind')).toBe(ECR_SLIP)
    expect([STORE_DAY, CASH_CLOSE, ECR_SLIP]).toEqual(['STORE_DAY', 'CASH_CLOSE', 'ECR_SLIP'])
  })

  it('sends the picked file itself, under its own name', () => {
    const part = form.get('File')
    expect(part).toBeInstanceOf(File)
    expect((part as File).name).toBe('ecr slip.jpg')
    expect((part as File).size).toBe(slip.size)
  })
})
