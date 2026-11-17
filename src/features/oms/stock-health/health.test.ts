import { describe, expect, it } from 'vitest'
import i18next from 'i18next'
import type { StockHealthSignal } from '@/core/models/stock-health'
import { stripIsolates } from '@/core/util/bidi'
import en from '@/locales/en/stock-health.json'
import ar from '@/locales/ar/stock-health.json'
import { REFRESH_MS, asOf, figureLabel, figureText, figuresShown, headerLine, reasonText, tileHref, verdictTone } from './health'

const signal = (key: string, verdict: string | null, extra: Partial<StockHealthSignal> = {}): StockHealthSignal => ({
  key,
  verdict,
  reason: `${key} ${verdict}`,
  figures: [],
  readAt: '2026-11-17T10:00:00',
  link: null,
  ...extra,
})

describe('the header line', () => {
  it('the header reads All good only when every judged signal is good (null verdicts are not judged)', () => {
    expect(headerLine([signal('feeds', 'good'), signal('holdSeamTills', null), signal('storeStages', null)])).toEqual({
      kind: 'allGood',
      count: 0,
    })
    expect(headerLine([signal('feeds', 'good'), signal('batchWorker', 'watch'), signal('storeStages', null)])).toEqual({
      kind: 'attention',
      count: 1,
    })
  })
})

describe('the header counts every judged signal that is not good', () => {
  it('watch, bad and noAnswer each need attention; an empty answer is not "All good"', () => {
    expect(
      headerLine([signal('feeds', 'bad'), signal('batchWorker', 'noAnswer'), signal('salePush', 'watch'), signal('takeDoor', 'good')]),
    ).toEqual({ kind: 'attention', count: 3 })
    expect(headerLine([])).toEqual({ kind: 'empty', count: 0 })
  })

  it('a verdict this page does not know is not taken for good', () => {
    expect(headerLine([signal('feeds', 'stale')])).toEqual({ kind: 'attention', count: 1 })
  })
})

describe('verdict to tone', () => {
  it('good green, watch amber, bad red, null neutral', () => {
    expect(verdictTone('good')).toBe('good')
    expect(verdictTone('watch')).toBe('watch')
    expect(verdictTone('bad')).toBe('bad')
    expect(verdictTone(null)).toBe('neutral')
  })

  it('noAnswer draws as did-not-answer, never as neutral', () => {
    expect(verdictTone('noAnswer')).toBe('noAnswer')
  })

  it('a verdict this page does not know draws as watch, never as good or neutral', () => {
    expect(verdictTone('stale')).toBe('watch')
  })
})

/** A real i18next over the shipped locale files, the way `core/i18n.ts` sets it up. */
function translator(lng: 'en' | 'ar') {
  const i18n = i18next.createInstance()
  void i18n.init({
    lng,
    fallbackLng: 'en',
    initAsync: false,
    resources: { en: { 'stock-health': en }, ar: { 'stock-health': ar } },
    interpolation: { escapeValue: false },
  })
  return i18n.getFixedT(lng, 'stock-health')
}

const takeDoorBad = signal('takeDoor', 'bad', {
  reason: '7 of 120 take(s) failed at the door today (5.83%).',
  figures: [
    { label: 'Takes today', value: 120 },
    { label: 'Failed', value: 7 },
    { label: 'Skipped at the time limit', value: 0 },
  ],
  link: 'oms/held-stock-report/gates',
})

describe('the reason line', () => {
  it("in English it is the server's own line", () => {
    expect(reasonText(translator('en'), takeDoorBad)).toBe('7 of 120 take(s) failed at the door today (5.83%).')
  })

  it('an AR reason is picked by key and verdict, with the figures interpolated', () => {
    const text = stripIsolates(reasonText(translator('ar'), takeDoorBad))
    expect(text).toBe('فشلت 7 من 120 عملية أخذ عند الباب اليوم.')
    const good = stripIsolates(reasonText(translator('ar'), { ...takeDoorBad, verdict: 'good' }))
    expect(good).toBe('لم تفشل أي عملية أخذ عند الباب اليوم.')
  })

  it('a figure-only signal is keyed as none, and a time figure keeps its wall-clock', () => {
    const tills = signal('holdSeamTills', null, {
      figures: [
        { label: 'Tills heard in the last hour', value: 42 },
        { label: 'Stores heard in the last hour', value: 17 },
      ],
    })
    expect(stripIsolates(reasonText(translator('ar'), tills))).toBe('سُمع 42 جهاز نقطة بيع في 17 فرعًا على وصلة الحجز خلال الساعة الأخيرة.')
    const count = signal('hourlyCount', 'bad', {
      figures: [
        { label: 'Last run', value: '2026-11-17T09:00:12' },
        { label: 'Last good run', value: '2026-11-17T01:00:05' },
        { label: 'Open differences', value: 0 },
      ],
    })
    expect(stripIsolates(reasonText(translator('ar'), count))).toContain('2026-11-17 01:00:05')
  })

  it('a no-answer reason in Arabic still names the source that failed, isolated', () => {
    const dead = signal('feeds', 'noAnswer', { reason: "Stock Visibility's Stock/FeedStatus did not answer: it timed out.", readAt: null })
    const text = reasonText(translator('ar'), dead)
    expect(stripIsolates(text)).toBe("لم يُجب مصدر هذه الإشارة: Stock Visibility's Stock/FeedStatus did not answer: it timed out.")
    expect(text).not.toBe(stripIsolates(text))
  })

  it("a key or verdict the Arabic file does not hold falls back to the server's English line", () => {
    const later = signal('somethingNew', 'watch', { reason: 'A later signal.' })
    expect(reasonText(translator('ar'), later)).toBe('A later signal.')
  })
})

describe('the figures', () => {
  it('a value reads as sent: a number as is, a time without its T and never shifted, a missing one as a dash', () => {
    expect(figureText(12.5)).toBe('12.5')
    expect(figureText('98.5%')).toBe('98.5%')
    expect(figureText('2026-11-17T23:59:59')).toBe('2026-11-17 23:59:59')
    expect(figureText(null)).toBe('—')
  })

  it('an AR label is keyed by the signal key and the English label; an unknown label stays English', () => {
    expect(figureLabel(translator('ar'), 'takeDoor', 'Failed')).toBe('فشلت')
    expect(figureLabel(translator('ar'), 'takeDoor', 'Something new')).toBe('Something new')
    expect(figureLabel(translator('en'), 'takeDoor', 'Failed')).toBe('Failed')
  })
})

describe('the tile', () => {
  it('shows at most five figures, in the order sent, so the stuck-seeding count shows', () => {
    const stages = signal('storeStages', null, {
      figures: ['Shadow', 'Seeding', 'Seeded', 'Blocking', 'Seeding over 24 hours', 'A sixth'].map((label, i) => ({ label, value: i })),
    })
    expect(figuresShown(stages).map((f) => f.label)).toEqual(['Shadow', 'Seeding', 'Seeded', 'Blocking', 'Seeding over 24 hours'])
    expect(figuresShown(signal('feeds', 'noAnswer'))).toEqual([])
  })

  it('opens its link as an app route, and only an app route', () => {
    expect(tileHref('oms/store-stages')).toBe('/oms/store-stages')
    expect(tileHref('/oms/held-stock-report/gates')).toBe('/oms/held-stock-report/gates')
    expect(tileHref(null)).toBeNull()
    expect(tileHref('  ')).toBeNull()
    expect(tileHref('https://example.com/x')).toBeNull()
    expect(tileHref('//example.com/x')).toBeNull()
    expect(tileHref('javascript:alert(1)')).toBeNull()
  })
})

describe('the refresh', () => {
  it('re-reads every 60 seconds', () => {
    expect(REFRESH_MS).toBe(60_000)
  })

  it('"as of" is the server wall-clock as sent, never shifted', () => {
    expect(asOf('2026-11-17T00:30:05')).toBe('2026-11-17 00:30:05')
    expect(asOf('')).toBe('')
  })
})

describe('S8, the DRS queue (BackOffice 3993, review fixes b9f6b3403)', () => {
  const figures = [
    { label: 'Unsent', value: 7 },
    { label: 'Oldest unsent (minutes)', value: 22.5 },
    { label: 'Failed, waiting to retry', value: 2 },
    { label: 'Last sent', value: '2026-11-17T10:41:00' },
    { label: 'Last heartbeat', value: '2026-11-17T10:42:30' },
  ]

  it('null reads "DRS holds are off", with no heartbeat ever and with every instance switched off', () => {
    const never = signal('drsQueue', null, { reason: "DRS holds are off: DRS has never sent its queue's heartbeat." })
    expect(stripIsolates(reasonText(translator('ar'), never))).toBe('حجوزات DRS متوقفة.')
    const off = signal('drsQueue', null, { reason: 'DRS holds are off: DRSWEB01, DRSWEB02 said so in its last heartbeat.', figures })
    expect(stripIsolates(reasonText(translator('ar'), off))).toBe('حجوزات DRS متوقفة.')
  })

  it('watch puts the queue totals into the Arabic line and keeps the server line, which names the instance', () => {
    const reason = 'DRS DRSWEB02: 7 call(s) wait in its queue to SIS.Api, the oldest for 22 minutes; 2 failed and wait to retry.'
    const watch = signal('drsQueue', 'watch', { figures, reason })
    expect(stripIsolates(reasonText(translator('ar'), watch))).toBe(
      `ينتظر 7 طلب في طابور DRS إلى SIS.Api، أقدمها منذ 22.5 دقيقة؛ فشل 2 وينتظر إعادة المحاولة. (${reason})`,
    )
  })

  it('bad keeps the server line too, so the silent or slow instance is named', () => {
    const reason = 'DRS DRSWEB01 has sent no heartbeat for 40 minutes with its holds on (bad at 15): its queue to SIS.Api is not known.'
    const bad = stripIsolates(reasonText(translator('ar'), signal('drsQueue', 'bad', { figures, reason })))
    expect(bad).toContain('DRSWEB01')
    expect(bad).toContain('2026-11-17 10:42:30')
  })

  it('every shipped figure label has its Arabic', () => {
    for (const f of figures) expect(figureLabel(translator('ar'), 'drsQueue', f.label)).not.toBe(f.label)
  })
})
