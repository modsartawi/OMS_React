import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MIRROR_STATES,
  STORE_STATES,
  type LoopHealth,
  type MirrorLane,
  type MirrorWorker,
  type StoreRow,
  type StoreState,
  type SyncWorker,
  type WorkerItem,
} from '@/core/models/sync-console'
import { syncConsoleApi } from './api'
import {
  DEFAULT_FLEET_FILTER,
  FLEET_SORTS,
  FLEET_TILES,
  fleetQuery,
  lastLoopError,
  mirrorLaneChip,
  stateBadge,
  tickOutcomeBadge,
  tileOn,
  toggleTile,
  workerBanner,
  workerCardItems,
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
  // Changed deliberately by 456: the mirror states joined STORE_STATES, and the
  // railsDisagree tile is rail agreement's (459), so it is held out of the row.
  it('offer All and every state but railsDisagree, the four mirror tiles last', () => {
    expect(FLEET_TILES).toEqual(['all', ...STORE_STATES.filter((s) => s !== 'railsDisagree')])
    expect(FLEET_TILES.slice(-4)).toEqual(['mirrorOffline', 'mirrorBehind', 'deadLetters', 'deferredTooLong'])
    expect(FLEET_TILES).not.toContain('railsDisagree')
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
    rail: 'store',
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

// ── Spec 2563, ticket 456: the mirror lane ──────────────────────────────────────

describe('the mirror states', () => {
  it('read as ruled: offline, dead letters and rails disagree bad; behind and deferred too long a warning', () => {
    expect(stateBadge('mirrorOffline').sev).toBe('bad')
    expect(stateBadge('deadLetters').sev).toBe('bad')
    expect(stateBadge('railsDisagree').sev).toBe('bad')
    expect(stateBadge('mirrorBehind').sev).toBe('warn')
    expect(stateBadge('deferredTooLong').sev).toBe('warn')
  })

  it('are four, and railsDisagree is not one of them', () => {
    expect(MIRROR_STATES).toEqual(['mirrorOffline', 'mirrorBehind', 'deadLetters', 'deferredTooLong'])
  })
})

describe('FLEET_SORTS', () => {
  it('appends the two mirror sorts after the store worker four', () => {
    expect(FLEET_SORTS).toEqual(['mostBehind', 'longestOffline', 'newestError', 'code', 'largestBacklog', 'mostDeadLetters'])
    for (const s of FLEET_SORTS) expect((en.table.sorts as Record<string, string>)[s]).toBeTruthy()
  })
})

describe('mirrorLaneChip', () => {
  const lane = (over: Partial<MirrorLane> = {}): MirrorLane => ({
    onMirror: true,
    lastPullAt: '2026-10-10T09:00:00',
    lastPullOkAt: '2026-10-10T09:00:00',
    lastConnectOkAt: '2026-10-10T09:00:00',
    lastConnectFailAt: null,
    lastConnectError: null,
    tillBacklogCount: 1200,
    tillBacklogOldestAt: '2026-10-10T08:10:00',
    inboxPending: 40,
    inboxDeferred: 2,
    oldestDeferredAt: null,
    openDeadLetters: 3,
    ...over,
  })
  const row = (states: string[], over: Partial<MirrorLane> = {}) =>
    ({ states: states as StoreState[], mirror: lane(over) }) as Pick<StoreRow, 'mirror' | 'states'>

  it('is healthy (go) on mirror with no mirror state, carrying the three counts', () => {
    expect(mirrorLaneChip(row(['onWorker']))).toEqual({
      kind: 'onMirror',
      sev: 'go',
      worst: null,
      tillBacklogCount: 1200,
      inboxPending: 40,
      openDeadLetters: 3,
    })
  })

  it('takes the worst mirror state: bad beats warn, whatever the order the door sent', () => {
    const chip = mirrorLaneChip(row(['onWorker', 'mirrorBehind', 'deadLetters', 'deferredTooLong']))
    expect(chip.kind === 'onMirror' && chip.worst).toBe('deadLetters')
    expect(chip.sev).toBe('bad')
  })

  it('keeps the contract order on a tie', () => {
    const chip = mirrorLaneChip(row(['deadLetters', 'mirrorOffline']))
    expect(chip.kind === 'onMirror' && chip.worst).toBe('mirrorOffline')
    const warn = mirrorLaneChip(row(['deferredTooLong', 'mirrorBehind']))
    expect(warn.kind === 'onMirror' && warn.worst).toBe('mirrorBehind')
    expect(warn.sev).toBe('warn')
  })

  it('maps every mirror-set state to a severity token and a label that exists', () => {
    for (const s of MIRROR_STATES) {
      const chip = mirrorLaneChip(row([s]))
      expect(chip.kind === 'onMirror' && chip.worst).toBe(s)
      expect(['warn', 'bad']).toContain(chip.sev)
      expect((en.states as Record<string, string>)[s]).toBeTruthy()
    }
  })

  it('is not on mirror, muted and with no state, when onMirror is false — even if a state arrived', () => {
    expect(mirrorLaneChip(row(['onWpf', 'mirrorOffline', 'deadLetters'], { onMirror: false }))).toEqual({
      kind: 'notOnMirror',
      sev: 'mute',
    })
  })

  it('ignores states that are not the lane: railsDisagree, the store states, an unknown code', () => {
    const chip = mirrorLaneChip(row(['offline', 'erroring', 'railsDisagree', 'mirrorQuarantined', 'toString']))
    expect(chip).toMatchObject({ kind: 'onMirror', sev: 'go', worst: null })
  })

  it('keeps a never-measured till backlog null, not 0', () => {
    const never = mirrorLaneChip(row([], { tillBacklogCount: null }))
    expect(never.kind === 'onMirror' && never.tillBacklogCount).toBeNull()
    const zero = mirrorLaneChip(row([], { tillBacklogCount: 0 }))
    expect(zero.kind === 'onMirror' && zero.tillBacklogCount).toBe(0)
  })

  it('reads a row with no lane at all as not on mirror, never as healthy', () => {
    const bare = { states: ['mirrorOffline'] } as unknown as Pick<StoreRow, 'mirror' | 'states'>
    expect(mirrorLaneChip(bare).kind).toBe('notOnMirror')
  })
})

describe('tickOutcomeBadge', () => {
  it('labels every outcome; backpressure is a warning, never idle; Faulted is bad', () => {
    for (const o of ['Swept', 'Applied', 'SkippedLockHeld', 'SkippedBackpressure', 'Faulted', 'None']) {
      const b = tickOutcomeBadge(o)
      expect(b.labelKey).toBe(`tickOutcomes.${o}`)
      expect((en.tickOutcomes as Record<string, string>)[o]).toBeTruthy()
    }
    expect(tickOutcomeBadge('SkippedBackpressure').sev).toBe('warn')
    expect(tickOutcomeBadge('Faulted').sev).toBe('bad')
    expect(tickOutcomeBadge('None').sev).toBe('mute')
  })

  it('leaves an unknown outcome neutral and raw', () => {
    expect(tickOutcomeBadge('Exploded')).toEqual({ labelKey: null, sev: 'mute' })
    expect(tickOutcomeBadge('constructor')).toEqual({ labelKey: null, sev: 'mute' })
  })
})

describe('workerCardItems', () => {
  const store = (instance: string): SyncWorker => ({
    rail: 'store',
    instance,
    version: '1.0.0',
    gateOn: true,
    pushWidth: 64,
    pullWidth: 64,
    pushInFlight: 1,
    pullInFlight: 1,
    lastFlushAt: '2026-10-10T09:00:00',
    isStale: false,
    settings: {},
  })
  const mirror = (rail: MirrorWorker['rail'], over: Partial<MirrorWorker> = {}): MirrorWorker => ({
    rail,
    instance: 'SISAPI-01',
    version: '2.0.0',
    startedAt: '2026-10-10T06:00:00',
    lastTickAt: '2026-10-10T09:00:00',
    lastTickOutcome: rail === 'mirrorPull' ? 'Swept' : 'Applied',
    lastTickMessage: null,
    inboxPending: rail === 'mirrorPull' ? 1200 : null,
    backpressureThreshold: rail === 'mirrorPull' ? 50000 : null,
    isStale: false,
    settings: {},
    ...over,
  })

  it('narrows on rail: the store worker apart, then Mirror pull, then Mirror apply', () => {
    const items = workerCardItems([mirror('mirrorApply'), store('SYNC-01'), mirror('mirrorPull')])
    expect(items.store.map((w) => w.instance)).toEqual(['SYNC-01'])
    expect(items.mirror.map((m) => m.worker.rail)).toEqual(['mirrorPull', 'mirrorApply'])
  })

  it('gives a stale mirror role its own banner, from the door isStale alone', () => {
    const items = workerCardItems([store('SYNC-01'), mirror('mirrorPull'), mirror('mirrorApply', { isStale: true })])
    expect(items.mirror.map((m) => [m.worker.rail, m.stale])).toEqual([
      ['mirrorPull', false],
      ['mirrorApply', true],
    ])
    // A mirror role going stale does not raise the store worker's banner.
    expect(workerBanner(items.store)).toBeNull()
  })

  it('reads SkippedBackpressure as a warning and Faulted as bad', () => {
    const items = workerCardItems([
      mirror('mirrorPull', { lastTickOutcome: 'SkippedBackpressure' }),
      mirror('mirrorApply', { lastTickOutcome: 'Faulted' }),
    ])
    expect(items.mirror.map((m) => m.outcome.sev)).toEqual(['warn', 'bad'])
  })

  it('draws nothing for a mirror role the door did not list, and keys "none reported" on the store worker', () => {
    const onlyMirror = workerCardItems([mirror('mirrorApply')])
    expect(onlyMirror.mirror).toHaveLength(1)
    expect(workerBanner(onlyMirror.store)).toEqual({ kind: 'none' })
    expect(workerCardItems([store('SYNC-01')]).mirror).toEqual([])
  })

  it('leaves out an item whose rail it does not know', () => {
    const odd = { ...mirror('mirrorPull'), rail: 'mirrorAudit' } as unknown as WorkerItem
    const items = workerCardItems([odd, store('SYNC-01')])
    expect(items.mirror).toEqual([])
    expect(items.store).toHaveLength(1)
  })
})
