import { MAP_REGION, type MapLang } from './map-panel'

/**
 * Google's Maps JavaScript loader (ticket 908, BackOffice spec 3630 M29, M35; ADR 0139): one script tag per page, added
 * when the first map is on screen, never before. Our own small loader rather than `@googlemaps/js-api-loader`: the
 * address is the whole contract, so it is built here and read by the tests.
 *
 * - The key is the model's (`maps.key`, BackOffice 3986): never in this code, the build or a `.env` file.
 * - `region=SA` (KSA's borders, "Arabian Gulf"), `language` the screen's, the version pinned to a numbered release.
 * - Google's script is loaded once per page in one language: a map asked for later in the other language gets the
 *   page's script as loaded. The app does not switch a screen's language under a drawn map (the language is set at sign-in,
 *   and the print pages set theirs before any map is on screen), so the next page load draws in the new language.
 * - "Unreachable": the script failed, or did not call back within {@link GOOGLE_LOAD_TIMEOUT_MS}. Neither is kept for
 *   the page's life (review G1): a script that is only slow still reaches the next map when it arrives, a map asking
 *   while it is on its way waits for it with time of its own (never a second tag beside a live one: Google refuses to be
 *   loaded twice), and a script that FAILED is asked for again by the next map, with the key that map brings.
 * - "Refused": Google called `gm_authFailure` (the key or the referrer refused, the API not enabled, billing off, the
 *   quota spent). Kept for the page's life: Google's script, once run, holds the key it was loaded with and cannot be
 *   loaded again, so a key changed on the server reaches Google on the next page load (the print worker's every render
 *   is one).
 */

/**
 * Google's numbered release the map is drawn with: pinned, not `weekly`, so a Google release never changes the map
 * under a printed report unannounced. On 2026-11-17 Google served `quarterly` = 3.65, `weekly` = 3.66, beta = 3.67;
 * 3.66 is pinned because it becomes the next quarterly and so stays live longest. ⚠ A retired number is not refused:
 * Google serves its `weekly` in its place (3.62 was answered with 3.66.13d), so the pin is moved forward on purpose,
 * a few times a year, before it retires.
 */
export const GOOGLE_MAPS_VERSION = '3.66'

/** How long Google's script may take to arrive and call back. Inside the print page's 20 seconds (M38). */
export const GOOGLE_LOAD_TIMEOUT_MS = 15_000

const SCRIPT_ORIGIN = 'https://maps.googleapis.com/maps/api/js'

/** The global Google's script calls back when it is ready. */
const READY_CALLBACK = '__omsGoogleMapsReady'

/** The global Google calls when it refuses the key or the page. Google's own name. */
const AUTH_FAILURE = 'gm_authFailure'

/** Google's script address: the key, the pinned version, region SA, the language, async loading and the callback. */
export function googleMapsUrl(p: { key: string; lang: MapLang; callback: string }): string {
  const q = new URLSearchParams({ key: p.key, v: GOOGLE_MAPS_VERSION, region: MAP_REGION, language: p.lang, loading: 'async', callback: p.callback })
  return `${SCRIPT_ORIGIN}?${q.toString()}`
}

/** The page, as the loader touches it (a stand-in in the tests, {@link browserPage} in the browser). */
export interface LoaderPage {
  addScript(src: string, onError: () => void): void
  setGlobal(name: string, value: unknown): void
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
  /** Whether Google's script has run (`google.maps` is defined), whether or not it has called back yet. */
  mapsReady(): boolean
}

export type LoadFailure = 'unreachable'

export interface GoogleLoader {
  /**
   * Resolves when Google's script is ready; rejects with `'unreachable'` when it fails, or does not arrive within the
   * time allowed this call. The first call adds the script tag; a call after a failed script adds another.
   */
  load(key: string, lang: MapLang): Promise<void>
  /** Calls `listener` when Google refuses the key or the page; at once when it already has. Returns how to stop. */
  onRefused(listener: () => void): () => void
}

export function createGoogleLoader(page: LoaderPage, timeoutMs = GOOGLE_LOAD_TIMEOUT_MS): GoogleLoader {
  // The page's script: none yet, on its way, run, or failed (then the next map asks again).
  let script: 'none' | 'loading' | 'ready' | 'failed' = 'none'
  // The maps waiting on the script on its way, each with its own clock.
  const waiting = new Set<(ok: boolean) => void>()
  let refused = false
  const listeners = new Set<() => void>()
  const settle = (ok: boolean) => {
    script = ok ? 'ready' : 'failed'
    for (const w of [...waiting]) w(ok)
  }
  return {
    load(key, lang) {
      if (script === 'ready' || page.mapsReady()) {
        script = 'ready'
        return Promise.resolve()
      }
      const loading = new Promise<void>((resolve, reject) => {
        const finish = (ok: boolean) => {
          waiting.delete(finish)
          page.clearTimeout(timer)
          if (ok) resolve()
          else reject('unreachable' satisfies LoadFailure)
        }
        // Google's script may have run with its callback still to come: that is a late callback, not an unreachable map.
        const timer = page.setTimeout(() => finish(page.mapsReady()), timeoutMs)
        waiting.add(finish)
      })
      if (script !== 'loading') {
        script = 'loading'
        page.setGlobal(AUTH_FAILURE, () => {
          refused = true
          for (const l of [...listeners]) l()
        })
        page.setGlobal(READY_CALLBACK, () => settle(true))
        page.addScript(googleMapsUrl({ key, lang, callback: READY_CALLBACK }), () => settle(false))
      }
      // A rejection nobody awaits yet is not an unhandled one: each map reads it through its own `then`.
      loading.catch(() => {})
      return loading
    },
    onRefused(listener) {
      if (refused) {
        listener()
        return () => {}
      }
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
}

/** The browser's page: a real script tag, real globals, the real clock. */
export const browserPage: LoaderPage = {
  addScript(src, onError) {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onerror = onError
    document.head.appendChild(script)
  },
  setGlobal: (name, value) => void ((window as unknown as Record<string, unknown>)[name] = value),
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (handle) => window.clearTimeout(handle as number),
  mapsReady: () => typeof (window as unknown as { google?: { maps?: { importLibrary?: unknown } } }).google?.maps?.importLibrary === 'function',
}

let pageLoader: GoogleLoader | null = null

/** The page's one loader. */
export function googleLoader(): GoogleLoader {
  return (pageLoader ??= createGoogleLoader(browserPage))
}
