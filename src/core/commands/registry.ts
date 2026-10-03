/**
 * The command registry (ticket 392, spec 380 K1): the commands of the mounted pages,
 * which are the palette's whole "This screen" group.
 *
 * A Page calls `useCommands([...])` on every render. Its commands are registered while it
 * is mounted — replaced in place on each render, so a handler sees the page's current
 * state (the selected row) — and unregistered when it unmounts. Nothing else feeds the
 * group, and features never import each other to reach it.
 */
import { useEffect, useId, useMemo } from 'react'
import { create } from 'zustand'
import type { Command } from './palette-model'

/** One mounted page's commands. `owner` is that page's `useId`. */
export interface RegistryEntry {
  owner: string
  commands: readonly Command[]
}

/** Registers (or re-registers, in place) one page's commands. */
export function withCommands(
  entries: readonly RegistryEntry[],
  owner: string,
  commands: readonly Command[],
): RegistryEntry[] {
  const at = entries.findIndex((e) => e.owner === owner)
  if (at === -1) return [...entries, { owner, commands }]
  return entries.map((e, i) => (i === at ? { owner, commands } : e))
}

/** Unregisters one page's commands. Unchanged (the same array) when it had none. */
export function withoutOwner(entries: readonly RegistryEntry[], owner: string): readonly RegistryEntry[] {
  return entries.some((e) => e.owner === owner) ? entries.filter((e) => e.owner !== owner) : entries
}

/** Every registered command, in the order the pages registered. */
export function registeredCommands(entries: readonly RegistryEntry[]): Command[] {
  return entries.flatMap((e) => e.commands)
}

const useRegistry = create<{ entries: readonly RegistryEntry[] }>(() => ({ entries: [] }))

/**
 * Registers the calling page's commands for as long as it is mounted. Pass the commands
 * as the page sees them on this render; there is nothing to memoise.
 */
export function useCommands(commands: readonly Command[]): void {
  const owner = useId()
  // Every commit, so the handlers the palette runs are this render's.
  useEffect(() => {
    useRegistry.setState((s) => ({ entries: withCommands(s.entries, owner, commands) }))
  })
  useEffect(
    () => () => useRegistry.setState((s) => ({ entries: withoutOwner(s.entries, owner) })),
    [owner],
  )
}

/** The registered commands as they stand — for the key layer, which reads them per press. */
export function registeredNow(): Command[] {
  return registeredCommands(useRegistry.getState().entries)
}

/** The registered commands, for the palette's host. */
export function useRegisteredCommands(): Command[] {
  const entries = useRegistry((s) => s.entries)
  return useMemo(() => registeredCommands(entries), [entries])
}
