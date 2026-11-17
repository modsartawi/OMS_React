import { describe, expect, it } from 'vitest'
import { MAP_REGION } from './map-panel'
import { createGoogleLoader, GOOGLE_LOAD_TIMEOUT_MS, GOOGLE_MAPS_VERSION, googleMapsUrl, type LoaderPage } from './google-loader'

// Ticket 908 (BackOffice spec 3630 M29, M35; ADR 0139): Google's script, fetched once per page when the first map is on
// screen. The page is a stand-in: the tests read the script tags asked for and play the browser's answers (the script's
// callback, its error, Google's `gm_authFailure`, the clock). No real script, no real key.

const KEY = 'planted-test-key'

function stagePage() {
  const scripts: { src: string; fail: () => void }[] = []
  const globals = new Map<string, unknown>()
  let mapsDefined = false
  let timers: { fn: () => void; ms: number; cleared: boolean }[] = []
  const page: LoaderPage = {
    addScript: (src, onError) => void scripts.push({ src, fail: onError }),
    setGlobal: (name, value) => void globals.set(name, value),
    mapsReady: () => mapsDefined,
    setTimeout: (fn, ms) => {
      const t = { fn, ms, cleared: false }
      timers.push(t)
      return t
    },
    clearTimeout: (handle) => {
      ;(handle as { cleared: boolean }).cleared = true
    },
  }
  return {
    page,
    scripts,
    /** Google's script arrived and called back. */
    answer: () => {
      mapsDefined = true
      ;(globals.get(scripts[scripts.length - 1].src.match(/callback=([^&]+)/)![1]) as () => void)()
    },
    /** Google's script ran (`google.maps` is defined) but its callback has not been called yet. */
    defineMaps: () => void (mapsDefined = true),
    /** Google refused the key or the page. */
    authFailure: () => (globals.get('gm_authFailure') as () => void)(),
    /** The clock runs past every pending timer. */
    elapse: () => {
      const due = timers.filter((t) => !t.cleared)
      timers = []
      for (const t of due) t.fn()
    },
    get timers() {
      return timers
    },
  }
}

/** A promise's state, read after the microtasks have run. */
async function settled<T>(p: Promise<T>): Promise<{ ok: T } | { failed: unknown } | 'pending'> {
  let out: { ok: T } | { failed: unknown } | 'pending' = 'pending'
  p.then(
    (ok) => (out = { ok }),
    (failed) => (out = { failed }),
  )
  await new Promise((r) => setTimeout(r, 0))
  return out
}

describe("the loader's address carries the key, region SA, the language and a pinned version, and nothing else of ours", () => {
  it('is Google’s Maps JavaScript address', () => {
    const url = new URL(googleMapsUrl({ key: KEY, lang: 'en', callback: 'cb' }))
    expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/js')
  })

  it('carries exactly: the key, the version, region SA, the language, async loading and the callback', () => {
    const url = new URL(googleMapsUrl({ key: KEY, lang: 'ar', callback: 'cb' }))
    expect([...url.searchParams.keys()].sort()).toEqual(['callback', 'key', 'language', 'loading', 'region', 'v'])
    expect(url.searchParams.get('key')).toBe(KEY)
    expect(url.searchParams.get('region')).toBe('SA')
    expect(url.searchParams.get('language')).toBe('ar')
    expect(url.searchParams.get('loading')).toBe('async')
    expect(url.searchParams.get('callback')).toBe('cb')
  })

  it('the language is the screen’s', () => {
    expect(new URL(googleMapsUrl({ key: KEY, lang: 'en', callback: 'cb' })).searchParams.get('language')).toBe('en')
  })

  it('the version is a numbered release, pinned: never `weekly`, `quarterly`, `beta` or `alpha`', () => {
    expect(GOOGLE_MAPS_VERSION).toMatch(/^3\.\d+$/)
    expect(new URL(googleMapsUrl({ key: KEY, lang: 'en', callback: 'cb' })).searchParams.get('v')).toBe(GOOGLE_MAPS_VERSION)
  })

  it('the region is the map panel’s one region, Saudi Arabia (review G8)', () => {
    expect(new URL(googleMapsUrl({ key: KEY, lang: 'en', callback: 'cb' })).searchParams.get('region')).toBe(MAP_REGION)
  })

  it('a key with characters an address reserves is carried intact', () => {
    expect(new URL(googleMapsUrl({ key: 'a&b=c d', lang: 'en', callback: 'cb' })).searchParams.get('key')).toBe('a&b=c d')
  })
})

describe('Google’s script is fetched once per page, only when a map asks', () => {
  it('nothing is fetched until the first map asks', () => {
    const p = stagePage()
    createGoogleLoader(p.page)
    expect(p.scripts).toHaveLength(0)
  })

  it('the first map adds one script tag; the next maps share it', async () => {
    const p = stagePage()
    const loader = createGoogleLoader(p.page)
    const first = loader.load(KEY, 'en')
    const second = loader.load(KEY, 'en')
    expect(p.scripts).toHaveLength(1)
    p.answer()
    expect(await settled(first)).toEqual({ ok: undefined })
    expect(await settled(second)).toEqual({ ok: undefined })
    expect(await settled(loader.load(KEY, 'en'))).toEqual({ ok: undefined })
    expect(p.scripts).toHaveLength(1)
  })

  it('a later map in the other language gets the page’s script as loaded: one script per page', () => {
    const p = stagePage()
    const loader = createGoogleLoader(p.page)
    void loader.load(KEY, 'ar')
    void loader.load(KEY, 'en')
    expect(p.scripts).toHaveLength(1)
    expect(new URL(p.scripts[0].src).searchParams.get('language')).toBe('ar')
  })
})

describe('a script that fails or does not arrive in time is "unreachable", once', () => {
  it('the script’s error: unreachable', async () => {
    const p = stagePage()
    const load = createGoogleLoader(p.page).load(KEY, 'en')
    p.scripts[0].fail()
    expect(await settled(load)).toEqual({ failed: 'unreachable' })
  })

  it('no answer within the time allowed: unreachable', async () => {
    const p = stagePage()
    const load = createGoogleLoader(p.page).load(KEY, 'en')
    expect(await settled(load)).toBe('pending')
    expect(p.timers.map((t) => t.ms)).toEqual([GOOGLE_LOAD_TIMEOUT_MS])
    p.elapse()
    expect(await settled(load)).toEqual({ failed: 'unreachable' })
  })

  it('an answer after the time ran out reaches the next map, with no second script (review G1)', async () => {
    const p = stagePage()
    const loader = createGoogleLoader(p.page)
    const load = loader.load(KEY, 'en')
    p.elapse()
    expect(await settled(load)).toEqual({ failed: 'unreachable' })
    p.answer()
    expect(await settled(loader.load(KEY, 'en'))).toEqual({ ok: undefined })
    expect(p.scripts).toHaveLength(1)
  })

  it('a map asking while the slow script is still on its way waits for it, with time of its own and no second script (review G1)', async () => {
    const p = stagePage()
    const loader = createGoogleLoader(p.page)
    void loader.load(KEY, 'en')
    p.elapse()
    const second = loader.load(KEY, 'en')
    expect(await settled(second)).toBe('pending')
    expect(p.scripts).toHaveLength(1)
    p.answer()
    expect(await settled(second)).toEqual({ ok: undefined })
  })

  it('Google defined when the time runs out is not unreachable: its callback was only late (review G1)', async () => {
    const p = stagePage()
    const load = createGoogleLoader(p.page).load(KEY, 'en')
    p.defineMaps()
    p.elapse()
    expect(await settled(load)).toEqual({ ok: undefined })
  })

  it('a script that failed is tried again by the next map, with the key it brings (review G1)', async () => {
    const p = stagePage()
    const loader = createGoogleLoader(p.page)
    const first = loader.load(KEY, 'en')
    p.scripts[0].fail()
    expect(await settled(first)).toEqual({ failed: 'unreachable' })
    const again = loader.load('another-test-key', 'en')
    expect(p.scripts).toHaveLength(2)
    expect(new URL(p.scripts[1].src).searchParams.get('key')).toBe('another-test-key')
    p.answer()
    expect(await settled(again)).toEqual({ ok: undefined })
  })

  it('an answer in time stops the clock', async () => {
    const p = stagePage()
    const load = createGoogleLoader(p.page).load(KEY, 'en')
    p.answer()
    expect(p.timers.every((t) => t.cleared)).toBe(true)
    expect(await settled(load)).toEqual({ ok: undefined })
  })
})

describe('Google’s auth failure is "refused", told to every map, even one opened after it', () => {
  it('the page listens for it before the script is asked for', () => {
    const p = stagePage()
    const loader = createGoogleLoader(p.page)
    const told: string[] = []
    loader.onRefused(() => told.push('refused'))
    void loader.load(KEY, 'en')
    p.answer()
    p.authFailure()
    expect(told).toEqual(['refused'])
  })

  it('every map listening is told; one that stopped listening is not', () => {
    const p = stagePage()
    const loader = createGoogleLoader(p.page)
    const told: string[] = []
    loader.onRefused(() => told.push('a'))
    const stop = loader.onRefused(() => told.push('b'))
    void loader.load(KEY, 'en')
    stop()
    p.authFailure()
    expect(told).toEqual(['a'])
  })

  it('a map that listens after the refusal is told at once: the key will not work for it either', () => {
    const p = stagePage()
    const loader = createGoogleLoader(p.page)
    void loader.load(KEY, 'en')
    p.authFailure()
    const told: string[] = []
    loader.onRefused(() => told.push('late'))
    expect(told).toEqual(['late'])
  })
})
