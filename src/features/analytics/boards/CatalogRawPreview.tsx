import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { tableLayout } from '@/core/charts/table-layout'
import type { AnalyticsRawValue } from '@/core/models/analytics'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { analyticsApi, analyticsRawKey } from './api'
import { rawRefusal, rawRequest, type RawOffer, type RawOrder } from './catalog-raw'
import { refusalWords } from './wire'

type Row = Record<string, AnalyticsRawValue>

/** The server's order is the point of the preview: the grid does not re-sort it. */
const RAW_DEFAULT_COL_DEF: ColDef<Row> = { ...OMS_GRID_BASE_COL_DEF, sortable: false, resizable: true }

/**
 * A curator's raw preview of one mart (ticket 844, spec 3437 §G, BO 3442): the top 200 rows through the allow-listed
 * columns, ordered by one of them (the picker offers only those) and descending unless turned off. A change of order
 * asks again. Values come raw — no unit, no shape — so the grid shows them as they came, through the base's `BdiCell`
 * (no `fsi` in a cell; the header name, a string-only sink, takes it). Mounted only when `rawOffer` says curator.
 */
export default function CatalogRawPreview({ martKey, offer }: { martKey: string; offer: RawOffer }) {
  const { t } = useTranslation('boards')
  const [order, setOrder] = useState<RawOrder | null>(null)
  const body = rawRequest(martKey, offer, order)
  const raw = useQuery({ queryKey: analyticsRawKey(body), queryFn: () => analyticsApi.catalogRaw(body), staleTime: 60_000, retry: false })
  const columns = raw.data?.columns
  const columnDefs = useMemo<ColDef<Row>[]>(
    () =>
      (columns ?? []).map((c) => ({
        colId: c,
        // A column name may hold a dot; read it by key, not as a field path.
        valueGetter: (p) => p.data?.[c] ?? null,
        valueFormatter: (p) => (p.value == null ? '' : String(p.value)),
        // A header name is a string-only sink: isolate the whole name (bidi rule).
        headerName: fsi(c),
        minWidth: 120,
        flex: 1,
      })),
    [columns],
  )
  const rows = raw.data?.rows ?? []
  const layout = tableLayout(rows.length, OMS_GRID_ROW_HEIGHT, OMS_GRID_HEADER_HEIGHT)
  const chosen = { orderBy: body.orderBy ?? '', descending: body.descending ?? true }

  return (
    <section className="flex min-w-0 flex-col gap-3 border-t border-border/60 pt-4" data-catalog-raw={martKey}>
      <h3 className="text-sm font-semibold">{t('catalog.raw.title')}</h3>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('catalog.raw.orderBy')} className="w-56">
          <Select
            value={chosen.orderBy}
            disabled={offer.orderBy.length === 0}
            onChange={(e) => setOrder({ orderBy: e.target.value, descending: chosen.descending })}
            data-catalog-raw-order=""
          >
            {offer.orderBy.map((c) => (
              <option key={c} value={c}>
                {fsi(c)}
              </option>
            ))}
          </Select>
        </Field>
        <Chip on={chosen.descending} onClick={() => setOrder({ orderBy: chosen.orderBy, descending: !chosen.descending })} data-catalog-raw-descending="">
          {t('catalog.raw.descending')}
        </Chip>
      </div>
      {raw.isPending ? (
        <p className="text-sm text-muted-foreground">{t('catalog.raw.loading')}</p>
      ) : raw.isError ? (
        <ErrorBanner message={refusalWords(rawRefusal(raw.error, t('catalog.raw.failed')), t)} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-catalog-raw-empty="">
          {t('catalog.raw.empty')}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground" data-catalog-raw-shown="">
            <Trans t={t} i18nKey="catalog.raw.shown" components={{ n: <Ltr /> }} values={{ count: rows.length }} />
          </p>
          <div
            className="overflow-hidden rounded-md border border-border/60"
            role="figure"
            aria-label={t('catalog.raw.gridLabel', { mart: fsi(martKey) })}
            style={layout.kind === 'fixed' ? { height: layout.heightPx } : undefined}
            data-catalog-raw-grid=""
          >
            <AgGridReact<Row>
              theme={omsGridTheme}
              rowData={rows}
              columnDefs={columnDefs}
              defaultColDef={RAW_DEFAULT_COL_DEF}
              rowHeight={OMS_GRID_ROW_HEIGHT}
              headerHeight={OMS_GRID_HEADER_HEIGHT}
              domLayout={layout.kind === 'auto' ? 'autoHeight' : 'normal'}
              animateRows={false}
            />
          </div>
        </>
      )}
    </section>
  )
}
