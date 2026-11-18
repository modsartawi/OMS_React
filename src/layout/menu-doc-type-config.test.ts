/**
 * The Document types leaf (BackOffice spec 3148, ticket 3149) — in the Admin group, just before the engine switch
 * (which stays last), gated on the View predicate of the document-type configuration (`canViewDocTypeConfig` =
 * `DocumentList:03`) off the ONE permissions answer (oms 909).
 *
 * Read out of the **real** `MENU`, never re-declared, so a leaf that lost its gate or drifted off its key fails here.
 */
import { describe, expect, it } from 'vitest'
import { permissionsFromQuery, permissionsOf } from '@/core/permissions'
import { MENU, type ShellMenuItem } from './menu-model'
import { isGated, resolveMenu } from './useVisibleMenu'

const admin = MENU.find((g) => g.labelKey === 'ua-admin:menu.admin')!
const leaf = admin.items!.find((i) => i.labelKey === 'doc-type-config:menu.documentTypes')!

const holding = (...screens: string[]) => permissionsOf({ screens })
const errored = permissionsFromQuery({ isPending: false, isError: true, data: undefined })
const pending = permissionsFromQuery({ isPending: true, isError: false, data: undefined })
const labels = (items: ShellMenuItem[]): string[] => items.flatMap((i) => [i.labelKey, ...labels(i.items ?? [])])

describe('the Document types leaf', () => {
  it('sits in the Admin group, just before the engine switch', () => {
    const keys = admin.items!.map((i) => i.labelKey)
    expect(keys.at(-1)).toBe('engine-switch:menu.engineSwitch')
    expect(keys.at(-2)).toBe('doc-type-config:menu.documentTypes')
    expect(leaf.routerLink).toBe('/admin/doc-types')
    expect(isGated(leaf)).toBe(true)
  })

  it('shows on OMS access alone — the edit grant is not needed to read', () => {
    const only = { ...leaf, items: undefined }
    expect(labels(resolveMenu([only], holding('DocumentList:03')).items)).toEqual(['doc-type-config:menu.documentTypes'])
    expect(labels(resolveMenu([only], holding('DocumentList:03', 'SdDocTypeConfig:06')).items)).toEqual([
      'doc-type-config:menu.documentTypes',
    ])
  })

  it('🚩 half-grant: the edit key without OMS access (SdDocTypeConfig:06 alone) hides it', () => {
    const only = { ...leaf, items: undefined }
    expect(resolveMenu([only], holding('SdDocTypeConfig:06')).items).toEqual([])
  })

  it('🚩 hides on a near-miss key, an error or while pending', () => {
    const only = { ...leaf, items: undefined }
    for (const p of [holding('DocumentList:02'), holding('DocumentDetails:03'), errored, pending])
      expect(resolveMenu([only], p).items).toEqual([])
  })
})
