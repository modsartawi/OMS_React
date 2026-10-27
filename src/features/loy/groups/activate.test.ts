/**
 * Deactivate / reactivate a group (oms ticket 631, BackOffice spec 3173; door `SetActive`, 3174). The
 * deactivate confirm names every live bonus-buy that uses the group (`liveBonusBuys`, 3179) and says
 * plainly when there are none; the request is `{ groupId, isActive }` and nothing else.
 */
import { describe, expect, it } from 'vitest'
import { deactivateConfirm, setActiveRequest } from './activate'

describe('deactivate confirm names the live bonus-buys', () => {
  it('n bonus-buys give n named lines, promo number and description, in the order sent', () => {
    const confirm = deactivateConfirm({
      liveBonusBuys: [
        { promoNumber: '100045', description: 'Buy 2 vitamins get 1' },
        { promoNumber: '100046', description: 'Baby care bundle' },
      ],
    })
    expect(confirm).toStrictEqual({
      sentence: 'activate.confirm.stops',
      lines: [
        { promoNumber: '100045', description: 'Buy 2 vitamins get 1' },
        { promoNumber: '100046', description: 'Baby care bundle' },
      ],
    })
  })

  it('none gives the "stops no live offer" sentence and no lines', () => {
    expect(deactivateConfirm({ liveBonusBuys: [] })).toStrictEqual({ sentence: 'activate.confirm.stopsNone', lines: [] })
  })

  it('a door that omitted liveBonusBuys reads as none, not as an error', () => {
    const older = {} as { liveBonusBuys: never[] }
    expect(deactivateConfirm(older)).toStrictEqual({ sentence: 'activate.confirm.stopsNone', lines: [] })
  })
})

describe('set-active request', () => {
  it('is { groupId, isActive } only', () => {
    expect(setActiveRequest('g-1', false)).toStrictEqual({ groupId: 'g-1', isActive: false })
    expect(setActiveRequest('g-3', true)).toStrictEqual({ groupId: 'g-3', isActive: true })
  })
})
