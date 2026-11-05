/**
 * Force refund's pure rules (spec 759 F5, ticket 763; BackOffice 3369 D13, door 3375): the received
 * quantity clamp, the submit gate, the request body (never money) and when the action is offered.
 * Expected values are literals written from the ticket and the shipped English, never re-derived.
 */
import { describe, expect, it } from 'vitest'
import documentEn from '@/locales/en/document.json'
import documentAr from '@/locales/ar/document.json'
import type { LfReturnDetailModel } from '@/core/models/lf-return'
import {
  createHeldRequestIds,
  buildForceRefundRequest,
  clampReceivedQuantity,
  forceRefundAction,
  forceRefundGate,
  forceRefundLines,
  pressRequestId,
} from './force-refund'

const resolve = (bundle: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle)
const en = (key: string) => resolve(documentEn, key)
const ar = (key: string) => resolve(documentAr, key)

describe('received quantity clamps to 0..asked', () => {
  it.each([
    ['a negative number → 0', -3, 4, 0],
    ['a negative typed string → 0', '-1', 4, 0],
    ['a fractional number → its whole part (never pays for a part not received)', 2.7, 4, 2],
    ['a fractional typed string → its whole part', '1.5', 4, 1],
    ['above asked → asked', 9, 4, 4],
    ['above asked typed → asked', '12', 4, 4],
    ['zero stays zero (nothing arrived is a statement)', 0, 4, 0],
    ['inside the range stays', '3', 4, 3],
    ['typed with spaces', ' 2 ', 4, 2],
  ])('%s', (_name, value, asked, expected) => {
    expect(clampReceivedQuantity(value, asked)).toBe(expected)
  })

  it.each([
    ['an empty box', ''],
    ['spaces only', '   '],
    ['null', null],
    ['undefined', undefined],
    ['a word', 'two'],
    ['NaN', Number.NaN],
  ])('blank — %s — is not stated (null), never a guessed 0', (_name, value) => {
    expect(clampReceivedQuantity(value, 4)).toBeNull()
  })

  it('an asked quantity the server did not send caps at 0 — nothing can be paid for an unknown ask', () => {
    expect(clampReceivedQuantity(3, null)).toBe(0)
    expect(clampReceivedQuantity(3, Number.NaN)).toBe(0)
  })
})

const watch = (outcome: string, lines = [
  { itemNumber: '000010', sku: '100200300', quantityAsked: 2 },
  { itemNumber: '000020', sku: '100200400', quantityAsked: 1 },
]): LfReturnDetailModel => ({ outcome, lines })

describe('the force-refund rows', () => {
  it('one row per line, asked as the cap, nothing typed', () => {
    expect(forceRefundLines(watch('unanswered'))).toEqual([
      { itemNumber: '000010', sku: '100200300', asked: 2 },
      { itemNumber: '000020', sku: '100200400', asked: 1 },
    ])
  })
})

describe('the submit gate needs every line stated and a reason', () => {
  const rows = forceRefundLines(watch('unanswered'))

  it('nothing typed: names the lines still to state', () => {
    const gate = forceRefundGate(rows, {}, 'Starlinks never answered')
    expect(gate.ok).toBe(false)
    expect(gate.key).toBe('lfReturn.force.gate.stateEveryLine')
    expect(gate.params).toEqual({ count: 2 })
    expect(en('lfReturn.force.gate.stateEveryLine_one')).toBe('State what was received on <n>{{count}}</n> more line.')
    expect(en('lfReturn.force.gate.stateEveryLine_other')).toBe('State what was received on <n>{{count}}</n> more lines.')
  })

  it('one line left blank still blocks — a 0 is a statement, a blank is not', () => {
    const gate = forceRefundGate(rows, { '000010': 0 }, 'reason')
    expect(gate).toMatchObject({ ok: false, key: 'lfReturn.force.gate.stateEveryLine', params: { count: 1 } })
  })

  it('every line stated but no reason: asks for the reason', () => {
    for (const reason of ['', '   ', '\n\t']) {
      const gate = forceRefundGate(rows, { '000010': 2, '000020': 0 }, reason)
      expect(gate).toEqual({ ok: false, key: 'lfReturn.force.gate.reasonRequired' })
    }
    expect(en('lfReturn.force.gate.reasonRequired')).toBe('Give the reason for forcing the refund.')
  })

  it('every line stated (zeros included) and a reason: ready', () => {
    const gate = forceRefundGate(rows, { '000010': 0, '000020': 0 }, 'Customer handed over nothing')
    expect(gate).toEqual({ ok: true, key: 'lfReturn.force.gate.ready', params: { count: 2 } })
    expect(en('lfReturn.force.gate.ready_other')).toBe('<n>{{count}}</n> lines stated. The server computes the refund.')
  })

  it('a watch with no lines can never be submitted', () => {
    expect(forceRefundGate([], {}, 'reason')).toEqual({ ok: false, key: 'lfReturn.force.gate.noLines' })
  })

  it('every gate key exists in en and ar', () => {
    for (const key of ['stateEveryLine_one', 'stateEveryLine_other', 'reasonRequired', 'ready_one', 'ready_other', 'noLines']) {
      expect(typeof en(`lfReturn.force.gate.${key}`)).toBe('string')
      expect(typeof ar(`lfReturn.force.gate.${key}`)).toBe('string')
    }
  })
})

describe('the request body carries quantities, reason and requestId, and no amount', () => {
  const rows = forceRefundLines(watch('short'))
  const body = buildForceRefundRequest({
    returnDeliveryNo: '9000000105',
    rows,
    received: { '000010': 1, '000020': 0 },
    reason: '  Starlinks never answered; customer handed over one pack.  ',
    requestId: 'req-1',
  })

  it('is exactly the 3375 verb, in row order, the reason trimmed', () => {
    expect(body).toEqual({
      returnDeliveryNo: '9000000105',
      lines: [
        { itemNumber: '000010', receivedQuantity: 1 },
        { itemNumber: '000020', receivedQuantity: 0 },
      ],
      reason: 'Starlinks never answered; customer handed over one pack.',
      requestId: 'req-1',
    })
  })

  it('re-clamps on the way out — the keyboard is no way past asked', () => {
    const over = buildForceRefundRequest({ returnDeliveryNo: '9', rows, received: { '000010': 9, '000020': -2 }, reason: 'r', requestId: 'x' })
    expect(over.lines).toEqual([
      { itemNumber: '000010', receivedQuantity: 2 },
      { itemNumber: '000020', receivedQuantity: 0 },
    ])
  })

  it('puts NO amount on the wire — a whole-body walk', () => {
    const keys: string[] = []
    const numbers: number[] = []
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(walk)
      if (typeof value === 'number') return void numbers.push(value)
      if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          keys.push(key)
          walk(child)
        }
      }
    }
    walk(JSON.parse(JSON.stringify(body)))
    const money = /price|amount|discount|vat|tax|total|charge|refund|money|cost|rate|net|gross|value/i
    expect(keys.filter((key) => money.test(key))).toEqual([])
    // Every key on the wire, and nothing else.
    expect([...new Set(keys)].sort()).toEqual(['itemNumber', 'lines', 'reason', 'receivedQuantity', 'requestId', 'returnDeliveryNo'])
    // The only numbers are the received quantities.
    expect(numbers).toEqual([1, 0])
  })
})

describe('the requestId is minted per press; a retry of an unanswered press reuses it', () => {
  let n = 0
  const mint = () => `id-${++n}`

  it('a first press mints', () => {
    n = 0
    expect(pressRequestId(null, mint)).toBe('id-1')
  })

  it('a press while an unanswered id is held reuses it and mints nothing', () => {
    n = 0
    expect(pressRequestId('held-7', mint)).toBe('held-7')
    expect(n).toBe(0)
  })
})

describe('the unanswered requestId is held per return delivery, across a dialog close', () => {
  const minter = () => {
    let n = 0
    return { mint: () => `id-${++n}`, count: () => n }
  }

  it('a first press mints and holds it', () => {
    const held = createHeldRequestIds()
    const m = minter()
    expect(held.press('9000000105', m.mint)).toBe('id-1')
    expect(held.held('9000000105')).toBe('id-1')
  })

  it('a press after an unanswered one — even from a reopened dialog — reuses the held id and mints nothing', () => {
    const held = createHeldRequestIds()
    const m = minter()
    const first = held.press('9000000105', m.mint)
    // The dialog closes and reopens: nothing is dropped, because nothing answered.
    expect(held.press('9000000105', m.mint)).toBe(first)
    expect(m.count()).toBe(1)
  })

  it('an answer (success or business refusal) drops it: the next press is a new request', () => {
    const held = createHeldRequestIds()
    const m = minter()
    const first = held.press('9000000105', m.mint)
    held.answered('9000000105')
    expect(held.held('9000000105')).toBeNull()
    const second = held.press('9000000105', m.mint)
    expect(second).not.toBe(first)
  })

  it('each return delivery holds its own id', () => {
    const held = createHeldRequestIds()
    const m = minter()
    const a = held.press('9000000105', m.mint)
    const b = held.press('9000000103', m.mint)
    expect(a).not.toBe(b)
    held.answered('9000000103')
    expect(held.held('9000000105')).toBe(a)
  })
})

describe('Force refund is absent without 04 and disabled on refunded/forced', () => {
  it('absent without 04, whatever the outcome', () => {
    for (const outcome of ['open', 'unanswered', 'short', 'nothingReceived', 'refunded', 'forced']) {
      expect(forceRefundAction(false, outcome)).toEqual({ shown: false })
      expect(forceRefundAction(undefined, outcome)).toEqual({ shown: false })
    }
  })

  it.each(['open', 'unanswered', 'short', 'nothingReceived'])('with 04 on %s: shown and enabled', (outcome) => {
    expect(forceRefundAction(true, outcome)).toEqual({ shown: true, disabled: false })
  })

  it.each([
    ['refunded', 'This return is already refunded.'],
    ['forced', 'This return was already force-refunded.'],
  ])('with 04 on %s: shown, disabled, with its reason', (outcome, sentence) => {
    const action = forceRefundAction(true, ` ${outcome} `)
    expect(action).toEqual({ shown: true, disabled: true, reasonKey: `lfReturn.force.disabled.${outcome}` })
    expect(en(`lfReturn.force.disabled.${outcome}`)).toBe(sentence)
    expect(typeof ar(`lfReturn.force.disabled.${outcome}`)).toBe('string')
  })

  it("with 04 on 3369's prose spelling nothing-received: shown and enabled, as nothingReceived", () => {
    expect(forceRefundAction(true, 'nothing-received')).toEqual({ shown: true, disabled: false })
    expect(forceRefundAction(true, ' nothing-received ')).toEqual(forceRefundAction(true, 'nothingReceived'))
  })

  it('with 04 on an outcome the client has not learned: disabled, never a guess with money', () => {
    expect(forceRefundAction(true, 'somethingNew')).toEqual({ shown: true, disabled: true, reasonKey: 'lfReturn.force.disabled.unknown' })
    expect(en('lfReturn.force.disabled.unknown')).toBe('This return is in a state this screen does not know, so it cannot be forced here.')
  })
})
