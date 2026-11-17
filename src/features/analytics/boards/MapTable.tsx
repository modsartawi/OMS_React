import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TableChart from '@/core/charts/TableChart'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'
import Button from '@/core/ui/Button'
import { fsi } from '@/core/util/bidi'
import { listText } from '@/core/util/list-format'
import { useTableWords } from './AreaNotes'
import { mapTableView, notOnMapTableView, type MapDisplay, type MapTableWords } from './map-chart'

/**
 * The map's rows as a table, and the line under a map (oms-react 882, BackOffice spec 3630 M21, M24). The rows and their
 * order are `./map-chart`'s (`mapTableView`, `notOnMapTableView`); this only draws them with the table chart's grid.
 */

function useMapTableWords(): MapTableWords {
  const { t } = useTranslation('boards')
  const tableWords = useTableWords()
  return useMemo(() => ({ ...tableWords, storeName: t('view.mapStoreName'), city: t('view.mapCity') }), [tableWords, t])
}

type Props = { result: AnalyticsQueryResult; definition: AnalyticsViewDefinition; model: AnalyticsModel; lang: string }

/** Every row of the map's answer as a table (M24), or only the stores not on it (`only: 'notOnMap'`, M21). */
export default function MapTable({ result, definition, model, lang, only }: Props & { only?: 'notOnMap' }) {
  const { t: tc } = useTranslation('common')
  const words = useMapTableWords()
  const view = useMemo(
    () => (only === 'notOnMap' ? notOnMapTableView : mapTableView)(result, definition, model, lang, words),
    [only, result, definition, model, lang, words],
  )
  const measures = view.columns.filter((c) => c.role === 'measure').map((c) => c.label)
  const dims = view.columns.filter((c) => c.role === 'dimension').map((c) => c.label)
  return (
    <div data-map-table={only ?? 'all'}>
      <TableChart
        columns={view.columns}
        rows={view.rows}
        sort={view.sort}
        locale={lang}
        ariaLabel={tc('charts.tableLabel', { measures: fsi(listText(measures, lang)), dimensions: fsi(listText(dims, lang)) })}
      />
    </div>
  )
}

/**
 * The line under a map: "N stores are not on the map" — the server's count (`result.notOnMap`), never one the panel
 * makes — which opens and closes the list of those stores; or "The map could not be drawn" (879's cannot-draw).
 */
export function MapLine({ line, ...props }: Props & { line: MapDisplay['line'] }) {
  const { t } = useTranslation('boards')
  const [open, setOpen] = useState(false)
  const listId = useId()
  if (line === 'cannotDraw') {
    return (
      <p className="text-xs text-muted-foreground" role="status" data-map-cannot-draw>
        {t('view.mapCannotDraw')}
      </p>
    )
  }
  if (line !== 'notOnMap') return null
  const count = props.result.notOnMap ?? 0
  return (
    <div className="flex flex-col gap-1.5">
      <div>
        <Button variant="link" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={listId} data-map-not-on-map={count}>
          {t('view.mapNotOnMap', { count, n: fsi(count) })}
        </Button>
      </div>
      {open && (
        <section id={listId} aria-label={t('view.mapNotOnMapList')}>
          <MapTable {...props} only="notOnMap" />
        </section>
      )}
    </div>
  )
}
