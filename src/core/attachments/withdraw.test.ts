/**
 * Withdraw a wrong file (spec 319's ticket 323, lifted by ticket 325): the body and
 * each answer. These cases moved here from the slip suite with their assertions
 * unchanged; the slip's grant and its five reasons stay in
 * `features/collection/inquiry/slip-withdraw.test.ts`.
 *
 * 🔑 The answer mapping branches on the CODE: the only status it reads is the grant
 * filter's bodiless 403, so a coded 403 (not the grant filter) must not be read as one.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import {
  WITHDRAW_NOTE_MAX,
  withdrawAnswer,
  withdrawBody,
  withdrawCanResend,
  withdrawClosesDialog,
  withdrawNote,
} from './withdraw'

/** A coded envelope refusal, as `core/api` builds it. */
const coded = (status: number, code: string) =>
  new ApiError('business', `${code} — English.\nالعربية.`, status, [
    { errorCode: code, internalErrorCode: '', errorMessage: code },
  ])

/** What `core/api` makes of a 403 with no body: kind unknown, no code. */
const bare403 = () => new ApiError('unknown', 'Unexpected API error (HTTP 403)', 403)

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
