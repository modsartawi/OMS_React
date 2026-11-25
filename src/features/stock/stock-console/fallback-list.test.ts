/**
 * BackOffice 4277 (spec 4275 "What head office sees", ADR 0146): inventory control's list of a store's expiry fallback
 * takes — `/stock/console/fallback`, a console page behind the console's one grant. It reads nothing until Read; a store,
 * a first day and at most 32 days (both in) are checked before anything is asked.
 */
import { describe, expect, it } from 'vitest'
import { canOpenStockConsole } from './access'
import { CONSOLE_PAGES, consolePageActive } from './console-pages'
import {
  FALLBACK_LIST_PAGE,
  FALLBACK_MOST_DAYS,
  fallbackListFromParams,
  fallbackListRead,
  fallbackListToParams,
  fallbackTakesHref,
} from './fallback-list'

const TODAY = '2026-11-25'
const read = (qs: string) => fallbackListRead(fallbackListFromParams(new URLSearchParams(qs)), TODAY)

describe('the page and its grant', () => {
  it('is a console page, between Find and Feeds and switches, lit on its own address only', () => {
    expect(CONSOLE_PAGES.map((p) => p.key)).toEqual(['stores', 'find', 'fallback', 'fleet'])
    expect(FALLBACK_LIST_PAGE).toEqual({ to: '/stock/console/fallback', key: 'fallback' })
    expect(consolePageActive(FALLBACK_LIST_PAGE, '/stock/console/fallback')).toBe(true)
    expect(consolePageActive(FALLBACK_LIST_PAGE, '/stock/console')).toBe(false)
  })

  it('🚩 opens on the stock console’s own grant (StockConsole:03) and fails closed without it', () => {
    const holding = (keys: string[]) => ({ has: (k: string) => keys.includes(k) }) as Parameters<typeof canOpenStockConsole>[0]
    expect(canOpenStockConsole(holding(['StockConsole:03']))).toBe(true)
    expect(canOpenStockConsole(holding(['StoreStage:03', 'HeldStockReport:03']))).toBe(false)
    expect(canOpenStockConsole(holding([]))).toBe(false)
  })
})

describe('what the list reads', () => {
  it('nothing until Read was pressed', () => {
    expect(read('store=P077&from=2026-11-20')).toEqual({ kind: 'nothing' })
  })

  it('a store and its days; the last day is the first when none is given', () => {
    expect(read('ran=1&store=p077&from=2026-11-20&to=2026-11-25')).toEqual({
      kind: 'read',
      store: 'P077',
      from: '2026-11-20',
      to: '2026-11-25',
    })
    expect(read('ran=1&store=P077&from=2026-11-24')).toEqual({ kind: 'read', store: 'P077', from: '2026-11-24', to: '2026-11-24' })
  })

  it('stops without a store, without a first day, on a reversed range and past 32 days — asking nothing', () => {
    expect(read('ran=1&from=2026-11-24')).toEqual({ kind: 'stopped', problem: 'store' })
    expect(read('ran=1&store=P077')).toEqual({ kind: 'stopped', problem: 'from' })
    expect(read('ran=1&store=P077&from=2026-11-24&to=2026-11-23')).toEqual({ kind: 'stopped', problem: 'reversed' })
    expect(read('ran=1&store=P077&from=2026-10-01&to=2026-11-02')).toEqual({ kind: 'stopped', problem: 'tooLong' })
    expect(read('ran=1&store=P077&from=2026-10-01&to=2026-11-01').kind).toBe('read')
    expect(FALLBACK_MOST_DAYS).toBe(32)
  })

  it('a day after today is stopped: no take has happened yet', () => {
    expect(read('ran=1&store=P077&from=2026-11-25&to=2026-11-26')).toEqual({ kind: 'stopped', problem: 'outOfBounds' })
  })
})

describe('its address', () => {
  it('round-trips the store, the days and the Read', () => {
    const state = { store: 'P077', from: '2026-11-20', to: '2026-11-25', ran: true }
    expect(fallbackListFromParams(fallbackListToParams(state))).toEqual(state)
    expect(fallbackListToParams({ store: '', from: '', to: '', ran: false }).toString()).toBe('')
  })

  it('a store’s link opens the list on it, read for its days', () => {
    expect(fallbackTakesHref('P077', '2026-11-20', '2026-11-25')).toBe(
      '/stock/console/fallback?store=P077&from=2026-11-20&to=2026-11-25&ran=1',
    )
  })
})
