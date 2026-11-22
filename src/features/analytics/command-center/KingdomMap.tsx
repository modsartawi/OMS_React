import { useMemo, useState } from 'react'
import LazyMapPanel from '@/core/map/LazyMapPanel'
import { KSA_BH_BOX, type MapSelection } from '@/core/map/map-panel'
import type { CcFilter, CcLang, CcRegionKey, CommandCenterHome } from '@/core/models/command-center'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import type { CcT } from './lang'
import { kingdomView, POINTS_FROM_ZOOM, regionView } from './map-view'
import MapFilter from './MapFilter'
import { pageDir } from './lang'
import RegionTable from './RegionTable'

/**
 * The kingdom map and the region table (oms 947, spec 4165 "The kingdom map"): the home's end half. Drawn with Google
 * Maps through the analytics map chart's own door and key path (`@/core/map/LazyMapPanel`, the server's `maps` part,
 * ADR 0139); only pharmacy codes and coordinates reach Google. Zoomed out, the five regions and Bahrain shaded by the
 * server's step for their share of flagged pharmacies; zoomed in, each pharmacy a green, amber or red point. The filter
 * changes the points, the shading and the table together. Choosing a region zooms to it; choosing a pharmacy opens its
 * scorecard (`onPharmacy`, the page puts it in the URL). A pharmacy with no coordinates is counted under the map.
 *
 * A map that cannot be drawn (no key, Google refused or unreachable) says so; the region table beside it still stands.
 */
export default function KingdomMap({
  home,
  filter,
  onFilter,
  onPharmacy,
  lang,
  t,
}: {
  home: Pick<CommandCenterHome, 'points' | 'regions' | 'notOnMap' | 'maps'>
  filter: CcFilter
  onFilter: (filter: CcFilter) => void
  onPharmacy: (storeCode: string) => void
  lang: CcLang
  t: CcT
}) {
  // One stable drawing per answer and filter: a new identity draws the map again.
  const view = useMemo(() => kingdomView(home, filter), [home, filter])
  const [region, setRegion] = useState<CcRegionKey | null>(null)
  const [cannotDraw, setCannotDraw] = useState(false)
  const shown = useMemo(() => (region ? regionView(region) : null) ?? KSA_BH_BOX, [region])
  const onSelect = (selection: MapSelection) => (selection.kind === 'point' ? onPharmacy(selection.id) : setRegion(selection.id))
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" data-cc-map={filter}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{t('map.title')}</h2>
        <MapFilter filter={filter} onChange={onFilter} t={t} />
      </div>
      {cannotDraw ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground" data-cc-map-cannot-draw>
          {t('map.cannotDraw')}
        </p>
      ) : (
        <LazyMapPanel
          points={view.points}
          polygons={view.polygons}
          groupNearby={false}
          pointsFromZoom={POINTS_FROM_ZOOM}
          view={shown}
          onSelect={onSelect}
          maps={home.maps}
          lang={lang}
          dir={pageDir(lang)}
          ariaLabel={t('map.label')}
          className="h-96 w-full"
          onCannotDraw={() => setCannotDraw(true)}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {home.notOnMap > 0 ? (
          <span data-cc-not-on-map>
            {t('map.notOnMap')} <Ltr>{home.notOnMap}</Ltr>
          </span>
        ) : (
          <span>{t('map.zoomHint')}</span>
        )}
        <span data-cc-boundaries>{t('map.boundaries')}</span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold tracking-tight text-muted-foreground">{t('regions.title')}</h3>
          {region && (
            <Button variant="ghost" onClick={() => setRegion(null)} data-cc-whole-kingdom>
              {t('regions.wholeKingdom')}
            </Button>
          )}
        </div>
        <RegionTable rows={view.rows} selected={region} onSelect={setRegion} t={t} />
      </div>
    </section>
  )
}
