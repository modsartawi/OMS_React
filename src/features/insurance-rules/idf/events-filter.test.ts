/**
 * Ticket 626 — the IDF events address and the door's query. One filter (local window, store, payer, master) that
 * 627's swap report shares; the log adds the outcome and the page. Empty fields are dropped by core `buildQuery`.
 */
import { describe, expect, it } from 'vitest'
import { eventsDoorParams, filterDoorParams, readIdfEventsQuery, typedFilter, withFilter, writeIdfEventsQuery } from './events-filter'

const TODAY = '2026-10-27'
const read = (qs: string) => readIdfEventsQuery(new URLSearchParams(qs), TODAY)

describe('events filter builds the query; core buildQuery drops the empty fields', () => {
  it('defaults_theLast7LocalDays_page1_noOtherFilter', () => {
    expect(read('')).toEqual({ from: '2026-10-21', to: '2026-10-27', store: '', payer: '', masterId: '', outcome: '', page: 1, tab: 'events' })
  })

  it('readsEveryField_andIgnoresAnUnknownOutcomeOrABadPage', () => {
    expect(read('from=2026-10-01&to=2026-10-15&store=P019&payer=BUPA&master=M-OPS&outcome=forcedPickTaken&page=3')).toEqual({
      from: '2026-10-01',
      to: '2026-10-15',
      store: 'P019',
      payer: 'BUPA',
      masterId: 'M-OPS',
      outcome: 'forcedPickTaken',
      page: 3,
      tab: 'events',
    })
    expect(read('outcome=nope&page=0')).toMatchObject({ outcome: '', page: 1 })
    expect(read('page=x')).toMatchObject({ page: 1 })
    // the reserved outcomes are not offered until IDF requests exist, so an address cannot select them either
    expect(read('outcome=requestRaised')).toMatchObject({ outcome: '' })
  })

  it('trimsTheTypedStoreAndPayer', () => {
    expect(read('store=%20P019%20&payer=%20BUPA')).toMatchObject({ store: 'P019', payer: 'BUPA' })
  })

  it('writesOnlyWhatDiffersFromTheDefaults_soTheBareAddressStaysBare', () => {
    expect(writeIdfEventsQuery(read(''), TODAY).toString()).toBe('')
    expect(writeIdfEventsQuery({ ...read(''), payer: 'BUPA', masterId: 'M-OPS', outcome: 'reminder', page: 2 }, TODAY).toString()).toBe(
      'payer=BUPA&master=M-OPS&outcome=reminder&page=2',
    )
  })

  it('aTypedStoreOrPayer_appliesOnlyWhenItChanged_soLeavingTheBoxKeepsThePage', () => {
    const q = { ...read('store=P019'), page: 4 }
    expect(typedFilter(q, 'store', ' P019 ')).toBeNull()
    expect(typedFilter(q, 'payer', '  ')).toBeNull()
    expect(typedFilter(q, 'store', 'p020 ')).toEqual({ store: 'p020' })
    expect(typedFilter(q, 'store', '')).toEqual({ store: '' })
  })

  it('changingAFilterGoesBackToPage1', () => {
    const q = { ...read(''), page: 4 }
    expect(withFilter(q, { outcome: 'reminder' })).toMatchObject({ outcome: 'reminder', page: 1 })
    expect(withFilter(q, { store: 'P001' })).toMatchObject({ store: 'P001', page: 1 })
  })

  // Blank fields are handed on as '' and dropped by core `buildQuery` (the api-envelope rule) — never pre-dropped here.
  it('theSharedFilter_namesEveryField_blankOnesEmpty', () => {
    expect(filterDoorParams(read(''))).toEqual({ from: '2026-10-21', to: '2026-10-27', store: '', payer: '', masterId: '' })
    expect(filterDoorParams(read('store=P019&master=M-OPS'))).toEqual({ from: '2026-10-21', to: '2026-10-27', store: 'P019', payer: '', masterId: 'M-OPS' })
  })

  it('theLog_addsTheOutcomeAndThePage', () => {
    expect(eventsDoorParams(read(''))).toEqual({ from: '2026-10-21', to: '2026-10-27', store: '', payer: '', masterId: '', outcome: '', page: '1' })
    expect(eventsDoorParams(read('payer=BUPA&outcome=lineAbandoned&page=2'))).toEqual({
      from: '2026-10-21',
      to: '2026-10-27',
      store: '',
      payer: 'BUPA',
      masterId: '',
      outcome: 'lineAbandoned',
      page: '2',
    })
  })
})
