/**
 * Ticket 665 / 671 (reconciled to the BackOffice 3201 door contract, 2026-10-29) — the promotions
 * list's filters and the open promotion live in the URL, round-trip, and reach the door as the
 * contract names them: chain, ONE status (no `type` key), name text, store; take 50.
 */
import { describe, expect, it } from 'vitest'
import type { PromotionsPageQuery } from './promotions-query'
import { PROMOTIONS_PAGE_SIZE, promotionsDoorParams, promotionsFromParams, promotionsToParams } from './promotions-query'

const query = (over: Partial<PromotionsPageQuery> = {}): PromotionsPageQuery => ({
  chain: null,
  status: null,
  q: null,
  store: null,
  skip: 0,
  take: 50,
  promotion: null,
  edit: null,
  ...over,
})

describe('promotionsFromParams ⇄ promotionsToParams', () => {
  it('666: the editor rides the URL too — `new`, or a draft id', () => {
    expect(promotionsFromParams(new URLSearchParams('edit=new')).edit).toBe('new')
    expect(promotionsToParams({ ...query(), edit: '01JBX7' }).toString()).toBe('edit=01JBX7')
  })

  it('an empty URL is no filter, the first page, nothing open; the page size is the contract default (50)', () => {
    expect(promotionsFromParams(new URLSearchParams())).toEqual(query())
    expect(PROMOTIONS_PAGE_SIZE).toBe(50)
    expect(promotionsToParams(query()).toString()).toBe('')
  })

  it('round-trips every filter, the status, skip and the open promotion', () => {
    const url = 'chain=OlaCare&status=livePartlyRefused&q=Ramadan&store=1001&skip=50&promotion=01JBX7'
    const read = promotionsFromParams(new URLSearchParams(url))
    expect(read).toEqual(query({ chain: 'OlaCare', status: 'livePartlyRefused', q: 'Ramadan', store: '1001', skip: 50, promotion: '01JBX7' }))
    expect(promotionsToParams(read).toString()).toBe(url)
  })

  it('the door takes ONE status: an old link with several keeps the first it names', () => {
    expect(promotionsFromParams(new URLSearchParams('status=bogus&status=scheduled&status=ended')).status).toBe('scheduled')
  })

  it('a status the contract does not name is dropped (the door would 400 it); a `type` key is not a filter', () => {
    const read = promotionsFromParams(new URLSearchParams('status=bogus&type=SAME_ITEM_BUNDLE'))
    expect(read).toEqual(query())
    expect(promotionsToParams(read).toString()).toBe('')
  })

  it('blank text is no filter; text is trimmed; a bad skip reads as 0', () => {
    expect(promotionsFromParams(new URLSearchParams('q=%20%20&chain=&skip=-3'))).toEqual(query())
    expect(promotionsFromParams(new URLSearchParams('q=%20Eid%20&skip=abc&store=%201001%20'))).toEqual(query({ q: 'Eid', store: '1001' }))
  })
})

describe('promotionsDoorParams — what GET HungerStationWeb/Promotions is sent', () => {
  it('every filter, skip and take; never the open promotion or the editor', () => {
    expect(promotionsDoorParams(query({ chain: 'AlDawaa', status: 'ended', q: 'Eid', store: '1001', skip: 50, promotion: 'x', edit: 'y' }))).toEqual({
      chain: 'AlDawaa',
      status: 'ended',
      q: 'Eid',
      store: '1001',
      skip: 50,
      take: 50,
    })
  })
})
