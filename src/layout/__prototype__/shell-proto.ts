/* PROTOTYPE — throwaway (map 580, ticket 587). Never merge to main.
 * Which rail look and which mark the shell carries; persisted per browser so a reload keeps it.
 */
import { create } from 'zustand'

export type ShellLook = 'flat' | 'pill'
export type ShellMark = 'aldawaa' | 'dmsco' | 'both'

function read<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T | null) ?? fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* private window — just won't persist */
  }
}

interface ShellProto {
  look: ShellLook
  mark: ShellMark
  setLook: (l: ShellLook) => void
  setMark: (m: ShellMark) => void
}

export const useShellProto = create<ShellProto>((set) => ({
  look: read<ShellLook>('proto.shell.look', 'pill'),
  mark: read<ShellMark>('proto.shell.mark', 'dmsco'),
  setLook: (look) => {
    write('proto.shell.look', look)
    set({ look })
  },
  setMark: (mark) => {
    write('proto.shell.mark', mark)
    set({ mark })
  },
}))
