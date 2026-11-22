import { describe, expect, it } from 'vitest'
import { BATCH_FILTERS, HOLD_STATES, ITEM_FILTERS, STOCK_CONSOLE_FLAGS } from '@/core/models/stock-console'
import { flagHref, flagLink } from './flags'
import { searchFromParams, shouldRead, type ListSpec } from './search'
import { resolveStoreTab } from './store-tabs'

const LISTS: Record<string, ListSpec> = {
  items: { filters: ITEM_FILTERS, keep: ['tab'] },
  holds: { filters: HOLD_STATES, keep: ['tab'] },
  batches: { filters: BATCH_FILTERS, keep: ['tab'] },
}

/** Where a click lands: the store page's path, the tab it opens and the list's search as the address says it. */
function land(href: string) {
  const [path, qs = ''] = href.split('?')
  const params = new URLSearchParams(qs)
  const tab = resolveStoreTab(params.get('tab'))
  const spec = LISTS[tab]
  return { path, tab, search: spec ? searchFromParams(params, spec) : null, params }
}

describe('a flag on a store’s header opens its list', () => {
  it('below zero opens Items, filtered to below zero, with the search run', () => {
    const { path, tab, search } = land(flagHref('P077', 'BelowZero')!)
    expect(path).toBe('/stock/console/store/P077')
    expect(tab).toBe('items')
    expect(search!.filter).toBe('belowZero')
    expect(shouldRead(search!)).toBe(true)
  })

  it('an old hold opens Holds on the standing ones, and sales not applied on the sold ones, each searched', () => {
    const old = land(flagHref('P077', 'OldHold')!)
    expect([old.tab, old.search!.filter, shouldRead(old.search!)]).toEqual(['holds', 'standing', true])
    const sold = land(flagHref('P077', 'SalesNotApplied')!)
    expect([sold.tab, sold.search!.filter, shouldRead(sold.search!)]).toEqual(['holds', 'sold', true])
  })

  it('placeholder stock opens Batches on the placeholder ones, searched', () => {
    const { tab, search } = land(flagHref('P077', 'PlaceholderStock')!)
    expect([tab, search!.filter, shouldRead(search!)]).toEqual(['batches', 'placeholder', true])
  })

  it('a differing comparison opens Feeds, which reads on opening: no filter, no search to run', () => {
    const { tab, params } = land(flagHref('P077', 'ComparisonDiffers')!)
    expect(tab).toBe('feeds')
    expect(params.toString()).toBe('tab=feeds')
  })

  it('SAP quiet opens Feeds too, where the SAP place and its last attempt are', () => {
    expect(flagLink('SapQuiet')).toEqual({ tab: 'feeds', filter: null })
  })

  it('every one of the six flags opens somewhere', () => {
    for (const code of STOCK_CONSOLE_FLAGS) expect([code, flagLink(code) !== null]).toEqual([code, true])
  })

  it('an unknown flag opens nothing — it stays a plain sentence', () => {
    expect(flagLink('MoonPhase')).toBeNull()
    expect(flagHref('P077', 'MoonPhase')).toBeNull()
  })

  it('the store code is escaped in the path', () => {
    expect(flagHref('A/B', 'BelowZero')!.split('?')[0]).toBe('/stock/console/store/A%2FB')
  })
})
