import { describe, expect, it } from 'vitest'
import { kbSize, sharePercent } from './size'

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
