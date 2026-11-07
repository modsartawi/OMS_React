import { describe, expect, it } from 'vitest'
import type { AnalyticsItem, AnalyticsTier } from '@/core/models/analytics'
import {
  DEFAULT_LIBRARY_CHOICE,
  changedWindow,
  fileInList,
  folderName,
  folderNameTaken,
  libraryFromParams,
  libraryItems,
  libraryItemsQuery,
  libraryToParams,
  localDayOf,
  moveCounts,
  type LibraryChoice,
} from './library'

const label = (en: string, ar = '') => ({ en, ar })
const ME = 'msartawi'
const TODAY = '2026-11-07'

const item = (
  id: string,
  over: Partial<AnalyticsItem> & { tier?: AnalyticsTier } = {},
): AnalyticsItem => ({
  id,
  kind: 'view',
  title: label(id),
  subtitle: label(''),
  owner: ME,
  tier: 'personal',
  sourceChangedSinceCopy: false,
  revision: 1,
  updatedAt: '2026-11-07T08:00:00',
  updatedBy: ME,
  definition: { chart: { type: 'bar' }, query: { measures: [], dimensions: [], filters: [] } },
  folderId: null,
  deletedAt: null,
  ...over,
})

const ITEMS: AnalyticsItem[] = [
  item('mine-view', { updatedAt: '2026-11-07T09:00:00', folderId: 'f1' }),
  item('mine-board', { kind: 'board', updatedAt: '2026-11-02T09:00:00' }),
  item('my-shared', { tier: 'shared', updatedAt: '2026-10-20T09:00:00', folderId: 'f2' }),
  item('their-shared', { tier: 'shared', owner: 'someone', updatedAt: '2026-10-09T09:00:00', folderId: 'f1' }),
  item('cert-report', { kind: 'report', tier: 'certified', owner: 'curator', updatedAt: '2026-09-01T09:00:00' }),
  item('gone', { deletedAt: '2026-11-06T10:00:00', updatedAt: '2026-11-06T10:00:00' }),
]

const ids = (choice: Partial<LibraryChoice>) => libraryItems(ITEMS, choice, ME, TODAY).map((i) => i.id)

describe('library filters (837 item 3)', () => {
  it('all items: every live item, newest change first; a deleted one is not listed', () => {
    expect(ids({})).toEqual(['mine-view', 'mine-board', 'my-shared', 'their-shared', 'cert-report'])
  })

  it('who: mine is my own of any tier; certified; shared with me is Shared and not mine', () => {
    expect(ids({ who: 'mine' })).toEqual(['mine-view', 'mine-board', 'my-shared'])
    expect(ids({ who: 'certified' })).toEqual(['cert-report'])
    expect(ids({ who: 'sharedWithMe' })).toEqual(['their-shared'])
  })

  it('mine compares the owner without regard to case', () => {
    expect(libraryItems([item('x', { owner: 'MSartawi' })], { who: 'mine' }, ME, TODAY).map((i) => i.id)).toEqual(['x'])
  })

  it('kind narrows to views, boards or reports', () => {
    expect(ids({ kind: 'board' })).toEqual(['mine-board'])
    expect(ids({ kind: 'report' })).toEqual(['cert-report'])
    expect(ids({ kind: 'view' })).toEqual(['mine-view', 'my-shared', 'their-shared'])
  })

  it('changed: today, the last 7 and 30 days (today included), and a range with both ends included', () => {
    expect(ids({ changed: { kind: 'today' } })).toEqual(['mine-view'])
    expect(ids({ changed: { kind: 'days', days: 7 } })).toEqual(['mine-view', 'mine-board'])
    expect(ids({ changed: { kind: 'days', days: 30 } })).toEqual(['mine-view', 'mine-board', 'my-shared', 'their-shared'])
    expect(ids({ changed: { kind: 'range', from: '2026-10-09', to: '2026-10-20' } })).toEqual(['my-shared', 'their-shared'])
  })

  it('a range with one end open narrows by that end only; a range with no dates is any time', () => {
    expect(ids({ changed: { kind: 'range', from: '2026-11-01' } })).toEqual(['mine-view', 'mine-board'])
    expect(ids({ changed: { kind: 'range', to: '2026-10-09' } })).toEqual(['their-shared', 'cert-report'])
    expect(ids({ changed: { kind: 'range' } })).toEqual(ids({}))
  })

  it('folder: one of mine, unfiled, and recently deleted (deleted items only)', () => {
    expect(ids({ folder: 'f1' })).toEqual(['mine-view', 'their-shared'])
    expect(ids({ folder: 'none' })).toEqual(['mine-board', 'cert-report'])
    expect(ids({ folder: 'deleted' })).toEqual(['gone'])
  })

  it('search is the home title search, in either language, through the generated title', () => {
    const list = [item('a', { title: label('Late orders', 'الطلبات المتأخرة') }), item('b', { title: label('', '') })]
    const named = () => label('Orders by store', 'الطلبات حسب الفرع')
    expect(libraryItems(list, { search: ' LATE ' }, ME, TODAY).map((i) => i.id)).toEqual(['a'])
    expect(libraryItems(list, { search: 'الطَّلبات' }, ME, TODAY, named).map((i) => i.id)).toEqual(['a', 'b'])
    expect(libraryItems(list, { search: 'by store' }, ME, TODAY).map((i) => i.id)).toEqual([])
  })

  it('every narrowing applies at once', () => {
    expect(ids({ who: 'mine', kind: 'view', folder: 'f1', changed: { kind: 'today' }, search: 'mine' })).toEqual(['mine-view'])
    expect(ids({ who: 'sharedWithMe', folder: 'f2' })).toEqual([])
  })

  it('an item without folderId (a server before 3432) reads as unfiled', () => {
    const old = { ...item('old'), folderId: undefined, deletedAt: undefined }
    expect(libraryItems([old], { folder: 'none' }, ME, TODAY).map((i) => i.id)).toEqual(['old'])
  })
})

describe('the local day of a server time', () => {
  it('reads a time with no zone as written, and nothing that is not a date', () => {
    expect(localDayOf('2026-11-04T23:59:00')).toBe('2026-11-04')
    expect(localDayOf('2026-11-04')).toBe('2026-11-04')
    expect(localDayOf('')).toBeNull()
    expect(localDayOf('yesterday')).toBeNull()
  })
  it('turns a zoned instant into the browser’s local day', () => {
    const at = '2026-11-04T12:00:00Z'
    const d = new Date(at)
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    expect(localDayOf(at)).toBe(local)
  })
  it('the last 7 days start six days before today', () => {
    expect(changedWindow({ kind: 'days', days: 7 }, TODAY)).toEqual({ from: '2026-11-01', to: TODAY })
    expect(changedWindow({ kind: 'any' }, TODAY)).toBeNull()
  })
})

describe('GET Analytics/Items is asked with the same narrowing (3432 §1)', () => {
  it('the whole library asks nothing', () => {
    expect(libraryItemsQuery({}, TODAY)).toEqual({})
  })
  it('maps who, kind, folder, changed and search to the door’s params', () => {
    expect(libraryItemsQuery({ who: 'mine', kind: 'view', folder: 'none', changed: { kind: 'days', days: 30 }, search: ' x ' }, TODAY)).toEqual({
      kind: 'view',
      owner: 'me',
      folder: 'none',
      changedFrom: '2026-10-09',
      changedTo: TODAY,
      search: 'x',
    })
    expect(libraryItemsQuery({ who: 'certified' }, TODAY)).toEqual({ tier: 'certified' })
    expect(libraryItemsQuery({ who: 'sharedWithMe', folder: 'f1' }, TODAY)).toEqual({ tier: 'shared', folder: 'f1' })
    expect(libraryItemsQuery({ changed: { kind: 'range', to: '2026-10-01' } }, TODAY)).toEqual({ changedTo: '2026-10-01' })
  })
  it('recently deleted asks deleted=true alone', () => {
    expect(libraryItemsQuery({ folder: 'deleted', who: 'mine', search: 'x' }, TODAY)).toEqual({ deleted: true })
  })
})

describe('the choice in the URL', () => {
  const round = (c: LibraryChoice) => libraryFromParams(libraryToParams(c))

  it('the default choice is the bare address', () => {
    expect(libraryToParams(DEFAULT_LIBRARY_CHOICE).toString()).toBe('')
    expect(libraryFromParams(new URLSearchParams())).toEqual(DEFAULT_LIBRARY_CHOICE)
  })

  it('round-trips every choice', () => {
    const choices: LibraryChoice[] = [
      { who: 'mine', kind: 'board', changed: { kind: 'today' }, folder: 'f1', search: 'late orders', area: '' },
      { who: 'sharedWithMe', kind: 'all', changed: { kind: 'days', days: 7 }, folder: 'none', search: '', area: 'till_sales' },
      { who: 'certified', kind: 'report', changed: { kind: 'days', days: 30 }, folder: 'deleted', search: 'الطلبات', area: '' },
      { who: 'all', kind: 'view', changed: { kind: 'range', from: '2026-10-01', to: '2026-10-31' }, folder: 'all', search: '', area: '' },
      { who: 'all', kind: 'all', changed: { kind: 'range', from: '2026-10-01' }, folder: 'all', search: '', area: '' },
    ]
    for (const c of choices) expect(round(c)).toEqual(c)
  })

  it('writes short keys', () => {
    const p = libraryToParams({ who: 'mine', kind: 'view', changed: { kind: 'range', from: '2026-10-01', to: '2026-10-31' }, folder: 'f1', search: 'x', area: '' })
    expect(p.toString()).toBe('who=mine&kind=view&changed=range&from=2026-10-01&to=2026-10-31&folder=f1&q=x')
  })

  it('reads anything unknown as its default, and drops a malformed date', () => {
    expect(libraryFromParams(new URLSearchParams('who=boss&kind=chart&changed=14'))).toEqual(DEFAULT_LIBRARY_CHOICE)
    expect(libraryFromParams(new URLSearchParams('changed=range&from=2026-1-1&to=2026-10-31')).changed).toEqual({ kind: 'range', to: '2026-10-31' })
  })
})

describe('folders', () => {
  it('a name is trimmed, 1–80 characters', () => {
    expect(folderName('  Ops  ')).toBe('Ops')
    expect(folderName('   ')).toBeNull()
    expect(folderName('x'.repeat(80))).toHaveLength(80)
    expect(folderName('x'.repeat(81))).toBeNull()
  })
  it('a name is unique per user ignoring case, except the folder being renamed', () => {
    const folders = [{ id: 'f1', name: 'Ops' }]
    expect(folderNameTaken(folders, ' ops ')).toBe(true)
    expect(folderNameTaken(folders, 'OPS', 'f1')).toBe(false)
    expect(folderNameTaken(folders, 'Sales')).toBe(false)
  })
  it('filing moves one item and its count, and filing where it already is changes nothing', () => {
    expect(fileInList(ITEMS, 'mine-board', 'f2').find((i) => i.id === 'mine-board')?.folderId).toBe('f2')
    const folders = [
      { id: 'f1', itemCount: 2 },
      { id: 'f2', itemCount: 1 },
    ]
    expect(moveCounts(folders, 'f1', 'f2')).toEqual([
      { id: 'f1', itemCount: 1 },
      { id: 'f2', itemCount: 2 },
    ])
    expect(moveCounts(folders, null, 'f1')[0].itemCount).toBe(3)
    expect(moveCounts(folders, 'f2', null)[1].itemCount).toBe(0)
    expect(moveCounts(folders, 'f1', 'f1')).toEqual(folders)
  })
})
