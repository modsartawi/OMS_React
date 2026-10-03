/**
 * The palette's app-wide groups, composed where the app is composed (ticket 392, spec
 * 380 K1, K8, K10–K12; ruling 364 §1–§3).
 *
 * `@/core/commands` owns the palette and knows no route and no grant; `layout/` — the
 * composition root, which already reads the menu and its probes — turns them into rows:
 *
 * - **Go to** is the **same `useVisibleMenu` result the rail draws** (K10), so the
 *   palette and the nav can never disagree. Each leaf's probe already fails closed there.
 * - **Jump to number** yields *Open delivery N* and *Open document N*, which navigate
 *   straight to the existing routes with no read (K11); the destination page answers
 *   not-found or denied. It lands on Delivery details, so it follows **`canOpenDetail`**.
 *
 * 🚩 **Pending or errored probes fail closed** (K12): the group is hidden until the probe
 * confirms. The palette only hides; the server's grant filters stay the boundary.
 */
import { FileText, Truck } from 'lucide-react'
import { commandRow, composePalette, jumpNumberOf, type Command, type PaletteGroup, type PaletteRow } from '@/core/commands/palette-model'
import type { OmsAccessResult } from '@/core/models/oms-access'
import type { ShellMenuItem } from './menu-model'
import type { ProbeState } from './useVisibleMenu'

/** Every leaf of the (already permission-filtered) menu, named under the group it sits in. */
export function gotoRows(items: readonly ShellMenuItem[], navigate: (to: string) => void): PaletteRow[] {
  const rows: PaletteRow[] = []
  const walk = (list: readonly ShellMenuItem[], context: string | null) => {
    for (const item of list) {
      if (item.items) walk(item.items, item.labelKey)
      else if (item.routerLink) {
        const to = item.routerLink
        rows.push({
          id: `goto:${to}`,
          group: 'goto',
          label: item.labelKey,
          context,
          value: null,
          icon: item.icon ?? null,
          enabled: true,
          reason: null,
          run: () => navigate(to),
        })
      }
    }
  }
  walk(items, null)
  return rows
}

/** `canOpenDetail`, read off the shared OMS probe — `true` only once it has answered yes. */
export function detailGranted(probe: ProbeState): boolean {
  if (!probe.isSuccess) return false
  // Read defensively: a malformed answer is a denial.
  const data = probe.data as Partial<OmsAccessResult> | null | undefined
  return data?.canOpenDetail === true
}

/** The two Jump rows for a typed number, or none. */
export function jumpRows(query: string, navigate: (to: string) => void): PaletteRow[] {
  const n = jumpNumberOf(query)
  if (n === null) return []
  const row = (kind: 'delivery' | 'document', icon: typeof Truck): PaletteRow => ({
    id: `jump:${kind}`,
    group: 'jump',
    label: `common:palette.jump.${kind}`,
    context: null,
    value: n,
    icon,
    enabled: true,
    reason: null,
    run: () => navigate(`/oms/${kind}/${n}`),
  })
  return [row('delivery', Truck), row('document', FileText)]
}

/** This screen → Go to → Jump, each behind its gate. */
export function paletteGroups(input: {
  commands: readonly Command[]
  /** `useVisibleMenu(MENU).items` — what the rail draws. */
  menu: readonly ShellMenuItem[]
  /** The OMS access probe (`OMS_ACCESS_KEY`), as react-query reports it. */
  detail: ProbeState
  query: string
  textOf: (row: PaletteRow) => string
  navigate: (to: string) => void
}): PaletteGroup[] {
  return composePalette({
    screen: input.commands.map(commandRow),
    goto: gotoRows(input.menu, input.navigate),
    jump: detailGranted(input.detail) ? jumpRows(input.query, input.navigate) : [],
    query: input.query,
    textOf: input.textOf,
  })
}
