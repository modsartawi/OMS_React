import { describe, expect, it } from 'vitest'
import { BLANK_QUERY } from './query-model'
import { URL_ENTRY_PARAMS, urlEntryQuery } from './url-entry'

const read = (qs: string) => urlEntryQuery(new URLSearchParams(qs))

describe('the Deliveries URL entry', () => {
  it('a store and a day range become a search for that store over those days (a Custom date)', () => {
    expect(read('store=P001&from=2026-10-30&to=2026-11-05')).toEqual({
      ...BLANK_QUERY,
      storeCode: 'P001',
      date: { preset: 'custom', from: '2026-10-30', to: '2026-11-05' },
    })
  })

  it('a store alone searches that store with no date; a range alone searches every store', () => {
    expect(read('store=%20P002%20')).toEqual({ ...BLANK_QUERY, storeCode: 'P002' })
    expect(read('from=2026-11-01&to=2026-11-01')).toEqual({ ...BLANK_QUERY, date: { preset: 'custom', from: '2026-11-01', to: '2026-11-01' } })
  })

  it('a half, reversed or unreadable range is no date', () => {
    expect(read('store=P001&from=2026-11-01')).toEqual({ ...BLANK_QUERY, storeCode: 'P001' })
    expect(read('store=P001&from=2026-11-05&to=2026-11-01')).toEqual({ ...BLANK_QUERY, storeCode: 'P001' })
    expect(read('store=P001&from=yesterday&to=2026-11-01')).toEqual({ ...BLANK_QUERY, storeCode: 'P001' })
    expect(read('store=P001&from=2026-02-30&to=2026-03-01')).toEqual({ ...BLANK_QUERY, storeCode: 'P001' })
  })

  it('no entry when the URL carries none of its params, or only unreadable ones', () => {
    expect(read('')).toBeNull()
    expect(read('tab=2&city=riyadh')).toBeNull()
    expect(read('store=&from=2026-11-05')).toBeNull()
  })

  it('names exactly the params it reads, so the page can clear them after entry', () => {
    expect([...URL_ENTRY_PARAMS]).toEqual(['store', 'from', 'to'])
  })
})
