/**
 * Ticket 626 — the IDF events address and the door's query. One filter (local window, store, payer, master) that
 * 627's swap report shares; the log adds the outcome and the page. Empty fields never reach the door.
 */
import { describe, expect, it } from 'vitest'
import { eventsDoorParams, filterDoorParams, readIdfEventsQuery, withFilter, writeIdfEventsQuery } from './events-filter'

const TODAY = '2026-10-27'
const read = (qs: string) => readIdfEventsQuery(new URLSearchParams(qs), TODAY)

describe('events filter builds the query and drops empty fields', () => {
  it('defaults_theLast7LocalDays_page1_noOtherFilter', () => {
    expect(read('')).toEqual({ from: '2026-10-21', to: '2026-10-27', store: '', payer: '', masterId: '', outcome: '', page: 1 })
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

  it('changingAFilterGoesBackToPage1', () => {
    const q = { ...read(''), page: 4 }
    expect(withFilter(q, { outcome: 'reminder' })).toMatchObject({ outcome: 'reminder', page: 1 })
    expect(withFilter(q, { store: 'P001' })).toMatchObject({ store: 'P001', page: 1 })
  })

  it('theSharedFilter_sendsTheWindowAndOnlyTheFilledFields', () => {
    expect(filterDoorParams(read(''))).toEqual({ from: '2026-10-21', to: '2026-10-27' })
    expect(filterDoorParams(read('store=P019&master=M-OPS'))).toEqual({ from: '2026-10-21', to: '2026-10-27', store: 'P019', masterId: 'M-OPS' })
  })

  it('theLog_addsTheOutcomeWhenChosen_andAlwaysThePage', () => {
    expect(eventsDoorParams(read(''))).toEqual({ from: '2026-10-21', to: '2026-10-27', page: '1' })
    expect(eventsDoorParams(read('payer=BUPA&outcome=lineAbandoned&page=2'))).toEqual({
      from: '2026-10-21',
      to: '2026-10-27',
      payer: 'BUPA',
      outcome: 'lineAbandoned',
      page: '2',
    })
  })
})
