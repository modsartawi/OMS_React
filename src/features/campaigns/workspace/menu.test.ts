import { describe, expect, it } from 'vitest'
import { drawnMenu, workspaceMenu } from './menu'

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
    expect(drawnMenu({ coupons: true, points: true }).map((i) => i.key)).toEqual(['dashboard'])
    expect(drawnMenu({ coupons: false, points: false }).map((i) => i.key)).toEqual(['dashboard'])
  })
})
