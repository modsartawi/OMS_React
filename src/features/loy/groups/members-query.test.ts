/**
 * A group's members (oms ticket 632; door BackOffice 3174
 * `GET LoyGroupWeb/Groups/{groupId}/Members?search=&page=&pageSize=`).
 *
 * The server canonicalises the search — `05…`, `5…`, `+9665…`, `9665…` all match — so the client must
 * send what the user typed UNTOUCHED: no digit stripping, no `+` removal, no re-spelling. These tests
 * assert the URL that leaves the browser, because the layer that could lose or mangle the search
 * (`buildQuery`, URL encoding) sits between the object and the wire.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOY_GROUP_MEMBERS_PAGE_SIZE, membersApi } from './api'
import { membersQueryFromParams, membersQueryToParams } from './members-query'

const answers = () =>
  vi.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: async () => ({ statusCode: 200, success: true, message: '', errors: [], data: { total: 0, rows: [] } }),
  } as unknown as Response)

const sent = (fetchMock: ReturnType<typeof vi.fn>) => new URL(String(fetchMock.mock.calls.at(-1)?.[0]), 'http://portal.test')

afterEach(() => vi.unstubAllGlobals())

describe('members query carries the typed search untouched and drops a blank one', () => {
  it('sends +966 5… exactly as typed, spaces and plus included', async () => {
    const fetchMock = answers()
    vi.stubGlobal('fetch', fetchMock)
    await membersApi.members('g-1', { search: '+966 50 123', page: 1 })
    const url = sent(fetchMock)
    expect(url.pathname).toBe('/api/LoyGroupWeb/Groups/g-1/Members')
    expect(url.searchParams.get('search')).toBe('+966 50 123')
  })

  it('sends a local spelling untouched too', async () => {
    const fetchMock = answers()
    vi.stubGlobal('fetch', fetchMock)
    await membersApi.members('g-1', { search: '0501', page: 1 })
    expect(sent(fetchMock).searchParams.get('search')).toBe('0501')
  })

  it('drops a blank search rather than sending search=', async () => {
    const fetchMock = answers()
    vi.stubGlobal('fetch', fetchMock)
    await membersApi.members('g-1', { search: '', page: 1 })
    expect(sent(fetchMock).searchParams.has('search')).toBe(false)
    await membersApi.members('g-1', { search: '   ', page: 1 })
    expect(sent(fetchMock).searchParams.has('search')).toBe(false)
  })

  it('sends the page and 50 a page', async () => {
    const fetchMock = answers()
    vi.stubGlobal('fetch', fetchMock)
    await membersApi.members('g-1', { search: '', page: 3 })
    const q = sent(fetchMock).searchParams
    expect(LOY_GROUP_MEMBERS_PAGE_SIZE).toBe(50)
    expect(q.get('page')).toBe('3')
    expect(q.get('pageSize')).toBe('50')
  })

  it('encodes the group id as one path segment', async () => {
    const fetchMock = answers()
    vi.stubGlobal('fetch', fetchMock)
    await membersApi.members('g/1?x', { search: '', page: 1 })
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain('LoyGroupWeb/Groups/g%2F1%3Fx/Members')
  })

  it('answers a missing rows list as an empty one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ statusCode: 200, success: true, message: '', errors: [], data: { total: 0, rows: null } }),
      } as unknown as Response),
    )
    expect(await membersApi.members('g-1', { search: '', page: 1 })).toEqual({ total: 0, rows: [] })
  })
})

describe('the members search and page sit in the URL', () => {
  it('reads ?search (trimmed) and ?page', () => {
    expect(membersQueryFromParams(new URLSearchParams('search=%20%2B966%2050%20&page=4'))).toEqual({ search: '+966 50', page: 4 })
  })

  it('defaults to no search, page 1, and repairs a nonsense page', () => {
    expect(membersQueryFromParams(new URLSearchParams(''))).toEqual({ search: '', page: 1 })
    expect(membersQueryFromParams(new URLSearchParams('page=0'))).toEqual({ search: '', page: 1 })
    expect(membersQueryFromParams(new URLSearchParams('page=abc'))).toEqual({ search: '', page: 1 })
    expect(membersQueryFromParams(new URLSearchParams('page=2.7'))).toEqual({ search: '', page: 2 })
  })

  it('writes only what differs from the default', () => {
    expect(membersQueryToParams({ search: '', page: 1 }).toString()).toBe('')
    expect(membersQueryToParams({ search: '0501', page: 2 }).toString()).toBe('search=0501&page=2')
  })
})
