/**
 * Ticket 1008 (spec 1006 D4, D6): the prescription's pure rules — the ID box's filtering, which
 * field a refusal belongs under, the reference's per-type label, and the payment lock's reason.
 *
 * Expected values are literals off the spec (10 digits, *eRx number*, *Approval / PreAuthRef*,
 * *Prescription orders are paid on delivery*), never re-derived the way the module derives them.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/callcenter.json'
import ar from '@/locales/ar/callcenter.json'
import type { SessionCapabilities, SessionHeader } from '@/core/models/callcenter'
import { EMPTY_SESSION } from './__fixtures__/payloads'
import {
  filterPatientId,
  paymentLock,
  prescriptionCommit,
  prescriptionOf,
  prescriptionRefusal,
  prescriptionSettled,
  referenceLabelKey,
} from './prescription'

const lookup = (bundle: unknown, key: string): string | undefined =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle) as
    | string
    | undefined

const header = (extra: Partial<SessionHeader>): SessionHeader => ({ ...EMPTY_SESSION.header, ...extra })
const caps = (extra: Partial<SessionCapabilities>): SessionCapabilities => ({ ...EMPTY_SESSION.capabilities, ...extra })

describe('filterPatientId', () => {
  it('keeps digits only', () => {
    expect(filterPatientId('10 2345-678a9')).toBe('1023456789')
  })
  it('stops at ten digits', () => {
    expect(filterPatientId('123456789012')).toBe('1234567890')
  })
  it('reads Arabic-Indic digits as the digits they are', () => {
    expect(filterPatientId('١٠٢٣٤٥٦٧٨٩')).toBe('1023456789')
    expect(filterPatientId('۱۲۳')).toBe('123')
  })
  it('empties to empty', () => {
    expect(filterPatientId('')).toBe('')
    expect(filterPatientId('abc')).toBe('')
  })
})

describe('prescriptionOf / prescriptionSettled', () => {
  it('reads a pre-1.15 header as nothing held', () => {
    expect(prescriptionOf(EMPTY_SESSION.header)).toEqual({ patientId: '', reference: '' })
    expect(prescriptionSettled(EMPTY_SESSION.header)).toBe(false)
  })
  it('is settled only when both are held', () => {
    expect(prescriptionSettled(header({ prescription: { patientId: '1023456789', reference: null } }))).toBe(false)
    expect(prescriptionSettled(header({ prescription: { patientId: '1023456789', reference: '  ' } }))).toBe(false)
    expect(prescriptionSettled(header({ prescription: { patientId: '1023456789', reference: 'ERX-77' } }))).toBe(true)
  })
})

describe('prescriptionCommit', () => {
  const held = header({ prescription: { patientId: '1023456789', reference: 'ERX-77' } })
  it('sends nothing on blur while one field is still empty', () => {
    expect(prescriptionCommit(EMPTY_SESSION.header, { patientId: '1023456789', reference: '' }, 'blur')).toBeNull()
  })
  it('sends a whole pair on blur, the reference trimmed', () => {
    expect(prescriptionCommit(EMPTY_SESSION.header, { patientId: '1023456789', reference: ' ERX-77 ' }, 'blur')).toEqual({
      patientId: '1023456789',
      reference: 'ERX-77',
    })
  })
  it('sends nothing when the order already holds exactly that', () => {
    expect(prescriptionCommit(held, { patientId: '1023456789', reference: 'ERX-77 ' }, 'blur')).toBeNull()
    expect(prescriptionCommit(held, { patientId: '1023456789', reference: 'ERX-77' }, 'enter')).toBeNull()
  })
  it('sends on Enter even with a field empty, so the refusal is the server’s', () => {
    expect(prescriptionCommit(EMPTY_SESSION.header, { patientId: '123', reference: '' }, 'enter')).toEqual({
      patientId: '123',
      reference: '',
    })
  })
})

describe('prescriptionRefusal', () => {
  it('puts each refusal under its own field', () => {
    expect(prescriptionRefusal('PATIENT_ID_INVALID')).toEqual({ field: 'patientId', key: 'prescription.refused.PATIENT_ID_INVALID' })
    expect(prescriptionRefusal('REFERENCE_REQUIRED')).toEqual({ field: 'reference', key: 'prescription.refused.REFERENCE_REQUIRED' })
  })
  it('has no field for anything else', () => {
    expect(prescriptionRefusal('SESSION_BUSY')).toBeNull()
    expect(prescriptionRefusal(null)).toBeNull()
  })
  it('words both refusals in en and ar', () => {
    for (const code of ['PATIENT_ID_INVALID', 'REFERENCE_REQUIRED']) {
      const key = prescriptionRefusal(code)!.key
      expect(lookup(en, key), `en ${key}`).toBeTruthy()
      expect(lookup(ar, key), `ar ${key}`).toBeTruthy()
    }
    expect(lookup(en, 'prescription.refused.PATIENT_ID_INVALID')).toBe('The patient ID is 10 digits. Check it with the caller.')
  })
})

describe('referenceLabelKey', () => {
  it('names the reference by the type', () => {
    expect(lookup(en, referenceLabelKey('Wasfaty'))).toBe('eRx number')
    expect(lookup(en, referenceLabelKey('Nphies'))).toBe('Approval / PreAuthRef')
    expect(lookup(ar, referenceLabelKey('Wasfaty'))).toBeTruthy()
    expect(lookup(ar, referenceLabelKey('Nphies'))).toBeTruthy()
  })
  it('falls back to a plain word for any other type', () => {
    expect(lookup(en, referenceLabelKey('Ordinary'))).toBe('Reference')
  })
})

describe('paymentLock', () => {
  const wasfaty = header({ orderType: 'Wasfaty', paymentType: 'CashOnDelivery' })
  it('is open on an ordinary order with nothing forced', () => {
    expect(paymentLock(EMPTY_SESSION.header, EMPTY_SESSION.capabilities)).toEqual({ open: true })
  })
  it('reads the header’s forced reason first', () => {
    expect(paymentLock(header({ ...wasfaty, paymentTypeForcedReason: 'orderType' }), caps({}))).toEqual({
      open: false,
      key: 'payment.locked.orderType',
      reason: 'orderType',
    })
  })
  it('reads capabilityReasons when the header carries none', () => {
    expect(
      paymentLock(wasfaty, caps({ canChangePaymentType: false, capabilityReasons: { canChangePaymentType: 'orderType' } })),
    ).toEqual({ open: false, key: 'payment.locked.orderType', reason: 'orderType' })
  })
  it('never says "paid online" on a prescription order', () => {
    expect(
      paymentLock(wasfaty, caps({ canChangePaymentType: false, capabilityReasons: { canChangePaymentType: 'PAYMENT_TYPE_FORCED' } })),
    ).toMatchObject({ open: false, key: 'payment.locked.orderType' })
    expect(paymentLock(wasfaty, caps({ canChangePaymentType: false }))).toMatchObject({ key: 'payment.locked.orderType' })
  })
  it('keeps the existing words on an ordinary order', () => {
    expect(
      paymentLock(
        EMPTY_SESSION.header,
        caps({ canChangePaymentType: false, capabilityReasons: { canChangePaymentType: 'PAYMENT_TYPE_FORCED' } }),
      ),
    ).toMatchObject({ key: 'payment.locked.PAYMENT_TYPE_FORCED' })
    expect(paymentLock(EMPTY_SESSION.header, caps({ canChangePaymentType: false }))).toMatchObject({
      key: 'payment.locked.unknown',
    })
    expect(
      paymentLock(EMPTY_SESSION.header, caps({ canChangePaymentType: false, capabilityReasons: { canChangePaymentType: 'NEW_RULE' } })),
    ).toMatchObject({ key: 'payment.locked.unknown', reason: 'NEW_RULE' })
  })
  it('words the prescription reason in en and ar', () => {
    expect(lookup(en, 'payment.locked.orderType')).toBe('Prescription orders are paid on delivery.')
    expect(lookup(ar, 'payment.locked.orderType')).toBeTruthy()
    expect(lookup(ar, 'payment.locked.unknown')).toBeTruthy()
  })
})
