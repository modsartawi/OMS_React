/**
 * A donor request's codes in words (ticket 672, BackOffice spec 3242): the hook reasons that end a request
 * without a person (`outcomeReason`), and the trail events 3239 adds. One map, read by the donor request grid,
 * its inspector, the Delivery activity spine and the Pick support timeline. Pure.
 */
import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import en from '@/locales/en/donor-words.json'
import ar from '@/locales/ar/donor-words.json'
import { DONOR_EVENT_TYPES, DONOR_HOOK_REASONS, donorEventWord, donorReasonText, donorReasonWord } from './donor-words'

const at = (bundle: unknown, key: string) =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle)

/** A `t` over one locale's bundle, as i18next answers a `donor-words:` key (a missing key renders itself). */
const tIn = (bundle: unknown) =>
  ((key: string) => {
    const [ns, path] = key.split(':')
    const found = ns === 'donor-words' ? at(bundle, path) : undefined
    return typeof found === 'string' ? found : key
  }) as unknown as TFunction

describe('hook reasons', () => {
  it('the closed list is BackOffice’s DonorHookReasons', () => {
    expect(DONOR_HOOK_REASONS).toEqual([
      'DELIVERY_CLOSED',
      'DELIVERY_FORCE_CLOSED',
      'DELIVERY_STORE_CHANGED',
      'HOST_CANCELLED',
      'HOST_STORE_CHANGED',
    ])
  })

  it('every hook reason has words in English and Arabic', () => {
    for (const code of DONOR_HOOK_REASONS) {
      const key = donorReasonWord(code)!.key!.replace('donor-words:', '')
      expect(typeof at(en, key), key).toBe('string')
      expect(typeof at(ar, key), key).toBe('string')
    }
  })

  it('HOST_CANCELLED and HOST_STORE_CHANGED read as the till words them', () => {
    expect(donorReasonText(tIn(en), 'HOST_CANCELLED')).toBe('Order cancelled')
    expect(donorReasonText(tIn(en), 'HOST_STORE_CHANGED')).toBe('Order moved to another store')
    expect(donorReasonText(tIn(ar), 'HOST_CANCELLED')).toBe('تم إلغاء الطلب')
    expect(donorReasonText(tIn(ar), 'HOST_STORE_CHANGED')).toBe('نُقل الطلب إلى فرع آخر')
  })

  it('a code is matched trimmed and case-blind', () => {
    expect(donorReasonText(tIn(en), ' host_cancelled ')).toBe('Order cancelled')
  })

  it('an unknown code renders raw, as today; no code is no words', () => {
    expect(donorReasonWord('OUT_OF_STOCK')).toEqual({ key: null, raw: 'OUT_OF_STOCK' })
    expect(donorReasonText(tIn(en), 'OUT_OF_STOCK')).toBe('OUT_OF_STOCK')
    expect(donorReasonText(tIn(en), '  ')).toBe('')
    expect(donorReasonText(tIn(en), null)).toBe('')
  })
})

describe('trail events', () => {
  it('REKEY and DONOR_CARRIED have words in English and Arabic', () => {
    expect(DONOR_EVENT_TYPES).toEqual(['REKEY', 'DONOR_CARRIED'])
    for (const code of DONOR_EVENT_TYPES) {
      const key = donorEventWord(code)!.key!.replace('donor-words:', '')
      expect(typeof at(en, key), key).toBe('string')
      expect(typeof at(ar, key), key).toBe('string')
    }
    expect(at(en, 'event.REKEY')).toBe('Donor request moved to the session')
  })

  it('any other event type has no words: the code stands alone', () => {
    expect(donorEventWord('RAISE')).toEqual({ key: null, raw: 'RAISE' })
    expect(donorEventWord('')).toBeNull()
  })
})
