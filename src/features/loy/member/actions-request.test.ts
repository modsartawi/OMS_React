/**
 * What the Actions tab **asks the server for** (ticket 238, first Proof bullet).
 *
 * The subject is one correctness constraint and it is a PII one: 🚩 a
 * `LoyMemberActions` call without a `LoyId` returns the first 25 actions of the
 * **whole estate**, newest first, across all members — a silent cross-member data
 * leak, *not* an error (223 §4). The door makes that unrepresentable server-side;
 * these tests pin that the client never relies on it having done so.
 *
 * They assert the **URL that leaves the browser**, not the shape of a params
 * object, because the leak is a property of the request and the layer that could
 * lose the parameter — `buildQuery` drops an empty string silently — sits between
 * the object and the wire.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LOY_ACTIONS_PAGE_SIZE, actionsKey, actionsQuery, loyReportsApi } from './api'

/** One `fetch` answer carrying a paged envelope inside the universal one. */
const answers = (page: {
  records?: unknown[] | null
  recordsCount?: number
  currentPage?: number
}) =>
  vi.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: async () => ({
      statusCode: 200,
      success: true,
      message: '',
      errors: [],
      data: {
        records: page.records ?? [],
        currentPage: page.currentPage ?? 1,
        pageSize: 25,
        pageRecordsCount: (page.records ?? []).length,
        totalPages: 1,
        recordsCount: page.recordsCount ?? 0,
      },
    }),
  } as unknown as Response)

/** The query the last call actually put on the wire. */
const sentQuery = (fetchMock: ReturnType<typeof vi.fn>) =>
  new URL(String(fetchMock.mock.calls.at(-1)?.[0]), 'http://portal.test').searchParams

afterEach(() => vi.unstubAllGlobals())

describe('the actions request', () => {
  it('🚩 sends the LoyId on page 1', async () => {
    const fetchMock = answers({})
    vi.stubGlobal('fetch', fetchMock)

    await loyReportsApi.actions('100001293', 1)

    expect(sentQuery(fetchMock).get('loyId')).toBe('100001293')
  })

  it('🚩 sends the LoyId on page 2 and beyond — paging is where it would be dropped', async () => {
    const fetchMock = answers({})
    vi.stubGlobal('fetch', fetchMock)

    for (const page of [2, 3, 14]) {
      await loyReportsApi.actions('100001293', page)
      const query = sentQuery(fetchMock)
      expect(query.get('loyId')).toBe('100001293')
      expect(query.get('page')).toBe(String(page))
    }
  })

  it('🚩 refuses a blank LoyId rather than making the estate-wide call', async () => {
    const fetchMock = answers({})
    vi.stubGlobal('fetch', fetchMock)

    // An empty string is the dangerous one: `buildQuery` drops it, so without the
    // guard this would leave as a bare `LoyMemberActions` and answer 200 with
    // somebody else's audit trail.
    await expect(loyReportsApi.actions('', 1)).rejects.toThrow()
    await expect(loyReportsApi.actions('   ', 1)).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('asks for 25 a page — the server default, not the pager’s other caller’s 50', async () => {
    const fetchMock = answers({})
    vi.stubGlobal('fetch', fetchMock)

    await loyReportsApi.actions('100001293', 1)

    expect(LOY_ACTIONS_PAGE_SIZE).toBe(25)
    expect(sentQuery(fetchMock).get('pageSize')).toBe('25')
  })

  it('sends a sane page number, so the pager and the server agree which page is on screen', () => {
    // The report coerces `<= 0` to 1 itself; sending 0 would leave the footer
    // claiming page 0 of a result the server answered as page 1.
    expect(actionsQuery('100001293', 0).page).toBe(1)
    expect(actionsQuery('100001293', -4).page).toBe(1)
    expect(actionsQuery('100001293', 2.7).page).toBe(2)
  })

  it('answers an empty page as an empty list, never a null the grid cannot render', async () => {
    const fetchMock = answers({ records: null, recordsCount: 0 })
    vi.stubGlobal('fetch', fetchMock)

    const page = await loyReportsApi.actions('100001293', 1)

    expect(page.records).toEqual([])
    expect(page.recordsCount).toBe(0)
  })

  it('keys the cache per member AND per page — page 2 is a different read', () => {
    expect(actionsKey('100001293', 2)).not.toEqual(actionsKey('100001293', 1))
    expect(actionsKey('100001293', 1)).not.toEqual(actionsKey('100009999', 1))
  })
})
