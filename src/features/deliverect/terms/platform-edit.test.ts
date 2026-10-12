import { describe, expect, it } from 'vitest'
import type { DeliverectPlatform } from '@/core/models/deliverect'
import { parsePlatformDraft, platformDraftOf, samePlatform } from './platform-edit'

const JAHEZ: DeliverectPlatform = { platformKey: 'JAHEZ', displayName: 'Jahez', channelId: 0, creditCustomer: '0001100001', active: true }

describe('platformDraftOf — the edit dialog starts from the row', () => {
  it('copies the row; a null credit customer is an empty field', () => {
    expect(platformDraftOf(JAHEZ)).toEqual({ displayName: 'Jahez', channelId: '0', creditCustomer: '0001100001', active: true })
    expect(platformDraftOf({ ...JAHEZ, creditCustomer: null, active: false }).creditCustomer).toBe('')
  })
})

describe('parsePlatformDraft — the PUT body’s fields', () => {
  const draft = platformDraftOf(JAHEZ)

  it('reads the fields exactly as the PUT body carries them (the reason is the dialog’s)', () => {
    expect(parsePlatformDraft(draft)).toEqual({
      value: { displayName: 'Jahez', channelId: 0, creditCustomer: '0001100001', active: true },
      problems: {},
      activeBlocked: false,
    })
  })

  it('trims the text fields', () => {
    expect(parsePlatformDraft({ ...draft, displayName: '  Jahez KSA ', creditCustomer: ' 0001100009 ' }).value).toMatchObject({
      displayName: 'Jahez KSA',
      creditCustomer: '0001100009',
    })
  })

  it('🚩 no credit customer: sent as null, and the platform cannot be active', () => {
    const r = parsePlatformDraft({ ...draft, creditCustomer: '   ', active: true })
    expect(r.activeBlocked).toBe(true)
    expect(r.value).toBeNull()
    expect(r.problems).toEqual({ active: 'noCreditCustomer' })
    expect(parsePlatformDraft({ ...draft, creditCustomer: '', active: false })).toEqual({
      value: { displayName: 'Jahez', channelId: 0, creditCustomer: null, active: false },
      problems: {},
      activeBlocked: true,
    })
  })

  it('the display name is required', () => {
    expect(parsePlatformDraft({ ...draft, displayName: ' ' }).problems).toEqual({ displayName: 'required' })
  })

  it('the channel id is a whole number, zero allowed', () => {
    expect(parsePlatformDraft({ ...draft, channelId: '7' }).value?.channelId).toBe(7)
    for (const bad of ['', '-1', '1.5', 'x', '1e3', '٧', '12345678901234567890'])
      expect([bad, parsePlatformDraft({ ...draft, channelId: bad }).problems]).toEqual([bad, { channelId: 'wholeNumber' }])
  })
})

describe('samePlatform — Save waits for a change', () => {
  it('the row as it was is no change', () => {
    expect(samePlatform(parsePlatformDraft(platformDraftOf(JAHEZ)).value!, JAHEZ)).toBe(true)
  })

  it('any field changed is a change', () => {
    for (const over of [{ displayName: 'Jahez 2' }, { channelId: '3' }, { creditCustomer: '9' }, { active: false }])
      expect(samePlatform(parsePlatformDraft({ ...platformDraftOf(JAHEZ), ...over }).value!, JAHEZ)).toBe(false)
  })
})
