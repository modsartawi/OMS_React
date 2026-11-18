/**
 * Ticket 654 — the IDF grants (BackOffice 3191), read off the one permissions answer since oms 909: `IdfPriority:03`
 * view, `:06` master edit, `:07` general edit. A missing or errored answer hides every write (fail closed).
 * The draft's actions follow `canEditIdf`; the general master's and the IDF groups' writes follow `canEditGeneral`.
 */
import { describe, expect, it } from 'vitest'
import { permissionsFromQuery, permissionsOf } from '@/core/permissions'
import { draftActions, idfGrants } from './access'

const all = (value: boolean) => ({ canViewIdf: value, canEditIdf: value, canEditGeneral: value })

const held = (...screens: string[]) => permissionsOf({ screens })

describe('idfGrants', () => {
  it('no answer, a pending one or an errored one grants nothing', () => {
    expect(idfGrants(permissionsOf(null))).toEqual(all(false))
    expect(idfGrants(permissionsFromQuery({ isPending: true, isError: false, data: undefined }))).toEqual(all(false))
    expect(idfGrants(permissionsFromQuery({ isPending: false, isError: true, data: undefined }))).toEqual(all(false))
  })
  it('every IDF command held grants all three', () => {
    expect(idfGrants(held('IdfPriority:03', 'IdfPriority:06', 'IdfPriority:07'))).toEqual(all(true))
  })
  it('each grant reads only its own command', () => {
    expect(idfGrants(held('IdfPriority:07'))).toEqual({ canViewIdf: false, canEditIdf: false, canEditGeneral: true })
    expect(idfGrants(held('IdfPriority:06'))).toEqual({ canViewIdf: false, canEditIdf: true, canEditGeneral: false })
    expect(idfGrants(held('IdfPriority:03'))).toEqual({ canViewIdf: true, canEditIdf: false, canEditGeneral: false })
  })
})

describe('draftActions — which draft controls show', () => {
  it('without the IDF edit grant nothing but the read shows, whatever the state', () => {
    for (const state of ['none', 'mine', 'stale', 'someoneElse'] as const)
      expect([state, draftActions(state, false)]).toEqual([state, { start: false, edit: false, rebase: false, publish: false, discard: false }])
  })
  it('with it: Start on no draft; edits, Publish and Discard on mine; Rebase too on mine and stale', () => {
    expect(draftActions('none', true)).toEqual({ start: true, edit: false, rebase: false, publish: false, discard: false })
    expect(draftActions('mine', true)).toEqual({ start: false, edit: true, rebase: false, publish: true, discard: true })
    expect(draftActions('stale', true)).toEqual({ start: false, edit: true, rebase: true, publish: true, discard: true })
  })
  it("someone else's draft: only Discard", () => {
    expect(draftActions('someoneElse', true)).toEqual({ start: false, edit: false, rebase: false, publish: false, discard: true })
  })
})
