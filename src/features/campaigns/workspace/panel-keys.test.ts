/**
 * Tickets 505 / 523 — every field and choice of HQ's catalogue blocks has words in the
 * `campaign-workspace` bundle, so a panel never shows a raw key. (Blocks and palette groups are named
 * in HQ's own words, the catalogue's `name`, since 523.)
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/campaign-workspace.json'
import { blockFields } from '@/core/rules/sentence'
import { CATALOGUE } from '../../../../tools/campaigns-fixtures.mjs'
import { fieldLabelKey, optionLabelKey, timingNoneKey } from './panel-keys'

const has = (key: string) => typeof key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), en) === 'string'

describe('panel keys', () => {
  it('labels every field and every choice the panel shows', () => {
    const missing: string[] = []
    for (const b of [...CATALOGUE.conditions, ...CATALOGUE.effects])
      for (const f of blockFields(b)) {
        // EN + AR lines are labelled by their role; a group's conditions are edited in the card.
        if (f.type === 'text' || f.type === 'conditions') continue
        if (!has(fieldLabelKey(b.type, f.name, has))) missing.push(`${b.type}.${f.name}`)
        for (const o of f.values ?? []) if (!optionLabelKey(b.type, f.name, o, has)) missing.push(`${b.type}.${f.name}=${o}`)
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
