/**
 * The Insurance rules nav group (oms 607, BackOffice spec 3126). Read out of the REAL `MENU`. Gated per leaf
 * since oms 852, on the one permissions answer since oms 914 (`menu-access-852.test.ts`).
 */
import { describe, expect, it } from 'vitest'
import { MENU, markedLeaf, type ShellMenuItem } from './menu-model'
import { permissionsFromQuery, permissionsOf } from '@/core/permissions'
import { isGated, resolveMenu } from './useVisibleMenu'
import { deriveCrumb } from './crumb'

const group = MENU.find((g) => g.labelKey === 'insurance-rules:menu.group')
const leaves = (items: ShellMenuItem[]): ShellMenuItem[] => items.flatMap((i) => (i.items ? leaves(i.items) : [i]))

describe('the Insurance rules nav group', () => {
  it('is ONE group of its own, right after Hybris stock (922 put Insurance last, beside it)', () => {
    expect(MENU.filter((g) => g.labelKey === 'insurance-rules:menu.group')).toHaveLength(1)
    expect(MENU.at(-2)).toBe(group)
    expect(MENU.at(-3)?.labelKey).toBe('hybris-stock-stores:menu.hybrisStock')
    expect(MENU.at(-1)?.labelKey).toBe('insurance-patterns:menu.group')
  })

  it('607 ships Guards first, at /insurance-rules/guards', () => {
    expect(leaves([group!])[0]).toMatchObject({ labelKey: 'insurance-rules:menu.guards', routerLink: '/insurance-rules/guards' })
  })

  it('a rule’s page lights Guards and puts the rule id in the crumb', () => {
    expect(markedLeaf(MENU, '/insurance-rules/guards/G-007')?.labelKey).toBe('insurance-rules:menu.guards')
    expect(deriveCrumb(MENU, '/insurance-rules/guards/G-007', { ruleId: 'G-007' })).toEqual({
      trail: ['insurance-rules:menu.group', 'insurance-rules:menu.guards'],
      scope: null,
      record: 'G-007',
    })
  })

  it('614 ships Review and Exceptions, at /insurance-rules/review and /insurance-rules/exceptions', () => {
    const links = leaves([group!]).map((l) => l.routerLink)
    expect(links).toContain('/insurance-rules/review')
    expect(links).toContain('/insurance-rules/exceptions')
    expect(markedLeaf(MENU, '/insurance-rules/exceptions')?.labelKey).toBe('insurance-rules:menu.exceptions')
  })

  it('615 ships Metrics at /insurance-rules/metrics', () => {
    expect(leaves([group!]).find((l) => l.labelKey === 'insurance-rules:menu.metrics')).toMatchObject({ routerLink: '/insurance-rules/metrics' })
    expect(markedLeaf(MENU, '/insurance-rules/metrics')?.labelKey).toBe('insurance-rules:menu.metrics')
  })

  it('609 ships Templates at /insurance-rules/templates', () => {
    expect(leaves([group!]).find((l) => l.labelKey === 'insurance-rules:menu.templates')).toMatchObject({ routerLink: '/insurance-rules/templates' })
    expect(markedLeaf(MENU, '/insurance-rules/templates')?.labelKey).toBe('insurance-rules:menu.templates')
  })

  it('612 ships Simulator at /insurance-rules/simulator', () => {
    expect(leaves([group!]).find((l) => l.labelKey === 'insurance-rules:menu.simulator')).toMatchObject({ routerLink: '/insurance-rules/simulator' })
    expect(markedLeaf(MENU, '/insurance-rules/simulator')?.labelKey).toBe('insurance-rules:menu.simulator')
  })

  it('617 ships Insurers, Categories and Coverage', () => {
    const links = leaves([group!]).map((l) => l.routerLink)
    for (const leaf of ['insurers', 'categories', 'coverage']) {
      expect(links).toContain(`/insurance-rules/${leaf}`)
      expect(markedLeaf(MENU, `/insurance-rules/${leaf}`)?.labelKey).toBe(`insurance-rules:menu.${leaf}`)
    }
  })

  it('852: every leaf is gated (the group is not), and no grant or a pending answer hides the whole group', () => {
    for (const leaf of leaves([group!])) expect(isGated(leaf)).toBe(true)
    expect(isGated(group!)).toBe(false)
    expect(resolveMenu([group!], permissionsOf({ screens: [] })).items).toHaveLength(0)
    expect(resolveMenu([group!], permissionsFromQuery({ isPending: true, isError: false, data: undefined })).items).toHaveLength(0)
  })
})
