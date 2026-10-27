/** Ticket 613 — the Editions leaf of the Insurance rules group, read out of the REAL `MENU`. */
import { describe, expect, it } from 'vitest'
import { MENU, markedLeaf } from './menu-model'
import { deriveCrumb } from './crumb'

describe('the Editions leaf', () => {
  it('sits in the Insurance rules group at /insurance-rules/editions, ungated until 618', () => {
    const group = MENU.find((g) => g.labelKey === 'insurance-rules:menu.group')
    const leaf = group?.items?.find((i) => i.labelKey === 'insurance-rules:menu.editions')
    expect(leaf).toMatchObject({ routerLink: '/insurance-rules/editions' })
    expect(leaf?.access).toBeUndefined()
  })

  it('an edition page lights Editions and puts the edition id in the crumb', () => {
    expect(markedLeaf(MENU, '/insurance-rules/editions/sfda/ED-SFDA-59')?.labelKey).toBe('insurance-rules:menu.editions')
    expect(deriveCrumb(MENU, '/insurance-rules/editions/sfda/ED-SFDA-59', { list: 'sfda', id: 'ED-SFDA-59' })).toMatchObject({
      trail: ['insurance-rules:menu.group', 'insurance-rules:menu.editions'],
    })
  })
})
