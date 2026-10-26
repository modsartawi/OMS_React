/**
 * The hand-back to ActionSync, pure (spec 558, ticket 565): which stores of an Apply campaign go
 * back to ActionSync and which stay paused for a person, with why; the tagged Resume batches; and
 * the paging that reads EVERY job of the campaign (the split must not depend on the page shown).
 * No React, no network — pinned by `handback-helpers.test.ts`.
 */
import type { StoreControlRequest } from '@/core/models/sync-console'
import { DATA_SYNC_PAGE_SIZE, type Job, type Mode } from '@/core/models/data-sync'
import { campaignControlReason, storeControlBatches } from './apply-helpers'
import { isTerminalJob, storeLabel } from './job-helpers'

/**
 * Why a store stays paused. `notResumable` covers both of DataSync's reasons (engine spec §7.4):
 * ActionSync's control changed since the job began, or the store's latest ActionSync control is
 * not this campaign's tag — the job carries only the one flag, so the screen cannot tell them apart.
 */
export type StayPausedWhy = 'failed' | 'cancelled' | 'inFlight' | 'notResumable'

export interface HandBackStore {
  /** As ActionSync knows the store (the control door takes codes). */
  code: string
  /** `client/code`, as the jobs grid shows it. */
  store: string
  jobId: string
}

export interface StayPausedStore extends HandBackStore {
  why: StayPausedWhy
}

export interface HandBackSplit {
  /** Jobs `Succeeded` with `actionSyncResumable` — pre-selected for the Resume. */
  handBack: HandBackStore[]
  /** Every other job's store, with why, in the jobs' order. */
  stayPaused: StayPausedStore[]
  /** Jobs not finished yet (they are among `stayPaused` as `inFlight`). */
  inFlight: number
}

/**
 * An Apply campaign's jobs → the hand-back set and the stay-paused set. A report-only campaign
 * paused nothing on ActionSync, so it gives neither.
 */
export function handBackSplit(mode: Mode, jobs: readonly Job[]): HandBackSplit {
  const out: HandBackSplit = { handBack: [], stayPaused: [], inFlight: 0 }
  if (mode !== 'Apply') return out
  for (const j of jobs) {
    const s: HandBackStore = { code: j.store.code, store: storeLabel(j.store), jobId: j.jobId }
    if (j.status === 'Succeeded') {
      if (j.actionSyncResumable) out.handBack.push(s)
      else out.stayPaused.push({ ...s, why: 'notResumable' })
    } else if (j.status === 'Failed') out.stayPaused.push({ ...s, why: 'failed' })
    else if (j.status === 'Cancelled') out.stayPaused.push({ ...s, why: 'cancelled' })
    else if (!isTerminalJob(j.status)) {
      out.stayPaused.push({ ...s, why: 'inFlight' })
      out.inFlight++
    } else out.stayPaused.push({ ...s, why: 'notResumable' })
  }
  return out
}

/** The Resume batches (≤ 50 codes each), tagged `DataSync campaign <id>: <reason>` like the pause. */
export const handBackBatches = (campaignId: string, reason: string, codes: readonly string[]): StoreControlRequest[] =>
  storeControlBatches('Resume', codes, campaignControlReason(campaignId, reason))

/** A ceiling on the paging, so a misbehaving door can never loop the dialog forever (10,000 stores). */
const MAX_PAGES = 200

/**
 * Every job of a campaign, read page by page (50 a page, the door's own size) until a short or
 * empty page — the door has no total. `fetchPage` is the call, injected.
 */
export async function allCampaignJobs(fetchPage: (page: number) => Promise<Job[]>): Promise<Job[]> {
  const jobs: Job[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const rows = await fetchPage(page)
    jobs.push(...rows)
    if (rows.length < DATA_SYNC_PAGE_SIZE) break
  }
  return jobs
}
