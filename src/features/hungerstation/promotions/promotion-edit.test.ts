/**
 * Ticket 670 (reconciled to the BackOffice 3201 door contract, 2026-10-29) — a sent promotion is
 * edited in place: its name, type, stores, start and end are its HungerStation identity (changing
 * them is DHS-00021, a Replace); the chain is fixed; every other field is edited and re-sent.
 * Nothing is written while the promotion — or any part — reads Sending; a promotion switched off or
 * replaced is closed (even while a failed switch-off makes it read Failed).
 */
import { describe, expect, it } from 'vitest'
import type { HungerStationPromotionStatus } from '@/core/models/hungerstation'
import { editMode, identityLocked, lifecycleClosed, lockOf } from './promotion-edit'

const of = (status: HungerStationPromotionStatus | 'paused', parts: (HungerStationPromotionStatus | null)[] = ['live'], over = {}) =>
  ({ status, parts: parts.map((s) => ({ status: s })), switchedOffAt: null, replacedByPromotionId: null, ...over }) as Parameters<typeof editMode>[0]

describe('identityLocked — name/stores/start/end locked once sent, everything else editable', () => {
  it('locks nothing on a draft', () => {
    for (const f of ['name', 'stores', 'window', 'chainKey', 'type', 'displayNameEn', 'items'] as const) expect(identityLocked('draft', f)).toBe(false)
  })

  it('locks the name, the stores and the window of a live promotion', () => {
    for (const f of ['name', 'stores', 'window'] as const) expect(identityLocked('live', f)).toBe(true)
  })

  it('leaves the display names, reason, limits, defaults and items editable once sent', () => {
    for (const f of ['displayNameEn', 'displayNameAr', 'hsReason', 'orderLimit', 'globalLimit', 'defaultSubtype', 'defaultValue', 'items'] as const) {
      expect(identityLocked('livePartlyRefused', f)).toBe(false)
      expect(lockOf('scheduled', f)).toBe(null)
    }
  })

  it('says which lock: the identity points to Replace, the chain and type are fixed', () => {
    expect(lockOf('failed', 'name')).toBe('replace')
    expect(lockOf('failed', 'chainKey')).toBe('fixed')
    expect(lockOf('failed', 'type')).toBe('fixed')
  })
})

describe('editMode', () => {
  it('a draft is a draft', () => {
    expect(editMode(of('draft', []))).toBe('draft')
  })

  it('a live, partly refused, failed or scheduled promotion is edited in place', () => {
    for (const status of ['live', 'livePartlyRefused', 'failed', 'scheduled'] as const) expect(editMode(of(status))).toBe('inPlace')
  })

  // Review B3: the contract's `sending` is wider than "a part's job is QUEUED" (an IN_PROGRESS job,
  // an open switch-off). The promotion's own status is the lock — never the job status word.
  it('waits while the promotion reads Sending, whatever its parts say — or while ANY part reads Sending', () => {
    expect(editMode(of('sending', ['live']))).toBe('sending')
    expect(editMode(of('sending', []))).toBe('sending')
    expect(editMode(of('live', ['live', 'sending']))).toBe('sending')
  })

  it('a part unanswered for 24 hours reads Failed, not Sending: the edit (a re-send) is open', () => {
    expect(editMode(of('failed', ['failed']))).toBe('inPlace')
  })

  it('a switched-off, replaced or ended promotion — or a status the contract does not name — is closed', () => {
    for (const status of ['switchedOff', 'replaced', 'ended', 'paused'] as const) expect(editMode(of(status))).toBe('closed')
  })

  it('a switched-off promotion whose switch-off job failed reads Failed, and is still closed to edits', () => {
    expect(editMode(of('failed', ['failed'], { switchedOffAt: '2026-10-29T11:00:00' }))).toBe('closed')
    expect(editMode(of('failed', ['failed'], { replacedByPromotionId: 'p-2' }))).toBe('closed')
  })
})

describe('lifecycleClosed', () => {
  it('switched off or replaced, by its stamps — not by the status it reads', () => {
    expect(lifecycleClosed({ switchedOffAt: null, replacedByPromotionId: null })).toBe(false)
    expect(lifecycleClosed({ switchedOffAt: '2026-10-29T11:00:00', replacedByPromotionId: null })).toBe(true)
    expect(lifecycleClosed({ switchedOffAt: null, replacedByPromotionId: 'p-2' })).toBe(true)
  })
})
