import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import CommandPalette from '@/core/commands/CommandPalette'
import { closePalette, returnPaletteFocus, usePalette, usePaletteHost } from '@/core/commands/palette-store'
import { useRegisteredCommands } from '@/core/commands/registry'
import type { PaletteRow } from '@/core/commands/palette-model'
import { omsAccessQuery } from '@/core/oms/api'
import { MENU } from './menu-model'
import { paletteGroups } from './palette-groups'
import { useVisibleMenu } from './useVisibleMenu'

/**
 * The app-wide palette's host (ticket 392, spec 380 K7): mounted once by `ProtectedLayout`
 * on every signed-in route that does not opt out, so it reaches chromeless screens too.
 * It binds Ctrl+K for as long as it is mounted, and composes the groups — the mounted
 * page's commands, the rail's own menu, the detail grant — into the core palette.
 *
 * Both reads are the ones the rail already makes, on the same keys and options, so the
 * palette costs no request of its own: `useVisibleMenu` is the rail's call, and the OMS
 * probe matches the Deliveries leaf's (and both OMS pages') `staleTime: Infinity`,
 * `retry: false` — a second answer that failed would empty the nav under an open screen.
 */
export default function CommandPaletteHost() {
  usePaletteHost()
  const navigate = useNavigate()
  const open = usePalette((s) => s.open)
  const commands = useRegisteredCommands()
  const menu = useVisibleMenu(MENU)
  const detail = useQuery(omsAccessQuery())

  const compose = (query: string, textOf: (row: PaletteRow) => string) =>
    paletteGroups({ commands, menu: menu.items, detail, query, textOf, navigate: (to) => void navigate(to) })
  // A module function, so stable: it is a dependency of the palette's open/close effect.
  return <CommandPalette open={open} onClose={closePalette} compose={compose} returnFocus={returnPaletteFocus} />
}
