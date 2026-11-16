import { describe, expect, it } from 'vitest'
import { byteRange } from './basemap-dev-file.mjs'

// Ticket 879: the dev server hands out the base-map file by byte range, as IIS does in production (BackOffice 3634:
// MapLibre's pmtiles protocol reads the file in parts and needs 206 answers).

describe('the dev server answers a byte range of the base-map file', () => {
  it('a closed range is answered with exactly those bytes', () => {
    expect(byteRange('bytes=0-16383', 4712306)).toEqual({ start: 0, end: 16383 })
  })

  it('an open range runs to the end of the file', () => {
    expect(byteRange('bytes=4712300-', 4712306)).toEqual({ start: 4712300, end: 4712305 })
  })

  it('a range past the end is cut at the last byte', () => {
    expect(byteRange('bytes=4712300-9999999', 4712306)).toEqual({ start: 4712300, end: 4712305 })
  })

  it('a suffix range is the last n bytes', () => {
    expect(byteRange('bytes=-6', 4712306)).toEqual({ start: 4712300, end: 4712305 })
  })

  it('no range header means the whole file', () => {
    expect(byteRange(undefined, 4712306)).toBe('whole')
  })

  it('a range starting past the end cannot be answered (416)', () => {
    expect(byteRange('bytes=4712306-', 4712306)).toBe('unsatisfiable')
  })
})
