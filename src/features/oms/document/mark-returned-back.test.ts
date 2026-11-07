import { describe, expect, it } from 'vitest'
import documentEn from '@/locales/en/document.json'
import documentAr from '@/locales/ar/document.json'
import {
  MARK_RETURNED_BACK_NOTE_MAX,
  MARK_RETURNED_BACK_REASONS,
  MARK_RETURNED_BACK_REFUSALS,
  deliveryCorrections,
  markReturnedBackCommit,
  markReturnedBackGate,
  markReturnedBackNotices,
  returnedBackReasonLabelKey,
  returnedBackRefusalKeyOf,
  type MarkReturnedBackContext,
} from './mark-returned-back'

/** A key resolved against one shipped locale file, or `undefined` when it is not there. */
function lookup(locale: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], locale)
}

const AT_REST: MarkReturnedBackContext = {
  canMarkReturnedBack: true,
  documentCategory: 'D',
  deliveryStatus: 'O',
  closeStatus: '',
  busy: false,
}

describe('markReturnedBack gate (oms-react 838, BackOffice spec 3433)', () => {
  it.each([
    ['without the grant', { canMarkReturnedBack: false }],
    ['with the grant absent (an older SIS.Api)', { canMarkReturnedBack: undefined }],
    ['with a malformed grant', { canMarkReturnedBack: 'yes' as unknown as boolean }],
    ['on an order', { documentCategory: 'O' }],
    ['on a delivery return', { documentCategory: 'T' }],
    ['on an eRx', { documentCategory: 'X' }],
    ['with no category', { documentCategory: null }],
  ])('markReturnedBack hidden without canMarkReturnedBack or off category D: %s', (_, patch) => {
    expect(markReturnedBackGate({ ...AT_REST, ...patch })).toBeNull()
  })

  it.each(['', ' ', 'D', 'B', 'R', 'L', 'S', 'o'])(
    'markReturnedBack disabled with reason key on non-O status %j',
    (deliveryStatus) => {
      // `B` too: a delivery already returned back is not out for delivery. Lower-case `o`: the
      // server compares the code exactly, so the client must not be kinder.
      expect(markReturnedBackGate({ ...AT_REST, deliveryStatus })).toEqual({
        disabled: true,
        reasonKey: 'markReturnedBack.disabled.notOutForDelivery',
      })
    },
  )

  it.each(['R', 'C', 'X'])('markReturnedBack disabled with reason key on a pending cancellation (%s)', (closeStatus) => {
    expect(markReturnedBackGate({ ...AT_REST, closeStatus })).toEqual({
      disabled: true,
      reasonKey: 'markReturnedBack.disabled.cancellationPending',
    })
  })

  it('names the status before the cancellation, the order the server checks them in', () => {
    expect(markReturnedBackGate({ ...AT_REST, deliveryStatus: 'D', closeStatus: 'R' })?.reasonKey).toBe(
      'markReturnedBack.disabled.notOutForDelivery',
    )
  })

  it.each([null, undefined, '', '  '])('markReturnedBack enabled on O with blank closeStatus (%j)', (closeStatus) => {
    expect(markReturnedBackGate({ ...AT_REST, closeStatus })).toEqual({ disabled: false, reasonKey: null })
  })

  it('is disabled with no reason while the page is busy', () => {
    expect(markReturnedBackGate({ ...AT_REST, busy: true })).toEqual({ disabled: true, reasonKey: null })
  })
})

describe('the Delivery cluster (oms-react 838)', () => {
  const at = (canMarkDelivered: boolean | undefined, canMarkReturnedBack: boolean | undefined, documentCategory = 'D') =>
    deliveryCorrections({
      canMarkDelivered,
      canMarkReturnedBack,
      documentCategory,
      deliveryStatus: 'O',
      closeStatus: '',
      busy: false,
    }).map((c) => c.kind)

  it('each grant draws only its own command in the Delivery cluster', () => {
    expect(at(true, false)).toEqual(['mark-delivered'])
    expect(at(false, true)).toEqual(['mark-returned-back'])
    expect(at(true, undefined)).toEqual(['mark-delivered'])
    expect(at(undefined, true)).toEqual(['mark-returned-back'])
    expect(at(true, true)).toEqual(['mark-delivered', 'mark-returned-back'])
    expect(at(false, false)).toEqual([])
    expect(at(undefined, undefined)).toEqual([])
  })

  it('draws neither off category D, whatever the grants', () => {
    expect(at(true, true, 'T')).toEqual([])
    expect(at(true, true, 'O')).toEqual([])
  })

  it('gives both the same state gate, each with its own reason key', () => {
    const cluster = deliveryCorrections({
      canMarkDelivered: true,
      canMarkReturnedBack: true,
      documentCategory: 'D',
      deliveryStatus: 'D',
      closeStatus: '',
      busy: false,
    })
    expect(cluster).toEqual([
      { kind: 'mark-delivered', disabled: true, reasonKey: 'markDelivered.disabled.notOutForDelivery' },
      { kind: 'mark-returned-back', disabled: true, reasonKey: 'markReturnedBack.disabled.notOutForDelivery' },
    ])
  })
})

describe('markReturnedBack dialog (oms-react 838)', () => {
  const at = (reasonCode: string, note = '', pending = false) => markReturnedBackCommit({ reasonCode, note, pending })

  it('dialog commit requires a reason, and a note on Other (OTHB)', () => {
    expect(at('').canCommit).toBe(false)
    expect(at('  ').canCommit).toBe(false)
    expect(at('CARB').canCommit).toBe(true)
    expect(at('STOR', 'received by the pharmacist').canCommit).toBe(true)

    expect(at('OTHB')).toMatchObject({ canCommit: false, noteRequired: true })
    expect(at('OTHB', '   ')).toMatchObject({ canCommit: false, noteRequired: true })
    expect(at('OTHB', 'customer refused at the door')).toMatchObject({ canCommit: true, noteRequired: true })
    expect(at('DAPB').noteRequired).toBe(false)
    // Mark delivered's Other is not this act's: `ReasonCode` alone keys the reason table.
    expect(at('OTHR').noteRequired).toBe(false)
  })

  it('the note is capped at 100, measured trimmed as the server does', () => {
    const atMax = 'x'.repeat(MARK_RETURNED_BACK_NOTE_MAX)
    expect(MARK_RETURNED_BACK_NOTE_MAX).toBe(100)
    expect(at('CARB', `  ${atMax}  `)).toMatchObject({ canCommit: true, noteTooLong: false })
    expect(at('CARB', `${atMax}x`)).toMatchObject({ canCommit: false, noteTooLong: true })
  })

  it('locks the commit while the request is pending', () => {
    expect(at('CARB', '', true).canCommit).toBe(false)
  })

  it('the express warning shows only on isExpressDelivery; the reschedule line always shows', () => {
    expect(markReturnedBackNotices({ isExpressDelivery: true })).toEqual({ reschedule: true, expressAutoClose: true })
    expect(markReturnedBackNotices({ isExpressDelivery: false })).toEqual({ reschedule: true, expressAutoClose: false })
    expect(markReturnedBackNotices({ isExpressDelivery: undefined })).toEqual({ reschedule: true, expressAutoClose: false })
    expect(markReturnedBackNotices({ isExpressDelivery: 'true' as unknown as boolean })).toEqual({
      reschedule: true,
      expressAutoClose: false,
    })
  })
})

describe('markReturnedBack copy in en and ar (oms-react 838)', () => {
  it.each([
    'actions.mark-returned-back',
    'markReturnedBack.disabled.notOutForDelivery',
    'markReturnedBack.disabled.cancellationPending',
    'markReturnedBack.reschedule',
    'markReturnedBack.expressAutoClose',
    'markReturnedBack.grantRefused.title',
    'markReturnedBack.done.title',
  ])('ships %s in en and ar', (key) => {
    expect(typeof lookup(documentEn, key)).toBe('string')
    expect(typeof lookup(documentAr, key)).toBe('string')
  })

  it('never calls the command "Return": that word is Create return on this screen', () => {
    expect(lookup(documentEn, 'actions.mark-returned-back')).toMatch(/^Mark returned back/i)
  })
})

describe('markReturnedBack refusals and reasons (BackOffice 3434, 3435, 3436)', () => {
  /** 3434's and 3435's codes, in the order the server checks them — the contract this client keys on. */
  const SERVER_CODES = [
    'SDD-00002',
    'SDD-02226',
    'SDD-02227',
    'SDD-02228',
    'SDD-02090',
    'SDD-02441',
    'SDD-02225',
    'SDD-02229',
    'SDD-02230',
  ]

  it("maps exactly the server's codes", () => {
    expect(Object.keys(MARK_RETURNED_BACK_REFUSALS).sort()).toEqual([...SERVER_CODES].sort())
  })

  it.each(SERVER_CODES)('every refusal code from BackOffice 3435 maps to an i18n key in en and ar: %s', (code) => {
    const key = returnedBackRefusalKeyOf(code)
    expect(key).not.toBeNull()
    expect(key).toMatch(/^markReturnedBack\./)
    expect(typeof lookup(documentEn, key!)).toBe('string')
    expect(typeof lookup(documentAr, key!)).toBe('string')
  })

  it('answers null for a code it does not know, so the server sentence is shown instead', () => {
    // Mark delivered's own refusals name THAT act, never this one.
    expect(returnedBackRefusalKeyOf('SDD-02152')).toBeNull()
    expect(returnedBackRefusalKeyOf('SDD-99999')).toBeNull()
    expect(returnedBackRefusalKeyOf(null)).toBeNull()
  })

  it("knows the four seeded DLVB codes, in the server's order", () => {
    expect(MARK_RETURNED_BACK_REASONS).toEqual(['CARB', 'DAPB', 'OTHB', 'STOR'])
  })

  it.each(['CARB', 'DAPB', 'STOR', 'OTHB'])('labels the seeded reason %s in en and ar', (code) => {
    expect(typeof lookup(documentEn, returnedBackReasonLabelKey(code))).toBe('string')
    expect(typeof lookup(documentAr, returnedBackReasonLabelKey(code))).toBe('string')
  })

  it("labels a reason by code from its own namespace, never Mark delivered's", () => {
    expect(returnedBackReasonLabelKey(' CARB ')).toBe('markReturnedBack.reasons.CARB')
    expect(lookup(documentEn, returnedBackReasonLabelKey('OTHR'))).toBeUndefined()
  })
})
