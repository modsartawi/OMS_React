import { describe, expect, it } from 'vitest'
import { AUTO_SCROLL, edgeSpeed } from './auto-scroll'

const AREA = { top: 0, bottom: 1000 }
const HELD = AUTO_SCROLL.rampMs

describe('edgeSpeed (846)', () => {
  it('does not scroll outside the bands', () => {
    expect(edgeSpeed(500, AREA, HELD)).toBe(0)
    expect(edgeSpeed(AUTO_SCROLL.band + 1, AREA, HELD)).toBe(0)
    expect(edgeSpeed(1000 - AUTO_SCROLL.band - 1, AREA, HELD)).toBe(0)
  })

  it('scrolls down in the bottom band and up in the top band', () => {
    expect(edgeSpeed(980, AREA, HELD)).toBeGreaterThan(0)
    expect(edgeSpeed(20, AREA, HELD)).toBeLessThan(0)
  })

  it('goes faster the deeper the pointer is, reaching full speed before the edge', () => {
    const shallow = edgeSpeed(1000 - 80, AREA, HELD)
    const deep = edgeSpeed(1000 - 30, AREA, HELD)
    expect(deep).toBeGreaterThan(shallow)
    expect(edgeSpeed(1000 - 10, AREA, HELD)).toBe(AUTO_SCROLL.maxSpeed)
    expect(edgeSpeed(1200, AREA, HELD)).toBe(AUTO_SCROLL.maxSpeed)
  })

  it('ramps up over a hold, so passing through the band barely moves the page', () => {
    const first = edgeSpeed(995, AREA, 0)
    expect(first).toBeLessThan(AUTO_SCROLL.maxSpeed / 4)
    expect(edgeSpeed(995, AREA, HELD / 2)).toBeLessThan(AUTO_SCROLL.maxSpeed)
    expect(edgeSpeed(995, AREA, HELD)).toBe(AUTO_SCROLL.maxSpeed)
  })

  it('narrows the band on a short area', () => {
    expect(edgeSpeed(50, { top: 0, bottom: 200 }, HELD)).toBe(0)
  })
})
