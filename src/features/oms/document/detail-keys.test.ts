import { describe, expect, it } from 'vitest'
import type { Command } from '@/core/commands/palette-model'
import documentEn from '@/locales/en/document.json'
import { resolveOpenIntent } from '@/core/oms/open-intent'
import { commandBar, commandOf, surfaceOf, type CommandContext } from './commands'
import { composerState } from './composer'
import { DETAIL_KEYS, detailCommands, keyHints } from './detail-keys'

/** A `document:` key resolved against the shipped JSON — a deleted key fails here, not on screen. */
const shipped = (key: string): string => {
  const [ns, path] = key.split(':')
  expect(ns).toBe('document')
  const value = path
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], documentEn)
  if (typeof value !== 'string') throw new Error(`missing document namespace key: ${key}`)
  return value
}
const t = (key: string) => shipped(`document:${key}`)

const AT_REST: CommandContext = {
  closeStatus: '',
  documentCategory: 'D',
  openedAs: 'delivery',
  canReturn: false,
  lines: [],
  busy: false,
}
const REQUEST_OPEN: CommandContext = { ...AT_REST, closeStatus: 'R' }

const calls: string[] = []
const handlers = {
  back: () => calls.push('back'),
  focusComposer: () => calls.push('composer'),
  command: (kind: string) => calls.push(kind),
}

function build(
  context: CommandContext | null,
  { text = '', posting = false, singleKeyScreen = true } = {},
): Record<string, Command> {
  const commands = detailCommands({ context, composer: composerState(text, posting), singleKeyScreen, ...handlers })
  return Object.fromEntries(commands.map((c) => [c.id, c]))
}

describe('Delivery details keys (spec 380 D10, ticket 405; ruling 365 §6)', () => {
  it('binds R, C, N and Esc on the single-key screen, and every label is shipped copy', () => {
    const commands = build(AT_REST)
    expect(Object.values(commands).map((c) => [c.id, c.keys])).toEqual([
      ['act.reschedule', DETAIL_KEYS.reschedule],
      ['act.request-close', DETAIL_KEYS['request-close']],
      ['composer.focus', DETAIL_KEYS.composer],
      ['back', DETAIL_KEYS.back],
    ])
    expect(DETAIL_KEYS).toEqual({ reschedule: 'KeyR', 'request-close': 'KeyC', composer: 'KeyN', back: 'Escape' })
    for (const c of Object.values(commands)) expect(shipped(c.label)).toBeTruthy()
  })

  it('one label per act: N reads as the bar\'s Add Note…, Esc as the header\'s Back', () => {
    const commands = build(AT_REST)
    expect(commands['composer.focus'].label).toBe('document:actions.add-note')
    expect(commands.back.label).toBe('document:back')
  })

  it('hints R / C / N on the bar and N on the composer only where the letters are bound', () => {
    expect(keyHints(true)).toEqual({
      bar: { reschedule: 'KeyR', 'request-close': 'KeyC', 'add-note': 'KeyN' },
      composer: 'KeyN',
    })
    expect(keyHints(false)).toEqual({ bar: {}, composer: null })
  })

  it('no J/K next/previous delivery, and nothing terminal or hidden', () => {
    const commands = Object.values(build(AT_REST))
    expect(commands.some((c) => c.keys === 'KeyJ' || c.keys === 'KeyK')).toBe(false)
    expect(commands.some((c) => c.terminal || c.hidden)).toBe(false)
  })

  it('off the single-key screen the letters stay palette rows with no key; Esc keeps its key', () => {
    const commands = build(AT_REST, { singleKeyScreen: false })
    expect(commands['act.reschedule'].keys).toBeUndefined()
    expect(commands['act.request-close'].keys).toBeUndefined()
    expect(commands['composer.focus'].keys).toBeUndefined()
    expect(commands.back.keys).toBe('Escape')
  })

  it('before the header loads only Esc is there: the chevron is the way out while it loads', () => {
    expect(Object.keys(build(null))).toEqual(['back'])
  })

  it('N focuses the composer; R and C open their dialogs through the command bar', () => {
    calls.length = 0
    const commands = build(AT_REST)
    commands['composer.focus'].run?.()
    commands['act.reschedule'].run?.()
    commands['act.request-close'].run?.()
    expect(calls).toEqual(['composer', 'reschedule', 'request-close'])
  })

  it("C is refused through the bar's gate with the button's own reason, which the key layer toasts", () => {
    const c = build(REQUEST_OPEN)['act.request-close']
    expect(c.run).toBeNull()
    expect(c.reason).toBe('document:command.disabled.requestOpen')
    expect(shipped(c.reason!)).toBe(commandOf(commandBar(REQUEST_OPEN, t), 'request-close')?.reason)
    expect(build(REQUEST_OPEN)['act.reschedule'].run).toBeTypeOf('function')
  })

  it('a busy page refuses R and C with no reason of its own (the spinner is the reason)', () => {
    const commands = build({ ...AT_REST, busy: true })
    expect(commands['act.reschedule'].run).toBeNull()
    expect(commands['act.reschedule'].reason).toBeNull()
    expect(commands['act.request-close'].run).toBeNull()
  })

  it('Esc goes back from an empty composer, and is refused, with a toast, while it holds unsent text', () => {
    calls.length = 0
    build(AT_REST).back.run?.()
    expect(calls).toEqual(['back'])
    const refused = build(AT_REST, { text: 'Customer called' }).back
    expect(refused.run).toBeNull()
    expect(shipped(refused.reason!)).toBeTruthy()
    expect(build(AT_REST, { text: 'Customer called', posting: true }).back.run).toBeNull()
  })
})

describe('the add-note intent focuses the composer; reschedule and request-close still open their dialogs', () => {
  const bar = commandBar(AT_REST, t)
  const gate = (kind: Parameters<typeof commandOf>[1]) => commandOf(bar, kind)

  it('each intent the list sends lands on the surface its button opens', () => {
    const landed = (['add-note', 'reschedule', 'request-close'] as const).map((intent) => {
      const resolved = resolveOpenIntent(intent, gate)
      return resolved?.outcome === 'open' ? [intent, surfaceOf(resolved.intent)] : [intent, null]
    })
    expect(landed).toEqual([
      ['add-note', 'composer'],
      ['reschedule', 'dialog'],
      ['request-close', 'dialog'],
    ])
  })

  it('the other note-carrying commands keep their notes inside their own dialogs', () => {
    expect(surfaceOf('close')).toBe('dialog')
    expect(surfaceOf('force-close')).toBe('dialog')
    expect(surfaceOf('cancel-close-request')).toBe('dialog')
    expect(surfaceOf('change-store')).toBe('dialog')
    expect(surfaceOf('return-document')).toBe('dialog')
  })
})
