/**
 * Saved views (ticket 400, spec 380 L3, L4, L5; ruling 366): per user and defensive, the old
 * layouts imported once as layout-only, drift on each of the four captured things, unique
 * names, one default, delete with undo, and the default on open.
 */
import { describe, expect, it } from 'vitest'
import type { ColumnState } from 'ag-grid-community'
import { BLANK_QUERY, toFilterCriteria, withField, type QueryCriteria } from './query-model'
import {
  defaultView,
  deleteView,
  EMPTY_VIEW_STORE,
  isDrifted,
  LEGACY_VIEWS_KEY,
  nameTaken,
  opensOnDefault,
  parseViewStore,
  readViewStore,
  renameView,
  restoreView,
  saveView,
  serializeViewStore,
  toggleDefault,
  updateView,
  viewDrift,
  viewStorageKey,
  writeViewStore,
  type SavedView,
  type ViewSnapshot,
  type ViewStorage,
  type ViewStore,
} from './saved-views'

/** A `Storage` in memory, with a log of every key written. */
function memory(seed: Record<string, string> = {}): ViewStorage & { data: Map<string, string>; writes: string[] } {
  const data = new Map(Object.entries(seed))
  const writes: string[] = []
  return {
    data,
    writes,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      writes.push(key)
      data.set(key, value)
    },
  }
}

const ids = () => {
  let n = 0
  return () => `id-${++n}`
}

const COLUMNS: ColumnState[] = [
  { colId: 'deliveryNo', width: 120, hide: false, pinned: 'left', sort: null, sortIndex: null, flex: null },
  { colId: 'status', width: 150, hide: false, pinned: null, sort: null, sortIndex: null, flex: null },
  { colId: 'documentNo', width: 115, hide: false, pinned: null, sort: 'desc', sortIndex: 0, flex: null },
  { colId: 'customerName', width: 160, hide: false, pinned: null, sort: null, sortIndex: null, flex: null },
]

const STORE_1017: QueryCriteria = { ...BLANK_QUERY, storeCode: '1017', date: { preset: 'today' } }

const snapshot = (over: Partial<ViewSnapshot> = {}): ViewSnapshot => ({
  query: STORE_1017,
  lens: 'all',
  columnState: COLUMNS,
  filterModel: {},
  ...over,
})

function saved(store: ViewStore, name: string, snap: ViewSnapshot = snapshot(), id = name): { store: ViewStore; view: SavedView } {
  const result = saveView(store, name, snap, id)
  if (!result.ok) throw new Error(`refused: ${result.refusal}`)
  return result
}

describe('savedViewStoreIsPerUserAndDefensive', () => {
  it("keeps two users' views apart, each under its own key", () => {
    const storage = memory()
    const a = saved(readViewStore(storage, 'alice', ids()), 'Store 1017 · today').store
    writeViewStore(storage, 'alice', a)
    const b = saved(readViewStore(storage, 'bob', ids()), 'Failed jobs').store
    writeViewStore(storage, 'bob', b)

    expect(readViewStore(storage, 'alice').views.map((v) => v.name)).toEqual(['Store 1017 · today'])
    expect(readViewStore(storage, 'bob').views.map((v) => v.name)).toEqual(['Failed jobs'])
    expect(storage.data.has(viewStorageKey('alice'))).toBe(true)
    expect(storage.data.has(viewStorageKey('bob'))).toBe(true)
  })

  it('reads nothing and writes nothing without a user', () => {
    const storage = memory({ [viewStorageKey('alice')]: serializeViewStore(saved(EMPTY_VIEW_STORE, 'Mine').store) })
    expect(readViewStore(storage, null)).toEqual(EMPTY_VIEW_STORE)
    expect(readViewStore(storage, '')).toEqual(EMPTY_VIEW_STORE)
    expect(writeViewStore(storage, null, EMPTY_VIEW_STORE)).toBe(false)
    expect(storage.writes).toEqual([])
  })

  it('reads a malformed store as empty', () => {
    for (const raw of ['{not json', 'null', '42', '[]', '{"views":7}', '"views"']) {
      expect(parseViewStore(raw)).toEqual(EMPTY_VIEW_STORE)
    }
    expect(parseViewStore(null)).toEqual(EMPTY_VIEW_STORE)
  })

  it('drops a malformed view, a repeated id or name, and a default that names no view', () => {
    const good = saved(EMPTY_VIEW_STORE, 'Store 1017').view
    const raw = JSON.stringify({
      legacyImported: true,
      defaultId: 'gone',
      views: [
        good,
        { ...good, name: 'Other' }, // same id
        { ...good, id: 'x2', name: '  store 1017 ' }, // same name
        { id: 'x3', name: '   ', query: null }, // blank name
        { id: 'x4', name: 'No criteria key' }, // claims no query, holds none
        'a string',
      ],
    })
    const store = parseViewStore(raw)
    expect(store.views.map((v) => v.id)).toEqual(['Store 1017'])
    expect(store.defaultId).toBeNull()
    expect(store.legacyImported).toBe(true)
  })

  it('rebuilds a stored view field by field: a wrong-typed field is no filter', () => {
    const raw = JSON.stringify({
      views: [
        {
          id: 'v',
          name: 'Odd',
          lens: 'nonsense',
          query: { storeCode: 1017, deliveryNo: ' 80001238 ', limit: -5, isExpress: 'yes', date: { preset: 'never' }, extra: 'x' },
          columnState: [{ colId: 'deliveryNo', width: 'wide', pinned: 'middle', hide: true, junk: 1 }, { nope: true }],
          filterModel: ['not', 'a', 'model'],
        },
      ],
      legacyImported: true,
    })
    const [view] = parseViewStore(raw).views
    expect(view.query).toEqual({ ...BLANK_QUERY, deliveryNo: ' 80001238 ' })
    expect(view.lens).toBe('all')
    expect(view.columnState).toEqual([{ colId: 'deliveryNo', hide: true, pinned: null }])
    expect(view.filterModel).toEqual({})
  })

  it('treats a storage that throws as an empty store', () => {
    const throwing: ViewStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readViewStore(throwing, 'alice')).toEqual(EMPTY_VIEW_STORE)
    expect(writeViewStore(throwing, 'alice', EMPTY_VIEW_STORE)).toBe(false)
  })

  it('refuses a blank or duplicate name, case- and space-insensitively', () => {
    const store = saved(EMPTY_VIEW_STORE, 'Failed jobs').store
    expect(saveView(store, '   ', snapshot(), 'n')).toEqual({ ok: false, refusal: 'blank' })
    expect(saveView(store, '  failed JOBS ', snapshot(), 'n')).toEqual({ ok: false, refusal: 'taken' })
    expect(nameTaken(store, 'FAILED JOBS')).toBe(true)
    expect(nameTaken(store, 'FAILED JOBS', 'Failed jobs')).toBe(false)
  })

  it('renames, refusing another view’s name but accepting its own', () => {
    let store = saved(EMPTY_VIEW_STORE, 'A').store
    store = saved(store, 'B').store
    expect(renameView(store, 'A', 'b')).toEqual({ ok: false, refusal: 'taken' })
    expect(renameView(store, 'deleted meanwhile', 'C')).toEqual({ ok: false, refusal: 'gone' })
    const same = renameView(store, 'A', ' a ')
    expect(same.ok && same.view.name).toBe('a')
    const renamed = renameView(store, 'A', 'Morning shift')
    expect(renamed.ok && renamed.store.views.map((v) => v.name)).toEqual(['Morning shift', 'B'])
  })

  it('round-trips a view through the store, with its Date still relative', () => {
    const query = withField(STORE_1017, 'date', { preset: 'last3' })
    const store = saved(EMPTY_VIEW_STORE, 'Last 3 days', snapshot({ query, lens: 'attention', filterModel: { status: { filterType: 'text', type: 'contains', filter: 'cancel' } } })).store
    const [view] = parseViewStore(serializeViewStore(store)).views
    expect(view.query?.date).toEqual({ preset: 'last3' })
    expect(view.lens).toBe('attention')
    expect(view.columnState).toEqual(COLUMNS)
    expect(view.filterModel).toEqual({ status: { filterType: 'text', type: 'contains', filter: 'cancel' } })
    // Tomorrow it still means the last three days — resolved when its search runs.
    const later = toFilterCriteria(view.query!, new Date(2026, 9, 10, 9, 30))
    expect(later.fromDate).toEqual(new Date(2026, 9, 8))
    expect(later.toDate).toEqual(new Date(2026, 9, 10))
  })

  it('stars one default at most, and unstars it on a second toggle', () => {
    let store = saved(EMPTY_VIEW_STORE, 'A').store
    store = saved(store, 'B').store
    store = toggleDefault(store, 'A')
    expect(defaultView(store)?.id).toBe('A')
    store = toggleDefault(store, 'B')
    expect(store.defaultId).toBe('B')
    store = toggleDefault(store, 'B')
    expect(defaultView(store)).toBeNull()
    expect(toggleDefault(store, 'missing')).toBe(store)
  })

  it('deletes with no confirm, and Undo puts it back in its place with its star', () => {
    let store = saved(EMPTY_VIEW_STORE, 'A').store
    store = saved(store, 'B').store
    store = saved(store, 'C').store
    store = toggleDefault(store, 'B')
    const { store: after, removed } = deleteView(store, 'B')
    expect(after.views.map((v) => v.id)).toEqual(['A', 'C'])
    expect(after.defaultId).toBeNull()
    const undone = restoreView(after, removed!)
    expect(undone.views.map((v) => v.id)).toEqual(['A', 'B', 'C'])
    expect(undone.defaultId).toBe('B')
    // A second Undo changes nothing.
    expect(restoreView(undone, removed!)).toBe(undone)
  })

  it('Undo keeps a star taken meanwhile, and a name taken meanwhile gets a free suffix', () => {
    let store = saved(EMPTY_VIEW_STORE, 'A').store
    store = toggleDefault(store, 'A')
    const { store: after, removed } = deleteView(store, 'A')
    const meanwhile = toggleDefault(saved(after, 'a', snapshot(), 'A2').store, 'A2')
    const undone = restoreView(meanwhile, removed!)
    expect(undone.views.map((v) => v.name)).toEqual(['A (2)', 'a'])
    expect(undone.defaultId).toBe('A2')
  })

  it('Update overwrites the four captured things and keeps the name and star', () => {
    let store = toggleDefault(saved(EMPTY_VIEW_STORE, 'A').store, 'A')
    store = updateView(store, 'A', snapshot({ lens: 'dawaaNow', query: BLANK_QUERY }))
    expect(store.views[0]).toMatchObject({ id: 'A', name: 'A', lens: 'dawaaNow', query: BLANK_QUERY })
    expect(store.defaultId).toBe('A')
  })
})

describe('legacyLayoutViewsImportOnceAsLayoutOnly', () => {
  const LEGACY = JSON.stringify([
    { id: 'old-1', name: 'Money columns', columnState: [{ colId: 'documentNo', hide: true }], filterModel: {} },
    { id: 'old-2', name: 'Store filter', columnState: COLUMNS, filterModel: { storeCode: { filterType: 'text', type: 'equals', filter: '1017' } } },
    { id: 'bad', name: 'No layout' },
  ])

  it('imports the old layouts once, as layout-only views: no criteria, lens All', () => {
    const storage = memory({ [LEGACY_VIEWS_KEY]: LEGACY })
    const store = readViewStore(storage, 'alice', ids())
    expect(store.views.map((v) => [v.name, v.query, v.lens])).toEqual([
      ['Money columns', null, 'all'],
      ['Store filter', null, 'all'],
    ])
    expect(store.views[0].columnState).toEqual([{ colId: 'documentNo', hide: true }])
    expect(store.views[1].filterModel).toEqual({ storeCode: { filterType: 'text', type: 'equals', filter: '1017' } })
    expect(store.legacyImported).toBe(true)
  })

  it('does not import again on the next load, so a deleted layout stays deleted', () => {
    const storage = memory({ [LEGACY_VIEWS_KEY]: LEGACY })
    const first = readViewStore(storage, 'alice', ids())
    writeViewStore(storage, 'alice', deleteView(first, first.views[0].id).store)
    const second = readViewStore(storage, 'alice', ids())
    expect(second.views.map((v) => v.name)).toEqual(['Store filter'])
  })

  it('never writes or removes the old key', () => {
    const storage = memory({ [LEGACY_VIEWS_KEY]: LEGACY })
    const store = readViewStore(storage, 'alice', ids())
    writeViewStore(storage, 'alice', saved(store, 'New').store)
    readViewStore(storage, 'bob', ids())
    expect(storage.data.get(LEGACY_VIEWS_KEY)).toBe(LEGACY)
    expect(storage.writes).not.toContain(LEGACY_VIEWS_KEY)
    expect(storage.writes.every((key) => key.startsWith('oms.deliveries.views.v1:'))).toBe(true)
  })

  it("imports into each user's own store once", () => {
    const storage = memory({ [LEGACY_VIEWS_KEY]: LEGACY })
    readViewStore(storage, 'alice', ids())
    expect(readViewStore(storage, 'bob', ids()).views).toHaveLength(2)
  })

  it('appends after the user’s own views, and a clashing name takes a free suffix', () => {
    const own = { ...saved(EMPTY_VIEW_STORE, 'money COLUMNS').store, legacyImported: false }
    const storage = memory({ [LEGACY_VIEWS_KEY]: LEGACY, [viewStorageKey('alice')]: serializeViewStore(own) })
    const store = readViewStore(storage, 'alice', ids())
    expect(store.views.map((v) => v.name)).toEqual(['money COLUMNS', 'Money columns (2)', 'Store filter'])
  })

  it('keeps a suffixed name within the cap, so it reads back as itself and is not dropped', () => {
    const long = 'x'.repeat(60)
    const raw = JSON.stringify([
      { id: 'a', name: long, columnState: [], filterModel: {} },
      { id: 'b', name: long, columnState: [], filterModel: {} },
    ])
    const storage = memory({ [LEGACY_VIEWS_KEY]: raw })
    const store = readViewStore(storage, 'alice', ids())
    expect(store.views.map((v) => v.name)).toEqual([long, `${'x'.repeat(56)} (2)`])
    expect(readViewStore(storage, 'alice').views).toHaveLength(2)
  })

  it('records the import even when the old key is missing or malformed', () => {
    for (const legacy of [undefined, '{oops', '{"a":1}']) {
      const storage = memory(legacy === undefined ? {} : { [LEGACY_VIEWS_KEY]: legacy })
      expect(readViewStore(storage, 'alice', ids())).toEqual({ ...EMPTY_VIEW_STORE, legacyImported: true })
      expect(parseViewStore(storage.data.get(viewStorageKey('alice'))).legacyImported).toBe(true)
    }
  })

  it('makes an imported view a full view when it is re-saved', () => {
    const store = readViewStore(memory({ [LEGACY_VIEWS_KEY]: LEGACY }), 'alice', ids())
    const id = store.views[0].id
    const updated = updateView(store, id, snapshot({ lens: 'attention' }))
    expect(updated.views[0]).toMatchObject({ name: 'Money columns', query: STORE_1017, lens: 'attention', columnState: COLUMNS })
  })
})

describe('viewDriftDetection', () => {
  const view = saved(EMPTY_VIEW_STORE, 'Store 1017', snapshot({ filterModel: { status: { filterType: 'text', type: 'contains', filter: 'cancel' } } })).view
  const asSaved = snapshot({ filterModel: { status: { type: 'contains', filter: 'cancel', filterType: 'text' } } })
  const none = { criteria: false, lens: false, columns: false, filters: false }

  it('is not modified while the page holds what was saved', () => {
    expect(viewDrift(view, asSaved, null)).toEqual(none)
  })

  it('sets modified when the criteria change, but not for a padded box', () => {
    expect(viewDrift(view, { ...asSaved, query: withField(STORE_1017, 'storeCode', '1002') }, null)).toEqual({ ...none, criteria: true })
    expect(viewDrift(view, { ...asSaved, query: withField(STORE_1017, 'date', { preset: 'last7' }) }, null).criteria).toBe(true)
    expect(viewDrift(view, { ...asSaved, query: withField(STORE_1017, 'storeCode', ' 1017 ') }, null).criteria).toBe(false)
  })

  it('sets modified when the lens changes', () => {
    expect(viewDrift(view, { ...asSaved, lens: 'attention' }, null)).toEqual({ ...none, lens: true })
  })

  it('sets modified when a column is hidden, moved, resized, pinned or sorted', () => {
    const change = (i: number, over: Partial<ColumnState>) => COLUMNS.map((c, j) => (j === i ? { ...c, ...over } : c))
    const moved = [COLUMNS[0], COLUMNS[2], COLUMNS[1], COLUMNS[3]]
    for (const columnState of [
      change(3, { hide: true }),
      moved,
      change(1, { width: 200 }),
      change(3, { pinned: 'left' }),
      change(2, { sort: 'asc' }),
    ]) {
      expect(viewDrift(view, { ...asSaved, columnState }, null)).toEqual({ ...none, columns: true })
    }
  })

  it('sets modified when a grid filter changes, whatever its key order', () => {
    expect(viewDrift(view, { ...asSaved, filterModel: {} }, null)).toEqual({ ...none, filters: true })
    expect(viewDrift(view, { ...asSaved, filterModel: null }, null).filters).toBe(true)
    expect(
      viewDrift(view, { ...asSaved, filterModel: { status: { filterType: 'text', type: 'contains', filter: 'deliv' } } }, null).filters,
    ).toBe(true)
  })

  it('clears once the view is re-applied', () => {
    const drifted: ViewSnapshot = { query: BLANK_QUERY, lens: 'dawaaNow', columnState: [...COLUMNS].reverse(), filterModel: {} }
    expect(isDrifted(view, drifted, null)).toBe(true)
    // Applying puts back what was saved: its criteria, lens, columns and filters.
    const reapplied: ViewSnapshot = { query: view.query!, lens: view.lens, columnState: view.columnState, filterModel: view.filterModel }
    expect(isDrifted(view, reapplied, null)).toBe(false)
  })

  it('reads a column a stored layout names twice once, and never throws on it', () => {
    const raw = JSON.stringify({
      legacyImported: true,
      views: [{ id: 'd', name: 'Doubled', query: null, columnState: [COLUMNS[0], COLUMNS[1], { ...COLUMNS[0], width: 999 }], filterModel: {} }],
    })
    const [doubled] = parseViewStore(raw).views
    expect(doubled.columnState?.map((c) => c.colId)).toEqual(['deliveryNo', 'status'])
    expect(viewDrift(doubled, snapshot(), null).columns).toBe(false)
  })

  it('ignores a column the saved layout does not name (one added to the grid since)', () => {
    const added = [...COLUMNS, { colId: 'newColumn', width: 90, hide: false, pinned: null, sort: null, sortIndex: null, flex: null }]
    expect(viewDrift(view, { ...asSaved, columnState: added }, null).columns).toBe(false)
  })

  it('compares a flex column by its flex, not the width the viewport gave it', () => {
    const flexed = COLUMNS.map((c) => (c.colId === 'customerName' ? { ...c, flex: 1 } : c))
    const flexView = saved(EMPTY_VIEW_STORE, 'Flex', snapshot({ columnState: flexed })).view
    const wider = flexed.map((c) => (c.colId === 'customerName' ? { ...c, width: 400 } : c))
    expect(viewDrift(flexView, { ...asSaved, filterModel: {}, columnState: wider }, null).columns).toBe(false)
  })

  it('reads a layout-only view on its layout alone: criteria and lens cannot drift', () => {
    const layoutOnly: SavedView = { id: 'old', name: 'Money columns', query: null, lens: 'all', columnState: [{ colId: 'documentNo', hide: true }], filterModel: {} }
    const now = snapshot({ query: withField(BLANK_QUERY, 'orderNo', '900100'), lens: 'attention', columnState: COLUMNS.map((c) => (c.colId === 'documentNo' ? { ...c, hide: true } : c)) })
    // It said nothing of width or pinning, so the grid's own pinned Delivery no. is no drift.
    expect(viewDrift(layoutOnly, now, null)).toEqual(none)
    expect(viewDrift(layoutOnly, { ...now, columnState: COLUMNS }, null)).toEqual({ ...none, columns: true })
  })

  it("stands the grid's own layout in for a view saved before any grid mounted", () => {
    const early = saved(EMPTY_VIEW_STORE, 'Early', snapshot({ columnState: null })).view
    expect(viewDrift(early, snapshot({ columnState: null }), null).columns).toBe(false)
    expect(viewDrift(early, snapshot(), COLUMNS).columns).toBe(false)
    expect(viewDrift(early, snapshot({ columnState: COLUMNS.map((c) => ({ ...c, hide: true })) }), COLUMNS).columns).toBe(true)
  })
})

describe('the default on open', () => {
  const idle = { query: null, draft: BLANK_QUERY, rows: null, error: null, activeViewId: null }

  it('runs only when there is no in-memory search', () => {
    expect(opensOnDefault(idle)).toBe(true)
    expect(opensOnDefault({ ...idle, query: STORE_1017, rows: [] })).toBe(false) // back from Details
    expect(opensOnDefault({ ...idle, error: 'Search failed' })).toBe(false)
    expect(opensOnDefault({ ...idle, activeViewId: 'A' })).toBe(false)
    expect(opensOnDefault({ ...idle, draft: withField(BLANK_QUERY, 'storeCode', '1017') })).toBe(false)
    expect(opensOnDefault({ ...idle, draft: withField(BLANK_QUERY, 'storeCode', '  ') })).toBe(true)
  })
})
