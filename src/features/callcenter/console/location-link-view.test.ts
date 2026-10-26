/**
 * The waiting strip's reading of a location link (574, BackOffice spec 2482, contract v1.12
 * §2/§5): the server's status plus the console's own clock in, the one strip state out.
 *
 * Every expected value here is a literal worked from the contract's timings — 15 minutes of
 * link, a 30 s Resend cooldown counted client-side, a 3 s poll, and the "can't reach the
 * server" note after 30 s of continuous failure.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import {
  formatClock,
  mobileWasTyped,
  chipAfter,
  discardRefusal,
  resendSteps,
  pollRefusal,
  resendCooldownSeconds,
  sendBody,
  sendRefusal,
  shouldRetire,
  showsSendAction,
  stripAct,
  stripView,
  type StripInput,
} from './location-link-view'

const T0 = 1_760_000_000_000

const input = (over: Partial<StripInput> = {}): StripInput => ({
  sentAt: T0,
  sentSecondsLeft: 900,
  read: null,
  failingSince: null,
  now: T0,
  ...over,
})

describe('formatClock', () => {
  it('writes whole minutes and seconds as mm:ss', () => {
    expect(formatClock(900)).toBe('15:00')
    expect(formatClock(605)).toBe('10:05')
    expect(formatClock(59)).toBe('00:59')
    expect(formatClock(0)).toBe('00:00')
  })

  it('never goes below zero and drops a fraction rather than rounding up', () => {
    expect(formatClock(-4)).toBe('00:00')
    expect(formatClock(61.9)).toBe('01:01')
  })
})

describe('stripView — waiting', () => {
  it('counts down from the send answer before the first poll lands', () => {
    const view = stripView(input({ now: T0 + 5_000 }))
    expect(view).toMatchObject({ kind: 'waiting', clock: '14:55', polling: true })
  })

  it('takes the latest status read as the clock, the server being the clock that matters', () => {
    // The server says 870 s at T0+28s; two seconds later the strip reads 14:28.
    const view = stripView(
      input({ read: { status: 'Live', secondsLeft: 870, at: T0 + 28_000 }, now: T0 + 30_000 }),
    )
    expect(view).toMatchObject({ kind: 'waiting', clock: '14:28' })
  })

  it('never counts up when the shared clock last ticked before the send landed', () => {
    // The 1 s clock's snapshot may trail the moment the Send answer was stamped.
    const view = stripView(input({ now: T0 - 400 }))
    expect(view).toMatchObject({ kind: 'waiting', clock: '15:00' })
  })

  it('holds at 00:00 while the server has not yet said the link lapsed', () => {
    const view = stripView(input({ now: T0 + 901_000 }))
    expect(view).toMatchObject({ kind: 'waiting', clock: '00:00', polling: true })
  })
})

describe('stripView — the server has decided', () => {
  it('reads Lapsed as expired, and stops polling', () => {
    const view = stripView(input({ read: { status: 'Lapsed', secondsLeft: 0, at: T0 + 900_000 }, now: T0 + 900_500 }))
    expect(view).toMatchObject({ kind: 'expired', clock: null, polling: false })
  })

  it('reads Superseded as replaced, and stops polling', () => {
    const view = stripView(input({ read: { status: 'Superseded', secondsLeft: 0, at: T0 + 3_000 }, now: T0 + 3_000 }))
    expect(view).toMatchObject({ kind: 'replaced', clock: null, polling: false })
  })

  it('reads Captured as received, and stops polling', () => {
    const view = stripView(input({ read: { status: 'Captured', secondsLeft: 0, at: T0 + 60_000 }, now: T0 + 60_000 }))
    expect(view).toMatchObject({ kind: 'received', clock: null, polling: false })
  })
})

describe('stripView — the 30 s unreachable rule', () => {
  it('keeps the countdown through 29 s of continuous failure', () => {
    const view = stripView(input({ failingSince: T0 + 3_000, now: T0 + 32_999 }))
    expect(view).toMatchObject({ kind: 'waiting', clock: '14:28', polling: true })
  })

  it('says it cannot reach the server once the failing has lasted 30 s, and keeps polling', () => {
    const view = stripView(input({ failingSince: T0 + 3_000, now: T0 + 33_000 }))
    expect(view).toMatchObject({ kind: 'unreachable', clock: null, polling: true })
  })

  it('never hides a decided status behind the note', () => {
    const view = stripView(
      input({
        read: { status: 'Lapsed', secondsLeft: 0, at: T0 + 1_000 },
        failingSince: T0 + 3_000,
        now: T0 + 60_000,
      }),
    )
    expect(view.kind).toBe('expired')
  })
})

describe('Resend cooldown', () => {
  it('is 30 s from the console’s own last send, shown as whole seconds rounded up', () => {
    expect(resendCooldownSeconds(T0, T0)).toBe(30)
    expect(resendCooldownSeconds(T0, T0 + 200)).toBe(30)
    expect(resendCooldownSeconds(T0, T0 + 1_000)).toBe(29)
    expect(resendCooldownSeconds(T0, T0 + 29_001)).toBe(1)
    expect(resendCooldownSeconds(T0, T0 + 30_000)).toBe(0)
    expect(resendCooldownSeconds(T0, T0 + 95_000)).toBe(0)
  })

  it('rides on the strip view', () => {
    expect(stripView(input({ now: T0 + 12_000 })).resendIn).toBe(18)
    expect(stripView(input({ now: T0 + 45_000 })).resendIn).toBe(0)
  })
})

describe('mobileWasTyped', () => {
  it('is false for the customer’s own number, in any spelling of it', () => {
    expect(mobileWasTyped('0551234567', '0551234567')).toBe(false)
    expect(mobileWasTyped('0551234567', '966551234567')).toBe(false)
    expect(mobileWasTyped('0551234567', '+966 55 123 4567')).toBe(false)
    expect(mobileWasTyped('0551234567', '00966551234567')).toBe(false)
    expect(mobileWasTyped('0551234567', ' 055 123 4567 ')).toBe(false)
    expect(mobileWasTyped('966551234567', '0551234567')).toBe(false)
    expect(mobileWasTyped('0551234567', '551234567')).toBe(false)
    expect(mobileWasTyped('0551234567', '٠٥٥١٢٣٤٥٦٧')).toBe(false)
    expect(mobileWasTyped('0551234567', '055-123-4567')).toBe(false)
  })

  it('is true for another number', () => {
    expect(mobileWasTyped('0551234567', '0551234568')).toBe(true)
    expect(mobileWasTyped('0551234567', '966501234567')).toBe(true)
  })

  it('is true for any number when the order has no customer mobile', () => {
    expect(mobileWasTyped(null, '0551234567')).toBe(true)
    expect(mobileWasTyped('', '0551234567')).toBe(true)
  })
})

describe('sendBody', () => {
  it('is the contract’s four fields, the order in progress being the session’s transactionId', () => {
    expect(sendBody('01JC0TX', '0551234567', '0551234567')).toEqual({
      seatKind: 'OMSWEB',
      orderContextId: '01JC0TX',
      mobile: '0551234567',
      mobileWasTyped: false,
    })
  })

  it('sends a typed number as typed (trimmed) — the server validates and normalises it', () => {
    expect(sendBody('01JC0TX', '0551234567', ' 0509876543 ')).toEqual({
      seatKind: 'OMSWEB',
      orderContextId: '01JC0TX',
      mobile: '0509876543',
      mobileWasTyped: true,
    })
  })

  it('sends the customer’s number re-spelled as not typed', () => {
    expect(sendBody('01JC0TX', '0551234567', '+966551234567').mobileWasTyped).toBe(false)
  })
})

describe('showsSendAction', () => {
  const caps = { canAddItem: true, canSubmit: false, canChangeStore: true, canOpenAddressBook: true, submitBlockers: [] }

  it('shows the action only while the server says canSendLocationLink', () => {
    expect(showsSendAction({ ...caps, canSendLocationLink: true })).toBe(true)
    expect(showsSendAction({ ...caps, canSendLocationLink: false })).toBe(false)
  })

  it('hides it on a pre-1.12 server that sends no capability', () => {
    expect(showsSendAction(caps)).toBe(false)
  })
})

describe('sendRefusal', () => {
  const refused = (code: string, message: string) =>
    new ApiError('business', message, 400, [{ errorCode: code, internalErrorCode: '', errorMessage: message }])

  it('draws an invalid mobile inline at the number, in the validator’s own words', () => {
    expect(sendRefusal(refused('CCL-00004', 'Mobile number is not valid.'))).toEqual({
      at: 'mobile',
      text: 'Mobile number is not valid.',
    })
  })

  it('shows the cooldown’s server message in the dialog — it holds the seconds left', () => {
    expect(sendRefusal(refused('CCL-00008', 'Wait 12 seconds before sending another link.'))).toEqual({
      at: 'dialog',
      text: 'Wait 12 seconds before sending another link.',
    })
  })

  it('words the two send limits itself, in the dialog', () => {
    expect(sendRefusal(refused('CCL-00009', 'Limit reached.'))).toEqual({ at: 'dialog', key: 'location.refused.orderLimit' })
    expect(sendRefusal(refused('CCL-00020', 'Limit reached.'))).toEqual({
      at: 'dialog',
      key: 'location.refused.mobileDailyLimit',
    })
  })

  it('marks not-configured as hiding the action', () => {
    expect(sendRefusal(refused('CCL-00001', 'Not configured.'))).toEqual({ at: 'hide' })
  })

  it('keeps the server’s sentence for anything else, and a generic line when there is none', () => {
    expect(sendRefusal(refused('CCL-00005', 'Unknown caller.'))).toEqual({ at: 'dialog', text: 'Unknown caller.' })
    expect(sendRefusal(new Error('boom'))).toEqual({ at: 'dialog', key: 'location.send.failed' })
  })
})

describe('shouldRetire', () => {
  const caps = (canSendLocationLink?: boolean) => ({
    capabilities: { canAddItem: true, canSubmit: true, canChangeStore: true, canOpenAddressBook: true, submitBlockers: [], canSendLocationLink },
  })

  it('retires an order that could send a link, or that this tab sent one on', () => {
    expect(shouldRetire(caps(true), false)).toBe(true)
    expect(shouldRetire(caps(false), true)).toBe(true)
  })

  it('retires an order this tab never read — another tab may have sent it a link', () => {
    expect(shouldRetire(undefined, false)).toBe(true)
  })

  it('does not call Retire for an order that never could have had a link', () => {
    expect(shouldRetire(caps(false), false)).toBe(false)
    expect(shouldRetire(caps(undefined), false)).toBe(false)
  })
})

describe('pollRefusal — a status poll that answered, but with a refusal', () => {
  const refused = (code: string) =>
    new ApiError('business', 'Refused.', 400, [{ errorCode: code, internalErrorCode: '', errorMessage: 'Refused.' }])

  it('CCL-00006 (no such link, or not yours) drops the link and offers Send again — it is not a failed poll', () => {
    expect(pollRefusal(refused('CCL-00006'))).toBe('gone')
  })

  it('CCL-00001 (not configured) hides the action', () => {
    expect(pollRefusal(refused('CCL-00001'))).toBe('hide')
  })

  it('anything else is a failed poll, retried quietly at the same pace', () => {
    expect(pollRefusal(refused('CCL-00005'))).toBe('failed')
    expect(pollRefusal(new ApiError('network', 'offline', 0))).toBe('failed')
    expect(pollRefusal(new Error('boom'))).toBe('failed')
  })
})

describe('576 — card → discarded → Send again', () => {
  const refused = (code: string, message = 'Refused.') =>
    new ApiError('business', message, 400, [{ errorCode: code, internalErrorCode: '', errorMessage: message }])

  it('offers Send again, and only Send again, on a discarded strip', () => {
    expect(stripAct('discarded')).toBe('sendAgain')
  })

  it('offers Resend on a live strip and Send again on every dead one', () => {
    expect(stripAct('waiting')).toBe('resend')
    expect(stripAct('unreachable')).toBe('resend')
    expect(stripAct('expired')).toBe('sendAgain')
    expect(stripAct('replaced')).toBe('sendAgain')
    expect(stripAct('gone')).toBe('sendAgain')
    expect(stripAct('received')).toBeNull()
  })

  it('re-reads the session when the capture was already stamped (CCL-00031)', () => {
    expect(discardRefusal(refused('CCL-00031'))).toEqual({ at: 'refetch' })
  })

  it("drops the card for a link that is no longer the agent's, and hides on not configured", () => {
    expect(discardRefusal(refused('CCL-00006'))).toEqual({ at: 'gone' })
    expect(discardRefusal(refused('CCL-00001'))).toEqual({ at: 'hide' })
  })

  it("keeps the card and says the server's sentence on anything else, the console's when it gave none", () => {
    expect(discardRefusal(refused('CCL-00005', 'Caller unknown.'))).toEqual({ at: 'card', text: 'Caller unknown.' })
    expect(discardRefusal(new ApiError('network', '', 0))).toEqual({ at: 'card', key: 'location.card.discardFailed' })
  })
})

describe('576 — never two cards: what Resend does from each face', () => {
  it('asks first, then stamps the discard, then sends — over an unapplied card', () => {
    expect(resendSteps('card')).toEqual(['confirm', 'discard', 'send'])
  })

  it('sends at once over the chip: the new card compares against values that include the first capture', () => {
    expect(resendSteps('chip')).toEqual(['send'])
  })

  it('sends at once from a live strip, where there is no capture to lose', () => {
    expect(resendSteps('strip')).toEqual(['send'])
  })
})

describe('576 — chip + address change → cleared', () => {
  it('remembers the address the chip was first shown on', () => {
    expect(chipAfter(null, '77120')).toEqual({ addressNumber: '77120', cleared: false })
  })

  it('stays applied while the order keeps that address, whatever its pin now reads', () => {
    expect(chipAfter({ addressNumber: '77120', cleared: false }, '77120')).toEqual({ addressNumber: '77120', cleared: false })
  })

  it('reads cleared once the order is on another address — the pin went with the old one', () => {
    expect(chipAfter({ addressNumber: '77120', cleared: false }, '77121')).toEqual({ addressNumber: '77120', cleared: true })
  })

  it('stays cleared when the agent goes back: the book row refills its own pin, not the capture', () => {
    expect(chipAfter({ addressNumber: '77120', cleared: true }, '77120')).toEqual({ addressNumber: '77120', cleared: true })
  })

  it('reads cleared when the address is taken off the order', () => {
    expect(chipAfter({ addressNumber: '77120', cleared: false }, null)).toEqual({ addressNumber: '77120', cleared: true })
  })
})
