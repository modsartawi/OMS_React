/**
 * Ticket 1009 (spec 1006 D5): a prescription that already has an open order is confirmed before
 * submit — the ask read off the submit answer, the sheet's words (en and ar), and the token sent
 * exactly once.
 *
 * Expected strings are literals off the ticket's own sentence (*"This prescription already has an
 * open order, {{documentNo}}. Place another one?"*), never re-derived the way the module derives
 * them. The isolates around the order number are part of the expected text (bidi rule).
 */
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/callcenter.json'
import ar from '@/locales/ar/callcenter.json'
import type { SubmitAnswer } from '@/core/models/callcenter'
import { ATTACHED_SESSION, BELOW_ATP_CONFIRM, SUBMIT_PLACED } from './__fixtures__/payloads'
import { activePrescriptionCopy, nextSubmitPress, placeAnyway, submitAsk } from './active-prescription'

const instance = i18next.createInstance()
instance.init({
  lng: 'en',
  resources: { en: { callcenter: en }, ar: { callcenter: ar } },
  ns: ['callcenter'],
  defaultNS: 'callcenter',
  initAsync: false,
  interpolation: { escapeValue: false },
})
const tEn = instance.getFixedT('en', 'callcenter')
const tAr = instance.getFixedT('ar', 'callcenter')
const iso = (value: string) => `⁨${value}⁩`

/** The guessed v1.15 shape: no number yet, the UNCHANGED state carrying the ask. */
const ASKED: SubmitAnswer = {
  outcome: 'confirmationRequired',
  documentNo: null,
  state: {
    ...ATTACHED_SESSION,
    pendingConfirmation: {
      kind: 'activePrescription',
      confirmToken: 'TOKEN-RX-1',
      expiresInMs: 120000,
      detail: { documentNo: '0090011111' },
    },
  },
}

describe('submitAsk — reading the duplicate-prescription ask off a submit answer', () => {
  it('reads the token and the open order number', () => {
    expect(submitAsk(ASKED)).toEqual({ confirmToken: 'TOKEN-RX-1', documentNo: '0090011111' })
  })

  it('answers null for a placed order', () => {
    expect(submitAsk(SUBMIT_PLACED)).toBeNull()
  })

  // Review finding 3: a placed answer is never a question, whatever its state still carries.
  it('answers null for a placed answer whose state still carries the ask', () => {
    const placed: SubmitAnswer = { outcome: 'submitted', documentNo: '0090022222', state: ASKED.state }
    expect(submitAsk(placed)).toBeNull()
    expect(submitAsk({ ...placed, outcome: 'alreadySubmitted' })).toBeNull()
  })

  it("answers null for someone else's kind of confirmation", () => {
    expect(submitAsk({ ...ASKED, state: { ...ASKED.state!, pendingConfirmation: BELOW_ATP_CONFIRM } })).toBeNull()
  })

  it('answers null for an ask with no token — nothing could commit it', () => {
    const pending = { ...ASKED.state!.pendingConfirmation!, confirmToken: '' }
    expect(submitAsk({ ...ASKED, state: { ...ASKED.state!, pendingConfirmation: pending } })).toBeNull()
  })

  it('still asks when the detail names no order number', () => {
    const pending = { ...ASKED.state!.pendingConfirmation!, detail: {} }
    expect(submitAsk({ ...ASKED, state: { ...ASKED.state!, pendingConfirmation: pending } })).toEqual({
      confirmToken: 'TOKEN-RX-1',
      documentNo: null,
    })
  })
})

describe("activePrescriptionCopy — the sheet's words", () => {
  const ask = { confirmToken: 'TOKEN-RX-1', documentNo: '0090011111' }

  it('names the open order, isolated, in English', () => {
    const copy = activePrescriptionCopy(ask, tEn)
    expect(copy.body).toBe(`This prescription already has an open order, ${iso('0090011111')}. Place another one?`)
    expect(copy.keep).toBe('Go back')
    expect(copy.confirm).toBe('Place anyway')
  })

  it('names the open order, isolated, in Arabic', () => {
    const copy = activePrescriptionCopy(ask, tAr)
    expect(copy.body).toBe(`هذه الوصفة لها طلب مفتوح بالفعل، ${iso('0090011111')}. هل تريد إنشاء طلب آخر؟`)
    expect(copy.keep).toBe('رجوع')
    expect(copy.confirm).toBe('إنشاء الطلب على أي حال')
  })

  it('says the same thing without a number when the ask named none', () => {
    expect(activePrescriptionCopy({ ...ask, documentNo: null }, tEn).body).toBe(
      'This prescription already has an open order. Place another one?',
    )
    expect(activePrescriptionCopy({ ...ask, documentNo: null }, tAr).body).toBe(
      'هذه الوصفة لها طلب مفتوح بالفعل. هل تريد إنشاء طلب آخر؟',
    )
  })
})

describe('placeAnyway — the token is sent exactly once', () => {
  const press = { requestId: 'REQ-1', version: 7 }
  const ask = { confirmToken: 'TOKEN-RX-1', documentNo: '0090011111' }

  it('re-sends the same press with the token', () => {
    expect(placeAnyway(press, ask, false)).toEqual({ requestId: 'REQ-1', version: 7, confirmToken: 'TOKEN-RX-1' })
  })

  it('sends nothing while that commit is in flight (a double click)', () => {
    expect(placeAnyway(press, ask, true)).toBeNull()
  })

  it('sends nothing once the ask is gone (Go back, or the commit landed)', () => {
    expect(placeAnyway(press, null, false)).toBeNull()
  })

  it('sends nothing with no press behind the ask', () => {
    expect(placeAnyway(null, ask, false)).toBeNull()
  })
})

// Review finding 2: an unconfirmable answer is cached under its requestId, so re-sending that id
// replays it forever. Only a failure that may have landed keeps the id.
describe('nextSubmitPress — which id the next press of Place order carries', () => {
  const last = { requestId: 'REQ-1', version: 7, confirmToken: 'TOKEN-RX-1' }
  const mint = () => 'REQ-NEW'

  it('re-sends the same id, without a token, after a failure that may have landed', () => {
    expect(nextSubmitPress(last, 'failed', 7, mint)).toEqual({ requestId: 'REQ-1', version: 7 })
  })

  it('mints a fresh id after an answer the console could not confirm', () => {
    expect(nextSubmitPress(last, 'unconfirmable', 7, mint)).toEqual({ requestId: 'REQ-NEW', version: 7 })
  })

  it('mints a fresh id, at the current version, with nothing standing', () => {
    expect(nextSubmitPress(last, null, 9, mint)).toEqual({ requestId: 'REQ-NEW', version: 9 })
    expect(nextSubmitPress(null, 'failed', 9, mint)).toEqual({ requestId: 'REQ-NEW', version: 9 })
  })
})
