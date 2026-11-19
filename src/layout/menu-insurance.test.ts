/**
 * Oms 922 (BackOffice spec 4050) — the Insurance group's Pattern cases leaf shows only with the analyst grant
 * (`INSURANCE_PATTERN_ANALYST`, guessed key `InsurancePattern:03`), off the ONE permissions answer — the same predicate
 * the page's gate reads. Read out of the REAL `MENU` through the real `resolveMenu`.
 */
import { describe, expect, it } from 'vitest'
import { permissionsFromQuery, permissionsOf, type Permissions } from '@/core/permissions'
import { MENU, markedLeaf } from './menu-model'
import { resolveMenu } from './useVisibleMenu'

type Item = (typeof MENU)[number]

const leaves = (items: Item[]): Item[] => items.flatMap((i) => (i.items ? leaves(i.items) : [i]))
const visible = (p: Permissions) => leaves(resolveMenu(MENU, p).items).map((l) => l.labelKey)
const holding = (...screens: string[]) => permissionsOf({ screens })

const GROUP = 'insurance-patterns:menu.group'
const LEAF = 'insurance-patterns:menu.cases'

describe('922 — the Pattern cases leaf', () => {
  it('sits in its own Insurance group at /insurance/patterns, and stays lit on a case', () => {
    const group = MENU.find((g) => g.labelKey === GROUP)
    expect(group).toBeDefined()
    expect(leaves([group!]).find((l) => l.labelKey === LEAF)).toMatchObject({ routerLink: '/insurance/patterns' })
    expect(markedLeaf(MENU, '/insurance/patterns')?.labelKey).toBe(LEAF)
    expect(markedLeaf(MENU, '/insurance/patterns/01JD3K7Q2W')?.labelKey).toBe(LEAF)
  })

  it('shows on InsurancePattern:03 alone — and nothing else in the whole menu does', () => {
    expect(visible(holding('InsurancePattern:03'))).toEqual([LEAF])
  })

  it('the investigator and manager keys alone do not open it, nor do the insurance-rules grants', () => {
    expect(visible(holding('InsurancePattern:06', 'InsurancePattern:02', 'InsurancePatientBlock:02'))).not.toContain(LEAF)
    expect(visible(holding('InsuranceRuleAuthoring:03', 'InsurancePatientBlock:03', 'InsurancePayerMonth:03'))).not.toContain(LEAF)
  })

  it('is hidden — and its group with it — without the key, while pending or on an error', () => {
    for (const p of [
      holding(),
      permissionsFromQuery({ isPending: true, isError: false, data: undefined }),
      permissionsFromQuery({ isPending: false, isError: true, data: undefined }),
    ]) {
      expect(visible(p)).toEqual([])
      expect(resolveMenu(MENU, p).items.map((g) => g.labelKey)).not.toContain(GROUP)
    }
  })
})
