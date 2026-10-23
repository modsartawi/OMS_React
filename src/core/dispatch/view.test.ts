/**
 * Ticket 541 — the callout's view logic the board's grids and inspector draw (and 542's ledger reuses):
 * the live countdown, each outcome's label, and a bid row's story.
 */
import { describe, expect, it } from 'vitest'
import type { DispatchBid } from '@/core/models/dispatch-board'
import { atpView, bidRow, bidStatusView, calloutClock, countdownLeft, formatClock, outcomeView } from './view'

describe('countdownLeft', () => {
  const fetchedAt = 1_000_000

  it('counts down from secondsLeft by the whole seconds since the fetch', () => {
    expect(countdownLeft(120, fetchedAt, fetchedAt)).toBe(120)
    expect(countdownLeft(120, fetchedAt, fetchedAt + 999)).toBe(120)
    expect(countdownLeft(120, fetchedAt, fetchedAt + 1000)).toBe(119)
    expect(countdownLeft(120, fetchedAt, fetchedAt + 61_500)).toBe(59)
  })

  it('never goes below 0', () => {
    expect(countdownLeft(5, fetchedAt, fetchedAt + 60_000)).toBe(0)
    expect(countdownLeft(0, fetchedAt, fetchedAt + 1000)).toBe(0)
  })

  it('a clock behind the fetch never counts up', () => {
    expect(countdownLeft(30, fetchedAt, fetchedAt - 5000)).toBe(30)
  })

  it('a closed callout (no secondsLeft) has no countdown', () => {
    expect(countdownLeft(null, fetchedAt, fetchedAt)).toBeNull()
  })
})

describe('calloutClock — what the line of an open callout says of its time', () => {
  const readAt = 1_000_000

  it('counts down while time is left', () => {
    expect(calloutClock(140, readAt, readAt + 2000)).toEqual({ kind: 'left', left: 138 })
  })

  it('is due once the countdown reaches 0', () => {
    expect(calloutClock(5, readAt, readAt + 9000)).toEqual({ kind: 'due' })
    expect(calloutClock(0, readAt, readAt)).toEqual({ kind: 'due' })
  })

  it('says nothing of time when the door sent no secondsLeft (never "0:00 left")', () => {
    expect(calloutClock(null, readAt, readAt)).toEqual({ kind: 'none' })
  })
})

describe('formatClock', () => {
  it.each([
    [0, '0:00'],
    [9, '0:09'],
    [65, '1:05'],
    [300, '5:00'],
    [3725, '62:05'],
  ])('%i s reads %s', (s, text) => {
    expect(formatClock(s)).toBe(text)
  })
})

describe('outcomeView', () => {
  it.each([
    ['Open', 'outcome.Open', 'go'],
    ['Taken', 'outcome.Taken', 'ok'],
    ['FellBack', 'outcome.FellBack', 'warn'],
    ['Withdrawn', 'outcome.Withdrawn', 'mute'],
    ['NotCompeted', 'outcome.NotCompeted', 'mute'],
  ])('%s gives its own label', (outcome, key, sev) => {
    expect(outcomeView(outcome)).toEqual({ key, sev, raw: outcome })
  })

  it('an unknown outcome still renders, as itself', () => {
    expect(outcomeView('Escalated')).toEqual({ key: null, sev: 'mute', raw: 'Escalated' })
  })
})

describe('bidStatusView', () => {
  it.each([
    ['OPEN', 'bidStatus.OPEN', 'go'],
    ['TAKEN', 'bidStatus.TAKEN', 'ok'],
    ['PASSED', 'bidStatus.PASSED', 'mute'],
    ['LOST', 'bidStatus.LOST', 'mute'],
    ['EXPIRED', 'bidStatus.EXPIRED', 'warn'],
    ['WITHDRAWN', 'bidStatus.WITHDRAWN', 'mute'],
  ])('%s gives its own label', (status, key, sev) => {
    expect(bidStatusView(status)).toEqual({ key, sev, raw: status })
  })

  it('an unknown status still renders, as itself', () => {
    expect(bidStatusView('HANDED')).toEqual({ key: null, sev: 'mute', raw: 'HANDED' })
  })
})

const bid = (over: Partial<DispatchBid> = {}): DispatchBid => ({
  bidId: 'B1',
  store: 'P014',
  status: 'OPEN',
  offeredAt: '2026-10-23T10:00:00',
  distanceKm: 2.4,
  atpKnown: true,
  atpCoversBasket: true,
  atpShortLines: 0,
  onlineTills: 2,
  signedInTills: 1,
  dark: false,
  deliveredAt: null,
  deliveredRegister: '',
  shownAt: null,
  shownStaff: '',
  shownRegister: '',
  openedAt: null,
  openedStaff: '',
  openedRegister: '',
  answeredAt: null,
  answeredStaff: '',
  answeredRegister: '',
  closedAt: null,
  ignoreReason: '',
  ...over,
})

describe('atpView', () => {
  it('covers', () => {
    expect(atpView(bid())).toEqual({ kind: 'covers' })
  })
  it('short by n lines', () => {
    expect(atpView(bid({ atpCoversBasket: false, atpShortLines: 3 }))).toEqual({ kind: 'short', lines: 3 })
  })
  it('unknown when no stock check ran — whatever the other two say', () => {
    expect(atpView(bid({ atpKnown: false, atpCoversBasket: true }))).toEqual({ kind: 'unknown' })
  })
})

describe('bidRow', () => {
  it('a dark store is marked dark, with its tills online / signed in at offer', () => {
    const row = bidRow(bid({ dark: true, onlineTills: 0, signedInTills: 0 }))
    expect(row.dark).toBe(true)
    expect(row.tills).toEqual({ online: 0, signedIn: 0 })
  })

  it('the four moments carry seconds from offer, staff and register; an unstamped one is null', () => {
    const row = bidRow(
      bid({
        status: 'TAKEN',
        deliveredAt: '2026-10-23T10:00:04',
        deliveredRegister: '02',
        shownAt: '2026-10-23T10:00:09',
        shownStaff: 'amal',
        shownRegister: '02',
        openedAt: null,
        answeredAt: '2026-10-23T10:01:15',
        answeredStaff: 'amal',
        answeredRegister: '02',
      }),
    )
    expect(row.moments).toEqual([
      { kind: 'delivered', at: '2026-10-23T10:00:04', seconds: 4, staff: '', register: '02' },
      { kind: 'shown', at: '2026-10-23T10:00:09', seconds: 9, staff: 'amal', register: '02' },
      { kind: 'opened', at: null, seconds: null, staff: '', register: '' },
      { kind: 'answered', at: '2026-10-23T10:01:15', seconds: 75, staff: 'amal', register: '02' },
    ])
    expect(row.status).toEqual({ key: 'bidStatus.TAKEN', sev: 'ok', raw: 'TAKEN' })
  })

  it('an unknown bid status still gives a row', () => {
    expect(bidRow(bid({ status: 'HANDED' })).status.raw).toBe('HANDED')
  })

  it('keeps the store, km, ATP and the ignore reason', () => {
    const row = bidRow(bid({ status: 'EXPIRED', ignoreReason: 'ShownNotOpened', atpKnown: false }))
    expect([row.store, row.km, row.atp, row.ignoreReason]).toEqual(['P014', 2.4, { kind: 'unknown' }, 'ShownNotOpened'])
  })
})
