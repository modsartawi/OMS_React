/**
 * Oms 922 — a case's route on the map (ticket Proof: "The route draws legs in time order, a travel leg in the warning
 * colour, and delivery as a point without a leg"). `caseRoute` turns the case into what the map panel draws: one point
 * per store visited, the server's legs between counter dispenses as lines in time order, each labelled with its number,
 * km and time. The words are the page's (`t()`), stood in here.
 */
import { describe, expect, it } from 'vitest'
import type { PatternCaseDetail, PatternDispense, PatternLeg } from '@/core/models/insurance-patterns'
import { caseRoute, LEG_TONE, legsBesideMap, routeLegs, type RouteWords } from './route'

const NEVER = '0001-01-01T00:00:00'

const STORES = [
  { storeCode: '1001', storeName: 'Olaya', lat: 24.6943, lon: 46.6853 },
  { storeCode: '2040', storeName: 'Buraydah Central', lat: 26.326, lon: 43.975 },
  { storeCode: '3050', storeName: 'Dammam Corniche', lat: 26.434, lon: 50.103 },
  { storeCode: '5060', storeName: 'Hail', lat: 27.5114, lon: 41.7208 },
  { storeCode: '4090', storeName: 'Qurtubah (new)', lat: null, lon: null },
]
const at = (code: string) => {
  const s = STORES.find((x) => x.storeCode === code)!
  return { lon: s.lon!, lat: s.lat! }
}

const dispense = (eventId: number, storeCode: string, when: string, counter = true): PatternDispense => ({
  eventId,
  storeCode,
  storeName: STORES.find((s) => s.storeCode === storeCode)!.storeName,
  at: when,
  itemNumber: '100200',
  itemDescription: 'Insulin glargine',
  sfdaCode: '6281100',
  quantity: 1,
  daysSupply: 30,
  payer: 'BUPA',
  channel: counter ? 'Counter' : 'Delivery',
  counter,
  pharmacist: 'phx',
})

// Olaya → Buraydah (too fast: travel) → [a delivery from Dammam] → Hail → Olaya → the store with no coordinates.
const DISPENSES = [
  dispense(7001, '1001', '2026-11-10T09:15:00'),
  dispense(7002, '2040', '2026-11-10T10:55:00'),
  dispense(7003, '3050', '2026-11-11T12:00:00', false),
  dispense(7004, '5060', '2026-11-11T15:30:00'),
  dispense(7005, '1001', '2026-11-12T18:40:00'),
  dispense(7006, '4090', '2026-11-12T20:00:00'),
]
const LEG_1: PatternLeg = { fromEventId: 7001, toEventId: 7002, km: 312.4, minutes: 100, kmPerHour: 187.4, travel: true }
const LEG_2: PatternLeg = { fromEventId: 7002, toEventId: 7004, km: 214.9, minutes: 1715, kmPerHour: 7.5, travel: false }
const LEG_3: PatternLeg = { fromEventId: 7004, toEventId: 7005, km: 637.2, minutes: 1630, kmPerHour: 23.5, travel: false }
const LEG_4: PatternLeg = { fromEventId: 7005, toEventId: 7006, km: null, minutes: 80, kmPerHour: null, travel: false }

const detail = (over: Partial<PatternCaseDetail> = {}): PatternCaseDetail => ({
  caseId: '01JD3K7Q2W',
  caseNumber: 'PC-000123',
  stores: STORES,
  dispenseCount: DISPENSES.length,
  openedAt: '2026-11-10T09:15:00',
  lastDispenseAt: '2026-11-12T20:00:00',
  closedAt: NEVER,
  spanMinutes: 3525,
  longestLegKm: 637.2,
  shortestGapMinutes: 80,
  signals: ['travel', 'hopping'],
  score: 4,
  severity: 'action',
  status: 'open',
  totalValue: 1840.5,
  dispenses: DISPENSES,
  // The server's list, out of time order: the route orders it.
  legs: [LEG_3, LEG_1, LEG_4, LEG_2],
  signalWords: [],
  marks: [],
  previousClearance: null,
  previousCases: [],
  ...over,
})

const WORDS: RouteWords = {
  leg: (n, km, minutes) => [String(n), km === null ? '' : `${km} km`, `${minutes} min`].filter(Boolean).join(' · '),
  card: (store, counts) => ({
    title: store.storeName,
    subtitle: store.storeCode,
    figures: [
      { label: 'dispenses', value: String(counts.dispenses) },
      { label: 'deliveries', value: String(counts.deliveries) },
    ],
  }),
}

describe('the stores: one point per store visited', () => {
  it('each store with coordinates once, in the order first visited, the delivery’s store among them', () => {
    expect(caseRoute(detail(), WORDS).points.map((p) => [p.id, p.lon, p.lat])).toEqual([
      ['1001', 46.6853, 24.6943],
      ['2040', 43.975, 26.326],
      ['3050', 50.103, 26.434],
      ['5060', 41.7208, 27.5114],
    ])
  })

  it('sized by its dispenses: two at Olaya draw larger than one elsewhere', () => {
    const size = Object.fromEntries(caseRoute(detail(), WORDS).points.map((p) => [p.id, p.size]))
    expect(size['1001']).toBeGreaterThan(size['2040']!)
    expect(size['2040']).toBe(size['3050'])
  })

  it('its card names the store and counts its dispenses and deliveries', () => {
    const dammam = caseRoute(detail(), WORDS).points.find((p) => p.id === '3050')
    expect(dammam?.card).toEqual({
      title: 'Dammam Corniche',
      subtitle: '3050',
      figures: [
        { label: 'dispenses', value: '1' },
        { label: 'deliveries', value: '1' },
      ],
    })
  })
})

describe('the legs: drawn in time order, labelled with their number, km and time', () => {
  it('in time order, whatever order the server listed them, each from its first store to its second', () => {
    const lines = caseRoute(detail(), WORDS).lines
    expect(lines.map((l) => [l.from, l.to])).toEqual([
      [at('1001'), at('2040')],
      [at('2040'), at('5060')],
      [at('5060'), at('1001')],
    ])
  })

  it('a leg that fired the travel signal is drawn in the warning colour; the others plain', () => {
    expect(caseRoute(detail(), WORDS).lines.map((l) => l.tone)).toEqual([LEG_TONE.travel, LEG_TONE.plain, LEG_TONE.plain])
    // Drawn above the plain legs: Hail, Buraydah and Riyadh lie nearly on one line, and a later plain leg must not hide it.
    expect(caseRoute(detail(), WORDS).lines.map((l) => !!l.strong)).toEqual([true, false, false])
    expect(LEG_TONE).toEqual({ travel: '--map-worse', plain: '--map-ring' })
  })

  it('each labelled with its number in time order, its km and its time', () => {
    expect(caseRoute(detail(), WORDS).lines.map((l) => l.label)).toEqual(['1 · 312.4 km · 100 min', '2 · 214.9 km · 1715 min', '3 · 637.2 km · 1630 min'])
  })
})

describe('a delivery dispense is a point without a leg', () => {
  it('no line starts or ends at the delivery’s store', () => {
    const dammam = at('3050')
    const lines = caseRoute(detail(), WORDS).lines
    expect(lines.filter((l) => [l.from, l.to].some((end) => end.lon === dammam.lon && end.lat === dammam.lat))).toEqual([])
  })

  it('even when the server lists a leg into or out of it', () => {
    const intoDelivery: PatternLeg = { fromEventId: 7002, toEventId: 7003, km: 600, minutes: 60, kmPerHour: 600, travel: true }
    const outOfDelivery: PatternLeg = { fromEventId: 7003, toEventId: 7004, km: 800, minutes: 210, kmPerHour: 228, travel: true }
    const route = caseRoute(detail({ legs: [LEG_1, intoDelivery, outOfDelivery, LEG_2, LEG_3] }), WORDS)
    expect(route.lines).toHaveLength(3)
    expect(route.points.map((p) => p.id)).toContain('3050')
  })
})

describe('a store with no coordinates', () => {
  it('is not drawn, its legs are skipped, and it is listed as not on the map', () => {
    const route = caseRoute(detail(), WORDS)
    expect(route.points.map((p) => p.id)).not.toContain('4090')
    expect(route.lines.map((l) => l.label)).not.toContain('4 · 80 min')
    expect(route.unplaced).toEqual([{ storeCode: '4090', storeName: 'Qurtubah (new)' }])
  })
})

describe('the same two stores travelled both ways', () => {
  it('draw one line, its words a line per leg in time order, in the warning colour when either fired', () => {
    const back = dispense(7010, '1001', '2026-11-10T13:00:00')
    const there = dispense(7011, '2040', '2026-11-10T09:00:00')
    const legs: PatternLeg[] = [
      { fromEventId: 7010 + 1, toEventId: 7010, km: 312.4, minutes: 240, kmPerHour: 78.1, travel: false },
      { fromEventId: 7010, toEventId: 7012, km: 312.4, minutes: 95, kmPerHour: 197.3, travel: true },
    ]
    const route = caseRoute(
      detail({ dispenses: [there, back, dispense(7012, '2040', '2026-11-10T14:35:00')], legs }),
      WORDS,
    )
    expect(route.lines).toHaveLength(1)
    expect(route.lines[0]).toMatchObject({ from: at('2040'), to: at('1001'), tone: LEG_TONE.travel, label: '1 · 312.4 km · 240 min\n2 · 312.4 km · 95 min' })
  })
})

describe('a case at one store', () => {
  it('is one point and no line', () => {
    const route = caseRoute(detail({ dispenses: [dispense(7001, '1001', '2026-11-10T09:15:00'), dispense(7002, '1001', '2026-11-11T09:15:00')], legs: [] }), WORDS)
    expect(route.points.map((p) => p.id)).toEqual(['1001'])
    expect(route.lines).toEqual([])
  })
})

describe('the legs as a table (when the map cannot draw)', () => {
  it('lists every leg the server sent, in time order, numbered as on the map, with its two dispenses', () => {
    const rows = routeLegs(detail())
    expect(rows.map((r) => [r.n, r.leg.fromEventId, r.from?.storeCode, r.to?.storeCode, r.drawn])).toEqual([
      [1, 7001, '1001', '2040', true],
      [2, 7002, '2040', '5060', true],
      [3, 7004, '5060', '1001', true],
      [4, 7005, '1001', '4090', false],
    ])
  })
})

describe('the legs listed beside the route (review 9: no leg appears nowhere)', () => {
  it('with no map to read them on, every leg, numbered in time order', () => {
    expect(legsBesideMap(routeLegs(detail()), false).map((r) => r.n)).toEqual([1, 2, 3, 4])
  })

  it('beside a map, the legs it cannot draw: the leg to the store without coordinates, keeping its number', () => {
    expect(legsBesideMap(routeLegs(detail()), true).map((r) => [r.n, r.from?.storeCode, r.to?.storeCode])).toEqual([[4, '1001', '4090']])
  })

  it('beside a map that draws every leg, none', () => {
    expect(legsBesideMap(routeLegs(detail({ legs: [LEG_1, LEG_2, LEG_3] })), true)).toEqual([])
  })
})
