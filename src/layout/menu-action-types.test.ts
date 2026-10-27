/**
 * The Action types leaf (BackOffice spec 3148, ticket 3155) — in the Admin group just before Config changes (whose place
 * before Document types 3152 pins), riding the ONE configuration probe key with its View predicate.
 */
import { describe, expect, it } from 'vitest'
import { DOC_TYPE_CONFIG_ACCESS_KEY } from '@/features/admin/doc-type-config/api'
import { MENU, type ShellMenuItem } from './menu-model'
import { resolveMenu, type ProbeState } from './useVisibleMenu'

const admin = MENU.find((g) => g.labelKey === 'ua-admin:menu.admin')!
const leaf = admin.items!.find((i) => i.labelKey === 'doc-type-config:menu.actionTypes')!

const probed = (data: unknown): ProbeState => ({ isPending: false, isSuccess: true, data })
const errored: ProbeState = { isPending: false, isSuccess: false, data: undefined }
const labels = (items: ShellMenuItem[]): string[] => items.flatMap((i) => [i.labelKey, ...labels(i.items ?? [])])

describe('the Action types leaf', () => {
  it('sits in the Admin group, just before Config changes', () => {
    const keys = admin.items!.map((i) => i.labelKey)
    expect(keys.indexOf('doc-type-config:menu.actionTypes')).toBe(keys.indexOf('doc-type-config:menu.configChanges') - 1)
    expect(leaf.routerLink).toBe('/admin/action-types')
  })

  it('rides the ONE configuration probe key', () => {
    expect(leaf.access!.key).toBe(DOC_TYPE_CONFIG_ACCESS_KEY)
  })

  it('shows on OMS access alone, hides without it or on an error', () => {
    const only = { ...leaf, items: undefined }
    expect(labels(resolveMenu([only], [probed({ canViewDocTypeConfig: true, canEditDocTypeConfig: false })]).items)).toEqual([
      'doc-type-config:menu.actionTypes',
    ])
    for (const state of [probed({ canViewDocTypeConfig: false, canEditDocTypeConfig: true }), errored, probed({})])
      expect(resolveMenu([only], [state]).items).toEqual([])
  })
})
