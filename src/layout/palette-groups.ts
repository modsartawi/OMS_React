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
 * - **Open loyalty member N** (ticket 427) is the third Jump row, LAST, so an OMS user's
 *   *number + Enter opens the delivery* is unchanged. It lands on the Loy lookup, so it
 *   follows **`canOpenLoyMember`** — each Jump row follows its own landing page's gate, and
 *   a Loy-only session sees it alone. It is the one row that cannot navigate to a record:
 *   a typed number may be a mobile, so it hands the key over as router state and the Loy
 *   page resolves it. It accepts what the Loy field accepts (`+966 55 …`), and it never
 *   enters Recent — a loyalty key is a customer's mobile (239).
 * - **Recent** (394, K9) is the last five numbers opened through Delivery details, read
 *   from `@/core/commands/recent`. Every row lands on Delivery details too, so the group
 *   follows **`canOpenDetail`**, re-read on every open: a revoked grant hides the history.
 *
 * 🚩 **Pending or errored probes fail closed** (K12): the group is hidden until the probe
 * confirms. The palette only hides; the server's grant filters stay the boundary.
 */
import { FileText, Truck, UserSearch, type LucideIcon } from 'lucide-react'
import { bindKeys } from '@/core/commands/keys'
import type { RecentKind, RecentRecord } from '@/core/commands/recent'
import {
  composePalette,
  jumpNumberOf,
  screenRows,
  shortcutsRow,
  type Command,
  type PaletteGroup,
  type PaletteRow,
} from '@/core/commands/palette-model'
import type { OmsAccessResult } from '@/core/models/oms-access'
import type { LoyAccessResult } from '@/core/models/loy'
// `layout` is the composition root and may reach into a feature (feature-structure).
import { canOpenLoyMember } from '@/features/loy/member/api'
import { memberLookupKeyOf, memberLookupState } from '@/features/loy/member/lookup-intent'
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

/** `canOpenLoyMember`, read off the Loy probe — `true` only once it has answered yes. */
export function memberGranted(probe: ProbeState): boolean {
  return probe.isSuccess && canOpenLoyMember(probe.data as LoyAccessResult | null | undefined)
}

/** The palette's navigation: a route, and optionally the router state to land with. */
export type PaletteNavigate = (to: string, state?: unknown) => void

/** Each record kind's icon — the same on its Jump row and its Recent row. */
const KIND_ICON: Readonly<Record<RecentKind, LucideIcon>> = { delivery: Truck, document: FileText }

/**
 * *Open delivery N* / *Open document N* — the row that navigates straight to a record's
 * route, where the page answers not-found or denied. Jump and Recent both draw it, so a
 * Recent row reads exactly like the Jump row for the same number.
 */
function openRecordRow(
  id: string,
  group: 'jump' | 'recent',
  { kind, no }: RecentRecord,
  navigate: (to: string) => void,
): PaletteRow {
  return {
    id,
    group,
    label: `common:palette.jump.${kind}`,
    context: null,
    value: no,
    icon: KIND_ICON[kind],
    enabled: true,
    reason: null,
    run: () => navigate(`/oms/${kind}/${no}`),
  }
}

/** The two Jump rows for a typed number, or none. */
export function jumpRows(query: string, navigate: (to: string) => void): PaletteRow[] {
  const no = jumpNumberOf(query)
  if (no === null) return []
  return (['delivery', 'document'] as const).map((kind) => openRecordRow(`jump:${kind}`, 'jump', { kind, no }, navigate))
}

/**
 * *Open loyalty member N* for a typed key, or none. 🚩 The key goes in router STATE: a
 * mobile is personal data and must never reach the URL, the history or a log.
 */
export function memberJumpRow(query: string, navigate: PaletteNavigate): PaletteRow | null {
  const typed = memberLookupKeyOf(query)
  if (typed === null) return null
  return {
    id: 'jump:member',
    group: 'jump',
    label: 'common:palette.jump.member',
    context: null,
    value: typed,
    icon: UserSearch,
    enabled: true,
    reason: null,
    run: () => navigate('/loy/members', memberLookupState(typed)),
  }
}

/** The Recent rows, newest first: each reopens its own route, where the page applies its own gate. */
export function recentRows(records: readonly RecentRecord[], navigate: (to: string) => void): PaletteRow[] {
  return records.map((record) => openRecordRow(`recent:${record.kind}:${record.no}`, 'recent', record, navigate))
}

/**
 * The records a query keeps. A typed NUMBER keeps only the record that IS that number:
 * Recent sits above Jump and the first row is aimed, so a recent `80001237` must not
 * take `Enter` from someone who typed `8000123` to jump there. Words are left to the
 * palette's own filter.
 */
export function recentNarrowedByNumber(records: readonly RecentRecord[], query: string): readonly RecentRecord[] {
  const n = jumpNumberOf(query)
  return n === null ? records : records.filter((record) => record.no === n)
}

/**
 * This screen → Recent → Go to → Jump, each behind its gate. This screen is the mounted
 * page's commands (hidden ones aside), each hinting the key it is bound to, then the row
 * that opens the shortcuts sheet (393).
 */
export function paletteGroups(input: {
  commands: readonly Command[]
  /** The matched route is a single-key screen (365 §2): its letters bind, and `?` is live. */
  singleKeyScreen: boolean
  /** Opens the shortcuts sheet. */
  openShortcuts: () => void
  /** The signed-in user's Recent store, newest first (`loadRecent`). */
  recent: readonly RecentRecord[]
  /** `useVisibleMenu(MENU).items` — what the rail draws. */
  menu: readonly ShellMenuItem[]
  /** The OMS access probe (`OMS_ACCESS_KEY`), as react-query reports it. */
  detail: ProbeState
  /** The Loy access probe (`LOY_ACCESS_KEY`), as react-query reports it (427). */
  member: ProbeState
  query: string
  textOf: (row: PaletteRow) => string
  navigate: PaletteNavigate
}): PaletteGroup[] {
  // Recent and the record Jump rows land on Delivery details; a pending or errored probe
  // hides them. The member row lands on the Loy lookup, behind its own probe.
  const detail = detailGranted(input.detail)
  const member = memberGranted(input.member) ? memberJumpRow(input.query, input.navigate) : null
  return composePalette({
    screen: [
      ...screenRows(input.commands, bindKeys(input.commands, { singleKeyScreen: input.singleKeyScreen })),
      shortcutsRow(input.openShortcuts, { singleKeyScreen: input.singleKeyScreen }),
    ],
    recent: detail ? recentRows(recentNarrowedByNumber(input.recent, input.query), input.navigate) : [],
    goto: gotoRows(input.menu, input.navigate),
    jump: [...(detail ? jumpRows(input.query, input.navigate) : []), ...(member ? [member] : [])],
    query: input.query,
    textOf: input.textOf,
  })
}
