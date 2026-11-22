import { describe, expect, it } from 'vitest'
import ar from '@/locales/ar/sync-console.json'
import en from '@/locales/en/sync-console.json'
import type { MirrorDrain, MirrorDrainSlot, MirrorReason } from '@/core/models/sync-console'
import { fsi } from '@/core/util/bidi'
import {
  DRAIN_KEYS,
  chartRows,
  etaView,
  lagTile,
  pieView,
  reasonLine,
  sinceMarker,
  verdictLine,
  when,
  type DrainLine,
} from './mirror-drain-helpers'

/** The Mirror drain page's words (oms 931, BackOffice 4091): what it says for each verdict, in both languages. */

const AS_OF = '2026-11-20T12:05:00'

const slot = (at: string, over: Partial<MirrorDrainSlot> = {}): MirrorDrainSlot => ({
  slot: at,
  partial: false,
  pulled: 0,
  applied: 0,
  parked: 0,
  net: 0,
  pendingAtEnd: 0,
  bad: false,
  why: null,
  ...over,
})

const reason = (over: Partial<MirrorReason>): MirrorReason => ({
  code: 'lagging',
  level: 'warning',
  since: null,
  value: null,
  limit: null,
  kind: null,
  text: '',
  ...over,
})

const drain = (over: Partial<MirrorDrain>): MirrorDrain => ({
  asOf: AS_OF,
  window: '6h',
  slotMinutes: 10,
  verdict: 'healthy',
  reasons: [],
  pending: 0,
  waitingForRetry: 0,
  oldestPendingPulledAt: null,
  lagMinutes: null,
  businessFirst: false,
  businessPending: 0,
  businessOldestPendingPulledAt: null,
  businessLagMinutes: null,
  lastAppliedAt: '2026-11-20T12:04:40',
  lastPulledAt: '2026-11-20T12:04:30',
  parkedOpen: 0,
  parkedLast30Min: 0,
  backpressureThreshold: 50_000,
  pullPaused: false,
  pullPausedSince: null,
  window24h: { pulled: 0, applied: 0, stillPending: 0, parked: 0 },
  applyPerMinute: 0,
  arrivePerMinute: 0,
  etaEmptyAt: null,
  etaPullResumesAt: null,
  slots: [],
  troubleSince: null,
  tillBacklogKnown: null,
  tillBacklogOldestMeasuredAt: null,
  pendingByType: [],
  parkedByReason: [],
  ...over,
})

// The three fixtures the page is drawn for.
const HEALTHY = drain({ pending: 1_200, etaEmptyAt: '2026-11-20T14:20:00', applyPerMinute: 900, arrivePerMinute: 800 })
const BEHIND = drain({
  verdict: 'behind',
  pending: 858_412,
  pullPaused: true,
  pullPausedSince: '2026-11-19T21:38:00',
  troubleSince: '2026-11-19T08:00:00',
  reasons: [
    reason({ code: 'pullPaused', level: 'behind', since: '2026-11-19T21:38:00', value: 858_412, limit: 50_000 }),
    reason({ code: 'trouble', level: 'behind', since: '2026-11-19T08:00:00', value: 36, limit: 3, kind: 'slowApply' }),
    reason({ code: 'lagging', level: 'behind', value: 1_023, limit: 60 }),
  ],
})
const DOWN = drain({
  verdict: 'down',
  pending: 40,
  troubleSince: '2026-11-20T11:50:00',
  reasons: [reason({ code: 'applyStopped', level: 'down', since: '2026-11-20T11:51:00', value: 14, limit: 5 })],
})

/** A line through the locale, as `t()` would read it: the key under `drain`, its `{{values}}` filled. */
function say(locale: unknown, line: DrainLine): string {
  const copy = line.key.split('.').reduce<unknown>((node, k) => (node as Record<string, unknown> | undefined)?.[k], (locale as { drain: unknown }).drain)
  if (typeof copy !== 'string') throw new Error(`no copy for drain.${line.key}`)
  return copy.replace(/\{\{(\w+)\}\}/g, (_, name: string) => line.values[name] ?? `{{${name}}}`)
}

const plain = (s: string) => s.replace(/[⁦-⁩]/g, '')

describe('the verdict sentence', () => {
  it('says healthy with the time the inbox empties', () => {
    expect(plain(say(en, verdictLine(HEALTHY)))).toBe('Draining, empty by 14:20')
    expect(plain(say(en, verdictLine(drain({}))))).toBe('Keeping up: nothing waiting')
  })

  it('says behind since the door’s troubleSince, with the day when it is not today', () => {
    expect(plain(say(en, verdictLine(BEHIND)))).toBe('Falling behind since 2026-11-19 08:00')
  })

  it('falls back to the pull’s pause when the door names no trouble run', () => {
    const paused = { ...BEHIND, troubleSince: null }
    expect(plain(say(en, verdictLine(paused)))).toBe('Falling behind since 2026-11-19 21:38')
    expect(verdictLine({ ...paused, pullPaused: false }).key).toBe('verdict.behind')
  })

  it('says down since the last row applied, never since the trouble run, today in clock time alone', () => {
    expect(plain(say(en, verdictLine(DOWN)))).toBe('Not applying since 11:51')
  })

  it('says the apply worker is silent when that is what made it down', () => {
    const silent = drain({
      verdict: 'down',
      troubleSince: '2026-11-20T10:00:00',
      reasons: [reason({ code: 'applyWorkerStale', level: 'down', since: '2026-11-20T11:58:00' })],
    })
    expect(plain(say(en, verdictLine(silent)))).toBe('The apply worker is silent since 11:58')
    expect(verdictLine({ ...silent, reasons: [{ ...silent.reasons[0], since: null }] }).key).toBe('verdict.downWorker')
  })

  it('isolates every machine value', () => {
    expect(verdictLine(BEHIND).values.since).toBe(fsi('2026-11-19 08:00'))
  })

  it('draws each fixture in both languages, every value filled', () => {
    for (const d of [HEALTHY, BEHIND, DOWN, drain({ verdict: 'noData' })])
      for (const locale of [en, ar]) {
        const lines = [verdictLine(d), ...d.reasons.map((r) => reasonLine(r, d.asOf))]
        for (const line of lines) expect(say(locale, line)).not.toMatch(/\{\{/)
      }
  })
})

describe('the reasons', () => {
  it('word each code from its figures', () => {
    expect(BEHIND.reasons.map((r) => plain(say(en, reasonLine(r, AS_OF))))).toEqual([
      'Pull paused since 2026-11-19 21:38: 858,412 waiting, over the limit of 50,000',
      'Applying at under half the normal rate since 2026-11-19 08:00',
      'The oldest waiting row has waited 17 h 3 min',
    ])
    expect(plain(say(en, reasonLine(DOWN.reasons[0], AS_OF)))).toBe('Nothing applied for 14 min')
    expect(reasonLine(reason({ code: 'applyStopped', level: 'down' }), AS_OF).key).toBe('reasons.applyStoppedNever')
    expect(reasonLine(reason({ code: 'trouble', kind: null }), AS_OF).key).toBe('reasons.trouble.other')
  })

  it('word the lag as the sales’ when business rows go first, and the events’ apart', () => {
    expect(plain(say(en, reasonLine(reason({ code: 'lagging', level: 'behind', value: 61 }), AS_OF, true))))
      .toBe('The oldest sale or shift row has waited 1 h 1 min')
    expect(plain(say(en, reasonLine(reason({ code: 'eventsLagging', level: 'warning', value: 1_575 }), AS_OF, true))))
      .toBe('Event rows wait behind the sales: the oldest has waited 26 h 15 min')
    expect(reasonLine(reason({ code: 'eventsLagging', value: 30 }), AS_OF).key).toBe('reasons.eventsLaggingMinutes')
  })
})

describe('the oldest-waiting tile', () => {
  // 2026-11-20 20:11: the sales 10 min behind, the events 26 h 15 min behind them.
  const firstSales = drain({ businessFirst: true, businessLagMinutes: 10, lagMinutes: 1_575 })

  it('shows the oldest sale, the events under it, with business rows first', () => {
    const tile = lagTile(firstSales)
    expect(tile.label).toBe('tiles.businessLag')
    expect(plain(say(en, tile.value!))).toBe('10 min')
    expect(plain(say(en, tile.note!))).toBe('Events: 26 h 15 min')
    for (const line of [tile.value!, tile.note!]) expect(say(ar, line)).not.toMatch(/\{\{/)
    expect(lagTile({ ...firstSales, businessLagMinutes: null }).value).toBeNull()
  })

  it('shows the whole inbox’s lag otherwise, as before', () => {
    const tile = lagTile(drain({ lagMinutes: 1_023 }))
    expect(tile.label).toBe('tiles.lag')
    expect(plain(say(en, tile.value!))).toBe('17 h 3 min')
    expect(tile.note).toBeNull()
  })
})

describe('the pie', () => {
  it('reads the share applied in the centre, rounded down while rows wait', () => {
    const view = pieView({ pulled: 1_000, applied: 996, stillPending: 3, parked: 1 })
    expect(view.appliedPct).toBe(99)
    expect(view.total).toBe(1_000)
    expect(view.slices.map((s) => [s.part, s.value])).toEqual([
      ['applied', 996],
      ['stillPending', 3],
      ['parked', 1],
    ])
    expect(view.slices.map((s) => s.ink)).toEqual(['var(--success)', 'var(--attention)', 'var(--danger)'])
  })

  it('has no centre figure when nothing was pulled', () => {
    expect(pieView({ pulled: 0, applied: 0, stillPending: 0, parked: 0 }).appliedPct).toBeNull()
  })
})

describe('the “since” marker', () => {
  const slots = ['07:30', '07:40', '07:50', '08:00', '08:10'].map((t) => slot(`2026-11-20T${t}:00`))

  it('stands on the slot holding troubleSince', () => {
    expect(sinceMarker(slots, '2026-11-20T08:00:00')).toEqual({ slot: '2026-11-20T08:00:00', before: false })
    expect(sinceMarker(slots, '2026-11-20T07:45:00')).toEqual({ slot: '2026-11-20T07:40:00', before: false })
  })

  it('stands on the first slot, marked before, when the trouble is older than the window', () => {
    expect(sinceMarker(slots, '2026-11-19T08:00:00')).toEqual({ slot: '2026-11-20T07:30:00', before: true })
  })

  it('is absent with no trouble or no slots', () => {
    expect(sinceMarker(slots, null)).toBeNull()
    expect(sinceMarker([], '2026-11-19T08:00:00')).toBeNull()
  })
})

describe('the ETAs', () => {
  it('reads a null ETA as not draining', () => {
    expect(etaView(null, AS_OF)).toEqual({ kind: 'notDraining' })
    expect(etaView('2026-11-20T14:20:00', AS_OF)).toEqual({ kind: 'at', at: '14:20' })
    expect(etaView('2026-11-21T02:00:00', AS_OF)).toEqual({ kind: 'at', at: '2026-11-21 02:00' })
    expect(etaView(null, AS_OF, false)).toEqual({ kind: 'notPaused' })
  })
})

describe('the bars', () => {
  it('label ten-minute slots by clock time and the week by day and time', () => {
    const d = drain({ slots: [slot('2026-11-20T11:50:00', { pulled: 5, applied: 7, pendingAtEnd: 3, bad: true, why: 'slowApply' })] })
    expect(chartRows(d)).toEqual([
      { slot: '2026-11-20T11:50:00', label: '11:50', pulled: 5, applied: 7, parked: 0, pending: 3, bad: true, why: 'slowApply', partial: false },
    ])
    expect(chartRows({ ...d, window: '7d', slotMinutes: 60 })[0].label).toBe('11-20 11:50')
  })
})

describe('the copy', () => {
  it('has every line the page can say, in English and Arabic', () => {
    for (const locale of [en, ar])
      for (const key of DRAIN_KEYS) expect(() => say(locale, { key, values: {} }), key).not.toThrow()
  })

  it('formats a day other than today with the day', () => {
    expect(when('2026-11-19T08:00:00', AS_OF)).toBe('2026-11-19 08:00')
    expect(when(null, AS_OF)).toBe('')
  })
})
