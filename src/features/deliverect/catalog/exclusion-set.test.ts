/**
 * Ticket 479 — the platform exclusion editor: the ticked delivery platforms ⇄ the excluded set sent.
 *
 * `PUT Exclusions/{material}` REPLACES the material's set, so an empty list re-enables every
 * platform. Unticked means excluded. 🚩 A key the material is excluded on that the Platforms read
 * does not list (an inactive or retired platform) is KEPT in the set sent: the editor cannot show
 * it as a box, so it must never drop it.
 */
import { describe, expect, it } from 'vitest'
import type { DeliverectPlatform } from '@/core/models/deliverect'
import { exclusionEditor, exclusionSet, sameExclusions } from './exclusion-set'

const platform = (platformKey: string, over: Partial<DeliverectPlatform> = {}): DeliverectPlatform => ({
  platformKey,
  displayName: platformKey[0] + platformKey.slice(1).toLowerCase(),
  channelId: 0,
  creditCustomer: '0001100001',
  active: true,
  ...over,
})

const PLATFORMS = [platform('JAHEZ'), platform('KEETA'), platform('HSD', { active: false, creditCustomer: null })]

describe('exclusionEditor — the boxes from a row', () => {
  it('ticks every listed platform the material is NOT excluded on', () => {
    const editor = exclusionEditor(['KEETA'], PLATFORMS)
    expect(editor.boxes.map((b) => [b.platformKey, b.ticked])).toEqual([
      ['JAHEZ', true],
      ['KEETA', false],
      ['HSD', true],
    ])
    expect(editor.unlisted).toEqual([])
  })

  it('carries each box’s display name and active flag from the read', () => {
    const hsd = exclusionEditor([], PLATFORMS).boxes[2]
    expect(hsd).toEqual({ platformKey: 'HSD', displayName: 'Hsd', active: false, ticked: true })
  })

  it('🚩 a key the read does not list is kept aside as unlisted (shown read-only), never dropped', () => {
    const editor = exclusionEditor(['MRSOOL', 'KEETA', 'OLDAPP'], PLATFORMS)
    expect(editor.unlisted).toEqual(['MRSOOL', 'OLDAPP'])
    expect(editor.boxes.find((b) => b.platformKey === 'KEETA')?.ticked).toBe(false)
  })
})

describe('exclusionSet — the set sent', () => {
  const keys = PLATFORMS.map((p) => p.platformKey)

  it('is every listed platform NOT ticked', () => {
    expect(exclusionSet(keys, ['JAHEZ'], [])).toEqual(['KEETA', 'HSD'])
  })

  it('every box ticked sends [] — the material back on every platform', () => {
    expect(exclusionSet(keys, keys, [])).toEqual([])
  })

  it('no box ticked excludes every listed platform', () => {
    expect(exclusionSet(keys, [], [])).toEqual(['JAHEZ', 'KEETA', 'HSD'])
  })

  it('🚩 keeps the unlisted keys the row carried, whatever is ticked', () => {
    expect(exclusionSet(keys, keys, ['OLDAPP'])).toEqual(['OLDAPP'])
    expect(exclusionSet(keys, ['JAHEZ', 'HSD'], ['OLDAPP'])).toEqual(['KEETA', 'OLDAPP'])
  })

  it('round-trips: the editor read from a row, saved untouched, sends that row’s set', () => {
    for (const excluded of [[], ['KEETA'], ['JAHEZ', 'KEETA', 'HSD'], ['OLDAPP', 'KEETA']]) {
      const editor = exclusionEditor(excluded, PLATFORMS)
      const ticked = editor.boxes.filter((b) => b.ticked).map((b) => b.platformKey)
      expect(sameExclusions(exclusionSet(keys, ticked, editor.unlisted), excluded)).toBe(true)
    }
  })

  it('a ticked key the read does not list is ignored — only listed platforms are boxes', () => {
    expect(exclusionSet(['JAHEZ'], ['JAHEZ', 'GHOST'], [])).toEqual([])
  })

  it('no duplicate, even when a listed key also came as unlisted', () => {
    expect(exclusionSet(['JAHEZ'], [], ['JAHEZ'])).toEqual(['JAHEZ'])
  })
})

describe('sameExclusions', () => {
  it('compares as sets', () => {
    expect(sameExclusions(['A', 'B'], ['B', 'A'])).toBe(true)
    expect(sameExclusions(['A'], ['A', 'B'])).toBe(false)
    expect(sameExclusions([], [])).toBe(true)
  })
})
