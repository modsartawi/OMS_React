import { describe, expect, it } from 'vitest'
import type { MirrorLane, MirrorWorker } from '@/core/models/sync-console'
import {
  noMirrorHour,
  normaliseFleet,
  normaliseLastHour,
  normaliseStoreHours,
  normaliseWorkers,
  notOnMirrorLane,
  withMirrorLane,
} from './wire'

/**
 * The boundary fill (ticket 456): a door that has not shipped spec 2563 yet must read
 * as "not on mirror", "not judged", the store worker and "no data" — and a door that
 * HAS shipped it must pass through untouched.
 */

const loop = { lastPassAt: null, lastPassOutcome: 'None' as const, lastErrorAt: null, lastError: null }
const oldRow = {
  code: 'P001',
  description: 'Store P001',
  host: 'Worker' as const,
  isPaused: false,
  controlPending: false,
  states: ['onWorker' as const],
  lastConnectOkAt: null,
  lastConnectFailAt: null,
  lastConnectError: null,
  backoffUntil: null,
  push: loop,
  pull: loop,
  pendingActions: 0,
  oldestPendingActionAt: null,
  lastTrxPulledAt: null,
  healthUpdatedAt: null,
}
const lane: MirrorLane = {
  onMirror: true,
  lastPullAt: '2026-10-10T09:00:00',
  lastPullOkAt: '2026-10-10T09:00:00',
  lastConnectOkAt: '2026-10-10T09:00:00',
  lastConnectFailAt: null,
  lastConnectError: null,
  tillBacklogCount: 0,
  tillBacklogOldestAt: null,
  inboxPending: 5,
  inboxDeferred: 0,
  oldestDeferredAt: null,
  openDeadLetters: 1,
}

describe('notOnMirrorLane', () => {
  it('is the contract not-on-mirror lane: onMirror false, nulls and zeros, a never-measured backlog', () => {
    expect(notOnMirrorLane()).toEqual({
      onMirror: false,
      lastPullAt: null,
      lastPullOkAt: null,
      lastConnectOkAt: null,
      lastConnectFailAt: null,
      lastConnectError: null,
      tillBacklogCount: null,
      tillBacklogOldestAt: null,
      inboxPending: 0,
      inboxDeferred: 0,
      oldestDeferredAt: null,
      openDeadLetters: 0,
    })
  })

  it('is a fresh object each time, so no row can change another', () => {
    expect(notOnMirrorLane()).not.toBe(notOnMirrorLane())
  })
})

describe('normaliseFleet / withMirrorLane', () => {
  it('fills a missing lane as not on mirror and a missing agreement as notJudged', () => {
    const page = normaliseFleet({ items: [oldRow], total: 1, page: 1, pageSize: 50 })
    expect(page).toMatchObject({ total: 1, page: 1, pageSize: 50 })
    expect(page.items[0].mirror).toEqual(notOnMirrorLane())
    expect(page.items[0].agreement).toBe('notJudged')
    expect(page.items[0].code).toBe('P001')
  })

  it('passes a lane and an agreement the door sent through as they are', () => {
    const row = withMirrorLane({ ...oldRow, mirror: lane, agreement: 'disagree' as const })
    expect(row.mirror).toBe(lane)
    expect(row.agreement).toBe('disagree')
  })

  it('reads a null lane like a missing one, and never touches the states', () => {
    const row = withMirrorLane({ ...oldRow, states: ['onWorker', 'mirrorOffline'] as const, mirror: null, agreement: null })
    expect(row.mirror.onMirror).toBe(false)
    expect(row.agreement).toBe('notJudged')
    expect(row.states).toEqual(['onWorker', 'mirrorOffline'])
  })

  it('keeps the store header own members', () => {
    const header = withMirrorLane({ ...oldRow, controlVersion: 3, appliedVersion: 2, appliedAt: null })
    expect(header).toMatchObject({ controlVersion: 3, appliedVersion: 2, mirror: { onMirror: false } })
  })
})

describe('normaliseWorkers', () => {
  const storeWorker = {
    instance: 'SYNC-01',
    version: '1.0.0',
    gateOn: true,
    pushWidth: 64,
    pullWidth: 64,
    pushInFlight: 1,
    pullInFlight: 1,
    lastFlushAt: null,
    isStale: false,
    settings: {},
  }
  const pull: MirrorWorker = {
    rail: 'mirrorPull',
    instance: 'SISAPI-01',
    version: '2.0.0',
    startedAt: null,
    lastTickAt: null,
    lastTickOutcome: 'None',
    lastTickMessage: null,
    inboxPending: null,
    backpressureThreshold: null,
    isStale: false,
    settings: {},
  }

  it('reads an item with no rail as the store sync worker', () => {
    expect(normaliseWorkers({ items: [storeWorker] }).items).toEqual([{ ...storeWorker, rail: 'store' }])
  })

  it('passes the mirror roles and a sent rail through', () => {
    const items = normaliseWorkers({ items: [{ ...storeWorker, rail: 'store' }, pull] }).items
    expect(items.map((w) => w.rail)).toEqual(['store', 'mirrorPull'])
    expect(items[1]).toBe(pull)
  })
})

describe('normaliseStoreHours', () => {
  const hour = { hour: '2026-10-10T09:00:00', cell: 'work' as const, pushPasses: 1, pullPasses: 1, connectFailures: 0, actionsPushed: 3, trxPulled: 2, errors: 0 }

  it('fills a missing mirror member as noData with zeros', () => {
    const items = normaliseStoreHours({ items: [hour] }).items
    expect(items[0].mirror).toEqual({ cell: 'noData', sweeps: 0, connectFailures: 0, rowsPulled: 0, applied: 0, deferred: 0, errored: 0, deadLettered: 0 })
    expect(items[0].cell).toBe('work')
  })

  it('passes a sent mirror member through', () => {
    const mirror = { ...noMirrorHour(), cell: 'idle' as const, sweeps: 4 }
    expect(normaliseStoreHours({ items: [{ ...hour, mirror }] }).items[0].mirror).toBe(mirror)
  })
})

describe('normaliseLastHour', () => {
  const totals = { hour: '2026-10-10T09:00:00', pushPasses: 1, pullPasses: 2, connectFailures: 3, chunksPushed: 4, actionsPushed: 5, trxPulled: 6, errors: 7 }

  it('fills missing mirror totals with zeros, both hours, and keeps the rest', () => {
    const data = normaliseLastHour({ current: totals, previous: totals })
    for (const h of [data.current, data.previous]) {
      expect(h).toMatchObject(totals)
      expect(h).toMatchObject({ mirrorSweeps: 0, mirrorConnectFailures: 0, mirrorPulled: 0, mirrorApplied: 0, mirrorDeferred: 0, mirrorDeadLettered: 0 })
    }
  })

  it('keeps the mirror totals the door sent', () => {
    const sent = { ...totals, mirrorSweeps: 9, mirrorConnectFailures: 1, mirrorPulled: 800, mirrorApplied: 790, mirrorDeferred: 4, mirrorDeadLettered: 2 }
    expect(normaliseLastHour({ current: sent, previous: totals }).current).toEqual(sent)
  })
})
