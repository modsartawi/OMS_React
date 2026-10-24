import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { RotateCcw, Search } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { useUrlQuery } from '@/core/ui/use-url-query'
import {
  PRESCRIPTION_SESSION_NS,
  PRESCRIPTION_SOURCE_KINDS,
  PRESCRIPTION_STEP_OWNERS,
  flagWord,
  ownerWord,
  sourceWord,
  stateWord,
  wordText,
} from '@/core/prescription-session/words'
import { prescriptionSessionsApi } from './api'
import { openColumns } from './columns'
import Denied from './Denied'
import {
  DEFAULT_OPEN_FILTER,
  OPEN_STATES,
  openFilterFromParams,
  openFilterToParams,
  openRequest,
  withFlag,
  type OpenFilter,
} from './open-filter'
import { flagChips, openRow, type OpenGridRow } from './open-row'

/** The bad-filter refusal (`PrescriptionSessionHqErrorCodes.BadFilter`): said beside the filters. */
const BAD_FILTER = 'PSES-00223'

const DEFAULT_COL_DEF: ColDef<OpenGridRow> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  filter: true,
  suppressHeaderMenuButton: true,
}

const FIELD = 'flex flex-col gap-1 text-xs font-medium text-muted-foreground'
const INPUT =
  'h-9 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none'

/** What the filter bar edits before Search promotes it to the address. */
type Draft = Pick<OpenFilter, 'store' | 'state' | 'owner' | 'source' | 'minAge' | 'maxAge'>
const draftOf = (f: OpenFilter): Draft => ({
  store: f.store,
  state: f.state,
  owner: f.owner,
  source: f.source,
  minAge: f.minAge,
  maxAge: f.maxAge,
})

/**
 * The Open tab (ticket 545; BackOffice spec 2994 stories 68-69): every open session across stores,
 * oldest idle first, filtered from the address, with the three flag chips and the Owed saved view.
 * Read only — the one HQ act (548) lives in the row-action slot (`./OpenRowAction`).
 */
export default function OpenTab() {
  const { t, i18n } = useTranslation('prescription-sessions')
  const { t: tw } = useTranslation(PRESCRIPTION_SESSION_NS)
  const { query: filter, update, changedFromOutside } = useUrlQuery(openFilterFromParams, openFilterToParams)
  const [draft, setDraft] = useState<Draft>(() => draftOf(filter))
  const owedView = filter.view === 'owed'

  // Back, a pasted link or the menu leaf resets the bar; the page's own writes keep what is typed.
  useEffect(() => {
    if (changedFromOutside()) setDraft(draftOf(filter))
  }, [filter, changedFromOutside])

  const request = openRequest(filter)
  const list = useQuery({
    queryKey: ['prescription-sessions', 'open', request],
    queryFn: () => prescriptionSessionsApi.open(filter),
    retry: false,
  })

  const denied = isBareDenial(list.error)
  const badFilter = list.isError && apiErrorCode(list.error) === BAD_FILTER
  const columns = useMemo(() => openColumns(t, tw, i18n.language), [t, tw, i18n.language])
  const rows = useMemo<OpenGridRow[]>(
    () => (list.isError ? [] : (list.data?.rows ?? [])).map((r) => ({ ...r, view: openRow(r) })),
    [list.data, list.isError],
  )
  const chips = flagChips(list.isError ? undefined : list.data, filter.flag)

  if (denied) return <Denied />

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))
  const search = () => {
    update((prev) => (prev.view === 'owed' ? { ...prev, store: draft.store } : { ...prev, ...draft }))
    void list.refetch()
  }
  const reset = () => {
    setDraft(draftOf(DEFAULT_OPEN_FILTER))
    update((prev) => ({ ...DEFAULT_OPEN_FILTER, view: prev.view }))
  }
  const setView = (view: OpenFilter['view']) =>
    update((prev) => (view === 'owed' ? { ...DEFAULT_OPEN_FILTER, view, store: prev.store } : { ...prev, view }))

  const select = (key: keyof Draft, label: string, codes: readonly string[], word: (c: string) => ReturnType<typeof stateWord>) => (
    <label className={FIELD}>
      {label}
      <select
        value={draft[key]}
        onChange={(e) => patch({ [key]: e.target.value })}
        className={`${INPUT} w-44`}
        data-ps-filter={key}
      >
        <option value="">{t('filters.any')}</option>
        {codes.map((c) => (
          <option key={c} value={c}>
            {wordText(tw, word(c))}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="flex flex-col gap-3" data-ps-open="" data-ps-view={filter.view}>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('views.label')}>
        {(['all', 'owed'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={filter.view === v}
            onClick={() => setView(v)}
            className={`rounded-full border px-3 py-1 text-sm font-medium ${
              filter.view === v ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 text-foreground hover:bg-muted'
            }`}
            data-ps-view-button={v}
          >
            {t(`views.${v}`)}
          </button>
        ))}
        {owedView && <span className="text-xs text-muted-foreground">{t('views.owedHint')}</span>}
      </div>

      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          search()
        }}
        data-ps-filters=""
      >
        <label className={FIELD}>
          {t('filters.store')}
          <input
            type="text"
            value={draft.store}
            onChange={(e) => patch({ store: e.target.value })}
            placeholder={t('filters.storePlaceholder')}
            aria-describedby="ps-store-hint"
            className={`${INPUT} w-28`}
            data-ps-filter="store"
          />
          <span id="ps-store-hint" className="font-normal" data-ps-store-hint="">
            {t('filters.storeHint')}
          </span>
        </label>
        {!owedView && (
          <>
            {select('state', t('filters.state'), OPEN_STATES, stateWord)}
            {select('owner', t('filters.owner'), PRESCRIPTION_STEP_OWNERS, ownerWord)}
            {select('source', t('filters.source'), PRESCRIPTION_SOURCE_KINDS, sourceWord)}
            <label className={FIELD}>
              {t('filters.minAge')}
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={draft.minAge}
                onChange={(e) => patch({ minAge: e.target.value })}
                className={`${INPUT} w-24`}
                data-ps-filter="minAge"
              />
            </label>
            <label className={FIELD}>
              {t('filters.maxAge')}
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={draft.maxAge}
                onChange={(e) => patch({ maxAge: e.target.value })}
                className={`${INPUT} w-24`}
                data-ps-filter="maxAge"
              />
            </label>
          </>
        )}
        <div className="flex items-center gap-2 self-start pt-5">
          <Button type="submit" disabled={list.isFetching} data-ps-search="">
            <Search className="h-3.5 w-3.5" aria-hidden />
            {t('filters.search')}
          </Button>
          <Button variant="outlined" onClick={reset} data-ps-reset="">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {t('filters.reset')}
          </Button>
        </div>
        {badFilter && (
          <p role="alert" className="basis-full text-xs text-danger-800" data-ps-bad-filter="">
            <bdi>{apiErrorMessage(list.error, t('filters.bad'))}</bdi>
          </p>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('flags.label')} data-ps-chips="">
        {chips.map((chip) => (
          <button
            key={chip.flag}
            type="button"
            aria-pressed={chip.pressed}
            disabled={owedView}
            onClick={() => update((prev) => withFlag(prev, chip.flag))}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium disabled:opacity-60 ${
              chip.pressed ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 text-foreground hover:bg-muted'
            }`}
            data-ps-chip={chip.flag}
          >
            {wordText(tw, flagWord(chip.flag))}
            {chip.count !== null && (
              <span className="tabular-nums" data-ps-chip-count="">
                <Ltr>{chip.count}</Ltr>
              </span>
            )}
          </button>
        ))}
      </div>

      {list.isError && !badFilter && (
        <ErrorBanner className="p-2.5" title={t('list.failedTitle')} message={apiErrorMessage(list.error, t('list.failed'))} />
      )}

      {list.data?.isTruncated && !list.isError && (
        <p className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-sm text-attention-800" role="status" data-ps-truncated="">
          <Trans
            t={t}
            i18nKey="list.truncated"
            values={{ shown: String(list.data.rows.length), total: String(list.data.total) }}
            components={{ n: <Ltr /> }}
          />
        </p>
      )}

      <div className="relative h-[calc(100vh-25rem)] min-h-96" data-ps-grid="">
        <AgGridReact<OpenGridRow>
          theme={omsGridTheme}
          rowData={rows}
          columnDefs={columns}
          defaultColDef={DEFAULT_COL_DEF}
          getRowId={({ data }) => data.sessionId}
          rowHeight={OMS_GRID_ROW_HEIGHT}
          headerHeight={OMS_GRID_HEADER_HEIGHT}
          tooltipShowDelay={500}
          animateRows={false}
          // Eighteen columns: render every one, so a cell off to the side is in the DOM for
          // find-in-page and for the drive.
          suppressColumnVirtualisation
          loading={list.isPending}
          noRowsOverlayComponent={NoRows}
          suppressNoRowsOverlay={list.isError}
        />
      </div>
      {!list.isError && (
        <div
          className="flex h-7 shrink-0 items-center gap-3 overflow-hidden rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
          data-status-bar=""
        >
          {list.isFetching ? (
            <span>{t('statusBar.loading')}</span>
          ) : (
            <span data-status-count="">
              <Trans t={t} i18nKey="statusBar.rows" count={list.data?.total ?? 0} values={{ n: String(list.data?.total ?? 0) }} components={{ n: <Ltr /> }} />
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function NoRows() {
  const { t } = useTranslation('prescription-sessions')
  return <span className="text-sm text-muted-foreground">{t('list.empty')}</span>
}
