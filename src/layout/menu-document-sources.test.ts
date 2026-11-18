/**
 * The Document sources leaf (BackOffice spec 3148, ticket 3156) — in the Admin group just before Action types (whose
 * place before Config changes 3155 pins). Gated on the View predicate of the document-type configuration
 * (`canViewDocTypeConfig` = `DocumentList:03`), read off the ONE permissions answer (oms 914).
 */
import { describe, expect, it } from 'vitest'
import { permissionsFromQuery, permissionsOf } from '@/core/permissions'
import { MENU, type ShellMenuItem } from './menu-model'
import { resolveMenu } from './useVisibleMenu'

const admin = MENU.find((g) => g.labelKey === 'ua-admin:menu.admin')!
const leaf = admin.items!.find((i) => i.labelKey === 'doc-type-config:menu.documentSources')!

const holding = (...screens: string[]) => permissionsOf({ screens })
const errored = permissionsFromQuery({ isPending: false, isError: true, data: undefined })
const pending = permissionsFromQuery({ isPending: true, isError: false, data: undefined })
const labels = (items: ShellMenuItem[]): string[] => items.flatMap((i) => [i.labelKey, ...labels(i.items ?? [])])

describe('the Document sources leaf', () => {
  it('sits in the Admin group, just before Action types', () => {
    const keys = admin.items!.map((i) => i.labelKey)
    expect(keys.indexOf('doc-type-config:menu.documentSources')).toBe(keys.indexOf('doc-type-config:menu.actionTypes') - 1)
    expect(leaf.routerLink).toBe('/admin/document-sources')
  })

  it('shows on OMS access (DocumentList:03) alone — the edit grant is not needed to read', () => {
    const only = { ...leaf, items: undefined }
    expect(labels(resolveMenu([only], holding('DocumentList:03')).items)).toEqual(['doc-type-config:menu.documentSources'])
  })

  it('🚩 hides on the edit grant alone (SdDocTypeConfig:06), a near-miss key, an error or while pending', () => {
    const only = { ...leaf, items: undefined }
    for (const p of [holding('SdDocTypeConfig:06'), holding('DocumentList:02'), holding(), errored, pending])
      expect(resolveMenu([only], p).items).toEqual([])
  })
})
