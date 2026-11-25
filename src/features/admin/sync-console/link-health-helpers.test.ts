import { describe, expect, it } from 'vitest'
import en from '@/locales/en/sync-console.json'
import ar from '@/locales/ar/sync-console.json'
import { LINK_HEALTH_VIEWS, type LinkHealthCell, type LinkHealthStore } from '@/core/models/sync-console'
import {
  CHRONIC_MIN,
  DEFAULT_LINK_HEALTH_FILTER,
  LINK_HEALTH_PAGE_SIZE,
  attentionReasons,
  linkHealthQuery,
  setLinkHealth,
  toggleView,
  CHRONIC_WINDOW,
  LINK_HEALTH_LEGEND,
  chronicBadge,
  hourRows,
  linkHealthCell,
  linkHealthFigures,
  tillsReach,
  worstFirst,
} from './link-health-helpers'
import { tillHourCell } from './tills-helpers'

/**
 * The fleet "Link health" page's pure logic (spec 4288, BackOffice 4295): which colour a store-hour is, when a store is
 * chronic, the worst-first order, and "one till or the whole store". The cell rules are the till drill-in's (4292), so
 * the fleet grid and a till's history never disagree about one hour.
 */
const cell = (over: Partial<LinkHealthCell> = {}): LinkHealthCell => ({
  checks: 360,
  failed: 0,
  slow: 0,
  failPct: 0,
  slowPct: 0,
  maxP95Ms: 120,
  unstableSeconds: 0,
  offlineSeconds: 0,
  tillsReporting: 2,
  tillsAffected: 0,
  ...over,
})

const store = (code: string, over: Partial<LinkHealthStore> = {}): LinkHealthStore => ({
  code,
  description: `Store ${code}`,
  noData: false,
  troubledHours: 0,
  offlineHours: 0,
  unstableMinutes: 0,
  offlineMinutes: 0,
  tillsReporting: 2,
  tillsAffected: 0,
  unstableTills: 0,
  silentTills: 0,
  chronic: false,
  needsAttention: false,
  cells: [],
  ...over,
})

const unstable = cell({ unstableSeconds: 600, tillsAffected: 1 })
const offline = cell({ offlineSeconds: 120, unstableSeconds: 1800, tillsAffected: 2 })

describe('a store-hour cell', () => {
  it('is coloured as the till drill-in colours an hour: offline > unstable > blips > online, null = no data', () => {
    expect(linkHealthCell(null).cell).toBe('noData')
    expect(linkHealthCell(cell()).cell).toBe('online')
    expect(linkHealthCell(cell({ failed: 1 })).cell).toBe('blips')
    expect(linkHealthCell(cell({ slow: 3 })).cell).toBe('blips')
    expect(linkHealthCell(unstable).cell).toBe('unstable')
    expect(linkHealthCell(offline).cell).toBe('offline')
    expect(linkHealthCell(offline).swatch).toBe('bg-danger')
    expect(linkHealthCell(unstable).swatch).toBe('bg-attention')
    expect(linkHealthCell(null).swatch).toBe('bg-muted')
  })

  it('agrees with tillHourCell on every figure, so the fleet grid and the drill-in never differ', () => {
    for (const c of [null, cell(), cell({ failed: 1 }), unstable, offline])
      expect(linkHealthCell(c)).toEqual(tillHourCell(c))
  })

  it('gives the tooltip its figures in whole minutes, and none for no data', () => {
    expect(linkHealthFigures(null)).toBeNull()
    expect(linkHealthFigures(cell({ failPct: 6, slowPct: 11, maxP95Ms: 1840, unstableSeconds: 1800, offlineSeconds: 120, tillsAffected: 2 })))
      .toEqual({ failPct: 6, slowPct: 11, p95Ms: 1840, unstableMinutes: 30, offlineMinutes: 2, tillsReporting: 2, tillsAffected: 2 })
  })

  it('the legend is the drill-in’s, every cell in order', () => {
    expect(LINK_HEALTH_LEGEND.map((e) => e.cell)).toEqual(['online', 'blips', 'unstable', 'offline', 'noData'])
  })
})

describe('one till or the whole store', () => {
  it('names nothing when no till was affected, or for no data', () => {
    expect(tillsReach(null)).toBeNull()
    expect(tillsReach(cell())).toBeNull()
  })

  it('reads "N of M tills" when some were affected', () => {
    expect(tillsReach(cell({ unstableSeconds: 60, tillsAffected: 1, tillsReporting: 3 }))).toEqual({
      labelKey: 'links.reach.some',
      affected: 1,
      reporting: 3,
    })
  })

  it('reads "all M tills" when every reporting till was, and a lone till as 1 of 1', () => {
    expect(tillsReach(cell({ unstableSeconds: 60, tillsAffected: 3, tillsReporting: 3 }))?.labelKey).toBe('links.reach.whole')
    expect(tillsReach(cell({ unstableSeconds: 60, tillsAffected: 1, tillsReporting: 1 }))?.labelKey).toBe('links.reach.some')
  })
})

describe('the chronic badge', () => {
  const quiet = cell()
  it('is earned by CHRONIC_MIN troubled hours in the last CHRONIC_WINDOW', () => {
    expect(CHRONIC_WINDOW).toBe(8)
    expect(CHRONIC_MIN).toBe(4)
    const six = [offline, quiet, quiet, unstable, unstable, offline, unstable, quiet, unstable, unstable]
    expect(chronicBadge(six)).toEqual({ troubled: 6, of: 8 })
  })

  it('is not earned by three, nor by trouble older than the window', () => {
    expect(chronicBadge([quiet, quiet, quiet, quiet, quiet, unstable, unstable, unstable])).toBeNull()
    expect(chronicBadge([unstable, unstable, unstable, unstable, quiet, quiet, quiet, quiet, quiet, quiet, quiet, quiet])).toBeNull()
  })

  it('counts blips and no data as untroubled, and reads a short day over the hours it has', () => {
    expect(chronicBadge([cell({ failed: 3 }), null, null, null, null, null, null, null])).toBeNull()
    expect(chronicBadge([unstable, unstable, offline, unstable])).toEqual({ troubled: 4, of: 4 })
  })
})

describe('worst first', () => {
  it('orders by troubled hours, then minutes offline, then healthy, then no data, each by code', () => {
    const rows = [
      store('S9', { noData: true, tillsReporting: 0 }),
      store('S1'),
      store('S4', { troubledHours: 2, offlineMinutes: 10 }),
      store('S3', { troubledHours: 2, offlineMinutes: 60 }),
      store('S5', { troubledHours: 5 }),
      store('S0'),
      store('S2', { noData: true, tillsReporting: 0 }),
    ]
    expect(worstFirst(rows).map((s) => s.code)).toEqual(['S5', 'S3', 'S4', 'S0', 'S1', 'S2', 'S9'])
  })

  it('never ranks a no-data store above a healthy one', () => {
    expect(worstFirst([store('A', { noData: true }), store('B')]).map((s) => s.code)).toEqual(['B', 'A'])
  })
})

describe('the hour grid', () => {
  const hoursFrom = (first: string, count: number) =>
    Array.from({ length: count }, (_, i) => {
      const d = new Date(new Date(first).getTime() + i * 3_600_000)
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00:00`
    })

  it('today is one row of 24 hours, the hours not yet reached marked future', () => {
    const hours = hoursFrom('2026-10-10T00:00:00', 13)
    const rows = hourRows(hours, hours.map((_, i) => (i === 12 ? unstable : null)))
    expect(rows).toHaveLength(1)
    expect(rows[0].day).toBe('2026-10-10')
    expect(rows[0].slots).toHaveLength(24)
    expect(rows[0].slots[12]).toEqual({ hour: '2026-10-10T12:00:00', cell: unstable, future: false })
    expect(rows[0].slots[11].future).toBe(false)
    expect(rows[0].slots[13]).toEqual({ hour: '2026-10-10T13:00:00', cell: null, future: true })
    expect(rows[0].slots[23].hour).toBe('2026-10-10T23:00:00')
  })

  it('7 days is one row per day, oldest first, each of 24 hours', () => {
    const hours = hoursFrom('2026-10-04T00:00:00', 6 * 24 + 13)
    const rows = hourRows(hours, hours.map(() => null))
    expect(rows.map((r) => r.day)).toEqual(['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10'])
    expect(rows.every((r) => r.slots.length === 24)).toBe(true)
    expect(rows[5].slots.some((s) => s.future)).toBe(false)
    expect(rows[6].slots.filter((s) => s.future)).toHaveLength(11)
  })
})

describe('the strings', () => {
  const at = (bundle: unknown, key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle)
  const keys = (bundle: unknown, prefix: string): string[] =>
    Object.entries((bundle ?? {}) as Record<string, unknown>).flatMap(([k, v]) =>
      typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
    )
  const slots = (text: unknown) => [...String(text).matchAll(/<(\w+)>|\{\{(\w+)\}\}/g)].map((m) => m[1] ?? m[2]).sort()

  it('every links.* key is in both en and ar, with the same slots', () => {
    const enKeys = keys(at(en, 'links'), 'links.').sort()
    expect(enKeys.length).toBeGreaterThan(10)
    expect(keys(at(ar, 'links'), 'links.').sort()).toEqual(enKeys)
    for (const key of enKeys) expect(slots(at(ar, key)), key).toEqual(slots(at(en, key)))
    expect(at(en, 'nav.links')).toBeTruthy()
    expect(at(ar, 'nav.links')).toBeTruthy()
  })

  it('names every reach and chronic key the helpers hand out', () => {
    for (const key of [
      'links.reach.some',
      'links.reach.whole',
      'links.chronic',
      'links.reasons.unstableNow',
      'links.reasons.chronic',
      'links.reasons.silent',
      ...LINK_HEALTH_VIEWS.map((v) => `links.views.${v}`),
    ])
      expect(at(en, key), key).toBeTruthy()
  })
})

describe('the Link health filter (BackOffice 4295, owner follow-up)', () => {
  it('starts on today, the WAN line, every store, page 1', () => {
    expect(DEFAULT_LINK_HEALTH_FILTER).toEqual({ period: 'today', link: 'WAN', q: '', show: 'all', page: 1 })
  })

  it('sends the search, the view and the page to the door: the server pages and filters, never the browser', () => {
    expect(linkHealthQuery({ ...DEFAULT_LINK_HEALTH_FILTER, q: '  p077 ', show: 'attention', page: 3 })).toEqual({
      period: 'today',
      link: 'WAN',
      q: 'p077',
      show: 'attention',
      page: 3,
      pageSize: LINK_HEALTH_PAGE_SIZE,
    })
    expect(linkHealthQuery({ ...DEFAULT_LINK_HEALTH_FILTER, page: 0 }).page).toBe(1)
  })

  it('a new search, link, period or view goes back to page 1; turning the page keeps the search', () => {
    const on3 = { ...DEFAULT_LINK_HEALTH_FILTER, q: 'P07', show: 'attention' as const, page: 3 }
    expect(setLinkHealth(on3, { q: 'P077' })).toMatchObject({ q: 'P077', show: 'attention', page: 1 })
    expect(setLinkHealth(on3, { link: 'STORE' })).toMatchObject({ link: 'STORE', page: 1 })
    expect(setLinkHealth(on3, { period: '7d' })).toMatchObject({ period: '7d', page: 1 })
    expect(setLinkHealth(on3, { page: 4 })).toEqual({ ...on3, page: 4 })
  })

  it('a summary tile picks its view; picking the chosen one again goes back to every store', () => {
    const f = toggleView({ ...DEFAULT_LINK_HEALTH_FILTER, page: 2, q: 'P0' }, 'attention')
    expect(f).toMatchObject({ show: 'attention', page: 1, q: 'P0' })
    expect(toggleView(f, 'attention').show).toBe('all')
    expect(toggleView(f, 'noData').show).toBe('noData')
    expect(toggleView(f, 'all').show).toBe('all')
    expect(LINK_HEALTH_VIEWS).toEqual(['all', 'attention', 'troubled', 'healthy', 'noData'])
  })
})

describe('why a store needs attention', () => {
  it('names each of the door’s reasons: a till unstable now, chronic, a till gone silent', () => {
    expect(attentionReasons(store('S1'))).toEqual([])
    expect(attentionReasons(store('S1', { unstableTills: 2, chronic: true, silentTills: 1, needsAttention: true }))).toEqual([
      { key: 'links.reasons.unstableNow', n: 2 },
      { key: 'links.reasons.chronic', n: 0 },
      { key: 'links.reasons.silent', n: 1 },
    ])
  })
})
