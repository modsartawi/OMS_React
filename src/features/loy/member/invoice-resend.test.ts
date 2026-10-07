/**
 * Whether a receipt offers Resend (ticket 428): the server's `resendable` AND the
 * session's edit grant — nothing looser, and never on a row that is waiting or was
 * never queued, whatever a careless projection says about it.
 */
import { describe, expect, it } from 'vitest'

import type { LoyInvoiceRow } from '@/core/models/loy'
import { requeueOutcome, resendOffered } from './invoice-resend'

const row = (over: Partial<LoyInvoiceRow> = {}): LoyInvoiceRow => ({
  storeCode: '1001',
  trxNumber: '000123',
  trxDate: '2026-10-01T00:00:00',
  documentType: 1,
  status: 'Skipped',
  skipReason: 'NO_EMAIL',
  lastAttemptAt: null,
  recipient: 'nouf.h@example.com',
  recipientSource: 'Profile',
  resendable: true,
  notResendableReason: null,
  ...over,
})

describe('resendOffered', () => {
  it('a resendable row offers Resend to an editor', () => {
    expect(resendOffered(row(), true)).toBe(true)
    expect(resendOffered(row({ status: 'Sent', skipReason: null }), true)).toBe(true)
    expect(resendOffered(row({ status: 'Failed', skipReason: null }), true)).toBe(true)
  })

  it('🚩 a look-only session is offered nothing', () => {
    expect(resendOffered(row(), false)).toBe(false)
  })

  it('a row the server says is not resendable offers nothing', () => {
    expect(resendOffered(row({ resendable: false, notResendableReason: 'NO_EMAIL' }), true)).toBe(false)
  })

  it.each([
    ['Queued', 'QUEUED'],
    ['NotQueued', 'NOT_QUEUED'],
  ] as const)('🚩 a %s row offers nothing even if flagged resendable', (status, reason) => {
    expect(resendOffered(row({ status }), true)).toBe(false)
    expect(resendOffered(row({ status: 'Sent', notResendableReason: reason }), true)).toBe(false)
  })

  it('🚩 anything but a literal true is not resendable', () => {
    expect(resendOffered(row({ resendable: 'true' as unknown as boolean }), true)).toBe(false)
  })
})

describe('requeueOutcome', () => {
  it('queued names the address the SERVER queued to', () => {
    expect(
      requeueOutcome({ result: 'Queued', recipient: ' new@x.sa ', recipientSource: 'Profile' }),
    ).toEqual({ key: 'tabs.invoices.resend.queuedTo', recipient: 'new@x.sa' })
  })

  it('a queued answer with no address still says queued', () => {
    expect(requeueOutcome({ result: 'Queued', recipient: '', recipientSource: 'Profile' })).toEqual({
      key: 'tabs.invoices.resend.queued',
      recipient: null,
    })
  })

  it('🚩 already waiting is not queued', () => {
    expect(
      requeueOutcome({ result: 'AlreadyQueued', recipient: 'a@b.sa', recipientSource: 'Profile' }),
    ).toEqual({ key: 'tabs.invoices.resend.alreadyQueued', recipient: null })
  })
})
