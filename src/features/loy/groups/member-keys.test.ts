/**
 * Review fix 6: a member write refetches that group's members, its detail and the lists — never the
 * access probe, and never another group's pages.
 */
import { describe, expect, it } from 'vitest'
import { LOY_GROUPS_ACCESS_KEY } from '@/core/loy-groups/api'
import { memberWriteKeys } from './api'

describe('a member write invalidates only its own group and the lists', () => {
  it("names the group's members, the group's detail and the lists", () => {
    expect(memberWriteKeys('g-5')).toEqual([
      ['loy', 'groups', 'members', 'g-5'],
      ['loy', 'groups', 'one', 'g-5'],
      ['loy', 'groups', 'list'],
    ])
  })
  it('never names the access probe (no key is a prefix of it)', () => {
    const prefixOf = (k: readonly unknown[], of: readonly unknown[]) => k.every((part, i) => part === of[i])
    expect(memberWriteKeys('g-5').some((k) => prefixOf(k, LOY_GROUPS_ACCESS_KEY))).toBe(false)
  })
})
