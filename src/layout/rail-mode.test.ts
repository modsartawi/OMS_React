import { describe, expect, it } from 'vitest'
import { railExpanded, railMode } from './rail-mode'

describe('rail mode is pinned, overlay or drawer by width and preference', () => {
  it('reads the band from the viewport width (363 §"Narrow widths")', () => {
    // ≥1280: the rail as built in 385/386, its toggle pinning the tree.
    for (const w of [1280, 1281, 1600, 3400]) expect(railMode(w), String(w)).toBe('pinned')
    // 640–1279: always collapsed, the toggle overlays the tree.
    for (const w of [640, 641, 992, 1100, 1279]) expect(railMode(w), String(w)).toBe('overlay')
    // <640: no rail at all, a hamburger and a drawer.
    for (const w of [0, 320, 390, 639]) expect(railMode(w), String(w)).toBe('drawer')
  })

  it('pinned follows the stored preference, never the overlay', () => {
    expect(railExpanded('pinned', true, false)).toBe(true)
    expect(railExpanded('pinned', false, false)).toBe(false)
    // An overlay left open as the window widened does not pin the tree.
    expect(railExpanded('pinned', false, true)).toBe(false)
  })

  it('overlay is collapsed whatever the preference, until the toggle opens the overlay', () => {
    expect(railExpanded('overlay', true, false)).toBe(false)
    expect(railExpanded('overlay', false, false)).toBe(false)
    expect(railExpanded('overlay', false, true)).toBe(true)
    expect(railExpanded('overlay', true, true)).toBe(true)
  })

  it('drawer never draws a rail', () => {
    for (const pref of [true, false]) for (const open of [true, false]) expect(railExpanded('drawer', pref, open)).toBe(false)
  })
})
