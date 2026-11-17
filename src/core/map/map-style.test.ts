import { describe, expect, it } from 'vitest'
import { isBasemapUnreadable, isPainted } from './map-style'

// Ticket 879 review W5/W6: the MapLibre engine's own reads, moved out of the panel's tests by 908 (the panel now draws
// with Google, ADR 0139). MapLibre stays only for comparison until 911 removes it, with these tests.

describe('only the base-map file itself unread is "base map unreadable" (review W5)', () => {
  it('the file or its header not read: unreadable', () => {
    expect(isBasemapUnreadable({ sourceId: 'protomaps', error: new Error('404') })).toBe(true)
  })

  it('one tile failing is not: the rest of the map is drawn', () => {
    expect(isBasemapUnreadable({ sourceId: 'protomaps', tile: {}, error: new Error('timeout') })).toBe(false)
  })

  it('an error on another source is not', () => {
    expect(isBasemapUnreadable({ sourceId: 'points', error: new Error('x') })).toBe(false)
    expect(isBasemapUnreadable({ error: new Error('x') })).toBe(false)
  })
})

describe('an Arabic map is drawn only once its letters are shaped (review W6)', () => {
  const loaded = { tilesLoaded: true, basemapLoaded: true, pointsLoaded: true }

  it('on an Arabic screen, not before the text-shaping add-on has loaded', () => {
    for (const rtl of ['unavailable', 'deferred', 'requested', 'loading'] as const) expect(isPainted({ ...loaded, lang: 'ar', rtl })).toBe(false)
    expect(isPainted({ ...loaded, lang: 'ar', rtl: 'loaded' })).toBe(true)
  })

  it('an add-on that failed to load leaves the labels unshaped, not the map undrawn', () => {
    expect(isPainted({ ...loaded, lang: 'ar', rtl: 'error' })).toBe(true)
  })

  it('on an English screen the add-on is not waited for', () => {
    expect(isPainted({ ...loaded, lang: 'en', rtl: 'deferred' })).toBe(true)
  })

  it('never before the tiles and both sources are in', () => {
    expect(isPainted({ ...loaded, tilesLoaded: false, lang: 'en', rtl: 'loaded' })).toBe(false)
    expect(isPainted({ ...loaded, basemapLoaded: false, lang: 'en', rtl: 'loaded' })).toBe(false)
    expect(isPainted({ ...loaded, pointsLoaded: false, lang: 'ar', rtl: 'loaded' })).toBe(false)
  })
})
