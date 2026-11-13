/**
 * Oms 896 — the Payer months leaf of the Insurance rules group shows only when `InsurancePayerMonthWeb/Access`
 * says yes, and it shares that probe's ONE key with the page's gate. Read out of the REAL `MENU` through the real
 * `resolveMenu`, as `menu-access-852.test.ts` does.
 */
import { describe, expect, it } from 'vitest'
import { MENU, markedLeaf } from './menu-model'
import { resolveMenu } from './useVisibleMenu'
import { PAYER_MONTH_ACCESS_KEY, payerMonthAccessQuery } from '@/features/insurance-rules/payer-month/access'

type Item = (typeof MENU)[number]
type State = { isPending: boolean; isSuccess: boolean; data: unknown }

const keyOf = (k: readonly unknown[]) => JSON.stringify(k)
const gated = (items: Item[]): Item[] => items.flatMap((i) => [...(i.access ? [i] : []), ...gated(i.items ?? [])])
const leaves = (items: Item[]): Item[] => items.flatMap((i) => (i.items ? leaves(i.items) : [i]))

const answered = (data: unknown): State => ({ isPending: false, isSuccess: true, data })
const errored: State = { isPending: false, isSuccess: false, data: undefined }
const pending: State = { isPending: true, isSuccess: false, data: undefined }

/** Only the payer-month probe answers; every other probe errors, so only its leaf can show. */
const visible = (state: State) =>
  leaves(resolveMenu(MENU, gated(MENU).map((i) => (keyOf(i.access!.key) === keyOf(PAYER_MONTH_ACCESS_KEY) ? state : errored))).items).map(
    (l) => l.labelKey,
  )

const LEAF = 'insurance-rules:menu.payerMonths'

describe('896 — the Payer months leaf', () => {
  it('sits in the Insurance rules group at /insurance-rules/payer-months', () => {
    const group = MENU.find((g) => g.labelKey === 'insurance-rules:menu.group')!
    expect(leaves([group]).find((l) => l.labelKey === LEAF)).toMatchObject({ routerLink: '/insurance-rules/payer-months' })
    expect(markedLeaf(MENU, '/insurance-rules/payer-months')?.labelKey).toBe(LEAF)
  })

  it('rides the page gate’s own key, so the leaf and the page cost one call', () => {
    const leaf = leaves(MENU).find((l) => l.labelKey === LEAF)!
    expect(keyOf(leaf.access!.key)).toBe(keyOf(payerMonthAccessQuery().queryKey))
  })

  it('shows on canManage: true', () => {
    expect(visible(answered({ canManage: true }))).toEqual([LEAF])
  })

  it('is hidden when the probe says no, is pending, errors or answers a shape nobody agreed to', () => {
    for (const state of [answered({ canManage: false }), answered({ canManage: 'true' }), answered({}), answered(null), pending, errored])
      expect(visible(state)).toEqual([])
  })
})
