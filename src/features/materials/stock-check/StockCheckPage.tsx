import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi } from 'ag-grid-community'
import { AlertTriangle, FileSpreadsheet, Layers, Plus, Warehouse, X } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import ScreenGate from '@/core/ui/ScreenGate'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { notify } from '@/core/services/notify'
import { lookupQueries } from '@/core/services/lookups'
import { formatPair, fsi } from '@/core/util/bidi'
import { gridSheet, writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'
import { materialAccessQuery } from '@/core/materials/api'
import { canCheckStock } from '@/core/materials/access'
import { STOCK_CAP_REFUSAL_KEY, STOCK_MATERIAL_CAP, STOCK_MATERIAL_PARAM } from '@/core/materials/stock-cap'
import { isStockUnavailable, materialStockQuery, stockRequest } from '@/core/materials/stock'
import StockUnavailable from '@/core/materials/StockUnavailable'
import {
  MATERIAL_ERRORS,
  type MaterialStockCell,
  type MaterialStockRequest,
  type MaterialStoreSetKind,
} from '@/core/models/materials'
import { STORE_SET_KINDS, stockCheckApi } from './api'
import { EXPORT_AS_TEXT, stockColumns } from './columns'
import { materialListText, parseMaterialList } from './material-list'
import {
  addStores,
  chosenFromLookup,
  chosenFromSet,
  clearStores,
  emptyStoreSelection,
  hasStoreChoice,
  matchesStore,
  removeStore,
  selectedStoreCodes,
  setAllStores,
  type StoreSelection,
} from './store-selection'

/**
 * Stock check (ticket 453, BackOffice spec 2544 stories 24–33): up to 50 materials × a store choice
 * — stores picked by code or name, whole sets added at once, or "All stores" — answered with live
 * ATP from Stock Visibility, broken down into SAP unrestricted, POS and OMS.
 *
 * Behind `canCheckStock` on the ONE Materials probe, the same predicate the menu leaf reads.
 * Its doors (`MaterialWeb/Stock`, `StoreSets`) are BackOffice 2548.
 */
export default function StockCheckPage() {
  const { t } = useTranslation('materials-stock-check')
  return (
    <ScreenGate query={materialAccessQuery()} can={canCheckStock} ns="materials-stock-check" title={t('title')} subtitle={t('subtitle')}>
      <StockCheck />
    </ScreenGate>
  )
}

type Row = MaterialStockCell

const DEFAULT_COL_DEF: ColDef<Row> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  filter: true,
  suppressHeaderMenuButton: true,
}

const PANEL = 'flex flex-col gap-2 rounded-lg border border-border/60 bg-card/40 p-3'
const FIELD = 'flex flex-col gap-1 text-xs font-medium text-muted-foreground'
const INPUT =
  'h-9 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none'
const TOGGLE = 'inline-flex items-center gap-1.5 text-xs font-medium text-foreground'

/** How many store matches the finder draws at once; the rest are reached by typing more. */
const FINDER_SHOWN = 20

/** The number a sentence names, grouped as figures are drawn across the app. */
const figure = (n: number) => n.toLocaleString('en-US')

function StockCheck() {
  const { t } = useTranslation('materials-stock-check')
  const [params] = useSearchParams()

  // ── Materials ──────────────────────────────────────────────────────────────────────────────
  // `?material=` (repeatable) prefills the box — what the search's "check stock for selected"
  // sends — and is read through the very same parse, de-duplication and cap as typing.
  const prefill = params.getAll(STOCK_MATERIAL_PARAM)
  const prefillKey = materialListText(prefill)
  const [draft, setDraft] = useState(prefillKey)
  useEffect(() => setDraft(prefillKey), [prefillKey])
  const list = useMemo(() => parseMaterialList(draft), [draft])

  // ── Stores ─────────────────────────────────────────────────────────────────────────────────
  const [selection, setSelection] = useState<StoreSelection>(emptyStoreSelection)
  const [includeClosed, setIncludeClosed] = useState(false)
  const [includeZero, setIncludeZero] = useState(false)

  // ── The check ──────────────────────────────────────────────────────────────────────────────
  // The request last asked, kept apart from the inputs: editing the box does not re-ask, Check does.
  const [asked, setAsked] = useState<MaterialStockRequest | null>(null)
  const stock = useQuery(materialStockQuery(asked))
  const errorCode = stock.isError ? apiErrorCode(stock.error) : null
  const unavailable = stock.isError && isStockUnavailable(stock.error)
  // The door's own refusals of the material list are said under the box, not over the grid.
  const materialsRefused =
    errorCode === MATERIAL_ERRORS.tooManyMaterials || errorCode === MATERIAL_ERRORS.noMaterials
  const rows = useMemo(() => (stock.isError ? [] : (stock.data?.cells ?? [])), [stock.isError, stock.data])

  const canCheck = list.materials.length > 0 && list.refused.length === 0 && hasStoreChoice(selection)

  function check() {
    if (!canCheck) return
    const request = stockRequest({
      materials: list.materials,
      stores: selectedStoreCodes(selection),
      includeZero,
      includeClosed,
    })
    // The same question again still asks again: stock moves by the minute.
    if (asked !== null && JSON.stringify(asked) === JSON.stringify(request)) void stock.refetch()
    else setAsked(request)
  }

  const columns = useMemo(() => stockColumns(t), [t])
  const gridApi = useRef<GridApi<Row> | null>(null)
  const [shown, setShown] = useState(0)

  /** The grid as shown — its columns, filters and sort — through the core writer. */
  async function exportXlsx() {
    const api = gridApi.current
    if (!api) return
    try {
      const sheet = gridSheet(api, t('export.sheet'), { asText: (colId) => EXPORT_AS_TEXT.has(colId) })
      await writeWorkbook([sheet], xlsxFileName(t('export.fileName')))
      notify.success(t('export.done'), t('export.doneDetail', { count: sheet.count, n: fsi(figure(sheet.count)) }))
    } catch {
      notify.error(t('export.failed'), t('export.failedDetail'))
    }
  }

  const whyNot =
    list.materials.length === 0
      ? t('check.needMaterials')
      : list.refused.length > 0
        ? null
        : !hasStoreChoice(selection)
          ? t('check.needStores')
          : null

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(18rem,1fr)_2fr]">
        {/* ── Materials ── */}
        <div className={PANEL} data-stock-materials-panel="">
          <label className={FIELD}>
            {t('materials.label')}
            <textarea
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                // The door's refusal was of the list as it WAS: once edited, it no longer stands.
                if (materialsRefused) setAsked(null)
              }}
              placeholder={t('materials.placeholder')}
              // The screen starts with the materials list: focused on landing.
              autoFocus
              rows={8}
              spellCheck={false}
              aria-invalid={list.refused.length > 0 || materialsRefused || undefined}
              aria-describedby="stock-materials-note"
              className="min-h-40 rounded-md border border-border/60 bg-background px-2.5 py-2 font-mono text-sm text-foreground focus:border-primary/50 focus:outline-none"
              data-stock-materials=""
            />
          </label>
          <div id="stock-materials-note" className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground" data-stock-material-count={list.materials.length}>
              <Trans
                t={t}
                i18nKey="materials.count"
                count={list.materials.length}
                values={{ n: figure(list.materials.length), max: figure(STOCK_MATERIAL_CAP) }}
                components={{ n: <Ltr />, max: <Ltr /> }}
              />
              {list.duplicates > 0 && (
                <>
                  {' '}
                  <Trans
                    t={t}
                    i18nKey="materials.duplicates"
                    count={list.duplicates}
                    values={{ n: figure(list.duplicates) }}
                    components={{ n: <Ltr /> }}
                  />
                </>
              )}
            </span>
            {/* The 51st is refused HERE, before any call — the door's MAT-00002, said first. */}
            {list.refused.length > 0 && (
              <p role="alert" className="flex items-center gap-1.5 text-danger-800" data-stock-cap-refused="">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  <Trans i18nKey={STOCK_CAP_REFUSAL_KEY} values={{ max: figure(STOCK_MATERIAL_CAP) }} components={{ n: <Ltr /> }} />
                </span>
              </p>
            )}
            {/* MAT-00002 / MAT-00003 from the door: inline under the box, in the server's words. */}
            {materialsRefused && (
              <p role="alert" className="flex items-center gap-1.5 text-danger-800" data-stock-materials-refused={errorCode ?? ''}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <bdi>{apiErrorMessage(stock.error, t('materials.refused'))}</bdi>
              </p>
            )}
          </div>
        </div>

        {/* ── Stores ── */}
        <StoresPanel
          selection={selection}
          onSelection={setSelection}
          includeClosed={includeClosed}
          onIncludeClosed={setIncludeClosed}
        />
      </div>

      {/* ── The check ── */}
      <div className="flex flex-wrap items-center gap-3">
        <label className={TOGGLE}>
          <input type="checkbox" checked={includeZero} onChange={(e) => setIncludeZero(e.target.checked)} data-stock-include-zero="" />
          {t('options.includeZero')}
        </label>
        <Button onClick={check} disabled={!canCheck || stock.isFetching} data-stock-check="">
          <Warehouse className="h-3.5 w-3.5" aria-hidden />
          {t('check.button')}
        </Button>
        {whyNot && (
          <span className="text-xs text-muted-foreground" data-stock-why-not="">
            {whyNot}
          </span>
        )}
      </div>

      {/* ── The answer ── */}
      {asked === null ? (
        <p className="px-1 text-[11.5px] text-muted-foreground" data-stock-not-checked="">
          {t('results.notChecked')}
        </p>
      ) : unavailable ? (
        // 🚩 MAT-00004 is NEVER an empty grid: an outage must not read as "no stock".
        <StockUnavailable onRetry={() => void stock.refetch()} retrying={stock.isFetching} />
      ) : stock.isError && !materialsRefused ? (
        <ErrorBanner className="p-2.5" title={t('results.failedTitle')} message={apiErrorMessage(stock.error, t('results.failed'))} />
      ) : (
        !stock.isError && (
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outlined"
                disabled={stock.isFetching || shown === 0}
                onClick={() => void exportXlsx()}
                data-stock-export=""
              >
                <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
                {t('export.button')}
              </Button>
            </div>
            <div className="relative h-[calc(100vh-30rem)] min-h-80" data-stock-grid="">
              <AgGridReact<Row>
                theme={omsGridTheme}
                rowData={rows}
                columnDefs={columns}
                defaultColDef={DEFAULT_COL_DEF}
                onGridReady={({ api }) => {
                  gridApi.current = api
                }}
                onModelUpdated={({ api }) => setShown(api.getDisplayedRowCount())}
                rowHeight={OMS_GRID_ROW_HEIGHT}
                headerHeight={OMS_GRID_HEADER_HEIGHT}
                tooltipShowDelay={500}
                animateRows={false}
                loading={stock.isFetching && !stock.data}
                noRowsOverlayComponent={NoCells}
              />
            </div>
            <div
              className="flex h-7 shrink-0 items-center gap-4 rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
              data-stock-summary=""
            >
              {stock.isFetching ? (
                <span>{t('results.loading')}</span>
              ) : (
                <>
                  <span data-stock-summary-materials={stock.data?.materialsAsked ?? 0}>
                    <Trans t={t} i18nKey="summary.materials" values={{ n: figure(stock.data?.materialsAsked ?? 0) }} components={{ n: <Ltr /> }} />
                  </span>
                  <span data-stock-summary-stores={stock.data?.storesAsked ?? 0}>
                    <Trans t={t} i18nKey="summary.stores" values={{ n: figure(stock.data?.storesAsked ?? 0) }} components={{ n: <Ltr /> }} />
                  </span>
                  <span data-stock-summary-cells={shown}>
                    <Trans t={t} i18nKey="summary.cells" values={{ n: figure(shown) }} components={{ n: <Ltr /> }} />
                  </span>
                </>
              )}
            </div>
          </div>
        )
      )}
    </div>
  )
}

/**
 * The store choice: find a store by code or name (the session-cached store lookup), add a whole
 * area / city / district / supervisor set, or "All stores"; the chosen stores are removable chips.
 */
function StoresPanel({
  selection,
  onSelection,
  includeClosed,
  onIncludeClosed,
}: {
  selection: StoreSelection
  onSelection: (change: (prev: StoreSelection) => StoreSelection) => void
  includeClosed: boolean
  onIncludeClosed: (on: boolean) => void
}) {
  const { t } = useTranslation('materials-stock-check')

  // Find a store: the ungated store lookup, asked once a word is typed and shared session-wide.
  const [find, setFind] = useState('')
  const lookup = useQuery({ ...lookupQueries.storeDetails(), enabled: find.trim() !== '' })
  const chosen = useMemo(() => new Set(selection.stores.map((s) => s.storeCode)), [selection.stores])
  const matches = useMemo(
    () => (lookup.data ?? []).filter((s) => matchesStore(s, find)).map(chosenFromLookup),
    [lookup.data, find],
  )

  // Add a set: a kind, then one of its values with its store count.
  const [kind, setKind] = useState<MaterialStoreSetKind | ''>('')
  const [setValue, setSetValue] = useState('')
  const sets = useQuery({
    queryKey: ['materials', 'storeSets', kind],
    queryFn: () => stockCheckApi.storeSets(kind as MaterialStoreSetKind),
    enabled: kind !== '',
    staleTime: 5 * 60_000,
    retry: false,
  })
  const addSet = useMutation({
    mutationFn: () => stockCheckApi.storeSetStores(kind as MaterialStoreSetKind, setValue, includeClosed),
    onSuccess: (stores) => {
      onSelection((s) => addStores(s, stores.map(chosenFromSet)))
      setSetValue('')
    },
  })

  const count = selection.stores.length

  return (
    <div className={PANEL} data-stock-stores-panel="">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-xs font-medium text-muted-foreground">{t('stores.label')}</span>
        <label className={TOGGLE}>
          <input
            type="checkbox"
            checked={selection.all}
            onChange={(e) => onSelection((s) => setAllStores(s, e.target.checked))}
            data-stock-all-stores=""
          />
          {t('stores.all')}
        </label>
        <label className={TOGGLE}>
          <input type="checkbox" checked={includeClosed} onChange={(e) => onIncludeClosed(e.target.checked)} data-stock-include-closed="" />
          {t('options.includeClosed')}
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {/* By code or name */}
        <div className="relative min-w-[16rem] flex-1">
          <label className={FIELD}>
            {t('stores.find')}
            <input
              type="search"
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder={t('stores.findPlaceholder')}
              autoComplete="off"
              className={INPUT}
              data-stock-store-find=""
            />
          </label>
          {find.trim() !== '' && (
            <div
              className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-md border border-border bg-card p-1 shadow-pop"
              data-stock-store-matches=""
            >
              {lookup.isPending ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">{t('stores.loading')}</p>
              ) : lookup.isError ? (
                <p className="px-2 py-1.5 text-xs text-danger-800">
                  <bdi>{apiErrorMessage(lookup.error, t('stores.loadFailed'))}</bdi>
                </p>
              ) : matches.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">{t('stores.noMatch')}</p>
              ) : (
                <>
                  {matches.slice(0, FINDER_SHOWN).map((store) => (
                    <button
                      key={store.storeCode}
                      type="button"
                      disabled={chosen.has(store.storeCode)}
                      onClick={() => onSelection((s) => addStores(s, [store]))}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-sm hover:bg-accent disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
                      data-stock-store-option={store.storeCode}
                    >
                      <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {/* A pair led by a machine value: one string, isolated once. */}
                      <Ltr>{formatPair(store.storeCode, store.storeName)}</Ltr>
                    </button>
                  ))}
                  {matches.length > FINDER_SHOWN && (
                    <p className="px-2 py-1 text-[11px] text-muted-foreground">
                      <Trans
                        t={t}
                        i18nKey="stores.more"
                        count={matches.length - FINDER_SHOWN}
                        values={{ n: figure(matches.length - FINDER_SHOWN) }}
                        components={{ n: <Ltr /> }}
                      />
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* A whole set */}
        <label className={FIELD}>
          {t('sets.kind')}
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as MaterialStoreSetKind | '')
              setSetValue('')
              addSet.reset()
            }}
            className={INPUT}
            data-stock-set-kind=""
          >
            <option value="">{t('sets.chooseKind')}</option>
            {STORE_SET_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`sets.kinds.${k}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={FIELD}>
          {t('sets.value')}
          <select
            value={setValue}
            onChange={(e) => {
              setSetValue(e.target.value)
              addSet.reset()
            }}
            disabled={kind === '' || !sets.data}
            className={`${INPUT} min-w-[12rem]`}
            data-stock-set-value=""
          >
            <option value="">{sets.isFetching ? t('sets.loading') : t('sets.chooseValue')}</option>
            {(sets.data ?? []).map((set) => (
              <option key={set.value} value={set.value}>
                {t('sets.option', { count: set.storeCount, label: fsi(set.label || set.value), n: fsi(figure(set.storeCount)) })}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="outlined"
          className="h-9"
          disabled={kind === '' || setValue === '' || addSet.isPending}
          onClick={() => addSet.mutate()}
          data-stock-set-add=""
        >
          <Layers className="h-3.5 w-3.5" aria-hidden />
          {t('sets.add')}
        </Button>
      </div>
      {(sets.isError || addSet.isError) && (
        <p role="alert" className="text-xs text-danger-800" data-stock-set-failed="">
          <bdi>{apiErrorMessage(sets.error ?? addSet.error, t('sets.failed'))}</bdi>
        </p>
      )}

      {/* The chosen stores */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span data-stock-store-count={count}>
          {selection.all ? (
            t('stores.allChosen')
          ) : (
            <Trans t={t} i18nKey="stores.count" count={count} values={{ n: figure(count) }} components={{ n: <Ltr /> }} />
          )}
        </span>
        {count > 0 && !selection.all && (
          <Button variant="text" className="h-6 px-1.5 text-xs" onClick={() => onSelection(clearStores)} data-stock-stores-clear="">
            {t('stores.clear')}
          </Button>
        )}
      </div>
      {count > 0 && !selection.all && (
        <ul className="flex max-h-32 flex-wrap gap-1.5 overflow-auto" data-stock-chips="">
          {selection.stores.map((store) => (
            <li
              key={store.storeCode}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background py-0.5 ps-2.5 pe-1 text-xs"
              data-stock-chip={store.storeCode}
            >
              <Ltr>{formatPair(store.storeCode, store.storeName)}</Ltr>
              <button
                type="button"
                onClick={() => onSelection((s) => removeStore(s, store.storeCode))}
                aria-label={t('stores.remove', { store: fsi(store.storeCode) })}
                title={t('stores.remove', { store: fsi(store.storeCode) })}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                data-stock-chip-remove=""
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** An answer with no cell — every figure was zero (and zeros were left out), not a failure. */
function NoCells() {
  const { t } = useTranslation('materials-stock-check')
  return <span className="text-sm text-muted-foreground">{t('results.empty')}</span>
}
