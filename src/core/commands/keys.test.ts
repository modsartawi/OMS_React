/**
 * A key is a field on a command (ticket 393, spec 380 K2–K3, K17; ruling 365 §1, §10):
 * what the registry refuses, how a press names its key, and the legend a key's hint
 * shows.
 */
import { describe, expect, it } from 'vitest'
import {
  ariaKeyShortcuts,
  bindKeys,
  boundKeysOf,
  eventKeys,
  keyRefusal,
  legendOf,
  legendText,
  parseKeys,
  tierOf,
} from './keys'
import type { Command } from './palette-model'

const LIST = { singleKeyScreen: true }
const cmd = (id: string, keys?: string, over: Partial<Command> = {}): Command => ({
  id,
  label: `test:${id}`,
  keys,
  run: () => {},
  ...over,
})

describe('registryRefusesReservedAndCollidingKeys', () => {
  it('refuses any Alt chord', () => {
    expect(keyRefusal('Alt+KeyR', LIST)).toBe('alt')
    expect(keyRefusal('Ctrl+Alt+Enter', LIST)).toBe('alt')
  })

  it('refuses any Ctrl chord but a screen’s Ctrl+Enter — Ctrl+K is the core’s', () => {
    expect(keyRefusal('Ctrl+KeyS', LIST)).toBe('ctrl')
    expect(keyRefusal('Ctrl+Shift+Enter', LIST)).toBe('ctrl')
    expect(keyRefusal('Ctrl+KeyK', LIST)).toBe('core')
    expect(keyRefusal('Ctrl+Enter', LIST)).toBeNull()
  })

  it('refuses AG Grid’s own keys, so the grid and native copy keep them', () => {
    for (const keys of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Tab', 'Space', 'Enter', 'PageUp', 'PageDown', 'Home', 'End', 'Ctrl+KeyA', 'Ctrl+KeyC'])
      expect([keys, keyRefusal(keys, LIST)]).toEqual([keys, 'grid'])
  })

  it('refuses `?`, which is the core’s shortcuts sheet', () => {
    expect(keyRefusal('Shift+Slash', LIST)).toBe('core')
  })

  it('takes a letter, `/`, Esc and Ctrl+Enter — and nothing else', () => {
    for (const keys of ['KeyR', 'KeyJ', 'Slash', 'Escape']) expect(keyRefusal(keys, LIST)).toBeNull()
    expect(keyRefusal('Digit1', LIST)).toBe('unsupported')
    expect(keyRefusal('Shift+KeyR', LIST)).toBe('unsupported')
    expect(keyRefusal('F5', LIST)).toBe('unsupported')
    expect(keyRefusal('Meta+KeyR', LIST)).toBe('malformed')
    expect(keyRefusal('', LIST)).toBe('malformed')
  })

  it('refuses a letter or `/` off the single-key screens (365 §2), but not Esc or Ctrl+Enter', () => {
    const elsewhere = { singleKeyScreen: false }
    expect(keyRefusal('KeyR', elsewhere)).toBe('single-key-screen')
    expect(keyRefusal('Slash', elsewhere)).toBe('single-key-screen')
    expect(keyRefusal('Escape', elsewhere)).toBeNull()
    expect(keyRefusal('Ctrl+Enter', elsewhere)).toBeNull()
  })

  it('a second command on an already-bound key is refused, and the first binding wins', () => {
    const first = cmd('reschedule', 'KeyR')
    const second = cmd('refresh', 'KeyR')
    const { bound, refused } = bindKeys([first, second], LIST)
    expect(bound.get('KeyR')).toBe(first)
    expect(refused).toEqual([{ command: second, keys: 'KeyR', refusal: 'collision' }])
    expect(boundKeysOf(first, { bound, refused })).toBe('KeyR')
    expect(boundKeysOf(second, { bound, refused })).toBeNull()
  })

  // 395, ruling 365 §7: a terminal act is never one key away — not even Ctrl+Enter.
  it('registryRefusesKeysOnTerminalCommand', () => {
    const place = cmd('place', 'Ctrl+Enter', { terminal: true })
    const { bound, refused } = bindKeys([place], LIST)
    expect(bound.size).toBe(0)
    expect(refused).toEqual([{ command: place, keys: 'Ctrl+Enter', refusal: 'terminal' }])
    expect(boundKeysOf(place, { bound, refused })).toBeNull()
    // Refused on any key, and before a collision is even considered.
    const first = cmd('note', 'Escape')
    const abandon = cmd('abandon', 'Escape', { terminal: true })
    expect(bindKeys([first, abandon], LIST).refused.map((r) => r.refusal)).toEqual(['terminal'])
  })

  it('every refusal is reported and binds nothing; a command with no key is simply unbound', () => {
    const { bound, refused } = bindKeys(
      [cmd('alt', 'Alt+KeyR'), cmd('save', 'Ctrl+KeyS'), cmd('down', 'ArrowDown'), cmd('space', 'Space'), cmd('plain')],
      LIST,
    )
    expect(bound.size).toBe(0)
    expect(refused.map((r) => [r.command.id, r.refusal])).toEqual([
      ['alt', 'alt'],
      ['save', 'ctrl'],
      ['down', 'grid'],
      ['space', 'grid'],
    ])
  })
})

describe('eventKeys', () => {
  const press = (over: Partial<Parameters<typeof eventKeys>[0]>) => ({
    key: 'r',
    code: 'KeyR',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...over,
  })

  it('names a letter by its code, whatever character `key` holds (an Arabic layout)', () => {
    expect(eventKeys(press({ key: 'ق' }))).toBe('KeyR')
    expect(eventKeys(press({ key: 'ت', code: 'KeyJ' }))).toBe('KeyJ')
  })

  it('names Enter and Escape by `key` — the numpad’s Enter included — and Meta as Ctrl', () => {
    expect(eventKeys(press({ key: 'Enter', code: 'NumpadEnter', metaKey: true }))).toBe('Ctrl+Enter')
    expect(eventKeys(press({ key: 'Escape', code: 'Escape' }))).toBe('Escape')
    expect(eventKeys(press({ key: '?', code: 'Slash', shiftKey: true }))).toBe('Shift+Slash')
  })

  it('a press with no code names nothing', () => {
    expect(eventKeys(press({ key: 'Unidentified', code: '' }))).toBeNull()
  })
})

describe('tierOf', () => {
  it('Ctrl is a chord, Escape is Esc, a letter or symbol is a single key', () => {
    expect(tierOf('Ctrl+Enter')).toBe('chord')
    expect(tierOf('Ctrl+KeyK')).toBe('chord')
    expect(tierOf('Escape')).toBe('esc')
    expect(tierOf('KeyR')).toBe('single')
    expect(tierOf('Shift+Slash')).toBe('single')
  })
})

describe('legendDerivesFromCode', () => {
  it('a letter’s Latin legend comes from its code — data, not a translation', () => {
    expect(legendOf('KeyR')).toEqual([{ cap: 'R' }])
    expect(legendOf('KeyJ')).toEqual([{ cap: 'J' }])
  })

  it('`Slash` is `/`, and Shift+`Slash` is the one cap `?`', () => {
    expect(legendOf('Slash')).toEqual([{ cap: '/' }])
    expect(legendOf('Shift+Slash')).toEqual([{ cap: '?' }])
  })

  it('named keys go through their i18n key, in chord order', () => {
    expect(legendOf('Ctrl+Enter')).toEqual([{ named: 'common:keys.ctrl' }, { named: 'common:keys.enter' }])
    expect(legendOf('Escape')).toEqual([{ named: 'common:keys.esc' }])
    expect(legendOf('Ctrl+KeyK')).toEqual([{ named: 'common:keys.ctrl' }, { cap: 'K' }])
    expect(legendOf('Shift+KeyR')).toEqual([{ named: 'common:keys.shift' }, { cap: 'R' }])
  })

  it('legendText resolves the named caps and keeps the Latin ones', () => {
    const t = (key: string) => `<${key}>`
    expect(legendText('Ctrl+Enter', t)).toBe('<common:keys.ctrl>+<common:keys.enter>')
    expect(legendText('KeyR', t)).toBe('R')
  })

  it('`aria-keyshortcuts` uses WAI-ARIA’s names', () => {
    expect(ariaKeyShortcuts('KeyR')).toBe('R')
    expect(ariaKeyShortcuts('Ctrl+Enter')).toBe('Control+Enter')
    expect(ariaKeyShortcuts('Shift+Slash')).toBe('Shift+?')
    expect(ariaKeyShortcuts('Slash')).toBe('/')
    expect(ariaKeyShortcuts('Escape')).toBe('Escape')
  })
})

describe('parseKeys', () => {
  it('reads modifiers in any order, and refuses an unknown or repeated one', () => {
    expect(parseKeys('Shift+Ctrl+Enter')).toEqual({ ctrl: true, alt: false, shift: true, base: 'Enter' })
    expect(parseKeys('Ctrl+Ctrl+Enter')).toBeNull()
    expect(parseKeys('Hyper+KeyR')).toBeNull()
    expect(parseKeys('Ctrl')).toBeNull()
  })
})
