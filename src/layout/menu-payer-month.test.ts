/**
 * Oms 896 — the Payer months leaf of the Insurance rules group shows only on its own grant, `InsurancePayerMonth:03`,
 * off the ONE permissions answer (oms 909) — the same predicate the page's gate reads. Read out of the REAL `MENU`
 * through the real `resolveMenu`.
 */
import { describe, expect, it } from 'vitest'
import { permissionsFromQuery, permissionsOf, type Permissions } from '@/core/permissions'
import { MENU, markedLeaf } from './menu-model'
import { resolveMenu } from './useVisibleMenu'

type Item = (typeof MENU)[number]

const leaves = (items: Item[]): Item[] => items.flatMap((i) => (i.items ? leaves(i.items) : [i]))
const visible = (p: Permissions) => leaves(resolveMenu(MENU, p).items).map((l) => l.labelKey)
const holding = (...screens: string[]) => permissionsOf({ screens })

const LEAF = 'insurance-rules:menu.payerMonths'

describe('896 — the Payer months leaf', () => {
  it('sits in the Insurance rules group at /insurance-rules/payer-months', () => {
    const group = MENU.find((g) => g.labelKey === 'insurance-rules:menu.group')!
    expect(leaves([group]).find((l) => l.labelKey === LEAF)).toMatchObject({ routerLink: '/insurance-rules/payer-months' })
    expect(markedLeaf(MENU, '/insurance-rules/payer-months')?.labelKey).toBe(LEAF)
  })

  it('shows on InsurancePayerMonth:03 alone — and nothing else in the whole menu does', () => {
    expect(visible(holding('InsurancePayerMonth:03'))).toEqual([LEAF])
  })

  it('the area grant does not open it (its OWN grant, BackOffice 1628 D36)', () => {
    expect(visible(holding('InsuranceRuleAuthoring:03'))).not.toContain(LEAF)
  })

  it('is hidden without the key, on a near-miss, while pending or on an error', () => {
    for (const p of [
      holding(),
      holding('InsurancePayerMonth:02'),
      permissionsFromQuery({ isPending: true, isError: false, data: undefined }),
      permissionsFromQuery({ isPending: false, isError: true, data: undefined }),
    ])
      expect(visible(p)).toEqual([])
  })
})
