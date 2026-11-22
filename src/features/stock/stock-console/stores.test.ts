import { describe, expect, it } from 'vitest'
import {
  searchStores,
  sortStores,
  storesFromParams,
  storesToParams,
  tileCounts,
  tileFilter,
  visibleStores,
  type StoreSort,
} from './stores'
import { flag, storeRow as row } from './test-rows'

describe('the stores tiles', () => {
  const rows = [
    row({ plant: 'P001', stage: 'Shadow' }),
    row({ plant: 'P002', stage: 'Seeded', flags: [flag('OldHold')] }),
    row({ plant: 'P003', stage: 'Blocking', flags: [flag('SapQuiet'), flag('BelowZero', 'Problem', 600, 500)] }),
    row({ plant: 'P004', stage: 'Seeding', flags: [flag('BelowZero', 'Watch', 4, 0), flag('OldHold')] }),
  ]

  it('each tile counts its stores: all, counted (Seeded or Blocking), old hold, SAP quiet, over the below-zero limit', () => {
    expect(tileCounts(rows)).toEqual({ all: 4, counted: 2, oldHold: 2, sapQuiet: 1, belowZero: 1 })
  })

  it('each tile filters the list to the stores it counts, in the list’s order', () => {
    const plants = (tile: Parameters<typeof tileFilter>[1]) => tileFilter(rows, tile).map((r) => r.plant)
    expect(plants('all')).toEqual(['P001', 'P002', 'P003', 'P004'])
    expect(plants('counted')).toEqual(['P002', 'P003'])
    expect(plants('oldHold')).toEqual(['P002', 'P004'])
    expect(plants('sapQuiet')).toEqual(['P003'])
    expect(plants('belowZero')).toEqual(['P003'])
  })

  it('a below-zero flag at Watch is not the Below zero tile’s: that tile is the stores over the limit', () => {
    expect(tileFilter([row({ flags: [flag('BelowZero', 'Watch', 12, 0)] })], 'belowZero')).toEqual([])
  })

  it('a Blocking store with a few items below zero is a Problem, but not over the limit, so not the tile’s (spec story 7)', () => {
    const blocking = row({ stage: 'Blocking', flags: [flag('BelowZero', 'Problem', 3, 0)] })
    expect(tileFilter([blocking], 'belowZero')).toEqual([])
  })

  it('the tile follows the limit the server sends, not a fixed 500', () => {
    const over = row({ plant: 'P010', flags: [flag('BelowZero', 'Problem', 301, 300)] })
    expect(tileFilter([over], 'belowZero').map((r) => r.plant)).toEqual(['P010'])
  })
})

describe('the stores search', () => {
  const rows = [
    row({ plant: 'P077', city: 'Riyadh' }),
    row({ plant: 'J101', city: 'Jeddah' }),
    row({ plant: 'R207', city: 'الرياض' }),
  ]
  const plants = (q: string) => searchStores(rows, q).map((r) => r.plant)

  it('matches a part of the store code, whatever its case', () => {
    expect(plants('p07')).toEqual(['P077'])
  })

  it('matches a part of the city, in either script', () => {
    expect(plants('JED')).toEqual(['J101'])
    expect(plants('رياض')).toEqual(['R207'])
  })

  it('is trimmed, and an empty search keeps every store', () => {
    expect(plants('  j10  ')).toEqual(['J101'])
    expect(plants('   ')).toEqual(['P077', 'J101', 'R207'])
  })
})

describe('the stores sort', () => {
  const rows = [
    row({ plant: 'P003', city: 'Dammam', tillStock: 500, reserved: 12, reservedState: 'Computed', status: 'Watch', stage: 'Blocking', lastUpdate: '2026-11-22T09:00:00' }),
    row({ plant: 'P001', city: 'Riyadh', tillStock: -20, reserved: null, status: 'Problem', stage: 'Shadow', lastUpdate: null }),
    row({ plant: 'P002', city: 'Abha', tillStock: 1200, reserved: 0, reservedState: 'Stale', status: 'Ok', stage: 'Seeded', lastUpdate: '2026-11-22T10:00:00' }),
  ]
  const plants = (by: StoreSort, desc = false) => sortStores(rows, by, desc).map((r) => r.plant)

  it('sorts by the store code by default order, and back when descending', () => {
    expect(plants('plant')).toEqual(['P001', 'P002', 'P003'])
    expect(plants('plant', true)).toEqual(['P003', 'P002', 'P001'])
  })

  it('sorts by a figure as a number, not as text', () => {
    expect(plants('tillStock')).toEqual(['P001', 'P003', 'P002'])
    expect(plants('tillStock', true)).toEqual(['P002', 'P003', 'P001'])
  })

  it('sorts by the city', () => {
    expect(plants('city')).toEqual(['P002', 'P003', 'P001'])
  })

  it('🚩 a reserved never computed is last both ways: it is not a zero', () => {
    expect(plants('reserved')).toEqual(['P002', 'P003', 'P001'])
    expect(plants('reserved', true)).toEqual(['P003', 'P002', 'P001'])
  })

  it('a store with no last update is last both ways', () => {
    expect(plants('lastUpdate')).toEqual(['P003', 'P002', 'P001'])
    expect(plants('lastUpdate', true)).toEqual(['P002', 'P003', 'P001'])
  })

  it('sorts by trouble: Problem first when descending', () => {
    expect(plants('status', true)).toEqual(['P001', 'P003', 'P002'])
  })

  it('sorts by stage in the stages’ own order, not alphabetically', () => {
    expect(plants('stage')).toEqual(['P001', 'P002', 'P003'])
  })

  it('breaks a tie by the store code, and leaves the list it was given unchanged', () => {
    const tied = [row({ plant: 'B', held: 5 }), row({ plant: 'A', held: 5 })]
    expect(sortStores(tied, 'held', true).map((r) => r.plant)).toEqual(['A', 'B'])
    expect(tied.map((r) => r.plant)).toEqual(['B', 'A'])
  })
})

describe('the stores the grid shows', () => {
  it('are the tile’s stores, searched, then sorted', () => {
    const rows = [
      row({ plant: 'P003', city: 'Riyadh', stage: 'Seeded', held: 1 }),
      row({ plant: 'P001', city: 'Riyadh', stage: 'Blocking', held: 9 }),
      row({ plant: 'P002', city: 'Jeddah', stage: 'Seeded', held: 50 }),
      row({ plant: 'P004', city: 'Riyadh', stage: 'Shadow', held: 99 }),
    ]
    const shown = visibleStores(rows, { tile: 'counted', q: 'riy', sortBy: 'held', desc: true })
    expect(shown.map((r) => r.plant)).toEqual(['P001', 'P003'])
  })
})

describe('the stores list in the address', () => {
  const read = (qs: string) => storesFromParams(new URLSearchParams(qs))

  it('opens on every store, no search, by store code ascending, with nothing in the address', () => {
    expect(read('')).toEqual({ tile: 'all', q: '', sortBy: 'plant', desc: false })
    expect(storesToParams(read('')).toString()).toBe('')
  })

  it('reads back what it wrote', () => {
    const q = { tile: 'oldHold', q: 'riyadh', sortBy: 'held', desc: true } as const
    expect(storesToParams(q).toString()).toBe('tile=oldHold&q=riyadh&sortBy=held&desc=1')
    expect(read('tile=oldHold&q=riyadh&sortBy=held&desc=1')).toEqual(q)
  })

  it('an unknown tile or sort in a pasted link falls back to the default, and the search is trimmed', () => {
    expect(read('tile=nope&sortBy=colour&q=%20p07%20&desc=yes')).toEqual({ tile: 'all', q: 'p07', sortBy: 'plant', desc: false })
  })
})
