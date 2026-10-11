import { describe, expect, it } from 'vitest'
import { IDENTITY_BREAK_KINDS } from '@/core/models/sap-export'
import { IDENTITY_BREAK_PAGE_SIZE, identityBreakErrorKey, identityBreakKey, identityBreakParams } from './identity-break-helpers'
import en from '@/locales/en/sap-export-console.json'

const lookup = (key: string): unknown => key.split('.').reduce<unknown>((node, k) => (node as Record<string, unknown> | undefined)?.[k], en)

describe('identityBreakKey', () => {
  it('gives every contract kind a name and a plain-English meaning in the bundle', () => {
    for (const kind of IDENTITY_BREAK_KINDS) {
      const key = identityBreakKey(kind)
      expect(key).toEqual({ name: `identityBreaks.kinds.${kind}.name`, meaning: `identityBreaks.kinds.${kind}.meaning` })
      expect(lookup(key!.name)).toBeTruthy()
      expect(lookup(key!.meaning)).toBeTruthy()
    }
  })

  it('gives each kind its own meaning', () => {
    const meanings = IDENTITY_BREAK_KINDS.map((k) => lookup(identityBreakKey(k)!.meaning))
    expect(new Set(meanings).size).toBe(IDENTITY_BREAK_KINDS.length)
  })

  it('returns null for a kind this bundle does not know, so the raw kind shows', () => {
    expect(identityBreakKey('orphanPayment')).toBeNull()
    expect(identityBreakKey('toString')).toBeNull()
  })
})

describe('identityBreakParams', () => {
  it('asks for the store, the page and 50 a page', () => {
    expect(identityBreakParams('P014', 2)).toEqual({ code: 'P014', page: 2, pageSize: 50 })
    expect(IDENTITY_BREAK_PAGE_SIZE).toBe(50)
  })

  it('never asks for a page below 1', () => {
    expect(identityBreakParams('P014', 0).page).toBe(1)
  })
})

describe('identityBreakErrorKey', () => {
  it('has its own sentence for BAD_PAGING, and leaves any other code to the envelope', () => {
    expect(identityBreakErrorKey('BAD_PAGING')).toBe('identityBreaks.errors.BAD_PAGING')
    expect(lookup('identityBreaks.errors.BAD_PAGING')).toBeTruthy()
    expect(identityBreakErrorKey('BOOM')).toBeNull()
    expect(identityBreakErrorKey(null)).toBeNull()
  })
})
