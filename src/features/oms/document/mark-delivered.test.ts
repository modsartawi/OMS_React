import { describe, expect, it } from 'vitest'
import documentEn from '@/locales/en/document.json'
import documentAr from '@/locales/ar/document.json'
import {
  MARK_DELIVERED_NOTE_MAX,
  MARK_DELIVERED_REFUSALS,
  markDeliveredCommit,
  markDeliveredGate,
  reasonLabelKey,
  refusalKeyOf,
  type MarkDeliveredContext,
} from './mark-delivered'

/** A key resolved against one shipped locale file, or `undefined` when it is not there. */
function lookup(locale: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], locale)
}

const AT_REST: MarkDeliveredContext = {
  canMarkDelivered: true,
  documentCategory: 'D',
  deliveryStatus: 'O',
  closeStatus: '',
  busy: false,
}

describe('markDelivered gate (BackOffice 2422)', () => {
  it.each([
    ['without the grant', { canMarkDelivered: false }],
    ['with the grant absent (an older SIS.Api)', { canMarkDelivered: undefined }],
    ['with a malformed grant', { canMarkDelivered: 'yes' as unknown as boolean }],
    ['on an order', { documentCategory: 'O' }],
    ['on a delivery return', { documentCategory: 'T' }],
    ['on an eRx', { documentCategory: 'X' }],
    ['with no category', { documentCategory: null }],
  ])('markDelivered hidden without canMarkDelivered or off category D: %s', (_, patch) => {
    expect(markDeliveredGate({ ...AT_REST, ...patch })).toBeNull()
  })

  it.each(['', ' ', 'D', 'R', 'B', 'L', 'S', 'o'])(
    'markDelivered disabled with reason key on non-O status %j',
    (deliveryStatus) => {
      // Lower-case `o` too: the server compares the code exactly, so the client must not be kinder.
      expect(markDeliveredGate({ ...AT_REST, deliveryStatus })).toEqual({
        disabled: true,
        reasonKey: 'markDelivered.disabled.notOutForDelivery',
      })
    },
  )

  it.each(['R', 'C', 'X'])('markDelivered disabled with reason key on a pending cancellation (%s)', (closeStatus) => {
    expect(markDeliveredGate({ ...AT_REST, closeStatus })).toEqual({
      disabled: true,
      reasonKey: 'markDelivered.disabled.cancellationPending',
    })
  })

  it('names the status before the cancellation, the order the server checks them in', () => {
    expect(markDeliveredGate({ ...AT_REST, deliveryStatus: 'D', closeStatus: 'R' })?.reasonKey).toBe(
      'markDelivered.disabled.notOutForDelivery',
    )
  })

  it.each([null, undefined, '', '  '])('markDelivered enabled on O with blank closeStatus (%j)', (closeStatus) => {
    expect(markDeliveredGate({ ...AT_REST, closeStatus })).toEqual({ disabled: false, reasonKey: null })
  })

  it('is disabled with no reason while the page is busy', () => {
    expect(markDeliveredGate({ ...AT_REST, busy: true })).toEqual({ disabled: true, reasonKey: null })
  })

  it.each(['markDelivered.disabled.notOutForDelivery', 'markDelivered.disabled.cancellationPending'])(
    'ships the disabled reason %s in en and ar',
    (key) => {
      expect(typeof lookup(documentEn, key)).toBe('string')
      expect(typeof lookup(documentAr, key)).toBe('string')
    },
  )
})

describe('markDelivered dialog commit (BackOffice 2422)', () => {
  const at = (reasonCode: string, note = '', pending = false) => markDeliveredCommit({ reasonCode, note, pending })

  it('dialog commit requires a reason, and a note on OTHR', () => {
    expect(at('').canCommit).toBe(false)
    expect(at('  ').canCommit).toBe(false)
    expect(at('CARR').canCommit).toBe(true)
    expect(at('CUST', 'customer phoned').canCommit).toBe(true)

    expect(at('OTHR')).toMatchObject({ canCommit: false, noteRequired: true })
    expect(at('OTHR', '   ')).toMatchObject({ canCommit: false, noteRequired: true })
    expect(at('OTHR', 'left at the gate')).toMatchObject({ canCommit: true, noteRequired: true })
    expect(at('CARR').noteRequired).toBe(false)
  })

  it('holds a note over the server width back, measured trimmed as the server does', () => {
    const atMax = 'x'.repeat(MARK_DELIVERED_NOTE_MAX)
    expect(MARK_DELIVERED_NOTE_MAX).toBe(100)
    expect(at('CARR', `  ${atMax}  `)).toMatchObject({ canCommit: true, noteTooLong: false })
    expect(at('CARR', `${atMax}x`)).toMatchObject({ canCommit: false, noteTooLong: true })
  })

  it('locks the commit while the request is pending', () => {
    expect(at('CARR', '', true).canCommit).toBe(false)
  })
})

describe('markDelivered refusals and reasons (BackOffice 2420, 2421)', () => {
  /** 2420's codes, in the order the server checks them — the contract this client keys on. */
  const CODES_2420 = [
    'SDD-00002',
    'SDD-02151',
    'SDD-02152',
    'SDD-02153',
    'SDD-02090',
    'SDD-02441',
    'SDD-02150',
    'SDD-02154',
    'SDD-02155',
  ]

  it('maps exactly 2420\'s codes', () => {
    expect(Object.keys(MARK_DELIVERED_REFUSALS).sort()).toEqual([...CODES_2420].sort())
  })

  it.each(CODES_2420)('every refusal code from 2420 maps to an i18n key in en and ar: %s', (code) => {
    const key = refusalKeyOf(code)
    expect(key).not.toBeNull()
    expect(typeof lookup(documentEn, key!)).toBe('string')
    expect(typeof lookup(documentAr, key!)).toBe('string')
  })

  it('answers null for a code it does not know, so the server sentence is shown instead', () => {
    expect(refusalKeyOf('SDD-99999')).toBeNull()
    expect(refusalKeyOf(null)).toBeNull()
  })

  it.each(['CARR', 'DAPP', 'CUST', 'OTHR'])('labels the seeded reason %s in en and ar', (code) => {
    expect(typeof lookup(documentEn, reasonLabelKey(code))).toBe('string')
    expect(typeof lookup(documentAr, reasonLabelKey(code))).toBe('string')
  })
})
