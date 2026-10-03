/**
 * The shortcuts sheet is generated from the registry (ticket 393, spec 380 K16): the
 * app-wide keys, then the mounted screen's BOUND commands — hidden ones included,
 * refused ones not.
 */
import { describe, expect, it } from 'vitest'
import type { Command } from './palette-model'
import { appWideLines, screenLines } from './shortcuts-sheet'

const cmd = (id: string, keys?: string, over: Partial<Command> = {}): Command => ({ id, label: `t:${id}`, keys, ...over })

describe('appWideLines', () => {
  it('lists Ctrl+K, `?` and Esc on a single-key screen', () => {
    expect(appWideLines({ singleKeyScreen: true }).map((l) => l.keys)).toEqual(['Ctrl+KeyK', 'Shift+Slash', 'Escape'])
  })

  it('leaves `?` out where it is not live', () => {
    expect(appWideLines({ singleKeyScreen: false }).map((l) => l.keys)).toEqual(['Ctrl+KeyK', 'Escape'])
  })
})

describe('screenLines', () => {
  it('lists every bound command in registration order — a hidden one (J/K) included', () => {
    const lines = screenLines(
      [cmd('next', 'KeyJ', { hidden: true }), cmd('reschedule', 'KeyR'), cmd('back', 'Escape'), cmd('export')],
      { singleKeyScreen: true },
    )
    expect(lines.map((l) => [l.id, l.keys])).toEqual([
      ['next', 'KeyJ'],
      ['reschedule', 'KeyR'],
      ['back', 'Escape'],
    ])
  })

  it('🚩 never lists a key the registry refused — a collision, or a letter off a single-key screen', () => {
    expect(screenLines([cmd('a', 'KeyR'), cmd('b', 'KeyR')], { singleKeyScreen: true }).map((l) => l.id)).toEqual(['a'])
    expect(screenLines([cmd('a', 'KeyR'), cmd('run', 'Ctrl+Enter')], { singleKeyScreen: false }).map((l) => l.id)).toEqual(['run'])
  })
})
