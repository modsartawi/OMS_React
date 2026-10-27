/**
 * The create and rename forms' pure half (oms ticket 630, BackOffice spec 3173). The code is
 * upper-cased as typed and checked against `[A-Z0-9_-]{1,20}` before the round trip — the server is
 * still the authority — and a rename never carries a code: the code never changes after create.
 */
import { describe, expect, it } from 'vitest'
import { checkGroupCode, normaliseGroupCode, renameRequest, reseedGroupNames } from './group-form'

describe('group code is upper-cased and checked against the pattern', () => {
  it('upper-cases the code as typed', () => {
    expect(normaliseGroupCode('vip-1')).toBe('VIP-1')
    expect(normaliseGroupCode('ramadan_vip')).toBe('RAMADAN_VIP')
  })

  it('accepts the alphabet, from 1 to 20 characters', () => {
    expect(checkGroupCode('VIP-1')).toBeNull()
    expect(checkGroupCode('A')).toBeNull()
    expect(checkGroupCode('ABCDEFGHIJ_123456789')).toBeNull()
  })

  it('refuses a space, an accented letter and 21 characters, each with its reason key', () => {
    expect(checkGroupCode('VIP 1')).toBe('create.code.badChar')
    expect(checkGroupCode(normaliseGroupCode('café'))).toBe('create.code.badChar')
    expect(checkGroupCode('ABCDEFGHIJ_1234567890')).toBe('create.code.tooLong')
    expect(checkGroupCode('')).toBe('create.code.required')
  })
})

describe('rename request never carries a code', () => {
  it('is { groupId, nameEn, nameAr } only, the Arabic name exactly as typed', () => {
    const form = { code: 'RAMADAN_VIP', nameEn: 'Ramadan VIP', nameAr: ' كبار رمضان ٢٠٢٦ ' }
    expect(renameRequest('g-1', form)).toStrictEqual({
      groupId: 'g-1',
      nameEn: 'Ramadan VIP',
      nameAr: ' كبار رمضان ٢٠٢٦ ',
    })
  })
})

// Review fix 1: a refetch never remounts the page; the name form re-seeds only when it is not dirty.
describe('the name form re-seeds from the server only when it is not dirty', () => {
  const base = { nameEn: 'Ramadan VIP', nameAr: 'كبار رمضان' }
  it('takes the server names when the form still holds the names it was seeded from', () => {
    const server = { nameEn: 'Ramadan VIP 2', nameAr: 'كبار رمضان ٢' }
    expect(reseedGroupNames(base, base, server)).toEqual(server)
  })
  it('keeps names the user typed and has not saved when the server copy moves', () => {
    const typed = { nameEn: 'Typed', nameAr: 'كبار رمضان' }
    expect(reseedGroupNames(typed, base, { nameEn: 'Elsewhere', nameAr: 'x' })).toEqual(typed)
  })
  it('keeps the form when the server names did not change (a member write refetched the group)', () => {
    const typed = { nameEn: 'Typed', nameAr: 'كبار رمضان' }
    expect(reseedGroupNames(typed, base, { ...base })).toEqual(typed)
  })
})
