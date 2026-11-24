/**
 * BackOffice ticket 4224 (spec 4212) — the Returns group's Parked returns leaf shows only with the view right
 * (`ParkedReturns.View` = `BackOfficeScreen[ParkedReturns, 03]`, BackOffice 4218's seed), off the ONE permissions answer:
 * the same predicate the page's gate reads. Read out of the REAL `MENU` through the real `resolveMenu`.
 */
import { describe, expect, it } from 'vitest'
import { permissionsFromQuery, permissionsOf, type Permissions } from '@/core/permissions'
import { MENU, markedLeaf } from './menu-model'
import { resolveMenu } from './useVisibleMenu'

type Item = (typeof MENU)[number]

const leaves = (items: Item[]): Item[] => items.flatMap((i) => (i.items ? leaves(i.items) : [i]))
const visible = (p: Permissions) => leaves(resolveMenu(MENU, p).items).map((l) => l.labelKey)
const holding = (...screens: string[]) => permissionsOf({ screens })

const GROUP = 'parked-returns:menu.group'
const LEAF = 'parked-returns:menu.parked'
const RULE_LEAF = 'parked-returns:menu.ruleReturns'

describe('4224 — the Returns area', () => {
  it('is its own top-level group, with Parked returns at /returns/parked', () => {
    const group = MENU.find((g) => g.labelKey === GROUP)
    expect(group).toBeDefined()
    expect(leaves([group!]).find((l) => l.labelKey === LEAF)).toMatchObject({ routerLink: '/returns/parked' })
    expect(markedLeaf(MENU, '/returns/parked')?.labelKey).toBe(LEAF)
  })

  it('shows on ParkedReturns:03 alone — and nothing else in the whole menu does', () => {
    expect(visible(holding('ParkedReturns:03'))).toEqual([LEAF, RULE_LEAF])
  })

  it('the settle right alone does not open it (settle is not view)', () => {
    expect(visible(holding('ParkedReturns:06'))).not.toContain(LEAF)
  })

  it('is hidden — and its group with it — without the view right, while pending or on an error', () => {
    for (const p of [
      holding(),
      holding('DocumentList:03', 'OmsCreateReturn:01', 'LocalFulfillmentReturn:03'),
      permissionsFromQuery({ isPending: true, isError: false, data: undefined }),
      permissionsFromQuery({ isPending: false, isError: true, data: undefined }),
    ]) {
      expect(visible(p)).not.toContain(LEAF)
      expect(visible(p)).not.toContain(RULE_LEAF)
      expect(resolveMenu(MENU, p).items.map((g) => g.labelKey)).not.toContain(GROUP)
    }
  })
})

describe('4226 — Parked rule returns, in the Returns area', () => {
  it('is a leaf of the Returns group at /returns/rule-returns', () => {
    const group = MENU.find((g) => g.labelKey === GROUP)
    expect(leaves([group!]).find((l) => l.labelKey === RULE_LEAF)).toMatchObject({ routerLink: '/returns/rule-returns' })
    expect(markedLeaf(MENU, '/returns/rule-returns')?.labelKey).toBe(RULE_LEAF)
  })

  it('shows on the view right; the settle right alone does not open it', () => {
    expect(visible(holding('ParkedReturns:03'))).toContain(RULE_LEAF)
    expect(visible(holding('ParkedReturns:06'))).not.toContain(RULE_LEAF)
  })
})
