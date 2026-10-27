/**
 * Mobile → groups lookup (oms ticket 634; door BackOffice 3176 `GET LoyGroupWeb/Mobile/{mobile}/Groups`).
 *
 * The typed mobile rides in a PATH segment, so any spelling the user types — a leading `+`, spaces, a
 * slash — must be encoded, never left to cut the path or turn into a query.
 */
import { describe, expect, it } from 'vitest'
import { lookupMobileOf, mobileGroupsPath } from './api'

describe('mobile lookup path encodes the typed mobile', () => {
  it('encodes a leading plus in the path segment', () => {
    expect(mobileGroupsPath('+966501234567')).toBe('LoyGroupWeb/Mobile/%2B966501234567/Groups')
  })

  it('encodes spaces, slashes and query characters, keeping every other character the user typed', () => {
    expect(mobileGroupsPath('050 123 4567')).toBe('LoyGroupWeb/Mobile/050%20123%204567/Groups')
    expect(mobileGroupsPath('050/123?4567#')).toBe('LoyGroupWeb/Mobile/050%2F123%3F4567%23/Groups')
  })

  it('sends the canonical spelling untouched', () => {
    expect(mobileGroupsPath('966501234567')).toBe('LoyGroupWeb/Mobile/966501234567/Groups')
  })
})

describe('the looked-up mobile is read from the URL', () => {
  it('reads ?mobile, trimmed', () => {
    expect(lookupMobileOf(new URLSearchParams('scope=all&mobile=%20%2B966501234567%20'))).toBe('+966501234567')
  })

  it('is empty when the param is absent or blank', () => {
    expect(lookupMobileOf(new URLSearchParams('scope=all'))).toBe('')
    expect(lookupMobileOf(new URLSearchParams('mobile=%20%20'))).toBe('')
  })
})
