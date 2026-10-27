// The shared controls' class composition (ticket 594, spec 590 §Shared controls).
// RTL is not installed (spec 083), so Button / IconButton / Chip are proven on the
// live page by tools/dmsco-theme-drive.mjs; this suite pins the pure half: which
// shape and which state attributes each control composes. Expected tokens are the
// spec's own words (pill at h-7, primary-050 / primary-800 / primary border "on",
// card + border "off"), not re-derived from the module.
import { describe, expect, it } from 'vitest'
import { BUTTON_VARIANTS, buttonClass, chipClass, chipState, iconButtonClass } from './control-classes'

const tokens = (cls: string) => cls.split(/\s+/).filter(Boolean)

describe('buttonClass', () => {
  it('keeps the nine existing variants and adds link', () => {
    expect([...BUTTON_VARIANTS].sort()).toEqual(
      [
        'cancel-request',
        'danger',
        'danger-outlined',
        'fulfilment',
        'ghost',
        'link',
        'outlined',
        'primary',
        'secondary',
        'text',
      ].sort(),
    )
  })

  it('gives every variant but link the full pill at h-7', () => {
    for (const v of BUTTON_VARIANTS.filter((v) => v !== 'link')) {
      expect(tokens(buttonClass(v)), v).toEqual(expect.arrayContaining(['h-7', 'rounded-full', 'px-3']))
    }
  })

  it('draws link as underlined primary ink with no ground or border', () => {
    const t = tokens(buttonClass('link'))
    expect(t).toEqual(expect.arrayContaining(['text-primary', 'underline', 'h-7']))
    expect(t.some((x) => /^bg-(?!transparent)/.test(x))).toBe(false)
    expect(t).not.toContain('border')
  })

  it('styles aria-disabled like disabled on every variant, so a reasoned disable stays focusable', () => {
    for (const v of BUTTON_VARIANTS) {
      expect(tokens(buttonClass(v)), v).toEqual(
        expect.arrayContaining(['disabled:opacity-50', 'aria-disabled:opacity-50', 'aria-disabled:cursor-not-allowed']),
      )
    }
  })

  it('appends the caller className last', () => {
    expect(buttonClass('primary', 'w-full').endsWith(' w-full')).toBe(true)
  })
})

describe('iconButtonClass', () => {
  it('is a square at h-7 by default and h-5 when compact', () => {
    expect(tokens(iconButtonClass())).toEqual(expect.arrayContaining(['h-7', 'w-7', 'rounded-full']))
    expect(tokens(iconButtonClass('ghost', 'compact'))).toEqual(expect.arrayContaining(['h-5', 'w-5']))
    expect(tokens(iconButtonClass('ghost', 'compact'))).not.toContain('h-7')
  })

  it('shares the Button disabled treatment, aria-disabled included', () => {
    for (const v of ['ghost', 'outlined', 'danger'] as const) {
      expect(tokens(iconButtonClass(v)), v).toEqual(
        expect.arrayContaining(['disabled:opacity-50', 'aria-disabled:opacity-50', 'aria-disabled:cursor-not-allowed']),
      )
    }
  })

  it('borders only the outlined variant', () => {
    expect(tokens(iconButtonClass('outlined'))).toContain('border')
    expect(tokens(iconButtonClass('ghost'))).not.toContain('border')
  })
})

describe('chipState', () => {
  it('exposes a toggle as aria-pressed, with no role', () => {
    expect(chipState('toggle', true)).toEqual({ 'aria-pressed': true })
    expect(chipState('toggle', false)).toEqual({ 'aria-pressed': false })
  })

  it('exposes a tab as role=tab with aria-selected', () => {
    expect(chipState('tab', true)).toEqual({ role: 'tab', 'aria-selected': true })
    expect(chipState('tab', false)).toEqual({ role: 'tab', 'aria-selected': false })
  })
})

describe('chipClass', () => {
  it('is off on the card ground with the border, at h-7 as a pill', () => {
    expect(tokens(chipClass('toggle'))).toEqual(
      expect.arrayContaining(['h-7', 'rounded-full', 'border', 'border-border', 'bg-card']),
    )
  })

  it('turns on from the state attribute its variant exposes', () => {
    expect(tokens(chipClass('toggle'))).toEqual(
      expect.arrayContaining(['aria-pressed:bg-primary-050', 'aria-pressed:text-primary-800', 'aria-pressed:border-primary']),
    )
    expect(tokens(chipClass('tab'))).toEqual(
      expect.arrayContaining(['aria-selected:bg-primary-050', 'aria-selected:text-primary-800', 'aria-selected:border-primary']),
    )
    expect(chipClass('tab')).not.toMatch(/aria-pressed:/)
  })
})
