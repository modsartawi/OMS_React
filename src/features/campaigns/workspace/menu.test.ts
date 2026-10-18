import { describe, expect, it } from 'vitest'
import { drawnMenu, drawnSettings, pageLanded, settingsPage, workspaceMenu } from './menu'

const keys = (coupons: boolean, points: boolean) => workspaceMenu([...(coupons ? ['coupons' as const] : []), ...(points ? ['points' as const] : [])]).map((i) => i.key)

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

  it('draws the offered items whose page has landed: Coupons (515) and Versions (512) both have', () => {
    expect(drawnMenu(['coupons', 'points']).map((i) => i.key)).toEqual(['dashboard', 'rules', 'coupons', 'versions'])
    expect(drawnMenu([]).map((i) => i.key)).toEqual(['dashboard', 'rules', 'versions'])
  })

  it('pageLanded links only a page that has landed: the rule builder, Settings (509), Budgets (510) and Coupons (515)', () => {
    expect(pageLanded('rules')).toBe(true)
    expect(pageLanded('settings/details')).toBe(true)
    expect(pageLanded('settings/schedule')).toBe(true)
    expect(pageLanded('settings/budgets')).toBe(true)
    expect(pageLanded('settings/nonsense')).toBe(false)
    expect(pageLanded('coupons')).toBe(true)
    expect(pageLanded('versions')).toBe(true)
  })
})

describe('settings pages', () => {
  it('draws Details, Schedule, Audience, Features, Budgets, Value map (523) and Offline, in the prototype’s order', () => {
    expect(drawnSettings()).toEqual(['details', 'schedule', 'audience', 'features', 'budgets', 'valueMap', 'offline'])
  })

  it('settingsPage reads a landed page by its segment, and nothing else', () => {
    expect(settingsPage('offline')).toBe('offline')
    expect(settingsPage('budgets')).toBe('budgets')
    expect(settingsPage(undefined)).toBeNull()
  })
})
