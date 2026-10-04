import { describe, expect, it } from 'vitest'
import { fillsContent } from './shell-route'

describe('fillsContent', () => {
  it('is true when any matched route flags fill', () => {
    expect(fillsContent([undefined, { fill: true }])).toBe(true)
    // A route can carry the palette's flags beside it.
    expect(fillsContent([{ singleKeys: true }, { fill: true, print: false }])).toBe(true)
  })

  it('is false for every other screen, and for handles of any other shape', () => {
    expect(fillsContent([])).toBe(false)
    expect(fillsContent([undefined, null, { singleKeys: true }, { print: true }])).toBe(false)
    for (const handle of ['fill', 1, true, { fill: 'true' }, { fill: 1 }, { fill: false }])
      expect(fillsContent([handle]), JSON.stringify(handle)).toBe(false)
  })
})
