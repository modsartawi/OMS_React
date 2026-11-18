import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import { kbSize, kbText, sharePercent } from './size'

/** One size spelling for every Store database panel (oms 915): the wire carries KB, the tab reads MB / GB. */
describe('a size as the tab draws it', () => {
  it('reads a gigabyte or more in GB, to one decimal', () => {
    expect(kbSize(4194304)).toEqual({ unit: 'gb', n: '4.0' })
    expect(kbSize(3984588)).toEqual({ unit: 'gb', n: '3.8' })
    expect(kbSize(20971520)).toEqual({ unit: 'gb', n: '20.0' })
  })

  it('reads a megabyte or more in whole MB, grouped', () => {
    expect(kbSize(512000)).toEqual({ unit: 'mb', n: '500' })
    expect(kbSize(1047552)).toEqual({ unit: 'mb', n: '1,023' })
  })

  it('reads less than a megabyte in KB', () => {
    expect(kbSize(640)).toEqual({ unit: 'kb', n: '640' })
    expect(kbSize(0)).toEqual({ unit: 'kb', n: '0' })
  })

  it('has nothing to say for no reading', () => {
    expect(kbSize(null)).toBeNull()
    expect(kbSize(undefined)).toBeNull()
  })

  it('reads a share as a percent, to one decimal only when it has one', () => {
    expect(sharePercent(0.95)).toBe('95')
    expect(sharePercent(0.725)).toBe('72.5')
    expect(sharePercent(null)).toBeNull()
  })
})

describe('a size in words', () => {
  // A stand-in for `t`: the key and the figure, so the test sees which unit word was asked for.
  const t = ((key: string, o?: { n?: string }) => `${key}(${o?.n})`) as unknown as TFunction

  it('asks for the unit’s words with the figure in its slot', () => {
    expect(kbText(t, 4194304)).toBe('storeDb.units.gb(4.0)')
    expect(kbText(t, 512000)).toBe('storeDb.units.mb(500)')
    expect(kbText(t, 640)).toBe('storeDb.units.kb(640)')
  })

  it('is blank for no reading', () => {
    expect(kbText(t, null)).toBe('')
    expect(kbText(t, undefined)).toBe('')
  })
})
