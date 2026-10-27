import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi, RowSelectedEvent, RowSelectionOptions } from 'ag-grid-community'
import { AlertTriangle, FileSpreadsheet, RotateCcw, ScanSearch, Search, Warehouse } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { pinStart } from '@/core/theme/direction'
import ScreenGate from '@/core/ui/ScreenGate'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { notify } from '@/core/services/notify'
import { formatPair, fsi } from '@/core/util/bidi'
import { gridSheet, writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'
import { materialAccessQuery } from '@/core/materials/api'
import { canCheckStock, canSearchMaterials } from '@/core/materials/access'
import { STOCK_CAP_REFUSAL_KEY, STOCK_MATERIAL_CAP, overStockCap, stockCheckHref } from '@/core/materials/stock-cap'
import {
  MATERIAL_ERRORS,
  type MaterialFacetKind,
  type MaterialFacetValue,
  type MaterialLevel,
  type MaterialSearchRow,
} from '@/core/models/materials'
import { materialSearchApi } from './api'
import { EXPORT_AS_TEXT, isExportSkipped, materialColumns, materialPath } from './columns'
import FilterPicker, { TriStateFilter, type PickerOption } from './FilterPicker'
import { cascade, levelsAbove, pickLevel } from './level-cascade'
import { resolvedChip } from './resolved-chip'
import {
  FACET_FILTERS,
  MATERIAL_LEVELS,
  TAKE_CHOICES,
  emptySearch,
  hasSearch,
  parseItemType,
  searchFromParams,
  searchQueryString,
  searchToParams,
  type MaterialSearchState,
} from './search-query'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'

/**
 * Material search (ticket 451, BackOffice spec 2544): one smart box, the A → E level cascade, the
 * side filters, a grid that opens a material, an xlsx export, and "check stock for selected".
 *
 * Behind `canSearchMaterials` on the ONE Materials probe, the same predicate the menu leaf reads.
 * Its doors (`MaterialWeb/Search`, `Levels`, `Facets`) are BackOffice 2545/2546.
 */
export default function MaterialSearchPage() {
  const { t } = useTranslation('materials-search')
  return (
    <ScreenGate query={materialAccessQuery()} can={canSearchMaterials} ns="materials-search" title={t('title')} subtitle={t('subtitle')}>
      <MaterialSearch />
    </ScreenGate>
  )
}

type Row = MaterialSearchRow

const DEFAULT_COL_DEF: ColDef<Row> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  filter: true,
  suppressHeaderMenuButton: true,
}

/** Ticking is only for "check stock for selected": no select-all, which would tick past the cap. */
const ROW_SELECTION: RowSelectionOptions<Row> = {
  mode: 'multiRow',
  checkboxes: true,
  headerCheckbox: false,
  enableClickSelection: false,
}

/** The number a sentence names, grouped as figures are drawn across the app. */
const figure = (n: number) => n.toLocaleString('en-US')

const levelOption = (code: string, description: string | null): PickerOption => ({
  value: code,
  text: formatPair(code, description),
  machine: true,
})

function MaterialSearch() {
  const { t } = useTranslation('materials-search')
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  // 🔑 The URL is the single source of truth: the state is READ from it every render and every
  // change is WRITTEN back to it. Replace, not push — Back leaves the screen rather than stepping
  // through each filter tweak; a material opened from the grid is a push, so Back returns here.
  const state = useMemo(() => searchFromParams(params), [params])
  const queryString = searchQueryString(state)

  // ⚠️ A write reaches `state` only once the router's navigation lands, which is async: two quick
  // changes (untick A006, tick A008) composed against `state` would each start from the SAME old
  // URL and the second would undo the first. So every change is an UPDATER applied to the latest
  // state written (`latest`), and the URL echoes we are still waiting for are remembered so that
  // only a change from outside (Back, a pasted link) resets `latest`.
  const latest = useRef(state)
  const echoes = useRef<string[]>([])
  useEffect(() => {
    const mine = echoes.current.indexOf(queryString)
    if (mine >= 0) echoes.current.splice(0, mine + 1)
    else {
      echoes.current = []
      latest.current = state
    }
  }, [queryString, state])
  const update = useCallback(
    (change: (prev: MaterialSearchState) => MaterialSearchState) => {
      const prev = latest.current
      const next = change(prev)
      const qs = searchToParams(next)
      if (qs.toString() === searchQueryString(prev)) return
      latest.current = next
      echoes.current.push(qs.toString())
      setParams(qs, { replace: true })
    },
    [setParams],
  )

  const access = useQuery(materialAccessQuery())
  const stockAllowed = canCheckStock(access.data)

  const gridApi = useRef<GridApi<Row> | null>(null)
  const [shown, setShown] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [capRefused, setCapRefused] = useState(false)
  const [openPicker, setOpenPicker] = useState<string | null>(null)
  const [levelFind, setLevelFind] = useState('')
  const [itemTypeFind, setItemTypeFind] = useState('')

  // The box is a draft until Search; a URL change (Back, a shared link, Clear) resets it.
  const [draft, setDraft] = useState(state.q)
  useEffect(() => setDraft(state.q), [state.q])

  const searching = hasSearch(state)
  const search = useQuery({
    queryKey: ['materials', 'search', queryString],
    queryFn: () => materialSearchApi.search(state),
    enabled: searching,
    retry: false,
  })
  const tooShort = search.isError && apiErrorCode(search.error) === MATERIAL_ERRORS.searchTooShort
  const rows = useMemo(
    () => (searching && !search.isError ? (search.data?.rows ?? []) : []),
    [searching, search.isError, search.data],
  )
  const chip = searching ? resolvedChip(search.data, state.q) : null

  // ── The level cascade ───────────────────────────────────────────────────────────────────────
  // One query per level, asked with the choices ABOVE it. A level's list is loaded while its
  // picker is open, or while it holds a choice that may need dropping.
  const levelQueries = useQueries({
    queries: MATERIAL_LEVELS.map((level) => ({
      queryKey: ['materials', 'levels', level, levelsAbove(state.levels, level)],
      queryFn: () => materialSearchApi.levels(level, state.levels),
      enabled: openPicker === `level${level}` || state.levels[level].length > 0,
      staleTime: 5 * 60_000,
      retry: false,
    })),
  })
  const levelData = levelQueries.map((q) => q.data)
  // When a level's options arrive, drop any choice there that is no longer offered — ONE write
  // for the whole cascade, so two levels settling together never overwrite each other. The drop
  // changes the filters the next level is asked with, and the cascade runs on until it settles.
  useEffect(() => {
    const offered: Partial<Record<MaterialLevel, NonNullable<(typeof levelData)[number]>>> = {}
    MATERIAL_LEVELS.forEach((level, i) => {
      if (levelData[i]) offered[level] = levelData[i]
    })
    // Only against a settled URL: the options were asked under `state`'s levels, and a write
    // still in flight may have changed the levels above.
    if (echoes.current.length > 0) return
    update((s) => {
      const next = cascade(s.levels, offered)
      return next === s.levels ? s : { ...s, levels: next }
    })
    // `levelData` is five entries, each a stable query result: listed one by one, so the effect
    // runs when a level's options change and not on every render.
  }, [state, update, levelData[0], levelData[1], levelData[2], levelData[3], levelData[4]])

  const columns = useMemo(() => materialColumns(t), [t])

  const pickerOpen = (name: string) => ({
    open: openPicker === name,
    onOpenChange: (open: boolean) => {
      setOpenPicker(open ? name : null)
      // The five level pickers share one Find box's text: start each opening afresh, so what was
      // typed for A never narrows B's list.
      if (open) setLevelFind('')
    },
  })

  function submit() {
    // Search with an unchanged box still asks again: a material may have changed since.
    if (draft.trim() === latest.current.q && searching) void search.refetch()
    else update((s) => ({ ...s, q: draft.trim() }))
  }

  function clearAll() {
    setDraft('')
    update(() => emptySearch())
  }

  // The ticks in the order they were made. A range tick fires one event per row AFTER the grid
  // has selected them all, so the grid's own count is already past the cap for every one of them;
  // counting here instead keeps the rows that fit and refuses only the ones past the cap.
  const ticked = useRef<string[]>([])

  /** Refuse the 51st tick: untick it again and say why (the stock check's own cap). */
  function onRowSelected({ node, data }: RowSelectedEvent<Row>) {
    if (!data) return
    const no = data.materialNumber
    if (!node.isSelected()) {
      ticked.current = ticked.current.filter((m) => m !== no)
      return
    }
    if (ticked.current.includes(no)) return
    if (overStockCap(ticked.current.length + 1)) {
      node.setSelected(false)
      setCapRefused(true)
      return
    }
    ticked.current = [...ticked.current, no]
  }

  function checkStock() {
    const href = stockCheckHref(selected)
    if (href) void navigate(href)
  }

  /** The result as shown — its columns, its column filters, its sort — through the core writer. */
  async function exportXlsx() {
    const api = gridApi.current
    if (!api) return
    try {
      const sheet = gridSheet(api, t('export.sheet'), {
        skip: isExportSkipped,
        asText: (colId) => EXPORT_AS_TEXT.has(colId),
      })
      await writeWorkbook([sheet], xlsxFileName(t('export.fileName')))
      notify.success(t('export.done'), t('export.doneDetail', { count: sheet.count, n: fsi(String(sheet.count)) }))
    } catch {
      notify.error(t('export.failed'), t('export.failedDetail'))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ── The smart box ── */}
      <form
        className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/40 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        data-material-box=""
      >
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t('box.label')} className="min-w-[22rem] flex-1">
            <Input
              type="search"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('box.placeholder')}
              // The screen starts with typing or a scan: focused on landing.
              autoFocus
              aria-invalid={tooShort || undefined}
              aria-describedby={tooShort ? 'material-search-too-short' : undefined}
              data-material-q=""
            />
          </Field>
          <Button type="submit" disabled={search.isFetching} data-material-search="">
            <Search className="h-3.5 w-3.5" aria-hidden />
            {t('box.search')}
          </Button>
          <Button variant="outlined" onClick={clearAll} data-material-clear="">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {t('box.clear')}
          </Button>
          {/* MAT-00006 beside the box, never a toast: the server's own sentence. */}
          {tooShort && (
            <p
              id="material-search-too-short"
              role="alert"
              className="flex items-center gap-1.5 self-center text-xs text-danger-800"
              data-material-too-short=""
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <bdi>{apiErrorMessage(search.error, t('box.tooShort'))}</bdi>
            </p>
          )}
        </div>
        {chip && (
          <p
            className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary-050 px-2.5 py-0.5 text-xs text-primary-800"
            data-resolved-chip={chip.kind}
          >
            <ScanSearch className="h-3.5 w-3.5" aria-hidden />
            <span>
              <Trans
                t={t}
                i18nKey={chip.labelKey}
                {...(chip.material === null ? { count: chip.count } : {})}
                values={{ from: chip.from, material: chip.material, n: figure(chip.count) }}
                components={{ from: <Ltr />, material: <Ltr />, n: <Ltr /> }}
              />
            </span>
          </p>
        )}

        {/* ── The A → E levels, then the side filters ── */}
        <div className="flex flex-wrap items-center gap-2" data-material-levels="">
          {MATERIAL_LEVELS.map((level, i) => {
            const q = levelQueries[i]
            return (
              <FilterPicker
                key={level}
                name={`level${level}`}
                label={t(`filters.level${level}`)}
                selected={state.levels[level]}
                onChange={(change) => update((s) => ({ ...s, levels: pickLevel(s.levels, level, change(s.levels[level])) }))}
                options={(q.data ?? []).map((v) => levelOption(v.code, v.description))}
                textOf={(code) => levelOption(code, null)}
                {...pickerOpen(`level${level}`)}
                query={levelFind}
                onQuery={setLevelFind}
                loading={q.isFetching && !q.data}
                failed={q.isError}
                filterLocally
              />
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2" data-material-side-filters="">
          {FACET_FILTERS.map((kind) => (
            <FacetPicker
              key={kind}
              kind={kind}
              label={t(`filters.${kind}`)}
              selected={state[kind]}
              onChange={(change) => update((s) => ({ ...s, [kind]: change(s[kind]) }))}
              {...pickerOpen(kind)}
            />
          ))}
          <FilterPicker
            name="itemType"
            label={t('filters.itemType')}
            selected={state.itemType.map(String)}
            onChange={(change) => update((s) => ({ ...s, itemType: change(s.itemType.map(String)).map(Number) }))}
            options={[]}
            textOf={(value) => ({ value, text: value, machine: true })}
            {...pickerOpen('itemType')}
            query={itemTypeFind}
            onQuery={setItemTypeFind}
            entry={(typed) => {
              const n = parseItemType(typed)
              return n === null ? null : String(n)
            }}
            placeholder={t('filters.itemTypeHint')}
          />
          <TriStateFilter name="blocked" label={t('filters.blocked')} value={state.blocked} onChange={(blocked) => update((s) => ({ ...s, blocked }))} />
          <TriStateFilter
            name="serialised"
            label={t('filters.serialised')}
            value={state.serialised}
            onChange={(serialised) => update((s) => ({ ...s, serialised }))}
          />
          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            {t('filters.take')}
            <Select
              value={String(state.take ?? TAKE_CHOICES[0])}
              onChange={(e) => {
                const n = Number(e.target.value)
                update((s) => ({ ...s, take: n === TAKE_CHOICES[0] ? null : n }))
              }}
              data-material-take=""
            >
              {[...new Set([...TAKE_CHOICES, state.take ?? TAKE_CHOICES[0]])].map((n) => (
                <option key={n} value={String(n)}>
                  {fsi(figure(n))}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </form>

      {search.isError && !tooShort && (
        <ErrorBanner className="p-2.5" title={t('results.failedTitle')} message={apiErrorMessage(search.error, t('results.failed'))} />
      )}

      {search.data?.limited && searching && !search.isError && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-attention-border bg-attention-050 px-3 py-2 text-[0.8125rem] text-attention-800"
          data-material-limited=""
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          {t('results.limited')}
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {capRefused && (
            <p role="alert" className="me-auto text-xs text-danger-800" data-stock-cap-refused="">
              <Trans
                i18nKey={STOCK_CAP_REFUSAL_KEY}
                values={{ max: figure(STOCK_MATERIAL_CAP) }}
                components={{ n: <Ltr /> }}
              />
            </p>
          )}
          {stockAllowed && (
            <Button variant="secondary" disabled={selected.length === 0} onClick={checkStock} data-material-check-stock="">
              <Warehouse className="h-3.5 w-3.5" aria-hidden />
              {t('stock.button')}
              {selected.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums" data-selected-count="">
                  <Ltr>{selected.length}</Ltr>
                </span>
              )}
            </Button>
          )}
          <Button
            variant="outlined"
            disabled={search.isError || search.isFetching || shown === 0}
            onClick={() => void exportXlsx()}
            data-material-export=""
          >
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            {t('export.button')}
          </Button>
        </div>
        <div className="relative h-[calc(100vh-26rem)] min-h-96" data-material-grid="">
          <AgGridReact<Row>
            theme={omsGridTheme}
            rowData={rows}
            columnDefs={columns}
            defaultColDef={DEFAULT_COL_DEF}
            getRowId={({ data }) => data.materialNumber}
            rowSelection={stockAllowed ? ROW_SELECTION : undefined}
            // The tick box sits first, at the reading start, before the pinned material.
            selectionColumnDef={{ pinned: pinStart, width: 44, resizable: false, suppressHeaderMenuButton: true }}
            onRowSelected={onRowSelected}
            onSelectionChanged={({ api }) => {
              const now = api.getSelectedRows().map((r) => r.materialNumber)
              // A new answer drops rows (and their ticks) without a rowSelected event per row.
              ticked.current = ticked.current.filter((m) => now.includes(m))
              setSelected(now)
              if (now.length < STOCK_MATERIAL_CAP) setCapRefused(false)
            }}
            onGridReady={({ api }) => {
              gridApi.current = api
            }}
            onRowDoubleClicked={({ data }) => {
              if (data) void navigate(materialPath(data.materialNumber))
            }}
            onModelUpdated={({ api }) => setShown(api.getDisplayedRowCount())}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            tooltipShowDelay={500}
            animateRows={false}
            // Sixteen columns: render every one, so a cell off to the side is in the DOM for
            // find-in-page and for the drive.
            suppressColumnVirtualisation
            loading={searching && search.isFetching && !search.data}
            noRowsOverlayComponent={NoRows}
            suppressNoRowsOverlay={search.isError || !searching}
          />
        </div>
        {!searching ? (
          <p className="flex h-7 items-center px-3 text-[11.5px] text-muted-foreground" data-material-not-searched="">
            {t('results.notSearched')}
          </p>
        ) : (
          !search.isError && (
            <div
              className="flex h-7 shrink-0 items-center gap-3 rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
              data-status-bar=""
            >
              {search.isFetching ? (
                <span>{t('results.loading')}</span>
              ) : (
                <span data-status-count="">
                  <Trans t={t} i18nKey="results.count" count={rows.length} values={{ n: figure(rows.length) }} components={{ n: <Ltr /> }} />
                </span>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}

/** A side filter's typeahead: `MaterialWeb/Facets` asked while the panel is open, as you type. */
function FacetPicker({
  kind,
  label,
  selected,
  onChange,
  open,
  onOpenChange,
}: {
  kind: MaterialFacetKind
  label: string
  selected: string[]
  onChange: (change: (prev: string[]) => string[]) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [find, setFind] = useState('')
  const q = useDebounced(find.trim(), 250)
  const facets = useQuery({
    queryKey: ['materials', 'facets', kind, q],
    queryFn: () => materialSearchApi.facets(kind, q),
    enabled: open,
    staleTime: 60_000,
    retry: false,
  })
  // A vendor's value is its NUMBER: drawn as the pair `number · name`, led by the number.
  const option = (f: MaterialFacetValue): PickerOption =>
    kind === 'vendor'
      ? { value: f.value, text: formatPair(f.value, f.label), machine: true }
      : { value: f.value, text: f.label || f.value, machine: false }
  return (
    <FilterPicker
      name={kind}
      label={label}
      selected={selected}
      onChange={onChange}
      options={(facets.data ?? []).map(option)}
      textOf={(value) => option({ value, label: null })}
      open={open}
      onOpenChange={onOpenChange}
      query={find}
      onQuery={setFind}
      loading={facets.isFetching}
      failed={facets.isError}
    />
  )
}

/** `value`, once it has stood still for `ms`. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return settled
}

/** An empty answer — nothing matches, not a failure. */
function NoRows() {
  const { t } = useTranslation('materials-search')
  return <span className="text-sm text-muted-foreground">{t('results.empty')}</span>
}
