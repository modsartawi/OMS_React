import { describe, expect, it } from 'vitest'
import {
  conditionsForTag,
  filterLines,
  lineMatchesTag,
  mintedByTags,
  sourceTagDisplay,
} from './provenance'
import { aCondition, aLine } from './__fixtures__/graph'

describe('anEmptySourceTagRendersAsUnknownNotAsPos', () => {
  it('🔑 renders an empty tag as UNKNOWN — the whole reason the column exists', () => {
    // The ledger's convention defaults an untagged row to `pos`; the API sends
    // `""` verbatim precisely so this screen does not. Substituting here would
    // make a provenance bug indistinguishable from a genuine POS line.
    expect(sourceTagDisplay('')).toEqual({ kind: 'unknown' })
  })

  it('⚠️ and NEVER as `pos` — the substitution has no code path at all', () => {
    const display = sourceTagDisplay('')
    expect(display.kind).toBe('unknown')
    expect(JSON.stringify(display)).not.toContain('pos')
  })

  it('treats whitespace, null and a missing field as unknown too', () => {
    // A field that failed to arrive is no more a POS line than an empty one is.
    expect(sourceTagDisplay('   ')).toEqual({ kind: 'unknown' })
    expect(sourceTagDisplay(null)).toEqual({ kind: 'unknown' })
    expect(sourceTagDisplay(undefined)).toEqual({ kind: 'unknown' })
  })

  it('renders a real tag as its own raw code — never a friendly name instead', () => {
    // A consultant pastes this code into a SAP ticket. Ticket 300 adds the label
    // BESIDE it; nothing ever replaces it.
    expect(sourceTagDisplay('pos')).toEqual({ kind: 'tag', code: 'pos' })
    expect(sourceTagDisplay('hungerstn')).toEqual({ kind: 'tag', code: 'hungerstn' })
  })
})

describe('the minted-by filter bar', () => {
  const posLine = aLine({ itemNumber: 1, sourceTag: 'pos', conditions: [aCondition()] })
  const feeLine = aLine({
    itemNumber: 2,
    sourceTag: 'hungerstn',
    conditions: [aCondition({ conditionType: 'COFF', sourceTag: 'hungerstn' })],
  })
  const untagged = aLine({ itemNumber: 3, sourceTag: '', conditions: [aCondition({ sourceTag: '' })] })
  // The line the filter exists for: a POS line whose DISCOUNT an enricher minted.
  const enriched = aLine({
    itemNumber: 4,
    sourceTag: 'pos',
    conditions: [aCondition(), aCondition({ seq: 2, conditionType: 'DCUS', sourceTag: 'credit-load' })],
  })
  const lines = [posLine, feeLine, untagged, enriched]

  it('offers every tag on the lines AND their conditions, in first-seen order', () => {
    expect(mintedByTags(lines)).toEqual(['pos', 'hungerstn', '', 'credit-load'])
  })

  it('🚩 offers the empty tag as a button of its own — unknown is what you hunt for', () => {
    expect(mintedByTags(lines)).toContain('')
  })

  it('🔑 keeps a line whose CONDITION carries the tag, not just its own', () => {
    // Filtering on the line's own tag alone would hide the commonest question
    // the bar is asked: which lines did this enricher touch?
    expect(lineMatchesTag(enriched, 'credit-load')).toBe(true)
    expect(lineMatchesTag(posLine, 'credit-load')).toBe(false)
    expect(filterLines(lines, 'credit-load')).toEqual([enriched])
  })

  it('filters on the TAG only — there is no filter on the condition source', () => {
    expect(filterLines(lines, 'hungerstn')).toEqual([feeLine])
    expect(filterLines(lines, '')).toEqual([untagged])
  })

  it('no filter is the whole document, untouched', () => {
    expect(filterLines(lines, null)).toEqual(lines)
  })

  it('can legitimately match nothing — the pane says so rather than looking empty', () => {
    expect(filterLines(lines, 'insurance')).toEqual([])
  })

  it('⚠️ trims, so a padded tag is not a SECOND button for the same source', () => {
    // The tag comes off a fixed-width column. Two visually identical buttons —
    // worse, two `unknown` ones — of which only one matches anything would make
    // the bar unusable for exactly the hunt it exists for.
    const padded = aLine({ itemNumber: 9, sourceTag: ' pos ', conditions: [aCondition({ sourceTag: '  ' })] })
    expect(mintedByTags([padded])).toEqual(['pos', ''])
    expect(lineMatchesTag(padded, 'pos')).toBe(true)
    expect(filterLines([padded], 'pos')).toEqual([padded])
    expect(conditionsForTag(padded, '').shown).toHaveLength(1)
  })
})

describe('openingALineShowsItsConditionsAndItemDetailsInPlace', () => {
  // The DOM half — that the expansion opens IN PLACE, inside the line's own
  // table row, and is never a third navigation level — is driven in
  // `tools/idoc-inspector-drive.mjs`. What is pure here is WHAT it shows.
  const line = aLine({
    conditions: [aCondition(), aCondition({ seq: 2, conditionType: 'DCUS', sourceTag: 'credit-load' })],
    itemDetails: [
      { seq: 1, attributeName: 'BATCH', attributeValue: 'B24A917' },
      { seq: 2, attributeName: 'PARTNER', attributeValue: '0000401288' },
    ],
  })

  it('shows every condition of the line when nothing is filtered', () => {
    expect(conditionsForTag(line, null)).toEqual({
      shown: line.conditions,
      total: 2,
      filtered: false,
    })
  })

  it('carries the item details on the same line — never a third level', () => {
    expect(line.itemDetails.map((d) => d.attributeName)).toEqual(['BATCH', 'PARTNER'])
  })

  it('🚩 under a filter shows the matching conditions AND the total, so `1 of 2` is sayable', () => {
    // Without the total a filtered expansion reads as a line that only ever had
    // one condition.
    const filtered = conditionsForTag(line, 'credit-load')
    expect(filtered.shown).toHaveLength(1)
    expect(filtered.total).toBe(2)
    expect(filtered.filtered).toBe(true)
  })

  it('a line surviving on its OWN tag may show no conditions at all under that filter', () => {
    const own = aLine({ sourceTag: 'bonded', conditions: [aCondition({ sourceTag: 'pos' })] })
    expect(lineMatchesTag(own, 'bonded')).toBe(true)
    expect(conditionsForTag(own, 'bonded').shown).toEqual([])
    expect(conditionsForTag(own, 'bonded').total).toBe(1)
  })
})
