import { describe, expect, it } from 'vitest'
import {
  EMPTY_PROMOTION_QUERY,
  PROMOTION_PAGE_SIZE,
  campaignInPromotionPath,
  promotionCampaignsBody,
  promotionQueryFromUrl,
  urlFromPromotionQuery,
  withPromotionFilter,
} from './promotion-query'

const url = (s: string) => new URLSearchParams(s)

describe('promotionQueryFromUrl / urlFromPromotionQuery', () => {
  it('round-trips every filter and the page', () => {
    const query = { q: 'واقي', mechanic: 'bundle', status: 'Pending', page: 3 }
    expect(promotionQueryFromUrl(urlFromPromotionQuery(query))).toEqual(query)
    expect(urlFromPromotionQuery(promotionQueryFromUrl(url('q=sun&mechanic=builder&status=Published&page=2'))).toString()).toBe('q=sun&mechanic=builder&status=Published&page=2')
  })

  it('an empty address is page 1 with no filter, and writes nothing back', () => {
    expect(promotionQueryFromUrl(url(''))).toEqual(EMPTY_PROMOTION_QUERY)
    expect(urlFromPromotionQuery(EMPTY_PROMOTION_QUERY).toString()).toBe('')
  })

  it('a page that is not a whole number from 1 reads as page 1', () => {
    for (const p of ['0', '-2', 'x', '1.5', '']) expect(promotionQueryFromUrl(url(`page=${p}`)).page).toBe(1)
  })

  it('a status is read in any case as its listed spelling; an unlisted one is no filter', () => {
    expect(promotionQueryFromUrl(url('status=pending')).status).toBe('Pending')
    expect(promotionQueryFromUrl(url('status=DISABLED')).status).toBe('Disabled')
    expect(promotionQueryFromUrl(url('status=archived')).status).toBe('')
  })

  it('a mechanic is kept as sent: every key HQ counts is a filter, unknown ones included', () => {
    expect(promotionQueryFromUrl(url('mechanic=freeGift')).mechanic).toBe('freeGift')
  })
})

describe('withPromotionFilter', () => {
  const on = { q: 'sun', mechanic: 'bundle', status: '', page: 4 }

  it('a changed filter goes back to page 1', () => {
    expect(withPromotionFilter(on, { q: 'sunscreen' })).toEqual({ ...on, q: 'sunscreen', page: 1 })
    expect(withPromotionFilter(on, { mechanic: '' })).toEqual({ ...on, mechanic: '', page: 1 })
    expect(withPromotionFilter(on, { status: 'Pending' })).toEqual({ ...on, status: 'Pending', page: 1 })
  })

  it('the same filter again keeps the page', () => {
    expect(withPromotionFilter(on, { mechanic: 'bundle' })).toBe(on)
  })
})

describe('promotionCampaignsBody', () => {
  it('a promotion sends its code, the filters set, the page and 50 a page', () => {
    expect(promotionCampaignsBody('0001000048-261009-261015', { q: ' واقي ', mechanic: 'bundle', status: 'Pending', page: 2 })).toEqual({
      promotionCode: '0001000048-261009-261015',
      q: 'واقي',
      mechanic: 'bundle',
      status: 'Pending',
      page: 2,
      pageSize: PROMOTION_PAGE_SIZE,
    })
    expect(PROMOTION_PAGE_SIZE).toBe(50)
  })

  it('no-promotion sends promotionCode: null, and an unset filter is not sent', () => {
    expect(promotionCampaignsBody(null, EMPTY_PROMOTION_QUERY)).toEqual({ promotionCode: null, page: 1, pageSize: 50 })
  })
})

describe('campaignInPromotionPath', () => {
  it('opens the campaign with the list context: the promotion, then its filters and page', () => {
    expect(campaignInPromotionPath('0001000048-SUN-3FOR2', '0001000048-261009-261015', { q: 'sun', mechanic: 'bundle', status: '', page: 2 })).toBe(
      '/campaigns/0001000048-SUN-3FOR2?promotion=0001000048-261009-261015&q=sun&mechanic=bundle&page=2',
    )
  })

  it('an empty promotion is no promotion', () => {
    expect(campaignInPromotionPath('WKND20', null, EMPTY_PROMOTION_QUERY)).toBe('/campaigns/WKND20?promotion=')
  })
})
