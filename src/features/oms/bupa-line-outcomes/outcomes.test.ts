/**
 * Oms 899 — a summary row opens exactly its own detail lines, and the pharmacist's `PICK` act reads as Resolve.
 * The en and ar namespaces mirror each other, and every key the screen builds from data exists in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/bupa-line-outcomes.json'
import ar from '@/locales/ar/bupa-line-outcomes.json'
import { BUPA_OUTCOME_ACTS, BUPA_OUTCOME_KINDS, type BupaOutcomeDetail, type BupaOutcomeSummaryRow } from '@/core/models/bupa-line-outcome'
import { actKey, linesOf, sentKey } from './outcomes'

const item = (materialNumber: string) => ({ materialNumber, sfdaCode: null, nameEn: 'X', nameAr: 'س' })

const summary = (over: Partial<BupaOutcomeSummaryRow>): BupaOutcomeSummaryRow => ({
  kind: 'resolved',
  sent: { materialNumber: null, sfdaCode: null, text: 'Panadol Extra', nameEn: null, nameAr: null },
  dispensed: item('100234'),
  orders: 1,
  lines: 1,
  linesQtyDiffers: 0,
  sentBaseUnits: 1,
  dispensedBaseUnits: 1,
  ...over,
})

let n = 0
const detail = (over: Partial<BupaOutcomeDetail>): BupaOutcomeDetail => ({
  documentNo: `20000005${n++}`,
  bupaReference: 'BUPA-1',
  approvalNo: null,
  placedAt: '2026-11-01T10:00:00',
  storeCode: 'P001',
  lineNumber: 1,
  kind: 'resolved',
  sent: { materialNumber: null, sfdaCode: null, text: 'Panadol Extra', quantity: 1, uom: 'PAK' },
  dispensed: { ...item('100234'), quantity: 1, uom: 'PAK' },
  acts: [],
  ...over,
})

describe('a summary row\'s lines are the details with its kind, sent and dispensed item', () => {
  it('matches kind + sent + dispensed material, and nothing else', () => {
    const row = summary({})
    const mine = [
      detail({}),
      detail({ sent: { materialNumber: null, sfdaCode: null, text: '  panadol EXTRA ', quantity: 2, uom: 'PAK' } }),
    ]
    const others = [
      detail({ kind: 'swapped' }),
      detail({ dispensed: { ...item('999999'), quantity: 1, uom: 'PAK' } }),
      detail({ sent: { materialNumber: null, sfdaCode: null, text: 'Panadol', quantity: 1, uom: 'PAK' } }),
      detail({ sent: { materialNumber: null, sfdaCode: '1234-56', text: 'Panadol Extra', quantity: 1, uom: 'PAK' } }),
    ]
    expect(linesOf(row, [others[0], mine[0], others[1], mine[1], others[2], others[3]])).toEqual(mine)
  })

  it('a sent material wins over its SFDA code and text; an SFDA code wins over text', () => {
    expect(sentKey({ materialNumber: '100234', sfdaCode: '1234-56', text: 'x' })).toBe('m:100234')
    expect(sentKey({ materialNumber: null, sfdaCode: '1234-56', text: 'x' })).toBe('s:1234-56')
    expect(sentKey({ materialNumber: '', sfdaCode: '', text: ' X ' })).toBe('t:x')
  })

  it('a voided or unresolved row (nothing dispensed) opens the lines that dispensed nothing', () => {
    const row = summary({ kind: 'voided', dispensed: null })
    const voided = detail({ kind: 'voided', dispensed: null })
    expect(linesOf(row, [voided, detail({ kind: 'voided' })])).toEqual([voided])
  })
})

describe('PICK reads as Resolve in both languages', () => {
  it('the PICK act reads by its own key, "Resolve" / "حلّ", never "Pick"', () => {
    expect(actKey('PICK')).toBe('act.PICK')
    expect(en.act.PICK).toBe('Resolve')
    expect(ar.act.PICK).toBe('حلّ')
    for (const locale of [en, ar]) expect(JSON.stringify(locale.act)).not.toMatch(/\bPick\b/)
  })

  it('an act the screen does not know reads as its unknown key', () => {
    expect(actKey('SOMETHING')).toBe('act.unknown')
  })
})

/** Every leaf key, dotted. */
function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}
const has = (locale: unknown, key: string) =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], locale) !== undefined

describe('bupa-line-outcomes — en and ar', () => {
  it('mirror each other key for key', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
  })

  it.each([en, ar])('hold every key the screen builds from data', (locale) => {
    const keys = [
      ...BUPA_OUTCOME_KINDS.map((k) => `kind.${k}`),
      ...BUPA_OUTCOME_ACTS.map((a) => actKey(a)),
      'act.unknown',
      ...['incomplete', 'reversed', 'tooLong'].map((p) => `problem.${p}`),
      ...['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint'].map((a) => `access.${a}`),
      'menu.bupaLineOutcomes',
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })
})
