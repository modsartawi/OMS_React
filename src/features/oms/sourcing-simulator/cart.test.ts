/**
 * The cart's request (ticket 962; review 4354 #6): a time of day is planned on the day Run is pressed, not the day the
 * page opened.
 */
import { describe, expect, it } from 'vitest'
import { adviseRequest, type CartForm } from './cart'

const FORM: CartForm = {
  channel: 'WEB',
  time: '14:30',
  goodsTotal: '',
  lines: [{ key: 1, item: '100200', quantity: '2' }],
  lat: '24.7',
  lng: '46.7',
}

describe('the day a time of day is planned on', () => {
  it('is the day the request is built: a page left open past midnight plans on the new day', () => {
    expect(adviseRequest(FORM, new Date(2026, 10, 27, 23, 50))?.plannedFor).toBe('2026-11-27 14:30:00')
    expect(adviseRequest(FORM, new Date(2026, 10, 28, 0, 5))?.plannedFor).toBe('2026-11-28 14:30:00')
  })

  it('no time of day plans for now: no day is sent', () => {
    expect(adviseRequest({ ...FORM, time: '' }, new Date(2026, 10, 28, 0, 5))).not.toHaveProperty('plannedFor')
  })
})
