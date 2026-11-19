/**
 * oms 915 — `mini-pos-assignments` ships English and Arabic together, the Arabic mirroring the English keys exactly, and
 * every key the screen builds from data (a form problem, a refusal) and the menu group's labels exist in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/mini-pos-assignments.json'
import ar from '@/locales/ar/mini-pos-assignments.json'
import { hasLocaleKey } from '@/core/test/locale'
import { MINI_POS_ERRORS } from '@/core/models/mini-pos'
import { ApiError } from '@/core/api'
import { refusalKey, type DraftProblem } from './assignments'

const leaves = (node: unknown, prefix = ''): string[] =>
  typeof node !== 'object' || node === null ? [prefix] : Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))

const PROBLEMS: DraftProblem[] = ['promoter', 'store', 'dates', 'past', 'order', 'hours']
const refusalKeys = Object.values(MINI_POS_ERRORS)
  .map((code) => refusalKey(new ApiError('business', 'm', 400, [{ errorCode: code, internalErrorCode: '', errorMessage: 'm' }])))
  .filter((k): k is string => k !== null)

describe('mini-pos-assignments — en and ar', () => {
  it('mirror each other', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
  })

  it.each([en, ar])('hold every key the screen builds', (locale) => {
    const keys = [
      ...PROBLEMS.map((p) => `add.problem.${p}`),
      ...refusalKeys.map((k) => `refusal.${k}`),
      ...['group', 'assignments', 'stores', 'items'].map((m) => `menu.${m}`),
      ...['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'].map((a) => `access.${a}`),
    ]
    expect(refusalKeys.length).toBe(5)
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
})
