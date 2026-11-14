import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi, RowClickedEvent } from 'ag-grid-community'
import { ChevronLeft, ChevronRight, FileSpreadsheet, RotateCcw, X } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import type {
  ExpiredApprovalPickPharmacist,
  ExpiredApprovalPickRow,
} from '@/core/models/expired-approval-pick'
import { notify } from '@/core/services/notify'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { fsi } from '@/core/util/bidi'
import { formatDateTime, formatDay, toIsoDate } from '@/core/util/date-format'
import { gridSheet, writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'
import { canOpenExpiredApprovalPicks, expiredApprovalPickAccessQuery } from './access'
import { expiredApprovalPickApi } from './api'
import { TEXT_COLUMNS, pharmacistColumns, pickColumns } from './columns'
import {
  DEFAULT_FILTERS,
  OUTCOMES,
  REPORT_TABS,
  canStepForward,
  drillInto,
  filtersFromParams,
  filtersToParams,
  normalizeStores,
  picksShown,
  reportQuery,
  stepWeek,
  weekStartOf,
  weekTotals,
  type OutcomeFilter,
  type PharmacistDrill,
  type ReportFilters,
  type ReportTab,
  type WeekTotals,
} from './filters'

/**
 * Expired approval picks (BackOffice ticket 3874, spec 3849): the insurance team's weekly report of the picks on an
 * insurance approval that expired with no sale, per store and pharmacist, in two groups — "sold from the approvals
 * screen, delivery never billed" and "never sold". One week at a time (the newest filled by default); a pharmacist row
 * opens their picks.
 *
 * Behind `canOpenExpiredApprovalPicks` on its own probe (`ExpiredApprovalPick/Access`), the same predicate the menu leaf
 * reads, failing closed. The report names pharmacists, so its grant is its own (`BackOfficeScreen[ExpiredApprovalPick, 03]`).
 *
 * 🚩 The report is the weekly fill's (`PickExpiredApproval`), never computed on the request: a week nobody filled reads
 * as empty with "not filled yet", not as a clean week.
 */
export default function ExpiredApprovalPicksPage() {
  const { t } = useTranslation('expired-approval-picks')
  return (
    <ScreenGate
      query={expiredApprovalPickAccessQuery()}
      can={canOpenExpiredApprovalPicks}
      ns="expired-approval-picks"
      title={t('title')}
      subtitle={t('subtitle')}
    >
      <Report />
    </ScreenGate>
  )
}

const DEFAULT_COL_DEF: ColDef = {
  ...OMS_GRID_BASE_COL_DEF,
  resizable: true,
  sortable: true,
  suppressHeaderMenuButton: true,
  wrapHeaderText: true,
  autoHeaderHeight: true,
}

const TILES: readonly (keyof WeekTotals)[] = ['picks', 'soldNotBilled', 'neverSold', 'units', 'stores', 'pharmacists']

function Report() {
  const { t } = useTranslation('expired-approval-picks')
  const { query: filters, update, changedFromOutside } = useUrlQuery(filtersFromParams, filtersToParams)
  // The stores box is a draft, applied on Enter or Apply: typed into the URL on every key, each key would read.
  const [storesDraft, setStoresDraft] = useState(filters.stores)
  useEffect(() => {
    if (changedFromOutside()) setStoresDraft(filters.stores)
  }, [filters, changedFromOutside])

  // "Today" is read once per visit, for the forward bound only.
  const [now] = useState(() => new Date())
  const query = useMemo(() => reportQuery(filters), [filters])
  const read = useQuery({
    queryKey: ['oms', 'expired-approval-picks', 'report', query],
    queryFn: () => expiredApprovalPickApi.report(query),
    retry: false,
  })
  const data = read.data

  // The week shown: the door's answer (it resolves "newest filled"), else the one asked for.
  const shownWeek = weekStartOf(formatDay(data?.weekStart)) || filters.week
  const shownWeekEnd = formatDay(data?.weekEnd)

  const patch = (p: Partial<ReportFilters>) => update((prev) => ({ ...prev, ...p }))
  const openPharmacist = useCallback(
    (row: ExpiredApprovalPickPharmacist) => update((prev) => drillInto(prev, row)),
    [update],
  )
  const onPicks = filters.tab === 'picks'
  const picks = useMemo(() => picksShown(data?.rows ?? [], filters), [data, filters])
  const totals = useMemo(() => (data ? weekTotals(data.pharmacists) : null), [data])
  const gridApi = useRef<GridApi | null>(null)

  async function exportXlsx() {
    const api = gridApi.current
    if (!api) return
    try {
      const sheet = gridSheet(api as GridApi<unknown>, t(`tabs.${filters.tab}`), { asText: (colId) => TEXT_COLUMNS.has(colId) })
      await writeWorkbook([sheet], xlsxFileName(`${t('export.fileName')}-${shownWeek}`))
      notify.success(t('export.done'), t('export.doneDetail', { count: sheet.count, n: fsi(String(sheet.count)) }))
    } catch {
      notify.error(t('export.failed'), t('export.failedDetail'))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          const stores = normalizeStores(storesDraft)
          setStoresDraft(stores)
          patch({ stores })
        }}
        data-eap-filters=""
      >
        <Field label={t('week.label')}>
          <div className="flex items-center gap-1">
            <Button
              variant="outlined"
              aria-label={t('week.previous')}
              title={t('week.previous')}
              disabled={!shownWeek}
              onClick={() => patch({ week: stepWeek(shownWeek, -1) })}
              data-eap-week="previous"
            >
              <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
            </Button>
            <Input
              type="date"
              value={shownWeek}
              max={toIsoDate(now)}
              onChange={(e) => patch({ week: weekStartOf(e.target.value) })}
              className="w-40"
              data-eap-filter="week"
            />
            <Button
              variant="outlined"
              aria-label={t('week.next')}
              title={t('week.next')}
              disabled={!canStepForward(shownWeek, now)}
              onClick={() => patch({ week: stepWeek(shownWeek, 1) })}
              data-eap-week="next"
            >
              <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
            </Button>
          </div>
        </Field>
        <Field label={t('filters.stores')}>
          <Input
            type="text"
            value={storesDraft}
            onChange={(e) => setStoresDraft(e.target.value)}
            placeholder={t('filters.storesPlaceholder')}
            className="w-56"
            data-eap-filter="stores"
          />
        </Field>
        {onPicks && (
          <Field label={t('filters.outcome')}>
            <Select
              value={filters.outcome}
              onChange={(e) => patch({ outcome: e.target.value as OutcomeFilter })}
              className="w-72"
              data-eap-filter="outcome"
            >
              {OUTCOMES.map((o) => (
                <option key={o || 'any'} value={o}>
                  {o ? t(`outcome.${o}`) : t('filters.anyOutcome')}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Button type="submit" variant="secondary" data-eap-apply="">
          {t('filters.apply')}
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setStoresDraft('')
            update((prev) => ({ ...DEFAULT_FILTERS, tab: prev.tab }))
          }}
          data-eap-reset=""
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('filters.reset')}
        </Button>
        {data && shownWeek && shownWeekEnd && (
          <p className="basis-full text-xs text-muted-foreground" data-eap-week-range={shownWeek}>
            <Trans
              t={t}
              i18nKey="week.range"
              values={{ from: shownWeek, to: shownWeekEnd }}
              components={{ from: <Ltr />, to: <Ltr /> }}
            />
            {' · '}
            {data.filledAt ? (
              <Trans t={t} i18nKey="week.filledAt" values={{ at: formatDateTime(data.filledAt) }} components={{ at: <Ltr /> }} />
            ) : (
              <span className="text-attention-800" data-eap-not-filled="">
                {t('week.notFilled')}
              </span>
            )}
          </p>
        )}
      </form>

      {read.isError && (
        <ErrorBanner className="p-2.5" title={t('list.failedTitle')} message={apiErrorMessage(read.error, t('list.failed'))} />
      )}

      <Tiles totals={totals} loading={read.isFetching && !data} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label={t('tabs.label')} className="flex flex-wrap gap-1">
          {REPORT_TABS.map((tab: ReportTab) => (
            <Chip key={tab} variant="tab" on={filters.tab === tab} onClick={() => patch({ tab })} data-eap-tab={tab}>
              {t(`tabs.${tab}`)}
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {data?.asOf && (
            <span className="text-xs text-muted-foreground" data-eap-as-of={data.asOf}>
              <Trans t={t} i18nKey="asOf" values={{ at: formatDateTime(data.asOf) }} components={{ at: <Ltr /> }} />
            </span>
          )}
          <Button variant="outlined" disabled={!read.isSuccess} onClick={() => void exportXlsx()} data-eap-export="">
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            {t('export.button')}
          </Button>
        </div>
      </div>

      {onPicks && filters.drill && <DrillLine drill={filters.drill} onClear={() => patch({ drill: null })} />}

      <div className="relative h-[calc(100vh-26rem)] min-h-96" data-eap-grid={filters.tab}>
        <TabGrid
          tab={filters.tab}
          pharmacists={data?.pharmacists}
          picks={picks}
          loading={read.isFetching && !data}
          quiet={read.isError}
          onReady={(api) => {
            gridApi.current = api
          }}
          onPharmacist={openPharmacist}
        />
      </div>
      <p className="text-xs text-muted-foreground" data-eap-note="">
        {t(onPicks ? 'note.picks' : 'note.pharmacists')}
      </p>
    </div>
  )
}

function Tiles({ totals, loading }: { totals: WeekTotals | null; loading: boolean }) {
  const { t } = useTranslation('expired-approval-picks')
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-6" data-eap-tiles="">
      {TILES.map((key) => (
        <div key={key} className="rounded-lg border border-border/60 bg-card/40 px-3 py-2" data-eap-tile={key} title={t(`tileHint.${key}`)}>
          <dt className="text-xs text-muted-foreground">{t(`tile.${key}`)}</dt>
          <dd className="text-lg font-semibold tabular-nums">
            <Ltr>{loading || !totals ? t('dash') : String(totals[key])}</Ltr>
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** The store and pharmacist the Picks tab is narrowed to, with the way back to every pick of the week. */
function DrillLine({ drill, onClear }: { drill: PharmacistDrill; onClear: () => void }) {
  const { t } = useTranslation('expired-approval-picks')
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" data-eap-drill="">
      <span className="text-muted-foreground">{t('drill.label')}</span>
      <span className="rounded-full border border-border bg-card px-2 py-0.5">
        <Ltr>{drill.store}</Ltr>
        {' · '}
        {drill.pharmacist ? <Ltr>{drill.pharmacist}</Ltr> : <span className="italic">{t('unknownPharmacist')}</span>}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-primary hover:bg-muted"
        data-eap-drill-clear=""
      >
        <X className="h-3 w-3" aria-hidden />
        {t('drill.clear')}
      </button>
    </div>
  )
}

/** The open tab's grid. A pharmacist row opens that pharmacist's picks. */
function TabGrid({
  tab,
  pharmacists,
  picks,
  loading,
  quiet,
  onReady,
  onPharmacist,
}: {
  tab: ReportTab
  pharmacists: ExpiredApprovalPickPharmacist[] | undefined
  picks: ExpiredApprovalPickRow[]
  loading: boolean
  quiet: boolean
  onReady: (api: GridApi) => void
  onPharmacist: (row: ExpiredApprovalPickPharmacist) => void
}) {
  const { t } = useTranslation('expired-approval-picks')
  const columns = useMemo(
    () => (tab === 'pharmacists' ? (pharmacistColumns(t) as ColDef[]) : (pickColumns(t) as ColDef[])),
    [tab, t],
  )
  const rows: unknown[] = tab === 'pharmacists' ? (pharmacists ?? []) : picks
  const onPharmacists = tab === 'pharmacists'
  return (
    <AgGridReact
      key={tab}
      theme={omsGridTheme}
      rowData={quiet ? [] : rows}
      columnDefs={columns}
      defaultColDef={DEFAULT_COL_DEF}
      onGridReady={({ api }) => onReady(api)}
      onRowClicked={
        onPharmacists ? (e: RowClickedEvent) => e.data && onPharmacist(e.data as ExpiredApprovalPickPharmacist) : undefined
      }
      rowClass={onPharmacists ? 'cursor-pointer' : undefined}
      rowHeight={OMS_GRID_ROW_HEIGHT}
      headerHeight={OMS_GRID_HEADER_HEIGHT}
      tooltipShowDelay={400}
      animateRows={false}
      suppressColumnVirtualisation
      loading={loading}
      noRowsOverlayComponent={NoRows}
      suppressNoRowsOverlay={quiet}
    />
  )
}

function NoRows() {
  const { t } = useTranslation('expired-approval-picks')
  return <span className="text-sm text-muted-foreground">{t('list.empty')}</span>
}
