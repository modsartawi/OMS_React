/**
 * The command registry's bookkeeping (ticket 392, spec 380 K1): a page's commands
 * are registered while it is mounted and gone when it unmounts, and a re-render
 * replaces them in place rather than moving them.
 */
import { describe, expect, it } from 'vitest'
import { registeredCommands, withCommands, withoutOwner } from './registry'

const cmd = (id: string) => ({ id, label: id })

describe('registryTracksMountedPages', () => {
  it('lists commands in the order their pages registered them', () => {
    let entries = withCommands([], 'a', [cmd('a1'), cmd('a2')])
    entries = withCommands(entries, 'b', [cmd('b1')])
    expect(registeredCommands(entries).map((c) => c.id)).toEqual(['a1', 'a2', 'b1'])
  })

  // A page re-registers on every render, so its commands see its current state.
  it('a re-registration replaces that page’s commands in place', () => {
    let entries = withCommands([], 'a', [cmd('a1')])
    entries = withCommands(entries, 'b', [cmd('b1')])
    entries = withCommands(entries, 'a', [cmd('a1'), cmd('a3')])
    expect(registeredCommands(entries).map((c) => c.id)).toEqual(['a1', 'a3', 'b1'])
  })

  it('unmounting removes that page’s commands and nobody else’s', () => {
    let entries = withCommands([], 'a', [cmd('a1')])
    entries = withCommands(entries, 'b', [cmd('b1')])
    expect(registeredCommands(withoutOwner(entries, 'a')).map((c) => c.id)).toEqual(['b1'])
    expect(withoutOwner(entries, 'nobody')).toBe(entries)
  })
})
