/**
 * Ticket 569 — every refusal label the add-stores dialog builds from a code exists in English and Arabic
 * (the en/ar mirror itself is `i18n-keys.test.ts`).
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { SERVING_LIST_ERRORS as E } from '@/core/models/serving-list'
import en from '@/locales/en/serving-lists.json'
import ar from '@/locales/ar/serving-lists.json'
import { addStoresRefusal } from './add-stores-refusal'

const has = (locale: unknown, key: string) =>
  key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale) !== undefined

const refused = (code: string, data: unknown = null) => new ApiError('business', 'x', 400, [{ errorCode: code, errorMessage: 'x', internalErrorCode: '' }], data)

describe('serving-lists — the add-stores refusal labels exist', () => {
  it.each([en, ar])('every code the door refuses a batch add with', (locale) => {
    const errs = [
      refused(E.UnknownList),
      refused(E.UnknownStore, { badStoreCodes: ['X1'] }),
      refused(E.AlreadyMember, { badStoreCodes: ['1001'] }),
      refused(E.StoreCodesRequired),
    ]
    for (const err of errs) {
      const r = addStoresRefusal(err)
      const key = r.kind === 'badCodes' || r.kind === 'refused' ? r.labelKey : null
      expect([key, key !== null && has(locale, key)]).toEqual([key, true])
    }
  })
})
