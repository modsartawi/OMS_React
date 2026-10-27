/**
 * The Document sources leaf (BackOffice spec 3148, ticket 3156) — in the Admin group just before Action types (whose
 * place before Config changes 3155 pins), riding the ONE configuration probe key with its View predicate.
 */
import { describe, expect, it } from 'vitest'
import { DOC_TYPE_CONFIG_ACCESS_KEY } from '@/features/admin/doc-type-config/api'
import { MENU, type ShellMenuItem } from './menu-model'
import { resolveMenu, type ProbeState } from './useVisibleMenu'

const admin = MENU.find((g) => g.labelKey === 'ua-admin:menu.admin')!
const leaf = admin.items!.find((i) => i.labelKey === 'doc-type-config:menu.documentSources')!

const probed = (data: unknown): ProbeState => ({ isPending: false, isSuccess: true, data })
const errored: ProbeState = { isPending: false, isSuccess: false, data: undefined }
const labels = (items: ShellMenuItem[]): string[] => items.flatMap((i) => [i.labelKey, ...labels(i.items ?? [])])

describe('the Document sources leaf', () => {
  it('sits in the Admin group, just before Action types', () => {
    const keys = admin.items!.map((i) => i.labelKey)
    expect(keys.indexOf('doc-type-config:menu.documentSources')).toBe(keys.indexOf('doc-type-config:menu.actionTypes') - 1)
    expect(leaf.routerLink).toBe('/admin/document-sources')
  })

  it('rides the ONE configuration probe key', () => {
    expect(leaf.access!.key).toBe(DOC_TYPE_CONFIG_ACCESS_KEY)
  })

  it('shows on OMS access alone, hides without it or on an error', () => {
    const only = { ...leaf, items: undefined }
    expect(labels(resolveMenu([only], [probed({ canViewDocTypeConfig: true, canEditDocTypeConfig: false })]).items)).toEqual([
      'doc-type-config:menu.documentSources',
    ])
    for (const state of [probed({ canViewDocTypeConfig: false, canEditDocTypeConfig: true }), errored, probed({})])
      expect(resolveMenu([only], [state]).items).toEqual([])
  })
})
