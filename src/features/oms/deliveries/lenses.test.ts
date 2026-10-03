/**
 * Lenses and their counts (ticket 398, spec 380 L1, L2, L9; ruling 366): a lens is a predicate
 * over the LOADED rows, and its count says honestly what the loaded rows hold.
 */
import { describe, expect, it } from 'vitest'
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import en from '@/locales/en/deliveries.json'
import {
  isCut,
  LENS_IDS,
  lensCount,
  lensCounts,
  lensIsEmpty,
  lensMatches,
  rowPill,
  type CountWording,
  type LensId,
} from './lenses'

const row = (deliveryNo: string, over: Partial<DeliveryDocumentModel> = {}) =>
  ({ deliveryNo, failedJobsCount: 0, closeStatus: '', isExpressDelivery: false, rescheduled: false, ...over }) as DeliveryDocumentModel

/** One row per lens, one that matches two, and one that matches none but All. */
const FIXTURE = [
  row('plain'),
  row('failed', { failedJobsCount: 2 }),
  row('requested', { closeStatus: 'R' }),
  row('closed', { closeStatus: 'C' }),
  row('express', { isExpressDelivery: true }),
  row('moved', { rescheduled: true }),
  row('express-failed', { isExpressDelivery: true, failedJobsCount: 1 }),
  // The server sends nulls for unset fields: they match nothing.
  row('nulls', { failedJobsCount: null, closeStatus: null, isExpressDelivery: null, rescheduled: null } as never),
]

const matching = (lens: LensId) => FIXTURE.filter((r) => lensMatches(lens, r)).map((r) => r.deliveryNo)

/** The en bundle's wording for a count, as `t('lens.count.<key>', { count })` renders it. */
const words = (c: CountWording) =>
  (en.lens.count as Record<string, string>)[c.key].replace('{{count}}', c.key === 'none' ? '' : String(c.count))

describe('lensPredicatesMatchRowFields', () => {
  it('lists the five lenses in the rail order', () => {
    expect(LENS_IDS).toEqual(['all', 'attention', 'cancelRequested', 'dawaaNow', 'rescheduled'])
  })

  it('All matches every row', () => {
    expect(matching('all')).toEqual(FIXTURE.map((r) => r.deliveryNo))
  })

  it('Needs attention matches failedJobsCount > 0', () => {
    expect(matching('attention')).toEqual(['failed', 'express-failed'])
  })

  it("Cancellation requested matches closeStatus 'R' only, never a close", () => {
    expect(matching('cancelRequested')).toEqual(['requested'])
  })

  it('Dawaa Now matches isExpressDelivery', () => {
    expect(matching('dawaaNow')).toEqual(['express', 'express-failed'])
  })

  it('Rescheduled matches rescheduled', () => {
    expect(matching('rescheduled')).toEqual(['moved'])
  })
})

describe('lensCountsWording', () => {
  const loaded = { rows: FIXTURE, limit: 200 }

  it('before any search every count reads "—"', () => {
    const counts = lensCounts(null)
    for (const lens of LENS_IDS) {
      expect(counts[lens]).toEqual({ key: 'none' })
      expect(words(counts[lens])).toBe('—')
    }
  })

  it('a page under its limit counts each lens exactly', () => {
    const counts = lensCounts(loaded)
    expect(isCut(loaded)).toBe(false)
    expect(LENS_IDS.map((lens) => words(counts[lens]))).toEqual(['8', '2', '1', '2', '1'])
  })

  it('a full page (rows = Limit) reads "N+" on EVERY lens, a zero too', () => {
    const full = { rows: FIXTURE, limit: FIXTURE.length }
    expect(isCut(full)).toBe(true)
    const counts = lensCounts(full)
    expect(counts.all).toEqual({ key: 'atLeast', count: 8 })
    expect(LENS_IDS.map((lens) => words(counts[lens]))).toEqual(['8+', '2+', '1+', '2+', '1+'])
    expect(words(lensCount({ rows: [row('plain')], limit: 1 }, 'attention'))).toBe('0+')
  })

  it('an empty result counts 0, not "—"', () => {
    expect(words(lensCount({ rows: [], limit: 200 }, 'all'))).toBe('0')
  })

  it('column filters change no count: the pill says "N of M shown" instead', () => {
    const before = lensCounts(loaded)
    // The grid shows 1 of the 2 Needs attention rows once a column filter narrows it.
    const pill = rowPill(loaded, 'attention', { displayed: 1, columnFiltered: true })
    expect(lensCounts(loaded)).toEqual(before)
    expect(pill).toEqual({ key: 'shown', shown: 1, total: { key: 'exact', count: 2 } })
  })

  it('without column filters the pill is the lens total, "N+" when cut', () => {
    expect(rowPill(loaded, 'all', { displayed: 8, columnFiltered: false })).toEqual({
      key: 'rows',
      total: { key: 'exact', count: 8 },
    })
    const full = { rows: FIXTURE, limit: 8 }
    expect(rowPill(full, 'dawaaNow', { displayed: 2, columnFiltered: false })).toEqual({
      key: 'rows',
      total: { key: 'atLeast', count: 2 },
    })
  })

  it('there is no pill before a search', () => {
    expect(rowPill(null, 'all', { displayed: 0, columnFiltered: false })).toBeNull()
  })

  it('the lens empty state shows only when loaded rows exist and the lens matches none', () => {
    expect(lensIsEmpty(loaded, 'rescheduled')).toBe(false)
    expect(lensIsEmpty({ rows: [row('plain')], limit: 200 }, 'rescheduled')).toBe(true)
    expect(lensIsEmpty({ rows: [row('plain')], limit: 200 }, 'all')).toBe(false)
    // An empty search is "no deliveries match", not a lens problem; no search is neither.
    expect(lensIsEmpty({ rows: [], limit: 200 }, 'rescheduled')).toBe(false)
    expect(lensIsEmpty(null, 'rescheduled')).toBe(false)
  })
})
