import { describe, expect, it } from 'vitest'
import { fillsContent, hidesShell } from './shell-route'

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

describe('hidesShell', () => {
  it('is true when a matched route names its chromeless param and the URL sets it to 1', () => {
    expect(hidesShell([undefined, { chromeless: 'tv' }], '?tv=1&refresh=30s')).toBe(true)
  })

  it('is false when the param is not 1, or the route names none, or another param', () => {
    expect(hidesShell([{ chromeless: 'tv' }], '')).toBe(false)
    expect(hidesShell([{ chromeless: 'tv' }], '?tv=0')).toBe(false)
    expect(hidesShell([{ chromeless: 'tv' }], '?kiosk=1')).toBe(false)
    // Any other screen ignores a `tv=1` typed onto its URL.
    expect(hidesShell([undefined, { fill: true }], '?tv=1')).toBe(false)
    for (const handle of [null, 'tv', { chromeless: 1 }, { chromeless: '' }]) expect(hidesShell([handle], '?tv=1&=1'), JSON.stringify(handle)).toBe(false)
  })
})
