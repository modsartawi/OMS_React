import { afterEach, describe, expect, it, vi } from 'vitest'
import { pinEndFor, pinStartFor, toasterPositionFor } from './direction'

/**
 * Direction is a boot fact (spec 380 F22, F23). AG Grid pins to a PHYSICAL side —
 * `pinned: 'left'` stays left in a mirrored grid (378 §1, measured) — so the side a
 * column pins to is read from the page's direction once, at boot.
 */
describe('pinStart', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('pinStart reads right under rtl and left under ltr', () => {
    expect(pinStartFor('rtl')).toBe('right')
    expect(pinStartFor('ltr')).toBe('left')
  })

  it('pinEnd is the other side', () => {
    expect(pinEndFor('rtl')).toBe('left')
    expect(pinEndFor('ltr')).toBe('right')
  })

  it('is read from the boot document: right when <html dir="rtl">', async () => {
    vi.stubGlobal('document', { documentElement: { dir: 'rtl' } })
    const boot = await import('./direction')
    expect(boot.bootDirection).toBe('rtl')
    expect(boot.pinStart).toBe('right')
    expect(boot.pinEnd).toBe('left')
  })

  it('is ltr when <html> carries no dir, or one that is not rtl', async () => {
    vi.stubGlobal('document', { documentElement: { dir: '' } })
    const boot = await import('./direction')
    expect(boot.bootDirection).toBe('ltr')
    expect(boot.pinStart).toBe('left')
  })

  it('is ltr with no document at all (a node module graph, as under vitest)', async () => {
    const boot = await import('./direction')
    expect(boot.bootDirection).toBe('ltr')
    expect(boot.pinStart).toBe('left')
  })
})

/**
 * Toasts sit at the bottom END (spec 380 F16, 377 §2). Sonner's positions are physical, so
 * the end corner is named per direction: today's physical `top-right` sat on the top bar's
 * store chip and bell, and a physical `bottom-right` would be the reading START under RTL.
 */
describe('toaster position', () => {
  it('toaster position maps bottom-end by direction', () => {
    expect(toasterPositionFor('ltr')).toBe('bottom-right')
    expect(toasterPositionFor('rtl')).toBe('bottom-left')
  })
})
