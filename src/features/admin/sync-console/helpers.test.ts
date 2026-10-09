import { afterEach, describe, expect, it, vi } from 'vitest'
import { STORE_STATES, type LoopHealth, type SyncWorker } from '@/core/models/sync-console'
import { syncConsoleApi } from './api'
import {
  DEFAULT_FLEET_FILTER,
  FLEET_TILES,
  fleetQuery,
  lastLoopError,
  stateBadge,
  tileOn,
  toggleTile,
  workerBanner,
  type FleetFilter,
} from './helpers'
import en from '@/locales/en/sync-console.json'

describe('stateBadge', () => {
  it('maps every StoreState to a label key that exists, and a severity', () => {
    for (const state of STORE_STATES) {
      const badge = stateBadge(state)
      expect(badge.labelKey).toBe(`states.${state}`)
      expect((en.states as Record<string, string>)[state]).toBeTruthy()
      expect(['ok', 'go', 'warn', 'bad', 'mute']).toContain(badge.sev)
    }
  })

  it('reads the bad states as bad, behind as a warning, the hosts as quiet', () => {
    expect(stateBadge('offline').sev).toBe('bad')
    expect(stateBadge('erroring').sev).toBe('bad')
    expect(stateBadge('behind').sev).toBe('warn')
    expect(stateBadge('onWpf').sev).toBe('mute')
    expect(stateBadge('paused').sev).toBe('mute')
  })

  it('leaves an unknown state neutral and unlabelled, so the raw code shows', () => {
    expect(stateBadge('quarantined')).toEqual({ labelKey: null, sev: 'mute' })
    // A key inherited from Object.prototype is not a state either.
    expect(stateBadge('toString')).toEqual({ labelKey: null, sev: 'mute' })
  })
})

describe('fleetQuery', () => {
  const filter = (over: Partial<FleetFilter> = {}): FleetFilter => ({ ...DEFAULT_FLEET_FILTER, ...over })

  it('asks for page 1 of 50, most behind first, by default', () => {
    expect(fleetQuery(DEFAULT_FLEET_FILTER)).toEqual({
      state: [],
      host: null,
      q: '',
      sort: 'mostBehind',
      page: 1,
      pageSize: 50,
    })
  })

  it('carries the tiles, host, trimmed search, sort and page', () => {
    expect(
      fleetQuery(filter({ states: ['offline', 'behind'], host: 'Worker', q: '  p00 ', sort: 'newestError', page: 3 })),
    ).toEqual({ state: ['offline', 'behind'], host: 'Worker', q: 'p00', sort: 'newestError', page: 3, pageSize: 50 })
  })

  it('never asks for a page below 1', () => {
    expect(fleetQuery(filter({ page: 0 })).page).toBe(1)
  })

  describe('the exact query string the door receives', () => {
    afterEach(() => vi.unstubAllGlobals())

    const urlFor = async (f: FleetFilter): Promise<string> => {
      const fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          statusCode: 200,
          success: true,
          message: '',
          errors: [],
          data: { items: [], total: 0, page: 1, pageSize: 50 },
        }),
      } as unknown as Response)
      vi.stubGlobal('fetch', fetch)
      await syncConsoleApi.fleet(f)
      const url = String(fetch.mock.calls[0][0])
      return url.slice(url.indexOf('ActionSync/'))
    }

    it('repeats state, one key per tile, and drops an Any host and a blank search', async () => {
      const f = toggleTile(toggleTile(DEFAULT_FLEET_FILTER, 'erroring'), 'offline')
      expect(await urlFor(f)).toBe(
        'ActionSync/Fleet?state=offline&state=erroring&sort=mostBehind&page=1&pageSize=50',
      )
    })

    it('sends the host, the search and the sort, and the page asked for', async () => {
      expect(await urlFor(filter({ host: 'Wpf', q: 'Riyadh', sort: 'code', page: 2 }))).toBe(
        'ActionSync/Fleet?host=Wpf&q=Riyadh&sort=code&page=2&pageSize=50',
      )
    })
  })
})

describe('the tiles', () => {
  it('offer All and every state', () => {
    expect(FLEET_TILES).toEqual(['all', ...STORE_STATES])
  })

  it('toggle a state in and out, kept in the contract order, back to page 1', () => {
    const one = toggleTile({ ...DEFAULT_FLEET_FILTER, page: 4 }, 'behind')
    expect(one.states).toEqual(['behind'])
    expect(one.page).toBe(1)
    const two = toggleTile(one, 'onWorker')
    expect(two.states).toEqual(['onWorker', 'behind'])
    expect(toggleTile(two, 'behind').states).toEqual(['onWorker'])
  })

  it('clear every state on All, which then reads as chosen', () => {
    const f = toggleTile(toggleTile(DEFAULT_FLEET_FILTER, 'paused'), 'all')
    expect(f.states).toEqual([])
    expect(tileOn(f, 'all')).toBe(true)
    expect(tileOn(toggleTile(f, 'paused'), 'all')).toBe(false)
    expect(tileOn(toggleTile(f, 'paused'), 'paused')).toBe(true)
  })
})

describe('workerBanner', () => {
  const worker = (instance: string, isStale: boolean): SyncWorker => ({
    instance,
    version: '1.0.0',
    gateOn: true,
    pushWidth: 64,
    pullWidth: 64,
    pushInFlight: 1,
    pullInFlight: 1,
    lastFlushAt: '2026-10-09T12:00:00',
    isStale,
    settings: {},
  })

  it('shows none while every worker is fresh', () => {
    expect(workerBanner([worker('SYNC-01', false)])).toBeNull()
  })

  it('names the stale workers', () => {
    expect(workerBanner([worker('SYNC-01', false), worker('SYNC-02', true)])).toEqual({
      kind: 'stale',
      instances: ['SYNC-02'],
    })
  })

  it('warns when no worker has reported at all', () => {
    expect(workerBanner([])).toEqual({ kind: 'none' })
  })
})

describe('lastLoopError', () => {
  const loop = (lastErrorAt: string | null, lastError: string | null): LoopHealth => ({
    lastPassAt: null,
    lastPassOutcome: 'None',
    lastErrorAt,
    lastError,
  })

  it('is null when neither loop has an error', () => {
    expect(lastLoopError({ push: loop(null, null), pull: loop(null, null) })).toBeNull()
  })

  it('takes the newer of the two', () => {
    expect(
      lastLoopError({ push: loop('2026-10-09T09:00:00', 'push broke'), pull: loop('2026-10-09T11:00:00', 'pull broke') }),
    ).toEqual({ at: '2026-10-09T11:00:00', error: 'pull broke' })
    expect(lastLoopError({ push: loop('2026-10-09T09:00:00', 'push broke'), pull: loop(null, null) })).toEqual({
      at: '2026-10-09T09:00:00',
      error: 'push broke',
    })
  })
})
