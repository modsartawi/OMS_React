import { describe, expect, it } from 'vitest'
import { ITEM_LIST_LEVELS, ITEM_LIST_STATUSES } from '@/core/models/item-list'
import ar from '@/locales/ar/item-lists.json'
import en from '@/locales/en/item-lists.json'
import { PROBLEM_KINDS } from './preview'

const keys = (o: object, at = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v as object, `${at}${k}.`) : [`${at}${k}`]))

describe('the item-lists bundles: Arabic says everything English says', () => {
  it('both bundles hold the same keys', () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort())
  })
  it('every level, status and problem kind has its words', () => {
    for (const bundle of [en, ar]) {
      for (const l of ITEM_LIST_LEVELS) expect(bundle.level[l]).toBeTruthy()
      for (const s of ITEM_LIST_STATUSES) expect(bundle.status[s]).toBeTruthy()
      for (const k of PROBLEM_KINDS) expect(bundle.preview.kinds[k] && bundle.preview.kindHints[k]).toBeTruthy()
    }
  })
})
