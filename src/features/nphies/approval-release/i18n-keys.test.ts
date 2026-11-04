/**
 * Ticket 751 — the `approval-release` namespace ships English and Arabic together, the Arabic file
 * mirrors the English keys exactly, and every key the page BUILDS (a refusal, a withheld reason, a
 * state) exists in both. Prior art: `features/deliverect/catalog/i18n-keys.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/approval-release.json'
import ar from '@/locales/ar/approval-release.json'
import { ApiError } from '@/core/api'
import { RELEASE_REFUSAL_CODES, refusalKey, type ReleaseWithheld } from './release-rules'

/** Every leaf key, dotted. */
function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

const has = (locale: unknown, key: string) =>
  key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale) !==
  undefined

describe('i18n keys exist in EN and AR', () => {
  it('the Arabic file mirrors the English keys exactly', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
  })

  it('no Arabic value is left blank or copied from English', () => {
    const enLeaves = new Map(leaves(en).map((k) => [k, k.split('.').reduce<any>((n, p) => n[p], en)]))
    for (const key of leaves(ar)) {
      const value = key.split('.').reduce<any>((n, p) => n[p], ar) as string
      expect([key, value.trim() === '']).toEqual([key, false])
      // `{{…}}`-only values would legitimately repeat; none exist here, so an identical value is a missed translation.
      expect([key, value === enLeaves.get(key)]).toEqual([key, false])
    }
  })

  it.each([en, ar])('the five ScreenGate sentences', (locale) => {
    for (const key of ['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'])
      expect([key, has(locale, `access.${key}`)]).toEqual([key, true])
  })

  it.each([en, ar])('every refusal sentence the code builds', (locale) => {
    const keys = [
      ...RELEASE_REFUSAL_CODES.map((code) =>
        refusalKey(new ApiError('business', '', 409, [{ errorCode: code, errorMessage: '' } as never])),
      ),
      refusalKey(new ApiError('business', '', 403)),
    ]
    for (const key of keys) expect([key, key !== null && has(locale, key)]).toEqual([key, true])
  })

  it.each([en, ar])('every withheld reason, state and claim type the page builds', (locale) => {
    const withheld: ReleaseWithheld[] = ['dispensed', 'alreadyReleased', 'empty', 'noGrant']
    const keys = [
      ...withheld.map((r) => `act.withheld.${r}`),
      ...['cancelled', 'failed', 'pending', 'complete'].map((s) => `request.${s}`),
      ...['approved', 'partlyApproved', 'rejected', 'noApprovalNeeded'].map((v) => `verdict.${v}`),
      ...['0', '1', '2', '3', '4', '6', 'other'].map((c) => `claimType.${c}`),
      'menu.release',
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })

  it('🚩 copy never says "disable" or "cancel the approval" (spec 3342 Terms: the act is releasing)', () => {
    const words = JSON.stringify(en).toLowerCase()
    expect(words).not.toMatch(/\bdisabl/)
    expect(words).not.toMatch(/cancel (the|its|this) approval number/)
  })
})
