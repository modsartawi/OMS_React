/**
 * The Insurance rules nav group (oms 607, BackOffice spec 3126). Read out of the REAL `MENU`. UNGATED until
 * 618 adds the probes: a leaf that grows one before then fails here.
 */
import { describe, expect, it } from 'vitest'
import { MENU, markedLeaf, type ShellMenuItem } from './menu-model'
import { resolveMenu } from './useVisibleMenu'
import { deriveCrumb } from './crumb'

const group = MENU.find((g) => g.labelKey === 'insurance-rules:menu.group')
const leaves = (items: ShellMenuItem[]): ShellMenuItem[] => items.flatMap((i) => (i.items ? leaves(i.items) : [i]))

describe('the Insurance rules nav group', () => {
  it('is ONE group of its own, the LAST, right after HungerStation', () => {
    expect(MENU.filter((g) => g.labelKey === 'insurance-rules:menu.group')).toHaveLength(1)
    expect(MENU.at(-1)).toBe(group)
    expect(MENU.at(-2)?.labelKey).toBe('hungerstation-stores:menu.hungerstation')
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

  it('612 ships Simulator at /insurance-rules/simulator', () => {
    expect(leaves([group!]).find((l) => l.labelKey === 'insurance-rules:menu.simulator')).toMatchObject({ routerLink: '/insurance-rules/simulator' })
    expect(markedLeaf(MENU, '/insurance-rules/simulator')?.labelKey).toBe('insurance-rules:menu.simulator')
  })

  it('🚩 no leaf carries a probe until 618 — the group shows for every user', () => {
    for (const leaf of leaves([group!])) expect(leaf.access).toBeUndefined()
    expect(group!.access).toBeUndefined()
    expect(resolveMenu([group!], []).items).toHaveLength(1)
  })
})
