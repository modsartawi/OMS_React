/**
 * Ticket 654 — the IDF grant probe (`GET IdfPriority/Access` → `{ canViewIdf, canEditIdf, canEditGeneral }`, BackOffice
 * 3191). Only an explicit `true` grants, so a missing, errored or malformed answer hides every write (fail closed).
 * The draft's actions follow `canEditIdf`; the general master's and the IDF groups' writes follow `canEditGeneral`.
 */
import { describe, expect, it } from 'vitest'
import { IDF_ACCESS_FLAGS, draftActions, idfGrants } from './access'

const all = (value: boolean) => ({ canViewIdf: value, canEditIdf: value, canEditGeneral: value })

describe('idfGrants', () => {
  it('names exactly the three flags of the door', () => {
    expect([...IDF_ACCESS_FLAGS].sort()).toEqual(['canEditGeneral', 'canEditIdf', 'canViewIdf'])
  })
  it.each([null, undefined])('a %s answer grants nothing', (r) => {
    expect(idfGrants(r)).toEqual(all(false))
  })
  it('a malformed answer grants nothing — an array (an unstubbed drive), a string "true", a 1', () => {
    expect(idfGrants([] as never)).toEqual(all(false))
    expect(idfGrants({ canEditIdf: 'true', canEditGeneral: 1 } as never)).toEqual(all(false))
  })
  it('each flag reads only its own field', () => {
    expect(idfGrants({ canEditGeneral: true })).toEqual({ canViewIdf: false, canEditIdf: false, canEditGeneral: true })
    expect(idfGrants({ canEditIdf: true })).toEqual({ canViewIdf: false, canEditIdf: true, canEditGeneral: false })
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
