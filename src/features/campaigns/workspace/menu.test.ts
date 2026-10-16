import { describe, expect, it } from 'vitest'
import { drawnMenu, drawnSettings, pageLanded, settingsPage, workspaceMenu } from './menu'

const keys = (coupons: boolean, points: boolean) => workspaceMenu({ coupons, points }).map((i) => i.key)

describe('workspaceMenu', () => {
  it('workspaceMenu_showsCouponsOnlyWithTheCouponsFeature', () => {
    expect(keys(true, false)).toContain('coupons')
    expect(keys(true, true)).toContain('coupons')
    expect(keys(false, true)).not.toContain('coupons')
    expect(keys(false, false)).not.toContain('coupons')
  })

  it('always offers the Dashboard, first', () => {
    expect(keys(false, false)[0]).toBe('dashboard')
    expect(keys(true, true)[0]).toBe('dashboard')
  })

  it('draws only the items whose page has landed: Coupons waits for its page (515)', () => {
    expect(drawnMenu({ coupons: true, points: true }).map((i) => i.key)).toEqual(['dashboard', 'rules'])
    expect(drawnMenu({ coupons: false, points: false }).map((i) => i.key)).toEqual(['dashboard', 'rules'])
  })

  it('pageLanded links only a page that has landed: the rule builder and Settings (509), not Budgets before 510', () => {
    expect(pageLanded('rules')).toBe(true)
    expect(pageLanded('settings/details')).toBe(true)
    expect(pageLanded('settings/schedule')).toBe(true)
    expect(pageLanded('settings/budgets')).toBe(false)
    expect(pageLanded('settings/nonsense')).toBe(false)
    expect(pageLanded('coupons')).toBe(false)
  })
})

describe('settings pages', () => {
  it('draws Details, Schedule, Audience, Features and Offline, in the prototype’s order, Budgets waiting for 510', () => {
    expect(drawnSettings()).toEqual(['details', 'schedule', 'audience', 'features', 'offline'])
  })

  it('settingsPage reads a landed page by its segment, and nothing else', () => {
    expect(settingsPage('offline')).toBe('offline')
    expect(settingsPage('budgets')).toBeNull()
    expect(settingsPage(undefined)).toBeNull()
  })
})
