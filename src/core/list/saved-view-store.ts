/**
 * Saved views (ticket 400, spec 380 L3, L4, L5; ruling 366): an operator's own named views of a
 * list screen. Graduated from the Deliveries list's `saved-views.ts` at ticket 786, when the
 * Order / ERX list became its second reader — ~350 lines of tested logic that must not fork.
 * Pure: no React, no i18n, and the storage is a parameter, so vitest's node environment carries
 * the suite.
 *
 * The schema-free half lives here: names, columns, filters, drift, the lifecycle and the storage
 * edge. Each list binds its own half with {@link savedViewStore}: its storage key, how its query
 * is read back, its lenses, and how two of its queries differ.
 *
 * - A **saved view** captures four things: the query bar's criteria (with the Date kept
 *   **relative**, resolved only when its search runs), the active **lens**, the grid's **column
 *   state** (order, width, visibility, pinning, sort) and its **column filters**. Applying one
 *   runs its search.
 * - 🚩 **Per user, in `localStorage` keyed by user id.** A shared counter PC never shows one
 *   operator's views to the next. There are no shared views and no server store (366).
 * - 🚩 **Anything unreadable is an empty store, never a throw.** The store is a value a human can
 *   edit in devtools, and it is read while the page renders.
 * - **Old layout-only views** (a list may name a legacy key) are imported **once** into the
 *   signed-in user's store as **layout-only** views: no criteria, the default lens. 🚩 **The old
 *   key is only ever read** — never written, never removed.
 * - **Names are unique per user** (trimmed, case-insensitive). **One** view may be the default.
 * - The **modified dot**: the active view has drifted once its criteria, lens, columns or grid
 *   filters differ from what was saved ({@link SavedViewStore.viewDrift}).
 */
import type { ColumnState, FilterModel } from 'ag-grid-community'

/** A view's name is capped, as the dialog's box is. */
export const VIEW_NAME_MAX = 60

/** The grid half of a view: what `getColumnState()` and `getFilterModel()` give back. */
export interface ViewLayout {
  /** `null` = the grid's own default layout (a view saved before any grid had mounted). */
  columnState: ColumnState[] | null
  filterModel: FilterModel
}

export interface SavedView<Q, L extends string> extends ViewLayout {
  id: string
  name: string
  /** The query bar's criteria, the Date relative. `null` = a **layout-only** view (imported). */
  query: Q | null
  lens: L
}

export interface ViewStore<Q, L extends string> {
  views: SavedView<Q, L>[]
  /** The starred view, which applies and runs on page open. At most one. */
  defaultId: string | null
  /** The old shared key has been imported into this store — so it never is again. */
  legacyImported: boolean
}

/** What the page holds right now, as a view would capture it. */
export interface ViewSnapshot<Q, L extends string> {
  query: Q
  lens: L
  /** `null` = no grid has reported a layout yet. */
  columnState: ColumnState[] | null
  filterModel: FilterModel | null
}

/** One layout from an old key: a name, the column state and the filters, as the old app wrote them. */
export interface LegacyLayout extends ViewLayout {
  name: string
}

/** The two calls of `Storage` this module makes — a parameter, so the suite runs in node. */
export interface ViewStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** Why a name was refused: blank, another of the user's views holds it, or the view is gone. */
export type NameRefusal = 'blank' | 'taken' | 'gone'

export type ViewResult<Q, L extends string> =
  | { ok: true; store: ViewStore<Q, L>; view: SavedView<Q, L> }
  | { ok: false; refusal: NameRefusal }

/** What Delete took, so the toast's Undo can put it back where it was. */
export interface RemovedView<Q, L extends string> {
  view: SavedView<Q, L>
  index: number
  wasDefault: boolean
}

/** Which of the four captured things drifted. A layout-only view has no criteria or lens to drift. */
export interface ViewDrift {
  criteria: boolean
  lens: boolean
  columns: boolean
  filters: boolean
}

/** The page's in-memory search, as far as the default on open cares. */
export interface InMemorySearch<Q> {
  query: Q | null
  draft: Q
  rows: readonly unknown[] | null
  error: string | null
  activeViewId: string | null
}

// ----- defensive parsing ----------------------------------------------------------------------

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const PINS = ['left', 'right'] as const
const SORTS = ['asc', 'desc'] as const
const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

/**
 * One column's state, from the keys a list writes only. A key the stored state does not carry
 * stays absent, so applying it leaves that part of the column as the grid has it (an old layout
 * that only hides columns keeps the key column pinned).
 */
function columnOf(value: unknown): ColumnState | null {
  if (!isRecord(value) || typeof value.colId !== 'string' || !value.colId) return null
  const column: ColumnState = { colId: value.colId }
  const width = num(value.width)
  if (width !== undefined) column.width = width
  if (typeof value.hide === 'boolean') column.hide = value.hide
  if ('pinned' in value) column.pinned = PINS.includes(value.pinned as never) ? (value.pinned as ColumnState['pinned']) : null
  if ('sort' in value) column.sort = SORTS.includes(value.sort as never) ? (value.sort as ColumnState['sort']) : null
  if ('sortIndex' in value) column.sortIndex = num(value.sortIndex) ?? null
  if ('flex' in value) column.flex = num(value.flex) ?? null
  return column
}

/** A layout's columns; a column named twice keeps its first entry, as a grid holds it once. */
function columnsOf(value: unknown): ColumnState[] | null {
  if (!Array.isArray(value)) return null
  const columns: ColumnState[] = []
  for (const entry of value) {
    const column = columnOf(entry)
    if (column && !columns.some((c) => c.colId === column.colId)) columns.push(column)
  }
  return columns.length ? columns : null
}

const filtersOf = (value: unknown): FilterModel => (isRecord(value) ? (value as FilterModel) : {})

const nameOf = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, VIEW_NAME_MAX) : null

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()

/** An old key's layouts, read defensively — the same shape test the old store used. */
export function parseLegacyViews(raw: string | null | undefined): LegacyLayout[] {
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const layouts: LegacyLayout[] = []
  for (const value of parsed) {
    if (!isRecord(value) || !Array.isArray(value.columnState) || !isRecord(value.filterModel)) continue
    const name = nameOf(value.name)
    if (name === null) continue
    layouts.push({ name, columnState: columnsOf(value.columnState), filterModel: filtersOf(value.filterModel) })
  }
  return layouts
}

/**
 * `name`, or `name (2)`, `name (3)`… — the first that no view in `views` holds. The name is cut
 * to make room for the suffix, so it stays within {@link VIEW_NAME_MAX} and reads back the same.
 */
function freeName(views: readonly { name: string }[], name: string): string {
  if (!views.some((v) => sameName(v.name, name))) return name
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`
    const candidate = name.slice(0, VIEW_NAME_MAX - suffix.length).trimEnd() + suffix
    if (!views.some((v) => sameName(v.name, candidate))) return candidate
  }
}

/** Short, collision-resistant id without relying on `crypto`. */
export function newViewId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// ----- the schema-free lifecycle --------------------------------------------------------------

export function nameTaken(store: ViewStore<unknown, string>, name: string, exceptId?: string): boolean {
  return store.views.some((v) => v.id !== exceptId && sameName(v.name, name))
}

function checkName(store: ViewStore<unknown, string>, name: string, exceptId?: string): NameRefusal | null {
  if (!name.trim()) return 'blank'
  if (nameTaken(store, name, exceptId)) return 'taken'
  return null
}

export function renameView<Q, L extends string>(store: ViewStore<Q, L>, id: string, name: string): ViewResult<Q, L> {
  const existing = store.views.find((v) => v.id === id)
  if (!existing) return { ok: false, refusal: 'gone' }
  const refusal = checkName(store, name, id)
  if (refusal) return { ok: false, refusal }
  const view = { ...existing, name: name.trim().slice(0, VIEW_NAME_MAX) }
  return { ok: true, store: { ...store, views: store.views.map((v) => (v.id === id ? view : v)) }, view }
}

/** Make default / Remove default: one star at most, so starring one unstars the other. */
export function toggleDefault<Q, L extends string>(store: ViewStore<Q, L>, id: string): ViewStore<Q, L> {
  if (!store.views.some((v) => v.id === id)) return store
  return { ...store, defaultId: store.defaultId === id ? null : id }
}

export function defaultView<Q, L extends string>(store: ViewStore<Q, L>): SavedView<Q, L> | null {
  return store.views.find((v) => v.id === store.defaultId) ?? null
}

/** Delete, with no confirm: the view goes, and so does its star. */
export function deleteView<Q, L extends string>(
  store: ViewStore<Q, L>,
  id: string,
): { store: ViewStore<Q, L>; removed: RemovedView<Q, L> | null } {
  const index = store.views.findIndex((v) => v.id === id)
  if (index === -1) return { store, removed: null }
  const view = store.views[index]
  const wasDefault = store.defaultId === id
  return {
    store: { ...store, views: store.views.filter((v) => v.id !== id), defaultId: wasDefault ? null : store.defaultId },
    removed: { view, index, wasDefault },
  }
}

/**
 * Undo from the toast: the view goes back at its place, with its star if no other view took the
 * star meanwhile. If its name was taken meanwhile, it comes back under the next free `(n)`.
 */
export function restoreView<Q, L extends string>(store: ViewStore<Q, L>, removed: RemovedView<Q, L>): ViewStore<Q, L> {
  if (store.views.some((v) => v.id === removed.view.id)) return store
  const view = { ...removed.view, name: freeName(store.views, removed.view.name) }
  const views = [...store.views]
  views.splice(Math.min(removed.index, views.length), 0, view)
  const defaultId = removed.wasDefault && store.defaultId === null ? view.id : store.defaultId
  return { ...store, views, defaultId }
}

// ----- drift ----------------------------------------------------------------------------------

/**
 * A column as the saved layout states it, against the grid's. Only what the saved column carries
 * counts: an old layout that only hid columns says nothing about their width. A flex column's
 * width follows the viewport, so its flex counts instead.
 */
function sameColumn(saved: ColumnState, now: ColumnState): boolean {
  if (saved.hide !== undefined && !!saved.hide !== !!now.hide) return false
  if ('pinned' in saved && (saved.pinned ?? null) !== (now.pinned ?? null)) return false
  if ('sort' in saved) {
    if ((saved.sort ?? null) !== (now.sort ?? null)) return false
    if (saved.sort && 'sortIndex' in saved && (saved.sortIndex ?? null) !== (now.sortIndex ?? null)) return false
  }
  const flex = saved.flex ?? null
  if (flex !== null) return flex === (now.flex ?? null)
  return saved.width === undefined || saved.width === now.width
}

/**
 * The grid matches a saved layout when the columns they BOTH name sit in the same order and
 * match as {@link sameColumn} reads them. A column only one of them names (one added to the grid
 * after the layout was saved) cannot have drifted from it.
 */
function sameColumns(saved: readonly ColumnState[], now: readonly ColumnState[]): boolean {
  const byId = new Map(now.map((c) => [c.colId, c]))
  const shared = saved.filter((c) => byId.has(c.colId))
  const ids = new Set(shared.map((c) => c.colId))
  const nowOrder = now.filter((c) => ids.has(c.colId))
  return shared.every((c, i) => c.colId === nowOrder[i]?.colId && sameColumn(c, byId.get(c.colId)!))
}

/** JSON with object keys sorted, so two equal filter models compare equal whatever their key order. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .filter((k) => value[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stable(value[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

// ----- one list's binding ---------------------------------------------------------------------

/** What a list says about its own half of a view. */
export interface SavedViewConfig<Q, L extends string> {
  /** One user's store key. Versioned, so a future shape can start clean. */
  storageKey: (userId: string) => string
  /** The criteria rebuilt field by field from a stored value; `null` when it is not a query. */
  queryOf: (value: unknown) => Q | null
  /** The list's lenses; a stored lens it does not know reads as `defaultLens`. */
  lensIds: readonly L[]
  defaultLens: L
  /** How many entries differ between a draft and a base (`null` = before any search: blank). */
  pendingCount: (draft: Q, base: Q | null) => number
  /** An old app's layout-only views, imported once per user. Absent = nothing to import. */
  legacyKey?: string
}

export interface SavedViewStore<Q, L extends string> {
  emptyStore: ViewStore<Q, L>
  parseViewStore(raw: string | null | undefined): ViewStore<Q, L>
  serializeViewStore(store: ViewStore<Q, L>): string
  importLegacy(store: ViewStore<Q, L>, legacyRaw: string | null | undefined, newId: () => string): ViewStore<Q, L>
  writeViewStore(storage: ViewStorage, userId: string | null | undefined, store: ViewStore<Q, L>): boolean
  readViewStore(storage: ViewStorage, userId: string | null | undefined, newId?: () => string): ViewStore<Q, L>
  saveView(store: ViewStore<Q, L>, name: string, snapshot: ViewSnapshot<Q, L>, id: string): ViewResult<Q, L>
  updateView(store: ViewStore<Q, L>, id: string, snapshot: ViewSnapshot<Q, L>): ViewStore<Q, L>
  viewDrift(view: SavedView<Q, L>, current: ViewSnapshot<Q, L>, defaultColumns: ColumnState[] | null): ViewDrift
  isDrifted(view: SavedView<Q, L>, current: ViewSnapshot<Q, L>, defaultColumns: ColumnState[] | null): boolean
  opensOnDefault(state: InMemorySearch<Q>): boolean
}

export function savedViewStore<Q extends object, L extends string>(config: SavedViewConfig<Q, L>): SavedViewStore<Q, L> {
  const emptyStore: ViewStore<Q, L> = { views: [], defaultId: null, legacyImported: false }
  const lensOf = (value: unknown): L => (config.lensIds.includes(value as L) ? (value as L) : config.defaultLens)

  function viewOf(value: unknown): SavedView<Q, L> | null {
    if (!isRecord(value) || typeof value.id !== 'string' || !value.id) return null
    const name = nameOf(value.name)
    if (name === null) return null
    const query = value.query === null ? null : config.queryOf(value.query)
    // A view that claims criteria but holds none readable is not a view this store wrote.
    if (query === null && value.query !== null) return null
    return {
      id: value.id,
      name,
      query,
      lens: query === null ? config.defaultLens : lensOf(value.lens),
      columnState: columnsOf(value.columnState),
      filterModel: filtersOf(value.filterModel),
    }
  }

  /**
   * One user's store, read defensively: a malformed or foreign value is an empty store. A view
   * that repeats an earlier view's id or name is dropped, so the store's invariants hold however
   * it was edited, and a default that names no view is no default.
   */
  function parseViewStore(raw: string | null | undefined): ViewStore<Q, L> {
    if (!raw) return emptyStore
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return emptyStore
    }
    if (!isRecord(parsed) || !Array.isArray(parsed.views)) return emptyStore
    const views: SavedView<Q, L>[] = []
    for (const value of parsed.views) {
      const view = viewOf(value)
      if (view && !views.some((v) => v.id === view.id || sameName(v.name, view.name))) views.push(view)
    }
    const defaultId = views.some((v) => v.id === parsed.defaultId) ? (parsed.defaultId as string) : null
    return { views, defaultId, legacyImported: parsed.legacyImported === true }
  }

  const serializeViewStore = (store: ViewStore<Q, L>) => JSON.stringify(store)

  /**
   * The one-time import: the old key's layouts join the store as **layout-only** views (no
   * criteria, the default lens), after the user's own, and the store records that it imported. A
   * store that already imported is returned as it is — so a layout the user deleted never comes
   * back. A name the store already holds takes the next free `(n)` suffix, so names stay unique.
   */
  function importLegacy(store: ViewStore<Q, L>, legacyRaw: string | null | undefined, newId: () => string): ViewStore<Q, L> {
    if (store.legacyImported) return store
    const views = [...store.views]
    for (const layout of parseLegacyViews(legacyRaw)) {
      views.push({
        id: newId(),
        name: freeName(views, layout.name),
        query: null,
        lens: config.defaultLens,
        columnState: layout.columnState,
        filterModel: layout.filterModel,
      })
    }
    return { ...store, views, legacyImported: true }
  }

  /** Writes one user's store. `false` when the storage refused (full, blocked): the views still work. */
  function writeViewStore(storage: ViewStorage, userId: string | null | undefined, store: ViewStore<Q, L>): boolean {
    if (!userId) return false
    try {
      storage.setItem(config.storageKey(userId), serializeViewStore(store))
      return true
    } catch {
      return false
    }
  }

  /**
   * One user's store, with the old layouts imported on the first read and the import recorded in
   * the user's own key. No user, no store: a session that has not loaded never reads another
   * user's views. A storage that throws on access is an empty store.
   */
  function readViewStore(storage: ViewStorage, userId: string | null | undefined, newId: () => string = newViewId): ViewStore<Q, L> {
    if (!userId) return emptyStore
    let store: ViewStore<Q, L>
    try {
      store = parseViewStore(storage.getItem(config.storageKey(userId)))
    } catch {
      return emptyStore
    }
    if (store.legacyImported || !config.legacyKey) return store
    let legacy: string | null = null
    try {
      legacy = storage.getItem(config.legacyKey)
    } catch {
      /* an unreadable old key imports nothing */
    }
    const imported = importLegacy(store, legacy, newId)
    writeViewStore(storage, userId, imported)
    return imported
  }

  /** The four captured things, copied so a later edit of the page's state never reaches the store. */
  function captured(snapshot: ViewSnapshot<Q, L>): Pick<SavedView<Q, L>, 'query' | 'lens' | 'columnState' | 'filterModel'> {
    return {
      query: { ...snapshot.query },
      lens: snapshot.lens,
      columnState: snapshot.columnState ? snapshot.columnState.map((c) => ({ ...c })) : null,
      filterModel: { ...(snapshot.filterModel ?? {}) },
    }
  }

  /** Save current view / Save as new: a full view, appended. A blank or taken name is refused. */
  function saveView(store: ViewStore<Q, L>, name: string, snapshot: ViewSnapshot<Q, L>, id: string): ViewResult<Q, L> {
    const refusal = checkName(store, name)
    if (refusal) return { ok: false, refusal }
    const view: SavedView<Q, L> = { id, name: name.trim().slice(0, VIEW_NAME_MAX), ...captured(snapshot) }
    return { ok: true, store: { ...store, views: [...store.views, view] }, view }
  }

  /** Update: the view takes what the page holds now. A layout-only view becomes a full view. */
  function updateView(store: ViewStore<Q, L>, id: string, snapshot: ViewSnapshot<Q, L>): ViewStore<Q, L> {
    return { ...store, views: store.views.map((v) => (v.id === id ? { ...v, ...captured(snapshot) } : v)) }
  }

  /**
   * The modified dot (366). `defaultColumns` is the grid's own layout, which stands in for a view
   * saved before any grid mounted (`columnState: null`) and for a page whose grid has not reported
   * a layout yet. With neither known, the columns cannot have drifted: no grid, no column change.
   */
  function viewDrift(view: SavedView<Q, L>, current: ViewSnapshot<Q, L>, defaultColumns: ColumnState[] | null): ViewDrift {
    const savedColumns = view.columnState ?? defaultColumns
    const currentColumns = current.columnState ?? defaultColumns
    return {
      criteria: view.query !== null && config.pendingCount(current.query, view.query) > 0,
      lens: view.query !== null && view.lens !== current.lens,
      columns: savedColumns !== null && currentColumns !== null && !sameColumns(savedColumns, currentColumns),
      filters: stable(view.filterModel) !== stable(current.filterModel ?? {}),
    }
  }

  function isDrifted(view: SavedView<Q, L>, current: ViewSnapshot<Q, L>, defaultColumns: ColumnState[] | null): boolean {
    const drift = viewDrift(view, current, defaultColumns)
    return drift.criteria || drift.lens || drift.columns || drift.filters
  }

  /**
   * The starred default applies and runs on page open only when there is no in-memory search: no
   * search has run or failed, no view is active, and the bar holds no edits. Returning from
   * Details keeps the search that was there, never the default (L5).
   */
  function opensOnDefault(state: InMemorySearch<Q>): boolean {
    return (
      state.query === null &&
      state.rows === null &&
      state.error === null &&
      state.activeViewId === null &&
      config.pendingCount(state.draft, null) === 0
    )
  }

  return {
    emptyStore,
    parseViewStore,
    serializeViewStore,
    importLegacy,
    writeViewStore,
    readViewStore,
    saveView,
    updateView,
    viewDrift,
    isDrifted,
    opensOnDefault,
  }
}
