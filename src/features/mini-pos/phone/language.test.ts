import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PHONE_LOCALE_KEY, storedLanguage, switchLanguage } from './language'

// Review 4063 #9: the phone shares OMS's origin, so a key it shares with OMS flips the OMS portal too (Arabic, RTL).
// The phone keeps its language under its own key, and the pre-paint script reads that same key.
describe('the phone’s language is its own', () => {
  const store = new Map<string, string>()
  const reload = vi.fn()
  beforeEach(() => {
    store.clear()
    reload.mockClear()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
    vi.stubGlobal('window', { location: { reload } })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('a switch writes the phone’s key, never OMS’s `oms.locale`', () => {
    switchLanguage()
    expect(store.get(PHONE_LOCALE_KEY)).toBe('ar')
    expect(store.has('oms.locale')).toBe(false)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('OMS in Arabic does not make the phone Arabic', () => {
    store.set('oms.locale', 'ar')
    expect(storedLanguage()).toBe('en')
    store.set(PHONE_LOCALE_KEY, 'ar')
    expect(storedLanguage()).toBe('ar')
  })

  it('the phone’s pre-paint direction reads the phone’s key', () => {
    const html = readFileSync('minipos/index.html', 'utf8')
    expect(PHONE_LOCALE_KEY).not.toBe('oms.locale')
    expect(html).toContain(`localStorage.getItem('${PHONE_LOCALE_KEY}')`)
    expect(html).not.toContain("localStorage.getItem('oms.locale')")
  })
})
