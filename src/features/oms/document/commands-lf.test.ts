/**
 * The command gate's LOCAL FULFILLMENT arm (spec 759 F2, ticket 760). Its own file so the bonded
 * suite (`commands.test.ts`, spec 289 / ticket 290) stays byte-for-byte unchanged: every case there
 * must keep passing without an edit.
 *
 * The expected reasons are the shipped English, written out here as literals, never re-derived from
 * the JSON the way the code reads it.
 */
import { describe, expect, it } from 'vitest'
import { commandBar, commandGate, commandOf, type CommandContext } from './commands'
import documentEn from '@/locales/en/document.json'
import documentAr from '@/locales/ar/document.json'
import { FSI, PDI } from '@/core/util/bidi'

const resolve = (bundle: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle)

const t = (key: string, options?: Record<string, unknown>): string => {
  const value = resolve(documentEn, key)
  if (typeof value !== 'string') throw new Error(`missing document namespace key: ${key}`)
  return value.replace(/{{(\w+)}}/g, (_, name: string) => String(options?.[name] ?? ''))
}

/** An LF delivery at rest, opened as a delivery, by a session holding 03 and not the bonded grant. */
const LF: CommandContext = {
  closeStatus: '',
  documentCategory: 'J',
  openedAs: 'delivery',
  canReturn: false,
  lines: [],
  busy: false,
  canChangeDetail: true,
  canCreateReturn: false,
  deliveryDocumentType: 'LF',
  returnRefusal: null,
  returnWindowEndsOn: null,
  canCreateLocalFulfillmentReturn: true,
}

const returnOf = (ctx: CommandContext) => commandOf(commandBar(ctx, t), 'return-document')

const BONDED_REASONS = [
  'Open the delivery to return it.',
  'Only bonded deliveries handled by Starlinks can be returned here.',
  'Everything on this delivery has already been returned.',
]

describe('the LF arm of the command gate (ticket 760)', () => {
  it('commandBar leaves Return off an LF delivery without 03 — and still draws it on a bonded delivery with canCreateReturn', () => {
    // Bonded grant only: not drawn on LF.
    expect(returnOf({ ...LF, canCreateReturn: true, canCreateLocalFulfillmentReturn: false })).toBeNull()
    // No grant at all: not drawn.
    expect(returnOf({ ...LF, canCreateLocalFulfillmentReturn: false })).toBeNull()
    // An older probe that sends no LF flag: absent, not drawn.
    const { canCreateLocalFulfillmentReturn: _drop, ...older } = LF
    expect(returnOf({ ...older, canCreateReturn: true })).toBeNull()
    // The rest of the bar is still there for the same session.
    expect(commandOf(commandBar({ ...LF, canCreateLocalFulfillmentReturn: false }, t), 'reschedule')).not.toBeNull()

    // A bonded (non-LF) delivery: the bonded grant draws it, the LF grant does not.
    const bonded: CommandContext = { ...LF, deliveryDocumentType: 'BZ02' }
    expect(returnOf({ ...bonded, canCreateReturn: true, canCreateLocalFulfillmentReturn: false })).not.toBeNull()
    expect(returnOf({ ...bonded, canCreateReturn: false, canCreateLocalFulfillmentReturn: true })).toBeNull()
    // And with no delivery type at all (every capture today) the bonded grant still draws it.
    expect(returnOf({ ...bonded, deliveryDocumentType: undefined, canCreateReturn: true })).not.toBeNull()
  })

  it('reads the LF type case- and space-insensitively, as every server code', () => {
    expect(returnOf({ ...LF, deliveryDocumentType: ' lf ', canCreateReturn: true, canCreateLocalFulfillmentReturn: false })).toBeNull()
    expect(returnOf({ ...LF, deliveryDocumentType: ' lf ' })).not.toBeNull()
  })

  it('commandBar enables LF Return only when canReturn is true — and fails closed when absent', () => {
    expect(returnOf({ ...LF, canReturn: true })).toEqual({ kind: 'return-document', disabled: false, reason: null })
    expect(returnOf({ ...LF, canReturn: false })?.disabled).toBe(true)
    expect(returnOf({ ...LF, canReturn: undefined })?.disabled).toBe(true)
    expect(returnOf({ ...LF, canReturn: null })?.disabled).toBe(true)
    // `canReturn` ALONE: a refusal code beside a true does not disable it.
    expect(returnOf({ ...LF, canReturn: true, returnRefusal: 'returnOpen' })?.disabled).toBe(false)
    // Busy outranks it and carries no reason, as on every command.
    expect(commandGate('return-document', { ...LF, canReturn: true, busy: true })).toEqual({ disabled: true, reasonKey: null })
  })

  it('each LF refusal maps to its own key — plus unknown/absent → the generic one', () => {
    const reason = (returnRefusal: string | null | undefined) => returnOf({ ...LF, returnRefusal })?.reason
    expect(reason('notDelivered')).toBe('This delivery has not reached the customer yet, so it cannot be returned.')
    expect(reason('nothingRemaining')).toBe('Everything on this delivery has already been returned or is being returned.')
    expect(reason('returnOpen')).toBe('A return is already open on this delivery. Only one can be open at a time.')
    expect(returnOf({ ...LF, returnRefusal: 'outsideWindow', returnWindowEndsOn: '2026-11-10' })?.reason).toMatch(
      /^The return window for this delivery closed on /,
    )
    const generic = 'The server will not take a return on this delivery.'
    for (const unknown of ['somethingNew', '', null, undefined]) {
      expect([unknown, reason(unknown)]).toEqual([unknown, generic])
    }
    // Never a bonded reason, whatever the lines or the route say.
    const routed = returnOf({ ...LF, openedAs: 'document', documentCategory: 'X', returnRefusal: undefined })?.reason
    expect(routed).toBe(generic)
    for (const code of ['notDelivered', 'nothingRemaining', 'returnOpen', 'outsideWindow', 'x', null]) {
      expect(BONDED_REASONS).not.toContain(reason(code))
    }
  })

  it('the window refusal carries the end date, isolated whole (a tooltip is a string sink)', () => {
    const reason = returnOf({ ...LF, returnRefusal: 'outsideWindow', returnWindowEndsOn: '2026-11-10' })?.reason
    expect(reason).toBe(`The return window for this delivery closed on ${FSI}2026-11-10${PDI}.`)
    // Without the date the sentence cannot be said; it falls back to the generic one, never "closed on ."
    expect(returnOf({ ...LF, returnRefusal: 'outsideWindow', returnWindowEndsOn: null })?.reason).toBe(
      'The server will not take a return on this delivery.',
    )
  })

  it('every LF reason is shipped in Arabic too', () => {
    for (const key of ['outsideWindow', 'notDelivered', 'nothingRemaining', 'returnOpen', 'refused']) {
      const ar = resolve(documentAr, `command.disabled.lfReturn.${key}`)
      expect([key, typeof ar]).toEqual([key, 'string'])
    }
    expect(resolve(documentAr, 'command.disabled.lfReturn.outsideWindow')).toContain('{{date}}')
  })
})
