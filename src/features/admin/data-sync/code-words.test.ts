import { describe, expect, it } from 'vitest'
import { codeText, codeValue, codeWord, type WordLookup } from './code-words'

/** A stand-in for `t`: knows `mode.Apply` only; honours `defaultValue` like i18next. */
const t: WordLookup = (key, opts) => (key === 'mode.Apply' ? 'Apply' : (opts?.defaultValue ?? key))

const FSI = '⁨'
const PDI = '⁩'

describe('code → word, else the raw code', () => {
  it('gives the word for a code the bundle knows', () => {
    expect(codeWord(t, 'mode', 'Apply')).toBe('Apply')
    expect(codeText(t, 'mode', 'Apply')).toBe('Apply')
    expect(codeValue(t, 'mode', 'Apply')).toBe('Apply')
  })
  it('gives no word for an unknown code, so the caller shows the raw code', () => {
    expect(codeWord(t, 'mode', 'Mirror')).toBeNull()
  })
  it('a grid value falls back to the bare raw code (the grid base isolates its cells; fsi never reaches a cell)', () => {
    expect(codeText(t, 'mode', 'Mirror')).toBe('Mirror')
  })
  it('a string sink (a toast, a t() interpolation) gets the raw code isolated whole with fsi', () => {
    expect(codeValue(t, 'mode', 'Mirror')).toBe(`${FSI}Mirror${PDI}`)
  })
})
