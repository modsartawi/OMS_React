import { describe, expect, it, vi } from 'vitest'
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/core/api'
import type { AnalyticsHome, AnalyticsItem } from '@/core/models/analytics'
import { ANALYTICS_HOME_KEY } from './api'
import { isPinned, pinMutationOptions, pinRefusalWords, type PinDoors } from './pin'

const item = (id: string): AnalyticsItem => ({
  id,
  kind: 'board',
  title: { en: id, ar: '' },
  subtitle: { en: '', ar: '' },
  owner: 'msartawi',
  tier: 'personal',
  sourceChangedSinceCopy: false,
  revision: 1,
  updatedAt: '2026-11-07T08:00:00',
  updatedBy: 'msartawi',
  definition: { chart: { type: 'bar' }, query: { measures: [], dimensions: [], filters: [] } },
})

const HOME: AnalyticsHome = { recent: [item('b-1'), item('b-2')], pinned: [item('b-9')], newestCertified: [] }
const pinnedIds = (qc: QueryClient) => qc.getQueryData<AnalyticsHome>(ANALYTICS_HOME_KEY)?.pinned.map((i) => i.id)

/** A door that answers when told to, so the test can look at the cache while the call is in flight. */
function heldDoors() {
  let settle: (refusal?: unknown) => void = () => {}
  const calls: string[] = []
  const door = (verb: string) => (id: string) =>
    new Promise<{ itemId: string; pinned: boolean }>((resolve, reject) => {
      calls.push(`${verb} ${id}`)
      settle = (refusal) => (refusal ? reject(refusal) : resolve({ itemId: id, pinned: verb === 'PUT' }))
    })
  const doors: PinDoors = { pin: door('PUT'), unpin: door('DELETE') }
  // The door is called after the optimistic patch: once it has been, the cache shows what the user sees mid-call.
  const inFlight = () => vi.waitFor(() => expect(calls.length).toBeGreaterThan(0))
  return { doors, calls, inFlight, settle: (refusal?: unknown) => settle(refusal) }
}

const run = (qc: QueryClient, doors: PinDoors, refused: unknown[]) => {
  const observer = new MutationObserver(qc, pinMutationOptions(qc, doors, (err) => refused.push(err)))
  return (v: { item: AnalyticsItem; pinned: boolean }) => observer.mutate(v).catch(() => undefined)
}

describe('pin toggle is optimistic and rolls back on refusal', () => {
  it('pinning shows the item under Pinned at once, first, before the door answers', async () => {
    const qc = new QueryClient()
    qc.setQueryData(ANALYTICS_HOME_KEY, HOME)
    const { doors, calls, inFlight, settle } = heldDoors()
    const done = run(qc, doors, [])({ item: item('b-2'), pinned: true })
    await inFlight()
    expect(pinnedIds(qc)).toEqual(['b-2', 'b-9'])
    expect(isPinned(qc.getQueryData(ANALYTICS_HOME_KEY), 'b-2')).toBe(true)
    settle()
    await done
    expect(calls).toEqual(['PUT b-2'])
    expect(pinnedIds(qc)).toEqual(['b-2', 'b-9'])
  })

  it('a refusal puts Pinned back as it was and hands the refusal on', async () => {
    const qc = new QueryClient()
    qc.setQueryData(ANALYTICS_HOME_KEY, HOME)
    const refused: unknown[] = []
    const { doors, inFlight, settle } = heldDoors()
    const done = run(qc, doors, refused)({ item: item('b-2'), pinned: true })
    await inFlight()
    expect(pinnedIds(qc)).toEqual(['b-2', 'b-9'])
    const notFound = new ApiError('business', 'Not found.', 404, [{ errorCode: 'ANALYTICS-404', internalErrorCode: '', errorMessage: 'Not found.' }])
    settle(notFound)
    await done
    expect(pinnedIds(qc)).toEqual(['b-9'])
    expect(refused).toEqual([notFound])
  })

  it('unpinning drops the item at once and calls DELETE; a refusal brings it back', async () => {
    const qc = new QueryClient()
    qc.setQueryData(ANALYTICS_HOME_KEY, HOME)
    const { doors, calls, inFlight, settle } = heldDoors()
    const done = run(qc, doors, [])({ item: item('b-9'), pinned: false })
    await inFlight()
    expect(pinnedIds(qc)).toEqual([])
    settle(new ApiError('network', 'offline', 0))
    await done
    expect(calls).toEqual(['DELETE b-9'])
    expect(pinnedIds(qc)).toEqual(['b-9'])
  })

  it('pinning twice never lists an item twice', async () => {
    const qc = new QueryClient()
    qc.setQueryData(ANALYTICS_HOME_KEY, HOME)
    const { doors, inFlight, settle } = heldDoors()
    const done = run(qc, doors, [])({ item: item('b-9'), pinned: true })
    await inFlight()
    expect(pinnedIds(qc)).toEqual(['b-9'])
    settle()
    await done
  })

  it('before Home has loaded, whether an item is pinned is not known', () => {
    expect(isPinned(undefined, 'b-1')).toBeNull()
    expect(isPinned(HOME, 'b-1')).toBe(false)
    expect(isPinned(HOME, 'b-9')).toBe(true)
  })
})

describe('a refused pin says why', () => {
  const t = (key: string) => `<${key}>`
  const refusal = (code: string) => new ApiError('business', `server ${code}`, 400, [{ errorCode: code, internalErrorCode: '', errorMessage: '' }])
  it("404 is the pin's own sentence, 413 the shared one, anything else the server's words or the fallback", () => {
    expect(pinRefusalWords(refusal('ANALYTICS-404'), true, t)).toBe('<pin.notFound>')
    expect(pinRefusalWords(refusal('ANALYTICS-413'), true, t)).toBe('<refusal.notShared>')
    expect(pinRefusalWords(new Error('boom'), false, t)).toBe('<pin.unpinFailed>')
  })
})
