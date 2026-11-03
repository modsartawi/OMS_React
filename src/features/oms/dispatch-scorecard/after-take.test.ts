import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  afterTakeKey,
  afterTakeReason,
  attemptText,
  attemptsSwept,
  itemText,
  itemsText,
  plainText,
  shortLineParts,
  showsAfterTake,
} from './after-take'

describe('which drills read what happened after the take', () => {
  it('the three spec 3326 figures and the failed-take rate do; the older figures do not', () => {
    expect(['failedTakes', 'failedTakeRate', 'fallbackCancels', 'refusedCloses'].map(showsAfterTake)).toEqual([true, true, true, true])
    expect(['won', 'ignoreRate', 'lostRaces', 'fallbacksReceived'].map(showsAfterTake)).toEqual([false, false, false, false])
  })
})

describe('what happened, in words', () => {
  it('an outcome names its key; nothing after the take yet (or a server before 3326) names none', () => {
    expect(afterTakeKey('CourierBlamedStore')).toBe('afterTake.CourierBlamedStore')
    expect(afterTakeKey('')).toBeNull()
    expect(afterTakeKey(undefined)).toBeNull()
  })
})

describe('the reason, exactly as given', () => {
  it("the courier's Arabic text comes back as sent, untouched", () => {
    const text = 'الطلب غير موجود في الفرع '
    expect(afterTakeReason({ afterTakeOutcome: 'CourierBlamedStore', afterTakeReason: text, afterTakeCourier: 'alshrouqexpress' })).toEqual({
      kind: 'text',
      text,
    })
  })
  it('a courier cancel with no reason reads "no reason given"', () => {
    expect(afterTakeReason({ afterTakeOutcome: 'CourierNoReason', afterTakeReason: '', afterTakeCourier: 'alshrouqexpress' })).toEqual({ kind: 'noReason' })
    expect(afterTakeReason({ afterTakeOutcome: 'CourierOtherReason', afterTakeReason: '  ', afterTakeCourier: '' })).toEqual({ kind: 'noReason' })
  })
  it('a store close with no note, or no outcome at all, has no reason to show', () => {
    expect(afterTakeReason({ afterTakeOutcome: 'StoreClosed', afterTakeReason: '', afterTakeCourier: '' })).toEqual({ kind: 'none' })
    expect(afterTakeReason({})).toEqual({ kind: 'none' })
  })
})

describe('items', () => {
  it('each item reads code · quantity unit, one value isolated whole', () => {
    expect(itemText({ itemNumber: '100234', quantity: 2, uom: 'EA' })).toBe('100234 · 2 EA')
    expect(itemText({ itemNumber: '100235', quantity: 1.5, uom: '' })).toBe('100235 · 1.5')
  })
  it('the export joins them into one cell; none reads the dash', () => {
    expect(
      itemsText(
        [
          { itemNumber: '100234', quantity: 2, uom: 'EA' },
          { itemNumber: '100235', quantity: 1, uom: 'PAC' },
        ],
        '—',
      ),
    ).toBe('100234 · 2 EA; 100235 · 1 PAC')
    expect(itemsText([], '—')).toBe('—')
    expect(itemsText(undefined, '—')).toBe('—')
  })
})

describe('a short line at offer', () => {
  it('reads the material, what was needed and what was on record', () => {
    expect(shortLineParts({ line: 1, material: '100234', quantity: 2, uom: 'EA', neededBase: 20, availableBase: 4 })).toEqual({
      material: '100234',
      needed: '20',
      available: '4',
    })
  })
  it('no stock row on record is null, never 0', () => {
    expect(shortLineParts({ line: 2, material: '100235', quantity: 1, uom: 'EA', neededBase: 1, availableBase: null }).available).toBeNull()
  })
})

describe('refused close attempts', () => {
  it('an attempt reads time · who · till · reason, as one line', () => {
    expect(attemptText({ at: '2026-10-30T08:15:00', closedBy: 'P001-ph01', register: '02', reason: 'لا يوجد' }, '—')).toBe(
      '2026-10-30 08:15 · P001-ph01 · 02 · لا يوجد',
    )
    expect(attemptText({ at: '2026-10-30T08:15:00', closedBy: 'P001-ph01', register: '', reason: '' }, '—')).toBe('2026-10-30 08:15 · P001-ph01 · — · —')
  })
  it('a refused-closes row with no attempts left (swept after 6 months) shows the note; any other figure never does', () => {
    expect(attemptsSwept('refusedCloses', { refusedAttempts: [] })).toBe(true)
    expect(attemptsSwept('refusedCloses', {})).toBe(true)
    expect(attemptsSwept('refusedCloses', { refusedAttempts: [{ at: '2026-10-30T08:15:00', closedBy: 'x', register: '01', reason: '' }] })).toBe(false)
    expect(attemptsSwept('failedTakes', { refusedAttempts: [] })).toBe(false)
  })
})

describe('a tagged sentence as plain text (the export)', () => {
  it('drops the slot tags and keeps the words', () => {
    expect(plainText('<m>100234</m>: needed <n>20</n>, on record <a>4</a>')).toBe('100234: needed 20, on record 4')
  })
})

describe('the words never conclude "no stock"', () => {
  const read = (lng: string) => JSON.parse(readFileSync(`src/locales/${lng}/dispatch-scorecard.json`, 'utf8'))
  it.each(['en', 'ar'])('%s: every after-take label exists and none says no stock', (lng) => {
    const ns = read(lng)
    for (const k of ['StoreClosed', 'CourierBlamedStore', 'FallbackStoreClosed', 'CourierOtherReason', 'CourierNoReason', 'OtherClose'])
      expect(ns.afterTake[k], k).toBeTruthy()
    for (const k of ['takenBy', 'closedBy', 'closedAt', 'afterTake', 'reason', 'courier', 'items', 'refusedAttempts'])
      expect(ns.drill.column[k], k).toBeTruthy()
    for (const k of ['noReason', 'notOnRecord', 'shortLine', 'attemptsSwept']) expect(ns.drill[k], k).toBeTruthy()
    expect(ns.class.FallbackCancel).toBeTruthy()
    const words = JSON.stringify([ns.afterTake, ns.drill.noReason, ns.drill.notOnRecord, ns.drill.shortLine, ns.drill.attemptsSwept])
    expect(words).not.toMatch(/no stock|out of stock|not in stock|لا يوجد مخزون|نفد|نفاد|غير متوفر/i)
  })
})
