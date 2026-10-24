/**
 * Ticket 545 — the Open tab's filters as the URL holds them and as the door is asked
 * (`GET PrescriptionSessionWeb/Sessions`, and the saved "owed" view `…/Sessions/Owed`). Pure.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OPEN_FILTER,
  OPEN_STATES,
  openFilterFromParams,
  openFilterToParams,
  openRequest,
  withFlag,
  withView,
  type OpenFilter,
} from './open-filter'

const url = (qs: string) => openFilterFromParams(new URLSearchParams(qs))
const full: OpenFilter = {
  view: 'all',
  store: 'P019',
  state: 'PICKING',
  owner: 'DONOR_STORE',
  source: 'WSFT',
  minAge: '3',
  maxAge: '30',
  flag: 'STALLED',
}

describe('filter ↔ URL', () => {
  it('an empty address is every open session, no filter', () => {
    expect(url('')).toEqual(DEFAULT_OPEN_FILTER)
    expect(openFilterToParams(DEFAULT_OPEN_FILTER).toString()).toBe('')
  })

  it('every filter round-trips through the address', () => {
    const qs = openFilterToParams(full).toString()
    expect(qs).toBe('store=P019&state=PICKING&owner=DONOR_STORE&source=WSFT&minAge=3&maxAge=30&flag=STALLED')
    expect(url(qs)).toEqual(full)
  })

  it('empty values drop from the address; the store is trimmed', () => {
    expect(openFilterToParams({ ...DEFAULT_OPEN_FILTER, store: '  P002 ', minAge: '', flag: '' }).toString()).toBe('store=P002')
  })

  it('a code the lists do not hold, or an age that is not a whole day count, reads as no filter', () => {
    expect(url('state=INVOICED&owner=BOSS&source=X&flag=LATE&minAge=-1&maxAge=2.5')).toEqual(DEFAULT_OPEN_FILTER)
  })

  it('INVOICED is not an open state the door accepts (HqOpenStates; it closes in the same act)', () => {
    expect(OPEN_STATES).not.toContain('INVOICED')
    expect(url('state=INVOICED').state).toBe('')
  })

  it('offers exactly the open states the Sessions door accepts (HqOpenStates), in lifecycle order', () => {
    expect(OPEN_STATES).toEqual([
      'DRAFT',
      'VALIDATING',
      'AWAITING_APPROVAL',
      'APPROVED',
      'AWAITING_ORDER',
      'PICKING',
      'AWAITING_DELIVERY',
      'DISPENSED',
    ])
  })

  it('the Owed view keeps only its store in the address', () => {
    const qs = openFilterToParams({ ...full, view: 'owed' }).toString()
    expect(qs).toBe('view=owed&store=P019')
    expect(url(qs)).toEqual({ ...DEFAULT_OPEN_FILTER, view: 'owed', store: 'P019' })
    expect(url('view=owed&state=PICKING&flag=STALLED')).toEqual({ ...DEFAULT_OPEN_FILTER, view: 'owed' })
  })
})

describe('filter → query', () => {
  it('asks Sessions with every filter named as the door binds it', () => {
    expect(openRequest(full)).toEqual({
      path: 'PrescriptionSessionWeb/Sessions',
      params: {
        store: 'P019',
        state: 'PICKING',
        owner: 'DONOR_STORE',
        source: 'WSFT',
        minAgeDays: 3,
        maxAgeDays: 30,
        flag: 'STALLED',
      },
    })
  })

  it('no filter asks with no parameter', () => {
    expect(openRequest(DEFAULT_OPEN_FILTER)).toEqual({ path: 'PrescriptionSessionWeb/Sessions', params: {} })
  })

  it('age 0 is a filter, not an empty value', () => {
    expect(openRequest({ ...DEFAULT_OPEN_FILTER, minAge: '0' }).params).toEqual({ minAgeDays: 0 })
  })

  it('the Owed view sends only the store, to Sessions/Owed', () => {
    expect(openRequest({ ...full, view: 'owed' })).toEqual({ path: 'PrescriptionSessionWeb/Sessions/Owed', params: { store: 'P019' } })
    expect(openRequest({ ...DEFAULT_OPEN_FILTER, view: 'owed' })).toEqual({ path: 'PrescriptionSessionWeb/Sessions/Owed', params: {} })
  })
})

describe('switching the view', () => {
  it('All open → Owed keeps the store and drops every filter the Owed door does not take', () => {
    expect(withView(full, 'owed')).toEqual({ ...DEFAULT_OPEN_FILTER, view: 'owed', store: 'P019' })
  })

  it('Owed → All open is the store alone: nothing hidden comes back', () => {
    const owed = withView(full, 'owed')
    expect(withView(owed, 'all')).toEqual({ ...DEFAULT_OPEN_FILTER, store: 'P019' })
  })

  it('the view already shown changes nothing', () => {
    expect(withView(full, 'all')).toBe(full)
  })
})

describe('flag chips', () => {
  it('a chip sets flag; pressing it again clears it; another chip replaces it', () => {
    const stalled = withFlag(DEFAULT_OPEN_FILTER, 'STALLED')
    expect(stalled.flag).toBe('STALLED')
    expect(openRequest(stalled).params).toEqual({ flag: 'STALLED' })
    expect(withFlag(stalled, 'STALLED').flag).toBe('')
    expect(withFlag(stalled, 'OWED').flag).toBe('OWED')
  })

  it('a chip keeps the other filters', () => {
    expect(withFlag({ ...full, flag: '' }, 'ABOUT_TO_LAPSE')).toEqual({ ...full, flag: 'ABOUT_TO_LAPSE' })
  })

  it('in the Owed view a chip changes nothing (that door takes no flag)', () => {
    const owed = { ...DEFAULT_OPEN_FILTER, view: 'owed' as const }
    expect(withFlag(owed, 'STALLED')).toBe(owed)
  })
})
