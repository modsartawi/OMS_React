import { describe, expect, it } from 'vitest'
import { CONSOLE_PAGES, consolePageActive } from './console-pages'

describe('the stock console’s top links', () => {
  it('Stores is the first link, at the console’s own address', () => {
    expect(CONSOLE_PAGES[0]).toEqual({ to: '/stock/console', key: 'stores' })
  })

  it('Stores is lit on the list and on every store’s and item’s page', () => {
    const stores = CONSOLE_PAGES[0]
    for (const path of ['/stock/console', '/stock/console/', '/stock/console/store/P077', '/stock/console/store/P077/item/1001'])
      expect([path, consolePageActive(stores, path)]).toEqual([path, true])
  })

  it('Stores is not lit on the console’s other pages, nor on another screen that shares its start', () => {
    const stores = CONSOLE_PAGES[0]
    for (const path of ['/stock/console/find', '/stock/console/fleet', '/stock/consoles', '/stock/health'])
      expect([path, consolePageActive(stores, path)]).toEqual([path, false])
  })
})

describe('Feeds and switches (942)', () => {
  it('is the last link, lit on its own address only', () => {
    const fleet = CONSOLE_PAGES[CONSOLE_PAGES.length - 1]
    expect(fleet).toEqual({ to: '/stock/console/fleet', key: 'fleet' })
    expect(consolePageActive(fleet, '/stock/console/fleet')).toBe(true)
    expect(consolePageActive(fleet, '/stock/console')).toBe(false)
    expect(consolePageActive(fleet, '/stock/console/store/P077')).toBe(false)
  })
})

describe('Find an item or a batch (943)', () => {
  it('sits between Stores and Feeds and switches, lit on its own address only', () => {
    // BackOffice 4277 puts the expiry fallback list between Find and Feeds and switches.
    expect(CONSOLE_PAGES.map((p) => p.key)).toEqual(['stores', 'find', 'fallback', 'fleet'])
    const find = CONSOLE_PAGES[1]
    expect(find).toEqual({ to: '/stock/console/find', key: 'find' })
    expect(consolePageActive(find, '/stock/console/find')).toBe(true)
    expect(consolePageActive(find, '/stock/console')).toBe(false)
    expect(consolePageActive(find, '/stock/console/store/P077/item/1001')).toBe(false)
  })
})
