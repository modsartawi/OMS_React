/**
 * oms 915 — `mini-pos-stores` ships English and Arabic together, the Arabic mirroring the English keys exactly, and every
 * key the screen builds from data (a trial role) and both gates' sentences exist in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/mini-pos-stores.json'
import ar from '@/locales/ar/mini-pos-stores.json'
import { hasLocaleKey } from '@/core/test/locale'
import { MINI_POS_TRIAL_ROLES } from '@/core/models/mini-pos'
import { trialRoleKey } from './stores'

const leaves = (node: unknown, prefix = ''): string[] =>
  typeof node !== 'object' || node === null ? [prefix] : Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))

describe('mini-pos-stores — en and ar', () => {
  it('mirror each other', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
  })

  it.each([en, ar])('hold every key the screen builds', (locale) => {
    const gate = ['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint']
    const keys = [
      ...MINI_POS_TRIAL_ROLES.map((r) => `trialRole.${trialRoleKey(r)}`),
      ...gate.map((a) => `access.${a}`),
      ...gate.map((a) => `printAccess.${a}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
})
