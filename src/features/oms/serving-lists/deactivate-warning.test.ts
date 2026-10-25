/**
 * Ticket 570 — before a deactivation the confirm names the COMPETED types pointing at the list (their deliveries
 * stop being competed); a non-competed pointing type is not named, and with none there is no warning.
 */
import { describe, expect, it } from 'vitest'
import { deactivateWarning } from './deactivate-warning'

const pt = (documentType: string, isCompeted: boolean) => ({ documentType, description: `${documentType} type`, isCompeted })

describe('deactivateWarning', () => {
  it('names only the competed pointing types, in the door order', () => {
    expect(deactivateWarning({ pointingTypes: [pt('QC', true), pt('HD', false), pt('QCS', true)] })).toEqual(['QC', 'QCS'])
  })

  it('no warning when no type points at the list', () => {
    expect(deactivateWarning({ pointingTypes: [] })).toBeNull()
  })

  it('no warning when only non-competed types point at it', () => {
    expect(deactivateWarning({ pointingTypes: [pt('HD', false)] })).toBeNull()
  })

  it('a missing pointingTypes reads as none, and only an explicit true is competed', () => {
    expect(deactivateWarning({} as never)).toBeNull()
    expect(deactivateWarning({ pointingTypes: [{ documentType: 'QC', description: '', isCompeted: 'true' as never }] })).toBeNull()
  })
})
