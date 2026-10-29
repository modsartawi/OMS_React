/**
 * Ticket 665 — a HungerStation promotion's status in words, EN and AR (BackOffice spec 3201 §
 * Status), and a status the contract does not name shown as itself, never blank.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/hungerstation-promotions.json'
import ar from '@/locales/ar/hungerstation-promotions.json'
import { PROMOTION_STATUSES, promotionStatusLabel, promotionStatusText } from './promotion-status'

const at = (locale: unknown, key: string) => key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale)
/** A `t` over one locale file, the way i18next resolves a `ns:key`-less key. */
const tOf = (locale: unknown) => ((key: string) => String(at(locale, key) ?? key)) as never

describe('promotionStatusLabel', () => {
  it('names the nine statuses of spec 3201, in their life order', () => {
    expect(PROMOTION_STATUSES).toEqual(['draft', 'sending', 'live', 'livePartlyRefused', 'failed', 'switchedOff', 'replaced', 'scheduled', 'ended'])
  })

  it.each([
    ['draft', 'Draft', 'mute'],
    ['sending', 'Sending', 'go'],
    ['live', 'Live', 'ok'],
    ['livePartlyRefused', 'Live with refusals', 'warn'],
    ['failed', 'Failed', 'bad'],
    ['switchedOff', 'Switched off', 'mute'],
    ['replaced', 'Replaced', 'mute'],
    ['scheduled', 'Scheduled', 'go'],
    ['ended', 'Ended', 'mute'],
  ] as const)('%s → "%s" (%s)', (status, words, sev) => {
    const label = promotionStatusLabel(status)
    expect(label.sev).toBe(sev)
    expect(at(en, label.key!)).toBe(words)
  })

  it('every status has Arabic words, none of them the English ones', () => {
    for (const status of PROMOTION_STATUSES) {
      const words = at(ar, promotionStatusLabel(status).key!)
      expect([status, typeof words]).toEqual([status, 'string'])
      expect([status, words]).not.toEqual([status, at(en, promotionStatusLabel(status).key!)])
      expect(String(words)).toMatch(/[؀-ۿ]/)
    }
  })

  it('🚩 a status the contract does not name is shown as itself, neutral — never blank, never a prototype key', () => {
    expect(promotionStatusLabel('paused')).toEqual({ key: null, sev: 'mute' })
    expect(promotionStatusLabel('constructor')).toEqual({ key: null, sev: 'mute' })
    expect(promotionStatusText(tOf(en), 'paused')).toBe('paused')
    expect(promotionStatusText(tOf(en), 'livePartlyRefused')).toBe('Live with refusals')
    expect(promotionStatusText(tOf(ar), 'live')).toBe(at(ar, 'statuses.live'))
  })

  it('an empty status from a broken answer still reads as something', () => {
    expect(promotionStatusText(tOf(en), '')).toBe('—')
  })
})
