/**
 * Oms 922 (spec 4050 review) — the pattern screens' words for what the server sends as codes and counts: a count in a
 * sentence is grouped and isolated whole, and a signal or severity the screen does not know reads as "unknown" in the
 * screen's language — never the raw code, never an empty badge (`./wire` keeps an unknown value as sent and promises the
 * screen's own words for it).
 */
import { describe, expect, it } from 'vitest'
import i18n from '@/core/i18n'
import { counted, severityText, signalText, statusText } from './words'

const FSI = '⁨'
const PDI = '⁩'
const en = i18n.getFixedT('en', 'insurance-patterns')
const ar = i18n.getFixedT('ar', 'insurance-patterns')

describe('a count in a sentence', () => {
  it('picks the plural by the number and shows the figure grouped, isolated whole', () => {
    expect(counted(12345)).toEqual({ count: 12345, n: `${FSI}12,345${PDI}` })
    expect(counted(1250000)).toEqual({ count: 1250000, n: `${FSI}1,250,000${PDI}` })
  })

  it('a small count reads as itself', () => {
    expect(counted(7)).toEqual({ count: 7, n: `${FSI}7${PDI}` })
    expect(counted(0)).toEqual({ count: 0, n: `${FSI}0${PDI}` })
  })
})
