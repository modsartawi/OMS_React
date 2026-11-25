import { describe, expect, it } from 'vitest'
import en from '@/locales/en/sync-console.json'
import ar from '@/locales/ar/sync-console.json'
import { LINK_STATES, type LinkHour, type LinkVerdict, type Till, type TillHour } from '@/core/models/sync-console'
import {
  TILL_HOUR_LEGEND,
  TILL_SILENT_AFTER_MS,
  fleetUnstableTills,
  tillHistorySummary,
  tillHourCell,
  tillHourFigures,
  tillLinkCell,
  tillSilent,
  unstableTillsCell,
} from './tills-helpers'

/**
 * The Tills view's pure logic (spec 4288, BackOffice 4290): what one link cell says and how it is coloured. The till
 * judged the link; the console only names it — except that a till which stopped reporting is never shown as healthy.
 */
const at = (bundle: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle)

const keys = (bundle: unknown, prefix: string): string[] =>
  Object.entries((bundle ?? {}) as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  )

const slots = (text: unknown) => [...String(text).matchAll(/<(\w+)>|\{\{(\w+)\}\}/g)].map((m) => m[1] ?? m[2]).sort()

const AS_OF = '2026-11-25T11:00:00'

const verdict = (state: LinkVerdict['state'], extra: Partial<LinkVerdict> = {}): LinkVerdict => ({
  state,
  failPct: 7,
  slowPct: 23,
  p95Ms: 1840,
  since: state === 'online' ? null : '2026-11-25T10:42:00',
  ...extra,
})

const till = (wan: LinkVerdict | null, extra: Partial<Till> = {}): Till => ({
  device: 'R1',
  lastSeenAt: '2026-11-25T10:59:20',
  reportedAt: '2026-11-25T10:59:20',
  wan,
  store: null,
  ...extra,
})

describe('tillLinkCell', () => {
  it('names and colours each state the till judged', () => {
    const cases: [LinkVerdict['state'], string, string][] = [
      ['online', 'tills.states.online', 'ok'],
      ['unstable', 'tills.states.unstable', 'warn'],
      ['offline', 'tills.states.offline', 'bad'],
      ['unknown', 'tills.states.unknown', 'mute'],
      ['local', 'tills.states.local', 'mute'],
    ]
    for (const [state, labelKey, sev] of cases) {
      const t = till(verdict(state))
      const cell = tillLinkCell(t.wan, t, AS_OF)
      expect(cell, state).toMatchObject({ kind: 'verdict', labelKey, sev, state })
      expect(at(en, labelKey), state).toEqual(expect.any(String))
    }
    expect(LINK_STATES).toHaveLength(cases.length)
  })

  it('carries the figures the till judged by, and since for a link that left online', () => {
    const t = till(verdict('unstable'))
    expect(tillLinkCell(t.wan, t, AS_OF)).toMatchObject({
      figures: { failPct: 7, slowPct: 23, p95Ms: 1840 },
      since: '2026-11-25T10:42:00',
    })
    const online = till(verdict('online', { failPct: 0, slowPct: 0, p95Ms: 80 }))
    expect(tillLinkCell(online.wan, online, AS_OF)).toMatchObject({ since: null, figures: { p95Ms: 80 } })
  })

  it('reads a local link as figure-less', () => {
    const t = till(verdict('online'), { store: verdict('local', { failPct: null, slowPct: null, p95Ms: null, since: null }) })
    expect(tillLinkCell(t.store, t, AS_OF)).toMatchObject({ kind: 'verdict', figures: null })
  })

  it("names and colours the store link per state, and says why a main till's store link is local (BackOffice 4291)", () => {
    const cases: [LinkVerdict['state'], string, string][] = [
      ['online', 'tills.states.online', 'ok'],
      ['unstable', 'tills.states.unstable', 'warn'],
      ['offline', 'tills.states.offline', 'bad'],
      ['unknown', 'tills.states.unknown', 'mute'],
    ]
    for (const [state, labelKey, sev] of cases) {
      const t = till(verdict('online'), { store: verdict(state, { p95Ms: 410 }) })
      const cell = tillLinkCell(t.store, t, AS_OF)
      expect(cell, state).toMatchObject({ kind: 'verdict', labelKey, sev, state, noteKey: null })
      if (state !== 'unknown') expect(cell.figures, state).toEqual({ failPct: 7, slowPct: 23, p95Ms: 410 })
    }

    const main = till(verdict('online'), { store: verdict('local', { failPct: null, slowPct: null, p95Ms: null, since: null }) })
    const local = tillLinkCell(main.store, main, AS_OF)
    expect(local).toMatchObject({
      kind: 'verdict',
      labelKey: 'tills.states.local',
      sev: 'mute',
      state: 'local',
      figures: null,
      since: null,
      noteKey: 'tills.localNote',
    })
    expect(at(en, 'tills.localNote')).toEqual(expect.any(String))
  })

  it('shows a never-reported link (NULL from an older build) as no data, never online', () => {
    const t = till(null, { reportedAt: null })
    const cell = tillLinkCell(t.wan, t, AS_OF)
    expect(cell).toMatchObject({ kind: 'noData', labelKey: 'tills.states.noData', sev: 'mute', state: null, figures: null })
  })

  it('lets a stale last-seen beat an old "online" verdict', () => {
    const silent = till(verdict('online'), { lastSeenAt: '2026-11-25T10:50:00', reportedAt: '2026-11-25T10:50:00' })
    const cell = tillLinkCell(silent.wan, silent, AS_OF)
    expect(cell).toMatchObject({ kind: 'silent', labelKey: 'tills.states.silent', sev: 'mute', state: 'online' })
    expect(tillSilent(silent, AS_OF)).toBe(true)
  })

  it('treats a till still seen but no longer reporting (its lamp closed) as silent too', () => {
    const t = till(verdict('online'), { lastSeenAt: '2026-11-25T10:59:50', reportedAt: '2026-11-25T10:40:00' })
    expect(tillLinkCell(t.wan, t, AS_OF)).toMatchObject({ kind: 'silent', state: 'online' })
    expect(tillSilent(t, AS_OF)).toBe(false)
  })

  it('draws the edge: exactly the silence window is still current, one second past is silent', () => {
    const edge = new Date(new Date(AS_OF).getTime() - TILL_SILENT_AFTER_MS)
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T` +
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
    const on = till(verdict('online'), { lastSeenAt: iso(edge), reportedAt: iso(edge) })
    expect(tillLinkCell(on.wan, on, AS_OF).kind).toBe('verdict')
    const past = new Date(edge.getTime() - 1000)
    const off = till(verdict('online'), { lastSeenAt: iso(past), reportedAt: iso(past) })
    expect(tillLinkCell(off.wan, off, AS_OF).kind).toBe('silent')
  })

  it('shows a state this bundle does not know as its raw code, neutral', () => {
    const t = till(verdict('sideways' as never))
    expect(tillLinkCell(t.wan, t, AS_OF)).toMatchObject({ kind: 'verdict', labelKey: null, sev: 'mute' })
  })

  it('a till never seen is silent', () => {
    expect(tillSilent(till(null, { lastSeenAt: null, reportedAt: null }), AS_OF)).toBe(true)
  })
})

describe('the Tills words', () => {
  const enKeys = [...keys(at(en, 'tills'), 'tills.'), 'tabs.tills']

  it('has every key in English and in Arabic, with the same slots', () => {
    expect(enKeys.length).toBeGreaterThan(10)
    expect([...keys(at(ar, 'tills'), 'tills.'), 'tabs.tills'].sort()).toEqual([...enKeys].sort())
    for (const key of enKeys) {
      expect(at(en, key), `en ${key}`).toBeTruthy()
      expect(at(ar, key), `ar ${key}`).toBeTruthy()
      expect(slots(at(ar, key)), key).toEqual(slots(at(en, key)))
    }
  })
})

// ── BackOffice 4292: the till drill-in's 7-day hour strip, and the fleet's per-store count ──────────────────────

const hourOf = (link: Partial<LinkHour> | null): LinkHour | null =>
  link && { checks: 360, failed: 0, slow: 0, maxP95Ms: 120, unstableSeconds: 0, offlineSeconds: 0, ...link }

describe('tillHourCell', () => {
  it('reads an hour with no row as no data, never as healthy', () => {
    expect(tillHourCell(null)).toMatchObject({ cell: 'noData', swatch: 'bg-muted', labelKey: 'tills.history.cells.noData' })
  })

  it('paints the worst thing the till saw in the hour: offline, then unstable, then blips, then online', () => {
    expect(tillHourCell(hourOf({ offlineSeconds: 30, unstableSeconds: 600, failed: 9 })).cell).toBe('offline')
    expect(tillHourCell(hourOf({ unstableSeconds: 1, failed: 2, slow: 40 })).cell).toBe('unstable')
    expect(tillHourCell(hourOf({ failed: 1 })).cell).toBe('blips')
    expect(tillHourCell(hourOf({ slow: 3 })).cell).toBe('blips')
    expect(tillHourCell(hourOf({})).cell).toBe('online')
  })

  it('colours each cell from the token palette, and every cell has its words in both languages', () => {
    const swatches = TILL_HOUR_LEGEND.map((e) => e.swatch)
    expect(swatches).toEqual(['bg-success', 'bg-success/35', 'bg-attention', 'bg-danger', 'bg-muted'])
    for (const entry of TILL_HOUR_LEGEND) {
      expect(at(en, entry.labelKey), entry.labelKey).toEqual(expect.any(String))
      expect(at(ar, entry.labelKey), entry.labelKey).toEqual(expect.any(String))
    }
  })
})

describe('tillHourFigures', () => {
  it('gives the hour in the numbers L1 reads to the network team: counts, p95 and whole minutes', () => {
    expect(tillHourFigures(hourOf({ failed: 4, slow: 80, maxP95Ms: 1840, unstableSeconds: 1800, offlineSeconds: 29 }))).toEqual({
      checks: 360,
      failed: 4,
      slow: 80,
      p95Ms: 1840,
      unstableMinutes: 30,
      offlineMinutes: 0,
    })
    expect(tillHourFigures(hourOf({ unstableSeconds: 30 }))?.unstableMinutes, 'half a minute rounds up to one').toBe(1)
    expect(tillHourFigures(null)).toBeNull()
  })
})

describe('tillHistorySummary', () => {
  it('counts the hours a link was unstable or offline out of the hours it reported', () => {
    const hours: TillHour[] = [
      { hour: '2026-11-25T08:00:00', wan: hourOf({}), store: null },
      { hour: '2026-11-25T09:00:00', wan: hourOf({ unstableSeconds: 600 }), store: hourOf({ offlineSeconds: 60 }) },
      { hour: '2026-11-25T10:00:00', wan: null, store: null },
      { hour: '2026-11-25T11:00:00', wan: hourOf({ offlineSeconds: 120 }), store: hourOf({ failed: 1 }) },
    ]
    expect(tillHistorySummary(hours, 'wan')).toEqual({ reported: 3, troubled: 2 })
    expect(tillHistorySummary(hours, 'store')).toEqual({ reported: 2, troubled: 1 })
    expect(tillHistorySummary([], 'wan')).toEqual({ reported: 0, troubled: 0 })
  })
})

describe('unstableTillsCell', () => {
  it('flags a store with tills on an unstable or offline link, and stays quiet at zero', () => {
    expect(unstableTillsCell({ unstableTills: 3 })).toEqual({ text: '3', sev: 'warn' })
    expect(unstableTillsCell({ unstableTills: 0 })).toEqual({ text: '0', sev: 'mute' })
  })

  it('leaves the cell blank for a door older than BackOffice 4292, never a reassuring 0', () => {
    expect(unstableTillsCell({})).toBeNull()
  })

  it('sums the fleet page', () => {
    expect(fleetUnstableTills([{ unstableTills: 3 }, {}, { unstableTills: 1 }, { unstableTills: 0 }])).toEqual({ tills: 4, stores: 2 })
  })
})
