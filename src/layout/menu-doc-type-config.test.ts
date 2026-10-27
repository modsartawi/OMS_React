/**
 * The Document types leaf (BackOffice spec 3148, ticket 3149) — in the Admin group, just before the engine switch
 * (which stays last), riding the ONE configuration probe key with its View predicate.
 *
 * Read out of the **real** `MENU`, never re-declared, so a leaf that lost its probe or drifted off the key fails here.
 */
import { describe, expect, it } from 'vitest'
import { DOC_TYPE_CONFIG_ACCESS_KEY } from '@/features/admin/doc-type-config/api'
import { MENU, type ShellMenuItem } from './menu-model'
import { resolveMenu, type ProbeState } from './useVisibleMenu'

const admin = MENU.find((g) => g.labelKey === 'ua-admin:menu.admin')!
const leaf = admin.items!.find((i) => i.labelKey === 'doc-type-config:menu.documentTypes')!

const probed = (data: unknown): ProbeState => ({ isPending: false, isSuccess: true, data })
const errored: ProbeState = { isPending: false, isSuccess: false, data: undefined }
const pending: ProbeState = { isPending: true, isSuccess: false, data: undefined }
const labels = (items: ShellMenuItem[]): string[] => items.flatMap((i) => [i.labelKey, ...labels(i.items ?? [])])

describe('the Document types leaf', () => {
  it('sits in the Admin group, just before the engine switch', () => {
    const keys = admin.items!.map((i) => i.labelKey)
    expect(keys.at(-1)).toBe('engine-switch:menu.engineSwitch')
    expect(keys.at(-2)).toBe('doc-type-config:menu.documentTypes')
    expect(leaf.routerLink).toBe('/admin/doc-types')
  })

  it('rides the ONE configuration probe key', () => {
    expect(leaf.access!.key).toBe(DOC_TYPE_CONFIG_ACCESS_KEY)
  })

  it('shows on OMS access alone — the edit grant is not needed to read', () => {
    const only = { ...leaf, items: undefined }
    expect(labels(resolveMenu([only], [probed({ canViewDocTypeConfig: true, canEditDocTypeConfig: false })]).items)).toEqual([
      'doc-type-config:menu.documentTypes',
    ])
  })

  it('🚩 hides without OMS access, on an error, a malformed answer or while pending', () => {
    const only = { ...leaf, items: undefined }
    for (const state of [probed({ canViewDocTypeConfig: false, canEditDocTypeConfig: true }), errored, probed({}), probed({ canViewDocTypeConfig: 'true' }), pending])
      expect(resolveMenu([only], [state]).items).toEqual([])
  })
})
