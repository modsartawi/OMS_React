/**
 * Withdraw a wrong slip (ticket 323, BackOffice 2035's `## Web contract`): who may,
 * the reasons, and the confirm rule over them.
 *
 * 🔑 A bare string `"CASH_CLOSE"` in `withdrawCategories` must NOT admit (a
 * `String.includes` would). The shared rules — the body and each answer, by code —
 * moved to `@/core/attachments/withdraw.test.ts` with ticket 325; the confirm rule
 * is shared too, and is pinned here through the slip's own five reasons.
 */
import { describe, expect, it } from 'vitest'
import { canConfirmWithdraw, needsWithdrawNote } from '@/core/attachments/withdraw'
import type { AttachmentAccess } from '@/core/models/collection'
import en from '@/locales/en/collection.json'
import { WITHDRAW_REASONS, WITHDRAW_REASON_CODES, canWithdrawSlips } from './slip-withdraw'
import { CASH_CLOSE } from './slips'

const access = (a: Partial<AttachmentAccess>): AttachmentAccess => ({ categories: [CASH_CLOSE], ...a })

/** Ticket 323's table, copied byte for byte (UTF-8). The bundle must say exactly this. */
const TABLE: [string, string, string][] = [
  ['WRONG_STORE_DAY', 'Wrong store or day', 'فرع أو يوم غير صحيح'],
  ['UNREADABLE', 'Unreadable', 'غير مقروء'],
  ['DUPLICATE', 'Duplicate', 'مكرر'],
  ['NOT_ECR_SLIP', 'Not an ECR slip', 'ليس إيصال جهاز الدفع (ECR)'],
  ['OTHER', 'Other', 'سبب آخر'],
]

/** Read a dotted key out of the collection bundle. */
const bundle = (key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en)

describe('canWithdrawSlips — the withdraw grant, from the one shared probe', () => {
  it('admits only a withdrawCategories array holding CASH_CLOSE', () => {
    expect(canWithdrawSlips(access({ withdrawCategories: [CASH_CLOSE] }))).toBe(true)
    expect(canWithdrawSlips(access({ withdrawCategories: ['OTHER', CASH_CLOSE] }))).toBe(true)
  })

  it('refuses a missing field — a collector, or an older SIS.Api', () => {
    expect(canWithdrawSlips(access({}))).toBe(false)
    expect(canWithdrawSlips(access({ withdrawCategories: undefined }))).toBe(false)
  })

  it('refuses an empty array, and a list without CASH_CLOSE', () => {
    expect(canWithdrawSlips(access({ withdrawCategories: [] }))).toBe(false)
    expect(canWithdrawSlips(access({ withdrawCategories: ['OTHER'] }))).toBe(false)
    expect(canWithdrawSlips(access({ withdrawCategories: ['cash_close'] }))).toBe(false)
  })

  it('🔑 refuses CASH_CLOSE as a bare string — the String.includes trap', () => {
    expect(canWithdrawSlips({ categories: [CASH_CLOSE], withdrawCategories: CASH_CLOSE } as never)).toBe(false)
    expect(canWithdrawSlips({ categories: [CASH_CLOSE], withdrawCategories: 'CASH_CLOSE,OTHER' } as never)).toBe(false)
  })

  it('refuses a pending or refused probe (no data at all)', () => {
    expect(canWithdrawSlips(undefined)).toBe(false)
    expect(canWithdrawSlips(null)).toBe(false)
    expect(canWithdrawSlips({} as never)).toBe(false)
  })

  it('refuses a withdraw grant without the read grant — the drawer is only open to a reader', () => {
    expect(canWithdrawSlips({ categories: [], withdrawCategories: [CASH_CLOSE] })).toBe(false)
  })
})

describe('the reason list', () => {
  it('is the five codes, in contract order', () => {
    expect(WITHDRAW_REASON_CODES).toEqual(['WRONG_STORE_DAY', 'UNREADABLE', 'DUPLICATE', 'NOT_ECR_SLIP', 'OTHER'])
    expect(WITHDRAW_REASONS.map((r) => r.code)).toEqual(TABLE.map(([code]) => code))
  })

  it('labels each with the English beside the Arabic, byte for byte, under its own key', () => {
    for (const [code, english, arabic] of TABLE) {
      const reason = WITHDRAW_REASONS.find((r) => r.code === code)
      expect(reason?.labelKey).toBe(`slips.withdraw.reasons.${code}`)
      const label = bundle(reason!.labelKey)
      expect(label).toBe(`${english} · ${arabic}`)
      expect(String(label).normalize('NFC')).toBe(String(label))
    }
  })

  it('needs a note for Other only', () => {
    expect(needsWithdrawNote(WITHDRAW_REASONS, 'OTHER')).toBe(true)
    for (const code of ['WRONG_STORE_DAY', 'UNREADABLE', 'DUPLICATE', 'NOT_ECR_SLIP', null, undefined, 'other']) {
      expect(needsWithdrawNote(WITHDRAW_REASONS, code)).toBe(false)
    }
  })
})

describe('canConfirmWithdraw — the confirm rule', () => {
  it('keeps Other disabled while the note is blank or whitespace', () => {
    expect(canConfirmWithdraw(WITHDRAW_REASONS, 'OTHER', '')).toBe(false)
    expect(canConfirmWithdraw(WITHDRAW_REASONS, 'OTHER', '   ')).toBe(false)
    expect(canConfirmWithdraw(WITHDRAW_REASONS, 'OTHER', '\n\t ')).toBe(false)
  })

  it('enables Other once the note says something', () => {
    expect(canConfirmWithdraw(WITHDRAW_REASONS, 'OTHER', 'Belongs to P020')).toBe(true)
    expect(canConfirmWithdraw(WITHDRAW_REASONS, 'OTHER', '  x  ')).toBe(true)
  })

  it('enables every other code with or without a note', () => {
    for (const code of ['WRONG_STORE_DAY', 'UNREADABLE', 'DUPLICATE', 'NOT_ECR_SLIP']) {
      expect(canConfirmWithdraw(WITHDRAW_REASONS, code, '')).toBe(true)
      expect(canConfirmWithdraw(WITHDRAW_REASONS, code, '   ')).toBe(true)
      expect(canConfirmWithdraw(WITHDRAW_REASONS, code, 'a note')).toBe(true)
    }
  })

  it('stays disabled until a known reason is picked', () => {
    expect(canConfirmWithdraw(WITHDRAW_REASONS, null, 'a note')).toBe(false)
    expect(canConfirmWithdraw(WITHDRAW_REASONS, undefined, '')).toBe(false)
    expect(canConfirmWithdraw(WITHDRAW_REASONS, 'WRONG', 'a note')).toBe(false)
    expect(canConfirmWithdraw(WITHDRAW_REASONS, 'other', 'a note')).toBe(false)
  })
})
