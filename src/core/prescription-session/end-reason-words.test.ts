/**
 * Ticket 547 — the end reasons' words (abandon + write-off), shared with 548's write-off dialog. Pure.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/prescription-session.json'
import ar from '@/locales/ar/prescription-session.json'
import { ABANDON_REASONS, WRITE_OFF_REASONS, abandonReasonWord, endReasonWord, writeOffReasonWord } from './words'

const at = (bundle: unknown, key: string) =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle)

describe('end reasons', () => {
  it('the closed lists are SIS.Api’s', () => {
    expect(ABANDON_REASONS).toEqual(['INVALID', 'REJECTED', 'PATIENT_WITHDREW', 'DUPLICATE', 'LAPSED'])
    expect(WRITE_OFF_REASONS).toEqual(['PAYER_REFUSED', 'SALE_LOST', 'GOODS_NEVER_LEFT', 'OTHER'])
  })

  it('every reason has words in EN and AR', () => {
    for (const r of ABANDON_REASONS) {
      const key = abandonReasonWord(r).key!
      expect(typeof at(en, key), key).toBe('string')
      expect(typeof at(ar, key), key).toBe('string')
    }
    for (const r of WRITE_OFF_REASONS) {
      const key = writeOffReasonWord(r).key!
      expect(typeof at(en, key), key).toBe('string')
      expect(typeof at(ar, key), key).toBe('string')
    }
    expect(at(en, 'abandonReason.PATIENT_WITHDREW')).toBe('Patient withdrew')
    expect(at(en, 'writeOffReason.GOODS_NEVER_LEFT')).toBe('Goods never left the store')
  })

  it('an ended session reads its reason from its own state’s list', () => {
    expect(endReasonWord('ABANDONED', 'LAPSED')).toEqual({ key: 'abandonReason.LAPSED', raw: 'LAPSED' })
    expect(endReasonWord('WRITTEN_OFF', 'SALE_LOST')).toEqual({ key: 'writeOffReason.SALE_LOST', raw: 'SALE_LOST' })
  })

  it('a state it does not expect still finds a known reason in either list', () => {
    expect(endReasonWord('CLOSED', 'OTHER')).toEqual({ key: 'writeOffReason.OTHER', raw: 'OTHER' })
  })

  it('an unknown reason renders itself; no reason is no word', () => {
    expect(endReasonWord('WRITTEN_OFF', 'BURNT')).toEqual({ key: null, raw: 'BURNT' })
    expect(endReasonWord('CLOSED', null)).toBeNull()
    expect(endReasonWord('ABANDONED', '  ')).toBeNull()
  })
})
