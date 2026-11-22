/**
 * oms 951 (BackOffice spec 4182 §F "accuracy guards"): every `screens` route the help's table of contents names —
 * checked in as `src/features/help/screens.snapshot.json`, refreshed by the capture script (954) — must still be a route of the app.
 * A route renamed or removed in `router.tsx` fails here, so an article never sends a reader to a screen that is gone.
 *
 * `router.tsx` cannot be imported in node (`createBrowserRouter` runs at module load), so its `path:` strings are read
 * as text, plus the analytics library's leaves, which it generates from `LIBRARY_PAGES`. It lives in `app/` (the
 * composition root) because it reads two features: the help's snapshot and the analytics library's pages.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { matchPath } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ALL_ITEMS_PATH, LIBRARY_PAGES } from '@/features/analytics/boards/library-pages'
import snapshot from '@/features/help/screens.snapshot.json'

const here = path.dirname(fileURLToPath(import.meta.url))
const router = readFileSync(path.join(here, 'router.tsx'), 'utf8')

/**
 * Every route pattern the app answers: router.tsx's paths (relative ones sit under `/`), and the library leaves. The
 * catch-all `*` is not a screen — it sends any unknown address home.
 */
const patterns = [
  ...[...router.matchAll(/\bpath:\s*'([^']+)'/g)].filter((m) => m[1] !== '*').map((m) => (m[1].startsWith('/') ? m[1] : `/${m[1]}`)),
  ...LIBRARY_PAGES.map((p) => p.path),
  ALL_ITEMS_PATH,
]

const isRoute = (screen: string) => patterns.some((pattern) => matchPath({ path: pattern, end: true }, screen) !== null)

describe('the help snapshot of screens', () => {
  it('holds routes', () => {
    expect(snapshot.screens.length).toBeGreaterThan(0)
    expect(isRoute('/analytics/nowhere-at-all')).toBe(false)
  })

  it.each(snapshot.screens)('%s is a route of the app', (screen) => {
    expect(isRoute(screen)).toBe(true)
  })
})
