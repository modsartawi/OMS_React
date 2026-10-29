/**
 * Ticket 665 — the promotions list's filters (chain, status, type, name text) and the open
 * promotion live in the URL, round-trip, and reach the door as the contract names them.
 */
import { describe, expect, it } from 'vitest'
import type { PromotionsPageQuery } from './promotions-query'
import { PROMOTIONS_PAGE_SIZE, promotionsDoorParams, promotionsFromParams, promotionsToParams } from './promotions-query'

const query = (over: Partial<PromotionsPageQuery> = {}): PromotionsPageQuery => ({
  chain: null,
  status: [],
  type: null,
  q: null,
  store: null,
  skip: 0,
  take: 100,
  promotion: null,
  edit: null,
  ...over,
})

describe('promotionsFromParams ⇄ promotionsToParams', () => {
  it('666: the editor rides the URL too — `new`, or a draft id', () => {
    expect(promotionsFromParams(new URLSearchParams('edit=new')).edit).toBe('new')
    expect(promotionsToParams({ ...query(), edit: '01JBX7' }).toString()).toBe('edit=01JBX7')
  })

  it('an empty URL is no filter, the first page, nothing open; the page size is the contract default', () => {
    expect(promotionsFromParams(new URLSearchParams())).toEqual(query())
    expect(PROMOTIONS_PAGE_SIZE).toBe(100)
    expect(promotionsToParams(query()).toString()).toBe('')
  })

  it('round-trips every filter, repeated status keys, skip and the open promotion', () => {
    const url = 'chain=OlaCare&status=live&status=livePartlyRefused&type=SAME_ITEM_BUNDLE&q=Ramadan&skip=100&promotion=01JBX7'
    const read = promotionsFromParams(new URLSearchParams(url))
    expect(read).toEqual(
      query({ chain: 'OlaCare', status: ['live', 'livePartlyRefused'], type: 'SAME_ITEM_BUNDLE', q: 'Ramadan', skip: 100, promotion: '01JBX7' }),
    )
    expect(promotionsToParams(read).toString()).toBe(url)
  })

  it('671: Scheduled, Ended and the store ("live on this store") ride the URL and reach the door', () => {
    const url = 'status=scheduled&status=ended&store=1001'
    const read = promotionsFromParams(new URLSearchParams(url))
    expect(read).toEqual(query({ status: ['scheduled', 'ended'], store: '1001' }))
    expect(promotionsToParams(read).toString()).toBe(url)
    expect(promotionsDoorParams(read)).toMatchObject({ status: ['scheduled', 'ended'], store: '1001' })
    expect(promotionsFromParams(new URLSearchParams('store=%201001%20')).store).toBe('1001')
  })

  it('a status or type the contract does not name is dropped (the door would 400 it); a repeated status counts once', () => {
    const read = promotionsFromParams(new URLSearchParams('status=live&status=bogus&status=live&type=BOGO'))
    expect(read.status).toEqual(['live'])
    expect(read.type).toBeNull()
  })

  it('blank text is no filter; text is trimmed; a bad skip reads as 0', () => {
    expect(promotionsFromParams(new URLSearchParams('q=%20%20&chain=&skip=-3'))).toEqual(query())
    expect(promotionsFromParams(new URLSearchParams('q=%20Eid%20&skip=abc'))).toEqual(query({ q: 'Eid' }))
  })
})

describe('promotionsDoorParams — what GET HungerStationWeb/Promotions is sent', () => {
  it('every filter, skip and take; never the open promotion', () => {
    expect(promotionsDoorParams(query({ chain: 'AlDawaa', status: ['draft', 'ended'], type: 'STRIKETHROUGH', q: 'Eid', skip: 100, promotion: 'x' }))).toEqual({
      chain: 'AlDawaa',
      status: ['draft', 'ended'],
      type: 'STRIKETHROUGH',
      q: 'Eid',
      store: null,
      skip: 100,
      take: 100,
    })
  })
})
