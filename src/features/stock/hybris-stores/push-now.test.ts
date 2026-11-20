import { describe, expect, it } from 'vitest'
import en from '@/locales/en/hybris-stock-stores.json'
import ar from '@/locales/ar/hybris-stock-stores.json'
import { PUSH_NOW_CODES, PUSH_NOW_REFUSALS, isErrorState, materialsPushBlock, parseMaterials, pushNowRefusal, pushResult, refreshesList } from './push-now'

const at = (locale: unknown, key: string) => key.split('.').reduce<unknown>((n, p) => (n as Record<string, unknown> | undefined)?.[p], locale)

describe('pushNowRefusal', () => {
  it('maps every push-now code of the contract', () => {
    expect(pushNowRefusal('HYS-00030')).toBe('busy')
    expect(pushNowRefusal('HYS-00031')).toBe('notMarked')
    expect(pushNowRefusal('HYS-00034')).toBe('railOff')
    expect(pushNowRefusal('HYS-00032')).toBe('materialNotEnabled')
    expect(pushNowRefusal('HYS-00033')).toBe('selection')
  })

  it('leaves the rest to the dialog (the reason refusal, no such store, anything unknown, the guessed codes)', () => {
    expect(pushNowRefusal('HYS-00001')).toBeNull()
    expect(pushNowRefusal('HYS-00002')).toBeNull()
    expect(pushNowRefusal('HybrisStockPushBusy')).toBeNull()
    expect(pushNowRefusal('HYS-00011')).toBeNull()
    expect(pushNowRefusal(null)).toBeNull()
    expect(PUSH_NOW_CODES).not.toContain('HYS-00001')
  })

  it('409 busy is not an error state; the others are', () => {
    expect(isErrorState('busy')).toBe(false)
    expect(isErrorState('railOff')).toBe(true)
    expect(isErrorState(null)).toBe(false)
  })

  it('a store no longer marked re-reads the list; busy and rail off do not (nothing was recorded)', () => {
    expect(refreshesList('notMarked')).toBe(true)
    expect(refreshesList('busy')).toBe(false)
    expect(refreshesList('railOff')).toBe(false)
  })

  it.each([en, ar])('every refusal has words and a hint', (locale) => {
    for (const k of PUSH_NOW_REFUSALS) {
      expect(typeof at(locale, `pushNow.refusal.${k}`)).toBe('string')
      expect(typeof at(locale, `pushNow.refusal.${k}Hint`)).toBe('string')
    }
  })

  it("the English busy message is the ticket's", () => {
    expect(String(at(en, 'pushNow.refusal.busy'))).toMatch(/a push of this store is already running/i)
    expect(String(at(en, 'pushNow.refusal.busyHint'))).toMatch(/try again shortly/i)
  })
})

describe('pushResult', () => {
  it('reads rowsSent and the letter status of the answer', () => {
    expect(pushResult({ rowsSent: 4300, status: 'S' })).toEqual({ key: 'pushNow.result.S', rows: '4,300', ok: true, status: 'S' })
    expect(pushResult({ rowsSent: 0, status: 'E' })).toMatchObject({ ok: false, status: 'E' })
    expect(pushResult({ rowsSent: 1, status: 'sent' }).key).toBe('pushNow.result.other')
  })

  it.each([en, ar])('every result key exists', (locale) => {
    for (const s of ['S', 'E', 'R', 'other']) {
      expect(typeof at(locale, `pushNow.result.${s}`)).toBe('string')
      expect(typeof at(locale, `pushNow.toast.${s}`)).toBe('string')
    }
  })

  it('the toast of a delivered push says delivered to hot folder; a failed one never says delivered', () => {
    expect(String(at(en, 'pushNow.toast.S'))).toMatch(/delivered to hot folder/i)
    expect(String(at(en, 'pushNow.toast.E'))).not.toMatch(/delivered/i)
  })
})

describe('parseMaterials', () => {
  it('splits, de-duplicates and keeps order', () => {
    expect(parseMaterials('100002, 100003\n100002;100004  100005')).toEqual({ numbers: ['100002', '100003', '100004', '100005'], invalid: [] })
  })

  it('takes the contract material shape (letters, digits, . _ -; up to 30) and names the rest', () => {
    expect(parseMaterials('100002 AB-12.3_x 12/3 ' + 'X'.repeat(31))).toEqual({ numbers: ['100002', 'AB-12.3_x'], invalid: ['12/3', 'X'.repeat(31)] })
    expect(parseMaterials('   ')).toEqual({ numbers: [], invalid: [] })
  })
})

describe('materialsPushBlock', () => {
  it('nothing blocks a pick of 1–200 stores and 1–1,000 valid materials', () => {
    expect(materialsPushBlock(1, { numbers: ['1'], invalid: [] })).toBeNull()
    expect(materialsPushBlock(200, { numbers: Array.from({ length: 1000 }, (_, i) => String(i)), invalid: [] })).toBeNull()
  })

  it('names what is missing or over the door limit (HYS-00033)', () => {
    expect(materialsPushBlock(0, { numbers: ['1'], invalid: [] })).toBe('noStore')
    expect(materialsPushBlock(1, { numbers: [], invalid: [] })).toBe('noMaterial')
    expect(materialsPushBlock(1, { numbers: ['1'], invalid: ['?'] })).toBe('invalid')
    expect(materialsPushBlock(201, { numbers: ['1'], invalid: [] })).toBe('tooManyStores')
    expect(materialsPushBlock(1, { numbers: Array.from({ length: 1001 }, (_, i) => String(i)), invalid: [] })).toBe('tooManyMaterials')
  })
})
