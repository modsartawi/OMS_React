import type { MapLang } from './map-panel'

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
 * - "Unreachable": the script failed, or did not call back within {@link GOOGLE_LOAD_TIMEOUT_MS}. "Refused": Google
 *   called `gm_authFailure` (the key or the referrer refused, the API not enabled, billing off, the quota spent). Both are
 *   kept for the page's life: no second script tag is ever added.
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
  const q = new URLSearchParams({ key: p.key, v: GOOGLE_MAPS_VERSION, region: 'SA', language: p.lang, loading: 'async', callback: p.callback })
  return `${SCRIPT_ORIGIN}?${q.toString()}`
}

/** The page, as the loader touches it (a stand-in in the tests, {@link browserPage} in the browser). */
export interface LoaderPage {
  addScript(src: string, onError: () => void): void
  setGlobal(name: string, value: unknown): void
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export type LoadFailure = 'unreachable'

export interface GoogleLoader {
  /** Resolves when Google's script is ready; rejects with `'unreachable'`. The first call adds the script tag. */
  load(key: string, lang: MapLang): Promise<void>
  /** Calls `listener` when Google refuses the key or the page; at once when it already has. Returns how to stop. */
  onRefused(listener: () => void): () => void
}

export function createGoogleLoader(page: LoaderPage, timeoutMs = GOOGLE_LOAD_TIMEOUT_MS): GoogleLoader {
  let loading: Promise<void> | null = null
  let refused = false
  const listeners = new Set<() => void>()
  return {
    load(key, lang) {
      if (loading) return loading
      loading = new Promise<void>((resolve, reject) => {
        let done = false
        const timer = page.setTimeout(() => finish(false), timeoutMs)
        const finish = (ok: boolean) => {
          if (done) return
          done = true
          page.clearTimeout(timer)
          if (ok) resolve()
          else reject('unreachable' satisfies LoadFailure)
        }
        page.setGlobal(AUTH_FAILURE, () => {
          refused = true
          for (const l of [...listeners]) l()
        })
        page.setGlobal(READY_CALLBACK, () => finish(true))
        page.addScript(googleMapsUrl({ key, lang, callback: READY_CALLBACK }), () => finish(false))
      })
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
}

let pageLoader: GoogleLoader | null = null

/** The page's one loader. */
export function googleLoader(): GoogleLoader {
  return (pageLoader ??= createGoogleLoader(browserPage))
}
