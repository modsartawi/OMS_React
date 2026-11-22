/** oms 952 (BackOffice spec 4182 §D): the page help drawer's open state — Escape closes it, and it never opens over a dialog. */
import { describe, expect, it } from 'vitest'
import { createPageHelp, hasPageHelp, helpDrawerSide } from './page-help'

describe('the page help drawer', () => {
  it('opens on "?", and closes with Escape (another key leaves it open)', () => {
    const store = createPageHelp(() => false)
    expect(store.getState().open).toBe(false)
    store.getState().openHelp()
    expect(store.getState().open).toBe(true)
    store.getState().pressKey('Enter')
    expect(store.getState().open).toBe(true)
    store.getState().pressKey('Escape')
    expect(store.getState().open).toBe(false)
  })

  it('never opens while another dialog is open, so it takes no focus from it', () => {
    let dialogOpen = true
    const store = createPageHelp(() => dialogOpen)
    expect(store.getState().openHelp()).toBe(false)
    expect(store.getState().open).toBe(false)
    dialogOpen = false
    expect(store.getState().openHelp()).toBe(true)
    expect(store.getState().open).toBe(true)
  })

  it('docks on the right in English and on the left in Arabic', () => {
    expect(helpDrawerSide('en')).toBe('right')
    expect(helpDrawerSide('ar')).toBe('left')
  })

  it('is offered on every analytics page, and nowhere else (the help center has none)', () => {
    for (const p of ['/analytics', '/analytics/board/42', '/analytics/price-command-center', '/analytics/itemlist/7', '/analytics/catalog'])
      expect([p, hasPageHelp(p)]).toEqual([p, true])
    for (const p of ['/analytics/help', '/analytics/help/boards', '/deliveries', '/analyticsx'])
      expect([p, hasPageHelp(p)]).toEqual([p, false])
  })
})
