import { describe, expect, it } from 'vitest'
import { bindKeys, keyRefusal } from '@/core/commands/keys'
import simulationEn from '@/locales/en/simulation.json'
import { PROCESS_KEYS, processCommand, processRefusal } from './process-command'

/** A `simulation:` key resolved against the shipped JSON — a deleted key fails here, not on screen. */
const shipped = (key: string): string => {
  const [ns, path] = key.split(':')
  expect(ns).toBe('simulation')
  const value = path
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], simulationEn)
  if (typeof value !== 'string') throw new Error(`missing simulation namespace key: ${key}`)
  return value
}

describe('process refusal reason', () => {
  it('no items → the add-item reason', () => {
    const reason = processRefusal({ itemCount: 0, pending: false })
    expect(reason).toBe('simulation:process.refused.noItems')
    expect(shipped(reason!)).toBe('Add an item first')
  })

  it('run in flight → the in-progress reason', () => {
    const reason = processRefusal({ itemCount: 2, pending: true })
    expect(reason).toBe('simulation:process.refused.running')
    expect(shipped(reason!)).toBe('A run is already in progress')
  })

  it('a run in flight is the reason even with the basket emptied under it', () => {
    expect(processRefusal({ itemCount: 0, pending: true })).toBe('simulation:process.refused.running')
  })

  it('otherwise enabled', () => {
    expect(processRefusal({ itemCount: 1, pending: false })).toBeNull()
  })
})

describe('the Process command', () => {
  const run = () => {}

  it('carries the handler only when it can run — enablement is the handler being present', () => {
    const ready = processCommand({ reason: processRefusal({ itemCount: 1, pending: false }), run })
    expect(ready.run).toBe(run)
    expect(ready.reason).toBeNull()

    const empty = processCommand({ reason: processRefusal({ itemCount: 0, pending: false }), run })
    expect(empty.run).toBeNull()
    expect(empty.reason).toBe('simulation:process.refused.noItems')

    const running = processCommand({ reason: processRefusal({ itemCount: 3, pending: true }), run })
    expect(running.run).toBeNull()
    expect(running.reason).toBe('simulation:process.refused.running')
  })

  it('is labelled with the button’s own word, Process', () => {
    expect(shipped(processCommand({ reason: null, run }).label)).toBe('Process')
  })

  it('is bound to Ctrl+Enter, which the registry accepts on a screen with no single keys', () => {
    const command = processCommand({ reason: null, run })
    expect(command.keys).toBe(PROCESS_KEYS)
    expect(keyRefusal(PROCESS_KEYS, { singleKeyScreen: false })).toBeNull()
    expect(bindKeys([command], { singleKeyScreen: false }).bound.get('Ctrl+Enter')).toBe(command)
  })

  it('is a listed act: never hidden, never terminal', () => {
    const command = processCommand({ reason: null, run })
    expect(command.hidden).toBeFalsy()
    expect(command.terminal).toBeFalsy()
  })
})
