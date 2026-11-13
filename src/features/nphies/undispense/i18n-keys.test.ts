/**
 * Ticket 898 — the `undispense` namespace ships English and Arabic together, the Arabic file mirrors
 * the English keys exactly, and every key the page BUILDS (a refusal, a state, an origin, an outcome)
 * exists in both. Prior art: `../approval-release/i18n-keys.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/undispense.json'
import ar from '@/locales/ar/undispense.json'
import { ApiError } from '@/core/api'
import {
  LIST_REFUSAL_CODES,
  RETRY_REFUSAL_CODES,
  UNDISPENSE_REFUSAL_CODES,
  UNDISPENSE_STATES,
  listRefusalKey,
  originKey,
  retryRefusalKey,
  undispenseRefusalKey,
} from './undispense-rules'

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

const has = (locale: unknown, key: string) =>
  key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale) !== undefined

const coded = (code: string | null, status = 409) =>
  new ApiError('business', '', status, code === null ? [] : [{ errorCode: code, errorMessage: '' } as never])

describe('i18n keys exist in EN and AR', () => {
  it('the Arabic file mirrors the English keys exactly', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
  })

  it('no Arabic value is left blank or copied from English', () => {
    const enLeaves = new Map(leaves(en).map((k) => [k, k.split('.').reduce<any>((n, p) => n[p], en)]))
    for (const key of leaves(ar)) {
      const value = key.split('.').reduce<any>((n, p) => n[p], ar) as string
      expect([key, value.trim() === '']).toEqual([key, false])
      expect([key, value === enLeaves.get(key)]).toEqual([key, false])
    }
  })

  it.each([en, ar])('the five ScreenGate sentences', (locale) => {
    for (const key of ['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'])
      expect([key, has(locale, `access.${key}`)]).toEqual([key, true])
  })

  it.each([en, ar])('every key the page builds', (locale) => {
    const keys = [
      ...UNDISPENSE_REFUSAL_CODES.map((c) => undispenseRefusalKey(coded(c))),
      ...RETRY_REFUSAL_CODES.map((c) => retryRefusalKey(coded(c))),
      ...LIST_REFUSAL_CODES.map((c) => listRefusalKey(coded(c, 400))),
      undispenseRefusalKey(coded(null, 403)),
      ...UNDISPENSE_STATES.map((s) => `state.${s}`),
      ...['return', 'support', 'callcenter'].map((o) => originKey(o)),
      ...['queued', 'alreadyPending', 'alreadyFailed', 'alreadyDone'].flatMap((o) => [
        `manual.outcome.${o}`,
        `manual.outcome.${o}Detail`,
      ]),
      'menu.undispense',
    ]
    for (const key of keys) expect([key, key !== null && has(locale, key)]).toEqual([key, true])
  })
})
