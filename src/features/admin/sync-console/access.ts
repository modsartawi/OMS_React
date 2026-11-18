/**
 * The store sync console's grants (oms 909, BackOffice spec 4002 brief row 1): read off the ONE permissions answer
 * (`@/core/permissions`), never `ActionSync/Access`. Apart from `./api` so the pure helpers can read them without a
 * cycle through the api module. The nav leaf and every page gate read `canOpenSyncConsole`.
 */
import type { Permissions } from '@/core/permissions'

/** `ActionSync.Health.View` — the menu leaf, every page gate and every read. */
export const canOpenSyncConsole = (p: Permissions): boolean => p.has('ActionSyncConsole:03')

/** `ActionSync.Operate` — every control and command. */
export const canOperateSyncConsole = (p: Permissions): boolean => p.has('ActionSyncConsole:06')

/** `Store.Onboard` — the store-master step and Edit store. */
export const canOnboardStores = (p: Permissions): boolean => p.has('StoreOnboard:06')

/** `ActionSync.Replay` (spec 470) — the Replay page and its nav link. Independent of Operate. */
export const canReplayReceipts = (p: Permissions): boolean => p.has('ReceiptReplay:06')

/** `ActionSync.EnrollObject` (BackOffice 2558) — Enrol on the Objects page. Independent of Operate. */
export const canEnrolObjects = (p: Permissions): boolean => p.has('SyncObjectEnrol:06')

/** `ActionSync.RunStoreScript` (spec 3202 D3) — Send, Withdraw and Retry on the Scripts page. Independent of Operate. */
export const canRunStoreScripts = (p: Permissions): boolean => p.has('SyncStoreScript:06')
