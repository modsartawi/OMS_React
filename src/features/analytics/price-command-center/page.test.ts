/**
 * oms 934 (BackOffice spec 4127, decision 8) — the price command center stands behind the PriceWatch View grant
 * (`PriceWatch:03`, read off the one permissions answer), and its tab strip shows only the tabs that are built and that the
 * user may open. The page is rendered as static markup with the permissions answer seeded in the query cache.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import '@/core/i18n'
import { PERMISSIONS_KEY, permissionsOf, type PermissionsAnswer } from '@/core/permissions'
import { ANALYTICS_MENU } from '@/layout/menu-analytics'
import PriceCommandCenterPage from './PriceCommandCenterPage'
import { canManagePriceWatch, canViewPriceIndex, canViewPriceWatch } from './access'
import { TAB_REGISTRY } from './tab-registry'
import { defaultTab, pinTab, visibleTabs, type TabEntry } from './tabs'

const answer = (screens: string[]): PermissionsAnswer => ({
  screens,
  extras: { fileServerReady: false, notificationCenterOn: false, commandCenterOn: false, nphiesContractVersion: '1.3', canManageRoles: false, canManageUsers: false },
  version: 'v',
})

const drawPage = (screens: string[]) => {
  const client = new QueryClient()
  client.setQueryData(PERMISSIONS_KEY, answer(screens))
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(MemoryRouter, { initialEntries: ['/analytics/price-command-center'] }, createElement(PriceCommandCenterPage)),
    ),
  )
}

describe('the price command center page', () => {
  it('is hidden without the View grant — the denial, no tab strip', () => {
    const html = drawPage(['Analytics:03', 'PriceWatch:06'])
    expect(html).toContain('No access to the price command center')
    expect(html).not.toContain('role="tablist"')
  })

  it('opens on the price alerts with the View grant', () => {
    const html = drawPage(['PriceWatch:03'])
    expect(html).toContain('role="tablist"')
    expect(html).toContain('data-tab-panel="alerts"')
    expect(html).toContain('Price command center')
  })

  it('reads View and Manage separately — Manage does not imply View in code', () => {
    expect(canViewPriceWatch(permissionsOf({ screens: ['PriceWatch:06'] }))).toBe(false)
    expect(canManagePriceWatch(permissionsOf({ screens: ['PriceWatch:06'] }))).toBe(true)
    expect(canManagePriceWatch(permissionsOf({ screens: ['PriceWatch:03'] }))).toBe(false)
  })

  it('offers its menu leaf on the same predicate as its gate', () => {
    const leaf = ANALYTICS_MENU.items?.find((i) => i.routerLink === '/analytics/price-command-center')
    expect(leaf?.requires).toBe(canViewPriceWatch)
  })
})

describe('the tab registry', () => {
  const yes = () => true
  const no = () => false
  const reg: TabEntry[] = [
    { id: 'index', can: yes, built: false },
    { id: 'alerts', can: yes, built: true },
    { id: 'grid', can: no, built: true },
    { id: 'feed-health', can: yes, built: true },
  ]
  const p = permissionsOf({ screens: [] })

  it('hides unbuilt tabs and tabs the user may not open, keeping the strip order', () => {
    expect(visibleTabs(reg, p)).toEqual(['alerts', 'feed-health'])
  })

  it('opens on Alerts by default, a visible tab the URL names, else the first visible', () => {
    expect(defaultTab(['alerts', 'feed-health'], null)).toBe('alerts')
    expect(defaultTab(['alerts', 'feed-health'], 'feed-health')).toBe('feed-health')
    expect(defaultTab(['alerts', 'feed-health'], 'grid')).toBe('alerts')
    expect(defaultTab(['feed-health'], null)).toBe('feed-health')
  })

  // 938: Index comes first; Alerts stays the default only for a user with open price alerts of their own.
  it('opens on Index for a user with no open price alerts of their own, on Alerts for one with some', () => {
    expect(defaultTab(['index', 'alerts'], null, false)).toBe('index')
    expect(defaultTab(['index', 'alerts'], null, true)).toBe('alerts')
    expect(defaultTab(['index', 'alerts'], 'alerts', false)).toBe('alerts')
    expect(defaultTab(['index', 'alerts'], 'index', true)).toBe('index')
    // Not known yet: Alerts, as before 938.
    expect(defaultTab(['index', 'alerts'], null)).toBe('alerts')
    expect(defaultTab(['index'], null, true)).toBe('index')
  })
})

describe('the Index tab (938)', () => {
  it('needs Analytics:03 beside the PriceWatch view grant — it reads Cube through Analytics/Query', () => {
    expect(canViewPriceIndex(permissionsOf({ screens: ['PriceWatch:03', 'Analytics:03'] }))).toBe(true)
    expect(canViewPriceIndex(permissionsOf({ screens: ['PriceWatch:03'] }))).toBe(false)
    expect(canViewPriceIndex(permissionsOf({ screens: ['Analytics:03'] }))).toBe(false)
  })

  it('is first in the strip for a user who may open it', () => {
    expect(visibleTabs(TAB_REGISTRY, permissionsOf({ screens: ['PriceWatch:03', 'Analytics:03'] }))[0]).toBe('index')
    expect(visibleTabs(TAB_REGISTRY, permissionsOf({ screens: ['PriceWatch:03'] }))).not.toContain('index')
  })
})

// Review fix: the default is decided ONCE and written to the URL, so a later re-read of Mine (an Accept, a Dismiss or a
// Break invalidating it) cannot move the user off the tab they are working on.
describe('the decided default tab is pinned in the URL', () => {
  it('writes ?tab= once the URL names none, keeping every other parameter', () => {
    const pinned = pinTab(new URLSearchParams('material=100012345'), 'alerts')
    expect(pinned?.get('tab')).toBe('alerts')
    expect(pinned?.get('material')).toBe('100012345')
  })

  it('leaves a URL that already names a tab alone', () => {
    expect(pinTab(new URLSearchParams('tab=grid'), 'alerts')).toBeNull()
  })
})
