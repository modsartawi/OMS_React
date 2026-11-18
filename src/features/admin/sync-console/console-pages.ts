/**
 * The console's own page links (ticket 447) and which of them a holder sees — pure, so the gating is pinned by a test
 * (`store-db/access.test.ts`) rather than only by a drive. `ConsoleNav` draws them.
 *
 * New store is the wizard, which is nothing but controls: a holder who may onboard nothing (`wizardStart` is `null`)
 * is not shown the link. Replay (spec 470) is shown only with `canReplay`. Store database (oms 915, BackOffice spec
 * 4016) only with its own View grant, which the console's leaf does not imply.
 */
import type { Permissions } from '@/core/permissions'
import { canReplayReceipts, canViewStoreDb } from './access'
import { wizardStart } from './onboard-helpers'
import { REPLAY_PATH } from './replay-draft'

export const CONSOLE_PAGES = [
  { to: '/admin/sync', key: 'fleet', end: true },
  { to: '/admin/sync/passes', key: 'passes', end: false },
  { to: '/admin/sync/commands', key: 'commands', end: false },
  { to: '/admin/sync/audit', key: 'audit', end: false },
  { to: '/admin/sync/new-store', key: 'newStore', end: false },
  { to: '/admin/sync/pending', key: 'pending', end: false },
  { to: '/admin/sync/objects', key: 'objects', end: false },
  { to: '/admin/sync/scripts', key: 'scripts', end: false },
  { to: REPLAY_PATH, key: 'replay', end: false },
  { to: '/admin/sync/database', key: 'database', end: false },
] as const

export type ConsolePage = (typeof CONSOLE_PAGES)[number]

/** The pages a holder is shown, in the bar's order. */
export function consolePages(permissions: Permissions): ConsolePage[] {
  const canOnboardAny = wizardStart(permissions, null) !== null
  const canReplay = canReplayReceipts(permissions)
  const canDatabase = canViewStoreDb(permissions)
  return CONSOLE_PAGES.filter(
    (p) =>
      (p.key !== 'newStore' || canOnboardAny) && (p.key !== 'replay' || canReplay) && (p.key !== 'database' || canDatabase),
  )
}
