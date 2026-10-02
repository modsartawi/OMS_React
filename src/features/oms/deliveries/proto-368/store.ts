/* PROTOTYPE 368 — in-memory state for every variant (no persistence: the
 * localStorage-per-user store is 366's decision, not this prototype's question).
 * Module-scoped like today's search-store, so a drill-down and back restores it. */
import { create } from 'zustand'
import { toast } from 'sonner'
import type { ColumnState, FilterModel, GridApi } from 'ag-grid-community'
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import { apiErrorMessage } from '@/core/api'
import { deliveriesApi } from '../api'
import { deliveryRowKey } from '../search-store'
import { c } from './copy'
import {
  BLANK,
  DEFAULT_LIMIT,
  lensTest,
  sameCriteria,
  toCriteria,
  type LensKey,
  type ProtoCriteria,
} from './model'

type Row = DeliveryDocumentModel

export interface SavedView {
  id: string
  name: string
  starred: boolean
  /** null = a layout-only view imported once from the old Angular key (366). */
  criteria: ProtoCriteria | null
  lens: LensKey
  columnState: ColumnState[] | null
  filterModel: FilterModel | null
}

interface S {
  draft: ProtoCriteria
  applied: ProtoCriteria | null
  rows: Row[] | null
  searching: boolean
  error: string | null
  lens: LensKey
  activeViewId: string | null
  views: SavedView[]
  columnState: ColumnState[] | null
  filterModel: FilterModel | null
  shown: number
  selectedKey: string | null
  inspectorOpen: boolean
  inspectorWidth: number
  criteriaOpen: boolean
  gridApi: GridApi<Row> | null
}

export const INSPECTOR = { def: 360, min: 320, max: 560 }

/** Normalised layout for drift comparison (width counts: a resize IS a layout change). */
const norm = (cs: ColumnState[] | null) =>
  JSON.stringify((cs ?? []).map((s) => [s.colId, !!s.hide, s.pinned ?? null, s.sort ?? null, s.width ?? null]))
const fm = (f: FilterModel | null) => JSON.stringify(f ?? {})

let seq = 0
const newId = () => `v${Date.now().toString(36)}${seq++}`

const MONEY_ONLY_HIDDEN = [
  'documentNo', 'orderNo', 'documentType', 'deliveryType', 'deliveryDocumentType', 'isExpressDelivery',
  'documentSource', 'documentReason', 'entryTime', 'documentDate', 'customerPhone', 'isActiveInStore',
  'timeSlotDescription', 'timeSlotDay', 'note', 'cityName', 'street1',
]

export function seedViews(starFirst: boolean): SavedView[] {
  return [
    {
      id: 'v-store',
      name: 'Store 1017 · today',
      starred: starFirst,
      criteria: { ...BLANK, storeCode: '1017', range: { preset: 'today' } },
      lens: 'all',
      columnState: null,
      filterModel: null,
    },
    {
      id: 'v-failed',
      name: 'Failed jobs · last 3 days',
      starred: false,
      criteria: { ...BLANK, range: { preset: 'last3' } },
      lens: 'attention',
      columnState: null,
      filterModel: null,
    },
    {
      id: 'v-week',
      name: 'Whole week · newest 30',
      starred: false,
      criteria: { ...BLANK, range: { preset: 'last7' }, limit: 30 },
      lens: 'all',
      columnState: null,
      filterModel: null,
    },
    {
      id: 'v-old',
      name: 'Money columns',
      starred: false,
      criteria: null,
      lens: 'all',
      columnState: MONEY_ONLY_HIDDEN.map((colId) => ({ colId, hide: true })),
      filterModel: null,
    },
  ]
}

export const useProto = create<S>(() => ({
  draft: { ...BLANK, limit: DEFAULT_LIMIT },
  applied: null,
  rows: null,
  searching: false,
  error: null,
  lens: 'all',
  activeViewId: null,
  views: seedViews(true),
  columnState: null,
  filterModel: null,
  shown: 0,
  selectedKey: null,
  inspectorOpen: true,
  inspectorWidth: INSPECTOR.def,
  criteriaOpen: true,
  gridApi: null,
}))

const get = () => useProto.getState()
const set = useProto.setState

export const isCut = (s: Pick<S, 'rows' | 'applied'>) =>
  s.rows !== null && s.rows.length === (s.applied?.limit || DEFAULT_LIMIT)

export function lensRows(s: Pick<S, 'rows' | 'lens'>): Row[] {
  return (s.rows ?? []).filter(lensTest(s.lens))
}

export function selectedRow(s: Pick<S, 'rows' | 'selectedKey'>): Row | null {
  if (!s.selectedKey) return null
  return s.rows?.find((r) => deliveryRowKey(r) === s.selectedKey) ?? null
}

export function activeView(s: Pick<S, 'views' | 'activeViewId'>): SavedView | null {
  return s.views.find((v) => v.id === s.activeViewId) ?? null
}

/** The modified dot: criteria, lens, columns or grid filters drifted from what was saved. */
export function isModified(s: S): boolean {
  const v = activeView(s)
  if (!v) return false
  if (v.criteria && !sameCriteria(v.criteria, s.applied)) return true
  if (v.criteria && v.lens !== s.lens) return true
  if (v.columnState) {
    // A full captured layout compares exactly; the imported layout-only seed carries only hide flags.
    const full = v.columnState[0]?.width !== undefined
    const drift = full
      ? norm(v.columnState) !== norm(s.columnState)
      : v.columnState.some((p) => !!s.columnState?.find((x) => x.colId === p.colId)?.hide !== !!p.hide)
    if (drift) return true
  }
  return fm(v.filterModel) !== fm(s.filterModel)
}

// ---------- actions --------------------------------------------------------------

export function setDraft(patch: Partial<ProtoCriteria>) {
  set({ draft: { ...get().draft, ...patch } })
}

export function discardDraft() {
  set({ draft: get().applied ?? { ...BLANK, limit: DEFAULT_LIMIT } })
}

export async function runSearch() {
  const criteria = get().draft
  set({ searching: true, error: null, applied: criteria })
  try {
    const rows = await deliveriesApi.search(toCriteria(criteria))
    const key = get().selectedKey
    set({
      rows,
      searching: false,
      selectedKey: key && rows.some((r) => deliveryRowKey(r) === key) ? key : null,
    })
  } catch (err) {
    const message = apiErrorMessage(err, 'Unexpected error running the search.')
    set({ searching: false, error: message })
    toast.error('Search failed', { description: message })
  }
}

export function setLens(lens: LensKey) {
  set({ lens })
  const api = get().gridApi
  api?.onFilterChanged()
}

/** Apply a layout to the store AND the live grid (whichever variant's grid is mounted). */
function applyLayout(columnState: ColumnState[] | null, filterModel: FilterModel | null) {
  const api = get().gridApi
  if (api) {
    api.resetColumnState()
    if (columnState) api.applyColumnState({ state: columnState, applyOrder: !!columnState[0]?.width })
    api.setFilterModel(filterModel ?? null)
    set({ columnState: api.getColumnState(), filterModel: api.getFilterModel() })
  } else {
    set({ columnState, filterModel })
  }
}

/** A saved view whose layout was never captured adopts the grid's current layout as its baseline. */
export function adoptBaseline() {
  const s = get()
  const v = activeView(s)
  if (!v || !s.gridApi) return
  const full = s.gridApi.getColumnState()
  set({
    views: s.views.map((x) => (x.id === v.id ? { ...x, columnState: full, filterModel: s.gridApi!.getFilterModel() } : x)),
    columnState: full,
    filterModel: s.gridApi.getFilterModel(),
  })
}

export function applyView(id: string) {
  const v = get().views.find((x) => x.id === id)
  if (!v) return
  set({ activeViewId: id })
  applyLayout(v.columnState, v.filterModel)
  if (!v.criteria) return // layout-only: the current search stays, nothing runs
  set({ draft: v.criteria, lens: v.lens })
  get().gridApi?.onFilterChanged()
  void runSearch().then(() => {
    if (!v.columnState || !v.columnState[0]?.width) setTimeout(adoptBaseline, 50)
  })
}

function snapshot(): Omit<SavedView, 'id' | 'name' | 'starred'> {
  const s = get()
  return {
    criteria: s.applied ?? s.draft,
    lens: s.lens,
    columnState: s.gridApi?.getColumnState() ?? s.columnState,
    filterModel: s.gridApi?.getFilterModel() ?? s.filterModel,
  }
}

export function updateActive() {
  const v = activeView(get())
  if (!v) return
  set({ views: get().views.map((x) => (x.id === v.id ? { ...x, ...snapshot() } : x)) })
  toast.success(c('views.updated', { name: v.name }))
}

export const nameTaken = (name: string, exceptId?: string) =>
  get().views.some((v) => v.id !== exceptId && v.name.trim().toLowerCase() === name.trim().toLowerCase())

export function saveAsNew(name: string) {
  const v: SavedView = { id: newId(), name: name.trim(), starred: false, ...snapshot() }
  set({ views: [...get().views, v], activeViewId: v.id })
  toast.success(c('views.savedNew', { name: v.name }))
}

export function renameView(id: string, name: string) {
  set({ views: get().views.map((v) => (v.id === id ? { ...v, name: name.trim() } : v)) })
}

export function toggleDefault(id: string) {
  set({ views: get().views.map((v) => ({ ...v, starred: v.id === id ? !v.starred : false })) })
}

export function deleteView(id: string) {
  const views = get().views
  const index = views.findIndex((v) => v.id === id)
  const v = views[index]
  if (!v) return
  set({ views: views.filter((x) => x.id !== id), activeViewId: get().activeViewId === id ? null : get().activeViewId })
  // Undo from the toast, no confirm dialog (366).
  toast(c('views.deleted', { name: v.name }), {
    action: {
      label: c('views.undo'),
      onClick: () => {
        const now = [...get().views]
        now.splice(index, 0, v)
        set({ views: now })
      },
    },
  })
}

// ---------- selection + J/K ------------------------------------------------------

export function selectKey(key: string | null) {
  set({ selectedKey: key })
}

export function step(delta: 1 | -1) {
  const api = get().gridApi
  if (!api) return
  const count = api.getDisplayedRowCount()
  if (!count) return
  const cur = api.getSelectedNodes()[0]
  const idx = cur?.rowIndex ?? (delta === 1 ? -1 : count)
  const next = Math.max(0, Math.min(count - 1, idx + delta))
  const node = api.getDisplayedRowAtIndex(next)
  if (!node) return
  node.setSelected(true, true)
  api.ensureIndexVisible(next)
  // Selection follows focus: J/K are ↓/↑, so the focused cell moves too.
  const col = api.getFocusedCell()?.column ?? api.getAllDisplayedColumns()[0]
  if (col) api.setFocusedCell(next, col)
}

// ---------- scenarios (the switcher's ↑/↓) ---------------------------------------

export const SCENARIOS = [
  { key: 'open', label: 'Opening the screen', proves: 'The starred default view applies AND runs on open (366).' },
  { key: 'before', label: 'Before any search', proves: 'No default starred: counts read "—", the inspector shows its empty prompt.' },
  { key: 'cut', label: 'Page hit its limit', proves: '"Whole week · newest 30": rows === Limit, every count reads "N+", the grid bar says it stopped.' },
  { key: 'filtered', label: 'Grid filter narrows', proves: 'A column filter (Customer contains "Noura"): "N of M shown"; lens counts ignore it.' },
  { key: 'pending', label: 'Edits not searched', proves: 'Store changed, Document type added, Date removed — flagged until Search.' },
  { key: 'modified', label: 'View drifted', proves: 'Lens switched after applying a view: the modified dot, then Update / Save as new.' },
]

export async function seedScenario(key: string) {
  set({
    draft: { ...BLANK, limit: DEFAULT_LIMIT },
    applied: null,
    rows: null,
    error: null,
    lens: 'all',
    activeViewId: null,
    views: seedViews(key !== 'before'),
    selectedKey: null,
    criteriaOpen: true,
  })
  applyLayout(null, null)
  if (key === 'before') return
  const id = key === 'cut' ? 'v-week' : 'v-store'
  // "open" seeds exactly as a fresh mount would: the starred default runs.
  applyView(id === 'v-store' ? get().views.find((v) => v.starred)!.id : id)
  await waitIdle()
  if (key === 'filtered') {
    const api = get().gridApi
    api?.setFilterModel({ customerName: { filterType: 'text', type: 'contains', filter: 'Noura' } })
  }
  if (key === 'pending') {
    const d = get().draft
    set({ draft: { ...d, storeCode: '1002', documentType: 'CLCN', range: null } })
  }
  if (key === 'modified') setLens('attention')
  const first = get().gridApi?.getDisplayedRowAtIndex(0)
  if (first && key !== 'pending') first.setSelected(true, true)
}

function waitIdle() {
  return new Promise<void>((resolve) => {
    const tick = () => (get().searching ? setTimeout(tick, 40) : setTimeout(resolve, 120))
    tick()
  })
}
