/**
 * Ticket 480 — a Deliverect store's stock sync health, the rule behind the store grid's highlight:
 * a failed last run is red, an overdue store is amber, a paused store is never overdue, a store
 * Deliverect has not linked yet is never overdue, and a store whose `sync` block is null (2624 not
 * shipped) has no reading at all.
 */
import { describe, expect, it } from 'vitest'
import type { DeliverectStoreRow, DeliverectStoreSync } from '@/core/models/deliverect'
import {
  DELTA_OVERDUE_MINUTES,
  FULL_SYNC_GRACE_MINUTES,
  FULL_SYNC_HOUR,
  parseLocal,
  runFailed,
  syncHealth,
  syncHighlight,
  syncTypeKey,
} from './sync-health'

type Subject = Pick<DeliverectStoreRow, 'sync' | 'deliverectLocationId'> & Partial<Pick<DeliverectStoreRow, 'linkedAt'>>

const sync = (over: Partial<DeliverectStoreSync> = {}): DeliverectStoreSync => ({
  active: true,
  lastFullRun: '2026-10-12T07:05:00',
  lastDeltaRun: '2026-10-12T10:30:00',
  lastStatus: 'S',
  lastError: null,
  ...over,
})

const linked = (s: DeliverectStoreSync | null): Subject => ({ sync: s, deliverectLocationId: '64f0c2' })

/** Local wall-clock — the contract's times carry no offset, and neither does this. */
const at = (hh: number, mm: number, day = 12) => new Date(2026, 9, day, hh, mm, 0)

describe('the cadence thresholds (spec 2615 "Cadence")', () => {
  it('a full run is due after 07:00 and overdue past 07:30; a delta is overdue after 60 minutes (twice the 30)', () => {
    expect([FULL_SYNC_HOUR, FULL_SYNC_GRACE_MINUTES, DELTA_OVERDUE_MINUTES]).toEqual([7, 30, 60])
  })
})

describe('parseLocal — "yyyy-MM-ddTHH:mm:ss" read as local wall-clock, never UTC', () => {
  it('reads the local parts as written', () => {
    const d = parseLocal('2026-10-12T07:05:09')!
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([2026, 9, 12, 7, 5, 9])
  })

  it('null, empty and unreadable are null', () => {
    expect([parseLocal(null), parseLocal(''), parseLocal('yesterday')]).toEqual([null, null, null])
  })
})

describe('syncHealth', () => {
  it('no sync block (2624 not shipped) → no reading', () => {
    expect(syncHealth(linked(null), at(11, 0))).toBeNull()
  })

  it('a successful full this morning and a recent delta → ok', () => {
    expect(syncHealth(linked(sync()), at(11, 0))).toEqual({ health: 'ok', fullOverdue: false, deltaOverdue: false })
  })

  it('"S" is the only success: any other non-null status is failed (red)', () => {
    for (const status of ['E', 'F', 'X', 's'])
      expect([status, syncHealth(linked(sync({ lastStatus: status })), at(11, 0))?.health]).toEqual([status, 'failed'])
    expect(syncHighlight('failed')).toBe('bad')
  })

  it('failed beats overdue', () => {
    expect(syncHealth(linked(sync({ lastStatus: 'E', lastDeltaRun: '2026-10-12T08:00:00' })), at(11, 0))?.health).toBe('failed')
  })

  it('🚩 paused beats failed — a store paused for its bad stock reads Paused, not red', () => {
    expect(syncHealth(linked(sync({ lastStatus: 'E', active: false })), at(11, 0))?.health).toBe('paused')
  })

  it('no full run since today 07:00 once it is past 07:30 → overdue (amber)', () => {
    const yesterdaysFull = sync({ lastFullRun: '2026-10-11T07:04:00', lastDeltaRun: '2026-10-12T07:20:00' })
    expect(syncHealth(linked(yesterdaysFull), at(7, 30))).toEqual({ health: 'ok', fullOverdue: false, deltaOverdue: false })
    expect(syncHealth(linked(yesterdaysFull), at(7, 31))).toEqual({ health: 'overdue', fullOverdue: true, deltaOverdue: false })
    expect(syncHighlight('overdue')).toBe('warn')
  })

  it('before 07:30 yesterday\'s full is not yet overdue', () => {
    const s = sync({ lastFullRun: '2026-10-11T07:04:00', lastDeltaRun: '2026-10-12T06:50:00' })
    expect(syncHealth(linked(s), at(7, 15))?.health).toBe('ok')
  })

  it('no run of either kind in the last 60 minutes → overdue', () => {
    const s = sync({ lastFullRun: '2026-10-12T07:05:00', lastDeltaRun: '2026-10-12T09:59:00' })
    expect(syncHealth(linked(s), at(10, 59))?.health).toBe('ok')
    expect(syncHealth(linked(s), at(11, 0))).toEqual({ health: 'overdue', fullOverdue: false, deltaOverdue: true })
  })

  it('a fresh full run counts as the latest run — no delta yet right after it is not overdue', () => {
    const s = sync({ lastFullRun: '2026-10-12T07:05:00', lastDeltaRun: '2026-10-11T23:30:00' })
    expect(syncHealth(linked(s), at(7, 40))?.health).toBe('ok')
  })

  it('both overdue at once', () => {
    const s = sync({ lastFullRun: '2026-10-11T07:05:00', lastDeltaRun: '2026-10-12T08:00:00' })
    expect(syncHealth(linked(s), at(11, 0))).toEqual({ health: 'overdue', fullOverdue: true, deltaOverdue: true })
  })

  it('🚩 a paused store is never overdue — it reads Paused, no highlight', () => {
    const stale = sync({ active: false, lastFullRun: '2026-10-01T07:05:00', lastDeltaRun: '2026-10-01T08:00:00' })
    expect(syncHealth(linked(stale), at(11, 0))).toEqual({ health: 'paused', fullOverdue: false, deltaOverdue: false })
    expect(syncHighlight('paused')).toBeNull()
  })

  it('a store Deliverect has not linked yet is never overdue (the worker syncs linked stores)', () => {
    const subject: Subject = { sync: sync({ lastFullRun: null, lastDeltaRun: null, lastStatus: null }), deliverectLocationId: null }
    expect(syncHealth(subject, at(11, 0))).toEqual({ health: 'notRun', fullOverdue: false, deltaOverdue: false })
  })

  it('never ran (null status) is neutral — unless the linked, active store is behind', () => {
    const never = sync({ lastFullRun: null, lastDeltaRun: null, lastStatus: null })
    expect(syncHighlight('notRun')).toBeNull()
    expect(syncHealth(linked(never), at(11, 0))).toEqual({ health: 'overdue', fullOverdue: true, deltaOverdue: true })
    expect(syncHealth({ sync: never, deliverectLocationId: null }, at(11, 0))?.health).toBe('notRun')
  })

  it('a store linked in the last 60 minutes is given that long for its first run — then the rules apply', () => {
    const never = sync({ lastFullRun: null, lastDeltaRun: null, lastStatus: null })
    const justLinked = { sync: never, deliverectLocationId: '64f0c2', linkedAt: '2026-10-12T10:30:00' }
    expect(syncHealth(justLinked, at(11, 0))?.health).toBe('notRun')
    expect(syncHealth(justLinked, at(11, 30))?.health).toBe('notRun')
    expect(syncHealth(justLinked, at(11, 31))).toEqual({ health: 'overdue', fullOverdue: true, deltaOverdue: true })
  })

  it('ok has no highlight', () => {
    expect(syncHighlight('ok')).toBeNull()
  })
})

describe('the log drawer\'s run labels', () => {
  it('syncType F is full, D is delta, anything else has no label (shown raw)', () => {
    expect([syncTypeKey('F'), syncTypeKey('D'), syncTypeKey('X')]).toEqual(['full', 'delta', null])
  })

  it('a run failed when its status is non-null and not "S"', () => {
    expect([runFailed('S'), runFailed(null), runFailed('E')]).toEqual([false, false, true])
  })
})
