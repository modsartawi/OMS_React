/**
 * Ticket 703 — a drift signal reads in words while its rates and URLs stay machine values, and a badge is found by the
 * field or rule it affects. Expected values are worked by hand from the spec's three signals (3271 D3, D4, D6).
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-rules.json'
import ar from '@/locales/ar/insurance-rules.json'
import { badgesOnField, badgesOnRule, driftBadgesIn, driftItemPath, driftSignalIn, driftSignalType, formatDriftRate, signalReading, type DriftBadge } from './drift'

const at = (locale: unknown, key: string): unknown => key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale)

describe('signalReading', () => {
  it('signalReading_newProfile_namesTheVersionAsAMachineValue', () => {
    expect(signalReading(driftSignalIn({ type: 'newProfile', profile: 'ksa-claim|2.1.0' }))).toEqual({
      words: 'drift.signal.newProfile',
      values: { profile: 'ksa-claim|2.1.0' },
    })
  })

  it('signalReading_newUrl_keepsTheUrlWhole', () => {
    const url = 'http://payer.example/fhir/ext?a=1&b=2'
    expect(signalReading(driftSignalIn({ type: 'newUrl', url }))).toEqual({ words: 'drift.signal.newUrl', values: { url } })
  })

  it('signalReading_answerRateFell_saysFellAndGivesPercents', () => {
    expect(signalReading(driftSignalIn({ type: 'rateFell', measure: 'answer', field: '$line.claimResponse.copay', rate: 0.125, baseline: 0.48 }))).toEqual({
      words: 'drift.signal.answerRateFell',
      values: { field: '$line.claimResponse.copay', rate: '12.5%', baseline: '48%' },
    })
  })

  it('signalReading_unparsedRate_saysRoseNotFell', () => {
    expect(signalReading(driftSignalIn({ type: 'rateFell', measure: 'unparsed', field: '$claim.total', rate: 0.2, baseline: 0.05 }))).toEqual({
      words: 'drift.signal.unparsedRateRose',
      values: { field: '$claim.total', rate: '20%', baseline: '5%' },
    })
  })

  it('signalReading_valuesCarryNoIsolates_theScreenIsolatesThem', () => {
    const { values } = signalReading(driftSignalIn({ type: 'rateFell', measure: 'answer', field: 'x', rate: 0, baseline: 1 }))
    expect(values.rate).toBe('0%')
    expect(values.baseline).toBe('100%')
    expect(Object.values(values).join('')).not.toMatch(/[⁦-⁩]/)
  })

  it('signalReading_anUnheardOrHalfSentSignal_saysSoAndNeverThrows', () => {
    expect(signalReading(driftSignalIn({ type: 'somethingNew' }))).toEqual({ words: 'drift.signal.unknown', values: { code: 'somethingNew' } })
    expect(signalReading(driftSignalIn(null))).toEqual({ words: 'drift.signal.unknown', values: { code: '' } })
    expect(signalReading(driftSignalIn({ type: 'newUrl' }))).toEqual({ words: 'drift.signal.unknown', values: { code: 'newUrl' } })
    expect(signalReading(driftSignalIn({ type: 'rateFell', measure: 'answer', field: 'x', rate: null, baseline: 0.5 }))).toEqual({ words: 'drift.signal.unknown', values: { code: 'rateFell' } })
  })

  it('every reading has words in both languages, with a slot for each of its values', () => {
    const signals = [
      { type: 'newProfile', profile: 'p' },
      { type: 'newUrl', url: 'u' },
      { type: 'rateFell', measure: 'answer', field: 'f', rate: 0.1, baseline: 0.4 },
      { type: 'rateFell', measure: 'unparsed', field: 'f', rate: 0.4, baseline: 0.1 },
      { type: 'other' },
    ]
    for (const s of signals) {
      const { words, values } = signalReading(driftSignalIn(s))
      for (const locale of [en, ar]) {
        const text = at(locale, words) as string
        expect(typeof text, words).toBe('string')
        for (const name of Object.keys(values)) expect(text, `${words} ${name}`).toContain(`<v>{{${name}}}</v>`)
      }
    }
  })

  it('every signal type has a word for the badge hint in both languages', () => {
    for (const type of ['newProfile', 'newUrl', 'rateFell', 'whoKnows']) {
      for (const locale of [en, ar]) expect(typeof at(locale, `drift.type.${driftSignalType(type)}`)).toBe('string')
    }
    expect(driftSignalType('whoKnows')).toBe('unknown')
  })
})

describe('formatDriftRate', () => {
  it('formatDriftRate_roundsToOneDecimal', () => {
    expect(formatDriftRate(0.29)).toBe('29%')
    expect(formatDriftRate(0.1234)).toBe('12.3%')
  })
})

describe('badges', () => {
  const badge = (o: Partial<DriftBadge>): DriftBadge => ({ itemId: 'D-1', payer: 'bupa', signal: 'newUrl', fields: [], rules: [], ...o })

  it('badgesOnField_findsEveryOpenItemThatAffectsTheKey', () => {
    const a = badge({ itemId: 'D-1', fields: ['$claim.total'] })
    const b = badge({ itemId: 'D-2', fields: ['$claim.total', '$claim.diagnoses'] })
    const c = badge({ itemId: 'D-3', fields: ['$claim.diagnoses'] })
    expect(badgesOnField([a, b, c], '$claim.total').map((x) => x.itemId)).toEqual(['D-1', 'D-2'])
    expect(badgesOnField([a, b, c], '$claim.hasAttachment')).toEqual([])
  })

  it('badgesOnRule_findsByRuleId', () => {
    const a = badge({ rules: ['G-001'] })
    expect(badgesOnRule([a], 'G-001')).toEqual([a])
    expect(badgesOnRule([a], 'G-002')).toEqual([])
  })

  it('driftBadgesIn_fillsWhatTheDoorLeftOut', () => {
    expect(driftBadgesIn(null)).toEqual([])
    expect(driftBadgesIn([{ itemId: 'D-1', payer: 'bupa', signal: 'newUrl' }])).toEqual([{ itemId: 'D-1', payer: 'bupa', signal: 'newUrl', fields: [], rules: [] }])
  })

  it('driftItemPath_linksBackToTheItem_escaped', () => {
    expect(driftItemPath('D 1')).toBe('/insurance-rules/review?kind=drift&item=D%201')
  })
})
