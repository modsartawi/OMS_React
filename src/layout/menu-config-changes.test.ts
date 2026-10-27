/**
 * The Config changes leaf (BackOffice spec 3148, ticket 3152) — in the Admin group just before Document types (whose
 * place before the engine switch 3149 pins), riding the ONE configuration probe key with its View predicate: anyone
 * with OMS access reads the change log, the edit grant is not needed.
 */
import { describe, expect, it } from 'vitest'
import { DOC_TYPE_CONFIG_ACCESS_KEY } from '@/features/admin/doc-type-config/api'
import { MENU, type ShellMenuItem } from './menu-model'
import { resolveMenu, type ProbeState } from './useVisibleMenu'

const admin = MENU.find((g) => g.labelKey === 'ua-admin:menu.admin')!
const leaf = admin.items!.find((i) => i.labelKey === 'doc-type-config:menu.configChanges')!

const probed = (data: unknown): ProbeState => ({ isPending: false, isSuccess: true, data })
const errored: ProbeState = { isPending: false, isSuccess: false, data: undefined }
const labels = (items: ShellMenuItem[]): string[] => items.flatMap((i) => [i.labelKey, ...labels(i.items ?? [])])

describe('the Config changes leaf', () => {
  it('sits in the Admin group, just before Document types', () => {
    const keys = admin.items!.map((i) => i.labelKey)
    expect(keys.indexOf('doc-type-config:menu.configChanges')).toBe(keys.indexOf('doc-type-config:menu.documentTypes') - 1)
    expect(leaf.routerLink).toBe('/admin/config-changes')
  })

  it('rides the ONE configuration probe key', () => {
    expect(leaf.access!.key).toBe(DOC_TYPE_CONFIG_ACCESS_KEY)
  })

  it('shows on OMS access alone, hides without it or on an error', () => {
    const only = { ...leaf, items: undefined }
    expect(labels(resolveMenu([only], [probed({ canViewDocTypeConfig: true, canEditDocTypeConfig: false })]).items)).toEqual([
      'doc-type-config:menu.configChanges',
    ])
    for (const state of [probed({ canViewDocTypeConfig: false, canEditDocTypeConfig: true }), errored, probed({})])
      expect(resolveMenu([only], [state]).items).toEqual([])
  })
})
