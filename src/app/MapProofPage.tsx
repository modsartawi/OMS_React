/* DEVELOPMENT ONLY — the map panel's proof page (ticket 879, BackOffice spec 3630). Not reachable in a production
 * build: its route exists only under `import.meta.env.DEV` (`./router`), so the bundler drops it. BackOffice 3635 prints
 * it through the report renderer; oms-react 883 removes it.
 *
 * Print readiness (BackOffice 3635, spec 3630 M37): the report renderer prints once the page carries `data-print-ready`,
 * so this page sets it only after its map has left `drawing` (drawn, or cannot draw) - as 883's print route will. It also
 * stamps `data-map-drawn-at` on <html> (performance.now() at the panel's onDrawn) so the proof can time load -> drawn.
 *
 * The panel with 20 fixed store points inside the development base-map file's box (central Riyadh, 46.60-46.80 E,
 * 24.60-24.80 N; BackOffice 3634). `?lang=ar` draws it in Arabic, right to left. The words here are dev chrome, exempt
 * from the t() rule like the prototype switcher's.
 */
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import LazyMapPanel from '@/core/map/LazyMapPanel'
import type { MapPoint } from '@/core/map/map-panel'

/** 20 fixed points, a 5 x 4 grid over central Riyadh with a small fixed jitter so no two line up. */
export const MAP_PROOF_POINTS: readonly MapPoint[] = Array.from({ length: 20 }, (_, i) => ({
  id: `P${String(i + 1).padStart(3, '0')}`,
  lon: Number((46.63 + (i % 5) * 0.035 + ((i * 7) % 5) * 0.003).toFixed(4)),
  lat: Number((24.63 + Math.floor(i / 5) * 0.04 + ((i * 3) % 4) * 0.003).toFixed(4)),
}))

export default function MapProofPage() {
  const [search] = useSearchParams()
  const { i18n } = useTranslation()
  const lang = search.get('lang') === 'ar' ? 'ar' : 'en'
  const [ready, setReady] = useState(false)
  const [settled, setSettled] = useState(false)

  // Language and direction are set BEFORE the panel mounts: the panel reads both when it starts.
  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
    void i18n.changeLanguage(lang).then(() => setReady(true))
  }, [i18n, lang])

  const onDrawn = useCallback(() => {
    document.documentElement.dataset.mapDrawnAt = String(Math.round(performance.now()))
    setSettled(true)
  }, [])
  const onCannotDraw = useCallback(() => setSettled(true), [])

  return (
    <main className="flex flex-col gap-2 bg-background p-4" data-print-ready={settled ? '' : undefined}>
      <h1 className="text-sm font-semibold text-foreground">Map panel proof (development only) · {lang}</h1>
      {ready && (
        <LazyMapPanel
          points={MAP_PROOF_POINTS}
          ariaLabel="Map proof"
          className="h-[960px] w-[720px]"
          onDrawn={onDrawn}
          onCannotDraw={onCannotDraw}
        />
      )}
    </main>
  )
}
