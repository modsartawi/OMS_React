/**
 * The Invoices tab's pure half (ticket 428, spec 2443): one column set, a status
 * sentence for every status and every skip reason, and the address-source wording.
 *
 * 🚩 The status is the SERVER's (2446 derives it from the queue row and its latest
 * attempt). The client only words it, so these tests pin the wording, never a
 * derivation, and an unknown code must still read as itself rather than vanish.
 */
import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'

import type { LoyInvoiceRow } from '@/core/models/loy'
import enLoy from '@/locales/en/loy.json'
import {
  INVOICE_SKIP_REASONS,
  INVOICE_STATUSES,
  buildInvoiceColumns,
  invoiceStatusText,
  notResendableText,
  recipientSourceKey,
} from './invoice-columns'

/** A `t` that shows which key and params it was asked for. */
const t = ((key: string, params?: Record<string, unknown>) =>
  params ? `${key}${JSON.stringify(params)}` : key) as unknown as TFunction

const row = (over: Partial<LoyInvoiceRow> = {}): LoyInvoiceRow => ({
  storeCode: '1001',
  trxNumber: '1001-0042-000123',
  trxDate: '2026-10-01T00:00:00',
  documentType: 1,
  status: 'Sent',
  skipReason: null,
  lastAttemptAt: '2026-10-01T10:12:00',
  recipient: 'nouf.h@example.com',
  recipientSource: 'Profile',
  resendable: true,
  notResendableReason: null,
  ...over,
})

const NoCell = () => null

/** Resolve a dotted key against the real EN locale. */
const inLocale = (key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], enLoy)

describe('buildInvoiceColumns', () => {
  it('is ONE column set: store, receipt, date, status, last attempt, will go to, then the action', () => {
    const cols = buildInvoiceColumns(t, { actionCell: NoCell })
    expect(cols.map((c) => c.colId ?? c.field)).toEqual([
      'storeCode',
      'trxNumber',
      'trxDate',
      'status',
      'lastAttemptAt',
      'recipient',
      'resend',
    ])
  })

  it('has no action column when the session may not resend at all', () => {
    const cols = buildInvoiceColumns(t, { actionCell: null })
    expect(cols.map((c) => c.colId ?? c.field)).not.toContain('resend')
  })

  it('every header is a key the EN locale backs', () => {
    for (const col of buildInvoiceColumns(t, { actionCell: NoCell })) {
      expect(typeof inLocale(String(col.headerName))).toBe('string')
    }
  })
})

describe('invoiceStatusText', () => {
  it.each(INVOICE_STATUSES.filter((s) => s !== 'Skipped'))('%s has its own sentence', (status) => {
    const key = `tabs.invoices.status.${status}`
    expect(invoiceStatusText(row({ status }), t)).toBe(key)
    expect(typeof inLocale(key)).toBe('string')
  })

  it.each(INVOICE_SKIP_REASONS)('a skip for %s names its reason', (reason) => {
    const reasonKey = `tabs.invoices.skip.${reason}`
    expect(invoiceStatusText(row({ status: 'Skipped', skipReason: reason }), t)).toBe(
      `tabs.invoices.status.skippedBecause${JSON.stringify({ reason: reasonKey })}`,
    )
    expect(typeof inLocale(reasonKey)).toBe('string')
    expect(typeof inLocale('tabs.invoices.status.skippedBecause')).toBe('string')
  })

  it('the never-queued sentence says why, so nobody promises an email', () => {
    expect(String(inLocale('tabs.invoices.status.NotQueued'))).toMatch(/insurance, credit and non-emailing stores/i)
  })

  it('a skip with no reason (a row older than the attempt history) is plain Skipped', () => {
    expect(invoiceStatusText(row({ status: 'Skipped', skipReason: null }), t)).toBe(
      'tabs.invoices.status.Skipped',
    )
  })

  it('🚩 an unknown skip reason reads as its bare code, never as a raw key', () => {
    expect(invoiceStatusText(row({ status: 'Skipped', skipReason: 'NEW_THING' }), t)).toBe(
      `tabs.invoices.status.skippedBecause${JSON.stringify({ reason: 'NEW_THING' })}`,
    )
  })

  it('🚩 an unknown status reads as itself', () => {
    expect(invoiceStatusText(row({ status: 'Bounced' as LoyInvoiceRow['status'] }), t)).toBe('Bounced')
  })
})

describe('notResendableText', () => {
  it('a receipt the rail would skip NOW says why, in the skip reason words', () => {
    const blocked = row({ status: 'Sent', resendable: false, notResendableReason: 'INVALID_EMAIL', recipient: null })
    expect(notResendableText(blocked, t)).toBe(
      `tabs.invoices.wouldSkip${JSON.stringify({ reason: 'tabs.invoices.skip.INVALID_EMAIL' })}`,
    )
    expect(typeof inLocale('tabs.invoices.wouldSkip')).toBe('string')
  })

  it.each([
    ['a resendable receipt', row()],
    ['a waiting receipt', row({ status: 'Queued', resendable: false, notResendableReason: 'QUEUED' })],
    ['a never-queued receipt', row({ status: 'NotQueued', resendable: false, notResendableReason: 'NOT_QUEUED' })],
    ['no reason at all', row({ resendable: false, notResendableReason: null })],
  ])('%s needs no note — the status already says it', (_, r) => {
    expect(notResendableText(r, t)).toBeNull()
  })

  it('🚩 an unknown reason reads as its bare code', () => {
    expect(notResendableText(row({ resendable: false, notResendableReason: 'NEW_RULE' }), t)).toBe(
      `tabs.invoices.wouldSkip${JSON.stringify({ reason: 'NEW_RULE' })}`,
    )
  })
})

describe('recipientSourceKey', () => {
  it('an e-commerce receipt says it goes to the online order’s email', () => {
    expect(recipientSourceKey(row({ recipientSource: 'Order' }))).toBe('tabs.invoices.source.order')
    expect(String(inLocale('tabs.invoices.source.order'))).toMatch(/online order/i)
  })

  it('a profile address needs no note', () => {
    expect(recipientSourceKey(row({ recipientSource: 'Profile' }))).toBeNull()
    expect(recipientSourceKey(row({ recipientSource: null, recipient: null }))).toBeNull()
  })
})
