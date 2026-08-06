/**
 * `tab-volume` — ticket 236's pure Proof bullet: the tab shell states its
 * ceiling honestly, and never states a row count.
 *
 * The property worth regressing is not the wording (that lives in `loy.json`)
 * but the three rules an agent could describe: the caption names the ceiling,
 * the warning fires when the window comes back full, and the number the module
 * hands over is the **cap** and never the count of rows it was shown.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MEMBER_TAB,
  MEMBER_TABS,
  cappedVolume,
  countedVolume,
  resolveTab,
} from './tab-volume'

describe('resolveTab', () => {
  it('opens the tab a link named', () => {
    expect(resolveTab('sales')).toBe('sales')
    expect(resolveTab('actions')).toBe('actions')
    expect(resolveTab('activities')).toBe('activities')
  })

  it('lands on Activities with no ?tab= at all', () => {
    expect(resolveTab(null)).toBe('activities')
    expect(resolveTab(undefined)).toBe('activities')
    expect(DEFAULT_MEMBER_TAB).toBe('activities')
  })

  it('🚩 falls back to Activities on an unknown value rather than erroring', () => {
    // A link is something a colleague pasted. Refusing to render over a mistyped
    // query param costs the agent the member for no reading benefit.
    for (const junk of ['', 'Sales', 'purchases', 'activities ', '../etc']) {
      expect(resolveTab(junk)).toBe('activities')
    }
  })

  it('draws the three peers in the order the strip needs them', () => {
    expect([...MEMBER_TABS]).toEqual(['activities', 'sales', 'actions'])
  })
})

describe('cappedVolume', () => {
  it('names the ceiling, on both capped tabs', () => {
    expect(cappedVolume('activities', 40)).toMatchObject({
      captionKey: 'tabs.activities.caption',
      cap: 100,
    })
    expect(cappedVolume('sales', 12)).toMatchObject({
      captionKey: 'tabs.sales.caption',
      cap: 500,
    })
  })

  it('stays quiet below the cap', () => {
    expect(cappedVolume('activities', 0).warningKey).toBeNull()
    expect(cappedVolume('activities', 99).warningKey).toBeNull()
    expect(cappedVolume('sales', 499).warningKey).toBeNull()
  })

  it('🚩 warns at exactly the cap — a false positive there, a false negative otherwise', () => {
    expect(cappedVolume('activities', 100).warningKey).toBe('tabs.activities.atCap')
    expect(cappedVolume('sales', 500).warningKey).toBe('tabs.sales.atCap')
  })

  it('🚩 warns above the cap too — a window wider than its own TOP (n) is still a window', () => {
    expect(cappedVolume('activities', 101).warningKey).toBe('tabs.activities.atCap')
  })

  it('🚩 never hands over a bare row count — a count reads as completeness', () => {
    // The row count goes IN and only the cap and a key come OUT. This is the rule
    // the whole module exists for: `40` must be unreachable from the caption.
    const below = cappedVolume('activities', 40)
    expect(Object.values(below)).not.toContain(40)
    const full = cappedVolume('sales', 500)
    // 500 IS present — as the cap, which is a fact about the query and not about
    // this member. The distinction is the point, so it is asserted rather than
    // assumed.
    expect(full.cap).toBe(500)
    expect(Object.keys(full)).toEqual(['captionKey', 'cap', 'warningKey'])
  })
})

describe('countedVolume', () => {
  it('states a real total, with no ceiling and no warning to hedge it', () => {
    const volume = countedVolume(312)
    expect(volume).toEqual({ captionKey: 'tabs.actions.caption', total: 312 })
    expect(Object.keys(volume)).not.toContain('cap')
    expect(Object.keys(volume)).not.toContain('warningKey')
  })

  it('carries a zero total as a fact like any other', () => {
    expect(countedVolume(0).total).toBe(0)
  })
})
