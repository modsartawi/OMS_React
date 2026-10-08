/**
 * Ticket 420 (origin filter) and ticket 439 (spec 2463: deleting a mistaken upload).
 *
 * Ticket 420 — the coupon template's origin filter takes the same paste box, normaliser and cap
 * as the bonus buy's (BackOffice spec 2396 story 39).
 */
import { describe, expect, it } from 'vitest'
import i18n from '@/core/i18n'
import { isTerminalJob, type CouponDetails, type CouponTransaction, type EarlierUpload, type ImportJobDeletePreview } from '@/core/models/coupons'
import { stripIsolates } from '@/core/util/bidi'
import {
  couponHistorySections,
  describeDeletePreview,
  jobActions,
  TEMPLATE_ORIGIN_FILTER_MAX,
  templateOriginFilterMeter,
} from './helpers'

describe('the template origin filter', () => {
  it('origin filter cap follows the shipped width', () => {
    // ⚠ 50 until BackOffice 2403 ships the 3000-character column: then TEMPLATE_ORIGIN_FILTER_MAX flips.
    expect(TEMPLATE_ORIGIN_FILTER_MAX).toBe(50)
    const ten = Array.from({ length: 10 }, (_, i) => String(1180 + i)).join('\r\n') + '\r\n' // 49 stored
    expect(templateOriginFilterMeter(ten)).toMatchObject({ count: 10, length: 49, max: 50, over: false })
    expect(templateOriginFilterMeter(ten + '11')).toMatchObject({ count: 11, length: 52, over: true })
  })

  it('a pasted column normalises to a comma list, case kept', () => {
    expect(templateOriginFilterMeter('c000\r\n1186\t1188').normalised).toBe('c000,1186,1188')
  })
})

// ── Ticket 439 (spec 2463): deleting a mistaken upload ──────────────────────────────────────

describe('jobActions', () => {
  it('offers Delete on Completed and Failed, and Retry only on Failed', () => {
    expect(jobActions('Completed')).toMatchObject({ retry: false, delete: true })
    expect(jobActions('Failed')).toMatchObject({ retry: true, delete: true })
  })

  it('offers neither on Deleted, Pending or Processing', () => {
    for (const status of ['Deleted', 'Pending', 'Processing'] as const) {
      expect(jobActions(status)).toMatchObject({ retry: false, delete: false })
    }
  })

  it('treats Deleted as terminal, so polling stops', () => {
    expect(isTerminalJob('Deleted')).toBe(true)
    expect(isTerminalJob('Processing')).toBe(false)
  })
})

describe('describeDeletePreview', () => {
  const t = i18n.getFixedT('en', 'coupons')
  const preview = (over: Partial<ImportJobDeletePreview>): ImportJobDeletePreview => ({
    jobId: 'J1',
    toDelete: 2904,
    redeemed: 3,
    redemptionCount: 4,
    inOtherTemplates: 12096,
    canDelete: true,
    refusalCode: null,
    refusalMessage: null,
    ...over,
  })
  const say = (p: ImportJobDeletePreview) => stripIsolates(describeDeletePreview(p, t))

  it('states the counts in plain language', () => {
    expect(say(preview({}))).toBe(
      'Deletes 2,904 coupons (3 already redeemed; their redemption history is kept). ' +
        '12,096 codes in this file belong to other templates and are not touched.',
    )
  })

  it('drops the redeemed clause when none were redeemed', () => {
    expect(say(preview({ redeemed: 0, redemptionCount: 0 }))).toBe(
      'Deletes 2,904 coupons. 12,096 codes in this file belong to other templates and are not touched.',
    )
  })

  it('drops the other-templates sentence when the file held none of theirs, and counts one as one', () => {
    expect(say(preview({ toDelete: 1, redeemed: 1, inOtherTemplates: 0 }))).toBe(
      'Deletes 1 coupon (1 already redeemed; their redemption history is kept).',
    )
    expect(say(preview({ inOtherTemplates: 1, redeemed: 0 }))).toBe(
      'Deletes 2,904 coupons. 1 code in this file belongs to another template and is not touched.',
    )
  })

  it('isolates each count, since the sentence reads right-to-left under Arabic', () => {
    expect(describeDeletePreview(preview({ redeemed: 0, inOtherTemplates: 0 }), t)).toContain('⁨2,904⁩')
  })
})

describe('couponHistorySections', () => {
  const txn = (id: string): CouponTransaction => ({
    transactionId: id,
    refTransactionId: '',
    couponCode: 'C1',
    redemptionType: 'Redeem',
    transactionReference: '',
    storeCode: 'P001',
    redemptionTime: '2026-10-01T10:00:00',
    userId: 'u',
    staffId: '',
    isSuccessful: true,
    errorMessage: '',
  })
  const upload = (deletedAt: string, ids: string[]): EarlierUpload => ({
    deletedAt,
    deletedBy: 'msartawi',
    reason: 'wrong file',
    templateId: 'OMS000000619',
    redeemCount: ids.length,
    transactions: ids.map(txn),
  })
  const details = (over: Partial<CouponDetails>): CouponDetails => ({
    instance: null,
    template: null,
    transactions: [],
    isDeleted: false,
    earlierUploads: [],
    ...over,
  })

  it('gives only the earlier-upload sections for a deleted code, in the order sent', () => {
    const a = upload('2026-10-02T09:00:00', ['T1'])
    const b = upload('2026-10-05T09:00:00', ['T2', 'T3'])
    expect(couponHistorySections(details({ isDeleted: true, earlierUploads: [a, b] }))).toEqual([
      { kind: 'earlier', upload: a },
      { kind: 'earlier', upload: b },
    ])
  })

  it('puts the current coupon first for a re-uploaded code, then the earlier ones', () => {
    const a = upload('2026-10-02T09:00:00', ['T1'])
    const current = [txn('T9')]
    expect(couponHistorySections(details({ transactions: current, earlierUploads: [a] }))).toEqual([
      { kind: 'current', transactions: current },
      { kind: 'earlier', upload: a },
    ])
  })

  it('never re-splits the ledger: a refund dated after the delete stays where the server put it', () => {
    const late: CouponTransaction = { ...txn('R1'), redemptionType: 'Refund', refTransactionId: 'T1', redemptionTime: '2026-10-09T10:00:00' }
    const a = { ...upload('2026-10-02T09:00:00', ['T1']), transactions: [txn('T1'), late] }
    const [, earlier] = couponHistorySections(details({ transactions: [txn('T9')], earlierUploads: [a] }))
    expect(earlier).toEqual({ kind: 'earlier', upload: a })
  })

  it('gives just the current section for an ordinary code', () => {
    expect(couponHistorySections(details({ transactions: [] }))).toEqual([{ kind: 'current', transactions: [] }])
  })
})

describe('the Arabic coupons strings (ticket 439)', () => {
  const ar = i18n.getFixedT('ar', 'coupons')
  const base: ImportJobDeletePreview = {
    jobId: 'J1', toDelete: 2, redeemed: 0, redemptionCount: 0, inOtherTemplates: 0,
    canDelete: true, refusalCode: null, refusalMessage: null,
  }

  it('states the preview in Arabic, with its own plural forms', () => {
    expect(stripIsolates(describeDeletePreview(base, ar))).toBe('يحذف قسيمتين.')
    expect(stripIsolates(describeDeletePreview({ ...base, toDelete: 5, inOtherTemplates: 1 }, ar))).toBe(
      'يحذف 5 قسائم. رمز واحد في هذا الملف يتبع قالبًا آخر ولن يُمس.',
    )
  })

  it('falls back to English for the older coupons keys the partial namespace does not carry', () => {
    expect(ar('import.jobs.title')).toBe('Import jobs')
    expect(ar('import.status.Deleted')).toBe('محذوفة')
  })
})
