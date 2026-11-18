/**
 * The store sync console's grants (oms 914, BackOffice spec 4002 brief row 1): read off the ONE permissions answer
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

// ── Store database (oms 915, BackOffice spec 4016 D9) ───────────────────────────
// 🚩 The keys are GUESSED: BO names the grants StoreDatabase.View / .Act / .Restore (each its own controller under
// `BackOfficeScreen`), not their `CONTROLLER:COMMAND` spelling. Reconcile when BO writes the 4016 brief.

/** `StoreDatabase.View` — the Store database tab, its store page and every read. */
export const canViewStoreDb = (p: Permissions): boolean => p.has('StoreDatabase:03')

/** `StoreDatabase.Act` — Check now, the jobs and the backup schedule. Counts only beside View: the page needs it. */
export const canActStoreDb = (p: Permissions): boolean => canViewStoreDb(p) && p.has('StoreDatabase:06')

/** `StoreDatabase.Restore` — restore a backup as a side copy. Counts only beside View, as Act does. */
export const canRestoreStoreDb = (p: Permissions): boolean => canViewStoreDb(p) && p.has('StoreDatabaseRestore:06')
