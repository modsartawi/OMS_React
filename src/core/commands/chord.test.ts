/**
 * The Ctrl+K chord (ticket 392, spec 380 K4 + K7; ruling 365 §3): matched on the
 * physical key, so it works on an Arabic layout, with Meta counted as Ctrl. When it
 * fires — inert, but still prevented, under a dialog — is `fire-tier.test.ts`'s.
 */
import { describe, expect, it } from 'vitest'
import { isPaletteChord, keyLegend } from './chord'

const press = (over: Partial<Parameters<typeof isPaletteChord>[0]>) => ({
  code: 'KeyK',
  key: 'k',
  ctrlKey: true,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...over,
})

describe('ctrlKMatchesOnCodeNotKey', () => {
  it('accepts Ctrl on the K key', () => {
    expect(isPaletteChord(press({}))).toBe(true)
  })

  // 🚩 365's flag: on an Arabic layout Chrome reports the Arabic character in `key`.
  it('accepts it whatever `key` says — including the Arabic character on that cap', () => {
    expect(isPaletteChord(press({ key: 'ن' }))).toBe(true)
    expect(isPaletteChord(press({ key: 'K' }))).toBe(true)
    expect(isPaletteChord(press({ key: 'Unidentified' }))).toBe(true)
  })

  it('refuses a `k` typed on another physical key (a remapped layout)', () => {
    expect(isPaletteChord(press({ code: 'KeyN', key: 'k' }))).toBe(false)
  })

  it('accepts Meta as Ctrl', () => {
    expect(isPaletteChord(press({ ctrlKey: false, metaKey: true }))).toBe(true)
  })

  it('a bare K, an Alt chord or a Shift chord is not the palette key', () => {
    expect(isPaletteChord(press({ ctrlKey: false }))).toBe(false)
    expect(isPaletteChord(press({ altKey: true }))).toBe(false)
    expect(isPaletteChord(press({ shiftKey: true }))).toBe(false)
  })
})

describe('keyLegend', () => {
  // K17: the Latin legend printed on the cap, derived from the code — data, not copy.
  it('derives the letter from the code', () => {
    expect(keyLegend('KeyK')).toBe('K')
    expect(keyLegend('KeyR')).toBe('R')
  })

  it('draws the arrows as arrows', () => {
    expect(keyLegend('ArrowUp')).toBe('↑')
    expect(keyLegend('ArrowDown')).toBe('↓')
  })
})
