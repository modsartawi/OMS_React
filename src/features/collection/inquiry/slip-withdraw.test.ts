/**
 * Withdraw a wrong slip (ticket 323, BackOffice 2035's `## Web contract`): who may,
 * the reasons, the confirm rule, the body, and each answer.
 *
 * 🔑 Two traps are pinned here. A bare string `"CASH_CLOSE"` in `withdrawCategories`
 * must NOT admit (a `String.includes` would). And the answer mapping branches on the
 * CODE: the only status it reads is the grant filter's bodiless 403, so a coded 403
 * (not the grant filter) must not be read as one.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { AttachmentAccess } from '@/core/models/collection'
import en from '@/locales/en/collection.json'
import {
  WITHDRAW_NOTE_MAX,
  WITHDRAW_REASONS,
  WITHDRAW_REASON_CODES,
  canConfirmWithdraw,
  canWithdrawSlips,
  needsWithdrawNote,
  withdrawAnswer,
  withdrawBody,
  withdrawCanResend,
  withdrawClosesDialog,
  withdrawNote,
} from './slip-withdraw'
import { CASH_CLOSE } from './slips'

const access = (a: Partial<AttachmentAccess>): AttachmentAccess => ({ categories: [CASH_CLOSE], ...a })

/** A coded envelope refusal, as `core/api` builds it. */
const coded = (status: number, code: string) =>
  new ApiError('business', `${code} — English.\nالعربية.`, status, [
    { errorCode: code, internalErrorCode: '', errorMessage: code },
  ])

/** What `core/api` makes of a 403 with no body: kind unknown, no code. */
const bare403 = () => new ApiError('unknown', 'Unexpected API error (HTTP 403)', 403)

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
    expect(needsWithdrawNote('OTHER')).toBe(true)
    for (const code of ['WRONG_STORE_DAY', 'UNREADABLE', 'DUPLICATE', 'NOT_ECR_SLIP', null, undefined, 'other']) {
      expect(needsWithdrawNote(code)).toBe(false)
    }
  })
})

describe('canConfirmWithdraw — the confirm rule', () => {
  it('keeps Other disabled while the note is blank or whitespace', () => {
    expect(canConfirmWithdraw('OTHER', '')).toBe(false)
    expect(canConfirmWithdraw('OTHER', '   ')).toBe(false)
    expect(canConfirmWithdraw('OTHER', '\n\t ')).toBe(false)
  })

  it('enables Other once the note says something', () => {
    expect(canConfirmWithdraw('OTHER', 'Belongs to P020')).toBe(true)
    expect(canConfirmWithdraw('OTHER', '  x  ')).toBe(true)
  })

  it('enables every other code with or without a note', () => {
    for (const code of ['WRONG_STORE_DAY', 'UNREADABLE', 'DUPLICATE', 'NOT_ECR_SLIP']) {
      expect(canConfirmWithdraw(code, '')).toBe(true)
      expect(canConfirmWithdraw(code, '   ')).toBe(true)
      expect(canConfirmWithdraw(code, 'a note')).toBe(true)
    }
  })

  it('stays disabled until a known reason is picked', () => {
    expect(canConfirmWithdraw(null, 'a note')).toBe(false)
    expect(canConfirmWithdraw(undefined, '')).toBe(false)
    expect(canConfirmWithdraw('WRONG', 'a note')).toBe(false)
    expect(canConfirmWithdraw('other', 'a note')).toBe(false)
  })
})

describe('withdrawBody — exactly { reasonCode, note }', () => {
  it('carries the two fields and nothing else', () => {
    const body = withdrawBody('DUPLICATE', '')
    expect(body).toEqual({ reasonCode: 'DUPLICATE', note: '' })
    expect(Object.keys(body)).toEqual(['reasonCode', 'note'])
  })

  it('trims the note', () => {
    expect(withdrawBody('OTHER', '  Belongs to P020 \n')).toEqual({ reasonCode: 'OTHER', note: 'Belongs to P020' })
  })

  it('caps the note at 200, after the trim', () => {
    expect(WITHDRAW_NOTE_MAX).toBe(200)
    expect(withdrawBody('OTHER', 'a'.repeat(250)).note).toBe('a'.repeat(200))
    expect(withdrawBody('OTHER', `   ${'b'.repeat(200)}   `).note).toBe('b'.repeat(200))
    expect(withdrawBody('OTHER', 'ملاحظة'.repeat(40)).note).toHaveLength(200)
  })

  it('never cuts a surrogate pair in half at the cap', () => {
    const note = `${'a'.repeat(199)}😀tail`
    expect(withdrawNote(note)).toBe('a'.repeat(199))
    expect(withdrawNote(`${'a'.repeat(198)}😀tail`)).toBe(`${'a'.repeat(198)}😀`)
  })
})

describe('withdrawAnswer — each answer, by code (and the one bodiless 403)', () => {
  it('200 is withdrawn: close the dialog, re-read', () => {
    expect(withdrawAnswer(null)).toBe('withdrawn')
    expect(withdrawClosesDialog('withdrawn')).toBe(true)
  })

  it('400 reasonCode and 400 note keep the dialog and the input, and may be sent again', () => {
    for (const code of ['reasonCode', 'note']) {
      const answer = withdrawAnswer(coded(400, code))
      expect(answer).toBe('invalid')
      expect(withdrawClosesDialog(answer)).toBe(false)
      expect(withdrawCanResend(answer)).toBe(true)
    }
  })

  it('404 NOT_FOUND is gone: close the dialog, re-read', () => {
    expect(withdrawAnswer(coded(404, 'NOT_FOUND'))).toBe('gone')
    expect(withdrawClosesDialog('gone')).toBe(true)
  })

  it('a bare 403 (no body) is forbidden: close, and take the action away', () => {
    expect(withdrawAnswer(bare403())).toBe('forbidden')
    expect(withdrawClosesDialog('forbidden')).toBe(true)
  })

  it('a CODED 403 is not the grant filter: its message is shown', () => {
    expect(withdrawAnswer(coded(403, 'CATEGORY_NOT_HELD'))).toBe('failed')
  })

  it('503 NOT_SET_UP shows its message, and offers no retry', () => {
    const answer = withdrawAnswer(coded(503, 'NOT_SET_UP'))
    expect(answer).toBe('not-set-up')
    expect(withdrawClosesDialog(answer)).toBe(false)
    expect(withdrawCanResend(answer)).toBe(false)
  })

  it('anything else is a failure that may be pressed again (a repeat is a harmless 200)', () => {
    for (const error of [
      new ApiError('network', 'offline', 0),
      new ApiError('server', 'crash', 500),
      new ApiError('unknown', 'Unexpected API error (HTTP 502)', 502),
      new Error('a bug'),
    ]) {
      const answer = withdrawAnswer(error)
      expect(answer).toBe('failed')
      expect(withdrawClosesDialog(answer)).toBe(false)
      expect(withdrawCanResend(answer)).toBe(true)
    }
  })
})
