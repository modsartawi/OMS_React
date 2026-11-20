/**
 * Oms 924 (BackOffice spec 4050, 4055) — the Insurance group's Pattern settings and Reveal log leaves show only with the
 * manage grant (BackOffice 4055's seed, `InsurancePattern:01`), off the ONE permissions answer — the
 * same predicate each page's gate reads. Read out of the REAL `MENU` through the real `resolveMenu`.
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
const CASES = 'insurance-patterns:menu.cases'
const SETTINGS = 'insurance-patterns:menu.settings'
const REVEALS = 'insurance-patterns:menu.reveals'

describe('924 — the manager’s two leaves', () => {
  it('sit in the Insurance group at /insurance/patterns/settings and /insurance/patterns/reveals', () => {
    const group = MENU.find((g) => g.labelKey === GROUP)
    expect(leaves([group!]).map((l) => [l.labelKey, l.routerLink])).toEqual([
      [CASES, '/insurance/patterns'],
      [SETTINGS, '/insurance/patterns/settings'],
      [REVEALS, '/insurance/patterns/reveals'],
    ])
  })

  it('each lights on its own address, and a case still lights the cases leaf', () => {
    expect(markedLeaf(MENU, '/insurance/patterns/settings')?.labelKey).toBe(SETTINGS)
    expect(markedLeaf(MENU, '/insurance/patterns/reveals')?.labelKey).toBe(REVEALS)
    expect(markedLeaf(MENU, '/insurance/patterns/123')?.labelKey).toBe(CASES)
  })

  it('show on InsurancePattern:01 alone — and nothing else in the whole menu does', () => {
    expect(visible(holding('InsurancePattern:01'))).toEqual([SETTINGS, REVEALS])
  })

  it('view, mark (02), reveal and the blocked-patient list’s grants do not open them', () => {
    const shown = visible(holding('InsurancePattern:03', 'InsurancePattern:02', 'InsurancePattern:06', 'InsurancePatientBlock:02', 'InsurancePatientBlock:03'))
    expect(shown).toContain(CASES)
    expect(shown).not.toContain(SETTINGS)
    expect(shown).not.toContain(REVEALS)
  })

  it('are hidden without the key, while pending or on an error', () => {
    for (const p of [
      holding(),
      permissionsFromQuery({ isPending: true, isError: false, data: undefined }),
      permissionsFromQuery({ isPending: false, isError: true, data: undefined }),
    ])
      expect(visible(p)).toEqual([])
  })
})
