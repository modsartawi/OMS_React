import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FLEET_QUERY,
  FLEET_PAGE_SIZE,
  fleetDoorParams,
  fleetQueryFromParams,
  fleetQueryToParams,
  isFilteredFleet,
  toggleFleetLabel,
  toggleFleetState,
  withFleetFilter,
  withFleetPage,
  type FleetQuery,
} from './fleet-query'

const query = (over: Partial<FleetQuery> = {}): FleetQuery => ({ ...DEFAULT_FLEET_QUERY, ...over })
const from = (s: string) => fleetQueryFromParams(new URLSearchParams(s))
const to = (q: FleetQuery) => fleetQueryToParams(q).toString()

describe('fleetQueryFromParams / fleetQueryToParams', () => {
  it('reads an empty URL as the default: worst first, page 1, no filter', () => {
    expect(from('')).toEqual({ labels: [], states: [], rail: null, q: '', sort: 'worst', page: 1 })
    expect(to(DEFAULT_FLEET_QUERY)).toBe('')
  })

  it('round-trips repeated label and state, rail, q, sort and page through the URL', () => {
    const url = 'label=stuck&label=behind&rail=legacy&state=L10&state=N1&q=riyadh&sort=oldestBehind&page=3'
    const q = from(url)
    expect(q).toEqual({ labels: ['stuck', 'behind'], states: ['L10', 'N1'], rail: 'legacy', q: 'riyadh', sort: 'oldestBehind', page: 3 })
    expect(to(q)).toBe(url)
  })

  it('writes the defaults as absent', () => {
    expect(to(query({ sort: 'worst', page: 1 }))).toBe('')
    expect(to(query({ sort: 'code' }))).toBe('sort=code')
  })

  it('canonicalises the lists: worst first, states in the contract order, each once', () => {
    const q = from('label=behind&label=stuck&label=behind&state=N1&state=L2a&state=N1')
    expect(q.labels).toEqual(['stuck', 'behind'])
    expect(q.states).toEqual(['L2a', 'N1'])
    expect(to(q)).toBe('label=stuck&label=behind&state=L2a&state=N1')
  })

  it('drops what the door would refuse rather than provoking BAD_FILTER', () => {
    expect(from('label=parked&state=Z9&rail=both&sort=random')).toEqual(DEFAULT_FLEET_QUERY)
  })

  it('reads a malformed or out-of-range page as page 1', () => {
    for (const p of ['0', '-2', '1.5', 'x', '']) expect(from(`page=${p}`).page).toBe(1)
  })

  it('trims the search and drops a blank one', () => {
    expect(from('q=%20P01%20').q).toBe('P01')
    expect(to(query({ q: '   ' }))).toBe('')
  })
})

describe('isFilteredFleet', () => {
  it('counts a label, a state, a rail or a search as a filter, never the sort or the page', () => {
    expect(isFilteredFleet(query({ sort: 'code', page: 3 }))).toBe(false)
    for (const over of [{ labels: ['stuck'] }, { states: ['N1'] }, { rail: 'new' }, { q: 'P0' }] as Partial<FleetQuery>[])
      expect(isFilteredFleet(query(over))).toBe(true)
  })
})

describe('fleetDoorParams', () => {
  it('asks the door for the query in the contract spelling, 50 a page', () => {
    expect(FLEET_PAGE_SIZE).toBe(50)
    expect(fleetDoorParams(query({ labels: ['stuck'], states: ['N1', 'N4'], rail: 'new', q: 'P0', sort: 'mostStuck', page: 2 }))).toEqual({
      label: ['stuck'],
      state: ['N1', 'N4'],
      rail: 'new',
      q: 'P0',
      sort: 'mostStuck',
      page: 2,
      pageSize: 50,
    })
  })

  it('sends no rail and no search when none is chosen (the query builder drops them)', () => {
    expect(fleetDoorParams(DEFAULT_FLEET_QUERY)).toEqual({ label: [], state: [], rail: null, q: '', sort: 'worst', page: 1, pageSize: 50 })
  })
})

describe('a filter change resets to page 1', () => {
  it('withFleetFilter: rail, search and sort go back to page 1', () => {
    expect(withFleetFilter(query({ page: 4 }), { rail: 'legacy' })).toEqual(query({ rail: 'legacy' }))
    expect(withFleetFilter(query({ page: 4 }), { q: 'P01' }).page).toBe(1)
    expect(withFleetFilter(query({ page: 4 }), { sort: 'code' }).page).toBe(1)
  })

  it('withFleetFilter: no change keeps the page, so a refetch never jumps', () => {
    const q = query({ rail: 'new', page: 4 })
    expect(withFleetFilter(q, { rail: 'new' })).toBe(q)
  })

  it('toggleFleetLabel: in and out, worst first, back on page 1', () => {
    const a = toggleFleetLabel(query({ page: 3 }), 'behind')
    expect(a).toEqual(query({ labels: ['behind'] }))
    expect(toggleFleetLabel(a, 'stuck').labels).toEqual(['stuck', 'behind'])
    expect(toggleFleetLabel(toggleFleetLabel(a, 'stuck'), 'behind').labels).toEqual(['stuck'])
    expect(toggleFleetLabel(query(), 'parked')).toEqual(query())
  })

  it('toggleFleetState: in and out, contract order, back on page 1', () => {
    const a = toggleFleetState(query({ page: 2 }), 'N1')
    expect(toggleFleetState(a, 'L9')).toEqual(query({ states: ['L9', 'N1'] }))
    expect(toggleFleetState(query(), 'Z9')).toEqual(query())
  })

  it('withFleetPage moves the page only, never below 1', () => {
    expect(withFleetPage(query({ labels: ['stuck'] }), 3)).toEqual(query({ labels: ['stuck'], page: 3 }))
    expect(withFleetPage(query(), 0).page).toBe(1)
  })
})
