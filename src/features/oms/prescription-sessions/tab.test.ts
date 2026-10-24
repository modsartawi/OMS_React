/** Ticket 545 — the page's tab lives in the URL: Open by default (no key), To open, Ended. Pure. */
import { describe, expect, it } from 'vitest'
import { HQ_TABS, tabFromParams, tabParams } from './tab'

describe('tab ↔ URL', () => {
  it('offers Open, To open, Ended in that order', () => {
    expect(HQ_TABS).toEqual(['open', 'toOpen', 'ended'])
  })

  it('no tab, or one it does not know, is Open', () => {
    expect(tabFromParams(new URLSearchParams(''))).toBe('open')
    expect(tabFromParams(new URLSearchParams('tab=closed'))).toBe('open')
  })

  it('round-trips each tab; Open writes no key, and a switch starts its tab without the last one’s filters', () => {
    expect(tabParams('open').toString()).toBe('')
    expect(tabParams('toOpen').toString()).toBe('tab=toOpen')
    expect(tabParams('ended').toString()).toBe('tab=ended')
    for (const tab of HQ_TABS) expect(tabFromParams(tabParams(tab))).toBe(tab)
  })
})
