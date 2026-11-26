/**
 * Ticket 965 (BackOffice spec 4354 stories 37 and 91, §19): the two tabs' words. Every key of the `why` and `used`
 * sections has its Arabic, and no sentence says "fault", "performance", "rating" or "out of stock".
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/sourcing-simulator.json'
import ar from '@/locales/ar/sourcing-simulator.json'

/** Every leaf of a locale section, by dotted key. */
const leaves = (node: unknown, at = ''): [string, string][] =>
  node && typeof node === 'object'
    ? Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => leaves(v, at ? `${at}.${k}` : k))
    : [[at, String(node)]]

const ARABIC = /[؀-ۿ]/
const SECTIONS = ['why', 'used'] as const

describe('the words of "why this plan" and "what the run used"', () => {
  it.each(SECTIONS)('every %s key has Arabic text', (section) => {
    const english = leaves((en as Record<string, unknown>)[section], section)
    const arabic = new Map(leaves((ar as Record<string, unknown>)[section], section))
    expect(english.length).toBeGreaterThan(0)
    // Hybris is a product name and reads the same in both languages.
    const missing = english.filter(([k]) => !ARABIC.test(arabic.get(k) ?? '') && k !== 'why.source.HYBRIS').map(([k]) => k)
    expect(missing).toEqual([])
  })

  it.each(SECTIONS)('no %s sentence says "fault", "performance", "rating" or "out of stock"', (section) => {
    const said = leaves((en as Record<string, unknown>)[section], section).filter(([, v]) => /\b(fault|performance|rating)\b|out of stock/i.test(v))
    expect(said).toEqual([])
  })

  it('the short-figure sentence carries the line’s own chance', () => {
    expect(en.why.shortFigure.sentence).toContain('About {{n}} in 100 such lines are not handed over at this store')
    expect(ar.why.shortFigure.sentence).toContain('{{n}}')
  })
})
