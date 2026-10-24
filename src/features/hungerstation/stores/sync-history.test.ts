/**
 * Ticket 554 — a HungerStation store's pushes, a push's lines and a material's history (contract
 * § Stock sync, `GET …/Sync/{storeCode}/Logs`, `…/Logs/{logId}/Lines` and `…/Lines?material=`).
 * The pure half: the doors' paths and queries, how a line reads (a `null` the push did not send is
 * blank, never zero; an inactive line is marked), how a push reads, the 15-day wording and the
 * 200-line cap.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/hungerstation-stores.json'
import ar from '@/locales/ar/hungerstation-stores.json'
import type { HungerStationMaterialLine, HungerStationSyncLine } from '@/core/models/hungerstation'
import {
  cappedNotice,
  expiredNotice,
  historyRefusal,
  linesNotice,
  linesQuery,
  logsPath,
  materialLinesPath,
  pushReading,
  readLine,
  sheetFromParams,
  syncLinesPath,
  withSheet,
} from './sync-history'

const line = (over: Partial<HungerStationSyncLine> = {}): HungerStationSyncLine => ({
  materialNumber: '601624',
  active: true,
  quantity: 7,
  maximumSalesQuantity: 3,
  price: 18.95,
  currencyKey: 'SAR',
  sentAt: '2026-10-24T10:30:02',
  ...over,
})

const historyLine = (over: Partial<HungerStationMaterialLine> = {}): HungerStationMaterialLine => ({
  logId: '01JHS',
  syncType: 'D',
  status: 'S',
  sentAt: '2026-10-24T10:30:02',
  materialNumber: '601624',
  active: true,
  quantity: 7,
  maximumSalesQuantity: 3,
  price: 18.95,
  currencyKey: 'SAR',
  ...over,
})

const fill = (template: string, values: Record<string, string>) => template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => values[k] ?? `{{${k}}}`)

describe('the doors’ paths', () => {
  it('Logs, one push’s Lines and the material history, the store and push each one encoded segment', () => {
    expect(logsPath('1234')).toBe('HungerStationWeb/Sync/1234/Logs')
    expect(syncLinesPath('1234', '01J/X')).toBe('HungerStationWeb/Sync/1234/Logs/01J%2FX/Lines')
    expect(materialLinesPath('a/b')).toBe('HungerStationWeb/Sync/a%2Fb/Lines')
  })
})

describe('linesQuery — the Lines door’s query from the drawer’s filter', () => {
  it('page 1 with no material: skip 0, take 200, no material', () => {
    expect(linesQuery({ material: '', page: 1 })).toEqual({ material: null, skip: 0, take: 200 })
  })

  it('a material is trimmed and matched exactly; page 3 skips 400', () => {
    expect(linesQuery({ material: '  601624 ', page: 3 })).toEqual({ material: '601624', skip: 400, take: 200 })
  })
})

describe('readLine — how a line reads', () => {
  it('every value sent: active, the figures, and the price at 3 decimals with its currency', () => {
    expect(readLine(line())).toEqual({ active: 'active', quantity: '7', maximumSalesQuantity: '3', price: '18.950 SAR' })
  })

  it('a null the push did not send reads blank (null), never zero', () => {
    expect(readLine(line({ active: null, quantity: null, maximumSalesQuantity: null, price: null }))).toEqual({
      active: null,
      quantity: null,
      maximumSalesQuantity: null,
      price: null,
    })
  })

  it('a zero that WAS sent stays zero', () => {
    expect(readLine(line({ quantity: 0, maximumSalesQuantity: 0, price: 0 }))).toEqual({
      active: 'active',
      quantity: '0',
      maximumSalesQuantity: '0',
      price: '0.000 SAR',
    })
  })

  it('an inactive line is marked inactive', () => {
    expect(readLine(line({ active: false })).active).toBe('inactive')
  })

  it('figures are grouped', () => {
    expect(readLine(line({ quantity: 12500 })).quantity).toBe('12,500')
  })

  it('a material-history line reads the same way', () => {
    expect(readLine(historyLine({ price: null })).price).toBeNull()
  })
})

describe('pushReading — how a push reads', () => {
  it('S is success, E failed', () => {
    expect(pushReading({ status: 'S', endTime: '2026-10-24T10:30:04' })).toBe('success')
    expect(pushReading({ status: 'E', endTime: '2026-10-24T10:30:04' })).toBe('failed')
  })

  it('a push with no end yet is still running, never a failure', () => {
    expect(pushReading({ status: 'E', endTime: null })).toBe('running')
  })

  it('a history line (no end time in its shape) reads by its status', () => {
    expect(pushReading({ status: 'E' })).toBe('failed')
  })

  it('a status the contract does not name is never read as success', () => {
    expect(pushReading({ status: 'X' as 'S', endTime: '2026-10-24T10:30:04' })).toBe('failed')
  })
})

describe('linesNotice — the words that stand in for an empty table', () => {
  it('lines to show: no notice', () => {
    expect(linesNotice({ total: 812, filtered: false })).toBeNull()
  })

  it('a filtered read that matched nothing', () => {
    expect(linesNotice({ total: 0, filtered: true })).toBe('noMatch')
  })

  it('a push that sent no line', () => {
    expect(linesNotice({ total: 0, filtered: false })).toBe('noneSent')
  })
})

describe('historyRefusal — the refusals the drawers read in their own words', () => {
  it('DHS-00015 is the push gone (or older than the 15 days kept)', () => {
    expect(historyRefusal('DHS-00015')).toBe('expired')
  })

  it('DHS-00007 is a code with no store and no logs', () => {
    expect(historyRefusal('DHS-00007')).toBe('unknownStore')
  })

  it('anything else is not theirs', () => {
    expect(historyRefusal('HungerStationInputInvalid')).toBeNull()
    expect(historyRefusal(null)).toBeNull()
  })
})

describe('the 15-day wording', () => {
  it('names the days kept', () => {
    expect(expiredNotice()).toEqual({ key: 'lines.expired', days: '15' })
  })

  it.each([en, ar])('the sentence names the days through {{days}}', (locale) => {
    expect(locale.lines.expired).toMatch(/\{\{days\}\}/)
  })

  it('in English it says push detail is kept 15 days, never that nothing was sent', () => {
    const text = fill(en.lines.expired, { days: '15' })
    expect(text).toMatch(/kept for 15 days/)
    expect(text).not.toMatch(/nothing was sent|no lines/i)
  })
})

describe('the 200-line cap', () => {
  it('fewer than 200 lines: no notice', () => {
    expect(cappedNotice(Array.from({ length: 199 }, () => historyLine()))).toBeNull()
  })

  it('200 lines: the cap notice, naming the cap and the days', () => {
    expect(cappedNotice(Array.from({ length: 200 }, () => historyLine()))).toEqual({ key: 'material.capped', max: '200', days: '15' })
  })

  it.each([en, ar])('the sentence names the cap and the days', (locale) => {
    expect(locale.material.capped).toMatch(/\{\{max\}\}/)
    expect(locale.material.capped).toMatch(/\{\{days\}\}/)
  })

  it('in English it says only the newest 200 are shown', () => {
    expect(fill(en.material.capped, { max: '200', days: '15' })).toMatch(/newest 200/)
  })
})

describe('the drawer in the URL — a store code is enough to open its history', () => {
  it('?logs= opens the logs of that code, ?history= its material history', () => {
    expect(sheetFromParams(new URLSearchParams('logs=1234'))).toEqual({ kind: 'logs', storeCode: '1234' })
    expect(sheetFromParams(new URLSearchParams('chain=OlaCare&history=0450'))).toEqual({ kind: 'material', storeCode: '0450' })
  })

  it('none, or a blank code: no drawer', () => {
    expect(sheetFromParams(new URLSearchParams('chain=OlaCare'))).toBeNull()
    expect(sheetFromParams(new URLSearchParams('logs=%20'))).toBeNull()
  })

  it('withSheet writes one drawer and keeps the filters; null takes it off', () => {
    const base = new URLSearchParams('chain=OlaCare&history=0450')
    expect(withSheet(base, { kind: 'logs', storeCode: '1234' }).toString()).toBe('chain=OlaCare&logs=1234')
    expect(withSheet(base, null).toString()).toBe('chain=OlaCare')
    expect(base.toString()).toBe('chain=OlaCare&history=0450')
  })
})
