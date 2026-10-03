import { useEffect } from 'react'
import { useMatches, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import CommandPalette from '@/core/commands/CommandPalette'
import ShortcutsSheet from '@/core/commands/ShortcutsSheet'
import { reportRefusals, useKeyLayer } from '@/core/commands/key-layer'
import { bindKeys } from '@/core/commands/keys'
import { closePalette, paletteOrigin, returnPaletteFocus, usePalette, usePaletteHost } from '@/core/commands/palette-store'
import { singleKeyScreenOf, type PaletteRow } from '@/core/commands/palette-model'
import { useRegisteredCommands } from '@/core/commands/registry'
import { openShortcuts } from '@/core/commands/shortcuts-sheet'
import { omsAccessQuery } from '@/core/oms/api'
import { MENU } from './menu-model'
import { paletteGroups } from './palette-groups'
import { useVisibleMenu } from './useVisibleMenu'

/** The palette row's act: the sheet hands focus back to where the PALETTE was opened from. */
const openShortcutsFromPalette = () => openShortcuts(paletteOrigin())

/**
 * The app-wide palette's host (ticket 392, spec 380 K7): mounted once by `ProtectedLayout`
 * on every signed-in route that does not opt out, so it reaches chromeless screens too.
 * It binds the key layer for as long as it is mounted (393: Ctrl+K, `?` and every mounted
 * command's `keys`), composes the groups — the mounted page's commands, the rail's own
 * menu, the detail grant — into the core palette, and hosts the shortcuts sheet.
 *
 * Both reads are the ones the rail already makes, on the same keys and options, so the
 * palette costs no request of its own: `useVisibleMenu` is the rail's call, and the OMS
 * probe matches the Deliveries leaf's (and both OMS pages') `staleTime: Infinity`,
 * `retry: false` — a second answer that failed would empty the nav under an open screen.
 */
export default function CommandPaletteHost() {
  usePaletteHost()
  // Only the list and Delivery details have single keys (365 §2), flagged on their routes.
  const singleKeyScreen = singleKeyScreenOf(useMatches().map((m) => m.handle))
  useKeyLayer(singleKeyScreen)
  const navigate = useNavigate()
  const open = usePalette((s) => s.open)
  const commands = useRegisteredCommands()
  const menu = useVisibleMenu(MENU)
  const detail = useQuery(omsAccessQuery())

  // K3: a refused key is a dev-time error, raised once per refusal.
  useEffect(() => reportRefusals(bindKeys(commands, { singleKeyScreen }).refused), [commands, singleKeyScreen])

  const compose = (query: string, textOf: (row: PaletteRow) => string) =>
    paletteGroups({
      commands,
      singleKeyScreen,
      openShortcuts: openShortcutsFromPalette,
      menu: menu.items,
      detail,
      query,
      textOf,
      navigate: (to) => void navigate(to),
    })
  return (
    <>
      {/* `returnPaletteFocus` is a module function, so stable: a dependency of the palette's open/close effect. */}
      <CommandPalette open={open} onClose={closePalette} compose={compose} returnFocus={returnPaletteFocus} />
      <ShortcutsSheet commands={commands} singleKeyScreen={singleKeyScreen} />
    </>
  )
}
