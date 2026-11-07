import { describe, expect, it } from 'vitest'
import type { AnalyticsItem, AnalyticsTier } from '@/core/models/analytics'
import { libraryItems, libraryItemsQuery } from './library'
import { libraryRedirect, pageChoice, pageNarrows, pageShows, pageToParams } from './library-pages'

const ME = 'msartawi'
const TODAY = '2026-11-07'
const label = (en: string) => ({ en, ar: '' })
const item = (id: string, over: Partial<AnalyticsItem> & { tier?: AnalyticsTier } = {}): AnalyticsItem => ({
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
  item('my-board', { kind: 'board', folderId: 'f-1' }),
  item('my-view', { kind: 'view', folderId: 'f-1' }),
  item('my-report', { kind: 'report' }),
  item('my-shared-board', { kind: 'board', tier: 'shared' }),
  item('their-shared-view', { kind: 'view', tier: 'shared', owner: 'colleague' }),
  item('their-shared-board', { kind: 'board', tier: 'shared', owner: 'colleague' }),
  item('certified-board', { kind: 'board', tier: 'certified', owner: 'curator' }),
  item('my-deleted-view', { kind: 'view', deletedAt: '2026-11-06T10:00:00' }),
  item('my-deleted-board', { kind: 'board', deletedAt: '2026-11-06T09:00:00' }),
]

const ids = (page: Parameters<typeof pageChoice>[0], search = '') =>
  libraryItems(ITEMS, pageChoice(page, new URLSearchParams(search)), ME, TODAY)
    .map((i) => i.id)
    .sort()

describe('each leaf narrows the library by its route', () => {
  it('My boards / views / reports list only my items of that kind', () => {
    expect(ids('boards')).toEqual(['my-board', 'my-shared-board'])
    expect(ids('views')).toEqual(['my-view'])
    expect(ids('reports')).toEqual(['my-report'])
    expect(libraryItemsQuery(pageChoice('boards', new URLSearchParams()), TODAY)).toEqual({ kind: 'board', owner: 'me' })
  })

  it('the route wins over a who / kind in the query, and the folder, search and changed still narrow', () => {
    expect(ids('boards', 'who=certified&kind=view')).toEqual(['my-board', 'my-shared-board'])
    expect(ids('boards', 'folder=f-1')).toEqual(['my-board'])
    expect(ids('views', 'folder=f-1&q=nothing')).toEqual([])
    expect(ids('views', 'changed=range&to=2026-11-01')).toEqual([])
  })

  it('Certified lists certified items of every owner, the kind chip still narrowing; no folder', () => {
    expect(ids('certified')).toEqual(['certified-board'])
    expect(ids('certified', 'kind=view')).toEqual([])
    expect(ids('certified', 'folder=f-1')).toEqual(['certified-board'])
    expect(libraryItemsQuery(pageChoice('certified', new URLSearchParams('kind=board')), TODAY)).toEqual({ kind: 'board', tier: 'certified' })
  })

  it('Recently deleted lists my deleted items, the who / kind chips still narrowing', () => {
    expect(ids('deleted')).toEqual(['my-deleted-board', 'my-deleted-view'])
    expect(ids('deleted', 'kind=board')).toEqual(['my-deleted-board'])
    expect(libraryItemsQuery(pageChoice('deleted', new URLSearchParams()), TODAY)).toEqual({ deleted: true })
  })

  it('Home is still the whole library, its query read as before', () => {
    expect(ids('home')).toHaveLength(7)
    expect(ids('home', 'folder=deleted')).toEqual(['my-deleted-board', 'my-deleted-view'])
  })

  it('the URL keeps only what the route does not fix', () => {
    expect(pageToParams('boards', pageChoice('boards', new URLSearchParams('folder=f-1&q=x'))).toString()).toBe('folder=f-1&q=x')
    expect(pageToParams('shared', pageChoice('shared', new URLSearchParams('kind=view&changed=7'))).toString()).toBe('kind=view&changed=7')
    expect(pageToParams('deleted', pageChoice('deleted', new URLSearchParams('kind=view'))).toString()).toBe('kind=view')
  })

  it('a page shows the chips and the rail its route leaves open', () => {
    expect(pageShows('home')).toEqual({ who: true, kind: true, rail: true })
    expect(pageShows('boards')).toEqual({ who: false, kind: false, rail: true })
    expect(pageShows('shared')).toEqual({ who: false, kind: true, rail: false })
    expect(pageShows('certified')).toEqual({ who: false, kind: true, rail: false })
    expect(pageShows('deleted')).toEqual({ who: true, kind: true, rail: false })
  })

  it('only what the page leaves open counts as narrowing (Clear, the empty words)', () => {
    expect(pageNarrows('boards', pageChoice('boards', new URLSearchParams()))).toBe(false)
    expect(pageNarrows('boards', pageChoice('boards', new URLSearchParams('changed=today')))).toBe(true)
    expect(pageNarrows('shared', pageChoice('shared', new URLSearchParams('kind=view')))).toBe(true)
  })
})

describe('old who/kind links redirect to the matching leaf', () => {
  const from = (page: Parameters<typeof libraryRedirect>[0], search: string) => libraryRedirect(page, new URLSearchParams(search))

  it('mine of one kind goes to its My page, keeping the folder, changed and search', () => {
    expect(from('home', 'who=mine&kind=board')).toBe('/analytics/boards')
    expect(from('home', 'who=mine&kind=view&folder=f-1&changed=7&q=orders')).toBe('/analytics/views?changed=7&folder=f-1&q=orders')
    expect(from('home', 'kind=report&who=mine')).toBe('/analytics/reports')
  })

  it('shared with me and certified go to their pages, keeping the kind and dropping the folder', () => {
    expect(from('home', 'who=sharedWithMe')).toBe('/analytics/shared')
    expect(from('home', 'who=sharedWithMe&kind=view&folder=f-1')).toBe('/analytics/shared?kind=view')
    expect(from('home', 'who=certified&kind=board')).toBe('/analytics/certified?kind=board')
  })

  it('the deleted folder goes to Recently deleted, from Home or a My page', () => {
    expect(from('home', 'folder=deleted')).toBe('/analytics/deleted')
    expect(from('home', 'folder=deleted&who=mine&kind=board')).toBe('/analytics/deleted?who=mine&kind=board')
    expect(from('boards', 'folder=deleted')).toBe('/analytics/deleted?who=mine&kind=board')
  })

  it('a link no single leaf matches stays where it is', () => {
    expect(from('home', '')).toBeNull()
    expect(from('home', 'who=mine')).toBeNull()
    expect(from('home', 'kind=board&changed=today')).toBeNull()
    expect(from('home', 'who=nobody&kind=board')).toBeNull()
    expect(from('boards', 'folder=f-1')).toBeNull()
    expect(from('shared', 'folder=deleted')).toBeNull()
    expect(from('deleted', 'who=mine&kind=view')).toBeNull()
  })
})

describe('Shared with me excludes my items and certified', () => {
  it('lists only items colleagues shared, never my own shared item nor a certified one', () => {
    expect(ids('shared')).toEqual(['their-shared-board', 'their-shared-view'])
    expect(ids('shared', 'kind=board')).toEqual(['their-shared-board'])
    expect(libraryItemsQuery(pageChoice('shared', new URLSearchParams()), TODAY)).toEqual({ tier: 'shared' })
  })
})
