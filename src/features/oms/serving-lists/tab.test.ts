/** Ticket 568 — the serving-list detail's tab, held in the URL as `tab`. */
import { describe, expect, it } from 'vitest'
import { tabFromParams, tabParams } from './tab'

describe('the detail tab', () => {
  it('Members is the default and writes no key', () => {
    expect(tabFromParams(new URLSearchParams(''))).toBe('members')
    expect(tabParams('members').toString()).toBe('')
  })

  it('History reads and writes tab=history', () => {
    expect(tabFromParams(new URLSearchParams('tab=history'))).toBe('history')
    expect(tabParams('history').toString()).toBe('tab=history')
  })

  it('an unknown tab reads as Members', () => {
    expect(tabFromParams(new URLSearchParams('tab=audit'))).toBe('members')
  })
})
