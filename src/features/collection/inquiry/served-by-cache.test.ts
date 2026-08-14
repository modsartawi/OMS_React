/**
 * The *Served by* picker's ONE shared cache entry (BackOffice 1196, spec 1162 D10).
 *
 * 1196 closed a disclosure on `CollectionWeb/AssignmentOptions`: the route was
 * authenticated but ungated, so any signed-in browser session — including one that
 * can open no collection screen at all — received the finance roster and a
 * `defaultScope` naming the caller's own row and `Role`. The fix gates it on
 * holding **any** of the five collection grants rather than on a specific one,
 * **precisely so that this file's assertions stay true**: had it been gated per
 * screen, or answered a `?screen=` hint, the response would vary by caller and the
 * single cacheable payload the shared control is built on would be gone.
 *
 * 🚩 So what is pinned here is the CLIENT half of that bargain: the key carries no
 * screen and no grant dimension, and nothing on the request could split the cache.
 * All five screens fetching this descriptor cost **one** request between them.
 *
 * Sibling proofs: `served-by.test.ts` (which groups each screen renders — a
 * client-side table, deliberately not a server branch) and `access.test.ts` (the
 * five independent grants the ragged menu is drawn from).
 */
import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.hoisted(() => vi.fn())

vi.mock('@/core/api', () => ({
  api: {
    get,
    post: vi.fn(),
    postForFile: vi.fn(),
  },
}))

const { ASSIGNMENT_OPTIONS_KEY, assignmentOptionsQuery, collectionApi } = await import('./api')

/** The screens that render the shared picker — four inquiries plus the admin screen
 * whose two dropdowns are filled from the same payload. Named rather than counted,
 * because the claim is "these five share one entry", not "five things happened". */
const SCREENS = ['collections', 'acrs', 'deposits', 'attempts', 'assignment'] as const

const ROSTER = { accountants: [], collectors: [], supervisors: [], defaultScope: null }

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

beforeEach(() => {
  get.mockReset()
  get.mockResolvedValue(ROSTER)
})

describe('the shared Served by cache key', () => {
  it('carries no screen and no grant dimension', () => {
    // The key IS the cache. A screen segment here would give each screen its own
    // entry (five requests where the design says one); a grant segment would do the
    // same for a user holding several, and would additionally leak which grants the
    // session holds into a client-side cache map.
    expect(ASSIGNMENT_OPTIONS_KEY).toEqual(['collection', 'assignment-options'])
    expect(assignmentOptionsQuery().queryKey).toBe(ASSIGNMENT_OPTIONS_KEY)
  })

  it('sends no parameters at all, so nothing on the request can split it', async () => {
    // 🚩 D10 refused a `?screen=` branch and 1196 kept it refused — the per-screen
    // contract is a client-side table. A params object here would also make the
    // gated route's response vary by caller, which is the thing the "any grant"
    // gate exists to avoid.
    await collectionApi.assignmentOptions()

    expect(get).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledWith('CollectionWeb/AssignmentOptions')
  })

  it('costs ONE request across all five screens', async () => {
    // Every screen asks for the descriptor as it mounts; react-query merges them
    // onto one entry and one in-flight fetch. `staleTime: Infinity` is what keeps a
    // user moving between screens from re-fetching a roster that cannot change
    // inside a page life.
    // (Mutation-checked: giving the key a screen segment — ['collection',
    // 'assignment-options', screen] — reddens this and the first case.)
    const client = newClient()

    const payloads = await Promise.all(
      SCREENS.map(() => client.fetchQuery(assignmentOptionsQuery())),
    )

    expect(get).toHaveBeenCalledTimes(1)
    expect(client.getQueryCache().getAll()).toHaveLength(1)
    for (const payload of payloads) {
      expect(payload).toBe(ROSTER)
    }
  })

  it('does not re-fetch when a screen mounts again later', async () => {
    const client = newClient()

    await client.fetchQuery(assignmentOptionsQuery())
    await client.fetchQuery(assignmentOptionsQuery())

    expect(get).toHaveBeenCalledTimes(1)
  })

  it('surfaces a refusal as one failed entry rather than a retry storm', async () => {
    // 1196's new failure mode for a session holding none of the five grants: a bare
    // 403. `retry: false` is the descriptor's own, so the picker is simply empty and
    // the screen lands unscoped — the same shape it already showed for an
    // unreachable sink, and not five screens retrying a door that is shut.
    get.mockRejectedValue(new Error('403'))
    const client = newClient()

    await Promise.all(
      SCREENS.map(() => client.fetchQuery(assignmentOptionsQuery()).catch(() => null)),
    )

    expect(get).toHaveBeenCalledTimes(1)
    expect(assignmentOptionsQuery().retry).toBe(false)
  })
})
