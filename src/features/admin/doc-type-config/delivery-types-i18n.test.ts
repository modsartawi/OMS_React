/**
 * Ticket 3154 — every key the delivery type pages and dialog build exists in English and Arabic: each setting's label
 * (also what the History tab's diff labels a column with), both groups and categories, the courier table, the edit and
 * copy words and every copy blocker, and the courier assignment's change-log kind.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/doc-type-config.json'
import ar from '@/locales/ar/doc-type-config.json'
import { hasLocaleKey as has } from '@/core/test/locale'
import { DELIVERY_ALL_FIELDS, DELIVERY_CATEGORIES, DELIVERY_FIELD_GROUPS, type DeliveryCopyBlocker } from './delivery-type-form'

const BLOCKERS: Exclude<DeliveryCopyBlocker, 'reason'>[] = ['codeRequired', 'codeTooLong', 'codeExists', 'descriptionRequired']

describe('doc-type-config — the delivery type words', () => {
  it.each([en, ar])('exist for every key the code builds', (locale) => {
    const keys = [
      'menu.deliveryTypes',
      'entityTypes.CourierAssignment',
      ...DELIVERY_ALL_FIELDS.map((f) => `fields.${f.field}`),
      'fields.deliveringPlant',
      'fields.courierCode',
      ...DELIVERY_FIELD_GROUPS.map((g) => `deliveryTypes.groups.${g.group}`),
      ...DELIVERY_CATEGORIES.map((c) => `deliveryTypes.categories.${c}`),
      ...['documentType', 'description', 'documentCategory', 'isCompeted'].map((c) => `deliveryTypes.columns.${c}`),
      ...['title', 'hint', 'loading', 'failed', 'empty', 'everyPlant'].map((k) => `deliveryTypes.couriers.${k}`),
      ...['title', 'note', 'saved', 'stale'].map((k) => `deliveryTypes.edit.${k}`),
      ...['title', 'note', 'saved', 'failed'].map((k) => `deliveryTypes.copy.${k}`),
      ...BLOCKERS.map((b) => `deliveryTypes.copy.blockers.${b}`),
      ...['title', 'subtitle', 'loading', 'failed', 'empty', 'back', 'notFoundTitle', 'detailLoading', 'detailFailed'].map(
        (k) => `deliveryTypes.${k}`,
      ),
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })
})
