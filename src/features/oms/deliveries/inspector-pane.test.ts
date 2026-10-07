/**
 * The Delivery inspector's pane (ticket 397, spec 380 L15–L16; ruling 367 §4): its width, what
 * is remembered of it, and the one current row J/K step.
 */
import { describe, expect, it } from 'vitest'
import { INSPECTOR_WIDTH } from '@/core/ui/inspector-pane'
import { nextRowIndex, parseInspectorPrefs, serializeInspectorPrefs } from './inspector-pane'

describe('inspectorWidthClampsAndParses', () => {
  it('opens at 360 by default', () => {
    expect(INSPECTOR_WIDTH.default).toBe(360)
    expect(parseInspectorPrefs(null)).toEqual({ width: 360, open: true })
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
