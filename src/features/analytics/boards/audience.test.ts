import { describe, expect, it } from 'vitest'
import type { AnalyticsAudience } from '@/core/models/analytics'
import { audienceDraft, audienceOf, audienceSummary, audienceWrite, isNarrowing, readAudience, readCandidates } from './audience'

const role = (key: string, en: string, ar: string, removed = false) => ({ key, label: { en, ar }, removed })
const user = (id: string, name: string, employeeId: string) => ({ id, name, employeeId })
const chosen = (roles: ReturnType<typeof role>[], users: ReturnType<typeof user>[]): AnalyticsAudience => ({ everyone: false, roles, users })

describe('audienceSummary: the chip text, everyone or the roles and users', () => {
  it('everyone reads as everyone, with no names and no count', () => {
    expect(audienceSummary({ everyone: true }, 'en')).toEqual({ everyone: true })
  })

  it('roles come first, then users, each by its words in the language; nothing hidden, so no count', () => {
    const a = chosen([role('DELIVERY_OPS', 'Delivery operations', 'عمليات التوصيل')], [user('nalharbi', 'Noura Alharbi', '10442')])
    expect(audienceSummary(a, 'en')).toEqual({
      everyone: false,
      names: [
        { kind: 'role', key: 'DELIVERY_OPS', text: 'Delivery operations', removed: false },
        { kind: 'user', key: 'nalharbi', text: 'Noura Alharbi', removed: false },
      ],
      count: null,
    })
    expect(audienceSummary(a, 'ar')).toMatchObject({ names: [{ text: 'عمليات التوصيل' }, { text: 'Noura Alharbi' }] })
  })

  it('a role authz deleted is marked removed', () => {
    const a = chosen([role('OLD_ECOM', 'E-commerce (old)', 'التجارة الإلكترونية (قديم)', true)], [])
    expect(audienceSummary(a, 'en')).toMatchObject({ names: [{ key: 'OLD_ECOM', removed: true }] })
  })

  it('past three names, the chip shows three and counts them as n / m through formatCount', () => {
    const a = chosen(
      [role('HQ_SALES', 'HQ Sales', 'مبيعات'), role('FINANCE', 'Finance', 'المالية')],
      [user('nalharbi', 'Noura Alharbi', '10442'), user('kalotaibi', 'Khalid Alotaibi', '10551'), user('sqahtani', 'Sara Alqahtani', '10663')],
    )
    const s = audienceSummary(a, 'en')
    expect(s).toMatchObject({ count: '3 / 5' })
    expect(s.everyone === false && s.names.map((n) => n.key)).toEqual(['HQ_SALES', 'FINANCE', 'nalharbi'])
  })

  it('a role with no words reads as its key, a user with no name as their id', () => {
    const a = chosen([role('HQ_OPS', '', '')], [user('fdosari', '', '')])
    expect(audienceSummary(a, 'en')).toMatchObject({ names: [{ text: 'HQ_OPS' }, { text: 'fdosari' }] })
  })
})

describe('audienceOf: the chip shows on Shared items only', () => {
  it('a Shared item without an audience is v1’s share with everyone', () => {
    expect(audienceOf({ tier: 'shared' })).toEqual({ everyone: true })
  })
  it('a Shared item’s own audience is kept', () => {
    const a = chosen([role('FINANCE', 'Finance', 'المالية')], [])
    expect(audienceOf({ tier: 'shared', audience: a })).toBe(a)
  })
  it('Personal and Certified items carry no chip', () => {
    expect(audienceOf({ tier: 'personal' })).toBeNull()
    expect(audienceOf({ tier: 'certified', audience: { everyone: true } })).toBeNull()
  })
})

describe('the share dialog: a draft, its write, and a curator’s narrowing', () => {
  const everyone = { everyone: true, roles: [], users: [] }
  const some = { everyone: false, roles: ['FINANCE', 'HQ_SALES'], users: ['nalharbi'] }
  it('a draft starts from the audience (keys), and everyone for an item not yet shared', () => {
    expect(audienceDraft(null)).toEqual(everyone)
    expect(audienceDraft(chosen([role('FINANCE', 'Finance', 'المالية')], [user('nalharbi', 'Noura Alharbi', '10442')]))).toEqual({
      everyone: false,
      roles: ['FINANCE'],
      users: ['nalharbi'],
    })
  })
  it('writes everyone, or the role keys and user ids; an empty choice writes nothing', () => {
    expect(audienceWrite(everyone)).toEqual({ everyone: true })
    expect(audienceWrite(some)).toEqual({ roles: ['FINANCE', 'HQ_SALES'], users: ['nalharbi'] })
    expect(audienceWrite({ everyone: false, roles: [], users: [] })).toBeNull()
  })
  it('a curator narrows: everyone to any choice, or a choice to a smaller one', () => {
    expect(isNarrowing(everyone, some)).toBe(true)
    expect(isNarrowing(some, { everyone: false, roles: ['FINANCE'], users: [] })).toBe(true)
  })
  it('… but never widens, keeps it as it is, or empties it (that is Unshare)', () => {
    expect(isNarrowing(some, everyone)).toBe(false)
    expect(isNarrowing(some, { everyone: false, roles: ['FINANCE', 'HQ_SALES', 'HQ_OPS'], users: ['nalharbi'] })).toBe(false)
    expect(isNarrowing(some, { ...some, roles: ['HQ_SALES', 'FINANCE'] })).toBe(false)
    expect(isNarrowing(everyone, everyone)).toBe(false)
    expect(isNarrowing(some, { everyone: false, roles: [], users: [] })).toBe(false)
  })
})

describe('readAudience and readCandidates: the proposed wire, read defensively', () => {
  it('everyone, or resolved roles and users; a bare key reads as itself', () => {
    expect(readAudience({ everyone: true })).toEqual({ everyone: true })
    expect(readAudience({ roles: [{ key: 'OLD', label: 'Old', removed: true }, 'FINANCE'], users: [{ id: 'u1', name: 'N', employeeId: '7' }, 'u2'] })).toEqual({
      everyone: false,
      roles: [
        { key: 'OLD', label: { en: 'Old', ar: 'Old' }, removed: true },
        { key: 'FINANCE', label: { en: '', ar: '' }, removed: false },
      ],
      users: [
        { id: 'u1', name: 'N', employeeId: '7' },
        { id: 'u2', name: '', employeeId: '' },
      ],
    })
  })
  it('an absent audience is undefined; candidates without lists are empty', () => {
    expect(readAudience(undefined)).toBeUndefined()
    expect(readCandidates(null)).toEqual({ roles: [], users: [] })
    expect(readCandidates({ roles: [{ key: 'A', label: { en: 'A', ar: 'أ' } }] }).roles).toEqual([{ key: 'A', label: { en: 'A', ar: 'أ' }, removed: false }])
  })
})

describe('the server’s wire (BackOffice 3408 §B, confirmed live in 835)', () => {
  it('candidates come as one flat list of members, split by kind; a role’s key is its name, its label one string', () => {
    const c = readCandidates([
      { kind: 'role', id: null, name: 'ANALYTICS_HQ', label: 'HQ analysts', removed: false, employeeId: null },
      { kind: 'role', name: 'GONE', label: '', removed: true },
      { kind: 'user', id: '14419', name: 'Mohamed Sartawi', label: null, removed: null, employeeId: '14419' },
      { kind: 'other', id: 'x' },
    ])
    expect(c.roles).toEqual([
      { key: 'ANALYTICS_HQ', label: { en: 'HQ analysts', ar: 'HQ analysts' }, removed: false },
      { key: 'GONE', label: { en: '', ar: '' }, removed: true },
    ])
    expect(c.users).toEqual([{ id: '14419', name: 'Mohamed Sartawi', employeeId: '14419' }])
  })

  it('an item’s audience names its roles the same way', () => {
    expect(readAudience({ everyone: false, roles: [{ kind: 'role', name: 'ANALYTICS_HQ', label: 'HQ analysts', removed: false }], users: [] })).toEqual({
      everyone: false,
      roles: [{ key: 'ANALYTICS_HQ', label: { en: 'HQ analysts', ar: 'HQ analysts' }, removed: false }],
      users: [],
    })
  })
})
