/**
 * Ticket 505 — every block, palette group, field and choice of the catalogue has words in the
 * `campaign-workspace` bundle, so neither the palette nor a panel ever shows a raw key.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/campaign-workspace.json'
import { CATALOGUE } from '../../../../tools/campaigns-fixtures.mjs'
import { blockLabelKey, fieldLabelKey, groupLabelKey, optionLabelKey, timingNoneKey } from './panel-keys'

const has = (key: string) => typeof key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), en) === 'string'

describe('panel keys', () => {
  it('names every catalogue block and palette group', () => {
    const missing = [
      ...CATALOGUE.blocks.map((b) => blockLabelKey(b.kind, b.type)),
      ...CATALOGUE.groups.map((g) => groupLabelKey(g.key)),
    ].filter((k) => !has(k))
    expect(missing).toEqual([])
  })

  it('labels every field and every choice', () => {
    const missing: string[] = []
    for (const b of CATALOGUE.blocks)
      for (const f of b.fields) {
        if (f.kind === 'says') continue
        if (!has(fieldLabelKey(b.type, f.key, has))) missing.push(`${b.type}.${f.key}`)
        for (const o of f.options ?? []) if (!optionLabelKey(b.type, f.key, o, has)) missing.push(`${b.type}.${f.key}=${o}`)
      }
    expect(missing).toEqual([])
  })

  it('prefers the block’s own label and the panel’s own words', () => {
    expect(fieldLabelKey('tier', 'in', has)).toBe('panel.typeField.tier.in')
    expect(fieldLabelKey('minCount', 'of', has)).toBe('panel.field.of')
    expect(optionLabelKey('discountItems', 'kind', 'percent', has)).toBe('panel.option.discountItems.kind.percent')
    expect(optionLabelKey('tier', 'in', 'G', has)).toBe('sentence.option.tier.in.G')
    expect(optionLabelKey('tier', 'in', 'X', has)).toBeNull()
    expect(timingNoneKey('expires', has)).toBe('panel.timing.expires.none')
    expect(timingNoneKey('other', has)).toBe('panel.timing.none')
  })
})
