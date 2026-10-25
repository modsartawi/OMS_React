/**
 * Ticket 552 — removing a HungerStation store's onboarding (contract § Stores, `DELETE
 * HungerStationWeb/Stores/{storeCode}?reason=`). The reason rides the QUERY STRING, URL-encoded with
 * its unicode kept; the confirmation says in words what the removal does and what it does not.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/hungerstation-stores.json'
import ar from '@/locales/ar/hungerstation-stores.json'
import { REMOVE_CONSEQUENCES, removePath } from './remove'

/** What the server reads back out of the path, as ASP.NET would bind it. */
const read = (path: string) => {
  const url = new URL(path, 'http://sis.local/api/')
  return { pathname: url.pathname, reason: url.searchParams.get('reason'), keys: [...url.searchParams.keys()] }
}

describe('removePath', () => {
  it('names the store in the path and the reason in the query string', () => {
    expect(removePath('1234', 'closed for renovation')).toBe('HungerStationWeb/Stores/1234?reason=closed+for+renovation')
  })

  it('unicode survives the trip — Arabic with diacritics, a line break, an emoji', () => {
    const reason = 'أُغلق الفرع\nبطلب هنقرستيشن 👍'
    const path = removePath('0099', reason)
    expect(path).not.toMatch(/[^\x20-\x7e]/) // nothing raw on the wire
    expect(read(path).reason).toBe(reason)
  })

  it('a reason that looks like query syntax stays ONE reason', () => {
    const reason = 'a&reason=b #3 50% ?x=y/z'
    const path = removePath('1234', reason)
    expect(read(path)).toEqual({ pathname: '/api/HungerStationWeb/Stores/1234', reason, keys: ['reason'] })
  })

  it('the store code is encoded as a path segment, zeros kept', () => {
    expect(read(removePath('0450', 'x')).pathname).toBe('/api/HungerStationWeb/Stores/0450')
    expect(read(removePath('a/b', 'x')).pathname).toBe('/api/HungerStationWeb/Stores/a%2Fb')
  })
})

describe('the remove confirmation says what it does, in words', () => {
  const sentence = (key: string) => (en.remove.consequences as Record<string, string>)[key]

  it('four consequences, in order', () => {
    expect(REMOVE_CONSEQUENCES).toEqual(['syncStops', 'vendorIdFree', 'historyStays', 'notOffHungerStation'])
  })

  it('the stock sync stops and its orders are no longer fetched', () => {
    expect(sentence('syncStops')).toMatch(/stock sync stops/)
    expect(sentence('syncStops')).toMatch(/orders are no longer fetched/)
  })

  it('its vendor id becomes free for another store', () => {
    expect(sentence('vendorIdFree')).toMatch(/vendor id becomes free for another store/)
  })

  it('its logs, orders and history stay readable', () => {
    expect(sentence('historyStays')).toMatch(/logs, orders and history stay readable/)
  })

  it('🚩 it is NOT taken off HungerStation — that is done in HungerStation’s portal', () => {
    expect(sentence('notOffHungerStation')).toMatch(/not taken off HungerStation/)
    expect(sentence('notOffHungerStation')).toMatch(/HungerStation's portal/)
  })

  it.each([en, ar])('every consequence has its sentence in both languages', (locale) => {
    const c = (locale.remove as { consequences: Record<string, string> }).consequences
    for (const key of REMOVE_CONSEQUENCES) expect([key, typeof c[key]]).toEqual([key, 'string'])
  })

  it('the note names the store through a slot, never a bare value', () => {
    for (const locale of [en, ar]) expect(locale.remove.note).toMatch(/<store>\{\{store\}\}<\/store>/)
  })
})
