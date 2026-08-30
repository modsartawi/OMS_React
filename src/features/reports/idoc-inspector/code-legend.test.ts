import { describe, expect, it } from 'vitest'
import type { IDocInspectorMetadata } from '@/core/models/idoc-inspector'
import {
  conditionTypeMeaning,
  describeCode,
  discTypeCodeDisplay,
  EMPTY_LEGEND,
  indexLegend,
  type CodeVocabulary,
} from './code-legend'
import { aMetadata } from './__fixtures__/graph'

const legend = indexLegend(aMetadata())

describe('everyCodeRendersItsRawValue', () => {
  it('🔑 the label NEVER replaces the code — both come back, code first', () => {
    // A consultant pastes this into a SAP ticket. A screen showing only a
    // friendly name is unusable for the job it exists for, so there is no shape
    // this function can return that carries a label and no code.
    const display = describeCode(legend, 'iDocType', 'AGG')
    expect(display.code).toBe('AGG')
    expect(display.label).toBe('Aggregation')
  })

  it('renders the raw code even when the legend never loaded', () => {
    // In flight, or refused. The codes are what the consultant came for, so an
    // absent legend costs the labels and nothing else.
    expect(describeCode(EMPTY_LEGEND, 'iDocType', 'AGG')).toEqual({
      code: 'AGG',
      label: null,
      blank: null,
    })
  })

  it('trims the fixed-width column padding at both ends of the lookup', () => {
    // These codes come off CHAR columns on the row AND in the legend; a padded
    // one either side would silently lose its label.
    expect(describeCode(legend, 'sourceTag', ' pos ').code).toBe('pos')
    expect(describeCode(legend, 'sourceTag', ' pos ').label).toBe('Pos')
  })
})

describe('aCodeWithNoLabelRendersAlone', () => {
  it('⚠️ invents nothing for a code the legend does not carry', () => {
    // A value persisted before its constant existed, or a vocabulary this build
    // does not know. The honest answer is the code by itself.
    expect(describeCode(legend, 'sourceTag', 'not-a-tag')).toEqual({
      code: 'not-a-tag',
      label: null,
      blank: null,
    })
  })

  it('never echoes the code into the label to fill the gap', () => {
    const display = describeCode(legend, 'billingType', 'ZZZZ')
    expect(display.label).toBeNull()
    expect(display.label).not.toBe(display.code)
  })
})

describe('theThreeMeaningsOfEmptyStringRenderDistinctly', () => {
  it('⚠️ names WHICH meaning applies, per vocabulary — one dash for all three is misinformation', () => {
    // Three vocabularies persist `""` and it means something different in each.
    expect(describeCode(legend, 'sourceTag', '').blank).toBe('sourceTag')
    expect(describeCode(legend, 'conditionSource', '').blank).toBe('conditionSource')
    expect(describeCode(legend, 'errorType', '').blank).toBe('errorType')
  })

  it('and the fourth blank — an unmapped SAP discount type — is NOT one of them', () => {
    // 🔑 `discTypeCode` is derived from a per-billing-type-overridable map, so it
    // is deliberately absent from the legend. An empty one is a DEFECT, and it
    // gets its own reading so it cannot be confused with "no error".
    expect(discTypeCodeDisplay('')).toEqual({ kind: 'unmapped' })
    expect(discTypeCodeDisplay('3301')).toEqual({ kind: 'code', code: '3301' })
    expect(discTypeCodeDisplay(null)).toEqual({ kind: 'unmapped' })
  })

  it('leaves `blank` null in a vocabulary that does not persist an empty value', () => {
    // An empty IDoc type is not a meaning, it is a missing field — and pretending
    // it were one of the three would be the same misinformation the other way.
    expect(describeCode(legend, 'iDocType', '').blank).toBeNull()
    expect(describeCode(legend, 'conditionClass', '').blank).toBeNull()
  })

  it('a non-empty code is never a blank in any vocabulary', () => {
    expect(describeCode(legend, 'sourceTag', 'pos').blank).toBeNull()
    expect(describeCode(legend, 'errorType', 'PRICING').blank).toBeNull()
  })
})

describe('theLegendIsFetchedOncePerSessionAndReused', () => {
  it('🔑 indexes ONE answer into a structure every render site reads', () => {
    // The fetch-once half is the query's (`staleTime: Infinity`, one key). This
    // is the other half: indexing is a pure function of that one answer, so no
    // render site has a reason to ask for its own copy.
    const metadata = aMetadata()
    const index = indexLegend(metadata)
    expect(describeCode(index, 'sourceTag', 'pos').label).toBe('Pos')
    expect(describeCode(index, 'conditionClass', 'B').label).toBe('Prices')
    expect(describeCode(index, 'paymentGroup', '01').label).toBe('Cash')
  })

  it('indexes all nine vocabularies, and the count is the contract', () => {
    // A tenth would mean an open vocabulary smuggled in (condition types) or a
    // derived one (`discTypeCode`) — both of which would be stale by design.
    const vocabularies = Object.keys(aMetadata().legend) as CodeVocabulary[]
    expect(vocabularies).toHaveLength(9)
    const index = indexLegend(aMetadata())
    for (const vocabulary of vocabularies) expect(index.by.has(vocabulary)).toBe(true)
  })

  it('carries the registered workflow set as LEGEND ONLY', () => {
    // ⚠️ The server already decided the verdict (BackOffice 1390). Nothing in this
    // module derives a state from this set, so two consultants reading one
    // transaction can never disagree because their browsers computed it.
    expect(aMetadata().registeredWorkflowTypes).toContain('ZAGG')
  })

  it('degrades to unlabelled codes when the answer is absent or half-shaped', () => {
    expect(indexLegend(null)).toBe(EMPTY_LEGEND)
    expect(indexLegend(undefined)).toBe(EMPTY_LEGEND)
    const partial = { legend: { sourceTag: [{ code: 'pos', name: 'Pos' }] } }
    const index = indexLegend(partial as unknown as IDocInspectorMetadata)
    expect(describeCode(index, 'sourceTag', 'pos').label).toBe('Pos')
    expect(describeCode(index, 'billingType', 'ZAGG').label).toBeNull()
  })
})

describe('conditionTypeDescriptionComesFromTheRowNotTheLegend', () => {
  it('🔑 the ONE code on this screen the legend must never carry', () => {
    // Condition types are open master data — a pricing analyst adds one without a
    // deployment — so a closed legend of them would be stale by design. The
    // description is resolved per row, server-side.
    const index = indexLegend(aMetadata())
    // There is no `conditionType` vocabulary to ask, and that is the assertion.
    expect(Object.keys(aMetadata().legend)).not.toContain('conditionType')
    expect(index.by.has('conditionType' as CodeVocabulary)).toBe(false)
  })

  it('reads the row description, and invents nothing when there is none', () => {
    expect(conditionTypeMeaning('Base price')).toBe('Base price')
    expect(conditionTypeMeaning(null)).toBeNull()
    expect(conditionTypeMeaning('')).toBeNull()
    expect(conditionTypeMeaning('   ')).toBeNull()
  })

  it('⚠️ never falls back to the code as its own description', () => {
    // A code echoed into the meaning column reads as a table that has an answer
    // when it has none.
    expect(conditionTypeMeaning(undefined)).toBeNull()
  })
})
