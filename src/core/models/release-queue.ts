/**
 * The release download queue's wire shapes (BackOffice spec 3396, ticket 3401; oms-react ticket 791).
 *
 * Field for field from `Sartawi.Retail.Data/Modules/PosRelease/Models/DownloadSlotAdminModels.cs`, camelCase as
 * SIS.Api serializes them. Every stamp is HQ's LOCAL wall-clock as stored (no `Z`); every wait and duration is
 * whole seconds off HQ's clock, so the page never subtracts times itself.
 */

/** `GET PosReleaseQueue/Access` — cookie only, not grant-gated. */
export interface ReleaseQueueAccess {
  /** `PosRelease.Queue.View` — the page. */
  canView: boolean
  /** `PosRelease.Queue.Manage` — the controls (ticket 792). */
  canManage: boolean
}

/** What a till may fetch under a slot. */
export type SlotPackage = 'pos' | 'dashboard'

/** `GET PosReleaseQueue/Pool`. */
export interface SlotPool {
  poolName: string
  /** Slots; 0 = every download paused. */
  poolSize: number
  paused: boolean
  /** No pool row: the default size (40); `updatedAt` / `updatedBy` are then empty. */
  isDefault: boolean
  updatedAt: string | null
  updatedBy: string
  /** Slots in use right now. */
  activeSlots: number
}

/** One slot in use — `GET PosReleaseQueue/Slots`, oldest grant first. */
export interface LiveSlot {
  leaseId: string
  storeCode: string
  machineCode: string
  package: SlotPackage | string
  channel: string
  fromVersion: string
  toVersion: string
  grantedAt: string
  renewedAt: string
  expiresAt: string
  progressPercent: number
}

/** `GET PosReleaseQueue/Queue` — the waiting tills in grant order. */
export interface SlotQueue {
  queueLength: number
  /** The longest wait so far, seconds; 0 when nobody waits. */
  oldestWaitSeconds: number
  entries: SlotQueueEntry[]
}

export interface SlotQueueEntry {
  /** 1 = served next — the grant's own order. */
  position: number
  storeCode: string
  machineCode: string
  package: SlotPackage | string
  toVersion: string
  urgent: boolean
  firstAskedAt: string
  lastAskedAt: string
  /** Since the till first asked. */
  waitSeconds: number
  waitedOverFourHours: boolean
}

/** A finished lease's state, as `History` answers it. */
export type SlotOutcome = 'released-done' | 'released-failed' | 'expired' | 'freed-by-hand'

/** The `outcome` filter `History` takes (the short forms of the four states). */
export type SlotOutcomeFilter = 'done' | 'failed' | 'expired' | 'freed-by-hand'

/** `GET PosReleaseQueue/History?outcome=&store=&version=&skip=&take=` — most recently ended first. */
export interface SlotHistoryPage {
  /** Every finished lease the filters match, across all pages. */
  total: number
  skip: number
  take: number
  rows: SlotHistoryRow[]
}

export interface SlotHistoryRow {
  leaseId: string
  storeCode: string
  machineCode: string
  package: SlotPackage | string
  channel: string
  fromVersion: string
  toVersion: string
  grantedAt: string
  endedAt: string
  durationSeconds: number
  outcome: SlotOutcome | string
  progressPercent: number
  /** For `released-failed`; '' otherwise. */
  failureReason: string
  /** For `freed-by-hand`; '' otherwise. */
  freedBy: string
}

/** `GET PosReleaseQueue/Convergence` — one row per package and to-version; counts are distinct tills. */
export interface SlotConvergence {
  package: SlotPackage | string
  toVersion: string
  downloaded: number
  downloading: number
  waiting: number
}
