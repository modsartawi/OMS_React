/**
 * BackOffice ticket 3899 — the `store-stages` namespace ships English and Arabic together, and the Arabic file mirrors the
 * English keys exactly. Every key the screen builds from data (a stage, a mover, a column) exists in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/store-stages.json'
import ar from '@/locales/ar/store-stages.json'
import { CONFIRMATION_NAMES, GATE_NAMES, MOVERS, STAGE_COLUMN_IDS } from './columns'
import { STAGES } from '@/core/models/store-stage'

/** Every leaf key, dotted. */
function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

const has = (locale: unknown, key: string) =>
  key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale) !== undefined

describe('store-stages — en and ar mirror each other', () => {
  it('the same keys', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
  })
})

describe('store-stages — the keys the code builds exist', () => {
  it.each([en, ar])('every stage, mover, column and access sentence', (locale) => {
    const keys = [
      ...STAGES.map((s) => `stage.${s}`),
      ...MOVERS.map((m) => `mover.${m}`),
      ...STAGE_COLUMN_IDS.map((c) => `column.${c}`),
      ...['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'].map((a) => `access.${a}`),
      'menu.storeStages',
      // Ticket 3898: every release kind the log shows.
      ...['Seeded', 'ByHand', 'Reopened', 'Started', 'Cancelled'].map((k) => `count.kind.${k}`),
      // Ticket 4261: every gate toward Blocking and every confirmation a move to Blocking names.
      ...GATE_NAMES.map((g) => `gate.${g}`),
      ...CONFIRMATION_NAMES.map((c) => `confirm.${c}`),
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })
})
