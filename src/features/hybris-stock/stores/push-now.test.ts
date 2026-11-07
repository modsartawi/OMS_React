import { describe, expect, it } from 'vitest'
import en from '@/locales/en/hybris-stock-stores.json'
import ar from '@/locales/ar/hybris-stock-stores.json'
import { PUSH_NOW_CODES, PUSH_NOW_REFUSALS, isErrorState, parseMaterials, pushNowRefusal, pushResult, refreshesList } from './push-now'

const at = (locale: unknown, key: string) => key.split('.').reduce<unknown>((n, p) => (n as Record<string, unknown> | undefined)?.[p], locale)

describe('pushNowRefusal', () => {
  it('maps every push-now code', () => {
    expect(pushNowRefusal('HybrisStockPushBusy')).toBe('busy')
    expect(pushNowRefusal('HYS-00009')).toBe('notMarked')
    expect(pushNowRefusal('HYS-00010')).toBe('railOff')
    expect(pushNowRefusal('HYS-00011')).toBe('sinkFailed')
    expect(pushNowRefusal('HYS-00004')).toBe('unknownMaterial')
  })

  it('leaves the rest to the dialog (the reason refusal, anything unknown)', () => {
    expect(pushNowRefusal('HYS-00001')).toBeNull()
    expect(pushNowRefusal(null)).toBeNull()
    expect(PUSH_NOW_CODES).not.toContain('HYS-00001')
  })

  it('409 busy is not an error state; the others are', () => {
    expect(isErrorState('busy')).toBe(false)
    expect(isErrorState('sinkFailed')).toBe(true)
    expect(isErrorState(null)).toBe(false)
  })

  it('a recorded failure or a changed store re-reads the list; busy does not', () => {
    expect(refreshesList('sinkFailed')).toBe(true)
    expect(refreshesList('notMarked')).toBe(true)
    expect(refreshesList('busy')).toBe(false)
  })

  it.each([en, ar])('busy says a push of this store is already running; every refusal has words', (locale) => {
    for (const k of PUSH_NOW_REFUSALS) {
      expect(typeof at(locale, `pushNow.refusal.${k}`)).toBe('string')
      expect(typeof at(locale, `pushNow.refusal.${k}Hint`)).toBe('string')
    }
  })

  it('the English busy message is the ticket\'s', () => {
    expect(String(at(en, 'pushNow.refusal.busy'))).toMatch(/a push of this store is already running/i)
    expect(String(at(en, 'pushNow.refusal.busyHint'))).toMatch(/try again shortly/i)
  })
})

describe('pushResult', () => {
  it('reads rows and status', () => {
    expect(pushResult({ rows: 4300, status: 'S' })).toEqual({ key: 'pushNow.result.S', rows: '4,300', ok: true })
    expect(pushResult({ rows: 0, status: 'E' }).ok).toBe(false)
    expect(pushResult({ rows: 1, status: 'Z' }).key).toBe('pushNow.result.other')
  })

  it.each([en, ar])('every result key exists', (locale) => {
    for (const s of ['S', 'E', 'R', 'other']) expect(typeof at(locale, `pushNow.result.${s}`)).toBe('string')
  })
})

describe('parseMaterials', () => {
  it('splits, de-duplicates and keeps order', () => {
    expect(parseMaterials('100002, 100003\n100002;100004  100005')).toEqual({ numbers: ['100002', '100003', '100004', '100005'], invalid: [] })
  })

  it('lists what is not a material number', () => {
    expect(parseMaterials('100002 ABC 12-3 ABC')).toEqual({ numbers: ['100002'], invalid: ['ABC', '12-3'] })
    expect(parseMaterials('   ')).toEqual({ numbers: [], invalid: [] })
  })
})
