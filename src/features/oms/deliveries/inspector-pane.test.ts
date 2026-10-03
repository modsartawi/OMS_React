/**
 * The Delivery inspector's pane (ticket 397, spec 380 L15–L16; ruling 367 §4): its width, what
 * is remembered of it, and the one current row J/K step.
 */
import { describe, expect, it } from 'vitest'
import {
  clampInspectorWidth,
  INSPECTOR_WIDTH,
  maxInspectorWidth,
  nextRowIndex,
  parseInspectorPrefs,
  separatorKeyWidth,
  serializeInspectorPrefs,
} from './inspector-pane'

const WIDE = 1600

describe('inspectorWidthClampsAndParses', () => {
  it('opens at 360 by default', () => {
    expect(INSPECTOR_WIDTH.default).toBe(360)
    expect(parseInspectorPrefs(null)).toEqual({ width: 360, open: true })
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

  it('round-trips width and open/closed', () => {
    expect(parseInspectorPrefs(serializeInspectorPrefs({ width: 448, open: false }))).toEqual({
      width: 448,
      open: false,
    })
  })

  it('a stored width outside 320–560 is brought back inside it', () => {
    expect(parseInspectorPrefs(JSON.stringify({ width: 9999, open: true }))).toEqual({ width: 560, open: true })
    expect(parseInspectorPrefs(JSON.stringify({ width: 12, open: false }))).toEqual({ width: 320, open: false })
  })

  it('a malformed stored value reads as the default, open', () => {
    for (const raw of [
      '',
      'not json',
      '360',
      'null',
      '[]',
      '"wide"',
      JSON.stringify({ width: 'wide', open: 'yes' }),
      JSON.stringify({ width: Number.NaN }),
      JSON.stringify({}),
    ]) {
      expect(parseInspectorPrefs(raw)).toEqual({ width: 360, open: true })
    }
  })

  it('keeps the sound half of a half-malformed value', () => {
    expect(parseInspectorPrefs(JSON.stringify({ width: 400, open: 'yes' }))).toEqual({ width: 400, open: true })
    expect(parseInspectorPrefs(JSON.stringify({ width: null, open: false }))).toEqual({ width: 360, open: false })
  })
})

describe('selectionFollowsFocusRowIndex', () => {
  it('J from nothing selected lands on the first row; K on the last', () => {
    expect(nextRowIndex(null, 1, 5)).toBe(0)
    expect(nextRowIndex(null, -1, 5)).toBe(4)
  })

  it('steps one row at a time', () => {
    expect(nextRowIndex(2, 1, 5)).toBe(3)
    expect(nextRowIndex(2, -1, 5)).toBe(1)
  })

  it('stops at either end rather than wrapping', () => {
    expect(nextRowIndex(4, 1, 5)).toBe(4)
    expect(nextRowIndex(0, -1, 5)).toBe(0)
  })

  it('no displayed rows, no current row', () => {
    expect(nextRowIndex(null, 1, 0)).toBeNull()
    expect(nextRowIndex(3, -1, 0)).toBeNull()
  })

  it('a stale index past the end comes back to the last row', () => {
    expect(nextRowIndex(9, 1, 3)).toBe(2)
    expect(nextRowIndex(9, -1, 3)).toBe(2)
  })
})
