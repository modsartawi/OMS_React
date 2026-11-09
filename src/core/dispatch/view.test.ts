/**
 * Ticket 541 — the callout's view logic the board's grids and inspector draw (and 542's ledger reuses):
 * the live countdown, each outcome's label, and a bid row's story.
 */
import { describe, expect, it } from 'vitest'
import type { DispatchBid } from '@/core/models/dispatch-board'
import { hasLocaleKey as has } from '@/core/test/locale'
import enBoard from '@/locales/en/dispatch-board.json'
import arBoard from '@/locales/ar/dispatch-board.json'
import enDoc from '@/locales/en/document.json'
import arDoc from '@/locales/ar/document.json'
import { atpView, bidRow, bidStatusView, calloutClock, countdownLeft, formatClock, outcomeView, searchRadiusLabelKey, searchRadiusView } from './view'

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

describe('searchRadiusView (spec 3326, oms 715)', () => {
  it('10 km reads "Searched 10 km"', () => {
    expect(searchRadiusView({ searchRadiusKm: 10 })).toEqual({ kind: 'searched', km: '10' })
  })

  it('a wider fractional radius keeps its decimals', () => {
    expect(searchRadiusView({ searchRadiusKm: 7.5 })).toEqual({ kind: 'searched', km: '7.5' })
  })

  it('0 reads "No radius search"', () => {
    expect(searchRadiusView({ searchRadiusKm: 0 })).toEqual({ kind: 'none' })
  })

  it('absent (a server before 3326) shows nothing', () => {
    expect(searchRadiusView({})).toBeNull()
  })
})

describe('searchRadiusView — how the radius was measured (BackOffice spec 3460, door 3472; oms 858)', () => {
  it('no measure (an Off type, or a server before 3472) reads exactly as today', () => {
    expect(searchRadiusView({ searchRadiusKm: 5, distanceMeasure: '' })).toEqual({ kind: 'searched', km: '5' })
    expect(searchRadiusView({ searchRadiusKm: 5 })).toEqual({ kind: 'searched', km: '5' })
  })

  it('ROAD reads "5 km by road"', () => {
    expect(searchRadiusView({ searchRadiusKm: 5, distanceMeasure: 'ROAD' })).toEqual({
      kind: 'searched',
      km: '5',
      measure: { kind: 'road' },
    })
  })

  it('a widened ROAD search reads "10 km by road · widened"', () => {
    expect(searchRadiusView({ searchRadiusKm: 10, distanceMeasure: 'ROAD', searchWidened: true })).toEqual({
      kind: 'searched',
      km: '10',
      measure: { kind: 'road' },
      widened: true,
    })
  })

  it('a straight-line fallback carries its reason: "5 km · straight-line (fallback: timeout)"', () => {
    expect(
      searchRadiusView({ searchRadiusKm: 5, distanceMeasure: 'STRAIGHT_FALLBACK', distanceFallbackReason: 'TIMEOUT' }),
    ).toEqual({ kind: 'searched', km: '5', measure: { kind: 'fallback', reason: { key: 'TIMEOUT' } } })
  })

  it('a fallback reason the client does not know is kept raw, to show as itself', () => {
    expect(
      searchRadiusView({ searchRadiusKm: 5, distanceMeasure: 'STRAIGHT_FALLBACK', distanceFallbackReason: 'DNS' }),
    ).toEqual({ kind: 'searched', km: '5', measure: { kind: 'fallback', reason: { raw: 'DNS' } } })
  })

  it('a fallback with no reason on the row (the door before the BO ask) reads plain "(fallback)"', () => {
    expect(searchRadiusView({ searchRadiusKm: 5, distanceMeasure: 'STRAIGHT_FALLBACK' })).toEqual({
      kind: 'searched',
      km: '5',
      measure: { kind: 'fallback', reason: null },
    })
  })

  it('SHADOW reads "5 km · shadow"', () => {
    expect(searchRadiusView({ searchRadiusKm: 5, distanceMeasure: 'SHADOW' })).toEqual({
      kind: 'searched',
      km: '5',
      measure: { kind: 'shadow' },
    })
  })

  it('a measure the client does not know reads as no measure', () => {
    expect(searchRadiusView({ searchRadiusKm: 5, distanceMeasure: 'HELICOPTER' })).toEqual({ kind: 'searched', km: '5' })
  })

  it('no radius search stays "No radius search" whatever the measure', () => {
    expect(searchRadiusView({ searchRadiusKm: 0, distanceMeasure: 'ROAD' })).toEqual({ kind: 'none' })
  })
})

describe('bidRow — road km on a shadow callout (spec 3460, oms 858)', () => {
  it('a shadow callout shows each bid road km beside its straight-line km', () => {
    const row = bidRow(bid({ distanceKm: 3.9, straightKm: 3.9, roadKm: 12.2 }), 'SHADOW')
    expect([row.km, row.roadKm]).toEqual([3.9, 12.2])
  })

  it('a shadow bid Google could not measure (road 0) shows no road km', () => {
    expect(bidRow(bid({ straightKm: 2.4, roadKm: 0 }), 'SHADOW').roadKm).toBeUndefined()
  })

  it('a road or unmeasured callout shows the decision km alone, as today', () => {
    expect(bidRow(bid({ distanceKm: 12.2, straightKm: 3.9, roadKm: 12.2 }), 'ROAD').roadKm).toBeUndefined()
    expect(bidRow(bid({ roadKm: 12.2 })).roadKm).toBeUndefined()
  })
})

describe('the measure as the wire may spell it (858 review)', () => {
  it('a measure is matched trimmed and upper case, like the reason', () => {
    expect(searchRadiusView({ searchRadiusKm: 5, distanceMeasure: ' road ' })).toEqual({ kind: 'searched', km: '5', measure: { kind: 'road' } })
    expect(bidRow(bid({ distanceKm: 3.9, straightKm: 3.9, roadKm: 12.2 }), 'shadow ').roadKm).toBe(12.2)
  })
})

describe('searchRadiusLabelKey — one locale sentence per measure, widened or not (858 review)', () => {
  const key = (input: Parameters<typeof searchRadiusView>[0]) => {
    const view = searchRadiusView(input)
    return view?.kind === 'searched' ? searchRadiusLabelKey(view) : null
  }
  it.each([
    [{ searchRadiusKm: 5 }, 'inspector.searchRadius'],
    [{ searchRadiusKm: 5, searchWidened: true }, 'inspector.searchRadius_widened'],
    [{ searchRadiusKm: 5, distanceMeasure: 'ROAD' }, 'inspector.radiusByRoad'],
    [{ searchRadiusKm: 5, distanceMeasure: 'ROAD', searchWidened: true }, 'inspector.radiusByRoad_widened'],
    [{ searchRadiusKm: 5, distanceMeasure: 'SHADOW', searchWidened: true }, 'inspector.radiusShadow_widened'],
    [{ searchRadiusKm: 5, distanceMeasure: 'STRAIGHT_FALLBACK' }, 'inspector.radiusFallback'],
    [
      { searchRadiusKm: 5, distanceMeasure: 'STRAIGHT_FALLBACK', distanceFallbackReason: 'QUOTA', searchWidened: true },
      'inspector.radiusFallbackReason_widened',
    ],
  ] as const)('%j → %s', (input, expected) => {
    expect(key(input)).toBe(expected)
  })

  it.each([
    ['en', enBoard, enDoc],
    ['ar', arBoard, arDoc],
  ])('every label, widened or not, and the ledger road km exist in %s', (_, board, doc) => {
    const bases = ['searchRadius', 'radiusByRoad', 'radiusShadow', 'radiusFallback', 'radiusFallbackReason']
    for (const k of bases.flatMap((b) => [`inspector.${b}`, `inspector.${b}_widened`])) expect([k, has(board, k)]).toEqual([k, true])
    expect(has(doc, 'callout.ledger.roadKm')).toBe(true)
  })
})
