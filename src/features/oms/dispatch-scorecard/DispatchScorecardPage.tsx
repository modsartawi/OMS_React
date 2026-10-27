import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi } from 'ag-grid-community'
import { FileSpreadsheet, RotateCcw } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import type { DispatchScorecardStaffRow, DispatchScorecardStoreRow } from '@/core/models/dispatch-scorecard'
import { notify } from '@/core/services/notify'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { gridSheet, writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'
import { canOpenDispatchScorecard, dispatchScorecardAccessQuery } from './access'
import { dispatchScorecardApi } from './api'
import { staffColumns, storeColumns, type OpenDrill } from './columns'
import DrillDrawer, { type DrillTarget } from './DrillDrawer'
import { tooFewLast } from './figures'
import {
  DEFAULT_FILTERS,
  MAX_DAYS,
  SCORECARD_TABS,
  filtersFromParams,
  filtersToParams,
  refusalKey,
  resolveRange,
  wireQuery,
  type ScorecardFilters,
} from './range'
import StoreCardDrawer from './StoreCardDrawer'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Chip from '@/core/ui/Chip'

/**
 * The dispatch scorecard (ticket 543, BackOffice spec 2952; rulings 2948, 2950 point 3 — variant A with
 * B as the drill target). HQ ranks stores, and staff on their own actions, over a range; drills any
 * ranked figure (and lost races) to the bids behind it; and opens a store's report card.
 *
 * Behind `canOpenDispatchScorecard` on its own probe (`DispatchScorecard/Access`), the same predicate the
 * menu leaf reads, failing closed. The Staff tab sits behind the same grant (2950 point 6).
 *
 * 🚩 The figures, ranks and medians are the door's; the grid only sorts what it was sent. Best and worst
 * are the two directions of a ranked column's header sort; "too few" rows sort last either way.
 */
export default function DispatchScorecardPage() {
  const { t } = useTranslation('dispatch-scorecard')
  return (
    <ScreenGate
      query={dispatchScorecardAccessQuery()}
      can={canOpenDispatchScorecard}
      ns="dispatch-scorecard"
      title={t('title')}
      subtitle={t('subtitle')}
    >
      <Scorecard />
    </ScreenGate>
  )
}

const DEFAULT_COL_DEF: ColDef = {
  ...OMS_GRID_BASE_COL_DEF,
  resizable: true,
  suppressHeaderMenuButton: true,
  wrapHeaderText: true,
  autoHeaderHeight: true,
}

const FILTER_INPUTS = ['type', 'channel', 'city', 'region', 'store'] as const
type TextFilters = Pick<ScorecardFilters, (typeof FILTER_INPUTS)[number]>
const textFiltersOf = (f: ScorecardFilters): TextFilters => ({
  type: f.type,
  channel: f.channel,
  city: f.city,
  region: f.region,
  store: f.store,
})

function Scorecard() {
  const { t } = useTranslation('dispatch-scorecard')
  const { query: filters, update, changedFromOutside } = useUrlQuery(filtersFromParams, filtersToParams)
  // The text filters are a draft, applied together on Enter or Apply (the board's way): typed into the
  // URL on every key they could not hold an inner space ("Al Khobar") and each key fired a grid read.
  const [draft, setDraft] = useState<TextFilters>(() => textFiltersOf(filters))
  useEffect(() => {
    if (changedFromOutside()) setDraft(textFiltersOf(filters))
  }, [filters, changedFromOutside])
  const applyDraft = () => {
    const applied = Object.fromEntries(FILTER_INPUTS.map((key) => [key, draft[key].trim()])) as TextFilters
    setDraft(applied)
    update((prev) => ({ ...prev, ...applied }))
  }
  // "Today" is read once per visit: a range defaulted at 23:59 does not slide under the reader.
  const [now] = useState(() => new Date())
  const range = useMemo(() => resolveRange(filters, now), [filters, now])
  // Over 92 days, reversed or half-typed: no call at all (the door would refuse it as CALLOUT-301/302).
  const wire = useMemo(() => (range.ok ? wireQuery(filters, range) : null), [filters, range])

  const grid = useQuery({
    queryKey: ['oms', 'dispatch-scorecard', 'grid', wire],
    queryFn: () => dispatchScorecardApi.grid(wire!),
    enabled: wire !== null,
    retry: false,
  })

  const [drill, setDrill] = useState<DrillTarget | null>(null)
  const [card, setCard] = useState<string | null>(null)
  const openDrill = useCallback<OpenDrill>((figure, who) => setDrill({ figure, ...who }), [])
  const openCard = useCallback((store: string) => setCard(store), [])

  const storeCols = useMemo(() => storeColumns(t, openCard, openDrill), [t, openCard, openDrill])
  const staffCols = useMemo(() => staffColumns(t, openDrill), [t, openDrill])
  const storeRows = useMemo(() => tooFewLast(grid.data?.stores ?? []), [grid.data])
  const staffRows = useMemo(() => tooFewLast(grid.data?.staff ?? []), [grid.data])

  const storesApi = useRef<GridApi<DispatchScorecardStoreRow> | null>(null)
  const staffApi = useRef<GridApi<DispatchScorecardStaffRow> | null>(null)

  async function exportXlsx() {
    const api = filters.tab === 'stores' ? storesApi.current : staffApi.current
    if (!api) return
    try {
      const sheet = gridSheet(api as GridApi<unknown>, t(`export.${filters.tab}Sheet`), { asText: (colId) => colId === 'store' })
      await writeWorkbook([sheet], xlsxFileName(t('export.fileName')))
      notify.success(t('export.done'), t('export.doneDetail', { count: sheet.count, n: fsi(String(sheet.count)) }))
    } catch {
      notify.error(t('export.failed'), t('export.failedDetail'))
    }
  }

  const patch = (p: Partial<ScorecardFilters>) => update((prev) => ({ ...prev, ...p }))
  const refusal = grid.isError ? refusalKey(grid.error) : null
  const shown = filters.tab === 'stores' ? storeRows.length : staffRows.length

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          applyDraft()
        }}
        data-sc-filters=""
      >
        <Field label={t('filters.from')}>
          <Input
            type="date"
            value={filters.from || (range.ok ? range.from : '')}
            onChange={(e) => patch({ from: e.target.value, to: filters.to || (range.ok ? range.to : '') })}
            className="w-40"
            data-sc-filter="from"
          />
        </Field>
        <Field label={t('filters.to')}>
          <Input
            type="date"
            value={filters.to || (range.ok ? range.to : '')}
            onChange={(e) => patch({ to: e.target.value, from: filters.from || (range.ok ? range.from : '') })}
            className="w-40"
            data-sc-filter="to"
          />
        </Field>
        {FILTER_INPUTS.map((key) => (
          <Field key={key} label={t(`filters.${key}`)}>
            <Input
              type="text"
              value={draft[key]}
              onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
              placeholder={t('filters.any')}
              className="w-28"
              data-sc-filter={key}
            />
          </Field>
        ))}
        <Button type="submit" variant="secondary" data-sc-apply="">
          {t('filters.apply')}
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setDraft(textFiltersOf(DEFAULT_FILTERS))
            update((prev) => ({ ...DEFAULT_FILTERS, tab: prev.tab }))
          }}
          data-sc-reset=""
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('filters.reset')}
        </Button>
        {!range.ok && (
          <p role="alert" className="basis-full text-xs text-danger-800" data-sc-problem={range.problem}>
            {range.problem === 'tooLong' ? (
              <Trans t={t} i18nKey="problem.tooLong" values={{ max: String(MAX_DAYS) }} components={{ max: <Ltr /> }} />
            ) : (
              t(`problem.${range.problem}`)
            )}
          </p>
        )}
      </form>

      {grid.isError && (
        <div data-sc-refusal={refusal ?? ''}>
          <ErrorBanner
            className="p-2.5"
            title={t('list.failedTitle')}
            message={refusal ? t(refusal) : apiErrorMessage(grid.error, t('list.failed'))}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label={t('tabs.label')} className="flex gap-1">
          {SCORECARD_TABS.map((tab) => (
            <Chip key={tab} variant="tab" on={filters.tab === tab} onClick={() => patch({ tab })} data-sc-tab={tab}>
              {t(`tabs.${tab}`)}
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {grid.data?.asOf && (
            <span className="text-xs text-muted-foreground" data-sc-as-of={grid.data.asOf}>
              <Trans t={t} i18nKey="asOf" values={{ at: formatDateTime(grid.data.asOf) }} components={{ at: <Ltr /> }} />
            </span>
          )}
          <Button variant="outlined" disabled={!grid.isSuccess || shown === 0} onClick={() => void exportXlsx()} data-sc-export="">
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            {t('export.button')}
          </Button>
        </div>
      </div>

      <div className="relative h-[calc(100vh-22rem)] min-h-96" data-sc-grid={filters.tab}>
        {filters.tab === 'stores' ? (
          <AgGridReact<DispatchScorecardStoreRow>
            key="stores"
            theme={omsGridTheme}
            rowData={grid.isError ? [] : storeRows}
            columnDefs={storeCols}
            defaultColDef={DEFAULT_COL_DEF}
            getRowId={({ data }) => data.store}
            onGridReady={({ api }) => {
              storesApi.current = api
            }}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            tooltipShowDelay={400}
            animateRows={false}
            suppressColumnVirtualisation
            loading={grid.isFetching && !grid.data}
            noRowsOverlayComponent={NoRows}
            suppressNoRowsOverlay={grid.isError || !range.ok}
          />
        ) : (
          <AgGridReact<DispatchScorecardStaffRow>
            key="staff"
            theme={omsGridTheme}
            rowData={grid.isError ? [] : staffRows}
            columnDefs={staffCols}
            defaultColDef={DEFAULT_COL_DEF}
            getRowId={({ data }) => data.staff}
            onGridReady={({ api }) => {
              staffApi.current = api
            }}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            animateRows={false}
            suppressColumnVirtualisation
            loading={grid.isFetching && !grid.data}
            noRowsOverlayComponent={NoRows}
            suppressNoRowsOverlay={grid.isError || !range.ok}
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground" data-sc-note="">
        {filters.tab === 'stores' ? (
          <Trans
            t={t}
            i18nKey="note.stores"
            values={{ n: String(grid.data?.minimumBids ?? 20) }}
            components={{ n: <Ltr /> }}
          />
        ) : (
          <Trans
            t={t}
            i18nKey="note.staff"
            values={{ n: String(grid.data?.minimumAnswers ?? 10) }}
            components={{ n: <Ltr /> }}
          />
        )}
      </p>

      {card && wire && <StoreCardDrawer query={wire} store={card} openDrill={openDrill} onClose={() => setCard(null)} />}
      {drill && wire && <DrillDrawer query={wire} target={drill} onClose={() => setDrill(null)} />}
    </div>
  )
}

function NoRows() {
  const { t } = useTranslation('dispatch-scorecard')
  return <span className="text-sm text-muted-foreground">{t('list.empty')}</span>
}
