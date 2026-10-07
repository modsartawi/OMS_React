import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GetRowIdFunc, GridApi, RowSelectionOptions } from 'ag-grid-community'
import { FileSpreadsheet, Search } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import ScreenGate from '@/core/ui/ScreenGate'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { apiErrorMessage } from '@/core/api'
import { notify } from '@/core/services/notify'
import { formatCount, formatPair, fsi } from '@/core/util/bidi'
import { gridSheet, writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'
import { omsAccessQuery } from '@/core/oms/api'
import { canOpenGeography } from '@/core/oms/access'
import type { SdCityModel, SdDistrictModel } from '@/core/models/lookups'
import { citiesQuery, districtsQuery, selectedCityCode } from './geography'
import { EXPORT_AS_TEXT, cityColumns, districtColumns } from './columns'

/**
 * Cities & districts (ticket 436, spec 430 D6/D13): the WPF City and District inquiries on one
 * screen. Every city in the upper grid, loaded on open (D16); the selected city's districts in the
 * lower one, loaded on selection. Each grid has its own text filter and xlsx export.
 *
 * Behind `canOpenGeography` on the ONE shared OMS probe, the same predicate the menu leaf reads.
 * 🚩 Its doors (`SdDocumentWeb/Cities` and `SdDocumentWeb/Districts`, BackOffice ask BO-5) are not
 * built yet. The imports are ticket 437's.
 */
export default function GeographyPage() {
  const { t } = useTranslation('geography')
  return (
    <ScreenGate query={omsAccessQuery()} can={canOpenGeography} ns="geography" title={t('title')} subtitle={t('subtitle')}>
      <Geography />
    </ScreenGate>
  )
}

const ROW_SELECTION: RowSelectionOptions<SdCityModel> = {
  mode: 'singleRow',
  checkboxes: false,
  enableClickSelection: true,
}

const cityRowId: GetRowIdFunc<SdCityModel> = ({ data }) => data.cityCode
const districtRowId: GetRowIdFunc<SdDistrictModel> = ({ data }) => data.districtCode

/** A count, grouped as figures are drawn across the app. */
const figure = (n: number) => n.toLocaleString('en-US')

function Geography() {
  const { t, i18n } = useTranslation('geography')
  // The selected city's CODE, not its row: a reload (437's import) may rename it, and the title
  // reads the row as it stands now.
  const [selected, setSelected] = useState<string | null>(null)

  const cities = useQuery(citiesQuery())
  const city = useMemo(
    () => (selected === null ? null : ((cities.data ?? []).find((c) => selectedCityCode(c) === selected) ?? null)),
    [cities.data, selected],
  )
  // A city a reload no longer lists is no selection: its districts are not asked for or shown.
  const cityCode = city ? selected : null
  const districts = useQuery(districtsQuery(cityCode))

  const cityCols = useMemo(() => cityColumns(t), [t])
  const districtCols = useMemo(() => districtColumns(t), [t])

  // The city's name in the screen's language, the other when that one is blank.
  const arabic = i18n.language.startsWith('ar')
  const cityName = city ? (arabic ? city.cityNameAr || city.cityNameEn : city.cityNameEn || city.cityNameAr) : ''

  return (
    <div className="flex flex-col gap-4">
      <GridPane<SdCityModel>
        kind="cities"
        title={t('cities.title')}
        rows={cities.data}
        loading={cities.isFetching}
        error={cities.isError ? apiErrorMessage(cities.error, t('list.failed')) : null}
        columns={cityCols}
        getRowId={cityRowId}
        rowSelection={ROW_SELECTION}
        onSelect={(row) => setSelected(selectedCityCode(row))}
      />
      <GridPane<SdDistrictModel>
        kind="districts"
        title={
          cityCode !== null ? (
            // The city is a pair led by its code: one isolate around the whole pair.
            <Trans t={t} i18nKey="districts.titleOf" values={{ city: formatPair(cityCode, cityName) }} components={{ city: <Ltr /> }} />
          ) : (
            t('districts.title')
          )
        }
        rows={cityCode === null ? undefined : districts.data}
        loading={districts.isFetching}
        error={districts.isError ? apiErrorMessage(districts.error, t('list.failed')) : null}
        columns={districtCols}
        getRowId={districtRowId}
        placeholder={cityCode === null ? t('districts.selectCity') : undefined}
        // Another city is another list: its text filter starts empty.
        resetKey={cityCode}
      />
    </div>
  )
}

interface GridPaneProps<T> {
  /** Which list — its i18n keys, its `data-*` hooks, its export's name. */
  kind: 'cities' | 'districts'
  title: ReactNode
  /** `undefined` while nothing is loaded yet (or, for districts, no city is selected). */
  rows: T[] | undefined
  loading: boolean
  /** The failure, worded; the last good rows stay under it. */
  error: string | null
  columns: ColDef<T>[]
  getRowId: GetRowIdFunc<T>
  rowSelection?: RowSelectionOptions<T>
  onSelect?: (row: T | null) => void
  /** Said in the grid's place when there is nothing to load yet. */
  placeholder?: string
  /** When it changes, the text filter is cleared. */
  resetKey?: string | null
}

/** One list: its header (title, text filter, export), its banner, its grid and its count. */
function GridPane<T>({ kind, title, rows, loading, error, columns, getRowId, rowSelection, onSelect, placeholder, resetKey }: GridPaneProps<T>) {
  const { t } = useTranslation('geography')
  const gridApi = useRef<GridApi<T> | null>(null)
  const [quick, setQuick] = useState('')
  // What the grid shows once the text filter and the column filters have narrowed it; `null`
  // until the grid has counted these rows, so a list never flashes "nothing matches" first.
  const [shown, setShown] = useState<number | null>(null)
  const total = rows?.length ?? 0

  // Adjusted while rendering, not in an effect, so a stale filter or count is never drawn.
  const [seen, setSeen] = useState({ rows, resetKey })
  if (seen.rows !== rows || seen.resetKey !== resetKey) {
    setSeen({ rows, resetKey })
    setShown(null)
    if (seen.resetKey !== resetKey) setQuick('')
  }

  const defaultColDef = useMemo<ColDef<T>>(
    () => ({ ...OMS_GRID_BASE_COL_DEF, sortable: true, resizable: true, filter: true, suppressHeaderMenuButton: true }),
    [],
  )

  /** The list as shown — its columns, its filters, its sort — through the core writer. */
  async function exportXlsx() {
    const api = gridApi.current
    if (!api) return
    try {
      const sheet = gridSheet(api, t(`${kind}.sheet`), { asText: (colId) => EXPORT_AS_TEXT.has(colId) })
      await writeWorkbook([sheet], xlsxFileName(t(`${kind}.fileName`)))
      notify.success(t('export.done'), t(`${kind}.exported`, { count: sheet.count, n: fsi(figure(sheet.count)) }))
    } catch {
      notify.error(t('export.failed'), t('export.failedDetail'))
    }
  }

  return (
    <section className="flex min-w-0 flex-col gap-1.5" data-geo-pane={kind}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-foreground" data-geo-title="">
          {title}
        </h2>
        <div className="ms-auto flex items-center gap-2">
          <label className="relative flex items-center">
            <Search className="pointer-events-none absolute start-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              placeholder={t(`${kind}.filter`)}
              aria-label={t(`${kind}.filter`)}
              disabled={rows === undefined}
              className="h-8 w-56 rounded-md border border-border/60 bg-background ps-8 pe-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none disabled:opacity-50"
              data-geo-filter=""
            />
          </label>
          <Button variant="outlined" disabled={rows === undefined || loading || !shown} onClick={() => void exportXlsx()} data-geo-export="">
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            {t('export.button')}
          </Button>
        </div>
      </div>

      {error && <ErrorBanner className="p-2.5" title={rows ? t('list.reloadFailedTitle') : t(`${kind}.failedTitle`)} message={error} />}

      <div className="relative h-[calc(50vh-9rem)] min-h-64" data-geo-list="">
        {placeholder ? (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border/60" data-geo-placeholder="">
            <span className="text-sm text-muted-foreground">{placeholder}</span>
          </div>
        ) : (
          <>
            <AgGridReact<T>
              theme={omsGridTheme}
              rowData={rows ?? []}
              columnDefs={columns}
              defaultColDef={defaultColDef}
              getRowId={getRowId}
              rowSelection={rowSelection}
              quickFilterText={quick}
              onGridReady={({ api }) => {
                gridApi.current = api
              }}
              onSelectionChanged={onSelect ? ({ api }) => onSelect(api.getSelectedRows()[0] ?? null) : undefined}
              onModelUpdated={({ api }) => setShown(api.getDisplayedRowCount())}
              rowHeight={OMS_GRID_ROW_HEIGHT}
              headerHeight={OMS_GRID_HEADER_HEIGHT}
              animateRows={false}
              // Render every column, so a cell off to the side is in the DOM for find-in-page and the drive.
              suppressColumnVirtualisation
              loading={loading && rows === undefined}
              // The empty state is drawn below: AG Grid's overlay keeps the params it was shown with.
              suppressNoRowsOverlay
            />
            {/* A first load that failed is the banner's to say. */}
            {rows !== undefined && !loading && shown === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center pt-8" data-geo-empty="">
                <span className="text-sm text-muted-foreground">{total > 0 ? t('list.noneMatch') : t(`${kind}.empty`)}</span>
              </div>
            )}
          </>
        )}
      </div>

      {rows !== undefined && (
        <div
          className="flex h-7 shrink-0 items-center gap-3 overflow-hidden rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
          data-status-bar=""
        >
          {loading || shown === null ? (
            <span>{t('statusBar.loading')}</span>
          ) : (
            <span data-status-count="">
              {shown !== total ? (
                <Trans
                  t={t}
                  i18nKey={`${kind}.filtered`}
                  count={total}
                  values={{ n: formatCount(figure(shown), figure(total)) }}
                  components={{ n: <Ltr /> }}
                />
              ) : (
                <Trans t={t} i18nKey={`${kind}.count`} count={total} values={{ n: figure(total) }} components={{ n: <Ltr /> }} />
              )}
            </span>
          )}
        </div>
      )}
    </section>
  )
}
