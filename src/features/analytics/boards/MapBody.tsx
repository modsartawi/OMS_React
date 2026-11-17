import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Map as MapIcon, Table2 } from 'lucide-react'
import LazyMapPanel from '@/core/map/LazyMapPanel'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import { fsi } from '@/core/util/bidi'
import { mapDisplay, mapDrawing, mapLegendView } from './map-chart'
import MapLegend from './MapLegend'
import MapTable, { MapLine } from './MapTable'
import { usePrintMap } from './PrintMapsContext'

/**
 * A map view's body (880): the result's points on the map panel. 882 (spec 3630 M21, M24): "Show as table" switches to
 * every row as a table and back; the stores not on the map are counted under it by the server's count and open as a
 * list; with no row placed, or when the screen cannot draw a map (879: no graphics, or the base map unreadable), the
 * table is drawn in place of the map with its line (`./map-chart` `mapDisplay`).
 *
 * 883 (spec 3630 M37, M38): on the report print page the map joins the page's maps, which hold the ready marker until
 * it has drawn; one that cannot draw, or has not drawn within 20 seconds, prints as that table under "The map could not
 * be drawn". A map with no placed row has nothing to draw: its table is its drawing, so it settles at once. Its size is
 * fixed on screen and paper alike: the print page lays the report out at the paper's width, so the canvas is never
 * resized between drawing and printing (BackOffice 3635).
 *
 * 884 (spec 3630 M42): the copilot panel draws the same body above an answer's table (`tableBelow`): a map that cannot
 * draw, or has no row placed, then shows only its line — the answer's table of the same rows is right under it.
 * `className` sizes the map panel (its default `h-80 w-full`), for the larger map the panel opens.
 */
export default function MapBody({
  result,
  definition,
  model,
  lang,
  tableBelow = false,
  className,
}: {
  result: AnalyticsQueryResult
  definition: AnalyticsViewDefinition
  model: AnalyticsModel
  lang: string
  tableBelow?: boolean
  className?: string
}) {
  const { t } = useTranslation('boards')
  // 881: each point sized, coloured and carded from the server's legend. One stable drawing per answer and language:
  // a new identity restarts the map.
  const drawing = useMemo(() => mapDrawing(result, model, lang), [result, model, lang])
  const legend = useMemo(() => mapLegendView(result, model, lang), [result, model, lang])
  const points = drawing.points
  const [cannotDraw, setCannotDraw] = useState(false)
  const [asTable, setAsTable] = useState(false)
  const print = usePrintMap()
  const noneOnMap = points.length === 0
  useEffect(() => {
    if (noneOnMap) print.drawn()
  })
  const fellBack = cannotDraw || print.state === 'fell-back'
  const display = mapDisplay({ placed: points.length, notOnMap: result.notOnMap ?? 0, cannotDraw: fellBack, asTable, tableBelow })
  const measure = saysIn(model.measures.find((m) => m.key === definition.query.measures[0])?.label, lang)
  return (
    <div className="flex flex-col gap-1.5" data-map-body={display.shows} {...(fellBack ? { 'data-map-fell-back': true } : {})}>
      {display.switchTo && (
        <div className="flex justify-end print:hidden">
          <Button variant="ghost" onClick={() => setAsTable(display.switchTo === 'table')} data-map-switch={display.switchTo}>
            {display.switchTo === 'table' ? <Table2 className="size-3.5" aria-hidden /> : <MapIcon className="size-3.5" aria-hidden />}
            {t(display.switchTo === 'table' ? 'view.mapShowTable' : 'view.mapShowMap')}
          </Button>
        </div>
      )}
      {display.shows === 'map' && (
        <LazyMapPanel
          points={points}
          grouping={drawing.grouping}
          ariaLabel={t('view.mapLabel', { measure: fsi(measure) })}
          className={className}
          onDrawn={print.drawn}
          onCannotDraw={() => {
            setCannotDraw(true)
            print.cannotDraw()
          }}
        />
      )}
      {display.shows === 'table' && <MapTable result={result} definition={definition} model={model} lang={lang} />}
      {display.shows === 'map' && legend && <MapLegend view={legend} />}
      <MapLine line={display.line} result={result} definition={definition} model={model} lang={lang} />
    </div>
  )
}
