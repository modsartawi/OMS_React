/**
 * An inspector pane's width (ticket 397, spec 380 L15–L16; ruling 367 §4), graduated from the
 * Deliveries feature at ticket 432: the bounds, the 40% viewport cap and the separator's keys.
 */
import { describe, expect, it } from 'vitest'
import { clampInspectorWidth, INSPECTOR_WIDTH, maxInspectorWidth, separatorKeyWidth } from './inspector-pane'

const WIDE = 1600

describe('inspectorWidthClamps', () => {
  it('opens at 360', () => {
    expect(INSPECTOR_WIDTH.default).toBe(360)
  })

  it('clamps to 320–560 on a wide viewport', () => {
    expect(clampInspectorWidth(100, WIDE)).toBe(320)
    expect(clampInspectorWidth(400, WIDE)).toBe(400)
    expect(clampInspectorWidth(900, WIDE)).toBe(560)
  })

  it('never takes more than 40% of the viewport', () => {
    expect(maxInspectorWidth(1280)).toBe(512)
    expect(clampInspectorWidth(560, 1280)).toBe(512)
    expect(clampInspectorWidth(560, 1000)).toBe(400)
  })

  it('keeps the 320 floor when 40% of a narrow viewport is less', () => {
    expect(maxInspectorWidth(700)).toBe(320)
    expect(clampInspectorWidth(500, 700)).toBe(320)
  })

  it('rounds a dragged width to whole pixels', () => {
    expect(clampInspectorWidth(400.6, WIDE)).toBe(401)
  })

  it('arrows step 16 px; the one toward the inline start grows the pane', () => {
    expect(separatorKeyWidth('ArrowLeft', 360, { viewport: WIDE, rtl: false })).toBe(376)
    expect(separatorKeyWidth('ArrowRight', 360, { viewport: WIDE, rtl: false })).toBe(344)
    // Under RTL the pane sits on the left and its inline-start edge faces right.
    expect(separatorKeyWidth('ArrowRight', 360, { viewport: WIDE, rtl: true })).toBe(376)
    expect(separatorKeyWidth('ArrowLeft', 360, { viewport: WIDE, rtl: true })).toBe(344)
  })

  it('an arrow step stops at the bounds', () => {
    expect(separatorKeyWidth('ArrowRight', 330, { viewport: WIDE, rtl: false })).toBe(320)
    expect(separatorKeyWidth('ArrowLeft', 550, { viewport: WIDE, rtl: false })).toBe(560)
    expect(separatorKeyWidth('ArrowLeft', 512, { viewport: 1280, rtl: false })).toBe(512)
  })

  it('Home jumps to the minimum and End to the maximum the viewport allows', () => {
    expect(separatorKeyWidth('Home', 400, { viewport: WIDE, rtl: false })).toBe(320)
    expect(separatorKeyWidth('End', 400, { viewport: WIDE, rtl: false })).toBe(560)
    expect(separatorKeyWidth('End', 400, { viewport: 1280, rtl: true })).toBe(512)
  })

  it('any other key is not the separator’s', () => {
    for (const key of ['ArrowUp', 'ArrowDown', 'Enter', 'KeyJ', ' ']) {
      expect(separatorKeyWidth(key, 360, { viewport: WIDE, rtl: false })).toBeNull()
    }
  })
})
