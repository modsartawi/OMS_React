/**
 * Ticket 670 — a sent promotion is edited in place: the name, stores, start and end are its
 * HungerStation identity (changing them is a Replace, 671); the chain and type are fixed; every other
 * field is edited and re-sent. Nothing is edited while any part is Sending (spec 3201: any write).
 */
import { describe, expect, it } from 'vitest'
import { editMode, identityLocked, lockOf } from './promotion-edit'

const part = (latestJobStatus: 'QUEUED' | 'COMPLETED' | null, unanswered = false) => ({ latestJobStatus, unanswered })

describe('identityLocked — name/stores/start/end locked once sent, everything else editable', () => {
  it('locks nothing on a draft', () => {
    for (const f of ['name', 'stores', 'window', 'chainKey', 'type', 'displayNameEn', 'items'] as const) expect(identityLocked('draft', f)).toBe(false)
  })

  it('locks the name, the stores and the window of a live promotion', () => {
    expect(identityLocked('live', 'name')).toBe(true)
    expect(identityLocked('live', 'stores')).toBe(true)
    expect(identityLocked('live', 'window')).toBe(true)
  })

  it('leaves the display names, reason, limits, defaults and items editable once sent', () => {
    for (const f of ['displayNameEn', 'displayNameAr', 'hsReason', 'orderLimit', 'globalLimit', 'defaultSubtype', 'defaultValue', 'defaultBuy', 'defaultGet', 'items'] as const) {
      expect(identityLocked('livePartlyRefused', f)).toBe(false)
      expect(lockOf('scheduled', f)).toBe(null)
    }
  })

  it('says which lock: the identity points to Replace, the chain and type are fixed', () => {
    expect(lockOf('failed', 'name')).toBe('replace')
    expect(lockOf('failed', 'chainKey')).toBe('fixed')
    expect(lockOf('failed', 'type')).toBe('fixed')
    expect(identityLocked('failed', 'type')).toBe(false)
  })
})

describe('editMode', () => {
  it('a draft is a draft', () => {
    expect(editMode({ status: 'draft', parts: [] })).toBe('draft')
  })

  it('a live, partly refused, failed or scheduled promotion is edited in place', () => {
    for (const status of ['live', 'livePartlyRefused', 'failed', 'scheduled']) expect(editMode({ status, parts: [part('COMPLETED')] })).toBe('inPlace')
  })

  it('waits while ANY part is Sending, whatever the status reads', () => {
    expect(editMode({ status: 'sending', parts: [] })).toBe('sending')
    expect(editMode({ status: 'live', parts: [part('COMPLETED'), part('QUEUED')] })).toBe('sending')
  })

  it('an unanswered part (queued past 24 hours) does not hold the edit back', () => {
    expect(editMode({ status: 'live', parts: [part('QUEUED', true)] })).toBe('inPlace')
  })

  it('a switched-off, replaced or ended promotion — or a status the contract does not name — is closed', () => {
    for (const status of ['switchedOff', 'replaced', 'ended', 'paused']) expect(editMode({ status, parts: [] })).toBe('closed')
  })
})
