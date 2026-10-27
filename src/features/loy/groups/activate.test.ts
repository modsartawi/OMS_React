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
        { bbyNumber: '100045', description: 'Buy 2 vitamins get 1' },
        { bbyNumber: '100046', description: 'Baby care bundle' },
      ],
    })
    expect(confirm).toStrictEqual({
      sentence: 'activate.confirm.stops',
      lines: [
        { bbyNumber: '100045', description: 'Buy 2 vitamins get 1' },
        { bbyNumber: '100046', description: 'Baby care bundle' },
      ],
    })
  })

  it('none gives the "stops no live offer" sentence and no lines', () => {
    expect(deactivateConfirm({ liveBonusBuys: [] })).toStrictEqual({ sentence: 'activate.confirm.stopsNone', lines: [] })
  })

  it('a door that omitted liveBonusBuys is not an error, and never reads as none', () => {
    const older = {} as { liveBonusBuys: never[] }
    expect(deactivateConfirm(older)).toStrictEqual({ sentence: 'activate.confirm.stopsUnknown', lines: [] })
  })
})

describe('set-active request', () => {
  it('is { groupId, isActive } only', () => {
    expect(setActiveRequest('g-1', false)).toStrictEqual({ groupId: 'g-1', isActive: false })
    expect(setActiveRequest('g-3', true)).toStrictEqual({ groupId: 'g-3', isActive: true })
  })
})

// Review fix 4: the detail door may omit liveBonusBuys; the list entry answers, else the confirm says it does not know.
describe('deactivate confirm never claims "stops no live offer" without knowing', () => {
  it('falls back to the groups-list entry when the detail omits the field', () => {
    const line = { bbyNumber: '100045', description: 'Buy 2 vitamins get 1' }
    expect(deactivateConfirm({}, { liveBonusBuys: [line] })).toStrictEqual({ sentence: 'activate.confirm.stops', lines: [line] })
    expect(deactivateConfirm({}, { liveBonusBuys: [] })).toStrictEqual({ sentence: 'activate.confirm.stopsNone', lines: [] })
  })
  it('says it does not know when neither the detail nor the list sent the field', () => {
    expect(deactivateConfirm({}, undefined)).toStrictEqual({ sentence: 'activate.confirm.stopsUnknown', lines: [] })
    expect(deactivateConfirm({}, {})).toStrictEqual({ sentence: 'activate.confirm.stopsUnknown', lines: [] })
  })
  it("the detail's own [] wins over the list", () => {
    expect(deactivateConfirm({ liveBonusBuys: [] }, { liveBonusBuys: [{ bbyNumber: '1', description: 'x' }] }).sentence).toBe('activate.confirm.stopsNone')
  })
})
