/**
 * Ticket 964 (BackOffice spec 4354 §19, §12; SIMT decisions 4–5): the map tab draws every plan's stores at once, coloured
 * by mode, the pick-up leg dashed, each leg labelled with its distance to the customer; a switch narrows it to one plan;
 * a dotted line joins one plan's stores. Under it two tables: each store with its mode, plan, road and straight-line
 * distance; and the distances between the stores. Without the customer's point (no grant) nothing that would show it is
 * drawn — no pin, no rings, no legs — and every km stays as the server sent it. Fed the replay reply in the server's
 * shape; the run record carries no store's point, so the stores are placed from the store list (`SdDocument/StoreDetails`,
 * its `latitude` and `longitude` as text). Straight-line figures are the ground distances worked out by hand.
 */
import { describe, expect, it } from 'vitest'
import type { AdviseReply } from '@/core/models/sourcing-run'
import fixture from './replay-reply.fixture.json'
import { mapPlans, storePlaces, type MapWords } from './map-plans-model'

const REPLAY = fixture as unknown as AdviseReply
const reply = (over: Partial<AdviseReply> = {}): AdviseReply => ({ ...REPLAY, ...over })
const WORDS: MapWords = {
  mode: (m) => `mode:${m}`,
  km: (km) => `${km.toFixed(1)} km`,
  ring: (km) => `ring:${km}`,
  customer: 'the customer',
}
const DETAILS = [
  { storeCode: '1090', latitude: '24.7801', longitude: '46.752' },
  { storeCode: '1055', latitude: '24.7902', longitude: '46.7611' },
  { storeCode: '1061', latitude: '24.765', longitude: '46.7301' },
  { storeCode: '1203', latitude: '24.8302', longitude: '46.7105' },
]
const PLACES = storePlaces(DETAILS)
const all = (r: AdviseReply = reply(), places = PLACES) => mapPlans(r, { scope: 'all', goal: null, words: WORDS, places })
const CUSTOMER = { lon: 46.7386, lat: 24.7741 }

describe('every plan’s stores at once, by mode', () => {
  it('a store per point, at its place, coloured by the mode it ships by first, its card naming each mode and its distance', () => {
    const v = all()
    expect(v.points.map((p) => [p.id, p.lon, p.lat, p.ink])).toEqual([
      ['1090', 46.752, 24.7801, '--map-mode-dawaa-now'],
      ['1055', 46.7611, 24.7902, '--map-mode-slot'],
      ['1061', 46.7301, 24.765, '--map-mode-slot'],
    ])
    expect(v.points[2].card?.figures).toEqual([
      { label: 'mode:SLOT', value: '1.8 km' },
      { label: 'mode:PICK_UP', value: '1.8 km' },
    ])
  })

  it('a leg from each store to the customer per mode, in the mode’s colour, the pick-up leg dashed, labelled with its distance', () => {
    const legs = all().lines.filter((l) => l.id.startsWith('leg:'))
    expect(legs.map((l) => [l.id, l.tone, l.dash ?? 'solid'])).toEqual([
      ['leg:1090:DAWAA_NOW', '--map-mode-dawaa-now', 'solid'],
      ['leg:1055:SLOT', '--map-mode-slot', 'solid'],
      ['leg:1061:SLOT', '--map-mode-slot', 'solid'],
      ['leg:1061:PICK_UP', '--map-mode-pick-up', 'dashed'],
    ])
    expect(legs[0]).toMatchObject({ from: { lon: 46.752, lat: 24.7801 }, to: CUSTOMER })
    expect(legs[0].label).toContain('2.1 km')
    expect(legs[0].label).toContain('1090')
  })

  it('a dotted line joins the stores of one plan (Cheapest ships from 1055 and 1061), labelled with the distance between them', () => {
    const dotted = all().lines.filter((l) => l.dash === 'dotted')
    expect(dotted.map((l) => l.id)).toEqual(['between:1055:1061'])
    expect(dotted[0].label).toBe('4.2 km')
  })

  it('the 5 km and 10 km rings round the customer, and the customer’s pin', () => {
    const v = all()
    expect(v.rings.map((r) => [r.km, r.centre, r.label])).toEqual([
      [5, CUSTOMER, 'ring:5'],
      [10, CUSTOMER, 'ring:10'],
    ])
    expect(v.pin).toEqual({ ...CUSTOMER, ink: '--map-customer', label: 'the customer' })
    expect(v.customer).toEqual(CUSTOMER)
    expect(v.withheld).toBeNull()
  })
})

describe('the two tables', () => {
  it('each store with its mode, its plan and shipment, its distance by road as sent and in a straight line', () => {
    const rows = all().rows
    expect(rows.map((r) => [r.store, r.mode, r.goal, r.shipmentNo, r.km, r.kmKind])).toEqual([
      ['1090', 'DAWAA_NOW', 'BALANCED', 1, 2.1, 'ROAD'],
      ['1055', 'SLOT', 'CHEAPEST', 1, 3.6, 'ROAD'],
      ['1061', 'SLOT', 'CHEAPEST', 2, 1.8, 'ROAD'],
      ['1061', 'PICK_UP', 'PICK_UP', 1, 1.8, 'ROAD'],
    ])
    expect(rows.map((r) => r.straightKm?.toFixed(2))).toEqual(['1.51', '2.89', '1.33', '1.33'])
  })

  it('the distances between the stores shown, each pair once, in a straight line', () => {
    expect(all().between.map((b) => [b.from, b.to, b.km.toFixed(2)])).toEqual([
      ['1090', '1055', '1.45'],
      ['1090', '1061', '2.78'],
      ['1055', '1061', '4.20'],
    ])
  })
})

describe('the switch narrows the map to the selected plan', () => {
  it('Cheapest alone: its two stores, their legs, the dotted line between them and one pair', () => {
    const v = mapPlans(reply(), { scope: 'plan', goal: 'CHEAPEST', words: WORDS, places: PLACES })
    expect(v.points.map((p) => p.id)).toEqual(['1055', '1061'])
    expect(v.rows.map((r) => [r.store, r.goal])).toEqual([
      ['1055', 'CHEAPEST'],
      ['1061', 'CHEAPEST'],
    ])
    expect(v.lines.map((l) => l.id)).toEqual(['between:1055:1061', 'leg:1055:SLOT', 'leg:1061:SLOT'])
    expect(v.between).toHaveLength(1)
  })

  it('a plan no longer in the reply shows nothing of its own', () => {
    const v = mapPlans(reply(), { scope: 'plan', goal: 'FEWEST', words: WORDS, places: PLACES })
    expect(v.points).toEqual([])
    expect(v.rows).toEqual([])
  })
})

describe('nothing drawn when the point is withheld', () => {
  const withheld = reply({ customerPoint: undefined, customerPointWithheld: 'NO_GRANT' })

  it('no pin, no rings and no legs; it says why', () => {
    const v = all(withheld)
    expect(v.customer).toBeNull()
    expect(v.pin).toBeNull()
    expect(v.rings).toEqual([])
    expect(v.lines.filter((l) => l.id.startsWith('leg:'))).toEqual([])
    expect(v.withheld).toBe('NO_GRANT')
  })

  it('every km stays as the server sent it, and no straight line to the customer is worked out', () => {
    const v = all(withheld)
    expect(v.rows.map((r) => r.km)).toEqual([2.1, 3.6, 1.8, 1.8])
    expect(v.rows.every((r) => r.straightKm === null)).toBe(true)
    expect(v.points[0].card?.figures[0].value).toBe('2.1 km')
  })

  it('the stores and the distances between them are still shown: they tell nothing of the customer', () => {
    const v = all(withheld)
    expect(v.points).toHaveLength(3)
    expect(v.between).toHaveLength(3)
    expect(v.lines.map((l) => l.id)).toEqual(['between:1055:1061'])
  })

  it('a reply with no point and no reason (the point was not asked for) says so', () => {
    expect(all(reply({ customerPoint: undefined, customerPointWithheld: undefined })).withheld).toBe('NOT_ASKED')
  })
})

describe('the store list’s points', () => {
  it('reads each store’s latitude and longitude as sent, as text; a blank, zero or unreadable point is no point', () => {
    const places = storePlaces([
      ...DETAILS.slice(0, 1),
      { storeCode: '2001', latitude: '', longitude: '46.7' },
      { storeCode: '2002', latitude: '0', longitude: '0' },
      { storeCode: '2003', latitude: 'n/a', longitude: '46.7' },
    ])
    expect([...places.entries()]).toEqual([['1090', { lat: 24.7801, lon: 46.752 }]])
    expect(storePlaces(undefined).size).toBe(0)
  })
})

describe('a store with no location', () => {
  it('is in the table with its km as sent, listed as not drawn, and has no point, leg or pair', () => {
    const v = all(reply(), storePlaces(DETAILS.filter((d) => d.storeCode !== '1055')))
    expect(v.unplaced).toEqual(['1055'])
    expect(v.points.map((p) => p.id)).toEqual(['1090', '1061'])
    expect(v.rows.find((row) => row.store === '1055')).toMatchObject({ km: 3.6, straightKm: null })
    expect(v.lines.some((l) => l.id.includes('1055'))).toBe(false)
    expect(v.between.map((b) => [b.from, b.to])).toEqual([['1090', '1061']])
  })
})
